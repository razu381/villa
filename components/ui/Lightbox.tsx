"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Photo } from "@/lib/classic-content";
import { Pic } from "./Pic";

const pad = (n: number) => String(n).padStart(2, "0");

export interface ViewerItem {
  photo: Photo;
  title: string;
  line?: string;
}

export interface ViewerLabels {
  /** The dialog's name. */
  title: string;
  prev: string;
  next: string;
  close: string;
}

/**
 * The full-screen viewer: the whole photo on ink, its caption and count,
 * arrows, ← → and Esc, drag / swipe. Focus stays inside while it is open and
 * goes back to where it came from; the page doesn't scroll behind it.
 * Shared by the classic site and the 3D journey (`arch`: the first photo rises
 * through the brand arch; `note`: a quiet line beside the caption).
 */
export function Lightbox({
  items,
  start,
  labels,
  note,
  arch = false,
  onClosing,
  onClose,
}: {
  items: ViewerItem[];
  start: number;
  labels: ViewerLabels;
  note?: string;
  arch?: boolean;
  /** The fade out begins. */
  onClosing?: () => void;
  /** The fade out has ended: unmount the viewer. */
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const [prev, setPrev] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const n = items.length;

  const go = (to: number) => {
    const next = ((to % n) + n) % n;
    if (next === index) return;
    setPrev(index);
    setIndex(next);
  };
  const close = () => {
    if (closing) return;
    setClosing(true);
    onClosing?.();
    window.setTimeout(onClose, 450);
  };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const lenis = window.__lenis;
    lenis?.stop();
    document.documentElement.classList.add("vl-viewer-lock");
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      lenis?.start();
      document.documentElement.classList.remove("vl-viewer-lock");
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "Tab") {
        // Keep focus inside the viewer.
        const f = ref.current?.querySelectorAll<HTMLElement>("button");
        if (!f || f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const item = items[index];
  return createPortal(
    <div ref={ref} className="vl-viewer" role="dialog" aria-modal="true" aria-label={labels.title} data-closing={closing ? "1" : "0"}>
      <div
        className="vl-viewer__stage"
        onPointerDown={(e) => (drag.current = { x: e.clientX, id: e.pointerId })}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {items.map((it, i) => (
          <figure
            key={it.photo.src + i}
            className="vl-viewer__slide"
            data-state={i === index ? "active" : i === prev ? "prev" : "idle"}
            data-enter={arch && prev == null && i === start ? "arch" : undefined}
            aria-hidden={i !== index}
          >
            {(i === index || i === prev) && <Pic photo={it.photo} sizes="92vw" eager />}
          </figure>
        ))}
      </div>
      <div className="vl-viewer__bar">
        <p className="vl-viewer__cap" aria-live="polite">
          <b>{item.title}</b>
          {item.line && <span>{item.line}</span>}
        </p>
        {note && <span className="vl-viewer__note">{note}</span>}
        <span className="vl-viewer__count">
          {pad(index + 1)} <i>/</i> {pad(n)}
        </span>
        <div className="vl-viewer__nav">
          <button type="button" className="vl-viewer__btn" onClick={() => go(index - 1)} aria-label={labels.prev}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <button type="button" className="vl-viewer__btn" onClick={() => go(index + 1)} aria-label={labels.next}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
      <button ref={closeBtn} type="button" className="vl-viewer__close" onClick={close}>
        {labels.close}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>,
    // Inside the classic page root when there is one, so it shares its type.
    document.querySelector(".vc") ?? document.body,
  );
}
