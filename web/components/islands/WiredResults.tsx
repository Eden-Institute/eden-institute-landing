// Fearfully & Wonderfully Wired: the results page /wired/results (W4; spec 7.1 step 8, 7.2, answer 28).
// Private page (noThirdPartyTags): the token arrives in localStorage from the quiz, or as ?t= from an
// email link (W8), which is moved to localStorage and STRIPPED from the address bar at once (answer 12).
// Copy: web/lib/wiredCopy.ts + wiredWriteups.ts (approved, word for word).
// Buy buttons (W6): create-checkout's wired cart; Stripe brings her back with ?paid=, which is stripped.
// W9 (2026-11-20): the side by side, the teen link, the observer invites (WiredRaterPanels) and "Delete my quiz data".
// 2026-11-21 (Camila's taps): each match links to its curriculum (the affiliate link when it is one, with "Eden earns a
// commission" beside it) and its reason lines get the prep / "Free" fields; up to 3 Helpful extras below the matches
// (answer 38: type label + "Screen-based", never numbered); the later $28 upgrade in the Family Map box when
// wired-results says a Blueprint was bought this quiz year; and the coming-soon "Join the waitlist" button opens the
// Curriculum Finder's grade 6-12 waitlist form (BandWaitlistModal).
// 2026-11-21 (Camila's tap, "Build it, as written"): the "Your own questions" box (WiredOwnQuestions) at the top for a
// Family Map family (paid or pilot) whose mom has not answered her own set; the Family Map email's "Answer my
// questions" button lands here. client:only.

import { useEffect, useState } from "react";
import { getMatches, getResults, RESULTS_KEY, savedResultsToken, startWiredCheckout, WiredDark, wiredIsDark, writeStore, type WiredBuy } from "../../lib/wiredApi";
import WiredNotOpen from "./WiredNotOpen";
import { CHECKOUT } from "../../lib/wiredCheckoutCopy";
import { upperBandOf, type UpperBand } from "../../lib/bandWaitlist";
import BandWaitlistModal from "./BandWaitlistModal";
import WiredOwnQuestions from "./WiredOwnQuestions";
import { APPROACHES, COMING_SOON_912, REASONS, RESULTS, SCREENS, TIP_LABELS, TIPS, fill, type TipKind } from "../../lib/wiredCopy";
import { WIRING_WRITEUPS } from "../../lib/wiredWriteups";
import { Observers, type RaterView, SideBySide, TeenLink } from "./WiredRaterPanels";
import { W9 } from "../../lib/wiredCopyW9";
import { DOMAINS, type Domain } from "../../../supabase/functions/_shared/wired-engine";

interface Match {
  id: string; name: string; because: string[]; served_top3: Domain[]; components: Record<string, number>; esa_state?: string;
  // Display fields (wired-matches / wired-results, read after ranking): url is already the affiliate link when is_affiliate.
  prep_load?: string; price_cents?: number | null; price_basis?: string | null; url?: string | null; is_affiliate?: boolean;
}
/** A Helpful extra (answer 38): never ranked, so it is never numbered on the page. */
interface Extra { id: string; name: string; resource_type: string; screen_based: boolean; url: string | null; is_affiliate: boolean }
interface ChildResults {
  child_id: string; nickname: string; grade: number; unlocked: boolean; preview?: { top_wiring: Domain };
  scores?: Record<Domain, number>; top3?: Domain[]; renaissance?: boolean; tip_first?: TipKind;
  approach?: { fits: { approach: string; room_for: Domain[] }[]; already_there: boolean; her_approach: string | null };
  matches?: Match[]; coming_soon?: { name: string; eden_band: string | null }[]; offers: { blueprint: boolean; family_map: boolean };
  extras?: Extra[];
  raters?: RaterView[]; teen_link_allowed?: boolean; observers_allowed?: boolean;
}

const TIP_ORDER: TipKind[] = ["try_today", "low_prep", "together"];
const btn = "inline-flex items-center justify-center font-accent text-sm tracking-[0.2em] uppercase font-bold px-6 py-3 rounded-md";
const forest = { backgroundColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-cream))" };
const wname = (d: Domain) => WIRING_WRITEUPS[d].name;

function takeToken(): string | null {
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("t");
    if (t) {
      writeStore(RESULTS_KEY, t);
      url.searchParams.delete("t");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
      return t;
    }
  } catch {
    /* fall through */
  }
  return savedResultsToken();
}

