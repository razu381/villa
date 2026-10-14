"use client";

import { COPY } from "@/lib/content";
import { ChapterText } from "./ChapterText";

/** PLACEHOLDER — DOM module owns the real chapter design. */
export function MakingChapter() {
  const c = COPY.making;
  return <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} dark={false} />;
}
