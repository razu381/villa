/**
 * Materials for the featured homes.
 *
 *  - homeHouseMaterials(): per-level clones of the shared house materials
 *    (canvas/world/houses) with an extra horizontal "plan cut" clipping plane
 *    and a hover brightening uniform. Same shader, same uniforms by reference
 *    — so during the journey the featured homes are indistinguishable from
 *    the village — and the clones share one compiled program per material.
 *  - interior materials: vertex-coloured model furniture (cut by the same
 *    planes, poché where cut), lamp bodies, additive light pools.
 *  - homeLineMaterial(): screen-space hairlines (plans, guides, the golden
 *    jewel drawing) with a draw-in progress.
 */

import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshDepthMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Plane,
  ShaderChunk,
  ShaderMaterial,
  Vector2,
  Vector3,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import { HOUSE_LINE_RES, HOUSE_MATERIAL_KEYS, getHouseDepthMaterial, getHouseMaterials, type HouseMaterialKey } from "@/canvas/world/houses/architecture";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U, sectionPlane } from "@/lib/uniforms";

/** A horizontal clipping plane removing everything above y (world). Far away = off. */
export const makeCutPlane = () => new Plane(new Vector3(0, -1, 0), 1e4);

/** Per-home shared uniforms (hover glow, lamp level, open levels). */
export interface HomeUniforms {
  /** Hover / selection brightening, 0 → ~0.08. */
  uHomeGlow: { value: number };
  /** Interior lamps, 0 (day) → 1 (dusk/night). */
  uLamp: { value: number };
  /** Poché colour for this home's cut faces (the section colour by default). */
  uPoche: { value: Color };
  /** Per material set: 0 closed → 1 open in plan (exploded view). */
  uOpen: { value: number }[];
  /**
   * The exploded home's own light, 0 (journey: exactly the village's shading)
   * → 1: a raking-light response (a low sun still reads on floors and table
   * tops, its shadows long and legible) and a little less ambient fill.
   */
  uStudio: { value: number };
  /** Floor tone of the open rooms: a pale limed oak, so the model's furniture reads against it. */
  uHomeFloor: { value: Color };
}

export const createHomeUniforms = (sets = 3): HomeUniforms => ({
  uHomeGlow: { value: 0 },
  uLamp: { value: 0 },
  uPoche: { value: new Color(PALETTE.poche) },
  uOpen: Array.from({ length: sets }, () => ({ value: 0 })),
  uStudio: { value: 0 },
  uHomeFloor: { value: new Color("#D3C2A5") },
});

/**
 * three's physical lighting with a raking-light response: N·L lifted towards
 * N·L^0.55 by uStudio (grazing light still models horizontal surfaces, like a
 * photographer's low fill card). Identity at uStudio = 0.
 */
const RAKE_LIGHTS = ShaderChunk.lights_physical_pars_fragment.replace(
  "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );",
  "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tdotNL = mix( dotNL, pow( dotNL, 0.55 ), uStudio );",
);
/**
 * The studio fill: by day a little less ambient (the sun models the open
 * floors); by night a little more (moonlit model, the roof never a black hole).
 */
const STUDIO_FILL = "reflectedLight.indirectDiffuse *= 1.0 + uStudio * mix(-0.28, 0.6, uNight);";

/** Adds the studio light to a MeshStandardMaterial fragment shader (after its own patches). */
function studioLight(fs: string) {
  return fs
    .replace("#include <common>", "#include <common>\nuniform float uStudio;")
    .replace("#include <lights_physical_pars_fragment>", RAKE_LIGHTS)
    .replace("#include <aomap_fragment>", `#include <aomap_fragment>\n${STUDIO_FILL}`);
}

/** The house shader's fake bounce light inside cut rooms (see world/houses/materials.ts WALL_EMISSIVE). */
const ROOM_BOUNCE = "uPlaster * vec3(1.0, 0.95, 0.86) * 0.45 * (1.0 - uNight)";

