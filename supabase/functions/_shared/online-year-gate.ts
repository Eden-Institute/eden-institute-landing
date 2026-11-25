// supabase/functions/_shared/online-year-gate.ts
//
// The Online Year ships DARK (Build ticket OY2): until Camila's launch go sets the secret
// ONLINE_YEAR_ENABLED = "true", create-checkout answers the Online Year cart with a 404 as
// if it did not exist, EXCEPT a request carrying header x-online-year-preview equal to the
// ONLINE_YEAR_PREVIEW_TOKEN secret (Lane 2's and NP's end-to-end checks). Launch = set
// ONLINE_YEAR_ENABLED=true, no redeploy (the same switch pattern as WIRED_ENABLED).

import { timingSafeEqual } from './timing-safe-equal.ts';

export const ONLINE_YEAR_PREVIEW_HEADER = 'x-online-year-preview';

/** True when the Online Year is on sale, or the request carries the preview token. */
export function onlineYearOpen(req: Request, env: (k: string) => string | undefined = (k) => Deno.env.get(k)): boolean {
  if (env('ONLINE_YEAR_ENABLED') === 'true') return true;
  const want = env('ONLINE_YEAR_PREVIEW_TOKEN') ?? '';
  const got = req.headers.get(ONLINE_YEAR_PREVIEW_HEADER) ?? '';
  return want.length >= 24 && got.length > 0 && timingSafeEqual(got, want);
}
