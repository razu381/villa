"use client";

/**
 * Trees — three instanced kinds (round, tall cypress, silver olive).
 *
 * - Foam (U.uFoam): each tree scales in from its base as a model-maker's foam
 *   form (a smooth soft envelope), ease-out by its own delay. No bounce.
 * - Bloom: as the material sweep passes a tree it morphs from the foam form
 *   into clustered foliage and takes its colour (per-instance tone).
 * - Life (U.uLife): richer colour and a slow wind sway (+ a faint leaf flutter).
 * - Clipped by the section plane; a custom depth material keeps the shadows in
 *   step with the morph and growth.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  DynamicDrawUsage,
  type Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { VL_GLSL, patchVillageMaterial, sharedUniformsFor } from "@/lib/materials";
import { mulberry32 } from "@/lib/noise";
import { U } from "@/lib/uniforms";
import { TREES, type TreeKind } from "@/lib/village";
import { groundHeight } from "../terrain/ground";
import { lin } from "../terrain/siteGlsl";
import { extendMaterial, inject, uWind } from "./shaderUtils";
import { useJourney } from "@/lib/store";
import { buildTreeGeometry } from "./treeGeometry";

const KINDS: TreeKind[] = ["round", "tall", "olive"];
const WIDTH: Record<TreeKind, [number, number]> = { round: [0.85, 1.2], tall: [0.85, 1.1], olive: [0.9, 1.25] };

const VERT_PARS = /* glsl */ `
attribute vec3 aFoam;
attribute vec3 aFoamN;
attribute vec3 aTree;
attribute vec4 aInst;
uniform float uFoam;
uniform float uWind;
${VL_GLSL}
varying vec3 vTreeA;
varying vec4 vTreeI;
varying float vTreeB;
float tv_bloom() {
  vec3 base = instanceMatrix[3].xyz;
  return smoothstep(-3.0, 12.0, vl_sweepDist(base));
}
float tv_grow() {
  float k = clamp((uFoam - aInst.x * 0.55) / 0.45, 0.0, 1.0);
  return 1.0 - pow(1.0 - k, 3.0);
}
`;

const VERT_BODY = /* glsl */ `
  float tvB = tv_bloom();
  vec3 tvP = mix(aFoam, position, tvB);
  float tvH = max(tvP.y, 0.0);
  mat3 tvIm = inverse(mat3(instanceMatrix));
  float tvPh = aInst.y;
  float tvSway = sin(uTime * 0.72 + tvPh) * 0.65 + sin(uTime * 1.63 + tvPh * 1.9) * 0.35;
  tvP += (tvIm * vec3(0.92, 0.0, 0.38)) * tvSway * 0.17 * uLife * uWind * tvH * tvH;
  vec3 tvFl = vec3(sin(uTime * 2.3 + position.x * 31.0 + tvPh), 0.0, cos(uTime * 2.1 + position.z * 29.0 + tvPh));
  tvP += (tvIm * tvFl) * 0.03 * uLife * uWind * (1.0 - aTree.y) * tvH;
  transformed = tvP * tv_grow();
  vTreeA = aTree;
  vTreeI = aInst;
  vTreeB = tvB;
`;

const FRAG = /* glsl */ `
#define C_ROUND_A ${lin("#737C55")}
#define C_ROUND_B ${lin("#5E6848")}
#define C_ROUND_C ${lin("#8A9166")}
#define C_TALL_A ${lin("#48523B")}
#define C_TALL_B ${lin("#545E43")}
#define C_OLIVE_A ${lin("#959B85")}
#define C_OLIVE_B ${lin("#7F8772")}
#define C_TRUNK ${lin("#7A6D5D")}
#define C_TRUNK_OLIVE ${lin("#857D70")}
varying vec3 vTreeA;
varying vec4 vTreeI;
varying float vTreeB;
`;

