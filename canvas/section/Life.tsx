"use client";

/**
 * Life above — the Understanding layer and the people.
 *
 *   - luminous hairlines along the car-free lanes (PATHS), drawing outward
 *     from the village heart as the camera rises to the gardens, and a hairline
 *     ring around the botanical playground (the legend's circle). Additive,
 *     warm white, gone again once the chapter ends.
 *   - small abstract model figures (white / stone / cork): walkers on the
 *     lanes, children in the playground, a few people by the long pool. They
 *     are placed like model pieces (they grow up from the ground, staggered)
 *     and then stay for the rest of the day. Reduced motion: they stand still.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  type Mesh,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { mulberry32 } from "@/lib/noise";
import { PALETTE } from "@/lib/palette";
import { useJourney } from "@/lib/store";
import { bump, clamp01, easeOutQuart, smooth } from "@/lib/timeline";
import { clipPlanes } from "@/lib/uniforms";
import { HOUSES, PATHS, PATH_WIDTH, PLAYGROUND, VILLAGE_HEART } from "@/lib/village";
import { CROSSINGS, POOLS, STAIR } from "../world/landscape/layout";
import { TERRACE_WALL, groundHeight } from "../world/terrain/ground";

/** The heart the reveal grows from (as the contours and plan lines do). */
const HEART = { x: -10, z: -6 };

/* ------------------------------------------------------------ the ground */

/** Walking height on the lanes: terraces, with the stair flights as ramps. */
export function walkY(x: number, z: number) {
  for (const c of CROSSINGS) {
    if (Math.abs(x - c.x) > PATH_WIDTH / 2 + 0.3) continue;
    const n = Math.max(2, Math.round((c.upper - c.lower) / STAIR.rise));
    const z0 = c.stepZ - TERRACE_WALL.half;
    const zFoot = c.stepZ + TERRACE_WALL.half + (n - 1) * STAIR.tread;
    if (z >= z0 - 0.4 && z <= zFoot + 0.2) {
      const k = clamp01((zFoot + 0.2 - z) / (zFoot + 0.2 - z0));
      return c.lower + (c.upper - c.lower) * k;
    }
  }
  return groundHeight(x, z);
}

/* ------------------------------------------------------------ the lanes */

/** Footprints the lanes must not run through: houses, the pavilion, the pools (x0, x1, z0, z1). */
const BLOCKERS: [number, number, number, number][] = [
  ...HOUSES.map((h): [number, number, number, number] => [h.x - h.width / 2 - 0.5, h.x + h.width / 2 + 0.5, h.z - h.depth / 2 - 0.5, h.z + h.depth / 2 + 0.5]),
  (() => {
    const p = VILLAGE_HEART.pavilion;
    return [p.x - p.width / 2 - 0.5, p.x + p.width / 2 + 0.5, p.z - p.depth / 2 - 0.5, p.z + p.depth / 2 + 0.5] as [number, number, number, number];
  })(),
  ...POOLS.map((p): [number, number, number, number] => [p.x - p.hx - 0.6, p.x + p.hx + 0.6, p.z - p.hz - 0.6, p.z + p.hz + 0.6]),
];
const blocked = (x: number, z: number) => BLOCKERS.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);

/**
 * The walkable lanes: every PATHS polyline resampled (≈0.4 m) and split into
 * runs wherever it would cross a house, the pavilion or a pool — so neither
 * the luminous lines nor the walkers ever pass through a building.
 */
export const LANE_RUNS: [number, number][][] = (() => {
  const runs: [number, number][][] = [];
  for (const p of PATHS) {
    let run: [number, number][] = [];
    const flush = () => {
      if (run.length > 1 && polyLength(run) > 4) runs.push(run);
      run = [];
    };
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n;
        const z = az + ((bz - az) * k) / n;
        if (blocked(x, z)) flush();
        else run.push([x, z]);
      }
    }
    flush();
  }
  return runs;
})();

/* ------------------------------------------------------- luminous lines */

interface Ribbon {
  geo: BufferGeometry;
}

