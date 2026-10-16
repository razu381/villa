"use client";

/**
 * "Cars below. Life above." — the section chapter (t ≈ 3.85 → 5.1).
 *
 *   - the garage hall under terraces B and C and the tunnel from the portal:
 *     one merged shell of closed solids (poché where cut), lit by its own
 *     soffit strips (Garage)
 *   - the section cap: a depth-only seal on the cut face, open where the cut
 *     crosses the hall or the tunnel, so the earth reads solid (Cap)
 *   - model cars, instanced: parked ones, and a few that arrive from the
 *     street, turn into the portal, glide down the aisle and ease into bays
 *   - life above: luminous hairlines along the car-free lanes (Life), and
 *     furnished rooms in the houses the plane cuts (Interiors)
 *   - annotation anchors for the HTML legend (anchors.ts)
 *
 * While the section is closed the tunnel is seen through the real portal
 * opening (glsl.ts sec_portalDepth), so the landscape's portal back face is
 * hidden for the whole chapter.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  type Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  type Mesh,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import { mulberry32 } from "@/lib/noise";
import { useJourney } from "@/lib/store";
import { sectionPlane, U } from "@/lib/uniforms";
import { PLINTH } from "@/lib/village";
import { SECTION_ANCHORS, updateSectionAnchors } from "./anchors";
import { buildArrivals, buildCarGeometry, buildCarShadowGeometry, arrivalS, roadY } from "./cars";
import { OUTLINES, buildGarage } from "./garageGeometry";
import { SU } from "./glsl";
import { BAY_ROWS, CAR_PAINTS, PARKED, PORTAL_MOUTH_Z } from "./layout";
import { SectionInteriors } from "./Interiors";
import { Life } from "./Life";
import { createCapMaterial, createCarMaterial, createShadowMaterial, createShellMaterial } from "./materials";

/** The chapter's window (with margins for the camera's arrival and departure). */
const ACTIVE: [number, number] = [3.84, 5.14];

const DBG = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("secdbg") ?? "" : "";

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);
const _tan = new Vector3();
const _up = new Vector3(0, 1, 0);
const _zero = new Vector3(0, 0, 0);

