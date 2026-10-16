/**
 * Vila Leku architecture — a pure, reusable house builder.
 *
 *   buildHouse(spec, opts?)  → { parts, levels, height, spill }   house-local geometry
 *   getHouseMaterials()      → cached patched materials, one per HouseMaterialKey
 *   getHouseDepthMaterial()  → customDepthMaterial so shadows follow the shader rise
 *   riseAmount(spec, uRise)  → this house's rise 0..1 (CPU mirror of the shader)
 *   buildHouseLines(spec) + getHouseLineMaterial()  → the architect's hairline drawing
 *   buildHouseMask(spec)  + getHouseMaskMaterial()  → depth-only hidden-line mask for it
 *   HouseBuild.spill      + getHouseSpillMaterial() → warm night light on terraces / garden
 *   buildVillageHouses()     → every non-featured house + the pavilion merged per material
 *
 * The language (from the client's renders): stacked boxes — a limestone ground
 * floor and a cork-clad upper volume shifted along z (cantilevers over the
 * garden, or a roof terrace behind glass), deep window recesses with slim
 * bronze frames and sills, big ground-floor glazing to the south garden, flat
 * gravel roofs behind parapets with pale copings, solar arrays and skylights,
 * limestone garden walls between townhouse units. V4 villas: an L of limestone
 * (bar + wing around the pool terrace), a cork upper box cantilevering west
 * and south over the terrace, a timber deck with glass balustrades and a
 * limestone elevator core. Per-house variation (window rhythm, solar layout,
 * skylights, roof hatch, villa handedness) comes from spec.seed / upperShift.
 *
 * Coordinates: house-local metres. Origin at the footprint centre on the pad
 * (ground y = 0), facing +Z (south, the garden). Volumes sink SINK below 0 so
 * they seat into any terrain. Every volume is a closed shell and holds a room
 * cavity (inward-facing plaster/oak faces with holes behind each window), so
 * the section cut reads as poché walls and slabs around lit rooms, with the
 * windows seen from inside as daylight.
 *
 * HOMES MODULE — rebuilding a featured house with separable floors:
 *   const { parts, levels, spill } = buildHouse(FEATURED.v4);
 *   const mats = getHouseMaterials();
 *   // one <group> per level (0 ground · 1 upper floor + its terrace · 2 roof:
 *   // parapets, gravel, solar, skylights, lift overrun), all at
 *   // (spec.x, spec.y, spec.z) rotated spec.rotY; lift the level groups apart to explode.
 *   parts.map(p => <mesh geometry={p.geometry} material={mats[p.material]}
 *     customDepthMaterial={getHouseDepthMaterial()} castShadow={p.material !== "glass"} receiveShadow />)
 * Each level is closed on its own; level n+1 starts LEVEL_OVERLAP below the
 * top of level n (levels[i].y0 / y1 give floor and top heights + plan footprints).
 * The rise (U.uRise + spec.delay), material sweep, poché, section clip and
 * night windows (U.uWindows + spec.lightDelay) all run in the shaders from the
 * aHouse / aWin attributes baked here — do NOT also scale by riseAmount();
 * pass { animate: false } for a house that is always fully risen.
 * Line drawing for the same house in one construct:
 *   const { lines, mask } = buildHouse(spec, { drawing: true });
 *   <mesh geometry={mask} material={getHouseMaskMaterial()} renderOrder={998} />
 *   <mesh geometry={lines} material={getHouseLineMaterial()} renderOrder={999} />
 * (the mask is depth-only but transparent, so it runs after every other
 * transparent object; for buildHouse geometry aMask.w is 0 = house-local pad).
 * Ground-floor paving (garden terraces, the villa courtyard) is level 0, so it
 * explodes with the ground floor. Townhouse party joints are closed by thin
 * poché fillers built by the non-featured neighbour (never by a featured house).
 */

