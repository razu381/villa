"use client";

import { useEffect, useRef } from "react";
import { useJourney } from "@/lib/store";
import { bump, smooth, stagesFromT } from "@/lib/timeline";
import { useJourneyEffect } from "@/lib/ui-media";

/**
 * The hero film and the match cut into the 3D world, fixed above the canvas.
 *
 *   film (poster <img> underneath — never a black frame)
 *     → crossfades to the still aerial of the village (heroFade 0 → 0.42)
 *     → the still dissolves like a photo turning into an architect's drawing:
 *       soft blur, brighten, desaturate, a wash of limestone paper (0.42 → 1)
 *     → the 3D canvas, framed from the same high oblique angle.
 *
 * Styles are written directly from the store (no React re-render per frame).
 */
export function HeroMedia() {
  const filmRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const aerialRef = useRef<HTMLDivElement>(null);
  const aerialImgRef = useRef<HTMLImageElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const playing = useRef(false);

  // Pick the film for the screen, start it muted; reveal it only once frames flow.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const s = useJourney.getState();
    const reduced = s.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // the poster is the hero in reduced motion
    const mobile = window.matchMedia("(max-width: 820px)").matches;
    const base = mobile ? "/media/hero-loop-mobile" : "/media/hero-loop";
    const webm = v.canPlayType('video/webm; codecs="vp9"') || v.canPlayType("video/webm");
    v.src = `${base}.${webm ? "webm" : "mp4"}`;
    v.muted = true;
    const onPlaying = () => v.classList.add("is-playing");
    v.addEventListener("playing", onPlaying);
    v.play()
      .then(() => (playing.current = true))
      .catch(() => {});
    return () => v.removeEventListener("playing", onPlaying);
  }, []);

  useJourneyEffect((s) => {
    const k = stagesFromT(s.t).heroFade;
    const film = filmRef.current;
    const aerial = aerialRef.current;
    const img = aerialImgRef.current;
    const paper = paperRef.current;
    const root = rootRef.current;
    if (!film || !aerial || !img || !paper || !root) return;

    // Film → still.
    const kf = smooth(0, 0.42, k);
    film.style.opacity = String(1 - kf);
    film.style.visibility = kf >= 0.999 ? "hidden" : "visible";

    // Still → drawing → 3D. Hold the still until the 3D has rendered.
    const kd = s.ready ? smooth(0.4, 1, k) : 0;
    const out = smooth(0.5, 1, kd);
    aerial.style.opacity = String(1 - out);
    img.style.filter =
      kd > 0.001
        ? `blur(${(kd * 10).toFixed(2)}px) brightness(${(1 + kd * 0.42).toFixed(3)}) saturate(${(1 - kd * 0.75).toFixed(3)}) contrast(${(1 - kd * 0.3).toFixed(3)})`
        : "";
    img.style.transform = s.reducedMotion ? "" : `scale(${(1.02 + kd * 0.05).toFixed(4)})`;
    paper.style.opacity = String(smooth(0, 0.7, kd) * 0.62);

    // An architect's annotation on the still: here is the hill.
    const note = noteRef.current;
    if (note) {
      const n = bump(0.2, 0.34, 0.5, 0.64, k);
      note.style.opacity = n.toFixed(3);
      note.style.visibility = n > 0.001 ? "visible" : "hidden";
    }

    const gone = out >= 0.999 && kf >= 0.999;
    root.style.visibility = gone ? "hidden" : "visible";

    // Only spend decode time on the film while it can be seen.
    const v = videoRef.current;
    if (v && v.src) {
      if (kf >= 0.999 && !v.paused) v.pause();
      else if (kf < 0.999 && v.paused && playing.current && !document.hidden) v.play().catch(() => {});
    }
  });

  return (
    <div ref={rootRef} className="vl-heromedia" aria-hidden="true">
      <div ref={aerialRef} className="vl-heromedia__aerial">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={aerialImgRef} src="/media/aerial-village.jpg" alt="" decoding="async" />
        <div className="vl-heromedia__aerialscrim" />
        <div ref={paperRef} className="vl-heromedia__paper" />
        <div ref={noteRef} className="vl-site-note" style={{ ["--ix" as string]: 1000, ["--iy" as string]: 470 }}>
          <span className="vl-site-note__dot" />
          <span className="vl-site-note__lead" />
          <span className="vl-site-note__label">
            <span className="vl-site-note__name">Vila Leku</span>
            <span className="vl-site-note__place">the hill, from above</span>
          </span>
        </div>
      </div>
      <div ref={filmRef} className="vl-heromedia__film">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vl-heromedia__poster" src="/media/hero-poster.jpg" alt="" fetchPriority="high" />
        <video ref={videoRef} className="vl-heromedia__video" muted loop playsInline preload="auto" disablePictureInPicture />
        <div className="vl-heromedia__scrim" />
      </div>
    </div>
  );
}
