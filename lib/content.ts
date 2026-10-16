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

/*
 * The client's own copy (Site Vila Leku_textos.docx, EN), shared by both sites.
 */

export const CONCEPT = {
  title: "Vila Leku: a modern Castro.",
  intro:
    "Inspired by the enduring strength of the ancestral Castro de Leceia, we translate the heritage of the settlement into a contemporary, resilient residential ecosystem.",
  pillars: [
    {
      title: "Pedestrian Sanctuary",
      text: "By welcoming vehicle traffic into discreet underground garages, the surface is returned to human experience. A pedestrian oasis where children play freely and adults walk in harmony — a contemporary reinterpretation of safety, silence and encounter.",
    },
    {
      title: "Solidity",
      text: "Light Steel Frame (LSF) construction ensures strength, durability, and a clean, environmentally responsible building process, together with thermal and acoustic comfort that gives every home an A energy rating.",
    },
    {
      title: "Autonomy",
      text: "Integrated solar energy and intelligent water management offer independence from the grid (off-grid). A choice that sustains itself, and appreciates, over time.",
    },
    {
      title: "Durability",
      text: "The union of Portuguese limestone and natural cork creates a timeless, effortless beauty, designed to age with quiet elegance across generations.",
    },
  ],
};

export const AMENITIES = [
  { id: "garden", title: "The Garden", text: "Designed in harmony with native flora, a continuous, safe green space." },
  { id: "aqua", title: "Aqua Garden", text: "A heated natural pool, seamlessly integrated into the land's natural contours." },
  { id: "fitness", title: "Fitness Studio", text: "Designed for movement and focus." },
  { id: "hub", title: "Residents' Hub", text: "An extension of your home, dedicated to productivity." },
] as const;

/** The three floors of a home. (The source's "171 m² to 186 m²" waits on the client: see resumeplanlocal.md.) */
export const VILLA_FLOORS = [
  {
    title: "Open Living Space",
    text: "The art of seamless living. Designed across three floors, these villas harmonize the energy of gathering spaces with the quiet retreat of the private quarters.",
  },
  { title: "The Private Upper Floor", text: "The upper floor is a space of rest and privacy." },
  { title: "Private Basement", text: "The private storage space integrates discreetly into the continuous underground level." },
];

export const LOCATION = {
  title: "Close to everything. Far from the noise.",
  body: "Elevated position with panoramic views and natural privacy. Experience the silence of the hills while remaining just moments away from premium urban amenities.",
  groups: [
    { title: "Business & Innovation", places: [{ name: "Taguspark", min: 5 }, { name: "Lagoas Park", min: 7 }] },
    { title: "Education", places: [{ name: "OIS School", min: 4 }, { name: "Nova SBE", min: 12 }] },
    {
      title: "Culture & Leisure",
      places: [
        { name: "Parque dos Poetas", min: 10 },
        { name: "Oeiras Parque", min: 8 },
        { name: "Beaches", min: 10 },
        { name: "Oeiras Green Valley (Golf)", min: 6 },
      ],
    },
    { title: "City Access", places: [{ name: "Lisbon city centre", min: 15 }, { name: "Cascais", min: 15 }] },
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
    title: CONCEPT.title,
    body: CONCEPT.intro,
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
    body: CONCEPT.pillars[0].text,
    annotations: ["Underground parking", "Pedestrian sanctuary", "The Garden"],
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
    name: "V4 Premium Villa",
    kind: "Premium villa",
    status: "Coming 2028",
    area: "+400 m²",
    specs: ["4 bedrooms", "4 bathrooms", "Private pool", "Private elevator", "Home office", "Large garage"],
    image: "/media/renders/villa-pool.jpg",
  },
];
