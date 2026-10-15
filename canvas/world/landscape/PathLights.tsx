"use client";

/**
 * Night path lights: slim bronze bollards along the lanes, set out with the
 * planting (U.uLife). After dusk (U.uPathLights, or the held sun past sunset)
 * each one switches on in turn: a warm emissive head, a small tight glow (HDR,
 * bloom carries the spread) and an elliptical pool of light thrown onto the
 * paving. No real lights — three instanced draws.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  type Group,
  UniformsLib,
  UniformsUtils,
} from "three";
import { patchVillageMaterial, sharedUniformsFor } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U, clipPlanes } from "@/lib/uniforms";
import { lin } from "../terrain/siteGlsl";
import { PATH_LIGHTS } from "./layout";
import { extendMaterial, inject } from "./shaderUtils";

const BOLLARD_H = 0.85;

/** GLSL: this light's on-amount (staggered by its delay). */
const LIGHT_ON = /* glsl */ `
float pl_on(float delay) {
  float k = max(uPathLights, smoothstep(0.55, 0.92, uNight));
  return smoothstep(delay * 0.55, delay * 0.55 + 0.35, k);
}
`;

function bollards() {
  const geo = new CylinderGeometry(0.075, 0.09, BOLLARD_H, 10, 1);
  geo.translate(0, BOLLARD_H / 2, 0);
  const mesh = new InstancedMesh(geo, undefined, PATH_LIGHTS.length);
  const delays = new Float32Array(PATH_LIGHTS.length);
  const m = new Matrix4();
  PATH_LIGHTS.forEach((l, i) => {
    mesh.setMatrixAt(i, m.makeTranslation(l.x, l.y - 0.05, l.z));
    delays[i] = l.delay;
  });
  geo.setAttribute("aDelay", new InstancedBufferAttribute(delays, 1));
  const mat = patchVillageMaterial(new MeshStandardMaterial({ color: "#57524B", roughness: 0.55, metalness: 0.35 }), { poche: null });
  extendMaterial(mat, "bollard-v1", (shader) => {
    shader.uniforms.uPathLights = U.uPathLights;
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", "attribute float aDelay;\nuniform float uLife;\nvarying float vBlD;\nvarying float vBlY;");
    shader.vertexShader = inject(
      shader.vertexShader,
      "#include <begin_vertex>",
      `vBlD = aDelay;\nvBlY = position.y / ${BOLLARD_H.toFixed(3)};\nfloat blK = clamp((uLife - aDelay * 0.5) / 0.5, 0.0, 1.0);\ntransformed *= 1.0 - pow(1.0 - blK, 3.0);`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `varying float vBlD;\nvarying float vBlY;\nuniform float uPathLights;\n${LIGHT_ON}\nvoid main() {`,
    );
    shader.fragmentShader = inject(
      shader.fragmentShader,
      "#include <emissivemap_fragment>",
      `totalEmissiveRadiance += ${lin(PALETTE.windowGlow)} * 4.0 * pl_on(vBlD) * smoothstep(0.78, 0.84, vBlY) * (1.0 - smoothstep(0.95, 0.99, vBlY));`,
    );
  });
  mesh.material = mat;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

const SPRITE_VERT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
attribute float aDelay;
attribute vec2 aDir;
uniform float uSize;
uniform float uLift;
uniform float uFlat;
varying vec2 vUv;
varying float vDelay;
varying float vFog;
uniform float fogNear;
uniform float fogFar;
void main() {
  vUv = uv;
  vDelay = aDelay;
  vec3 c = instanceMatrix[3].xyz + vec3(0.0, uLift, 0.0);
  vec4 mvPosition;
  if (uFlat > 0.5) {
    // an ellipse along the lane, thrown onto the paving (away from the wall side)
    vec3 d = vec3(aDir.x, 0.0, aDir.y);
    vec3 t = vec3(-aDir.y, 0.0, aDir.x);
    mvPosition = viewMatrix * vec4(c + (t * position.x * 1.3 + d * position.y) * uSize + d * 0.55, 1.0);
  } else {
    mvPosition = viewMatrix * vec4(c, 1.0);
    mvPosition.xy += position.xy * uSize;
  }
  gl_Position = projectionMatrix * mvPosition;
  vFog = smoothstep(fogNear, fogFar, -mvPosition.z);
  #include <clipping_planes_vertex>
}
`;
const SPRITE_FRAG = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform float uPathLights;
uniform float uNight;
uniform float uGain;
uniform float uFlat;
varying vec2 vUv;
varying float vDelay;
varying float vFog;
${LIGHT_ON}
void main() {
  #include <clipping_planes_fragment>
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float on = pl_on(vDelay);
  float a;
  if (uFlat > 0.5) a = pow(max(1.0 - r, 0.0), 2.2);
  else a = exp(-r * r * 30.0) * 1.8 + exp(-r * 6.0) * 0.25;
  a *= smoothstep(1.0, 0.85, r);
  vec3 col = ${lin(PALETTE.windowGlow)} * a * on * uGain * (1.0 - vFog);
  gl_FragColor = vec4(col, 1.0);
}
`;

function sprites(flat: boolean) {
  const geo = new PlaneGeometry(2, 2);
  const mesh = new InstancedMesh(geo, undefined, PATH_LIGHTS.length);
  const delays = new Float32Array(PATH_LIGHTS.length);
  const dirs = new Float32Array(PATH_LIGHTS.length * 2);
  const m = new Matrix4();
  PATH_LIGHTS.forEach((l, i) => {
    mesh.setMatrixAt(i, m.makeTranslation(l.x, l.y, l.z));
    delays[i] = l.delay;
    dirs.set([l.nx, l.nz], i * 2);
  });
  geo.setAttribute("aDelay", new InstancedBufferAttribute(delays, 1));
  geo.setAttribute("aDir", new InstancedBufferAttribute(dirs, 2));
  const mat = new ShaderMaterial({
    vertexShader: SPRITE_VERT,
    fragmentShader: SPRITE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    clipping: true,
    fog: true,
    uniforms: {
      ...UniformsUtils.clone(UniformsLib.fog),
      ...sharedUniformsFor(["uPathLights", "uNight"]),
      uSize: { value: flat ? 2.6 : 0.45 },
      uLift: { value: flat ? 0.06 : BOLLARD_H - 0.08 },
      uFlat: { value: flat ? 1 : 0 },
      uGain: { value: flat ? 0.55 : 3.2 },
    },
  });
  mat.clippingPlanes = clipPlanes;
  mesh.material = mat;
  mesh.frustumCulled = false;
  mesh.renderOrder = flat ? 2 : 3;
  return mesh;
}

export function PathLights() {
  const objs = useMemo(() => ({ bollards: bollards(), glows: sprites(false), pools: sprites(true) }), []);
  useEffect(
    () => () => {
      for (const o of Object.values(objs)) {
        o.geometry.dispose();
        (o.material as ShaderMaterial).dispose();
        o.dispose();
      }
    },
    [objs],
  );
  const group = useRef<Group>(null);
  useFrame(() => {
    const on = U.uLife.value > 0.001;
    if (group.current && group.current.visible !== on) group.current.visible = on;
  });
  return (
    <group ref={group}>
      <primitive object={objs.bollards} />
      <primitive object={objs.pools} />
      <primitive object={objs.glows} />
    </group>
  );
}