/**
 * Clone of a house material with [section plane, cut plane] clipping and the
 * hover glow. onBeforeCompile chains the original (all of its uniforms are the
 * same objects), then adds a few lines driven by this home's uniforms:
 *  - a multiply before tone mapping (hover brightening),
 *  - with the level open in plan: no fake bounce light in the rooms (they get
 *    real sun now) and no window panes (an architect's model has no glass).
 * With every uniform at 0 the output is identical to the village's.
 */
function cloneHouseMaterial(key: HouseMaterialKey, src: MeshStandardMaterial, cut: Plane, hu: HomeUniforms, open: { value: number }) {
  const m = src.clone();
  m.clippingPlanes = [sectionPlane, cut];
  m.clipShadows = true;
  const base = src.onBeforeCompile;
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
    base.call(src, shader, renderer);
    shader.uniforms.uHomeGlow = hu.uHomeGlow;
    shader.uniforms.uHomeOpen = open;
    shader.uniforms.uStudio = hu.uStudio;
    shader.uniforms.uHomeFloor = hu.uHomeFloor;
    if (shader.uniforms.uPoche) shader.uniforms.uPoche = hu.uPoche;
    let fs = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uHomeGlow;\nuniform float uHomeOpen;\nuniform vec3 uHomeFloor;")
      .replace("uFloorTone * (0.9 + 0.2 * board)", "mix(uFloorTone, uHomeFloor, uHomeOpen) * (0.9 + 0.2 * board)")
      .replace("#include <tonemapping_fragment>", "gl_FragColor.rgb *= 1.0 + uHomeGlow;\n#include <tonemapping_fragment>")
      .replace(ROOM_BOUNCE, `${ROOM_BOUNCE} * (1.0 - uHomeOpen)`);
    // (The bump's NaN guard now lives in the source hPerturb — world/houses/materials.ts.)
    if (key === "window") {
      fs = fs.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (uHomeOpen > 0.02 && vHWin.y > 0.5 && vHWin.y < 2.5) discard;",
      );
    }
    if (key === "solar") {
      // The open home's panels by night: a faint moonlit slate, not a black hole.
      fs = fs.replace("#include <tonemapping_fragment>", "gl_FragColor.rgb += uStudio * uNight * vec3(0.016, 0.02, 0.03);\n#include <tonemapping_fragment>");
    }
    shader.fragmentShader = studioLight(fs);
  };
  const cacheKey = src.customProgramCacheKey();
  m.customProgramCacheKey = () => `${cacheKey}:home`;
  m.name = `${src.name}-home`;
  return m;
}

export type HouseMaterialSet = Record<HouseMaterialKey, MeshStandardMaterial>;

/** One material set per cut plane (e.g. per level, plus an uncut set). */
export function homeHouseMaterials(cuts: Plane[], hu: HomeUniforms): HouseMaterialSet[] {
  const shared = getHouseMaterials();
  return cuts.map((cut, i) => {
    const set = {} as HouseMaterialSet;
    for (const k of HOUSE_MATERIAL_KEYS) set[k] = cloneHouseMaterial(k, shared[k], cut, hu, hu.uOpen[i]);
    return set;
  });
}

/**
 * A house shadow material of its own (same program as getHouseDepthMaterial:
 * the same rise in the vertex shader). Needed per cut set: three.js reuses a
 * custom depth material's projected clipping planes across consecutive shadow
 * draws (it does not clone custom depth materials per colour material), so
 * meshes with different cut planes must not share one.
 */
export function homeDepthMaterial() {
  const src = getHouseDepthMaterial();
  const m = new MeshDepthMaterial();
  m.onBeforeCompile = src.onBeforeCompile;
  m.customProgramCacheKey = src.customProgramCacheKey;
  m.name = "house-depth-home";
  return m;
}

/* --------------------------------------------------------------- interiors */

/**
 * Model furniture and partitions: matte, vertex-coloured (timber, linen,
 * plaster tones), cut by the level's plan plane with poché on the cut, and a
 * faint warm lift when the lamps come on.
 */
