// deno test supabase/functions/_shared/esa-invoice-issue.test.ts
// The issue-or-void sequence, idempotency helpers and the hourly cap, with fakes (no network).
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ESA_INVOICE_HOURLY_CAP,
  hourlyCapKey,
  type IssueDeps,
  issueInvoices,
  overHourlyCap,
  parseIdempotencyKey,
  pdfPathForNumber,
  RATE_LIMITED_MESSAGE,
  submissionHash,
} from "./esa-invoice-issue.ts";
import { parseSubmission, planInvoices, secondDate } from "./esa-invoice.ts";

const addr = { line1: "123 Main St", line2: "", city: "Mesa", region: "AZ", zip: "85201" };
function sub(over: Record<string, unknown> = {}) {
  const p = parseSubmission({
    state: "AZ",
    parentName: "Jane Doe",
    email: "jane@example.com",
    address: addr,
    students: [{ first: "Sam", last: "Doe", choice: "set" }, { first: "Ava", last: "Doe", choice: "notebook" }],
    ...over,
  });
  if (!p.ok) throw new Error(p.error);
  return p.value;
}

type Log = string[];
function fakes(opts: { failRenderAt?: number; failUploadAt?: number; failFinishOk?: boolean } = {}) {
  const log: Log = [];
  let n = 0;
  const rows = new Map<string, { number: string; status: string; pdf_path?: string }>();
  const stored = new Set<string>();
  const alerts: { subject: string; lines: string[] }[] = [];
  const deps: IssueDeps = {
    insertPending: (row, testNumber) => {
      n++;
      const number = testNumber ?? `ET-AZ-2026-${String(n).padStart(3, "0")}`;
      rows.set(`id${n}`, { number, status: "pending" });
      log.push(`insert ${number} ${row.student_name}`);
      return Promise.resolve({ id: `id${n}`, invoice_number: number });
    },
    render: (_plan, number) => {
      log.push(`render ${number}`);
      if (opts.failRenderAt && n === opts.failRenderAt) return Promise.reject(new Error("render blew up"));
      return Promise.resolve(new Uint8Array([1, 2, 3]));
    },
    upload: (path) => {
      log.push(`upload ${path}`);
      if (opts.failUploadAt && n === opts.failUploadAt) return Promise.reject(new Error("storage 503"));
      stored.add(path);
      return Promise.resolve();
    },
    setPdfPath: (id, path) => {
      rows.get(id)!.pdf_path = path;
      return Promise.resolve();
    },
    finish: (ok, error) => {
      log.push(`finish ${ok}${error ? ` ${error}` : ""}`);
      if (ok && opts.failFinishOk) return Promise.reject(new Error("finish 500"));
      const changed: string[] = [];
      for (const r of rows.values()) {
        if (r.status === "pending") {
          r.status = ok ? "issued" : "void";
          changed.push(r.number);
        }
      }
      return Promise.resolve(changed);
    },
    removeObjects: (paths) => {
      log.push(`remove ${paths.join(",")}`);
      paths.forEach((p) => stored.delete(p));
      return Promise.resolve();
    },
    alertFounder: (subject, lines) => {
      alerts.push({ subject, lines });
      return Promise.resolve(true);
    },
  };
  return { deps, log, rows, stored, alerts };
}

function input(s = sub(), isTest = false) {
  return {
    submissionId: "00000000-0000-4000-8000-000000000001",
    sub: s,
    plans: planInvoices(s),
    isTest,
    invoiceDate: "2026-09-16",
    secondDate,
    testNumber: (_p: unknown, i: number) => `ET-TEST-AZ-X${i}`,
  };
}

Deno.test("success: each number gets its row BEFORE its PDF, and the batch is issued only after every PDF", async () => {
  const f = fakes();
  const issued = await issueInvoices(input(), f.deps);
  assertEquals(issued.map((i) => i.number), ["ET-AZ-2026-001", "ET-AZ-2026-002"]);
  assertEquals(f.log, [
    "insert ET-AZ-2026-001 Sam Doe",
    "render ET-AZ-2026-001",
    "upload AZ/ET-AZ-2026-001.pdf",
    "insert ET-AZ-2026-002 Ava Doe",
    "render ET-AZ-2026-002",
    "upload AZ/ET-AZ-2026-002.pdf",
    "finish true",
  ]);
  assertEquals([...f.rows.values()].map((r) => [r.status, r.pdf_path]), [["issued", "AZ/ET-AZ-2026-001.pdf"], ["issued", "AZ/ET-AZ-2026-002.pdf"]]);
  assertEquals(f.alerts.length, 0);
  assertEquals(issued[0].plan.totalCents, 26633);
  assertEquals(issued[1].plan.totalCents, 4081);
});

