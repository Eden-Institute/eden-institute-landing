// Social profiles. Every one of these was opened in a browser on 2026-07-26 and
// confirmed to resolve — none are inferred from a handle.
//
// The 2026-07-26 rebrand renamed all three to Eden's Table. Instagram and Facebook
// changed USERNAME as well as display name, and neither platform redirects an old
// username: both old URLs now 404. If these ever change again, grep the whole repo,
// including supabase/functions/_shared/, because the email templates carry their own
// copies and a stale one ships a dead link to the whole list. index.html carries a
// static copy in its Organization JSON-LD sameAs.
//
// Pinterest is the account with the verified domain and the ad account
// (id 1122311307048395117). Note the username is TheEdenInstituteBoards, NOT
// "theedeninstitute" — that is a separate, near-empty duplicate account with no
// domain claim. Do not "correct" this URL to the shorter-looking one.
export const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/edenstablehomeschoolcurriculum/" },
  { label: "Facebook", href: "https://www.facebook.com/EdensTableHomeschoolCurriculum" },
  { label: "Pinterest", href: "https://www.pinterest.com/TheEdenInstituteBoards/" },
  // Camila's weekly letters, "Letters from Eden's Table". Added 2026-09-25; the
  // publication URL, not the @camilajohnson1 profile, is what readers subscribe to.
  { label: "Substack", href: "https://edeninstituteletters.substack.com/" },
] as const;
