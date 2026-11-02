// Run with: deno test supabase/functions/_shared/refund-amount.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { refundDeltaFromEvent, RefundLike, thisRefundCents } from "./refund-amount.ts";

const never = (): Promise<RefundLike | null> => {
  throw new Error("refunds.list must not be called when the event carries previous_attributes");
};

Deno.test("first refund on a charge: the whole running total is this refund", async () => {
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 4271 }, { amount_refunded: 0 }, never), 4271);
});

Deno.test("second partial refund records only the new money, not the running total", async () => {
  // $5 back, then $12 more: Stripe's amount_refunded reads 1700 on the second event.
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 1700 }, { amount_refunded: 500 }, never), 1200);
});

Deno.test("partial refund followed by the rest records the remainder", async () => {
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 26100 }, { amount_refunded: 1200 }, never), 24900);
});

Deno.test("the refund rows for one charge add up to Stripe's final total (the old logic did not)", async () => {
  const charge = 26100;
  const refunds = [500, 1200, 24400];
  let total = 0;
  let newRows = 0;
  let oldRows = 0;
  for (const r of refunds) {
    const before = total;
    total += r;
    newRows += (await thisRefundCents({ id: "ch_1", amount_refunded: total }, { amount_refunded: before }, never))!;
    oldRows += total; // what recordRefund wrote before the fix: charge.amount_refunded every time
  }
  assertEquals(total, charge);
  assertEquals(newRows, charge);
  assertEquals(oldRows, 500 + 1700 + 26100); // 28300, $22 more back than the $261 charge
});

Deno.test("no previous_attributes: falls back to the newest refund on that charge", async () => {
  const asked: string[] = [];
  const newest = (id: string) => {
    asked.push(id);
    return Promise.resolve({ amount: 1200 });
  };
  assertEquals(await thisRefundCents({ id: "ch_9", amount_refunded: 1700 }, undefined, newest), 1200);
  assertEquals(asked, ["ch_9"]);
});

Deno.test("previous_attributes without a numeric amount_refunded also falls back", async () => {
  const newest = () => Promise.resolve({ amount: 800 });
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 800 }, { refunded: false }, newest), 800);
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 800 }, { amount_refunded: "0" }, newest), 800);
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 800 }, null, newest), 800);
});

Deno.test("a zero or negative difference is not trusted; the newest refund answers instead", async () => {
  const newest = () => Promise.resolve({ amount: 300 });
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 1000 }, { amount_refunded: 1000 }, newest), 300);
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 1000 }, { amount_refunded: 1500 }, newest), 300);
});

Deno.test("unknown amount returns null rather than guessing", async () => {
  const none = () => Promise.resolve(null);
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 1000 }, undefined, none), null);
  const zero = () => Promise.resolve({ amount: 0 });
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 1000 }, undefined, zero), null);
  // A newest refund bigger than the running total cannot be this event's refund.
  const tooBig = () => Promise.resolve({ amount: 5000 });
  assertEquals(await thisRefundCents({ id: "ch_1", amount_refunded: 1000 }, undefined, tooBig), null);
});

Deno.test("refundDeltaFromEvent needs both numbers", () => {
  assertEquals(refundDeltaFromEvent(1700, { amount_refunded: 500 }), 1200);
  assertEquals(refundDeltaFromEvent(null, { amount_refunded: 500 }), null);
  assertEquals(refundDeltaFromEvent(1700, {}), null);
  assertEquals(refundDeltaFromEvent(1700, "500"), null);
});
