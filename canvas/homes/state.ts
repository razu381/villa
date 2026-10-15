import type { Mesh } from "three";
import type { HomeId } from "@/lib/store";

/**
 * Transient pointer state for the featured homes (read in useFrame, never
 * rendered): the home under the pointer in the 3D scene, the home whose HTML
 * card is hovered or focused (so the card and the 3D jewel answer together),
 * and each home's invisible hit box (Homes.tsx raycasts against them).
 */
export const homesState: { hover: HomeId | null; cardHover: HomeId | null; proxies: Map<HomeId, Mesh> } = {
  hover: null,
  cardHover: null,
  proxies: new Map(),
};
