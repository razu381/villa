/**
 * Everything a featured home needs, built once: the house (per level, with
 * the low garden pieces of the ground floor split off so the plan cut never
 * touches them), its line drawing, night spill per level, the interiors, the
 * exploded-view guides and the jewel's leader line.
 */

import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildHouse, type HouseBuild, type HouseLevel, type HouseMaterialKey } from "@/canvas/world/houses/architecture";
import { LineCollector } from "@/canvas/world/houses/kit";
import type { HomeId } from "@/lib/store";
import { FEATURED } from "@/lib/village";
import { splitTriangles } from "./geometry";
import { buildInterior, type InteriorLevel } from "./interiors";

/** Material set used by a part: 0/1 = that level's plan cut, 2 = never cut. */
export type CutSet = 0 | 1 | 2;

export interface HomePart {
  geometry: BufferGeometry;
  material: HouseMaterialKey;
  set: CutSet;
}

export interface HomeData {
  id: HomeId;
  build: HouseBuild;
  /** Per level (0 ground · 1 upper · 2 roof) — drawn while the home is open. */
  levels: { level: HouseLevel; parts: HomePart[]; spill: BufferGeometry | null; interior: InteriorLevel | null }[];
  /** The closed home: one mesh per material across all levels (fewer draw calls). */
  merged: { geometry: BufferGeometry; material: HouseMaterialKey }[];
  lines: BufferGeometry;
  mask: BufferGeometry;
  /** Unit-height dashed verticals at the upper level's / the roof's corners (scaled per gap). */
  guides: [BufferGeometry, BufferGeometry];
  /** Unit-height leader line for the jewel marker. */
  leader: BufferGeometry;
  /** The jewel's setting: a golden hairline around the plot at ground level, corners crossing like a draughtsman's. */
  plot: BufferGeometry;
  /** The plot (all parts, garden included), local: min/max x and z. */
  plotBox: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Footprint (union of levels) centre and half extents, local. */
  box: { cx: number; cz: number; hx: number; hz: number; height: number };
  /** How far the upper floor and the roof lift in the exploded view. */
  lift: [number, number];
  /** Level tops (local), where a cut plane is "off" for that level. */
  tops: [number, number];
}

const disposeAll: Map<HomeId, HomeData> = new Map();

