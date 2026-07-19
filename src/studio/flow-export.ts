// Getting the finished ad out of the browser.
//
// Two outputs. A still ad is a PNG rendered at true Meta dimensions. An ad
// whose text moves, or that is built on a clip, is a video recorded off the
// same canvas with the founder's narration mixed in.
//
// Saving has to work in two different worlds and they need different
// mechanisms: an iPhone reaches Photos only through the share sheet, a computer
// saves through a download. A download on iOS lands in Files and never in
// Photos, which is an iOS rule rather than something to work around, so both
// routes are offered and named for what they actually do.

import { paintAd, adDimensions } from "./flow-paint";
import type { FlowAnswers } from "./flow-graph";
import { isVideoOutput } from "./flow-graph";
import { PRODUCTS } from "./studio-banks";

/** Formats worth trying, best first. Chrome and Safari both write MP4 now;
 *  WebM is the fallback and Meta accepts it. */
const VIDEO_MIMES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

const AUDIO_MIMES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

export type ExportFailure =
  | "no-recorder" | "no-capture" | "no-format" | "no-canvas" | "failed";

export class ExportError extends Error {
  constructor(public readonly reason: ExportFailure, message: string) {
    super(message);
    this.name = "ExportError";
  }
}

/** Plain-language reason, for showing rather than logging. */
export function explainExportFailure(reason: ExportFailure): string {
  switch (reason) {
    case "no-recorder":
      return "This browser cannot record video. Save the still image instead, "
        + "or build the video on a computer.";
    case "no-capture":
      return "This browser cannot record from a canvas. Save the still image instead.";
    case "no-format":
      return "This browser offers no video format we can write.";
    case "no-canvas":
      return "The ad could not be drawn, so there is nothing to export.";
    default:
      return "The video could not be built. The still image above still works.";
  }
}

export function supportsVideoExport(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  if (typeof document === "undefined") return false;
  const cv = document.createElement("canvas");
  if (typeof cv.captureStream !== "function") return false;
  return VIDEO_MIMES.some((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
  });
}

export function supportsMicRecording(): boolean {
  return typeof MediaRecorder !== "undefined"
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia;
}

/** A filename that says what the ad is, so a camera roll stays navigable. */
export function exportFilename(a: FlowAnswers, ext: string): string {
  const product = String(a.product ?? "ad").replace(/[^a-z0-9]+/gi, "-");
  const format = String(a.adType ?? "ad");
  return `eden-${product}-${format}.${ext}`;
}

/* ── stills ───────────────────────────────────────────────────────── */

/** The ad at true Meta pixels, not at preview size. */
export async function exportStill(a: FlowAnswers): Promise<Blob> {
  const cv = document.createElement("canvas");
  const { w } = adDimensions(a);
  paintAd(cv, a, { width: w });
  const blob = await new Promise<Blob | null>((res) => {
    try { cv.toBlob((b) => res(b), "image/png"); } catch { res(null); }
  });
  if (!blob) throw new ExportError("no-canvas", explainExportFailure("no-canvas"));
  return blob;
}

/* ── narration ────────────────────────────────────────────────────── */

export interface MicSession {
  /** Stop and hand back what was recorded. */
  stop: () => Promise<{ blob: Blob; url: string; seconds: number }>;
  /** Give up without keeping anything. */
  cancel: () => void;
  /** 0..1, for a level meter. */
  level: () => number;
}

/**
 * Record from the microphone.
 *
 * Live recording rather than a file picker, because iOS Voice Memos are
 * genuinely hard to retrieve through one. Note that an embedded preview
 * (an iframe) is refused microphone access; that is the embed, not the phone.
 */
export async function startMicRecording(maxSeconds = 60): Promise<MicSession> {
  if (!supportsMicRecording()) {
    throw new ExportError("no-recorder",
      "This browser cannot reach a microphone. If this page is embedded, that is "
      + "the embed rather than your device.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = AUDIO_MIMES.find((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
  });
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

  // A level meter is a nicety; failing to build one must not stop the recording.
  let analyser: AnalyserNode | null = null;
  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
  } catch { /* no meter */ }

  const started = performance.now();
  rec.start();

  let autoStop: number | undefined;
  const cleanup = () => {
    if (autoStop) window.clearTimeout(autoStop);
    stream.getTracks().forEach((t) => t.stop());
    try { audioCtx?.close(); } catch { /* already closed */ }
  };

  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  autoStop = window.setTimeout(() => {
    if (rec.state === "recording") rec.stop();
  }, maxSeconds * 1000);

  return {
    async stop() {
      if (rec.state === "recording") rec.stop();
      await stopped;
      cleanup();
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      return {
        blob,
        url: URL.createObjectURL(blob),
        seconds: (performance.now() - started) / 1000,
      };
    },
    cancel() {
      try { if (rec.state === "recording") rec.stop(); } catch { /* already stopped */ }
      cleanup();
    },
    level() {
      if (!analyser) return 0;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (const v of buf) sum += v;
      return Math.min(1, sum / buf.length / 128);
    },
  };
}

/* ── video ────────────────────────────────────────────────────────── */

