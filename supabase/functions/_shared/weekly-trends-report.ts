// weekly-trends-report: turns a weekly_trends_snapshot() result into the Friday
// trends email (subject, html, text). PURE, no env and no network, so the wording
// and the math are testable (weekly-trends-report.test.ts) and only
// weekly-trends-digest imports it.
//
// 2026-10-23 (founder): the sign-up rate divides leads by NEW VISITORS ON THE
// SIGN-UP PAGES (snapshot.lead_page_visitors, see migration
// 20261023180000_weekly_trends_lead_page_visitors.sql), not by every visitor. The
// old rate read a week of ESA outreach and Week 1 download clicks as a "conversion
// slip". The two "Eden's Table · waitlist" rows were Back to Eden Chapter 1 and the
// Cultivators waitlist; each source now has its own label, and rows that share a
// label are added together.

export interface BySource { funnel: string; source: string; wk: 'this' | 'last'; n: number; }
export interface WeekPair { this: number; last: number }
export interface Snapshot {
  generated_at: string;
  this_week_start: string;
  last_week_start: string;
  leads: { this: number; last: number; by_source: BySource[] };
  traffic_views: WeekPair;
  traffic_visitors: WeekPair;
  // Added 2026-10-23. Optional so an RPC from before that migration still renders
  // (the rate then falls back to all visitors and says so).
  lead_page_visitors?: WeekPair;
  quiz: WeekPair;
}

// Under about 30 leads a week, a 20% swing is within chance.
const SMALL_NUMBERS_LEADS = 60; // both weeks together

// ── (funnel, source) → human label, matching the daily digest vocabulary. ──
export function friendly(funnel: string, source: string): string {
  if (funnel === 'quiz_funnel' || funnel === 'constitution_assessment') return 'Constitution Quiz';
  if (funnel === 'homeschool') {
    if (source === 'sprouts_magnet') return "Eden's Table · Sprouts (K-2) magnet";
    if (source === 'seedlings_magnet') return "Eden's Table · Seedlings (3-5) magnet";
    if (source === 'reserve') return "Eden's Table · Founders Club (Reserve)";
    return "Eden's Table · Homeschool (general)";
  }
  if (funnel === 'edens_table') {
    if (source === 'sprouts_magnet') return "Eden's Table · Sprouts (K-2) magnet";
    if (source === 'seedlings_magnet') return "Eden's Table · Seedlings (3-5) magnet";
    if (source === 'reserve') return "Eden's Table · Founders Club (Reserve)";
    if (source === 'constitution_assessment') return 'Constitution Quiz';
    if (source === 'back_to_eden_ch1') return 'Back to Eden · free Chapter 1';
    if (source === 'cultivators_waitlist') return 'Cultivators (6-8) · waitlist';
    if (source === 'practitioners_waitlist') return 'Practitioners (9-12) · waitlist';
    if (source === '(unattributed)' || source === 'waitlist') return "Eden's Table · waitlist";
    // A new source shows its own name rather than hiding under "waitlist".
    return `Eden's Table · ${source}`;
  }
  if (funnel === 'course_tier2') return 'Tier 2 (Root) · waitlist';
  if (funnel === 'app_beta') return 'Apothecary App · beta waitlist';
  if (funnel === 'practitioner_waitlist') return 'Practitioner · waitlist';
  if (funnel === 'community') return 'Community · waitlist';
  return `${funnel} · ${source}`;
}

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Trend math ──
export interface Trend { thisN: number; lastN: number; abs: number; pct: number | null; label: string; arrow: string; }
export function trend(thisN: number, lastN: number): Trend {
  const abs = thisN - lastN;
  let pct: number | null = null;
  if (lastN > 0) pct = Math.round((abs / lastN) * 100);
  let label: string;
  let arrow: string;
  if (lastN === 0 && thisN === 0) { label = 'no activity'; arrow = '—'; }
  else if (lastN === 0) { label = 'new this week'; arrow = '▲'; }
  else if (pct !== null && pct >= 15) { label = 'accelerating'; arrow = '▲'; }
  else if (pct !== null && pct <= -15) { label = 'cooling'; arrow = '▼'; }
  else { label = 'steady'; arrow = '→'; }
  return { thisN, lastN, abs, pct, label, arrow };
}
export function pctStr(t: Trend): string {
  if (t.lastN === 0 && t.thisN === 0) return 'flat (0)';
  if (t.lastN === 0) return `new (+${t.thisN})`;
  const sign = t.abs > 0 ? '+' : '';
  return `${sign}${t.abs} (${sign}${t.pct}%)`;
}
export function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10; // one decimal %
}
// "rose" / "fell" / "held", on the same ±15% line trend() uses.
function moved(t: Trend): string {
  if (t.pct === null) return t.thisN > 0 ? 'rose' : 'held';
  if (t.pct >= 15) return 'rose';
  if (t.pct <= -15) return 'fell';
  return 'held';
}

