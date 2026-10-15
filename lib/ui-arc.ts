import { DUSK, NOON } from "./ui-time";

/**
 * Geometry of one brand arch — a vertical left leg rising into a fuller-than-
 * elliptical quarter curve (a superellipse, n ≈ 2.4, fitted to brand/arches.png)
 * that falls to the right foot. The sun travels it with the day:
 * dawn at the left foot → noon at the top → dusk at the right foot → night past it.
 */

export interface ArcSample {
  x: number;
  y: number;
  /** Cumulative length along the arch (the night extension continues it). */
  s: number;
  day: number;
}

export interface ArcGeom {
  w: number;
  h: number;
  /** SVG path of the arch (origin = top-left of the arch box). */
  d: string;
  /** Path of the faint horizon the moon rests on past dusk. */
  horizon: string;
  legLength: number;
  curveLength: number;
  /** Arch length (leg + curve). */
  length: number;
  /** How far past the right foot the moon rests at full night. */
  ext: number;
  samples: ArcSample[];
}

const SUPER_N = 2.4;

export function buildArc(w: number, h: number, steps = 96): ArcGeom {
  const curve: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const phi = (i / steps) * (Math.PI / 2);
    const x = w * Math.pow(Math.sin(phi), 2 / SUPER_N);
    const dy = h * Math.pow(Math.cos(phi), 2 / SUPER_N);
    curve.push({ x, y: h - dy });
  }
  let curveLength = 0;
  const curveCum = [0];
  for (let i = 1; i < curve.length; i++) {
    curveLength += Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y);
    curveCum.push(curveLength);
  }
  const legLength = h;
  const length = legLength + curveLength;
  const ext = Math.max(10, w * 0.24);

  const samples: ArcSample[] = [];
  const legSteps = 36;
  for (let i = 0; i <= legSteps; i++) {
    const k = i / legSteps;
    samples.push({ x: 0, y: h - k * h, s: k * h, day: k * NOON });
  }
  for (let i = 1; i < curve.length; i++) {
    const k = curveCum[i] / curveLength;
    samples.push({ x: curve[i].x, y: curve[i].y, s: legLength + curveCum[i], day: NOON + k * (DUSK - NOON) });
  }
  const extSteps = 10;
  for (let i = 1; i <= extSteps; i++) {
    const k = i / extSteps;
    samples.push({ x: w + k * ext, y: h, s: length + k * ext, day: DUSK + k * (1 - DUSK) });
  }

  const f = (n: number) => n.toFixed(2);
  const d = `M0 ${f(h)} L0 0 ` + curve.slice(1).map((p) => `L${f(p.x)} ${f(p.y)}`).join(" ");
  const horizon = `M${f(-ext * 0.6)} ${f(h)} L${f(w + ext * 1.6)} ${f(h)}`;
  return { w, h, d, horizon, legLength, curveLength, length, ext, samples };
}

/** Length along the arch for a day value (clamped to the arch; the night extension is separate). */
export function arcLengthForDay(g: ArcGeom, day: number): number {
  if (day <= 0) return 0;
  if (day <= NOON) return (day / NOON) * g.legLength;
  if (day <= DUSK) return g.legLength + ((day - NOON) / (DUSK - NOON)) * g.curveLength;
  return g.length;
}

/** Position of the sun / moon for a day value. */
export function arcPointForDay(g: ArcGeom, day: number, out = { x: 0, y: 0 }) {
  const d = Math.max(0, Math.min(1, day));
  // Interpolate between the two samples that bracket this day value.
  const ss = g.samples;
  let lo = 0;
  let hi = ss.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ss[mid].day <= d) lo = mid;
    else hi = mid;
  }
  const a = ss[lo];
  const b = ss[hi];
  const k = b.day > a.day ? (d - a.day) / (b.day - a.day) : 0;
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  return out;
}

/** The day value of the arch point nearest to (x, y) in arch-box coordinates. */
export function dayForPoint(g: ArcGeom, x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  const ss = g.samples;
  for (let i = 0; i < ss.length; i++) {
    const dx = ss[i].x - x;
    const dy = ss[i].y - y;
    const dd = dx * dx + dy * dy;
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  }
  // Refine between neighbours for a continuous feel.
  const i = best;
  const p = ss[i];
  const n = ss[Math.min(ss.length - 1, i + 1)];
  const m = ss[Math.max(0, i - 1)];
  const proj = (a: ArcSample, b: ArcSample) => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy || 1;
    const k = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / len2));
    const px = a.x + vx * k;
    const py = a.y + vy * k;
    return { day: a.day + (b.day - a.day) * k, dist: (px - x) ** 2 + (py - y) ** 2 };
  };
  const c1 = proj(p, n);
  const c2 = proj(m, p);
  return c1.dist <= c2.dist ? c1.day : c2.day;
}
