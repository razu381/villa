/**
 * Limestone for the landscape architecture: rough coursed dry-stone masonry on
 * the retaining walls (after the film's garden wall — public/media/renders/
 * stone-wall.jpg), dressed slabs on copings and treads. White model until the
 * sweep passes (patchVillageMaterial). Everything rises out of the hill with
 * the podium (uPodRise, build.ts) — the shadow depth material follows.
 *
 * Masonry: irregular courses (0.18–0.55 m) in bands, stones 0.3–1.3 m long
 * with the odd pinning stone, cream / grey / ochre per stone, recessed dark
 * joints that open at the rounded stone corners, and a derivative bump from
 * each stone's pillowed face so low golden-hour light catches the relief.
 * At night a faint warm wash grazes the foot of the walls.
 */
import { MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking } from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U } from "@/lib/uniforms";
import { PODIUM } from "@/lib/village";
import { PLINTH_UV_GLSL, heightTexture } from "../terrain/aoTexture";
import { POD_RISE_GLSL, uPodRise } from "../terrain/build";
import { BASTION, PORTAL } from "../terrain/ground";
import { lin } from "../terrain/siteGlsl";
import { extendMaterial, f, inject } from "./shaderUtils";

const STONE_GLSL = /* glsl */ `
#define C_CREAM ${lin("#D5C6A4")}
#define C_GREYST ${lin("#BEB7A6")}
#define C_OCHREST ${lin("#C9AB7C")}
#define C_JOINT ${lin("#8E8270")}
#define C_DRESSED ${lin(PALETTE.limestoneBuild)}
#define C_COPING ${lin("#DED4C1")}
#define C_WASH ${lin(PALETTE.windowGlow)}
varying vec3 vWl;
varying vec3 vWlN;
uniform float uPathLights;
uniform sampler2D uTrH;
${PLINTH_UV_GLSL}
/** Relief height of the stone face (m), for the bump. */
float wlH = 0.0;

float wl_rbox(vec2 p, vec2 h, float r) {
  vec2 q = abs(p) - h + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec3 wl_masonry(vec2 uv) {
  float fw = fwidth(uv.x) + fwidth(uv.y);
  float vis = 1.0 - smoothstep(0.025, 0.07, fw);
  // courses: 0.9 m bands split into 2–3 courses of uneven height (0.18–0.55 m)
  float B = 0.9;
  float kb = floor(uv.y / B);
  float fy = uv.y / B - kb;
  float hb = vl_hash(vec2(kb, 1.3));
  float nC = hb < 0.45 ? 2.0 : 3.0;
  float t1 = (1.0 + (vl_hash(vec2(kb, 2.9)) - 0.5) * 0.55) / nC;
  float t2 = nC > 2.5 ? (2.0 + (vl_hash(vec2(kb, 4.1)) - 0.5) * 0.5) / nC : 1.0;
  float c0 = fy < t1 ? 0.0 : (fy < t2 ? t1 : t2);
  float c1 = fy < t1 ? t1 : (fy < t2 ? t2 : 1.0);
  float course = kb * 3.0 + (fy < t1 ? 0.0 : (fy < t2 ? 1.0 : 2.0));
  float y0 = (kb + c0) * B;
  float y1 = (kb + c1) * B;
  // stones: joints on a jittered ~0.33 m grid (lengths 0.3–1.3 m)
  float cw = 0.3 + 0.06 * vl_hash(vec2(course, 5.1));
  float ux = uv.x / cw + vl_hash(vec2(course, 7.3)) * 17.0;
  float ci = floor(ux);
  float L = ci;
  float R = ci + 1.0;
  // a joint at a cell edge with p = 0.42, and always every 4th edge, so every
  // fragment of a stone finds the same two joints (stones 1–4 cells long)
  for (int i = 0; i < 4; i++) { if (mod(L, 4.0) < 0.5 || vl_hash(vec2(L, course)) < 0.42) break; L -= 1.0; }
  for (int i = 0; i < 4; i++) { if (mod(R, 4.0) < 0.5 || vl_hash(vec2(R, course)) < 0.42) break; R += 1.0; }
  float jl = (L + (vl_hash(vec2(L, course + 0.5)) - 0.5) * 0.35) * cw;
  float jr = (R + (vl_hash(vec2(R, course + 0.5)) - 0.5) * 0.35) * cw;
  float xu = ux * cw;
  float id = vl_hash(vec2(L, course) + 0.37);
  float id2 = vl_hash(vec2(L, course) + 3.1);
  vec2 ctr = vec2(0.5 * (jl + jr), 0.5 * (y0 + y1));
  vec2 hs = vec2(0.5 * (jr - jl), 0.5 * (y1 - y0));
  // split courses: now and then a stone is two thin ones stacked
  float id3 = vl_hash(vec2(L, course) + 5.5);
  if (id3 > 0.84 && hs.y > 0.13) {
    float ym = ctr.y + (id3 - 0.92) * hs.y * 1.5;
    float up = step(ym, uv.y);
    ctr.y = mix(0.5 * (y0 + ym), 0.5 * (ym + y1), up);
    hs.y = mix(0.5 * (ym - y0), 0.5 * (y1 - ym), up);
    id = fract(id + 0.41 * up);
    id2 = fract(id2 + 0.29 * up);
  }
  float jw = 0.013 + 0.012 * id2;
  float rad = min(0.06, min(hs.x, hs.y) * 0.45);
  // rough-hewn outlines: the stone edge wanders a little
  float wob = (vl_vnoise(vec2(xu, uv.y) * 7.0 + id * 13.0) - 0.5) * 0.035 + (vl_vnoise(vec2(xu, uv.y) * 23.0) - 0.5) * 0.01;
  float d = wl_rbox(vec2(xu, uv.y) - ctr, hs - jw, rad) + wob * vis;
  float fwd = fwidth(d) + 1e-5;
  float stone = 1.0 - smoothstep(-fwd, fwd, d);
  // per-stone colour: cream, with grey and ochre stones; ±9 % value
  float near = 1.0 - smoothstep(0.02, 0.08, fw);
  vec3 c = mix(C_CREAM, C_GREYST, smoothstep(0.4, 0.8, id) * mix(0.35, 0.8, near));
  c = mix(c, C_OCHREST, smoothstep(0.78, 0.96, id2) * mix(0.25, 0.6, near));
  c *= mix(1.0, 0.91 + 0.18 * vl_hash(vec2(L, course) + 9.7), near);
  // face texture: weathered, pitted limestone
  float g1 = vl_vnoise(uv * vec2(5.0, 7.0) + id * 31.0);
  float g2 = vl_vnoise(uv * vec2(19.0, 23.0) + id2 * 17.0);
  float g3 = vl_vnoise(uv * vec2(61.0, 67.0));
  c *= 0.9 + 0.12 * g1 + (0.07 * g2 + 0.05 * g3) * vis;
  // a gently rounded face, falling into the joint (no bevelled tile edge)
  float pillow = smoothstep(0.0, 0.045, -d);
  wlH = (pillow * 0.012 + (g1 - 0.5) * 0.008 + (g2 - 0.5) * 0.003) * vis;
  c *= mix(1.0, 0.9 + 0.1 * pillow, vis);
  // deep, dark joints, fading to a tone at distance
  vec3 joint = mix(c * 0.45, C_JOINT * 0.42, 0.5) * (0.85 + 0.2 * g2);
  c = mix(c, mix(c * 0.8, joint, vis), (1.0 - stone) * mix(0.35, 1.0, vis));
  return c;
}
vec3 wl_slab(vec2 uv, vec3 base, float L) {
  float k = uv.x / L;
  float id = vl_hash(vec2(floor(k), 1.7));
  float fw = fwidth(uv.x);
  float d = min(fract(k), 1.0 - fract(k)) * L;
  float joint = 1.0 - smoothstep(0.008, 0.008 + fw, d);
  float vis = 1.0 - smoothstep(0.02, 0.07, fw);
  vec3 c = base * (0.96 + 0.06 * id);
  c *= 0.96 + 0.06 * vl_vnoise(uv * 8.0);
  wlH = (1.0 - joint) * 0.004 * vis;
  return c * (1.0 - joint * 0.3 * vis);
}
`;

