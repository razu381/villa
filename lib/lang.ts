"use client";

import { create } from "zustand";

/**
 * The classic site's language (the client's note, VS3 p. 1). The choice is the
 * visitor's (localStorage); without one, PT browsers get PT, everyone else EN.
 * The server HTML stays "en" (a static export) — initLang() runs after mount.
 */

export type Lang = "en" | "pt";

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
    set({ lang });
    apply(lang);
  },
}));

/** After mount: the saved choice, else the browser's language. */
export function initLang() {
  let lang: Lang = "en";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "pt") lang = saved;
    else if ((navigator.language || "").toLowerCase().startsWith("pt")) lang = "pt";
  } catch {}
  if (useLang.getState().lang !== lang) useLang.getState().setLang(lang);
  else apply(lang);
}
