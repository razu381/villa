/**
 * The plinth material: white model → Mediterranean hillside (dry clearings,
 * darker maquis groves, pale outcrops), striped terrace lawns, limestone
 * paths, asphalt street; strata on the cut sides and the section face;
 * hairline contours (architect's drawing) that fade to a ghost after the sweep.
 *
 * Built on patchVillageMaterial (section clip, sweep, seam, poché) with:
 *   - vertex: the pre-build morph (natural hill → built ground, uPodRise)
 *   - before the sweep mix: the site SDFs (once) and the real ground colour,
 *     skipped entirely while the fragment is still white model
 *   - after the sweep mix: contact AO, contours and plan lines
 *   - the section face: strata in poché tones, with water in the cut pool
 */
import { MeshStandardMaterial } from "three";
import { PLINTH } from "@/lib/village";
import { HEART } from "./ground";
import { PLINTH_UV_GLSL, aoTexture, heightTexture } from "./aoTexture";
import { POD_RISE_GLSL, uPodRise } from "./build";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U } from "@/lib/uniforms";
import { extendMaterial, f, inject } from "../landscape/shaderUtils";
import { POOLS } from "../landscape/layout";
import { SITE_GLSL, lin, siteUniforms } from "./siteGlsl";

/** World z of the section cut, written per frame by Terrain.tsx from sectionPlane. */
export const uCutZ = { value: 1e4 };

