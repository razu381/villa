"use client";

/**
 * The village heart's jewel in "Two ways to live": a gold target on a leader
 * line standing between the pavilion and the long pool, drawn like the
 * featured homes' markers (same materials, same fade in and out). It answers
 * the pointer and the "Village heart" line under the cards; a click on the
 * pavilion or the pool opens the heart (Homes.tsx raycasts its hit box).
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group, type Mesh } from "three";
import { LineCollector } from "@/canvas/world/houses/kit";
import { updateHouseLineResolution } from "@/canvas/world/houses/architecture";
import { PALETTE } from "@/lib/palette";
import { useJourney } from "@/lib/store";
import { smooth, stagesFromT } from "@/lib/timeline";
import { VILLAGE_HEART } from "@/lib/village";
import { damp } from "../Driver";
import { MARKER_PX } from "./FeaturedHome";
import { homeLineMaterial, markerMaterial } from "./materials";
import { homesState } from "./state";

const stagesScratch = stagesFromT(0);

const { pavilion: pv, pool } = VILLAGE_HEART;
/** In the gap between the pavilion's east end and the pool's west end. */
const AT: [number, number, number] = [(pv.x + pv.width / 2 + pool.x - pool.width / 2) / 2, pv.y, (pv.z + pool.z) / 2];
/** The marker's height above the pad (the homes' stand ~3.6 m over their roofs). */
const MARKER_Y = pv.height + 4.6;
/** The hit box: the pavilion (with its roof's overhang) and the pool. */
const HIT = {
  x0: pv.x - pv.width / 2 - 0.9,
  x1: pool.x + pool.width / 2,
  z0: Math.min(pv.z - pv.depth / 2, pool.z - pool.depth / 2) - 0.9,
  z1: Math.max(pv.z + pv.depth / 2, pool.z + pool.depth / 2) + 0.9,
  h: pv.height + 0.8,
};

export function HeartMarker() {
  const gl = useThree((s) => s.gl);
  const mats = useMemo(() => ({ marker: markerMaterial(), leader: homeLineMaterial({ color: PALETTE.sun, alpha: 0.95, width: 1.5 }) }), []);
  const geo = useMemo(() => {
    const point = new BufferGeometry();
    point.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
    const leader = new LineCollector();
    leader.seg([0, 0, 0], [0, 1, 0], 0, 1);
    return { point, leader: leader.build() };
  }, []);
  useEffect(
    () => () => {
      mats.marker.dispose();
      mats.leader.dispose();
      geo.point.dispose();
      geo.leader.dispose();
    },
    [mats, geo],
  );

  const group = useRef<Group>(null);
  const sim = useRef({ explore: 0, jewel: 0, hover: 0 });

  useFrame((_, dtRaw) => {
    const s = useJourney.getState();
    const dt = Math.min(dtRaw, 1 / 20);
    const st = sim.current;
    const snap = s.snap;
    const stages = stagesFromT(s.t, stagesScratch);
    const interactive = s.mode === "journey" && stages.homes > 0.5;
    const wantHover = interactive && (homesState.hover === "heart" || homesState.cardHover === "heart") ? 1 : 0;
    st.hover = snap ? wantHover : damp(st.hover, wantHover, 7, dt);
    const wantExplore = s.mode === "explore" ? 1 : 0;
    st.explore = snap ? wantExplore : damp(st.explore, wantExplore, 3, dt);
    const jw = stages.homes * (1 - st.explore);
    st.jewel = snap ? jw : damp(st.jewel, jw, 4, dt);
    const j = st.jewel;
    const g = group.current;
    if (g) g.visible = j > 0.002;
    if (j <= 0.002) return;
    updateHouseLineResolution(gl);
    mats.leader.uniforms.uProgress.value = smooth(0.25, 0.9, j);
    mats.leader.uniforms.uAlpha.value = 0.95 * smooth(0.2, 0.6, j);
    const mk = mats.marker.uniforms;
    mk.uAlpha.value = smooth(0.55, 1.0, j);
    mk.uHover.value = st.hover;
    mk.uSize.value = MARKER_PX * gl.getPixelRatio();
    mk.uScale.value = gl.getPixelRatio();
  });

  const registerProxy = (el: Mesh | null) => {
    if (el) homesState.proxies.set("heart", el);
    else homesState.proxies.delete("heart");
  };

  return (
    <group name="heart-marker">
      <group ref={group} visible={false} position={AT}>
        <group position={[0, 0.05, 0]} scale={[1, MARKER_Y - 0.3, 1]}>
          <mesh geometry={geo.leader} material={mats.leader} renderOrder={999} frustumCulled={false} />
        </group>
        <points geometry={geo.point} material={mats.marker} position={[0, MARKER_Y, 0]} renderOrder={1000} frustumCulled={false} />
      </group>
      {/* Hit proxy for the pointer (a cheap box raycast, see Homes.tsx). */}
      <mesh ref={registerProxy} position={[(HIT.x0 + HIT.x1) / 2, pv.y + HIT.h / 2, (HIT.z0 + HIT.z1) / 2]} visible={false}>
        <boxGeometry args={[HIT.x1 - HIT.x0, HIT.h, HIT.z1 - HIT.z0]} />
      </mesh>
    </group>
  );
}
