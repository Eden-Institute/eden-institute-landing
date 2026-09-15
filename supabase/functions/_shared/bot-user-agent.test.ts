import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isBotUserAgent } from "./bot-user-agent.ts";

const BOTS = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
  "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "WhatsApp/2.23.20.0 A",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36",
  "python-requests/2.32.3",
  "Python-urllib/3.12",
  "curl/8.7.1",
  "Wget/1.21.4",
  "Go-http-client/1.1",
  "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
  "Screaming Frog SEO Spider/20.0",
];

const PEOPLE = [
  // iPhone Safari, the most common mail-client hand-off.
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  // Gmail on Android opens links in Chrome.
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  // An Android in-app WebView.
  "Mozilla/5.0 (Linux; Android 13; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36",
  // Outlook for iOS hands off to an in-app Safari view.
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Outlook-iOS/2.0",
  // Desktop browsers.
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
  // A phone brand whose name contains "bot" inside a word.
  "Mozilla/5.0 (Linux; Android 11; CUBOT_NOTE_20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
];

Deno.test("isBotUserAgent: crawlers, preview fetchers and scripted clients match", () => {
  for (const ua of BOTS) assertEquals(isBotUserAgent(ua), true, ua);
});

Deno.test("isBotUserAgent: real browsers and in-app views never match", () => {
  for (const ua of PEOPLE) assertEquals(isBotUserAgent(ua), false, ua);
});

Deno.test("isBotUserAgent: a missing header is not a bot", () => {
  assertEquals(isBotUserAgent(null), false);
  assertEquals(isBotUserAgent(undefined), false);
  assertEquals(isBotUserAgent(""), false);
});