const GROUND_GLSL = /* glsl */ `
#define C_DRY ${lin("#A99F78")}
#define C_UNDER ${lin("#6E7550")}
#define C_GROVE ${lin("#737552")}
#define C_DRY_PALE ${lin("#C2B691")}
#define C_GRASS ${lin("#878B60")}
#define C_EARTH ${lin("#9A8466")}
#define C_ROCK ${lin("#D3CAB6")}
#define C_LAWN ${lin("#93A067")}
#define C_LAWN_DEEP ${lin("#7E8B57")}
#define C_LAWN_SHEEN ${lin("#C9C994")}
#define C_BED ${lin("#6B6248")}
#define C_PAVE ${lin("#DCD3C1")}
#define C_DECK ${lin("#E2D9C6")}
#define C_SAND ${lin("#D6C9A8")}
#define C_ASPHALT ${lin("#5B5751")}
#define C_KERB ${lin("#CFC8B8")}
#define C_WALK ${lin("#BDB5A5")}
#define C_HUMUS ${lin("#4E3F33")}
#define C_CLAY ${lin(PALETTE.earth)}
#define C_CORK ${lin(PALETTE.cork)}
#define C_CORKDEEP ${lin(PALETTE.corkDeep)}
#define C_OCHRE ${lin("#B08E62")}
#define C_LIME ${lin("#D5C8AE")}
#define C_LIME_WARM ${lin("#C2AE8C")}
#define C_RIM ${lin(PALETTE.limestoneBuild)}
#define C_INK ${lin("#5A5248")}
#define C_POCHE ${lin(PALETTE.pocheEarth)}
#define C_SEC_WATER ${lin("#8FB7B1")}
#define C_SEC_DEEP ${lin("#4F7774")}
#define C_SEC_STONE ${lin("#CFC4AE")}

varying vec3 vTrTerr;
varying vec3 vTrN;
uniform float uContours;
uniform float uPlan;
uniform float uLines;
uniform float uRise;
uniform float uCutZ;
uniform float uFoam;
uniform float uPodRise;
uniform sampler2D uTrAO;
uniform sampler2D uTrH;
${SITE_GLSL}

// Site SDFs, evaluated once per fragment (colour + plan lines share them).
float trPd;
float trPth;
vec2 trPl;
float trDk;
float trPg;
vec4 trAO;
float trSheen = 0.0;

/** Antialiased line at integer values of v, ~px pixels wide; fades when too dense. */
float tr_line(float v, float px) {
  float fw = max(fwidth(v), 1e-5);
  float d = abs(fract(v + 0.5) - 0.5) / fw;
  return (1.0 - smoothstep(px - 0.5, px + 0.5, d)) * (1.0 - smoothstep(0.16, 0.42, fw));
}
/** Hairline along an SDF zero crossing. */
float tr_edge(float sd, float px) {
  float fw = max(fwidth(sd), 1e-5);
  return 1.0 - smoothstep(px - 0.5, px + 0.5, abs(sd) / fw);
}

vec3 tr_paving(vec2 l, vec3 base, float L, float W) {
  float row = floor(l.y / W);
  float u = l.x / L + row * 0.5;
  float id = vl_hash(vec2(floor(u), row));
  vec2 g = vec2(fract(u) * L, fract(l.y / W) * W);
  float jd = min(min(g.x, L - g.x), min(g.y, W - g.y));
  float fw = fwidth(l.x) + fwidth(l.y);
  float joint = 1.0 - smoothstep(0.012, 0.012 + fw, jd);
  float vis = 1.0 - smoothstep(0.03, 0.09, fw);
  vec3 c = base * (0.955 + 0.07 * id);
  return c * (1.0 - joint * 0.2 * vis);
}

${PLINTH_UV_GLSL}
vec3 tr_ground(vec3 p, vec3 n) {
  vec2 xz = p.xz;
  float n1 = vl_vnoise(xz * 0.021 + 11.0);
  float n2 = vl_vnoise(xz * 0.067 + 3.1);
  float n3 = vl_vnoise(xz * 0.21 + 7.7);
  float n4 = vl_vnoise(xz * 0.93 + 1.3);
  float n5 = vl_vnoise(xz * 3.7);
  float slope = 1.0 - n.y;
  float grove = trAO.a;

  // Natural hillside: dry grasses, paler in the open clearings, darker and
  // greener under the maquis groves, earth and limestone outcrops on the slopes.
  float green = smoothstep(0.36, 0.76, n1 * 0.6 + n2 * 0.4);
  vec3 c = mix(C_DRY, C_GRASS, green * 0.75);
  c = mix(c, C_DRY_PALE, (1.0 - grove) * smoothstep(0.25, 0.75, n1 * 0.5 + n2 * 0.5) * 0.6);
  c = mix(c, C_GROVE * (0.92 + 0.16 * n2), grove * 0.7);
  c = mix(c, C_EARTH, smoothstep(0.05, 0.2, slope + (n3 - 0.5) * 0.1) * 0.5 * (1.0 - grove * 0.6));
  // a few pale limestone outcrops where the hill steepens, out in the clearings
  float rk = vl_vnoise(xz * 0.07 + 21.0) * 0.7 + n3 * 0.3;
  float rock = smoothstep(0.8, 0.86, rk + smoothstep(0.03, 0.12, slope) * 0.12) * (1.0 - grove);
  c = mix(c, C_ROCK * (0.92 + 0.1 * n4), rock * 0.55);
  c *= 0.93 + 0.12 * (n4 * 0.6 + n5 * 0.4);
  // understorey: greener, darker ground gathers under and around trees and shrubs
  float under = clamp((1.0 - trAO.r) * 2.6 + (1.0 - trAO.b) * 1.8, 0.0, 1.0);
  c = mix(c, C_UNDER * (0.92 + 0.16 * n4), under * 0.55);

  // Street, kerbs and pavement.
  float sz = abs(p.z - TR_STREET_Z);
  float fwz = fwidth(p.z) * 0.7 + 1e-4;
  vec3 asphalt = C_ASPHALT * (0.93 + 0.1 * n5 + 0.05 * n3);
  vec3 walkCol = C_WALK * (0.96 + 0.05 * vl_hash(vec2(floor(p.x / 1.6), 3.0)));
  vec3 street = mix(asphalt, C_KERB, smoothstep(3.4 - fwz, 3.4 + fwz, sz));
  street = mix(street, walkCol, smoothstep(3.6 - fwz, 3.6 + fwz, sz));
  float onStreet = 1.0 - smoothstep(4.6 - fwz, 4.6 + fwz, sz);
  // Driveway into the portal.
  float dx = abs(p.x - TR_PORTAL_CX);
  float fwx = fwidth(p.x) * 0.7 + 1e-4;
  float onDrive = (1.0 - smoothstep(TR_PORTAL_HALF + 0.2 - fwx, TR_PORTAL_HALF + 0.2 + fwx, dx))
                * step(TR_PODIUM_MAXZ + TR_PORTAL_BACK - 0.2, p.z) * step(p.z, TR_STREET_Z);
  vec3 drive = mix(asphalt * 1.04, C_KERB, smoothstep(TR_PORTAL_HALF - fwx, TR_PORTAL_HALF + fwx, dx));
  c = mix(c, street, onStreet);
  c = mix(c, drive, onDrive);

  // Podium gardens: lush lawn, two-tone mown stripes, a soft sheen at grazing angles.
  float onPod = (1.0 - smoothstep(0.1, 0.3, trPd)) * (1.0 - onDrive);
  vec3 lawn = mix(C_LAWN, C_LAWN_DEEP, smoothstep(0.3, 0.85, n2 * 0.6 + n3 * 0.4) * 0.6);
  lawn *= 0.95 + 0.06 * n5 + 0.04 * n4;
  float sv = p.x / 3.6;
  float fws = fwidth(sv) + 1e-5;
  float stripe = clamp(sin(sv * 6.2832) / (fws * 6.2832 * 1.2), -1.0, 1.0) * (1.0 - smoothstep(0.05, 0.2, fws));
  lawn *= 1.0 + 0.045 * stripe;
  lawn = mix(lawn, lawn * vec3(1.03, 1.02, 0.93), 0.5 + 0.5 * stripe);
  vec3 V = normalize(cameraPosition - p);
  float graze = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.5);
  lawn = mix(lawn, C_LAWN_SHEEN, graze * 0.22);
  // dark soil under the planting beds
  lawn = mix(lawn, C_BED * (0.9 + 0.2 * n4), clamp((1.0 - trAO.b) * 3.2, 0.0, 1.0) * 0.6 * uLife);
  vec3 pc = lawn;

  // Playground: soft sand garden.
  float fwp = fwidth(trPg) + 1e-4;
  pc = mix(pc, C_SAND * (0.95 + 0.08 * n4), 1.0 - smoothstep(-fwp, fwp, trPg));

  // Paved decks around the pools (and the pavilion).
  float fwd = fwidth(trDk) + 1e-4;
  pc = mix(pc, tr_paving(xz, C_DECK, 1.2, 0.6), 1.0 - smoothstep(-fwd, fwd, trDk));

  // Pedestrian lanes: pale limestone paving.
  float fwt = fwidth(trPth) + 1e-4;
  float onPath = 1.0 - smoothstep(-fwt, fwt, trPth);
  pc = mix(pc, tr_paving(trPl, C_PAVE, 0.9, 0.45), onPath);
  // a soft soil edge where lawn meets the paving
  pc *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.35, trPth)) * (1.0 - onPath);

  return mix(c, pc, onPod);
}

vec3 tr_strata(vec3 p, float top, vec3 n) {
  float along = abs(n.x) > 0.5 ? p.z : p.x;
  float below = top - p.y;
  float w1 = (vl_vnoise(vec2(along * 0.045, 2.0)) - 0.5) * 1.9;
  float w2 = (vl_vnoise(vec2(along * 0.19, 5.0)) - 0.5) * 0.5;
  float yy = p.y + w1 + w2;
  float bh = 1.2;
  float bi = floor(yy / bh);
  float bf = fract(yy / bh);
  float hb = vl_hash(vec2(bi, 3.7));
  float depth = clamp((2.0 - p.y) / 15.0, 0.0, 1.0);
  vec3 c = mix(C_CLAY, C_CORK, smoothstep(0.15, 0.85, hb));
  c = mix(c, C_OCHRE, step(0.8, hb) * 0.75);
  c = mix(c, C_CORKDEEP, step(hb, 0.12) * 0.7);
  float rock = smoothstep(0.38, 0.8, depth + (hb - 0.5) * 0.4);
  vec3 lime = mix(C_LIME_WARM, C_LIME, vl_hash(vec2(bi, 9.1)));
  c = mix(c, lime, rock);
  // thin bedding lines
  float fwy = fwidth(yy / bh) + 1e-5;
  float bed = 1.0 - smoothstep(0.0, 1.4 * fwy + 0.012, min(bf, 1.0 - bf));
  c *= 1.0 - bed * 0.22;
  // grain + pebbles
  float g = vl_vnoise(vec2(along * 2.4, p.y * 3.1));
  float g2 = vl_vnoise(vec2(along * 9.0, p.y * 11.0));
  c *= 0.9 + 0.13 * g + 0.07 * g2;
  // dark topsoil following the surface
  float soil = 1.0 - smoothstep(0.3, 0.85, below + w2 * 0.5);
  c = mix(c, C_HUMUS, soil * 0.9);
  // thin limestone rim on the top edge
  float fwb = fwidth(below) + 1e-5;
  c = mix(c, C_RIM, 1.0 - smoothstep(0.16 - fwb, 0.16 + fwb, below));
  return c;
}
`;

