"use client";

/**
 * Planting — lavender drifts and ornamental grasses along the lanes and in the
 * gardens, dark maquis shrubs on the hillside. Three instanced meshes, one
 * material. Each clump grows in with U.uLife (own delay), grasses move in the
 * wind. White model → colour via the sweep; clipped by the section plane.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Group,
} from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { mulberry32 } from "@/lib/noise";
import { U } from "@/lib/uniforms";
import { lin } from "../terrain/siteGlsl";
import { PLANTING, SHRUBS, type Tuft } from "./layout";
import { extendMaterial, inject } from "./shaderUtils";

type Kind = 0 | 1 | 2; // lavender, grass, shrub

/** Unit clump (radius ~1, base at y=0) with a height attribute for colouring. */
function clumpGeometry(kind: Kind) {
  const detail = kind === 1 ? 0 : 1;
  const src = new IcosahedronGeometry(1, detail);
  const p = src.attributes.position;
  const rand = mulberry32(kind * 31 + 5);
  const pos: number[] = [];
  const nor: number[] = [];
  const h: number[] = [];
  const jitter = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, kind === 0 ? 0.88 + rand() * 0.24 : 0.85 + rand() * 0.3);
    const j = jitter.get(key)!;
    let px = x * j;
    let py = y * j;
    let pz = z * j;
    if (kind === 1) {
      // grass: a narrow fountain of blades — pinch the base, spike the top
      const up = Math.max(0, y);
      px *= 0.55 + 0.6 * up;
      pz *= 0.55 + 0.6 * up;
      py = py * 0.9 + (y > 0.6 ? 0.35 * j : 0);
    }
    if (kind === 0 && y > 0.2) py += (j - 0.88) * 1.1; // flower spikes break the silhouette
    py = py * 0.5 + 0.38;
    pos.push(px, Math.max(py, -0.05), pz);
    const n = new Vector3(x, y * 1.4 + 0.3, z).normalize();
    nor.push(n.x, n.y, n.z);
    h.push(Math.max(0, Math.min(1, (py + 0.05) / 0.95)));
  }
  src.dispose();
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute("aH", new BufferAttribute(new Float32Array(h), 1));
  return g;
}

const VERT_PARS = /* glsl */ `
attribute float aH;
attribute vec3 aInst;
uniform float uLife;
uniform float uTime;
varying float vPlH;
varying vec3 vPlI;
`;
const VERT_BODY = /* glsl */ `
  float plK = clamp((uLife - aInst.x * 0.55) / 0.45, 0.0, 1.0);
  float plGrow = 1.0 - pow(1.0 - plK, 3.0);
  vec3 plWind = inverse(mat3(instanceMatrix)) * vec3(0.92, 0.0, 0.38);
  float plSway = sin(uTime * 1.3 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21);
  float plAmp = aInst.z > 0.5 && aInst.z < 1.5 ? 0.09 : 0.02;
  transformed += plWind * plSway * plAmp * aH * aH * uLife;
  transformed *= plGrow;
  vPlH = aH;
  vPlI = aInst;
`;
const FRAG = /* glsl */ `
#define C_LAV_BASE ${lin("#8C9277")}
#define C_LAV_TOP ${lin("#9A8DB2")}
#define C_LAV_TOP2 ${lin("#A99CC0")}
#define C_GRASS_BASE ${lin("#8E8F62")}
#define C_GRASS_TOP ${lin("#C6B587")}
#define C_SHRUB_A ${lin("#56603F")}
#define C_SHRUB_B ${lin("#66704A")}
#define C_SHRUB_C ${lin("#7D8466")}
varying float vPlH;
varying vec3 vPlI;
`;
const COLOR = /* glsl */ `
  {
    float tone = vPlI.y;
    float kind = vPlI.z;
    vec3 c;
    if (kind < 0.5) c = mix(C_LAV_BASE, mix(C_LAV_TOP, C_LAV_TOP2, tone), smoothstep(0.42, 0.75, vPlH));
    else if (kind < 1.5) c = mix(C_GRASS_BASE, C_GRASS_TOP, smoothstep(0.2, 0.85, vPlH) * (0.7 + 0.3 * tone));
    else c = mix(mix(C_SHRUB_A, C_SHRUB_B, tone), C_SHRUB_C, smoothstep(0.8, 1.0, tone));
    c *= 0.8 + 0.25 * smoothstep(0.0, 0.8, vPlH);
    c *= 0.9 + 0.2 * vl_vnoise(vVlWorld.xz * 4.0 + vVlWorld.y * 3.0);
    diffuseColor.rgb = c;
  }
`;

function createPlantMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.96, metalness: 0 }), {
    poche: null,
    modelColor: "#DADCCD",
  });
  return extendMaterial(mat, "plant-v1", (shader) => {
    let vs = shader.vertexShader;
    vs = inject(vs, "#include <common>", VERT_PARS);
    vs = inject(vs, "#include <begin_vertex>", VERT_BODY);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = inject(fs, "#include <common>", FRAG);
    fs = inject(fs, "#include <color_fragment>", COLOR);
    shader.fragmentShader = fs;
  });
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

function makeMesh(kind: Kind, list: Tuft[], mat: MeshStandardMaterial) {
  const geo = clumpGeometry(kind);
  const mesh = new InstancedMesh(geo, mat, list.length);
  const inst = new Float32Array(list.length * 3);
  list.forEach((t, i) => {
    _p.set(t.x, t.y - (kind === 2 ? 0.15 : 0.05), t.z);
    _q.setFromAxisAngle(_up, t.rot);
    if (kind === 0) _s.set(t.s * 0.5 * (t.len ?? 1.2), t.s * 0.72, t.s * 0.52);
    else if (kind === 1) _s.set(t.s * 0.42, t.s * 1.05, t.s * 0.42);
    else _s.set(t.s * 1.0, t.s * 1.25, t.s * 0.95);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    inst.set([t.delay, t.tone, kind], i * 3);
  });
  geo.setAttribute("aInst", new InstancedBufferAttribute(inst, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.castShadow = kind === 2;
  mesh.frustumCulled = false;
  return mesh;
}

export function Planting() {
  const mat = useMemo(() => createPlantMaterial(), []);
  const meshes = useMemo(
    () => [makeMesh(0, PLANTING.lavender, mat), makeMesh(1, PLANTING.grass, mat), makeMesh(2, SHRUBS, mat)],
    [mat],
  );
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

