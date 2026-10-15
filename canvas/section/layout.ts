/**
 * Section-chapter layout, derived from the shared contract (lib/village.ts):
 * the garage hall's structure, its light, the tunnel and the portal opening,
 * which bays hold parked cars and which ones the arriving cars take.
 *
 * Everything here is plain data (metres, world space) — shared by the
 * geometry builders, the shaders (as GLSL constants) and the animation.
 */
import { CAR_ROUTE, GARAGE, PARKING_BAYS, PODIUM, TUNNEL } from "@/lib/village";
import { BASTION, PORTAL } from "../world/terrain/ground";
import { f } from "../world/landscape/shaderUtils";

/* ------------------------------------------------------------ structure */

/** Slab and wall thickness — read as poché where the section cuts them. */
export const SHELL = { roof: 0.62, base: 0.5, wall: 0.42 } as const;

/** The hall's clear interior (the contract's GARAGE bounds). */
export const HALL = { x0: GARAGE.minX, x1: GARAGE.maxX, z0: GARAGE.minZ, z1: GARAGE.maxZ, y0: GARAGE.floor, y1: GARAGE.ceiling } as const;

/** The hall's structural outline (slabs + walls). */
export const HALL_OUT = {
  x0: HALL.x0 - SHELL.wall,
  x1: HALL.x1 + SHELL.wall,
  z0: HALL.z0 - SHELL.wall,
  z1: HALL.z1 + SHELL.wall,
  y0: HALL.y0 - SHELL.base,
  y1: HALL.y1 + SHELL.roof,
} as const;

/** The portal recess (built by the landscape): its back plane and the opening seen through it. */
export const PORTAL_Z = PODIUM.maxZ + PORTAL.back;
export const PORTAL_MOUTH_Z = PODIUM.maxZ + BASTION.outer + 0.2;
export const OPENING = {
  x0: PORTAL.minX + 0.08,
  x1: PORTAL.maxX - 0.08,
  y0: PORTAL.floor,
  y1: PORTAL.top - 0.012,
} as const;

/** The tunnel: from the portal's back plane to the hall, level with the street at the portal. */
export const TUBE = {
  x0: TUNNEL.minX,
  x1: TUNNEL.maxX,
  z0: HALL.z1,
  z1: PORTAL_Z,
  yPortal: PORTAL.floor,
  yHall: HALL.y0,
  y1: TUNNEL.ceiling,
} as const;
export const TUBE_OUT = { x0: TUBE.x0 - SHELL.wall, x1: TUBE.x1 + SHELL.wall, y0: TUBE.yPortal - SHELL.base, y1: TUBE.y1 + 0.55 } as const;

/** Tunnel floor height along z (a barely-there ramp from the street up to the hall floor). */
export const tubeFloorY = (z: number) => {
  const k = Math.min(1, Math.max(0, (TUBE.z1 - z) / (TUBE.z1 - TUBE.z0)));
  return TUBE.yPortal + (TUBE.yHall - TUBE.yPortal) * k;
};

/* ------------------------------------------------------------- the grid */

/** Bay pitch along the aisle and the column bays (one column every three cars). */
export const BAY_W = 3.0;
export const BAY_D = 5.0;
export const BAY_ROWS = { north: -10.5, south: 2.5 } as const;
export const PARKING_BAY_X0 = Math.min(...PARKING_BAYS.map((b) => b.x)) - BAY_W / 2;
export const PARKING_BAY_X1 = Math.max(...PARKING_BAYS.map((b) => b.x)) + BAY_W / 2;
export const AISLE_Z = -4.0;

/** Slender round columns: between every third bay, in four lines across the hall. */
export const COLUMN_R = 0.21;
export const COLUMN_X: number[] = (() => {
  const out: number[] = [];
  for (let x = PARKING_BAYS[0].x - BAY_W / 2; x < HALL.x1 - 1; x += BAY_W * 3) out.push(x);
  return out;
})();
export const COLUMN_Z = [BAY_ROWS.south - BAY_D / 2 + 0.55, BAY_ROWS.north + BAY_D / 2 - 0.55];

/** Linear light strips in the soffit over the aisle, one per column bay (gaps at the columns). */
export const STRIPS_Z = [AISLE_Z + 2.0, AISLE_Z - 2.0];
export const STRIP = { y: HALL.y1 - 0.05, w: 0.26, gap: 1.3 } as const;
export const STRIP_SEGMENTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  const xs = [COLUMN_X[0] - BAY_W * 3, ...COLUMN_X];
  for (let i = 0; i < xs.length - 1; i++) out.push([xs[i] + STRIP.gap, xs[i + 1] - STRIP.gap]);
  out.push([xs[xs.length - 1] + STRIP.gap, HALL.x1 - 0.8]);
  return out.filter(([a, b]) => b - a > 1 && a > HALL.x0 + 0.5);
})();
/** Wall washers along the back wall, one per column bay — scallops of warm light. */
export const WASHERS_X: number[] = (() => {
  const xs = [COLUMN_X[0] - BAY_W * 3, ...COLUMN_X, COLUMN_X[COLUMN_X.length - 1] + BAY_W * 3];
  const out: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const m = (xs[i] + xs[i + 1]) / 2;
    if (m > HALL.x0 + 1.5 && m < HALL.x1 - 1.5) out.push(m);
  }
  return out;
})();
/** The tunnel's strip, along z on its axis. */
export const TUBE_STRIP = { x: (TUBE.x0 + TUBE.x1) / 2, z0: TUBE.z0 + 0.6, z1: TUBE.z1 - 0.4, y: TUBE.y1 - 0.05, w: 0.2 } as const;

