"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { FrameGate, Quality, baseDpr, pinnedQuality, qualitySteps } from "./Quality";

declare global {
  interface Window {
    __VL_READY?: boolean;
    /** Renderer stats for scripts/shot.mjs --info (draw calls, triangles, programs). */
    __VL_STATS?: () => { calls: number; triangles: number; programs: number; geometries: number; textures: number };
    /** The adaptive quality rung in use (canvas/Quality.tsx), for scripts/perf.mjs. */
    __VL_QUALITY?: { level: number; dpr: number; tilt: boolean; shadow: number };
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
      const s = useJourney.getState();
      s.setReady(true);
      if (s.canvas === "lost") s.setCanvas("live"); // warmed up again after a lost context
      window.__VL_READY = true;
    }
  });
  return null;
}

/**
 * A dropped WebGL context (GPU reset, driver update, memory pressure, a
 * backgrounded tab): three keeps the canvas restorable and rebuilds its GL state
 * on restore; meanwhile the aerial still stands in (HeroMedia, ready = false).
 * Restored: warm up again (shaders, buffers), then dissolve back in. Not back
 * within 3 s: the still stays for the rest of the session and the loop stops.
 */
function watchContext(canvas: HTMLCanvasElement, rewarm: () => void) {
  let timer = 0;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    const s = useJourney.getState();
    if (s.canvas === "gone") return;
    window.__VL_READY = false;
    s.setReady(false);
    s.setCanvas("lost");
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const st = useJourney.getState();
      if (st.canvas === "lost" && !st.ready) st.setCanvas("gone");
    }, 3000);
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (useJourney.getState().canvas === "gone") return;
    clearTimeout(timer);
    rewarm();
  });
}

/** The single persistent 3D canvas — fixed behind the HTML journey. */
export default function Experience() {
  const tier = useJourney((s) => s.tier);
  const [base, setBase] = useState(baseDpr);
  useEffect(() => {
    // Window resizes, browser zoom and moves to another display all fire resize.
    const onResize = () => setBase(baseDpr());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const steps = useMemo(() => qualitySteps(tier, base), [tier, base]);
  const [level, setLevel] = useState(() => pinnedQuality() ?? 0);
  const [warm, setWarm] = useState(0);
  const at = Math.min(level, steps.length - 1);
  const step = steps[at];
  useEffect(() => {
    window.__VL_QUALITY = { level: at, ...step };
  }, [at, step]);
  return (
    <Canvas
      shadows={tier !== "low" ? "percentage" : false}
      dpr={step.dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: false }}
      camera={{ fov: 30, near: 1, far: 6000, position: [70, 190, 180] }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        // In production, don't read back every shader's log: the read blocks until the
        // driver has compiled it, which defeats the parallel compile the warm-up relies on.
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
        watchContext(gl.domElement, () => setWarm((w) => w + 1));
      }}
      aria-hidden="true"
    >
      <Driver />
      <FrameGate />
      <Quality steps={steps.length} level={at} setLevel={setLevel} />
      <CameraRig />
      <Day shadowSize={step.shadow} />
      <Suspense fallback={null}>
        <Terrain />
        <Landscape />
        <Houses />
        <Section />
        <Homes />
        <Warmup key={warm} />
      </Suspense>
      <Post tilt={step.tilt} />
    </Canvas>
  );
}
