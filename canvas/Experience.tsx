"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import { useJourney } from "@/lib/store";
import { CameraRig } from "./CameraRig";
import { Day } from "./Day";
import { Driver } from "./Driver";
import { Post } from "./Post";
import { Terrain } from "./world/Terrain";
import { Landscape } from "./world/Landscape";
import { Houses } from "./world/Houses";
import { Section } from "./section/Section";
import { Homes } from "./homes/Homes";

declare global {
  interface Window {
    __VL_READY?: boolean;
  }
}

/** Flags readiness after the first few rendered frames (used by scripts/shot.mjs). */
function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current++;
    if (frames.current === 6) {
      useJourney.getState().setReady(true);
      window.__VL_READY = true;
    }
  });
  return null;
}

/** The single persistent 3D canvas — fixed behind the HTML journey. */
export default function Experience() {
  const tier = useJourney((s) => s.tier);
  const dpr: [number, number] = tier === "high" ? [1, 2] : tier === "mid" ? [1, 1.5] : [1, 1];
  return (
    <Canvas
      shadows={tier !== "low" ? "percentage" : false}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: false }}
      camera={{ fov: 30, near: 1, far: 6000, position: [70, 190, 180] }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
      aria-hidden="true"
    >
      <Driver />
      <CameraRig />
      <Day />
      <Suspense fallback={null}>
        <Terrain />
        <Landscape />
        <Houses />
        <Section />
        <Homes />
        <ReadySignal />
      </Suspense>
      <Post />
    </Canvas>
  );
}
