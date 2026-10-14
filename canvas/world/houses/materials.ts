/**
 * House materials — MeshStandardMaterials patched twice:
 *   1. lib/materials.ts patchVillageMaterial → section clip, white model → material
 *      sweep, warm seam, poché on back faces;
 *   2. the house layer below → per-house rise in the vertex shader (from the
 *      aHouse attribute that buildHouse() bakes), procedural cork / limestone /
 *      gravel / solar / timber surfaces in object space, glass that reflects
 *      the sky, and windows that switch on at night.
 *
 * Object-space texturing means the pattern sticks to a house when the homes
 * module moves its floors apart (exploded view).
 */

import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Vector2,
  MeshDepthMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import { VL_GLSL, patchVillageMaterial, sharedUniformsFor } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U, clipPlanes } from "@/lib/uniforms";

export type HouseMaterialKey = "limestone" | "cork" | "glass" | "frame" | "roof" | "solar" | "timber" | "window";

export const HOUSE_MATERIAL_KEYS: HouseMaterialKey[] = ["limestone", "cork", "roof", "window", "frame", "solar", "timber", "glass"];

/* ------------------------------------------------------------------ GLSL */

/**
 * Is a window lit, and how far through its switch-on? ~62 % of panes, 86 % of
 * living-room glazing, 75 % of skylights; staggered per house (lightDelay)
 * and per window.
 */
const WIN_ON_GLSL = /* glsl */ `
float vlWinOn(float r, float role, float lightDelay, float windows) {
  if (r < 0.0) return 0.0;
  float p = role > 1.5 && role < 2.5 ? 0.86 : (role > 2.5 && role < 3.5 ? 0.75 : 0.62);
  float lit = step(fract(r * 7.31 + 0.13), p);
  float start = 0.03 + 0.62 * lightDelay + 0.24 * fract(r * 13.7);
  return lit * smoothstep(start, start + 0.08, windows);
}
`;

/** Vertex: attributes, varyings and the per-house rise (ease-out quart). */
const RISE_PARS_VERTEX = /* glsl */ `
attribute vec4 aHouse;
attribute vec2 aWin;
uniform float uRise;
varying float vHRise;
float vlHouseRise(float delay) {
  float k = clamp((uRise - delay * 0.6) / 0.4, 0.0, 1.0);
  return 1.0 - pow(1.0 - k, 4.0);
}
`;
const RISE_VERTEX = /* glsl */ `
float hRise = vlHouseRise(aHouse.y);
vHRise = hRise;
float hBase = aHouse.x - 0.5;
transformed.y = hBase + (transformed.y - hBase) * hRise;
`;

const HOUSE_PARS_VERTEX = /* glsl */ `
${RISE_PARS_VERTEX}
varying vec3 vHObj;
varying vec3 vHObjN;
varying vec4 vHouse;
varying vec2 vHWin;
varying vec2 vHUv;
`;
const HOUSE_VERTEX = /* glsl */ `
vHObj = position;
vHObjN = normal;
vHouse = aHouse;
vHWin = aWin;
vHUv = uv;
${RISE_VERTEX}
`;