/** Section through a pool basin: limestone shell, water body, meniscus. Returns alpha 0 if outside. */
const POOL_SECTION = POOLS.map(
  (p) => `  { vec4 s = tr_poolSec(P, vec2(${f(p.x)}, ${f(p.z)}), vec2(${f(p.hx)}, ${f(p.hz)}), ${f(p.y)}, ${f(p.depth)}); if (s.a > 0.0) c = mix(c, s.rgb, s.a); }`,
).join("\n");

/** The section face (back faces seen through the cut): strata in poché tones. */
const POCHE_CODE = /* glsl */ `
  if (!gl_FrontFacing) {
    vec3 cam = cameraPosition;
    vec3 d = vVlWorld - cam;
    float s = (uCutZ - cam.z) / (abs(d.z) > 1e-4 ? d.z : 1e-4);
    vec3 P = cam + d * clamp(s, 0.0, 1.0);
    float top = texture2D(uTrH, tr_aoUv(vec2(P.x, uCutZ))).r;
    vec3 c = tr_strata(P, top, vec3(0.0, 0.0, 1.0));
    // the cut is a drawing convention: same strata as the sides, deeper and quieter
    float g = dot(c, vec3(0.3, 0.59, 0.11));
    c = mix(c, vec3(g) * C_POCHE / max(dot(C_POCHE, vec3(0.3, 0.59, 0.11)), 1e-3), 0.3) * 0.8;
${POOL_SECTION}
    gl_FragColor = vec4(c * mix(1.0, 0.45, uNight), 1.0);
  }
`;