const COLOR_CODE = /* glsl */ `
  {
    float k = vWl.z;
    vec3 sc;
    if (k < 0.5) sc = wl_masonry(vWl.xy);
    else if (k < 1.5) sc = wl_slab(vWl.xy, C_COPING, 1.15);
    else sc = wl_slab(vWl.xy, C_DRESSED, 0.9) * mix(0.97, 1.0, step(0.5, abs(vWlN.y)));
    diffuseColor.rgb = sc;
  }
`;

/** Derivative bump from the stone relief (view space; three's perturbNormalArb). */
const BUMP_CODE = /* glsl */ `
  {
    float wlK = vlMask * step(vWl.z, 2.5);
    vec3 sx = dFdx(-vViewPosition);
    vec3 sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal);
    vec3 r2 = cross(normal, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dFdx(wlH) * r1 + dFdy(wlH) * r2);
    normal = normalize(mix(normal, abs(det) * normal - grad, wlK));
  }
`;

const VERT = /* glsl */ `
attribute vec3 aWall;
attribute float aBase;
varying vec3 vWl;
varying vec3 vWlN;
${POD_RISE_GLSL}
`;

export function createStoneMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.88, metalness: 0 }), {
    poche: PALETTE.poche,
  });
  return extendMaterial(mat, "stone-v2", (shader) => {
    shader.uniforms.uPodRise = uPodRise;
    shader.uniforms.uPathLights = U.uPathLights;
    shader.uniforms.uTrH = { value: heightTexture() };
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", VERT);
    shader.vertexShader = inject(shader.vertexShader, "#include <begin_vertex>", "vWl = aWall;\nvWlN = normal;\ntransformed.y = vl_podY(aBase, transformed.y);");
    let fs = shader.fragmentShader;
    fs = inject(fs, "#include <color_fragment>", COLOR_CODE, "after");
    // the bump needs vlMask (declared by the patch after color_fragment)
    fs = inject(fs, "#include <normal_fragment_maps>", BUMP_CODE, "after");
    fs = inject(
      fs,
      "#include <emissivemap_fragment>",
      /* glsl */ `
      {
        // night: a warm wash grazing the foot of the walls (masonry faces only)
        float on = max(uPathLights, smoothstep(0.55, 0.92, uNight)) * uNight;
        if (on > 0.001 && vWl.z < 0.5) {
          vec3 wn = normalize(vWlN);
          float g = texture2D(uTrH, tr_aoUv(vVlWorld.xz + wn.xz * 0.9)).r;
          float foot = exp(-max(vVlWorld.y - g, 0.0) / 0.85) * step(0.2, length(wn.xz));
          totalEmissiveRadiance += C_WASH * diffuseColor.rgb * foot * on * 0.34 * (0.7 + 14.0 * wlH);
        }
      }`,
      "after",
    );
    fs = fs.replace("void main() {", `${STONE_GLSL}\nvoid main() {`);
    shader.fragmentShader = fs;
  });
}

