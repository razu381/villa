import { Color, Vector3 } from "three";
import { clamp01, lerp } from "./timeline";

/**
 * Time of day → lighting. One source of truth for sun, sky, fog and night.
 * `day` 0 = first light, ~0.5 = noon, ~0.8 = sunset, 1 = night.
 *
 * The sun travels east (+X) → south (+Z) → west (-X). North is -Z.
 */

export interface DayKey {
  day: number;
  /** Sky gradient top (zenith) and horizon. */
  skyTop: string;
  skyHorizon: string;
  /** Fog colour — matches the horizon so the model floats in its own air. */
  fog: string;
  /** Sun elevation in degrees (negative = below horizon). */
  sunElevation: number;
  sunColor: string;
  sunIntensity: number;
  /** Hemisphere fill. */
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  /** 0 = day, 1 = full night (window glow, stars, moonlight). */
  night: number;
  /** Renderer exposure multiplier. */
  exposure: number;
}

/* Tuned for a limestone-paper world: never pure white, never pure black. */
export const DAY_KEYS: DayKey[] = [
  { day: 0.0, skyTop: "#D9D6CC", skyHorizon: "#EADFD2", fog: "#E6DED3", sunElevation: 2, sunColor: "#FFC9A0", sunIntensity: 0.6, hemiSky: "#E9E4DA", hemiGround: "#CFC6B5", hemiIntensity: 1.25, night: 0, exposure: 1.0 },
  { day: 0.12, skyTop: "#DCDCD6", skyHorizon: "#F1DFCB", fog: "#ECE2D6", sunElevation: 9, sunColor: "#FFC594", sunIntensity: 1.6, hemiSky: "#E6E4DD", hemiGround: "#CDBFA9", hemiIntensity: 1.0, night: 0, exposure: 1.0 },
  { day: 0.28, skyTop: "#D3DADB", skyHorizon: "#EDE9DF", fog: "#E9E6DD", sunElevation: 28, sunColor: "#FFE7CC", sunIntensity: 2.4, hemiSky: "#E3E7E6", hemiGround: "#C9C0AC", hemiIntensity: 0.85, night: 0, exposure: 1.0 },
  { day: 0.5, skyTop: "#CBD6DB", skyHorizon: "#EEEDE6", fog: "#EBEAE3", sunElevation: 60, sunColor: "#FFF6EA", sunIntensity: 2.9, hemiSky: "#E2E8EA", hemiGround: "#C8C1AE", hemiIntensity: 0.8, night: 0, exposure: 1.0 },
  { day: 0.66, skyTop: "#D2C8B6", skyHorizon: "#F2D3A6", fog: "#EDD7B6", sunElevation: 18, sunColor: "#FFC27A", sunIntensity: 2.6, hemiSky: "#E8DCC6", hemiGround: "#BFA98A", hemiIntensity: 0.7, night: 0, exposure: 1.0 },
  { day: 0.76, skyTop: "#B9A79E", skyHorizon: "#F2B27E", fog: "#E3B38F", sunElevation: 5, sunColor: "#FF9A55", sunIntensity: 2.0, hemiSky: "#D9C1AD", hemiGround: "#9C8068", hemiIntensity: 0.55, night: 0.05, exposure: 1.0 },
  { day: 0.86, skyTop: "#4A4C63", skyHorizon: "#A7787A", fog: "#6E6170", sunElevation: -4, sunColor: "#FF8248", sunIntensity: 0.35, hemiSky: "#6A6A84", hemiGround: "#3E3A3A", hemiIntensity: 0.5, night: 0.55, exposure: 1.05 },
  { day: 1.0, skyTop: "#121620", skyHorizon: "#272B36", fog: "#1D2029", sunElevation: -12, sunColor: "#A9BCFF", sunIntensity: 0.0, hemiSky: "#3A4460", hemiGround: "#14161B", hemiIntensity: 0.45, night: 1, exposure: 1.1 },
];

export interface DayParams {
  day: number;
  skyTop: Color;
  skyHorizon: Color;
  fog: Color;
  sunDir: Vector3;
  sunColor: Color;
  sunIntensity: number;
  /** Cool moonlight for night (direction fixed, high in the east). */
  moonDir: Vector3;
  moonIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  night: number;
  exposure: number;
}

const tmpA = new Color();
const tmpB = new Color();

function mixHex(a: string, b: string, k: number, out: Color) {
  tmpA.set(a).convertSRGBToLinear();
  tmpB.set(b).convertSRGBToLinear();
  return out.copy(tmpA).lerp(tmpB, k).convertLinearToSRGB();
}

/** Sun azimuth: east at first light → south at noon → west at sunset. */
export function sunAzimuth(day: number) {
  // 0 → east, π/2 → south, π → west
  return lerp(0.08, Math.PI - 0.12, clamp01(day / 0.82));
}

export function directionFrom(azimuth: number, elevationDeg: number, out = new Vector3()) {
  const el = (elevationDeg * Math.PI) / 180;
  return out.set(Math.cos(azimuth) * Math.cos(el), Math.sin(el), Math.sin(azimuth) * Math.cos(el)).normalize();
}

/** Allocates once; pass the same object back in every frame. */
export function createDayParams(): DayParams {
  return {
    day: 0,
    skyTop: new Color(),
    skyHorizon: new Color(),
    fog: new Color(),
    sunDir: new Vector3(1, 0.2, 0),
    sunColor: new Color(),
    sunIntensity: 1,
    moonDir: directionFrom(0.6, 48),
    moonIntensity: 0,
    hemiSky: new Color(),
    hemiGround: new Color(),
    hemiIntensity: 1,
    night: 0,
    exposure: 1,
  };
}

export function getDayParams(dayIn: number, out: DayParams = createDayParams()): DayParams {
  const day = clamp01(dayIn);
  let i = 0;
  while (i < DAY_KEYS.length - 2 && DAY_KEYS[i + 1].day <= day) i++;
  const a = DAY_KEYS[i];
  const b = DAY_KEYS[i + 1];
  const k0 = clamp01((day - a.day) / (b.day - a.day));
  const k = k0 * k0 * (3 - 2 * k0);

  out.day = day;
  mixHex(a.skyTop, b.skyTop, k, out.skyTop);
  mixHex(a.skyHorizon, b.skyHorizon, k, out.skyHorizon);
  mixHex(a.fog, b.fog, k, out.fog);
  mixHex(a.sunColor, b.sunColor, k, out.sunColor);
  mixHex(a.hemiSky, b.hemiSky, k, out.hemiSky);
  mixHex(a.hemiGround, b.hemiGround, k, out.hemiGround);
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, k);
  out.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, k);
  out.night = lerp(a.night, b.night, k);
  out.exposure = lerp(a.exposure, b.exposure, k);
  directionFrom(sunAzimuth(day), lerp(a.sunElevation, b.sunElevation, k), out.sunDir);
  out.moonIntensity = 0.55 * clamp01((out.night - 0.3) / 0.7);
  return out;
}
