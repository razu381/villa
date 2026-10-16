"use client";

/**
 * One featured home (V3 townhouse or V4 villa).
 *
 * Journey: drawn with the same builder, materials and shader-driven stages as
 * the rest of the village (lines → rise → sweep → section poché → night
 * windows), so it is indistinguishable from its neighbours. In "Two ways to
 * live" it is presented as a jewel (a golden line drawing, a warm halo, a
 * small marker) and answers the pointer.
 *
 * Explore: the floors separate (a quart-out tween — no overshoot): the roof
 * lifts first, then the upper floor; each open level is cut in plan, showing
 * its rooms, furniture and the floor plan drawn on the slab. At dusk the
 * lamps come on.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group, type Material, type Mesh, type Points, type ShaderMaterial } from "three";
import {
  getHouseLineMaterial,
  getHouseMaskMaterial,
  getHouseSpillMaterial,
  updateHouseLineResolution,
} from "@/canvas/world/houses/architecture";
import { PALETTE } from "@/lib/palette";
import { useJourney, type HomeId } from "@/lib/store";
import { smooth, stagesFromT } from "@/lib/timeline";
import { U } from "@/lib/uniforms";
import { FEATURED } from "@/lib/village";
import { damp } from "../Driver";
import { buildHomeData, disposeHomeData } from "./homeData";
import {
  createHomeUniforms,
  haloMaterial,
  homeDepthMaterial,
  homeHouseMaterials,
  homeLineMaterial,
  interiorMaterial,
  lampMaterial,
  makeCutPlane,
  markerMaterial,
  poolMaterial,
} from "./materials";
import { homesState } from "./state";
import { HOME_ORDER } from "./Veil";

const ease = (k: number) => k * k * (3 - 2 * k);
/** Length of the explode / close tween (quart-out; the staggered levels make it read ~1.4 s). */
const EXPLODE_SECONDS = 2.2;

