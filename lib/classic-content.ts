/**
 * The classic site (/classic): navigation, photos, contacts. The story copy it
 * shares with the 3D site lives in lib/content.ts. Photos are the client's
 * renders (SITE-IMAGENS, converted to JPEG) plus the 3D site's own media.
 */

export interface Photo {
  src: string;
  w: number;
  h: number;
  alt: string;
}

const p = (src: string, w: number, h: number, alt: string): Photo => ({ src, w, h, alt });
const C = "/media/classic/";
const R = "/media/renders/";

export const PHOTOS = {
  terraceTall: p(`${C}terrace-hammock-tall.jpg`, 1080, 1440, "A hammock on a stone terrace looking over the hills to the sea"),
  aerialPhoto: p("/media/aerial-village.jpg", 1920, 1080, "Aerial view of the village on its hill in Leceia, Oeiras"),
  aerialRender: p(`${C}aerial-render.jpg`, 2560, 1440, "Aerial view of Vila Leku's homes, gardens and solar roofs among the trees"),
  corkFacade: p(`${C}cork-facade.jpg`, 2560, 1440, "Cork and limestone volumes of the homes, framed by garden trees"),
  naturalPool: p(`${C}natural-pool.jpg`, 2560, 1440, "The natural pool with loungers beneath old trees"),
  fitnessLounge: p(`${C}fitness-lounge.jpg`, 2560, 1440, "The fitness studio seen from a lounge of wooden chairs"),
  cowork: p(`${C}cowork.jpg`, 2560, 1440, "The residents' hub: a calm room with a long table and soft light"),
  gymLounge: p(`${C}gym-lounge.jpg`, 1600, 1200, "The fitness studio opening onto a planted terrace"),
  dining: p(`${C}dining.jpg`, 1600, 1200, "A bright dining room with cane chairs and a large painting"),
  bedroomTwin: p(`${C}bedroom-twin.jpg`, 1200, 900, "A children's bedroom with two low wooden beds"),
  bedroomMaster: p(`${C}bedroom-master.jpg`, 1200, 900, "The master bedroom with a wooden bed and built-in wardrobes"),
  diningTall: p(`${C}dining-tall.jpg`, 1080, 1440, "A bright dining room with cane chairs and a large painting"),
  bedroomTwinTall: p(`${C}bedroom-twin-tall.jpg`, 1080, 1440, "A children's bedroom with two low wooden beds"),
  bedroomMasterTall: p(`${C}bedroom-master-tall.jpg`, 1080, 1440, "The master bedroom with a wooden bed and built-in wardrobes"),
  villaPoolTall: p(`${C}villa-pool-tall.jpg`, 1080, 1440, "A cork-clad villa with its private pool and lawn"),
  living: p(`${R}living.jpg`, 1600, 900, "A living room opening onto the garden"),
  bath: p(`${R}bath.jpg`, 1600, 900, "A limestone bathroom with a freestanding bath"),
  terraceView: p(`${R}terrace-view.jpg`, 1600, 900, "A bedroom terrace with a view over the hills"),
  streetEntrance: p(`${R}street-entrance.jpg`, 1600, 900, "The street entrance, where cars go underground"),
  stoneWall: p(`${R}stone-wall.jpg`, 1600, 900, "Limestone garden walls beneath the homes"),
  townhouses: p(`${R}townhouses-row.jpg`, 1600, 900, "A car-free lane between the townhouses, lined with lavender"),
  villaPool: p(`${R}villa-pool.jpg`, 1600, 900, "A cork-clad villa with its private pool"),
  villagePool: p(`${R}village-pool.jpg`, 1600, 900, "The long natural pool and its pavilion"),
  shadows: p(`${R}shadows-play.jpg`, 1600, 900, "Children's shadows playing on a sunlit stone wall"),
  sunset: p("/media/sunset-aerial.jpg", 1920, 1080, "Golden hour over Oeiras and the village"),
  advisor: p(`${C}advisor.jpg`, 1024, 1280, "Helen Morais, Vila Leku customer advisor"),
  map: p(`${C}map.jpg`, 1222, 975, "Map of the Lisbon coast with Vila Leku between Oeiras and Lisbon"),
} satisfies Record<string, Photo>;

