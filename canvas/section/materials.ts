/**
 * Section materials. All of them are village materials (lib/materials
 * patchVillageMaterial: section clip, sweep, poché) extended per surface:
 *
 *   createShellMaterial()  the hall and the tunnel — polished pale floor with
 *                          hairline bay markings and soft reflections of the
 *                          lit back wall and the light strips, board-smooth
 *                          soffit, precast walls with a dashed wayfinding rule,
 *                          slender limestone columns, glowing strips and lobbies
 *   createCarMaterial()    model cars: satin paint, smoked glass with a sky
 *                          sheen, graphite tyres, slim lamp bars
 *   createCapMaterial()    depth-only section cap: the cut face of the earth
 *                          occludes what lies behind it, except where it opens
 *                          onto the hall and the tunnel
 *   createShadowMaterial() soft contact shadows under the cars
 */
import { Color, MeshStandardMaterial, ShaderMaterial, Vector4 } from "three";
import { patchVillageMaterial, sharedUniformsFor } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { clipPlanes } from "@/lib/uniforms";
import { PLINTH_UV_GLSL, heightTexture } from "../world/terrain/aoTexture";
import { lin } from "../world/terrain/siteGlsl";
import { extendMaterial, f, inject } from "../world/landscape/shaderUtils";
import { SEC_GLSL, SU } from "./glsl";
import { BAY_D, BAY_ROWS, COLUMN_R, COLUMN_X, COLUMN_Z, CORES, PARKING_BAY_X0, PARKING_BAY_X1 } from "./layout";

/** Overall gain of the garage light (tuned against the noon exposure). */
export const uSecGain = { value: 1.0 };