/** Fragment helpers (inserted after VL_GLSL, so uNight / uWindows are declared). */
const HOUSE_PARS_FRAGMENT = /* glsl */ `
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uGlow;
uniform vec3 uPlaster;
uniform vec3 uFloorTone;
varying float vHRise;
varying vec3 vHObj;
varying vec3 vHObjN;
varying vec4 vHouse;
varying vec2 vHWin;
varying vec2 vHUv;

// Hash without sine (stable at large coordinates).
float hH12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hH12(i), hH12(i + vec2(1.0, 0.0)), u.x), mix(hH12(i + vec2(0.0, 1.0)), hH12(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Facade coordinates in metres: (along the wall, up) on walls, (x, z) on tops.
vec2 hFace(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y > 0.5) return p.xz;
  if (a.x > a.z) return vec2(p.z, p.y);
  return vec2(p.x, p.y);
}
// Running-bond panels: returns (cell id hash, distance to nearest joint in metres).
vec2 hBond(vec2 fc, vec2 size, float seed) {
  float row = floor(fc.y / size.y);
  float x = fc.x / size.x + 0.5 * mod(row, 2.0) + seed;
  float col = floor(x);
  vec2 f = vec2(fract(x), fract(fc.y / size.y));
  vec2 d = min(f, 1.0 - f) * size;
  return vec2(hH12(vec2(col, row) + seed * 17.0), min(d.x, d.y));
}
// Bump from a scalar height via screen-space derivatives (Mikkelsen).
vec3 hPerturb(vec3 n, float h) {
  vec3 sp = -vViewPosition;
  vec3 sx = dFdx(sp);
  vec3 sy = dFdy(sp);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}
${WIN_ON_GLSL}
float hWinOn(float r, float role) {
  return vlWinOn(r, role, vHouse.z, uWindows);
}
// Cheap baked-in occlusion: ground contact and window reveals (darker towards the glass).
float hAmbientOcc() {
  float ao = abs(vHWin.y - 6.0) < 0.5 ? 1.0 : mix(0.6, 1.0, smoothstep(-0.05, 1.4, vHObj.y - vHouse.x));
  if (vHWin.y < -0.5) ao *= mix(1.0, 0.5, smoothstep(0.02, 0.5, vHUv.y));
  return ao;
}
// Warm interior colour per window: amber, honey or pale.
vec3 hWinColor(float r) {
  float k = fract(r * 3.97);
  vec3 c = uGlow * vec3(1.0, 0.86, 0.64);
  c = mix(c, uGlow * vec3(1.0, 0.77, 0.5), smoothstep(0.6, 0.9, k));
  c = mix(c, uGlow * vec3(1.0, 0.95, 0.84), 1.0 - smoothstep(0.1, 0.3, k));
  return c;
}
`;

interface HouseShaderParts {
  /** After color_fragment (before the white-model mix). Write diffuseColor.rgb; may declare hRough / hBumpH. */
  color?: string;
  /** After roughnessmap_fragment (before the white-model mix). */
  rough?: string;
  /** After normal_fragment_maps; vlMask is available. */
  normal?: string;
  /** After emissivemap_fragment (before ×vlMask). */
  emissive?: string;
  /** After the poché override, before tone mapping (gl_FragColor is final here). */
  post?: string;
}

const REVEAL_SPILL = /* glsl */ `
if (vHWin.y < -0.5) {
  float spill = hWinOn(vHWin.x, -vHWin.y);
  totalEmissiveRadiance += hWinColor(vHWin.x) * 0.32 * spill;
}
if (abs(vHWin.y - 6.0) < 0.5) {
  float st = 0.03 + 0.62 * vHouse.z;
  totalEmissiveRadiance += uGlow * 0.16 * smoothstep(st, st + 0.12, uWindows) + uPlaster * vec3(1.0, 0.95, 0.86) * 0.45 * (1.0 - uNight);
}
`;

/* ---------------------------------------------------------- per material */

const CORK: HouseShaderParts = {
  color: /* glsl */ `
  vec3 hp = vHObj + vec3(vHouse.w * 37.0, 0.0, vHouse.w * 53.0);
  vec2 fc = hFace(hp, vHObjN);
  float fw = max(fwidth(fc.x) + fwidth(fc.y), 1e-5);
  // Large-format panels in running bond, each a slightly different batch.
  vec2 bond = hBond(fc, vec2(1.2, 0.6), vHouse.w * 7.0);
  float jointVis = 1.0 - smoothstep(0.035, 0.11, fw);
  float joint = (1.0 - smoothstep(0.003, 0.003 + fw, bond.y)) * jointVis;
  // Granules: fine (close-ups) and a mid-scale salt-and-pepper that reads from afar.
  float granVis = 1.0 - smoothstep(0.006, 0.03, fw);
  float midVis = 1.0 - smoothstep(0.05, 0.16, fw);
  float g1 = hNoise(fc * 41.0);
  float g2 = hNoise(fc * 113.0 + 17.0);
  float gran = g1 * 0.55 + g2 * 0.45;
  float mid = hNoise(fc * 13.0 + 3.7) * 0.6 + hNoise(fc * 27.0 + 9.1) * 0.4;
  float mot = hNoise(fc * 1.3 + vHouse.w * 11.0);
  vec3 cork = diffuseColor.rgb * (1.0 + (bond.x - 0.5) * 0.12 + (mot - 0.5) * 0.08);
  cork *= 1.0 + (mid - 0.5) * 0.24 * midVis;
  float speck = smoothstep(0.2, 0.8, gran);
  cork = mix(cork, cork * mix(0.55, 1.28, speck), granVis);
  cork *= 1.0 - joint * 0.16;
  diffuseColor.rgb = cork;
  float hBumpH = (gran * 0.006 - joint * 0.004) * granVis;
  float hRough = 0.95;
  `,
  rough: /* glsl */ `roughnessFactor = hRough;`,
  normal: /* glsl */ `normal = hPerturb(normal, hBumpH * vlMask);`,
  emissive: REVEAL_SPILL,
};

