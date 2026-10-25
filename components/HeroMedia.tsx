"use client";

import { useEffect, useRef } from "react";
import { useJourney } from "@/lib/store";
import { bump, smooth, stagesFromT } from "@/lib/timeline";
import { damp } from "@/lib/ui-time";
import { useJourneyEffect } from "@/lib/ui-media";

/**
 * The hero film and the match cut into the 3D world, fixed above the canvas.
 *
 *   film (poster <img> underneath — never a black frame)
 *     → crossfades to the still aerial of the village (heroFade 0 → 0.42)
 *     → the photo turns into an architect's drawing of itself while the view
 *       pushes in towards the village (kd 0 → 0.55)
 *     → the drawing dissolves into the 3D canvas, whose contours and line
 *       drawing take over from the same high oblique angle (kd 0.55 → 1).
 *
 * The drawing (public/media/aerial-village-drawing.*) is pre-baked from the
 * aerial: Canny edges (ImageMagick `-canny 0x2.2+10%+28%`), inked in graphite
 * olive on limestone paper, strongest around the village, with a 10 % ghost
 * wash of the photo's tones.
 *
 * Styles are written directly from the store (no React re-render per frame),
 * and only while the hero media can change.
 */

/** Where the village sits in the 1920 × 1080 aerial (the push-in aims here). */
const PIN = { x: 1000, y: 470 };

/** Film → still: the film is gone by heroFade 0.42. */
const filmFade = (heroFade: number) => smooth(0, 0.42, heroFade);
/** Whether the film is (partly) on screen at journey position t (the loader waits for it only then). */
export const filmShownAt = (t: number) => filmFade(stagesFromT(t).heroFade) < 0.999;

