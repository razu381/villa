"use client";

import { COPY } from "@/lib/content";
import { ChapterText } from "./ChapterText";

/** PLACEHOLDER — DOM module owns the real chapter design. */
export function NightChapter() {
  const c = COPY.night;
  return <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} dark={true} />;
}
