// supabase/functions/_shared/wired-checkout.ts
//
// Fearfully & Wonderfully Wired, W6: the pure half of the wired cart (spec 9.1-9.4 and
// section 18 answers 1, 2, 15). No I/O here, so every rule is unit tested:
//   - which Stripe lines a cart gets (Blueprint; Family Map; Blueprint + upgrade; the later
//     $28 upgrade; + N x extra child past 5),
//   - which children it covers and what each one unlocks,
//   - the words on Stripe's own screen (all sales final, rule 4).
// create-checkout does the checks that need the database (token, children, same-year
// Blueprint) and stripe-webhook grants the unlocks through the wired_grant_purchase RPC.

/** The one lookup_key the webhook dispatches on (answer 1). Never a Stripe price. */
export const WIRED_CART_KEY = 'wired_cart';

/** Stripe price lookup keys (spec 9.1; prices DECIDED 11/17). */
export const WIRED_PRICE_KEYS = {
  blueprint: 'wired_blueprint', // $19
  family_map: 'wired_family_map', // $47, up to 5 children
  upgrade: 'wired_family_map_upgrade', // $28, Blueprint -> Family Map
  extra_child: 'wired_extra_child', // $10 each past 5
} as const;

/** Price in cents per key, for the dry run and the tests (Stripe stays the source at checkout). */
export const WIRED_PRICE_CENTS: Record<string, number> = {
  wired_blueprint: 1900,
  wired_family_map: 4700,
  wired_family_map_upgrade: 2800,
  wired_extra_child: 1000,
};

/**
 * What the buyer chose. Matches the wired_pending_checkouts.product CHECK:
 *   blueprint          one child's Blueprint ($19)
 *   family_map         the Family Map ($47) for up to 5 children, +$10 each after
 *   blueprint_upgrade  the checkout upsell: Blueprint + upgrade in one cart ($19 + $28)
 *   family_map_upgrade the later $28 upgrade, same quiz year as a Blueprint she already bought
 */
export type WiredProduct = 'blueprint' | 'family_map' | 'blueprint_upgrade' | 'family_map_upgrade';
export const WIRED_PRODUCTS: readonly WiredProduct[] = ['blueprint', 'family_map', 'blueprint_upgrade', 'family_map_upgrade'];

export const FAMILY_MAP_INCLUDED_CHILDREN = 5;
/** A family is never this big in practice; the cap keeps a forged request from building a silly cart. */
export const MAX_WIRED_CHILDREN = 15;

export interface WiredLine { lookup_key: string; quantity: number }

export interface WiredCartPlan {
  product: WiredProduct;
  lines: WiredLine[];
  extraChildren: number;
  /** What each covered child is unlocked as (wired_children.unlocked_via). */
  unlockAs: 'blueprint' | 'family_map';
  /** The orders.lookup_key / wired_buyers.product label for reporting. */
  orderLookupKey: string;
}

export type WiredPlanError =
  | 'unknown_product'
  | 'no_children'
  | 'too_many_children'
  | 'blueprint_is_one_child'
  | 'upgrade_needs_blueprint';

export function isWiredProduct(v: unknown): v is WiredProduct {
  return typeof v === 'string' && (WIRED_PRODUCTS as readonly string[]).includes(v);
}

/**
 * The Stripe lines for a cart. `hasSameYearBlueprint` is the answer-2 gate for the later
 * $28 upgrade: only a family with a Blueprint bought in THIS quiz year (not refunded or
 * disputed) gets the upgrade price.
 */
