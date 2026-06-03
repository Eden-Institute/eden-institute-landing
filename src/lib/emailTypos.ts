// src/lib/emailTypos.ts
//
// Lightweight, dependency-free email typo detection for signup forms.
//
// Why this exists: an audit of Resend lead-magnet bounces found that almost
// every "bounce" was a mistyped address domain entered at signup, not a
// delivery problem. Two failure modes dominated:
//   1. dead / misspelled TLDs        -> gmail.con, live.con, passmail.ner, gmail.comn
//   2. single-domain provider, wrong TLD -> gmail.co, gmail.cl
// plus fuzzy second-level typos    -> yaboo.com -> yahoo.com, hmail.com -> gmail.com
//
// Validated 2026-06 against the real bounced-address set: 16/16 typos
// flagged, 0 false positives on common valid domains.

export interface EmailCheck {
  /** Suggested correction, e.g. "jess@gmail.com", or null if the address looks fine. */
  suggestion: string | null;
  /** true => domain is effectively undeliverable; block submit until corrected. */
  invalid: boolean;
}

// Well-known mailbox domains used for fuzzy nearest-match suggestions.
const POPULAR_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.com.au", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "icloud.com", "me.com",
  "mac.com", "aol.com", "live.com", "msn.com", "comcast.net", "verizon.net",
  "att.net", "sbcglobal.net", "ymail.com", "gmx.com", "proton.me",
  "protonmail.com", "fastmail.com", "mail.com",
];

// Providers that operate on exactly one canonical domain. If the second-level
// label matches but the full domain doesn't, it's a guaranteed typo.
const PROVIDER_CANONICAL: Record<string, string> = {
  gmail: "gmail.com",
  googlemail: "googlemail.com",
  icloud: "icloud.com",
  aol: "aol.com",
};

// Common dead/typo TLDs mapped to their intended value.
const BAD_TLD: Record<string, string> = {
  con: "com", cm: "com", cmo: "com", ocm: "com", vom: "com", xom: "com",
  coom: "com", comm: "com", comn: "com", cim: "com", clm: "com",
  ner: "net", nett: "net", ogr: "org", orgg: "org",
};

// Two-label country-code second-level domains we must keep intact.
const CC_SLD = new Set<string>([
  "com.au", "co.uk", "co.nz", "com.br", "co.za", "com.mx", "co.in", "com.sg",
]);

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

interface ParsedEmail {
  local: string;
  domain: string;
  sld: string;
  tld: string;
}

function parseEmail(email: string): ParsedEmail | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain.includes(".") || domain.endsWith(".")) return null;
  const parts = domain.split(".");
  let tld: string;
  let sld: string;
  if (parts.length >= 3 && CC_SLD.has(parts.slice(-2).join("."))) {
    tld = parts.slice(-2).join(".");
    sld = parts[parts.length - 3];
  } else {
    tld = parts[parts.length - 1];
    sld = parts[parts.length - 2];
  }
  return { local, domain, sld, tld };
}

/**
 * Inspect an email address for likely domain typos.
 * Returns a suggested correction and whether the domain is undeliverable.
 */
export function checkEmail(raw: string): EmailCheck {
  const email = (raw || "").trim();
  const parsed = parseEmail(email);
  if (!parsed) return { suggestion: null, invalid: false };
  const { local, domain, sld, tld } = parsed;

  // 1. Single-domain provider on the wrong TLD (gmail.co, gmail.cl, icloud.net).
  const canonical = PROVIDER_CANONICAL[sld];
  if (canonical && domain !== canonical) {
    return { suggestion: `${local}@${canonical}`, invalid: true };
  }

  // 2. Dead / misspelled TLD (gmail.con, live.con, passmail.ner, gmail.comn).
  const fixedTld = BAD_TLD[tld];
  if (fixedTld) {
    return { suggestion: `${local}@${sld}.${fixedTld}`, invalid: true };
  }

  // 3. Fuzzy nearest-domain suggestion (yaboo.com -> yahoo.com). Soft: the
  //    address might be legitimate, so suggest but don't block.
  if (!POPULAR_DOMAINS.includes(domain)) {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const candidate of POPULAR_DOMAINS) {
      const dist = levenshtein(domain, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    if (best && bestDist > 0 && bestDist <= 2) {
      return { suggestion: `${local}@${best}`, invalid: false };
    }
  }

  return { suggestion: null, invalid: false };
}
