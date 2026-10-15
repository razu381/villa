/**
 * Shared foliage noise for trees and planting (GLSL):
 *   tv_h3 / tv_h33  cheap sin-free hashes
 *   tv_n3           3D value noise
 *   tv_cells        3D cellular noise (F1, F2)
 *   tv_clumps       smooth cellular noise: rounded leaf clumps with soft valleys
 *                   between them (no hard crease lines)
 */
export const FOLIAGE_NOISE_GLSL = /* glsl */ `
float tv_h3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 tv_h33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float tv_n3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tv_h3(i), tv_h3(i + vec3(1, 0, 0)), f.x), mix(tv_h3(i + vec3(0, 1, 0)), tv_h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(tv_h3(i + vec3(0, 0, 1)), tv_h3(i + vec3(1, 0, 1)), f.x), mix(tv_h3(i + vec3(0, 1, 1)), tv_h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
/** Cellular noise: (F1, F2), distances to the two nearest feature points — leaf clumps. */
vec2 tv_cells(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + tv_h33(i + g) * 0.8 + 0.1 - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
/** Smooth F1 (exponential smooth-min over the neighbourhood): 0 at a clump's heart, ~1 in the valleys. */
float tv_clumps(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float acc = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + tv_h33(i + g) * 0.8 + 0.1 - f;
    acc += exp(-9.0 * dot(r, r));
  }
  return sqrt(max(-log(acc) / 9.0, 0.0));
}
`;
