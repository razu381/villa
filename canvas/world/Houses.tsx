"use client";

/**
 * The village houses (every non-featured townhouse and villa, plus the
 * village-heart pavilion) — merged per material in world space, so the whole
 * village is ~8 draw calls (+ shadow pass) and one line-drawing call.
 *
 * Build stages run entirely in the shaders from the shared uniforms:
 *   uLines    architect's hairlines trace in, then settle to graphite
 *   uRise     each house rises from its plan as a white model (per-house delay)
 *   uMaterial the east → west sweep leaves cork, limestone, glass behind
 *   uWindows  windows switch on at night (per-house + per-window stagger)
 * The only per-frame CPU work is toggling visibility to skip idle draw calls.
 *
 * Featured homes are drawn by canvas/homes with the same builder
 * (canvas/world/houses/architecture.ts). Debug: `?houses=all` includes them here.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Mesh } from "three";
import { U } from "@/lib/uniforms";
import {
  HOUSE_MATERIAL_KEYS,
  buildVillageHouses,
  getHouseDepthMaterial,
  getHouseLineMaterial,
  getHouseMaskMaterial,
  getHouseMaterials,
  getHouseSpillMaterial,
  updateHouseLineResolution,
  type HouseMaterialKey,
} from "./houses/architecture";

const includeFeatured = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("houses") === "all";

let buildMs = 0;

export interface HousesProps {
  /**
   * Include the village-heart pavilion (default true). Set false if another
   * module renders VILLAGE_HEART.pavilion.
   */
  pavilion?: boolean;
}

export function Houses({ pavilion = true }: HousesProps) {
  const village = useMemo(() => {
    const t0 = performance.now();
    const v = buildVillageHouses(includeFeatured() ? () => true : undefined, pavilion);
    buildMs = performance.now() - t0;
    return v;
  }, [pavilion]);
  const mats = useMemo(() => getHouseMaterials(), []);
  const depth = useMemo(() => getHouseDepthMaterial(), []);
  const lineMat = useMemo(() => getHouseLineMaterial(), []);
  const maskMat = useMemo(() => getHouseMaskMaterial(), []);
  const spillMat = useMemo(() => getHouseSpillMaterial(), []);
  const meshes = useRef<Partial<Record<HouseMaterialKey, Mesh | null>>>({});
  const lines = useRef<Mesh>(null);
  const mask = useRef<Mesh>(null);
  const spill = useRef<Mesh>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    // Dev aid: geometry budget of the merged village (triangles per material).
    const w = window as unknown as { __VL_HOUSES?: () => Record<string, number> };
    w.__VL_HOUSES = () => {
      const out: Record<string, number> = {};
      for (const [k, g] of Object.entries(village.meshes)) out[k] = (g!.index ? g!.index.count : g!.attributes.position.count) / 3;
      out.lines = village.lines.index!.count / 3;
      out.mask = village.mask.attributes.position.count / 3;
      out.spill = village.spill ? village.spill.index!.count / 3 : 0;
      out.buildMs = Math.round(buildMs);
      return out;
    };
  }, [village]);

  useEffect(
    () => () => {
      Object.values(village.meshes).forEach((g) => g?.dispose());
      village.lines.dispose();
      village.mask.dispose();
      village.spill?.dispose();
    },
    [village],
  );

  useFrame(({ gl }) => {
    const risen = U.uRise.value > 0.0005;
    for (const k of HOUSE_MATERIAL_KEYS) {
      const m = meshes.current[k];
      if (m) m.visible = risen;
    }
    const drawing = U.uLines.value > 0.0005 && U.uMaterial.value < 0.999;
    if (lines.current) lines.current.visible = drawing;
    if (drawing) updateHouseLineResolution(gl);
    // Hidden-line mask: only while the drawing is up and some house is still rising.
    if (mask.current) mask.current.visible = drawing && U.uRise.value < 0.999;
    // Night light pools: only once windows start switching on.
    if (spill.current) spill.current.visible = U.uWindows.value > 0.001;
  });

  return (
    <group name="houses">
      {HOUSE_MATERIAL_KEYS.map((k) => {
        const g = village.meshes[k];
        if (!g) return null;
        return (
          <mesh
            key={k}
            name={`houses-${k}`}
            ref={(el) => {
              meshes.current[k] = el;
            }}
            geometry={g}
            material={mats[k]}
            customDepthMaterial={depth}
            castShadow={k !== "glass"}
            receiveShadow
            renderOrder={k === "glass" ? 2 : 0}
          />
        );
      })}
      {village.spill && <mesh ref={spill} geometry={village.spill} material={spillMat} renderOrder={2} frustumCulled={false} />}
      {/* Depth-only mask after every other transparent object, then the hairlines. */}
      <mesh ref={mask} geometry={village.mask} material={maskMat} renderOrder={998} frustumCulled={false} />
      <mesh ref={lines} geometry={village.lines} material={lineMat} renderOrder={999} frustumCulled={false} />
    </group>
  );
}
