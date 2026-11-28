// web/components/islands/OnlineYearReader.tsx
//
// /online-year/sign-in (punch #472, OY5): sign in with an emailed code, then read the Teacher's Guide and the
// storybook on screen. Pure logic and every word: web/lib/onlineYearReader.ts + web/lib/onlineYearCopy.ts
// (approved lines; OY_READER_DRAFT lines await Camila's OK). Server: supabase/functions/online-year-signin.
//
// Protection, as approved: the family's name and email on every page ("Licensed to ..."), pages as images through
// links that expire in 10 minutes, no download button, no right-click save or drag. The name line is laid over
// each page, so any screenshot carries it.
//
// DARK until launch: the function answers 404. For internal checks, open the page with #preview=<token>; the
// token is kept in sessionStorage for this tab only and never leaves the browser except as the preview header.

import { useCallback, useEffect, useMemo, useState } from "react";
import { makePortfolioPdf } from "../../lib/onlineYearPortfolio";
import { OY_APPROVED, OY_APPROVED_READER, OY_READER_DRAFT, type OnlineYearBandKey } from "../../lib/onlineYearCopy";
import {
  atLimitLine,
  bandLicense,
  bandsHeld,
  callFamily,
  callSignin,
  chunks,
  doneLine,
  type FamilyLicense,
  portfolioButtonLine,
  printLine,
  DEVICE_TOKEN_KEY,
  displayName,
  errorLine,
  inLastTwoWeeks,
  lastTwoWeeksLine,
  licensedLine,
  PREVIEW_KEY,
  RA_PAGES,
  type ReaderSession,
  tgRange,
  type TgSection,
  topLine,
  weekLabel,
  yearEndedLine,
} from "../../lib/onlineYearReader";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Screen = "loading" | "email" | "code" | "limit" | "reader";
type Page = { page: number; url: string };

function readPreview(): string | null {
  try {
    const m = window.location.hash.match(/preview=([A-Za-z0-9_-]{24,})/);
    if (m) {
      sessionStorage.setItem(PREVIEW_KEY, m[1]);
      history.replaceState(null, "", window.location.pathname);
    }
    return sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    return null;
  }
}

const btn = "inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-sm font-body text-sm tracking-wide";
const btnStyle = { backgroundColor: "#2E3D32", color: "#FAF8F3" };
const input = "w-full min-h-[44px] px-3 py-2 rounded-sm border font-body text-base";

