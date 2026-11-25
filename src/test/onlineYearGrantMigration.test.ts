// Online Year (punch #472) ticket OY3: the grant RPC migration keeps its security and grant rules.
// The planning rules themselves are unit tested in Deno (supabase/functions/_shared/online-year-grant.test.ts);
// this pins what the SQL must do with a plan.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..", "..", "supabase", "migrations");
const file = readdirSync(dir).find((f) => /_online_year_oy3_grant\.sql$/.test(f));
const sql = file ? readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n") : "";
const body = sql.replace(/--[^\n]*/g, "");
const SIG = "public.online_year_grant_purchase(uuid, text, text, text, timestamptz, jsonb)";

describe("Online Year grant RPC (OY3)", () => {
  it("exists, one migration, after OY1", () => {
    expect(file).toBeTruthy();
    expect(readdirSync(dir).filter((f) => /online_year_oy3/.test(f))).toHaveLength(1);
    const oy1 = readdirSync(dir).find((f) => /_online_year_oy1_schema\.sql$/.test(f))!;
    expect(file! > oy1).toBe(true);
  });

  it("SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toContain("create or replace function public.online_year_grant_purchase(");
    expect(body).toMatch(/returns jsonb\s+language plpgsql\s+security definer\s+set search_path = public, pg_temp/);
  });

  it("EXECUTE for service_role only: public, anon and authenticated revoked by the full signature", () => {
    expect(body).toContain(`revoke execute on function ${SIG} from public, anon, authenticated;`);
    expect(body).toContain(`grant execute on function ${SIG} to service_role;`);
    expect(body).not.toMatch(/grant [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it("no new table, no table grant, no policy, no blanket grant", () => {
    expect(body).not.toMatch(/create\s+(unlogged\s+)?table/i);
    expect(body).not.toMatch(/grant\s+[^;]+\s+on\s+(table\s+)?public\./i);
    expect(body).not.toMatch(/create policy/i);
    expect(body).not.toMatch(/on all tables|alter default privileges/i);
  });

  it("parent: upserted by lower(email), stored lower-cased, first license name kept", () => {
    expect(body).toContain("v_email        text := lower(btrim(coalesce(p_email, '')));");
    expect(body).toContain("on conflict ((lower(email))) do update");
    expect(body).toContain("set license_name = coalesce(p.license_name, excluded.license_name)");
  });

  it("idempotent: the insert targets the OY1 partial unique index, and the order's own licenses are skipped first", () => {
    expect(body).toContain("on conflict (order_id, band, (lower(child_name))) where order_id is not null do nothing");
    expect(body).toMatch(/where l\.order_id = p_order_id and l\.band = p_band and lower\(l\.child_name\) = lower\(v_child\)/);
  });

  it("12 months, computed in the database in UTC (the planned ends_at is not trusted)", () => {
    expect(body).toContain("(v_starts at time zone 'UTC' + interval '12 months') at time zone 'UTC'");
    expect(body).not.toMatch(/v_row\s*->>\s*'ends_at'/);
  });

  it("a stale plan is refused: every start is re-derived from the live table under the parent lock", () => {
    // Her live year in this band that ends last (active, not ended at purchase, not this order).
    expect(body).toMatch(/l\.status = 'active' and l\.ends_at > p_purchased_at\s+and l\.order_id is distinct from p_order_id\s+order by l\.ends_at desc\s+limit 1/);
    expect(body).toContain("if date_trunc('milliseconds', v_starts) <> date_trunc('milliseconds', p_purchased_at) or v_renews is not null then");
    expect(body).toContain("if date_trunc('milliseconds', v_starts) <> date_trunc('milliseconds', v_live_end)");
    expect(body).toContain("or v_renews is distinct from (case when v_live_renewed then null else v_live_id end) then");
    expect((body.match(/raise exception 'online_year_grant_purchase: stale plan/g) ?? []).length).toBe(2);
    // Once checked, the database's own value is stored, not the client's.
    expect(body).toContain("v_starts := p_purchased_at;");
    expect(body).toContain("v_starts := v_live_end;");
  });

  it("guards: an order that exists, a known band, 1 to 10 licenses, a purchase time", () => {
    expect(body).toContain("if not exists (select 1 from public.orders o where o.id = p_order_id) then");
    expect(body).toContain("if p_band is null or p_band not in ('sprouts', 'seedlings') then");
    expect(body).toContain("jsonb_array_length(p_licenses) < 1 or jsonb_array_length(p_licenses) > 10");
    expect(body).toContain("if p_purchased_at is null then");
  });

  it("closing is not here: refunds and disputes update licenses from the webhook", () => {
    expect(body).not.toMatch(/closed_reason/);
  });
});