export function planWiredCart(input: {
  product: unknown;
  childCount: number;
  hasSameYearBlueprint?: boolean;
}): { ok: true; plan: WiredCartPlan } | { ok: false; error: WiredPlanError } {
  const { product, childCount } = input;
  if (!isWiredProduct(product)) return { ok: false, error: 'unknown_product' };
  if (!Number.isInteger(childCount) || childCount < 1) return { ok: false, error: 'no_children' };
  if (childCount > MAX_WIRED_CHILDREN) return { ok: false, error: 'too_many_children' };

  const extra = Math.max(0, childCount - FAMILY_MAP_INCLUDED_CHILDREN);
  const extraLine = extra > 0 ? [{ lookup_key: WIRED_PRICE_KEYS.extra_child, quantity: extra }] : [];
  const orderLookupKey = `wired_${product}`;

  switch (product) {
    case 'blueprint':
      if (childCount !== 1) return { ok: false, error: 'blueprint_is_one_child' };
      return { ok: true, plan: { product, lines: [{ lookup_key: WIRED_PRICE_KEYS.blueprint, quantity: 1 }], extraChildren: 0, unlockAs: 'blueprint', orderLookupKey } };
    case 'family_map':
      return { ok: true, plan: { product, lines: [{ lookup_key: WIRED_PRICE_KEYS.family_map, quantity: 1 }, ...extraLine], extraChildren: extra, unlockAs: 'family_map', orderLookupKey } };
    case 'blueprint_upgrade':
      return {
        ok: true,
        plan: {
          product,
          lines: [{ lookup_key: WIRED_PRICE_KEYS.blueprint, quantity: 1 }, { lookup_key: WIRED_PRICE_KEYS.upgrade, quantity: 1 }, ...extraLine],
          extraChildren: extra, unlockAs: 'family_map', orderLookupKey,
        },
      };
    case 'family_map_upgrade':
      if (!input.hasSameYearBlueprint) return { ok: false, error: 'upgrade_needs_blueprint' };
      return { ok: true, plan: { product, lines: [{ lookup_key: WIRED_PRICE_KEYS.upgrade, quantity: 1 }, ...extraLine], extraChildren: extra, unlockAs: 'family_map', orderLookupKey } };
  }
}

/** Sum of a plan in cents at the decided prices (tests + dry run only). */
export function planCents(plan: WiredCartPlan): number {
  return plan.lines.reduce((s, l) => s + (WIRED_PRICE_CENTS[l.lookup_key] ?? 0) * l.quantity, 0);
}

/** Receipt / orders.product_label wording. */
export const WIRED_ORDER_LABELS: Record<string, string> = {
  wired_blueprint: 'Learner Blueprint',
  wired_family_map: 'Family Learning Map',
  wired_blueprint_upgrade: 'Learner Blueprint + Family Map upgrade',
  wired_family_map_upgrade: 'Family Map upgrade',
};

export function wiredOrderLabel(orderLookupKey: string, extraChildren = 0): string {
  const base = WIRED_ORDER_LABELS[orderLookupKey] ?? 'Fearfully & Wonderfully Wired';
  return extraChildren > 0 ? `${base} + ${extraChildren} extra ${extraChildren === 1 ? 'child' : 'children'}` : base;
}

/**
 * Words on Stripe's screen next to the Pay button (rule 4 / spec 9.4). Built from lines
 * Camila already approved (results page small print + the cart reminder copy).
 * PENDING HER OK on the W6 go tap; no buyer can see it while the quiz is dark.
 */
export const WIRED_CHECKOUT_SUBMIT_MESSAGE =
  "Your PDF lands in your inbox a few minutes after you check out. Because it's digital, all sales are final.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** De-duplicated, validated child ids, or null when any id is not a uuid. */
export function cleanChildIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string' || !UUID_RE.test(v)) return null;
    const id = v.toLowerCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Where Stripe sends her back. The results page reads its token from localStorage, so no token rides in the URL. */
export const WIRED_SUCCESS_URL = 'https://edeninstitute.health/wired/results?paid={CHECKOUT_SESSION_ID}';
export const WIRED_CANCEL_URL = 'https://edeninstitute.health/wired/results';

/** Pending row lifetime: a little longer than Stripe's default 24 h session. */
export const WIRED_PENDING_TTL_MS = 25 * 3600 * 1000;
