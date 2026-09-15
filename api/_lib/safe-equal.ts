// Length-independent constant-time string compare. Iterates to the longer of
// the two lengths and folds the length difference into the result, so neither
// a wrong guess nor a wrong length returns early. Sync on purpose: the Edge
// runtime has no crypto.timingSafeEqual and a WebCrypto digest would be async.
// Used for PARTNER_SAMPLE_KEY (api/partner-sample.ts) and CRON_SECRET (api/_lib/cron-forward.ts).
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    // charCodeAt past the end is NaN; `|| 0` maps it to 0.
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