/** Lift and stair cores against the back wall, on the column lines under the row-B houses — the way home. */
export const CORES = [COLUMN_X[1], COLUMN_X[4], COLUMN_X[7]].map((x) => ({ x, z0: HALL.z0, z1: HALL.z0 + 2.7, w: 3.2 }));

/* ------------------------------------------------------------------ cars */

export const CAR = { length: 4.5, width: 1.84, height: 1.44 } as const;

/** Muted model-car paints: champagne, graphite, ivory, deep olive, bronze, stone. */
export const CAR_PAINTS = ["#C9B593", "#4B4C4D", "#E4DDCD", "#5E6440", "#8B6A4B", "#A9A398", "#3A3D3E", "#B9AE98"];

/** Arriving cars: target bay (x, row) and their order of arrival. */
export const ARRIVALS: { bayX: number; row: "north" | "south"; paint: number }[] = [
  { bayX: -1, row: "south", paint: 0 },
  { bayX: -13, row: "north", paint: 2 },
  { bayX: -19, row: "south", paint: 4 },
  { bayX: -28, row: "north", paint: 3 },
];

/** Bays that already hold a car (x, row) — the centre of the south row is kept clear for the view. */
export const PARKED: { x: number; row: "north" | "south" }[] = (() => {
  // the rows never park at the same x, so the elevation reads one car per bay — a calm rhythm
  const north = [-46, -43, -37, -34, -22, -10, -7, 5, 8, 20, 23];
  const south = [-40, -31, -4, 11, 14, 26, 29];
  const taken = new Set(ARRIVALS.map((a) => `${a.row}:${a.bayX}`));
  return [
    ...north.map((x) => ({ x, row: "north" as const })),
    ...south.map((x) => ({ x, row: "south" as const })),
  ].filter((b) => !taken.has(`${b.row}:${b.x}`));
})();

/** Car route as (x, z): street → portal → tunnel → hall aisle (CAR_ROUTE up to the aisle). */
export const ROUTE_IN: [number, number][] = CAR_ROUTE.slice(0, 8);

/* ------------------------------------------------------------- GLSL defs */

export const SECTION_DEFS_GLSL = /* glsl */ `
#define SEC_PZ ${f(PORTAL_Z)}
#define SEC_OX0 ${f(OPENING.x0)}
#define SEC_OX1 ${f(OPENING.x1)}
#define SEC_OY0 ${f(OPENING.y0)}
#define SEC_OY1 ${f(OPENING.y1)}
#define SEC_HX0 ${f(HALL.x0)}
#define SEC_HX1 ${f(HALL.x1)}
#define SEC_HZ0 ${f(HALL.z0)}
#define SEC_HZ1 ${f(HALL.z1)}
#define SEC_HY0 ${f(HALL.y0)}
#define SEC_HY1 ${f(HALL.y1)}
#define SEC_TX0 ${f(TUBE.x0)}
#define SEC_TX1 ${f(TUBE.x1)}
#define SEC_TZ0 ${f(TUBE.z0)}
#define SEC_TZ1 ${f(TUBE.z1)}
#define SEC_TY1 ${f(TUBE.y1)}
#define SEC_SY ${f(STRIP.y)}
#define SEC_SW ${f(STRIP.w)}
#define SEC_TSX ${f(TUBE_STRIP.x)}
#define SEC_TSZ0 ${f(TUBE_STRIP.z0)}
#define SEC_TSZ1 ${f(TUBE_STRIP.z1)}
#define SEC_TSY ${f(TUBE_STRIP.y)}
const float SEC_STRIPS[${STRIPS_Z.length}] = float[](${STRIPS_Z.map(f).join(", ")});
const vec2 SEC_SEGS[${STRIP_SEGMENTS.length}] = vec2[](${STRIP_SEGMENTS.map(([a, b]) => `vec2(${f(a)}, ${f(b)})`).join(", ")});
const float SEC_WASH[${WASHERS_X.length}] = float[](${WASHERS_X.map(f).join(", ")});
const float SEC_CORES[${CORES.length}] = float[](${CORES.map((c) => f(c.x)).join(", ")});
`;