const POOL_SECTION_FN = /* glsl */ `
vec4 tr_poolSec(vec3 P, vec2 c, vec2 h, float y0, float D) {
  float shell = 0.32;
  if (abs(uCutZ - c.y) > h.y + shell || abs(P.x - c.x) > h.x + shell || P.y > y0 + 0.02 || P.y < y0 - D - shell) return vec4(0.0);
  float fx = fwidth(P.x) + 1e-4;
  float inX = 1.0 - smoothstep(h.x - fx, h.x + fx, abs(P.x - c.x));
  float inY = smoothstep(y0 - D - fx, y0 - D + fx, P.y);
  float inZ = step(abs(uCutZ - c.y), h.y);
  float hollow = inX * inY * inZ;
  // limestone shell, a hairline darker at the inside edge
  vec3 col = C_SEC_STONE * (0.94 + 0.06 * vl_vnoise(P.xy * 3.0));
  if (hollow > 0.0) {
    float yW = y0 - 0.12;
    float wet = smoothstep(yW + fx, yW - fx, P.y) * smoothstep(0.3, 0.7, uLife);
    float k = clamp((yW - P.y) / max(D - 0.12, 0.01), 0.0, 1.0);
    vec3 water = mix(C_SEC_WATER, C_SEC_DEEP, pow(k, 0.8));
    water *= 0.92 + 0.08 * sin(P.x * 2.1 + uTime * 0.8) * (1.0 - k);
    // the bright meniscus just below the surface
    water += vec3(0.55, 0.62, 0.6) * (1.0 - smoothstep(0.0, 0.06 + fx, yW - P.y)) * step(P.y, yW);
    vec3 air = C_SEC_STONE * 0.42;
    col = mix(col, mix(air, water, wet), hollow);
  }
  return vec4(col, 1.0);
}
`;

/** Before the sweep mix: site SDFs once, then the real ground colour (only where it can show). */
const COLOR_CODE = /* glsl */ `
  float trMask = vl_sweepMask(vVlWorld);
  {
    vec3 p = vVlWorld;
    float side = vTrTerr.y;
    trPd = tr_podium(p.xz);
    trAO = texture2D(uTrAO, tr_aoUv(p.xz));
    if (side < 0.5 && (trMask > 0.001 || uPlan > 0.001)) {
      trPth = tr_paths(p.xz, trPl);
      trDk = tr_decks(p.xz);
      trPg = tr_playground(p.xz);
    } else {
      trPth = 1e3; trPl = vec2(0.0); trDk = 1e3; trPg = 1e3;
    }
    if (trMask > 0.001) {
      vec3 trN = normalize(vTrN);
      diffuseColor.rgb = side > 0.5 ? tr_strata(p, vTrTerr.z, trN) : tr_ground(p, trN);
    }
  }
`;

