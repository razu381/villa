#!/usr/bin/env node
/**
 * Screenshot harness for the 3D journey (headless Chromium + SwiftShader WebGL).
 *
 *   node scripts/shot.mjs --t 1.5,2.4,3.3 [--port 3000] [--w 1440 --h 900] [--mobile]
 *                         [--q "home=v4&sun=0.3"] [--out shots] [--wait 1500] [--name prefix] [--info]
 *   --q "cam=x,y,z,tx,ty,tz,fov"  pins the camera for close-up inspection
 *   --info                         prints renderer stats (draw calls, triangles, programs)
 *   --base https://x.vercel.app    screenshot a deployed build instead of localhost
 *
 * Loads http://localhost:PORT/?t=<t>&snap=1&<q> for each t, waits for
 * window.__VL_READY, waits --wait ms more, saves PNGs and prints console errors.
 * Each PNG path is printed — open them with the Read tool to look at them.
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const port = opt("port", process.env.PORT || "3000");
const ts = String(opt("t", "0")).split(",").map((s) => s.trim()).filter(Boolean);
const mobile = flag("mobile");
const w = parseInt(opt("w", mobile ? "390" : "1440"), 10);
const h = parseInt(opt("h", mobile ? "844" : "900"), 10);
const extra = opt("q", "");
const out = opt("out", "shots");
const wait = parseInt(opt("wait", "1500"), 10);
const prefix = opt("name", mobile ? "m" : "d");
const pathName = opt("path", "/");
// --base https://example.vercel.app  screenshots a deployed build instead of localhost.
const base = opt("base", `http://localhost:${port}`);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
let failures = 0;
for (const t of ts) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text().slice(0, 400)}`);
  });
  page.on("pageerror", (e) => errors.push(`[pageerror] ${String(e).slice(0, 600)}`));
  const url = `${base}${pathName}?t=${t}&snap=1${extra ? "&" + extra : ""}`;
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForFunction(() => window.__VL_READY === true, null, { timeout: 180000 });
  } catch (e) {
    errors.push(`[harness] not ready: ${String(e).slice(0, 300)}`);
    failures++;
  }
  await page.waitForTimeout(wait);
  if (flag("info")) {
    const st = await page.evaluate(() => (window.__VL_STATS ? window.__VL_STATS() : null)).catch(() => null);
    if (st) console.log(`  stats: ${JSON.stringify(st)}  (note: with post-processing, calls include effect passes)`);
  }
  const file = path.join(out, `${prefix}_t${t}${extra ? "_" + extra.replace(/[^a-z0-9.=]+/gi, "-") : ""}.png`);
  await page.screenshot({ path: file });
  console.log(`${file}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const uniq = [...new Set(errors)].filter((e) => !/Download the React DevTools|THREE.WebGLRenderer: Context Lost|GPU stall due to ReadPixels|Automatic fallback to software WebGL|THREE.Clock: This module has been deprecated/.test(e));
  if (uniq.length) console.log("  console:\n   " + uniq.slice(0, 12).join("\n   "));
  await ctx.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
