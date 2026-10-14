"use client";

/**
 * PLACEHOLDER — to be replaced by the landscape module (plinth with strata sides,
 * contour lines, table, materials). Kept minimal so the foundation renders.
 */
import { useMemo } from "react";
import { MeshStandardMaterial, PlaneGeometry } from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { PLINTH, TABLE_Y, heightAt } from "@/lib/village";

export function Terrain() {
  const geo = useMemo(() => {
    const w = PLINTH.maxX - PLINTH.minX;
    const d = PLINTH.maxZ - PLINTH.minZ;
    const g = new PlaneGeometry(w, d, 220, 160);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + (PLINTH.minX + PLINTH.maxX) / 2;
      const z = p.getZ(i) + (PLINTH.minZ + PLINTH.maxZ) / 2;
      p.setXYZ(i, x, heightAt(x, z), z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => patchVillageMaterial(new MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.95 }), { poche: null }), []);
  return (
    <group>
      <mesh geometry={geo} material={mat} receiveShadow castShadow />
      <mesh rotation-x={-Math.PI / 2} position-y={TABLE_Y} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color={PALETTE.limestone} roughness={1} />
      </mesh>
    </group>
  );
}
