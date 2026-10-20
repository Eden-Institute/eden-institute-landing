/**
 * Every NEW table or view a migration creates must grant its own access, in the same file.
 *
 * WHY. Until now Supabase's default privileges granted SELECT, INSERT, UPDATE and DELETE on
 * every new table in `public` to anon, authenticated AND service_role, so a migration could
 * say nothing about grants and the edge functions (service_role) still worked. From
 * 2026-10-30 Supabase stops doing that on existing projects (changelog:
 * github.com/orgs/supabase/discussions/45329). A table created after that date has NO
 * grants, and every edge function that touches it fails with 42501 "permission denied".
 * Existing tables keep their grants. Most of our recent table migrations
 * (checkout_recoveries, band_waitlist, resend_unsubscribe_sync, ...) relied on the old
 * default and carry no grant at all, so the next one written the same way would break.
 *
 * THE RULE, for every migration written from 2026-10-20 on (what matters is when a
 * migration is APPLIED, and one written before the 30th can be applied after it):
 *   - each new public table or view grants the privileges it needs to service_role, by
 *     name, in the same file, plus anon / authenticated only where the app reads it
 *     directly;
 *   - each new table enables row level security, and has a policy for any role other than
 *     service_role that it grants to (no policy = service-role only, our default);
 *   - a serial column also grants its sequence;
 *   - NEVER the blanket rollback: no `grant ... on all tables in schema public` and no
 *     `alter default privileges ... grant` in public. That re-exposes every table at once,
 *     including ones that were meant to stay private.
 * Grants must be plain statements: a grant built inside a DO block is not seen here.
 *
 * Function grants are not checked: the house pattern (revoke from public, anon by name,
 * then grant execute to the roles that call it, see 20260915100000_audit_hardening.sql)
 * already names every role.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");

/** Migrations at or after this version must follow the rule. */
const CUTOFF = "20261020000000";

const IDENT = String.raw`(?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?`;

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** "Foo" -> public.foo, clinical.x -> clinical.x */
function qualify(name: string): string {
  const clean = name.replace(/"/g, "").toLowerCase();
  return clean.includes(".") ? clean : `public.${clean}`;
}

function splitList(list: string): string[] {
  return list.split(",").map((s) => s.trim()).filter(Boolean);
}

interface Created {
  name: string;
  kind: "table" | "view";
  statement: string;
}

function createdObjects(sql: string): Created[] {
  const out: Created[] = [];
  const table = new RegExp(String.raw`\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(${IDENT})[^;]*;?`, "gi");
  for (const m of sql.matchAll(table)) out.push({ name: qualify(m[1]), kind: "table", statement: m[0] });
  const view = new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(${IDENT})`, "gi");
  for (const m of sql.matchAll(view)) out.push({ name: qualify(m[1]), kind: "view", statement: m[0] });
  return out;
}

/** object -> roles granted on it in this file (tables and views only). */
function tableGrants(sql: string): Map<string, Set<string>> {
  const grants = new Map<string, Set<string>>();
  // [^;] keeps each match inside one statement.
  const re = /\bgrant\s+[^;]+?\s+on\s+(?!all\s|schema\s|function\s|functions\s|routine\s|procedure\s|sequence\s|sequences\s)(?:table\s+)?([^;]+?)\s+to\s+([^;]+?)\s*;/gi;
  for (const m of sql.matchAll(re)) {
    const roles = splitList(m[2].replace(/\bwith\s+grant\s+option\b/i, "")).map((r) => r.toLowerCase());
    for (const obj of splitList(m[1])) {
      const key = qualify(obj);
      const set = grants.get(key) ?? new Set<string>();
      roles.forEach((r) => set.add(r));
      grants.set(key, set);
    }
  }
  return grants;
}

function hasRls(sql: string, name: string): boolean {
  const re = new RegExp(String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${IDENT})\s+enable\s+row\s+level\s+security`, "gi");
  return [...sql.matchAll(re)].some((m) => qualify(m[1]) === name);
}

function hasPolicy(sql: string, name: string): boolean {
  const re = new RegExp(String.raw`\bcreate\s+policy\s+(?:"[^"]+"|[a-z0-9_]+)\s+on\s+(${IDENT})`, "gi");
  return [...sql.matchAll(re)].some((m) => qualify(m[1]) === name);
}

function grantsSequenceFor(sql: string, name: string): boolean {
  const bare = name.replace(/^public\./, "");
  const re = /\bgrant\s+[^;]+?\s+on\s+sequence\s+([^;]+?)\s+to\s+([^;]+?)\s*;/gi;
  return [...sql.matchAll(re)].some(
    (m) => splitList(m[1]).some((s) => qualify(s).startsWith(`public.${bare}_`)) && /\bservice_role\b/i.test(m[2]),
  );
}