const SHELL_GLSL = /* glsl */ `
#define C_FLOOR ${lin("#D7D1C5")}
#define C_FLOOR_AISLE ${lin("#CFC9BC")}
#define C_MARK ${lin("#8C8578")}
#define C_SOFFIT ${lin("#D2CCC0")}
#define C_WALL ${lin("#DCD5C8")}
#define C_COLUMN ${lin("#E7E1D5")}
#define C_CORE ${lin("#D9D0BF")}
#define C_LOBBY ${lin("#E9DCC4")}
#define C_WAYFIND ${lin(PALETTE.sun)}
#define C_TFLOOR ${lin("#8E887D")}
#define C_TWALL ${lin("#B3AC9F")}
#define C_HIDDEN ${lin(PALETTE.poche)}
#define SEC_BAYX0 ${f(PARKING_BAY_X0)}
#define SEC_BAYX1 ${f(PARKING_BAY_X1)}
#define SEC_ROWS_Z ${f(BAY_ROWS.south)}
#define SEC_ROWN_Z ${f(BAY_ROWS.north)}
#define SEC_BAY_HD ${f(BAY_D / 2)}
#define SEC_COLX0 ${f(COLUMN_X[0])}
#define SEC_COLX1 ${f(COLUMN_X[COLUMN_X.length - 1])}
#define SEC_COLR ${f(COLUMN_R)}
#define SEC_CORE_HW ${f(CORES[0].w / 2)}
#define SEC_CORE_Z1 ${f(CORES[0].z1)}
#define SEC_WAYY (SEC_HY0 + 2.05)
const float SEC_COLZ[${COLUMN_Z.length}] = float[](${COLUMN_Z.map(f).join(", ")});
uniform float uSecGain;
varying float vSecKind;

/** Antialiased hairline at distance d (metres) from a line, half-width w. */
float sec_hair(float d, float w, float fw) {
  return 1.0 - smoothstep(w - fw, w + fw, d);
}

/** Soft halo of the soffit strips, on the soffit itself. */
float sec_soffitGlow(vec3 P) {
  float g = 0.0;
  for (int i = 0; i < SEC_STRIPS.length(); i++) {
    float dz = P.z - SEC_STRIPS[i];
    float a = exp(-dz * dz * 2.2);
    if (a < 0.002) continue;
    for (int j = 0; j < SEC_SEGS.length(); j++) {
      vec2 sg = SEC_SEGS[j];
      float dx = max(max(sg.x - P.x, P.x - sg.y), 0.0);
      g += a * exp(-dx * dx * 2.2);
    }
  }
  return g;
}

/** What the polished floor mirrors: the washed back wall, the soffit and its strips. */
vec3 sec_floorRefl(vec3 P, float tunnel) {
  vec3 V = normalize(P - cameraPosition);
  vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));
  float F = 0.04 + 0.96 * pow(1.0 - clamp(-V.y, 0.0, 1.0), 5.0);
  float ceilY = tunnel > 0.5 ? SEC_TY1 : SEC_HY1;
  float tc = (ceilY - P.y) / max(R.y, 1e-3);
  float tb = (R.z < -1e-3 && tunnel < 0.5) ? (SEC_HZ0 - P.z) / R.z : 1e9;
  vec3 col;
  if (tb < tc) {
    vec3 Hb = P + R * tb;
    float blur = 0.15 + tb * 0.03;
    // three taps along the wall soften the scallops with distance
    float w = sec_wash(Hb.x, Hb.y) * 0.5 + (sec_wash(Hb.x - blur, Hb.y - blur * 0.5) + sec_wash(Hb.x + blur, Hb.y - blur * 0.5)) * 0.25;
    col = C_WALL * C_SEC_LIGHT * (0.22 + 2.2 * w) * 0.85;
    col = mix(col, C_WAYFIND * 0.8, (1.0 - smoothstep(0.04, 0.04 + blur, abs(Hb.y - (SEC_WAYY)))) * 0.45);
  } else {
    vec3 Hc = P + R * tc;
    float blur = 0.08 + tc * 0.05;
    col = C_SOFFIT * C_SEC_LIGHT * 0.3;
    if (tunnel > 0.5) {
      float band = 1.0 - smoothstep(0.1, 0.1 + blur, abs(Hc.x - SEC_TSX));
      col += C_SEC_LIGHT * 4.0 * band * (0.2 / (0.2 + blur)) * step(SEC_TSZ0, Hc.z) * step(Hc.z, SEC_TSZ1);
    } else {
      for (int i = 0; i < SEC_STRIPS.length(); i++) {
        float band = 1.0 - smoothstep(SEC_SW * 0.5, SEC_SW * 0.5 + blur, abs(Hc.z - SEC_STRIPS[i]));
        if (band <= 0.0) continue;
        float inX = 0.0;
        for (int j = 0; j < SEC_SEGS.length(); j++) {
          vec2 sg = SEC_SEGS[j];
          inX = max(inX, smoothstep(sg.x - blur, sg.x + blur, Hc.x) * (1.0 - smoothstep(sg.y - blur, sg.y + blur, Hc.x)));
        }
        col += C_SEC_LIGHT * 4.0 * band * inX * (SEC_SW / (SEC_SW + blur));
      }
    }
  }
  return col * F;
}
`;

