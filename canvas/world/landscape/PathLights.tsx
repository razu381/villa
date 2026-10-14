"use client";

/**
 * Night path lights: slim bronze bollards along the lanes. After dusk
 * (U.uPathLights, or the held sun past sunset) each one switches on in turn:
 * a warm emissive head, a soft glow (HDR, so bloom catches it) and a pool of
 * light on the paving. No real lights — three instanced draws.
 */
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
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
    shader.vertexShader = inject(shader.vertexShader, "#include <common>", "attribute float aDelay;\nvarying float vBlD;\nvarying float vBlY;");
    shader.vertexShader = inject(shader.vertexShader, "#include <begin_vertex>", `vBlD = aDelay;\nvBlY = position.y / ${BOLLARD_H.toFixed(3)};`);
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
    mvPosition = viewMatrix * vec4(c + vec3(position.x, 0.0, -position.y) * uSize, 1.0);
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
  else a = exp(-r * r * 26.0) * 1.6 + exp(-r * 4.2) * 0.5;
  a *= smoothstep(1.0, 0.85, r);
  vec3 col = ${lin(PALETTE.windowGlow)} * a * on * uGain * (1.0 - vFog);
  gl_FragColor = vec4(col, 1.0);
}
`;

function sprites(flat: boolean) {
  const geo = new PlaneGeometry(2, 2);
  const mesh = new InstancedMesh(geo, undefined, PATH_LIGHTS.length);
  const delays = new Float32Array(PATH_LIGHTS.length);
  const m = new Matrix4();
  PATH_LIGHTS.forEach((l, i) => {
    mesh.setMatrixAt(i, m.makeTranslation(l.x, l.y, l.z));
    delays[i] = l.delay;
  });
  geo.setAttribute("aDelay", new InstancedBufferAttribute(delays, 1));
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
      uSize: { value: flat ? 3.2 : 1.1 },
      uLift: { value: flat ? 0.06 : BOLLARD_H - 0.08 },
      uFlat: { value: flat ? 1 : 0 },
      uGain: { value: flat ? 0.55 : 2.6 },
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
  return (
    <group>
      <primitive object={objs.bollards} />
      <primitive object={objs.pools} />
      <primitive object={objs.glows} />
    </group>
  );
}
