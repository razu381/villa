/**
 * Interface copy that lives with the HTML layer (lib/content.ts holds the story copy).
 */

import { CONCEPT } from "./content";

const pillar = (title: string) => CONCEPT.pillars.find((p) => p.title === title)?.text ?? "";

export const UI = {
  skip: "Skip to the homes",
  loader: { label: "Loading Vila Leku", note: "before first light" },
  nav: { homes: "The homes", visit: "Private visit", classic: "Classic site" },
  offer: {
    text: "This device may show the classic site more smoothly.",
    open: "Open the classic site",
    stay: "Stay here",
  },
  sound: { on: "Sound on", off: "Sound off" },
  arc: {
    index: "Chapters",
    open: "Chapters",
    now: "now",
    labels: ["dawn", "noon", "dusk"] as const,
    slider: "Hold the sun",
  },
  making: {
    notes: [
      // The client's own words (Site Vila Leku_textos.docx).
      { title: "Durability", text: pillar("Durability") },
      { title: "Autonomy", text: pillar("Autonomy") },
    ],
  },
  cars: {
    legend: [
      { title: "Underground parking", where: "below", marker: "dashed" as const },
      { title: "Pedestrian sanctuary", where: "above", marker: "line" as const },
      { title: "The Garden", where: "the heart", marker: "circle" as const },
    ],
  },
  homes: {
    choose: "Choose a home",
    open: "Explore",
    specs: "Specifications",
    turn: "Turn the home",
    turnLeft: "Turn left",
    turnRight: "Turn right",
    drag: "drag to look around",
    /** Under the panel's render: "photos · 05". */
    photos: "photos",
    /** The panel's render as a button. */
    openPhotos: "See the photos",
    /** The third door under the two homes' cards. */
    heart: "Village heart",
    heartKind: "shared spaces",
  },
  /** The photo viewer over the 3D (components/homes/PlaceViewer.tsx). */
  viewer: {
    title: "Photos",
    prev: "Previous photo",
    next: "Next photo",
    close: "Close",
    note: "Artistic interpretation",
  },
  form: {
    legend: "Your private visit",
    name: "Your name",
    email: "Email",
    phone: "Phone",
    optional: "optional",
    home: "Preferred home",
    homeOptions: [
      { id: "v3", label: "V3 Townhouse" },
      { id: "v4", label: "V4 Premium Villa" },
    ] as const,
    date: "Preferred date",
    time: "Time of day",
    timeOptions: [
      { id: "morning", label: "Morning" },
      { id: "afternoon", label: "Afternoon" },
      { id: "evening", label: "Evening" },
    ] as const,
    sending: "Preparing your invitation",
    errors: {
      name: "Please tell us your name.",
      email: "Please enter a valid email address.",
      date: "Please choose a day for your visit.",
    },
    edit: "Change the details",
  },
  card: {
    title: "An invitation",
    for: "for",
    visit: "to visit",
    anyHome: "the homes of Vila Leku",
    place: "Leceia · Oeiras",
  },
  footer: {
    signature: "building harmony",
    copyright: "© 2026 Phidias. Vila Leku.",
  },
};

export type VisitHome = (typeof UI.form.homeOptions)[number]["id"];
export type VisitTime = (typeof UI.form.timeOptions)[number]["id"];

export interface VisitRequest {
  name: string;
  email: string;
  phone: string;
  home: VisitHome;
  date: string;
  time: VisitTime;
}

export const TIME_WORDS: Record<VisitTime, string> = {
  morning: "in the morning",
  afternoon: "in the afternoon",
  evening: "in the evening",
};
