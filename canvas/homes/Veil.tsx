"use client";

/**
 * While a home is open, the village behind it recedes into the air: a
 * camera-facing plane of the day's fog colour, set just behind the selected
 * home (depth-tested, so only what lies beyond it is veiled), clearest around
 * the home's silhouette and a little denser towards the frame edges.
 * Calm and cheap: one transparent quad, no post-processing.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Mesh, ShaderMaterial, Vector2, Vector3 } from "three";
import { useJourney } from "@/lib/store";
import { U } from "@/lib/uniforms";
import { FEATURED } from "@/lib/village";
import { damp } from "../Driver";

/** Vertical centre of each exploded stack above its pad (m). */
const STACK_MID = { v3: 9.5, v4: 9.0 } as const;
/** How far behind the home's centre the veil sits (m, along the view). */
const BEHIND = 12;

const v = new Vector3();
const dir = new Vector3();

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
        transparent: true,
        depthWrite: false,
        depthTest: true,
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
          varying vec3 vWorld;
          void main() {
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
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
          varying vec3 vWorld;
          // The podium terraces (lib/village TERRACES / steps), for feathering.
          float terraceY(float z) {
            float y = 7.8;
            y += (6.4 - 7.8) * smoothstep(-26.8, -25.6, z);
            y += (5.0 - 6.4) * smoothstep(-7.3, -6.1, z);
            y += (3.6 - 5.0) * smoothstep(13.0, 14.2, z);
            return y;
          }
          void main() {
            vec2 uv = vClip.xy / vClip.w * 0.5 + 0.5;
            vec2 d = (uv - uCenter) * vec2(uAspect, 1.0);
            float r = length(d);
            float k = mix(0.55, 1.0, smoothstep(0.18, 0.75, r));
            // Where the plane meets the ground there is no veil: it thickens with
            // height above the terrace, like aerial perspective (no hard seam).
            float h = vWorld.y - terraceY(vWorld.z);
            k *= smoothstep(0.0, 9.0, h);
            vec3 col = mix(mix(uFog, uSky, 0.35), uTint, 0.18 * (1.0 - uNight));
            gl_FragColor = vec4(col, uAmount * k * mix(0.46, 0.4, uNight));
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
    // Place the plane behind the home, facing the camera, covering the frustum.
    dir.copy(focus.current).sub(camera.position);
    const dist = dir.length() + BEHIND;
    dir.normalize();
    m.position.copy(camera.position).addScaledVector(dir, dist);
    m.quaternion.copy(camera.quaternion);
    const fov = ((camera as { fov?: number }).fov ?? 30) * (Math.PI / 180);
    const hgt = 2 * Math.tan(fov / 2) * dist * 1.6;
    m.scale.set(hgt * (size.width / Math.max(1, size.height)), hgt, 1);
    // Clearest around the home on screen.
    v.copy(focus.current).project(camera);
    mat.uniforms.uCenter.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    mat.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  });

  return (
    <mesh ref={ref} material={mat} renderOrder={5} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
