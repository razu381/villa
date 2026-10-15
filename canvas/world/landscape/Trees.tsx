"use client";

/**
 * Trees — three instanced kinds (round, tall cypress, silver olive).
 *
 * - Foam (U.uFoam): each tree scales in from its base as a model-maker's foam
 *   form (a smooth soft envelope), ease-out by its own delay. No bounce.
 * - Bloom: as the material sweep passes a tree it morphs from the foam form
 *   into clustered foliage and takes its colour (per-instance tone).
 * - Foliage shading: leaf-clump bump and cavity shading from 3D noise in the
 *   tree's own space, wrapped light and back-light translucency (per light,
 *   inside three's light loop), warm sunlit / cool shade split, a leafy
 *   broken silhouette, and a cool moonlit rim at night.
 * - Life (U.uLife): richer colour and a slow wind sway (+ a faint leaf flutter).
 * - Clipped by the section plane; a custom depth material keeps the shadows in
 *   step with the morph and growth.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix3,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Quaternion,
  RGBADepthPacking,
  ShaderChunk,
  StaticDrawUsage,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { VL_GLSL, patchVillageMaterial, sharedUniformsFor } from "@/lib/materials";
import { mulberry32 } from "@/lib/noise";
import { useJourney } from "@/lib/store";
import { U } from "@/lib/uniforms";
import type { TreeKind } from "@/lib/village";
import { groundHeight } from "../terrain/ground";
import { uCutZ } from "../terrain/terrainMaterial";
import { lin } from "../terrain/siteGlsl";
import { LANDSCAPE_TREES } from "./layout";
import { extendMaterial, inject, uWind } from "./shaderUtils";
import { FOLIAGE_NOISE_GLSL } from "./foliageGlsl";
import { buildTreeGeometry } from "./treeGeometry";

const KINDS: TreeKind[] = ["round", "tall", "olive"];
const WIDTH: Record<TreeKind, [number, number]> = { round: [0.85, 1.15], tall: [0.85, 1.1], olive: [0.9, 1.2] };
/** World wind direction (normalised in the shader's object space per instance). */
const WIND = new Vector3(0.92, 0, 0.38);

const VERT_PARS = /* glsl */ `
attribute vec3 aFoam;
attribute vec3 aFoamN;
attribute vec3 aTree;
attribute vec4 aInst;
attribute vec3 aWindO;
uniform float uFoam;
uniform float uWind;
${VL_GLSL}
varying vec3 vTreeA;
varying vec4 vTreeI;
varying float vTreeB;
varying vec3 vTreeL;
float tv_bloom() {
  return smoothstep(-3.0, 12.0, vl_sweepDist(instanceMatrix[3].xyz));
}
float tv_grow() {
  float k = clamp((uFoam - aInst.x * 0.55) / 0.45, 0.0, 1.0);
  return 1.0 - pow(1.0 - k, 3.0);
}
`;

const VERT_BODY = /* glsl */ `
  vec3 tvP = mix(aFoam, position, tvB);
  vTreeL = tvP + aInst.y * 0.37;
  float tvH = max(tvP.y, 0.0);
  float tvPh = aInst.y;
  float tvSway = sin(uTime * 0.72 + tvPh) * 0.65 + sin(uTime * 1.63 + tvPh * 1.9) * 0.35;
  float tvAmt = uLife * uWind * tvB;
  tvP += aWindO * tvSway * 0.17 * tvAmt * tvH * tvH;
  vec3 tvFl = vec3(sin(uTime * 2.3 + position.x * 31.0 + tvPh), 0.0, cos(uTime * 2.1 + position.z * 29.0 + tvPh));
  tvP += tvFl * 0.012 * tvAmt * (1.0 - aTree.y) * tvH;
  transformed = tvP * tv_grow();
  vTreeA = aTree;
  vTreeI = aInst;
  vTreeB = tvB;
`;

