/**
 * Interiors of the two featured homes, as an architect's model: thin plaster
 * partitions, furniture blocks in timber and linen tones, lamps, and the floor
 * plan as hairlines on each slab. Pure and deterministic.
 *
 * Coordinates are house-local (see canvas/world/houses/architecture.ts):
 * origin at the footprint centre on the pad, +X east, +Z south (garden).
 * Each level is built in that level's own frame (its group is lifted as a
 * whole in the exploded view), so pieces sit on the real floor heights.
 *
 * The rooms come from the house build (room cavities are found from the
 * interior-role faces), so the furniture always sits inside the walls.
 * Layouts are art-directed for the featured townhouse (V3) and villa (V4).
 */

import type { BufferGeometry } from "three";
import { LineCollector, ROLE, type Vec3 } from "@/canvas/world/houses/kit";
import type { HouseBuild } from "@/canvas/world/houses/architecture";
import type { HomeId } from "@/lib/store";
import { BlockBuilder, PoolBuilder, rgb } from "./geometry";

/* ------------------------------------------------------------------ tones */

const C = {
  plaster: rgb("#ECE6DA"),
  oak: rgb("#B48F68"),
  oakPale: rgb("#C6A983"),
  oakDark: rgb("#8A6A4D"),
  walnut: rgb("#6C5240"),
  linen: rgb("#E7DFD1"),
  linenWarm: rgb("#DCCFBB"),
  linenSheet: rgb("#F1EDE5"),
  throwCloth: rgb("#C2AE8F"),
  rug: rgb("#D3C5AC"),
  rugDeep: rgb("#C1B194"),
  stone: rgb("#DDD5C6"),
  stoneWhite: rgb("#EFEBE4"),
  bronze: rgb("#5D5444"),
  charcoal: rgb("#47433D"),
  sage: rgb("#9B9C7E"),
  leaf: rgb("#6E7650"),
  leafDeep: rgb("#59613F"),
  pot: rgb("#B49A7E"),
  water: rgb("#B9C4BF"),
  book1: rgb("#A88F70"),
  book2: rgb("#8E8574"),
  book3: rgb("#CDBFA5"),
  book4: rgb("#76664F"),
} as const;
type Col = [number, number, number];

/** Plan cut height above each finished floor (the exploded levels are cut here). */
export const CUT_ABOVE_FLOOR = 1.38;

export interface InteriorLevel {
  /** Partitions + furniture (vertex-coloured, cut by the level's plan plane). */
  furniture: BufferGeometry;
  /** Lamp shades and globes (glow at dusk; never cut). */
  lamps: BufferGeometry | null;
  /** Additive light pools under the lamps. */
  pools: BufferGeometry | null;
  /** The floor plan hairlines (room outlines, door swings, stair, lift). */
  plan: BufferGeometry;
  /** Local y of the plan cut (house-local, before the lift). */
  cutY: number;
  /** Finished floor height (house-local). */
  floorY: number;
}

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

type Side = "n" | "s" | "e" | "w";

/* ------------------------------------------------------------ the context */

class Level {
  f = new BlockBuilder();
  l = new BlockBuilder();
  p = new PoolBuilder();
  lines = new LineCollector();
  /** Running phase for the plan drawing (pen order). */
  private phase = 0;

  constructor(
    public F: number,
    public ceiling: number,
  ) {}

  private nextPhase(step = 0.035) {
    const p = this.phase;
    this.phase = Math.min(0.92, this.phase + step);
    return p;
  }

  /* ---- plan lines ---- */

