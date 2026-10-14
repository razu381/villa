import type { Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from "three";

type Shader = WebGLProgramParametersWithUniforms;

/**
 * Chain an extra onBeforeCompile step after an existing one (e.g. after
 * patchVillageMaterial) and extend the program cache key so variants never
 * share a program by accident.
 */
export function extendMaterial<T extends Material>(mat: T, key: string, fn: (shader: Shader) => void): T {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader: Shader, renderer: WebGLRenderer) => {
    prev.call(mat, shader, renderer);
    fn(shader);
  };
  mat.customProgramCacheKey = () => `${prevKey()}|${key}`;
  mat.needsUpdate = true;
  return mat;
}

/** Replace a chunk include, asserting it exists (fails loudly in dev if three changes). */
export function inject(src: string, anchor: string, code: string, where: "before" | "after" | "replace" = "after") {
  if (!src.includes(anchor)) {
    console.warn(`[landscape] shader anchor not found: ${anchor}`);
    return src;
  }
  if (where === "replace") return src.replace(anchor, code);
  return src.replace(anchor, where === "after" ? `${anchor}\n${code}` : `${code}\n${anchor}`);
}

/** GLSL float literal. */
export const f = (n: number) => {
  const s = String(Math.round(n * 1e5) / 1e5);
  return s.includes(".") || s.includes("e") ? s : `${s}.0`;
};

/** Hermite ease used across the landscape (calm, no overshoot). */
export const GLSL_EASE = /* glsl */ `
float ls_easeOut(float k) { k = clamp(k, 0.0, 1.0); return 1.0 - pow(1.0 - k, 3.0); }
float ls_smooth(float a, float b, float x) { return smoothstep(a, b, x); }
`;
