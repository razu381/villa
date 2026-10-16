"use client";

import { useEffect } from "react";
import { useJourney } from "@/lib/store";
import { sound } from "@/lib/audio";
import { UI } from "@/lib/ui-copy";
import { toneFor } from "@/lib/ui-time";
import { Header, goToHomes } from "./Header";
import { SunArc } from "./SunArc";
import { Cursor } from "./Cursor";
import { ClassicOffer } from "./ClassicOffer";

const THEME: Record<string, string> = { film: "#2a2b22", day: "#E5E3D7", night: "#14161b" };

/**
 * Writes the HTML layer's tone onto <html> (film / day / night), the hero phase
 * and the mode, so CSS can tint everything from one place. No React re-renders.
 */
function ToneSync() {
  useEffect(() => {
    const html = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const apply = () => {
      const s = useJourney.getState();
      const tone = toneFor(s);
      if (html.dataset.tone !== tone) {
        html.dataset.tone = tone;
        meta?.setAttribute("content", THEME[tone]);
      }
      const phase = s.t < 0.36 ? "hero" : "journey";
      if (html.dataset.phase !== phase) html.dataset.phase = phase;
      if (html.dataset.mode !== s.mode) html.dataset.mode = s.mode;
      // Busy frames (close over roofs and solar panels): the header needs a denser scrim.
      const busy = s.mode === "explore" || (s.t >= 3.85 && s.t < 6.0) ? "1" : "0";
      if (html.dataset.busy !== busy) html.dataset.busy = busy;
      // The very end (compact screens hide the arc while the form scrolls by).
      const end = s.t >= 6.6 ? "1" : "0";
      if (html.dataset.end !== end) html.dataset.end = end;
      const rm = s.reducedMotion ? "1" : "0";
      if (html.dataset.rm !== rm) html.dataset.rm = rm;
      // Device tier: costly CSS (backdrop blur, animated grain) only on capable devices.
      if (html.dataset.tier !== s.tier) html.dataset.tier = s.tier;
    };
    apply();
    return useJourney.subscribe(apply);
  }, []);
  return null;
}

/** Sound follows the store; the motif plays when the village finishes building. */
function AudioDirector() {
  useEffect(
    () =>
      useJourney.subscribe((s, p) => {
        if (s.soundOn !== p.soundOn) sound.setEnabled(s.soundOn);
        if (s.soundOn && p.t < 3.8 && s.t >= 3.8) sound.chime();
      }),
    [],
  );
  return null;
}

/** The soft corner light the sun arc sits in (beneath the journey text). */
export function ArcHaze() {
  return <div className="vl-arc-haze" aria-hidden="true" />;
}

/**
 * Fine film grain over everything: one layer only slightly larger than the
 * viewport (steps of ±3 %). Static in reduced motion, on mid / low tiers and on
 * compact screens.
 */
function Grain() {
  return <div className="vl-grain" aria-hidden="true" />;
}

function SkipLink() {
  return (
    <a
      href="#homes"
      className="vl-skip"
      onClick={(e) => {
        e.preventDefault();
        goToHomes();
      }}
    >
      {UI.skip}
    </a>
  );
}

/** Top of the document: tone, sound, skip link and header (first in tab order). */
export function ChromeTop() {
  return (
    <>
      <ToneSync />
      <AudioDirector />
      <SkipLink />
      <Header />
    </>
  );
}

/** After the journey: the sun arc (indicator / handle) and the grain over everything. */
export function Chrome() {
  return (
    <>
      <SunArc />
      <Cursor />
      <ClassicOffer />
      <Grain />
    </>
  );
}
