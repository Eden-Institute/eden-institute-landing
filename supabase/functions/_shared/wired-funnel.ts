// supabase/functions/_shared/wired-funnel.ts
// Wired quiz W10 (spec section 15): the quiz's numbers in the founder emails, read from public.wired_funnel_daily
// and public.wired_clicks_by_placement_daily (the same numbers in both emails). Counts only: never a nickname,
// grade, wiring or email address.
//   - Daily digest: one line of yesterday's counts (button clicks, starts, completions, new learner emails,
//     Blueprints, Family Maps), in the data part, never a punch item. Left out on a day with all zeros, so the
//     dark quiz adds nothing to her email until it opens.
//   - Weekly briefing: this week vs last week down the funnel, clicks by button, completions by band, and the
//     click-to-completion and completion-to-purchase rates against the body-pattern quiz benchmark (158
//     completions, 6 guide purchases, about 3.8%, Apr 26 - Nov 15 2026). Left out when both weeks are empty.

export interface FunnelDay {
  day: string; clicks: number; starts: number; completions: number;
  completions_k2: number; completions_g3_5: number; completions_g6_8: number; completions_g9_12: number;
  new_learner_emails: number; blueprints: number; family_maps: number;
}
export interface PlacementClicks { placement: string; clicks: number }

const KEYS = ["clicks", "starts", "completions", "completions_k2", "completions_g3_5", "completions_g6_8", "completions_g9_12", "new_learner_emails", "blueprints", "family_maps"] as const;
type Totals = Record<typeof KEYS[number], number>;

export function sumDays(days: FunnelDay[]): Totals {
  const t = Object.fromEntries(KEYS.map((k) => [k, 0])) as Totals;
  for (const d of days) for (const k of KEYS) t[k] += Number(d[k]) || 0;
  return t;
}
const empty = (t: Totals) => KEYS.every((k) => t[k] === 0);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Placement codes (W11, approved names) in plain words. */
export const PLACEMENT_LABEL: Record<string, string> = {
  header: "site header", homeschool_inline: "/homeschool", sample_inline: "Eden's Table sample", freebies_inline: "freebies page",
  esa_inline: "ESA pages", home_inline: "home page", bodypattern_results: "body-pattern results", blog_end: "end of blog posts",
  exit_popup: "exit pop-up", unknown: "other",
};
export const BENCHMARK = { completions: 158, purchases: 6, label: "body-pattern quiz, Apr 26 to Nov 15, 2026" };

export function dailyLine(day: FunnelDay | null): { html: string; text: string } | null {
  if (!day) return null;
  const t = sumDays([day]);
  if (empty(t)) return null;
  const s = `${plural(t.clicks, "button click")} · ${plural(t.starts, "start")} · ${plural(t.completions, "completion")} · ` +
    `${plural(t.new_learner_emails, "new learner email")} · ${plural(t.blueprints, "Blueprint")} · ${plural(t.family_maps, "Family Map")}`;
  return {
    html: `<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:16px 0 8px 0;">Wired quiz yesterday</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#1C3A2E;margin:0 0 8px 0;">${esc(s)}</p>`,
    text: `Wired quiz yesterday: ${s}`,
  };
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((1000 * a) / b) / 10}%` : "n/a");

export function weeklySection(thisWeek: FunnelDay[], lastWeek: FunnelDay[], placements: PlacementClicks[]): { html: string; text: string } | null {
  const a = sumDays(thisWeek);
  const b = sumDays(lastWeek);
  if (empty(a) && empty(b)) return null;
  const purchases = a.blueprints + a.family_maps;
  const rows: [string, number, number][] = [
    ["Button clicks", a.clicks, b.clicks], ["Starts", a.starts, b.starts], ["Completions", a.completions, b.completions],
    ["New learner emails", a.new_learner_emails, b.new_learner_emails], ["Blueprints", a.blueprints, b.blueprints], ["Family Maps", a.family_maps, b.family_maps],
  ];
  const byButton = placements.filter((p) => p.clicks > 0).sort((x, y) => y.clicks - x.clicks || x.placement.localeCompare(y.placement))
    .map((p) => `${PLACEMENT_LABEL[p.placement] ?? p.placement} ${p.clicks}`);
  const bands = `K-2 ${a.completions_k2}, 3-5 ${a.completions_g3_5}, 6-8 ${a.completions_g6_8}, 9-12 ${a.completions_g9_12}`;
  const rates = `Clicks to completions ${pct(a.completions, a.clicks)}; completions to purchases ${pct(purchases, a.completions)} ` +
    `(${BENCHMARK.label}: ${pct(BENCHMARK.purchases, BENCHMARK.completions)}).`;
  const text = [
    "WIRED QUIZ (this week vs last week)",
    ...rows.map(([l, x, y]) => `  ${l}: ${x} (was ${y})`),
    `  By button: ${byButton.length ? byButton.join(", ") : "none"}`,
    `  Completions by band: ${bands}`,
    `  ${rates}`,
  ].join("\n");
  const td = "padding:6px 10px;border-bottom:1px solid #E8E3DA;font-family:Georgia,serif;font-size:14px;color:#1C3A2E;";
  const html = `<h2 style="font-family:Georgia,serif;font-size:18px;color:#1C3A2E;margin:24px 0 8px 0;">Wired quiz</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
<tr><td style="${td}"></td><td style="${td}text-align:right;"><strong>This week</strong></td><td style="${td}text-align:right;">Last week</td></tr>
${rows.map(([l, x, y]) => `<tr><td style="${td}">${esc(l)}</td><td style="${td}text-align:right;"><strong>${x}</strong></td><td style="${td}text-align:right;">${y}</td></tr>`).join("\n")}
</table>
<p style="font-family:Georgia,serif;font-size:14px;color:#3D3832;margin:10px 0 4px 0;">By button: ${esc(byButton.length ? byButton.join(", ") : "none")}</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#3D3832;margin:4px 0;">Completions by band: ${esc(bands)}</p>
<p style="font-family:Georgia,serif;font-size:14px;color:#3D3832;margin:4px 0;">${esc(rates)}</p>`;
  return { html, text };
}
