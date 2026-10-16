/**
 * Baked ground data over the plinth (0.5 m/px), computed once on load:
 *
 * AO texture (RGBA8)
 *   R — contact shading under tree canopies (appears with the foam trees)
 *   G — around house footprints (appears as the houses rise)
 *   B — under shrubs and planting beds (appears with life)
 *   A — groves: 0 open dry clearing → 1 dense maquis (layout.groveMask)
 *
 * Height texture (R16F): the finished ground, so the section's topsoil band
 * follows the real surface wherever the cut plane is.
 */
import { DataTexture, DataUtils, HalfFloatType, LinearFilter, RGBAFormat, RedFormat, UnsignedByteType } from "three";
import { HOUSES, PLINTH } from "@/lib/village";
import { BEDS, LANDSCAPE_TREES, SHRUBS, groveMask } from "../landscape/layout";
import { groundHeight } from "./ground";
import { f } from "../landscape/shaderUtils";

export const AO_RES = 0.5;
export const AO_W = Math.round((PLINTH.maxX - PLINTH.minX) / AO_RES) + 1;
export const AO_H = Math.round((PLINTH.maxZ - PLINTH.minZ) / AO_RES) + 1;

export function buildAoTexture() {
  const w = AO_W;
  const h = AO_H;
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
  for (const t of LANDSCAPE_TREES) {
    const width = t.height * (t.kind === "cypress" ? 0.24 : t.kind === "pine" ? 0.8 : 1.0);
    // the pine's crown is high: a lighter shade under it
    splat(tree, t.x, t.z, width * 0.5 + 0.6, t.kind === "cypress" ? 0.42 : t.kind === "pine" ? 0.28 : 0.34);
  }
  for (const s of SHRUBS) splat(shrub, s.x, s.z, s.s * 1.1 + 0.3, 0.3);
  for (const s of BEDS) splat(shrub, s.x, s.z, s.s * 0.9 + 0.25, 0.22);
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
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      data[k * 4] = Math.round(Math.max(0, tree[k]) * 255);
      data[k * 4 + 1] = Math.round(Math.max(0, house[k]) * 255);
      data[k * 4 + 2] = Math.round(Math.max(0, shrub[k]) * 255);
      data[k * 4 + 3] = Math.round(groveMask(PLINTH.minX + i * AO_RES, PLINTH.minZ + j * AO_RES) * 255);
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function buildHeightTexture() {
  const data = new Uint16Array(AO_W * AO_H);
  for (let j = 0; j < AO_H; j++) {
    for (let i = 0; i < AO_W; i++) data[j * AO_W + i] = DataUtils.toHalfFloat(groundHeight(PLINTH.minX + i * AO_RES, PLINTH.minZ + j * AO_RES));
  }
  const tex = new DataTexture(data, AO_W, AO_H, RedFormat, HalfFloatType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

let _ao: DataTexture | null = null;
let _h: DataTexture | null = null;
/** Shared, built once on first use. */
export const aoTexture = () => (_ao ??= buildAoTexture());
export const heightTexture = () => (_h ??= buildHeightTexture());

/** GLSL: plinth (x, z) → texel-centred uv for the textures above. */
export const PLINTH_UV_GLSL = /* glsl */ `
vec2 tr_aoUv(vec2 xz) {
  return vec2(((xz.x - ${f(PLINTH.minX)}) / ${f(AO_RES)} + 0.5) / ${f(AO_W)},
              ((xz.y - ${f(PLINTH.minZ)}) / ${f(AO_RES)} + 0.5) / ${f(AO_H)});
}
`;
