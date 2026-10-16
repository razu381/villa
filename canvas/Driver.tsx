"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { createDayParams, getDayParams } from "@/lib/day";
import { effectiveDay, useJourney } from "@/lib/store";
import { smooth, stagesFromT, type Stages } from "@/lib/timeline";
import { U, sectionPlane } from "@/lib/uniforms";
import { SECTION_Z } from "@/lib/village";

/** Frame-rate independent exponential damping. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

const STAGE_TO_UNIFORM: [keyof Stages, keyof typeof U][] = [
  ["contours", "uContours"],
  ["plan", "uPlan"],
  ["lines", "uLines"],
  ["rise", "uRise"],
  ["foam", "uFoam"],
  ["material", "uMaterial"],
  ["life", "uLife"],
  ["section", "uSection"],
  ["cars", "uCars"],
  ["pathLights", "uPathLights"],
  ["stars", "uStars"],
];

/** Shared day parameters, updated every frame (read-only for consumers). */
export const dayParams = createDayParams();
const stagesScratch = stagesFromT(0);

/**
 * Writes all shared uniforms once per frame from the store:
 * journey t → build stages, effective day → lighting, section plane.
 * Mounted once inside the Canvas, before everything else.
 */
export function Driver() {
  const dayRef = useRef(0);
  useFrame((state, dt) => {
    if (!state.gl.info.autoReset) state.gl.info.reset();
    const s = useJourney.getState();
    const d = Math.min(dt, 1 / 20);
    const snap = s.snap;
    const stages = stagesFromT(s.t, stagesScratch);

    U.uTime.value = state.clock.elapsedTime;
    for (const [stage, uni] of STAGE_TO_UNIFORM) {
      const u = U[uni] as { value: number };
      u.value = snap ? stages[stage] : damp(u.value, stages[stage], 6, d);
    }

    // Day: the held sun wins; otherwise the journey. Damped so dragging feels silky.
    const targetDay = effectiveDay(s);
    dayRef.current = snap ? targetDay : damp(dayRef.current, targetDay, s.sunOverride != null ? 5 : 3, d);
    getDayParams(dayRef.current, dayParams);
    U.uDay.value = dayRef.current;
    U.uNight.value = dayParams.night;
    U.uSunDir.value.copy(dayParams.sunDir);
    U.uSunColor.value.copy(dayParams.sunColor);
    U.uSkyTop.value.copy(dayParams.skyTop);
    U.uSkyHorizon.value.copy(dayParams.skyHorizon);
    U.uFogColor.value.copy(dayParams.fog);

    // Windows: the night chapter, or the held sun going past sunset.
    const windowsTarget = Math.max(stages.windows, smooth(0.8, 0.92, dayRef.current) * (s.t > 2.6 ? 1 : 0));
    U.uWindows.value = snap ? windowsTarget : damp(U.uWindows.value, windowsTarget, 4, d);

    // Section plane: closed = far away, open = at SECTION_Z.
    const open = U.uSection.value;
    sectionPlane.constant = open > 0.001 ? SECTION_Z + (1 - open) * 160 : 1e4;
    U.uSectionZ.value = sectionPlane.constant;
  }, -100);
  return null;
}
