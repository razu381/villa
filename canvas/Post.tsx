"use client";

import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AgXToneMapping, NoToneMapping, Uniform } from "three";
import { BlendFunction, Effect, KernelSize, TiltShiftEffect, ToneMappingMode, type BloomEffect, type VignetteEffect } from "postprocessing";
import { useJourney } from "@/lib/store";
import { lerp, smooth } from "@/lib/timeline";
import { U } from "@/lib/uniforms";
import { rigView } from "./CameraRig";
import { damp } from "./Driver";

/**
 * Post-processing per device tier. High/mid: SMAA, tilt-shift (high only),
 * bloom (night windows, path lights, the sweep seam — never the daylit stone),
 * AgX filmic tone mapping, a light vignette and a fine film grain that rests in
 * the mid-tones (bright panes and deep night stay clean).
 * Low: no composer — renderer tone mapping only.
 */
export function Post() {
  const tier = useJourney((s) => s.tier);
  const reduced = useJourney((s) => s.reducedMotion);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    gl.toneMapping = tier === "low" ? AgXToneMapping : NoToneMapping;
  }, [gl, tier]);

  const tilt = useMemo(
    () =>
      new TiltShiftEffect({
        blendFunction: BlendFunction.NORMAL,
        focusArea: TILT_FOCUS,
        feather: TILT_FEATHER,
        kernelSize: KernelSize.MEDIUM,
        resolutionScale: 0.5,
      }),
    [],
  );
  const grain = useMemo(() => new GrainEffect(), []);
  useEffect(
    () => () => {
      tilt.dispose();
      grain.dispose();
    },
    [tilt, grain],
  );
  const bloom = useRef<BloomEffect>(null);
  const vignette = useRef<VignetteEffect>(null);
  const tiltK = useRef(0);
  const withTilt = tier === "high" && !reduced;

  useFrame((_, dt) => {
    const s = useJourney.getState();
    const night = U.uNight.value;
    // Bloom: only what is truly bright. Daylit limestone stays below the knee
    // (no milky veil); at night the threshold drops for windows and path lights.
    const b = bloom.current;
    if (b) {
      b.luminanceMaterial.threshold = lerp(1.4, 0.62, night);
      b.luminanceMaterial.smoothing = lerp(0.25, 0.32, night);
      b.intensity = lerp(0.32, 0.85, night);
    }
    const v = vignette.current;
    if (v) v.darkness = lerp(0.18, 0.24, night);
    if (withTilt) {
      const [k, off] = tiltAt(s.t);
      const want = k * (1 - rigView.explore) * TILT_MAX;
      tiltK.current = s.snap ? want : damp(tiltK.current, want, 3, Math.min(dt, 1 / 20));
      tilt.blendMode.opacity.value = tiltK.current;
      if (Math.abs(tilt.offset - off) > 1e-3) tilt.offset = off;
    }
  });

  if (tier === "low") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SMAA />
      {withTilt && <primitive object={tilt} dispose={null} />}
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={1.4} luminanceSmoothing={0.25} intensity={0.32} radius={0.62} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette ref={vignette} offset={0.6} darkness={0.18} />
      <primitive object={grain} dispose={null} />
    </EffectComposer>
  );
}

/* ------------------------------------------------------------ tilt-shift */

/** Focus band half-height and its soft edge, in half-screen units (1 = centre → top). */
const TILT_FOCUS = 0.82;
const TILT_FEATHER = 0.56;
const TILT_MAX = 0.7;

/**
 * The miniature look per journey position: [t, strength 0..1, band offset]
 * (offset in half-screen units, + = up — where the subject sits in the frame).
 * Strongest while the model is a model (rise → materials), eased off for the
 * section's elevation and the drawing, back for the homes and the night.
 */
const TILT_KEYS: [number, number, number][] = [
  [1.82, 0, 0.05],
  [2.2, 1, 0.05],
  [3.85, 1, 0.05],
  [4.06, 0.55, 0.1],
  [4.3, 0.1, 0.3],
  [4.8, 0.1, 0.2],
  [5.04, 0.6, 0.22],
  [5.95, 0.6, 0.22],
  [6.15, 0.5, 0.0],
];

function tiltAt(t: number): [number, number] {
  const K = TILT_KEYS;
  if (t <= K[0][0]) return [K[0][1], K[0][2]];
  for (let i = 0; i < K.length - 1; i++) {
    const a = K[i];
    const b = K[i + 1];
    if (t <= b[0]) {
      const k = smooth(a[0], b[0], t);
      return [lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    }
  }
  const last = K[K.length - 1];
  return [last[1], last[2]];
}

/* ----------------------------------------------------------------- grain */

/**
 * The final grade (a little contrast and saturation over AgX's soft curve) and
 * a fine monochrome film grain, in display space after the tone curve. It lives
 * in the mid-tones and fades out of the highlights (lit panes, path lights,
 * white paper) and the deepest shadows, so it never speckles a bright window.
 */
class GrainEffect extends Effect {
  constructor() {
    super(
      "VLGradeGrain",
      /* glsl */ `
      uniform float uAmount;
      uniform float uSeed;
      uniform float uContrast;
      uniform float uSat;
      float vlHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 d = sqrt(max(inputColor.rgb, 0.0));
        float l = dot(d, vec3(0.2126, 0.7152, 0.0722));
        // The grade: AgX is honest but soft — a touch of contrast and colour back.
        d = mix(vec3(l), d, uSat);
        d = clamp((d - 0.46) * uContrast + 0.46, 0.0, 1.0);
        l = dot(d, vec3(0.2126, 0.7152, 0.0722));
        float w = smoothstep(0.03, 0.22, l) * (1.0 - smoothstep(0.55, 0.9, l));
        float n = vlHash(gl_FragCoord.xy) + vlHash(gl_FragCoord.xy + 17.3) - 1.0;
        d += n * uAmount * w;
        outputColor = vec4(d * d, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map<string, Uniform>([
          ["uAmount", new Uniform(0.028)],
          ["uContrast", new Uniform(1.08)],
          ["uSat", new Uniform(1.1)],
          ["uSeed", new Uniform(0)],
        ]),
      },
    );
  }

  update() {
    const u = this.uniforms.get("uSeed")!;
    u.value = (u.value + 0.618) % 7.0;
  }
}
