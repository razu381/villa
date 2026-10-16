"use client";

/**
 * Life above, indoors: the rooms the section plane cuts are furnished, so the
 * elevation and the raised camera (t ≈ 4.4 → 4.9) look into homes rather than
 * hollow boxes. Each cut house gets the featured homes' model furniture
 * (canvas/homes/interiors.ts), laid out from that house's own rooms; all of it
 * is one merged mesh, clipped by the section plane with poché on the cut.
 * Mounted inside the section group, so it only exists while the section does.
 */
import { useEffect, useMemo } from "react";
import { type BufferGeometry, Matrix4, Plane, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HOUSES, SECTION_Z, type HouseSpec } from "@/lib/village";
import { buildHouse, houseMatrix } from "../world/houses/architecture";
import { buildInterior } from "../homes/interiors";
import { createHomeUniforms, interiorMaterial } from "../homes/materials";

/** Houses whose footprint the section plane crosses. */
function cutHouses(): HouseSpec[] {
  return HOUSES.filter((h) => {
    const c = Math.cos(h.rotY);
    const s = Math.sin(h.rotY);
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const wz = h.z - s * x * (h.width / 2) + c * z * (h.depth / 2);
      z0 = Math.min(z0, wz);
      z1 = Math.max(z1, wz);
    }
    return z0 < SECTION_Z && z1 > SECTION_Z;
  });
}

function buildCutInteriors(): BufferGeometry | null {
  const m = new Matrix4();
  const pieces: BufferGeometry[] = [];
  for (const spec of cutHouses()) {
    const build = buildHouse(spec);
    for (const lv of buildInterior(spec.type, build)) {
      pieces.push(lv.furniture.applyMatrix4(houseMatrix(spec, m)));
      lv.lamps?.dispose();
      lv.pools?.dispose();
      lv.plan.dispose();
    }
    for (const p of build.parts) p.geometry.dispose();
    build.spill?.dispose();
  }
  if (pieces.length === 0) return null;
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  merged?.computeBoundingSphere();
  return merged;
}

export function SectionInteriors() {
  const geometry = useMemo(buildCutInteriors, []);
  // Only the section plane cuts these (the second plane, the explode's plan cut, is parked far above).
  const material = useMemo(() => interiorMaterial(new Plane(new Vector3(0, -1, 0), 1e4), createHomeUniforms()), []);
  useEffect(
    () => () => {
      geometry?.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  if (!geometry) return null;
  return <mesh name="section-interiors" geometry={geometry} material={material} frustumCulled={false} />;
}
