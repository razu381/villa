/**
 * GLSL description of the site plan, generated from lib/village.ts:
 * podium SDF, pedestrian paths, house footprints, pool decks, street,
 * driveway, playground. Shared by the terrain and table shaders.
 */
import { Color, Vector4 } from "three";
import { HOUSES, PATHS, PATH_WIDTH, PLAYGROUND, PODIUM, STREET, VILLAGE_HEART, VILLA_POOLS } from "@/lib/village";
import { f } from "../landscape/shaderUtils";
import { BASTION, PORTAL, STEPS, TERRACE_WALL } from "./ground";

/** sRGB hex → linear GLSL vec3 literal. */
export function lin(hex: string) {
  const c = new Color(hex);
  return `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
}

const PODIUM_C = [(PODIUM.minX + PODIUM.maxX) / 2, (PODIUM.minZ + PODIUM.maxZ) / 2];
const PODIUM_H = [(PODIUM.maxX - PODIUM.minX) / 2, (PODIUM.maxZ - PODIUM.minZ) / 2];

/** Path segments (ax, az, bx, bz). */
export const PATH_SEGMENTS: Vector4[] = PATHS.flatMap((p) =>
  p.slice(0, -1).map((a, i) => new Vector4(a[0], a[1], p[i + 1][0], p[i + 1][1])),
);
/** House footprints (x, z, halfWidth, halfDepth). */
export const HOUSE_RECTS: Vector4[] = HOUSES.map((h) => new Vector4(h.x, h.z, h.width / 2, h.depth / 2));

const pool = VILLAGE_HEART.pool;
const pav = VILLAGE_HEART.pavilion;

/** Paved areas: the communal pool plaza + villa pool terraces (cx, cz, hx, hz). */
export const DECKS: [number, number, number, number][] = [
  [pool.x, pool.z, pool.width / 2 + 3.2, pool.depth / 2 + 3.0],
  [pav.x, pav.z, pav.width / 2 + 2.6, pav.depth / 2 + 2.4],
  [(pav.x + pav.width / 2 + pool.x - pool.width / 2) / 2, pool.z, 4, pool.depth / 2 + 3.0],
  ...VILLA_POOLS.map((p): [number, number, number, number] => {
    const h = HOUSES.find((hh) => hh.id === p.houseId)!;
    const z0 = h.z + h.depth / 2;
    const z1 = p.z + p.depth / 2 + 0.9;
    return [p.x, (z0 + z1) / 2, p.width / 2 + 0.9, (z1 - z0) / 2];
  }),
];

export const SITE_GLSL = /* glsl */ `
#define TR_NSEG ${PATH_SEGMENTS.length}
#define TR_NHOUSE ${HOUSE_RECTS.length}
#define TR_PATH_HALF ${f(PATH_WIDTH / 2)}
uniform vec4 uTrSegs[TR_NSEG];
uniform vec4 uTrHouses[TR_NHOUSE];

float tr_box(vec2 p, vec2 c, vec2 h) {
  vec2 q = abs(p - c) - h;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
float tr_podium(vec2 p) {
  return tr_box(p, vec2(${f(PODIUM_C[0])}, ${f(PODIUM_C[1])}), vec2(${f(PODIUM_H[0] - PODIUM.radius)}, ${f(PODIUM_H[1] - PODIUM.radius)})) - ${f(PODIUM.radius)};
}
/** Signed distance to the nearest path edge (negative on the path); l = (along, across). */
float tr_paths(vec2 p, out vec2 l) {
  float best = 1e9;
  l = vec2(0.0);
  for (int i = 0; i < TR_NSEG; i++) {
    vec4 s = uTrSegs[i];
    vec2 ab = s.zw - s.xy;
    float L = length(ab);
    vec2 dir = ab / L;
    float t = dot(p - s.xy, dir);
    vec2 q = s.xy + dir * clamp(t, 0.0, L);
    float d = length(p - q);
    if (d < best) {
      best = d;
      // world-anchored along coordinate (paths are axis aligned)
      float along = abs(dir.x) > 0.5 ? p.x : p.y;
      float across = abs(dir.x) > 0.5 ? p.y - s.y : p.x - s.x;
      l = vec2(along, across);
    }
  }
  return best - TR_PATH_HALF;
}
float tr_decks(vec2 p) {
  float d = 1e9;
  ${DECKS.map((d) => `d = min(d, tr_box(p, vec2(${f(d[0])}, ${f(d[1])}), vec2(${f(d[2])}, ${f(d[3])})) - 0.15);`).join("\n  ")}
  return d;
}
float tr_playground(vec2 p) {
  return tr_box(p, vec2(${f((PLAYGROUND.minX + PLAYGROUND.maxX) / 2)}, ${f((PLAYGROUND.minZ + PLAYGROUND.maxZ) / 2)}),
                vec2(${f((PLAYGROUND.maxX - PLAYGROUND.minX) / 2 - 3.0)}, ${f((PLAYGROUND.maxZ - PLAYGROUND.minZ) / 2 - 3.0)})) - 3.0;
}
/** Nearest house footprint distance (positive outside). */
float tr_houses(vec2 p) {
  float d = 1e9;
  for (int i = 0; i < TR_NHOUSE; i++) {
    vec4 h = uTrHouses[i];
    d = min(d, tr_box(p, h.xy, h.zw));
  }
  return d;
}
#define TR_STREET_Z ${f(STREET.z)}
#define TR_PORTAL_CX ${f(PORTAL.cx)}
#define TR_PORTAL_HALF ${f((PORTAL.maxX - PORTAL.minX) / 2)}
#define TR_PORTAL_BACK ${f(PORTAL.back)}
#define TR_PODIUM_MAXZ ${f(PODIUM.maxZ)}
#define TR_PODIUM_MINX ${f(PODIUM.minX)}
#define TR_PODIUM_MAXX ${f(PODIUM.maxX)}
#define TR_BASTION_IN ${f(BASTION.inner)}
#define TR_BASTION_OUT ${f(BASTION.outer)}
#define TR_TW_HALF ${f(TERRACE_WALL.half)}
const float TR_STEPS[${STEPS.length}] = float[](${STEPS.map((s) => f(s.z)).join(", ")});
`;

export const siteUniforms = () => ({
  uTrSegs: { value: PATH_SEGMENTS },
  uTrHouses: { value: HOUSE_RECTS },
});