export function HeroMedia() {
  const filmRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const aerialRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const drawingRef = useRef<HTMLImageElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const playing = useRef(false);
  /** The dissolve amount actually on screen (eased in if the 3D becomes ready late). */
  const kdShown = useRef(0);
  const easing = useRef(0);
  const last = useRef<{ k: number; kd: number; rm: boolean } | null>(null);

  // Pick the film for the screen, start it muted; reveal it only once frames flow.
  // Each step reports to the store's heroLoad, which the loader traces (chrome/Loader).
  useEffect(() => {
    const v = videoRef.current;
    const poster = posterRef.current;
    if (!v || !poster) return;
    const s = useJourney.getState();
    const reduced = s.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mark = (k: number) => {
      if (k > useJourney.getState().heroLoad) useJourney.getState().setHeroLoad(k);
    };
    // The poster is the first picture; it is the whole hero in reduced motion, or
    // when the film can't play.
    let posterIn = poster.complete;
    let filmOut = reduced;
    const onPoster = () => {
      posterIn = true;
      mark(filmOut ? 1 : 0.25);
    };
    const onFilmOut = () => {
      filmOut = true;
      if (posterIn) mark(1);
    };
    if (posterIn) onPoster();
    else {
      poster.addEventListener("load", onPoster, { once: true });
      poster.addEventListener("error", onPoster, { once: true });
    }
    const unPoster = () => {
      poster.removeEventListener("load", onPoster);
      poster.removeEventListener("error", onPoster);
    };
    if (reduced) return unPoster;

    const mobile = window.matchMedia("(max-width: 820px)").matches;
    const base = mobile ? "/media/hero-loop-mobile" : "/media/hero-loop";
    const webm = v.canPlayType('video/webm; codecs="vp9"') || v.canPlayType("video/webm");
    const steps: [string, number][] = [
      ["loadedmetadata", 0.45],
      ["loadeddata", 0.65],
      ["canplay", 0.8],
    ];
    const onStep = steps.map(([type, k]) => [type, () => mark(k)] as const);
    onStep.forEach(([type, fn]) => v.addEventListener(type, fn));
    const onPlaying = () => {
      v.classList.add("is-playing");
      mark(1);
    };
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onFilmOut);
    v.src = `${base}.${webm ? "webm" : "mp4"}`;
    v.muted = true;
    v.play()
      .then(() => (playing.current = true))
      .catch(onFilmOut);
    return () => {
      unPoster();
      onStep.forEach(([type, fn]) => v.removeEventListener(type, fn));
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onFilmOut);
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(easing.current), []);

  const render = (k: number, kd: number, reduced: boolean) => {
    const film = filmRef.current;
    const aerial = aerialRef.current;
    const view = viewRef.current;
    const photo = photoRef.current;
    const drawing = drawingRef.current;
    const root = rootRef.current;
    if (!film || !aerial || !view || !photo || !drawing || !root) return;
    const prev = last.current;
    if (prev && prev.k === k && prev.kd === kd && prev.rm === reduced) return;
    last.current = { k, kd, rm: reduced };

    // Film → still.
    const kf = filmFade(k);
    film.style.opacity = String(1 - kf);
    film.style.visibility = kf >= 0.999 ? "hidden" : "visible";

    // Photo → drawing (the photo softens a touch as the ink comes in) → 3D.
    const ink = smooth(0.04, 0.55, kd);
    const out = smooth(0.55, 1, kd);
    drawing.style.opacity = ink.toFixed(4);
    photo.style.opacity = (1 - smooth(0.3, 0.6, kd)).toFixed(4);
    photo.style.filter =
      kd > 0.001 && kd < 0.6
        ? `saturate(${(0.8 * (1 - ink * 0.6)).toFixed(3)}) sepia(0.08) contrast(0.97) brightness(${(1.02 + ink * 0.12).toFixed(3)}) blur(${Math.min(1.6, kd * 3.2).toFixed(2)}px)`
        : "";
    if (scrimRef.current) scrimRef.current.style.opacity = (1 - ink).toFixed(4);
    aerial.style.opacity = (1 - out).toFixed(4);
    // Push in towards the village, so the motion leads to where the 3D appears.
    view.style.transform = reduced ? "" : `scale(${(1.02 + 0.18 * smooth(0, 1, kd)).toFixed(4)})`;

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
  };

  useJourneyEffect((s, p) => {
    // A lost canvas: the still stands in, with the film's scrim for the type.
    rootRef.current?.classList.toggle("is-fallback", s.canvas !== "live");
    const k = stagesFromT(s.t).heroFade;
    // Hold the still until the 3D has rendered.
    const target = s.ready ? smooth(0.4, 1, k) : 0;
    // The 3D became ready after the visitor had already scrolled into the dissolve:
    // ease the dissolve in over ~0.8 s instead of jumping a frame.
    const lateReady = p != null && !p.ready && s.ready && target > 0.01 && !s.snap && !easing.current;
    if (lateReady) {
      let t0 = performance.now();
      const step = () => {
        const now = performance.now();
        const dt = Math.min(0.1, (now - t0) / 1000);
        t0 = now;
        const st = useJourney.getState();
        const tg = st.ready ? smooth(0.4, 1, stagesFromT(st.t).heroFade) : 0;
        kdShown.current = damp(kdShown.current, tg, 5, dt);
        if (Math.abs(kdShown.current - tg) < 0.002) {
          kdShown.current = tg;
          easing.current = 0;
        } else {
          easing.current = requestAnimationFrame(step);
        }
        render(stagesFromT(st.t).heroFade, kdShown.current, st.reducedMotion);
      };
      easing.current = requestAnimationFrame(step);
      return;
    }
    if (easing.current) return; // the easing loop is rendering
    kdShown.current = target;
    render(k, target, s.reducedMotion);
  });

  return (
    <div ref={rootRef} className="vl-heromedia" aria-hidden="true">
      <div ref={aerialRef} className="vl-heromedia__aerial">
        <div ref={viewRef} className="vl-heromedia__view" style={{ ["--ix" as string]: PIN.x, ["--iy" as string]: PIN.y }}>
          {/* AVIF / WebP with a JPEG fallback; the stills load after the poster and the film. */}
          <picture>
            <source srcSet="/media/aerial-village.avif" type="image/avif" />
            <source srcSet="/media/aerial-village.webp" type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={photoRef} className="vl-heromedia__photo" src="/media/aerial-village.jpg" alt="" decoding="async" fetchPriority="low" />
          </picture>
          <picture>
            <source srcSet="/media/aerial-village-drawing.avif" type="image/avif" />
            <source srcSet="/media/aerial-village-drawing.webp" type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={drawingRef} className="vl-heromedia__drawing" src="/media/aerial-village-drawing.jpg" alt="" decoding="async" fetchPriority="low" />
          </picture>
        </div>
        <div ref={scrimRef} className="vl-heromedia__aerialscrim" />
        <div ref={noteRef} className="vl-site-note" style={{ ["--ix" as string]: PIN.x, ["--iy" as string]: PIN.y }}>
          <span className="vl-site-note__dot" />
          <span className="vl-site-note__lead" />
          <span className="vl-site-note__label">
            <span className="vl-site-note__name">Vila Leku</span>
            <span className="vl-site-note__place">the hill, from above</span>
          </span>
        </div>
      </div>
      <div ref={filmRef} className="vl-heromedia__film">
        <picture>
          <source srcSet="/media/hero-poster.avif" type="image/avif" />
          <source srcSet="/media/hero-poster.webp" type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={posterRef} className="vl-heromedia__poster" src="/media/hero-poster.jpg" alt="" fetchPriority="high" />
        </picture>
        <video ref={videoRef} className="vl-heromedia__video" muted loop playsInline preload="auto" disablePictureInPicture />
        <div className="vl-heromedia__scrim" />
      </div>
    </div>
  );
}