import { type BufferGeometry, Matrix4 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "@/lib/noise";
import { clamp01, easeOutQuart } from "@/lib/timeline";
import { HOUSES, VILLAGE_HEART, heightAt, type HouseSpec } from "@/lib/village";
import {
  LineCollector,
  MaskBuilder,
  MeshBuilder,
  ROLE,
  facade,
  faceOf,
  onFace,
  uniqSorted,
  wallWithHoles,
  type Face,
  type FaceGrid,
  type FacadeTargets,
  type FaceFrame,
  type Opening,
  type Rect,
  type Vec3,
  type WallLamp,
} from "./kit";
import {
  HOUSE_LINE_RES,
  HOUSE_MATERIAL_KEYS,
  getHouseDepthMaterial,
  getHouseLineMaterial,
  getHouseMaskMaterial,
  getHouseMaterials,
  getHouseSpillMaterial,
  updateHouseLineResolution,
  type HouseMaterialKey,
} from "./materials";

export {
  HOUSE_LINE_RES,
  HOUSE_MATERIAL_KEYS,
  getHouseDepthMaterial,
  getHouseLineMaterial,
  getHouseMaskMaterial,
  getHouseMaterials,
  getHouseSpillMaterial,
  updateHouseLineResolution,
  type HouseMaterialKey,
};

/* ------------------------------------------------------------------ types */

export type HouseLevel = 0 | 1 | 2;

export interface HousePart {
  /** e.g. "L1.cork" — one merged mesh per (level, material). */
  name: string;
  /** 0 ground floor · 1 upper floor (incl. its roof terrace) · 2 roof (parapets, gravel, solar, skylights). */
  level: HouseLevel;
  /** House-local geometry; attributes position, normal, uv, aHouse, aWin (see kit.ts). */
  geometry: BufferGeometry;
  material: HouseMaterialKey;
}

export interface HouseLevelInfo {
  level: HouseLevel;
  /** Local y of the level's floor and its top (where the next level starts). */
  y0: number;
  y1: number;
  /** Plan footprint of the level's main volume(s), local (for floor plans). */
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface HouseBuild {
  spec: HouseSpec;
  parts: HousePart[];
  levels: HouseLevelInfo[];
  /** Overall height above the pad (top of parapets / lift overrun). */
  height: number;
  /** Night light pools in front of glazing (house-local), for getHouseSpillMaterial(); null if none. */
  spill: BufferGeometry | null;
  /** With { drawing: true }: the hairline drawing and its hidden-line mask (house-local). */
  lines?: BufferGeometry;
  mask?: BufferGeometry;
}

export interface BuildHouseOptions {
  /**
   * Bake the per-house rise delay so the house rises with the village (default
   * true). false → always fully risen (windows still follow lightDelay).
   */
  animate?: boolean;
  /**
   * Also return the architect's drawing (`lines`, for getHouseLineMaterial) and
   * its hidden-line `mask` (for getHouseMaskMaterial) from the same build.
   */
  drawing?: boolean;
}

/** Volumes start this far below the pad so they seat into the terrain. */
export const SINK = 0.45;
/**
 * Stacked levels overlap by this much (each level stays a closed shell for the
 * exploded view; no slit shows in the section). Where an upper face would be
 * flush with a lower face of another material it sits 1 cm behind it, so no
 * two different surfaces are ever coplanar.
 */
export const LEVEL_OVERLAP = 0.06;
/**
 * Wall thickness around room cavities (what the section cut shows as poché).
 * Never less than a reveal depth: panes close the shell, rooms get matching holes.
 */
export const WALL = 0.45;
/** Height of the poché cap inside sunk shells (between the pad and the room floor). */
const CAP_Y = 0.025;
/** Top of paved terraces above the pad (ground-floor glazing sills sit at +0.08). */
export const PAVING_TOP = 0.06;
/** Plan lines of the drawing float this far above the pad. */
export const PLAN_LIFT = 0.03;
/** Clear joint between neighbouring townhouse units (closed by a poché filler). */
export const PARTY_GAP = 0.004;
/** Upper (cork) volumes sit this far inside the ground floor's side faces. */
const UPPER_INSET = 0.01;

/** Per-house rise 0..1 — the exact mirror of the shader (ease-out quart, staggered by spec.delay). */
export function riseAmount(spec: Pick<HouseSpec, "delay">, uRise: number) {
  return easeOutQuart(clamp01((uRise - spec.delay * 0.6) / 0.4));
}

/* --------------------------------------------------------- build context */

class HouseKit {
  private builders = new Map<string, MeshBuilder>();
  readonly lines = new LineCollector();
  readonly mask = new MaskBuilder();
  readonly spillB = new MeshBuilder();
  levels: HouseLevelInfo[] = [];
  height = 0;
  /** Local (x, z) → terrain height relative to the pad (set by construct), to keep spill on the ground. */
  ground: ((lx: number, lz: number) => number) | null = null;

  constructor(private attr: [number, number, number, number], lineDelay: number) {
    this.lines.delay = lineDelay;
    this.mask.delay = attr[1];
    this.spillB.houseAttr = attr;
  }

  /**
   * Warm night light pooling on the floor in front of an opening (a trapezoid
   * widening away from the facade). `floorV` = floor height in the face's v
   * coordinates; `lift` = height of the pool above that floor (above paving).
   * On the ground, the reach stops where the terrain leaves the floor level.
   */
  spill(f: FaceFrame, o: Pick<Opening, "u0" | "u1" | "rand" | "fill">, floorV: number, maxLen: number, onGround = true, lift = 0.03, role?: number) {
    let len = maxLen;
    if (onGround && this.ground) {
      const floorY = f.o[1] + floorV;
      const um = (o.u0 + o.u1) / 2;
      for (let d = 0.25; d <= maxLen + 1e-6; d += 0.25) {
        const p = onFace(f, um, floorV, -d);
        if (Math.abs(this.ground(p[0], p[2]) - floorY) > 0.2) {
          len = d - 0.3;
          break;
        }
      }
    }
    if (len < 0.9) return;
    const v = floorV + lift;
    const w0 = role === ROLE.lamp ? 0.1 : 0.35;
    const spread = 0.4 * len;
    const b = this.spillB;
    b.winAttr = [o.rand, role ?? (o.fill === "glazing" ? ROLE.glazing : ROLE.pane)];
    b.quad(onFace(f, o.u0 - w0, v, -0.02), onFace(f, o.u1 + w0, v, -0.02), onFace(f, o.u1 + w0 + spread, v, -len), onFace(f, o.u0 - w0 - spread, v, -len), [0, 1, 0], [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    b.winAttr = [-1, ROLE.wall];
  }

  /** A wall light's night glow: a soft wash on its wall and a small pool on the ground below it. */
  lampLight(f: FaceFrame, lamp: WallLamp, floorV: number) {
    const b = this.spillB;
    const hw = 0.36;
    const v0 = lamp.v - 0.75;
    const v1 = lamp.v + 0.6;
    b.winAttr = [lamp.rand, ROLE.lampWash];
    b.quad(onFace(f, lamp.u - hw, v0, -0.012), onFace(f, lamp.u + hw, v0, -0.012), onFace(f, lamp.u + hw, v1, -0.012), onFace(f, lamp.u - hw, v1, -0.012), f.n, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    b.winAttr = [-1, ROLE.wall];
    this.spill(f, { u0: lamp.u - 0.2, u1: lamp.u + 0.2, rand: lamp.rand, fill: "pane" }, floorV, 1.9, true, 0.03, ROLE.lamp);
  }

  /** A volume of the drawing: its 12 hairline edges + its hidden-line mask box. */
  envelope(min: Vec3, max: Vec3, phase = 0, maskTop = max[1]) {
    // Plan lines on the pad sit PLAN_LIFT above it (never coplanar with the terrain).
    const lo: Vec3 = [min[0], Math.abs(min[1]) < 1e-3 ? PLAN_LIFT : min[1], min[2]];
    this.lines.box(lo, max, phase);
    this.mask.box(min, [max[0], maskTop, max[2]]);
  }

  b(level: HouseLevel, mat: HouseMaterialKey) {
    const key = `${level}:${mat}`;
    let m = this.builders.get(key);
    if (!m) {
      m = new MeshBuilder();
      m.houseAttr = this.attr;
      this.builders.set(key, m);
    }
    return m;
  }

  targets(level: HouseLevel, wall: HouseMaterialKey, lines = true): FacadeTargets {
    return { wall: this.b(level, wall), pane: this.b(level, "window"), frame: this.b(level, "frame"), door: this.b(level, "timber"), lines: lines ? this.lines : undefined };
  }

  /**
   * A closed volume with punched facades. Top/bottom are plain; `skip` drops
   * faces that sit against something (no coplanar double faces).
   */
  volume(
    level: HouseLevel,
    mat: HouseMaterialKey,
    min: Vec3,
    max: Vec3,
    openings: Partial<Record<"px" | "nx" | "pz" | "nz", Opening[]>> = {},
    skip: Face[] = [],
    room?: { y0: number; y1: number },
  ) {
    const t = this.targets(level, mat);
    // One breakpoint grid for the whole shell (x from the N/S faces, z from the
    // E/W faces, heights from all), so faces, top and bottom all conform.
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const xs = uniqSorted([x0, x1, ...(openings.pz ?? []).flatMap((o) => [x0 + o.u0, x0 + o.u1]), ...(openings.nz ?? []).flatMap((o) => [x1 - o.u0, x1 - o.u1])]);
    const zs = uniqSorted([z0, z1, ...(openings.px ?? []).flatMap((o) => [z1 - o.u0, z1 - o.u1]), ...(openings.nx ?? []).flatMap((o) => [z0 + o.u0, z0 + o.u1])]);
    const vs = (["px", "nx", "pz", "nz"] as const).flatMap((f) => (openings[f] ?? []).flatMap((o) => [o.v0, o.v1]));
    const wb = this.b(level, mat);
    wb.winAttr = [-1, ROLE.wall];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        const [a, b, c, d] = [xs[i], xs[i + 1], zs[j], zs[j + 1]];
        if (!skip.includes("py")) wb.quad([a, y1, d], [b, y1, d], [b, y1, c], [a, y1, c], [0, 1, 0]);
        if (!skip.includes("ny")) wb.quad([a, y0, c], [b, y0, c], [b, y0, d], [a, y0, d], [0, -1, 0]);
      }
    }
    const grids: Record<"px" | "nx" | "pz" | "nz", FaceGrid> = {
      pz: { us: xs.map((x) => x - x0), vs },
      nz: { us: xs.map((x) => x1 - x), vs },
      px: { us: zs.map((z) => z1 - z), vs },
      nx: { us: zs.map((z) => z - z0), vs },
    };
    for (const f of ["px", "nx", "pz", "nz"] as const) {
      if (skip.includes(f)) continue;
      const F = faceOf(min, max, f);
      const lamps = facade(F, openings[f] ?? [], t, grids[f]);
      // Entrance lights (ground floor): wash on the wall + a pool at the threshold.
      if (level === 0) for (const l of lamps) this.lampLight(F, l, -min[1]);
    }
    if (room) {
      const rMin: Vec3 = [x0 + WALL, room.y0, z0 + WALL];
      const rMax: Vec3 = [x1 - WALL, room.y1, z1 - WALL];
      this.room(level, rMin, rMax, min, max, openings);
      // Sunk shells: a poché cap over the wall band just above the pad (the
      // terrain runs through it; the section cut must read as solid wall).
      if (y0 < 0 && room.y0 > CAP_Y) {
        const e = 0.001;
        const cb = this.b(level, mat);
        cb.winAttr = [-1, ROLE.cap];
        const band = (a: number, b: number, c: number, d: number) => {
          if (b - a > 1e-3 && d - c > 1e-3) cb.quad([a, CAP_Y, d], [b, CAP_Y, d], [b, CAP_Y, c], [a, CAP_Y, c], [0, 1, 0]);
        };
        band(x0 + e, x1 - e, z0 + e, rMin[2]);
        band(x0 + e, x1 - e, rMax[2], z1 - e);
        band(x0 + e, rMin[0], rMin[2], rMax[2]);
        band(rMax[0], x1 - e, rMin[2], rMax[2]);
        cb.winAttr = [-1, ROLE.wall];
      }
    }
  }

  /**
   * A paved terrace slab (limestone, PAVING_TOP proud of the pad, SINK below),
   * shortened along z where the terrain falls away from the pad.
   */
  paving(level: HouseLevel, x0: number, x1: number, z0: number, z1: number) {
    const zEnd = this.groundRun([x0 + 0.3, (x0 + x1) / 2, x1 - 0.3], z0 + 0.3, z1, -0.12);
    if (zEnd - z0 < 0.6) return z0;
    this.box(level, "limestone", [x0, -SINK, z0], [x1, PAVING_TOP, zEnd]);
    this.lines.rect(x0, z0, x1, zEnd, PAVING_TOP + 0.01, 0.16);
    return zEnd;
  }

  /**
   * Walk from z0 towards z1 (along local z, at each x of `xs`) and return where
   * the terrain first drops below `minY` (relative to the pad), or z1.
   */
  groundRun(xs: number[], z0: number, z1: number, minY: number) {
    if (!this.ground) return z1;
    const dir = Math.sign(z1 - z0) || 1;
    for (let z = z0; dir * (z1 - z) > -1e-6; z += dir * 0.2) {
      if (xs.some((x) => this.ground!(x, z) < minY)) return z - dir * 0.2;
    }
    return z1;
  }

  box(level: HouseLevel, mat: HouseMaterialKey, min: Vec3, max: Vec3, skip: Face[] = []) {
    this.b(level, mat).box(min, max, skip);
  }

  /**
   * A room cavity (inward faces, interior finish) — the section shows walls and
   * slabs around it. With the parent volume's openings, its walls get matching
   * holes so every pane closes the shell from both sides.
   */
  room(level: HouseLevel, min: Vec3, max: Vec3, volMin?: Vec3, volMax?: Vec3, openings: Partial<Record<"px" | "nx" | "pz" | "nz", Opening[]>> = {}) {
    const b = this.b(level, "limestone");
    b.winAttr = [-1, ROLE.interior];
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    b.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, -1, 0]);
    b.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 1, 0]);
    for (const f of ["px", "nx", "pz", "nz"] as const) {
      const R = faceOf(min, max, f);
      const holes: Rect[] = [];
      if (volMin && volMax) {
        const F = faceOf(volMin, volMax, f);
        for (const o of openings[f] ?? []) {
          const a = onFace(F, o.u0, o.v0);
          const c = onFace(F, o.u1, o.v1);
          const toR = (p: Vec3) => [
            (p[0] - R.o[0]) * R.u[0] + (p[1] - R.o[1]) * R.u[1] + (p[2] - R.o[2]) * R.u[2],
            (p[0] - R.o[0]) * R.v[0] + (p[1] - R.o[1]) * R.v[1] + (p[2] - R.o[2]) * R.v[2],
          ];
          const [ua, va] = toR(a);
          const [uc, vc] = toR(c);
          const h = {
            u0: Math.max(0, Math.min(ua, uc)),
            u1: Math.min(R.w, Math.max(ua, uc)),
            v0: Math.max(0, Math.min(va, vc)),
            v1: Math.min(R.h, Math.max(va, vc)),
          };
          if (h.u1 - h.u0 > 0.01 && h.v1 - h.v0 > 0.01) holes.push(h);
        }
      }
      wallWithHoles(R, holes, b, [-R.n[0], -R.n[1], -R.n[2]]);
    }
    b.winAttr = [-1, ROLE.wall];
  }

  /**
   * A full-height interior partition (plaster, a closed box: poché where the
   * section cuts it) running along z inside a room, at an x clear of `avoid`
   * (openings in the walls it meets). Gives the cut rooms depth and rhythm.
   */
  partition(level: HouseLevel, room: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }, avoid: [number, number][], rand: () => number, reach = 0.55) {
    const t = 0.12;
    const lo = room.x0 + 1.4;
    const hi = room.x1 - 1.4;
    if (hi <= lo) return;
    for (let i = 0; i < 10; i++) {
      const x = lo + (hi - lo) * rand();
      if (avoid.some(([a, b]) => x + t / 2 > a - 0.2 && x - t / 2 < b + 0.2)) continue;
      const b = this.b(level, "limestone");
      b.winAttr = [-1, ROLE.interior];
      b.box([x - t / 2, room.y0 + 0.002, room.z0 + 0.002], [x + t / 2, room.y1 - 0.002, room.z0 + (room.z1 - room.z0) * reach]);
      b.winAttr = [-1, ROLE.wall];
      return;
    }
  }

  /** Mirror everything across x = 0 (positions, normals, winding, lines). */
  mirrorX() {
    for (const m of this.builders.values()) {
      for (let i = 0; i < m.pos.length; i += 3) {
        m.pos[i] = -m.pos[i];
        m.nor[i] = -m.nor[i];
      }
      for (let i = 0; i < m.idx.length; i += 3) {
        const t = m.idx[i + 1];
        m.idx[i + 1] = m.idx[i + 2];
        m.idx[i + 2] = t;
      }
    }
    for (let i = 0; i < this.lines.pos.length; i += 3) this.lines.pos[i] = -this.lines.pos[i];
    for (let i = 0; i < this.mask.pos.length; i += 3) this.mask.pos[i] = -this.mask.pos[i];
    const sb = this.spillB;
    for (let i = 0; i < sb.pos.length; i += 3) {
      sb.pos[i] = -sb.pos[i];
      sb.nor[i] = -sb.nor[i];
    }
    for (let i = 0; i < sb.idx.length; i += 3) {
      const t = sb.idx[i + 1];
      sb.idx[i + 1] = sb.idx[i + 2];
      sb.idx[i + 2] = t;
    }
    for (const l of this.levels) {
      const { minX, maxX } = l.footprint;
      l.footprint.minX = -maxX;
      l.footprint.maxX = -minX;
    }
  }

  parts(): HousePart[] {
    const out: HousePart[] = [];
    for (const [key, m] of this.builders) {
      if (m.isEmpty()) continue;
      const [lv, mat] = key.split(":");
      const level = Number(lv) as HouseLevel;
      out.push({ name: `L${level}.${mat}`, level, geometry: m.build(), material: mat as HouseMaterialKey });
    }
    out.sort((a, b) => a.level - b.level || HOUSE_MATERIAL_KEYS.indexOf(a.material) - HOUSE_MATERIAL_KEYS.indexOf(b.material));
    return out;
  }
}