const SHELL_COLOR = /* glsl */ `
  vec3 secP = vVlWorld;
  float secK = vSecKind;
  vec3 secAlb = vec3(1.0);
  float secRough = 0.85;
  float secAO = 1.0;
  float secPolish = 0.0;
  vec3 secEmit = vec3(0.0);
  float secLightK = 1.0;
  {
    vec2 xz = secP.xz;
    float fwx = fwidth(secP.x) + 1e-5;
    float fwz = fwidth(secP.z) + 1e-5;
    // contact shade at the foot of the walls, the columns and the cores (floor + walls)
    float dWall = min(min(secP.z - SEC_HZ0, secP.x - SEC_HX0), SEC_HX1 - secP.x);
    float cx = abs(fract((secP.x - SEC_COLX0) / 9.0 + 0.5) - 0.5) * 9.0;
    cx = secP.x < SEC_COLX0 - 4.5 || secP.x > SEC_COLX1 + 4.5 ? 99.0 : cx;
    float cz = 99.0;
    for (int i = 0; i < SEC_COLZ.length(); i++) cz = min(cz, abs(secP.z - SEC_COLZ[i]));
    float dCol = length(vec2(cx, cz)) - SEC_COLR;
    float dCore = 99.0;
    for (int i = 0; i < SEC_CORES.length(); i++) {
      vec2 q = abs(vec2(secP.x - SEC_CORES[i], secP.z - (SEC_HZ0 + SEC_CORE_Z1) * 0.5)) - vec2(SEC_CORE_HW, (SEC_CORE_Z1 - SEC_HZ0) * 0.5);
      dCore = min(dCore, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));
    }

    if (secK < 0.5) {
      // --- the hall floor: pale polished concrete -----------------------------
      float n1 = vl_vnoise(xz * 0.11 + 3.0);
      float n2 = vl_vnoise(xz * 0.7 + 9.0);
      float n3 = vl_vnoise(xz * 4.3);
      float aisle = smoothstep(SEC_ROWN_Z + SEC_BAY_HD - 0.05, SEC_ROWN_Z + SEC_BAY_HD + 0.05, secP.z) * (1.0 - smoothstep(SEC_ROWS_Z - SEC_BAY_HD - 0.05, SEC_ROWS_Z - SEC_BAY_HD + 0.05, secP.z));
      secAlb = mix(C_FLOOR, C_FLOOR_AISLE, aisle) * (0.95 + 0.07 * n1 + 0.035 * n2 + 0.02 * n3);
      // hairline bay markings: separators and stop lines
      float fw = max(fwx, fwz);
      float vis = 1.0 - smoothstep(0.05, 0.16, fw);
      float bx = secP.x - SEC_BAYX0;
      float inX = step(-0.06, bx) * step(secP.x, SEC_BAYX1 + 0.06);
      float sep = abs(fract(bx / 3.0 + 0.5) - 0.5) * 3.0;
      float rowS = step(SEC_ROWS_Z - SEC_BAY_HD, secP.z) * step(secP.z, SEC_ROWS_Z + SEC_BAY_HD);
      float rowN = step(SEC_ROWN_Z - SEC_BAY_HD, secP.z) * step(secP.z, SEC_ROWN_Z + SEC_BAY_HD);
      float mark = sec_hair(sep, 0.045, fwx) * max(rowS, rowN);
      mark = max(mark, sec_hair(abs(secP.z - (SEC_ROWS_Z + SEC_BAY_HD)), 0.045, fwz));
      mark = max(mark, sec_hair(abs(secP.z - (SEC_ROWN_Z - SEC_BAY_HD)), 0.045, fwz));
      secAlb = mix(secAlb, C_MARK, mark * inX * vis * 0.75);
      secAO *= mix(0.62, 1.0, smoothstep(0.0, 1.3, dWall));
      secAO *= mix(0.55, 1.0, smoothstep(0.0, 0.85, dCol));
      secAO *= mix(0.6, 1.0, smoothstep(0.0, 1.0, dCore));
      secRough = 0.36;
      secPolish = 0.75;
    } else if (secK < 1.5) {
      // --- soffit ------------------------------------------------------------
      secAlb = C_SOFFIT * (0.96 + 0.05 * vl_vnoise(xz * 0.5));
      secAO *= mix(0.78, 1.0, smoothstep(0.0, 1.0, dWall));
      secRough = 0.9;
      secEmit += secAlb * C_SEC_LIGHT * uSecGain * 0.55 * sec_soffitGlow(secP);
    } else if (secK < 2.5) {
      // --- precast walls with faint joints and the wayfinding rule -----------
      bool back = secP.z < SEC_HZ0 + 0.05;
      float run = back ? secP.x : secP.z;
      float fwr = back ? fwx : fwz;
      secAlb = C_WALL * (0.965 + 0.05 * vl_vnoise(vec2(run * 0.3, secP.y * 0.8)));
      float j = abs(fract(run / 3.0 + 0.5) - 0.5) * 3.0;
      secAlb *= 1.0 - 0.14 * sec_hair(j, 0.012, fwr) * (1.0 - smoothstep(0.03, 0.1, fwr));
      if (back) {
        float fy = fwidth(secP.y) + 1e-5;
        float band = sec_hair(abs(secP.y - (SEC_WAYY)), 0.04, fy);
        float dash = smoothstep(0.0, fwr * 1.5 + 0.01, fract(secP.x / 2.4)) * (1.0 - smoothstep(0.62, 0.62 + fwr * 1.5 + 0.01, fract(secP.x / 2.4)));
        secAlb = mix(secAlb, C_WAYFIND, band * dash * 0.9);
        secEmit += C_WAYFIND * band * dash * 0.3;
        secEmit += secAlb * C_SEC_LIGHT * uSecGain * 2.3 * sec_wash(secP.x, secP.y);
      }
      secAO *= mix(0.62, 1.0, smoothstep(0.0, 0.9, secP.y - SEC_HY0));
      secAO *= mix(0.85, 1.0, smoothstep(0.0, 0.45, SEC_HY1 - secP.y));
      secRough = 0.82;
    } else if (secK < 3.5) {
      // --- slender columns ----------------------------------------------------
      secAlb = C_COLUMN * (0.975 + 0.04 * vl_vnoise(vec2(secP.x * 3.0 + secP.z * 3.0, secP.y * 2.0)));
      secAO *= mix(0.6, 1.0, smoothstep(0.0, 0.7, secP.y - SEC_HY0));
      secAO *= mix(0.86, 1.0, smoothstep(0.0, 0.35, SEC_HY1 - secP.y));
      secRough = 0.62;
    } else if (secK < 4.5) {
      // --- light strips -------------------------------------------------------
      secAlb = vec3(1.0);
      secEmit = C_SEC_LIGHT * 4.2;
      secLightK = 0.0;
    } else if (secK < 5.5) {
      // --- lift cores ---------------------------------------------------------
      float fy = fwidth(secP.y) + 1e-5;
      float course = sec_hair(abs(fract((secP.y - SEC_HY0) / 0.55 + 0.5) - 0.5) * 0.55, 0.006, fy) * (1.0 - smoothstep(0.02, 0.06, fy));
      secAlb = C_CORE * (0.97 + 0.04 * vl_vnoise(secP.xy * 1.3)) * (1.0 - 0.1 * course);
      secAO *= mix(0.7, 1.0, smoothstep(0.0, 0.7, secP.y - SEC_HY0));
      secRough = 0.8;
    } else if (secK < 6.5) {
      // --- lobbies: a warm, glowing recess -------------------------------------
      float h = clamp((secP.y - SEC_HY0) / 2.45, 0.0, 1.0);
      secAlb = C_LOBBY;
      secEmit = C_SEC_LOBBY * (0.55 + 0.75 * h) * 1.15;
      secLightK = 0.3;
    } else if (secK < 7.5) {
      // --- tunnel floor --------------------------------------------------------
      float n1 = vl_vnoise(xz * 0.3 + 1.0);
      secAlb = C_TFLOOR * (0.95 + 0.07 * n1 + 0.03 * vl_vnoise(xz * 3.1));
      float dash = step(fract(secP.z / 3.0), 0.5);
      secAlb = mix(secAlb, C_FLOOR * 1.05, sec_hair(abs(secP.x - SEC_TSX), 0.05, fwx) * dash * 0.6);
      float de = min(secP.x - SEC_TX0, SEC_TX1 - secP.x);
      secAO *= mix(0.6, 1.0, smoothstep(0.0, 1.0, de));
      secRough = 0.5;
      secPolish = 0.45;
    } else if (secK < 8.5) {
      // --- tunnel walls and roof -----------------------------------------------
      secAlb = C_TWALL * (0.96 + 0.05 * vl_vnoise(vec2(secP.z * 0.4, secP.y * 0.9)));
      float j = abs(fract(secP.z / 3.0 + 0.5) - 0.5) * 3.0;
      secAlb *= 1.0 - 0.12 * sec_hair(j, 0.012, fwz) * (1.0 - smoothstep(0.03, 0.1, fwz));
      secAO *= mix(0.65, 1.0, smoothstep(0.0, 0.8, secP.y - (SEC_OY0 + 0.1)));
      secRough = 0.85;
    } else {
      secAlb = C_HIDDEN;
      secLightK = 0.0;
    }
  }
  diffuseColor.rgb = secAlb;
`;