export function Section() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const group = useRef<Group>(null);
  const cap = useRef<Mesh>(null);
  const portalBack = useRef<Object3D | null>(null);

  const garage = useMemo(() => buildGarage(), []);
  const shell = useMemo(() => createShellMaterial(), []);
  const capMat = useMemo(() => createCapMaterial(), []);
  const capGeo = useMemo(() => {
    const g = new PlaneGeometry(PLINTH.maxX - PLINTH.minX, 34);
    g.translate((PLINTH.minX + PLINTH.maxX) / 2, PLINTH.bottom + 17, 0);
    return g;
  }, []);

  /* --------------------------------------------------------------- cars */
  const arrivals = useMemo(() => buildArrivals(), []);
  const cars = useMemo(() => {
    const geo = buildCarGeometry();
    const mat = createCarMaterial();
    const count = arrivals.length + PARKED.length;
    const mesh = new InstancedMesh(geo, mat, count);
    const paint = new Float32Array(count * 3);
    const lamp = new Float32Array(count);
    const c = new Color();
    const rand = mulberry32(9);
    arrivals.forEach((a, i) => {
      c.set(CAR_PAINTS[a.paint]); // Color.set already lands in the linear working space
      paint.set([c.r, c.g, c.b], i * 3);
    });
    PARKED.forEach((b, j) => {
      const i = arrivals.length + j;
      c.set(CAR_PAINTS[Math.floor(rand() * CAR_PAINTS.length)]);
      paint.set([c.r, c.g, c.b], i * 3);
      const z = b.row === "north" ? BAY_ROWS.north : BAY_ROWS.south;
      const reversed = rand() < 0.3;
      const yaw = (b.row === "north" ? 0 : Math.PI) + (reversed ? Math.PI : 0) + (rand() - 0.5) * 0.035;
      _q.setFromAxisAngle(_up, yaw);
      _p.set(b.x + (rand() - 0.5) * 0.16, roadY(z), z + (rand() - 0.5) * 0.3);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    geo.setAttribute("aPaint", new InstancedBufferAttribute(paint, 3));
    const lampAttr = new InstancedBufferAttribute(lamp, 1);
    geo.setAttribute("aLamp", lampAttr);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    const shadow = new InstancedMesh(buildCarShadowGeometry(), createShadowMaterial(), count);
    shadow.instanceMatrix = mesh.instanceMatrix;
    shadow.frustumCulled = false;
    shadow.renderOrder = 5;
    return { mesh, shadow, lampAttr };
  }, [arrivals]);

  useEffect(
    () => () => {
      garage.dispose();
      shell.dispose();
      capMat.mat.dispose();
      capGeo.dispose();
      cars.mesh.geometry.dispose();
      (cars.mesh.material as { dispose(): void }).dispose();
      cars.shadow.geometry.dispose();
      (cars.shadow.material as { dispose(): void }).dispose();
      if (portalBack.current) portalBack.current.visible = true;
    },
    [garage, shell, capMat, capGeo, cars],
  );

  useEffect(() => {
    if (!DBG) return;
    const w = window as unknown as { __VL_SCENE?: unknown; __VL_SECTION_ANCHORS?: unknown };
    w.__VL_SCENE = scene;
    w.__VL_SECTION_ANCHORS = SECTION_ANCHORS;
  }, [scene]);

  useFrame((state) => {
    const s = useJourney.getState();
    const t = s.t;
    const active = t > ACTIVE[0] && t < ACTIVE[1];
    if (group.current && group.current.visible !== active) group.current.visible = active;

    // the landscape's portal back face: hidden while the tunnel is ours to show
    if (!portalBack.current) portalBack.current = scene.getObjectByName("landscape-portal-back") ?? null;
    if (portalBack.current) portalBack.current.visible = !active;

    if (DBG.includes("hide:")) {
      const names = DBG.split("hide:")[1].split("|");
      scene.traverse((o) => {
        if (names.some((n) => o.name === n || (n.endsWith("*") && o.name.startsWith(n.slice(0, -1))))) o.visible = false;
      });
    }
    const cutZ = sectionPlane.constant;
    SU.uSecPortal.value = active && cutZ > PORTAL_MOUTH_Z + 0.4 ? 1 : 0;
    camera.updateMatrixWorld();
    SU.uSecViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    // the section cap: only while the plane cuts the plinth
    if (cap.current) {
      const on = active && cutZ < PLINTH.maxZ + 0.5;
      cap.current.visible = on;
      cap.current.position.z = cutZ - 0.004;
      const u = capMat.uniforms;
      u.uCutZ.value = cutZ;
      const h = OUTLINES.hall;
      const tb = OUTLINES.tube;
      if (cutZ > h.z0 && cutZ < h.z1 + 0.02) u.uHoleA.value.set(h.x0, h.x1, h.y0, h.y1);
      else u.uHoleA.value.set(0, 0, 1, 0);
      if (cutZ > tb.z0 && cutZ < tb.z1 + 0.02) u.uHoleB.value.set(tb.x0, tb.x1, tb.y0, tb.y1);
      else u.uHoleB.value.set(0, 0, 1, 0);
    }

    // arriving cars
    if (active) {
      const lamp = cars.lampAttr.array as Float32Array;
      arrivals.forEach((a, i) => {
        const sArc = arrivalS(a, t);
        if (sArc < 0) {
          cars.mesh.setMatrixAt(i, _m.compose(_zero, _q.identity(), _zero));
          lamp[i] = 0;
          return;
        }
        const u = Math.min(1, sArc / a.length);
        a.curve.getPointAt(u, _p);
        a.curve.getTangentAt(Math.min(u, 0.9999), _tan);
        _q.setFromAxisAngle(_up, Math.atan2(-_tan.x, -_tan.z));
        _p.y = roadY(_p.z);
        cars.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        // lamps on while driving, dimming once parked
        const tEnd = a.keys[a.keys.length - 1][0];
        lamp[i] = 1 - Math.min(1, Math.max(0, (t - tEnd) / 0.035));
      });
      cars.mesh.instanceMatrix.needsUpdate = true;
      cars.lampAttr.needsUpdate = true;
    }

    updateSectionAnchors(camera, state.size.width, state.size.height, t, U.uSection.value, cutZ);
  }, -10);

  return (
    <>
      <group ref={group} name="section" visible={false}>
        {!DBG.includes("cap") && <mesh ref={cap} geometry={capGeo} material={capMat.mat} renderOrder={3} frustumCulled={false} />}
        {!DBG.includes("shell") && <mesh geometry={garage} material={shell} renderOrder={4} castShadow receiveShadow frustumCulled={false} />}
        {!DBG.includes("cars") && <primitive object={cars.mesh} />}
        {!DBG.includes("shadow") && <primitive object={cars.shadow} />}
        {!DBG.includes("rooms") && <SectionInteriors />}
      </group>
      {!DBG.includes("life") && <Life />}
    </>
  );
}
