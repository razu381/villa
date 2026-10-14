import { Color, DoubleSide, FrontSide, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";
import { PALETTE } from "./palette";
import { U, clipPlanes } from "./uniforms";

/**
 * Shared GLSL. Declares the shared uniforms and helper functions:
 *   vl_sweepDist(worldPos)  signed distance behind the material-sweep front (+ = materialised)
 *   vl_sweepMask(worldPos)  0 = white model, 1 = real material
 *   vl_seam(worldPos)       0 → 1 thin glowing band riding the sweep front
 *   vl_hash / vl_vnoise     cheap 2D noise
 * Use it in fully custom ShaderMaterials: `${VL_GLSL}` at the top of the fragment
 * shader, and bind `...sharedUniformsFor(["uMaterial", ...])` in `uniforms`.
 */
export const VL_GLSL = /* glsl */ `
uniform float uTime;
uniform float uMaterial;
uniform float uLife;
uniform float uNight;
uniform float uWindows;
uniform vec3 uSweepFrom;
uniform vec3 uSweepTo;
uniform float uSectionZ;

float vl_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vl_vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vl_hash(i), vl_hash(i + vec2(1.0, 0.0)), u.x),
             mix(vl_hash(i + vec2(0.0, 1.0)), vl_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float vl_sweepDist(vec3 wp) {
  vec2 a = uSweepFrom.xz;
  vec2 b = uSweepTo.xz;
  vec2 dir = normalize(b - a);
  float len = length(b - a);
  float along = dot(wp.xz - a, dir);
  float front = mix(-16.0, len + 16.0, uMaterial);
  float n = (vl_vnoise(wp.xz * 0.06) - 0.5) * 16.0
          + (vl_vnoise(wp.xz * 0.35 + 7.0) - 0.5) * 3.0
          + wp.y * 0.4;
  return front - (along + n);
}
float vl_sweepMask(vec3 wp) { return smoothstep(-0.7, 0.7, vl_sweepDist(wp)); }
/** Point where the view ray through a fragment crosses the section plane (z = uSectionZ). */
vec3 vl_sectionPoint(vec3 wp, vec3 camPos) {
  vec3 dir = wp - camPos;
  float k = abs(dir.z) > 1e-4 ? (uSectionZ - camPos.z) / dir.z : 0.0;
  return camPos + dir * clamp(k, 0.0, 1.0);
}
/** Earth strata at a point on the cut face: horizontal cork/earth bands with soft noise. */
vec3 vl_strata(vec3 p, vec3 base) {
  float y = p.y + (vl_vnoise(p.xz * vec2(0.08, 0.5)) - 0.5) * 1.6;
  float band = fract(y / 2.3);
  float tone = mix(0.86, 1.08, smoothstep(0.0, 0.5, band) * (1.0 - smoothstep(0.55, 1.0, band)));
  float grain = 0.94 + 0.12 * vl_vnoise(p.xy * vec2(1.7, 3.1));
  float depth = mix(0.78, 1.0, smoothstep(-14.0, 6.0, p.y));
  return base * tone * grain * depth;
}
float vl_seam(vec3 wp) {
  float d = vl_sweepDist(wp);
  float vlOn = smoothstep(0.0, 0.02, uMaterial) * (1.0 - smoothstep(0.98, 1.0, uMaterial));
  return (1.0 - smoothstep(0.0, 1.8, abs(d - 1.0))) * vlOn;
}
`;

type UniformName = keyof typeof U;
/** Pick shared uniforms by reference for a custom ShaderMaterial. */
export function sharedUniformsFor(names: UniformName[]) {
  const out: Record<string, { value: unknown }> = {};
  for (const n of names) out[n] = U[n];
  return out;
}

export interface VillagePatchOptions {
  /** White model → real material via the sweep (default true). */
  sweep?: boolean;
  /** Colour of the white model before the sweep. */
  modelColor?: string;
  modelRoughness?: number;
  /** Solid colour drawn on back faces when the mesh is cut (needs closed meshes). null = off. */
  poche?: string | null;
  /**
   * 'flat' = solid poche colour (buildings). 'strata' = earth layers evaluated on the
   * section plane itself (terrain/plinth) — reads like a cut architectural model.
   */
  pocheStyle?: "flat" | "strata";
  /** Clip with the section plane (default true). */
  clip?: boolean;
  /** Warm seam glow on the sweep front (default true). */
  seam?: boolean;
}

const DEFAULTS: Required<VillagePatchOptions> = {
  sweep: true,
  modelColor: PALETTE.modelWhite,
  modelRoughness: 0.92,
  poche: PALETTE.poche,
  pocheStyle: "flat",
  clip: true,
  seam: true,
};

/**
 * Patch a MeshStandardMaterial / MeshPhysicalMaterial into a village material:
 * section clipping, the white-model → material sweep, the seam glow and
 * section poché. Set the material's real colour/roughness as usual — the patch
 * shows `modelColor` until the sweep passes.
 *
 *   const mat = patchVillageMaterial(new MeshStandardMaterial({ color: PALETTE.cork, roughness: 0.85 }))
 */
export function patchVillageMaterial<T extends MeshStandardMaterial>(mat: T, options: VillagePatchOptions = {}): T {
  const o = { ...DEFAULTS, ...options };
  if (o.clip) {
    mat.clippingPlanes = clipPlanes;
    mat.clipShadows = true;
  }
  if (o.poche) {
    mat.side = DoubleSide;
    mat.shadowSide = FrontSide;
  }
  const uModelColor = { value: new Color(o.modelColor) };
  const uModelRough = { value: o.modelRoughness };
  const uPoche = { value: new Color(o.poche ?? "#000000") };
  const uSeamColor = { value: new Color("#FFB866").multiplyScalar(2.2) };

  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, sharedUniformsFor(["uTime", "uMaterial", "uLife", "uNight", "uWindows", "uSweepFrom", "uSweepTo", "uSectionZ"]), {
      uModelColor,
      uModelRough,
      uPoche,
      uSeamColor,
    });

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vVlWorld;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vec4 vlWp = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          vlWp = batchingMatrix * vlWp;
        #endif
        #ifdef USE_INSTANCING
          vlWp = instanceMatrix * vlWp;
        #endif
        vVlWorld = ( modelMatrix * vlWp ).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vVlWorld;
        uniform vec3 uModelColor;
        uniform float uModelRough;
        uniform vec3 uPoche;
        uniform vec3 uSeamColor;
        ${VL_GLSL}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float vlMask = ${o.sweep ? "vl_sweepMask( vVlWorld )" : "1.0"};
        diffuseColor.rgb = mix( uModelColor, diffuseColor.rgb, vlMask );`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix( uModelRough, roughnessFactor, vlMask );`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        metalnessFactor = mix( 0.0, metalnessFactor, vlMask );`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance *= vlMask;
        ${o.seam && o.sweep ? "totalEmissiveRadiance += uSeamColor * vl_seam( vVlWorld );" : ""}`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        ${
          o.poche
            ? o.pocheStyle === "strata"
              ? "if ( !gl_FrontFacing ) { vec3 vlCut = vl_sectionPoint( vVlWorld, cameraPosition ); gl_FragColor = vec4( vl_strata( vlCut, uPoche ) * mix( 1.0, 0.45, uNight ), 1.0 ); }"
              : "if ( !gl_FrontFacing ) gl_FragColor = vec4( uPoche * mix( 1.0, 0.45, uNight ), 1.0 );"
            : ""
        }`,
      );
  };
  mat.customProgramCacheKey = () => `vl:${o.sweep ? 1 : 0}${o.poche ? (o.pocheStyle === "strata" ? 2 : 1) : 0}${o.seam ? 1 : 0}${o.clip ? 1 : 0}`;
  mat.needsUpdate = true;
  return mat;
}
