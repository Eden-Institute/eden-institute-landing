// guide-checkout — straight-to-checkout redirect for the Deep-Dive Guide.
//
// GET ?slug=<constitution-slug>[&email=...]  ->  302 to a live Stripe Checkout
// session for the $4.99 deep_dive_guide.
//
// Why this exists: the nurture emails used to link the Deep-Dive CTA at
// /guide/:slug, which is a client-rendered SPA route. Opened cold from an
// email client (especially mobile in-app browsers), the SPA frequently failed
// to boot and the reader hit a blank page, so the guide was effectively
// unpurchasable from email (0 sales over the first ~2 months). This function is
// a plain server-side HTTP redirect (no SPA), so it works from any mail client.
// It reuses the create-checkout EF as the single source of truth for the price
// and metadata, so the stripe-webhook still flips quiz_completions.purchased_guide.
//
// Public endpoint (verify_jwt=false in supabase/config.toml): anonymous quiz
// takers click it straight from an email with no Supabase session.

const SLUG_TO_NAME: Record<string, string> = {
  'burning-bowstring': 'The Burning Bowstring',
  'open-flame': 'The Open Flame',
  'pressure-cooker': 'The Pressure Cooker',
  'overflowing-cup': 'The Overflowing Cup',
  'drawn-bowstring': 'The Drawn Bowstring',
  'spent-candle': 'The Spent Candle',
  'frozen-knot': 'The Frozen Knot',
  'still-water': 'The Still Water',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('slug') || '').toLowerCase().trim();
  const email = url.searchParams.get('email') || undefined;
  const name = SLUG_TO_NAME[slug];

  // Unknown / missing slug -> the assessment, rather than a dead end.
  if (!name) return Response.redirect('https://edeninstitute.health/assessment', 302);

  const guidePage = `https://edeninstitute.health/guide/${slug}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lookup_key: 'deep_dive_guide',
        constitution_type: slug,
        constitution_nickname: name,
        ...(email ? { email } : {}),
        success_url: `${guidePage}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: guidePage,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data && typeof data.url === 'string' && data.url) {
      return new Response(null, { status: 302, headers: { Location: data.url, 'Cache-Control': 'no-store' } });
    }
    console.error('guide-checkout: create-checkout returned no url', { status: res.status, data });
  } catch (e) {
    console.error('guide-checkout error', String(e));
  }
  // On any failure, fall back to the guide page rather than dead-ending the click.
  return Response.redirect(guidePage, 302);
});