/** Shadow depth for the walls: rises with the podium. */
export function createStoneDepthMaterial() {
  const mat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPodRise = uPodRise;
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", `attribute float aBase;\n${POD_RISE_GLSL}`);
    shader.vertexShader = inject(shader.vertexShader, "#include <begin_vertex>", "transformed.y = vl_podY(aBase, transformed.y);");
  };
  mat.customProgramCacheKey = () => "stone-depth-v1";
  return mat;
}

/**
 * The garage mouth: frame shade at the opening grading to a dim warm interior,
 * a faint floor-level glow from the soffit strip by day, fully lit at night.
 */
export function createRecessMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, metalness: 0 }), {
    sweep: false,
    poche: null,
    seam: false,
  });
  return extendMaterial(mat, "recess-v2", (shader) => {
    shader.uniforms.uPathLights = U.uPathLights;
    shader.uniforms.uPodRise = uPodRise;
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", `attribute vec3 aWall;\nattribute float aBase;\nvarying vec3 vWl;\n${POD_RISE_GLSL}`);
    shader.vertexShader = inject(shader.vertexShader, "#include <begin_vertex>", "vWl = aWall;\ntransformed.y = vl_podY(aBase, transformed.y);");
    let fs = shader.fragmentShader;
    fs = inject(
      fs,
      "#include <common>",
      `varying vec3 vWl;\nuniform float uPathLights;\n#define C_RC ${lin("#8A7F70")}\n#define C_RC_DEEP ${lin("#4A4239")}\n#define C_RC_LIGHT ${lin(PALETTE.windowGlow)}`,
    );
    fs = inject(
      fs,
      "#include <color_fragment>",
      /* glsl */ `
      float rcDepth = clamp((${f(PODIUM.maxZ + BASTION.inner)} - vVlWorld.z) / ${f(-PORTAL.back + BASTION.inner)}, 0.0, 1.0);
      float rcY = clamp((vVlWorld.y - ${f(PORTAL.floor)}) / ${f(PORTAL.top - PORTAL.floor)}, 0.0, 1.0);
      diffuseColor.rgb = mix(C_RC, C_RC_DEEP, smoothstep(0.0, 1.0, rcDepth)) * (0.9 + 0.1 * rcY);
      // the white model: a pale recess, just shaded
      diffuseColor.rgb = mix(uModelColor * 0.7, diffuseColor.rgb, smoothstep(0.0, 0.6, uMaterial));`,
      "after",
    );
    fs = inject(
      fs,
      "#include <emissivemap_fragment>",
      /* glsl */ `
      {
        float rcOn = max(uPathLights, smoothstep(0.55, 0.92, uNight));
        float rcLev = mix(0.15, 1.0, rcOn) * smoothstep(0.2, 0.9, uMaterial);
        if (vWl.z > 3.5) totalEmissiveRadiance += C_RC_LIGHT * 3.2 * rcLev;
        else {
          // the strip's light washing down the jambs and the back wall
          float nearTop = smoothstep(0.2, 1.0, rcY);
          totalEmissiveRadiance += C_RC_LIGHT * diffuseColor.rgb * rcLev * (0.25 + 0.6 * nearTop) * mix(0.6, 1.0, rcDepth);
          // daylight bouncing in off the driveway: the mouth reads as a room, not a hole
          totalEmissiveRadiance += diffuseColor.rgb * 0.2 * (1.0 - uNight) * (1.0 - 0.55 * rcDepth) * smoothstep(0.2, 0.9, uMaterial);
        }
      }`,
      "after",
    );
    shader.fragmentShader = fs;
  });
}
