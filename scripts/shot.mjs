#!/usr/bin/env node
/**
 * Screenshot harness for the 3D journey (Playwright, real GPU by default).
 *
 *   node scripts/shot.mjs --t 1.5,2.4,3.3 [--port 3000] [--w 1440 --h 900] [--mobile]
 *                         [--q "home=v4&sun=0.3"] [--out shots] [--wait 1500] [--name prefix] [--info]
 *   --q "cam=x,y,z,tx,ty,tz,fov"  pins the camera for close-up inspection
 *   --info                         prints the WebGL renderer and stats (draw calls, triangles, programs)
 *   --base https://x.vercel.app    screenshot a deployed build instead of localhost
 *   --path /3d-immersive           the route to load (default: the 3D's hidden route)
 *   --channel chrome|msedge        installed browser to drive (default chrome)
 *   --headed                       run a visible window (if headless frames come back black)
 *   --swiftshader                  software WebGL, as in the cloud container
 *   VL_CHROMIUM=/path/to/chromium  use that binary instead of an installed channel
 *
 * Loads http://localhost:PORT/3d-immersive?t=<t>&snap=1&<q> for each t, waits for
 * window.__VL_READY, waits --wait ms more, saves PNGs and prints console errors.
 * Each PNG path is printed — open them with the Read tool to look at them.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

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
const pathName = opt("path", "/3d-immersive");
// --base https://example.vercel.app  screenshots a deployed build instead of localhost.
const base = opt("base", `http://localhost:${port}`);
const swiftshader = flag("swiftshader");
fs.mkdirSync(out, { recursive: true });

// Headless Chrome on Linux falls back to SwiftShader unless the GPU is asked for
// explicitly; Windows (ANGLE/D3D11) and macOS (Metal) keep their default backend.
const gpuArgs = swiftshader
  ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  : ["--enable-gpu", ...(process.platform === "linux" ? ["--use-angle=gl"] : [])];
const browser = await chromium.launch({
  ...(process.env.VL_CHROMIUM ? { executablePath: process.env.VL_CHROMIUM } : { channel: opt("channel", "chrome") }),
  headless: !flag("headed"),
  args: [...gpuArgs, "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
let failures = 0;
let gpuShown = false;
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
    if (!gpuShown) {
      const gpu = await page
        .evaluate(() => {
          const gl = document.createElement("canvas").getContext("webgl2");
          const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
          const r = gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : "no WebGL2";
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
          return r;
        })
        .catch(() => "unknown");
      console.log(`  gpu: ${gpu}`);
      if (!swiftshader && /SwiftShader/i.test(gpu)) console.log("  WARNING: software WebGL; frames and stats are not representative of a real GPU");
      gpuShown = true;
    }
    const st = await page.evaluate(() => (window.__VL_STATS ? window.__VL_STATS() : null)).catch(() => null);
    if (st) console.log(`  stats: ${JSON.stringify(st)}  (note: with post-processing, calls include effect passes)`);
  }
  const file = path.join(out, `${prefix}_t${t}${extra ? "_" + extra.replace(/[^a-z0-9.=]+/gi, "-") : ""}.png`);
  await page.screenshot({ path: file, timeout: 90000 });
  console.log(`${file}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const uniq = [...new Set(errors)].filter((e) => !/Download the React DevTools|THREE.WebGLRenderer: Context Lost|GPU stall due to ReadPixels|Automatic fallback to software WebGL|THREE.Clock: This module has been deprecated/.test(e));
  if (uniq.length) console.log("  console:\n   " + uniq.slice(0, 12).join("\n   "));
  await ctx.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
