"use client";

/**
 * The botanical playground: sculpted soft grass mounds and a few abstract
 * timber play pieces — three arches (the brand's symbol, at a child's scale),
 * stepping posts and a low balance beam. Appears with the model rising.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, MeshStandardMaterial, Shape, SphereGeometry, type Group } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { patchVillageMaterial } from "@/lib/materials";
import { mulberry32 } from "@/lib/noise";
import { PALETTE } from "@/lib/palette";
import { U } from "@/lib/uniforms";
import { PLAYGROUND } from "@/lib/village";
import { easeOutQuart } from "@/lib/timeline";
import { lin } from "../terrain/siteGlsl";
import { extendMaterial, inject } from "./shaderUtils";

const Y = PLAYGROUND.y;

function mounds() {
  const list: [number, number, number, number][] = [
    // x, z, radius, height
    [-63.5, 24.5, 3.6, 1.15],
    [-57.5, 31.0, 4.4, 1.45],
    [-50.0, 23.0, 3.0, 0.9],
    [-48.5, 33.5, 2.4, 0.75],
  ];
  return mergeGeometries(
    list.map(([x, z, r, h]) => {
      const g = new SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(r, h, r * 0.86);
      g.rotateY((x * 13.1) % 3);
      g.translate(x, Y - 0.04, z);
      return g;
    }),
  )!;
}

function arch(R: number, band: number, depth: number) {
  const s = new Shape();
  s.absarc(0, 0, R, 0, Math.PI, false);
  s.lineTo(-R + band, 0);
  s.absarc(0, 0, R - band, Math.PI, 0, true);
  s.lineTo(R, 0);
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 28 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function timber() {
  const parts: BufferGeometry[] = [];
  // three arches in a gentle diagonal, tallest first
  [
    [2.3, -54.6, 21.2],
    [1.85, -53.0, 23.4],
    [1.45, -51.6, 25.4],
  ].forEach(([R, x, z]) => {
    const g = arch(R, 0.2, 0.24);
    g.rotateY(-0.62);
    g.translate(x, Y, z);
    parts.push(g);
  });
  // stepping posts in a soft spiral
  const rand = mulberry32(5);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.72;
    const r = 1.2 + i * 0.28;
    const h = 0.28 + (i / 8) * 0.65 + rand() * 0.06;
    const g = new CylinderGeometry(0.2, 0.22, h, 12);
    g.translate(-60.5 + Math.cos(a) * r, Y + h / 2, 34.6 + Math.sin(a) * r * 0.8);
    parts.push(g);
  }
  // a low balance beam on two blocks
  const beam = new CylinderGeometry(0.11, 0.11, 6.2, 10);
  beam.rotateZ(Math.PI / 2);
  beam.rotateY(0.35);
  beam.translate(-61.0, Y + 0.42, 20.6);
  parts.push(beam);
  // parts have differing attribute sets → keep position/normal only
  return mergeGeometries(
    parts.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      const out = new BufferGeometry();
      out.setAttribute("position", n.getAttribute("position"));
      out.setAttribute("normal", n.getAttribute("normal"));
      return out;
    }),
  )!;
}

export function Playground() {
  const geo = useMemo(() => ({ mounds: mounds(), timber: timber() }), []);
  const mats = useMemo(() => {
    const grass = patchVillageMaterial(new MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 }), { poche: PALETTE.pocheEarth });
    extendMaterial(grass, "mound-v1", (shader) => {
      shader.fragmentShader = inject(
        shader.fragmentShader,
        "#include <color_fragment>",
        /* glsl */ `
        {
          float n = vl_vnoise(vVlWorld.xz * 0.9) * 0.6 + vl_vnoise(vVlWorld.xz * 4.0) * 0.4;
          vec3 c = mix(${lin("#859260")}, ${lin("#97A06C")}, n);
          diffuseColor.rgb = c;
        }`,
      );
    });
    const wood = patchVillageMaterial(new MeshStandardMaterial({ color: PALETTE.timber, roughness: 0.8 }), { poche: PALETTE.poche });
    extendMaterial(wood, "timber-v1", (shader) => {
      shader.fragmentShader = inject(
        shader.fragmentShader,
        "#include <color_fragment>",
        /* glsl */ `
        {
          float grain = vl_vnoise(vec2(vVlWorld.y * 14.0, (vVlWorld.x + vVlWorld.z) * 1.3));
          diffuseColor.rgb *= 0.88 + 0.2 * grain;
        }`,
      );
    });
    return { grass, wood };
  }, []);
  useEffect(
    () => () => {
      geo.mounds.dispose();
      geo.timber.dispose();
      mats.grass.dispose();
      mats.wood.dispose();
    },
    [geo, mats],
  );
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const k = easeOutQuart((U.uRise.value - 0.35) / 0.55);
    g.visible = k > 0.001;
    g.position.y = Y * (1 - Math.max(k, 0.0001));
    g.scale.y = Math.max(k, 0.0001);
  });
  return (
    <group ref={group}>
      <mesh geometry={geo.mounds} material={mats.grass} castShadow receiveShadow />
      <mesh geometry={geo.timber} material={mats.wood} castShadow receiveShadow />
    </group>
  );
}

