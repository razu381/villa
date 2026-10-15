"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useJourney, type JourneyState } from "./store";

/** Compact layout: phones and short / narrow windows. Mirrors the CSS breakpoint. */
export const COMPACT_QUERY = "(max-width: 820px), (max-height: 620px)";

export function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const useCompact = () => useMedia(COMPACT_QUERY);

/**
 * Subscribe to the journey store without re-rendering: the callback runs on every
 * store change (and once immediately) and writes styles directly.
 */
export function useJourneyEffect(fn: (s: JourneyState, prev: JourneyState | null) => void, deps: unknown[] = []) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    ref.current(useJourney.getState(), null);
    return useJourney.subscribe((s, p) => ref.current(s, p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** URL debug params (read once on the client). */
export function debugParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}
