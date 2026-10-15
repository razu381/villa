"use client";

import { COPY } from "@/lib/content";
import { Pin } from "../ui/Pin";
import { ChapterText } from "./ChapterText";

/** Morning — the houses rise as a white model. */
export function ModelChapter() {
  const c = COPY.model;
  return (
    <Pin>
      <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={2.08} to={2.95} />
    </Pin>
  );
}