export function interiorMaterial(cut: Plane, hu: HomeUniforms) {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, emissive: new Color(PALETTE.windowGlow) });
  patchVillageMaterial(m, { sweep: false, seam: false, poche: PALETTE.poche });
  m.clippingPlanes = [sectionPlane, cut];
  m.clipShadows = true;
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    base.call(m, shader, renderer);
    shader.uniforms.uPoche = hu.uPoche;
    shader.uniforms.uLamp = hu.uLamp;
    shader.uniforms.uStudio = hu.uStudio;
    shader.fragmentShader = studioLight(shader.fragmentShader)
      .replace("#include <common>", "#include <common>\nuniform float uLamp;")
      // Lamp-lit at dusk: a warm fill proportional to the surface colour (never flat).
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance = emissive * diffuseColor.rgb * 0.16 * uLamp;");
  };
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => `${key}:home-interior`;
  m.name = "home-interior";
  return m;
}

/** Lamp shades / globes: pale linen by day, glowing warm at dusk (bloom picks them up). */
export function lampMaterial(hu: HomeUniforms) {
  const m = new MeshStandardMaterial({ color: "#E9E1D2", roughness: 0.7, emissive: new Color(PALETTE.windowGlow) });
  patchVillageMaterial(m, { sweep: false, seam: false, poche: null });
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    base.call(m, shader, renderer);
    shader.uniforms.uLamp = hu.uLamp;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLamp;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance = emissive * (0.25 + 3.2 * uLamp) * uLamp;");
  };
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => `${key}:home-lamp`;
  m.name = "home-lamp";
  return m;
}

