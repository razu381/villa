"use client";

import { COPY } from "@/lib/content";

/** PLACEHOLDER — DOM module owns the real chapter design. */
export function HeroChapter() {
  return (
    <div style={{ position: "sticky", top: 0, height: "100svh", display: "grid", placeItems: "center", color: "var(--text-on-dark)", textAlign: "center" }}>
      <div>
        <p style={{ letterSpacing: "0.32em", fontSize: 12 }}>{COPY.hero.eyebrow}</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(48px, 8vw, 120px)", margin: "12px 0" }}>Vila Leku</h1>
        <p>{COPY.hero.line}</p>
      </div>
    </div>
  );
}
