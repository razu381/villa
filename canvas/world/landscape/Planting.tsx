"use client";

/**
 * Planting — five instanced meshes, one material:
 *   lavender  drifts along the lanes: a low grey-green mound bristling with
 *             flower spikes, sage stems to violet tips (like the film)
 *   grasses   ornamental grass fountains
 *   shrubs    dark rounded maquis on the hillside (cast shadows)
 *   beds      mixed shrubs on top of the terrace walls and inside the bastion,
 *             the greenery that spills over the limestone
 *   hedges    clipped hedges framing the villa gardens
 * Each clump grows in with U.uLife (own delay), soft parts move in the wind.
 * White model → colour via the sweep; clipped by the section plane.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix3,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  StaticDrawUsage,
  Vector3,
  type Group,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { patchVillageMaterial } from "@/lib/materials";
import { mulberry32 } from "@/lib/noise";
import { U } from "@/lib/uniforms";
import { lin } from "../terrain/siteGlsl";
import { BEDS, HEDGES, PLANTING, SHRUBS, type Tuft } from "./layout";
import { FOLIAGE_NOISE_GLSL } from "./foliageGlsl";
import { extendMaterial, inject, uWind } from "./shaderUtils";

const KIND = { lavender: 0, grass: 1, shrub: 2, bed: 3, hedge: 4 } as const;

function finish(pos: number[], nor: number[], h: number[], index?: number[]) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute("aH", new BufferAttribute(new Float32Array(h), 1));
  if (index) {
    g.setIndex(index);
    return g;
  }
  const m = mergeVertices(g, 1e-4);
  g.dispose();
  return m;
}

/** Rounded clump (shrubs, beds) or a grass fountain; radius ~1, base at y = 0. */
function clumpGeometry(grass: boolean) {
  const src = new IcosahedronGeometry(1, grass ? 0 : 1);
  const p = src.attributes.position;
  const rand = mulberry32(grass ? 36 : 67);
  const pos: number[] = [];
  const nor: number[] = [];
  const h: number[] = [];
  const jitter = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, grass ? 0.85 + rand() * 0.3 : 0.9 + rand() * 0.2);
    const j = jitter.get(key)!;
    let px = x * j;
    let py = y * j;
    let pz = z * j;
    if (grass) {
      // a narrow fountain of blades — pinch the base, spike the top
      const up = Math.max(0, y);
      px *= 0.55 + 0.6 * up;
      pz *= 0.55 + 0.6 * up;
      py = py * 0.9 + (y > 0.6 ? 0.35 * j : 0);
    }
    py = py * 0.5 + 0.38;
    pos.push(px, Math.max(py, -0.05), pz);
    const n = grass ? new Vector3(x * 0.75, 0.9 + Math.max(0, y) * 0.5, z * 0.75).normalize() : new Vector3(x, y * 1.4 + 0.3, z).normalize();
    nor.push(n.x, n.y, n.z);
    h.push(Math.max(0, Math.min(1, (py + 0.05) / 0.95)));
  }
  src.dispose();
  return finish(pos, nor, h);
}

/**
 * Lavender: a low mound (aH 0 → 0.6) and slim flower spikes (aH 0.62 → 1),
 * so the shader can run sage stems to violet tips.
 */
function lavenderGeometry() {
  const rand = mulberry32(5150);
  const pos: number[] = [];
  const nor: number[] = [];
  const h: number[] = [];
  const index: number[] = [];
  const dome = new SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const dp = dome.attributes.position;
  const domeH = 0.5;
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i);
    const y = dp.getY(i);
    const z = dp.getZ(i);
    const k = 0.92 + 0.12 * Math.sin(x * 5.1 + z * 3.7) * Math.sin(z * 4.3 - x * 2.2);
    pos.push(x * k, y * domeH * k - 0.03, z * k);
    const n = new Vector3(x / 1, y / domeH, z / 1).normalize().lerp(new Vector3(0, 1, 0), 0.15).normalize();
    nor.push(n.x, n.y, n.z);
    h.push(0.6 * y);
  }
  index.push(...Array.from(dome.index!.array));
  dome.dispose();
  // flower wands: a hair-thin stem swelling into a slim violet head, then a point
  const N = 32;
  for (let s = 0; s < N; s++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.88;
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const by = domeH * Math.sqrt(Math.max(0, 1 - r * r)) * 0.75;
    const len = 0.26 + rand() * 0.2;
    const lean = 0.22 * r + 0.04;
    const ax = Math.cos(a) * lean + (rand() - 0.5) * 0.05;
    const az = Math.sin(a) * lean + (rand() - 0.5) * 0.05;
    const P = (k: number): [number, number, number] => [bx + ax * k, by + len * k, bz + az * k];
    const w = 0.034;
    const base = pos.length / 3;
    const b0 = P(0);
    pos.push(...b0);
    nor.push(0, 1, 0);
    h.push(0.62);
    const m = P(0.68);
    for (let k = 0; k < 3; k++) {
      const ang = a + (k / 3) * Math.PI * 2;
      pos.push(m[0] + Math.cos(ang) * w, m[1], m[2] + Math.sin(ang) * w);
      const n = new Vector3(Math.cos(ang), 0.35, Math.sin(ang)).normalize();
      nor.push(n.x, n.y, n.z);
      h.push(0.86);
    }
    const t = P(1);
    pos.push(...t);
    nor.push(0, 1, 0);
    h.push(1);
    for (let k = 0; k < 3; k++) {
      const k1 = (k + 1) % 3;
      index.push(base, base + 1 + k1, base + 1 + k);
      index.push(base + 1 + k, base + 1 + k1, base + 4);
    }
  }
  return finish(pos, nor, h, index);
}

