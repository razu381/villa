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
 * module moves its floors apart (exploded view). Fine patterns (joints, cell
 * grids) are box-filtered and granular detail fades by pixel footprint, so
 * nothing aliases or shimmers at any distance.
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
  // Glazing 86 %, skylights 75 %, wall lights (and their wash) always, panes 62 %.
  float p = role > 1.5 && role < 2.5 ? 0.86 : (role > 2.5 && role < 3.5 ? 0.75 : ((role > 3.5 && role < 4.5) || role > 6.5 ? 1.0 : 0.62));
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
// Integral of a pulse train: width w, centred on every multiple of P.
float hPulseInt(float x, float P, float w) {
  x += 0.5 * w;
  float n = floor(x / P);
  return n * w + min(x - n * P, w);
}
// Box-filtered coverage (0..1) of joint lines of width w every P metres, over
// a pixel footprint fw: crisp up close, an exact mean tone far away (no moiré).
float hJoint(float x, float P, float w, float fw) {
  fw = max(fw, 1e-5);
  return (hPulseInt(x + 0.5 * fw, P, w) - hPulseInt(x - 0.5 * fw, P, w)) / fw;
}
// Same, but never thinner than ~0.7 px: past that it widens at lower contrast
// (energy-conserving), so a fine grid still reads faintly at mid distance.
float hFineLine(float x, float P, float w, float fw) {
  float we = max(w, 0.7 * fw);
  return hJoint(x, P, we, fw) * (w / we);
}
// Cellular granules (Worley): x = F1, y = F2 - F1 (0 on a border), z = id of the nearest cell.
vec3 hCells(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 c = i + g;
      vec2 o = vec2(hH12(c), hH12(c + 19.19)) * 0.8 + 0.1;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hH12(c + 7.77);
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  d1 = sqrt(d1);
  return vec3(d1, sqrt(d2) - d1, id);
}
// A reflected tree line along a facade (x in metres): rounded crowns, 0..1.
float hCrowns(float x) {
  float cell = floor(x / 1.5);
  float h = 0.22 + 0.12 * hNoise(vec2(x * 0.6, 2.0));
  for (int i = -1; i <= 1; i++) {
    float c = cell + float(i);
    float cx = (c + 0.15 + 0.7 * hH12(vec2(c, 9.1))) * 1.5;
    float rad = 0.45 + 0.75 * hH12(vec2(c, 3.3));
    float d = (x - cx) / rad;
    float top = 0.45 + 0.55 * hH12(vec2(c, 5.5));
    h = max(h, top * sqrt(max(1.0 - d * d, 0.0)));
  }
  return h;
}
// Metric size (W, H) of a quad whose uv runs 0..1 across it (panes, lamps), from
// the ratio of facade-metre to uv derivatives — exact on a plane.
vec2 hQuadSize(vec2 q, vec2 fc) {
  vec2 qx = dFdx(q);
  vec2 qy = dFdy(q);
  vec2 cx = dFdx(fc);
  vec2 cy = dFdy(fc);
  float W = abs(cx.x * qx.x + cy.x * qy.x) / max(qx.x * qx.x + qy.x * qy.x, 1e-14);
  float H = abs(cx.y * qx.y + cy.y * qy.y) / max(qx.y * qx.y + qy.y * qy.y, 1e-14);
  return vec2(W, H);
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
  // Degenerate derivatives (grazing / sub-pixel faces) give a zero vector; a NaN
  // normal here poisons the bloom mip chain and blacks out the whole frame.
  vec3 r = abs(det) * n - grad;
  return dot(r, r) > 1e-24 ? normalize(r) : n;
}
${WIN_ON_GLSL}
float hWinOn(float r, float role) {
  return vlWinOn(r, role, vHouse.z, uWindows);
}
// Cheap baked-in occlusion: ground contact (walls only) and window reveals (darker towards the glass).
float hAmbientOcc() {
  if (abs(vHWin.y - 6.0) < 0.5) return 1.0;
  float ground = mix(0.6, 1.0, smoothstep(-0.05, 1.4, vHObj.y - vHouse.x));
  float ao = mix(1.0, ground, 1.0 - abs(vHObjN.y));
  if (vHWin.y < -0.5) ao *= mix(1.0, 0.5, smoothstep(0.02, 0.5, vHUv.y));
  return ao;
}
// The sky seen in a surface of world normal nW: (rgb = sky/ground env, a = fresnel).
vec4 hSkyEnv(vec3 nW, vec3 vW) {
  float ndv = clamp(abs(dot(nW, vW)), 0.0, 1.0);
  vec3 rW = reflect(-vW, nW);
  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.55, rW.y));
  vec3 ground = mix(uSkyHorizon, uSkyTop, 0.5) * vec3(0.46, 0.45, 0.4);
  vec3 env = mix(ground, sky, smoothstep(-0.14, 0.1, rW.y));
  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  return vec4(env, fres);
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

