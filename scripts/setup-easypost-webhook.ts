// scripts/setup-easypost-webhook.ts
//
// One-shot: registers the EasyPost webhook endpoint pointing at the shipping-webhook EF,
// with the HMAC secret the EF verifies. Run once per environment (and again only if the
// secret rotates). READ/WRITE on EasyPost only; touches nothing else.
//
//   deno run --allow-net --allow-env scripts/setup-easypost-webhook.ts
//
// Required env: EASYPOST_API_KEY, EASYPOST_WEBHOOK_SECRET
// Optional env: WEBHOOK_URL (defaults to the prod shipping-webhook EF)

const apiKey = Deno.env.get("EASYPOST_API_KEY")
const secret = Deno.env.get("EASYPOST_WEBHOOK_SECRET")
if (!apiKey || !secret) {
  console.error("Missing EASYPOST_API_KEY or EASYPOST_WEBHOOK_SECRET")
  Deno.exit(2)
}
const url = Deno.env.get("WEBHOOK_URL") ??
  "https://noeqztssupewjidpvhar.supabase.co/functions/v1/shipping-webhook"

const res = await fetch("https://api.easypost.com/v2/webhooks", {
  method: "POST",
  headers: {
    Authorization: `Basic ${btoa(apiKey + ":")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ webhook: { url, webhook_secret: secret } }),
})
const json = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error(`EasyPost webhook create failed ${res.status}:`, JSON.stringify(json))
  Deno.exit(1)
}
console.log(`Webhook registered: id=${json.id} url=${json.url} mode=${json.mode}`)
