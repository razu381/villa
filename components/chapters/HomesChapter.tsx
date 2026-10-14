"use client";

import { COPY } from "@/lib/content";
import { ChapterText } from "./ChapterText";

/** PLACEHOLDER — DOM module owns the real chapter design. */
export function HomesChapter() {
  const c = COPY.homes;
  return <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.hint} dark={false} />;
}
