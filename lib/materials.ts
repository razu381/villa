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
    Object.assign(shader.uniforms, sharedUniformsFor(["uTime", "uMaterial", "uLife", "uNight", "uWindows", "uSweepFrom", "uSweepTo"]), {
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
        ${o.poche ? "if ( !gl_FrontFacing ) gl_FragColor = vec4( uPoche * mix( 1.0, 0.45, uNight ), 1.0 );" : ""}`,
      );
  };
  mat.customProgramCacheKey = () => `vl:${o.sweep ? 1 : 0}${o.poche ? 1 : 0}${o.seam ? 1 : 0}${o.clip ? 1 : 0}`;
  mat.needsUpdate = true;
  return mat;
}