/** True once when Stripe sent her back (?paid=cs_...); the parameter is removed from the address bar. */
function takePaid(): boolean {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("paid")) return false;
    url.searchParams.delete("paid");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    return true;
  } catch {
    return false;
  }
}

export function reasonLines(m: Match, name: string, top3: Domain[]): string[] {
  const out: string[] = [];
  for (const r of m.because) {
    if (r === "wiring") {
      const s = top3.filter((d) => m.served_top3.includes(d)).map(wname);
      if (s.length >= 3) out.push(fill(REASONS.wiring3, { name, a: s[0], b: s[1], c: s[2] }));
      else if (s.length === 2) out.push(fill(REASONS.wiring2, { name, a: s[0], b: s[1] }));
      else if (s.length === 1) out.push(fill(REASONS.wiring1, { name, a: s[0] }));
    } else if (r === "budget") {
      if (m.price_cents === 0) out.push(REASONS.budgetFree);
      else out.push(m.components.budget >= 1 ? REASONS.budgetWithin : REASONS.budgetOver);
    } else if (r === "prep") {
      if (m.prep_load && REASONS.prep[m.prep_load]) out.push(REASONS.prep[m.prep_load] + (m.components.prep < 1 ? ` ${REASONS.prepOver}` : ""));
    } else if (r === "siblings") out.push(REASONS.siblings);
    else if (r === "esa" && m.esa_state) out.push(fill(REASONS.esa, { state: m.esa_state }));
  }
  return out;
}