  /** A room outline (polygon, closed) a hair above the floor. */
  room(pts: [number, number][], inset = 0) {
    const y = this.F + 0.012;
    const ph = this.nextPhase(0.06);
    const n = pts.length;
    // Inset an orthogonal polygon: each vertex moves along both adjacent edges' inward normals.
    let area = 0;
    for (let i = 0; i < n; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % n];
      area += ax * bz - bx * az;
    }
    const inward = (a: [number, number], b: [number, number]): [number, number] => {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      return area > 0 ? [-dz / l, dx / l] : [dz / l, -dx / l];
    };
    const q = pts.map((p, i) => {
      const np = inward(pts[(i + n - 1) % n], p);
      const nn = inward(p, pts[(i + 1) % n]);
      return [p[0] + (np[0] + nn[0]) * inset, p[1] + (np[1] + nn[1]) * inset] as [number, number];
    });
    this.lines.delay = 0;
    for (let i = 0; i < n; i++) {
      const a = q[i];
      const b = q[(i + 1) % n];
      this.lines.seg([a[0], y, a[1]], [b[0], y, b[1]], ph + (i / n) * 0.08, 0.16);
    }
  }

  rectRoom(r: Rect, inset = 0.14) {
    this.room(
      [
        [r.x0, r.z0],
        [r.x1, r.z0],
        [r.x1, r.z1],
        [r.x0, r.z1],
      ],
      inset,
    );
  }

  /** A door swing: leaf line + quarter arc, hinge at h, leaf towards `to`, opening towards `swing`. */
  door(h: [number, number], to: [number, number], swing: [number, number]) {
    const y = this.F + 0.014;
    const ph = this.nextPhase(0.02);
    const r = Math.hypot(to[0] - h[0], to[1] - h[1]);
    const ux = (to[0] - h[0]) / r;
    const uz = (to[1] - h[1]) / r;
    const vx = swing[0];
    const vz = swing[1];
    this.lines.delay = 0;
    this.lines.seg([h[0], y, h[1]], [h[0] + vx * r, y, h[1] + vz * r], ph, 0.1);
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * (Math.PI / 2);
      const a1 = ((i + 1) / N) * (Math.PI / 2);
      const p = (a: number): Vec3 => [h[0] + (ux * Math.cos(a) + vx * Math.sin(a)) * r, y, h[1] + (uz * Math.cos(a) + vz * Math.sin(a)) * r];
      this.lines.seg(p(a0), p(a1), ph + 0.04 + (i / N) * 0.06, 0.05);
    }
  }

  seg(a: [number, number], b: [number, number], dy = 0.012, dash = 0) {
    this.lines.delay = dash;
    this.lines.seg([a[0], this.F + dy, a[1]], [b[0], this.F + dy, b[1]], this.nextPhase(0.015), 0.14);
    this.lines.delay = 0;
  }

  /* ---- architecture ---- */

  /** A thin plaster partition, floor to ceiling (the plan cut shows it as poché). */
  wall(x0: number, z0: number, x1: number, z1: number, t = 0.1) {
    const hx = Math.abs(x1 - x0) < 1e-6 ? t / 2 : 0;
    const hz = Math.abs(z1 - z0) < 1e-6 ? t / 2 : 0;
    this.f.box(Math.min(x0, x1) - hx, this.F - 0.004, Math.min(z0, z1) - hz, Math.max(x0, x1) + hx, this.ceiling, Math.max(z0, z1) + hz, C.plaster);
  }

  /** A run of wall along x (at z) or z (at x) with door gaps [a, b]. */
  wallRun(axis: "x" | "z", at: number, from: number, to: number, gaps: [number, number][] = [], t = 0.1) {
    let a = from;
    const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
    for (const [g0, g1] of [...sorted, [to, to] as [number, number]]) {
      if (g0 - a > 0.05) {
        if (axis === "x") this.wall(a, at, g0, at, t);
        else this.wall(at, a, at, g0, t);
      }
      a = g1;
    }
  }

  /* ---- furniture vocabulary ---- */

  block(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: Col) {
    this.f.box(x0, this.F + y0, z0, x1, this.F + y1, z1, col);
  }

  rug(r: Rect, col: Col = C.rug) {
    this.block(r.x0, 0, r.z0, r.x1, 0.014, r.z1, col);
  }

  /** Sofa in rect r with its back on side `back`. */
  sofa(r: Rect, back: Side, col: Col = C.linenWarm) {
    const { x0, x1, z0, z1 } = r;
    const bd = 0.2;
    const aw = 0.18;
    this.block(x0, 0, z0, x1, 0.4, z1, col);
    const cushion: Col = [col[0] * 1.03, col[1] * 1.03, col[2] * 1.03];
    if (back === "n" || back === "s") {
      const zb0 = back === "n" ? z0 : z1 - bd;
      this.block(x0, 0.4, zb0, x1, 0.76, zb0 + bd, col);
      this.block(x0, 0.4, z0, x0 + aw, 0.6, z1, col);
      this.block(x1 - aw, 0.4, z0, x1, 0.6, z1, col);
      // Seat cushions (two), a hair proud.
      const zc0 = back === "n" ? z0 + bd : z0 + 0.04;
      const zc1 = back === "n" ? z1 - 0.04 : z1 - bd;
      const xm = (x0 + x1) / 2;
      this.block(x0 + aw + 0.01, 0.4, zc0, xm - 0.01, 0.47, zc1, cushion);
      this.block(xm + 0.01, 0.4, zc0, x1 - aw - 0.01, 0.47, zc1, cushion);
    } else {
      const xb0 = back === "w" ? x0 : x1 - bd;
      this.block(xb0, 0.4, z0, xb0 + bd, 0.76, z1, col);
      this.block(x0, 0.4, z0, x1, 0.6, z0 + aw, col);
      this.block(x0, 0.4, z1 - aw, x1, 0.6, z1, col);
      const xc0 = back === "w" ? x0 + bd : x0 + 0.04;
      const xc1 = back === "w" ? x1 - 0.04 : x1 - bd;
      const zm = (z0 + z1) / 2;
      this.block(xc0, 0.4, z0 + aw + 0.01, xc1, 0.47, zm - 0.01, cushion);
      this.block(xc0, 0.4, zm + 0.01, xc1, 0.47, z1 - aw - 0.01, cushion);
    }
  }

  /** Lounge chair centred (cx, cz), facing `face` (its back is opposite). */
  armchair(cx: number, cz: number, face: Side, col: Col = C.linen, s = 0.8) {
    const h = s / 2;
    const back: Side = face === "n" ? "s" : face === "s" ? "n" : face === "e" ? "w" : "e";
    this.sofa({ x0: cx - h, x1: cx + h, z0: cz - h, z1: cz + h }, back, col);
  }

  /** Table top on two slab legs; long axis = the longer side of r. */
  table(r: Rect, h = 0.75, top: Col = C.oak, legs: Col = C.oakDark) {
    const { x0, x1, z0, z1 } = r;
    this.block(x0, h - 0.045, z0, x1, h, z1, top);
    const alongX = x1 - x0 >= z1 - z0;
    const inset = 0.22;
    if (alongX) {
      this.block(x0 + inset, 0, z0 + 0.12, x0 + inset + 0.06, h - 0.045, z1 - 0.12, legs);
      this.block(x1 - inset - 0.06, 0, z0 + 0.12, x1 - inset, h - 0.045, z1 - 0.12, legs);
    } else {
      this.block(x0 + 0.12, 0, z0 + inset, x1 - 0.12, h - 0.045, z0 + inset + 0.06, legs);
      this.block(x0 + 0.12, 0, z1 - inset - 0.06, x1 - 0.12, h - 0.045, z1 - inset, legs);
    }
  }

  roundTable(cx: number, cz: number, r: number, h: number, col: Col = C.oak) {
    this.f.cyl(cx, this.F, cz, r * 0.35, h - 0.04, C.oakDark, 14);
    this.f.cyl(cx, this.F + h - 0.04, cz, r, 0.04, col, 28, true);
  }

  /** Dining chair centred (cx, cz), facing `face`. */
  chair(cx: number, cz: number, face: Side, col: Col = C.oak, seat: Col = C.linenWarm) {
    const w = 0.22;
    this.block(cx - w, 0.41, cz - w, cx + w, 0.46, cz + w, seat);
    const l = 0.035;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const px = cx + sx * (w - 0.03);
      const pz = cz + sz * (w - 0.03);
      this.block(px - l / 2, 0, pz - l / 2, px + l / 2, 0.41, pz + l / 2, col);
    }
    const t = 0.045;
    if (face === "s") this.block(cx - w, 0.46, cz - w, cx + w, 0.86, cz - w + t, col);
    if (face === "n") this.block(cx - w, 0.46, cz + w - t, cx + w, 0.86, cz + w, col);
    if (face === "e") this.block(cx - w, 0.46, cz - w, cx - w + t, 0.86, cz + w, col);
    if (face === "w") this.block(cx + w - t, 0.46, cz - w, cx + w, 0.86, cz + w, col);
  }

  stool(cx: number, cz: number) {
    this.f.cyl(cx, this.F, cz, 0.035, 0.62, C.bronze, 8);
    this.f.cyl(cx, this.F + 0.62, cz, 0.18, 0.05, C.oak, 20, true);
    this.f.cyl(cx, this.F, cz, 0.16, 0.012, C.bronze, 16);
  }

  /** Bed with its head on side `head`: oak frame, mattress, duvet, pillows, headboard. */
  bed(r: Rect, head: Side, duvet: Col = C.linenSheet, throwCol: Col = C.throwCloth) {
    const { x0, x1, z0, z1 } = r;
    this.block(x0, 0, z0, x1, 0.3, z1, C.oak);
    const m = 0.04;
    const alongZ = head === "n" || head === "s";
    // Mattress + duvet (covers the foot two-thirds) + a folded throw + pillows.
    this.block(x0 + m, 0.3, z0 + m, x1 - m, 0.5, z1 - m, C.linen);
    const L = alongZ ? z1 - z0 : x1 - x0;
    const sgn = head === "n" || head === "w" ? 1 : -1;
    const hEnd = head === "n" ? z0 : head === "s" ? z1 : head === "w" ? x0 : x1;
    const span = (a: number, b: number): [number, number] => {
      const p = hEnd + sgn * a;
      const q = hEnd + sgn * b;
      return [Math.min(p, q), Math.max(p, q)];
    };
    const [d0, d1] = span(L * 0.3, L - 0.02);
    const [t0, t1] = span(L * 0.72, L * 0.86);
    const [p0, p1] = span(0.14, 0.52);
    const [hb0, hb1] = span(-0.02, 0.07);
    if (alongZ) {
      this.block(x0 + 0.01, 0.5, d0, x1 - 0.01, 0.56, d1, duvet);
      this.block(x0 - 0.005, 0.56, t0, x1 + 0.005, 0.585, t1, throwCol);
      const xm = (x0 + x1) / 2;
      this.block(x0 + 0.12, 0.5, p0, xm - 0.04, 0.64, p1, C.linenSheet);
      this.block(xm + 0.04, 0.5, p0, x1 - 0.12, 0.64, p1, C.linenSheet);
      this.block(x0 - 0.06, 0, hb0, x1 + 0.06, 1.05, hb1, C.oakPale);
    } else {
      this.block(d0, 0.5, z0 + 0.01, d1, 0.56, z1 - 0.01, duvet);
      this.block(t0, 0.56, z0 - 0.005, t1, 0.585, z1 + 0.005, throwCol);
      const zm = (z0 + z1) / 2;
      this.block(p0, 0.5, z0 + 0.12, p1, 0.64, zm - 0.04, C.linenSheet);
      this.block(p0, 0.5, zm + 0.04, p1, 0.64, z1 - 0.12, C.linenSheet);
      this.block(hb0, 0, z0 - 0.06, hb1, 1.05, z1 + 0.06, C.oakPale);
    }
  }

  /** Bedside table with a table lamp (glows at dusk). */
  nightstand(cx: number, cz: number, lamp = true) {
    this.block(cx - 0.22, 0, cz - 0.2, cx + 0.22, 0.5, cz + 0.2, C.oakDark);
    if (lamp) this.tableLamp(cx, cz, 0.5);
  }

  tableLamp(cx: number, cz: number, top: number, k = 1) {
    this.f.cyl(cx, this.F + top, cz, 0.05, 0.2, C.bronze, 10);
    this.l.cyl(cx, this.F + top + 0.18, cz, 0.13, 0.17, C.linen, 18, true, 0.1);
    this.p.add(cx, this.F + top + 0.004, cz, 0.42, 0.42, 0.9 * k);
    this.p.add(cx, this.F + 0.02, cz, 1.25, 1.25, 0.55 * k);
  }

  floorLamp(cx: number, cz: number, k = 1) {
    this.f.cyl(cx, this.F, cz, 0.15, 0.025, C.bronze, 16);
    this.f.cyl(cx, this.F, cz, 0.014, 1.06, C.bronze, 6);
    this.l.cyl(cx, this.F + 1.04, cz, 0.21, 0.27, C.linen, 20, true, 0.16);
    this.p.add(cx, this.F + 0.02, cz, 1.9, 1.9, 0.8 * k);
  }

  /** A glowing globe hanging over a table (floats free of the cut ceiling). */
  pendant(cx: number, cz: number, y: number, r = 0.14, tableTop = 0.75, k = 1) {
    this.l.sphere(cx, this.F + y, cz, r, C.linen, 18, 12);
    this.p.add(cx, this.F + tableTop + 0.004, cz, 0.85, 0.85, 0.75 * k);
    this.p.add(cx, this.F + 0.02, cz, 2.0, 2.0, 0.42 * k);
  }

  island(r: Rect, overhangSide: Side) {
    const { x0, x1, z0, z1 } = r;
    const o = 0.28;
    this.block(x0, 0, z0, x1, 0.88, z1, C.bronze);
    const t = {
      x0: x0 - 0.03 - (overhangSide === "w" ? o : 0),
      x1: x1 + 0.03 + (overhangSide === "e" ? o : 0),
      z0: z0 - 0.03 - (overhangSide === "n" ? o : 0),
      z1: z1 + 0.03 + (overhangSide === "s" ? o : 0),
    };
    this.block(t.x0, 0.88, t.z0, t.x1, 0.92, t.z1, C.stone);
  }

  /** Kitchen run against a wall (back on side `back`), with a sink inset. */
  counter(r: Rect, sinkAt?: number) {
    const { x0, x1, z0, z1 } = r;
    this.block(x0, 0, z0, x1, 0.86, z1, C.oakPale);
    this.block(x0 - 0.01, 0.86, z0 - 0.01, x1 + 0.01, 0.9, z1 + 0.01, C.stone);
    if (sinkAt != null) {
      const alongX = x1 - x0 > z1 - z0;
      if (alongX) this.block(sinkAt - 0.32, 0.9, (z0 + z1) / 2 - 0.2, sinkAt + 0.32, 0.903, (z0 + z1) / 2 + 0.2, C.charcoal);
      else this.block((x0 + x1) / 2 - 0.2, 0.9, sinkAt - 0.32, (x0 + x1) / 2 + 0.2, 0.903, sinkAt + 0.32, C.charcoal);
    }
  }

  /** Tall joinery (wardrobe / pantry) — cut by the plan plane. */
  tall(r: Rect, col: Col = C.oakPale) {
    this.block(r.x0, 0, r.z0, r.x1, 2.3, r.z1, col);
  }

  /** Credenza / console. */
  low(r: Rect, h = 0.62, col: Col = C.oak) {
    this.block(r.x0, 0, r.z0, r.x1, h, r.z1, col);
  }

  bath(r: Rect) {
    const { x0, x1, z0, z1 } = r;
    const t = 0.09;
    const h = 0.56;
    this.block(x0, 0, z0, x1, 0.12, z1, C.stoneWhite);
    this.block(x0, 0.12, z0, x1, h, z0 + t, C.stoneWhite);
    this.block(x0, 0.12, z1 - t, x1, h, z1, C.stoneWhite);
    this.block(x0, 0.12, z0 + t, x0 + t, h, z1 - t, C.stoneWhite);
    this.block(x1 - t, 0.12, z0 + t, x1, h, z1 - t, C.stoneWhite);
    this.block(x0 + t, 0.12, z0 + t, x1 - t, 0.38, z1 - t, C.water);
  }

  vanity(r: Rect, basins: number[]) {
    const { x0, x1, z0, z1 } = r;
    this.block(x0, 0.15, z0, x1, 0.82, z1, C.oak);
    this.block(x0 - 0.01, 0.82, z0 - 0.01, x1 + 0.01, 0.86, z1 + 0.01, C.stone);
    const alongX = x1 - x0 > z1 - z0;
    for (const b of basins) {
      if (alongX) this.block(b - 0.22, 0.86, (z0 + z1) / 2 - 0.16, b + 0.22, 0.98, (z0 + z1) / 2 + 0.16, C.stoneWhite);
      else this.block((x0 + x1) / 2 - 0.16, 0.86, b - 0.22, (x0 + x1) / 2 + 0.16, 0.98, b + 0.22, C.stoneWhite);
    }
  }

  /** Desk with two slab legs, a task chair and a lamp. */
  desk(r: Rect, chairAt: [number, number], chairFace: Side, lampAt: [number, number], top: Col = C.walnut) {
    this.table(r, 0.74, top, top);
    this.chair(chairAt[0], chairAt[1], chairFace, C.charcoal, C.linenWarm);
    this.tableLamp(lampAt[0], lampAt[1], 0.74, 0.8);
  }

  /** Open shelving (low), books on each shelf. */
  shelf(r: Rect, h = 1.15, seed = 1) {
    const { x0, x1, z0, z1 } = r;
    const alongX = x1 - x0 > z1 - z0;
    const t = 0.03;
    const len = alongX ? x1 - x0 : z1 - z0;
    // Carcass: back, ends, shelves.
    if (alongX) {
      const back = z0 < 0 ? z0 : z1 - t; // back against the wall side nearest |z| max
      this.block(x0, 0, back, x1, h, back + t, C.oakPale);
    } else {
      const back = x0 < 0 ? x0 : x1 - t;
      this.block(back, 0, z0, back + t, h, z1, C.oakPale);
    }
    const shelves = [0, 0.37, 0.74, h - t];
    for (const y of shelves) this.block(x0, y, z0, x1, y + t, z1, C.oakPale);
    const ends = Math.max(2, Math.round(len / 0.9) + 1);
    for (let i = 0; i < ends; i++) {
      const a = (alongX ? x0 : z0) + (i / (ends - 1)) * (len - t);
      if (alongX) this.block(a, 0, z0, a + t, h, z1, C.oakPale);
      else this.block(x0, 0, a, x1, h, a + t, C.oakPale);
    }
    // Books: little runs of spines, gaps, the odd leaning stack.
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const tones = [C.book1, C.book2, C.book3, C.book4, C.linenWarm];
    for (let k = 0; k < shelves.length - 1; k++) {
      const yb = shelves[k] + t;
      let a = (alongX ? x0 : z0) + 0.06;
      const end = (alongX ? x1 : z1) - 0.06;
      while (a < end - 0.1) {
        if (rnd() < 0.22) {
          a += 0.15 + rnd() * 0.25;
          continue;
        }
        const run = Math.min(end - a, 0.12 + rnd() * 0.35);
        const hb = 0.19 + rnd() * 0.1;
        const col = tones[Math.floor(rnd() * tones.length)];
        const d0 = alongX ? z0 + 0.06 : x0 + 0.06;
        const d1 = alongX ? z1 - 0.04 : x1 - 0.04;
        if (alongX) this.block(a, yb, d0, a + run, yb + hb, d1, col);
        else this.block(d0, yb, a, d1, yb + hb, a + run, col);
        a += run + 0.015;
      }
    }
  }

  plant(cx: number, cz: number, s = 1) {
    this.f.cyl(cx, this.F, cz, 0.2 * s, 0.38 * s, C.pot, 16, false, 0.17 * s);
    this.f.sphere(cx, this.F + 0.38 * s + 0.36 * s, cz, 0.34 * s, C.leaf, 12, 8, 1.15);
    this.f.sphere(cx + 0.14 * s, this.F + 0.38 * s + 0.62 * s, cz - 0.08 * s, 0.22 * s, C.leafDeep, 10, 7);
  }

  /** A straight stair run of steps rising along +dir from (x0..x1) at z = zStart, up to the cut. */
  stairZ(x0: number, x1: number, zStart: number, dir: 1 | -1, rise: number, run: number, cutAbove: number) {
    let i = 0;
    for (; i < 30; i++) {
      const top = (i + 1) * rise;
      const za = zStart + dir * i * run;
      const zb = zStart + dir * (i + 1) * run;
      this.block(x0, 0, Math.min(za, zb), x1, top, Math.max(za, zb), C.oak);
      if (top > cutAbove) break;
    }
    // Plan: walking line with an arrow, and the break line where the cut crosses.
    const xm = (x0 + x1) / 2;
    const zEnd = zStart + dir * (i + 0.5) * run;
    const y = rise * 0.5 + 0.02;
    this.seg([xm, zStart + dir * 0.12], [xm, zEnd], y + 0.0, 0);
    this.seg([xm, zEnd], [xm - 0.12, zEnd - dir * 0.22], y, 0);
    this.seg([xm, zEnd], [xm + 0.12, zEnd - dir * 0.22], y, 0);
  }

  /** The lift shaft symbol (rectangle + diagonals) drawn at the cut. */
  liftSymbol(r: Rect, y: number) {
    const ph = this.nextPhase(0.04);
    const yy = y - this.F;
    const s = (a: [number, number], b: [number, number], k: number) => this.lines.seg([a[0], this.F + yy, a[1]], [b[0], this.F + yy, b[1]], ph + k, 0.12);
    this.lines.delay = 0;
    s([r.x0, r.z0], [r.x1, r.z0], 0);
    s([r.x1, r.z0], [r.x1, r.z1], 0.02);
    s([r.x1, r.z1], [r.x0, r.z1], 0.04);
    s([r.x0, r.z1], [r.x0, r.z0], 0.06);
    s([r.x0, r.z0], [r.x1, r.z1], 0.1);
    s([r.x1, r.z0], [r.x0, r.z1], 0.12);
  }

  /** Mirror everything across x = 0 (positions, normals, winding, lines). */
  mirrorX() {
    for (const b of [this.f, this.l]) {
      for (let i = 0; i < b.pos.length; i += 3) {
        b.pos[i] = -b.pos[i];
        b.nor[i] = -b.nor[i];
      }
      for (let i = 0; i < b.idx.length; i += 3) {
        const t = b.idx[i + 1];
        b.idx[i + 1] = b.idx[i + 2];
        b.idx[i + 2] = t;
      }
    }
    for (let i = 0; i < this.p.pos.length; i += 3) this.p.pos[i] = -this.p.pos[i];
    for (let i = 0; i < this.lines.pos.length; i += 3) this.lines.pos[i] = -this.lines.pos[i];
  }

  build(cutY: number): InteriorLevel {
    return {
      furniture: this.f.build(),
      lamps: this.l.isEmpty() ? null : this.l.build(),
      pools: this.p.isEmpty() ? null : this.p.build(),
      plan: this.lines.build(),
      cutY,
      floorY: this.F,
    };
  }
}

