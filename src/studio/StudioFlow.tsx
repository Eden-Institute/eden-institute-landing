// The ad flow: one question per screen, with the ad visible the whole time.
//
// Structure is deliberately thin. flow-graph.ts decides WHICH question comes
// next and what counts as an answer; this file only draws whatever the graph
// hands it. Adding a question means adding a node there, not branching here.
//
// Two layout rules are load-bearing on a phone, both learned the hard way:
//   - The preview must not be pinned. An opaque sticky panel hides the question
//     underneath it and the flow reads as broken.
//   - Nothing floats over the bottom bar. A floating button sits on top of
//     Continue and makes the flow impossible to finish.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FLOW, isAnswered, isVisible, nextNode, nodeById, orderedOptions, reconcile,
  isVideoOutput, visibleNodes,
} from "./flow-graph";
import type {
  FineTune, FlowAnswers, FlowNode, OverlayAnswer, SlideAnswer,
} from "./flow-graph";
import { adDimensions, defaultOverlay, paintAd } from "./flow-paint";
import {
  ExportError, HANDOFF_LINKS, downloadBlob, explainExportFailure, exportFilename,
  exportStill, exportVideo, nextStepText, saveToDevice, startMicRecording,
  supportsMicRecording, supportsVideoExport, suggestedDuration,
} from "./flow-export";
import type { MicSession, VideoExport } from "./flow-export";
import {
  listSavedSlides, signedUrlFor, unsavedSlides, uploadSlide,
} from "./flow-assets";
import type { AssetsPort } from "./flow-assets";
import {
  bankDrafts, checkAi, diagnoseDraft, editDraft, explainAiError, generateDrafts,
} from "./flow-ai";
import type { AiDiagnosis, AiDraft, AiInvoke } from "./flow-ai";
import { ANGLES, PRODUCTS } from "./studio-banks";
import "./flow.css";

const CHAPTER_NAMES = ["Where & what", "Media & styling", "Copy & text", "Export"];
const NUMERALS = ["I", "II", "III", "IV"];

/** Files a phone can actually offer. iPhones shoot HEIC and HEVC, so a narrow
 *  allow-list greys out the camera roll; let the decoder be the real gate. */
const MEDIA_ACCEPT = "image/*,video/*";
const MAX_BYTES = 200 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;

export type AssetsBridge = AssetsPort;

/** What a save produced, so the workroom can record the export paper trail. */
export interface ExportedFile {
  blob: Blob;
  name: string;
  format: "png" | "mp4" | "webm";
  width: number;
  height: number;
}

interface Props {
  answers: FlowAnswers;
  onChange: (next: FlowAnswers) => void;
  assets?: AssetsBridge;
  /** The studio-generate edge function. Absent means the approved copy bank
   *  is the only source of drafts, which is a working studio rather than a
   *  broken one. */
  ai?: AiInvoke;
  /** Start a fresh campaign. Offered once the ad is finished. */
  onFinish?: () => void;
  /** Called after a successful save/download, with what was produced. The
   *  archive's export history is written from this; failures there must never
   *  break the save itself. */
  onExported?: (file: ExportedFile) => void;
}

