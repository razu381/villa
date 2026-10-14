"use client";

/**
 * PLACEHOLDER — to be replaced by the houses module (stacked volumes, window
 * recesses, line drawing, rise, materials, window glow).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MeshStandardMaterial, type Group } from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U } from "@/lib/uniforms";
import { HOUSES } from "@/lib/village";
import { clamp01, easeOutQuart } from "@/lib/timeline";

export function Houses() {
  const cork = useMemo(() => patchVillageMaterial(new MeshStandardMaterial({ color: PALETTE.cork, roughness: 0.9 })), []);
  const stone = useMemo(() => patchVillageMaterial(new MeshStandardMaterial({ color: PALETTE.limestoneBuild, roughness: 0.8 })), []);
  const refs = useRef<(Group | null)[]>([]);
  const list = HOUSES.filter((h) => !h.featured);
  useFrame(() => {
    list.forEach((h, i) => {
      const g = refs.current[i];
      if (!g) return;
      const k = easeOutQuart(clamp01((U.uRise.value - h.delay * 0.6) / 0.4));
      g.scale.y = Math.max(0.0001, k);
      g.visible = k > 0.001;
    });
  });
  return (
    <group>
      {list.map((h, i) => (
        <group key={h.id} ref={(el) => { refs.current[i] = el; }} position={[h.x, h.y, h.z]}>
          <mesh position={[0, h.floors[0] / 2, 0]} material={stone} castShadow receiveShadow>
            <boxGeometry args={[h.width - 0.1, h.floors[0], h.depth]} />
          </mesh>
          <mesh position={[0, h.floors[0] + h.floors[1] / 2, h.upperShift]} material={cork} castShadow receiveShadow>
            <boxGeometry args={[h.width - 0.1, h.floors[1], h.depth - 1.5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