const WALL_EMISSIVE = /* glsl */ `
if (vHWin.y < -0.5) {
  float spill = hWinOn(vHWin.x, -vHWin.y);
  totalEmissiveRadiance += hWinColor(vHWin.x) * 0.32 * spill;
}
if (abs(vHWin.y - 6.0) < 0.5) {
  float st = 0.03 + 0.62 * vHouse.z;
  totalEmissiveRadiance += uGlow * 0.16 * smoothstep(st, st + 0.12, uWindows) + uPlaster * vec3(1.0, 0.95, 0.86) * 0.45 * (1.0 - uNight);
}
`;

/** ROLE.cap faces (inside sunk shells) render as the section poché. */
const POCHE_CAP = /* glsl */ `
if (abs(vHWin.y - 8.0) < 0.5) gl_FragColor = vec4(uPoche * mix(1.0, 0.45, uNight), 1.0);
`;

/* ---------------------------------------------------------- per material */

const CORK: HouseShaderParts = {
  color: /* glsl */ `
  vec3 hp = vHObj + vec3(vHouse.w * 37.0, 0.0, vHouse.w * 53.0);
  vec2 fc = hFace(hp, vHObjN);
  vec2 fw2 = max(fwidth(fc), vec2(1e-5));
  float fw = fw2.x + fw2.y;
  // Large-format expanded-cork panels (1.2 × 0.6 m) in a loosely staggered
  // bond, each a slightly different batch. Joints are box-filtered: crisp
  // recessed lines up close, fading into the per-panel tone far away.
  vec2 psz = vec2(1.2, 0.6);
  float row = floor(fc.y / psz.y);
  float off = 0.5 * mod(row, 2.0) + 0.3 * (hH12(vec2(row, vHouse.w * 13.0)) - 0.5);
  float px = fc.x / psz.x + off;
  float pid = hH12(vec2(floor(px), row) + vHouse.w * 17.0);
  float joint = max(hJoint(fc.y, psz.y, 0.005, fw2.y), hJoint(fc.x + off * psz.x, psz.x, 0.005, fw2.x));
  // Granules: 6–12 mm agglomerated grains with dark interstices, each grain its
  // own tone (fades to its mean once a grain is under ~2 px).
  // Two octaves, each shown only while its grains span ≥ ~3 px (no aliasing):
  // fine 9 mm grains up close, 2.6 cm clusters out to ~10 m.
  vec3 cel = hCells(fc * 105.0);
  float granVis = 1.0 - smoothstep(0.0025, 0.007, fw);
  float inter = 1.0 - smoothstep(0.03, 0.26, cel.y);
  float grain = (cel.z - 0.5) * 0.17 - (inter - 0.25) * 0.22;
  vec3 cel2 = hCells(fc * 56.0 + 11.0);
  float clusterVis = (1.0 - smoothstep(0.0055, 0.012, fw)) * (1.0 - 0.5 * granVis);
  float inter2 = 1.0 - smoothstep(0.015, 0.14, cel2.y);
  float cluster = (cel2.z - 0.5) * 0.07 - (inter2 - 0.15) * 0.14;
  // Sub-grain fleck (only in close-ups) and a faint mid-scale cloud.
  float fleck = hNoise(fc * 340.0) - 0.5;
  float fleckVis = 1.0 - smoothstep(0.0012, 0.004, fw);
  float mid = hNoise(fc * 13.0 + 3.7) * 0.6 + hNoise(fc * 27.0 + 9.1) * 0.4;
  float midVis = 1.0 - smoothstep(0.05, 0.16, fw);
  float mot = hNoise(fc * 1.3 + vHouse.w * 11.0);
  // Per-panel tone only while a panel spans a few pixels (no shimmer from afar).
  float panelVis = 1.0 - smoothstep(0.12, 0.3, fw);
  vec3 cork = diffuseColor.rgb * (1.0 + (pid - 0.5) * 0.12 * panelVis + (mot - 0.5) * 0.06 + (vHouse.w - 0.5) * 0.06);
  cork *= 1.0 + (mid - 0.5) * 0.07 * midVis;
  cork *= 1.0 + grain * granVis + cluster * clusterVis + fleck * 0.12 * fleckVis;
  // Darker grains read slightly redder-brown, interstices cooler.
  cork = mix(cork, cork * vec3(0.93, 0.95, 1.02), inter * granVis * 0.6);
  cork *= 1.0 - joint * 0.38;
  diffuseColor.rgb = cork;
  // (Joint relief only where a joint spans several pixels: thin features bumped
  // via screen derivatives turn into dashes.)
  float jointBump = 1.0 - smoothstep(0.0008, 0.002, max(fw2.x, fw2.y));
  float hBumpH = ((1.0 - inter) * 0.0028 + (cel.z - 0.5) * 0.0012) * granVis + (1.0 - inter2) * 0.003 * clusterVis + fleck * 0.0004 * fleckVis - joint * 0.004 * jointBump;
  float hRough = 0.95;
  `,
  rough: /* glsl */ `roughnessFactor = hRough;`,
  normal: /* glsl */ `normal = hPerturb(normal, hBumpH * vlMask);`,
  emissive: WALL_EMISSIVE,
  post: POCHE_CAP,
};

