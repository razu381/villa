"use client";

import { useEffect, useMemo } from "react";
import { createRecessMaterial, createStoneMaterial } from "./wallsMaterial";
import { buildWalls } from "./wallsGeometry";

/** Bastion, terrace walls, stairs, copings and the garage portal — two draw calls. */
export function Walls() {
  const geo = useMemo(() => buildWalls(), []);
  const stone = useMemo(() => createStoneMaterial(), []);
  const recess = useMemo(() => createRecessMaterial(), []);
  useEffect(
    () => () => {
      geo.stone.dispose();
      geo.recess.dispose();
      stone.dispose();
      recess.dispose();
    },
    [geo, stone, recess],
  );
  return (
    <group>
      <mesh geometry={geo.stone} material={stone} castShadow receiveShadow />
      <mesh geometry={geo.recess} material={recess} receiveShadow />
    </group>
  );
}