export function buildHomeData(id: HomeId): HomeData {
  const cached = disposeAll.get(id);
  if (cached) return cached;
  const spec = FEATURED[id];
  const build = buildHouse(spec, { drawing: true });
  const [l0, l1] = build.levels;
  const fp = l0.footprint;
  // Low pieces outside the ground floor's plan (garden walls, paving) are never cut.
  const outside = (x: number, z: number) => x < fp.minX - 0.02 || x > fp.maxX + 0.02 || z < fp.minZ - 0.02 || z > fp.maxZ + 0.02;
  const levels: HomeData["levels"] = [0, 1, 2].map((lv) => ({ level: lv as HouseLevel, parts: [] as HomePart[], spill: null, interior: null }));
  for (const p of build.parts) {
    if (p.level === 0) {
      const [keep, cut] = splitTriangles(p.geometry, (cx, _cy, cz, maxY) => maxY < 1.75 && outside(cx, cz));
      if (cut) levels[0].parts.push({ geometry: cut, material: p.material, set: 0 });
      if (keep) levels[0].parts.push({ geometry: keep, material: p.material, set: 2 });
    } else {
      levels[p.level].parts.push({ geometry: p.geometry, material: p.material, set: p.level === 1 ? 1 : 2 });
    }
  }
  if (build.spill) {
    const [upper, ground] = splitTriangles(build.spill, (_cx, _cy, _cz, _maxY, minY) => minY > l1.y0 - 0.4);
    levels[0].spill = ground;
    levels[1].spill = upper;
  }
  const byMat = new Map<HouseMaterialKey, BufferGeometry[]>();
  for (const p of build.parts) {
    if (!byMat.has(p.material)) byMat.set(p.material, []);
    byMat.get(p.material)!.push(p.geometry);
  }
  const merged: HomeData["merged"] = [];
  for (const [material, list] of byMat) {
    const g = list.length === 1 ? list[0].clone() : mergeGeometries(list, false);
    if (!g) continue;
    g.computeBoundingSphere();
    merged.push({ geometry: g, material });
  }
  const interiors = buildInterior(id, build);
  levels[0].interior = interiors[0] ?? null;
  levels[1].interior = interiors[1] ?? null;

  // Footprint union.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const l of build.levels) {
    minX = Math.min(minX, l.footprint.minX);
    maxX = Math.max(maxX, l.footprint.maxX);
    minZ = Math.min(minZ, l.footprint.minZ);
    maxZ = Math.max(maxZ, l.footprint.maxZ);
  }

  // Exploded-view guides: dashed verticals projecting each lifted level's
  // corners down to the one below (unit height, scaled per gap each frame).
  const guides = [l1.footprint, build.levels[2].footprint].map((f) => {
    const g = new LineCollector();
    g.delay = 0.32; // dash period (m)
    const corners: [number, number][] = [
      [f.minX, f.minZ],
      [f.maxX, f.minZ],
      [f.maxX, f.maxZ],
      [f.minX, f.maxZ],
    ];
    corners.forEach(([x, z], i) => g.seg([x, 1, z], [x, 0, z], i * 0.08, 0.5));
    return g.build();
  }) as [BufferGeometry, BufferGeometry];
  const leader = new LineCollector();
  leader.seg([0, 0, 0], [0, 1, 0], 0, 1);

  // The plot: every part of the house, garden walls and paving included.
  const pb = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of build.parts) {
    p.geometry.computeBoundingBox();
    const b = p.geometry.boundingBox!;
    pb.minX = Math.min(pb.minX, b.min.x);
    pb.maxX = Math.max(pb.maxX, b.max.x);
    pb.minZ = Math.min(pb.minZ, b.min.z);
    pb.maxZ = Math.max(pb.maxZ, b.max.z);
  }
  const plot = new LineCollector();
  {
    const m = 0.7; // margin outside the plot
    const o = 0.9; // corner overshoot
    const y = 0.07;
    const x0 = pb.minX - m;
    const x1 = pb.maxX + m;
    const z0 = pb.minZ - m;
    const z1 = pb.maxZ + m;
    // Drawn as one pen stroke round the plot, each side crossing the next corner.
    plot.seg([x0 - o, y, z1], [x1 + o, y, z1], 0.0, 0.34);
    plot.seg([x1, y, z1 + o], [x1, y, z0 - o], 0.22, 0.34);
    plot.seg([x1 + o, y, z0], [x0 - o, y, z0], 0.44, 0.34);
    plot.seg([x0, y, z0 - o], [x0, y, z1 + o], 0.66, 0.34);
  }

  const data: HomeData = {
    id,
    build,
    levels,
    merged,
    lines: build.lines!,
    mask: build.mask!,
    guides,
    leader: leader.build(),
    plot: plot.build(),
    plotBox: pb,
    box: { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2, height: build.height },
    lift: id === "v3" ? [5.6, 10.8] : [5.8, 11.0],
    tops: [l0.y1 + 0.5, l1.y1 + 0.5],
  };
  disposeAll.set(id, data);
  return data;
}

/** Free the GPU-side geometry of a home (called on unmount; the next mount rebuilds). */
export function disposeHomeData(id: HomeId) {
  const d = disposeAll.get(id);
  if (!d) return;
  disposeAll.delete(id);
  const seen = new Set<BufferGeometry>();
  const add = (g: BufferGeometry | null | undefined) => g && seen.add(g);
  for (const l of d.levels) {
    l.parts.forEach((p) => add(p.geometry));
    add(l.spill);
    if (l.interior) {
      add(l.interior.furniture);
      add(l.interior.lamps);
      add(l.interior.pools);
      add(l.interior.plan);
    }
  }
  [d.lines, d.mask, ...d.guides, d.leader, d.plot].forEach(add);
  d.merged.forEach((m) => add(m.geometry));
  d.build.parts.forEach((p) => add(p.geometry));
  add(d.build.spill);
  seen.forEach((g) => g.dispose());
}
