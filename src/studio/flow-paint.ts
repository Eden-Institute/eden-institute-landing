// Painting the ad onto a canvas.
//
// The flow shows the ad at every question, so this runs constantly: on a
// keystroke in the headline field, on every pixel of a slider drag. It is
// therefore synchronous and allocation-light, and decoded media is cached.
//
// Positions are relative (0..1 of the frame) so a creative built at preview
// size renders identically at 1080 px, and so changing the ad size later does
// not move the text.

import { FORMATS, PRODUCTS } from "./studio-banks";
import type { FineTune, FlowAnswers, SlideAnswer } from "./flow-graph";
import { isVideoOutput } from "./flow-graph";

/** Brand kit. These come from the Eden Brand Voice Guide §4.1, and the studio
 *  brand-kit table is the runtime source of truth; these are the fallbacks so
 *  a preview never renders un-branded while the kit loads. */
export const PAINT_PALETTE = {
  forest: "#2B3A1E",
  linen: "#F5EDD6",
  cream: "#FAF6EE",
  amber: "#C5A44E",
  ink: "#1E1E14",
  white: "#FFFFFF",
} as const;

const SERIF = '"Cinzel","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif';

/* ── decoded media cache ──────────────────────────────────────────── */

interface Decoded {
  el: HTMLImageElement | HTMLVideoElement | null;
  ready: boolean;
  failed: boolean;
}
const MEDIA = new Map<string, Decoded>();

/** A long session uploads and previews many files; decoded elements are heavy
 *  (a video element holds a decoder). Evict oldest-inserted beyond this. */
const MEDIA_CACHE_MAX = 24;

/** Decode once and keep it. `onReady` fires when a repaint would show more
 *  than it does now, so the caller can schedule one. */
export function decodeSlide(slide: SlideAnswer, onReady?: () => void): Decoded | null {
  const src = slide.url;
  if (!src) return null;
  const hit = MEDIA.get(src);
  if (hit) return hit;

  if (MEDIA.size >= MEDIA_CACHE_MAX) {
    const oldest = MEDIA.keys().next().value;
    if (oldest !== undefined) MEDIA.delete(oldest);
  }
  const entry: Decoded = { el: null, ready: false, failed: false };
  MEDIA.set(src, entry);
  try {
    if (slide.kind === "video") {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "metadata";
      v.crossOrigin = "anonymous";
      v.onloadeddata = () => {
        // A frame a little way in: frame zero is often black.
        try { v.currentTime = Math.min(1, (v.duration || 3) / 3); }
        catch { entry.ready = true; onReady?.(); }
      };
      v.onseeked = () => { entry.ready = true; onReady?.(); };
      v.onerror = () => { entry.failed = true; onReady?.(); };
      v.src = src;
      entry.el = v;
    } else {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => { entry.ready = true; onReady?.(); };
      im.onerror = () => { entry.failed = true; onReady?.(); };
      im.src = src;
      entry.el = im;
    }
  } catch {
    entry.failed = true;
  }
  return entry;
}

/* ── helpers ──────────────────────────────────────────────────────── */

function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text || "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const attempt = line ? `${line} ${word}` : word;
      if (g.measureText(attempt).width > maxW && line) { out.push(line); line = word; }
      else line = attempt;
    }
    if (line) out.push(line);
  }
  return out;
}

const filterFor = (f?: FineTune | null) => (f
  ? `brightness(${f.brightness ?? 1}) contrast(${f.contrast ?? 1}) saturate(${f.saturation ?? 1})`
  : "none");

/** Cover-fit, honouring zoom and nudge. Used for real media and, so the two
 *  behave identically, for the placeholder art too. */
function coverRect(
  W: number, H: number, natW: number, natH: number, f?: FineTune | null,
) {
  const scale = Math.max(W / natW, H / natH) * (f?.scale ?? 1);
  const dw = natW * scale;
  const dh = natH * scale;
  return {
    x: (W - dw) / 2 + ((f?.x ?? 0) / 100) * W,
    y: (H - dh) / 2 + ((f?.y ?? 0) / 100) * H,
    w: dw, h: dh,
  };
}

/* ── the layers ───────────────────────────────────────────────────── */

function paintGround(g: CanvasRenderingContext2D, W: number, H: number, a: FlowAnswers) {
  g.fillStyle = a.template === "forest" ? PAINT_PALETTE.forest : PAINT_PALETTE.linen;
  g.fillRect(0, 0, W, H);
}

function paintBranded(g: CanvasRenderingContext2D, W: number, H: number, a: FlowAnswers) {
  if (a.template === "forest") {
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, PAINT_PALETTE.forest);
    grd.addColorStop(1, "#16281F");
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  } else {
    g.fillStyle = PAINT_PALETTE.cream; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(43,58,30,.14)"; g.lineWidth = 1;
    for (let y = 0; y < H; y += Math.max(7, H / 54)) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
  }
}