const LIMESTONE: HouseShaderParts = {
  color: /* glsl */ `
  vec3 hp = vHObj + vec3(vHouse.w * 23.0, 0.0, vHouse.w * 41.0);
  vec2 fc = hFace(hp, vHObjN);
  float fw = max(fwidth(fc.x) + fwidth(fc.y), 1e-5);
  vec2 bond = hBond(fc, vec2(1.15, 0.55), vHouse.w * 5.0);
  float jointVis = 1.0 - smoothstep(0.03, 0.1, fw);
  float joint = (1.0 - smoothstep(0.0025, 0.0025 + fw, bond.y)) * jointVis;
  float grainVis = 1.0 - smoothstep(0.004, 0.02, fw);
  float grain = hNoise(fc * 150.0) * 0.5 + hNoise(fc * 37.0 + 3.0) * 0.5;
  float cloud = hNoise(fc * 0.9 + vHouse.w * 9.0);
  vec3 stone = diffuseColor.rgb;
  stone *= 1.0 + (bond.x - 0.5) * 0.075 * jointVis + (cloud - 0.5) * 0.05;
  stone = mix(stone, stone * vec3(1.02, 1.0, 0.96), smoothstep(0.6, 1.0, bond.x) * jointVis);
  stone *= 1.0 + (grain - 0.5) * 0.12 * grainVis;
  stone *= 1.0 - joint * 0.12;
  diffuseColor.rgb = stone;
  float hBumpH = (grain * 0.0012 - joint * 0.003) * grainVis;
  float hRough = 0.82;
  // Interior rooms (seen only through the section cut): plaster walls, oak floor.
  if (abs(vHWin.y - 6.0) < 0.5) {
    float board = hH12(vec2(floor(fc.y / 0.18), 3.0));
    diffuseColor.rgb = vHObjN.y > 0.5 ? uFloorTone * (0.9 + 0.2 * board) : uPlaster * (vHObjN.y < -0.5 ? 0.94 : 1.0);
    hBumpH = 0.0;
    hRough = 0.9;
  }
  `,
  rough: /* glsl */ `roughnessFactor = hRough;`,
  normal: /* glsl */ `normal = hPerturb(normal, hBumpH * vlMask);`,
  emissive: REVEAL_SPILL,
};

const ROOF: HouseShaderParts = {
  color: /* glsl */ `
  vec2 fc = vHObj.xz + vHouse.w * 31.0;
  float fw = max(fwidth(fc.x) + fwidth(fc.y), 1e-5);
  float vis = 1.0 - smoothstep(0.004, 0.025, fw);
  float pebble = hNoise(fc * 60.0) * 0.6 + hNoise(fc * 150.0) * 0.4;
  float patchy = hNoise(fc * 0.8);
  vec3 g = diffuseColor.rgb * (1.0 + (patchy - 0.5) * 0.06);
  g *= 1.0 + (pebble - 0.5) * 0.3 * vis;
  diffuseColor.rgb = g;
  float hBumpH = pebble * 0.01 * vis;
  `,
  normal: /* glsl */ `normal = hPerturb(normal, hBumpH * vlMask);`,
};

