// Run with: deno test supabase/functions/podcast-announce/recipients.test.ts

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { selectPodcastRecipients } from './recipients.ts';

const none = () => new Set<string>();

Deno.test('keeps a normal subscriber, normalizing the address', () => {
  const out = selectPodcastRecipients({
    podcastRows: [{ email: '  Mom@Example.com ', first_name: ' Ruth ' }],
    globallySuppressed: none(),
    podcastOptOuts: none(),
    alreadySent: none(),
  });
  assertEquals(out, [{ email: 'mom@example.com', first_name: 'Ruth' }]);
});

Deno.test('a hard bounce or complaint on ANY list blocks the address', () => {
  const out = selectPodcastRecipients({
    podcastRows: [{ email: 'bounced@example.com', first_name: 'A' }],
    globallySuppressed: new Set(['bounced@example.com']),
    podcastOptOuts: none(),
    alreadySent: none(),
  });
  assertEquals(out.length, 0);
});

Deno.test('a podcast opt-out blocks the address', () => {
  const out = selectPodcastRecipients({
    podcastRows: [{ email: 'left@example.com', first_name: 'B' }],
    globallySuppressed: none(),
    podcastOptOuts: new Set(['left@example.com']),
    alreadySent: none(),
  });
  assertEquals(out.length, 0);
});

Deno.test('already sent for this campaign is skipped', () => {
  const out = selectPodcastRecipients({
    podcastRows: [{ email: 'done@example.com', first_name: 'C' }],
    globallySuppressed: none(),
    podcastOptOuts: none(),
    alreadySent: new Set(['done@example.com']),
  });
  assertEquals(out.length, 0);
});

Deno.test('duplicates collapse to one send, and malformed or blank rows are dropped', () => {
  const out = selectPodcastRecipients({
    podcastRows: [
      { email: 'twice@example.com', first_name: 'D' },
      { email: 'TWICE@example.com', first_name: 'D again' },
      { email: 'no-at-sign', first_name: 'E' },
      { email: null, first_name: 'F' },
      { email: '   ', first_name: 'G' },
    ],
    globallySuppressed: none(),
    podcastOptOuts: none(),
    alreadySent: none(),
  });
  assertEquals(out, [{ email: 'twice@example.com', first_name: 'D' }]);
});

Deno.test('a blank first name is kept blank (the builder says "there")', () => {
  const out = selectPodcastRecipients({
    podcastRows: [{ email: 'anon@example.com', first_name: null }],
    globallySuppressed: none(),
    podcastOptOuts: none(),
    alreadySent: none(),
  });
  assertEquals(out, [{ email: 'anon@example.com', first_name: '' }]);
});
