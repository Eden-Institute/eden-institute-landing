// scripts/migrate-resend-contacts.ts
// Eden Apothecary — one-time legacy-Resend-contacts -> waitlist_signups migration
// Launch-blocker #46 · Manual §20.18 Supabase-as-SoT Waitlist
//
// Reads contacts from the three legacy Resend audiences (App Beta, Tier 2
// Course, Eden's Table) and upserts each into public.waitlist_signups with
// deterministic entry_funnel mapping. Idempotent via the (email, entry_funnel)
// UNIQUE constraint with ON CONFLICT DO UPDATE on resend_contact_id +
// resend_synced_at — re-running mutates nothing functional for already-synced
// contacts beyond bumping resend_synced_at.
//
// Run modes:
//   --dry-run (DEFAULT)   read + count + print sample emails, no writes
//   --production          actually write to Supabase
//
// Required env vars (set in PowerShell session before running):
//   RESEND_CONTACTS_KEY        Resend API key with audience read scope
//                              (the two-key architecture's contacts key)
//   SUPABASE_URL               https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  service role key (bypasses RLS for upsert)
//
// Usage from repo root (PowerShell):
//   $env:RESEND_CONTACTS_KEY="re_..."
//   $env:SUPABASE_URL="https://noeqztssupewjidpvhar.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."
//   deno run --allow-net --allow-env scripts/migrate-resend-contacts.ts
//   deno run --allow-net --allow-env scripts/migrate-resend-contacts.ts --production
//
// The script does NOT touch RESEND_API_KEY (sending key) — only the contacts
// key, which has audience read scope per the §20.7 two-key architecture.
//
// Authority + audit. Authored under Lock #45 surface 3 (Claude drives content
// + scripts end-to-end). Founder reviews dry-run output before approving
// production run (Lock #45 surface 4 strategic decision).

const LEGACY_AUDIENCES: Array<{ id: string; entry_funnel: string; label: string }> = [
  {
    id: "4860c1c5-8e2b-4d02-838a-60ef09b789bf",
    entry_funnel: "course_tier2",
    label: "Tier 2 Course Waitlist",
  },
  {
    id: "cebd3478-b344-41b7-98c8-8bcf0e0108da",
    entry_funnel: "app_beta",
    label: "App Beta Waitlist",
  },
  {
    id: "a48cb66e-b2a9-461d-98a6-bb1b12f72693",
    entry_funnel: "edens_table",
    label: "Eden's Table Waitlist",
  },
];

const RESEND_CONTACTS_KEY = Deno.env.get("RESEND_CONTACTS_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const args = new Set(Deno.args);
const PRODUCTION = args.has("--production");
const DRY_RUN = !PRODUCTION;

if (!RESEND_CONTACTS_KEY) {
  console.error("FATAL: RESEND_CONTACTS_KEY env var is not set.");
  Deno.exit(1);
}
if (!SUPABASE_URL) {
  console.error("FATAL: SUPABASE_URL env var is not set.");
  Deno.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY env var is not set.");
  Deno.exit(1);
}

interface ResendContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed?: boolean;
  created_at?: string;
}

interface ResendListResponse {
  object?: string;
  data?: ResendContact[];
  error?: { message: string; statusCode?: number };
}

interface UpsertRow {
  email: string;
  entry_funnel: string;
  first_name: string | null;
  last_name: string | null;
  resend_contact_id: string;
  resend_synced_at: string;
  unsubscribed_at: string | null;
  metadata: Record<string, unknown>;
}

interface AudienceResult {
  audience_id: string;
  label: string;
  entry_funnel: string;
  read: number;
  valid_for_upsert: number;
  written: number;
  skipped_bad_email: number;
  unsubscribed_in_resend: number;
  errors: number;
  sample_emails: string[];
  read_failed: boolean;
}

async function listAudienceContacts(audienceId: string): Promise<ResendContact[]> {
  const url = `https://api.resend.com/audiences/${audienceId}/contacts`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${RESEND_CONTACTS_KEY}` },
  });
  let json: ResendListResponse;
  try {
    json = (await res.json()) as ResendListResponse;
  } catch {
    throw new Error(
      `Resend API ${res.status} for audience ${audienceId}: response was not JSON`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Resend API ${res.status} for audience ${audienceId}: ${
        json.error?.message ?? res.statusText
      }`,
    );
  }
  if (!Array.isArray(json.data)) {
    throw new Error(
      `Resend API returned unexpected shape for audience ${audienceId}: ${
        JSON.stringify(json).slice(0, 200)
      }`,
    );
  }
  return json.data;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function upsertChunk(
  rows: UpsertRow[],
): Promise<{ ok: boolean; statusCode: number; body: string }> {
  if (rows.length === 0) return { ok: true, statusCode: 0, body: "" };
  const url = `${SUPABASE_URL}/rest/v1/waitlist_signups?on_conflict=email,entry_funnel`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  const body = await res.text();
  return { ok: res.ok, statusCode: res.status, body };
}

