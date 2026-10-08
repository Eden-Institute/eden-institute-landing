import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildFoundingFamilyEmail, DELIVERED_NOTE, SHIPPED_NOTE, type FoundingFamilyStep } from './founding-family-templates.ts';

const STEPS: FoundingFamilyStep[] = ['d1', 'd2', 'd3', 'd4', 'd5', 'p1', 'p2', 'p3', 'p4', 'p5'];

Deno.test('every step builds, no em or en dashes, signed by Camila', () => {
  for (const step of STEPS) {
    const e = buildFoundingFamilyEmail(step, { firstName: 'Ann', band: 'Sprouts', groupInviteOpen: true });
    assert(e, step);
    assert(!/[—–]/.test(e!.subject + e!.html + SHIPPED_NOTE + DELIVERED_NOTE), `${step} has a dash`);
    assert(e!.html.includes('Hi Ann,'), step);
    assert(e!.html.includes('In Him,<br>Camila'), step);
  }
});

Deno.test('group invite only in d1/p1 and only while open', () => {
  for (const step of STEPS) {
    const open = buildFoundingFamilyEmail(step, { firstName: 'Ann', band: 'Seedlings', groupInviteOpen: true })!;
    const shut = buildFoundingFamilyEmail(step, { firstName: 'Ann', band: 'Seedlings', groupInviteOpen: false })!;
    assertEquals(open.html.includes('groups/foundingfifty'), step === 'd1' || step === 'p1', step);
    assert(!shut.html.includes('groups/foundingfifty'), step);
  }
});

Deno.test('missing first name and HTML in names are safe', () => {
  const e = buildFoundingFamilyEmail('d1', { firstName: null, band: 'Sprouts', groupInviteOpen: false })!;
  assertEquals(e.subject, 'Thank you');
  assert(e.html.includes('Hi friend,'));
  const x = buildFoundingFamilyEmail('d2', { firstName: '<b>x</b>', band: 'Sprouts', groupInviteOpen: false })!;
  assert(!x.html.includes('<b>x</b>'));
});
