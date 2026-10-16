/** Deterministic noise + random helpers (CPU side). Same seed → same village. */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2Raw(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * The lattice hash, memoised: valueNoise only ever asks for integer corners, and
 * the village's noise stays within ±128 of the origin, so a small table filled on
 * demand replaces most of the Math.sin calls (exactly the same values). The
 * terrain build samples the hill hundreds of thousands of times on mount.
 */
const H_OFF = 128;
const H_W = 2 * H_OFF + 1;
const hashTable = new Float64Array(H_W * H_W).fill(-1);
function hash2(x: number, y: number) {
  const ix = x + H_OFF;
  const iy = y + H_OFF;
  if (ix < 0 || iy < 0 || ix >= H_W || iy >= H_W) return hash2Raw(x, y);
  const i = ix * H_W + iy;
  let h = hashTable[i];
  if (h < 0) h = hashTable[i] = hash2Raw(x, y);
  return h;
}

/** Smooth value noise in [0, 1]. */
export function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Fractal noise in roughly [-1, 1]. */
export function fbm(x: number, y: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise(x * freq, y * freq) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}
