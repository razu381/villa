"use client";

import dynamic from "next/dynamic";
import { CHAPTERS } from "@/lib/timeline";
import { SmoothScroll } from "./SmoothScroll";
import { HeroVideo } from "./HeroVideo";
import { Chrome } from "./chrome/Chrome";
import { HeroChapter } from "./chapters/HeroChapter";
import { DrawingChapter } from "./chapters/DrawingChapter";
import { ModelChapter } from "./chapters/ModelChapter";
import { MakingChapter } from "./chapters/MakingChapter";
import { CarsChapter } from "./chapters/CarsChapter";
import { HomesChapter } from "./chapters/HomesChapter";
import { NightChapter } from "./chapters/NightChapter";

// The 3D world loads after first paint, hidden behind the hero film.
const Experience = dynamic(() => import("@/canvas/Experience"), { ssr: false });

const CHAPTER_COMPONENTS = {
  hero: HeroChapter,
  drawing: DrawingChapter,
  model: ModelChapter,
  making: MakingChapter,
  cars: CarsChapter,
  homes: HomesChapter,
  night: NightChapter,
} as const;

export default function Journey() {
  return (
    <>
      <SmoothScroll />
      <div className="vl-stage">
        <Experience />
      </div>
      <HeroVideo />
      <main className="vl-journey">
        {CHAPTERS.map((c) => {
          const C = CHAPTER_COMPONENTS[c.id];
          return (
            <section key={c.id} id={c.id} data-chapter={c.id} className="vl-chapter" style={{ height: `${c.length * 100}svh` }} aria-label={c.label}>
              <C />
            </section>
          );
        })}
      </main>
      <Chrome />
    </>
  );
}