/** Hairline ribbons along every lane + the playground ring. aLine = (distance from the heart, across −1..1). */
function buildRibbons(): Ribbon {
  const pos: number[] = [];
  const line: number[] = [];
  const idx: number[] = [];
  const half = 1.5;
  const push = (x: number, y: number, z: number, nx: number, nz: number) => {
    const d = Math.hypot(x - HEART.x, z - HEART.z);
    const base = pos.length / 3;
    pos.push(x - nx * half, y, z - nz * half, x + nx * half, y, z + nz * half);
    line.push(d, -half, d, half);
    return base;
  };
  const strip = (pts: [number, number, number][]) => {
    let prev = -1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const l = Math.hypot(dx, dz) || 1;
      const cur = push(pts[i][0], pts[i][1], pts[i][2], -dz / l, dx / l);
      if (prev >= 0) idx.push(prev, prev + 1, cur, cur, prev + 1, cur + 1);
      prev = cur;
    }
  };
  for (const run of LANE_RUNS) strip(run.map(([x, z]): [number, number, number] => [x, walkY(x, z) + 0.05, z]));
  // the playground ring
  const cx = (PLAYGROUND.minX + PLAYGROUND.maxX) / 2;
  const cz = (PLAYGROUND.minZ + PLAYGROUND.maxZ) / 2;
  const rx = (PLAYGROUND.maxX - PLAYGROUND.minX) / 2 + 0.6;
  const rz = (PLAYGROUND.maxZ - PLAYGROUND.minZ) / 2 + 0.6;
  const ring: [number, number, number][] = [];
  for (let k = 0; k <= 160; k++) {
    const a = (k / 160) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const z = cz + Math.sin(a) * rz;
    ring.push([x, groundHeight(x, z) + 0.06, z]);
  }
  strip(ring);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("aLine", new BufferAttribute(new Float32Array(line), 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return { geo };
}

function createRibbonMaterial() {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    clipping: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uGlow: { value: 0 },
      uReveal: { value: 0 },
      uColor: { value: new Color("#FFDDA8").convertSRGBToLinear() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      attribute vec2 aLine;
      varying vec2 vLine;
      void main() {
        vLine = aLine;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        #include <clipping_planes_vertex>
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform float uGlow;
      uniform float uReveal;
      uniform vec3 uColor;
      varying vec2 vLine;
      void main() {
        #include <clipping_planes_fragment>
        float r = uReveal * 110.0;
        float shown = 1.0 - smoothstep(r - 6.0, r, vLine.x);
        // a brighter ink front riding the reveal
        float fd = (vLine.x - (r - 3.0)) / 3.0;
        float front = exp(-fd * fd) * (1.0 - smoothstep(0.9, 1.0, uReveal));
        // a hairline core (never thinner than a pixel, energy kept when far) and a soft halo
        float am = abs(vLine.y);
        float w = max(0.035, fwidth(vLine.y) * 0.9);
        float core = (1.0 - smoothstep(w * 0.5, w * 1.5, am)) * (0.035 / w);
        float halo = exp(-am * am * 18.0) * 0.62 + exp(-am * am * 1.6) * 0.2;
        float a = (core * 3.8 + halo) * (shown * 0.9 + front * 0.8) * uGlow;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
  mat.clippingPlanes = clipPlanes;
  return mat;
}

/* ------------------------------------------------------------- figures */

function buildFigureGeometry() {
  const prof: [number, number][] = [
    [0.0, 0.0],
    [0.07, 0.0],
    [0.08, 0.42],
    [0.115, 0.8],
    [0.13, 0.93],
    [0.118, 1.12],
    [0.165, 1.35],
    [0.13, 1.44],
    [0.05, 1.49],
    [0.055, 1.52],
    [0.098, 1.58],
    [0.102, 1.65],
    [0.08, 1.72],
    [0.0, 1.75],
  ];
  const g = new LatheGeometry(
    prof.map(([r, y]) => new Vector2(r, y)),
    12,
  );
  // keep the lathe's own (smooth, profile-derived) normals: recomputing them
  // leaves zero-length normals at the poles, which shade to NaN and bloom into
  // a black blot when the camera looks down on the figures' heads
  g.scale(1, 1, 0.66);
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    if (l < 1e-4) n.setXYZ(i, 0, g.attributes.position.getY(i) > 0.8 ? 1 : -1, 0);
    else n.setXYZ(i, n.getX(i) / l, n.getY(i) / l, n.getZ(i) / l);
  }
  return g;
}

type FigureKind = "walk" | "play" | "rest";
interface Figure {
  kind: FigureKind;
  /** walk: polyline + arc start + speed; play: loop centre + radii; rest: fixed. */
  path?: [number, number][];
  pathLen?: number;
  s0: number;
  speed: number;
  dir: number;
  offset: number;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  scale: number;
  delay: number;
  tone: number;
  yaw: number;
}

/** Model figures: mostly white and stone, a few in cork — never dark silhouettes. */
const TONES = ["#F4F1EA", "#EEEAE1", "#E6DFD1", "#D9CDB8", "#C9B597", PALETTE.cork];

function polyLength(p: [number, number][]) {
  let L = 0;
  for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
  return L;
}
function pointAt(p: [number, number][], s: number, out: { x: number; z: number; dx: number; dz: number }) {
  for (let i = 0; i < p.length - 1; i++) {
    const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    if (s <= l || i === p.length - 2) {
      const k = l > 0 ? Math.min(1, Math.max(0, s / l)) : 0;
      out.x = p[i][0] + (p[i + 1][0] - p[i][0]) * k;
      out.z = p[i][1] + (p[i + 1][1] - p[i][1]) * k;
      out.dx = (p[i + 1][0] - p[i][0]) / (l || 1);
      out.dz = (p[i + 1][1] - p[i][1]) / (l || 1);
      return out;
    }
    s -= l;
  }
  return out;
}

function buildFigures(): Figure[] {
  const rand = mulberry32(2026);
  const out: Figure[] = [];
  const base = (): Omit<Figure, "kind"> => ({
    s0: 0,
    speed: 0,
    dir: 1,
    offset: 0,
    cx: 0,
    cz: 0,
    rx: 0,
    rz: 0,
    scale: 1.08 + rand() * 0.12,
    delay: rand(),
    tone: Math.floor(rand() * TONES.length),
    yaw: rand() * Math.PI * 2,
  });
  // walkers on the lanes, in ones and twos
  const lanes = LANE_RUNS.map((p) => ({ p, L: polyLength(p) }));
  const total = lanes.reduce((a, l) => a + l.L, 0);
  let n = 0;
  while (n < 40) {
    let r = rand() * total;
    const lane = lanes.find((l) => (r -= l.L) < 0) ?? lanes[0];
    const s0 = rand() * lane.L;
    const dir = rand() < 0.5 ? 1 : -1;
    const speed = 0.9 + rand() * 0.45;
    const off = (rand() - 0.5) * 1.3;
    out.push({ ...base(), kind: "walk", path: lane.p, pathLen: lane.L, s0, speed, dir, offset: off });
    n++;
    if (rand() < 0.35 && n < 40) {
      // a companion, side by side
      out.push({ ...base(), kind: "walk", path: lane.p, pathLen: lane.L, s0: s0 + 0.15, speed, dir, offset: off + (off > 0 ? -0.62 : 0.62) });
      n++;
    }
  }
  // a few people stopping to talk on the lanes near the heart
  const groups: [number, number, number][] = [
    [-24.6, -4.0, 3],
    [1.2, -23.6, 2],
    [-13.0, 16.4, 2],
    [33.6, -10.0, 2],
    [-46.0, -24.9, 2],
  ];
  for (const [gx, gz, k] of groups) {
    for (let j = 0; j < k; j++) {
      const a = (j / k) * Math.PI * 2 + rand();
      out.push({ ...base(), kind: "rest", cx: gx + Math.cos(a) * 0.5, cz: gz + Math.sin(a) * 0.5, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
    }
  }
  // children at play in the botanical garden (on the sand, around the mounds)
  const play: [number, number, number, number][] = [
    [-55.0, 24.5, 2.2, 1.4],
    [-60.5, 36.0, 1.6, 1.0],
    [-45.8, 28.2, 1.4, 2.0],
    [-53.0, 36.5, 1.8, 0.9],
    [-65.0, 30.5, 1.2, 1.6],
    [-51.5, 29.0, 0.9, 0.7],
  ];
  for (const [cx, cz, rx, rz] of play) {
    out.push({ ...base(), kind: "play", cx, cz, rx, rz, speed: 0.35 + rand() * 0.3, scale: 0.66 + rand() * 0.1, dir: rand() < 0.5 ? 1 : -1 });
  }
  // two parents watching, at the playground's edge
  out.push({ ...base(), kind: "rest", cx: -44.6, cz: 21.5, yaw: -2.2 });
  out.push({ ...base(), kind: "rest", cx: -67.0, cz: 25.0, yaw: 1.4 });
  // by the long pool: one standing, two sitting on the edge
  const pool = VILLAGE_HEART.pool;
  const edge = pool.z - pool.depth / 2 - 0.55;
  out.push({ ...base(), kind: "rest", cx: pool.x - 7.5, cz: edge - 0.6, yaw: Math.PI * 0.95 });
  out.push({ ...base(), kind: "rest", cx: pool.x + 2.0, cz: edge + 0.15, yaw: Math.PI, scale: 0.66 });
  out.push({ ...base(), kind: "rest", cx: pool.x + 3.1, cz: edge + 0.15, yaw: Math.PI, scale: 0.64 });
  return out;
}

/* ------------------------------------------------------------------ Life */

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _at = { x: 0, z: 0, dx: 0, dz: 1 };

export function Life() {
  const ribbon = useMemo(() => buildRibbons(), []);
  const ribbonMat = useMemo(() => createRibbonMaterial(), []);
  const ribbonMesh = useRef<Mesh>(null);
  const figures = useMemo(() => buildFigures(), []);
  const people = useMemo(() => {
    const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.78, metalness: 0 }), { poche: PALETTE.poche });
    const mesh = new InstancedMesh(buildFigureGeometry(), mat, figures.length);
    const c = new Color();
    figures.forEach((f, i) => mesh.setColorAt(i, c.set(TONES[f.tone])));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }, [figures]);

  useEffect(
    () => () => {
      ribbon.geo.dispose();
      ribbonMat.dispose();
      people.geometry.dispose();
      (people.material as MeshStandardMaterial).dispose();
    },
    [ribbon, ribbonMat, people],
  );

  useFrame((state) => {
    const s = useJourney.getState();
    const t = s.t;

    // luminous lanes: only while the chapter rises to the gardens
    const glow = bump(4.58, 4.76, 4.95, 5.1, t);
    ribbonMat.uniforms.uGlow.value = glow;
    ribbonMat.uniforms.uReveal.value = smooth(4.58, 4.86, t);
    if (ribbonMesh.current) ribbonMesh.current.visible = glow > 0.002;

    // people: placed from t ≈ 4.6 on, then they stay
    const appear = t - 4.58;
    people.visible = appear > 0;
    if (!people.visible) return;
    const time = s.reducedMotion ? 0 : state.clock.elapsedTime;
    figures.forEach((f, i) => {
      const k = easeOutQuart(clamp01((appear - f.delay * 0.16) / 0.1));
      let x = f.cx;
      let z = f.cz;
      let yaw = f.yaw;
      let bob = 0;
      if (f.kind === "walk" && f.path && f.pathLen) {
        // ping-pong along the lane
        const L = f.pathLen;
        let u = (f.s0 + f.dir * f.speed * time) % (2 * L);
        if (u < 0) u += 2 * L;
        const back = u > L;
        const sArc = back ? 2 * L - u : u;
        pointAt(f.path, sArc, _at);
        const fx = back ? -_at.dx : _at.dx;
        const fz = back ? -_at.dz : _at.dz;
        const dirSign = f.dir;
        x = _at.x - _at.dz * f.offset;
        z = _at.z + _at.dx * f.offset;
        yaw = Math.atan2(fx * dirSign, fz * dirSign);
        bob = Math.abs(Math.sin((time * f.speed * 3.4 + f.delay * 10) % Math.PI)) * 0.025;
      } else if (f.kind === "play") {
        const a = f.delay * 6.28 + f.dir * f.speed * time;
        x = f.cx + Math.cos(a) * f.rx;
        z = f.cz + Math.sin(a) * f.rz;
        yaw = Math.atan2(-Math.sin(a) * f.rx * f.dir, Math.cos(a) * f.rz * f.dir);
        bob = Math.abs(Math.sin(time * 4.2 + f.delay * 9)) * 0.06;
      }
      const y = (f.kind === "walk" ? walkY(x, z) : groundHeight(x, z)) - 0.02 + bob;
      _q.setFromAxisAngle(_up, yaw);
      _p.set(x, y, z);
      _s.set(f.scale, f.scale * Math.max(0.001, k), f.scale);
      people.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    people.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh ref={ribbonMesh} geometry={ribbon.geo} material={ribbonMat} renderOrder={6} frustumCulled={false} visible={false} />
      <primitive object={people} />
    </>
  );
}