Deno.test("failure mid-loop: numbers recorded void (no gap), stored PDFs removed, founder alerted, error rethrown", async () => {
  const f = fakes({ failUploadAt: 2 });
  await assertRejects(() => issueInvoices(input(), f.deps), Error, "storage 503");
  assertEquals([...f.rows.values()].map((r) => [r.number, r.status]), [["ET-AZ-2026-001", "void"], ["ET-AZ-2026-002", "void"]]);
  assert(f.log.includes("remove AZ/ET-AZ-2026-001.pdf"), f.log.join("\n"));
  assertEquals(f.stored.size, 0);
  assert(!f.log.includes("finish true"));
  assertEquals(f.alerts.length, 1);
  const text = f.alerts[0].lines.join(" ");
  assert(text.includes("ET-AZ-2026-001, ET-AZ-2026-002") && text.includes("storage 503"), text);
  assert(!text.includes("Sam Doe") && !text.includes("Ava Doe"), "founder alert does not repeat student names");
});

Deno.test("a render failure before any upload removes nothing and still voids the number", async () => {
  const f = fakes({ failRenderAt: 1 });
  await assertRejects(() => issueInvoices(input(), f.deps), Error, "render blew up");
  assertEquals([...f.rows.values()].map((r) => r.status), ["void"]);
  assert(!f.log.some((l) => l.startsWith("remove")));
  assertEquals(f.alerts.length, 1);
});

Deno.test("if marking the batch issued fails, the pending rows are voided and cleaned up", async () => {
  const f = fakes({ failFinishOk: true });
  await assertRejects(() => issueInvoices(input(), f.deps), Error, "finish 500");
  assertEquals([...f.rows.values()].map((r) => r.status), ["void", "void"]);
  assertEquals(f.stored.size, 0);
});

Deno.test("test invoices take the ET-TEST number and never ask for a state number", async () => {
  const s = sub({ email: "hello+esatest@edeninstitute.health" });
  const f = fakes();
  const issued = await issueInvoices(input(s, true), f.deps);
  assertEquals(issued.map((i) => i.number), ["ET-TEST-AZ-X0", "ET-TEST-AZ-X1"]);
  assertEquals(pdfPathForNumber("ET-TEST-AZ-X0"), "AZ/ET-TEST-AZ-X0.pdf");
  assertEquals(pdfPathForNumber("ET-NH-2026-004"), "NH/ET-NH-2026-004.pdf");
  assertEquals(pdfPathForNumber("nonsense"), null);
});

Deno.test("idempotency key: only a UUID is accepted", () => {
  assertEquals(parseIdempotencyKey("3F2504E0-4F89-41D3-9A0C-0305E82C3301"), "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  assertEquals(parseIdempotencyKey("abc"), null);
  assertEquals(parseIdempotencyKey(undefined), null);
  assertEquals(parseIdempotencyKey("3f2504e0-4f89-41d3-9a0c-0305e82c3301' or 1=1"), null);
});

Deno.test("submission hash: same normalised form, same hash; any change, different hash", async () => {
  const a = await submissionHash(sub());
  assertEquals(a, await submissionHash(sub({ email: "JANE@example.com", parentName: "Jane   Doe" })));
  assert(a !== (await submissionHash(sub({ students: [{ first: "Sam", last: "Doe", choice: "set" }] }))));
  assertEquals(a.length, 64);
});

Deno.test("hourly cap: 30 per UTC hour, fails open, exact family message", () => {
  assertEquals(ESA_INVOICE_HOURLY_CAP, 30);
  assertEquals(hourlyCapKey(new Date("2026-09-16T14:59:59Z")), "esa_invoice_global:2026-09-16T14");
  assertEquals(overHourlyCap(30), false);
  assertEquals(overHourlyCap(31), true);
  assertEquals(overHourlyCap(null), false);
  assertEquals(
    RATE_LIMITED_MESSAGE,
    "We are getting a lot of invoice requests right now. Please try again in a few minutes, or email hello@edeninstitute.health.",
  );
});