const LIMESTONE: HouseShaderParts = {
  color: /* glsl */ `
  vec3 hp = vHObj + vec3(vHouse.w * 23.0, 0.0, vHouse.w * 41.0);
  vec2 fc = hFace(hp, vHObjN);
  vec2 fw2 = max(fwidth(fc), vec2(1e-5));
  float fw = fw2.x + fw2.y;
  // Ashlar blocks (1.15 × 0.55 m, running bond) with box-filtered joints: a
  // fine line up close, a faint coursing at mid distance, the mean far away.
  vec2 bsz = vec2(1.15, 0.55);
  float brow = floor(fc.y / bsz.y);
  float boff = 0.5 * mod(brow, 2.0) + vHouse.w * 5.0;
  vec2 bond = vec2(hH12(vec2(floor(fc.x / bsz.x + boff), brow) + vHouse.w * 85.0), 0.0);
  float jointVis = 1.0 - smoothstep(0.15, 0.35, fw);
  float joint = max(hJoint(fc.y, bsz.y, 0.005, fw2.y), hJoint(fc.x + boff * bsz.x, bsz.x, 0.005, fw2.x));
  float grainVis = 1.0 - smoothstep(0.004, 0.02, fw);
  float grain = hNoise(fc * 150.0) * 0.5 + hNoise(fc * 37.0 + 3.0) * 0.5;
  float cloud = hNoise(fc * 0.9 + vHouse.w * 9.0);
  vec3 stone = diffuseColor.rgb;
  stone *= 1.0 + (bond.x - 0.5) * 0.075 * jointVis + (cloud - 0.5) * 0.05;
  stone = mix(stone, stone * vec3(1.02, 1.0, 0.96), smoothstep(0.6, 1.0, bond.x) * jointVis);
  stone *= 1.0 + (grain - 0.5) * 0.12 * grainVis;
  stone *= 1.0 - joint * 0.36;
  diffuseColor.rgb = stone;
  float hBumpH = (grain * 0.0012 - joint * 0.003 * (1.0 - smoothstep(0.0008, 0.002, fw))) * grainVis;
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
  emissive: WALL_EMISSIVE,
  post: POCHE_CAP,
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
  // Contact shade where the gravel meets the parapets (its size rides in aWin).
  if (vHWin.y > 9.5 && vHObjN.y > 0.5) {
    vec2 gs = vec2(vHWin.x, vHWin.y - 10.0);
    vec2 e2 = min(vHUv, gs - vHUv) - 0.05;
    float edge = max(min(e2.x, e2.y), 0.0);
    hAO *= mix(0.5, 1.0, smoothstep(0.0, 0.5, edge));
    g *= mix(0.72, 1.0, smoothstep(0.0, 0.45, edge));
  }
  diffuseColor.rgb = g;
  float hBumpH = pebble * 0.01 * vis;
  `,
  normal: /* glsl */ `normal = hPerturb(normal, hBumpH * vlMask);`,
};