function paintMedia(
  g: CanvasRenderingContext2D, W: number, H: number, a: FlowAnswers, onReady?: () => void,
) {
  const slide = (a.slides || [])[0];
  const decoded = slide ? decodeSlide(slide, onReady) : null;

  if (decoded?.ready && decoded.el) {
    const el = decoded.el as HTMLImageElement & HTMLVideoElement;
    const natW = el.naturalWidth || el.videoWidth || W;
    const natH = el.naturalHeight || el.videoHeight || H;
    const r = coverRect(W, H, natW, natH, a.finetune);
    g.save();
    g.globalAlpha = a.opacity ?? 1;
    g.filter = filterFor(a.finetune);
    try { g.drawImage(el, r.x, r.y, r.w, r.h); } catch { /* not decodable yet */ }
    g.filter = "none";
    g.restore();
    return;
  }

  // Nothing to draw yet: say which, rather than showing a blank frame that
  // looks like a bug.
  g.fillStyle = "rgba(43,58,30,.06)"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(43,58,30,.45)";
  g.textAlign = "center";
  g.font = `${Math.round(W * 0.038)}px ${SERIF}`;
  g.fillText(
    decoded?.failed ? "That file could not be opened"
      : decoded ? "Reading your file…"
        : "Your picture appears here",
    W / 2, H / 2,
  );
}

function paintTemplate(g: CanvasRenderingContext2D, W: number, H: number, a: FlowAnswers) {
  const branded = a.source === "branded";
  if (a.template === "label") {
    const m = W * 0.055;
    g.strokeStyle = branded ? "rgba(43,58,30,.75)" : "rgba(245,237,214,.85)";
    g.lineWidth = Math.max(1.4, W * 0.006);
    g.strokeRect(m, m, W - m * 2, H - m * 2);
    g.lineWidth = Math.max(1, W * 0.002);
    const i = m + W * 0.018;
    g.strokeRect(i, i, W - i * 2, H - i * 2);
  } else if (a.template === "photo") {
    const grd = g.createLinearGradient(0, H * 0.42, 0, H);
    grd.addColorStop(0, "rgba(12,20,15,0)");
    grd.addColorStop(1, "rgba(12,20,15,.82)");
    g.fillStyle = grd; g.fillRect(0, H * 0.42, W, H * 0.58);
  } else if (a.template === "forest" && !branded) {
    g.fillStyle = "rgba(20,34,25,.5)"; g.fillRect(0, 0, W, H);
  }
}

/** Where the text sits, as a 9-point anchor. Stored as a code so it survives a
 *  change of ad size. */
function anchorPos(anchor: string, W: number, H: number, pad: number) {
  const v = anchor?.[0] ?? "b";
  const h = anchor?.[1] ?? "c";
  return {
    x: h === "l" ? pad : h === "r" ? W - pad : W / 2,
    align: (h === "l" ? "left" : h === "r" ? "right" : "center") as CanvasTextAlign,
    vertical: v,
  };
}