/** After the sweep mix: contact shading, contours, plan lines (vlMask in scope). */
const POST_CODE = /* glsl */ `
  {
    vec3 p = vVlWorld;
    float side = vTrTerr.y;
    float pd = trPd;
    float ao = 1.0;
    if (side < 0.5) {
      // paper grain in the white model
      ao *= 1.0 - (1.0 - vlMask) * 0.035 * vl_vnoise(p.xz * 1.7);
      // bastion foot, outside and inside (once the walls stand)
      float w = uPodRise;
      ao *= 1.0 - 0.3 * w * exp(-max(pd - TR_BASTION_OUT, 0.0) / 1.1) * step(TR_BASTION_OUT - 0.05, pd);
      ao *= 1.0 - 0.2 * w * exp(-max(TR_BASTION_IN - pd, 0.0) / 0.8) * step(pd, TR_BASTION_IN + 0.05);
      // terrace walls (lower side deeper, upper side the parapet foot)
      if (pd < 0.0) {
        for (int i = 0; i < TR_STEPS.length(); i++) {
          float dz = p.z - TR_STEPS[i];
          ao *= 1.0 - 0.26 * w * exp(-max(dz - TR_TW_HALF, 0.0) / 0.9) * step(TR_TW_HALF - 0.05, dz);
          ao *= 1.0 - 0.16 * w * exp(-max(-dz - TR_TW_HALF, 0.0) / 0.6) * step(dz, -TR_TW_HALF + 0.05);
        }
      }
      // baked contact shading: trees (with the foam), houses (as they rise), shrubs (life)
      ao *= mix(1.0, trAO.r, smoothstep(0.0, 0.8, uFoam));
      ao *= mix(1.0, trAO.g, smoothstep(0.25, 1.0, uRise));
      ao *= mix(1.0, trAO.b, uLife);
      // the garage portal recess: a gentle fall into shade, never a black hole
      float pdx = abs(p.x - TR_PORTAL_CX);
      if (pdx < TR_PORTAL_HALF + 0.3 && p.z > TR_PODIUM_MAXZ + TR_PORTAL_BACK - 0.3 && p.z < TR_PODIUM_MAXZ + 3.0) {
        float into = clamp((TR_PODIUM_MAXZ + TR_BASTION_OUT - p.z) / (TR_BASTION_OUT - TR_PORTAL_BACK), 0.0, 1.0);
        ao *= mix(1.0, 0.32, smoothstep(0.0, 0.9, into) * w);
        ao *= 1.0 - 0.22 * w * exp(-max(p.z - TR_PODIUM_MAXZ - TR_BASTION_OUT, 0.0) / 1.5);
        // a faint sheen on the garage floor
        trSheen = smoothstep(0.05, 0.6, into) * step(pdx, TR_PORTAL_HALF) * w;
      }
    } else {
      // a faint darkening at the foot of the sides, where the model meets the table
      ao *= 1.0 - 0.18 * exp(-(p.y - ${f(PLINTH.bottom)}) / 1.6);
    }
    diffuseColor.rgb *= ao;

    // --- contours: the architect's drawing ---------------------------------
    float onPod = 1.0 - smoothstep(0.0, 0.3, pd);
    float r = length(p.xz - vec2(${f(HEART.x)}, ${f(HEART.z)}));
    float revMinor = 1.0 - smoothstep(-22.0, 0.0, r - (uContours * 190.0 - 12.0));
    float revMajor = 1.0 - smoothstep(-22.0, 0.0, r - (uContours * 230.0 - 12.0));
    // the hill as it was: solid lines, dashed on the podium once it has risen
    float hC = side > 0.5 ? p.y : mix(p.y, vTrTerr.x, onPod);
    float minor = tr_line(hC, 0.55);
    float major = tr_line(hC / 5.0, 1.05);
    float dash = smoothstep(0.35, 0.5, abs(fract(dot(p.xz, vec2(0.62, 0.21))) - 0.5) * 2.0 + 0.15);
    float podK = mix(1.0, dash * 0.55 * (1.0 - 0.75 * uRise), onPod * (1.0 - side) * uPodRise);
    float sideK = mix(1.0, 0.55, side);
    float ghost = mix(1.0, 0.13, vlMask);
    // the deck is the plan's now: the hill's lines leave it as its outline draws
    float offDeck = 1.0 - onPod * (1.0 - side) * smoothstep(0.45, 0.7, uPlan);
    float ink = max(minor * 0.4 * revMinor, major * 0.72 * revMajor) * podK * sideK * ghost * offDeck;

    // --- plan lines: podium outline, terrace steps, paths, decks, kerbs (uLines)
    if (side < 0.5) {
      float off = 1.0 - vlMask;
      // the stronghold's outline is drawn first, quickly, before it rises
      float revP = 1.0 - smoothstep(-14.0, 0.0, r - (uPlan * 420.0 - 10.0));
      float outline = max(tr_edge(pd - TR_BASTION_OUT, 0.75), tr_edge(pd - TR_BASTION_IN, 0.6));
      float inPod = step(pd, TR_BASTION_IN + 0.02);
      for (int i = 0; i < TR_STEPS.length(); i++) {
        float dz = abs(p.z - TR_STEPS[i]);
        outline = max(outline, tr_edge(dz - TR_TW_HALF, 0.6) * inPod);
      }
      ink = max(ink, outline * 0.7 * revP * off);
      float revL = 1.0 - smoothstep(-14.0, 0.0, r - (uLines * 200.0 - 10.0));
      float lines = tr_edge(trPth, 0.6) * onPod;
      lines = max(lines, tr_edge(trDk, 0.6) * onPod);
      lines = max(lines, tr_edge(trPg, 0.6) * onPod);
      float sz = abs(p.z - TR_STREET_Z);
      float outside = smoothstep(0.0, 0.2, pd);
      lines = max(lines, max(tr_edge(sz - 3.4, 0.6), tr_edge(sz - 4.6, 0.5)) * outside);
      float dxp = abs(p.x - TR_PORTAL_CX);
      lines = max(lines, tr_edge(dxp - TR_PORTAL_HALF - 0.2, 0.6) * outside * step(p.z, TR_STREET_Z - 3.4) * step(TR_PODIUM_MAXZ + TR_BASTION_OUT, p.z));
      ink = max(ink, lines * 0.62 * revL * off);
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, C_INK, clamp(ink, 0.0, 1.0));
  }
`;