export const NAV = [
  { id: "concept", label: "Concept" },
  { id: "village-heart", label: "Village Heart" },
  { id: "villas", label: "Villas" },
  { id: "location", label: "Location" },
  { id: "gallery", label: "Gallery" },
] as const;

export const CLASSIC = {
  immersive: "Immersive 3D",
  visitCta: "Private visit",
  menu: "Menu",
  top: "Vila Leku — back to the top",
  scroll: "Scroll",
  pillars: "Four pillars",
  villageHeart: { eyebrow: "Village Heart", title: "A village shaped around life." },
  villas: {
    eyebrow: "Villas",
    title: "Find your place.",
    floors: "Three floors",
    whatsapp: "Request a private visit",
    interest: "Register your interest",
    pause: "Pause the photos",
    play: "Play the photos",
    prev: "Previous photo",
    next: "Next photo",
  },
  location: {
    eyebrow: "Location",
    band: { title: "The View", line: "Panoramic river views" },
    openMap: "Open in Google Maps",
    marker: "About the place",
    close: "Close",
  },
  gallery: { eyebrow: "Gallery", title: "Explore Vila Leku.", view: "View", close: "Close", of: "of" },
  visit: {
    eyebrow: "Private visit",
    title: "Come experience Vila Leku.",
    body: [
      "Discover the homes, landscape and shared spaces with our dedicated Vila Leku advisor.",
      "Whether you are looking for a primary residence, a second home or a long-term investment, we are here to help you find the right place.",
    ],
  },
  footer: {
    line: "A contemporary village where natural harmony and modern living converge.",
    place: "Leceia, Oeiras · Portugal",
    explore: "Explore",
    company: "Partners",
    contact: "Contact",
    email: "info@phidias.com",
  },
};

/** Partners as text only (the client: no logos besides Vila Leku and Phidias). */
export const PARTNERS = [
  { role: "Contractor", name: "FCM", note: "Excellence in construction" },
  { role: "Financier", name: "BPI", note: "Solid financial backing" },
  { role: "Real estate agent", name: "Porta da Frente", note: "Exclusive partner" },
];

/** From the client's layout (p. 11). Name, phone and email wait on the client's confirmation. */
export const ADVISOR = {
  name: "Helen Morais",
  role: "Customer Advisor",
  phone: "+351 912 345 678",
  email: "hello@phidi.as",
  whatsapp: "351912345678",
};

export const whatsappLink = (home: string) =>
  `https://wa.me/${ADVISOR.whatsapp}?text=${encodeURIComponent(`Hello, I'd like to arrange a private visit to the ${home} at Vila Leku.`)}`;

export const MAPS_LINK = "https://www.google.com/maps/search/?api=1&query=Leceia%2C%20Oeiras";

/**
 * The four pillars (lib/content.ts CONCEPT order), each with the photo that
 * shows it, cropped close (`pos` is the object-position).
 */
export const PILLAR_PHOTOS: { photo: Photo; pos: string }[] = [
  { photo: PHOTOS.shadows, pos: "42% 50%" },
  { photo: PHOTOS.stoneWall, pos: "36% 50%" },
  { photo: PHOTOS.aerialRender, pos: "36% 62%" },
  { photo: PHOTOS.corkFacade, pos: "74% 38%" },
];

/** Village Heart: one photo per amenity (lib/content.ts AMENITIES order). */
export const AMENITY_PHOTOS: Photo[] = [PHOTOS.corkFacade, PHOTOS.naturalPool, PHOTOS.fitnessLounge, PHOTOS.cowork];