/** Clipped hedge: a unit rounded box, base at y = 0 (x, z ∈ [-0.5, 0.5]). */
function hedgeGeometry() {
  const src = new BoxGeometry(1, 1, 1, 4, 4, 12);
  const p = src.attributes.position;
  const pos: number[] = [];
  const nor: number[] = [];
  const h: number[] = [];
  const r = 0.1;
  const v = new Vector3();
  const q = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    q.set(Math.max(-0.5 + r, Math.min(0.5 - r, v.x)), Math.max(-0.5 + r, Math.min(0.5 - r, v.y)), Math.max(-0.5 + r, Math.min(0.5 - r, v.z)));
    const d = v.clone().sub(q);
    const n = d.lengthSq() > 1e-8 ? d.normalize() : new Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const out = q.clone().addScaledVector(n, r);
    pos.push(out.x, out.y + 0.5, out.z);
    nor.push(n.x, n.y, n.z);
    h.push(out.y + 0.5);
  }
  const index = Array.from(src.index!.array);
  src.dispose();
  const g = finish(pos, nor, h, index);
  const m = mergeVertices(g, 1e-4);
  g.dispose();
  return m;
}

const VERT_PARS = /* glsl */ `
attribute float aH;
attribute vec3 aInst;
attribute vec3 aWindO;
uniform float uLife;
uniform float uTime;
uniform float uWind;
varying float vPlH;
varying vec3 vPlI;
`;
const VERT_BODY = /* glsl */ `
  float plK = clamp((uLife - aInst.x * 0.55) / 0.45, 0.0, 1.0);
  float plGrow = 1.0 - pow(1.0 - plK, 3.0);
  float plSway = sin(uTime * 1.3 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21);
  float plAmp = aInst.z < 0.5 ? 0.06 * smoothstep(0.6, 1.0, aH) : (aInst.z < 1.5 ? 0.09 : (aInst.z > 3.5 ? 0.0 : 0.015));
  transformed += aWindO * plSway * plAmp * aH * aH * uLife * uWind;
  transformed *= plGrow;
  vPlH = aH;
  vPlI = aInst;
`;
const FRAG = /* glsl */ `
#define C_LAV_LEAF ${lin("#6E7A52")}
#define C_LAV_STEM ${lin("#7C8768")}
#define C_LAV_TOP ${lin("#8E80AE")}
#define C_LAV_TOP2 ${lin("#A194BE")}
#define C_GRASS_BASE ${lin("#76825A")}
#define C_GRASS_TOP ${lin("#ABA67E")}
#define C_SHRUB_A ${lin("#56603F")}
#define C_SHRUB_B ${lin("#66704A")}
#define C_SHRUB_C ${lin("#7D8466")}
#define C_BED_A ${lin("#5D6A42")}
#define C_BED_B ${lin("#7A8660")}
#define C_BED_SILVER ${lin("#A3A792")}
#define C_HEDGE ${lin("#56623F")}
varying float vPlH;
varying vec3 vPlI;
float plBump = 0.0;
float plClump = -1.0;
${FOLIAGE_NOISE_GLSL}
`;
const COLOR = /* glsl */ `
  {
    float tone = vPlI.y;
    float kind = vPlI.z;
    vec3 c;
    float n1 = vl_vnoise(vVlWorld.xz * 0.35 + 3.0);
    if (kind < 0.5) {
      // sage mound and stems, violet flower heads; whole stretches in fuller bloom
      float bloom = smoothstep(0.25, 0.75, n1);
      float flower = smoothstep(0.7, 0.84, vPlH);
      vec3 violet = mix(C_LAV_TOP, C_LAV_TOP2, tone) * (0.92 + 0.12 * bloom);
      c = mix(C_LAV_LEAF * (0.82 + 0.3 * smoothstep(0.0, 0.6, vPlH)), C_LAV_STEM, step(0.61, vPlH));
      c = mix(c, violet, flower * (0.75 + 0.25 * bloom));
      // at a distance the spikes are sub-pixel: the mound's top carries the haze of flowers
      float far = smoothstep(0.015, 0.06, fwidth(vVlWorld.x) + fwidth(vVlWorld.z));
      c = mix(c, violet * 0.95, far * smoothstep(0.3, 0.6, vPlH) * (0.45 + 0.25 * bloom));
    }
    else if (kind < 1.5) c = mix(C_GRASS_BASE, C_GRASS_TOP, smoothstep(0.2, 0.85, vPlH) * (0.7 + 0.3 * tone));
    else if (kind < 2.5) c = mix(mix(C_SHRUB_A, C_SHRUB_B, tone), C_SHRUB_C, smoothstep(0.8, 1.0, tone));
    else if (kind < 3.5) c = mix(mix(C_BED_A, C_BED_B, smoothstep(0.2, 0.8, tone)), C_BED_SILVER, smoothstep(0.82, 0.96, tone));
    else {
      // clipped leaf: fine mottling, a darker foot, a lighter clipped top
      vec2 hq = vec2(vVlWorld.x + vVlWorld.z, vVlWorld.y) * 9.0;
      c = C_HEDGE * (0.84 + 0.2 * vl_vnoise(hq) + 0.1 * vl_vnoise(hq * 3.1 + 5.0));
      c *= 0.78 + 0.3 * smoothstep(0.0, 0.85, vPlH);
    }
    if (kind > 0.5 && kind < 3.5) {
      c *= 0.78 + 0.27 * smoothstep(0.0, 0.8, vPlH);
    }
    if (kind > 1.5 && kind < 3.5) {
      // shrubs and beds: irregular leaf clumps, each a soft dome (as on the trees)
      vec3 q = vVlWorld * 2.7 + tone * 9.0;
      float fwq = fwidth(q.x) + fwidth(q.y);
      float vis = 1.0 - smoothstep(0.25, 0.8, fwq);
      q += (vec3(tv_n3(q * 0.31), tv_n3(q * 0.31 + 11.0), tv_n3(q * 0.31 + 23.0)) - 0.5) * 1.4;
      float dome = 1.0 - smoothstep(0.1, 0.95, tv_clumps(q));
      plClump = mix(0.6, dome, vis);
      plBump = plClump * vis * 1.2;
      c *= mix(1.0, 0.8 + 0.32 * plClump, vis);
    } else if (kind > 3.5) {
      // clipped hedge: a fine, even leaf texture
      vec3 q = vVlWorld * 5.0;
      float fwq = fwidth(q.x) + fwidth(q.y);
      float vis = 1.0 - smoothstep(0.3, 0.9, fwq);
      float n = tv_n3(q) * 0.65 + tv_n3(q * 2.3 + 4.0) * 0.35;
      plBump = n * vis;
      c *= mix(1.0, 0.85 + 0.3 * n, vis);
    }
    // flowers lose their colour after dusk (no saturated indigo under the moon)
    c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), uNight * 0.6);
    diffuseColor.rgb = c;
  }
`;

function createPlantMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.96, metalness: 0 }), {
    poche: null,
    modelColor: "#DADCCD",
    seam: false,
  });
  return extendMaterial(mat, "plant-v2", (shader) => {
    shader.uniforms.uWind = uWind;
    let vs = shader.vertexShader;
    vs = inject(vs, "#include <common>", VERT_PARS);
    vs = inject(vs, "#include <begin_vertex>", VERT_BODY);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = inject(fs, "void main() {", `${FRAG}\nvoid main() {`, "replace");
    fs = inject(fs, "#include <color_fragment>", COLOR);
    fs = inject(
      fs,
      "#include <roughnessmap_fragment>",
      /* glsl */ `
      if (plClump >= 0.0 && vlMask > 0.5) {
        // a leafy silhouette: the gaps between clumps open at the rim
        float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
        if (plClump * 0.85 + 0.12 < smoothstep(0.55, 1.0, rim) * 0.9) discard;
      }`,
      "before",
    );
    fs = inject(
      fs,
      "#include <normal_fragment_maps>",
      /* glsl */ `
      if (plBump > 0.0) {
        vec3 sx = dFdx(-vViewPosition);
        vec3 sy = dFdy(-vViewPosition);
        vec3 r1 = cross(sy, normal);
        vec3 r2 = cross(normal, sx);
        float det = dot(sx, r1);
        float h = plBump * 0.09;
        vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
        normal = normalize(mix(normal, abs(det) * normal - grad, vlMask));
      }`,
    );
    shader.fragmentShader = fs;
  });
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _n = new Matrix3();
const _w = new Vector3();
const WIND = new Vector3(0.92, 0, 0.38);