/* ----------------------------------------------------------- shared bits */

/** Roof: parapets (facade material), pale coping, gravel, solar array, skylights. */
function roof(
  k: HouseKit,
  rng: () => number,
  o: {
    x0: number;
    x1: number;
    z0: number;
    z1: number;
    y: number;
    wall: HouseMaterialKey;
    parapet?: number;
    solar: { cols: number; rows: number };
    skylights: number;
    hatch: boolean;
    /** Party sides: the coping stops flush there (the neighbour's coping continues it). */
    shared?: { west?: boolean; east?: boolean };
  },
) {
  const { x0, x1, z0, z1, y } = o;
  const pt = 0.22;
  const ph = o.parapet ?? PARAPET;
  const L: HouseLevel = 2;
  const top = y + ph;
  // Parapets — N and S full width; E and W between them. They reach a few cm
  // down into the volume (closed shells, no slit in the section), flush with the
  // facade: the overlap band is the same material and shading, so it is seamless.
  // (No undersides: they sit inside the slab, where a section cut would show
  // them lit instead of poché. Seen from below in an exploded view, the roof
  // level then reads as a poché slab.)
  const dn = y - LEVEL_OVERLAP;
  k.box(L, o.wall, [x0, dn, z0], [x1, top, z0 + pt], ["ny"]);
  k.box(L, o.wall, [x0, dn, z1 - pt], [x1, top, z1], ["ny"]);
  k.box(L, o.wall, [x0, dn, z0 + pt], [x0 + pt, top, z1 - pt], ["nz", "pz", "ny"]);
  k.box(L, o.wall, [x1 - pt, dn, z0 + pt], [x1, top, z1 - pt], ["nz", "pz", "ny"]);
  // Coping, a hair proud of the facade — closed underneath (no open slot from below).
  const c = 0.025;
  const cw = o.shared?.west ? 0 : c;
  const ce = o.shared?.east ? 0 : c;
  const ct = top + 0.05;
  const cb = k.b(L, "limestone");
  const wallTop: [number, number, number, number] = [x0, x1, z0, z1];
  cb.capBox([x0 - cw, top, z0 - c], [x1 + ce, ct, z0 + pt], wallTop);
  cb.capBox([x0 - cw, top, z1 - pt], [x1 + ce, ct, z1 + c], wallTop);
  cb.capBox([x0 - cw, top, z0 + pt], [x0 + pt, ct, z1 - pt], wallTop, ["nz", "pz"]);
  cb.capBox([x1 - pt, top, z0 + pt], [x1 + ce, ct, z1 - pt], wallTop, ["nz", "pz"]);
  // Gravel (its top carries its size in aWin → contact shade along the parapets).
  const gy = y + 0.08;
  const gb = k.b(L, "roof");
  const gx0 = x0 + pt - 0.05;
  const gx1 = x1 - pt + 0.05;
  const gz0 = z0 + pt - 0.05;
  const gz1 = z1 - pt + 0.05;
  gb.winAttr = [gx1 - gx0, GRAVEL_TAG + (gz1 - gz0)];
  gb.box([gx0, dn, gz0], [gx1, gy, gz1], ["ny"]);
  gb.winAttr = [-1, ROLE.wall];
  k.lines.rect(x0 + pt, z0 + pt, x1 - pt, z1 - pt, top, 0.64);
  k.mask.box([x0, y, z0], [x1, top, z0 + pt]);
  k.mask.box([x0, y, z1 - pt], [x1, top, z1]);
  k.mask.box([x0, y, z0], [x0 + pt, top, z1]);
  k.mask.box([x1 - pt, y, z0], [x1, top, z1]);

  // Solar array — rows of panels tilted 10° to the south, on slim rails. A
  // 2 cm gap: each row reads as one continuous dark strip from afar.
  const tilt = (10 * Math.PI) / 180;
  const pw = 1.0;
  const pl = 1.65;
  const gap = 0.02;
  const depthZ = pl * Math.cos(tilt);
  const cols = o.solar.cols;
  const rows = o.solar.rows;
  const arrW = cols * pw + (cols - 1) * gap;
  const innerW = x1 - x0 - 2 * pt;
  const ax0 = x0 + pt + Math.max(0.35, (innerW - arrW) * (0.25 + 0.5 * rng()));
  const rowPitch = depthZ + 0.75;
  const innerD = z1 - z0 - 2 * pt;
  const arrD = rows * rowPitch - 0.75;
  // Array sits towards the north (skylights to the south of it).
  const az1 = z0 + pt + 0.5 + arrD;
  const sb = k.b(L, "solar");
  const fb = k.b(L, "frame");
  if (arrD < innerD - 0.8 && ax0 + arrW < x1 - pt - 0.2) {
    for (let r = 0; r < rows; r++) {
      const zs = az1 - r * rowPitch; // south (low) edge of this row
      const zn = zs - depthZ;
      const lift = 0.16;
      for (let ci = 0; ci < cols; ci++) {
        const px = ax0 + ci * (pw + gap);
        sb.frameBox([px, gy + lift, zs], [1, 0, 0], [0, Math.sin(tilt), -Math.cos(tilt)], [0, Math.cos(tilt), Math.sin(tilt)], pw, pl, 0.045);
      }
      // Rails under the low and high edges.
      fb.box([ax0 + 0.1, gy, zs - 0.18], [ax0 + arrW - 0.1, gy + lift + 0.02, zs - 0.12], ["ny"]);
      fb.box([ax0 + 0.1, gy, zn + 0.12], [ax0 + arrW - 0.1, gy + lift + pl * Math.sin(tilt) - 0.02, zn + 0.18], ["ny"]);
      k.lines.rect(ax0, zn, ax0 + arrW, zs, gy + lift + 0.2, 0.84);
    }
  }
  // Roof access hatch on some houses — a small box in a south corner.
  let skyX0 = x0 + pt;
  let skyX1 = x1 - pt;
  if (o.hatch) {
    const hw = 1.5;
    const hd = 1.1;
    const west = rng() < 0.5;
    const hx = west ? x0 + pt + 0.3 : x1 - pt - 0.3 - hw;
    const hz = z1 - pt - 0.3 - hd;
    if (hz > az1 + 0.45) {
      k.box(L, o.wall, [hx, y, hz], [hx + hw, gy + 0.95, hz + hd], ["ny"]);
      k.b(L, "limestone").capBox([hx - 0.02, gy + 0.95, hz - 0.02], [hx + hw + 0.02, gy + 0.99, hz + hd + 0.02], [hx, hx + hw, hz, hz + hd]);
      k.envelope([hx, gy, hz], [hx + hw, gy + 0.95, hz + hd], 0.2);
      if (west) skyX0 = hx + hw + 0.2;
      else skyX1 = hx - 0.2;
    }
  }
  // Skylights — limestone upstands with a glass top (glows from above at night).
  const skyZ0 = Math.max(az1 + 0.7, z0 + pt + 0.6);
  for (let i = 0; i < o.skylights; i++) {
    const s = 1.05 + rng() * 0.35;
    const span = skyX1 - skyX0 - 0.6 - s;
    if (span < 0) break;
    const sx = skyX0 + 0.3 + span * clamp01((i + 0.5) / o.skylights + (rng() - 0.5) * 0.25);
    const sz = skyZ0 + rng() * Math.max(0, z1 - pt - 0.5 - s - skyZ0);
    if (sz + s > z1 - pt - 0.3) continue;
    const h = 0.24;
    k.box(L, "limestone", [sx, y, sz], [sx + s, gy + h, sz + s], ["ny", "py"]);
    const wb = k.b(L, "window");
    wb.winAttr = [rng(), ROLE.skylight];
    wb.quad([sx, gy + h, sz + s], [sx + s, gy + h, sz + s], [sx + s, gy + h, sz], [sx, gy + h, sz], [0, 1, 0], [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    wb.winAttr = [-1, ROLE.wall];
    k.lines.rect(sx, sz, sx + s, sz + s, gy + h, 0.86);
  }
  return ct;
}

/** Parapet height above the roof slab. */
const PARAPET = 0.5;
/** aWin.y of the roof gravel top = GRAVEL_TAG + its z size (aWin.x = its x size). */
const GRAVEL_TAG = 10;

/**
 * A terrace edge: limestone upstand + frameless glass with a slim pale top
 * rail (a model's clear balustrade: a dark bronze rail over invisible glass read,
 * from afar, as a stray hairline). Along x or z (whichever is longer).
 */
function balustrade(k: HouseKit, level: HouseLevel, y: number, a: [number, number], b: [number, number], skip: Face[] = []) {
  const up = 0.22;
  const gh = 1.0;
  const [ax, az] = a;
  const [bx, bz] = b;
  k.box(level, "limestone", [Math.min(ax, bx), y, Math.min(az, bz)], [Math.max(ax, bx), y + up, Math.max(az, bz)], ["ny", ...skip]);
  const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
  const g = 0.012;
  const rw = 0.015;
  const rh = 0.04;
  const gt = y + up + gh;
  if (alongX) {
    const zc = (az + bz) / 2;
    const xa = Math.min(ax, bx) + 0.06;
    const xb = Math.max(ax, bx) - 0.06;
    k.box(level, "glass", [xa, y + up, zc - g], [xb, gt, zc + g], ["ny", "py"]);
    k.box(level, "limestone", [xa - 0.01, gt, zc - rw], [xb + 0.01, gt + rh, zc + rw]);
    k.lines.seg([Math.min(ax, bx), gt, zc], [Math.max(ax, bx), gt, zc], 0.8);
  } else {
    const xc = (ax + bx) / 2;
    const za = Math.min(az, bz) + 0.06;
    const zb = Math.max(az, bz) - 0.06;
    k.box(level, "glass", [xc - g, y + up, za], [xc + g, gt, zb], ["ny", "py"]);
    k.box(level, "limestone", [xc - rw, gt, za - 0.01], [xc + rw, gt + rh, zb + 0.01]);
    k.lines.seg([xc, gt, Math.min(az, bz)], [xc, gt, Math.max(az, bz)], 0.8);
  }
}

/** Neighbouring townhouse units (same row & block), if any. */
function neighbours(spec: HouseSpec) {
  const same = HOUSES.filter((h) => h.row === spec.row && h.block === spec.block && h.type === spec.type && h.id !== spec.id);
  return {
    west: same.find((h) => Math.abs(h.x - (spec.x - spec.width)) < 0.5),
    east: same.find((h) => Math.abs(h.x - (spec.x + spec.width)) < 0.5),
  };
}

/**
 * A townhouse's stacked-box plan (local z): ground floor g0..g1, upper floor
 * u0..u1. upperShift > 0 → the upper box cantilevers over the south garden;
 * otherwise the ground floor runs out under a roof terrace.
 */
function townhousePlan(spec: Pick<HouseSpec, "depth" | "upperShift">) {
  const hd = spec.depth / 2;
  const s = spec.upperShift;
  if (s > 0) {
    const c = 2.0 + 0.4 * Math.abs(s);
    return { south: true, g0: -hd, g1: hd - c, u0: -hd + 0.9, u1: hd };
  }
  const c = 2.6 + 0.4 * Math.abs(s);
  return { south: false, g0: -hd + 1.3, g1: hd, u0: -hd, u1: hd - c };
}

/* -------------------------------------------------------------- townhouse */

function townhouse(spec: HouseSpec, k: HouseKit, rng: () => number) {
  const W = spec.width - PARTY_GAP;
  const hw = W / 2;
  const D = spec.depth;
  const hd = D / 2;
  const [f0, f1] = spec.floors;
  const y0 = -SINK;
  const yF = f0;
  const yU = f0 - LEVEL_OVERLAP;
  const yR = f0 + f1;
  const fl = SINK; // floor level, in ground-facade coordinates
  const ul = LEVEL_OVERLAP; // floor level, in upper-facade coordinates
  const nb = neighbours(spec);
  const R = () => rng();
  const plan = townhousePlan(spec);
  const { south, g0, g1, u0, u1 } = plan;
  const gD = g1 - g0;
  const uD = u1 - u0;
  const ux0 = -hw + UPPER_INSET;
  const ux1 = hw - UPPER_INSET;

  /* ---- ground floor: limestone ---- */
  const southG: Opening[] = [];
  if (south) {
    southG.push({ u0: 0.55, u1: W - 0.55, v0: fl + 0.08, v1: fl + 2.72, depth: 0.3, fill: "glazing", mullions: 3, rand: R() });
  } else {
    const flip = R() < 0.5;
    const gw = W - 2.65;
    const a = flip ? 0.55 : W - 0.55 - gw;
    const sl = flip ? W - 1.45 : 0.8;
    southG.push({ u0: a, u1: a + gw, v0: fl + 0.08, v1: fl + 2.62, depth: 0.3, fill: "glazing", mullions: 2, rand: R() });
    southG.push({ u0: sl, u1: sl + 0.65, v0: fl + 0.55, v1: fl + 2.62, depth: 0.3, fill: "pane", rand: R() });
  }
  const doorLeft = R() < 0.5;
  const du = doorLeft ? 0.75 : W - 0.75 - 1.1;
  const wu = doorLeft ? W - 0.75 - 2.0 : 0.75;
  const northG: Opening[] = [
    { u0: du, u1: du + 1.1, v0: fl + 0.05, v1: fl + 2.45, depth: 0.45, fill: "door", rand: R() },
    { u0: wu, u1: wu + 2.0, v0: fl + 1.2, v1: fl + 2.3, depth: 0.3, fill: "pane", mullions: 1, rand: R() },
  ];
  const sideG = (): Opening[] => [{ u0: gD * 0.32, u1: gD * 0.32 + 0.8, v0: fl + 0.35, v1: fl + 2.55, depth: 0.3, fill: "pane", rand: R() }];
  k.volume(
    0,
    "limestone",
    [-hw, y0, g0],
    [hw, yF, g1],
    { pz: southG, nz: northG, px: nb.east ? [] : sideG(), nx: nb.west ? [] : sideG() },
    [],
    { y0: 0.06, y1: yF - 0.32 },
  );
  k.envelope([-hw, 0, g0], [hw, yF, g1], 0);

  // Entrance canopy over the door when nothing overhangs it.
  if (south) {
    const xc = hw - (du + 0.55);
    k.box(0, "limestone", [xc - 0.95, yF - 0.62, g0 - 1.05], [xc + 0.95, yF - 0.48, g0], ["pz"]);
    // North ledge: the ground roof in front of the set-back upper floor.
    k.box(0, "limestone", [-hw, yF, g0], [hw, yF + 0.16, g0 + 0.22], ["ny"]);
    k.box(0, "roof", [-hw + 0.01, yF - LEVEL_OVERLAP, g0 + 0.1], [hw - 0.01, yF + 0.07, u0 + 0.05]);
  }

  /* ---- garden walls (limestone), seated on the terrain ---- */
  const wallZ0 = (south ? g1 : hd) - 0.3;
  const gardenWall = (bx: number) => {
    // Stop where the terrain falls away (e.g. the step down to the next terrace).
    const z1 = k.groundRun([bx - 0.12, bx + 0.12], wallZ0 + 0.5, hd + 2.6, -(SINK - 0.15));
    if (z1 - wallZ0 < 0.8) return;
    k.box(0, "limestone", [bx - 0.12, y0, wallZ0], [bx + 0.12, 1.55, z1]);
    k.b(0, "limestone").capBox([bx - 0.145, 1.55, wallZ0], [bx + 0.145, 1.6, z1 + 0.025], [bx - 0.12, bx + 0.12, wallZ0, z1]);
    k.envelope([bx - 0.12, 0, Math.max(wallZ0, south ? g1 : hd)], [bx + 0.12, 1.55, z1], 0.18);
  };
  gardenWall(nb.east ? hw + PARTY_GAP / 2 : hw + 0.02);
  if (!nb.west) gardenWall(-hw - 0.02);

  /* ---- paved terrace at the garden doors, between the garden walls ---- */
  // Edges 6 mm inside the garden walls on both sides.
  const paveX0 = (nb.west ? -hw - PARTY_GAP / 2 : -hw - 0.02) + 0.12 - 0.006;
  const paveX1 = (nb.east ? hw + PARTY_GAP / 2 : hw + 0.02) - 0.12 + 0.006;
  const paveZ0 = g1 - 0.05;
  const paveEnd = k.paving(0, paveX0, paveX1, paveZ0, south ? hd + 0.35 : hd + 2.4);
  const paved = paveEnd > paveZ0 + 0.5;
  const faceSG = faceOf([-hw, y0, g0], [hw, yF, g1], "pz");
  for (const o of southG) {
    if (o.fill !== "glazing") continue;
    if (paved) k.spill(faceSG, o, fl, Math.max(paveEnd - g1, 1.0), true, PAVING_TOP + 0.015);
    else k.spill(faceSG, o, fl, 3.2);
  }

  /* ---- party joints: poché fillers close the gap to the neighbour ---- */
  // Each joint is built once (by the west unit, or by the east one when the
  // west unit is featured), and never by a featured house (exploded view).
  if (!spec.featured) {
    if (nb.east) partyFiller(k, plan, townhousePlan(nb.east), hw, yF, yR);
    if (nb.west?.featured) partyFiller(k, townhousePlan(nb.west), plan, -hw - PARTY_GAP, yF, yR);
  }

  /* ---- upper floor: cork ---- */
  let southU: Opening[];
  if (south) {
    const left = R() < 0.5;
    const bw = 2.7;
    const bu = left ? 0.75 : W - 0.75 - bw;
    const su = left ? W - 1.55 : 0.85;
    southU = [
      { u0: bu, u1: bu + bw, v0: 0.8, v1: 2.55, depth: 0.45, fill: "pane", mullions: 1, rand: R() },
      { u0: su, u1: su + 0.7, v0: 0.35, v1: 2.6, depth: 0.45, fill: "pane", rand: R() },
    ];
  } else {
    const left = R() < 0.5;
    const dw = 3.3;
    const d0 = left ? 0.6 : W - 0.6 - dw;
    const w0 = left ? W - 0.6 - 1.3 : 0.6;
    southU = [
      { u0: d0, u1: d0 + dw, v0: 0.14, v1: 2.6, depth: 0.4, fill: "glazing", mullions: 2, rand: R() },
      { u0: w0, u1: w0 + 1.3, v0: 1.0, v1: 2.35, depth: 0.45, fill: "pane", rand: R() },
    ];
  }
  const pattern = R();
  let northU: Opening[];
  if (pattern < 0.4) {
    northU = [
      { u0: 0.95, u1: 2.3, v0: 1.0, v1: 2.35, depth: 0.45, fill: "pane", rand: R() },
      { u0: W - 2.3, u1: W - 0.95, v0: 1.0, v1: 2.35, depth: 0.45, fill: "pane", rand: R() },
    ];
  } else if (pattern < 0.75) {
    const a = 0.8 + R() * 0.8;
    northU = [
      { u0: a, u1: a + 2.6, v0: 1.05, v1: 2.35, depth: 0.45, fill: "pane", mullions: 1, rand: R() },
      { u0: W - 1.5, u1: W - 0.9, v0: 0.35, v1: 2.6, depth: 0.45, fill: "pane", rand: R() },
    ];
  } else {
    northU = [0.9, 2.9, 4.9].map((a) => ({ u0: a, u1: a + 0.62, v0: 0.35, v1: 2.6, depth: 0.45, fill: "pane" as const, rand: R() }));
  }
  const sideU = (): Opening[] => [{ u0: uD * 0.5 - 0.65, u1: uD * 0.5 + 0.65, v0: 0.95, v1: 2.4, depth: 0.45, fill: "pane", rand: R() }];
  const lift = (list: Opening[]) => list.map((o) => ({ ...o, v0: o.v0 + ul, v1: o.v1 + ul }));
  k.volume(
    1,
    "cork",
    [ux0, yU, u0],
    [ux1, yR, u1],
    { pz: lift(southU), nz: lift(northU), px: nb.east ? [] : lift(sideU()), nx: nb.west ? [] : lift(sideU()) },
    [],
    { y0: yF + 0.14, y1: yR - 0.38 },
  );

  /* ---- interior partitions (seen only in the section) ---- */
  {
    const pr = mulberry32(spec.seed + 7); // own stream: the facade design stays as it was
    const xsN = (list: Opening[], x1: number) => list.map((o): [number, number] => [x1 - o.u1, x1 - o.u0]);
    k.partition(0, { x0: -hw + WALL, x1: hw - WALL, z0: g0 + WALL, z1: g1 - WALL, y0: 0.06, y1: yF - 0.32 }, xsN(northG, hw), pr);
    k.partition(1, { x0: ux0 + WALL, x1: ux1 - WALL, z0: u0 + WALL, z1: u1 - WALL, y0: yF + 0.14, y1: yR - 0.38 }, xsN(lift(northU), ux1), pr);
  }

  /* ---- roof terrace over the ground floor (terrace type) ---- */
  if (!south) {
    const faceSU = faceOf([ux0, yU, u0], [ux1, yR, u1], "pz");
    for (const o of lift(southU)) if (o.fill === "glazing") k.spill(faceSU, o, ul + 0.1, hd - 0.3 - u1, false);
    k.box(1, "timber", [ux0, yF - LEVEL_OVERLAP, u1 - 0.05], [ux1, yF + 0.1, hd - 0.12], ["ny"]);
    balustrade(k, 1, yF, [-hw, hd - 0.24], [hw, hd]);
    if (!nb.east) balustrade(k, 1, yF, [hw - 0.24, u1], [hw, hd - 0.24], ["nz", "pz"]);
    if (!nb.west) balustrade(k, 1, yF, [-hw, u1], [-hw + 0.24, hd - 0.24], ["nz", "pz"]);
  }

  /* ---- roof ---- */
  const cols = 3 + Math.floor(R() * 3);
  const rows = uD > 9 ? 2 : R() < 0.5 ? 2 : 1;
  const top = roof(k, rng, {
    x0: ux0,
    x1: ux1,
    z0: u0,
    z1: u1,
    y: yR,
    wall: "cork",
    solar: { cols, rows },
    skylights: R() < 0.65 ? 1 : 2,
    hatch: R() < 0.35,
    shared: { west: !!nb.west, east: !!nb.east },
  });
  k.envelope([ux0, yF, u0], [ux1, yR + PARAPET, u1], 0.08, yR + 0.08);

  k.levels = [
    { level: 0, y0: 0, y1: yF, footprint: { minX: -hw, maxX: hw, minZ: g0, maxZ: g1 } },
    { level: 1, y0: yF, y1: yR, footprint: { minX: -hw, maxX: hw, minZ: u0, maxZ: u1 } },
    { level: 2, y0: yR, y1: top, footprint: { minX: -hw, maxX: hw, minZ: u0, maxZ: u1 } },
  ];
  k.height = top;
}

/**
 * Close the joint between two townhouse units with thin closed boxes (ground
 * floor, upper floor + parapet, coping), each kept 0.5 mm clear of both
 * neighbours: the section cut reads as one continuous poché party wall, and
 * the roofs as one continuous coping. `xa` = the west unit's east ground face.
 */
function partyFiller(k: HouseKit, west: ReturnType<typeof townhousePlan>, east: ReturnType<typeof townhousePlan>, xa: number, yF: number, yR: number) {
  const cl = 0.0005;
  const xb = xa + PARTY_GAP;
  const gz0 = Math.max(west.g0, east.g0);
  const gz1 = Math.min(west.g1, east.g1);
  if (gz1 - gz0 > 0.2) k.box(0, "limestone", [xa + cl, -SINK, gz0], [xb - cl, yF, gz1]);
  const uz0 = Math.max(west.u0, east.u0);
  const uz1 = Math.min(west.u1, east.u1);
  if (uz1 - uz0 > 0.2) {
    const top = yR + PARAPET;
    k.box(1, "cork", [xa - UPPER_INSET + cl, yF + 0.001, uz0], [xb + UPPER_INSET - cl, top - cl, uz1]);
    k.box(2, "limestone", [xa - UPPER_INSET + cl, top, uz0 + 0.002], [xb + UPPER_INSET - cl, top + 0.05 - 0.001, uz1 - 0.002]);
  }
}

/* ------------------------------------------------------------------ villa */

function villa(spec: HouseSpec, k: HouseKit, rng: () => number) {
  // Built with the wing to the east, mirrored afterwards for the other hand.
  const hw = spec.width / 2; // 7.5
  const hd = spec.depth / 2; // 6
  const [f0, f1] = spec.floors;
  const y0 = -SINK;
  const yF = f0;
  const yU = f0 - LEVEL_OVERLAP;
  const yR = f0 + f1;
  const fl = SINK;
  const ul = LEVEL_OVERLAP;
  const R = () => rng();
  const s = Math.abs(spec.upperShift);

  const barZ1 = 0.6; // south face of the main bar
  const wingX0 = 2.3; // west face of the wing (looks onto the pool terrace)
  const upX0 = -hw - 1.2; // upper box cantilevers west…
  const upX1 = 3.7;
  const upZ0 = -5.6;
  const upZ1 = 2.6 + 0.4 * s; // …and south over the terrace
  const core = { x0: 3.6, x1: 5.8, z0: -hd - 0.3, z1: -3.9 };

  /* ---- ground: the L ---- */
  const barGlazing: Opening = { u0: 0.7, u1: wingX0 + hw - 0.5, v0: fl + 0.08, v1: fl + 2.85, depth: 0.32, fill: "glazing", mullions: 4, rand: R() };
  k.volume(0, "limestone", [-hw, y0, -hd], [hw, yF, barZ1], {
    pz: [barGlazing],
    nz: [
      { u0: 4.95, u1: 6.35, v0: fl + 0.05, v1: fl + 2.7, depth: 0.45, fill: "door", rand: R() },
      { u0: 7.2, u1: 7.8, v0: fl + 0.5, v1: fl + 2.75, depth: 0.32, fill: "pane", rand: R() },
      { u0: 9.6, u1: 12.6, v0: fl + 1.3, v1: fl + 2.45, depth: 0.32, fill: "pane", mullions: 2, rand: R() },
    ],
    nx: [{ u0: 2.2, u1: 4.7, v0: fl + 0.9, v1: fl + 2.45, depth: 0.32, fill: "pane", mullions: 1, rand: R() }],
    px: [{ u0: 2.0, u1: 3.6, v0: fl + 1.0, v1: fl + 2.4, depth: 0.32, fill: "pane", rand: R() }],
  }, [], { y0: 0.06, y1: yF - 0.32 });
  k.envelope([-hw, 0, -hd], [hw, yF, barZ1], 0);
  // The L-courtyard is a paved pool terrace (the landscape's deck carries it on to the pool).
  k.paving(0, -hw - 0.3, wingX0 + 0.05, barZ1 - 0.05, hd + 0.3);
  const pv = PAVING_TOP + 0.015;
  k.spill(faceOf([-hw, y0, -hd], [hw, yF, barZ1], "pz"), barGlazing, fl, 3.6, true, pv);
  const wingGlazing: Opening = { u0: 0.8, u1: 4.6, v0: fl + 0.08, v1: fl + 2.75, depth: 0.32, fill: "glazing", mullions: 2, rand: R() };
  k.volume(
    0,
    "limestone",
    [wingX0, y0, barZ1],
    [hw, yF, hd],
    {
      nx: [wingGlazing],
      pz: [{ u0: 1.4, u1: 3.8, v0: fl + 0.9, v1: fl + 2.5, depth: 0.32, fill: "pane", mullions: 1, rand: R() }],
      px: [{ u0: 1.2, u1: 1.9, v0: fl + 0.4, v1: fl + 2.7, depth: 0.32, fill: "pane", rand: R() }],
    },
    ["nz"],
    { y0: 0.06, y1: yF - 0.32 },
  );
  k.envelope([wingX0, 0, barZ1], [hw, yF, hd], 0.04);
  k.spill(faceOf([wingX0, y0, barZ1], [hw, yF, hd], "nx"), wingGlazing, fl, 3.0, true, pv);

  /* ---- elevator core: limestone, three stacked pieces (one per level) ---- */
  k.box(0, "limestone", [core.x0, y0, core.z0], [core.x1, yF - 0.005, core.z1]);
  k.box(1, "limestone", [core.x0 + 0.01, yU, core.z0 + 0.01], [core.x1 - 0.01, yR, core.z1 - 0.01]);
  const coreTop = yR + 1.15;
  k.box(2, "limestone", [core.x0 + 0.02, yR - LEVEL_OVERLAP, core.z0 + 0.02], [core.x1 - 0.02, coreTop, core.z1 - 0.02]);
  k.b(2, "frame").capBox([core.x0 - 0.03, coreTop, core.z0 - 0.03], [core.x1 + 0.03, coreTop + 0.05, core.z1 + 0.03], [core.x0 + 0.02, core.x1 - 0.02, core.z0 + 0.02, core.z1 - 0.02]);
  k.envelope([core.x0, 0, core.z0], [core.x1, coreTop, core.z1], 0.12);

  /* ---- upper: cork box cantilevering west and over the terrace ---- */
  const UW = upX1 - upX0;
  const lift = (list: Opening[]) => list.map((o) => ({ ...o, v0: o.v0 + ul, v1: o.v1 + ul }));
  const up: Partial<Record<"px" | "nx" | "pz" | "nz", Opening[]>> = {
    pz: [
      { u0: 1.4, u1: 4.2, v0: 0.8, v1: 2.6, depth: 0.45, fill: "pane", mullions: 1, rand: R() },
      { u0: 5.4, u1: 6.0, v0: 0.35, v1: 2.7, depth: 0.45, fill: "pane", rand: R() },
      { u0: 7.4, u1: 10.2, v0: 0.8, v1: 2.6, depth: 0.45, fill: "pane", mullions: 1, rand: R() },
    ],
    px: [
      { u0: 0.8, u1: 3.4, v0: 0.14, v1: 2.6, depth: 0.45, fill: "glazing", mullions: 1, rand: R() },
      { u0: 4.4, u1: 5.8, v0: 1.0, v1: 2.4, depth: 0.45, fill: "pane", rand: R() },
    ],
    nz: [
      { u0: 2.2, u1: 3.6, v0: 1.0, v1: 2.3, depth: 0.45, fill: "pane", rand: R() },
      { u0: 5.6, u1: 7.0, v0: 1.0, v1: 2.3, depth: 0.45, fill: "pane", rand: R() },
      { u0: UW - 2.6, u1: UW - 2.0, v0: 0.4, v1: 2.7, depth: 0.45, fill: "pane", rand: R() },
    ],
    nx: [{ u0: (upZ1 - upZ0) * 0.45, u1: (upZ1 - upZ0) * 0.45 + 1.2, v0: 0.3, v1: 2.7, depth: 0.45, fill: "pane", rand: R() }],
  };
  const upPx = lift(up.px!);
  k.volume(1, "cork", [upX0, yU, upZ0], [upX1, yR, upZ1], { pz: lift(up.pz!), px: upPx, nz: lift(up.nz!), nx: lift(up.nx!) }, [], {
    y0: yF + 0.14,
    y1: yR - 0.38,
  });
  k.spill(faceOf([upX0, yU, upZ0], [upX1, yR, upZ1], "px"), upPx[0], ul + 0.1, hw - 0.3 - upX1, false);

  /* ---- deck over the wing and the bar's east end, glass all round ---- */
  k.box(1, "timber", [wingX0 + 0.12, yF, upZ1], [hw - 0.12, yF + 0.1, hd - 0.12], ["ny", "nz"]);
  k.box(1, "timber", [upX1, yF, -hd], [hw - 0.12, yF + 0.1, upZ1], ["ny", "nx", "pz"]);
  balustrade(k, 1, yF, [wingX0, hd - 0.24], [hw, hd]);
  balustrade(k, 1, yF, [hw - 0.24, -hd], [hw, hd - 0.24], ["pz"]);
  balustrade(k, 1, yF, [wingX0, upZ1], [wingX0 + 0.24, hd - 0.24], ["nz", "pz"]);

  /* ---- roof ---- */
  const top = roof(k, rng, {
    x0: upX0,
    x1: upX1,
    z0: upZ0,
    z1: upZ1,
    y: yR,
    wall: "cork",
    solar: { cols: 6 + Math.floor(R() * 2), rows: 2 },
    skylights: 2,
    hatch: false,
  });
  k.envelope([upX0, yF, upZ0], [upX1, yR + 0.5, upZ1], 0.08, yR + 0.08);

  k.levels = [
    { level: 0, y0: 0, y1: yF, footprint: { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd } },
    { level: 1, y0: yF, y1: yR, footprint: { minX: upX0, maxX: hw, minZ: -hd, maxZ: hd } },
    { level: 2, y0: yR, y1: Math.max(top, coreTop + 0.05), footprint: { minX: upX0, maxX: core.x1, minZ: -hd - 0.3, maxZ: upZ1 } },
  ];
  k.height = Math.max(top, coreTop + 0.05);
  if (spec.upperShift < 0) k.mirrorX();
}

/* ---------------------------------------------------------------- pavilion */

/** The village-heart pavilion (fitness + silent cowork) as a pseudo house spec. */
export const PAVILION_SPEC: HouseSpec = (() => {
  const p = VILLAGE_HEART.pavilion;
  const heart = { x: -10, z: -6 };
  return {
    id: "heart-pavilion",
    type: "v3",
    x: p.x,
    z: p.z,
    y: p.y,
    rotY: 0,
    width: p.width,
    depth: p.depth,
    floors: [p.height],
    upperShift: 0,
    row: "C",
    block: -1,
    delay: clamp01((Math.hypot(p.x - heart.x, p.z - heart.z) / 75) * 0.85),
    lightDelay: 0.0,
    seed: 4242,
    featured: false,
  };
})();

function pavilion(spec: HouseSpec, k: HouseKit, rng: () => number) {
  const hw = spec.width / 2;
  const hd = spec.depth / 2;
  const y0 = -SINK;
  const fl = SINK;
  const bodyTop = spec.floors[0] - 0.35; // 3.05
  // Lit glazing: re-roll the random until the window is one that switches on.
  const lit = () => {
    for (;;) {
      const r = rng();
      if ((r * 7.31 + 0.13) % 1 < 0.55) return r;
    }
  };
  const pzG: Opening[] = [
    { u0: 2.0, u1: 6.6, v0: fl + 0.08, v1: fl + 2.55, depth: 0.4, fill: "glazing", mullions: 3, rand: lit() },
    { u0: 8.4, u1: 13.0, v0: fl + 0.08, v1: fl + 2.55, depth: 0.4, fill: "glazing", mullions: 3, rand: lit() },
  ];
  const pxG: Opening = { u0: 1.0, u1: 7.0, v0: fl + 0.08, v1: fl + 2.55, depth: 0.4, fill: "glazing", mullions: 3, rand: lit() };
  k.volume(0, "limestone", [-hw, y0, -hd], [hw, bodyTop, hd], {
    pz: pzG,
    nz: [
      { u0: 1.4, u1: 9.2, v0: fl + 1.85, v1: fl + 2.5, depth: 0.35, fill: "pane", mullions: 5, rand: lit() },
      { u0: 10.5, u1: 12.0, v0: fl + 0.05, v1: fl + 2.5, depth: 0.45, fill: "door", rand: rng() },
    ],
    px: [pxG],
    nx: [{ u0: 3.0, u1: 3.6, v0: fl + 0.3, v1: fl + 2.55, depth: 0.35, fill: "pane", rand: lit() }],
  }, [], { y0: 0.06, y1: bodyTop - 0.3 });
  k.envelope([-hw, 0, -hd], [hw, bodyTop, hd], 0);
  // Fitness | cowork divider, on the pier between the two glazed bays.
  {
    const xm = -hw + (pzG[0].u1 + pzG[1].u0) / 2;
    const b = k.b(0, "limestone");
    b.winAttr = [-1, ROLE.interior];
    b.box([xm - 0.07, 0.062, -hd + WALL + 0.002], [xm + 0.07, bodyTop - 0.302, hd - WALL - 0.002]);
    b.winAttr = [-1, ROLE.wall];
  }
  for (const o of pzG) k.spill(faceOf([-hw, y0, -hd], [hw, bodyTop, hd], "pz"), o, fl, 3.4);
  k.spill(faceOf([-hw, y0, -hd], [hw, bodyTop, hd], "px"), pxG, fl, 3.4);
  // Slender roof: a timber soffit band under a limestone slab, overhanging all round.
  const o = 0.9;
  k.b(1, "timber").capBox([-hw - o, bodyTop - 0.12, -hd - o], [hw + o, bodyTop + 0.05, hd + o], [-hw, hw, -hd, hd]);
  k.box(1, "limestone", [-hw - o, bodyTop + 0.05, -hd - o], [hw + o, bodyTop + 0.3, hd + o], ["ny"]);
  k.box(1, "roof", [-hw - o + 0.35, bodyTop + 0.3, -hd - o + 0.35], [hw + o - 0.35, bodyTop + 0.32, hd + o - 0.35], ["ny"]);
  k.envelope([-hw - o, bodyTop - 0.12, -hd - o], [hw + o, bodyTop + 0.3, hd + o], 0.1);
  k.levels = [
    { level: 0, y0: 0, y1: bodyTop, footprint: { minX: -hw, maxX: hw, minZ: -hd, maxZ: hd } },
    { level: 1, y0: bodyTop, y1: bodyTop + 0.32, footprint: { minX: -hw - o, maxX: hw + o, minZ: -hd - o, maxZ: hd + o } },
  ];
  k.height = bodyTop + 0.32;
}

/* --------------------------------------------------------------- the API */

function construct(spec: HouseSpec, options: BuildHouseOptions = {}) {
  const animate = options.animate ?? true;
  const rand = (spec.seed % 9973) / 9973;
  const k = new HouseKit([0, animate ? spec.delay : -10, spec.lightDelay, rand], spec.delay);
  // Villas with a negative shift are built east-handed and mirrored at the end.
  const mx = spec.type === "v4" && spec.id !== PAVILION_SPEC.id && spec.upperShift < 0 ? -1 : 1;
  const c = Math.cos(spec.rotY);
  const sn = Math.sin(spec.rotY);
  k.ground = (lx, lz) => {
    const x = mx * lx;
    return heightAt(spec.x + c * x + sn * lz, spec.z - sn * x + c * lz) - spec.y;
  };
  const rng = mulberry32(spec.seed);
  if (spec.id === PAVILION_SPEC.id) pavilion(spec, k, rng);
  else if (spec.type === "v4") villa(spec, k, rng);
  else townhouse(spec, k, rng);
  return k;
}

/**
 * Build one house in house-local coordinates (origin at footprint centre,
 * ground y = 0, facing +Z). Pure and deterministic (same spec → same house).
 * Returns one part per (level, material); dispose the geometries when done.
 */
export function buildHouse(spec: HouseSpec, options: BuildHouseOptions = {}): HouseBuild {
  const k = construct(spec, options);
  const out: HouseBuild = { spec, parts: k.parts(), levels: k.levels, height: k.height, spill: k.spillB.isEmpty() ? null : k.spillB.build() };
  if (options.drawing) {
    out.lines = k.lines.build();
    out.mask = k.mask.build();
  }
  return out;
}

/**
 * The architect's line drawing of a house (LineSegments geometry, house-local),
 * for getHouseLineMaterial(). Volumes, openings, roof, terraces, garden walls.
 */
export function buildHouseLines(spec: HouseSpec): BufferGeometry {
  return construct(spec).lines.build();
}
// (Prefer buildHouse(spec, { drawing: true }) when you also need the meshes: one construct.)

/**
 * Hidden-line mask for buildHouseLines() (house-local): depth-only envelope
 * boxes for getHouseMaskMaterial(). The mask material is transparent (so it
 * never punches holes in other modules' transparent objects): give the mask
 * mesh renderOrder 998 and the lines 999, and show them only while the
 * drawing is on screen.
 */
export function buildHouseMask(spec: HouseSpec): BufferGeometry {
  return construct(spec).mask.build();
}

/** Local → world placement matrix for a spec. */
export function houseMatrix(spec: Pick<HouseSpec, "x" | "y" | "z" | "rotY">, out = new Matrix4()) {
  return out.makeRotationY(spec.rotY).setPosition(spec.x, spec.y, spec.z);
}

export interface VillageHouses {
  /** One merged world-space geometry per material (null if unused). */
  meshes: Partial<Record<HouseMaterialKey, BufferGeometry>>;
  /** Merged world-space line drawing (screen-space hairline quads). */
  lines: BufferGeometry;
  /** Merged hidden-line mask (depth-only envelopes). */
  mask: BufferGeometry;
  /** Merged night light pools. */
  spill: BufferGeometry | null;
}

/**
 * Every non-featured house plus the village-heart pavilion, merged per
 * material in world space (aHouse.x = the house's pad y, so the rise still
 * happens per house in the shader).
 */
export function buildVillageHouses(include: (spec: HouseSpec) => boolean = (h) => !h.featured, withPavilion = true): VillageHouses {
  const specs = [...HOUSES.filter(include), ...(withPavilion ? [PAVILION_SPEC] : [])];
  const perMat = new Map<HouseMaterialKey, BufferGeometry[]>();
  const lineGeos: BufferGeometry[] = [];
  const maskGeos: BufferGeometry[] = [];
  const spillGeos: BufferGeometry[] = [];
  const m = new Matrix4();
  for (const spec of specs) {
    const k = construct(spec);
    houseMatrix(spec, m);
    for (const part of k.parts()) {
      const g = part.geometry;
      g.applyMatrix4(m);
      const ah = g.getAttribute("aHouse");
      for (let i = 0; i < ah.count; i++) ah.setX(i, spec.y);
      if (!perMat.has(part.material)) perMat.set(part.material, []);
      perMat.get(part.material)!.push(g);
    }
    lineGeos.push(k.lines.build(m));
    const mg = k.mask.build();
    mg.applyMatrix4(m);
    const am = mg.getAttribute("aMask");
    for (let i = 0; i < am.count; i++) am.setW(i, spec.y);
    maskGeos.push(mg);
    if (!k.spillB.isEmpty()) {
      const sg = k.spillB.build();
      sg.applyMatrix4(m);
      const sa = sg.getAttribute("aHouse");
      for (let i = 0; i < sa.count; i++) sa.setX(i, spec.y);
      spillGeos.push(sg);
    }
  }
  const meshes: Partial<Record<HouseMaterialKey, BufferGeometry>> = {};
  for (const [mat, list] of perMat) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (merged) {
      merged.computeBoundingSphere();
      meshes[mat] = merged;
    }
  }
  const lines = mergeGeometries(lineGeos, false)!;
  lineGeos.forEach((g) => g.dispose());
  const mask = mergeGeometries(maskGeos, false)!;
  maskGeos.forEach((g) => g.dispose());
  const spill = spillGeos.length ? mergeGeometries(spillGeos, false) : null;
  spillGeos.forEach((g) => g.dispose());
  return { meshes, lines, mask, spill };
}

