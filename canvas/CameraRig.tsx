"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { sampleCamera, type CameraSample } from "@/lib/camera";
import { useJourney } from "@/lib/store";
import { HOME_SHOTS } from "./homes/shots";
import { damp } from "./Driver";

/**
 * Journey camera: samples the authored path at `t`, damps towards it.
 * Explore mode blends to the selected home's close-up shot.
 * A barely-there breathing drift keeps still frames alive.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const sample = useRef<CameraSample>({ pos: [0, 0, 0], target: [0, 0, 0], fov: 30, zoom: 1, lift: 0, slide: 0 });
  const slide = useRef(0);
  const zoom = useRef(1);
  const lift = useRef(0);
  const pos = useRef(new Vector3(70, 190, 180));
  const target = useRef(new Vector3(-6, 0, -2));
  const fov = useRef(30);
  const explore = useRef(0);
  const goalPos = useRef(new Vector3());
  const goalTarget = useRef(new Vector3());
  const pointer = useThree((s) => s.pointer);
  const first = useRef(true);
  // Debug: ?cam=x,y,z,tx,ty,tz[,fov] pins the camera (close-up inspection).
  const pinned = useRef<number[] | null>(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cam")
      ? new URLSearchParams(window.location.search).get("cam")!.split(",").map(Number)
      : null,
  );

  useFrame((state, dt) => {
    const s = useJourney.getState();
    const d = Math.min(dt, 1 / 20);
    const snap = s.snap || first.current;
    first.current = false;

    sampleCamera(s.t, sample.current);
    goalPos.current.fromArray(sample.current.pos);
    goalTarget.current.fromArray(sample.current.target);
    let goalFov = sample.current.fov;
    let goalZoom = sample.current.zoom;
    let goalLift = sample.current.lift;
    let goalSlide = sample.current.slide;

    const wantExplore = s.mode === "explore" && s.home ? 1 : 0;
    explore.current = snap ? wantExplore : damp(explore.current, wantExplore, 2.4, d);
    if (explore.current > 0.001 && s.home) {
      const shot = HOME_SHOTS[s.home];
      const k = explore.current;
      goalPos.current.lerp(tmp.fromArray(shot.pos), k);
      goalTarget.current.lerp(tmp.fromArray(shot.target), k);
      goalFov = goalFov + (shot.fov - goalFov) * k;
      // The close-ups carry their own portrait framing.
      goalZoom += (1 - goalZoom) * k;
      goalLift -= goalLift * k;
      goalSlide -= goalSlide * k;
      // Gentle pointer parallax while exploring.
      if (!s.reducedMotion) {
        goalPos.current.x += pointer.x * 4 * k;
        goalPos.current.y += pointer.y * 2 * k;
      }
    }

    if (snap) {
      pos.current.copy(goalPos.current);
      target.current.copy(goalTarget.current);
      fov.current = goalFov;
      zoom.current = goalZoom;
      lift.current = goalLift;
      slide.current = goalSlide;
    } else {
      const lambda = s.reducedMotion ? 10 : 3.2;
      pos.current.x = damp(pos.current.x, goalPos.current.x, lambda, d);
      pos.current.y = damp(pos.current.y, goalPos.current.y, lambda, d);
      pos.current.z = damp(pos.current.z, goalPos.current.z, lambda, d);
      target.current.x = damp(target.current.x, goalTarget.current.x, lambda, d);
      target.current.y = damp(target.current.y, goalTarget.current.y, lambda, d);
      target.current.z = damp(target.current.z, goalTarget.current.z, lambda, d);
      fov.current = damp(fov.current, goalFov, lambda, d);
      zoom.current = damp(zoom.current, goalZoom, lambda, d);
      lift.current = damp(lift.current, goalLift, lambda, d);
      slide.current = damp(slide.current, goalSlide, lambda, d);
    }

    if (pinned.current && pinned.current.length >= 6) {
      const c = pinned.current;
      pos.current.set(c[0], c[1], c[2]);
      target.current.set(c[3], c[4], c[5]);
      if (c[6]) fov.current = c[6];
    }
    // Portrait / narrow screens: keep the composition by widening the lens a little
    // and dollying back the rest (preserves the long-lens look, no fish-eye).
    // Phones in portrait (w → 1) also take the key's portrait fit: a little
    // closer than width-preserving, and a lens shift that lifts the subject
    // above the text (verticals stay true — no tilt).
    const k = Math.max(1, REF_ASPECT / Math.max(0.3, camera.aspect));
    const fovEff = Math.min(58, (2 * Math.atan(Math.tan((fov.current * Math.PI) / 360) * Math.pow(k, 0.5)) * 180) / Math.PI);
    const w = Math.min(1, Math.max(0, (k - 1) / (PORTRAIT_K - 1)));
    const distScale = Math.pow(k, 0.5) * (1 + (zoom.current - 1) * w);
    const liftEff = lift.current * w;
    const slideEff = slide.current * w;
    camera.position.copy(target.current).add(tmp.copy(pos.current).sub(target.current).multiplyScalar(distScale));
    // The settled view (no breathing) — what the shadow frustum is fitted to (Day.tsx).
    rigView.pos.copy(camera.position);
    rigView.target.copy(target.current);
    rigView.fov = fovEff;
    rigView.aspect = camera.aspect;
    rigView.explore = explore.current;
    rigView.lift = liftEff;
    rigView.slide = slideEff;
    rigView.distScale = distScale;
    // Breathing: a tiny slow orbit so a still frame never feels frozen.
    if (!s.reducedMotion && !s.snap && !pinned.current) {
      const e = state.clock.elapsedTime;
      camera.position.x += Math.sin(e * 0.11) * 0.8;
      camera.position.y += Math.sin(e * 0.07 + 1.3) * 0.4;
    }
    camera.lookAt(target.current);
    camera.fov = fovEff;
    camera.updateProjectionMatrix();
    if (liftEff !== 0 || slideEff !== 0) {
      // Off-axis projection: the optical axis lands at ndc (slideEff, liftEff).
      camera.projectionMatrix.elements[8] = -slideEff;
      camera.projectionMatrix.elements[9] = -liftEff;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
  }, -50);
  return null;
}

const tmp = new Vector3();

/**
 * The rig's settled view this frame (portrait-adjusted, without the breathing
 * drift): stable while the journey is still, so consumers fitted to it (the
 * sun's shadow frustum) stay still too.
 */
export const rigView = { pos: new Vector3(70, 190, 180), target: new Vector3(-6, 0, -2), fov: 30, aspect: 1.6, explore: 0, lift: 0, slide: 0, distScale: 1 };
/** Compositions are authored for ~16:10. */
const REF_ASPECT = 1.6;
/** Narrowness (REF_ASPECT / aspect) at which the portrait fit applies fully (≈ 1:2 phones). */
const PORTRAIT_K = 3.2;