const SOLAR: HouseShaderParts = {
  color: /* glsl */ `
  // vHUv is metric across the panel (1.0 × 1.65 m) on its top face.
  vec2 q = vHUv;
  vec2 fq = max(fwidth(q), vec2(1e-5));
  vec2 cs = vec2(1.0 / 6.0, 1.65 / 10.0);
  // Cell grid: fine lines that never vanish abruptly, cells with a faint tone each.
  float grid = max(hFineLine(q.x, cs.x, 0.003, fq.x), hFineLine(q.y, cs.y, 0.003, fq.y));
  float cellVis = 1.0 - smoothstep(0.03, 0.09, max(fq.x, fq.y));
  vec3 col = diffuseColor.rgb * (0.94 + 0.12 * hH12(floor(q / cs) + vHouse.w * 50.0) * cellVis);
  col = mix(col, vec3(0.075, 0.085, 0.1), grid * 0.7);
  // A slim dark anodised rim (15 mm).
  float edge = min(min(q.x, 1.0 - q.x), min(q.y, 1.65 - q.y));
  float rim = 1.0 - smoothstep(0.015, 0.015 + max(fq.x, fq.y), edge);
  vec3 rimCol = vec3(0.042, 0.047, 0.051);
  col = mix(col, rimCol, rim);
  float hTop = step(0.5, vHObjN.y);
  diffuseColor.rgb = mix(rimCol, col, hTop);
  `,
  emissive: /* glsl */ `
  {
    // The sky in the glass (the panels face up: mostly sky, a cool sheen).
    vec4 env = hSkyEnv(normalize((vec4(normal, 0.0) * viewMatrix).xyz), normalize(cameraPosition - vVlWorld));
    totalEmissiveRadiance += env.rgb * (0.15 + 0.85 * env.a) * 0.55 * hTop * (1.0 - rim) * (1.0 - uNight * 0.8);
  }
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

/**
 * Window panes: dark tinted glass by day — a reflection with structure (sky in
 * the upper part of the pane, a darker band of reflected garden and trees
 * below a soft, continuous horizon), over a dim room — and warm lamp-lit
 * interiors at night. Also the opal wall lights (ROLE.lamp).
 */
const WINDOW: HouseShaderParts = {
  color: /* glsl */ `
  float hRole = vHWin.y;
  bool hLamp = hRole > 3.5 && hRole < 4.5;
  if (hLamp) {
    float rr = length(vHUv - 0.5) * 2.0;
    if (rr > 1.0) discard;
    diffuseColor.rgb = vec3(0.8, 0.79, 0.75) * (1.0 - 0.15 * smoothstep(0.75, 1.0, rr));
  } else {
    // Per-pane tint: some panes a touch greener, some greyer.
    float tr = fract(vHWin.x * 7.7);
    diffuseColor.rgb *= mix(vec3(0.95, 1.02, 1.0), vec3(1.04, 1.0, 0.97), tr);
  }
  `,
  emissive: /* glsl */ `
  {
    vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    vec3 vW = normalize(cameraPosition - vVlWorld);
    vec4 envF = hSkyEnv(nW, vW);
    float fres = envF.a;
    float role = vHWin.y;
    float on = hWinOn(vHWin.x, role);
    vec2 q = vHUv;
    vec2 fc = hFace(vHObj, vHObjN);
    if (hLamp) {
      float rr = length(q - 0.5) * 2.0;
      vec3 lampC = hWinColor(vHWin.x) * vec3(1.0, 0.97, 0.9);
      totalEmissiveRadiance += lampC * on * (4.2 - 1.4 * rr * rr) + uSkyHorizon * 0.06 * (1.0 - uNight);
    } else {
      vec2 sz = hQuadSize(q, fc);
      // Reveal occlusion: darker towards the head and the jambs (metric).
      float ej = min(q.x, 1.0 - q.x) * sz.x;
      float eh = (1.0 - q.y) * sz.y;
      float occ = mix(0.5, 1.0, smoothstep(0.0, 0.32, ej)) * mix(0.45, 1.0, smoothstep(0.0, 0.38, eh));
      occ = role > 2.5 && role < 3.5 ? 1.0 : occ; // skylights: open to the sky
      // Pane-space reflection: sky above a soft tree-line horizon that runs
      // continuously along the facade (metres), a darker garden band below.
      float hx = fc.x + vHouse.w * 41.0;
      // Tree line in pane space (metric along the facade → continuous across
      // panes): rounded crowns of a few sizes over a low hedge, leafy edge.
      float hz = 0.24 + 0.2 * hCrowns(hx) + 0.018 * (hNoise(vec2(hx * 7.0, 1.7)) - 0.5) + 0.01 * (hNoise(vec2(hx * 19.0, 4.3)) - 0.5);
      float above = smoothstep(hz - 0.006, hz + 0.016, q.y);
      vec3 skyC = mix(uSkyHorizon, uSkyTop, smoothstep(hz, 1.0, q.y)) * 0.78;
      float leaf = hNoise(vec2(hx * 3.1, q.y * 6.0 + 1.3)) * 0.6 + hNoise(vec2(hx * 9.0, q.y * 14.0)) * 0.4;
      vec3 landC = mix(uSkyHorizon, uSkyTop, 0.5) * vec3(0.16, 0.18, 0.14) * (0.6 + 0.8 * leaf);
      vec3 refl = mix(landC, skyC * 0.85, above);
      // The bright sky band just above the tree line (gold at golden hour).
      refl += uSkyHorizon * 0.35 * above * exp(-pow((q.y - hz) / 0.09, 2.0));
      // Skylights face up: the physical sky.
      refl = role > 2.5 && role < 3.5 ? envF.rgb : refl;
      float tint = 0.9 + 0.2 * fract(vHWin.x * 7.7);
      vec3 reflection = refl * (0.16 + 0.84 * fres) * occ * tint;
      // The room behind the glass.
      float vig = smoothstep(0.0, 0.18, q.x) * smoothstep(1.0, 0.82, q.x) * smoothstep(0.0, 0.12, q.y) * smoothstep(1.0, 0.9, q.y);
      float roomG = 0.3 + 0.7 * smoothstep(0.08, 0.9, q.y) + 0.22 * smoothstep(0.84, 0.97, q.y);
      float backW = 1.0 - 0.24 * exp(-pow((q.x - 0.5) / 0.3, 2.0)) * (1.0 - q.y);
      float pool = exp(-pow((q.x - (0.3 + 0.4 * fract(vHWin.x * 5.3))) * 2.4, 2.0));
      float curtain = step(0.62, fract(vHWin.x * 19.1));
      // Sheer curtain gathered at one side of some panes.
      float sheerSide = (fract(vHWin.x * 3.3) < 0.5 ? q.x : 1.0 - q.x) * sz.x;
      float sheer = step(0.45, fract(vHWin.x * 11.3)) * (1.0 - smoothstep(0.16, 0.3, sheerSide)) * smoothstep(0.0, 0.05, sheerSide);
      // Furniture in the big glazing (metric along the facade): sofa backs,
      // a low table, an occasional floor lamp with its halo.
      float furn = 1.0;
      float halo = 0.0;
      if (role > 1.5 && role < 2.5) {
        float fx = fc.x + vHWin.x * 17.0;
        float seg = floor(fx / 1.7);
        float sx = fract(fx / 1.7);
        float sr = hH12(vec2(seg, vHWin.x * 31.0));
        float hgt = sr < 0.42 ? mix(0.32, 0.42, fract(sr * 7.0)) : (sr < 0.66 ? 0.22 : 0.0);
        float inSeg = smoothstep(0.06, 0.12, sx) * smoothstep(0.94, 0.88, sx);
        float sil = (1.0 - smoothstep(hgt - 0.02, hgt + 0.02, q.y)) * inSeg * step(0.01, hgt);
        float lampX = abs(sx - 0.5) * 1.7;
        float isLamp = step(0.86, sr);
        float column = (1.0 - smoothstep(0.012, 0.03, lampX)) * (1.0 - smoothstep(0.52, 0.56, q.y)) * isLamp;
        halo = isLamp * exp(-pow(lampX / 0.32, 2.0) - pow((q.y - 0.6) / 0.11, 2.0));
        furn = 1.0 - 0.3 * max(sil, column);
      }
      float inner = mix(0.5, 1.0, vig) * roomG * backW * (0.7 + 0.45 * pool) * furn + halo * 0.9;
      inner = mix(inner, inner * 0.62 + 0.18, curtain);
      // By day: a dim room (≈ 8 % of the lamp-lit one) gives the glazing depth.
      vec3 dayRoom = uPlaster * vec3(0.92, 0.9, 0.86) * (inner * 0.075 + sheer * 0.07) * (1.0 - uNight) * occ;
      float gain = role > 2.5 && role < 3.5 ? 2.0 : (role > 1.5 && role < 2.5 ? 2.3 : 2.0);
      vec3 glow = hWinColor(vHWin.x) * gain * inner * on;
      totalEmissiveRadiance += (reflection + dayRoom) * (1.0 - 0.75 * on) + glow;
    }
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
 * House tones, calibrated against the facade renders: the cork a warm taupe
 * (between PALETTE.cork and the sunlit renders — golden in low sun, never
 * orange), limestone a warm cream.
 */
export const TONES = {
  cork: "#9D8D75",
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
      // Glass has almost no diffuse: its colour is reflection (+ the room by night).
      new MeshStandardMaterial({ color: "#0E1213", roughness: 0.1, metalness: 0.0 }),
      WINDOW,
      { modelColor: "#DAD6CD" },
    ),
    frame: houseMaterial("frame", new MeshStandardMaterial({ color: TONES.bronze, roughness: 0.45, metalness: 0.25 }), FRAME),
    solar: houseMaterial("solar", new MeshStandardMaterial({ color: "#1E2733", roughness: 0.3, metalness: 0.2 }), SOLAR),
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
      varying float vRole;
      void main() {
        vUv = uv;
        vR = aWin.x;
        vRole = aWin.y;
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
      varying float vRole;
      void main() {
        #include <clipping_planes_fragment>
        if (vOn <= 0.001) discard;
        float k;
        if (vRole > 6.5) {
          // A wall light's wash on its wall: a soft vertical oval, brightest at the fixture.
          vec2 d = (vUv - vec2(0.5, 0.556)) * vec2(2.0, 2.0 * 1.35 / 1.2);
          float r2 = dot(d, d);
          k = (exp(-r2 * 2.4) * 0.8 + exp(-r2 * 14.0) * 0.5) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2)));
        } else {
          float across = smoothstep(0.0, 0.32, vUv.x) * smoothstep(1.0, 0.68, vUv.x);
          float along = pow(1.0 - vUv.y, 2.2) * smoothstep(0.0, 0.05, vUv.y);
          k = across * along * (vRole > 3.5 && vRole < 4.5 ? 0.75 : 1.0);
        }
        vec3 c = uGlow * vec3(1.0, 0.92, 0.8) * (0.9 + 0.2 * fract(vR * 3.97));
        gl_FragColor = vec4(c * 0.5 * vOn * k, 1.0);
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
 * mask + risen house always fill the final volume.
 * It is flagged transparent (still writing depth, never colour) so that with
 * renderOrder 998 it draws after every other transparent object of every
 * module — it can only hide the hairlines (renderOrder 999), never punch a
 * house-shaped hole in foam trees, water or overlays. Homes module: same.
 */
export function getHouseMaskMaterial(): ShaderMaterial {
  if (maskCache) return maskCache;
  maskCache = new ShaderMaterial({
    name: "house-line-mask",
    transparent: true,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
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
      #define LINE_PULL 0.0016
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
        // Pulled towards the camera (≈1.6 cm at 10 m, 16 cm at 100 m): enough for a
        // ~2 px hairline to clear its own faces at grazing angles; the mask
        // boxes sit 3 cm inside the envelope, plan lines 3 cm above the pad.
        mvPosition.xyz *= 1.0 - LINE_PULL;
        mvOther.xyz *= 1.0 - LINE_PULL;
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
