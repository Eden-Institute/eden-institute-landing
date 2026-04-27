/**
 * Targeted follow-up questions for the Pattern of Eden quiz.
 *
 * Surfaced ONLY when the initial 12-question pass resolves inconclusive on
 * one or more axes (per Option A+B of the v3.31 quiz UX redesign). Smart
 * targeting: only the axes that came back Neutral get follow-up questions;
 * the others are already resolved and don't need re-asking.
 *
 * Per Lock #39, even after follow-up the user can land in genuinely-
 * balanced territory — in which case the inconclusive screen is shown
 * with the axis-spectrum visual + framing as a clinical category, not a
 * failure. We never silently default to a Pattern.
 *
 * Question IDs start at 13 to avoid collision with the original 1-12 range
 * defined in Assessment.tsx. Three follow-ups per axis. Each is intentionally
 * MORE CONCRETE than the originals — sensory body checks, in-the-moment
 * scenarios, body-attention prompts — to give the user a sharper way to
 * break the tie that the abstract originals couldn't.
 */

import type { Axis } from "./constitution-data";

export interface FollowupQuestion {
  id: number;
  axis: Axis;
  question: string;
  options: { label: string; text: string; score: string }[];
}

export const followupQuestions: FollowupQuestion[] = [
  // ---------------- Temperature follow-ups (13–15) ----------------
  {
    id: 13,
    axis: "temperature",
    question:
      "Place your hand on your wrist or ankle right now — what does the skin feel like?",
    options: [
      { label: "A", text: "Warm to the touch", score: "Hot" },
      { label: "B", text: "Cool to the touch", score: "Cold" },
      {
        label: "C",
        text: "Genuinely in the middle — not noticeably warm or cool",
        score: "neutral",
      },
    ],
  },
  {
    id: 14,
    axis: "temperature",
    question: "When you take a hot shower, how long do you typically stay in?",
    options: [
      {
        label: "A",
        text: "Short — the heat becomes uncomfortable quickly",
        score: "Hot",
      },
      {
        label: "B",
        text: "Long — I love standing under the heat as long as I can",
        score: "Cold",
      },
      { label: "C", text: "Truly varies by mood", score: "neutral" },
    ],
  },
  {
    id: 15,
    axis: "temperature",
    question:
      "If you had to choose right now: a cold drink or a hot drink?",
    options: [
      { label: "A", text: "Cold — that's what sounds good", score: "Hot" },
      { label: "B", text: "Hot — that's what sounds good", score: "Cold" },
      { label: "C", text: "Either is fine", score: "neutral" },
    ],
  },

  // ---------------- Fluid follow-ups (16–18) ----------------
  {
    id: 16,
    axis: "fluid",
    question:
      "When you sweat during exercise or on a hot day, what's the experience?",
    options: [
      {
        label: "A",
        text: "I sweat a lot, easily, and get drenched",
        score: "Damp",
      },
      { label: "B", text: "I barely sweat even when hot", score: "Dry" },
      { label: "C", text: "Average", score: "neutral" },
    ],
  },
  {
    id: 17,
    axis: "fluid",
    question:
      "How are your lips and the inside of your nose right now?",
    options: [
      { label: "A", text: "Moist, sometimes too much", score: "Damp" },
      {
        label: "B",
        text: "Dry, sometimes uncomfortably so",
        score: "Dry",
      },
      { label: "C", text: "Normal", score: "neutral" },
    ],
  },
  {
    id: 18,
    axis: "fluid",
    question:
      "When you wake up in the morning, what's your tongue like?",
    options: [
      {
        label: "A",
        text: "Coated, thick, or sticky-feeling",
        score: "Damp",
      },
      {
        label: "B",
        text: "Dry, sometimes stuck to the roof of the mouth",
        score: "Dry",
      },
      { label: "C", text: "Normal", score: "neutral" },
    ],
  },

  // ---------------- Tone follow-ups (19–21) ----------------
  {
    id: 19,
    axis: "tone",
    question: "Right now, this moment — where is your jaw?",
    options: [
      {
        label: "A",
        text: "Clenched or holding tight — I notice when I check",
        score: "Tense",
      },
      { label: "B", text: "Soft, dropped, easy", score: "Relaxed" },
      { label: "C", text: "Hard to tell", score: "neutral" },
    ],
  },
  {
    id: 20,
    axis: "tone",
    question: "When you sit down to rest, can you actually rest?",
    options: [
      {
        label: "A",
        text: "My mind keeps moving even when my body stops",
        score: "Tense",
      },
      {
        label: "B",
        text: "I drop into stillness easily — sometimes too easily, I drift off",
        score: "Relaxed",
      },
      { label: "C", text: "Depends on the day", score: "neutral" },
    ],
  },
  {
    id: 21,
    axis: "tone",
    question:
      "Place your hand on your belly — as you breathe, does it...",
    options: [
      {
        label: "A",
        text: "Stay held tight, not much movement",
        score: "Tense",
      },
      {
        label: "B",
        text: "Drop and rise softly with each breath",
        score: "Relaxed",
      },
      { label: "C", text: "Hard to tell", score: "neutral" },
    ],
  },
];

/**
 * Filter follow-up questions to the axes that resolved Neutral after the
 * initial 12-question pass. Keeps the order from `followupQuestions` (so
 * the user moves through Temperature → Fluid → Tone in order, with
 * resolved axes skipped).
 */
export function getFollowupQuestionsForAxes(
  axes: ReadonlyArray<Axis>,
): FollowupQuestion[] {
  const set = new Set(axes);
  return followupQuestions.filter((q) => set.has(q.axis));
}
