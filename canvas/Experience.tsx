"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { HalfFloatType, WebGLRenderTarget, type Light, type Line, type Mesh, type Object3D, type Points, type Sprite } from "three";
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
    /** Renderer stats for scripts/shot.mjs --info (draw calls, triangles, programs). */
    __VL_STATS?: () => { calls: number; triangles: number; programs: number; geometries: number; textures: number };
  }
}

/**
 * Compiles every shader and uploads every buffer up front, then flags readiness
 * (HeroMedia holds the film still until then; scripts/shot.mjs waits for it).
 * Every stage starts hidden, so without this each compiles on the frame it first
 * appears: a half-second freeze as the houses rise, another on the first Explore.
 * 1. compileAsync with a target like the composer's input bound, so the programs
 *    match the RenderPass (linear, not tone-mapped); off the main thread where
 *    KHR_parallel_shader_compile exists (ANGLE/D3D11 has it).
 * 2. Each object rendered once on its own, visible and unculled, into a 1×1
 *    half-float target (tier low, no composer: a 1-px scissor on the canvas): the
 *    shadow pass compiles its depth programs, the geometries and textures upload.
 *    Those compile on the main thread, so they're spread over frames (~8 ms a frame).
 */
function Warmup() {
  const frames = useRef(0);
  const phase = useRef<"wait" | "compile" | "upload" | "done">("wait");
  const target = useRef<WebGLRenderTarget | null>(null);
  const queue = useRef<Object3D[]>([]);
  const scene = useThree((s) => s.scene);
  useEffect(
    () => () => {
      if (phase.current !== "done") scene.visible = true;
      phase.current = "done";
      target.current?.dispose();
    },
    [scene],
  );
  useFrame(({ gl, camera }) => {
    frames.current++;
    if (frames.current === 1) {
      gl.info.autoReset = false; // reset once per frame in Driver → stats cover the whole frame
      window.__VL_STATS = () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        programs: gl.info.programs?.length ?? 0,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      });
    }
    // Wait two frames: tier, lights, fog and the composer have settled.
    if (phase.current === "wait" && frames.current === 3) {
      phase.current = "compile";
      const rt = useJourney.getState().tier === "low" ? null : new WebGLRenderTarget(1, 1, { type: HalfFloatType });
      target.current = rt;
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      const compiled = gl.compileAsync(scene, camera);
      gl.setRenderTarget(prev);
      // The film covers the canvas until ready: draw nothing meanwhile, so these
      // frames stay light (after compile, which gathers the lights it can see).
      scene.visible = false;
      compiled.then(() => {
        if (phase.current !== "compile") return;
        scene.traverse((o) => {
          if ((o as Mesh).isMesh || (o as Points).isPoints || (o as Line).isLine || (o as Sprite).isSprite) queue.current.push(o);
        });
        phase.current = "upload";
      });
    } else if (phase.current === "upload") {
      const saved: [Object3D, boolean, boolean][] = [];
      scene.traverse((o) => {
        saved.push([o, o.visible, o.frustumCulled]);
        if (!(o as Light).isLight) o.visible = false;
      });
      scene.visible = true;
      const rt = target.current;
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      if (!rt) {
        gl.setScissor(0, 0, 1, 1);
        gl.setScissorTest(true);
      }
      // An empty render first: three's shadow pass keys its depth programs on the
      // lights of the previous render of this scene, and that one drew nothing.
      gl.render(scene, camera);
      const t0 = performance.now();
      while (queue.current.length > 0 && performance.now() - t0 < 8) {
        const o = queue.current.pop()!;
        o.frustumCulled = false;
        for (let p: Object3D | null = o; p; p = p.parent) p.visible = true;
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, camera);
        o.visible = false;
      }
      if (!rt) gl.setScissorTest(false);
      gl.setRenderTarget(prev);
      for (const [o, v, f] of saved) {
        o.visible = v;
        o.frustumCulled = f;
      }
      if (queue.current.length === 0) {
        phase.current = "done";
        scene.visible = true;
        rt?.dispose();
        target.current = null;
        frames.current = 1e3; // count on from here
      }
    } else if (phase.current === "done" && frames.current === 1e3 + 4) {
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
        <Warmup />
      </Suspense>
      <Post />
    </Canvas>
  );
}