export default function OnlineYearReader() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewChecked, setPreviewChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devices, setDevices] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<ReaderSession | null>(null);
  const [band, setBand] = useState<OnlineYearBandKey>("sprouts");
  const [book, setBook] = useState<"tg" | "ra">("tg");
  const [section, setSection] = useState<TgSection>({ kind: "week", week: 1 });
  const [raStart, setRaStart] = useState(1);
  const [pages, setPages] = useState<Page[]>([]);
  const [pageError, setPageError] = useState("");
  // OY6/OY7: each live child's done weeks (online-year-family 'progress').
  const [family, setFamily] = useState<FamilyLicense[]>([]);
  const [actionBusy, setActionBusy] = useState("");

  const api = useCallback((body: Record<string, unknown>) => callSignin(body, { url: SUPABASE_URL, apikey: APIKEY, preview }), [preview]);
  const famApi = useCallback((body: Record<string, unknown>) => callFamily(body, { url: SUPABASE_URL, apikey: APIKEY, preview }), [preview]);

  const token = () => {
    try {
      return localStorage.getItem(DEVICE_TOKEN_KEY);
    } catch {
      return null;
    }
  };

  const loadSession = useCallback(async () => {
    const t = token();
    if (!t) return setScreen("email");
    const r = await api({ action: "session", token: t });
    if (r.status === 200) {
      const s = r.body as unknown as ReaderSession;
      setSession(s);
      const held = bandsHeld(s);
      if (held.length) setBand(held[0]);
      setScreen("reader");
      const p = await famApi({ action: "progress", token: t });
      if (p.status === 200) setFamily((p.body.licenses as FamilyLicense[]) ?? []);
    } else {
      try {
        localStorage.removeItem(DEVICE_TOKEN_KEY);
      } catch { /* private mode */ }
      if (r.body.error === "SIGNED_OUT") setError(OY_READER_DRAFT.signedOut);
      setScreen("email");
    }
  }, [api, famApi]);

  useEffect(() => {
    setPreview(readPreview());
    setPreviewChecked(true);
  }, []);
  useEffect(() => {
    if (previewChecked) void loadSession();
  }, [previewChecked, loadSession]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const r = await api({ action: "request", email });
    setBusy(false);
    if (r.status === 200) setScreen("code");
    else setError(errorLine(r.body.error, r.body));
  }

  async function verify(confirm = false, e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const r = await api({ action: "verify", email, code, confirm, label: navigator.userAgent.slice(0, 80) });
    setBusy(false);
    if (r.status === 200 && typeof r.body.token === "string") {
      try {
        localStorage.setItem(DEVICE_TOKEN_KEY, r.body.token);
      } catch { /* private mode: signed in for this visit only */ }
      setCode("");
      await loadSession();
    } else if (r.status === 409 && r.body.error === "AT_LIMIT") {
      setDevices(Number(r.body.devices) || 0);
      setScreen("limit");
    } else setError(errorLine(r.body.error, r.body));
  }

  async function signOut() {
    const t = token();
    if (t) await api({ action: "signout", token: t });
    try {
      localStorage.removeItem(DEVICE_TOKEN_KEY);
    } catch { /* ignore */ }
    setSession(null);
    setPages([]);
    setScreen("email");
  }

  const license = session ? bandLicense(session, band) : null;
  const ended = license ? Date.parse(license.ends_at) <= Date.now() : false;

  const range = useMemo<[number, number]>(() => {
    if (book === "tg") return tgRange(band, section);
    return [raStart, Math.min(RA_PAGES[band], raStart + 11)];
  }, [band, book, section, raStart]);

  useEffect(() => {
    if (screen !== "reader" || !license || ended) return;
    let cancelled = false;
    (async () => {
      setPageError("");
      setPages([]);
      const out: Page[] = [];
      for (const [from, to] of chunks(range[0], range[1])) {
        const r = await api({ action: "pages", token: token(), band, book, from, to });
        if (r.status !== 200) {
          if (r.body.error === "SIGNED_OUT") return void signOut();
          if (!cancelled) setPageError(errorLine(r.body.error));
          return;
        }
        out.push(...((r.body.pages as Page[]) ?? []));
      }
      if (!cancelled) setPages(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, band, book, range[0], range[1], license?.id, ended]);

  const wrap = (children: React.ReactNode) => (
    <section className="py-12 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
      <div className="max-w-xl mx-auto space-y-4">{children}</div>
    </section>
  );
  const errorBox = error ? <p className="font-body text-sm" role="alert" style={{ color: "hsl(var(--eden-rust, 10 60% 40%))" }}>{error}</p> : null;

  if (screen === "loading") return wrap(<p className="font-body">{OY_READER_DRAFT.loading}</p>);

  if (screen === "email")
    return wrap(
      <form onSubmit={sendCode} className="space-y-4">
        <h1 className="font-serif text-3xl" style={{ color: "hsl(var(--eden-bark))" }}>{OY_APPROVED.title}</h1>
        <p className="font-body text-base">{OY_APPROVED_READER.signIn}</p>
        <label className="block font-body text-sm">
          {OY_APPROVED.signInEmail}
          <input className={input} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {errorBox}
        <button className={btn} style={btnStyle} disabled={busy} data-cta="oy-signin-send-code">{OY_READER_DRAFT.sendCodeButton}</button>
      </form>,
    );

  if (screen === "code")
    return wrap(
      <form onSubmit={(e) => verify(false, e)} className="space-y-4">
        <p className="font-body text-base">{OY_APPROVED_READER.codeScreen}</p>
        <label className="block font-body text-sm">
          {OY_READER_DRAFT.codeLabel}
          <input className={input} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {errorBox}
        <button className={btn} style={btnStyle} disabled={busy} data-cta="oy-signin-verify">{OY_APPROVED_READER.codeButton}</button>
        <button type="button" className="block font-body text-sm underline underline-offset-4" onClick={() => sendCode()} disabled={busy}>{OY_APPROVED_READER.newCodeLink}</button>
      </form>,
    );

  if (screen === "limit")
    return wrap(
      <div className="space-y-4">
        <p className="font-body text-base">{atLimitLine(devices)}</p>
        {errorBox}
        <button className={btn} style={btnStyle} disabled={busy} onClick={() => verify(true)} data-cta="oy-signin-at-limit">{OY_APPROVED_READER.atLimitButton}</button>
      </div>,
    );

  // Reader
  if (!session) return null;
  const held = bandsHeld(session);
  const name = displayName(session);
  return (
    <section className="py-8 px-4" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
      <div className="max-w-3xl mx-auto space-y-4">
        {license && <p className="font-accent text-sm tracking-wide" style={{ color: "hsl(var(--eden-gold-ink))" }}>{topLine(band, license.ends_at)}</p>}
        {held.length > 1 && (
          <div className="flex gap-2">
            {held.map((b) => (
              <button key={b} type="button" className="font-body text-sm underline underline-offset-4" aria-pressed={b === band} onClick={() => setBand(b)} style={{ fontWeight: b === band ? 700 : 400 }}>
                {OY_APPROVED.bandLabel[b]}
              </button>
            ))}
          </div>
        )}
        {license && !ended && inLastTwoWeeks(license.ends_at) && (
          <p className="font-body text-sm">
            {lastTwoWeeksLine(license.ends_at)}{" "}
            <a className="underline" href={`/online-year/checkout?band=${band}`}>{OY_APPROVED_READER.renewFirstChild}</a>
          </p>
        )}
        {license && ended ? (
          <div className="space-y-3">
            <p className="font-body text-base">{yearEndedLine(license.child_name, license.ends_at)}</p>
            <a className={btn} style={btnStyle} href={`/online-year/checkout?band=${band}`}>{OY_APPROVED_READER.yearEndedButton.replace("[Child]", license.child_name)}</a>
          </div>
        ) : !license ? (
          <p className="font-body">{OY_READER_DRAFT.noYearHere}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              <button type="button" className="font-body text-sm underline underline-offset-4" aria-pressed={book === "tg"} style={{ fontWeight: book === "tg" ? 700 : 400 }} onClick={() => setBook("tg")}>{OY_READER_DRAFT.teachersGuide}</button>
              <button type="button" className="font-body text-sm underline underline-offset-4" aria-pressed={book === "ra"} style={{ fontWeight: book === "ra" ? 700 : 400 }} onClick={() => setBook("ra")}>{OY_READER_DRAFT.storybook}</button>
              {book === "tg" && (
                <select
                  className="min-h-[44px] px-2 rounded-sm border font-body text-sm"
                  value={section.kind === "week" ? `w${section.week}` : section.kind}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSection(v === "front" ? { kind: "front" } : v === "back" ? { kind: "back" } : { kind: "week", week: Number(v.slice(1)) });
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <option value="front">{OY_READER_DRAFT.beforeWeek1}</option>
                  {Array.from({ length: 36 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={`w${w}`}>{weekLabel(band, w)}</option>
                  ))}
                  <option value="back">{OY_READER_DRAFT.backOfBook}</option>
                </select>
              )}
            </div>
            {book === "tg" && section.kind === "week" && (
              <div className="space-y-2">
                {family
                  .filter((l) => l.band === band && Date.parse(l.ends_at) > Date.now())
                  .map((l) => {
                    const wk = (section as { week: number }).week;
                    const isDone = l.done.some((d) => d.week === wk);
                    return (
                      <div key={l.id} className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btn}
                          style={btnStyle}
                          disabled={!!actionBusy}
                          data-cta="oy-print-notebook"
                          onClick={async () => {
                            // Open the tab inside the click so the browser allows it; point it at the PDF when ready.
                            const tab = window.open("", "_blank");
                            setActionBusy(`print-${l.id}`);
                            const r = await famApi({ action: "print", token: token(), license_id: l.id, week: wk });
                            setActionBusy("");
                            if (r.status === 200 && typeof r.body.url === "string") {
                              if (tab) tab.location.href = r.body.url;
                              else window.location.href = r.body.url;
                            } else {
                              tab?.close();
                              setPageError(errorLine(r.body.error, r.body));
                            }
                          }}
                        >
                          {printLine(l.child_name)}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-sm border font-body text-sm"
                          disabled={isDone || !!actionBusy}
                          aria-pressed={isDone}
                          data-cta="oy-mark-done"
                          onClick={async () => {
                            setActionBusy(`done-${l.id}`);
                            const r = await famApi({ action: "done", token: token(), license_id: l.id, week: wk });
                            setActionBusy("");
                            if (r.status === 200) {
                              setFamily((f) => f.map((x) => (x.id === l.id ? { ...x, done: [...x.done, { week: wk, done_on: String(r.body.done_on) }] } : x)));
                            } else setPageError(errorLine(r.body.error, r.body));
                          }}
                        >
                          {isDone ? "✓ " : ""}{doneLine(wk, l.child_name)}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
            {pageError && <p className="font-body text-sm" role="alert">{pageError}</p>}
            {!pages.length && !pageError && <p className="font-body text-sm">{OY_READER_DRAFT.loading}</p>}
            <div className="space-y-6" onContextMenu={(e) => e.preventDefault()}>
              {pages.map((p) => (
                <figure key={`${book}-${p.page}`} className="relative select-none shadow-sm" style={{ backgroundColor: "#fff" }}>
                  <img src={p.url} alt="" width={1400} loading="lazy" draggable={false} className="w-full h-auto block pointer-events-none" />
                  <figcaption
                    className="absolute left-0 right-0 bottom-0 text-center font-body text-[11px] sm:text-xs py-1 px-2"
                    style={{ backgroundColor: "rgba(250,248,243,0.88)", color: "#2E3D32" }}
                  >
                    {licensedLine(name, session.parent.email)}
                  </figcaption>
                </figure>
              ))}
            </div>
            {book === "ra" && (
              <div className="flex justify-between">
                <button type="button" className="font-body text-sm underline" disabled={raStart <= 1} onClick={() => { setRaStart(Math.max(1, raStart - 12)); window.scrollTo({ top: 0 }); }}>{OY_READER_DRAFT.previous}</button>
                <button type="button" className="font-body text-sm underline" disabled={raStart + 12 > RA_PAGES[band]} onClick={() => { setRaStart(raStart + 12); window.scrollTo({ top: 0 }); }}>{OY_READER_DRAFT.next}</button>
              </div>
            )}
          </>
        )}
        {family.filter((l) => l.band === band).map((l) => (
          <div key={`pf-${l.id}`} className="space-y-2 pt-4">
            <p className="font-body text-sm">{OY_APPROVED_READER.portfolio.replace("[Child]", l.child_name)}</p>
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-sm border font-body text-sm"
              data-cta="oy-portfolio"
              onClick={async () => {
                const bytes = await makePortfolioPdf({ child: l.child_name, band: l.band, starts_at: l.starts_at, ends_at: l.ends_at, done: l.done });
                const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `${l.child_name} - Eden's Table ${OY_APPROVED.bandLabel[l.band]} portfolio.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
              }}
            >
              {portfolioButtonLine(l.child_name)}
            </button>
          </div>
        ))}
        <button type="button" className="font-body text-xs underline underline-offset-4" onClick={signOut}>{OY_READER_DRAFT.signOut}</button>
      </div>
    </section>
  );
}
