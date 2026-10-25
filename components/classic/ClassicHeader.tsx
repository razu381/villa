"use client";

import { useEffect, useRef, useState } from "react";
import { CLASSIC, NAV } from "@/lib/classic-content";
import { openingNow } from "@/lib/opening";
import { scrollToY } from "@/lib/ui-scroll";
import { Wordmark } from "../ui/Brand";

/** Scroll to a section, just under the header. */
export function goTo(id: string, focus?: string) {
  const el = document.getElementById(id);
  if (!el) return;
  openingNow(); // the pin's scroll space must be in place before measuring
  const y = id === "top" ? 0 : el.getBoundingClientRect().top + window.scrollY - (id === "visit" ? 0 : 56);
  // Not on touch: focusing a field opens the keyboard and jumps the page to it.
  const field = focus && !window.matchMedia("(pointer: coarse)").matches ? focus : null;
  scrollToY(y, () => {
    if (field) document.querySelector<HTMLElement>(field)?.focus({ preventScroll: true });
  });
}

/** Phones: the menu is a full-screen sheet behind a "Menu" button (see classic.css). */
const SHEET = "(max-width: 820px)";

/**
 * Always there (the client: the menu stays in view). Over the film it is the
 * full menu; past it, the header slims to the leaf, the docked wordmark and a
 * "Menu" that opens as a small panel when the mouse passes over it (or on click
 * / focus). The leaf goes back to the top: it sways slowly and turns green on hover.
 * On a phone, "Menu" opens the whole screen: the sections, the 3D, the visit.
 */
export function ClassicHeader() {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Docked once the film has (mostly) scrolled away.
    const hero = document.getElementById("top");
    const onScroll = () => {
      const docked = window.scrollY > (hero ? hero.offsetHeight - 80 : 400);
      if ((el.dataset.docked === "1") !== docked) {
        el.dataset.docked = docked ? "1" : "0";
        if (!docked) setOpen(false);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // The section in view, for the menu's marker.
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
        let best: string | null = null;
        let r = 0;
        seen.forEach((v, k) => {
          if (v > r) {
            r = v;
            best = k;
          }
        });
        setActive(best);
      },
      { threshold: [0, 0.2, 0.4, 0.6], rootMargin: "-20% 0px -40% 0px" },
    );
    NAV.forEach((n) => {
      const s = document.getElementById(n.id);
      if (s) io.observe(s);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(SHEET);
    const on = () => {
      setSheet(mq.matches);
      setOpen(false);
    };
    setSheet(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // The sheet holds the page still beneath it.
    const lenis = window.__lenis;
    if (sheet) {
      lenis?.stop();
      document.documentElement.classList.add("vc-locked");
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      if (sheet) {
        lenis?.start();
        document.documentElement.classList.remove("vc-locked");
      }
    };
  }, [open, sheet]);

  /** Close the menu, then go: the sheet holds the page until it has closed. */
  const leave = (go: () => void) => {
    setOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(go));
  };

  return (
    <header ref={ref} className="vc-header" data-docked="0" data-open={open ? "1" : "0"}>
      <a
        href="#top"
        className="vc-header__leaf"
        aria-label={CLASSIC.top}
        onClick={(e) => {
          e.preventDefault();
          goTo("top");
        }}
      >
        <span className="vc-leaf" />
      </a>
      <a
        href="#top"
        className="vc-header__mark"
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => {
          e.preventDefault();
          goTo("top");
        }}
      >
        <Wordmark className="vc-header__wordmark" label={null} />
      </a>
      <nav
        className="vc-nav"
        aria-label="Main"
        // The mouse only: a tap would open on "enter" and close again on the click.
        onPointerEnter={(e) => e.pointerType === "mouse" && !sheet && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && !sheet && setOpen(false)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <button type="button" className="vc-nav__toggle" aria-expanded={open} aria-controls="vc-nav-list" onClick={() => setOpen((o) => !o)}>
          <span>{open && sheet ? CLASSIC.menuClose : CLASSIC.menu}</span>
          <span className="vc-nav__bars" aria-hidden="true" />
        </button>
        <ul id="vc-nav-list" className="vc-nav__list" onFocus={() => setOpen(true)}>
          {NAV.map((n, i) => (
            <li key={n.id} style={{ "--i": i } as React.CSSProperties}>
              <a
                href={`#${n.id}`}
                aria-current={active === n.id ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  leave(() => goTo(n.id));
                }}
              >
                <span className="vc-nav__n" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {n.label}
              </a>
            </li>
          ))}
          <li className="vc-nav__cta" style={{ "--i": NAV.length } as React.CSSProperties}>
            <a
              href="#visit"
              className="vl-btn vl-btn--solid"
              onClick={(e) => {
                e.preventDefault();
                leave(() => goTo("visit", '#visit input[name="name"]'));
              }}
            >
              {CLASSIC.visitCta}
            </a>
          </li>
        </ul>
      </nav>
      <a
        href="#visit"
        className="vl-btn vl-btn--solid vc-header__visit"
        onClick={(e) => {
          e.preventDefault();
          goTo("visit", '#visit input[name="name"]');
        }}
      >
        {CLASSIC.visitCta}
      </a>
    </header>
  );
}
