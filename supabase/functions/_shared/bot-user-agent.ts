// Crawler / scripted-client detection by User-Agent, for endpoints whose GET
// has a side effect (guide-checkout mints a live Stripe Checkout Session).
//
// Deliberately narrow: the tokens below name search crawlers, SEO crawlers,
// link-preview fetchers (Facebook, Twitter, Slack, WhatsApp, iMessage all
// carry one of these), headless Chrome, and the common scripting clients. A
// real person's browser, mail client or in-app webview never carries any of
// them, and phone model names such as "CUBOT_NOTE_20" do not match because
// "bot" must end a word. A false positive is not a dead end either: the caller
// falls back to the ordinary page, which has its own Buy button.

const BOT_UA_RE =
  /bot\b|crawl|spider|slurp|headlesschrome|facebookexternalhit|whatsapp\/|python-requests|python-urllib|\bcurl\/|\bwget\/|go-http-client|libwww/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_RE.test(userAgent);
}
