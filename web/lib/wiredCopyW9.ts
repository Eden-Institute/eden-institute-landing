// Fearfully & Wonderfully Wired, W9: the words on the teen link, the side by side, the observer invite form,
// /wired/teen, /wired/observer and /wired/delete.
//
// APPROVED lines are word for word from Camila's approved copy (Results page copy APPROVED 2026-11-19 11:20 AM
// CT: the teen link + "Delete my quiz data"; Teen set APPROVED 2026-11-19 8:47 AM CT: the teen intro screen;
// email copy APPROVED 2026-11-19 2:44 PM CT: "Mom sees / Teen sees").
// PROPOSED lines had no approved copy yet; they go on Camila's W9 review page before the quiz opens, and
// change here only. The quiz is DARK, so no family sees any of this until she approves and turns it on.

export const W9 = {
  // ── APPROVED ──
  teenAsk: "Get {name}'s side too. How old is {name}?",
  teenLinkLine: "Here's a link to send {name}. Their answers show next to yours, and it's normal if they don't match.",
  teenUnder13: "The teen questions are for ages 13 and up. You can send them when {name} turns 13.",
  teenIntro: "Your mom took a short quiz about how God wired you, and she'd love to see it from your side too. This isn't a test, and there are no right answers. Take it on your own and answer for you. It takes about 5 minutes. Your answers show next to hers, and it's normal if they don't match: you each see different sides of you.",
  deleteLink: "Delete my quiz data",
  momSees: "Mom sees",
  teenSees: "Teen sees",
  // APPROVED on the W9 review page (card tryAgain, 2026-11-20 6:15 PM CT); also the error line of the "Your own
  // questions" box on the results page.
  tryAgain: "Something went wrong. Please try again in a minute.",

  // ── PROPOSED (Camila approves on the W9 review page) ──
  sideHeading: "How each of you sees {name}",
  sideNote: "The results above blend everyone: your view counts for half, and the others share the other half.",
  labelSees: "{label} sees",
  teenAgeLabel: "Age",
  teenAgeChoose: "Choose an age",
  teenButton: "Get the link",
  copyButton: "Copy the link",
  copied: "Copied",
  obsHeading: "Invite someone who knows {name}",
  obsBody: "Up to 3 people, like dad, a grandparent or a co-op teacher. We send them one invite and at most one reminder, never add them to any list, and email you an updated Blueprint when they answer.",
  obsEmail: "Their email",
  obsWho: "Who they are",
  obsWhoChoose: "Choose one",
  obsButton: "Send the invite",
  obsRemove: "Remove",
  obsStatus: { invited: "Invited", answered: "Answered", expired: "Link expired" } as Record<string, string>,
  obsFull: "You've invited 3 people for {name}, the most we allow.",
  obsErrors: {
    invalid_email: "Please check that email address.",
    that_is_your_own_email: "That's your own email. Invite someone else who knows {name}.",
    already_invited: "You've already invited that person.",
    max_observers: "You've invited 3 people for {name}, the most we allow.",
  } as Record<string, string>,
  obsIntro: "{mom} would love to see {name} through your eyes. It takes about 5 minutes. Think about {name} over the past month and pick what sounds most like {name} right now. There are no wrong answers.",
  start: "Start",
  thanksTeen: "Thank you! Your answers are in, and your mom will see them next to hers.",
  thanksObserver: "Thank you! Your answers are in, and {mom} will see them next to hers.",
  linkUsed: "This link has already been used. Thank you!",
  linkExpired: "This link has expired.",
  linkBad: "This link doesn't work. Please check that you copied all of it.",
  linkNoMom: "This link isn't ready yet. Please try again later.",
  deleteHeading: "Delete my quiz data",
  deleteBody: "This deletes your children's answers and results, the people you invited, and any teen links. Purchase records stay (kept for taxes, with your children taken off them). We'll email you a link to confirm first.",
  deleteEmailLabel: "The email you used for the quiz",
  deleteSend: "Email me the confirm link",
  deleteSent: "If that email took the quiz, a confirm link is on its way. It works for 24 hours.",
  deleteConfirmBody: "Tap below to delete your Fearfully & Wonderfully Wired quiz data for good.",
  deleteConfirmButton: "Yes, delete my quiz data",
  deleteDone: "Done. Your quiz data is deleted, and you won't get any more learner emails.",
  deleteExpired: "This confirm link has expired. You can ask for a new one below.",
} as const;

export const OBSERVER_LABELS = ["Dad", "Grandparent", "Co-op teacher", "Tutor", "Other family member", "Other"] as const;

export function w9fill(s: string, v: { name?: string; mom?: string; label?: string }): string {
  return s.replace(/\{(name|mom|label)\}/g, (m, k: "name" | "mom" | "label") => v[k] ?? m);
}
