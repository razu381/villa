#!/usr/bin/env node
/**
 * Flicker probe for the 3D journey (Playwright, real GPU, same launch flags as perf.mjs).
 * Measure on a production build (npm run build && npm start).
 *
 *   node scripts/flicker.mjs --t 0.8:6.9:0.1          still frames at each t (breathing on, t frozen)
 *   node scripts/flicker.mjs --t 0.8:6.9:0.1 --micro 0.0005
 *                                                      at each t, nudge t ~1 px per frame (snap, no wind):
 *                                                      only unstable pixels flip (z-fighting, aliasing)
 *   node scripts/flicker.mjs --scroll 4.0:5.0          a slow scroll (snap, t stepped per frame)
 *   node scripts/flicker.mjs --t 5.5 --q "home=v4&sun=0.72" --through v4
 *                                                      tree pixels inside the open home
 *   options: --q "quality=3&rm=1"  extra query (variants)    --label name   output folder name
 *            --frames 12  --gap 120 (ms)  --settle 4000 (ms)  --step 0.004 (scroll, t per frame)
 *            --w 1536 --h 864 --dpr 1.25  --channel chrome|msedge  --headed  --base URL  --path /3d-immersive
 *            --keep  also save each still target's first frame
 *
 * Still: N screenshots of the same frozen frame. A pixel "flickers" when its
 * luminance swings back and forth (≥ 3 sign changes among its frame-to-frame
 * steps larger than the threshold); smooth drift, sway and a slow scroll change
 * a pixel monotonically and don't count. Scroll: the same count over sliding
 * 12-frame windows, so textured surfaces moving across the screen count too —
 * compare variants, not absolute numbers. Writes heat-maps (red = flicker) to
 * shots/flicker/<label>/ and prints a table. The film grain is off (?grain=0).
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};
const flag = (n) => args.includes(`--${n}`);
const base = opt("base", `http://localhost:${process.env.PORT || "3000"}`);
const pathName = opt("path", "/3d-immersive");
const q = opt("q", "");
const label = opt("label", q ? q.replace(/[^a-z0-9.=]+/gi, "_") : "default");
const frames = parseInt(opt("frames", "12"), 10);
const gap = parseInt(opt("gap", "120"), 10);
const settle = parseInt(opt("settle", "4000"), 10);
const w = +opt("w", "1536"), h = +opt("h", "864"), dpr = +opt("dpr", "1.25");
const THR = 12;
const out = path.join("shots", "flicker", label);
fs.mkdirSync(out, { recursive: true });

/** "a:b:s" → a, a+s, …, b; "a,b,c" → list. */
const range = (spec) => {
  if (!spec.includes(":")) return spec.split(",").map(Number);
  const [a, b, s = "0.1"] = spec.split(":").map(Number);
  const r = [];
  for (let x = a; x <= b + 1e-9; x += +s) r.push(Math.round(x * 1000) / 1000);
  return r;
};