function makeMesh(kind: number, geo: BufferGeometry, list: Tuft[], mat: MeshStandardMaterial, place: (t: Tuft) => void, castShadow: boolean) {
  const mesh = new InstancedMesh(geo, mat, list.length);
  const inst = new Float32Array(list.length * 3);
  const wind = new Float32Array(list.length * 3);
  list.forEach((t, i) => {
    place(t);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    inst.set([t.delay, t.tone, kind], i * 3);
    // the wind, in the instance's own (rotated, scaled) space
    _w.copy(WIND).applyMatrix3(_n.setFromMatrix4(_m).invert());
    wind.set([_w.x, _w.y, _w.z], i * 3);
  });
  geo.setAttribute("aInst", new InstancedBufferAttribute(inst, 3));
  geo.setAttribute("aWindO", new InstancedBufferAttribute(wind, 3));
  mesh.instanceMatrix.setUsage(StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.castShadow = castShadow;
  mesh.frustumCulled = false;
  return mesh;
}

export function Planting() {
  const mat = useMemo(() => createPlantMaterial(), []);
  const meshes = useMemo(() => {
    const out: InstancedMesh[] = [];
    out.push(
      makeMesh(
        KIND.lavender,
        lavenderGeometry(),
        PLANTING.lavender,
        mat,
        (t) => {
          _p.set(t.x, t.y - 0.04, t.z);
          _q.setFromAxisAngle(_up, t.rot);
          _s.set(t.s * 0.5 * (t.len ?? 1.2), t.s * 0.95, t.s * 0.5);
        },
        false,
      ),
    );
    out.push(
      makeMesh(
        KIND.grass,
        clumpGeometry(true),
        PLANTING.grass,
        mat,
        (t) => {
          _p.set(t.x, t.y - 0.05, t.z);
          _q.setFromAxisAngle(_up, t.rot);
          _s.set(t.s * 0.4, t.s * 0.85, t.s * 0.4);
        },
        false,
      ),
    );
    out.push(
      makeMesh(
        KIND.shrub,
        clumpGeometry(false),
        SHRUBS,
        mat,
        (t) => {
          _p.set(t.x, t.y - 0.15, t.z);
          _q.setFromAxisAngle(_up, t.rot);
          _s.set(t.s, t.s * 1.25, t.s * 0.95);
        },
        true,
      ),
    );
    out.push(
      makeMesh(
        KIND.bed,
        clumpGeometry(false),
        BEDS,
        mat,
        (t) => {
          _p.set(t.x, t.y - 0.12, t.z);
          _q.setFromAxisAngle(_up, t.rot);
          _s.set(t.s, t.s * (0.95 + 0.3 * t.tone), t.s * 0.9);
        },
        false,
      ),
    );
    const hedges: Tuft[] = HEDGES.map((h) => ({ x: h.x, z: h.z, y: h.y, s: 1, rot: 0, delay: h.delay, tone: 0.5 }));
    out.push(
      makeMesh(
        KIND.hedge,
        hedgeGeometry(),
        hedges,
        mat,
        (t) => {
          const h = HEDGES.find((hh) => hh.x === t.x && hh.z === t.z)!;
          _p.set(h.x, h.y - 0.05, h.z);
          _q.identity();
          _s.set(h.w, h.h, h.len);
        },
        true,
      ),
    );
    return out;
  }, [mat]);
  useEffect(
    () => () => {
      meshes.forEach((m) => {
        m.geometry.dispose();
        m.dispose();
      });
      mat.dispose();
    },
    [meshes, mat],
  );
  const group = useRef<Group>(null);
  useFrame(() => {
    const on = U.uLife.value > 0.001;
    if (group.current && group.current.visible !== on) group.current.visible = on;
  });
  return (
    <group ref={group}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
