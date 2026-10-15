import type { HomeId } from "@/lib/store";

/**
 * Transient pointer state for the featured homes (read in useFrame, never
 * rendered): the home under the pointer in the 3D scene, and the home whose
 * HTML card is hovered or focused (so the card and the 3D jewel answer together).
 */
export const homesState: { hover: HomeId | null; cardHover: HomeId | null } = {
  hover: null,
  cardHover: null,
};