const SHELL_EMISSIVE = /* glsl */ `
  {
    vec3 secN = inverseTransformDirection(normal, viewMatrix);
    float tunnel = step(SEC_HZ1 + 0.3, secP.z);
    vec3 lightIn = sec_light(secP, secN) * uSecGain;
    // light bounced off the pale floor onto everything facing down or sideways
    lightIn += C_SEC_LIGHT * uSecGain * (0.16 + 0.22 * max(-secN.y, 0.0)) * mix(1.0, 0.5, tunnel);
    totalEmissiveRadiance += secAlb * lightIn * secAO * secLightK + secEmit;
    if (secPolish > 0.0) totalEmissiveRadiance += sec_floorRefl(secP, tunnel) * secPolish * uSecGain * mix(0.75, 1.0, secAO);
  }
`;

/** The hall + tunnel shell. */
export function createShellMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0 }), {
    poche: PALETTE.poche,
  });
  return extendMaterial(mat, "sec-shell-v1", (shader) => {
    Object.assign(shader.uniforms, SU, { uSecGain });
    let vs = shader.vertexShader;
    vs = inject(vs, "#include <common>", "attribute float aKind;\nvarying float vSecKind;");
    vs = inject(vs, "#include <begin_vertex>", "vSecKind = aKind;");
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = fs.replace("void main() {", `${SEC_GLSL}\n${SHELL_GLSL}\nvoid main() {`);
    fs = inject(fs, "#include <clipping_planes_fragment>", "sec_portalDepth(vVlWorld);");
    fs = inject(fs, "#include <color_fragment>", SHELL_COLOR);
    fs = inject(fs, "#include <roughnessmap_fragment>", "roughnessFactor = secRough;");
    fs = inject(fs, "#include <emissivemap_fragment>", SHELL_EMISSIVE);
    // underground: the sky's fill is mostly gone; the strips do the lighting
    fs = inject(fs, "#include <lights_fragment_end>", "reflectedLight.indirectDiffuse *= 0.22 * secAO;\nreflectedLight.indirectSpecular *= 0.15;");
    shader.fragmentShader = fs;
  });
}

