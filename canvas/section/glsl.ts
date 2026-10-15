/**
 * Shared GLSL and uniforms for the section chapter.
 *
 *   sec_portalDepth(wp)  — "seeing into the hill". While the section is closed the
 *       garage portal is a real opening: tunnel and car fragments behind the
 *       portal's back plane are kept only where the view ray passes through the
 *       opening, and their depth is folded onto that plane (keeping their order),
 *       so the solid hill behind the recess never hides the tunnel — while
 *       everything in front of the opening (jambs, lintel, trees, cars) still
 *       occludes it correctly. No stencil, no extra pass.
 *   sec_light(P, N)      — the hall's light: slim linear strips in the soffit
 *       (line lights), the tunnel strip and the warm lift lobbies — a soft,
 *       even, warm-neutral wash, like a lit model.
 *   sec_under(P)         — 1 underground (inside the hall or the tunnel), easing
 *       through the portal recess.
 */
import { Matrix4 } from "three";
import { lin } from "../world/terrain/siteGlsl";
import { SECTION_DEFS_GLSL } from "./layout";

/** Written once per frame by Section.tsx. */
export const SU = {
  /** 1 while the section is closed and the tunnel is seen through the portal. */
  uSecPortal: { value: 0 },
  /** The main camera's view-projection (fragment-side depth folding). */
  uSecViewProj: { value: new Matrix4() },
};

export const LIGHT_COLOR = "#FFDAA8";
export const LOBBY_COLOR = "#FFC27A";

export const SEC_GLSL = /* glsl */ `
${SECTION_DEFS_GLSL}
uniform float uSecPortal;
uniform mat4 uSecViewProj;
#define SEC_BAND 0.45
#define C_SEC_LIGHT ${lin(LIGHT_COLOR)}
#define C_SEC_LOBBY ${lin(LOBBY_COLOR)}

float sec_depthOf(vec3 p) {
  vec4 c = uSecViewProj * vec4(p, 1.0);
  return c.z / c.w * 0.5 + 0.5;
}

void sec_portalDepth(vec3 wp) {
  float fd = gl_FragCoord.z;
  if (uSecPortal > 0.5 && wp.z < SEC_PZ + SEC_BAND) {
    vec3 d = wp - cameraPosition;
    bool keep = false;
    if (d.z < -1e-3 && cameraPosition.z > SEC_PZ) {
      float k = (SEC_PZ - cameraPosition.z) / d.z;
      vec3 q = cameraPosition + d * k;
      if (q.x > SEC_OX0 && q.x < SEC_OX1 && q.y > SEC_OY0 && q.y < SEC_OY1) {
        float L = length(d);
        vec3 dn = d / L;
        float e = L * (1.0 - k);
        float z1 = sec_depthOf(q);
        float z0 = sec_depthOf(q - dn * SEC_BAND);
        float g = (e + SEC_BAND) / (e + SEC_BAND + 6.0);
        fd = mix(z0, z1, clamp(g, 0.0, 1.0));
        keep = true;
      }
    }
    if (!keep && wp.z < SEC_PZ) discard;
  }
  gl_FragDepth = fd;
}

float sec_under(vec3 P) {
  float hall = step(SEC_HX0 - 0.6, P.x) * step(P.x, SEC_HX1 + 0.6) * step(SEC_HZ0 - 0.6, P.z) * step(P.z, SEC_HZ1 + 0.2) * step(P.y, SEC_HY1 + 0.3);
  float tx = step(SEC_TX0 - 0.6, P.x) * step(P.x, SEC_TX1 + 0.6) * step(P.y, SEC_TY1 + 0.3);
  float tube = tx * step(SEC_HZ1 - 0.2, P.z) * (1.0 - smoothstep(SEC_PZ - 1.5, SEC_PZ + 3.2, P.z));
  return max(hall, tube);
}

/** A line light's contribution at P (closest point Q): soft cosine and a broad falloff. */
float sec_line(vec3 P, vec3 N, vec3 Q, float wrap) {
  vec3 L = Q - P;
  float d = length(L) + 1e-3;
  L /= d;
  float ndl = clamp((dot(N, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
  return ndl / (0.6 + d * 0.42 + d * d * 0.035);
}

/** One wall washer's scallop on the back wall: dx along the wall, dy below the soffit. */
float sec_scallop(float dx, float dy) {
  float edge = dy - 0.2 - 0.17 * dx * dx;
  float beam = smoothstep(-0.05, 0.5, edge);
  return beam * exp(-max(edge, 0.0) * 0.3) * exp(-dx * dx * 0.15);
}
/** The back wall's washed light at (x, y). */
float sec_wash(float x, float y) {
  float e = 0.0;
  float dy = SEC_HY1 - 0.08 - y;
  for (int i = 0; i < SEC_WASH.length(); i++) e += sec_scallop(x - SEC_WASH[i], dy);
  return e;
}

/** Irradiance (linear RGB) from the garage lights at P with world normal N. */
vec3 sec_light(vec3 P, vec3 N) {
  float e = 0.0;
  if (P.z < SEC_HZ1 + 0.6) {
    for (int i = 0; i < SEC_STRIPS.length(); i++) {
      for (int j = 0; j < SEC_SEGS.length(); j++) {
        vec2 sg = SEC_SEGS[j];
        e += sec_line(P, N, vec3(clamp(P.x, sg.x, sg.y), SEC_SY, SEC_STRIPS[i]), 0.25) * 0.7;
      }
    }
    // the washers, seen from the floor and the cars near the back wall
    for (int i = 0; i < SEC_WASH.length(); i++) {
      vec3 L = vec3(SEC_WASH[i], SEC_HY1 - 0.15, SEC_HZ0 + 0.55) - P;
      float d = length(L) + 1e-3;
      L /= d;
      e += clamp(dot(N, L) * 0.85 + 0.15, 0.0, 1.0) * clamp(-L.y * 1.4 + 0.2, 0.0, 1.0) * 0.9 / (1.0 + d * d * 0.09);
    }
  }
  // the tunnel strip, along its axis
  float tz = clamp(P.z, SEC_TSZ0, SEC_TSZ1);
  float te = sec_line(P, N, vec3(SEC_TSX, SEC_TSY, tz), 0.2) * step(P.z, SEC_PZ + 0.5);
  te *= mix(0.5, 1.0, smoothstep(SEC_PZ, SEC_HZ1, P.z));
  vec3 c = C_SEC_LIGHT * (e + te * 0.9);
  // the lift lobbies: warm light spilling from the open cores
  for (int i = 0; i < SEC_CORES.length(); i++) {
    vec3 L = vec3(SEC_CORES[i], SEC_HY0 + 1.2, SEC_HZ0 + 2.9) - P;
    float d = length(L) + 1e-3;
    c += C_SEC_LOBBY * clamp(dot(N, L / d) * 0.8 + 0.2, 0.0, 1.0) * 1.0 / (1.0 + d * d * 0.2);
  }
  return c;
}
`;
