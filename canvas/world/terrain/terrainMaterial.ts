/**
 * The plinth material: white model → Mediterranean hillside, lush terrace
 * gardens, limestone paths, asphalt street; strata on the cut sides; hairline
 * contours (architect's drawing) that fade to a ghost after the sweep.
 *
 * Built on patchVillageMaterial (section clip, sweep, seam, poché) with two
 * extra injections:
 *   - before the sweep mix: the real ground colour
 *   - after the sweep mix:  contact AO, contours and plan lines (model + material)
 */
import { MeshStandardMaterial } from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U } from "@/lib/uniforms";
import { extendMaterial, f, inject } from "../landscape/shaderUtils";
import { SITE_GLSL, lin, siteUniforms } from "./siteGlsl";

/** Village heart (contours draw outward from here). */
const HEART = [-10, -6];

const GROUND_GLSL = /* glsl */ `
#define C_DRY ${lin("#ADA27A")}
#define C_DRY_PALE ${lin("#C2B48C")}
#define C_GRASS ${lin("#878B60")}
#define C_EARTH ${lin("#9A8466")}
#define C_LAWN ${lin("#8E9867")}
#define C_LAWN_DEEP ${lin("#7A8656")}
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
#define C_PAPER_SHADE ${lin("#E4E1D8")}

varying vec3 vTrTerr;
varying vec3 vTrN;
uniform float uContours;
uniform float uLines;
uniform float uRise;
${SITE_GLSL}

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

vec3 tr_ground(vec3 p, vec3 n) {
  vec2 xz = p.xz;
  float n1 = vl_vnoise(xz * 0.021 + 11.0);
  float n2 = vl_vnoise(xz * 0.067 + 3.1);
  float n3 = vl_vnoise(xz * 0.21 + 7.7);
  float n4 = vl_vnoise(xz * 0.93 + 1.3);
  float n5 = vl_vnoise(xz * 3.7);

  // Natural hillside: dry grasses with greener hollows, earth on the steeper ground.
  float green = smoothstep(0.42, 0.8, n1 * 0.6 + n2 * 0.4);
  vec3 c = mix(C_DRY, C_GRASS, green * 0.85);
  c = mix(c, C_DRY_PALE, smoothstep(0.58, 0.9, n2 * 0.5 + n3 * 0.5) * (1.0 - green) * 0.55);
  float slope = 1.0 - n.y;
  c = mix(c, C_EARTH, smoothstep(0.07, 0.3, slope + (n3 - 0.5) * 0.16) * 0.7);
  c *= 0.9 + 0.2 * (n4 * 0.6 + n5 * 0.4);

  float pd = tr_podium(xz);

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

  // Podium gardens: lush lawn and planting beds (not inside the portal recess).
  float onPod = (1.0 - smoothstep(0.1, 0.3, pd)) * (1.0 - onDrive);
  vec3 lawn = mix(C_LAWN, C_LAWN_DEEP, smoothstep(0.3, 0.85, n2 * 0.6 + n3 * 0.4) * 0.7);
  lawn *= 0.95 + 0.07 * n5 + 0.04 * n4;
  vec3 pc = lawn;

  // Playground: soft sand garden.
  float pg = tr_playground(xz);
  float fwp = fwidth(pg) + 1e-4;
  pc = mix(pc, C_SAND * (0.95 + 0.08 * n4), 1.0 - smoothstep(-fwp, fwp, pg));

  // Paved decks around the pools.
  float dk = tr_decks(xz);
  float fwd = fwidth(dk) + 1e-4;
  pc = mix(pc, tr_paving(xz, C_DECK, 1.2, 0.6), 1.0 - smoothstep(-fwd, fwd, dk));

  // Pedestrian lanes: pale limestone paving.
  vec2 pl;
  float pth = tr_paths(xz, pl);
  float fwt = fwidth(pth) + 1e-4;
  float onPath = 1.0 - smoothstep(-fwt, fwt, pth);
  pc = mix(pc, tr_paving(pl, C_PAVE, 0.9, 0.45), onPath);
  // a soft soil edge where lawn meets the paving
  pc *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.35, pth)) * (1.0 - onPath);

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

const COLOR_CODE = /* glsl */ `
  {
    vec3 trN = normalize(vTrN);
    vec3 trCol = vTrTerr.y > 0.5 ? tr_strata(vVlWorld, vTrTerr.z, trN) : tr_ground(vVlWorld, trN);
    diffuseColor.rgb = trCol;
  }
