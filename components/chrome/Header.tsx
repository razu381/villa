"use client";

import { UI } from "@/lib/ui-copy";
import { scrollToChapter, scrollToT, scrollToY } from "@/lib/ui-scroll";
import { Wordmark } from "../ui/Brand";
import { SoundToggle } from "./SoundToggle";

/** Go to the invitation and put the cursor in the first field once there. */
export function goToVisit() {
  const focusForm = () => document.querySelector<HTMLInputElement>('#visit input[name="name"]')?.focus({ preventScroll: true });
  const tail = document.querySelector<HTMLElement>(".vl-tail");
  if (tail) {
    scrollToY(tail.getBoundingClientRect().top + window.scrollY - 24, focusForm);
  } else {
    scrollToChapter("night", focusForm);
  }
}

export function goToHomes() {
  scrollToChapter("homes", () => document.querySelector<HTMLButtonElement>(".vl-card")?.focus({ preventScroll: true }));
}

/**
 * Small wordmark tinted to the scene (olive by day, limestone over film / night),
 * minimal nav, the only solid button, the sound waveform, the language.
 */
export function Header() {
  return (
    <header className="vl-header">
      <a
        href="#hero"
        className="vl-header__brand"
        onClick={(e) => {
          e.preventDefault();
          scrollToT(0);
        }}
      >
        <Wordmark className="vl-header__wordmark" label="Vila Leku — back to the beginning" />
      </a>
      <nav className="vl-header__nav" aria-label="Main">
        <a
          href="#homes"
          className="vl-link vl-header__homes"
          onClick={(e) => {
            e.preventDefault();
            goToHomes();
          }}
        >
          {UI.nav.homes}
        </a>
        <a
          href="#visit"
          className="vl-btn vl-btn--solid vl-header__visit"
          onClick={(e) => {
            e.preventDefault();
            goToVisit();
          }}
        >
          {UI.nav.visit}
        </a>
        <SoundToggle />
        <span className="vl-header__lang" title="English">
          {UI.nav.lang}
        </span>
      </nav>
    </header>
  );
}
