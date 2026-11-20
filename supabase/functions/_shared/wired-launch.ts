// supabase/functions/_shared/wired-launch.ts
//
// ONE switch for everything that INVITES people to the Wired quiz (the curriculum finder page, the shortlist
// email and PDF). The quiz itself ships dark (WIRED_ENABLED secret, wired-gate.ts) and /wired is noindex, so
// until launch day no page, email or PDF may send a mom there: she would land on "This page isn't open yet".
// Launch day: set this to true (same PR as /wired going indexable), redeploy curriculum-shortlist + wired-pdf.
export const WIRED_IS_PUBLIC = false;
