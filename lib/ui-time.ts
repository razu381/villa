import { CHAPTERS, stagesFromT } from "./timeline";
import type { JourneyState } from "./store";

/**
 * DOM-side reading of the journey: chapter, time words and the colour tone the
 * HTML layer should take over the scene (film / day / night).
 */

/** Day progress at which the sun reaches the top of the arch, and the right foot. */
export const NOON = 0.5;
export const DUSK = 0.82;

/** Frame-rate independent damping (same as canvas/Driver's, without pulling three into the DOM bundle). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export const chapterAt = (t: number) => Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(t)));

/** A time word for any day value (used while the sun is held). Never numbers. */
export function timeWordForDay(d: number): string {
  if (d < 0.06) return "first light";
  if (d < 0.18) return "dawn";
  if (d < 0.34) return "morning";
  if (d < 0.47) return "late morning";
  if (d < 0.57) return "noon";
  if (d < 0.66) return "afternoon";
  if (d < 0.8) return "golden hour";
  if (d < 0.9) return "dusk";
  return "night";
}

/** The word under the sun arc: the chapter's time while scrolling, the held sun's otherwise. */
export function timeWord(s: Pick<JourneyState, "t" | "sunOverride">): string {
  if (s.sunOverride != null) return timeWordForDay(s.sunOverride);
  return CHAPTERS[chapterAt(s.t)].time;
}

export type Tone = "film" | "day" | "night";

/**
 * film  — light type over the hero film / aerial still
 * day   — dark olive type over the limestone world
 * night — limestone type over the dark scene (night chapter, or the held sun past dusk)
 */
export function toneFor(s: Pick<JourneyState, "t" | "journeyDay" | "sunOverride">): Tone {
  if (stagesFromT(s.t).heroFade < 0.72) return "film";
  const day = s.sunOverride ?? s.journeyDay;
  if (day >= 0.8 || s.t >= 6) return "night";
  return "day";
}

/** Formats a yyyy-mm-dd input value as "Saturday, 14 November" (local date, no TZ drift). */
export function formatVisitDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

/** yyyy-mm-dd for a local date. */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
