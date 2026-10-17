import { Color, Plane, Vector3 } from "three";
import { SWEEP_FROM, SWEEP_TO } from "./village";

/**
 * Shared uniforms — one object, referenced by every custom shader.
 * canvas/Driver.tsx writes them once per frame; materials read them by
 * reference (pass `U.uMaterial` itself into shader.uniforms, never a copy).
 */
export const U = {
  uTime: { value: 0 },
  /** Build stages, 0 → 1 (see lib/timeline.ts `Stages`). */
  uContours: { value: 0 },
  /** Podium outline drawn, then the podium rises (see build.ts). */
  uPlan: { value: 0 },
  uLines: { value: 0 },
  uRise: { value: 0 },
  uFoam: { value: 0 },
  uMaterial: { value: 0 },
  uLife: { value: 0 },
  uSection: { value: 0 },
  /** World z of the section plane (everything with z > uSectionZ is cut away). */
  uSectionZ: { value: 1e4 },
  uCars: { value: 0 },
  uWindows: { value: 0 },
  uPathLights: { value: 0 },
  uStars: { value: 0 },
  /** Clearing the plot around an open home, 0 → 1 (lib/plot.ts): V3, V4. */
  uIsoV3: { value: 0 },
  uIsoV4: { value: 0 },
  /** Effective day progress (journey or held sun) and derived night amount. */
  uDay: { value: 0 },
  uNight: { value: 0 },
  uSunDir: { value: new Vector3(1, 0.2, 0) },
  uSunColor: { value: new Color("#ffffff") },
  uSkyTop: { value: new Color("#dddddd") },
  uSkyHorizon: { value: new Color("#eeeeee") },
  uFogColor: { value: new Color("#eeeeee") },
  /** Material sweep axis (east → west). */
  uSweepFrom: { value: new Vector3(...SWEEP_FROM) },
  uSweepTo: { value: new Vector3(...SWEEP_TO) },
};

export type SharedUniforms = typeof U;

/**
 * Section cut. Three.js clips fragments whose signed distance is negative:
 * with normal (0,0,-1) and constant c, everything with z > c is removed.
 * Driver sets c = SECTION_Z when open, far away when closed.
 * Add `clippingPlanes: clipPlanes` to every material that should be cut
 * (patchVillageMaterial does this for you).
 */
export const sectionPlane = new Plane(new Vector3(0, 0, -1), 1e4);
export const clipPlanes = [sectionPlane];
