"use client";

/**
 * While a home is open, the rest of the village recedes into the air.
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
import { useJourney } from "@/lib/store";
import { U } from "@/lib/uniforms";
import { FEATURED } from "@/lib/village";
import { damp } from "../Driver";
import { rigView } from "../CameraRig";

/** Opaque-pass order of the veil; the selected home draws after it. */
export const VEIL_ORDER = 50;
export const HOME_ORDER = 51;

/** Vertical centre of each exploded stack above its pad (m). */
const STACK_MID = { v3: 9.5, v4: 9.0 } as const;
/** Distance of the quad in front of the camera (m) — in front of everything. */
const NEAR = 2;

const v = new Vector3();

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
          uTint: { value: new Color("#F3ECE0") },
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
          uniform vec3 uTint;
          varying vec4 vClip;
          void main() {
            vec2 uv = vClip.xy / vClip.w * 0.5 + 0.5;
            vec2 d = (uv - uCenter) * vec2(uAspect, 1.0);
            float r = length(d);
            // Thin around the home (its garden keeps a little air), fuller at the edges.
            float k = mix(0.07, 0.2, smoothstep(0.15, 0.8, r));
            vec3 col = mix(mix(uFog, uSky, 0.35), uTint, 0.12 * (1.0 - uNight));
            gl_FragColor = vec4(col, uAmount * k * mix(1.0, 1.15, uNight));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );

  useFrame((_, dtRaw) => {
    const s = useJourney.getState();
    const dt = Math.min(dtRaw, 1 / 20);
    const want = s.mode === "explore" && s.home ? 1 : 0;
    amt.current = s.snap ? want : damp(amt.current, want, 2.2, dt);
    const m = ref.current;
    if (!m) return;
    m.visible = amt.current > 0.003;
    mat.uniforms.uAmount.value = amt.current;
    if (!m.visible) return;
    if (s.home) {
      const h = FEATURED[s.home];
      focus.current.set(h.x, h.y + STACK_MID[s.home], h.z);
    }
    // A quad just in front of the camera, facing it, covering the frustum.
    camera.getWorldDirection(v);
    m.position.copy(camera.position).addScaledVector(v, NEAR);
    m.quaternion.copy(camera.quaternion);
    const fov = ((camera as { fov?: number }).fov ?? 30) * (Math.PI / 180);
    // (A portrait lens shift moves the frustum off-axis — cover the far side too.)
    const hgt = 2 * Math.tan(fov / 2) * NEAR * 1.2 * (1 + Math.abs(rigView.lift));
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
