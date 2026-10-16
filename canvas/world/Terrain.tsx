"use client";

/**
 * The plinth — the village's terrain as an architectural-model block — and the
 * table it stands on.
 *
 * - Top: the ground (lib/village heightAt, built edges sharpened for the walls),
 *   white model → hillside / gardens / paths / street via the material sweep.
 *   It starts as the natural hill and the podium rises out of it (build.ts).
 * - Contours draw outward from the village heart (U.uContours) and fade to a ghost.
 * - Sides: earth strata over limestone bedrock, with a thin limestone rim.
 * - Closed solid: poché (pocheEarth) when the section plane cuts it.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { sectionPlane } from "@/lib/uniforms";
import { TABLE_Y } from "@/lib/village";
import { updatePodiumRise } from "./terrain/build";
import { buildPlinthGeometry } from "./terrain/plinthGeometry";
import { createTableMaterial } from "./terrain/tableMaterial";
import { createTerrainMaterial, uCutZ } from "./terrain/terrainMaterial";

export function Terrain() {
  const geo = useMemo(() => buildPlinthGeometry(), []);
  const mat = useMemo(() => createTerrainMaterial(), []);
  const tableMat = useMemo(() => createTableMaterial(), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      tableMat.dispose();
    },
    [geo, mat, tableMat],
  );
  useFrame(() => {
    // plane: normal (0,0,-1), constant c → the cut face is z = c
    uCutZ.value = sectionPlane.constant;
    updatePodiumRise();
  }, -50);
  return (
    <group>
      <mesh name="terrain" geometry={geo} material={mat} receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position-y={TABLE_Y} material={tableMat} renderOrder={-10}>
        <planeGeometry args={[6000, 6000]} />
      </mesh>
    </group>
  );
}
