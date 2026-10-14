"use client";

import { COPY } from "@/lib/content";
import { ChapterText } from "./ChapterText";

/** PLACEHOLDER — DOM module owns the real chapter design. */
export function DrawingChapter() {
  const c = COPY.drawing;
  return <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} dark={false} />;
}
