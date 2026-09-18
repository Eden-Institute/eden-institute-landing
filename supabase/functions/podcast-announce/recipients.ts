// Who a podcast broadcast goes to. Pure, so the suppression rules are unit-tested
// (recipients.test.ts) without a database.
//
// THREE EXCLUSIONS, and each one is load bearing:
//   1. globallySuppressed: any waitlist_signups row for the address, on ANY funnel,
//      has unsubscribed_at set. That column carries Resend-level unsubscribes, hard
//      bounces and spam complaints (waitlist_apply_resend_event). The podcast row may
//      not carry the Resend contact id that event matched on, so checking only the
//      podcast row could mail an address that hard-bounced on another list.
//   2. podcastOptOuts: email_list_unsubscribes rows with list = 'podcast' ONLY.
//      Opting out of an Eden's Table list does not remove someone from the podcast
//      list: joining the podcast list afterwards is its own, newer consent.
//   3. alreadySent: founders_send_log rows for THIS campaign key, so "remaining"
//      stays honest across batches. The claim at send time is the real guard.

export interface SignupRow {
  email: string | null;
  first_name: string | null;
}

export interface Recipient {
  email: string;
  first_name: string;
}

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

export function selectPodcastRecipients(input: {
  podcastRows: SignupRow[];
  globallySuppressed: Set<string>;
  podcastOptOuts: Set<string>;
  alreadySent: Set<string>;
}): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of input.podcastRows) {
    const email = normalizeEmail(r.email);
    if (!email || !email.includes('@')) continue;
    if (seen.has(email)) continue;
    if (
      input.globallySuppressed.has(email) ||
      input.podcastOptOuts.has(email) ||
      input.alreadySent.has(email)
    ) continue;
    seen.add(email);
    // The broadcast builder falls back to "there" for a blank name; never "Hi ,".
    out.push({ email, first_name: (r.first_name ?? '').trim() });
  }
  return out;
}
