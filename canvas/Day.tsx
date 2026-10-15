"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Color, Fog, Matrix4, ShaderMaterial, Vector3, type DirectionalLight, type HemisphereLight } from "three";
import { useJourney } from "@/lib/store";
import { U } from "@/lib/uniforms";
import { dayParams } from "./Driver";
import { rigView } from "./CameraRig";

const FOG_NEAR = 260;
const FOG_FAR = 1100;
/** Half-size of the shadow box when it covers the whole model (m). */
const SHADOW_EXTENT = 135;
/** Tightest half-size (exploded home close-ups) (m). */
const SHADOW_MIN = 16;
/** The model and its table shadow: footprints are clamped to this (m). */
const SHADOW_BOUNDS = { minX: -150, maxX: 150, minZ: -125, maxZ: 125 };
/** Heights the footprint is sampled at: the ground and the top of the houses (m). */
const SHADOW_YS = [-2, 22];

const UP = new Vector3(0, 1, 0);
const ORIGIN = new Vector3();
const basis = new Matrix4();
const ax = new Vector3();
const ay = new Vector3();
const az = new Vector3();
const fwd = new Vector3();
const right = new Vector3();
const up = new Vector3();
const ray = new Vector3();
const pt = new Vector3();
const ctr = new Vector3();

/**
 * Fits the sun's orthographic shadow box to what is on screen: the ground
 * footprint of the settled view (9 rays, at ground and roof height, clamped to
 * the model), seen from the sun. Close-ups get a tight box — crisp shadows
 * without stair-steps — wide views the whole model. The box centre is snapped
 * to the shadow map's texel grid in the sun's frame and it is fitted to the
 * rig's view without the breathing drift, so a still frame's shadows are still.
 */
function fitShadow(light: DirectionalLight, sunDir: Vector3, mapSize: number) {
  const v = rigView;
  fwd.subVectors(v.target, v.pos);
  const dist = fwd.length();
  fwd.divideScalar(Math.max(1e-6, dist));
  right.crossVectors(fwd, UP).normalize();
  up.crossVectors(right, fwd);
  const th = Math.tan((v.fov * Math.PI) / 360) * 1.08;
  const tw = th * v.aspect;
  // Far reach of the view: the fog in the journey; just past the chosen home while exploring.
  const reach = dist * 1.7 + (340 * v.distScale - dist * 1.7) * (1 - v.explore);

  // The sun's frame (rotation only): x/y across the light, z towards the sun.
  basis.lookAt(sunDir, ORIGIN, UP);
  basis.extractBasis(ax, ay, az);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  ctr.set(0, 0, 0);
  let n = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      ray.copy(fwd).addScaledVector(right, i * tw).addScaledVector(up, (j - v.lift) * th).normalize();
      for (const y of SHADOW_YS) {
        let d = ray.y < -1e-4 ? (y - v.pos.y) / ray.y : reach;
        if (!(d > 0)) d = reach;
        d = Math.min(d, reach);
        pt.copy(v.pos).addScaledVector(ray, d);
        pt.x = Math.min(SHADOW_BOUNDS.maxX, Math.max(SHADOW_BOUNDS.minX, pt.x));
        pt.z = Math.min(SHADOW_BOUNDS.maxZ, Math.max(SHADOW_BOUNDS.minZ, pt.z));
        pt.y = y;
        const lx = pt.dot(ax);
        const ly = pt.dot(ay);
        const lz = pt.dot(az);
        if (lx < minX) minX = lx;
        if (lx > maxX) maxX = lx;
        if (ly < minY) minY = ly;
        if (ly > maxY) maxY = ly;
        if (lz < minZ) minZ = lz;
        if (lz > maxZ) maxZ = lz;
        ctr.add(pt);
        n++;
      }
    }
  }
  const pad = 1.1;
  const hx = Math.min(SHADOW_EXTENT, Math.max(SHADOW_MIN, ((maxX - minX) / 2) * pad + 4));
  const hy = Math.min(SHADOW_EXTENT, Math.max(SHADOW_MIN, ((maxY - minY) / 2) * pad + 4));
  // Centre in the sun's frame, snapped to whole texels → a world-fixed texel grid.
  const sx = (2 * hx) / mapSize;
  const sy = (2 * hy) / mapSize;
  const cx = Math.round((minX + maxX) / 2 / sx) * sx;
  const cy = Math.round((minY + maxY) / 2 / sy) * sy;
  const cz = (minZ + maxZ) / 2;
  const target = light.target.position;
  target.set(0, 0, 0).addScaledVector(ax, cx).addScaledVector(ay, cy).addScaledVector(az, cz);
  light.position.copy(target).addScaledVector(sunDir, 300);
  light.target.updateMatrixWorld();
  const cam = light.shadow.camera;
  if (cam.right !== hx || cam.top !== hy) {
    cam.left = -hx;
    cam.right = hx;
    cam.top = hy;
    cam.bottom = -hy;
    cam.updateProjectionMatrix();
  }
}

/**
 * Sun, moon, sky and fog — all from the shared day parameters.
 * The sky is a gradient dome; fog matches the horizon so the model floats in its own air.
 */
export function Day() {
  const sun = useRef<DirectionalLight>(null);
  const moon = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const tier = useJourney((s) => s.tier);

  const fog = useMemo(() => new Fog(new Color("#E6DED3"), FOG_NEAR, FOG_FAR), []);
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
      if (sun.current.castShadow) fitShadow(sun.current, p.sunDir, sun.current.shadow.mapSize.x);
      else sun.current.position.copy(p.sunDir).multiplyScalar(300);
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
    // The air belongs to the model, not the lens: a camera dollied back for a
    // portrait screen sees the same haze.
    fog.near = FOG_NEAR * rigView.distScale;
    fog.far = FOG_FAR * rigView.distScale;
    // Read by the AgX curve (post ToneMapping effect, or the renderer on tier low).
    gl.toneMappingExposure = p.exposure;
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
        shadow-camera-far={620}
      />
      <directionalLight ref={moon} color="#A9BCFF" intensity={0} />
    </>
  );
}
