"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Color, Fog, ShaderMaterial, type DirectionalLight, type HemisphereLight } from "three";
import { useJourney } from "@/lib/store";
import { U } from "@/lib/uniforms";
import { dayParams } from "./Driver";

const SHADOW_EXTENT = 135;

/**
 * Sun, moon, sky and fog — all from the shared day parameters.
 * The sky is a gradient dome; fog matches the horizon so the model floats in its own air.
 */
export function Day() {
  const sun = useRef<DirectionalLight>(null);
  const moon = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const tier = useJourney((s) => s.tier);

  const fog = useMemo(() => new Fog(new Color("#E6DED3"), 260, 1100), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  const skyMat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uSkyTop: U.uSkyTop, uSkyHorizon: U.uSkyHorizon, uStars: U.uStars, uNight: U.uNight, uTime: U.uTime },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSkyTop;
          uniform vec3 uSkyHorizon;
          uniform float uStars;
          uniform float uNight;
          uniform float uTime;
          varying vec3 vDir;
          float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
          void main() {
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 col = mix(uSkyHorizon, uSkyTop, smoothstep(-0.02, 0.55, h));
            // Stars: sparse, twinkling, only above the horizon at night.
            vec3 cell = floor(vDir * 420.0);
            float s = step(0.9965, hash(cell));
            float tw = 0.6 + 0.4 * sin(uTime * 1.3 + hash(cell + 3.0) * 40.0);
            col += vec3(1.0, 0.96, 0.9) * s * tw * uStars * uNight * smoothstep(0.05, 0.35, h);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );

  useFrame(() => {
    const p = dayParams;
    if (sun.current) {
      sun.current.position.copy(p.sunDir).multiplyScalar(300);
      sun.current.color.copy(p.sunColor);
      sun.current.intensity = Math.max(0, p.sunIntensity) * (p.sunDir.y > -0.02 ? 1 : 0);
    }
    if (moon.current) {
      moon.current.position.copy(p.moonDir).multiplyScalar(300);
      moon.current.intensity = p.moonIntensity;
    }
    if (hemi.current) {
      hemi.current.color.copy(p.hemiSky);
      hemi.current.groundColor.copy(p.hemiGround);
      hemi.current.intensity = p.hemiIntensity;
    }
    fog.color.copy(p.fog);
  });

  const mapSize = tier === "high" ? 4096 : tier === "mid" ? 2048 : 1024;

  return (
    <>
      <mesh scale={2600} material={skyMat} renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[1, 48, 24]} />
      </mesh>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow={tier !== "low"}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={10}
        shadow-camera-far={700}
      />
      <directionalLight ref={moon} color="#A9BCFF" intensity={0} />
    </>
  );
}
