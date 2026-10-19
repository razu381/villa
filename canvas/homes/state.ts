import type { Mesh } from "three";
import type { HomeId } from "@/lib/store";

/** A featured home as it stands this frame (FeaturedHome writes it). */
export interface HomeLive {
  /** How far the floors are open, 0 → 1 (the explode tween). */
  open: number;
  /** Each level's lift above the pad (m): ground · upper · roof, hover included. */
  levelY: [number, number, number];
}

/**
 * Transient state for the featured homes (read in useFrame, never rendered):
 * the home under the pointer in the 3D scene, the home whose HTML card is
 * hovered or focused (so the card and the 3D jewel answer together), each
 * home's invisible hit box (Homes.tsx raycasts against them), and how each
 * home stands this frame (Spots.tsx places the photo pins by it).
 */
export const homesState: { hover: HomeId | null; cardHover: HomeId | null; proxies: Map<HomeId, Mesh>; live: Record<HomeId, HomeLive> } = {
  hover: null,
  cardHover: null,
  proxies: new Map(),
  live: {
    v3: { open: 0, levelY: [0, 0, 0] },
    v4: { open: 0, levelY: [0, 0, 0] },
  },
};
