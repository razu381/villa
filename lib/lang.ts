"use client";

import { create } from "zustand";

/**
 * The classic site's language (the client's note, VS3 p. 1). While PT is
 * paused, use English and retain the saved preference for later.
 * The server HTML stays "en" (a static export) — initLang() runs after mount.
 */

export type Lang = "en" | "pt";

// Enable when the Portuguese translation is ready; shared by the store and menu.
export const PT_ENABLED = false;

const KEY = "vl-lang";

const apply = (lang: Lang) => {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  document.documentElement.lang = lang === "pt" ? "pt-PT" : "en";
};

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLang = create<LangState>((set) => ({
  lang: "en",
  setLang: (lang) => {
    if (lang === "pt" && !PT_ENABLED) return;
    set({ lang });
    apply(lang);
  },
}));

/** After mount: English while PT is paused; otherwise the saved/browser choice. */
export function initLang() {
  if (!PT_ENABLED) {
    useLang.setState({ lang: "en" });
    document.documentElement.lang = "en";
    return;
  }
  let lang: Lang = "en";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "pt") lang = saved;
    else if ((navigator.language || "").toLowerCase().startsWith("pt")) lang = "pt";
  } catch {}
  if (useLang.getState().lang !== lang) useLang.getState().setLang(lang);
  else apply(lang);
}
