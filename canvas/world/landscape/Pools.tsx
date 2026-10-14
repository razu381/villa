"use client";

/**
 * Pools — the communal pool and the villa pools as limestone basins recessed
 * into the deck. One flat quad per pool; the basin is ray-traced in the
 * fragment shader (interior mapping), so it has true depth, perspective and
 * sun shadow inside the walls at the cost of two triangles.
 *
 * - Basin depth grows with the model rising (U.uRise); white until the sweep.
 * - Water fills with U.uLife: an empty basin becomes satin water — fresnel to
 *   the sky, a soft sun glint, refraction, aqua absorption and caustics.
 * - At night the pools glow softly from underwater lights (emissive > 1).
 * - Clipped by the section plane.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { VL_GLSL, sharedUniformsFor } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U, clipPlanes } from "@/lib/uniforms";
import { dayParams } from "../../Driver";
import { lin } from "../terrain/siteGlsl";
import { POOLS } from "./layout";

function buildPoolGeometry() {
  const pos: number[] = [];
  const pool: number[] = [];
  const pool2: number[] = [];
  const idx: number[] = [];
  POOLS.forEach((p, i) => {
    const y = p.y + 0.03;
    const corners = [
      [p.x - p.hx, p.z - p.hz],
      [p.x + p.hx, p.z - p.hz],
      [p.x + p.hx, p.z + p.hz],
      [p.x - p.hx, p.z + p.hz],
    ];
    for (const [x, z] of corners) {
      pos.push(x, y, z);
      pool.push(p.x, p.z, p.hx, p.hz);
      pool2.push(p.y, p.depth);
    }
    const o = i * 4;
    idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aPool", new BufferAttribute(new Float32Array(pool), 4));
  g.setAttribute("aPool2", new BufferAttribute(new Float32Array(pool2), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <clipping_planes_pars_vertex>
attribute vec4 aPool;
attribute vec2 aPool2;
varying vec3 vWp;
varying vec4 vPool;
varying vec2 vPool2;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vPool = aPool;
  vPool2 = aPool2;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>
${VL_GLSL}
uniform float uRise;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uSunI;
uniform float uHemiI;
uniform vec3 uHemiSky;
uniform vec3 uHemiGround;
uniform vec3 uModel;
varying vec3 vWp;
varying vec4 vPool;
varying vec2 vPool2;

#define C_TILE ${lin("#D8D6C8")}
#define C_TILE_DEEP ${lin("#C9CCC0")}
#define C_WATER ${lin("#79A8A6")}
#define C_GLOW ${lin("#86C9C6")}

float pl_box(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }

/** Ray from inside the basin opening; returns the hit distance and face normal. */
float pl_trace(vec3 o, vec3 d, vec2 c, vec2 h, float yB, out vec3 n) {
  float tF = d.y < -1e-5 ? (yB - o.y) / d.y : 1e9;
  float sx = d.x > 0.0 ? c.x + h.x : c.x - h.x;
  float sz = d.z > 0.0 ? c.y + h.y : c.y - h.y;
  float tX = abs(d.x) > 1e-5 ? (sx - o.x) / d.x : 1e9;
  float tZ = abs(d.z) > 1e-5 ? (sz - o.z) / d.z : 1e9;
  float t = min(tF, min(tX, tZ));
  n = t == tF ? vec3(0.0, 1.0, 0.0) : (t == tX ? vec3(-sign(d.x), 0.0, 0.0) : vec3(0.0, 0.0, -sign(d.z)));
  return max(t, 0.0);
}

vec3 pl_light(vec3 albedo, vec3 n, float shadow) {
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 hemi = mix(uHemiGround, uHemiSky, 0.5 * n.y + 0.5) * uHemiI;
  return albedo * RECIPROCAL_PI * (uSunColor * uSunI * ndl * shadow + hemi);
}

float pl_caustic(vec2 p) {
  float t = uTime * 0.55;
  vec2 q = p * 1.7;
  float v = sin(q.x + t + sin(q.y * 1.3 - t * 0.7));
  v += sin(q.y * 1.1 - t * 0.8 + sin(q.x * 1.7 + t * 0.5));
  v += sin((q.x + q.y) * 0.8 + t * 1.1);
  v = 1.0 - abs(v) / 3.0;
  return pow(v, 7.0);
}

// Lit basin surface at P (normal n); under = 1 when under water.
vec3 pl_basin(vec3 P, vec3 n, vec2 c, vec2 h, float y0, float D, float under) {
  // sun shadow from the basin rim
  float sh = 0.0;
  if (uSunDir.y > 0.01) {
    float s = (y0 - P.y) / uSunDir.y;
    vec3 Q = P + uSunDir * s;
    sh = 1.0 - smoothstep(-0.06, 0.06, pl_box(Q.xz, c, h - 0.01));
  }
  if (n.y < 0.5) sh *= step(0.0, dot(n, uSunDir));
  // tile grid
  vec2 tuv = n.y > 0.5 ? P.xz : (abs(n.x) > 0.5 ? vec2(P.z, P.y) : vec2(P.x, P.y));
  vec2 g = abs(fract(tuv / 0.5) - 0.5);
  float joint = smoothstep(0.47, 0.49, max(g.x, g.y));
  float depthK = clamp((y0 - P.y) / max(D, 0.01), 0.0, 1.0);
  vec3 alb = mix(C_TILE, C_TILE_DEEP, depthK * 0.6) * (1.0 - joint * 0.08);
  alb = mix(uModel, alb, vl_sweepMask(P));
  vec3 col = pl_light(alb, n, sh);
  // soft ambient occlusion in the basin corners and towards the floor
  vec2 e = h - abs(P.xz - c);
  float corner = smoothstep(0.0, 0.6, min(e.x, e.y));
  float deepK = smoothstep(0.15, 1.0, D);
  col *= mix(1.0, mix(0.72, 1.0, corner), deepK) * mix(1.0, 0.82, depthK * deepK);
  if (n.y > 0.5) col += uSunColor * uSunI * 0.16 * pl_caustic(P.xz) * sh * under * RECIPROCAL_PI;
  return col;
}

