/**
 * The garage hall and the tunnel as one merged mesh (one draw call).
 *
 * Every piece is a closed solid — slabs, walls, columns, cores — so where the
 * section plane cuts them their back faces read as poché, a crisp dark frame
 * around the lit hall. The faces that look into the hall or the tunnel carry a
 * surface kind (aKind) the material shades: polished floor, soffit, walls,
 * columns, light strips, lift cores and their lobbies.
 */
import { BufferAttribute, BufferGeometry, CylinderGeometry } from "three";
import { BAY_ROWS, COLUMN_R, COLUMN_X, COLUMN_Z, CORES, HALL, HALL_OUT, PORTAL_Z, SHELL, STRIPS_Z, STRIP, STRIP_SEGMENTS, TUBE, TUBE_OUT, TUBE_STRIP, WASHERS_X, tubeFloorY } from "./layout";

export const KIND = {
  floor: 0,
  soffit: 1,
  wall: 2,
  column: 3,
  strip: 4,
  core: 5,
  lobby: 6,
  tubeFloor: 7,
  tubeWall: 8,
  hidden: 9,
} as const;

type Face = "px" | "nx" | "py" | "ny" | "pz" | "nz";
type V3 = [number, number, number];

class Builder {
  pos: number[] = [];
  nor: number[] = [];
  kind: number[] = [];

