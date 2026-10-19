"use client";

/**
 * While a home is open, the rest of the village recedes into the air; through
 * "Two ways to live" it does too, around both featured homes, so they read as
 * the chapter's subject. The open village heart is part of the village itself
 * (nothing draws after the veil), so its air is lighter, thinnest over it.
 *
 * A camera-facing quad of the day's fog colour drawn over everything in the
 * opaque pass (renderOrder VEIL_ORDER, no depth test, blended) — and the
 * selected home is drawn right after it (FeaturedHome gives its meshes
 * HOME_ORDER), so the home, and only the home, stays crisp: neighbours at the
 * same depth recede as much as the hill behind. Thinnest around the home on
 * screen, a little denser towards the frame edges, like aerial perspective.
 * (The village's few transparent bits — railing glass, window spill, path
 * lights — draw later and stay as they are: lights through haze.)
 * Calm and cheap: one quad, no post-processing.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, CustomBlending, type Mesh, OneMinusSrcAlphaFactor, ShaderMaterial, SrcAlphaFactor, Vector2, Vector3 } from "three";
import { openPlace, useJourney } from "@/lib/store";
import { stagesFromT } from "@/lib/timeline";
import { U } from "@/lib/uniforms";
import { FEATURED } from "@/lib/village";
import { damp } from "../Driver";
import { rigView } from "../CameraRig";
import { PLACE_CENTRE } from "./shots";

/** Opaque-pass order of the veil; the selected home draws after it. */
export const VEIL_ORDER = 50;
export const HOME_ORDER = 51;

/** Distance of the quad in front of the camera (m) — in front of everything. */
const NEAR = 2;

const v = new Vector3();
const stagesScratch = stagesFromT(0);
/** The veil through "Two ways to live" (1 = as strong as while a home is open). */
const JOURNEY_VEIL = 0.5;
/** The village heart is the village itself (nothing draws after the veil): a lighter air. */
const HEART_VEIL = 0.5;

export function Veil() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const ref = useRef<Mesh>(null);
  const amt = useRef(0);
  const focus = useRef(new Vector3());

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        name: "home-veil",
        // Opaque pass (so the home can follow it there) but blended.
        transparent: false,
        blending: CustomBlending,
        blendSrc: SrcAlphaFactor,
        blendDst: OneMinusSrcAlphaFactor,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uAmount: { value: 0 },
          uFog: U.uFogColor,
          uSky: U.uSkyHorizon,
          uNight: U.uNight,
          uCenter: { value: new Vector2(0.4, 0.5) },
          uAspect: { value: 1.6 },
          uDeep: { value: new Color("#1C1E17") },
        },
        vertexShader: /* glsl */ `
          varying vec4 vClip;
          void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            vClip = gl_Position;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmount;
          uniform vec3 uFog;
          uniform vec3 uSky;
          uniform float uNight;
          uniform vec2 uCenter;
          uniform float uAspect;
          uniform vec3 uDeep;
          varying vec4 vClip;
          void main() {
            vec2 uv = vClip.xy / vClip.w * 0.5 + 0.5;
            vec2 d = (uv - uCenter) * vec2(uAspect, 1.0);
            float r = length(d);
            // Thin around the home (its garden keeps a little air), fuller at the edges.
            float k = mix(0.07, 0.2, smoothstep(0.15, 0.8, r));
            // By day a mid-tone air (the fog, a little deeper), so the frame never goes milky;
            // by night the sky-lit haze.
            vec3 col = mix(mix(uFog, uDeep, 0.18), mix(uFog, uSky, 0.35), uNight);
            gl_FragColor = vec4(col, uAmount * k * mix(1.0, 1.15, uNight));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );

  useFrame((_, dtRaw) => {
    const s = useJourney.getState();
    const dt = Math.min(dtRaw, 1 / 20);
    const place = openPlace(s);
    const want = place ? (place === "heart" ? HEART_VEIL : 1) : s.mode === "journey" ? stagesFromT(s.t, stagesScratch).homes * JOURNEY_VEIL : 0;
    amt.current = s.snap ? want : damp(amt.current, want, 2.2, dt);
    const m = ref.current;
    if (!m) return;
    m.visible = amt.current > 0.003;
    mat.uniforms.uAmount.value = amt.current;
    if (!m.visible) return;
    if (place) {
      focus.current.fromArray(PLACE_CENTRE[place]);
    } else if (!s.home && !s.place) {
      // Between the two homes.
      const a = FEATURED.v3;
      const b = FEATURED.v4;
      focus.current.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 5, (a.z + b.z) / 2);
    }
    // A quad just in front of the camera, facing it, covering the frustum.
    camera.getWorldDirection(v);
    m.position.copy(camera.position).addScaledVector(v, NEAR);
    m.quaternion.copy(camera.quaternion);
    const fov = ((camera as { fov?: number }).fov ?? 30) * (Math.PI / 180);
    // (A portrait lens shift moves the frustum off-axis — cover the far side too.)
    const hgt = 2 * Math.tan(fov / 2) * NEAR * 1.2 * (1 + Math.max(Math.abs(rigView.lift), Math.abs(rigView.slide)));
    m.scale.set(hgt * (size.width / Math.max(1, size.height)), hgt, 1);
    // Clearest around the home on screen.
    v.copy(focus.current).project(camera);
    mat.uniforms.uCenter.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    mat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  });

  return (
    <mesh ref={ref} material={mat} renderOrder={VEIL_ORDER} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
