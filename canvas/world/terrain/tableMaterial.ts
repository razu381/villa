/**
 * The table the model stands on: a soft warm-stone surface with
 *   - an analytic, soft, long shadow of the plinth (swept box, penumbra grows
 *     with distance) — no shadow-map frustum edges, ever
 *   - contact darkening at the plinth's foot
 *   - a gentle pool of light around the model, fading into the fog
 */
import { MeshStandardMaterial } from "three";
import { U } from "@/lib/uniforms";
import { PLINTH, TABLE_Y } from "@/lib/village";
import { f, inject } from "../landscape/shaderUtils";
import { groundHeight } from "./ground";

/** Mean height of the plinth's top edge above the table (for the analytic shadow). */
const RIM_H = (() => {
  let s = 0;
  let n = 0;
  for (let x = PLINTH.minX; x <= PLINTH.maxX; x += 4) {
    s += groundHeight(x, PLINTH.minZ) + groundHeight(x, PLINTH.maxZ);
    n += 2;
  }
  for (let z = PLINTH.minZ; z <= PLINTH.maxZ; z += 4) {
    s += groundHeight(PLINTH.minX, z) + groundHeight(PLINTH.maxX, z);
    n += 2;
  }
  return s / n - TABLE_Y + 1.5; // + a little for trees and the podium
})();

const C = [(PLINTH.minX + PLINTH.maxX) / 2, (PLINTH.minZ + PLINTH.maxZ) / 2];
const H = [(PLINTH.maxX - PLINTH.minX) / 2, (PLINTH.maxZ - PLINTH.minZ) / 2];

export function createTableMaterial(color = "#CEC7B8") {
  const mat = new MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = U.uSunDir;
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", "varying vec3 vTbWorld;");
    shader.vertexShader = inject(
      shader.vertexShader,
      "#include <worldpos_vertex>",
      "vTbWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    );
    let fs = shader.fragmentShader;
    fs = inject(
      fs,
      "#include <common>",
      /* glsl */ `
      varying vec3 vTbWorld;
      uniform vec3 uSunDir;
      float tb_box(vec2 p) {
        vec2 q = abs(p - vec2(${f(C[0])}, ${f(C[1])})) - vec2(${f(H[0])}, ${f(H[1])});
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      }
      float tb_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float tb_noise(vec2 p) {
        vec2 i = floor(p); vec2 u = fract(p); u = u * u * (3.0 - 2.0 * u);
        return mix(mix(tb_hash(i), tb_hash(i + vec2(1, 0)), u.x), mix(tb_hash(i + vec2(0, 1)), tb_hash(i + vec2(1, 1)), u.x), u.y);
      }
      /** Soft shadow of the plinth block: distance to the box swept along the sun. */
      float tb_shadow(vec2 p) {
        vec3 L = normalize(uSunDir);
        if (L.y < 0.012) return 1.0;
        vec2 off = -L.xz / max(L.y, 0.03) * ${f(RIM_H)};
        float a = 0.0;
        float b = 1.0;
        for (int i = 0; i < 16; i++) {
          float m1 = a + (b - a) / 3.0;
          float m2 = b - (b - a) / 3.0;
          if (tb_box(p - off * m1) < tb_box(p - off * m2)) b = m2; else a = m1;
        }
        float s = 0.5 * (a + b);
        float d = tb_box(p - off * s);
        float soft = 0.6 + 0.05 * s * length(off);
        return mix(0.0, 1.0, smoothstep(-soft, soft, d));
      }`,
    );
    fs = inject(
      fs,
      "#include <color_fragment>",
      /* glsl */ `
      float tbD = max(tb_box(vTbWorld.xz), 0.0);
      float tbAo = 1.0 - 0.42 * exp(-tbD / 1.6) - 0.14 * exp(-tbD / 10.0);
      float tbPool = 1.0 + 0.07 * exp(-tbD / 70.0);
      float tbN = tb_noise(vTbWorld.xz * 0.045) * 0.6 + tb_noise(vTbWorld.xz * 0.6) * 0.4;
      diffuseColor.rgb *= tbAo * tbPool * (0.975 + 0.05 * tbN);`,
    );
    fs = inject(
      fs,
      "#include <lights_fragment_end>",
      /* glsl */ `
      {
        float sunUp = smoothstep(0.0, 0.06, normalize(uSunDir).y);
        float sh = mix(1.0, tb_shadow(vTbWorld.xz), sunUp);
        reflectedLight.directDiffuse *= mix(0.12, 1.0, sh);
        reflectedLight.directSpecular *= sh;
      }`,
    );
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => "vl-table-v1";
  return mat;
}
