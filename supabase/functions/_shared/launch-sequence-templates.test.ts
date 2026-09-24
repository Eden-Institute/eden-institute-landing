// Run with: deno test --no-lock -A supabase/functions/_shared/launch-sequence-templates.test.ts
//
// 2026-09-24: both elementary bands are on sale. The live launch series (8-12 and
// 19-21) renders a Seedlings variant for Seedlings free-week signups
// (launch_email_queue.band, migration 20260924210000). These tests pin:
//   - Seedlings variants sell Seedlings (their buttons go to Seedlings pages only),
//     never carry Sprouts-only lines like "K-2 hands", and each carries one
//     new-to-herbs line pointing to Sprouts;
//   - Sprouts variants are the default, never make Seedlings the main offer, and
//     carry the older-kids line in 8, 20 and 21;
//   - a NULL or missing band renders exactly the Sprouts email;
//   - no em dash anywhere, and the specific stale lines are gone.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildLaunchEmail,
  buildLaunchEmail8,
  buildLaunchEmail20,
  normalizeLaunchBand,
} from './launch-sequence-templates.ts';

const LIVE = [8, 9, 10, 11, 12, 19, 20, 21];
const SEEDLINGS_STARTER = 'https://edeninstitute.health/starter/seedlings';
const SEEDLINGS_BOOKS = 'https://edeninstitute.health/books#seedlings';

// The main CTA is the forest brandButton; the gold Facebook button in the footer
// is a different style and is not an offer.
function buttonHrefs(html: string): string[] {
  const re = /<a href="([^"]+)" target="_blank" style="display:inline-block;background-color:#2C3E2D;/g;
  return [...html.matchAll(re)].map((m) => m[1]);
}

function build(pos: number, band?: unknown, founding = true) {
  const built = buildLaunchEmail(pos, 'Sarah', founding, undefined, 'a', band);
  assert(built, `no builder for ${pos}`);
  return built!;
}

Deno.test('Seedlings variants sell Seedlings, never the Sprouts starter or K-2 lines', () => {
  for (const pos of LIVE) {
    const { subject, html } = build(pos, 'seedlings');
    assert(html.includes(SEEDLINGS_STARTER) || html.includes(SEEDLINGS_BOOKS), `${pos}: no Seedlings link`);
    assert(!html.includes('K-2 hands'), `${pos}: K-2 hands`);
    const buttons = buttonHrefs(html);
    assert(buttons.length >= 1, `${pos}: no main button`);
    for (const href of buttons) {
      assert(href === SEEDLINGS_STARTER || href === SEEDLINGS_BOOKS, `${pos}: Seedlings button goes to ${href}`);
    }
    assert(!html.includes('href="https://edeninstitute.health/starter" target="_blank"'), `${pos}: Sprouts starter as a button`);
    // One short new-to-herbs line pointing to Sprouts (the founder's start rule).
    assert(/new to (herbs|plants)/i.test(html), `${pos}: no new-to-herbs line`);
    assert(
      html.includes('href="https://edeninstitute.health/starter"') || html.includes('href="https://edeninstitute.health/books#buy"'),
      `${pos}: new-to-herbs line does not link Sprouts`,
    );
    assert(!/Plantago|240 pages|224 pages|Week 6 is plantain|sized for K-2/i.test(html), `${pos}: Sprouts-only fact in Seedlings copy`);
    // Each band has its own extra Student Notebook at $39.99 (Seedlings added 2026-09-24).
    if (pos === 8) assert(/extra Student Notebook for each sibling at checkout, \$39\.99 each/.test(html), `${pos}: no Seedlings sibling-notebook line`);
    assert(!subject.includes('—') && !html.includes('—'), `${pos}: em dash`);
  }
});

Deno.test('Sprouts variants never make Seedlings the main offer', () => {
  for (const pos of LIVE) {
    const { html } = build(pos, 'sprouts');
    for (const href of buttonHrefs(html)) {
      assert(!href.includes('seedlings'), `${pos}: Sprouts button goes to ${href}`);
    }
    // Any Seedlings link sits inside the one start-rule / older-kids line.
    const seedlingsLinks = (html.match(/href="https:\/\/edeninstitute\.health\/(starter\/seedlings|books#seedlings)"/g) ?? []).length;
    assert(seedlingsLinks <= 1, `${pos}: ${seedlingsLinks} Seedlings links`);
    if (seedlingsLinks === 1) {
      assert(/already know the basics/.test(html), `${pos}: Seedlings link outside the older-kids line`);
    }
  }
  for (const pos of [8, 20, 21]) {
    const { html } = build(pos, 'sprouts');
    assert(/already know the basics/.test(html), `${pos}: no older-kids line`);
    assert(html.includes(SEEDLINGS_STARTER) || html.includes(SEEDLINGS_BOOKS), `${pos}: older-kids line has no Seedlings link`);
  }
});

