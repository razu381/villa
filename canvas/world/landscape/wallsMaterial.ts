/**
 * Limestone for the landscape architecture: coursed dry-stone masonry on the
 * retaining walls (like the film's garden walls), dressed slabs on copings and
 * treads. White model until the sweep passes (patchVillageMaterial).
 */
import { MeshStandardMaterial } from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U } from "@/lib/uniforms";
import { lin } from "../terrain/siteGlsl";
import { extendMaterial, f, inject } from "./shaderUtils";
import { PODIUM } from "@/lib/village";
import { BASTION, PORTAL } from "../terrain/ground";

const STONE_GLSL = /* glsl */ `
#define C_MASON ${lin("#CDBC9A")}
#define C_MASON_WARM ${lin("#C2A982")}
#define C_DRESSED ${lin(PALETTE.limestoneBuild)}
#define C_COPING ${lin("#DED4C1")}
varying vec3 vWl;
varying vec3 vWlN;

vec3 wl_masonry(vec2 uv) {
  // irregular courses: each course boundary is jittered, so heights vary 0.28–0.6 m
  float rowH = 0.42;
  float k = floor(uv.y / rowH);
  float bk = k * rowH + (vl_hash(vec2(k, 2.9)) - 0.5) * rowH * 0.5;
  float r = uv.y < bk ? k - 1.0 : k;
  float b0 = r * rowH + (vl_hash(vec2(r, 2.9)) - 0.5) * rowH * 0.5;
  float b1 = (r + 1.0) * rowH + (vl_hash(vec2(r + 1.0, 2.9)) - 0.5) * rowH * 0.5;
  float hR = b1 - b0;
  float fy = clamp((uv.y - b0) / hR, 0.0, 1.0);
  // irregular stone lengths: cells merge randomly, joints wander a little
  float cell = 0.36 + 0.22 * vl_hash(vec2(r, 5.1));
  float ux = (uv.x + vl_hash(vec2(r, 7.3)) * 4.0) / cell;
  float ci = floor(ux);
  float fx = fract(ux);
  float jl = step(0.42, vl_hash(vec2(ci, r)));
  float jr = step(0.42, vl_hash(vec2(ci + 1.0, r)));
  float b = ci;
  if (jl < 0.5) { b -= 1.0; if (step(0.42, vl_hash(vec2(ci - 1.0, r))) < 0.5) b -= 1.0; }
  float id = vl_hash(vec2(b, r) + 0.37);
  float id2 = vl_hash(vec2(b, r) + 3.1);
  float dxl = jl > 0.5 ? fx * cell : 1.0;
  float dxr = jr > 0.5 ? (1.0 - fx) * cell : 1.0;
  float dy = min(fy, 1.0 - fy) * hR;
  float d = min(min(dxl, dxr), dy);
  float fw = fwidth(uv.x) + fwidth(uv.y);
  float joint = 1.0 - smoothstep(0.01, 0.01 + fw * 1.2, d);
  float vis = 1.0 - smoothstep(0.02, 0.06, fw);
  float tv = mix(1.0, 0.88 + 0.22 * id, smoothstep(0.12, 0.03, fw));
  vec3 c = mix(C_MASON, C_MASON_WARM, id2 * 0.7) * tv;
  // each stone is slightly pillowed: lit top edge, shaded foot
  float pillow = smoothstep(0.0, 0.3, fy) * (1.0 - 0.35 * smoothstep(0.75, 1.0, fy));
  c *= mix(1.0, 0.9 + 0.12 * pillow, vis);
  c *= 0.92 + 0.13 * vl_vnoise(uv * vec2(6.0, 9.0) + id * 13.0);
  c *= 1.0 - joint * 0.4 * vis - 0.05 * (1.0 - vis);
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

export function createStoneMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.88, metalness: 0 }), {
    poche: PALETTE.poche,
  });
  return extendMaterial(mat, "stone-v1", (shader) => {
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", "attribute vec3 aWall;\nvarying vec3 vWl;\nvarying vec3 vWlN;");
    shader.vertexShader = inject(shader.vertexShader, "#include <begin_vertex>", "vWl = aWall;\nvWlN = normal;");
    let fs = shader.fragmentShader;
    fs = inject(fs, "#include <color_fragment>", COLOR_CODE, "after");
    fs = fs.replace("void main() {", `${STONE_GLSL}\nvoid main() {`);
    shader.fragmentShader = fs;
  });
}

/** The dark garage mouth: deepens into shadow; a warm strip and spill at night. */
export function createRecessMaterial() {
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, metalness: 0 }), {
    sweep: false,
    poche: null,
    seam: false,
  });
  return extendMaterial(mat, "recess-v1", (shader) => {
    shader.uniforms.uPathLights = U.uPathLights;
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", "attribute vec3 aWall;\nvarying vec3 vWl;");
    shader.vertexShader = inject(shader.vertexShader, "#include <begin_vertex>", "vWl = aWall;");
    let fs = shader.fragmentShader;
    fs = inject(fs, "#include <common>", `varying vec3 vWl;\nuniform float uPathLights;\n#define C_RC ${lin("#3A342E")}\n#define C_RC_DEEP ${lin("#120F0D")}\n#define C_RC_LIGHT ${lin(PALETTE.windowGlow)}`);
    fs = inject(
      fs,
      "#include <color_fragment>",
      /* glsl */ `
      float rcDepth = clamp((${f(PODIUM.maxZ + BASTION.inner)} - vVlWorld.z) / ${f(-PORTAL.back + BASTION.inner)}, 0.0, 1.0);
      diffuseColor.rgb = mix(C_RC, C_RC_DEEP, smoothstep(0.0, 0.9, rcDepth));`,
      "after",
    );
    fs = inject(
      fs,
      "#include <emissivemap_fragment>",
      /* glsl */ `
      float rcOn = max(uPathLights, smoothstep(0.55, 0.92, uNight));
      totalEmissiveRadiance += vWl.z > 3.5 ? C_RC_LIGHT * 3.2 * rcOn : C_RC_LIGHT * 0.07 * rcOn * (1.0 - rcDepth * 0.6);`,
      "after",
    );
    shader.fragmentShader = fs;
  });
}
