"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { uPodRise } from "../terrain/build";
import { createRecessMaterial, createStoneDepthMaterial, createStoneMaterial } from "./wallsMaterial";
import { buildWalls } from "./wallsGeometry";

/**
 * Bastion, terrace walls, stairs, copings and the garage portal — three draw
 * calls. They rise out of the hill with the podium (uPodRise) and are hidden
 * until it starts. The portal's back face is its own mesh, named
 * "landscape-portal-back", so the section / cars module can hide it (or put
 * the tunnel there) while cars drive in.
 */
export function Walls() {
  const geo = useMemo(() => buildWalls(), []);
  const stone = useMemo(() => createStoneMaterial(), []);
  const depth = useMemo(() => createStoneDepthMaterial(), []);
  const recess = useMemo(() => createRecessMaterial(), []);
  useEffect(
    () => () => {
      geo.stone.dispose();
      geo.recess.dispose();
      geo.recessBack.dispose();
      stone.dispose();
      depth.dispose();
      recess.dispose();
    },
    [geo, stone, depth, recess],
  );
  const group = useRef<Group>(null);
  useFrame(() => {
    const on = uPodRise.value > 0.002;
    if (group.current && group.current.visible !== on) group.current.visible = on;
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo.stone} material={stone} customDepthMaterial={depth} castShadow receiveShadow />
      <mesh geometry={geo.recess} material={recess} receiveShadow />
      <mesh name="landscape-portal-back" geometry={geo.recessBack} material={recess} receiveShadow />
    </group>
  );
}
