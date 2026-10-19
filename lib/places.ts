/**
 * The photos behind the 3D. Each place explore can open (the two featured
 * homes and the village heart) has spots, each with some of the client's
 * renders. A spot with a point in the model gets a pin there
 * (canvas/homes/Spots.tsx finds it on screen, components/homes/Spots.tsx draws
 * it); one without is in the gallery only. Three-free, so the HTML layer can
 * read it.
 *
 * Which render belongs to which home waits on the client (resumeplanlocal.md):
 * V3 takes the classic site's set (VILLA_PHOTOS), V4 the interiors no home had
 * claimed. Every photo is shown as an artistic interpretation.
 */
import { PHOTOS, type Photo } from "./classic-content";
import type { Place } from "./store";

export interface PlacePhoto {
  photo: Photo;
  title: string;
  line?: string;
}

export type SpotAt =
  /** A room of the open home: an anchor its interior layout names (canvas/homes/interiors.ts). */
  | { room: string }
  /** A point outside the house: the villa's own pool, or one of the village heart's places. */
  | { outside: "pool" | "aqua" | "fitness" | "hub" };

export interface Spot {
  /** Unique across the places (`?photo=<key>` opens it). */
  key: string;
  place: Place;
  /** The pin's label. */
  label: string;
  /** Where the pin stands; null = in the gallery only. */
  at: SpotAt | null;
  photos: PlacePhoto[];
}

export const SPOTS: Spot[] = [
  { key: "v3-dining", place: "v3", label: "Dining", at: { room: "dining" }, photos: [{ photo: PHOTOS.dining, title: "Dining" }] },
  { key: "v3-master", place: "v3", label: "Master suite", at: { room: "master" }, photos: [{ photo: PHOTOS.bedroomMaster, title: "Master suite" }] },
  { key: "v3-bedroom", place: "v3", label: "Bedroom", at: { room: "bedroom" }, photos: [{ photo: PHOTOS.bedroomTwin, title: "Bedroom" }] },
  { key: "v3-terrace", place: "v3", label: "Terrace", at: { room: "terrace" }, photos: [{ photo: PHOTOS.terrace, title: "Terrace" }] },
  { key: "v3-lane", place: "v3", label: "The lane", at: null, photos: [{ photo: PHOTOS.townhouses, title: "The lane", line: "Car-free paths between the homes." }] },

  { key: "v4-living", place: "v4", label: "Living", at: { room: "living" }, photos: [{ photo: PHOTOS.living, title: "Open living space", line: "The art of seamless living." }] },
  { key: "v4-bath", place: "v4", label: "Bathroom", at: { room: "bath" }, photos: [{ photo: PHOTOS.bath, title: "Bathroom" }] },
  { key: "v4-terrace", place: "v4", label: "Bedroom terrace", at: { room: "deck" }, photos: [{ photo: PHOTOS.terraceView, title: "Bedroom terrace" }] },
  { key: "v4-pool", place: "v4", label: "Private pool", at: { outside: "pool" }, photos: [{ photo: PHOTOS.villaPool, title: "Private pool", line: "A private pool and garden." }] },

  {
    key: "heart-aqua",
    place: "heart",
    label: "Aqua Garden",
    at: { outside: "aqua" },
    photos: [
      { photo: PHOTOS.villagePool, title: "Aqua Garden", line: "A heated natural pool, seamlessly integrated into the land." },
      { photo: PHOTOS.naturalPool, title: "Natural Pool", line: "A natural pool within a vast, serene leisure landscape." },
    ],
  },
  {
    key: "heart-fitness",
    place: "heart",
    label: "Fitness Studio",
    at: { outside: "fitness" },
    photos: [
      { photo: PHOTOS.fitnessLounge, title: "Fitness Studio", line: "Designed for movement and focus." },
      { photo: PHOTOS.gymLounge, title: "Fitness Studio" },
    ],
  },
  {
    key: "heart-hub",
    place: "heart",
    label: "Residents' Hub",
    at: { outside: "hub" },
    photos: [{ photo: PHOTOS.cowork, title: "Residents' Hub", line: "An extension of your home, dedicated to productivity." }],
  },
];

const PLACES: Place[] = ["v3", "v4", "heart"];

/** Each place's spots, in gallery order. */
export const PLACE_SPOTS = Object.fromEntries(PLACES.map((p) => [p, SPOTS.filter((s) => s.place === p)])) as Record<Place, Spot[]>;

/** Each place's gallery: its spots' photos in order. */
export const PLACE_PHOTOS = Object.fromEntries(PLACES.map((p) => [p, PLACE_SPOTS[p].flatMap((s) => s.photos)])) as Record<Place, PlacePhoto[]>;

/** Where a spot's first photo sits in its place's gallery. */
export function spotIndex(spot: Spot) {
  let i = 0;
  for (const s of PLACE_SPOTS[spot.place]) {
    if (s === spot) return i;
    i += s.photos.length;
  }
  return 0;
}

/** The gallery index of a photo by its file (the panel's render opens on itself), else 0. */
export function photoIndex(place: Place, src: string) {
  return Math.max(0, PLACE_PHOTOS[place].findIndex((p) => p.photo.src === src));
}