export default function StudioFlow({
  answers, onChange, assets, ai, onFinish, onExported,
}: Props) {
  const [currentId, setCurrentId] = useState<string>(() => {
    // Resuming a saved campaign lands on its first unanswered question. If
    // there isn't one the ad is finished, and she should see it rather than be
    // marched back to question one.
    const first = FLOW.find((n) => isVisible(n, answers) && !isAnswered(n, answers));
    return first ? first.id : "";
  });
  const [history, setHistory] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  // No `?? FLOW[0]` fallback here: advance() clears currentId when the ad is
  // finished, and a fallback would swallow that and loop on question one.
  const node = currentId ? nodeById(currentId) : undefined;
  const done = !node;

  /* ── answering ───────────────────────────────────────────────────── */

  // Writes compose through a ref, not the render's `answers` closure. Handlers
  // that write two keys in one tick (pick a draft → variant AND caption) would
  // otherwise build the second write on pre-first-write state and silently
  // drop the first one.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const write = useCallback((key: keyof FlowAnswers, value: unknown) => {
    const { answers: next, cleared } = reconcile(
      { ...answersRef.current, [key]: value } as FlowAnswers,
    );
    answersRef.current = next;
    onChange(next);
    if (cleared.length) {
      setNotice(cleared.length === 1
        ? `That change reset one earlier answer: ${cleared[0].question(next).toLowerCase()}`
        : `That change reset ${cleared.length} earlier answers.`);
    }
    return next;
  }, [onChange]);

  const advance = useCallback((from: FlowAnswers) => {
    const next = nextNode(currentId, from);
    if (!next) { setCurrentId(""); return; }
    setHistory((h) => [...h, currentId]);
    setCurrentId(next.id);
  }, [currentId]);

  const answerAndAdvance = (key: keyof FlowAnswers, value: unknown) => {
    advance(write(key, value));
  };

  const goBack = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setCurrentId(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  const jumpTo = (id: string) => {
    setHistory((h) => {
      const i = h.indexOf(id);
      return i >= 0 ? h.slice(0, i) : h;
    });
    setCurrentId(id);
    setNotice(null);
  };

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // The enlarged preview is a dialog: Escape closes it, focus moves to the
  // close button on open and returns to wherever it was on close.
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!enlarged) return;
    const before = document.activeElement as HTMLElement | null;
    lightboxCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [enlarged]);

  /* ── the live preview ────────────────────────────────────────────── */

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const repaint = useCallback(() => {
    const cv = canvasRef.current;
    if (cv) paintAd(cv, answers, { width: 560, onReady: () => repaint() });
    if (enlarged && bigRef.current) {
      paintAd(bigRef.current, answers, { width: 900, onReady: () => repaint() });
    }
  }, [answers, enlarged]);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    // Credits have to actually roll, otherwise "scrolling text" is a claim
    // rather than something she can see.
    if (answers.treatment === "scrolling") {
      const start = performance.now();
      const loop = () => {
        const t = (performance.now() - start) / 1000;
        const cv = canvasRef.current;
        if (cv) paintAd(cv, answers, { width: 560, time: t });
        if (enlarged && bigRef.current) paintAd(bigRef.current, answers, { width: 900, time: t });
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      repaint();
    }
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [answers, enlarged, repaint]);

  /* ── chrome ──────────────────────────────────────────────────────── */

  const chips = useMemo(
    () => FLOW.filter((n) => isVisible(n, answers) && isAnswered(n, answers)
      && answers[n.writes] !== null),
    [answers],
  );
  const dims = adDimensions(answers);
  const inChapter = useMemo(
    () => visibleNodes(answers).filter((n) => n.chapter === node?.chapter),
    [answers, node],
  );

  if (done || !node) {
    return (
      <FlowSummary answers={answers} onJump={jumpTo} onFinish={onFinish}
        onExported={onExported} />
    );
  }

  const answered = isAnswered(node, answers);
  const showContinue = node.stay || node.kind !== "single";

  return (
    <div className="edenflow">
      <div className="ef-chips">
        {chips.map((n) => (
          <button key={n.id} type="button" className="ef-chip" onClick={() => jumpTo(n.id)}
            title="Change this">
            <b>{safeChip(n, answers)}</b>
          </button>
        ))}
      </div>

      <div className="ef-layout">
        <aside className={`ef-stage${trayOpen ? " is-open" : ""}`}>
          <div className="ef-stagerow">
            <div className="ef-frame">
              <canvas ref={canvasRef} aria-label="Live preview of your ad" />
            </div>
            <div className="ef-meta">
              <b>{dims.name}</b>
              {dims.w} × {dims.h}
              {isVideoOutput(answers) && <><br />Video</>}
              <br /><span className="ef-live" />Live preview
            </div>
          </div>
          <AdjustTray answers={answers} open={trayOpen} onToggle={setTrayOpen}
            onWrite={write} onJump={jumpTo} />
        </aside>

        <main className="ef-col">
          <div className="ef-prog">
            <span className="ef-chapter">
              <b>{NUMERALS[node.chapter - 1]}</b>&nbsp; {CHAPTER_NAMES[node.chapter - 1]}
            </span>
            <span className="ef-dots">
              {inChapter.map((n) => (
                <span key={n.id}
                  className={`ef-dot${n.id === node.id ? " now"
                    : isAnswered(n, answers) ? " on" : ""}`} />
              ))}
            </span>
          </div>

          <h1 className="ef-q">{node.question(answers)}</h1>
          {node.sub && <p className="ef-sub">{node.sub(answers)}</p>}

          <NodeBody node={node} answers={answers} assets={assets} ai={ai}
            onWrite={write}
            onPick={(key, value) => {
              if (node.stay) write(key, value);
              else answerAndAdvance(key, value);
            }} />

          <div className="ef-nav">
            <button type="button" className="ef-btn" onClick={goBack}
              disabled={!history.length}>◂ Back</button>
            <button type="button" className="ef-peek" onClick={() => setEnlarged(true)}>
              ⤢ See the ad
            </button>
            <span className="ef-spacer" />
            {node.optional && (
              <button type="button" className="ef-btn"
                onClick={() => answerAndAdvance(node.writes, null)}>Skip</button>
            )}
            {showContinue && (
              <button type="button" className="ef-btn ef-pri" disabled={!answered}
                onClick={() => advance(answers)}>Continue</button>
            )}
          </div>
        </main>
      </div>

      {notice && <div className="ef-toast" role="status">{notice}</div>}

      {enlarged && (
        <div className="ef-lightbox" role="dialog" aria-modal="true"
          aria-label="Enlarged ad preview"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEnlarged(false);
          }}>
          <canvas ref={bigRef} aria-label="Enlarged preview" />
          <button ref={lightboxCloseRef} type="button" className="ef-btn"
            onClick={() => setEnlarged(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

function safeChip(n: FlowNode, a: FlowAnswers): string {
  try { return n.chip(a[n.writes], a); } catch { return "—"; }
}

/* ── per-question bodies ──────────────────────────────────────────── */

interface BodyProps {
  node: FlowNode;
  answers: FlowAnswers;
  assets?: AssetsBridge;
  ai?: AiInvoke;
  onWrite: (key: keyof FlowAnswers, value: unknown) => FlowAnswers;
  onPick: (key: keyof FlowAnswers, value: unknown) => void;
}

function NodeBody({ node, answers, assets, ai, onWrite, onPick }: BodyProps) {
  switch (node.kind) {
    case "single": return <SingleChoice node={node} answers={answers} onPick={onPick} />;
    case "text": return <FreeText node={node} answers={answers} onWrite={onWrite} />;
    case "gallery": return <MediaPicker node={node} answers={answers} assets={assets}
      onWrite={onWrite} />;
    case "aiimage": return <AiImageStep answers={answers} assets={assets}
      onWrite={onWrite} />;
    case "opacity": return <OpacitySlider answers={answers} onWrite={onWrite} />;
    case "caption": return <CaptionField answers={answers} onWrite={onWrite} />;
    case "overlay": return <OverlayFields answers={answers} onWrite={onWrite} />;
    case "anchor": return <AnchorGrid answers={answers} onWrite={onWrite} />;
    case "own": return <OwnCopy answers={answers} ai={ai} onWrite={onWrite} />;
    case "variants": return <CopyDrafts answers={answers} ai={ai} onWrite={onWrite} />;
    case "finetune": return <FineTuneSliders answers={answers} onWrite={onWrite} />;
    case "credits": return <CreditsEditor answers={answers} onWrite={onWrite} />;
    case "link": return <LinkFields answers={answers} onWrite={onWrite} />;
    case "sound": return <NarrationRecorder answers={answers} onWrite={onWrite} />;
    case "render": return <RenderStep answers={answers} onWrite={onWrite} />;
    default:
      return (
        <p className="ef-note">
          This step arrives with the next release. Continue for now.
        </p>
      );
  }
}

/** Drafts to choose from: the approved copy bank, which needs no model and no
 *  waiting, plus freshly generated ones on request. The bank is listed too
 *  rather than replaced, because it is already approved. */
function CopyDrafts({ answers, ai, onWrite }: {
  answers: FlowAnswers; ai?: AiInvoke; onWrite: BodyProps["onWrite"];
}) {
  const bank = useMemo(() => bankDrafts(answers), [answers]);
  const [fresh, setFresh] = useState<AiDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);

  useEffect(() => {
    let live = true;
    void checkAi(ai).then((r) => {
      if (!live) return;
      setReady(r.ready);
      if (!r.ready && r.reason) setNote(r.reason);
    });
    return () => { live = false; };
  }, [ai]);

  const drafts = [
    ...fresh.map((d) => ({ text: d.primary, badge: "new", meta: d.approach })),
    ...bank.map((text) => ({ text, badge: "approved", meta: undefined as string | undefined })),
  ];

  const draw = async () => {
    if (!ai) return;
    setBusy(true); setError(null); setNote(null);
    try {
      const { drafts: got, note: n } = await generateDrafts(ai, answers);
      if (!liveRef.current) return;
      if (!got.length) setError("No drafts came back. The approved copy below still works.");
      setFresh(got);
      setNote(n);
    } catch (err) {
      if (liveRef.current) setError(explainAiError(err));
    } finally {
      if (liveRef.current) setBusy(false);
    }
  };

  return (
    <>
      {ai && (
        <div className="ef-exportrow" style={{ marginBottom: 12 }}>
          <button type="button" className="ef-btn ef-pri" onClick={draw}
            disabled={busy || ready === false}>
            {busy ? "Drafting…" : fresh.length ? "Draft three more" : "Draft three in Eden's voice"}
          </button>
        </div>
      )}
      {error && <p className="ef-error">{error}</p>}

      <div className="ef-grid ef-grid-1">
        {drafts.map((d, i) => (
          <button key={`${d.badge}-${i}`} type="button"
            className={`ef-opt${answers.variant === i ? " is-sel" : ""}`}
            onClick={() => { onWrite("variant", i); onWrite("caption", d.text); }}>
            <span className="ef-opt-t">
              Draft {i + 1} <span className="ef-tag">{d.badge}</span>
            </span>
            <span className="ef-opt-h ef-draft">{d.text}</span>
            {d.meta && <span className="ef-note" style={{ margin: "6px 0 0" }}>{d.meta}</span>}
          </button>
        ))}
      </div>
      <p className="ef-note">
        {note ?? (fresh.length
          ? "Freshly drafted from your brief, listed above your approved library copy."
          : "Approved copy from the campaign library. Pick one, then edit it on the next screen.")}
      </p>
    </>
  );
}

function OwnCopy({ answers, ai, onWrite }: {
  answers: FlowAnswers; ai?: AiInvoke; onWrite: BodyProps["onWrite"];
}) {
  const own = answers.own ?? {};
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rewrites, setRewrites] = useState<AiDraft[]>([]);
  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(null);
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);

  const set = (k: keyof NonNullable<FlowAnswers["own"]>, v: string) => {
    onWrite("own", { ...own, [k]: v });
    if (k === "primary") onWrite("caption", v);
  };
  const fields: Array<[keyof NonNullable<FlowAnswers["own"]>, string, number]> = [
    ["primary", "Primary text", 4], ["headline", "Headline", 1],
    ["description", "Description", 1], ["note", "Your note", 2],
  ];
  const draft = (own.primary ?? "").trim();

  const run = async (action: "sharpen" | "variations") => {
    if (!ai || !draft) return;
    setBusy(action); setError(null); setDiagnosis(null);
    try {
      const out = await editDraft(ai, answers, draft, action, own.note ?? "");
      if (liveRef.current) setRewrites(out);
    } catch (err) {
      if (liveRef.current) setError(explainAiError(err));
    } finally {
      if (liveRef.current) setBusy(null);
    }
  };

  const diagnose = async () => {
    if (!ai || !draft) return;
    setBusy("diagnose"); setError(null); setRewrites([]);
    try {
      const out = await diagnoseDraft(ai, answers, draft);
      if (liveRef.current) setDiagnosis(out);
    } catch (err) {
      if (liveRef.current) setError(explainAiError(err));
    } finally {
      if (liveRef.current) setBusy(null);
    }
  };

  return (
    <>
      {fields.map(([k, label, rows]) => (
        <div className="ef-field" key={k}>
          <label>{label}</label>
          <textarea className="ef-input" rows={rows} value={own[k] ?? ""}
            onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}

      {ai && (
        <>
          <p className="ef-eyebrow">Have the editor look at it</p>
          <div className="ef-exportrow">
            <button type="button" className="ef-btn" onClick={() => run("sharpen")}
              disabled={!draft || !!busy}>
              {busy === "sharpen" ? "Working…" : "Sharpen this"}
            </button>
            <button type="button" className="ef-btn" onClick={() => run("variations")}
              disabled={!draft || !!busy}>
              {busy === "variations" ? "Working…" : "Show variations"}
            </button>
            <button type="button" className="ef-btn" onClick={diagnose}
              disabled={!draft || !!busy}>
              {busy === "diagnose" ? "Reading…" : "Diagnose only"}
            </button>
          </div>
          <p className="ef-note">
            The editor works on your words. It may restructure them, but it cannot
            introduce a price, date or claim you did not already write.
          </p>
        </>
      )}
      {error && <p className="ef-error">{error}</p>}

      {diagnosis && (
        <div className="ef-summary-card" style={{ marginTop: 12 }}>
          <p className="ef-eyebrow">Diagnosis only. Nothing was rewritten.</p>
          {typeof diagnosis.score === "number" && (
            <p className="ef-note" style={{ margin: 0 }}>
              Conversion score: {diagnosis.score}/10
            </p>
          )}
          {!!diagnosis.issues?.length && (
            <ul className="ef-list">
              {diagnosis.issues.map((it, i) => (
                <li key={i}><b>{it.severity ?? "note"}</b> · {it.note}</li>
              ))}
            </ul>
          )}
          {!!diagnosis.strengths?.length && (
            <ul className="ef-list">
              {diagnosis.strengths.map((good, i) => <li key={i}>Keep: {good}</li>)}
            </ul>
          )}
        </div>
      )}

      {rewrites.length > 0 && (
        <>
          <p className="ef-eyebrow" style={{ marginTop: 14 }}>Suggested rewrites</p>
          <div className="ef-grid ef-grid-1">
            {rewrites.map((r, i) => (
              <button key={i} type="button" className="ef-opt"
                onClick={() => set("primary", r.primary)}>
                <span className="ef-opt-t">{r.approach ?? `Option ${i + 1}`}</span>
                <span className="ef-opt-h ef-draft">{r.primary}</span>
                {!!r.changes?.length && (
                  <span className="ef-note" style={{ margin: "6px 0 0" }}>
                    Changed: {r.changes.join("; ")}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="ef-note">Tap one to use it. Your own words stay until you do.</p>
        </>
      )}

      <p className="ef-note">
        Primary text becomes the caption. You can still edit it on the next screen.
      </p>
    </>
  );
}

function FineTuneSliders({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const f = answers.finetune ?? {
    brightness: 1, contrast: 1, saturation: 1, x: 0, y: 0, scale: 1,
  };
  const set = (k: keyof FineTune, v: number) => onWrite("finetune", { ...f, [k]: v });
  const rows: Array<[keyof FineTune, string, number, number, number, (v: number) => string]> = [
    ["x", "Move left / right", -50, 50, 1, (v) => String(Math.round(v))],
    ["y", "Move up / down", -50, 50, 1, (v) => String(Math.round(v))],
    ["scale", "Zoom", 0.5, 2.5, 0.01, (v) => `${Math.round(v * 100)}%`],
    ["brightness", "Brightness", 0, 2, 0.01, (v) => v.toFixed(2)],
    ["contrast", "Contrast", 0, 2, 0.01, (v) => v.toFixed(2)],
    ["saturation", "Saturation", 0, 2, 0.01, (v) => v.toFixed(2)],
  ];
  return (
    <>
      {rows.map(([k, label, min, max, step, fmt]) => (
        <div className="ef-slider" key={k}>
          <span className="ef-slider-l">{label}</span>
          <input type="range" min={min} max={max} step={step} value={f[k]}
            aria-label={label}
            onChange={(e) => set(k, Number(e.target.value))} />
          <span className="ef-slider-v">{fmt(f[k])}</span>
        </div>
      ))}
      <p className="ef-note">Non-destructive: your original file is never rewritten.</p>
    </>
  );
}

function CreditsEditor({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const c = answers.credits ?? { text: "", speed: 5, startDelaySec: 0 };
  const set = (k: string, v: unknown) => onWrite("credits", { ...c, [k]: v });
  return (
    <>
      <textarea className="ef-input" rows={6} value={c.text}
        placeholder={"One herb a week\nAll year long\nPreorders open July 29"}
        onChange={(e) => set("text", e.target.value)} />
      <div className="ef-slider" style={{ marginTop: 10 }}>
        <span className="ef-slider-l">Roll speed</span>
        <input type="range" min={1} max={10} value={c.speed}
          onChange={(e) => set("speed", Number(e.target.value))} />
        <span className="ef-slider-v">{c.speed}</span>
      </div>
      <p className="ef-note">Watch it roll on the preview. One line at a time reads best.</p>
    </>
  );
}

function LinkFields({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const l = answers.link ?? { domain: "edeninstitute.health", dest: "", qr: false };
  const set = (k: string, v: unknown) => onWrite("link", { ...l, [k]: v });
  return (
    <>
      <div className="ef-field">
        <label>Display domain</label>
        <input className="ef-input" type="text" value={l.domain ?? ""}
          onChange={(e) => set("domain", e.target.value)} />
      </div>
      <button type="button" className={`ef-opt${l.qr ? " is-sel" : ""}`}
        onClick={() => set("qr", !l.qr)}>
        <span className="ef-opt-t">{l.qr ? "☑" : "☐"} Include a QR code</span>
        <span className="ef-opt-h">For printed collateral and in-person events</span>
      </button>
    </>
  );
}

/** Live microphone recording. A file picker was the wrong design: iOS Voice
 *  Memos are hard to retrieve through one, and she should just tap and talk. */
function NarrationRecorder({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const sound = answers.sound ?? { mode: "none" as const };
  const [session, setSession] = useState<MicSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => {
      setElapsed((e) => e + 0.1);
      setLevel(session.level());
    }, 100);
    return () => window.clearInterval(t);
  }, [session]);

  const setMode = (mode: "none" | "narration") =>
    onWrite("sound", { ...sound, mode, ...(mode === "none" ? { narration: null } : {}) });

  const begin = async () => {
    setError(null);
    try {
      const s = await startMicRecording(60);
      setElapsed(0);
      setSession(s);
    } catch (err) {
      setError(err instanceof ExportError ? err.message
        : "The microphone was refused. If this page is embedded that is the embed "
          + "rather than your device, and you can upload a voice memo instead.");
    }
  };

  const finish = async () => {
    if (!session) return;
    const out = await session.stop();
    setSession(null);
    if (out.seconds < 1) {
      setError("That was too short. Hold on and speak for a moment.");
      return;
    }
    onWrite("sound", {
      ...sound, mode: "narration",
      narration: { name: "Recorded narration", url: out.url, durationSec: out.seconds },
    });
  };

  const fmt = (x: number) =>
    `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;

  return (
    <>
      <div className="ef-grid">
        {[
          { id: "none", label: "No narration", hint: "Silent. You can add music in Instagram later." },
          { id: "narration", label: "Add my voice", hint: "Record here. It is baked into the video you save." },
        ].map((o) => (
          <button key={o.id} type="button"
            className={`ef-opt${sound.mode === o.id ? " is-sel" : ""}`}
            onClick={() => setMode(o.id as "none" | "narration")}>
            <span className="ef-opt-t">{o.label}</span>
            <span className="ef-opt-h">{o.hint}</span>
          </button>
        ))}
      </div>

      {sound.mode === "narration" && (
        <div className="ef-record">
          {sound.narration ? (
            <>
              <audio controls src={sound.narration.url} className="ef-audio" />
              <div className="ef-trayrow">
                <span className="ef-note" style={{ margin: 0 }}>
                  {sound.narration.name} · {fmt(sound.narration.durationSec ?? 0)}
                </span>
                <button type="button" className="ef-mini"
                  onClick={() => {
                    // The discarded take's blob URL would otherwise pin its
                    // audio in memory for the tab's life.
                    const old = sound.narration?.url;
                    if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
                    onWrite("sound", { ...sound, narration: null });
                  }}>
                  Record again
                </button>
              </div>
            </>
          ) : session ? (
            <div className="ef-trayrow">
              <button type="button" className="ef-btn ef-pri" onClick={finish}>Stop</button>
              <span className="ef-slider-v">{fmt(elapsed)}</span>
              <span className="ef-meter" aria-hidden>
                {"▁▂▃▅▇".slice(0, Math.max(1, Math.round(level * 5)))}
              </span>
            </div>
          ) : (
            <div className="ef-trayrow">
              <button type="button" className="ef-btn ef-pri" onClick={begin}
                disabled={!supportsMicRecording()}>Record</button>
              <button type="button" className="ef-mini" onClick={() => fileRef.current?.click()}>
                Upload a voice memo
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="audio/*" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (!/^audio\//.test(f.type || "")) {
                setError(`"${f.name}" is not an audio file.`);
                return;
              }
              if (f.size > 25 * 1024 * 1024) {
                setError(`"${f.name}" is ${(f.size / 1048576).toFixed(0)} MB. `
                  + "Voice memos should be under 25 MB.");
                return;
              }
              setError(null);
              const old = sound.narration?.url;
              if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
              onWrite("sound", {
                ...sound, mode: "narration",
                narration: { name: f.name, url: URL.createObjectURL(f) },
              });
            }} />
          {error && <p className="ef-error">{error}</p>}
          <p className="ef-note">
            Add music afterwards in Instagram or Business Suite, where the
            licensed tracks live.
          </p>
        </div>
      )}
    </>
  );
}

function SingleChoice({ node, answers, onPick }: {
  node: FlowNode; answers: FlowAnswers; onPick: BodyProps["onPick"];
}) {
  const rec = node.recommended ? node.recommended(answers) : [];
  const opts = orderedOptions(node, answers);
  const chosen = answers[node.writes];
  return (
    <>
      <div className="ef-grid">
        {opts.map((o) => (
          <button key={o.id} type="button"
            className={`ef-opt${chosen === o.id ? " is-sel" : ""}`}
            onClick={() => onPick(node.writes, o.id)}>
            {rec.includes(o.id) && <span className="ef-rec">❦ Recommended</span>}
            <span className="ef-opt-t">{o.label}</span>
            {o.hint && <span className="ef-opt-h">{o.hint}</span>}
            {o.tag && <span className="ef-tag">{o.tag}</span>}
          </button>
        ))}
      </div>
      {node.stay && (
        <p className="ef-note">
          {chosen ? "That is on the preview. Adjust it, or continue."
            : "Pick one and it appears on the preview."}
        </p>
      )}
    </>
  );
}

function FreeText({ node, answers, onWrite }: {
  node: FlowNode; answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const value = (answers[node.writes] as string) ?? "";
  return (
    <textarea className="ef-input" rows={4} value={value}
      placeholder="e.g. Lead with the July 29 date, and keep it warmer than usual."
      onChange={(e) => onWrite(node.writes, e.target.value)} />
  );
}

function MediaPicker({ node, answers, assets, onWrite }: {
  node: FlowNode; answers: FlowAnswers; assets?: AssetsBridge;
  onWrite: BodyProps["onWrite"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SlideAnswer[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const slides = answers.slides ?? [];
  const multi = answers.adType === "carousel";
  const unsaved = unsavedSlides(slides);
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);

  // Everything she has uploaded before, so a photo is chosen once and reused.
  useEffect(() => {
    let live = true;
    listSavedSlides(assets)
      .then((rows) => { if (live) setSaved(rows.slice(0, 12)); })
      .catch(() => { /* the uploader still works without a library */ });
    return () => { live = false; };
  }, [assets]);

  // Signed URLs are minted only for the thumbnails actually on screen.
  useEffect(() => {
    let live = true;
    for (const s of saved) {
      if (!s.path || thumbs[s.path]) continue;
      signedUrlFor(s, assets).then((url) => {
        if (live && url) setThumbs((t) => ({ ...t, [s.path as string]: url }));
      });
    }
    return () => { live = false; };
  }, [saved, assets, thumbs]);

  const toggle = (slide: SlideAnswer) => {
    const cur = slides.slice();
    const i = cur.findIndex((x) => x.id === slide.id);
    if (multi) {
      if (i >= 0) cur.splice(i, 1); else cur.push(slide);
    } else {
      cur.length = 0;
      if (i < 0) cur.push(slide);
    }
    onWrite("slides", cur);
  };

  const take = async (file: File) => {
    setError(null);
    if (!/^(image|video)\//.test(file.type || "")) {
      setError(`"${file.name}" is not a photo or video.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is ${(file.size / 1048576).toFixed(0)} MB. The limit is 200 MB.`);
      return;
    }
    const localUrl = URL.createObjectURL(file);
    if (file.type.startsWith("video")) {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      const ok = await new Promise<boolean>((res) => {
        probe.onloadedmetadata = () =>
          res(!probe.duration || probe.duration <= MAX_VIDEO_SECONDS);
        probe.onerror = () => res(false);
        probe.src = localUrl;
      });
      if (!ok) {
        URL.revokeObjectURL(localUrl);
        setError(`"${file.name}" is longer than 60 seconds, or could not be read. `
          + "iPhone clips are HEVC by default; Settings > Camera > Formats > Most "
          + "Compatible fixes that.");
        return;
      }
    }
    setBusy(true);
    try {
      const { slide, error: uploadError } = await uploadSlide(file, assets, localUrl);
      // The write itself must land even if she has moved on: an upload that
      // completed belongs on the ad. Only local state is unmount-guarded.
      toggle(slide);
      if (!liveRef.current) return;
      if (uploadError) setError(uploadError);
      if (slide.path) {
        setSaved((prev) => [slide, ...prev.filter((p) => p.path !== slide.path)].slice(0, 12));
      }
    } finally {
      if (liveRef.current) setBusy(false);
    }
  };

  const card = (s: SlideAnswer, badge: string) => {
    const chosen = slides.some((x) => x.id === s.id);
    const thumb = s.url ?? (s.path ? thumbs[s.path] : undefined);
    return (
      <button key={s.id} type="button" className={`ef-opt ef-asset${chosen ? " is-sel" : ""}`}
        onClick={() => toggle(s)}>
        {thumb && s.kind === "image"
          ? <img className="ef-thumb" src={thumb} alt="" loading="lazy" />
          : <span className="ef-thumb ef-thumb-ph">{s.kind === "video" ? "▶" : "▣"}</span>}
        <span className="ef-asset-body">
          <span className="ef-opt-t">{s.name ?? s.id}</span>
          <span className="ef-opt-h">{s.kind}</span>
          <span className="ef-tag">{badge}</span>
        </span>
      </button>
    );
  };

  return (
    <>
      <p className="ef-eyebrow">Your own photos and videos</p>
      <button type="button" className="ef-drop" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          for (const f of Array.from(e.dataTransfer.files || [])) void take(f);
        }}>
        <span className="ef-opt-t">⬆ &nbsp;Upload from this device</span>
        <span className="ef-opt-h">
          Opens your photo library, or take a new one. Photos and videos, up to
          200 MB, video 60 seconds or less.
        </span>
      </button>
      <input ref={fileRef} type="file" accept={MEDIA_ACCEPT} multiple hidden
        onChange={(e) => {
          for (const f of Array.from(e.target.files || [])) void take(f);
          e.target.value = "";
        }} />
      {busy && <p className="ef-note">Uploading…</p>}
      {error && <p className="ef-error">{error}</p>}

      {slides.length > 0 && (
        <div className="ef-grid">{slides.map((s) => card(s, s.path ? "on this ad" : "not saved yet"))}</div>
      )}

      {unsaved.length > 0 && (
        <p className="ef-warn">
          {unsaved.length === 1 ? "One file is" : `${unsaved.length} files are`} only in this
          browser and will be lost if you refresh. Everything else is saved to your library.
        </p>
      )}

      {saved.filter((s) => !slides.some((x) => x.id === s.id)).length > 0 && (
        <>
          <p className="ef-eyebrow" style={{ marginTop: 18 }}>Saved to your library</p>
          <div className="ef-grid">
            {saved.filter((s) => !slides.some((x) => x.id === s.id))
              .map((s) => card(s, "saved"))}
          </div>
        </>
      )}

      <p className="ef-note">
        {multi
          ? `Carousels need 2 to 10 cards. ${slides.length} selected.`
          : slides.length
            ? "That is on the preview. Swap it, or continue."
            : "Upload one to place it on the preview."}
      </p>
    </>
  );
}

/** The AI image step. Every brand constraint (palette, mood, hard rules) lives
 *  in the studio-image EF where the browser cannot weaken it; this sends her
 *  words and a creative range. The result arrives as a saved asset and is
 *  written into `slides` exactly as an upload would be, so paint, export, and
 *  the media library need no special case for it. */
function AiImageStep({ answers, assets, onWrite }: {
  answers: FlowAnswers; assets?: AssetsBridge; onWrite: BodyProps["onWrite"];
}) {
  const seed = ANGLES[answers.angle ?? ""]?.visual ?? "";
  const current = (answers.slides ?? []).find((s) => s.ai);
  const [prompt, setPrompt] = useState(current?.name || seed);
  const [range, setRange] = useState<"strict" | "moderate" | "loose">("moderate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!assets?.aiStatus) { setConfigured(false); return; }
    let live = true;
    assets.aiStatus()
      .then((s) => { if (live) setConfigured(!!s.configured); })
      .catch(() => { if (live) setConfigured(false); });
    return () => { live = false; };
  }, [assets]);

  const generate = async () => {
    if (!assets?.aiGenerate || !prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await assets.aiGenerate(prompt.trim(), range);
      if (!liveRef.current) return;
      onWrite("slides", [{
        id: r.storagePath,
        path: r.storagePath,
        url: r.url ?? undefined,
        kind: "image" as const,
        ai: true,
        own: false,
        name: prompt.trim().slice(0, 60),
      }]);
    } catch (err) {
      if (liveRef.current) setError(explainAiError(err));
    } finally {
      if (liveRef.current) setBusy(false);
    }
  };

  if (configured === false) {
    return (
      <p className="ef-note">
        The image engine is not connected right now. Go back a step and choose
        your own photo or the plain branded look; both work without it.
      </p>
    );
  }

  const ranges: Array<["strict" | "moderate" | "loose", string, string]> = [
    ["strict", "Faithful", "Stays tightly inside the brand look"],
    ["moderate", "Balanced", "Brand-true, with room to interpret"],
    ["loose", "Bold", "Free interpretation; the hard rules still hold"],
  ];

  return (
    <>
      <textarea className="ef-input" rows={4} value={prompt}
        aria-label="Describe the image"
        placeholder="e.g. A child's hands and a parent's hands over a mortar and pestle"
        onChange={(e) => setPrompt(e.target.value)} />
      <div className="ef-grid" style={{ marginTop: 10 }}>
        {ranges.map(([id, label, hint]) => (
          <button key={id} type="button"
            className={`ef-opt${range === id ? " is-sel" : ""}`}
            onClick={() => setRange(id)}>
            <span className="ef-opt-t">{label}</span>
            <span className="ef-opt-h">{hint}</span>
          </button>
        ))}
      </div>
      <div className="ef-exportrow" style={{ marginTop: 12 }}>
        <button type="button" className="ef-btn ef-pri" onClick={generate}
          disabled={busy || !prompt.trim() || configured === null}>
          {busy ? "Painting…" : current ? "Generate another" : "Generate the image"}
        </button>
      </div>
      {error && <p className="ef-error">{error}</p>}
      <p className="ef-note">
        {current
          ? "That is on the preview. Generate another to replace it, or continue."
          : "Eden's palette, mood, and hard rules are locked on the server. Your words steer the subject."}
      </p>
    </>
  );
}

function OpacitySlider({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const v = answers.opacity ?? 1;
  return (
    <div className="ef-slider">
      <span className="ef-slider-l">Overlay strength</span>
      <input type="range" min={0} max={100} value={Math.round(v * 100)}
        onChange={(e) => onWrite("opacity", Number(e.target.value) / 100)} />
      <span className="ef-slider-v">{Math.round(v * 100)}%</span>
    </div>
  );
}

function CaptionField({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const v = answers.caption ?? "";
  const over = v.length > 2200;
  return (
    <>
      <textarea className="ef-input" rows={8} value={v}
        onChange={(e) => onWrite("caption", e.target.value)} />
      <div className={`ef-count${over ? " is-over" : ""}`}>{v.length} / 2200</div>
    </>
  );
}

function OverlayFields({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const o = answers.overlay ?? defaultOverlay(answers);
  const set = (k: keyof OverlayAnswer, val: string) => onWrite("overlay", { ...o, [k]: val });
  const fields: Array<[keyof OverlayAnswer, string, number]> = [
    ["hook", "Headline", 40], ["sub", "Subtext", 90], ["cta", "Button", 30],
  ];
  return (
    <>
      {fields.map(([k, label, cap]) => {
        const val = o[k] ?? "";
        return (
          <div className="ef-field" key={k}>
            <label>{label}</label>
            <input className="ef-input" type="text" value={val}
              onChange={(e) => set(k, e.target.value)} />
            <div className={`ef-count${val.length > cap ? " is-over" : ""}`}>
              {val.length} / {cap}
            </div>
          </div>
        );
      })}
    </>
  );
}

function AnchorGrid({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const cells: Array<[string, string]> = [
    ["tl", "Top left"], ["tc", "Top centre"], ["tr", "Top right"],
    ["ml", "Middle left"], ["mc", "Middle centre"], ["mr", "Middle right"],
    ["bl", "Bottom left"], ["bc", "Bottom centre"], ["br", "Bottom right"],
  ];
  return (
    <>
      <div className="ef-anchors">
        {cells.map(([c, label]) => (
          <button key={c} type="button" aria-label={label} title={label}
            className={`ef-opt${answers.anchor === c ? " is-sel" : ""}`}
            onClick={() => onWrite("anchor", c)}>{c}</button>
        ))}
      </div>
      <p className="ef-note">
        Tap a cell and the text moves on the preview. Positions are stored
        relative, so they survive a change of ad size.
      </p>
    </>
  );
}

/* ── the always-available edit tray ───────────────────────────────── */

function AdjustTray({ answers, open, onToggle, onWrite, onJump }: {
  answers: FlowAnswers; open: boolean; onToggle: (v: boolean) => void;
  onWrite: BodyProps["onWrite"]; onJump: (id: string) => void;
}) {
  const hasMedia = (answers.slides?.length ?? 0) > 0 || answers.source === "ai";
  const rows: React.ReactNode[] = [];

  if (hasMedia) {
    rows.push(
      <div className="ef-trayrow" key="img">
        <label>Image</label>
        <button type="button" className="ef-mini"
          onClick={() => onJump(answers.source === "ai" ? "aiImage" : "media")}>
          Change image
        </button>
      </div>,
      <div className="ef-trayrow" key="op">
        <label>Opacity</label>
        <input type="range" min={0} max={100} value={Math.round((answers.opacity ?? 1) * 100)}
          onChange={(e) => onWrite("opacity", Number(e.target.value) / 100)} />
        <span className="ef-slider-v">{Math.round((answers.opacity ?? 1) * 100)}%</span>
      </div>,
    );
  }
  if (answers.overlay && (answers.treatment === "static" || answers.treatment === "branded")) {
    rows.push(
      <div className="ef-trayrow" key="hook">
        <label>Headline</label>
        <input className="ef-input" type="text" value={answers.overlay.hook ?? ""}
          onChange={(e) => onWrite("overlay", { ...answers.overlay, hook: e.target.value })} />
      </div>,
    );
  }
  if (answers.adType) {
    rows.push(
      <div className="ef-trayrow" key="fmt">
        <label>Format</label>
        <button type="button" className="ef-mini" onClick={() => onJump("adType")}>
          Change size
        </button>
      </div>,
    );
  }
  if (!rows.length) return null;

  return (
    <details className="ef-tray" open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>✎ Adjust image, text, opacity</summary>
      <div>{rows}</div>
    </details>
  );
}

/* ── the finished ad ──────────────────────────────────────────────── */

function RenderStep({ answers, onWrite }: {
  answers: FlowAnswers; onWrite: BodyProps["onWrite"];
}) {
  const dims = adDimensions(answers);
  const video = isVideoOutput(answers);
  return (
    <>
      <div className="ef-summary-card">
        <div className="ef-row"><span>Output</span><b>{video ? "Video" : "Image"}</b></div>
        <div className="ef-row">
          <span>Size</span><b>{dims.w} × {dims.h}</b>
        </div>
        {video && (
          <div className="ef-row">
            <span>Length</span><b>about {suggestedDuration(answers)}s</b>
          </div>
        )}
        {answers.sound?.narration && (
          <div className="ef-row"><span>Narration</span><b>baked in</b></div>
        )}
      </div>
      <p className="ef-note">
        {video
          ? "Building the video happens on the next screen, where you can play it before saving."
          : "Rendered at full Meta dimensions on the next screen."}
      </p>
      {!answers.rendered && (
        <button type="button" className="ef-btn ef-pri" style={{ marginTop: 12 }}
          onClick={() => onWrite("rendered", true)}>
          Ready
        </button>
      )}
    </>
  );
}

/* ── the finished ad ──────────────────────────────────────────────── */

function FlowSummary({ answers, onJump, onFinish, onExported }: {
  answers: FlowAnswers; onJump: (id: string) => void; onFinish?: () => void;
  onExported?: (file: ExportedFile) => void;
}) {
  const finalRef = useRef<HTMLCanvasElement>(null);
  const [video, setVideo] = useState<VideoExport | null>(null);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wantsVideo = isVideoOutput(answers);
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);

  useEffect(() => {
    if (finalRef.current) paintAd(finalRef.current, answers, { width: 640 });
  }, [answers]);

  const build = async () => {
    setBuilding(true); setError(null); setProgress(0);
    try {
      const out = await exportVideo(answers, { onProgress: setProgress });
      if (!liveRef.current) { URL.revokeObjectURL(out.url); return; }
      // A rebuild replaces the previous take; let its blob URL go.
      setVideo((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return out;
      });
    } catch (err) {
      if (!liveRef.current) return;
      setError(err instanceof ExportError ? explainExportFailure(err.reason)
        : "The video could not be built. The image below still works.");
    } finally {
      if (liveRef.current) setBuilding(false);
    }
  };

  /** The archive's paper trail. Fire-and-forget by contract: a logging failure
   *  must never turn a successful save into an error. */
  const record = (blob: Blob) => {
    if (!onExported) return;
    const dims = adDimensions(answers);
    try {
      onExported({
        blob,
        name: exportFilename(answers, video ? video.ext : "png"),
        format: video ? video.ext : "png",
        width: dims.w,
        height: dims.h,
      });
    } catch { /* recording is decoration on the save */ }
  };

  const savePhone = async () => {
    setStatus(null);
    try {
      const blob = video ? video.blob : await exportStill(answers);
      const name = exportFilename(answers, video ? video.ext : "png");
      const outcome = await saveToDevice(blob, name);
      if (outcome === "shared" || outcome === "downloaded") record(blob);
      if (!liveRef.current) return;
      setStatus({
        shared: "Sent to your share sheet. Choose Save Video or Save Image.",
        cancelled: "Cancelled.",
        downloaded: "Your browser could not open the share sheet, so it downloaded instead. "
          + "On an iPhone that lands in Files, not Photos.",
        failed: "Could not save from here.",
      }[outcome]);
    } catch {
      if (liveRef.current) setError("Could not prepare the file.");
    }
  };

  const saveComputer = async () => {
    setStatus(null);
    try {
      const blob = video ? video.blob : await exportStill(answers);
      const name = exportFilename(answers, video ? video.ext : "png");
      const ok = downloadBlob(blob, name);
      if (ok) record(blob);
      if (!liveRef.current) return;
      setStatus(ok ? `Downloaded ${name}.` : "Could not download.");
    } catch {
      if (liveRef.current) setError("Could not prepare the file.");
    }
  };

  const links: Array<[string, string]> = answers.pathway === "canva"
    ? [["Open Canva", HANDOFF_LINKS.canva]]
    : answers.pathway === "bsuite"
      ? [["Open Business Suite", HANDOFF_LINKS.businessSuite],
         ["Open Ads Manager", HANDOFF_LINKS.adsManager]]
      : answers.pathway === "native"
        ? [["Open Instagram", HANDOFF_LINKS.instagram],
           ["Open Facebook", HANDOFF_LINKS.facebook],
           ["Open Ads Manager", HANDOFF_LINKS.adsManager]]
        : [];

  return (
    <div className="edenflow">
      <h1 className="ef-q">Here's your ad.</h1>
      <p className="ef-sub">
        Not happy with something? Tap any chip to change that one answer.
        Everything else stays as it is.
      </p>

      <div className="ef-final">
        <div>
          {video
            ? <video className="ef-video" src={video.url} controls playsInline />
            : <canvas ref={finalRef} aria-label="Your finished ad" />}
          {video && (
            <p className="ef-note">
              {video.hasAudio
                ? "Play it and check your narration before you save."
                : "Play it through before you save."}
              {" "}{video.ext.toUpperCase()} · {video.seconds}s
            </p>
          )}
        </div>

        <div className="ef-final-side">
          {wantsVideo && !video && (
            <div className="ef-summary-card">
              <p className="ef-eyebrow">Build the video</p>
              <p className="ef-note" style={{ margin: "0 0 10px" }}>
                {answers.sound?.narration
                  ? "Records the ad with your narration inside it."
                  : "Records the ad as a video file."}
                {" "}Add music afterwards in Instagram.
              </p>
              <button type="button" className="ef-btn ef-pri" onClick={build}
                disabled={building || !supportsVideoExport()}>
                {building ? `Recording… ${Math.round(progress * 100)}%` : "Build the video"}
              </button>
              {!supportsVideoExport() && (
                <p className="ef-note">
                  This browser cannot record video. The image still saves.
                </p>
              )}
            </div>
          )}

          <div className="ef-summary-card">
            <p className="ef-eyebrow">Save it</p>
            <p className="ef-note" style={{ margin: "0 0 10px" }}>
              Only the first reaches your camera roll. A download always lands in
              Files instead, which is an iPhone rule rather than a choice.
            </p>
            <div className="ef-exportrow">
              <button type="button" className="ef-btn ef-pri" onClick={savePhone}>
                Save to my phone
              </button>
              <button type="button" className="ef-btn" onClick={saveComputer}>
                Download to this computer
              </button>
            </div>
            {status && <p className="ef-note">{status}</p>}
            {error && <p className="ef-error">{error}</p>}
          </div>

          <div className="ef-summary-card">
            <p className="ef-eyebrow">Caption to paste into Meta</p>
            <div className="ef-caption">{answers.caption}</div>
          </div>

          {links.length > 0 && (
            <div className="ef-summary-card">
              <p className="ef-eyebrow">Where it goes next</p>
              <p className="ef-note" style={{ margin: "0 0 10px" }}>{nextStepText(answers)}</p>
              <div className="ef-exportrow">
                {links.map(([label, href]) => (
                  <a key={href} className="ef-btn ef-link" href={href}
                    target="_blank" rel="noopener noreferrer">{label} ↗</a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ef-nav">
        <button type="button" className="ef-btn"
          onClick={() => {
            // The genuinely last question of THIS ad, not a hardcoded id.
            const last = visibleNodes(answers).at(-1);
            onJump(last ? last.id : "pathway");
          }}>
          ◂ Back to the last question
        </button>
        <span className="ef-spacer" />
        {onFinish && (
          <button type="button" className="ef-btn ef-pri" onClick={onFinish}>
            Start another ad
          </button>
        )}
      </div>
    </div>
  );
}
