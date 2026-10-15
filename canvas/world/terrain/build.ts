/**
 * The podium's own build stage. The story (PLAN §3①) opens on a blank,
 * contoured hill; the outline of the stronghold is drawn on it (uPlan), then
 * the terraces, bastion, terrace walls and stairs rise out of the hill as one
 * white solid — finished before the houses' line drawing starts (uLines) and
 * long before the first house rises (uRise).
 *
 *   uPodRise 0 → 1   t ≈ 1.44 → 1.74 (plan 0.45 → 1), held at 1 once the house lines start
 *
 * Terrain.tsx writes it every frame; the plinth, the walls (and their shadow
 * depth material) and the portal recess read it by reference.
 */
import { U } from "@/lib/uniforms";
import { smooth } from "@/lib/timeline";

export const uPodRise = { value: 0 };

export function podiumRise(plan: number, lines: number) {
  return Math.max(smooth(0.45, 1.0, plan), smooth(0.0, 0.04, lines));
}

/** Called once per frame (after the Driver has written the stage uniforms). */
export function updatePodiumRise() {
  uPodRise.value = podiumRise(U.uPlan.value, U.uLines.value);
  return uPodRise.value;
}

/** GLSL: lerp a vertex height from the pre-build ground (base) to its final height. */
export const POD_RISE_GLSL = /* glsl */ `
uniform float uPodRise;
float vl_podY(float base, float y) { return base + (y - base) * uPodRise; }
`;
