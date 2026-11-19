/**
 * Wired quiz W1 schema (spec sections 3, 4 and 18): guards the rules a later edit could
 * quietly break. newTableGrants.test.ts already checks RLS + a service_role grant on every
 * new table; this adds the children's-data rules specific to wired_*.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..", "..", "supabase", "migrations");
const file = readdirSync(dir).find((f) => /_wired_quiz_schema_w1\.sql$/.test(f));
const sql = file ? readFileSync(join(dir, file), "utf8") : "";
const code = sql.replace(/--[^\n]*/g, " ");

const TABLES = [
  "wired_question_banks", "wired_families", "wired_children", "wired_observers", "wired_sessions",
  "wired_results", "wired_family_results", "wired_family_prefs", "wired_teen_links",
  "wired_pending_checkouts", "wired_unlocks", "wired_buyers", "wired_credits", "wired_tombstones",
  "wired_curricula", "wired_curriculum_esa", "wired_curricula_history", "wired_email_queue", "wired_failures",
];

function tableBody(name: string): string {
  const m = code.match(new RegExp(String.raw`create table if not exists public\.${name}\s*\(([\s\S]*?)\n\);`, "i"));
  return m ? m[1] : "";
}

describe("wired W1 migration", () => {
  it("exists exactly once", () => {
    expect(file).toBeTruthy();
    expect(readdirSync(dir).filter((f) => /_wired_quiz_schema_w1\.sql$/.test(f))).toHaveLength(1);
  });

  it("creates every table, each with RLS on and a service_role grant", () => {
    for (const t of TABLES) {
      expect(tableBody(t), t).not.toBe("");
      expect(code).toMatch(new RegExp(String.raw`alter table public\.${t} enable row level security;`));
      expect(code).toMatch(new RegExp(String.raw`grant select, insert, update, delete on table public\.${t} to service_role;`));
    }
  });

  it("revokes the auto-granted client privileges on every table (default ACL still grants them)", () => {
    for (const t of TABLES) {
      expect(code).toMatch(new RegExp(String.raw`revoke all on table public\.${t} from anon, authenticated;`));
    }
  });

  it("never grants a wired_ table to anon or authenticated, and adds no policy", () => {
    expect(code).not.toMatch(/on\s+(?:table\s+)?public\.wired_\w+\s+to\s+[^;]*\b(anon|authenticated|public)\b/i);
    expect(code).not.toMatch(/create\s+policy/i);
  });

  it("stores only nickname and grade about a child (rule 6)", () => {
    const cols = tableBody("wired_children")
      .split("\n")
      .map((l) => l.trim().split(/\s+/)[0])
      .filter((c) => c && /^[a-z_]+$/.test(c));
    expect(cols.sort()).toEqual(
      ["created_at", "family_id", "free_slot", "grade", "id", "nickname", "removed_at", "unlocked_at", "unlocked_via"].sort(),
    );
  });

  it("no citext; emails unique on lower(email)", () => {
    expect(code).not.toMatch(/\bcitext\b/i);
    expect(code).toMatch(/on public\.wired_families \(lower\(email\)\)/);
  });

  it("one quiz per rater per year includes family_id (adult set has child_id null)", () => {
    expect(code).toMatch(
      /wired_sessions_one_per_rater_year\s+on public\.wired_sessions \(family_id, child_id, rater_role, observer_id, quiz_year\) nulls not distinct\s+where completed_at is not null and not is_pilot_retake;/,
    );
  });

  it("ranking can never see affiliate status: no affiliate field outside wired_curricula", () => {
    for (const t of TABLES.filter((x) => x !== "wired_curricula")) {
      expect(tableBody(t), t).not.toMatch(/affiliate/);
    }
  });

  it("record_cta_click: one 4-argument version, old one dropped, execute named role by role", () => {
    expect(code).toMatch(/drop function if exists public\.record_cta_click\(text, text, text\);/);
    expect(code).toMatch(/p_placement text default null::text/);
    expect(code).toMatch(/revoke execute on function public\.record_cta_click\(text, text, text, text\) from public;/);
    expect(code).toMatch(/grant execute on function public\.record_cta_click\(text, text, text, text\) to anon, authenticated, service_role;/);
  });

  it("trigger functions are not callable by clients", () => {
    for (const fn of ["wired_children_unlock_is_sticky", "wired_curricula_log_change"]) {
      expect(code).toMatch(new RegExp(String.raw`revoke execute on function public\.${fn}\(\) from public, anon, authenticated;`));
    }
  });
});
