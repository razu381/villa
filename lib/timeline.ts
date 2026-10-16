/**
 * The journey timeline — the single contract between scroll, DOM and 3D.
 *
 * `t` runs from 0 to CHAPTERS.length. The integer part is the chapter index,
 * the fraction is progress through that chapter's scroll section
 * (t = index + (scrollY - sectionTop) / sectionHeight).
 *
 * Everything that animates with the journey derives from `t` through the pure
 * functions below, so DOM, camera and shaders can never drift apart.
 */

export type ChapterId =
  | "hero"
  | "drawing"
  | "model"
  | "making"
  | "cars"
  | "homes"
  | "night";

export interface Chapter {
  id: ChapterId;
  /** Short name for the chapter index. */
  label: string;
  /** Wide-tracked lowercase eyebrow — time of day in words, never numbers. */
  time: string;
  /** Section height in viewport heights. */
  length: number;
  /** Day progress (0 = first light, 1 = night) at chapter start / end. */
  day: [number, number];
}

export const CHAPTERS: Chapter[] = [
  { id: "hero", label: "Arrival", time: "first light", length: 1.6, day: [0.0, 0.06] },
  { id: "drawing", label: "The drawing", time: "dawn", length: 2.6, day: [0.06, 0.18] },
  { id: "model", label: "The model", time: "morning", length: 2.6, day: [0.18, 0.34] },
  { id: "making", label: "The making", time: "late morning", length: 2.8, day: [0.34, 0.47] },
  { id: "cars", label: "Cars below", time: "noon", length: 3.2, day: [0.47, 0.57] },
  { id: "homes", label: "Two ways to live", time: "golden hour", length: 3.4, day: [0.57, 0.76] },
  { id: "night", label: "Invitation", time: "evening", length: 2.6, day: [0.76, 1.0] },
];

export const T_MAX = CHAPTERS.length;

export const chapterIndex = (id: ChapterId) => CHAPTERS.findIndex((c) => c.id === id);

/* ------------------------------------------------------------------ easing */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0 → 1 between a and b, with smoothstep easing. */
export const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** Linear 0 → 1 between a and b. */
export const ramp = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
/** Rises a→b, holds, falls c→d. */
export const bump = (a: number, b: number, c: number, d: number, x: number) =>
  smooth(a, b, x) * (1 - smooth(c, d, x));
/** Quartic ease-out — the house easing for large moves. */
export const easeOutQuart = (k: number) => 1 - Math.pow(1 - clamp01(k), 4);
export const easeInOutCubic = (k: number) => {
  k = clamp01(k);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};

/* ----------------------------------------------------------- day mapping */

/** Day progress for a journey position. Monotonic: the day only moves forward. */
export function dayFromT(t: number): number {
  const i = Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(t)));
  const local = clamp01(t - i);
  const [a, b] = CHAPTERS[i].day;
  return lerp(a, b, local);
}

/* ------------------------------------------------------------ build stages */

/**
 * Every animated stage of the experience, each 0 → 1, derived from `t`.
 * Ranges are in journey units (chapter index + local progress).
 */
export interface Stages {
  /** Hero film → 3D crossfade (0 = film fully visible, 1 = 3D only). */
  heroFade: number;
  /** Topographic contour lines drawing in on the terrain. */
  contours: number;
  /**
   * The stronghold's plan: the podium outline is drawn on the bare hill
   * (0 → ~0.45), then the podium rises out of it (~0.45 → 1, canvas/world/terrain/build.ts).
   */
  plan: number;
  /** Architect's line drawing of the houses (and paths, decks) tracing in on the risen podium. */
  lines: number;
  /** Houses rising from their plans as a white model (per-house delay applied by consumer). */
  rise: number;
  /** Model-maker's foam trees appearing. */
  foam: number;
  /** Material sweep — white model → cork, limestone, glass, planting. */
  material: number;
  /** Life — foliage colour + wind, water fills. */
  life: number;
  /** Section cut open amount (opens then closes inside the cars chapter). */
  section: number;
  /** Cars gliding down the ramp into the garage. */
  cars: number;
  /** Homes chapter focus (camera + explode allowed). */
  homes: number;
  /** Night amount for the night chapter (separate from day lighting). */
  night: number;
  /** Windows switching on (per-window stagger applied by consumer). */
  windows: number;
  /** Path lights switching on. */
  pathLights: number;
  /** Stars appearing. */
  stars: number;
}

/** Build stages at journey time t. Per-frame callers pass a scratch `out` (no allocation). */
export function stagesFromT(t: number, out: Stages = {} as Stages): Stages {
  out.heroFade = smooth(0.55, 1.05, t);
  // contours → podium outline → podium rises → house lines on the podium → houses rise
  out.contours = ramp(0.8, 1.38, t);
  out.plan = ramp(1.2, 1.74, t);
  out.lines = ramp(1.74, 2.16, t);
  out.rise = ramp(2.1, 2.76, t);
  out.foam = ramp(2.4, 2.96, t);
  out.material = ramp(2.95, 3.7, t);
  out.life = smooth(3.55, 4.05, t);
  out.section = bump(4.12, 4.42, 4.82, 5.02, t);
  out.cars = ramp(4.22, 4.85, t);
  out.homes = bump(5.0, 5.12, 5.92, 6.02, t);
  out.night = smooth(6.0, 6.4, t);
  out.windows = ramp(6.02, 6.5, t);
  out.pathLights = ramp(6.15, 6.55, t);
  out.stars = smooth(6.2, 6.65, t);
  return out;
}
