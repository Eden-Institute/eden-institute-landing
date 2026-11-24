// "How did you hear about us?" (2026-11-24): the shared list, Stripe's limits, and the wiring in create-checkout,
// stripe-webhook and resend-waitlist.
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  cleanHeardAbout,
  HEARD_ABOUT_OPTIONS,
  HEARD_ABOUT_QUESTION,
  HEARD_ABOUT_STRIPE_KEY,
  heardAboutFromSession,
  heardAboutStripeField,
} from './heard-about.ts';

const read = async (fn: string) =>
  (await Deno.readTextFile(new URL(`../${fn}/index.ts`, import.meta.url))).replace(/\r\n/g, '\n');

Deno.test("Stripe's dropdown rules: key + values letters/digits, label <= 50, option labels <= 100, values unique", () => {
  assert(/^[a-z0-9]{1,200}$/i.test(HEARD_ABOUT_STRIPE_KEY));
  assert(HEARD_ABOUT_QUESTION.length <= 50);
  for (const o of HEARD_ABOUT_OPTIONS) {
    assert(/^[a-z0-9]{1,100}$/.test(o.value), o.value);
    assert(o.label.length >= 1 && o.label.length <= 100, o.label);
    assert(!o.label.includes('—'), 'no em dash');
  }
  assertEquals(new Set(HEARD_ABOUT_OPTIONS.map((o) => o.value)).size, HEARD_ABOUT_OPTIONS.length);
  assert(HEARD_ABOUT_OPTIONS.length <= 200);
});

Deno.test('the Stripe field is an OPTIONAL dropdown with every choice in order', () => {
  const f = heardAboutStripeField();
  assertEquals(f.key, 'heardabout');
  assertEquals(f.type, 'dropdown');
  assertEquals(f.optional, true);
  assertEquals(f.label, { type: 'custom', custom: 'How did you hear about us?' });
  assertEquals(f.dropdown.options, HEARD_ABOUT_OPTIONS.map((o) => ({ label: o.label, value: o.value })));
});

Deno.test('cleanHeardAbout keeps known values only and never throws', () => {
  assertEquals(cleanHeardAbout('uhpn'), 'uhpn');
  assertEquals(cleanHeardAbout('  Facebook '), 'facebook');
  for (const bad of ['', 'tiktok', 'talesandtabletalk; drop table', null, undefined, 3, {}, ['uhpn']]) assertEquals(cleanHeardAbout(bad), null);
});

Deno.test('heardAboutFromSession reads only our field and only a known value', () => {
  const field = (value: unknown, key = 'heardabout') => ({ key, type: 'dropdown', dropdown: { value, options: [] }, optional: true });
  assertEquals(heardAboutFromSession({ custom_fields: [field('talesandtabletalk')] }), 'talesandtabletalk');
  assertEquals(heardAboutFromSession({ custom_fields: [field('instagram', 'other_key'), field('pinterest')] }), 'pinterest');
  assertEquals(heardAboutFromSession({ custom_fields: [field(null)] }), null); // skipped
  assertEquals(heardAboutFromSession({ custom_fields: [field('made_up')] }), null);
  assertEquals(heardAboutFromSession({ custom_fields: [] }), null);
  assertEquals(heardAboutFromSession({}), null);
  assertEquals(heardAboutFromSession(null), null);
});

Deno.test('create-checkout: the dropdown on all four session builders, never on an app subscription', async () => {
  const src = await read('create-checkout');
  assertStringIncludes(src, 'import { heardAboutStripeField } from "../_shared/heard-about.ts";');
  const builders = src.split('const sessionParams: Stripe.Checkout.SessionCreateParams = {').slice(1);
  assertEquals(builders.length, 4);
  for (const b of builders) assert(b.slice(0, 400).includes('heardAboutStripeField()'), b.slice(0, 120));
  assertStringIncludes(src, '...(isSubscription ? {} : { custom_fields: [heardAboutStripeField()] }),');
});

Deno.test('stripe-webhook: stamps the pick after the sale is recorded, only where none is stored, never throws', async () => {
  const src = await read('stripe-webhook');
  assertStringIncludes(src, 'import { heardAboutFromSession } from "../_shared/heard-about.ts"');
  const completed = src.slice(src.indexOf('case "checkout.session.completed": {'), src.indexOf('case "checkout.session.expired": {'));
  assert(completed.indexOf('await handleOneOffPayment(session)') < completed.indexOf('await stampHeardAbout(session)'), 'after the order');
  assert(completed.indexOf('await stampHeardAbout(session)') < completed.indexOf('await reportCheckoutToGa4(event, session)'));
  const fn = src.slice(src.indexOf('async function stampHeardAbout('), src.indexOf('// ---------- Abandoned-checkout recovery'));
  assertStringIncludes(fn, 'try {');
  assertStringIncludes(fn, '} catch (err) {');
  assertStringIncludes(fn, '.eq("stripe_checkout_session_id", session.id)');
  assertStringIncludes(fn, '.is("heard_about", null)');
  assertStringIncludes(fn, 'if (!heardAbout) return');
});

Deno.test('resend-waitlist: reads the optional answer, keeps only known values, fills an empty row only', async () => {
  const src = await read('resend-waitlist');
  assertStringIncludes(src, "import { cleanHeardAbout } from '../_shared/heard-about.ts';");
  assertStringIncludes(src, 'heard_about: heardAboutRaw,');
  assertStringIncludes(src, 'const heardAbout = cleanHeardAbout(heardAboutRaw);');
  const block = src.slice(src.indexOf('// ── Step 1a: "How did you hear about us?"'), src.indexOf('// ── Step 1b: band waitlist row ──'));
  assertStringIncludes(block, 'if (heardAbout && waitlistId) {');
  assertStringIncludes(block, '&heard_about=is.null');
  assertStringIncludes(block, "method: 'PATCH'");
  assertStringIncludes(block, '} catch (e) {');
});