/** The two homes as the classic site shows them (HOMES in lib/content.ts holds the shared facts). */
export const VILLA_PHOTOS: Record<"v3" | "v4", Photo[]> = {
  v3: [PHOTOS.diningTall, PHOTOS.bedroomMasterTall, PHOTOS.bedroomTwinTall, PHOTOS.terraceTall],
  v4: [PHOTOS.villaPoolTall],
};
export const VILLA_NAMES: Record<"v3" | "v4", string> = { v3: "V3 Townhouse", v4: "V4 Premium Villa" };
export const FLOOR_PHOTOS: Photo[] = [PHOTOS.living, PHOTOS.bedroomMaster, PHOTOS.streetEntrance];

/**
 * Map hotspots, as % of the map image (client layout p. 7). Places the map
 * doesn't show have no spot; their list rows simply don't light the map.
 */
export const MAP_MARKER = { x: 53.4, y: 52.2, box: { l: 47, t: 36.4, r: 59.8, b: 47.2 } };
export const MAP_SPOTS: Record<string, { x: number; y: number }> = {
  Taguspark: { x: 64.4, y: 60.4 },
  "Lagoas Park": { x: 74.9, y: 61.7 },
  "Oeiras Parque": { x: 47.4, y: 58.1 },
  Beaches: { x: 43.2, y: 80.2 },
  "Lisbon city centre": { x: 91.9, y: 47.2 },
  Cascais: { x: 12.2, y: 43.9 },
};

export type GalleryCategory = "architecture" | "interiors" | "landscape" | "amenities";

export const GALLERY: { id: GalleryCategory; label: string; items: { photo: Photo; title: string; line?: string }[] }[] = [
  {
    id: "architecture",
    label: "Architecture",
    items: [
      { photo: PHOTOS.corkFacade, title: "Cork and limestone", line: "Portuguese limestone and natural cork, made to age with elegance." },
      { photo: PHOTOS.villaPool, title: "V4 Premium Villa", line: "A private pool and garden." },
      { photo: PHOTOS.townhouses, title: "The lanes", line: "Car-free paths between the homes." },
      { photo: PHOTOS.streetEntrance, title: "The entrance", line: "Every car arrives underground." },
      { photo: PHOTOS.stoneWall, title: "Limestone walls" },
    ],
  },
  {
    id: "interiors",
    label: "Interiors",
    items: [
      { photo: PHOTOS.dining, title: "Dining" },
      { photo: PHOTOS.living, title: "Open living space", line: "The art of seamless living." },
      { photo: PHOTOS.bedroomMaster, title: "Master suite" },
      { photo: PHOTOS.terraceView, title: "Bedroom terrace" },
      { photo: PHOTOS.bedroomTwin, title: "Bedroom" },
      { photo: PHOTOS.bath, title: "Bathroom" },
    ],
  },
  {
    id: "landscape",
    label: "Landscape",
    items: [
      { photo: PHOTOS.aerialRender, title: "The View", line: "Panoramic river views." },
      { photo: PHOTOS.shadows, title: "The Garden", line: "Where children play freely." },
      { photo: PHOTOS.aerialPhoto, title: "The hill", line: "Leceia, Oeiras." },
      { photo: PHOTOS.sunset, title: "Golden hour" },
    ],
  },
  {
    id: "amenities",
    label: "Amenities",
    items: [
      { photo: PHOTOS.naturalPool, title: "Natural Pool", line: "A natural pool within a vast, serene leisure landscape." },
      { photo: PHOTOS.villagePool, title: "Aqua Garden", line: "A heated natural pool, seamlessly integrated into the land." },
      { photo: PHOTOS.fitnessLounge, title: "Fitness Studio", line: "Designed for movement and focus." },
      { photo: PHOTOS.gymLounge, title: "Fitness Studio" },
      { photo: PHOTOS.cowork, title: "Residents' Hub", line: "An extension of your home, dedicated to productivity." },
    ],
  },
];