/* ------------------------------------------------------- rooms from build */

interface RoomScan {
  /** Bounding box of the interior faces of a level (the room cavity). */
  room: Rect & { y0: number; y1: number };
  /** Interior partitions found inside it (centre x, z extent). */
  partitions: { x: number; z0: number; z1: number }[];
}

/** Find a level's room cavity and the builder's own partitions from the interior-role faces. */
function scanLevel(build: HouseBuild, level: 0 | 1): RoomScan | null {
  const part = build.parts.find((p) => p.level === level && p.material === "limestone");
  if (!part) return null;
  const pos = part.geometry.getAttribute("position");
  const nor = part.geometry.getAttribute("normal");
  const win = part.geometry.getAttribute("aWin");
  const r = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, y0: 1e9, y1: -1e9 };
  const faces = new Map<string, { x: number; z0: number; z1: number }>();
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(win.getY(i) - ROLE.interior) > 0.5) continue;
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    r.x0 = Math.min(r.x0, x);
    r.x1 = Math.max(r.x1, x);
    r.z0 = Math.min(r.z0, z);
    r.z1 = Math.max(r.z1, z);
    r.y0 = Math.min(r.y0, y);
    r.y1 = Math.max(r.y1, y);
    if (Math.abs(nor.getX(i)) > 0.9) {
      const k = x.toFixed(3);
      const e = faces.get(k) ?? { x, z0: 1e9, z1: -1e9 };
      e.z0 = Math.min(e.z0, z);
      e.z1 = Math.max(e.z1, z);
      faces.set(k, e);
    }
  }
  if (r.x0 > r.x1) return null;
  // Partition faces: x-facing interior faces strictly inside the room, in pairs ~0.12 apart.
  const inner = [...faces.values()].filter((f) => f.x > r.x0 + 0.05 && f.x < r.x1 - 0.05).sort((a, b) => a.x - b.x);
  const partitions: RoomScan["partitions"] = [];
  for (let i = 0; i + 1 < inner.length; i += 2) {
    const a = inner[i];
    const b = inner[i + 1];
    if (b.x - a.x < 0.3) partitions.push({ x: (a.x + b.x) / 2, z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) });
  }
  return { room: r, partitions };
}