export default function WiredResults() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "dark" | "error">("loading");
  const [children, setChildren] = useState<ChildResults[]>([]);
  const [sel, setSel] = useState(0);
  const [filters, setFilters] = useState({ withinBudget: false, christianOnly: false, esaOnly: false, state: "" });
  const [live, setLive] = useState<{ matches: Match[]; budget_filter_offered: boolean; extras?: Extra[] } | null>(null);
  // The later $28 upgrade (spec 9.2): { blueprint_nickname } when she bought a Blueprint this quiz year, else null.
  const [upgrade, setUpgrade] = useState<{ blueprint_nickname: string } | null>(null);
  // The "Your own questions" box (2026-11-21): a Family Map family (paid or pilot) whose mom has not answered her own set.
  const [ownBox, setOwnBox] = useState(false);
  const [waitlist, setWaitlist] = useState<UpperBand | null>(null);
  const [paid, setPaid] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState(false);
  // The store's one-reminder box, same approved words (answer 20): her email is already known from the quiz.
  const [remind, setRemind] = useState(false);

  useEffect(() => {
    const t = takeToken();
    setToken(t);
    // No results on this device: while the quiz is dark that is "not open yet", not "no results".
    if (!t) { void wiredIsDark().then((dark) => setState(dark ? "dark" : "none")); return; }
    const load = () => getResults(t)
      .then(({ status, data }) => {
        if (status === 401) return setState("none");
        if (status !== 200) return setState("error");
        setChildren(((data as { children?: ChildResults[] }).children) ?? []);
        setUpgrade((data as { family_map_upgrade?: { blueprint_nickname: string } | null }).family_map_upgrade ?? null);
        const own = data as { has_family_map?: boolean; own_questions_answered?: boolean };
        setOwnBox(own.has_family_map === true && own.own_questions_answered !== true);
        setState("ready");
      })
      .catch((err) => setState(err instanceof WiredDark ? "dark" : "error"));
    load();
    // Back from Stripe: the webhook may land a few seconds after her, so look again twice.
    if (takePaid()) {
      setPaid(true);
      setTimeout(load, 4000);
      setTimeout(load, 12000);
    }
  }, []);

  async function buy(product: WiredBuy, childIds?: string[]) {
    if (!token || buying) return;
    setBuying(product);
    setBuyError(null);
    try {
      const { status, data } = await startWiredCheckout({ token, product, ...(remind ? { reminder_consent: true } : {}), ...(childIds ? { child_ids: childIds } : {}) });
      if (status === 200 && data.url) {
        window.location.assign(data.url);
        return;
      }
      setBuyError(data.error ?? CHECKOUT.failed);
    } catch {
      setBuyError(CHECKOUT.failed);
    }
    setBuying(null);
  }

  const child = children[sel];
  useEffect(() => {
    if (!token || !child?.unlocked) return setLive(null);
    const f = { ...filters, esaOnly: filters.esaOnly && /^[A-Za-z]{2}$/.test(filters.state), state: filters.state || null };
    getMatches({ token, child_id: child.child_id, filters: f, ranking: null })
      .then(({ status, data }) => status === 200 && setLive(data as never))
      .catch(() => {});
  }, [token, child?.child_id, filters.withinBudget, filters.christianOnly, filters.esaOnly, filters.state]);

  const wrap = (c: React.ReactNode) => <div className="max-w-2xl mx-auto px-4 py-8 font-body" style={{ color: "hsl(var(--eden-bark))" }}>{c}</div>;
  if (state === "loading") return wrap(<p>Loading your results...</p>);
  if (state === "dark") return <WiredNotOpen />;
  if (state === "none") return wrap(<p>We couldn't find quiz results on this device. Open the link in your results email.</p>);
  if (state === "error" || !child) return wrap(<p>We couldn't load your results just now. Please try again in a minute.</p>);

  const name = child.nickname;
  const remindBox = (
    <label className="mt-3 flex items-start gap-2 font-body text-sm text-muted-foreground">
      <input id="wired-remind" type="checkbox" className="mt-1" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
      <span>If I don&apos;t finish checking out, send me one reminder.</span>
    </label>
  );
  const buyNote = buyError ? <p className="text-sm mt-3" role="alert">{buyError}</p> : buying ? <p className="text-sm mt-3">{CHECKOUT.starting}</p> : null;
  const paidNote = paid && (
    <p className="mb-6 rounded-md p-4" style={{ backgroundColor: "hsl(var(--eden-cream))" }} role="status">
      {children.length > 1 ? CHECKOUT.paidThanksFamily : fill(CHECKOUT.paidThanks, { name })}
    </p>
  );
  const tabs = children.length > 1 && (
    <div className="flex flex-wrap gap-2 mb-6">
      {children.map((c, k) => (
        <button key={c.child_id} type="button" onClick={() => setSel(k)} className="font-body text-sm rounded-full border px-4 py-2"
          style={{ borderColor: "hsl(var(--eden-gold) / 0.6)", backgroundColor: k === sel ? "hsl(var(--eden-cream))" : "transparent" }}>{c.nickname}</button>
      ))}
    </div>
  );

  if (!child.unlocked) {
    return wrap(<>
      {tabs}
      <p className="text-base">{fill(RESULTS.thirdChild, { name, wiring: child.preview ? wname(child.preview.top_wiring) : "" })}</p>
      <div className="flex flex-wrap gap-3 mt-5">
        <button type="button" className={btn} style={forest} disabled={!!buying} onClick={() => buy("blueprint", [child.child_id])}>{RESULTS.thirdChildBlueprint}</button>
        <button type="button" className={btn} style={forest} disabled={!!buying} onClick={() => buy("family_map")}>{RESULTS.thirdChildFamilyMap}</button>
      </div>
      {remindBox}
      <p className="text-xs mt-2">{CHECKOUT.allSalesFinal}</p>
      {buyNote}
    </>);
  }

  const scores = child.scores!;
  const top3 = child.top3!;
  const sorted = DOMAINS.slice().sort((a, b) => scores[b] - scores[a]);
  const tips = [child.tip_first ?? "try_today", ...TIP_ORDER.filter((t) => t !== (child.tip_first ?? "try_today"))] as TipKind[];
  const matches = live?.matches ?? child.matches ?? [];
  const extras = live?.extras ?? child.extras ?? [];
  const budgetOffered = live?.budget_filter_offered ?? true;

  return wrap(<>
    {paidNote}
    {token && ownBox && <WiredOwnQuestions token={token} />}
    {tabs}
    <h1 className="font-display text-3xl">{fill(RESULTS.heading, { name })}</h1>
    <p className="mt-3">{fill(RESULTS.intro, { name })}</p>
    {child.renaissance && <p className="mt-4 font-semibold">{fill(RESULTS.renaissance, { name })}</p>}

    <h2 className="font-display text-2xl mt-8">{fill(RESULTS.top3Heading, { name })}</h2>
    {top3.map((d) => (
      <div key={d} className="mt-4">
        <h3 className="font-display text-xl">{WIRING_WRITEUPS[d].name}</h3>
        <p className="mt-1">{WIRING_WRITEUPS[d].short}</p>
        <p className="mt-1 text-sm text-muted-foreground">{WIRING_WRITEUPS[d].bibleLabel}: {WIRING_WRITEUPS[d].bible}</p>
      </div>
    ))}

    <h2 className="font-display text-2xl mt-8">{RESULTS.chartHeading}</h2>
    <p className="text-sm mt-1">{fill(RESULTS.chartCaption, { name })}</p>
    <div className="mt-4 space-y-2">
      {sorted.map((d) => (
        <div key={d}>
          <div className="flex justify-between text-sm"><span>{wname(d)}</span></div>
          <div className="h-3 rounded-full" style={{ backgroundColor: "hsl(var(--eden-gold) / 0.2)" }}>
            <div className="h-3 rounded-full" style={{ width: `${Math.max(2, Math.min(100, scores[d]))}%`, backgroundColor: "hsl(var(--eden-forest))" }} />
          </div>
          {d === "seeker" && <p className="text-xs text-muted-foreground mt-1">{RESULTS.seekerNote}</p>}
        </div>
      ))}
    </div>

    {child.approach && (
      <section className="mt-8">
        <h2 className="font-display text-2xl">{fill(RESULTS.approachHeading, { name })}</h2>
        {child.approach.fits.map((f) => {
          const a = APPROACHES[f.approach];
          if (!a) return null;
          return <p key={f.approach} className="mt-3">{fill(RESULTS.approachLine, { approach: a.name, description: a.description, name, a: wname(f.room_for[0]), b: wname(f.room_for[1] ?? f.room_for[0]) })}</p>;
        })}
        {child.approach.her_approach && <p className="mt-3">{child.approach.already_there ? RESULTS.approachAlreadyThere : RESULTS.approachWorthALook}</p>}
        <p className="text-sm text-muted-foreground mt-2">{fill(RESULTS.approachNote, { name })}</p>
      </section>
    )}

    <section className="mt-8">
      <h2 className="font-display text-2xl">{RESULTS.tipsHeading}</h2>
      {tips.map((t) => (
        <p key={t} className="mt-3"><strong>{TIP_LABELS[t]}:</strong> {fill(TIPS[top3[0]][t], { name })}</p>
      ))}
    </section>

    <section className="mt-8">
      <h2 className="font-display text-2xl">{fill(RESULTS.matchesHeading, { name })}</h2>
      <p className="mt-2">{RESULTS.matchesIntro}</p>
      <div className="mt-3 space-y-2 text-sm">
        {budgetOffered && <label className="flex gap-2"><input type="checkbox" checked={filters.withinBudget} onChange={(e) => setFilters({ ...filters, withinBudget: e.target.checked })} />{RESULTS.filterBudget}</label>}
        <label className="flex gap-2"><input type="checkbox" checked={filters.christianOnly} onChange={(e) => setFilters({ ...filters, christianOnly: e.target.checked })} />{RESULTS.filterChristian}</label>
        <label className="flex gap-2 items-center"><input type="checkbox" checked={filters.esaOnly} onChange={(e) => setFilters({ ...filters, esaOnly: e.target.checked })} />{RESULTS.filterEsa}</label>
        {filters.esaOnly && (
          <input aria-label="State (2 letters)" maxLength={2} className="ml-6 w-20 rounded-md border px-2 py-1 uppercase" value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value.toUpperCase() })} style={{ borderColor: "hsl(var(--eden-gold) / 0.5)" }} />
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-4">{RESULTS.affiliateNote}</p>
      <ol className="mt-3 space-y-3">
        {matches.map((m) => (
          <li key={m.id}>
            <p className="font-semibold">{m.url ? <a href={m.url} className="underline" rel={m.is_affiliate ? "sponsored noopener" : "noopener"} target="_blank">{m.name}</a> : m.name}
              {m.url && m.is_affiliate && <span className="ml-2 text-xs text-muted-foreground">{RESULTS.affiliateLabel}</span>}</p>
            <p className="text-sm">{reasonLines(m, name, top3).join(" · ")}</p>
          </li>
        ))}
      </ol>
      {(child.coming_soon ?? []).map((c) => (
        <div key={c.name} className="mt-4">
          <p className="text-sm"><span className="text-xs uppercase tracking-wide mr-2">{RESULTS.comingSoonLabel}</span>
            {upperBandOf(c.eden_band) === "practitioners" ? COMING_SOON_912 : RESULTS.comingSoon68}</p>
          <button type="button" className={`${btn} mt-2`} style={forest} onClick={() => setWaitlist(upperBandOf(c.eden_band))}>{RESULTS.waitlistButton}</button>
        </div>
      ))}
      {extras.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-xl">{RESULTS.extrasHeading}</h3>
          <p className="mt-1 text-sm">{RESULTS.extrasLine}</p>
          <ul className="mt-3 space-y-2">
            {extras.map((x) => (
              <li key={x.id}>
                <p className="font-semibold">{x.url ? <a href={x.url} className="underline" rel={x.is_affiliate ? "sponsored noopener" : "noopener"} target="_blank">{x.name}</a> : x.name}
                  {x.url && x.is_affiliate && <span className="ml-2 text-xs text-muted-foreground">{RESULTS.affiliateLabel}</span>}</p>
                <p className="text-xs uppercase tracking-wide mt-1">{[x.resource_type, x.screen_based ? RESULTS.screenBased : null].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
    <BandWaitlistModal band={waitlist} formName={waitlist ? `wired_results_${waitlist}_waitlist` : ""} onClose={() => setWaitlist(null)} />

    <section className="mt-8 rounded-md p-5" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
      <p>{fill(RESULTS.blueprintOffer, { name })}</p>
      <p className="mt-2 text-sm">{fill(RESULTS.blueprintObservers, { name })}</p>
      {!upsell ? (
        <button type="button" className={`${btn} mt-4`} style={forest} disabled={!!buying}
          onClick={() => (child.offers.family_map ? setUpsell(true) : buy("blueprint", [child.child_id]))}>{fill(RESULTS.blueprintButton, { name })}</button>
      ) : (
        <div className="mt-4">
          <p className="font-semibold">{CHECKOUT.upsellLine}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <button type="button" className={btn} style={forest} disabled={!!buying} onClick={() => buy("blueprint_upgrade")}>{CHECKOUT.upsellYes}</button>
            <button type="button" className={`${btn} border`} style={{ borderColor: "hsl(var(--eden-forest))", color: "hsl(var(--eden-forest))" }} disabled={!!buying}
              onClick={() => buy("blueprint", [child.child_id])}>{fill(CHECKOUT.upsellNo, { name })}</button>
          </div>
        </div>
      )}
      {remindBox}
      <p className="text-xs mt-2">{RESULTS.blueprintSmall}</p>
      {!child.offers.family_map && buyNote}
    </section>
    {child.offers.family_map && (
      <section className="mt-4 rounded-md p-5" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <p>{RESULTS.familyMapOffer}</p>
        {upgrade ? (<>
          {/* The later $28 upgrade (approved 2026-11-21): a Blueprint bought this quiz year; create-checkout re-checks it. */}
          <p className="mt-2 font-semibold">{fill(RESULTS.familyMapUpgradeLine, { name: upgrade.blueprint_nickname })}</p>
          <button type="button" className={`${btn} mt-4`} style={forest} disabled={!!buying} onClick={() => buy("family_map_upgrade")}>{RESULTS.familyMapUpgradeButton}</button>
          <p className="text-xs mt-2">{CHECKOUT.allSalesFinal}</p>
        </>) : (<>
          <button type="button" className={`${btn} mt-4`} style={forest} disabled={!!buying} onClick={() => buy("family_map")}>{RESULTS.familyMapButton}</button>
          <p className="text-xs mt-2">{RESULTS.familyMapSmall}</p>
        </>)}
        {buyNote}
      </section>
    )}

    <SideBySide name={name} raters={child.raters ?? []} />
    {token && child.teen_link_allowed && <TeenLink token={token} childId={child.child_id} name={name} />}
    {token && child.observers_allowed && <Observers token={token} childId={child.child_id} name={name} />}

    <section className="mt-8">
      <a href="/wired" className={btn} style={forest}>{SCREENS.anotherChild}</a>
      <p className="text-sm mt-2">{children.filter((c) => c.unlocked).length < 2 ? SCREENS.anotherChildFree : SCREENS.anotherChildPaid}</p>
    </section>

    <section className="mt-8">
      <h2 className="font-display text-xl">{RESULTS.notDiagnosticHeading}</h2>
      {RESULTS.notDiagnostic.map((p) => <p key={p} className="mt-2 text-sm">{fill(p, { name })}</p>)}
      <h2 className="font-display text-xl mt-6">{RESULTS.evaluationHeading}</h2>
      {RESULTS.evaluation.map((p) => <p key={p} className="mt-2 text-sm">{fill(p, { name })}</p>)}
    </section>

    <p className="mt-10 text-sm"><a href="/wired/delete" className="underline">{W9.deleteLink}</a></p>
  </>);
}