const browser = await chromium.launch({
  channel: opt("channel", "chrome"),
  headless: !flag("headed"),
  args: ["--enable-gpu", ...(process.platform === "linux" ? ["--use-angle=gl"] : []), "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log(`  [pageerror] ${String(e).slice(0, 300)}`));

async function open(query) {
  await page.goto(`${base}${pathName}?${query}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__VL_READY === true && window.__VL_PROBE, null, { timeout: 180000 });
}
/** Waits for n new rendered frames (and at least `ms`), then grabs the page as greyscale. */
async function grab(n = 1, ms = 0) {
  const f0 = await page.evaluate(() => window.__VL_PROBE.frames());
  const t0 = Date.now();
  await page.waitForFunction((f) => window.__VL_PROBE.frames() >= f, f0 + n, { timeout: 30000 });
  const left = ms - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
  const png = await page.screenshot({ type: "png" });
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { png, data, width: info.width, height: info.height };
}

/** Per pixel: sign changes among significant frame-to-frame steps. */
function flips(seq) {
  const n = seq[0].data.length;
  const count = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    let last = 0, c = 0;
    for (let k = 1; k < seq.length; k++) {
      const d = seq[k].data[p] - seq[k - 1].data[p];
      if (d > THR || d < -THR) {
        const s = d > 0 ? 1 : -1;
        if (last && s !== last) c++;
        last = s;
      }
    }
    count[p] = c;
  }
  return count;
}

/** Heat-map: the first frame darkened, flickering pixels in red. */
async function heat(file, frame, count, min) {
  const { width, height } = frame;
  const rgb = Buffer.alloc(width * height * 3);
  let hits = 0;
  for (let p = 0; p < width * height; p++) {
    const g = frame.data[p] * 0.45;
    const on = count[p] >= min;
    if (on) hits++;
    rgb[p * 3] = on ? 255 : g;
    rgb[p * 3 + 1] = on ? 40 : g;
    rgb[p * 3 + 2] = on ? 40 : g;
  }
  await sharp(rgb, { raw: { width, height, channels: 3 } }).resize(Math.round(width / 2)).png().toFile(file);
  return hits;
}

const rows = [];
const pct = (n, f) => ((100 * n) / (f.width * f.height)).toFixed(3);

if (opt("through", null)) {
  // Trees and planting inside the open home's on-screen box: with vs without them.
  const id = opt("through");
  for (const t of range(opt("t", "5.5"))) {
    const qs = `t=${t}&snap=1&grain=0&probe=1${q ? "&" + q : ""}`;
    await open(qs);
    await page.waitForTimeout(1500);
    const a = await grab(3);
    const rect = await page.evaluate((i) => window.__VL_PROBE.homeRect(i), id);
    await open(`${qs}&secdbg=${encodeURIComponent("hide:landscape-trees*|landscape-planting*")}`);
    await page.waitForTimeout(1500);
    const b = await grab(3);
    const s = dpr;
    const x0 = Math.max(0, Math.floor(rect.x * s)), y0 = Math.max(0, Math.floor(rect.y * s));
    const x1 = Math.min(a.width, Math.ceil((rect.x + rect.w) * s)), y1 = Math.min(a.height, Math.ceil((rect.y + rect.h) * s));
    const count = new Uint8Array(a.data.length);
    let n = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const p = y * a.width + x;
        if (Math.abs(a.data[p] - b.data[p]) > THR) {
          count[p] = 1;
          n++;
        }
      }
    const file = path.join(out, `through-${id}-t${t}.png`);
    await heat(file, a, count, 1);
    await sharp(a.png).extract({ left: x0, top: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }).toFile(path.join(out, `through-${id}-t${t}-home.png`));
    rows.push({ target: `${id} t${t}`, px: n, pct: ((100 * n) / Math.max(1, (x1 - x0) * (y1 - y0))).toFixed(2) + " % of home box", file });
  }
} else if (opt("scroll", null)) {
  const [a, b] = opt("scroll").split(":").map(Number);
  const step = +opt("step", "0.004");
  await open(`t=${a}&snap=1&grain=0&probe=1${q ? "&" + q : ""}`);
  await page.waitForTimeout(1500);
  const seq = [];
  const ts = [];
  for (let t = a; t <= b + 1e-9; t += step) {
    await page.evaluate((v) => window.__VL_PROBE.setT(v), t);
    seq.push(await grab(2));
    ts.push(t);
    // Sliding windows: report each full window, keep memory flat.
    if (seq.length === frames) {
      const count = flips(seq);
      const tm = ts[Math.floor(frames / 2)].toFixed(3);
      const file = path.join(out, `scroll-t${tm}.png`);
      const hits = await heat(file, seq[0], count, 3);
      rows.push({ target: `t ${tm}`, px: hits, pct: pct(hits, seq[0]) + " %", file });
      seq.splice(0, Math.floor(frames / 2));
      ts.splice(0, Math.floor(frames / 2));
    }
  }
} else {
  // --micro d: snap, no wind or breathing, t nudged by d per frame (~1 px of scroll at 0.0005):
  // real content barely moves, so what flips is unstable (z-fighting, shadow or edge aliasing).
  const micro = opt("micro", null) != null ? +opt("micro") : 0;
  for (const t of range(opt("t", "4.5"))) {
    await open(`t=${t}&grain=0&probe=1${micro ? "&snap=1&rm=1" : ""}${q ? "&" + q : ""}`);
    await page.waitForTimeout(micro ? 1500 : settle);
    const seq = [];
    for (let k = 0; k < frames; k++) {
      if (micro) await page.evaluate((v) => window.__VL_PROBE.setT(v), t + k * micro);
      seq.push(await grab(micro ? 2 : 1, micro ? 0 : gap));
    }
    const count = flips(seq);
    const file = path.join(out, `t${t.toFixed(2)}.png`);
    const hits = await heat(file, seq[0], count, 3);
    if (flag("keep")) fs.writeFileSync(path.join(out, `t${t.toFixed(2)}-frame.png`), seq[0].png);
    rows.push({ target: `t ${t.toFixed(2)}`, px: hits, pct: pct(hits, seq[0]) + " %", file });
    console.log(`  t ${t.toFixed(2)}  ${String(hits).padStart(7)} px  ${pct(hits, seq[0])} %`);
  }
}

console.log(`\nflicker probe — ${label} (${q || "default"})`);
for (const r of rows) console.log(`${r.target.padEnd(14)} ${String(r.px).padStart(8)} px  ${r.pct.padStart(10)}   ${r.file}`);
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(rows, null, 2));
await browser.close();