/** Problems in one migration. `seen` = public objects created by earlier migrations. */
function grantProblems(rawSql: string, seen: Set<string> = new Set()): string[] {
  const sql = stripComments(rawSql);
  const problems: string[] = [];

  if (/\bgrant\s+[^;]+?\s+on\s+all\s+(?:tables|sequences)\s+in\s+schema\s+public\b/i.test(sql)) {
    problems.push("grants on ALL tables/sequences in schema public (the blanket rollback): grant each table by name");
  }
  if (/\balter\s+default\s+privileges\b[^;]*\bin\s+schema\s+public\b[^;]*\bgrant\b/i.test(sql)) {
    problems.push("alter default privileges ... grant in schema public (the blanket rollback): grant each table by name");
  }

  const grants = tableGrants(sql);
  for (const obj of createdObjects(sql)) {
    if (!obj.name.startsWith("public.") || seen.has(obj.name)) continue;
    const roles = grants.get(obj.name) ?? new Set<string>();
    if (!roles.has("service_role")) {
      problems.push(`new ${obj.kind} ${obj.name} has no grant to service_role in this file`);
    }
    if (obj.kind !== "table") continue;
    if (!hasRls(sql, obj.name)) {
      problems.push(`new table ${obj.name} does not enable row level security in this file`);
    }
    const clientRoles = [...roles].filter((r) => r === "anon" || r === "authenticated" || r === "public");
    if (clientRoles.length && !hasPolicy(sql, obj.name)) {
      problems.push(`new table ${obj.name} is granted to ${clientRoles.join(", ")} but has no policy in this file`);
    }
    if (/\b(?:small|big)?serial\b/i.test(obj.statement) && !grantsSequenceFor(sql, obj.name)) {
      problems.push(`new table ${obj.name} has a serial column but no sequence grant to service_role`);
    }
  }
  return problems;
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
}

describe("grantProblems", () => {
  it("passes a new table that grants service_role and enables RLS", () => {
    const sql = `
      create table if not exists public.thing (id uuid primary key default gen_random_uuid());
      alter table public.thing enable row level security;
      grant select, insert, update, delete on table public.thing to service_role;`;
    expect(grantProblems(sql)).toEqual([]);
  });

  it("flags a new table that relies on the old automatic grants", () => {
    const sql = `
      create table if not exists public.thing (id uuid primary key);
      alter table public.thing enable row level security;`;
    expect(grantProblems(sql)).toEqual(["new table public.thing has no grant to service_role in this file"]);
  });

  it("flags a missing RLS line, a client grant with no policy, and a serial with no sequence grant", () => {
    const sql = `
      create table public.thing (id bigserial primary key);
      grant select on public.thing to authenticated, service_role;`;
    expect(grantProblems(sql)).toEqual([
      "new table public.thing does not enable row level security in this file",
      "new table public.thing is granted to authenticated but has no policy in this file",
      "new table public.thing has a serial column but no sequence grant to service_role",
    ]);
  });

  it("accepts the client grant once a policy and the sequence grant are there", () => {
    const sql = `
      create table public.thing (id bigserial primary key);
      alter table public.thing enable row level security;
      create policy "thing_self_read" on public.thing for select to authenticated using (true);
      grant select on public.thing to authenticated, service_role;
      grant usage, select on sequence public.thing_id_seq to service_role;`;
    expect(grantProblems(sql)).toEqual([]);
  });

  it("flags a new view with no service_role grant, and ignores a comment that mentions one", () => {
    const sql = `
      -- grant select on public.v_thing to service_role;
      create or replace view public.v_thing with (security_invoker = on) as select 1 as x;`;
    expect(grantProblems(sql)).toEqual(["new view public.v_thing has no grant to service_role in this file"]);
  });

  it("does not ask an existing table to re-grant, and skips other schemas", () => {
    const sql = `
      create table if not exists public.old_thing (id uuid primary key);
      create table if not exists clinical.notes (id uuid primary key);`;
    expect(grantProblems(sql, new Set(["public.old_thing"]))).toEqual([]);
  });

  it("refuses the blanket rollback", () => {
    const sql = `
      grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public grant select on tables to anon;`;
    expect(grantProblems(sql)).toHaveLength(2);
  });
});

// Reads every migration file (200 and growing): allow for a busy machine.
describe("supabase/migrations: new tables carry their own grants", { timeout: 30_000 }, () => {
  it(`every migration from ${CUTOFF} on grants each new table and view by name`, () => {
    const seen = new Set<string>();
    let tablesFound = 0;
    const failures: string[] = [];
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      if (file.slice(0, 14) >= CUTOFF) {
        for (const p of grantProblems(sql, seen)) failures.push(`${file}: ${p}`);
      }
      for (const obj of createdObjects(stripComments(sql))) {
        if (obj.kind === "table") tablesFound += 1;
        seen.add(obj.name);
      }
    }
    // Guard against a blind check: the parser must find the tables that already exist.
    expect(tablesFound).toBeGreaterThan(100);
    expect(failures).toEqual([]);
  });
});