  tri(a: V3, b: V3, c: V3, k: number) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.kind.push(k);
    }
  }

  /** Quad a-b-c-d, counter-clockwise seen from the side it faces. */
  quad(a: V3, b: V3, c: V3, d: V3, k: number) {
    this.tri(a, b, c, k);
    this.tri(a, c, d, k);
  }

  /**
   * A closed hexahedron from its 8 corners: bottom (y0) ring then top (y1) ring,
   * each [x0z0, x1z0, x1z1, x0z1]. `kinds` sets a kind per face, `skip` leaves faces open.
   */
  hexa(c: V3[], kinds: Partial<Record<Face, number>>, fallback: number, skip: Face[] = []) {
    const [b0, b1, b2, b3, t0, t1, t2, t3] = c;
    const k = (f: Face) => kinds[f] ?? fallback;
    const faces: [Face, V3, V3, V3, V3][] = [
      ["ny", b0, b1, b2, b3],
      ["py", t0, t3, t2, t1],
      ["nz", b0, t0, t1, b1],
      ["pz", b3, b2, t2, t3],
      ["nx", b0, b3, t3, t0],
      ["px", b1, t1, t2, b2],
    ];
    for (const [f, a, b, cc, d] of faces) if (!skip.includes(f)) this.quad(a, b, cc, d, k(f));
  }

  box(min: V3, max: V3, kinds: Partial<Record<Face, number>>, fallback: number, skip: Face[] = []) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    this.hexa(
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      kinds,
      fallback,
      skip,
    );
  }

  /** Append an indexed/non-indexed three geometry (position + normal) with one kind. */
  geometry(g: BufferGeometry, k: number) {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.attributes.position.array as ArrayLike<number>;
    const n = src.attributes.normal.array as ArrayLike<number>;
    for (let i = 0; i < p.length; i++) {
      this.pos.push(p[i]);
      this.nor.push(n[i]);
    }
    for (let i = 0; i < p.length / 3; i++) this.kind.push(k);
    if (src !== g) src.dispose();
  }

  build() {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("aKind", new BufferAttribute(new Float32Array(this.kind), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

export function buildGarage() {
  const B = new Builder();
  const H = KIND.hidden;

  /* ------------------------------------------------------------ the hall */
  // floor slab (its top is the hall floor)
  B.box([HALL_OUT.x0, HALL_OUT.y0, HALL_OUT.z0], [HALL_OUT.x1, HALL.y0, HALL_OUT.z1], { py: KIND.floor }, H);
  // roof slab (its underside is the soffit)
  B.box([HALL_OUT.x0, HALL.y1, HALL_OUT.z0], [HALL_OUT.x1, HALL_OUT.y1, HALL_OUT.z1], { ny: KIND.soffit }, H);
  // back (north) wall, west and east walls
  B.box([HALL_OUT.x0, HALL.y0, HALL_OUT.z0], [HALL_OUT.x1, HALL.y1, HALL.z0], { pz: KIND.wall }, H);
  B.box([HALL_OUT.x0, HALL.y0, HALL.z0], [HALL.x0, HALL.y1, HALL.z1], { px: KIND.wall }, H);
  B.box([HALL.x1, HALL.y0, HALL.z0], [HALL_OUT.x1, HALL.y1, HALL.z1], { nx: KIND.wall }, H);
  // south wall, open where the tunnel arrives
  B.box([HALL_OUT.x0, HALL.y0, HALL.z1], [TUBE.x0, HALL.y1, HALL_OUT.z1], { nz: KIND.wall }, H);
  B.box([TUBE.x1, HALL.y0, HALL.z1], [HALL_OUT.x1, HALL.y1, HALL_OUT.z1], { nz: KIND.wall }, H);
  B.box([TUBE.x0, TUBE.y1, HALL.z1], [TUBE.x1, HALL.y1, HALL_OUT.z1], { nz: KIND.wall, ny: KIND.soffit }, H);

  // slender round columns
  const colH = HALL.y1 - HALL.y0;
  for (const x of COLUMN_X) {
    for (const z of COLUMN_Z) {
      const c = new CylinderGeometry(COLUMN_R, COLUMN_R, colH + 0.02, 20, 1, false);
      c.translate(x, HALL.y0 + colH / 2, z);
      B.geometry(c, KIND.column);
      c.dispose();
    }
  }

  // linear light strips in the soffit, one per column bay
  for (const z of STRIPS_Z) {
    for (const [a, b] of STRIP_SEGMENTS) B.box([a, STRIP.y - 0.04, z - STRIP.w / 2], [b, HALL.y1 + 0.01, z + STRIP.w / 2], {}, KIND.strip);
  }
  // wall washers: short slots in the soffit along the back wall
  for (const x of WASHERS_X) B.box([x - 0.7, STRIP.y - 0.03, HALL.z0 + 0.45], [x + 0.7, HALL.y1 + 0.01, HALL.z0 + 0.6], {}, KIND.strip);

  // lift and stair cores against the back wall, each with an open, lit lobby
  for (const c of CORES) {
    const x0 = c.x - c.w / 2;
    const x1 = c.x + c.w / 2;
    const door = 0.72;
    const top = HALL.y0 + 2.45;
    // cheeks and lintel (the lobby opening between them)
    B.box([x0, HALL.y0, c.z0], [c.x - door, HALL.y1, c.z1], { pz: KIND.core, nx: KIND.core, px: KIND.core }, H);
    B.box([c.x + door, HALL.y0, c.z0], [x1, HALL.y1, c.z1], { pz: KIND.core, nx: KIND.core, px: KIND.core }, H);
    B.box([c.x - door, top, c.z0], [c.x + door, HALL.y1, c.z1], { pz: KIND.core, ny: KIND.core }, H);
    // the lobby: a warm, softly glowing recess
    B.box([c.x - door, HALL.y0, c.z0], [c.x + door, top, c.z1 - 0.45], { pz: KIND.lobby }, H);
  }

  /* ---------------------------------------------------------- the tunnel */
  const z0 = HALL.z1 - 0.01;
  const z1 = PORTAL_Z;
  const f0 = tubeFloorY(z0);
  const f1 = tubeFloorY(z1);
  // floor slab: a barely-there ramp from the street up to the hall floor
  B.hexa(
    [
      [TUBE_OUT.x0, TUBE_OUT.y0, z0],
      [TUBE_OUT.x1, TUBE_OUT.y0, z0],
      [TUBE_OUT.x1, TUBE_OUT.y0, z1],
      [TUBE_OUT.x0, TUBE_OUT.y0, z1],
      [TUBE_OUT.x0, f0, z0],
      [TUBE_OUT.x1, f0, z0],
      [TUBE_OUT.x1, f1, z1],
      [TUBE_OUT.x0, f1, z1],
    ],
    { py: KIND.tubeFloor },
    H,
    ["pz"],
  );
  // walls and roof
  B.box([TUBE_OUT.x0, TUBE_OUT.y0, z0], [TUBE.x0, TUBE.y1, z1], { px: KIND.tubeWall }, H, ["pz"]);
  B.box([TUBE.x1, TUBE_OUT.y0, z0], [TUBE_OUT.x1, TUBE.y1, z1], { nx: KIND.tubeWall }, H, ["pz"]);
  B.box([TUBE_OUT.x0, TUBE.y1, z0], [TUBE_OUT.x1, TUBE_OUT.y1, z1], { ny: KIND.tubeWall }, H, ["pz"]);
  // its light strip, along the axis
  B.box([TUBE_STRIP.x - TUBE_STRIP.w / 2, TUBE_STRIP.y - 0.045, TUBE_STRIP.z0], [TUBE_STRIP.x + TUBE_STRIP.w / 2, TUBE.y1 + 0.01, TUBE_STRIP.z1], {}, KIND.strip);

  return B.build();
}

/** Structural outline of the hall and the tunnel (for the section cap's openings). */
export const OUTLINES = {
  hall: { x0: HALL_OUT.x0, x1: HALL_OUT.x1, y0: HALL_OUT.y0, y1: HALL_OUT.y1, z0: HALL_OUT.z0, z1: HALL_OUT.z1 },
  tube: { x0: TUBE_OUT.x0, x1: TUBE_OUT.x1, y0: TUBE_OUT.y0, y1: TUBE_OUT.y1, z0: HALL.z1, z1: PORTAL_Z },
  roof: SHELL.roof,
  rows: BAY_ROWS,
};