`;

/** After the sweep mix: contact shading, contours, plan lines (vlMask in scope). */
const POST_CODE = /* glsl */ `
  {
    vec3 p = vVlWorld;
    float side = vTrTerr.y;
    float pd = tr_podium(p.xz);
    float ao = 1.0;
    if (side < 0.5) {
      // paper grain in the white model
      ao *= 1.0 - (1.0 - vlMask) * 0.035 * vl_vnoise(p.xz * 1.7);
      // bastion foot, outside and inside
      ao *= 1.0 - 0.3 * exp(-max(pd - TR_BASTION_OUT, 0.0) / 1.1) * step(TR_BASTION_OUT - 0.05, pd);
      ao *= 1.0 - 0.2 * exp(-max(TR_BASTION_IN - pd, 0.0) / 0.8) * step(pd, TR_BASTION_IN + 0.05);
      // terrace walls (lower side deeper, upper side the parapet foot)
      if (pd < 0.0) {
        for (int i = 0; i < TR_STEPS.length(); i++) {
          float dz = p.z - TR_STEPS[i];
          ao *= 1.0 - 0.26 * exp(-max(dz - TR_TW_HALF, 0.0) / 0.9) * step(TR_TW_HALF - 0.05, dz);
          ao *= 1.0 - 0.16 * exp(-max(-dz - TR_TW_HALF, 0.0) / 0.6) * step(dz, -TR_TW_HALF + 0.05);
        }
        // houses
        float hd = tr_houses(p.xz);
        ao *= 1.0 - 0.3 * exp(-max(hd, 0.0) / 1.1) * smoothstep(0.25, 1.0, uRise) * step(0.0, hd);
      }
      // the garage portal recess falls into darkness
      float pdx = abs(p.x - TR_PORTAL_CX);
      if (pdx < TR_PORTAL_HALF + 0.3 && p.z > TR_PODIUM_MAXZ + TR_PORTAL_BACK - 0.3 && p.z < TR_PODIUM_MAXZ + 3.0) {
        float into = clamp((TR_PODIUM_MAXZ + TR_BASTION_OUT - p.z) / (TR_BASTION_OUT - TR_PORTAL_BACK), 0.0, 1.0);
        ao *= mix(1.0, 0.08, smoothstep(0.0, 0.9, into));
        ao *= 1.0 - 0.25 * exp(-max(p.z - TR_PODIUM_MAXZ - TR_BASTION_OUT, 0.0) / 1.5);
      }
    } else {
      // a faint darkening at the foot of the sides, where the model meets the table
      ao *= 1.0 - 0.18 * exp(-(p.y + ${f(14)}) / 1.6);
    }
    diffuseColor.rgb *= ao;

    // --- contours: the architect's drawing ---------------------------------
    float onPod = 1.0 - smoothstep(0.0, 0.3, pd);
    float r = length(p.xz - vec2(${f(HEART[0])}, ${f(HEART[1])}));
    float revMinor = 1.0 - smoothstep(-22.0, 0.0, r - (uContours * 190.0 - 12.0));
    float revMajor = 1.0 - smoothstep(-22.0, 0.0, r - (uContours * 230.0 - 12.0));
    // existing ground on the podium (dashed), finished ground elsewhere
    float hC = side > 0.5 ? p.y : mix(p.y, vTrTerr.x, onPod);
    float minor = tr_line(hC, 0.55);
    float major = tr_line(hC / 5.0, 1.05);
    float dash = smoothstep(0.35, 0.5, abs(fract(dot(p.xz, vec2(0.62, 0.21))) - 0.5) * 2.0 + 0.15);
    float podK = mix(1.0, dash * 0.55 * (1.0 - 0.75 * uRise), onPod * (1.0 - side));
    float sideK = mix(1.0, 0.55, side);
    float ghost = mix(1.0, 0.13, vlMask);
    float ink = max(minor * 0.4 * revMinor, major * 0.72 * revMajor) * podK * sideK * ghost;

    // --- plan lines: paths, decks, kerbs, playground (uLines) -------------
    if (side < 0.5) {
      float revL = 1.0 - smoothstep(-14.0, 0.0, r - (uLines * 200.0 - 10.0));
      vec2 pl;
      float pth = tr_paths(p.xz, pl);
      float lines = tr_edge(pth, 0.6) * onPod;
      lines = max(lines, tr_edge(tr_decks(p.xz), 0.6) * onPod);
      lines = max(lines, tr_edge(tr_playground(p.xz), 0.6) * onPod);
      float sz = abs(p.z - TR_STREET_Z);
      float outside = smoothstep(0.0, 0.2, pd);
      lines = max(lines, max(tr_edge(sz - 3.4, 0.6), tr_edge(sz - 4.6, 0.5)) * outside);
      float dxp = abs(p.x - TR_PORTAL_CX);
      lines = max(lines, tr_edge(dxp - TR_PORTAL_HALF - 0.2, 0.6) * outside * step(p.z, TR_STREET_Z - 3.4));
      ink = max(ink, lines * 0.62 * revL * mix(1.0, 0.0, vlMask));
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, C_INK, clamp(ink, 0.0, 1.0));
  }
`;

export function createTerrainMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.96, metalness: 0 }), {
    poche: PALETTE.pocheEarth,
    modelRoughness: 0.95,
  });
  return extendMaterial(mat, "terrain-v1", (shader) => {
    Object.assign(shader.uniforms, siteUniforms(), { uContours: U.uContours, uLines: U.uLines, uRise: U.uRise });
    let vs = shader.vertexShader;
    vs = inject(vs, "#include <common>", "attribute vec3 aTerr;\nvarying vec3 vTrTerr;\nvarying vec3 vTrN;");
    vs = inject(vs, "#include <begin_vertex>", "vTrTerr = aTerr;\nvTrN = normal;");
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    // GROUND_GLSL needs VL_GLSL (declared by the patch inside the common replacement) → append after it.
    fs = inject(fs, "#include <color_fragment>", COLOR_CODE, "after");
    fs = inject(fs, "#include <roughnessmap_fragment>", POST_CODE, "before");
    fs = fs.replace("void main() {", `${GROUND_GLSL}\nvoid main() {`);
    shader.fragmentShader = fs;
  });
}