/** Warm light pooling on floors and table tops under the lamps (additive, unlit). */
export function poolMaterial(hu: HomeUniforms) {
  return new ShaderMaterial({
    name: "home-pools",
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    clipping: true,
    clippingPlanes: [sectionPlane],
    uniforms: { uLamp: hu.uLamp, uGlow: { value: new Color(PALETTE.windowGlow) } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      attribute float aPool;
      varying vec2 vUv;
      varying float vK;
      void main() {
        vUv = uv;
        vK = aPool;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform float uLamp;
      uniform vec3 uGlow;
      varying vec2 vUv;
      varying float vK;
      void main() {
        #include <clipping_planes_fragment>
        if (uLamp <= 0.001) discard;
        vec2 d = (vUv - 0.5) * 2.0;
        float r2 = dot(d, d);
        float k = exp(-r2 * 3.2) * 0.75 + exp(-r2 * 12.0) * 0.35;
        k *= 1.0 - smoothstep(0.75, 1.0, sqrt(r2));
        gl_FragColor = vec4(uGlow * vec3(1.0, 0.9, 0.76) * k * vK * uLamp * 0.55, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/* ------------------------------------------------------------------- lines */

export interface LineMaterialOptions {
  color: string;
  /** Peak alpha. */
  alpha?: number;
  /** CSS px width (scaled by the pixel ratio via HOUSE_LINE_RES). */
  width?: number;
  /** Additive glow-ish blending for the golden drawing at dusk. */
  additive?: boolean;
  depthTest?: boolean;
  /** Honour aLine.x as a dash period (plan guides). */
  dashed?: boolean;
}

/**
 * Screen-space hairlines for LineCollector geometry (kit.ts): aLine = (dash
 * period in metres or 0, endpoint 0|1, phase, duration). `uProgress` draws
 * them in like a pen (each segment starts at phase·0.78 and takes duration).
 */
export function homeLineMaterial(o: LineMaterialOptions) {
  return new ShaderMaterial({
    name: "home-lines",
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: o.additive ? AdditiveBlending : NormalBlending,
    clipping: true,
    clippingPlanes: [sectionPlane],
    uniforms: {
      ...HOUSE_LINE_RES,
      uProgress: { value: 0 },
      uDash: { value: o.dashed ? 1 : 0 },
      uAlpha: { value: o.alpha ?? 0.6 },
      uScale: { value: (o.width ?? 1.15) / 1.15 },
      uColor: { value: new Color(o.color) },
      uNight: U.uNight,
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      #define LINE_PULL 0.0016
      uniform vec2 uRes;
      uniform float uWidth;
      uniform float uScale;
      attribute vec3 aOther;
      attribute float aSide;
      attribute vec4 aLine;
      varying vec4 vLine;
      varying float vDist;
      varying float vAlong;
      varying float vW;
      void main() {
        vLine = aLine;
        float w = uWidth * uScale;
        vW = w;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec4 mvOther = modelViewMatrix * vec4(aOther, 1.0);
        vAlong = aLine.y * length((modelMatrix * vec4(aOther, 1.0)).xyz - (modelMatrix * vec4(position, 1.0)).xyz);
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
        if (aLine.y > 0.5) dir = -dir;
        vec2 nrm = vec2(-dir.y, dir.x);
        float ext = w * 0.5 + 1.0;
        vec2 off = nrm * aSide * ext + dir * (aLine.y > 0.5 ? 1.0 : -1.0) * min(ext, 0.5 * len);
        vDist = aSide * ext;
        gl_Position = cThis + vec4(off / half_ * cThis.w, 0.0, 0.0);
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform float uProgress;
      uniform float uAlpha;
      uniform float uDash;
      uniform vec3 uColor;
      varying vec4 vLine;
      varying float vDist;
      varying float vAlong;
      varying float vW;
      void main() {
        #include <clipping_planes_fragment>
        float segP = clamp((uProgress - vLine.z * 0.78) / max(vLine.w, 1e-3), 0.0, 1.0);
        if (segP <= 0.0 || vLine.y > segP) discard;
        float a = uAlpha;
        // Dashed guides: aLine.x = dash period (metres). (House drawings keep their delay there.)
        if (uDash > 0.5 && vLine.x > 0.0) {
          float f = fract(vAlong / vLine.x);
          a *= smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.5, 0.58, f));
        }
        float w = max(vW, 1.0);
        a *= clamp(w * 0.5 + 0.5 - abs(vDist), 0.0, 1.0) * min(vW, 1.0);
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}

/* ------------------------------------------------------------------ marker */

/**
 * The jewel marker: a hollow ring with a fine centre dot, constant screen size
 * (a single point sprite), gold.
 */
export function markerMaterial() {
  return new ShaderMaterial({
    name: "home-marker",
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uAlpha: { value: 0 },
      uHover: { value: 0 },
      uSize: { value: 26 },
      uColor: { value: new Color(PALETTE.sun) },
      uDot: { value: new Color("#F4EBD9") },
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uHover;
      varying float vPx;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (1.0 + 0.18 * uHover);
        vPx = gl_PointSize;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      uniform float uHover;
      uniform vec3 uColor;
      uniform vec3 uDot;
      varying float vPx;
      void main() {
        vec2 p = (gl_PointCoord - 0.5) * vPx;
        float r = length(p);
        float R = vPx * 0.5 - 2.0;
        float ring = clamp(1.0 - abs(r - (R - 0.6)) / 1.0, 0.0, 1.0) * (0.85 + 0.15 * uHover);
        float core = clamp(3.2 + 0.8 * uHover - r, 0.0, 1.0);
        float halo = exp(-r * r / (R * R * 0.35)) * 0.18;
        float w = ring + core + halo;
        vec3 c = (uColor * (ring + halo) + uDot * core) / max(w, 1e-3);
        float a = clamp(w, 0.0, 1.0) * uAlpha;
        if (a < 0.004) discard;
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
}

/** Soft warm light pooled on the ground around a home (a rounded-rect ring, falling off outwards). */
export function haloMaterial() {
  return new ShaderMaterial({
    name: "home-halo",
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -6,
    clipping: true,
    clippingPlanes: [sectionPlane],
    uniforms: {
      uAlpha: { value: 0 },
      uHalf: { value: new Vector2(4, 6) },
      uPad: { value: 2.5 },
      uColor: { value: new Color("#FBE6BE") },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_vertex>
      varying vec2 vP;
      void main() {
        vP = position.xy; // a PlaneGeometry laid flat: local xy = footprint xz
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform float uAlpha;
      uniform vec2 uHalf;
      uniform float uPad;
      uniform vec3 uColor;
      varying vec2 vP;
      void main() {
        #include <clipping_planes_fragment>
        vec2 q = abs(vP) - uHalf;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        if (d < 0.0) discard;
        float k = exp(-d * d / (uPad * uPad * 0.25)) * (1.0 - smoothstep(uPad * 0.8, uPad, d));
        float a = k * uAlpha;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}