/* ------------------------------------------------------------------- cars */

const CAR_GLSL = /* glsl */ `
#define C_GLASS ${lin("#1E2224")}
#define C_TYRE ${lin("#272727")}
#define C_HUB ${lin("#9A978F")}
#define C_HEAD ${lin("#FFF3DE")}
#define C_TAIL ${lin("#E0563E")}
#define C_TAIL_LENS ${lin("#5A2620")}
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uSecGain;
varying float vCarPart;
varying vec3 vCarPaint;
varying float vCarLamp;
`;

const CAR_COLOR = /* glsl */ `
  float cpart = vCarPart;
  float cRough = 0.4;
  float cUnder = sec_under(vVlWorld);
  if (cpart < 0.5) { diffuseColor.rgb = vCarPaint; cRough = 0.34; }
  else if (cpart < 1.5) { diffuseColor.rgb = C_GLASS; cRough = 0.12; }
  else if (cpart < 2.5) { diffuseColor.rgb = C_TYRE; cRough = 0.9; }
  else if (cpart < 3.5) { diffuseColor.rgb = C_HUB; cRough = 0.45; }
  else if (cpart < 4.5) { diffuseColor.rgb = mix(vec3(0.55), C_HEAD, vCarLamp); cRough = 0.25; }
  else { diffuseColor.rgb = mix(C_TAIL_LENS, C_TAIL, vCarLamp * 0.6); cRough = 0.3; }
`;

const CAR_EMISSIVE = /* glsl */ `
  {
    vec3 cN = inverseTransformDirection(normal, viewMatrix);
    vec3 cV = normalize(vVlWorld - cameraPosition);
    vec3 cR = reflect(cV, cN);
    float cF = 0.04 + 0.96 * pow(1.0 - clamp(dot(-cV, cN), 0.0, 1.0), 5.0);
    if (cpart > 3.5 && cpart < 4.5) totalEmissiveRadiance += C_HEAD * 5.0 * vCarLamp;
    if (cpart > 4.5) totalEmissiveRadiance += C_TAIL * 3.2 * vCarLamp;
    // underground: lit by the strips, their soft highlights gliding over paint and glass
    vec3 lightIn = sec_light(vVlWorld, cN) * uSecGain + C_SEC_LIGHT * uSecGain * 0.18;
    totalEmissiveRadiance += diffuseColor.rgb * lightIn * cUnder * (cpart < 1.5 ? 1.0 : 0.7);
    float sheen = pow(clamp(cR.y, 0.0, 1.0), 6.0) * cF;
    totalEmissiveRadiance += C_SEC_LIGHT * uSecGain * sheen * cUnder * (cpart < 0.5 ? 0.9 : cpart < 1.5 ? 1.6 : 0.0);
    // outdoors: the glass mirrors the sky
    if (cpart > 0.5 && cpart < 1.5) {
      vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(-0.05, 0.6, cR.y));
      totalEmissiveRadiance += sky * (0.08 + 0.55 * cF) * (1.0 - cUnder);
    }
  }
`;

