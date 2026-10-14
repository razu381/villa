"use client";

/**
 * The village-heart pavilion (fitness + cowork) beside the communal pool:
 * a long, low limestone volume with two deep glazed bays, a thin roof slab
 * and a planted roof whose greenery spills over the fascia — after the film's
 * pool render. Rises with the model; glows softly at night.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MeshStandardMaterial, type Group } from "three";
import { patchVillageMaterial } from "@/lib/materials";
import { PALETTE } from "@/lib/palette";
import { U } from "@/lib/uniforms";
import { VILLAGE_HEART } from "@/lib/village";
import { easeOutQuart } from "@/lib/timeline";
import { lin } from "../terrain/siteGlsl";
import { extendMaterial, inject } from "./shaderUtils";
import { createStoneMaterial } from "./wallsMaterial";
import { Builder, KIND } from "./wallsGeometry";

const P = VILLAGE_HEART.pavilion;

function build() {
  const stone = new Builder();
  const glass = new Builder();
  const green = new Builder();
  const x0 = P.x - P.width / 2;
  const x1 = P.x + P.width / 2;
  const z0 = P.z - P.depth / 2;
  const z1 = P.z + P.depth / 2;
  const y0 = P.y;
  const yR = y0 + P.height;
  const t = 0.45; // wall thickness
  const inset = 0.55; // glazing recess
  // floor plinth
  stone.box([x0 - 0.3, y0 - 0.3, z0 - 0.3], [x1 + 0.3, y0 + 0.12, z1 + 0.3], KIND.dressed, KIND.coping);
  // end walls and back wall
  stone.box([x0, y0, z0], [x0 + t, yR, z1], KIND.dressed);
  stone.box([x1 - t, y0, z0], [x1, yR, z1], KIND.dressed);
  stone.box([x0, y0, z0], [x1, yR, z0 + t], KIND.dressed);
  // a solid pier splitting the south facade into two bays (gym | cowork)
  const pierW = 2.6;
  stone.box([P.x - pierW / 2 + 1.2, y0, z1 - 2.2], [P.x + pierW / 2 + 1.2, yR, z1], KIND.dressed);
  // roof slab with a crisp fascia
  stone.box([x0 - 0.35, yR, z0 - 0.35], [x1 + 0.35, yR + 0.42, z1 + 0.35], KIND.dressed, KIND.coping);
  // glazing, recessed
  glass.box([x0 + t, y0 + 0.1, z1 - inset - 0.08], [P.x - pierW / 2 + 1.2, yR, z1 - inset], KIND.dressed);
  glass.box([P.x + pierW / 2 + 1.2, y0 + 0.1, z1 - inset - 0.08], [x1 - t, yR, z1 - inset], KIND.dressed);
  // planted roof: a meadow inset on the slab, spilling over the south fascia
  green.box([x0 + 0.2, yR + 0.4, z0 + 0.2], [x1 - 0.2, yR + 0.62, z1 + 0.05], KIND.masonry);
  let x = x0 - 0.3;
  let k = 0;
  while (x < x1 + 0.3) {
    const w = 0.5 + ((k * 37) % 7) * 0.12;
    const drop = 0.25 + ((k * 53) % 5) * 0.1;
    green.box([x, yR + 0.42 - drop, z1 + 0.35], [Math.min(x + w, x1 + 0.35), yR + 0.6, z1 + 0.5], KIND.masonry);
    x += w + 0.25 + ((k * 29) % 3) * 0.2;
    k++;
  }
  return { stone: stone.build(), glass: glass.build(), green: green.build() };
}

export function Pavilion() {
  const geo = useMemo(() => build(), []);
  const mats = useMemo(() => {
    const stone = createStoneMaterial();
    const glass = patchVillageMaterial(new MeshStandardMaterial({ color: PALETTE.glass, roughness: 0.12, metalness: 0.2 }), { poche: null });
    extendMaterial(glass, "pav-glass-v2", (shader) => {
      shader.uniforms.uSkyTop = U.uSkyTop;
      shader.uniforms.uSkyHorizon = U.uSkyHorizon;
      shader.fragmentShader = shader.fragmentShader.replace("void main() {", "uniform vec3 uSkyTop;\nuniform vec3 uSkyHorizon;\nvoid main() {");
      shader.fragmentShader = inject(
        shader.fragmentShader,
        "#include <emissivemap_fragment>",
        `{
          vec3 gv = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(dot(normal, gv), 0.0, 1.0), 3.0);
          vec3 sky = mix(uSkyHorizon, uSkyTop, 0.35);
          totalEmissiveRadiance += sky * (0.1 + 0.5 * fr) * vlMask * (1.0 - 0.85 * uNight);
          totalEmissiveRadiance += ${lin(PALETTE.windowGlow)} * 1.6 * max(uWindows, smoothstep(0.6, 0.95, uNight)) * vlMask;
        }`,
      );
    });
    const green = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 }), { poche: PALETTE.foliageDeep });
    extendMaterial(green, "pav-green-v1", (shader) => {
      shader.fragmentShader = inject(
        shader.fragmentShader,
        "#include <color_fragment>",
        `{
          float n = vl_vnoise(vVlWorld.xz * 2.3 + vVlWorld.y * 4.0) * 0.6 + vl_vnoise(vVlWorld.xz * 9.0) * 0.4;
          diffuseColor.rgb = mix(${lin("#5F6B43")}, ${lin("#83905C")}, n) * mix(0.75, 1.0, uLife);
        }`,
      );
    });
    return { stone, glass, green };
  }, []);
  useEffect(
    () => () => {
      geo.stone.dispose();
      geo.glass.dispose();
      geo.green.dispose();
      mats.stone.dispose();
      mats.glass.dispose();
      mats.green.dispose();
    },
    [geo, mats],
  );
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const k = easeOutQuart((U.uRise.value - 0.05) / 0.5);
    g.visible = k > 0.001;
    g.position.y = P.y * (1 - Math.max(k, 0.0001));
    g.scale.y = Math.max(k, 0.0001);
  });
  return (
    <group ref={group}>
      <mesh geometry={geo.stone} material={mats.stone} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={mats.glass} receiveShadow />
      <mesh geometry={geo.green} material={mats.green} castShadow receiveShadow />
    </group>
  );
}
