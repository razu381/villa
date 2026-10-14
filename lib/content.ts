/**
 * Copy — English. Short, calm, confident. One idea per screen.
 * Specs come from the current vilaleku.com site.
 */

export const BRAND = {
  name: "Vila Leku",
  tagline: "Living in harmony",
  signature: "building harmony",
  place: "Leceia · Oeiras · Lisbon coast",
  developer: "Phidias",
  disclaimer: "Artistic interpretation. Not to scale.",
  partners: [
    { role: "Contractor", name: "FCM" },
    { role: "Financier", name: "BPI" },
    { role: "Real estate", name: "Porta da Frente" },
  ],
};

export const COPY = {
  hero: {
    eyebrow: "leceia · oeiras · lisbon coast",
    line: "A quiet hill above the Atlantic.",
    cue: "scroll to begin the day",
  },
  drawing: {
    eyebrow: "dawn",
    title: "It begins with a line.",
    body: "Every home was drawn around the hill — its slope, its light, its long view to the river.",
  },
  model: {
    eyebrow: "morning",
    title: "A contemporary stronghold.",
    body: "Living spaces raised to the light. Everything technical, buried below. A clear boundary between the outer world and an inner sanctuary.",
  },
  making: {
    eyebrow: "late morning",
    title: "Made to age with the land.",
    body: "Limestone and cork, chosen to weather gracefully. Solar energy and recycled water for quiet autonomy.",
    notes: ["Durability", "Autonomy"],
  },
  cars: {
    eyebrow: "noon",
    title: "Cars below. Life above.",
    body: "Every car arrives underground. Above, the village belongs to people — gardens, paths and children at play.",
    annotations: ["Underground parking", "Car-free streets", "Botanical playground"],
  },
  homes: {
    eyebrow: "golden hour",
    title: "Two ways to live.",
    hint: "Hold the sun — drag it across the arch.",
    explore: "Explore",
    back: "Back to the village",
  },
  night: {
    eyebrow: "evening",
    title: "Come experience Vila Leku.",
    body: "Discover the homes, the landscape and the shared spaces with your private advisor.",
    submit: "Request your private visit",
    confirmTitle: "An invitation",
    confirmBody: "Your advisor will confirm your visit within one day.",
  },
};

export interface HomeContent {
  id: "v3" | "v4";
  name: string;
  kind: string;
  status: string;
  area: string;
  specs: string[];
  image: string;
}

export const HOMES: HomeContent[] = [
  {
    id: "v3",
    name: "V3 Townhouse",
    kind: "Townhouse",
    status: "Available now",
    area: "+250 m²",
    specs: ["3 bedrooms", "3 bathrooms", "Private garden", "Master suite with terrace", "Open-space living", "2 parking spaces"],
    image: "/media/renders/townhouses-row.jpg",
  },
  {
    id: "v4",
    name: "V4 Villa",
    kind: "Premium villa",
    status: "Coming 2028",
    area: "+400 m²",
    specs: ["4 bedrooms", "4 bathrooms", "Private pool", "Private elevator", "Home office", "Large garage"],
    image: "/media/renders/villa-pool.jpg",
  },
];
