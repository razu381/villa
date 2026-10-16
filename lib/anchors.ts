/**
 * Screen positions of the section chapter's legend subjects (CSS px from the
 * canvas's top-left), rewritten every frame by the 3D (canvas/section/anchors.ts)
 * and read by the legend's leader lines (components/chapters/CarsChapter.tsx).
 * A plain object with no three.js import, so the HTML layer can read it without
 * pulling the 3D into its bundle.
 */
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
