"use client";

/**
 * Where the open place's photo pins stand on screen (lib/places.ts →
 * lib/anchors.ts SPOT_ANCHORS), each frame: a room's anchor
 * (canvas/homes/interiors.ts) rides on its level as the floors lift; points
 * outside (the villa's pool, the village heart) stand still. A room's pin
 * shows once its floors are open; a point outside a home hides while the
 * house stands between it and the camera. SPOT_VIEW tells the pins when the
 * camera is still (arrived, not turning, not gliding): they only show then,
 * never sliding along with a move.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Vector3 } from "three";
import { SPOT_ANCHORS, SPOT_VIEW } from "@/lib/anchors";
import { SPOTS, type Spot } from "@/lib/places";
import { useJourney, type HomeId } from "@/lib/store";
import { FEATURED, VILLA_POOLS, VILLAGE_HEART } from "@/lib/village";
import { buildHomeData } from "./homeData";
import { homesState } from "./state";

interface SpotPoint {
  spot: Spot;
  /** A room of this home (local to its level), or null: `at` is a world point. */
  home: HomeId | null;
  level: 0 | 1;
  at: [number, number, number];
  /** Hide while the home's centre is between it and the camera (outside a home). */
  farSide: HomeId | null;
}

/** Faster than this (m/s), the camera is moving: the pins wait. */
const STILL_SPEED = 0.6;

function resolve(): SpotPoint[] {
  const pool = VILLA_POOLS.find((p) => p.houseId === FEATURED.v4.id)!;
  const { pavilion: pv, pool: aqua } = VILLAGE_HEART;
  const roof = pv.y + pv.height + 0.3;
  const outside = {
    pool: [pool.x, pool.y + 0.5, pool.z],
    aqua: [aqua.x, aqua.y + 0.5, aqua.z],
    fitness: [pv.x - pv.width / 4, roof, pv.z],
    hub: [pv.x + pv.width / 4, roof, pv.z],
  } as const;
  const out: SpotPoint[] = [];
  for (const spot of SPOTS) {
    if (!spot.at) continue;
    if ("outside" in spot.at) {
      const home = spot.place === "heart" ? null : spot.place;
      out.push({ spot, home: null, level: 0, at: [...outside[spot.at.outside]], farSide: home });
      continue;
    }
    if (spot.place === "heart") continue;
    const data = buildHomeData(spot.place);
    for (const level of [0, 1] as const) {
      const a = data.levels[level].interior?.anchors[spot.at.room];
      if (a) {
        out.push({ spot, home: spot.place, level, at: [...a], farSide: null });
        break;
      }
    }
  }
  return out;
}

export function Spots() {
  const camera = useThree((s) => s.camera);
  const points = useMemo(resolve, []);
  const last = useRef(new Vector3());

  useFrame((state, dt) => {
    const s = useJourney.getState();
    const open = s.mode === "explore" ? s.home : null;
    const { width: w, height: h } = state.size;
    const speed = camera.position.distanceTo(last.current) / Math.max(dt, 1e-3);
    last.current.copy(camera.position);
    SPOT_VIEW.still = open != null && speed < STILL_SPEED;

    for (const p of points) {
      const a = SPOT_ANCHORS[p.spot.key];
      if (p.spot.place !== open) {
        a.visible = false;
        continue;
      }
      let shown = true;
      if (p.home) {
        const live = homesState.live[p.home];
        const f = FEATURED[p.home];
        const c = Math.cos(f.rotY);
        const sn = Math.sin(f.rotY);
        const [lx, ly, lz] = p.at;
        world.set(f.x + c * lx + sn * lz, f.y + live.levelY[p.level] + ly, f.z - sn * lx + c * lz);
        shown = live.open > 0.95;
      } else {
        world.fromArray(p.at);
      }
      if (p.farSide) {
        const f = FEATURED[p.farSide];
        shown &&= (world.x - f.x) * (camera.position.x - f.x) + (world.z - f.z) * (camera.position.z - f.z) > 0;
      }
      a.wx = world.x;
      a.wy = world.y;
      a.wz = world.z;
      ndc.copy(world).project(camera);
      a.x = (ndc.x * 0.5 + 0.5) * w;
      a.y = (-ndc.y * 0.5 + 0.5) * h;
      const inFront = ndc.z > -1 && ndc.z < 1;
      const onScreen = a.x > w * 0.03 && a.x < w * 0.97 && a.y > h * 0.06 && a.y < h * 0.96;
      a.visible = shown && inFront && onScreen;
    }
  });
  return null;
}

const world = new Vector3();
const ndc = new Vector3();
