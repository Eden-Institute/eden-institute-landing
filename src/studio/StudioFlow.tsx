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
import type { FlowAnswers, FlowNode, SlideAnswer } from "./flow-graph";
import { adDimensions, defaultOverlay, paintAd } from "./flow-paint";
import { PRODUCTS } from "./studio-banks";
import "./flow.css";

const CHAPTER_NAMES = ["Where & what", "Media & styling", "Copy & text", "Export"];
const NUMERALS = ["I", "II", "III", "IV"];

/** Files a phone can actually offer. iPhones shoot HEIC and HEVC, so a narrow
 *  allow-list greys out the camera roll; let the decoder be the real gate. */
const MEDIA_ACCEPT = "image/*,video/*";
const MAX_BYTES = 200 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;

export interface AssetsBridge {
  list: () => Promise<Array<{ name: string }>>;
  upload: (file: File) => Promise<void>;
  url: (name: string) => Promise<string>;
  remove: (name: string) => Promise<void>;
}

interface Props {
  answers: FlowAnswers;
  onChange: (next: FlowAnswers) => void;
  assets?: AssetsBridge;
  /** Start a fresh campaign. Offered once the ad is finished. */
  onFinish?: () => void;
}

export default function StudioFlow({ answers, onChange, assets, onFinish }: Props) {
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

  const write = useCallback((key: keyof FlowAnswers, value: unknown) => {
    const { answers: next, cleared } = reconcile({ ...answers, [key]: value } as FlowAnswers);
    onChange(next);
    if (cleared.length) {
      setNotice(cleared.length === 1
        ? `That change reset one earlier answer: ${cleared[0].question(next).toLowerCase()}`
        : `That change reset ${cleared.length} earlier answers.`);
    }
    return next;
  }, [answers, onChange]);

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
    return <FlowSummary answers={answers} onJump={jumpTo} onFinish={onFinish} />;
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

          <NodeBody node={node} answers={answers} assets={assets}
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
        <div className="ef-lightbox" onClick={(e) => {
          if (e.target === e.currentTarget) setEnlarged(false);
        }}>
          <canvas ref={bigRef} aria-label="Enlarged preview" />
          <button type="button" className="ef-btn" onClick={() => setEnlarged(false)}>Close</button>
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
  onWrite: (key: keyof FlowAnswers, value: unknown) => FlowAnswers;
  onPick: (key: keyof FlowAnswers, value: unknown) => void;
}

function NodeBody({ node, answers, assets, onWrite, onPick }: BodyProps) {
  switch (node.kind) {
    case "single": return <SingleChoice node={node} answers={answers} onPick={onPick} />;
    case "text": return <FreeText node={node} answers={answers} onWrite={onWrite} />;
    case "gallery": return <MediaPicker node={node} answers={answers} assets={assets}
      onWrite={onWrite} />;
    case "opacity": return <OpacitySlider answers={answers} onWrite={onWrite} />;
    case "caption": return <CaptionField answers={answers} onWrite={onWrite} />;
    case "overlay": return <OverlayFields answers={answers} onWrite={onWrite} />;
    case "anchor": return <AnchorGrid answers={answers} onWrite={onWrite} />;
    default:
      return (
        <p className="ef-note">
          This step arrives with the next release. Continue for now.
        </p>
      );
  }
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
  const slides = answers.slides ?? [];
  const multi = answers.adType === "carousel";

  const add = (slide: SlideAnswer) => {
    const cur = slides.slice();
    if (multi) {
      const i = cur.findIndex((s) => s.id === slide.id);
      if (i >= 0) cur.splice(i, 1); else cur.push(slide);
    } else { cur.length = 0; cur.push(slide); }
    onWrite("slides", cur);
  };

  const take = async (file: File) => {
    setError(null);
    if (!/^(image|video)\//.test(file.type || "")) {
      setError(`"${file.name}" is not a photo or video.`); return;
    }
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is ${(file.size / 1048576).toFixed(0)} MB. The limit is 200 MB.`);
      return;
    }
    const kind: SlideAnswer["kind"] = file.type.startsWith("video") ? "video" : "image";
    const url = URL.createObjectURL(file);
    if (kind === "video") {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      const ok = await new Promise<boolean>((res) => {
        probe.onloadedmetadata = () => res(!probe.duration || probe.duration <= MAX_VIDEO_SECONDS);
        probe.onerror = () => res(false);
        probe.src = url;
      });
      if (!ok) {
        setError(`"${file.name}" is longer than 60 seconds, or could not be read. `
          + "iPhone clips are HEVC by default; Settings › Camera › Formats › Most Compatible fixes it.");
        URL.revokeObjectURL(url);
        return;
      }
    }
    setBusy(true);
    try {
      // Uploading to the bucket lands in the next PR; the object URL is enough
      // to build and preview the ad in this one.
      if (assets) { try { await assets.upload(file); } catch { /* keep local */ } }
      add({ id: `own-${Date.now()}-${Math.round(file.size % 9973)}`, kind, url,
        own: true, name: file.name });
    } finally { setBusy(false); }
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
      {busy && <p className="ef-note">Reading your file…</p>}
      {error && <p className="ef-error">{error}</p>}

      {slides.length > 0 && (
        <div className="ef-grid">
          {slides.map((s) => (
            <button key={s.id} type="button" className="ef-opt is-sel"
              onClick={() => add(s)}>
              <span className="ef-opt-t">{s.kind === "video" ? "▶" : "▣"} {s.name ?? s.id}</span>
              <span className="ef-opt-h">{s.kind}</span>
              <span className="ef-tag">yours</span>
            </button>
          ))}
        </div>
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
  const set = (k: string, val: string) => onWrite("overlay", { ...o, [k]: val });
  const fields: Array<[string, string, number]> = [
    ["hook", "Headline", 40], ["sub", "Subtext", 90], ["cta", "Button", 30],
  ];
  return (
    <>
      {fields.map(([k, label, cap]) => {
        const val = (o as any)[k] ?? "";
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
  const cells = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
  return (
    <>
      <div className="ef-anchors">
        {cells.map((c) => (
          <button key={c} type="button"
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
        <button type="button" className="ef-mini" onClick={() => onJump("media")}>
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

function FlowSummary({ answers, onJump, onFinish }: {
  answers: FlowAnswers; onJump: (id: string) => void; onFinish?: () => void;
}) {
  const finalRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (finalRef.current) paintAd(finalRef.current, answers, { width: 640 });
  }, [answers]);
  const product = (PRODUCTS as any)[answers.product as string];

  return (
    <div className="edenflow">
      <h1 className="ef-q">Here's your ad.</h1>
      <p className="ef-sub">
        Not happy with something? Tap any chip to change that one answer.
        Everything else stays as it is.
      </p>
      <div className="ef-final">
        <canvas ref={finalRef} aria-label="Your finished ad" />
        <div>
          <p className="ef-eyebrow">Caption to paste into Meta</p>
          <div className="ef-caption">{answers.caption}</div>
          <p className="ef-note">
            Export, video and the Meta hand-offs arrive in the next release.
            {product ? ` This ad is for ${product.name}.` : ""}
          </p>
          <div className="ef-nav">
            <button type="button" className="ef-btn" onClick={() => onJump("pathway")}>
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
      </div>
    </div>
  );
}
