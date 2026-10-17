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

/**
 * Wind amount for the trees' and planting's sway / flutter. 0: they stand still
 * (2026-10-17, user's call: the moving crowns read as flicker). 1 brings the wind back.
 */
export const uWind = { value: 0 };

/** GLSL float literal. */
export const f = (n: number) => {
  const s = String(Math.round(n * 1e5) / 1e5);
  return s.includes(".") || s.includes("e") ? s : `${s}.0`;
};
