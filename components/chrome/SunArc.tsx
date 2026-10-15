"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@/lib/content";
import { useJourney } from "@/lib/store";
import { CHAPTERS, clamp01, smooth } from "@/lib/timeline";
import { arcLengthForDay, arcPointForDay, buildArc, dayForPoint } from "@/lib/ui-arc";
import { UI } from "@/lib/ui-copy";
import { scrollToChapter } from "@/lib/ui-scroll";
import { chapterAt, damp, timeWord, timeWordForDay } from "@/lib/ui-time";

/** Padding around the arch box inside the SVG (room for the halo and the handle). */
const P = 14;

/**
 * The signature: one brand arch is the sun's path. The disc travels it with the
 * effective day — dawn at the left foot, noon at the top, dusk at the right foot,
 * night past it as a pale moon. A tiny wide-tracked time word, no numbers.
 *
 * Journey mode: tap → chapter index. Explore mode: the disc becomes a handle —
 * "hold the sun" (pointer + keyboard, role=slider) writes store.sunOverride.
 */
export function SunArc() {
  const mode = useJourney((s) => s.mode);
  const explore = mode === "explore";
  const g = useMemo(() => buildArc(58, 66), []);
  const vb = { x: -P, y: -P, w: g.w + g.ext + 2 * P, h: g.h + 2 * P };

  const progressRef = useRef<SVGPathElement>(null);
  const discRef = useRef<SVGGElement>(null);
  const sunRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const moonRef = useRef<SVGCircleElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shown = useRef<number | null>(null);
  const raf = useRef(0);
  const [indexOpen, setIndexOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Store → disc, progress, word. Damped so leaving "hold the sun" glides home.
  useEffect(() => {
    const pt = { x: 0, y: 0 };
    let last = performance.now();
    const draw = (d: number) => {
      arcPointForDay(g, d, pt);
      discRef.current?.setAttribute("transform", `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
      const len = arcLengthForDay(g, d);
      progressRef.current?.setAttribute("stroke-dasharray", `${len.toFixed(2)} ${(g.length + 40).toFixed(2)}`);
      const night = smooth(0.8, 0.92, d);
      sunRef.current?.setAttribute("opacity", (1 - night).toFixed(3));
      haloRef.current?.setAttribute("opacity", (0.26 * (1 - night)).toFixed(3));
      moonRef.current?.setAttribute("opacity", night.toFixed(3));
    };
    const target = () => {
      const s = useJourney.getState();
      return s.sunOverride ?? s.journeyDay;
    };
    const loop = () => {
      const s = useJourney.getState();
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const tg = target();
      const cur = shown.current ?? tg;
      const next = s.snap || s.reducedMotion ? tg : damp(cur, tg, s.sunOverride != null ? 18 : 7, dt);
      shown.current = Math.abs(next - tg) < 1e-4 ? tg : next;
      draw(shown.current);
      raf.current = shown.current === tg ? 0 : requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf.current) {
        last = performance.now();
        raf.current = requestAnimationFrame(loop);
      }
    };
    const writeWord = () => {
      const s = useJourney.getState();
      const w = timeWord(s);
      if (wordRef.current && wordRef.current.textContent !== w) wordRef.current.textContent = w;
      // The scale label under the sun steps aside (never "dusk" twice).
      if (rootRef.current && rootRef.current.dataset.word !== w) rootRef.current.dataset.word = w;
      // The index button announces where the day is.
      const label = `${UI.arc.open} — ${UI.arc.now}: ${w}`;
      if (btnRef.current && btnRef.current.getAttribute("aria-label") !== label) btnRef.current.setAttribute("aria-label", label);
      const sl = sliderRef.current;
      if (sl) {
        const v = s.sunOverride ?? s.journeyDay;
        sl.setAttribute("aria-valuenow", String(Math.round(v * 100)));
        sl.setAttribute("aria-valuetext", timeWordForDay(v));
      }
    };
    shown.current = null;
    draw(target());
    shown.current = target();
    writeWord();
    const unsub = useJourney.subscribe((s, p) => {
      if (s.journeyDay !== p.journeyDay || s.sunOverride !== p.sunOverride) kick();
      if (s.t !== p.t || s.sunOverride !== p.sunOverride || s.journeyDay !== p.journeyDay) writeWord();
    });
    return () => {
      unsub();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [g, explore]);

  /* ------------------------------------------------------- hold the sun */
  const dragging = useRef(false);
  const setFromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * vb.w + vb.x;
    const y = ((e.clientY - r.top) / r.height) * vb.h + vb.y;
    useJourney.getState().setSunOverride(clamp01(dayForPoint(g, x, y)));
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    if (rootRef.current) {
      rootRef.current.dataset.dragging = "1";
      // The hint has done its job once the sun has been held.
      rootRef.current.dataset.held = "1";
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    setFromPointer(e);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setFromPointer(e);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (rootRef.current) rootRef.current.dataset.dragging = "0";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = useJourney.getState();
    const v = s.sunOverride ?? s.journeyDay;
    const step = { ArrowRight: 0.02, ArrowUp: 0.02, ArrowLeft: -0.02, ArrowDown: -0.02, PageUp: 0.1, PageDown: -0.1 } as Record<string, number>;
    let next: number | null = null;
    if (e.key in step) next = v + step[e.key];
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next != null) {
      e.preventDefault();
      s.setSunOverride(clamp01(next));
      if (rootRef.current) rootRef.current.dataset.held = "1";
    }
  };

  // Close the chapter index when exploring starts; a new explore shows the hint again.
  useEffect(() => {
    if (explore) setIndexOpen(false);
    if (rootRef.current) rootRef.current.dataset.held = "0";
  }, [explore]);

  // While the index is open, the chapter text steps back.
  useEffect(() => {
    document.documentElement.dataset.index = indexOpen ? "1" : "0";
  }, [indexOpen]);

  const size = { width: vb.w, height: vb.h };

  return (
    <div ref={rootRef} className="vl-arc" data-explore={explore ? "1" : "0"} data-open={indexOpen ? "1" : "0"} data-dragging="0" data-held="0" style={{ ["--arc-w" as string]: `${g.w}px`, ["--arc-h" as string]: `${g.h}px`, ["--arc-p" as string]: `${P}px`, ["--arc-ext" as string]: `${g.ext}px` }}>
      {indexOpen && !explore && <ChapterIndex onClose={() => setIndexOpen(false)} returnFocus={btnRef} />}

      <div className="vl-arc__stage" style={size}>
        <svg ref={svgRef} className="vl-arc__svg" width={vb.w} height={vb.h} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} aria-hidden="true">
          <path className="vl-arc__horizon" d={g.horizon} />
          <path className="vl-arc__path" d={g.d} />
          <path ref={progressRef} className="vl-arc__progress" d={g.d} />
          <g ref={discRef}>
            <circle className="vl-arc__ring" r={11} />
            <circle ref={haloRef} className="vl-arc__halo" r={9} />
            <circle ref={sunRef} className="vl-arc__sun" r={4.2} />
            <circle ref={moonRef} className="vl-arc__moon" r={3.9} opacity={0} />
          </g>
        </svg>

        <span className="vl-arc__label vl-arc__label--dawn" aria-hidden="true">
          {UI.arc.labels[0]}
        </span>
        <span className="vl-arc__label vl-arc__label--noon" aria-hidden="true">
          {UI.arc.labels[1]}
        </span>
        <span className="vl-arc__label vl-arc__label--dusk" aria-hidden="true">
          {UI.arc.labels[2]}
        </span>

        {explore ? (
          <div
            ref={sliderRef}
            className="vl-arc__slider"
            data-cursor="drag"
            role="slider"
            tabIndex={0}
            aria-label={UI.arc.slider}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-orientation="horizontal"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          />
        ) : (
          <button
            ref={btnRef}
            type="button"
            className="vl-arc__btn"
            aria-haspopup="dialog"
            aria-expanded={indexOpen}
            aria-label={UI.arc.open}
            onClick={() => setIndexOpen((o) => !o)}
          />
        )}
      </div>

      <span ref={wordRef} className="vl-arc__word" aria-live="off">
        {CHAPTERS[0].time}
      </span>
      <p className="vl-arc__hint" aria-hidden={!explore}>
        {COPY.homes.hint}
      </p>
    </div>
  );
}

function ChapterIndex({ onClose, returnFocus }: { onClose: () => void; returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const current = useJourney((s) => chapterAt(s.t));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLButtonElement>('button[aria-current="step"]') ?? ref.current?.querySelector<HTMLButtonElement>("button");
    first?.focus({ preventScroll: true });
    const btn = returnFocus.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      const root = ref.current?.closest(".vl-arc");
      if (root && !root.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      btn?.focus({ preventScroll: true });
    };
  }, [onClose, returnFocus]);

  return (
    <div ref={ref} className="vl-index" role="dialog" aria-label={UI.arc.index}>
      <p className="vl-index__head">one day at vila leku</p>
      <ol className="vl-index__list">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              aria-current={i === current ? "step" : undefined}
              onClick={() => {
                onClose();
                scrollToChapter(c.id);
              }}
            >
              <span className="vl-index__time">{c.time}</span>
              <span className="vl-index__label">{c.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
