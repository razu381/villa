/**
 * Baked contact shading for the ground (0.5 m/px over the plinth):
 *   R — under tree canopies (appears with the foam trees)
 *   G — around house footprints (appears as the houses rise)
 *   B — under hillside shrubs (appears with life)
 * Soft Gaussian splats, computed once on load (a few ms). Sampled by the
 * terrain shader, multiplied by each stage's progress.
 */
import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from "three";
import { HOUSES, PLINTH, TREES } from "@/lib/village";
import { SHRUBS } from "../landscape/layout";

export const AO_RES = 0.5;

export function buildAoTexture() {
  const w = Math.round((PLINTH.maxX - PLINTH.minX) / AO_RES) + 1;
  const h = Math.round((PLINTH.maxZ - PLINTH.minZ) / AO_RES) + 1;
  const tree = new Float32Array(w * h).fill(1);
  const house = new Float32Array(w * h).fill(1);
  const shrub = new Float32Array(w * h).fill(1);
  const splat = (buf: Float32Array, x: number, z: number, r: number, k: number) => {
    const R = r * 1.9;
    const i0 = Math.max(0, Math.floor((x - R - PLINTH.minX) / AO_RES));
    const i1 = Math.min(w - 1, Math.ceil((x + R - PLINTH.minX) / AO_RES));
    const j0 = Math.max(0, Math.floor((z - R - PLINTH.minZ) / AO_RES));
    const j1 = Math.min(h - 1, Math.ceil((z + R - PLINTH.minZ) / AO_RES));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = PLINTH.minX + i * AO_RES - x;
        const dz = PLINTH.minZ + j * AO_RES - z;
        const q = (dx * dx + dz * dz) / (r * r);
        buf[j * w + i] *= 1 - k * Math.exp(-q * 1.6);
      }
    }
  };
  for (const t of TREES) {
    const width = t.kind === "tall" ? t.height * 0.24 : t.kind === "olive" ? t.height * 1.0 : t.height * 0.78;
    splat(tree, t.x, t.z, width * 0.5 + 0.6, t.kind === "tall" ? 0.42 : 0.34);
  }
  for (const s of SHRUBS) splat(shrub, s.x, s.z, s.s * 1.1 + 0.3, 0.3);
  // houses: distance falloff from the footprint
  for (const hs of HOUSES) {
    const hx = hs.width / 2;
    const hz = hs.depth / 2;
    const R = 3.5;
    const i0 = Math.max(0, Math.floor((hs.x - hx - R - PLINTH.minX) / AO_RES));
    const i1 = Math.min(w - 1, Math.ceil((hs.x + hx + R - PLINTH.minX) / AO_RES));
    const j0 = Math.max(0, Math.floor((hs.z - hz - R - PLINTH.minZ) / AO_RES));
    const j1 = Math.min(h - 1, Math.ceil((hs.z + hz + R - PLINTH.minZ) / AO_RES));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const qx = Math.abs(PLINTH.minX + i * AO_RES - hs.x) - hx;
        const qz = Math.abs(PLINTH.minZ + j * AO_RES - hs.z) - hz;
        const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        if (d < 0) continue;
        house[j * w + i] = Math.min(house[j * w + i], 1 - 0.32 * Math.exp(-d / 1.1));
      }
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    data[k * 4] = Math.round(Math.max(0, tree[k]) * 255);
    data[k * 4 + 1] = Math.round(Math.max(0, house[k]) * 255);
    data[k * 4 + 2] = Math.round(Math.max(0, shrub[k]) * 255);
    data[k * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