const FRAG = /* glsl */ `
#define C_ROUND_A ${lin("#737C55")}
#define C_ROUND_B ${lin("#5C6746")}
#define C_ROUND_C ${lin("#8A9166")}
#define C_TALL_A ${lin("#465039")}
#define C_TALL_B ${lin("#535E42")}
#define C_OLIVE_A ${lin("#959C86")}
#define C_OLIVE_B ${lin("#7D8670")}
#define C_TRUNK ${lin("#7A6D5D")}
#define C_TRUNK_OLIVE ${lin("#857D70")}
#define C_MOON ${lin("#8FA0C8")}
varying vec3 vTreeA;
varying vec4 vTreeI;
varying float vTreeB;
varying vec3 vTreeL;
uniform float uCutZ;
float tvClump = 0.5;
float tvLeaf = 1.0;

${FOLIAGE_NOISE_GLSL}
/** Wrapped diffuse + back-light translucency for one light (inside three's light loop). */
void tv_foliage(IncidentLight L, vec3 raw, vec3 N, vec3 V, vec3 albedo, inout ReflectedLight rl) {
  float k = vTreeB * vlMaskT;
  if (k < 0.01) return;
  float ndl = dot(N, L.direction);
  float w = clamp((ndl + 0.55) / 1.55, 0.0, 1.0);
  rl.directDiffuse += L.color * max(w - max(ndl, 0.0), 0.0) * 0.75 * BRDF_Lambert(albedo) * k;
  // sunlight through the leaves (not the moon: no green halo at night)
  float back = pow(clamp(dot(-V, L.direction), 0.0, 1.0), 4.0);
  float rim = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  rl.directDiffuse += raw * back * (0.2 + 0.8 * rim) * 0.55 * BRDF_Lambert(albedo) * vec3(1.06, 1.12, 0.62) * k * (1.0 - uNight);
}
`;

/** Colour before the sweep mix: per-kind tone, clump noise in the tree's own space. */
const COLOR = /* glsl */ `
  {
    float kind = vTreeI.w;
    float tone = vTreeI.z;
    vec3 tc;
    if (kind < 0.5) tc = mix(mix(C_ROUND_A, C_ROUND_B, tone), C_ROUND_C, smoothstep(0.75, 1.0, tone));
    else if (kind < 1.5) tc = mix(C_TALL_A, C_TALL_B, tone);
    else tc = mix(C_OLIVE_A, C_OLIVE_B, tone);
    // leaf clumps: cells in the tree's own space (so they sway with it), each a
    // small dome bounded by dark crevices, over a slow light/dark drift
    vec3 q = vTreeL * (kind > 0.5 && kind < 1.5 ? vec3(34.0, 14.0, 34.0) : vec3(19.0));
    float fwq = fwidth(q.x) + fwidth(q.y);
    float vis = 1.0 - smoothstep(0.25, 0.8, fwq);
    // a slow warp so the clumps are irregular, never a regular scale pattern
    q += (vec3(tv_n3(q * 0.31), tv_n3(q * 0.31 + 11.0), tv_n3(q * 0.31 + 23.0)) - 0.5) * 1.6;
    // each clump a soft dome, soft valleys between them
    float dome = 1.0 - smoothstep(0.1, 0.95, tv_clumps(q));
    float drift = tv_n3(q * 0.35 + 3.0);
    float grain = tv_n3(q * 3.3 + 7.1);
    tvClump = mix(0.6, dome, vis);
    tvLeaf = mix(0.5, grain, vis);
    tc *= mix(1.0, 0.9 + 0.14 * tvClump + 0.14 * (drift - 0.5) + 0.06 * (grain - 0.5), vTreeB);
    if (vTreeA.y > 0.5) tc = kind > 1.5 ? C_TRUNK_OLIVE : C_TRUNK;
    float g = dot(tc, vec3(0.299, 0.587, 0.114));
    tc = mix(vec3(g) * vec3(1.05, 1.03, 0.95), tc, 0.55 + 0.45 * uLife);
    diffuseColor.rgb = tc;
  }
`;

/** After the sweep mix: foam back faces, the broken leafy silhouette, cavity AO. */
const POST = /* glsl */ `
  // inside faces: only where the section has cut the crown (the foam forms never show them)
  if (!gl_FrontFacing && (vTreeB < 0.995 || abs(vVlWorld.z - uCutZ) > 4.0)) discard;
  float vlMaskT = vlMask;
  {
    float bl = vTreeB * vlMask * (1.0 - vTreeA.y);
    if (bl > 0.5) {
      // leafy silhouette: clump-sized lobes eat into the rim (not pixel speckle)
      float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
      if (tvClump * 0.8 + tvLeaf * 0.2 < smoothstep(0.5, 1.0, rim) * 0.9) discard;
    }
    float ao = mix(1.0, vTreeA.x, 0.85) * mix(1.0, 0.72 + 0.34 * tvClump, bl);
    diffuseColor.rgb *= mix(1.0, ao, vTreeB);
  }
`;

/** Leaf-clump bump (derivative based, view space). */
const BUMP = /* glsl */ `
  {
    float k = vTreeB * vlMaskT * (1.0 - vTreeA.y);
    if (k > 0.01) {
      vec3 sx = dFdx(-vViewPosition);
      vec3 sy = dFdy(-vViewPosition);
      vec3 r1 = cross(sy, normal);
      vec3 r2 = cross(normal, sx);
      float det = dot(sx, r1);
      float h = (tvClump + 0.12 * tvLeaf) * 0.15;
      vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
      normal = normalize(mix(normal, abs(det) * normal - grad, k * 0.85));
    }
  }
`;