void main() {
  #include <clipping_planes_fragment>
  if (uRise < 0.1) discard; // nothing is dug before the model rises
  vec2 c = vPool.xy;
  vec2 h = vPool.zw;
  float y0 = vPool2.x;
  float D = max(vPool2.y * smoothstep(0.1, 0.8, uRise), 0.02);
  float fill = smoothstep(0.0, 1.0, uLife);
  float yW = y0 - 0.12 - (1.0 - fill) * (D - 0.12);

  vec3 V = normalize(vWp - cameraPosition);
  vec3 o = vec3(vWp.x, y0, vWp.z);
  vec3 nI;
  float tI = pl_trace(o, V, c, h, y0 - D, nI);
  float tW = V.y < -1e-4 ? (yW - y0) / V.y : 1e9;
  vec3 col;
  if (fill > 0.02 && tW < tI) {
    vec3 W = o + V * tW;
    float t = uTime;
    vec2 g = vec2(
      sin(W.x * 1.9 + t * 0.8) * 0.6 + sin(W.z * 3.1 - t * 1.1 + W.x) * 0.4,
      sin(W.z * 2.3 - t * 0.7) * 0.6 + sin(W.x * 2.9 + t * 0.9 - W.z) * 0.4);
    vec3 N = normalize(vec3(g.x * 0.035, 1.0, g.y * 0.035));
    float cosT = clamp(dot(-V, N), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
    vec3 R = reflect(V, N);
    vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.7, R.y));
    float glint = pow(max(dot(R, uSunDir), 0.0), 140.0) * uSunI * 1.4 * smoothstep(0.0, 0.08, uSunDir.y);
    vec3 T = refract(V, N, 0.75);
    vec3 nB;
    float tB = pl_trace(W, T, c, h, y0 - D, nB);
    vec3 B = W + T * tB;
    vec3 basin = pl_basin(B, nB, c, h, y0, D, 1.0);
    vec3 absorb = exp(-tB * vec3(0.62, 0.2, 0.16));
    vec3 body = pl_light(C_WATER, vec3(0.0, 1.0, 0.0), 1.0) * 0.55;
    vec3 refr = basin * absorb + body * (1.0 - absorb);
    // underwater lights at night
    // underwater lights at night: lamps along the long walls, light falling off with depth
    vec2 e = h - abs(B.xz - c);
    float wallNear = 1.0 - smoothstep(0.0, 1.4, min(e.x, e.y));
    float lamps = 0.55 + 0.45 * pow(abs(sin((B.x + B.z) * 1.1)), 3.0);
    float deep = clamp((y0 - B.y) / max(D, 0.01), 0.0, 1.0);
    refr = mix(refr, refr * 0.35, uNight);
    refr += C_GLOW * uNight * fill * (0.22 + 0.95 * wallNear * lamps) * mix(1.0, 0.6, deep) * exp(-tB * 0.25);
    col = mix(refr, sky * mix(1.0, 0.35, uNight), F * mix(1.0, 0.5, uNight)) + uSunColor * glint;
    // the waterline: a thin wet darkening on the walls just above
  } else {
    vec3 P = o + V * tI;
    col = pl_basin(P, nI, c, h, y0, D, 0.0);
    // waterline stain where water will be / was
    col *= 1.0 - 0.12 * fill * (1.0 - smoothstep(0.0, 0.05, abs(P.y - yW)));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function Pools() {
  const geo = useMemo(() => buildPoolGeometry(), []);
  const mat = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
      clipping: true,
      uniforms: {
        ...UniformsUtils.clone(UniformsLib.fog),
        ...sharedUniformsFor(["uTime", "uMaterial", "uLife", "uNight", "uWindows", "uSweepFrom", "uSweepTo", "uRise", "uSunDir", "uSunColor", "uSkyTop", "uSkyHorizon"]),
        uSunI: { value: 1 },
        uHemiI: { value: 1 },
        uHemiSky: { value: new Color() },
        uHemiGround: { value: new Color() },
        uModel: { value: new Color(PALETTE.modelWhite) },
      },
    });
    m.clippingPlanes = clipPlanes;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -2;
    return m;
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(() => {
    const p = dayParams;
    mat.uniforms.uSunI.value = Math.max(0, p.sunIntensity) * (p.sunDir.y > -0.02 ? 1 : 0);
    mat.uniforms.uHemiI.value = p.hemiIntensity;
    (mat.uniforms.uHemiSky.value as Color).copy(p.hemiSky);
    (mat.uniforms.uHemiGround.value as Color).copy(p.hemiGround);
  });
  return <mesh geometry={geo} material={mat} receiveShadow={false} renderOrder={1} />;
}
