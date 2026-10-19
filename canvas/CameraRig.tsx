"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { sampleCamera, type CameraSample } from "@/lib/camera";
import { SPOT_ANCHORS } from "@/lib/anchors";
import { orbit, spotFocus } from "@/lib/orbit";
import { useJourney } from "@/lib/store";
import { FEATURED } from "@/lib/village";
import { HOME_SHOTS, STACK_MID } from "./homes/shots";
import { damp } from "./Driver";

/**
 * Journey camera: samples the authored path at `t`, damps towards it.
 * Explore mode blends to the selected home's close-up shot, which the visitor
 * can turn all round the home (lib/orbit.ts): the whole shot rotates rigidly
 * about the home's centre, so the home keeps its place beside the panel.
 * A photo pin glides the view toward its spot (lib/orbit.ts spotFocus) before
 * its photos open, and back as they close.
 * A still frame holds perfectly still (no breathing drift: without multisampling,
 * any sub-pixel drift makes slender edges crawl, 2026-10-17).
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
  const yaw = useRef(orbit.yaw);
  const pitch = useRef(orbit.pitch);
  const pivot = useRef(new Vector3());
  const viewPos = useRef(new Vector3());
  const viewTarget = useRef(new Vector3());
  const glide = useRef(0);
  const glideAt = useRef(new Vector3());
  const first = useRef(true);
  // Debug: ?cam=x,y,z,tx,ty,tz[,fov] pins the camera (close-up inspection).
  const pinned = useRef<number[] | null>(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cam")
      ? new URLSearchParams(window.location.search).get("cam")!.split(",").map(Number)
      : null,
  );

  useFrame((_, dt) => {
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

    // The 360° look: turn the (damped) explore shot about the home's centre.
    if (s.home) {
      const h = FEATURED[s.home];
      tmp.set(h.x, h.y + STACK_MID[s.home], h.z);
      if (snap) pivot.current.copy(tmp);
      else pivot.current.lerp(tmp, 1 - Math.exp(-3.2 * d));
    }
    // Whole turns look the same: keep the yaw within ±π, so it unwinds the short way.
    if (Math.abs(orbit.yaw) > Math.PI) {
      const w = 2 * Math.PI * Math.round(orbit.yaw / (2 * Math.PI));
      orbit.yaw -= w;
      yaw.current -= w;
    }
    if (s.home) {
      // Elevation limits, measured on the home's own close-up shot.
      off.fromArray(HOME_SHOTS[s.home].pos).sub(tmp);
      const el = Math.atan2(off.y, Math.hypot(off.x, off.z));
      orbit.pitch = Math.min(ORBIT_MAX_EL - el, Math.max(ORBIT_MIN_EL - el, orbit.pitch));
    }
    const lo = s.reducedMotion ? 14 : 8;
    yaw.current = snap ? orbit.yaw : damp(yaw.current, orbit.yaw, lo, d);
    pitch.current = snap ? orbit.pitch : damp(pitch.current, orbit.pitch, lo, d);
    const ya = yaw.current * explore.current;
    const pa = pitch.current * explore.current;
    viewPos.current.copy(pos.current);
    viewTarget.current.copy(target.current);
    if (!pinned.current && (Math.abs(ya) > 1e-5 || Math.abs(pa) > 1e-5)) {
      // Pitch about the horizontal axis across the view, then yaw about the vertical.
      axis.set(-off.z, 0, off.x).normalize();
      rot.setFromAxisAngle(axis, pa);
      rot.premultiply(qYaw.setFromAxisAngle(UP, ya));
      viewPos.current.sub(pivot.current).applyQuaternion(rot).add(pivot.current);
      viewTarget.current.sub(pivot.current).applyQuaternion(rot).add(pivot.current);
    }
    const vp = viewPos.current;
    const vt = viewTarget.current;
    // A pin's glide: the view turns to its spot and closes in on it (the way back
    // eases from the last spot).
    const spot = spotFocus.key && s.mode === "explore" ? SPOT_ANCHORS[spotFocus.key] : null;
    if (spot) glideAt.current.set(spot.wx, spot.wy, spot.wz);
    glide.current = snap ? (spot ? 1 : 0) : damp(glide.current, spot ? 1 : 0, GLIDE_RATE, d);
    if (glide.current > 1e-4 && !pinned.current) {
      vt.lerp(glideAt.current, glide.current);
      vp.lerp(glideAt.current, GLIDE_IN * glide.current);
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
    camera.position.copy(vt).add(tmp.copy(vp).sub(vt).multiplyScalar(distScale));
    // The view this frame — what the shadow frustum is fitted to (Day.tsx).
    rigView.pos.copy(camera.position);
    rigView.target.copy(vt);
    rigView.fov = fovEff;
    rigView.aspect = camera.aspect;
    rigView.explore = explore.current;
    rigView.lift = liftEff;
    rigView.slide = slideEff;
    rigView.distScale = distScale;
    camera.lookAt(vt);
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
const off = new Vector3();
const axis = new Vector3();
const UP = new Vector3(0, 1, 0);
const rot = new Quaternion();
const qYaw = new Quaternion();
/** A pin's glide: ~90 % there in 0.9 s (components/homes/explore.ts GLIDE_MS), and how far in it closes (of the way to the spot). */
const GLIDE_RATE = 2.6;
const GLIDE_IN = 0.45;
/** The turned explore shot stays between these elevations above the home's centre (rad). */
const ORBIT_MIN_EL = (12 * Math.PI) / 180;
const ORBIT_MAX_EL = (68 * Math.PI) / 180;

/**
 * The rig's view this frame (portrait-adjusted, the 360° turn applied): stable
 * while the journey is still, so consumers fitted to it (the sun's shadow
 * frustum) stay still too.
 */
export const rigView = { pos: new Vector3(70, 190, 180), target: new Vector3(-6, 0, -2), fov: 30, aspect: 1.6, explore: 0, lift: 0, slide: 0, distScale: 1 };
/** Compositions are authored for ~16:10. */
const REF_ASPECT = 1.6;
/** Narrowness (REF_ASPECT / aspect) at which the portrait fit applies fully (≈ 1:2 phones). */
const PORTRAIT_K = 3.2;
