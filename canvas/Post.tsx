"use client";

import { Bloom, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { AgXToneMapping, NoToneMapping } from "three";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useJourney } from "@/lib/store";

/**
 * Post-processing per device tier. High/mid: SMAA, soft bloom (night windows,
 * the sweep seam), AgX filmic tone mapping, vignette and a fine film grain.
 * Low: no composer — renderer tone mapping only.
 */
export function Post() {
  const tier = useJourney((s) => s.tier);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    gl.toneMapping = tier === "low" ? AgXToneMapping : NoToneMapping;
  }, [gl, tier]);

  if (tier === "low") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SMAA />
      <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={0.55} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.32} darkness={0.42} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.32} />
    </EffectComposer>
  );
}
