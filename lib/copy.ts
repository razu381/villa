"use client";

/**
 * The classic site's whole copy bundle, picked by language (lib/lang). EN is the
 * existing dictionaries (the 3D route keeps importing them directly); PT is the
 * mirror modules. `locale` rides along for dates (lib/ui-time).
 */

import { useLang } from "./lang";
import { AMENITIES, CONCEPT, HEART, HOMES, LOCATION, VILLA_FLOORS } from "./content";
import { AMENITIES_PT, CONCEPT_PT, HEART_PT, HOMES_PT, LOCATION_PT, VILLA_FLOORS_PT } from "./content.pt";
import { ADVISOR, CLASSIC, GALLERY, NAV, PARTNERS } from "./classic-content";
import { ADVISOR_PT, CLASSIC_PT, GALLERY_PT, NAV_PT, PARTNERS_PT } from "./classic-content.pt";
import { TIME_WORDS, UI } from "./ui-copy";
import { TIME_WORDS_PT, UI_PT } from "./ui-copy.pt";

const en = {
  CONCEPT,
  AMENITIES,
  VILLA_FLOORS,
  LOCATION,
  HOMES,
  HEART,
  NAV,
  CLASSIC,
  GALLERY,
  PARTNERS,
  ADVISOR,
  UI,
  TIME_WORDS,
  locale: "en-GB",
};

const pt = {
  CONCEPT: CONCEPT_PT,
  AMENITIES: AMENITIES_PT,
  VILLA_FLOORS: VILLA_FLOORS_PT,
  LOCATION: LOCATION_PT,
  HOMES: HOMES_PT,
  HEART: HEART_PT,
  NAV: NAV_PT,
  CLASSIC: CLASSIC_PT,
  GALLERY: GALLERY_PT,
  PARTNERS: PARTNERS_PT,
  ADVISOR: ADVISOR_PT,
  UI: UI_PT,
  TIME_WORDS: TIME_WORDS_PT,
  locale: "pt-PT",
} satisfies typeof en;

export type Copy = typeof en;

export function useCopy(): Copy {
  return useLang((s) => s.lang) === "pt" ? pt : en;
}