export interface VideoExport {
  blob: Blob;
  url: string;
  ext: "mp4" | "webm";
  seconds: number;
  hasAudio: boolean;
}

/** Long enough to read the credits through once, within Meta's Reel limits. */
export function suggestedDuration(a: FlowAnswers): number {
  const lines = String(a.credits?.text ?? "").split("\n").filter(Boolean).length;
  const fromCredits = 6 + lines * 1.8;
  const fromNarration = a.sound?.narration?.durationSec ?? 0;
  return Math.min(60, Math.max(8, Math.ceil(Math.max(fromCredits, fromNarration))));
}

/**
 * Record the ad as a video, with narration mixed in when there is any.
 *
 * Rendered at 720 wide rather than the full 1080: MediaRecorder encodes in real
 * time, and on a phone 1080 drops frames badly enough to be visible. The still
 * export is full resolution; motion is where the trade belongs.
 */
export async function exportVideo(
  a: FlowAnswers,
  opts: { seconds?: number; onProgress?: (fraction: number) => void } = {},
): Promise<VideoExport> {
  if (typeof MediaRecorder === "undefined") {
    throw new ExportError("no-recorder", explainExportFailure("no-recorder"));
  }
  const dims = adDimensions(a);
  const cv = document.createElement("canvas");
  const width = 720;
  paintAd(cv, a, { width });
  if (typeof cv.captureStream !== "function") {
    throw new ExportError("no-capture", explainExportFailure("no-capture"));
  }
  const mime = VIDEO_MIMES.find((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
  });
  if (!mime) throw new ExportError("no-format", explainExportFailure("no-format"));

  const seconds = opts.seconds ?? suggestedDuration(a);
  const videoStream = cv.captureStream(30);
  let stream = videoStream;
  let audioCtx: AudioContext | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let hasAudio = false;

  const clip = a.sound?.narration ?? a.sound?.music ?? null;
  if (clip?.url) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      const dest = audioCtx.createMediaStreamDestination();
      audioEl = new Audio();
      audioEl.src = clip.url;
      audioEl.loop = true;
      audioCtx.createMediaElementSource(audioEl).connect(dest);
      await audioEl.play();
      stream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      hasAudio = true;
    } catch {
      stream = videoStream;      // silent beats failing the whole export
    }
  }

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });

  rec.start(200);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const frame = () => {
      const elapsed = (performance.now() - t0) / 1000;
      paintAd(cv, a, { width, time: elapsed });
      opts.onProgress?.(Math.min(1, elapsed / seconds));
      if (elapsed >= seconds) { res(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  rec.stop();
  await stopped;

  try { audioEl?.pause(); } catch { /* already paused */ }
  try { await audioCtx?.close(); } catch { /* already closed */ }

  if (!chunks.length) throw new ExportError("failed", explainExportFailure("failed"));
  const blob = new Blob(chunks, { type: mime });
  return {
    blob,
    url: URL.createObjectURL(blob),
    ext: mime.startsWith("video/mp4") ? "mp4" : "webm",
    seconds,
    hasAudio,
  };
}

/* ── saving ───────────────────────────────────────────────────────── */

export type SaveOutcome = "shared" | "cancelled" | "downloaded" | "failed";

/** The only route to an iPhone camera roll. Falls back to a download. */
export async function saveToDevice(
  blob: Blob, filename: string, title = "Eden ad",
): Promise<SaveOutcome> {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return "cancelled";
    // Anything else means the share sheet is unavailable: fall through.
  }
  return downloadBlob(blob, filename) ? "downloaded" : "failed";
}

export function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      try { URL.revokeObjectURL(url); a.remove(); } catch { /* gone already */ }
    }, 4000);
    return true;
  } catch {
    return false;
  }
}

/* ── where it goes next ───────────────────────────────────────────── */

export const HANDOFF_LINKS = {
  adsManager: "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
  businessSuite: "https://business.facebook.com/latest/composer",
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  canva: "https://www.canva.com/",
  soundCollection: "https://www.facebook.com/sound/collection",
} as const;

/** The destination URL an ad points at, with the campaign's UTM tags. */
export function destinationUrl(a: FlowAnswers): string {
  const product = (PRODUCTS as any)[a.product as string];
  const base = product?.url ?? "https://edeninstitute.health";
  const source = a.platforms === "facebook" ? "facebook" : "instagram";
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: "paid_social",
    utm_campaign: product?.campaign ?? "eden",
    utm_content: String(a.angle ?? "creative"),
  });
  return `${base}${base.includes("?") ? "&" : "?"}${params}`;
}

/** What the founder should do next, in her own terms. */
export function nextStepText(a: FlowAnswers): string {
  const video = isVideoOutput(a);
  const thing = video ? "video" : "image";
  switch (a.pathway) {
    case "native":
      return `Save the ${thing} to your phone, then open Instagram or Facebook, `
        + `start a new post, and paste your caption. Add music there.`;
    case "canva":
      return `Save the ${thing}, then open Canva to adjust the layout or add elements.`;
    case "bsuite":
      return `Save the ${thing}, then open Business Suite to schedule it, publish it, `
        + `or keep it as a draft.`;
    default:
      return `Save the ${thing} and come back whenever you like. The campaign stays here.`;
  }
}