function paintText(
  g: CanvasRenderingContext2D, W: number, H: number, a: FlowAnswers, t: number,
) {
  const treatment = a.treatment;
  if (!treatment || treatment === "none") return;

  const onDark = a.template === "forest" || a.template === "photo"
    || (a.source !== "branded" && (a.opacity ?? 1) > 0.45);
  const fg = onDark ? PAINT_PALETTE.linen : PAINT_PALETTE.forest;
  const pad = W * 0.1;
  const maxW = W - pad * 2;

  if (treatment === "scrolling") {
    const size = W * 0.062;
    const lh = size * 1.65;
    g.font = `600 ${size}px ${SERIF}`;
    g.textAlign = "center";
    const lines = wrapLines(g, a.credits?.text || "", maxW);
    const total = lines.length * lh;
    const span = H + total;
    const speed = a.credits?.speed ?? 5;
    const offset = ((t * (speed / 5)) / 8 * span) % span;
    lines.forEach((line, i) => {
      const y = H + i * lh - offset;
      if (y < -lh || y > H + lh) return;
      const fade = Math.min(1, Math.min(y, H - y) / (H * 0.18));
      g.globalAlpha = Math.max(0, fade);
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillText(line, W / 2 + 1.5, y + 1.5);
      g.fillStyle = fg; g.fillText(line, W / 2, y);
    });
    g.globalAlpha = 1;
    return;
  }

  const o = a.overlay || {};
  const { x, align, vertical } = anchorPos(
    treatment === "branded" ? "bc" : (a.anchor || "bc"), W, H, pad,
  );
  g.textAlign = align;

  const hookSize = W * 0.085;
  const subSize = W * 0.042;
  g.font = `600 ${hookSize}px ${SERIF}`;
  const hookLines = wrapLines(g, o.hook || "", maxW);
  g.font = `400 ${subSize}px ${SERIF}`;
  const subLines = wrapLines(g, o.sub || "", maxW);
  const ctaH = o.cta ? W * 0.085 : 0;
  const block = hookLines.length * hookSize * 1.16
    + (subLines.length ? subLines.length * subSize * 1.4 + W * 0.03 : 0)
    + (ctaH ? ctaH + W * 0.035 : 0);

  let y = vertical === "t" ? H * 0.13 + hookSize
    : vertical === "m" ? (H - block) / 2 + hookSize
      : H * 0.88 - block + hookSize;

  g.font = `600 ${hookSize}px ${SERIF}`;
  for (const line of hookLines) {
    if (onDark) { g.fillStyle = "rgba(0,0,0,.42)"; g.fillText(line, x + 1.5, y + 1.5); }
    g.fillStyle = fg; g.fillText(line, x, y);
    y += hookSize * 1.16;
  }
  if (subLines.length) {
    y += W * 0.03;
    g.font = `400 ${subSize}px ${SERIF}`;
    g.fillStyle = onDark ? "rgba(245,237,214,.88)" : "rgba(43,58,30,.82)";
    for (const line of subLines) { g.fillText(line, x, y); y += subSize * 1.4; }
  }
  if (o.cta) {
    y += W * 0.035;
    g.font = `600 ${W * 0.038}px ${SERIF}`;
    const tw = g.measureText(o.cta).width;
    const bw = tw + W * 0.1;
    const bh = W * 0.078;
    const bx = align === "left" ? x : align === "right" ? x - bw : x - bw / 2;
    g.fillStyle = PAINT_PALETTE.amber;
    g.beginPath();
    if (typeof g.roundRect === "function") {
      g.roundRect(bx, y - bh * 0.72, bw, bh, bh / 2);
      g.fill();
    } else {
      g.fillRect(bx, y - bh * 0.72, bw, bh);
    }
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.fillText(o.cta, bx + bw / 2, y + bh * 0.06);
  }
}

function paintPlayBadge(g: CanvasRenderingContext2D, W: number, H: number) {
  const r = W * 0.075;
  g.fillStyle = "rgba(12,20,15,.42)";
  g.beginPath(); g.arc(W / 2, H / 2, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,.8)";
  g.lineWidth = Math.max(1.2, W * 0.004); g.stroke();
  g.fillStyle = "rgba(255,255,255,.92)";
  g.beginPath();
  g.moveTo(W / 2 - r * 0.28, H / 2 - r * 0.4);
  g.lineTo(W / 2 + r * 0.42, H / 2);
  g.lineTo(W / 2 - r * 0.28, H / 2 + r * 0.4);
  g.closePath(); g.fill();
}

/* ── the whole creative ───────────────────────────────────────────── */

export interface PaintOptions {
  /** Longest edge in CSS pixels. The real export passes 1080. */
  width?: number;
  /** Seconds into the credits roll. */
  time?: number;
  /** Called when a decode finishes and a repaint would show more. */
  onReady?: () => void;
}

/** Pixel dimensions this ad renders at, straight from the format bank. */
export function adDimensions(a: FlowAnswers) {
  const f = FORMATS[a.adType || "portrait"] ?? FORMATS.portrait;
  return { w: f.w, h: f.h, name: f.name };
}

export function paintAd(
  canvas: HTMLCanvasElement, a: FlowAnswers, opts: PaintOptions = {},
): void {
  // getContext can throw, not just return null: jsdom does, and a browser will
  // too if 2d is unavailable. A preview that cannot draw must not take the
  // whole flow down with it.
  let g: CanvasRenderingContext2D | null = null;
  try { g = canvas.getContext("2d"); } catch { return; }
  if (!g) return;

  const dims = adDimensions(a);
  const W = Math.round(opts.width ?? 560);
  const H = Math.round(W * (dims.h / dims.w));
  // Assigning width/height reallocates and clears the backing store even when
  // the value is unchanged, and this runs 60×/s during the credits roll.
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  g.clearRect(0, 0, W, H);

  paintGround(g, W, H, a);
  if (a.source === "branded") paintBranded(g, W, H, a);
  else paintMedia(g, W, H, a, opts.onReady);
  paintTemplate(g, W, H, a);
  paintText(g, W, H, a, opts.time ?? 0);
  if (isVideoOutput(a) && a.treatment !== "scrolling") paintPlayBadge(g, W, H);
}

/** The headline the overlay starts from, so a new ad is never blank. */
export function defaultOverlay(a: FlowAnswers) {
  const p = PRODUCTS[a.product ?? ""];
  return {
    hook: p?.headlines?.[0] ?? "",
    sub: p?.descs?.[0] ?? "",
    cta: p?.ctas?.[a.objective ?? ""] ?? "Learn More",
  };
}
