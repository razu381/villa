#!/usr/bin/env node
/**
 * Scroll-through performance probe (real GPU, same launch flags as shot.mjs).
 *
 *   node scripts/perf.mjs [--base http://localhost:3000] [--path /3d-immersive] [--dur 60] [--w 1536 --h 864 --dpr 1.25]
 *                         [--q "tier=mid"] [--channel chrome|msedge] [--headed]
 *
 * Cold load at t 0, waits for ready, then scrolls linearly to the end over --dur
 * seconds while recording every rAF frame time and the shader program count.
 * Prints fps per half-chapter band, when programs compile, and every frame > 50 ms.
 * Measure on a production build (npm run build && npm start): dev React is slower.
 * Default viewport = a 1920x1080 laptop panel at 125% Windows scaling.
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const base = opt("base", `http://localhost:${process.env.PORT || "3000"}`);
const pathName = opt("path", "/3d-immersive");
const dur = parseFloat(opt("dur", "60"));
const w = +opt("w", "1536"), h = +opt("h", "864"), dpr = +opt("dpr", "1.25");
const q = opt("q", "");
const browser = await chromium.launch({
  channel: opt("channel", "chrome"),
  headless: !args.includes("--headed"),
  args: ["--enable-gpu", ...(process.platform === "linux" ? ["--use-angle=gl"] : []), "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
const tLoad = Date.now();
await page.goto(`${base}${pathName}${q ? "?" + q : ""}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__VL_READY === true, null, { timeout: 120000 });
const readyMs = Date.now() - tLoad;
await page.waitForTimeout(1500);
const meta = await page.evaluate(() => ({ tier: document.documentElement.dataset.tier, dpr: devicePixelRatio, canvas: (() => { const c = document.querySelector("canvas"); return c ? `${c.width}x${c.height}` : "none"; })() }));
const res = await page.evaluate(async (dur) => {
  const secs = [...document.querySelectorAll("[data-chapter]")].map((el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, height: r.height }; });
  const tOf = (y) => { let i = 0; while (i < secs.length - 1 && y >= secs[i + 1].top) i++; return i + Math.min(1, Math.max(0, (y - secs[i].top) / secs[i].height)); };
  const max = document.documentElement.scrollHeight - innerHeight;
  const frames = [];
  return await new Promise((done) => {
    const t0 = performance.now(); let last = t0;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / (dur * 1000));
      const y = p * max;
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
      const st = window.__VL_STATS ? window.__VL_STATS() : { programs: -1 };
      frames.push([now - last, tOf(y), st.programs]);
      last = now;
      if (p < 1) requestAnimationFrame(step); else done(frames);
    };
    requestAnimationFrame(step);
  });
}, dur);
await browser.close();

const bands = {};
const long = [];
let prevProg = null;
const progJumps = [];
for (const [dt, t, prog] of res.slice(1)) {
  const b = (Math.floor(t * 2) / 2).toFixed(1);
  (bands[b] ||= []).push(dt);
  if (dt > 50) long.push(`t=${t.toFixed(2)} ${dt.toFixed(0)}ms prog=${prog}`);
  if (prevProg !== null && prog !== prevProg) progJumps.push(`t=${t.toFixed(2)} ${prevProg}->${prog}`);
  prevProg = prog;
}
const all = res.slice(1).map((r) => r[0]).sort((a, b) => a - b);
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log(`viewport ${w}x${h} @${dpr} tier=${meta.tier} canvas=${meta.canvas} ready=${readyMs}ms frames=${all.length}`);
console.log(`overall: avg ${(1000 / (all.reduce((s, x) => s + x, 0) / all.length)).toFixed(1)} fps, median ${pct(all, 0.5).toFixed(1)}ms, p95 ${pct(all, 0.95).toFixed(1)}ms, p99 ${pct(all, 0.99).toFixed(1)}ms, max ${all[all.length - 1].toFixed(0)}ms`);
for (const [b, a] of Object.entries(bands).sort((x, y) => +x[0] - +y[0])) {
  const s = [...a].sort((x, y) => x - y);
  console.log(`  t ${b}-${(+b + 0.5).toFixed(1)}: ${(1000 / (a.reduce((x, y) => x + y, 0) / a.length)).toFixed(1)} fps  p95 ${pct(s, 0.95).toFixed(1)}ms  max ${s[s.length - 1].toFixed(0)}ms  (${a.length} frames)`);
}
console.log(`program count changes: ${progJumps.join(", ") || "none"}`);
console.log(`frames > 50ms (${long.length}): ${long.slice(0, 40).join(" | ")}`);
