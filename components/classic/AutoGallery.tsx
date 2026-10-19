"use client";

import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/classic-content";
import { stillMode } from "./env";
import { Pic } from "../ui/Pic";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A photo stage: each new photo wipes up from the bottom over the last (the
 * client's transition), with arrows, dots, a counter and drag / swipe.
 * `auto` advances on its own (the V3 gallery), with a progress line and a
 * pause button; it waits while the pointer or focus is on it, or it is off
 * screen. `onOpen` makes the photo a button (the gallery's viewer).
 */
export function AutoGallery({
  photos,
  sizes,
  label,
  auto = false,
  interval = 6,
  className = "",
  onOpen,
  onIndex,
  captions,
  labels = { prev: "Previous photo", next: "Next photo", pause: "Pause the photos", play: "Play the photos", view: "View" },
}: {
  photos: Photo[];
  sizes: string;
  label: string;
  auto?: boolean;
  interval?: number;
  className?: string;
  onOpen?: (i: number) => void;
  onIndex?: (i: number) => void;
  captions?: { title: string; line?: string }[];
  labels?: { prev: string; next: string; pause: string; play: string; view: string };
}) {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const swiped = useRef(false);
  const n = photos.length;

  useEffect(() => setStill(stillMode()), []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const go = (to: number) => {
    const next = ((to % n) + n) % n;
    if (next === index) return;
    setPrev(index);
    setIndex(next);
    onIndex?.(next);
  };

  const running = auto && !still && !userPaused && !held && visible && n > 1;

  return (
    <div
      ref={ref}
      className={`vc-ag ${className}`}
      data-auto={auto && !still ? "1" : "0"}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      data-running={running ? "1" : "0"}
      // Held by a resting mouse or keyboard focus; a tap or a swipe leaves it turning.
      onPointerEnter={(e) => e.pointerType === "mouse" && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHeld(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        else if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div
        className="vc-ag__stage"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, id: e.pointerId };
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          swiped.current = Math.abs(dx) > 40;
          if (swiped.current) go(index + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => (drag.current = null)}
        data-open={onOpen ? "1" : undefined}
      >
        {photos.map((p, i) => (
          <figure
            key={p.src + i}
            className="vc-ag__slide"
            data-state={i === index ? "active" : i === prev ? "prev" : "idle"}
            aria-hidden={i !== index}
          >
            <Pic photo={p} sizes={sizes} eager={i === 0} />
          </figure>
        ))}
        {onOpen && (
          <button
            type="button"
            className="vc-ag__view"
            onMouseMove={(e) => {
              // The "View" label follows the pointer.
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
              e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
            }}
            onClick={() => {
              // A swipe ends in a click too: only a tap opens the viewer.
              if (swiped.current) swiped.current = false;
              else onOpen(index);
            }} aria-label={`${labels.view}: ${photos[index].alt}`}>
            <span>{labels.view}</span>
          </button>
        )}
      </div>

      {captions && (
        <div className="vc-ag__caption" aria-live="polite">
          <p key={index} className="vc-ag__cap">
            <span className="vc-ag__cap-title">{captions[index]?.title}</span>
            {captions[index]?.line && <span className="vc-ag__cap-line">{captions[index]?.line}</span>}
          </p>
        </div>
      )}

      {n > 1 && (
        <div className="vc-ag__controls">
          <span className="vc-ag__count" aria-hidden="true">
            {pad(index + 1)} <i>/</i> {pad(n)}
          </span>
          <div className="vc-ag__dots">
            {photos.map((p, i) => (
              <button
                key={i}
                type="button"
                className="vc-ag__dot"
                aria-label={`${i + 1} / ${n}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
              >
                {i === index && auto && !still && (
                  <span key={index} className="vc-ag__bar" style={{ animationDuration: `${interval}s` }} onAnimationEnd={() => go(index + 1)} />
                )}
              </button>
            ))}
          </div>
          <div className="vc-ag__arrows">
            {auto && !still && (
              <button type="button" className="vc-ag__btn" onClick={() => setUserPaused((v) => !v)} aria-label={userPaused ? labels.play : labels.pause}>
                {userPaused ? (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5 3.5v9M11 3.5v9" />
                  </svg>
                )}
              </button>
            )}
            <button type="button" className="vc-ag__btn" onClick={() => go(index - 1)} aria-label={labels.prev}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3 5 8l5 5" />
              </svg>
            </button>
            <button type="button" className="vc-ag__btn" onClick={() => go(index + 1)} aria-label={labels.next}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m6 3 5 5-5 5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