export function FeaturedHome({ id }: { id: HomeId }) {
  const spec = FEATURED[id];
  const data = useMemo(() => buildHomeData(id), [id]);
  const gl = useThree((s) => s.gl);

  const mats = useMemo(() => {
    const hu = createHomeUniforms();
    const cuts = [makeCutPlane(), makeCutPlane(), makeCutPlane()];
    // Furniture has planes of its own: they always follow the visible cut,
    // also in the shadow pass (the walls' shadow cut is lower, see below).
    const furnitureCuts = [makeCutPlane(), makeCutPlane()];
    const sets = homeHouseMaterials(cuts, hu);
    return {
      hu,
      cuts,
      furnitureCuts,
      sets,
      depths: [homeDepthMaterial(), homeDepthMaterial(), homeDepthMaterial()],
      interior: [interiorMaterial(furnitureCuts[0], hu), interiorMaterial(furnitureCuts[1], hu)],
      lamp: lampMaterial(hu),
      pool: poolMaterial(hu),
      plan: homeLineMaterial({ color: "#F6EEDF", alpha: 0.72, width: 1.0 }),
      guides: homeLineMaterial({ color: PALETTE.taupe, alpha: 0.55, width: 1.0, dashed: true }),
      gold: homeLineMaterial({ color: "#E9CF98", alpha: 0.85, width: 1.25 }),
      plot: homeLineMaterial({ color: "#EFD8A6", alpha: 0.9, width: 1.25 }),
      leader: homeLineMaterial({ color: PALETTE.sun, alpha: 0.9, width: 1.0 }),
      halo: haloMaterial(),
      marker: markerMaterial(),
      lineMat: getHouseLineMaterial(),
      maskMat: getHouseMaskMaterial(),
      spillMat: getHouseSpillMaterial(),
    };
  }, []);

  useEffect(
    () => () => {
      disposeHomeData(id);
      for (const set of mats.sets) Object.values(set).forEach((m) => m.dispose());
      [...mats.interior, ...mats.depths, mats.lamp, mats.pool, mats.plan, mats.guides, mats.gold, mats.plot, mats.leader, mats.halo, mats.marker].forEach((m) => m.dispose());
    },
    [id, mats],
  );

  const root = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const levelRefs = useRef<(Group | null)[]>([null, null, null]);
  const closed = useRef<Group>(null);
  const interiorRefs = useRef<(Group | null)[]>([null, null]);
  const houseMeshes = useRef<Mesh[]>([]);
  /** Opaque interior meshes (furniture, lamps): drawn after the veil with the house. */
  const interiorMeshes = useRef<Mesh[]>([]);
  const order = useRef(0);
  const spillRefs = useRef<(Mesh | null)[]>([null, null, null]);
  const lines = useRef<Mesh>(null);
  const mask = useRef<Mesh>(null);
  const guideRefs = useRef<(Group | null)[]>([null, null]);
  const jewel = useRef<Group>(null);
  const marker = useRef<Points>(null);

  // Plan cut constants (world y): what the eye sees, and what the sun sees.
  // While a level is open its cut walls cast shadows only from a low stub, so
  // a low sun rakes right across the open floors (the furniture still casts
  // its full shadows) — the gold floods through the separated floors.
  const cutY = useRef({ vis: [1e4, 1e4], sun: [1e4, 1e4] });
  const shadowHooks = useMemo(
    () =>
      [0, 1].map((k) => ({
        before: () => {
          mats.cuts[k].constant = cutY.current.sun[k];
        },
        after: () => {
          mats.cuts[k].constant = cutY.current.vis[k];
        },
      })),
    [mats],
  );

  // Explode tween and soft states.
  const sim = useRef({ x: 0, from: 0, to: 0, k: 1, hover: 0, jewel: 0, explore: 0 });

  const markerGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([0, 0, 0], 3));
    return g;
  }, []);
  useEffect(() => () => markerGeo.dispose(), [markerGeo]);

  const { box } = data;
  const markerY = box.height + 3.6;
  useEffect(() => {
    (mats.halo.uniforms.uHalf.value as { set: (x: number, y: number) => void }).set(box.hx + 0.4, box.hz + 0.4);
    mats.halo.uniforms.uPad.value = 3.2;
  }, [mats, box]);

  useFrame((state, dtRaw) => {
    const s = useJourney.getState();
    const dt = Math.min(dtRaw, 1 / 20);
    const st = sim.current;
    const snap = s.snap;
    const stages = stagesFromT(s.t);
    const selected = s.mode === "explore" && s.home === id;
    const target = selected ? Math.min(1, Math.max(0, s.explode)) : 0;

    // ---- explode: a quart-out tween towards store.explode (re-aimed from where
    // it is whenever the target moves — never a jump, never an overshoot).
    if (snap || s.reducedMotion) {
      st.x = st.from = st.to = target;
      st.k = 1;
    } else {
      if (target !== st.to) {
        st.from = st.x;
        st.to = target;
        st.k = 0;
      }
      if (st.k < 1) {
        st.k = Math.min(1, st.k + dt / EXPLODE_SECONDS);
        st.x = st.from + (st.to - st.from) * (1 - Math.pow(1 - st.k, 4));
      }
    }
    const e = Math.min(1, Math.max(0, st.x));

    // ---- levels: the roof lifts first, then the upper floor; then each level opens in plan.
    const k2 = ease(smooth(0.0, 0.72, e));
    const k1 = ease(smooth(0.1, 0.86, e));
    const c1 = ease(smooth(0.3, 0.9, e));
    const c0 = ease(smooth(0.4, 1.0, e));
    const y1 = data.lift[0] * k1;
    const y2 = data.lift[1] * k2;
    const L = levelRefs.current;
    if (L[1]) L[1].position.y = y1;
    if (L[2]) L[2].position.y = y2;
    // Closed homes draw merged (one call per material); open ones per level.
    const split = e > 0.0005;
    if (closed.current) closed.current.visible = !split;
    for (const g of L) if (g) g.visible = split;

    // Hover lift (journey only) — the whole home rises a hand's breadth.
    const interactive = s.mode === "journey" && stages.homes > 0.5;
    const cardHover = homesState.cardHover === id;
    const wantHover = interactive && (homesState.hover === id || cardHover) ? 1 : 0;
    st.hover = snap ? wantHover : damp(st.hover, wantHover, 7, dt);
    if (lift.current) lift.current.position.y = st.hover * 0.32;
    // (The jewel's own lift: a breath brighter than its neighbours, more under the pointer.)
    mats.hu.uHomeGlow.value = st.hover * 0.07 + st.jewel * 0.035;

    // Plan cut planes (world): y_pad + lift + cut height; "off" when closed.
    const i0 = data.levels[0].interior;
    const i1 = data.levels[1].interior;
    const pad = spec.y + st.hover * 0.32;
    const cy = cutY.current;
    if (e > 0.0005 && i0 && i1) {
      cy.vis[0] = pad + data.tops[0] + (i0.cutY - data.tops[0]) * c0;
      cy.vis[1] = pad + y1 + data.tops[1] + (i1.cutY - data.tops[1]) * c1;
      cy.sun[0] = pad + data.tops[0] + (i0.floorY + 0.12 - data.tops[0]) * c0;
      cy.sun[1] = pad + y1 + data.tops[1] + (i1.floorY + 0.12 - data.tops[1]) * c1;
    } else {
      cy.vis[0] = cy.vis[1] = cy.sun[0] = cy.sun[1] = 1e4;
    }
    mats.cuts[0].constant = cy.vis[0];
    mats.cuts[1].constant = cy.vis[1];
    mats.furnitureCuts[0].constant = cy.vis[0];
    mats.furnitureCuts[1].constant = cy.vis[1];
    mats.cuts[2].constant = 1e4;
    mats.hu.uOpen[0].value = e > 0.0005 ? Math.max(c0, smooth(0.05, 0.3, e)) : 0;
    mats.hu.uOpen[1].value = e > 0.0005 ? Math.max(c1, smooth(0.05, 0.3, e)) : 0;
    mats.hu.uStudio.value = smooth(0.15, 0.85, e);

    // Interiors: only while open (they live inside the closed shells otherwise).
    const open = e > 0.01;
    for (const g of interiorRefs.current) if (g) g.visible = open;
    mats.plan.uniforms.uProgress.value = smooth(0.55, 1.0, e);
    mats.guides.uniforms.uProgress.value = smooth(0.62, 1.0, e);
    const G = guideRefs.current;
    if (G[0] && i0) {
      G[0].visible = e > 0.3;
      const a = 0.02;
      const b = data.build.levels[1].y0 - 0.06 + y1;
      G[0].position.y = a;
      G[0].scale.y = Math.max(0.01, b - a);
    }
    if (G[1] && i1) {
      G[1].visible = e > 0.3;
      const a = i1.cutY + y1;
      const b = data.build.levels[2].y0 - 0.06 + y2;
      G[1].position.y = a;
      G[1].scale.y = Math.max(0.01, b - a);
    }

    // Lamps: warm interiors once the held sun passes ~sunset.
    mats.hu.uLamp.value = smooth(0.8, 0.9, U.uDay.value);

    // While this home is the chosen one it draws after the veil (Veil.tsx), so
    // the village recedes and the home does not; in "Two ways to live" both
    // featured homes do. (Glass stays in the transparent pass.)
    const wantOrder = s.home === id || (s.mode === "journey" && stages.homes > 0) ? HOME_ORDER : 0;
    if (wantOrder !== order.current) {
      order.current = wantOrder;
      for (const m of houseMeshes.current) if (!(m.material as Material).transparent) m.renderOrder = wantOrder;
      for (const m of interiorMeshes.current) m.renderOrder = wantOrder;
    }

    // ---- build stages, exactly like canvas/world/Houses.tsx
    const risen = U.uRise.value > 0.0005;
    for (const m of houseMeshes.current) m.visible = risen;
    const drawing = U.uLines.value > 0.0005 && U.uMaterial.value < 0.999;
    if (lines.current) lines.current.visible = drawing;
    if (drawing) updateHouseLineResolution(gl);
    if (mask.current) mask.current.visible = drawing && U.uRise.value < 0.999;
    for (const sp of spillRefs.current) if (sp) sp.visible = U.uWindows.value > 0.001;

    // ---- the jewel: golden drawing, halo and marker in "Two ways to live".
    const wantExplore = s.mode === "explore" ? 1 : 0;
    st.explore = snap ? wantExplore : damp(st.explore, wantExplore, 3, dt);
    const jw = stages.homes * (1 - st.explore);
    st.jewel = snap ? jw : damp(st.jewel, jw, 4, dt);
    const j = st.jewel;
    if (jewel.current) jewel.current.visible = j > 0.002;
    if (j > 0.002) {
      updateHouseLineResolution(gl);
      const gold = mats.gold.uniforms;
      gold.uProgress.value = Math.min(1, j * 1.15);
      gold.uAlpha.value = (0.6 + 0.3 * st.hover) * smooth(0.0, 0.35, j);
      const plot = mats.plot.uniforms;
      plot.uProgress.value = smooth(0.0, 0.85, j);
      plot.uAlpha.value = (0.62 + 0.3 * st.hover) * (1 - 0.35 * U.uNight.value);
      mats.leader.uniforms.uProgress.value = smooth(0.25, 0.9, j);
      mats.leader.uniforms.uAlpha.value = 0.9 * smooth(0.2, 0.6, j);
      const mk = mats.marker.uniforms;
      mk.uAlpha.value = smooth(0.55, 1.0, j);
      mk.uHover.value = st.hover;
      mk.uSize.value = 34 * gl.getPixelRatio();
      const ha = mats.halo.uniforms;
      ha.uAlpha.value = (0.15 + 0.1 * st.hover) * smooth(0.1, 0.8, j) * (1 - 0.5 * U.uNight.value);
    }
  });

  const registerProxy = (el: Mesh | null) => {
    if (el) homesState.proxies.set(id, el);
    else homesState.proxies.delete(id);
  };
  const pushInterior = (el: Mesh | null) => {
    if (el && !interiorMeshes.current.includes(el)) interiorMeshes.current.push(el);
  };

  return (
    <group ref={root} name={`home-${id}`} position={[spec.x, spec.y, spec.z]} rotation-y={spec.rotY}>
      <group ref={lift}>
        {/* Closed: one mesh per material (the journey). */}
        <group ref={closed}>
          {data.merged.map((p) => (
            <mesh
              key={p.material}
              ref={(el) => {
                if (el && !houseMeshes.current.includes(el)) houseMeshes.current.push(el);
              }}
              geometry={p.geometry}
              material={mats.sets[2][p.material]}
              customDepthMaterial={mats.depths[2]}
              castShadow={p.material !== "glass"}
              receiveShadow
              renderOrder={p.material === "glass" ? 2 : 0}
            />
          ))}
          {data.build.spill && (
            <mesh
              ref={(el) => {
                spillRefs.current[2] = el;
              }}
              geometry={data.build.spill}
              material={mats.spillMat}
              renderOrder={2}
              frustumCulled={false}
            />
          )}
        </group>
        {/* Open: per level, lifted apart. */}
        {data.levels.map((lv) => (
          <group
            key={lv.level}
            ref={(el) => {
              levelRefs.current[lv.level] = el;
            }}
            visible={false}
          >
            {lv.parts.map((p, i) => (
              <mesh
                key={i}
                ref={(el) => {
                  if (!el) return;
                  if (!houseMeshes.current.includes(el)) houseMeshes.current.push(el);
                  if (p.set < 2) {
                    el.onBeforeShadow = shadowHooks[p.set].before;
                    el.onAfterShadow = shadowHooks[p.set].after;
                  }
                }}
                geometry={p.geometry}
                material={mats.sets[p.set][p.material]}
                customDepthMaterial={mats.depths[p.set]}
                castShadow={p.material !== "glass"}
                receiveShadow
                renderOrder={p.material === "glass" ? 2 : 0}
              />
            ))}
            {lv.spill && (
              <mesh
                ref={(el) => {
                  spillRefs.current[lv.level === 0 ? 0 : 1] = el;
                }}
                geometry={lv.spill}
                material={mats.spillMat}
                renderOrder={2}
                frustumCulled={false}
              />
            )}
            {lv.interior && lv.level < 2 && (
              <group
                ref={(el) => {
                  interiorRefs.current[lv.level] = el;
                }}
                visible={false}
              >
                <mesh ref={pushInterior} geometry={lv.interior.furniture} material={mats.interior[lv.level]} castShadow receiveShadow />
                {lv.interior.lamps && <mesh ref={pushInterior} geometry={lv.interior.lamps} material={mats.lamp} />}
                {lv.interior.pools && <mesh geometry={lv.interior.pools} material={mats.pool} renderOrder={3} />}
                <mesh geometry={lv.interior.plan} material={mats.plan} renderOrder={4} frustumCulled={false} />
              </group>
            )}
          </group>
        ))}
        {/* Exploded-view guides between the floors (scaled per gap each frame). */}
        {[0, 1].map((i) => (
          <group
            key={`g${i}`}
            ref={(el) => {
              guideRefs.current[i] = el;
            }}
            visible={false}
          >
            <mesh geometry={data.guides[i]} material={mats.guides} renderOrder={4} frustumCulled={false} />
          </group>
        ))}
        {/* The architect's drawing for the build stage (same as the village). */}
        <mesh ref={mask} geometry={data.mask} material={mats.maskMat} renderOrder={998} frustumCulled={false} />
        <mesh ref={lines} geometry={data.lines} material={mats.lineMat} renderOrder={999} frustumCulled={false} />
        {/* The jewel. */}
        <group ref={jewel} visible={false}>
          <mesh geometry={data.lines} material={mats.gold} renderOrder={999} frustumCulled={false} />
          <mesh geometry={data.plot} material={mats.plot} renderOrder={999} frustumCulled={false} />
          <mesh position={[box.cx, 0.2, box.cz]} rotation-x={-Math.PI / 2} material={mats.halo} renderOrder={3}>
            <planeGeometry args={[box.hx * 2 + 7, box.hz * 2 + 7]} />
          </mesh>
          <group position={[box.cx, box.height + 0.35, box.cz]} scale={[1, markerY - box.height - 0.35 - 0.25, 1]}>
            <mesh geometry={data.leader} material={mats.leader} renderOrder={999} frustumCulled={false} />
          </group>
          <points ref={marker} geometry={markerGeo} material={mats.marker} position={[box.cx, markerY, box.cz]} renderOrder={1000} frustumCulled={false} />
        </group>
      </group>
      {/* Hit proxy for the pointer (a cheap box raycast — see Homes.tsx). */}
      <mesh ref={registerProxy} position={[box.cx, box.height / 2, box.cz]} visible={false}>
        <boxGeometry args={[box.hx * 2 + 0.6, box.height + 0.8, box.hz * 2 + 0.6]} />
      </mesh>
    </group>
  );
}
