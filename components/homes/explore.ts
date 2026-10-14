"use client";

import { useJourney, type HomeId } from "@/lib/store";

/** Enter the interactive moment: the camera cranes in, the home opens, the day pauses. */
export function enterExplore(id: HomeId) {
  const s = useJourney.getState();
  s.setHome(id);
  s.setExplode(1);
  s.setMode("explore");
}

/** Back to the village: the day resumes from the journey. */
export function exitExplore() {
  const s = useJourney.getState();
  if (s.mode === "journey" && s.home == null && s.sunOverride == null && s.explode === 0) return;
  s.setMode("journey");
  s.setHome(null);
  s.setExplode(0);
  s.setSunOverride(null);
}

export const inHomes = (t: number) => t >= 5 && t < 6;