const HUE = /* glsl */ `
  {
    float k = vTreeB * vlMaskT;
    reflectedLight.directDiffuse *= mix(vec3(1.0), vec3(1.06, 1.03, 0.88), k);
    reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(0.9, 0.99, 1.1), k);
  }
`;

const MOON = /* glsl */ `
  {
    float rimM = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    totalEmissiveRadiance += C_MOON * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * pow(rimM, 3.0) * uNight * 0.35 * vTreeB;
  }
`;

function treeVertex(shader: WebGLProgramParametersWithUniforms, withNormal: boolean) {
  Object.assign(shader.uniforms, sharedUniformsFor(["uTime", "uMaterial", "uLife", "uNight", "uWindows", "uSweepFrom", "uSweepTo", "uFoam"]), { uWind });
  let vs = shader.vertexShader;
  vs = inject(vs, "#include <common>", VERT_PARS);
  vs = inject(vs, "void main() {", "void main() {\n  float tvB = tv_bloom();", "replace");
  if (withNormal) vs = inject(vs, "#include <beginnormal_vertex>", "objectNormal = normalize(mix(aFoamN, objectNormal, tvB * mix(0.32, 1.0, aTree.y)));");
  vs = inject(vs, "#include <begin_vertex>", VERT_BODY);
  shader.vertexShader = vs;
}

/** three's light loop with the foliage term added for each directional light. */
function foliageLights() {
  const src = ShaderChunk.lights_fragment_begin;
  const at = src.indexOf("#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )");
  const call = "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
  const k = src.indexOf(call, at);
  if (at < 0 || k < 0) {
    console.warn("[landscape] foliage light hook not found");
    return "#include <lights_fragment_begin>";
  }
  return (
    src.slice(0, k + call.length) +
    "\n\t\ttv_foliage( directLight, directionalLight.color, geometryNormal, geometryViewDir, material.diffuseColor, reflectedLight );" +
    src.slice(k + call.length)
  );
}

function createTreeMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.97, metalness: 0 }), {
    modelColor: "#D9DCCB",
    modelRoughness: 1,
    poche: "#3E4530",
    seam: false,
  });
  return extendMaterial(mat, "tree-v2", (shader) => {
    treeVertex(shader, true);
    shader.uniforms.uCutZ = uCutZ;
    let fs = shader.fragmentShader;
    // after every include (VL_GLSL's uniforms, the light structs), before main
    fs = inject(fs, "void main() {", `${FRAG.replace("float tvClump", "float vlMaskT = 0.0;\nfloat tvClump")}\nvoid main() {`, "replace");
    fs = inject(fs, "#include <color_fragment>", COLOR);
    fs = inject(fs, "#include <roughnessmap_fragment>", POST.replace("float vlMaskT = vlMask;", "vlMaskT = vlMask;"), "before");
    fs = inject(fs, "#include <normal_fragment_maps>", BUMP);
    fs = inject(fs, "#include <lights_fragment_begin>", foliageLights(), "replace");
    fs = inject(fs, "#include <lights_fragment_end>", HUE);
    fs = inject(fs, "#include <emissivemap_fragment>", MOON);
    shader.fragmentShader = fs;
  });
}

function createTreeDepthMaterial() {
  const mat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  mat.onBeforeCompile = (shader) => treeVertex(shader, false);
  mat.customProgramCacheKey = () => "tree-depth-v2";
  return mat;
}

const _m = new Matrix4();
const _n = new Matrix3();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _w = new Vector3();
const _up = new Vector3(0, 1, 0);

export function Trees() {
  const mat = useMemo(() => createTreeMaterial(), []);
  const depth = useMemo(() => createTreeDepthMaterial(), []);
  const meshes = useMemo(() => {
    return KINDS.map((kind, ki) => {
      const specs = LANDSCAPE_TREES.filter((t) => t.kind === kind);
      const geo = buildTreeGeometry(kind);
      const inst = new Float32Array(specs.length * 4);
      const wind = new Float32Array(specs.length * 3);
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
        // the wind, in the instance's own (rotated, scaled) space
        _w.copy(WIND).applyMatrix3(_n.setFromMatrix4(_m).invert());
        wind.set([_w.x, _w.y, _w.z], i * 3);
      });
      geo.setAttribute("aInst", new InstancedBufferAttribute(inst, 4));
      geo.setAttribute("aWindO", new InstancedBufferAttribute(wind, 3));
      mesh.instanceMatrix.setUsage(StaticDrawUsage);
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