/* ------------------------------------------------------------ V3 townhouse */

function townhouse(build: HouseBuild): InteriorLevel[] {
  const out: InteriorLevel[] = [];
  for (const lv of [0, 1] as const) {
    const scan = scanLevel(build, lv);
    if (!scan) continue;
    const R = scan.room;
    // The builder's partition runs from the north wall; the layouts are drawn
    // with it on the west and mirrored when it sits east of the centre.
    const found = scan.partitions[0];
    const mirror = found ? found.x > 0 : false;
    const px = found ? (mirror ? -found.x : found.x) : R.x0 + 2.1;
    const pz1 = found ? found.z1 : R.z0 + 0.55 * (R.z1 - R.z0);
    const [x0, x1] = mirror ? [-R.x1, -R.x0] : [R.x0, R.x1];
    const r: Rect = { x0, x1, z0: R.z0, z1: R.z1 };
    const L = new Level(R.y0, R.y1);
    const cut = R.y0 + CUT_ABOVE_FLOOR;
    if (!found) L.wallRun("z", px, r.z0, pz1);
    if (lv === 0) townhouseGround(L, r, px, pz1);
    else townhouseUpper(L, r, px, pz1);
    if (mirror) L.mirrorX();
    out.push(L.build(cut));
  }
  return out;
}

