/**
 * Annotation anchors for the section chapter's legend.
 *
 * SECTION_ANCHORS is a plain module-level object, rewritten every frame by the
 * section module with the screen position (CSS px, from the canvas's top-left)
 * of three world points, so the HTML layer can draw hairline leader lines to
 * them without any React re-render:
 *
 *   import { SECTION_ANCHORS } from "@/canvas/section/anchors";
 *   // in a rAF / gsap ticker:
 *   const a = SECTION_ANCHORS.parking; if (a.visible) drawLeader(a.x, a.y);
 *
 * `visible` is true only while the point is in front of the camera, inside
 * the viewport (with a margin), not cut away by the section, and its subject
 * is on show in the chapter (t ≈ 4.2 → 4.98).
 */
import type { Camera } from "three";
import { Vector3 } from "three";
import { PATH_WIDTH, PLAYGROUND, TERRACES } from "@/lib/village";
import { smooth } from "@/lib/timeline";
import { AISLE_Z, HALL } from "./layout";

export interface SectionAnchor {
  /** CSS px from the canvas's left edge. */
  x: number;
  /** CSS px from the canvas's top edge. */
  y: number;
  visible: boolean;
}

export const SECTION_ANCHORS: { parking: SectionAnchor; streets: SectionAnchor; playground: SectionAnchor } = {
  parking: { x: 0, y: 0, visible: false },
  streets: { x: 0, y: 0, visible: false },
  playground: { x: 0, y: 0, visible: false },
};

/** World points the anchors follow. */
export const ANCHOR_POINTS = {
  /** In the lit hall: the aisle, just behind the cut. */
  parking: new Vector3(-14, HALL.y0 + 1.0, AISLE_Z + 4.0),
  /** On the car-free lane in front of row B, in the gap between the row-C blocks. */
  streets: new Vector3(-36, TERRACES[2].y + 0.15, -4.6 + PATH_WIDTH * 0),
  /** The botanical playground's heart. */
  playground: new Vector3((PLAYGROUND.minX + PLAYGROUND.maxX) / 2, PLAYGROUND.y + 0.6, (PLAYGROUND.minZ + PLAYGROUND.maxZ) / 2),
};

const ndc = new Vector3();

function project(a: SectionAnchor, p: Vector3, camera: Camera, w: number, h: number, show: boolean, cutZ: number) {
  ndc.copy(p).project(camera);
  a.x = (ndc.x * 0.5 + 0.5) * w;
  a.y = (-ndc.y * 0.5 + 0.5) * h;
  const inFront = ndc.z > -1 && ndc.z < 1;
  const onScreen = a.x > w * 0.02 && a.x < w * 0.98 && a.y > h * 0.04 && a.y < h * 0.96;
  a.visible = show && inFront && onScreen && p.z <= cutZ;
}

/** Called once per frame after the camera has moved (Section.tsx). */
export function updateSectionAnchors(camera: Camera, w: number, h: number, t: number, section: number, cutZ: number) {
  const inChapter = t > 4.2 && t < 4.98;
  project(SECTION_ANCHORS.parking, ANCHOR_POINTS.parking, camera, w, h, inChapter && section > 0.9, cutZ);
  project(SECTION_ANCHORS.streets, ANCHOR_POINTS.streets, camera, w, h, inChapter && smooth(4.3, 4.45, t) > 0.5, cutZ);
  project(SECTION_ANCHORS.playground, ANCHOR_POINTS.playground, camera, w, h, inChapter, cutZ);
}
