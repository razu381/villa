/**
 * Interface copy that lives with the HTML layer (lib/content.ts holds the story copy).
 */

export const UI = {
  skip: "Skip to the homes",
  nav: { homes: "The homes", visit: "Private visit", lang: "EN" },
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
      { title: "Durability", text: "Stone and cork that grow more beautiful with age." },
      { title: "Autonomy", text: "Sun-powered, water-wise, quietly self-reliant." },
    ],
  },
  cars: {
    legend: [
      { title: "Underground parking", where: "below", marker: "dashed" as const },
      { title: "Car-free streets", where: "above", marker: "line" as const },
      { title: "Botanical playground", where: "the heart", marker: "circle" as const },
    ],
  },
  homes: {
    choose: "Choose a home",
    open: "Explore",
    specs: "Specifications",
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
      { id: "v4", label: "V4 Villa" },
      { id: "any", label: "Not sure yet" },
    ] as const,
    date: "Preferred date",
    time: "Time of day",
    timeOptions: [
      { id: "morning", label: "Morning" },
      { id: "afternoon", label: "Afternoon" },
      { id: "golden", label: "Golden hour" },
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
  golden: "at golden hour",
};