const COLOR = /* glsl */ `
  {
    float kind = vTreeI.w;
    float tone = vTreeI.z;
    vec3 tc;
    if (kind < 0.5) tc = mix(mix(C_ROUND_A, C_ROUND_B, tone), C_ROUND_C, smoothstep(0.75, 1.0, tone));
    else if (kind < 1.5) tc = mix(C_TALL_A, C_TALL_B, tone);
    else tc = mix(C_OLIVE_A, C_OLIVE_B, tone);
    if (vTreeA.y > 0.5) tc = kind > 1.5 ? C_TRUNK_OLIVE : C_TRUNK;
    float sp = vl_vnoise(vVlWorld.xz * 2.7 + vVlWorld.y * 3.1);
    float sp2 = vl_vnoise(vVlWorld.xz * 9.0 - vVlWorld.y * 8.0);
    tc *= 0.84 + 0.2 * sp + 0.12 * sp2;
    float g = dot(tc, vec3(0.299, 0.587, 0.114));
    tc = mix(vec3(g) * vec3(1.05, 1.03, 0.95), tc, 0.5 + 0.5 * uLife);
    diffuseColor.rgb = tc;
  }
`;

const POST = /* glsl */ `
  if (!gl_FrontFacing && vTreeB < 0.995) discard;
  diffuseColor.rgb *= mix(1.0, mix(1.0, vTreeA.x, 0.8), vTreeB);
`;

function treeVertex(shader: WebGLProgramParametersWithUniforms, withNormal: boolean) {
  Object.assign(shader.uniforms, sharedUniformsFor(["uTime", "uMaterial", "uLife", "uNight", "uWindows", "uSweepFrom", "uSweepTo", "uFoam"]), { uWind });
  let vs = shader.vertexShader;
  vs = inject(vs, "#include <common>", VERT_PARS);
  if (withNormal) vs = inject(vs, "#include <beginnormal_vertex>", "objectNormal = normalize(mix(aFoamN, objectNormal, tv_bloom() * mix(0.32, 1.0, aTree.y)));");
  vs = inject(vs, "#include <begin_vertex>", VERT_BODY);
  shader.vertexShader = vs;
}

function createTreeMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.97, metalness: 0 }), {
    modelColor: "#D9DCCB",
    modelRoughness: 1,
    poche: "#3E4530",
  });
  return extendMaterial(mat, "tree-v1", (shader) => {
    treeVertex(shader, true);
    let fs = shader.fragmentShader;
    fs = inject(fs, "#include <common>", FRAG);
    fs = inject(fs, "#include <color_fragment>", COLOR);
    fs = inject(fs, "#include <roughnessmap_fragment>", POST, "before");
    shader.fragmentShader = fs;
  });
}

function createTreeDepthMaterial() {
  const mat = new MeshDepthMaterial();
  mat.onBeforeCompile = (shader) => treeVertex(shader, false);
  mat.customProgramCacheKey = () => "tree-depth-v1";
  return mat;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

export function Trees() {
  const mat = useMemo(() => createTreeMaterial(), []);
  const depth = useMemo(() => createTreeDepthMaterial(), []);
  const meshes = useMemo(() => {
    return KINDS.map((kind, ki) => {
      const specs = TREES.filter((t) => t.kind === kind);
      const geo = buildTreeGeometry(kind);
      const inst = new Float32Array(specs.length * 4);
      const mesh = new InstancedMesh(geo, mat, specs.length);
      specs.forEach((t, i) => {
        const r = mulberry32(t.seed);
        const [w0, w1] = WIDTH[kind];
        const w = t.height * (w0 + r() * (w1 - w0));
        _p.set(t.x, groundHeight(t.x, t.z) - 0.08, t.z);
        _q.setFromAxisAngle(_up, r() * Math.PI * 2);
        _s.set(w, t.height, w * (0.9 + r() * 0.2));
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        inst.set([t.delay, r() * Math.PI * 2, r(), ki], i * 4);
      });
      geo.setAttribute("aInst", new InstancedBufferAttribute(inst, 4));
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.customDepthMaterial = depth;
      return mesh;
    });
  }, [mat, depth]);

  useEffect(
    () => () => {
      meshes.forEach((m) => {
        m.geometry.dispose();
        m.dispose();
      });
      mat.dispose();
      depth.dispose();
    },
    [meshes, mat, depth],
  );

  const group = useRef<Group>(null);
  useFrame(() => {
    const on = U.uFoam.value > 0.001;
    if (group.current && group.current.visible !== on) group.current.visible = on;
    uWind.value = useJourney.getState().reducedMotion ? 0 : 1;
  });

  return (
    <group ref={group}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