function townhouseGround(L: Level, r: Rect, px: number, pz1: number) {
  const hx1 = px - 0.06; // hall strip east face
  const ex0 = px + 0.06; // kitchen west face
  // Plan: the hall, and the L of kitchen / dining / living.
  L.room(
    [
      [r.x0, r.z0],
      [hx1, r.z0],
      [hx1, pz1],
      [r.x0, pz1],
    ],
    0.14,
  );
  L.room(
    [
      [ex0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
      [r.x0, pz1 + 0.06],
      [ex0, pz1 + 0.06],
    ],
    0.14,
  );

  // Hall: the stair along the partition, a console along the wall.
  L.stairZ(hx1 - 1.0, hx1 - 0.01, r.z0 + 1.32, 1, 0.18, 0.27, CUT_ABOVE_FLOOR);
  L.low({ x0: r.x0, x1: r.x0 + 0.36, z0: pz1 - 2.0, z1: pz1 - 0.5 }, 0.8, C.oak);
  L.plant(r.x0 + 0.3, pz1 - 0.25, 0.75);

  // Kitchen: a run under the north window, a tall pantry, the island and stools.
  L.tall({ x0: ex0 + 0.02, x1: ex0 + 0.66, z0: r.z0, z1: r.z0 + 0.62 }, C.oakPale);
  L.counter({ x0: ex0 + 0.68, x1: r.x1, z0: r.z0, z1: r.z0 + 0.62 }, (ex0 + r.x1) / 2 + 0.75);
  const isl: Rect = { x0: ex0 + 0.95, x1: r.x1 - 0.75, z0: r.z0 + 1.5, z1: r.z0 + 2.35 };
  L.island(isl, "s");
  const sz = isl.z1 + 0.38;
  const n = 3;
  for (let i = 0; i < n; i++) L.stool(isl.x0 + ((i + 0.5) / n) * (isl.x1 - isl.x0), sz);
  L.pendant(isl.x0 + (isl.x1 - isl.x0) * 0.28, (isl.z0 + isl.z1) / 2, 1.62, 0.11, 0.92, 0.7);
  L.pendant(isl.x0 + (isl.x1 - isl.x0) * 0.72, (isl.z0 + isl.z1) / 2, 1.62, 0.11, 0.92, 0.7);

  // Dining by the garden glazing (east), table along z.
  const dcx = r.x1 - 1.38;
  const dcz = r.z1 - 1.72;
  const tb: Rect = { x0: dcx - 0.46, x1: dcx + 0.46, z0: dcz - 0.9, z1: dcz + 0.9 };
  L.table(tb, 0.75, C.oak, C.oakDark);
  for (const dz of [-0.58, 0, 0.58]) {
    L.chair(tb.x0 - 0.3, dcz + dz, "e");
    L.chair(tb.x1 + 0.3, dcz + dz, "w");
  }
  L.pendant(dcx, dcz - 0.4, 1.5, 0.15, 0.75, 0.9);
  L.pendant(dcx, dcz + 0.4, 1.5, 0.15, 0.75, 0.9);

  // Living (west of the dining): sofa facing the garden, round table, chair, rug, lamp.
  const lx1 = tb.x0 - 0.75;
  const rugR: Rect = { x0: r.x0 + 0.25, x1: lx1 + 0.1, z0: pz1 + 0.75, z1: r.z1 - 0.12 };
  L.rug(rugR);
  L.sofa({ x0: r.x0 + 0.28, x1: r.x0 + 2.68, z0: pz1 + 0.62, z1: pz1 + 1.52 }, "n");
  L.roundTable(r.x0 + 1.48, pz1 + 2.3, 0.42, 0.34, C.oakPale);
  L.armchair(lx1 - 0.3, pz1 + 2.25, "w", C.sage, 0.74);
  L.floorLamp(r.x0 + 0.3, pz1 + 0.4, 1);
  L.plant(lx1 - 0.25, r.z1 - 0.3, 0.8);
}

function townhouseUpper(L: Level, r: Rect, px: number, pz1: number) {
  const sx1 = px - 0.06;
  const ex0 = px + 0.06;
  const wz = pz1 + 0.05; // new east-west wall (bedroom 2 | master)
  const bz = r.z0 + 2.45; // bath | dressing
  // Partitions: master/bed 2 wall with doors; en-suite split.
  L.wallRun("x", wz, r.x0, r.x1, [
    [sx1 - 0.95, sx1 + 0.002],
    [ex0 - 0.002, ex0 + 0.95],
  ]);
  L.wallRun("x", bz, r.x0, sx1 + 0.002, [[r.x0 + 1.05, r.x0 + 1.9]]);

  // Plan: four rooms + door swings.
  L.rectRoom({ x0: r.x0, x1: sx1, z0: r.z0, z1: bz - 0.05 });
  L.rectRoom({ x0: r.x0, x1: sx1, z0: bz + 0.05, z1: wz - 0.05 });
  L.rectRoom({ x0: ex0, x1: r.x1, z0: r.z0, z1: wz - 0.05 });
  L.rectRoom({ x0: r.x0, x1: r.x1, z0: wz + 0.05, z1: r.z1 });
  L.door([ex0 + 0.95, wz + 0.05], [ex0 + 0.05, wz + 0.05], [0, 1]);
  L.door([sx1 - 0.95, wz + 0.05], [sx1 - 0.05, wz + 0.05], [0, 1]);
  L.door([r.x0 + 1.9, bz + 0.05], [r.x0 + 1.05, bz + 0.05], [0, 1]);

  // En-suite (north of the strip): bath against the wall, vanity on the partition.
  L.bath({ x0: r.x0 + 0.02, x1: r.x0 + 0.78, z0: r.z0 + 0.05, z1: r.z0 + 1.75 });
  L.vanity({ x0: sx1 - 0.52, x1: sx1 - 0.005, z0: r.z0 + 0.35, z1: r.z0 + 1.75 }, [r.z0 + 1.05]);
  // Dressing: wardrobe along the outer wall.
  L.tall({ x0: r.x0 + 0.005, x1: r.x0 + 0.6, z0: bz + 0.12, z1: wz - 0.12 }, C.oakPale);

  // Bedroom 2: bed against the new wall, desk under the north window, wardrobe.
  const b2: Rect = { x0: ex0 + 1.45, x1: ex0 + 2.95, z0: wz - 0.05 - 2.0, z1: wz - 0.05 };
  L.bed(b2, "s", C.linenSheet, C.sage);
  L.nightstand(b2.x0 - 0.28, b2.z1 - 0.25);
  L.nightstand(Math.min(b2.x1 + 0.28, r.x1 - 0.23), b2.z1 - 0.25, false);
  L.rug({ x0: b2.x0 - 0.5, x1: r.x1 - 0.12, z0: b2.z0 - 0.45, z1: b2.z0 + 1.4 }, C.rugDeep);
  L.desk({ x0: ex0 + 0.12, x1: ex0 + 1.62, z0: r.z0 + 0.005, z1: r.z0 + 0.6 }, [ex0 + 0.85, r.z0 + 0.95], "n", [ex0 + 0.35, r.z0 + 0.25]);
  L.tall({ x0: r.x1 - 0.6, x1: r.x1 - 0.005, z0: r.z0 + 1.0, z1: r.z0 + 2.6 }, C.oakPale);

  // Master (south, the full width): king bed against the wall, bench, chair, rug.
  const xm = (ex0 + r.x1) / 2 - 0.35;
  const mb: Rect = { x0: xm - 0.9, x1: xm + 0.9, z0: wz + 0.05, z1: wz + 2.15 };
  L.rug({ x0: mb.x0 - 0.6, x1: mb.x1 + 0.6, z0: mb.z0 + 0.6, z1: Math.min(r.z1 - 0.3, mb.z1 + 1.0) });
  L.bed(mb, "n");
  L.nightstand(mb.x0 - 0.3, mb.z0 + 0.25);
  L.nightstand(mb.x1 + 0.3, mb.z0 + 0.25);
  L.block(mb.x0 + 0.2, 0, mb.z1 + 0.14, mb.x1 - 0.2, 0.44, mb.z1 + 0.54, C.linenWarm);
  L.armchair(r.x0 + 0.85, r.z1 - 0.95, "e", C.linen, 0.78);
  L.roundTable(r.x0 + 0.85, r.z1 - 0.2 - 1.5, 0.22, 0.5, C.oakDark);
  L.floorLamp(r.x0 + 0.35, r.z1 - 0.35, 0.9);
  L.plant(r.x1 - 0.35, r.z1 - 0.35, 0.85);
}

/* ---------------------------------------------------------------- V4 villa */

function villa(build: HouseBuild): InteriorLevel[] {
  const spec = build.spec;
  const mirror = spec.upperShift < 0;
  const s0 = scanLevel(build, 0);
  const s1 = scanLevel(build, 1);
  const out: InteriorLevel[] = [];
  // Rooms of the villa (see villa() in architecture.ts), east-handed frame.
  const hw = spec.width / 2;
  const hd = spec.depth / 2;
  const W = 0.45;
  const bar: Rect = { x0: -hw + W, x1: hw - W, z0: -hd + W, z1: 0.6 - W };
  const wing: Rect = { x0: 2.3 + W, x1: hw - W, z0: 0.6 + W, z1: hd - W };
  const s = Math.abs(spec.upperShift);
  const up: Rect = { x0: -hw - 1.2 + W, x1: 3.7 - W, z0: -5.6 + W, z1: 2.6 + 0.4 * s - W };
  const core: Rect = { x0: 3.6, x1: 5.8, z0: -hd - 0.3, z1: -3.9 };
  const F0 = s0?.room.y0 ?? 0.06;
  const C0 = s0?.room.y1 ?? spec.floors[0] - 0.32;
  const F1 = s1?.room.y0 ?? spec.floors[0] + 0.14;
  const C1 = s1?.room.y1 ?? spec.floors[0] + spec.floors[1] - 0.38;

  {
    const L = new Level(F0, C0);
    villaGround(L, bar, wing, core);
    if (mirror) L.mirrorX();
    out.push(L.build(F0 + CUT_ABOVE_FLOOR));
  }
  {
    const L = new Level(F1, C1);
    villaUpper(L, up, core, spec.floors[0] + 0.1, hw, hd);
    if (mirror) L.mirrorX();
    out.push(L.build(F1 + CUT_ABOVE_FLOOR));
  }
  return out;
}

function villaGround(L: Level, bar: Rect, wing: Rect, core: Rect) {
  // Plan: the long living space (around the lift core), the study in the wing.
  L.room(
    [
      [bar.x0, bar.z0],
      [core.x0, bar.z0],
      [core.x0, core.z1],
      [core.x1, core.z1],
      [core.x1, bar.z0],
      [bar.x1, bar.z0],
      [bar.x1, bar.z1],
      [bar.x0, bar.z1],
    ],
    0.14,
  );
  L.rectRoom(wing);
  L.liftSymbol({ x0: core.x0 + 0.25, x1: core.x1 - 0.25, z0: Math.max(core.z0, bar.z0 - 0.4) + 0.25, z1: core.z1 - 0.25 }, L.F + CUT_ABOVE_FLOOR + 0.01);

  // Living (west): rug, sofa facing the pool terrace, coffee table, two chairs.
  L.rug({ x0: bar.x0 + 0.4, x1: bar.x0 + 4.3, z0: bar.z0 + 1.55, z1: bar.z1 - 0.5 });
  L.sofa({ x0: bar.x0 + 0.75, x1: bar.x0 + 3.65, z0: bar.z0 + 1.75, z1: bar.z0 + 2.7 }, "n");
  L.table({ x0: bar.x0 + 1.6, x1: bar.x0 + 2.8, z0: bar.z0 + 3.15, z1: bar.z0 + 3.95 }, 0.34, C.walnut, C.walnut);
  L.armchair(bar.x0 + 0.5, bar.z0 + 3.55, "e", C.sage, 0.78);
  L.armchair(bar.x0 + 3.95, bar.z0 + 3.55, "w", C.linen, 0.78);
  L.floorLamp(bar.x0 + 0.32, bar.z0 + 1.95, 1);
  L.low({ x0: bar.x0 + 2.0, x1: bar.x0 + 4.95, z0: bar.z0 + 0.005, z1: bar.z0 + 0.45 }, 0.6, C.oak);
  L.plant(bar.x0 + 0.35, bar.z1 - 0.35, 0.95);

  // Dining (middle, by the glazing): eight chairs, two globes.
  const dc = { x: -0.5, z: (bar.z0 + bar.z1) / 2 + 0.55 };
  const tb: Rect = { x0: dc.x - 1.3, x1: dc.x + 1.3, z0: dc.z - 0.5, z1: dc.z + 0.5 };
  L.table(tb, 0.75, C.oak, C.oakDark);
  for (const dx of [-0.8, 0, 0.8]) {
    L.chair(dc.x + dx, tb.z0 - 0.3, "s");
    L.chair(dc.x + dx, tb.z1 + 0.3, "n");
  }
  L.chair(tb.x0 - 0.3, dc.z, "e");
  L.chair(tb.x1 + 0.3, dc.z, "w");
  L.pendant(dc.x - 0.65, dc.z, 1.55, 0.16, 0.75, 0.9);
  L.pendant(dc.x + 0.65, dc.z, 1.55, 0.16, 0.75, 0.9);

  // Kitchen (east): island with stools, a run along the east wall, tall units on the core.
  const isl: Rect = { x0: core.x0 - 1.0, x1: core.x1 - 0.4, z0: core.z1 + 1.45, z1: core.z1 + 2.4 };
  L.island(isl, "s");
  for (let i = 0; i < 3; i++) L.stool(isl.x0 + ((i + 0.5) / 3) * (isl.x1 - isl.x0), isl.z1 + 0.62);
  L.pendant(isl.x0 + 0.8, (isl.z0 + isl.z1) / 2, 1.62, 0.11, 0.92, 0.7);
  L.pendant(isl.x1 - 0.8, (isl.z0 + isl.z1) / 2, 1.62, 0.11, 0.92, 0.7);
  L.counter({ x0: bar.x1 - 0.62, x1: bar.x1, z0: core.z1 + 0.05, z1: bar.z1 - 0.3 }, core.z1 + 1.6);
  L.tall({ x0: core.x0 + 0.05, x1: core.x1 - 0.05, z0: core.z1, z1: core.z1 + 0.6 }, C.oakPale);
  // Entrance: a bench beside the door.
  L.low({ x0: core.x0 - 0.95, x1: core.x0 - 0.1, z0: bar.z0 + 0.005, z1: bar.z0 + 0.38 }, 0.42, C.linenWarm);

  // Study (the wing): desk facing the pool glazing, shelves, a reading chair.
  L.desk({ x0: wing.x0 + 0.5, x1: wing.x0 + 1.3, z0: wing.z0 + 0.9, z1: wing.z0 + 2.7 }, [wing.x0 + 1.72, wing.z0 + 1.8], "w", [wing.x0 + 0.75, wing.z0 + 1.1]);
  L.shelf({ x0: wing.x1 - 0.36, x1: wing.x1, z0: wing.z0 + 0.25, z1: wing.z0 + 2.75 }, 1.15, 3);
  L.rug({ x0: wing.x0 + 2.0, x1: wing.x1 - 0.3, z0: wing.z1 - 1.7, z1: wing.z1 - 0.25 }, C.rugDeep);
  L.armchair(wing.x0 + 2.95, wing.z1 - 0.95, "w", C.linenWarm, 0.8);
  L.floorLamp(wing.x1 - 0.35, wing.z1 - 0.4, 0.9);
  L.plant(wing.x0 + 0.35, wing.z1 - 0.35, 0.9);
}

function villaUpper(L: Level, up: Rect, core: Rect, deckY: number, hw: number, hd: number) {
  const p1 = up.x0 + 4.15; // west bedrooms | bath + landing
  const p2 = -1.75; // NW | SW bedroom
  const p3 = p1 + 3.15; // bath + landing | master
  const p4 = up.z0 + 2.55; // bath | landing
  L.wallRun("z", p1, up.z0, up.z1, [
    [p2 - 0.95, p2 - 0.1],
    [p2 + 0.6, p2 + 1.45],
  ]);
  L.wallRun("x", p2, up.x0, p1 - 0.05);
  L.wallRun("z", p3, up.z0, up.z1, [[p4 + 0.25, p4 + 1.15]]);
  L.wallRun("x", p4, p1 + 0.05, p3 - 0.05, [[p1 + 1.7, p1 + 2.55]]);

  // Plan.
  L.rectRoom({ x0: up.x0, x1: p1 - 0.05, z0: up.z0, z1: p2 - 0.05 });
  L.rectRoom({ x0: up.x0, x1: p1 - 0.05, z0: p2 + 0.05, z1: up.z1 });
  L.rectRoom({ x0: p1 + 0.05, x1: p3 - 0.05, z0: up.z0, z1: p4 - 0.05 });
  L.rectRoom({ x0: p1 + 0.05, x1: p3 - 0.05, z0: p4 + 0.05, z1: up.z1 });
  L.rectRoom({ x0: p3 + 0.05, x1: up.x1, z0: up.z0, z1: up.z1 });
  L.door([p1 - 0.05, p2 - 0.1], [p1 - 0.05, p2 - 0.95], [-1, 0]);
  L.door([p1 - 0.05, p2 + 1.45], [p1 - 0.05, p2 + 0.6], [-1, 0]);
  L.door([p3 + 0.05, p4 + 1.15], [p3 + 0.05, p4 + 0.25], [1, 0]);
  L.door([p1 + 2.55, p4 + 0.05], [p1 + 1.7, p4 + 0.05], [0, 1]);
  L.liftSymbol({ x0: core.x0 + 0.25, x1: core.x1 - 0.25, z0: core.z0 + 0.25, z1: core.z1 - 0.25 }, L.F + CUT_ABOVE_FLOOR + 0.01);

  // NW bedroom: bed with its head on the west wall, desk under the north window, wardrobe.
  const b4: Rect = { x0: up.x0, x1: up.x0 + 2.0, z0: p2 - 0.05 - 2.4, z1: p2 - 0.05 - 0.8 };
  L.bed(b4, "w", C.linenSheet, C.sage);
  L.nightstand(up.x0 + 0.24, b4.z0 - 0.26);
  L.desk({ x0: up.x0 + 2.3, x1: up.x0 + 3.6, z0: up.z0 + 0.005, z1: up.z0 + 0.55 }, [up.x0 + 2.95, up.z0 + 0.9], "n", [up.x0 + 3.35, up.z0 + 0.22]);
  L.tall({ x0: p1 - 0.65, x1: p1 - 0.055, z0: up.z0 + 0.95, z1: p2 - 1.15 }, C.oakPale);

  // SW bedroom: bed against the north wall, chair by the south window.
  const b3: Rect = { x0: up.x0 + 1.05, x1: up.x0 + 2.65, z0: p2 + 0.05, z1: p2 + 2.05 };
  L.rug({ x0: b3.x0 - 0.5, x1: b3.x1 + 0.5, z0: b3.z0 + 0.8, z1: up.z1 - 0.35 }, C.rugDeep);
  L.bed(b3, "n");
  L.nightstand(b3.x0 - 0.28, b3.z0 + 0.25);
  L.nightstand(b3.x1 + 0.28, b3.z0 + 0.25);
  L.armchair(p1 - 0.75, up.z1 - 0.7, "w", C.linen, 0.74);

  // Bath: tub under the north window, double vanity, a towel bench.
  L.bath({ x0: p1 + 0.55, x1: p1 + 2.25, z0: up.z0 + 0.02, z1: up.z0 + 0.78 });
  L.vanity({ x0: p1 + 0.055, x1: p1 + 0.6, z0: up.z0 + 1.0, z1: p4 - 0.12 }, [up.z0 + 1.35, p4 - 0.48]);
  L.block(p3 - 0.5, 0, up.z0 + 1.1, p3 - 0.055, 0.45, p4 - 0.25, C.oak);

  // Landing: reading corner by the tall south window.
  L.rug({ x0: p1 + 0.45, x1: p3 - 0.45, z0: up.z1 - 2.2, z1: up.z1 - 0.3 });
  L.armchair(p1 + 1.15, up.z1 - 0.95, "e", C.sage, 0.78);
  L.roundTable(p1 + 1.95, up.z1 - 1.1, 0.24, 0.48, C.oakDark);
  L.floorLamp(p1 + 0.45, up.z1 - 0.45, 1);
  L.low({ x0: p3 - 0.45, x1: p3 - 0.055, z0: p4 + 1.5, z1: p4 + 3.3 }, 0.75, C.oak);
  L.plant(p3 - 0.4, up.z1 - 0.4, 0.85);

  // Master: king bed with its head on the partition, dressing table, wardrobe, chair.
  const mb: Rect = { x0: p3 + 0.05, x1: p3 + 2.15, z0: (up.z0 + up.z1) / 2 + 0.35, z1: (up.z0 + up.z1) / 2 + 2.15 };
  L.rug({ x0: mb.x0 + 0.6, x1: Math.min(up.x1 - 0.25, mb.x1 + 1.0), z0: mb.z0 - 0.6, z1: mb.z1 + 0.6 });
  L.bed(mb, "w");
  L.nightstand(mb.x0 + 0.25, mb.z0 - 0.3);
  L.nightstand(mb.x0 + 0.25, mb.z1 + 0.3);
  L.tall({ x0: up.x1 - 1.6, x1: up.x1 - 0.005, z0: up.z0 + 0.005, z1: up.z0 + 0.6 }, C.oakPale);
  L.desk({ x0: p3 + 0.35, x1: p3 + 1.55, z0: up.z0 + 0.005, z1: up.z0 + 0.48 }, [p3 + 0.95, up.z0 + 0.82], "n", [p3 + 0.55, up.z0 + 0.22], C.oakPale);
  L.armchair(up.x1 - 0.65, up.z1 - 0.75, "w", C.linenWarm, 0.76);

  // Deck over the wing: two loungers on the timber (outside the cork box).
  const lounger = (x: number, z0: number) => {
    const y = deckY - L.F;
    L.block(x - 0.34, y, z0, x + 0.34, y + 0.28, z0 + 1.75, C.oak);
    L.block(x - 0.32, y + 0.28, z0 + 0.5, x + 0.32, y + 0.38, z0 + 1.73, C.linen);
    L.block(x - 0.32, y + 0.28, z0 + 0.04, x + 0.32, y + 0.62, z0 + 0.5, C.linen);
  };
  const deckZ0 = up.z1 + 0.8;
  if (hd - deckZ0 > 2.0) {
    lounger(hw - 2.6, deckZ0 + 0.25);
    lounger(hw - 1.55, deckZ0 + 0.25);
    const y = deckY - L.F;
    L.f.cyl(hw - 2.07, L.F + y, deckZ0 + 0.55, 0.2, 0.42, C.oakDark, 20, false);
  }
}

/* ------------------------------------------------------------------- API */

export function buildInterior(id: HomeId, build: HouseBuild): InteriorLevel[] {
  return id === "v3" ? townhouse(build) : villa(build);
}