const SOLAR: HouseShaderParts = {
  color: /* glsl */ `
  // vHUv is metric across the panel (1.0 × 1.65 m) on its top face.
  vec2 q = vHUv;
  float fw = max(fwidth(q.x) + fwidth(q.y), 1e-5);
  vec2 cs = vec2(1.0 / 6.0, 1.65 / 10.0);
  vec2 cf = (0.5 - abs(fract(q / cs) - 0.5)) * cs; // metres to the nearest cell line
  float gridVis = 1.0 - smoothstep(0.008, 0.03, fw);
  float grid = (1.0 - smoothstep(0.003, 0.003 + fw, min(cf.x, cf.y))) * gridVis;
  float edge = min(min(q.x, 1.0 - q.x), min(q.y, 1.65 - q.y));
  float rim = 1.0 - smoothstep(0.022, 0.022 + fw, edge);
  vec3 silver = vec3(0.40, 0.42, 0.44);
  vec3 col = diffuseColor.rgb * (0.92 + 0.16 * hH12(floor(q / cs) + vHouse.w * 50.0) * gridVis);
  col = mix(col, vec3(0.30, 0.32, 0.36), grid * 0.55);
  col = mix(col, silver, rim);
  diffuseColor.rgb = mix(silver * 0.5, col, step(0.5, vHObjN.y));
  `,
};

const TIMBER: HouseShaderParts = {
  color: /* glsl */ `
  vec3 hp = vHObj + vHouse.w * 13.0;
  vec2 fc = hFace(hp, vHObjN);
  float fw = max(fwidth(fc.x) + fwidth(fc.y), 1e-5);
  float board = floor(fc.y / 0.145);
  float bt = hH12(vec2(board, 7.0 + vHouse.w * 31.0));
  float grainVis = 1.0 - smoothstep(0.004, 0.02, fw);
  float grain = hNoise(vec2(fc.x * 3.0, fc.y * 90.0) + bt * 40.0);
  float fb = fract(fc.y / 0.145);
  float dGap = (0.5 - abs(fb - 0.5)) * 0.145;
  float gap = (1.0 - smoothstep(0.003, 0.003 + fw, dGap)) * (1.0 - smoothstep(0.01, 0.04, fw));
  vec3 wood = diffuseColor.rgb * (0.9 + bt * 0.2 * (1.0 - smoothstep(0.03, 0.1, fw)));
  wood *= 1.0 + (grain - 0.5) * 0.22 * grainVis;
  wood *= 1.0 - gap * 0.45;
  diffuseColor.rgb = wood;
  `,
};

const FRAME: HouseShaderParts = {};

/** Window panes: dark tinted glass reflecting the sky by day; warm interiors at night. */
const WINDOW: HouseShaderParts = {
  emissive: /* glsl */ `
  {
    vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    vec3 vW = normalize(cameraPosition - vVlWorld);
    float ndv = clamp(dot(nW, vW), 0.0, 1.0);
    vec3 rW = reflect(-vW, nW);
    vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.55, rW.y));
    vec3 ground = uSkyHorizon * vec3(0.3, 0.29, 0.26);
    vec3 env = mix(ground, sky, smoothstep(-0.12, 0.08, rW.y));
    float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    // A soft horizon band breaks up the reflection like clouds and far trees.
    float band = hNoise(vec2(atan(rW.x, rW.z) * 6.0 + vHWin.x * 40.0, rW.y * 9.0));
    env *= (0.86 + 0.28 * band) * (0.75 + 0.4 * vHUv.y);
    float role = vHWin.y;
    float on = hWinOn(vHWin.x, role);
    vec2 q = vHUv;
    // Interior: a lamp-lit room — brighter ceiling, a darker sill band, soft edges.
    float vig = smoothstep(0.0, 0.18, q.x) * smoothstep(1.0, 0.82, q.x) * smoothstep(0.0, 0.12, q.y) * smoothstep(1.0, 0.9, q.y);
    float room = 0.42 + 0.58 * smoothstep(0.05, 0.85, q.y);
    float pool = exp(-pow((q.x - (0.3 + 0.4 * fract(vHWin.x * 5.3))) * 2.4, 2.0));
    float curtain = step(0.62, fract(vHWin.x * 19.1));
    float inner = mix(0.55, 1.0, vig) * room * (0.72 + 0.4 * pool);
    inner = mix(inner, inner * 0.62 + 0.18, curtain);
    float gain = role > 2.5 && role < 3.5 ? 2.0 : (role > 1.5 && role < 2.5 ? 2.3 : 2.0);
    vec3 glow = hWinColor(vHWin.x) * gain * inner * on;
    totalEmissiveRadiance += env * (0.08 + 0.92 * fres) * (1.0 - 0.75 * on) + glow;
  }
  `,
  // Seen from inside a cut room, a window is daylight (night sky after dark), not poché.
  post: /* glsl */ `
  if (!gl_FrontFacing) {
    vec3 dayLight = mix(uSkyHorizon, vec3(1.0), 0.3);
    gl_FragColor = vec4(mix(dayLight, uSkyTop * 0.7, uNight), 1.0);
  }
  `,
};