export function createCarMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, metalness: 0 }), {
    poche: PALETTE.poche,
  });
  return extendMaterial(mat, "sec-car-v1", (shader) => {
    Object.assign(shader.uniforms, SU, sharedUniformsFor(["uSkyTop", "uSkyHorizon"]), { uSecGain });
    let vs = shader.vertexShader;
    vs = inject(
      vs,
      "#include <common>",
      "attribute float aPart;\nattribute vec3 aPaint;\nattribute float aLamp;\nvarying float vCarPart;\nvarying vec3 vCarPaint;\nvarying float vCarLamp;",
    );
    vs = inject(vs, "#include <begin_vertex>", "vCarPart = aPart;\nvCarPaint = aPaint;\nvCarLamp = aLamp;");
    shader.vertexShader = vs;
    let fs = shader.fragmentShader;
    fs = fs.replace("void main() {", `${SEC_GLSL}\n${CAR_GLSL}\nvoid main() {`);
    fs = inject(fs, "#include <clipping_planes_fragment>", "sec_portalDepth(vVlWorld);");
    fs = inject(fs, "#include <color_fragment>", CAR_COLOR);
    fs = inject(fs, "#include <roughnessmap_fragment>", "roughnessFactor = cRough;");
    fs = inject(fs, "#include <emissivemap_fragment>", CAR_EMISSIVE);
    fs = inject(
      fs,
      "#include <lights_fragment_end>",
      "reflectedLight.indirectDiffuse *= mix(1.0, 0.2, cUnder);\nreflectedLight.indirectSpecular *= mix(1.0, 0.15, cUnder);",
    );
    shader.fragmentShader = fs;
  });
}

/* ------------------------------------------------------------ section cap */

export type CapUniforms = {
  uCutZ: { value: number };
  uHoleA: { value: Vector4 };
  uHoleB: { value: Vector4 };
  uTrH: { value: unknown };
};

/**
 * Depth-only cap on the section plane, inside the plinth's cut silhouette
 * (below the ground line). The plinth paints the strata first; the cap then
 * seals that face so nothing buried behind it shows through — except through
 * the openings where the cut crosses the hall or the tunnel.
 */
export function createCapMaterial() {
  const uniforms: CapUniforms = {
    uCutZ: { value: 1e4 },
    uHoleA: { value: new Vector4(0, 0, 1, 0) },
    uHoleB: { value: new Vector4(0, 0, 1, 0) },
    uTrH: { value: heightTexture() },
  };
  const mat = new ShaderMaterial({
    uniforms,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTrH;
      uniform float uCutZ;
      uniform vec4 uHoleA;
      uniform vec4 uHoleB;
      varying vec3 vW;
      ${PLINTH_UV_GLSL}
      bool inHole(vec4 h) { return vW.x > h.x && vW.x < h.y && vW.y > h.z && vW.y < h.w; }
      void main() {
        float top = texture2D(uTrH, tr_aoUv(vec2(vW.x, uCutZ))).r;
        if (vW.y > top - 0.04) discard;
        if (inHole(uHoleA) || inHole(uHoleB)) discard;
        gl_FragColor = vec4(0.0);
      }`,
  });
  return { mat, uniforms };
}

/* ---------------------------------------------------------- contact shadows */

export function createShadowMaterial() {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    clipping: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uShade: { value: new Color("#2A241D") } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        #include <clipping_planes_vertex>
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 uShade;
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        #include <clipping_planes_fragment>
        vec2 q = (vUv - 0.5) * 2.0;
        vec2 a = abs(q) - vec2(0.55, 0.72);
        float d = length(max(a, 0.0)) + min(max(a.x, a.y), 0.0);
        float core = 1.0 - smoothstep(-0.2, 0.32, d);
        float soft = 1.0 - smoothstep(-0.1, 0.95, d);
        float alpha = core * 0.42 + soft * 0.22;
        gl_FragColor = vec4(uShade, alpha);
      }`,
  });
  mat.clippingPlanes = clipPlanes;
  return mat;
}