Deno.test('band defaults to Sprouts: omitted, null, junk and "sprouts" render identically', () => {
  assertEquals(normalizeLaunchBand(undefined), 'sprouts');
  assertEquals(normalizeLaunchBand(null), 'sprouts');
  assertEquals(normalizeLaunchBand('SEEDLINGS'), 'sprouts');
  assertEquals(normalizeLaunchBand('seedlings'), 'seedlings');
  for (const pos of LIVE) {
    const explicit = build(pos, 'sprouts');
    assertEquals(buildLaunchEmail(pos, 'Sarah'), explicit, `${pos}: default`);
    assertEquals(build(pos, null), explicit, `${pos}: null`);
    assertEquals(build(pos, undefined), explicit, `${pos}: undefined`);
    assertEquals(build(pos, 'other'), explicit, `${pos}: junk`);
  }
  assertEquals(buildLaunchEmail8('Sarah'), buildLaunchEmail8('Sarah', true, 'sprouts'));
  assertEquals(buildLaunchEmail20('Sarah'), buildLaunchEmail20('Sarah', false, 'sprouts'));
});

Deno.test('Seedlings and Sprouts variants keep the same structure (same Scripture, same podcast lines (reworded 2026-09-24, founder))', () => {
  const verses: Record<number, string> = {
    9: 'Proverbs 22:6', 10: 'James 1:5', 11: 'Nehemiah 2:18', 12: 'Psalm 78:4',
    19: 'Genesis 1:29', 20: 'Psalm 34:8', 21: 'Isaiah 40:11',
  };
  for (const pos of LIVE) {
    const sp = build(pos, 'sprouts').html;
    const sd = build(pos, 'seedlings').html;
    assert(sd !== sp, `${pos}: Seedlings variant identical to Sprouts`);
    if (verses[pos]) {
      assertStringIncludes(sp, verses[pos]);
      assertStringIncludes(sd, verses[pos]);
    }
    assertStringIncludes(sd, 'Hi Sarah,');
    assertStringIncludes(sd, 'Grace and health,');
    assertStringIncludes(sd, 'Rooted in Faith Ventures LLC');
  }
  // Podcast promise sentences are a founder decision and are deliberately untouched.
  for (const band of ['sprouts', 'seedlings']) {
    assertStringIncludes(build(19, band).html, 'I have been recording these conversations all summer, and I share each one with this list as it airs.');
    assertStringIncludes(build(20, band).html, 'I share each conversation with this list as it airs.');
    assertStringIncludes(build(21, band).html, 'I share each one with this list as it airs.');
  }
});

Deno.test('no em dash, kit, preorder or credit in any live launch email, either band', () => {
  for (const pos of LIVE) {
    for (const band of ['sprouts', 'seedlings']) {
      for (const founding of [true, false]) {
        const { subject, html } = build(pos, band, founding);
        assert(!subject.includes('—') && !html.includes('—'), `${pos} ${band}: em dash`);
        assert(!/\bkits?\b|preorder|founding|\bcredit\b/i.test(subject + html), `${pos} ${band}: kit/preorder/founding/credit`);
      }
    }
  }
});

Deno.test('the specific stale lines are fixed', () => {
  for (const band of ['sprouts', 'seedlings']) {
    const e11 = build(11, band).html;
    assert(!e11.includes('Seedlings, Cultivators, and Practitioners'), `11 ${band}: Seedlings still "being shaped"`);
    assertStringIncludes(e11, 'all of it shapes Cultivators and Practitioners before they reach anyone else&rsquo;s table.');
    assert(!e11.includes('eleven more grades'), `11 ${band}: eleven grades`);
    assertStringIncludes(e11, 'this wall still has seven grades to go, sixth through twelfth.');

    const e20 = build(20, band).html;
    assert(!/there is no higher|has not outgrown week one/.test(e20), `20 ${band}: "no higher"`);
    assertStringIncludes(e20, 'Grades 3 to 5 who already know the basics can go straight to');
    assertStringIncludes(e20, 'And if you have children in both, teach Sprouts to everyone together first.');

    const e8 = build(8, band).html;
    assertStringIncludes(e8, 'href="https://edeninstitute.health/freebies"');
  }
  assertStringIncludes(build(8, 'sprouts').html, '>the first nine weeks are $39 as a download</a>');
  assertStringIncludes(build(8, 'sprouts').html, 'href="https://edeninstitute.health/starter"');
  assertStringIncludes(build(8, 'seedlings').html, `href="${SEEDLINGS_STARTER}"`);
  assertStringIncludes(build(20, 'sprouts').html, `href="${SEEDLINGS_STARTER}"`);
});

Deno.test('Email 3 names the Five Tenets as the curriculum manual does', () => {
  const html = buildLaunchEmail(3, 'Sarah')!.html;
  assertStringIncludes(html, '<strong>Hydration, Movement, Nutrition, Rest, and Connection</strong>');
  assert(!/Spiritual Alignment|Elimination/.test(html));
});
