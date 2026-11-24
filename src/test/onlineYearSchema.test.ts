// Online Year (punch #472) ticket OY1: the schema keeps the approved rules (EdensTable_Digital_License_Plan.md).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..", "..", "supabase", "migrations");
const file = readdirSync(dir).find((f) => /_online_year_oy1_schema\.sql$/.test(f));
const sql = file ? readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n") : "";
const body = sql.replace(/--[^\n]*/g, "");
const TABLES = ["online_year_parents", "online_year_licenses", "online_year_devices", "online_year_signin_codes", "online_year_weeks_done"];

function block(table: string): string {
  const start = body.indexOf(`create table if not exists public.${table} (`);
  return body.slice(start, body.indexOf("\n);", start));
}

describe("Online Year schema (OY1)", () => {
  it("exists, one migration", () => {
    expect(file).toBeTruthy();
    expect(readdirSync(dir).filter((f) => /online_year_oy1/.test(f))).toHaveLength(1);
  });

  it("every table: RLS on, public roles revoked, service_role only, no policies", () => {
    for (const t of TABLES) {
      expect(body, t).toContain(`create table if not exists public.${t} (`);
      expect(body, t).toContain(`alter table public.${t} enable row level security;`);
      expect(body, t).toContain(`revoke all on table public.${t} from anon, authenticated;`);
      expect(body, t).toContain(`grant select, insert, update, delete on table public.${t} to service_role;`);
    }
    expect(body).not.toMatch(/create policy/i);
    expect(body).not.toMatch(/grant [^;]* to [^;]*\b(anon|authenticated)\b/i);
  });

  it("children: a first name or nickname only, and children never log in", () => {
    const lic = block("online_year_licenses");
    expect(lic).toContain("child_name           text not null check (length(btrim(child_name)) between 1 and 40)");
    for (const t of TABLES) expect(block(t), t).not.toMatch(/last_name|birth|child_email|dob\b|grade/);
    // Devices and codes belong to the parent account only.
    expect(block("online_year_devices")).toContain("parent_id         uuid not null references public.online_year_parents (id)");
    expect(block("online_year_signin_codes")).not.toMatch(/license_id|child/);
  });

  it("licenses: two bands, first child or sibling, a real term, renewals chain once, refunds close", () => {
    const lic = block("online_year_licenses");
    expect(lic).toContain("check (band in ('sprouts', 'seedlings'))");
    expect(lic).toContain("check (kind in ('first_child', 'sibling'))");
    expect(lic).toContain("check (ends_at > starts_at)");
    expect(lic).toContain("references public.orders (id) on delete set null");
    expect(lic).toContain("check (closed_reason in ('refunded', 'disputed', 'cancelled', 'admin'))");
    expect(body).toContain("on public.online_year_licenses (renews_license_id) where renews_license_id is not null;");
    // NP QA 2026-11-24: a retried webhook cannot grant the same child twice from one order.
    expect(body).toContain("create unique index if not exists online_year_licenses_one_per_child_per_order");
    expect(body).toContain("on public.online_year_licenses (order_id, band, lower(child_name)) where order_id is not null;");
  });

  it("sign-in: codes and device tokens are stored only as hashes; a code lives 10 minutes", () => {
    expect(block("online_year_devices")).toContain("token_hash        text not null check (token_hash ~ '^[0-9a-f]{64}$')");
    expect(block("online_year_signin_codes")).toContain("code_hash      text not null check (code_hash ~ '^[0-9a-f]{64}$')");
    expect(block("online_year_signin_codes")).toContain("expires_at <= created_at + interval '10 minutes'");
    expect(body).toMatch(/create unique index if not exists online_year_devices_token_uniq/);
    for (const t of TABLES) expect(block(t), t).not.toMatch(/\b(code|token|password)\s+text/);
  });

  it("weeks done: one row per child per week, weeks 1 to 36", () => {
    const w = block("online_year_weeks_done");
    expect(w).toContain("week       integer not null check (week between 1 and 36)");
    expect(w).toContain("primary key (license_id, week)");
  });

  it("one account per email, case-insensitive", () => {
    expect(body).toContain("create unique index if not exists online_year_parents_email_lower_uniq on public.online_year_parents (lower(email));");
  });
});
