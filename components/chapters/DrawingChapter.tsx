"use client";

import { COPY } from "@/lib/content";
import { Pin } from "../ui/Pin";
import { ChapterText } from "./ChapterText";

/** Dawn — contours and the architect's line drawing trace in. */
export function DrawingChapter() {
  const c = COPY.drawing;
  return (
    <Pin>
      <ChapterText eyebrow={c.eyebrow} title={c.title} body={c.body} from={1.06} to={1.95} />
    </Pin>
  );
}