export function createTerrainMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.96, metalness: 0 }), {
    poche: PALETTE.pocheEarth,
    modelRoughness: 0.95,
  });
  return extendMaterial(mat, "terrain-v3", (shader) => {
    Object.assign(shader.uniforms, siteUniforms(), {
      uContours: U.uContours,
      uPlan: U.uPlan,
      uLines: U.uLines,
      uRise: U.uRise,
      uCutZ,
      uFoam: U.uFoam,
      uPodRise,
      uTrAO: { value: aoTexture() },
      uTrH: { value: heightTexture() },
    });
    let vs = shader.vertexShader;
    vs = inject(vs, "#include <common>", `attribute vec3 aTerr;\nattribute vec4 aMorph;\nvarying vec3 vTrTerr;\nvarying vec3 vTrN;\n${POD_RISE_GLSL}`);
    // the hill before the build → the built ground (top surface and the sides' top row)
    vs = inject(vs, "#include <beginnormal_vertex>", "objectNormal = normalize(mix(aMorph.xyz, objectNormal, uPodRise));");
    vs = inject(
      vs,
      "#include <begin_vertex>",
      `if (aMorph.w > 0.5) transformed.y = vl_podY(aTerr.x, position.y);
      vTrTerr = vec3(aTerr.x, aTerr.y, vl_podY(aTerr.x, aTerr.z));
      vTrN = objectNormal;`,
    );
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    // GROUND_GLSL needs VL_GLSL (declared by the patch inside the common replacement) → insert before main.
    fs = inject(fs, "#include <color_fragment>", COLOR_CODE, "after");
    // the sweep mask is already known — reuse it
    fs = inject(fs, "float vlMask = vl_sweepMask( vVlWorld );", "float vlMask = trMask;", "replace");
    fs = inject(fs, "#include <roughnessmap_fragment>", POST_CODE, "before");
    fs = inject(fs, "#include <roughnessmap_fragment>", "roughnessFactor = mix(roughnessFactor, 0.42, trSheen);", "after");
    fs = inject(fs, "#include <tonemapping_fragment>", POCHE_CODE, "before");
    fs = fs.replace("void main() {", `${GROUND_GLSL}\n${POOL_SECTION_FN}\nvoid main() {`);
    shader.fragmentShader = fs;
  });
}