async function processAudience(
  a: typeof LEGACY_AUDIENCES[number],
): Promise<AudienceResult> {
  const result: AudienceResult = {
    audience_id: a.id,
    label: a.label,
    entry_funnel: a.entry_funnel,
    read: 0,
    valid_for_upsert: 0,
    written: 0,
    skipped_bad_email: 0,
    unsubscribed_in_resend: 0,
    errors: 0,
    sample_emails: [],
    read_failed: false,
  };

  console.log(
    `\n[${a.label}] reading audience ${a.id} -> entry_funnel='${a.entry_funnel}' …`,
  );

  let contacts: ResendContact[];
  try {
    contacts = await listAudienceContacts(a.id);
  } catch (e) {
    console.error(`[${a.label}] FATAL read failure: ${(e as Error).message}`);
    result.read_failed = true;
    return result;
  }

  result.read = contacts.length;
  console.log(`[${a.label}] read ${contacts.length} contacts from Resend`);
  if (contacts.length >= 1000) {
    console.warn(
      `[${a.label}] WARN: count is ${contacts.length} — verify Resend pagination is not silently truncating`,
    );
  }

  const validRows: UpsertRow[] = [];
  const nowIso = new Date().toISOString();
  for (const c of contacts) {
    const email = (c.email ?? "").trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      result.skipped_bad_email++;
      continue;
    }
    if (c.unsubscribed) result.unsubscribed_in_resend++;

    validRows.push({
      email,
      entry_funnel: a.entry_funnel,
      first_name: c.first_name?.trim() || null,
      last_name: c.last_name?.trim() || null,
      resend_contact_id: c.id,
      resend_synced_at: nowIso,
      unsubscribed_at: c.unsubscribed ? nowIso : null,
      metadata: {
        migrated_from: "resend_audience",
        source_audience_id: a.id,
        source_audience_label: a.label,
        migrated_at: nowIso,
      },
    });

    if (result.sample_emails.length < 3) {
      result.sample_emails.push(email);
    }
  }
  result.valid_for_upsert = validRows.length;

  if (DRY_RUN) {
    console.log(
      `[${a.label}] DRY-RUN: would upsert ${validRows.length} valid rows; sample: ${
        result.sample_emails.join(", ")
      }`,
    );
    return result;
  }

  // Production: chunk upserts to keep request sizes reasonable
  const CHUNK_SIZE = 200;
  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const r = await upsertChunk(chunk);
    if (!r.ok) {
      console.error(
        `[${a.label}] upsert chunk ${i}-${
          i + chunk.length
        } FAILED status=${r.statusCode} body=${r.body.slice(0, 400)}`,
      );
      result.errors += chunk.length;
      continue;
    }
    result.written += chunk.length;
    console.log(
      `[${a.label}] upserted chunk ${i + 1}-${i + chunk.length} of ${
        validRows.length
      } (status ${r.statusCode})`,
    );
  }

  return result;
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log("=".repeat(72));
  console.log(
    "Eden Apothecary — Legacy Resend Contacts -> waitlist_signups Migration",
  );
  console.log("Launch-blocker #46 · Manual §20.18");
  console.log(`Mode:         ${DRY_RUN ? "DRY-RUN (no writes)" : "PRODUCTION (writes)"}`);
  console.log(`Run started:  ${startedAt}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log("=".repeat(72));

  const results: AudienceResult[] = [];
  for (const a of LEGACY_AUDIENCES) {
    const r = await processAudience(a);
    results.push(r);
    // tiny inter-audience pause to be polite to Resend rate limits
    await new Promise((res) => setTimeout(res, 250));
  }

  console.log("\n" + "=".repeat(72));
  console.log("SUMMARY");
  console.log("=".repeat(72));

  let totalRead = 0;
  let totalValid = 0;
  let totalWritten = 0;
  let totalSkipped = 0;
  let totalUnsub = 0;
  let totalErrors = 0;
  let anyReadFailed = false;

  for (const r of results) {
    console.log(`\n  ${r.label} (${r.entry_funnel}):`);
    console.log(`    audience_id            ${r.audience_id}`);
    if (r.read_failed) {
      console.log(`    STATUS                 READ FAILED — see error log above`);
      anyReadFailed = true;
      continue;
    }
    console.log(`    read                   ${r.read}`);
    console.log(`    valid_for_upsert       ${r.valid_for_upsert}`);
    console.log(`    skipped_bad_email      ${r.skipped_bad_email}`);
    console.log(`    unsubscribed_in_resend ${r.unsubscribed_in_resend}`);
    if (r.sample_emails.length) {
      console.log(`    sample_emails          ${r.sample_emails.join(", ")}`);
    }
    if (!DRY_RUN) {
      console.log(`    written_to_supabase    ${r.written}`);
      console.log(`    upsert_errors          ${r.errors}`);
    }
    totalRead += r.read;
    totalValid += r.valid_for_upsert;
    totalSkipped += r.skipped_bad_email;
    totalUnsub += r.unsubscribed_in_resend;
    totalWritten += r.written;
    totalErrors += r.errors;
  }

  console.log(`\n  TOTAL:`);
  console.log(`    read                   ${totalRead}`);
  console.log(`    valid_for_upsert       ${totalValid}`);
  console.log(`    skipped_bad_email      ${totalSkipped}`);
  console.log(`    unsubscribed_in_resend ${totalUnsub}`);
  if (!DRY_RUN) {
    console.log(`    written_to_supabase    ${totalWritten}`);
    console.log(`    upsert_errors          ${totalErrors}`);
  }
  console.log(`\n  Run finished:           ${new Date().toISOString()}`);
  console.log("=".repeat(72));

  if (anyReadFailed) {
    console.log(
      "\nONE OR MORE AUDIENCES FAILED TO READ. Review errors above before re-running.",
    );
    Deno.exit(2);
  }
  if (DRY_RUN) {
    console.log(
      "\nDRY-RUN complete. Re-run with --production to actually write.",
    );
  } else {
    console.log("\nPRODUCTION run complete.");
    if (totalErrors > 0) {
      console.log(
        `WARNING: ${totalErrors} upsert errors occurred. Re-running is safe (idempotent).`,
      );
      Deno.exit(3);
    }
  }
}

if (import.meta.main) {
  await main();
}