/** Balustrade glass: faint tint, fresnel edge from the sky. */
const GLASS: HouseShaderParts = {
  emissive: /* glsl */ `
  {
    vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    vec3 vW = normalize(cameraPosition - vVlWorld);
    float ndv = clamp(abs(dot(nW, vW)), 0.0, 1.0);
    float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    totalEmissiveRadiance += mix(uSkyHorizon, uSkyTop, 0.4) * fres * 0.5;
    diffuseColor.a = mix(diffuseColor.a, 0.75, fres);
  }
  `,
};

/* --------------------------------------------------------------- factory */

function houseMaterial(
  key: HouseMaterialKey,
  mat: MeshStandardMaterial,
  parts: HouseShaderParts,
  patch: Parameters<typeof patchVillageMaterial>[1] = {},
) {
  patchVillageMaterial(mat, patch);
  const vlCompile = mat.onBeforeCompile;
  const uGlow = { value: new Color(PALETTE.windowGlow) };
  const uPlaster = { value: new Color("#E6DFD1") };
  const uFloorTone = { value: new Color("#A9896A") };
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
    vlCompile.call(mat, shader, renderer);
    Object.assign(shader.uniforms, {
      uRise: U.uRise,
      uSkyTop: U.uSkyTop,
      uSkyHorizon: U.uSkyHorizon,
      uGlow,
      uPlaster,
      uFloorTone,
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${HOUSE_PARS_VERTEX}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${HOUSE_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <clipping_planes_pars_fragment>", `#include <clipping_planes_pars_fragment>\n${HOUSE_PARS_FRAGMENT}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\nif (vHRise < 0.0005) discard;`)
      .replace("#include <color_fragment>", `#include <color_fragment>\nfloat hAO = hAmbientOcc();\n${parts.color ?? ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${parts.rough ?? ""}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${parts.normal ?? ""}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${parts.emissive ?? ""}`)
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= hAO;
        reflectedLight.indirectSpecular *= hAO;
        reflectedLight.directDiffuse *= mix(1.0, hAO, 0.4);`,
      )
      .replace("#include <tonemapping_fragment>", `${parts.post ?? ""}\n#include <tonemapping_fragment>`);
  };
  const vlKey = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => `${vlKey}:house:${key}`;
  mat.name = `house-${key}`;
  return mat;
}

/**
 * House tones, calibrated against the facade renders: the cork reads golden
 * tan in sun (more yellow than PALETTE.cork), limestone a warm cream.
 */
export const TONES = {
  cork: "#9E8667",
  limestone: "#DED3BE",
  bronze: "#6E634D",
  timber: "#8E7A62",
} as const;

let cache: Record<HouseMaterialKey, MeshStandardMaterial> | null = null;

/**
 * The cached, shared house materials (one per material key). They expect
 * geometry from buildHouse() (aHouse / aWin attributes). Rise, window glow
 * and the sweep run on the GPU from the shared uniforms; nothing per frame.
 */
export function getHouseMaterials(): Record<HouseMaterialKey, MeshStandardMaterial> {
  if (cache) return cache;
  cache = {
    limestone: houseMaterial("limestone", new MeshStandardMaterial({ color: TONES.limestone, roughness: 0.82 }), LIMESTONE),
    cork: houseMaterial("cork", new MeshStandardMaterial({ color: TONES.cork, roughness: 0.95 }), CORK),
    roof: houseMaterial("roof", new MeshStandardMaterial({ color: "#CBC4B4", roughness: 1 }), ROOF),
    window: houseMaterial(
      "window",
      new MeshStandardMaterial({ color: PALETTE.glass, roughness: 0.12, metalness: 0.0 }),
      WINDOW,
      { modelColor: "#DAD6CD" },
    ),
    frame: houseMaterial("frame", new MeshStandardMaterial({ color: TONES.bronze, roughness: 0.45, metalness: 0.25 }), FRAME),
    solar: houseMaterial("solar", new MeshStandardMaterial({ color: "#1A2029", roughness: 0.28, metalness: 0.35 }), SOLAR),
    timber: houseMaterial("timber", new MeshStandardMaterial({ color: TONES.timber, roughness: 0.72 }), TIMBER),
    glass: houseMaterial(
      "glass",
      new MeshStandardMaterial({ color: "#B9C6C4", roughness: 0.06, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false }),
      GLASS,
      { poche: null, modelColor: "#F4F2EC" },
    ),
  };
  return cache;
}

let depthCache: MeshDepthMaterial | null = null;

/**
 * Shadow-pass material for house meshes: same per-house rise as the colour
 * pass, so shadows grow with the houses. Set it as `mesh.customDepthMaterial`.
 * (Section clipping is copied over by three from the colour material.)
 */
export function getHouseDepthMaterial(): MeshDepthMaterial {
  if (depthCache) return depthCache;
  const m = new MeshDepthMaterial();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRise = U.uRise;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${RISE_PARS_VERTEX}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${RISE_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying float vHRise;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\nif (vHRise < 0.0005) discard;`);
  };
  m.customProgramCacheKey = () => "house-depth";
  depthCache = m;
  return m;
}

/* ----------------------------------------------------------------- spill */

let spillCache: ShaderMaterial | null = null;

/**
 * Night light pooling on the ground / deck in front of lit glazing (additive).
 * Geometry: HouseBuild.spill / the village merge. Invisible by day.
 */
export function getHouseSpillMaterial(): ShaderMaterial {
  if (spillCache) return spillCache;
  spillCache = new ShaderMaterial({
    name: "house-spill",
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    clipping: true,
    clippingPlanes: clipPlanes,
    uniforms: { uRise: U.uRise, uWindows: U.uWindows, uGlow: { value: new Color(PALETTE.windowGlow) } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      ${RISE_PARS_VERTEX}
      ${WIN_ON_GLSL}
      uniform float uWindows;
      varying vec2 vUv;
      varying float vOn;
      varying float vR;
      void main() {
        vUv = uv;
        vR = aWin.x;
        vOn = vlWinOn(aWin.x, aWin.y, aHouse.z, uWindows) * step(0.999, vlHouseRise(aHouse.y));
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 uGlow;
      varying vec2 vUv;
      varying float vOn;
      varying float vR;
      void main() {
        #include <clipping_planes_fragment>
        if (vOn <= 0.001) discard;
        float across = smoothstep(0.0, 0.32, vUv.x) * smoothstep(1.0, 0.68, vUv.x);
        float along = pow(1.0 - vUv.y, 2.2) * smoothstep(0.0, 0.05, vUv.y);
        vec3 c = uGlow * vec3(1.0, 0.92, 0.8) * (0.9 + 0.2 * fract(vR * 3.97));
        gl_FragColor = vec4(c * 0.5 * vOn * across * along, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return spillCache;
}

/* ------------------------------------------------------------------ mask */

let maskCache: ShaderMaterial | null = null;

/**
 * Depth-only hidden-line mask (geometry from buildHouseMask / the village
 * merge). Each envelope box shrinks from the bottom as its house rises, so
 * mask + risen house always fill the final volume. Draw it after the houses'
 * opaque meshes and before the lines.
 */
export function getHouseMaskMaterial(): ShaderMaterial {
  if (maskCache) return maskCache;
  maskCache = new ShaderMaterial({
    name: "house-line-mask",
    colorWrite: false,
    depthWrite: true,
    side: DoubleSide,
    clipping: true,
    clippingPlanes: clipPlanes,
    uniforms: { uRise: U.uRise },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      attribute vec4 aMask;
      uniform float uRise;
      void main() {
        float k = clamp((uRise - aMask.z * 0.6) / 0.4, 0.0, 1.0);
        k = 1.0 - pow(1.0 - k, 4.0);
        float y0 = aMask.x + aMask.w;
        float y1 = aMask.y + aMask.w;
        float base = aMask.w - 0.5;
        vec3 transformed = position;
        if (transformed.y < 0.5 * (y0 + y1)) transformed.y = max(y0, base + (y1 - base) * k);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      void main() {
        #include <clipping_planes_fragment>
        gl_FragColor = vec4(0.0);
      }`,
  });
  return maskCache;
}

/* ----------------------------------------------------------------- lines */

let lineCache: ShaderMaterial | null = null;

/**
 * Hairline resolution + width, shared by every house line material.
 * canvas/world/Houses.tsx keeps it in sync with the drawing buffer each frame;
 * call updateHouseLineResolution(gl) yourself if Houses is not mounted.
 */
export const HOUSE_LINE_RES = { uRes: { value: new Vector2(1440, 900) }, uWidth: { value: 1.3 } };
export function updateHouseLineResolution(gl: WebGLRenderer, cssWidth = 1.15) {
  gl.getDrawingBufferSize(HOUSE_LINE_RES.uRes.value);
  HOUSE_LINE_RES.uWidth.value = cssWidth * gl.getPixelRatio();
}

/**
 * The architect's line drawing: hairlines traced in per house (uLines), ink
 * olive on paper; as the house rises they settle to a faint graphite trace on
 * the white model, and vanish where the material sweep has passed.
 * Use with geometry from buildHouseLines() (aLine attribute).
 */
export function getHouseLineMaterial(): ShaderMaterial {
  if (lineCache) return lineCache;
  lineCache = new ShaderMaterial({
    name: "house-lines",
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    clipping: true,
    clippingPlanes: clipPlanes,
    uniforms: {
      ...sharedUniformsFor(["uTime", "uMaterial", "uLife", "uNight", "uWindows", "uSweepFrom", "uSweepTo", "uLines", "uRise"]),
      ...HOUSE_LINE_RES,
      uInk: { value: new Color(PALETTE.olive) },
      uGraphite: { value: new Color("#6E6B60") },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      uniform vec2 uRes;
      uniform float uWidth;
      attribute vec3 aOther;
      attribute float aSide;
      attribute vec4 aLine;
      varying vec4 vLine;
      varying vec3 vWorld;
      varying float vDist;
      void main() {
        vLine = aLine;
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec4 mvOther = modelViewMatrix * vec4(aOther, 1.0);
        // A hair towards the camera (≈2.5 cm per 100 m) so edges win over their own faces.
        mvPosition.xyz *= 1.0 - 0.00025;
        mvOther.xyz *= 1.0 - 0.00025;
        vec4 cThis = projectionMatrix * mvPosition;
        vec4 cOther = projectionMatrix * mvOther;
        vec2 half_ = uRes * 0.5;
        vec2 sThis = cThis.xy / cThis.w * half_;
        vec2 sOther = cOther.xy / cOther.w * half_;
        vec2 d = sOther - sThis;
        float len = length(d);
        vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
        if (aLine.y > 0.5) dir = -dir; // A → B at both ends
        vec2 nrm = vec2(-dir.y, dir.x);
        float ext = uWidth * 0.5 + 1.0;
        vec2 off = nrm * aSide * ext + dir * (aLine.y > 0.5 ? 1.0 : -1.0) * min(ext, 0.5 * len);
        vDist = aSide * ext;
        gl_Position = cThis + vec4(off / half_ * cThis.w, 0.0, 0.0);
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      ${VL_GLSL}
      uniform float uLines;
      uniform float uRise;
      uniform vec3 uInk;
      uniform vec3 uGraphite;
      uniform float uWidth;
      varying vec4 vLine;
      varying vec3 vWorld;
      varying float vDist;
      void main() {
        #include <clipping_planes_fragment>
        float delay = vLine.x;
        float lp = clamp((uLines - delay * 0.55) / 0.45, 0.0, 1.0);
        float segP = clamp((lp - vLine.z * 0.78) / vLine.w, 0.0, 1.0);
        if (segP <= 0.0 || vLine.y > segP) discard;
        float k = clamp((uRise - delay * 0.6) / 0.4, 0.0, 1.0);
        k = 1.0 - pow(1.0 - k, 4.0);
        float a = mix(0.9, 0.3, k) * (1.0 - vl_sweepMask(vWorld));
        // The pen tip: the last few centimetres of a stroke in progress are a touch darker.
        a = min(1.0, a * (1.0 + 0.6 * (1.0 - step(1.0, segP)) * smoothstep(segP - 0.08, segP, vLine.y)));
        // Anti-aliased hairline profile; sub-pixel widths fade instead of thinning.
        float w = max(uWidth, 1.0);
        a *= clamp(w * 0.5 + 0.5 - abs(vDist), 0.0, 1.0) * min(uWidth, 1.0);
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(uInk, uGraphite, k), a);
        #include <colorspace_fragment>
      }`,
  });
  return lineCache;
}
