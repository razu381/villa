"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Box3, Vector3 } from "three";
import { useJourney, type HomeId } from "@/lib/store";
import { dayFromT } from "@/lib/timeline";

declare global {
  interface Window {
    /** `?probe=1` only: hooks for scripts/flicker.mjs. */
    __VL_PROBE?: {
      /** Frames rendered so far (wait for new ones before a screenshot). */
      frames: () => number;
      /** Jump the journey to t (use with ?snap=1: no easing, the frame is exact). */
      setT: (t: number) => void;
      /** The home's on-screen box (CSS px), from its whole model. */
      homeRect: (id: HomeId) => { x: number; y: number; w: number; h: number } | null;
    };
  }
}

const box = new Box3();
const corner = new Vector3();

/** Debug hooks for the flicker probe (`?probe=1`). Renders nothing. */
export function Probe() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const frames = useRef(0);
  useFrame(() => {
    frames.current++;
  });
  useEffect(() => {
    window.__VL_PROBE = {
      frames: () => frames.current,
      setT: (t) => {
        const s = useJourney.getState();
        s.setT(t);
        s.setJourneyDay(dayFromT(t));
      },
      homeRect: (id) => {
        const root = scene.getObjectByName(`home-${id}`);
        if (!root) return null;
        box.setFromObject(root);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < 8; i++) {
          corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
          const x = (corner.x * 0.5 + 0.5) * size.width;
          const y = (0.5 - corner.y * 0.5) * size.height;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      },
    };
    return () => {
      delete window.__VL_PROBE;
    };
  }, [camera, scene, size]);
  return null;
}