export function ctDateString(now: Date): string {
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, '0');
  const d = String(ct.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function ctRange(startIso: string, endIso: string): string {
  const opt: Intl.DateTimeFormatOptions = { timeZone: 'America/Chicago', month: 'short', day: 'numeric' };
  return `${new Date(startIso).toLocaleDateString('en-US', opt)} – ${new Date(endIso).toLocaleDateString('en-US', opt)}`;
}

// ── Roll up by_source into funnel-level this/last + per-label source rows. ──
export interface Line { key: string; label: string; thisN: number; lastN: number; }
export function rollup(by: BySource[]): { funnels: Line[]; sources: Line[] } {
  const fmap = new Map<string, Line>();
  const smap = new Map<string, Line>();
  for (const r of by) {
    const f = fmap.get(r.funnel) ?? { key: r.funnel, label: r.funnel, thisN: 0, lastN: 0 };
    if (r.wk === 'this') f.thisN += r.n; else f.lastN += r.n;
    fmap.set(r.funnel, f);

    // Keyed by LABEL: two (funnel, source) pairs that mean the same thing (a Sprouts
    // magnet under 'homeschool' and under 'edens_table') are one row, never two
    // identical-looking rows.
    const label = friendly(r.funnel, r.source);
    const s = smap.get(label) ?? { key: label, label, thisN: 0, lastN: 0 };
    if (r.wk === 'this') s.thisN += r.n; else s.lastN += r.n;
    smap.set(label, s);
  }
  return {
    funnels: Array.from(fmap.values()).sort((a, b) => b.thisN - a.thisN),
    sources: Array.from(smap.values()).sort((a, b) => b.thisN - a.thisN || b.lastN - a.lastN),
  };
}

// ── The rate's denominator: new visitors on sign-up pages, else every visitor. ──
export interface RateBasis { pair: WeekPair; onLeadPages: boolean }
export function rateBasis(s: Snapshot): RateBasis {
  const lp = s.lead_page_visitors;
  if (lp && typeof lp.this === 'number' && typeof lp.last === 'number') return { pair: lp, onLeadPages: true };
  return { pair: s.traffic_visitors, onLeadPages: false };
}

// ── The interpretation: anomalies + one recommended focus. ──
export function interpret(s: Snapshot, sources: Line[]): { anomalies: string[]; focus: string } {
  const anomalies: string[] = [];
  const leadsT = trend(s.leads.this, s.leads.last);
  const visT = trend(s.traffic_visitors.this, s.traffic_visitors.last);
  const basis = rateBasis(s);
  const reachT = trend(basis.pair.this, basis.pair.last);
  const reachName = basis.onLeadPages ? 'new visitors on the sign-up pages' : 'visits';
  const convThis = rate(s.leads.this, basis.pair.this);
  const convLast = rate(s.leads.last, basis.pair.last);
  const rateName = basis.onLeadPages ? 'Sign-up rate on the sign-up pages' : 'Visitor→lead rate';

  // Source dried up / spiked.
  for (const src of sources) {
    if (src.lastN >= 3 && src.thisN === 0) anomalies.push(`${src.label} went quiet: ${src.lastN} last week, 0 this week.`);
    if (src.lastN === 0 && src.thisN >= 3) anomalies.push(`${src.label} appeared from nothing: ${src.thisN} this week.`);
    if (src.lastN >= 3 && src.thisN >= src.lastN * 2) anomalies.push(`${src.label} doubled: ${src.lastN} → ${src.thisN}.`);
  }
  // Total visits up, but mostly on pages that cannot take a sign-up.
  if (basis.onLeadPages && visT.pct !== null && visT.pct >= 15 && reachT.pct !== null && visT.pct - reachT.pct >= 15) {
    const lpPct = `${reachT.pct >= 0 ? '+' : ''}${reachT.pct}%`;
    anomalies.push(`Visits rose ${pctStr(visT)}, but new visitors on the sign-up pages went ${reachT.lastN} → ${reachT.thisN} (${lpPct}). Most of the extra traffic was on pages without a sign-up form.`);
  }
  // More people reached the sign-up pages, but leads did not follow.
  if (reachT.pct !== null && reachT.pct >= 15 && leadsT.pct !== null && leadsT.pct <= 0) {
    anomalies.push(basis.onLeadPages
      ? `New visitors on the sign-up pages rose ${pctStr(reachT)} but leads didn't follow.`
      : `Visits rose ${pctStr(reachT)} but leads didn't follow.`);
  }
  // Rate movement.
  if (convThis !== null && convLast !== null) {
    const rel = convLast > 0 ? Math.round(((convThis - convLast) / convLast) * 100) : null;
    if (rel !== null && rel <= -20) anomalies.push(`${rateName} fell ${convLast}% → ${convThis}% (${rel}%).`);
    if (rel !== null && rel >= 25) anomalies.push(`${rateName} jumped ${convLast}% → ${convThis}% (+${rel}%).`);
  }

  const small = s.leads.this + s.leads.last < SMALL_NUMBERS_LEADS;
  const smallNote = small
    ? ` Small numbers: ${s.leads.last} → ${s.leads.this} leads can swing this much by chance, so watch next week before changing a page.`
    : '';

  // Recommended focus: first matching rule wins.
  let focus: string;
  if (basis.pair.this > 0 && s.leads.this === 0) {
    focus = basis.onLeadPages
      ? 'Capture. People reached the sign-up pages but none signed up. Check the offer and the sign-up button first.'
      : 'Capture. Visitors are arriving but none signed up. Check the offer and the sign-up button first.';
  } else if (reachT.pct !== null && reachT.pct <= -15) {
    focus = `Reach. Fewer ${reachName} this week (${reachT.lastN} → ${reachT.thisN}). The lever is bringing more new people to those pages, not changing the pages.`;
  } else if (convThis !== null && convLast !== null && convLast > 0 && (convThis - convLast) / convLast <= -0.2) {
    const who = reachName.charAt(0).toUpperCase() + reachName.slice(1);
    focus = `Conversion. ${who} ${moved(reachT)} (${reachT.lastN} → ${reachT.thisN}) but fewer signed up (${convLast}% → ${convThis}%). Check the sign-up pages and pop-up for anything in the way.${smallNote}`;
  } else if (leadsT.pct !== null && leadsT.pct >= 15) {
    const top = sources[0];
    focus = top ? `Scale what's working. Leads are accelerating, and ${top.label} is your top source this week; lean into it.` : "Scale what's working. Leads are accelerating.";
  } else {
    // Find a stalled source to nudge.
    const stalled = sources.find((x) => x.lastN >= 3 && x.thisN < x.lastN);
    focus = stalled
      ? `Shore up ${stalled.label}: it slipped from ${stalled.lastN} to ${stalled.thisN}.`
      : 'Steady week. Nothing moved outside the normal range.';
  }
  return { anomalies, focus };
}

export function buildEmail(s: Snapshot, runDate: string): { subject: string; html: string; text: string } {
  const leadsT = trend(s.leads.this, s.leads.last);
  const viewsT = trend(s.traffic_views.this, s.traffic_views.last);
  const visT = trend(s.traffic_visitors.this, s.traffic_visitors.last);
  const quizT = trend(s.quiz.this, s.quiz.last);
  const basis = rateBasis(s);
  const lpT = basis.onLeadPages ? trend(basis.pair.this, basis.pair.last) : null;
  const convThis = rate(s.leads.this, basis.pair.this);
  const convLast = rate(s.leads.last, basis.pair.last);
  const { funnels: _funnels, sources } = rollup(s.leads.by_source);
  const { anomalies, focus } = interpret(s, sources);

  const thisRange = ctRange(s.this_week_start, s.generated_at);
  const lastRange = ctRange(s.last_week_start, s.this_week_start);

  const subject = `Weekly trends — ${s.leads.this} lead${s.leads.this === 1 ? '' : 's'}, ${pctStr(leadsT)} · ${runDate}`;

  const metric = (name: string, t: Trend, extra?: string) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:14px;color:#1C3A2E;">${esc(name)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:18px;color:#1C3A2E;text-align:right;font-weight:bold;">${t.thisN}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:13px;text-align:right;color:#6B6560;">${t.lastN}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E0D0;font-family:Georgia,serif;font-size:13px;color:${t.arrow === '▲' ? '#2E6B3E' : t.arrow === '▼' ? '#A6492F' : '#6B6560'};">${t.arrow} ${esc(pctStr(t))}<br><span style="font-size:11px;color:#A8A29A;font-style:italic;">${esc(t.label)}${extra ? ' · ' + esc(extra) : ''}</span></td>
    </tr>`;

  const rateWhat = basis.onLeadPages ? 'of new sign-up-page visitors' : 'of all visitors';
  const convExtra = convThis !== null ? `${convThis}% ${rateWhat}${convLast !== null ? ` (was ${convLast}%)` : ''}` : 'no visitor data';

  const visitorNote = basis.onLeadPages
    ? "Visitors are counted once per day: the counter resets daily, so someone who comes back on three days counts three times. New visitors on sign-up pages = people who viewed a page with a sign-up form (home, /homeschool, /freebies, /back-to-eden, /constitutional-herbalism, /community, the quiz), not counting people who arrived from Eden's own emails to the list. The sign-up rate is leads divided by that number."
    : 'Visitors are counted once per day: the counter resets daily, so someone who comes back on three days counts three times. The sign-up rate here is leads divided by ALL visitors (the sign-up-page count was not available).';

  const sourceRows = sources.filter((x) => x.thisN > 0 || x.lastN > 0).map((x) => {
    const t = trend(x.thisN, x.lastN);
    return `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;">${esc(x.label)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:13px;color:#1C3A2E;text-align:right;font-weight:bold;">${x.thisN}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:12px;color:#6B6560;text-align:right;">${x.lastN}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #F0EAD8;font-family:Georgia,serif;font-size:12px;color:${t.arrow === '▲' ? '#2E6B3E' : t.arrow === '▼' ? '#A6492F' : '#6B6560'};">${t.arrow} ${esc(pctStr(t))}</td>
    </tr>`;
  }).join('');

  const anomaliesHtml = anomalies.length
    ? anomalies.map((a) => `<li style="font-family:Georgia,serif;font-size:13px;color:#3D3832;margin-bottom:6px;">${esc(a)}</li>`).join('')
    : `<li style="font-family:Georgia,serif;font-size:13px;color:#6B6560;font-style:italic;">Nothing unusual. The numbers moved within normal range.</li>`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F5F0E8;font-family:Georgia,serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#FFFFFF;">

<tr><td style="background:#1C3A2E;padding:28px 24px;text-align:center;">
<div style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;">THE EDEN INSTITUTE</div>
<div style="font-family:Georgia,serif;font-size:14px;color:#F5F0E8;font-style:italic;padding-top:6px;">Weekly Trends Briefing</div>
</td></tr>

<tr><td style="padding:24px 24px 8px 24px;">
<p style="font-family:Georgia,serif;font-size:13px;color:#6B6560;margin:0 0 4px 0;">This week (${esc(thisRange)}) vs last week (${esc(lastRange)}) · America/Chicago</p>
<p style="font-family:Georgia,serif;font-size:22px;color:#1C3A2E;margin:8px 0 4px 0;font-weight:bold;">${s.leads.this} new lead${s.leads.this === 1 ? '' : 's'} this week <span style="font-size:15px;color:${leadsT.arrow === '▼' ? '#A6492F' : '#2E6B3E'};">${leadsT.arrow} ${esc(pctStr(leadsT))}</span></p>
</td></tr>

<tr><td style="padding:8px 24px;">
<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">The numbers</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
<thead><tr style="background:#F5F0E8;">
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Metric</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">This</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Last</th>
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Trend</th>
</tr></thead>
<tbody>
${metric('Leads captured', leadsT, convExtra)}
${lpT ? metric('New visitors on sign-up pages', lpT) : ''}
${metric('Visitors, all pages', visT)}
${metric('Page views', viewsT)}
${metric('Quiz completions', quizT)}
</tbody>
</table>
<p style="font-family:Georgia,serif;font-size:11px;color:#A8A29A;font-style:italic;margin:0 0 24px 0;line-height:1.5;">${esc(visitorNote)}</p>

<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">Leads by source</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
<thead><tr style="background:#F5F0E8;">
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Source</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">This</th>
<th style="padding:8px 12px;text-align:right;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">Last</th>
<th style="padding:8px 12px;text-align:left;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#6B6560;text-transform:uppercase;border-bottom:2px solid #C9A84C;">WoW</th>
</tr></thead>
<tbody>${sourceRows || `<tr><td colspan="4" style="padding:10px 12px;font-family:Georgia,serif;font-size:13px;color:#6B6560;font-style:italic;">No leads in either week.</td></tr>`}</tbody>
</table>

<p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 8px 0;">What stands out</p>
<ul style="margin:0 0 24px 0;padding-left:20px;">${anomaliesHtml}</ul>

<div style="background:#1C3A2E;padding:18px 20px;margin-bottom:8px;">
<p style="font-family:Georgia,serif;font-size:11px;font-weight:bold;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 6px 0;">This week&#x2019;s focus</p>
<p style="font-family:Georgia,serif;font-size:15px;color:#F5F0E8;margin:0;line-height:1.5;">${esc(focus)}</p>
</div>
</td></tr>

<tr><td style="background:#F5F0E8;padding:18px;text-align:center;font-family:Georgia,serif;font-size:11px;color:#6B6560;">
The Eden Institute · edeninstitute.health · automated weekly trends · testers &amp; bots excluded
</td></tr>

</table></td></tr></table></body></html>`;

  const text = [
    `WEEKLY TRENDS — ${runDate}`,
    `This week (${thisRange}) vs last week (${lastRange}), CT`,
    '',
    `Leads:                         ${leadsT.thisN}  (was ${leadsT.lastN})  ${pctStr(leadsT)}, ${leadsT.label}` + (convThis !== null ? `  · ${convExtra}` : ''),
    ...(lpT ? [`New visitors on sign-up pages: ${lpT.thisN}  (was ${lpT.lastN})  ${pctStr(lpT)}, ${lpT.label}`] : []),
    `Visitors, all pages:           ${visT.thisN}  (was ${visT.lastN})  ${pctStr(visT)}, ${visT.label}`,
    `Page views:                    ${viewsT.thisN}  (was ${viewsT.lastN})  ${pctStr(viewsT)}, ${viewsT.label}`,
    `Quiz completions:              ${quizT.thisN}  (was ${quizT.lastN})  ${pctStr(quizT)}, ${quizT.label}`,
    `Note: ${visitorNote}`,
    '',
    'Leads by source:',
    ...sources.filter((x) => x.thisN > 0 || x.lastN > 0).map((x) => `  ${x.thisN} (was ${x.lastN})\t${x.label}`),
    '',
    'What stands out:',
    ...(anomalies.length ? anomalies.map((a) => `  - ${a}`) : ['  - Nothing unusual.']),
    '',
    `THIS WEEK'S FOCUS: ${focus}`,
  ].join('\n');

  return { subject, html, text };
}
