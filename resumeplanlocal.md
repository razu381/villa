# Vila Leku demo: plan to resume locally

Everything still to do on the Vila Leku 3D pitch demo, in priority order, written so you (or Claude Code locally) can pick it up cold.
Creative intent: `PLAN.md`. Run/debug basics: `README.md`.

---

## 0. Where things stand

| | |
|---|---|
| Branch | **`main`** (everything merged; created from `claude/epic-carson-cm917t`, which is kept as history). Work on short feature branches and merge into `main`. |
| Live | https://villa-bay-iota.vercel.app (in Vercel → Project Settings → Git, set **Production Branch = `main`**; on GitHub, set the default branch to `main`) |
| Pitch device | **Windows laptop**. Every P0 target below is measured there first (Chrome/Edge on ANGLE/Direct3D). |
| Visit form | **Stays simulated** for the pitch (no backend; it shows the invitation card) |
| Stack | Next.js 16.4 (Turbopack), React 19.3, three r186, @react-three/fiber 9, drei 10, @react-three/postprocessing 3, gsap, lenis, zustand |

**Built, merged and verified with screenshots:**
- Foundation
- Landscape
- Houses
- HTML interface
- Section ("Cars below. Life above.")
- Featured homes ("Two ways to live")
- A director pass
- Hero film lengthened to a **34 s seamless loop** (2026-10-16, on request: at least 30 s). Exteriors only, cut from the client's film `PHIDIAS_Vila-Leku-Filme-Alterado-1.mp4`: the windmill (6.4–12.0 s), dissolve to the village aerial, then the lanes, wall shadows, garden, loungers and pool (17.75–48.2 s); a 1 s crossfade joins the end to the start. Skipped: the shots with the burned-in wordmark and map text. VP9 7.7 MB / H.264 9.5 MB desktop (1600×900), 3.4 / 4.3 MB mobile. The poster is the loop's first frame.

The full story works end to end: hero film → match cut → contours → podium → line drawing → white model → material sweep → section with cars → exploded homes with hold the sun → night invitation.

**Not done yet:**
1. **QA fixes part 1 (`e665a9b`) are type-checked and build, but not visually re-checked** (§2).
2. **Remaining review findings.** The fixer agent was cut off by a usage limit (§3).
3. **Section and homes never had their independent critique and polish.** The critic agents were cut off (§4).
4. **Never tested on a real GPU or real devices.** Every check so far ran in headless Chromium with *software* WebGL (SwiftShader). Real performance and the true look are unverified, and this is the biggest risk before a pitch (§5).

The latest independent review scores, after the director pass and before part 1: visual 6.5/10 · mobile/interaction 7.4/10 · performance 6.5/10. All interactions work: scroll, home cards, explore, the sun slider by keyboard, the chapter index, the form and card, sound, and no horizontal overflow.

---

## 1. Local setup

```bash
git clone https://github.com/razu381/villa && cd villa
git checkout main
npm install            # Node 20.9+ (22 recommended)
npm run dev            # http://localhost:3000
npm run typecheck && npm run build
```

Debug URL parameters (see README):
- `?t=3.4` jumps to a journey position
- `?snap=1` turns off easing
- `?home=v3|v4` opens a home
- `?sun=0..1` holds the sun
- `?tier=high|mid|low` forces a quality tier
- `?rm=1` forces reduced motion
- `?invite=demo` shows the invitation card
- `?cam=x,y,z,tx,ty,tz,fov` pins the camera

Notes:
- `next dev` rewrites an agent-rules block in `AGENTS.md`. Keep it committed.
- `shots/` is git-ignored scratch space for screenshots.

### ✅ 1.1 Make the screenshot tool portable (do this first)

> **Done.** `shot.mjs` now imports the local `playwright` devDependency and drives an installed browser (`--channel chrome|msedge`, default chrome; `VL_CHROMIUM` overrides with a binary). Real GPU by default, `--swiftshader` for software WebGL, `--headed` for a visible window, screenshot timeout 90 s. `--info` also prints the WebGL renderer string and warns if it is SwiftShader. No `npx playwright install` is needed when Chrome or Edge is installed.
> **Finding (Linux):** headless Chrome and Edge silently fall back to SwiftShader unless `--enable-gpu` and an ANGLE backend are passed, so the script adds `--enable-gpu` everywhere and `--use-angle=gl` on Linux only (Windows keeps its default D3D11, macOS keeps Metal). On Windows, confirm with `--info` that the gpu line names the real adapter.
> **No ImageMagick?** Any tiler works; e.g. a 20-line PIL script that pastes the PNGs into a grid.

`scripts/shot.mjs` is hard-wired to the cloud container: it requires Playwright from `/opt/node-tools/node_modules/` and launches `/opt/pw-browsers/chromium` with SwiftShader flags. Locally:

```bash
npm i -D playwright@1.56.1
npx playwright install chromium
```

Then in `scripts/shot.mjs`:
- Replace the `createRequire('/opt/node-tools/...')` lines with `import { chromium } from "playwright";`.
- Only pass `executablePath` if `process.env.VL_CHROMIUM` is set.
- Only pass the SwiftShader flags (`--use-angle=swiftshader --enable-unsafe-swiftshader`) behind a `--swiftshader` option. By default let Chromium use the real GPU. On macOS, `channel: "chrome"` with headless mode usually gets Metal/ANGLE; if frames come back black, try `headless: false`.
- Raise the hard-coded `page.screenshot` timeout to 60–90 s. Under load it dropped frames at 30 s.

On Windows: run it from PowerShell or Git Bash; `channel: "msedge"` or `"chrome"` uses the real GPU through ANGLE/Direct3D. That is exactly the pitch path, so use it for all verification. `montage` needs ImageMagick (`winget install ImageMagick.ImageMagick`).

Real-GPU screenshots take about 1–2 s instead of 20–45 s, and show the true look. SwiftShader can differ slightly, for example in bloom, precision and shadows.

Use: `node scripts/shot.mjs --t 1.6,2.6,4.5 --out shots/x [--mobile] [--q "home=v4&sun=0.72"] [--info]`. `--info` prints draw calls, triangles and shader programs. View many frames at once with `montage shots/x/*.png -tile 3x -geometry 600x375+2+2 shots/x-sheet.jpg` (ImageMagick).

---

## ✅ 2. First: visually verify QA part 1 (`e665a9b`)

> **Done** (real GPU, Intel UHD / ANGLE-GL, prod build). Per row:
> - **Sun path** ✓ morning azimuth ~20° (light from the right, raking the south faces), golden hour ~175° (from the left, shadows east), monotonic. The whole 116° swing happens inside the section chapter (t 4.0–4.95) at 47–60° elevation; gentle in scroll (~4° per 100 px). The code comment says "east-north-east"; it is actually east-south-east.
> - **Cut tree crowns** ✗→✓ the fix had no effect: the tree poché painted every back face flat dark olive after lighting, and the real "eye" was an *inner* lobe's front face seen through the cut. Fixed: trees drop the flat poché (still double-sided); the builder bakes a `hidden` weight per vertex (inside a neighbouring blob or facing into the crown); on crowns the plane runs through, back faces and hidden faces take the flat lit cap shading, no cavity AO. Trees away from the cut, and every frame with the section closed, are unchanged.
> - **Header backdrop** ✓ wordmark, "The homes", EN legible at 4.8–5.9 and in explore.
> - **Night** ✓ copy on dark air, form on its glass surface, no trees through the date grid. ✗ **stars**: only 2 faint dots, visible at ×3 gain. The sky below the horizon is covered by the fogged ground plane (R ≈ 4,200), so the "stars in the dark air" change can never show; see 3.23.
> - **Golden hour / dusk** ✓ 5.5 neutral-warm, not orange; 6.3 is a dusty rose-brown, not purple.
> - **Homes keys** ✓ both featured homes inside the 25–60% band at 5.1 / 5.5 / 5.9, clear of the header.
> - **Index overlay** ✗→✓ ghosts remained at 0.1 ("…fe above." legible beside the panel) and the legend eyebrow did not dim at all (GSAP reveals set inline opacity). Now `opacity: 0 !important` while the index is open; everything returns on close.
> - **Mobile 6.6** ✓ no half-cut eyebrow at the bottom.
> - **New, outside the table:** t ≈ 4.3 (section dive) flashes black (see 3.0 below).

Shoot desktop frames at t 3.0, 3.9, 4.5, 4.8, 5.1, 5.5, 5.9, 6.3, 6.7, plus `?home=v4&sun=0.72`, `?home=v3`, `?invite=demo` at 6.7, and mobile at 5.5 and 6.6. Check each fix:

| Fix | Where | Look for |
|---|---|---|
| Sun moved to the side of the camera (`sunAzimuth`, eased) | `lib/day.ts` | Morning (t 3.0–3.9): light rakes the south faces from the right. Golden hour (5.1–5.9, explore): light comes across from the left, shadows fall east. The arch indicator still moves forward only. No odd swing during the section chapter. |
| Cut tree crowns get a flat cap face | `canvas/world/landscape/Trees.tsx` (`CAP`, back-face lighting) | t 4.5 / 4.8: no dark hollow "eye" in trees sliced by the section. |
| Denser header backdrop on busy frames (`data-busy`) | `components/chrome/Chrome.tsx`, `app/globals.css` | t 4.8–5.9 and explore: the VILALEKU wordmark, "The homes" and EN stay legible over roofs. |
| Night camera targets lifted; form on a glass surface; deeper night text scrim; stars in the dark air | `lib/camera.ts` (keys 6.3/6.8), `globals.css`, `canvas/Day.tsx` | t 6.3/6.7: body copy on dark air, not on lit windows. No trees showing through the date grid. A few stars visible. |
| Golden-hour fill cooler; dusk sky ink-blue instead of mauve | `lib/day.ts` keys 0.66 / 0.86 | Less orange and more limestone/cork contrast at 5.5. No purple at 6.3. |
| Homes chapter keys aim 4.5 m higher | `canvas/homes/shots.ts` | Both featured homes in the 25–60% vertical band, clear of the header. |
| Index overlay dims text to 0.1; mobile night tail starts lower (37svh) | `globals.css` | With the sun-arc index open, no ghost title. On mobile t 6.6, no half-cut eyebrow at the bottom edge. |

Fix whatever looks wrong, then commit.

---

## 3. Remaining fixes, prioritised

Each item: **where** → **what to do** → **done when**. Review suggestions are quoted where they're concrete.

### P0: must do before the pitch

> **Order (decided 2026-10-16): finish the demo first, optimize later.** Keep performance work general (clients' devices are usually better than the dev machine, but cheaper ones must still work). Don't tune to one machine. Feature and story items come before further optimization.
>
> **Scope (decided 2026-10-16): desktop only.** This is a pitch demo for the Windows laptop. Mobile and tablet optimization is deferred (⏸) until the client asks for it: 3.8, 3.20, 3.21, P2 mid-tier geometry, and the phone parts of other items (e.g. 3.3's phone fps). Don't spend time on them, and don't break the mobile layout either.

> The pitch runs on a **Windows laptop**. Chrome and Edge there go through ANGLE → Direct3D 11, where shader compilation is the slowest of any platform, and the GPU is often an Intel or AMD integrated chip. So 3.1 (warm-up) and 3.2/3.3 (tiering and adaptive quality) come first.
> Step zero: open `chrome://gpu` on the pitch laptop and note the GPU string, and check whether it switches to a discrete GPU on battery vs mains power. Present on mains power.

> **Baseline (2026-10-16, after `307df3d`), the reference for 3.1–3.3.** Dev machine, not the pitch laptop: Linux, Intel UHD Graphics CML GT2 (CometLake-U, 24 EU, a weak iGPU; Iris Xe is roughly 3–4× faster), Chrome 154, `ANGLE (Intel, Mesa Intel(R) UHD Graphics (CML GT2), OpenGL 4.6)`. Prod build, `node scripts/perf.mjs` (1536×864 @1.25 = 1920×1080 canvas, tier high, 60 s scroll):
> - **12.5 fps average** (median 83 ms, p95 133 ms, max 567 ms). By band: 23 fps behind the hero film (t < 1, where the GPU should idle), 22 at the contours, 13 as the houses rise (t 2.0–2.5, max 567 ms), 8–10 from the sweep to dusk, 8 in the homes chapter, 12.5 at night.
> - **GPU-bound.** The main thread is 5–15% busy (4–17 ms CPU per frame).
> - **Pixel count isn't the main cost.** DPR 1.0 gives 16.5 fps. `?tier=low` (no post, no shadows) gives 10–15 fps in the heavy chapters, with a 2.6 s stall at t ≈ 2.5.
> - **Programs compile on first sight:** 12 → 15 at t 1.48, 17 → 35 at 2.11 (the 567 ms stall), 40 → 44 at 3.59, 44 → 48 at 3.85, 49 → 52 at 4.6, 52 → 55 at 5.02, 56 at 6.04. `--info` at 6.6: ~100 draw calls, ~720k triangles.

✅ **3.0 Black flash in the section dive (t ≈ 4.28–4.32).** *(found in §2)*
- *Where:* some scene shader emits NaN/Inf in the descending camera pose while the section plane sweeps in; the bloom mip pyramid (`canvas/Post.tsx`, always on) smears it into a near-black frame.
- *Seen:* prod build, real GPU: intermittent black frames on arrival by scroll and on a cold `?t=4.3`. Tier low (no composer) renders fine; t 4.25 and 4.35 are fine.
- *Done when:* no black frame anywhere in a slow scroll through 4.1–4.5 (sampled every frame) at tier high and mid.
- *Done:* the source was a single NaN pixel from the planting's derivative bump (`normalize` of a zero vector when a near-camera shrub is seen edge-on). The same guard `houses/materials.ts` already had now covers `Planting.tsx` and the stone walls (`wallsMaterial.ts`). A float-target scan finds no non-finite pixel over 40 frames at t 4.26–4.34, 1.6, 2.6, 3.5, 4.5, 4.8, 5.5, 6.6 and explore v3/v4 (before: one at frame 0 at 4.3). A 12 s scroll 4.1 → 4.5 on the prod build: 46 sampled frames at tier high and mid, none dark.

✅ **3.1 Compile shaders up front, so stages don't stall when they first appear.**
- *Where:* new `Warmup` component in `canvas/Experience.tsx`; first Explore click in `canvas/homes/FeaturedHome.tsx`.
- *Problem:* every stage starts hidden, so its shader programs compile and its buffers upload on the first frame it appears. That's 18 programs at once at t≈2.2 as the houses rise, 3–4 at later chapters, and 5 programs plus 31 geometry uploads on the first Explore click. Each blocks about 30 ms or more, and much longer on Windows/ANGLE and phones.
- *Do:* after the ready signal, while the hero film still covers the canvas (t < 0.5):
  1. Record every object's `visible` flag, then set all objects visible, including the exploded levels and interiors.
  2. `await gl.compileAsync(scene, camera, scene)`.
  3. Set `gl.shadowMap.needsUpdate = true` and render once into a 1×1 half-float render target (same tone-mapping and colour space as the composer input), so the shadow depth programs compile and all buffers upload.
  4. Restore the visibility flags and dispose of the target.
  5. On tier low (no composer), render to the canvas with a 1-px scissor instead.
- *Done when:* the program count from `--info` is already final (~59) at t 0.5 and stays flat to the end, including the first Explore.
- *Done:* `Warmup` in `canvas/Experience.tsx` replaces `ReadySignal`, and `ready` now waits for it. HeroMedia already holds the still until ready and eases the dissolve in if the visitor got there first, so nothing changes on screen. What differs from the plan:
  - **No visibility toggling for compile.** `compile()` walks hidden objects anyway. It runs with a 1×1 half-float target bound, so the programs match the composer's RenderPass (linear, untonemapped). On tier low it uses the canvas.
  - **The render step is spread over frames.** Each object is drawn once on its own (visible, unculled), with an 8 ms budget per frame. The shadow pass compiles its 9 depth programs synchronously, and one full-scene render blocked the main thread for one long stretch.
  - **The scene is hidden until ready**, so the frames behind the film stay light.
  - **An empty render starts each upload frame.** three's shadow pass keys its depth programs on the lights of the *previous* render of the scene. Without that render it compiled 0-light variants the journey never uses (seen as 62 → 66 programs).
  - *Result (prod build, `scripts/perf.mjs`, quiet machine, same protocol as the baseline):*

    | | before | after |
    |---|---|---|
    | Average fps | 11.8 | 12.3 |
    | p99 / max frame | 250 / 700 ms | 167 / 300 ms |
    | Worst frame after t 0.5 | 433 ms | 217 ms, the scene's normal cost |
    | Program jumps through the scroll | 11 | none |
    | Houses rise (t 2.0–2.5) max | 700 ms | 83 ms |
    | First Explore | +6 programs, +29 geometries, 800–870 ms freeze | +0 / +0, max frame 150 ms (V4) / 267 ms (V3) |
    | Time to ready | 2.6 s | 4.2 s, behind the film |

  - *Program count:* `--info` shows 62 on high, 60 on mid, 45 on low, at ready on a t 0 load, flat through the whole scroll and the first Explore. A cold load deeper in (`?t=6.6`, `?home=v4`) shows 63–65. Its first frame compiles throwaway 0-light shadow variants (the same three quirk, on a fresh render state), still before ready and flat afterwards.
  - *Dev machine caveat:* on Linux (ANGLE → OpenGL → Mesa), `compileAsync` resolves before the driver has really compiled. The first synchronous compile then waits for the whole backlog, so the parallel compile shows little benefit here. On Windows/D3D11 the parallel compile is real.
  - *Check on the pitch laptop:* time to ready, and that `--info` stays flat.
  - *Also seen, not 3D:* under heavy GPU contention from another browser, a 5–7 s hitch at t ≈ 0.8 when scrolling in from t 0, with no main-thread work and no compiles. It wasn't present on the quiet machine (t 0.5–1.0 max 167 ms). It's likely the hero stills' first composite. Recheck on the laptop with 3.3.

✅ **3.2 Stop the device check from creating a second WebGL context.**
- *Where:* `lib/tier.ts detectTier()`, called from `components/SmoothScroll.tsx`.
- *Problem:* it creates a throwaway canvas and WebGL2 context on every load and never releases it. That cost 1.9 s on SwiftShader (tens of ms to ~150 ms on Windows) and uses up iOS's context budget.
- *Do:* use `typeof WebGL2RenderingContext === "undefined"` → `'low'`. If you keep a real probe, call `getExtension('WEBGL_lose_context')?.loseContext()` straight after. Better: decide the tier inside R3F's `onCreated` from `gl.capabilities.isWebGL2` plus the GPU string from `WEBGL_debug_renderer_info`.
- *Also fix the policy:* `cores <= 4 || mem <= 4 → mid` drops ordinary 4-core laptops to mid, which turns off tilt-shift and lightens post. Only demote when the device is (coarse pointer or small screen) **and** low on cores/memory. Treat `Mali-G5x` and `Adreno 5xx/60x` as mid.
- *Careful with Intel:* the pitch laptop may well have Intel Iris Xe / Arc graphics. Don't blanket-demote `Intel` to mid. Make the high tier hold 60 fps there through 3.3 (DPR cap and PerformanceMonitor). Only if it truly can't, demote just the specific weak GPUs.
- *Done when:* there's no second context in DevTools, and the **pitch laptop** gets `high` and holds about 60 fps without needing `?tier=high`. Keep `?tier=high` as the emergency override.
- *Done:* `detectTier()` no longer creates a probe context. It checks `typeof WebGL2RenderingContext`, and three needs WebGL2 anyway. A page load now makes one WebGL context instead of two. Before, the detached probe took 1,082 ms on a cold desktop load here (it also paid the GPU start-up), plus 43 ms on emulated mobile.
  - *Policy (decided 2026-10-16):* phones and tablets stay mid. Laptops and desktops (fine pointer, screen ≥ 600 px) are no longer demoted for ≤ 4 cores or ≤ 4 GB. ≤ 2 cores, ≤ 2 GB, Save-Data or no WebGL2 → low. `?tier=` still overrides.
  - *Checked with emulated devices:* 4 cores / 4 GB desktop → high (was mid). 2 cores or 2 GB → low. iPad Pro, Pixel 7 (8 cores / 8 GB), iPhone 15 → mid. A 900×560 window → mid, as before.
  - *Dropped:* the Mali-G5x / Adreno 5xx/60x rule. Every touch device is mid already, so no GPU string is needed.
  - *Still open:* the "about 60 fps on the pitch laptop" half is 3.3 work and needs the laptop.

✅ **3.3 Adaptive quality and pause rendering when the 3D isn't visible.**
- *Where:* `canvas/Experience.tsx` (dpr), `canvas/Day.tsx` (4096 shadow map), `canvas/Post.tsx`.
- *Problem:* nothing caps pixel count or reacts at runtime. On a 4K/5K screen or an Intel iGPU it will drop well below 60 fps. The canvas also renders at full rate behind the opaque hero film, competing with video decode and heating phones.
- *Do:*
  - **Cap pixels:** `dpr = Math.min(devicePixelRatio, 2, Math.sqrt(4.5e6 / (innerWidth * innerHeight)))`.
  - **Recover automatically:** wrap the scene in drei `<PerformanceMonitor flipflops={3}>`. On decline, step down DPR 2 → 1.5 → 1.25, then turn off tilt-shift, then drop the shadow map to 2048. Only unmount effects at hidden moments.
  - **Pause behind the film:** add a FrameGate. Use `setFrameloop('never')` while `ready && heroFade < 0.02`, back to `'always'` when it rises. Optionally drop to 30 fps when idle.
  - **Shadows:** set `gl.shadowMap.autoUpdate = false` and set `needsUpdate` only while the camera, sun, stages, cars, people or explode are changing.
  - **Bloom:** `resolutionScale={0.5}` on high. On mid, drop it or use 4 levels at half resolution.
- *Done when:* steady 60 fps on the pitch laptop at the native display, and the GPU is idle during the hero film. (≥30 fps on a mid phone: ⏸ deferred, mobile.)
- **Done (2026-10-16), general settings, not tuned to any one machine.** `canvas/Quality.tsx`:
  - **Pixel cap:** start DPR = min(device, 2, √(4.5 MP ÷ viewport)), recomputed on resize/zoom, set through the Canvas `dpr` prop (R3F re-applies the prop on every render, so a runtime `setDpr` wouldn't stick).
  - **Ladder:** drei `PerformanceMonitor` (mounted after ready, `flipflops={3}`; at 60 Hz it steps down below ~52 fps and up at 59+) lowers DPR 2 → 1.5 → 1.25 → 1 (never below 60 % of the start), then fades tilt-shift out (no unmount, no recompile), then halves the shadow map (three resizes it in place, no recompile). After 3 flip-flops it settles on the lightest rung it needed. `?quality=N` pins a rung; `?snap=1` pins the top, so shots stay deterministic. `window.__VL_QUALITY` shows the rung in use.
  - **FrameGate:** the render loop stops once ready while `heroFade < 0.02` and restarts as the scroll begins (the clock is kept continuous). Hero: 0 render calls in 5 s, was ~3,000.
  - **Tilt-shift** skips its blur pass while its strength is ~0 (before the rise, exploring, faded out).
  - *Not done, on purpose:* shadow updates on demand (the tree sway, walkers and cars animate in the shadow pass, so frozen shadows would lag them), and bloom `resolutionScale` (a no-op with `mipmapBlur`: postprocessing sizes the luminance and mip passes at full resolution; the real levers are `luminancePass.resolution.scale` or fewer `levels`). Revisit only if the laptop needs it.
  - *Still to check on the pitch laptop:* that it holds 60 fps at the top rung, or which rung it settles on.

✅ **3.4 Explore mode shouldn't freeze scrolling.**
- *Where:* `components/chapters/HomesChapter.tsx useExploreGuard`, `components/homes/explore.ts`.
- *Problem:* while a home is open the camera is locked, so scrolling does nothing visible for about 2,000 px, then jumps to night once t ≥ 6.
- *Do:* record `tEnter` when explore starts. In the guard, call `backToVillage()` once `|t − tEnter| > 0.06` (about 180 px), so a scroll in either direction releases the home smoothly. Keep the t ≥ 6 exit as a fallback.
- **Done (2026-10-16).** `useExploreGuard` records `tEnter` when the visitor opens a home and calls `backToVillage()` past `EXPLORE_RELEASE` (0.06, `components/homes/explore.ts`); leaving the chapter still exits. `enterExplore` first settles any Lenis glide still running, so a click mid-glide can't carry the scroll past the threshold and close the home at once. A debug `?home=` load (no visitor click) isn't armed. Tested with real wheel input: ~100 px keeps the home, ~300 px releases it (both directions), the camera eases back, focus returns to the card.

✅ **3.5 The time-of-day word is wrong in the homes chapter.**
- *Where:* `lib/ui-time.ts timeWordForDay` vs `lib/timeline.ts CHAPTERS`.
- *Problem:* the homes chapter says "golden hour", but its day ≈ 0.63 maps to "afternoon". The arc word flips the moment you touch the sun, and the slider's `aria-valuetext` reads "afternoon".
- *Do:* align the ranges: `<0.06` first light · `<0.18` dawn · `<0.34` morning · `<0.47` late morning · `<0.57` noon · `<0.76` golden hour · `<0.88` dusk · else night.
- **Done (2026-10-16).** Ranges aligned as above ("afternoon" is gone). Checked under the arc at t 5.5: journey "golden hour"; held sun 0.63 and 0.72 "golden hour", 0.8 "dusk", 0.92 "night". The slider's `aria-valuetext` uses the same function.

✅ **3.6 Recover if the browser drops the WebGL context.**
- *Where:* `canvas/Experience.tsx onCreated`.
- *Problem:* if iOS or Android drops the context (backgrounding mid-pitch, memory pressure), the canvas goes blank.
- *Do:*
  - On `webglcontextlost`: call `preventDefault()` and set a store flag. `HeroMedia` then shows its aerial still as a backdrop (an `is-fallback` class).
  - On `webglcontextrestored`: clear the flag and re-run the warm-up (3.1).
  - If the context isn't back within about 3 s, keep the fallback for the rest of the session.
- **Done (2026-10-16).** three already calls `preventDefault()` and rebuilds its GL state on restore; what was missing is around it. Store `canvas: "live" | "lost" | "gone"`; `watchContext` in `canvas/Experience.tsx`:
  - Lost: `ready` false, so HeroMedia holds the aerial still over the canvas (`is-fallback` gives it the film's scrim) and the type takes the light film tone.
  - Restored: the Warmup remounts (new key), recompiles and uploads, then `ready` returns and the existing late-ready easing dissolves back into the 3D. Tested with `WEBGL_lose_context`: back in 1.9 s, the same frame as before.
  - Not back within 3 s: "gone" for the session: a late restore is ignored, the aerial stays and FrameGate stops the render loop.

**3.7 Single film grain.**
- *Where:* `components/chrome/Chrome.tsx` (CSS `.vl-grain`, `globals.css` ~l.2108) and `canvas/Post.tsx GrainEffect`.
- *Problem:* two grains stack over the 3D, flickering at different rates.
- *Do:* hide the CSS grain once the 3D is on screen with `html[data-phase]:not([data-phase="hero"]) .vl-grain { display:none }`, or keep it on the hero film only.

⏸ *Deferred (mobile).* **3.8 Mobile match cut (t 0.85–1.05).**
- *Where:* the line-drawing overlay in `components/HeroMedia.tsx` and the portrait setting of the ~t 1.0 key in `lib/camera.ts`.
- *Problem:* on phones, t 0.9 is a dense, noisy edge-traced map, then t 1.0 jumps to a small slab at a different scale, so the "film becomes the drawing" moment doesn't read.
- *Do:* give the ~1.0 key a portrait zoom/lift so the slab fills about 80% of the width at the film crop's orientation. On compact screens, thin the overlay (keep only major outlines) and fade it out by 0.93.

### P1: visual polish (the poster bar)

| # | Item | Where | Fix |
|---|---|---|---|
| 3.9 | Featured homes don't pop as the chapter's subject; white halo around the V4 plinth reads as fog | `canvas/homes/Veil.tsx`, homes jewel/halo code, `shots.ts` | Run the veil at ~0.2–0.25 through t 5.1–5.9 (not only in explore). Halve or remove the plinth halo glow. Confirm framing after 3.1–3.3. |
| 3.10 | Explore at golden hour is milky and one-tone (exploded floors all orange cork) | `canvas/homes/Veil.tsx`, `canvas/homes/materials.ts` | Veil toward a mid-tone `mix(uFog, #1C1E17, 0.18)`, capped at ~0.4 by day. Interior floor slabs and inner walls in limestone (#E5E3D7-ish); cork only on exterior cladding. Night explore (sun 0.92) is already excellent; keep it. |
| 3.11 | Hill contours keep drawing across the risen podium deck (t 1.4–1.8) | terrain contour shader (`canvas/world/terrain/terrainMaterial.ts`) with `uPlan` | Contour alpha `*= 1 - podiumMask * smoothstep(0.45, 0.7, uPlan)`. |
| 3.12 | Material sweep seam looks like a burning, game-like dissolve, right behind "Made to age" (t 3.5) | seam in `lib/materials.ts` (`uSeamColor`, `vl_seam`) and the house/terrain patches | Halve the emission, widen the falloff 2–3×, colour → warm white `#FFF1DC`. Retime so the seam clears the text column before t 3.45. |
| 3.13 | Making notes ("Durability", "Autonomy") sit on stairs and trees; 3.9 frame crowded | `components/chapters/MakingChapter.tsx`, `lib/camera.ts` key ~3.9 | Add the `.vl-haze--right` scrim behind the notes. Pull the 3.9 key back ~10% and raise the target ~3 m. |
| 3.14 | Cut townhouses look hollow from the raised section camera (t 4.8) | `canvas/section/*` | Reuse `canvas/homes/interiors.ts` blocks, or add a warm interior wash and a few furniture silhouettes per cut room ("life above"). |
| 3.15 | Outer ground at t 4.1 is flat beige (half the frame, under the text) | terrain material outside the podium after the sweep | Dry-meadow mottling (low-frequency olive/straw noise, a few tufts), or reframe the 4.02/4.2 keys so outer ground is ≤ 30% of the frame. |
| 3.16 | Lamp posts and benches render near-black on the white model (t 2.5, 3.0) | landscape props | Route them through `patchVillageMaterial`'s sweep, or hide them until material > 0.5. |
| 3.17 | Stray dark hairline from the V4 roof-terrace corner to the lawn (t 3.9) | houses line layer / balustrade edges | Check the line layer is fully faded after the sweep and the glass-rail edge geometry is bounded. Inspect with `?cam=`. |
| 3.18 | Section text sits over re-emerging row-D gardens (t 4.82–4.96) | `lib/timeline.ts` section close vs `CarsChapter` text timing | Close the section a little later, or fade the chapter text before 4.82. |
| 3.19 | The cars legend isn't tied to places in the picture | `components/chapters/CarsChapter.tsx` + `canvas/section/anchors.ts` (`SECTION_ANCHORS` already exported, not used by the DOM) | Draw hairline leaders from each legend marker to its anchor `{x, y, visible}`. Playground is only visible from ~4.9 (row D is cut); fade its leader in then. |
| 3.20 | ⏸ *Deferred (mobile).* Mobile tap targets too small | `components/homes/HomePanel.tsx`, `globals.css` compact block (~l.2210) | V3/V4 switch ≥ 44×44 px hit area; submit 48 px; `.vl-panel__more` ≥ 44 px; header pill hit area via `::after { inset:-4px 0 }`. |
| 3.21 | ⏸ *Deferred (mobile).* "Back to the village" hard to read and tap on phones | `.vl-back` | Soft limestone pill on compact screens: `color-mix(in srgb, var(--scrim) 72%, transparent)`, blur 6px, padding 8×14, radius 999px. |
| 3.22 | "EN" looks like a control but does nothing | `components/chrome/Header.tsx` | Remove it, or render it as plain soft text. |
| 3.23 | Night palette and stars | `lib/day.ts`, `canvas/Day.tsx` | Part 1 moved the sky toward ink-blue and added stars. Verified in §2: they **don't** read. The fogged ground plane hides all sky below the horizon, so stars can only appear in the thin true-sky strip at the top of the 6.3/6.8 frames. Pitch the 6.8 key up ~4° (or raise star density/size in the strip). |

### P2: nice to have

- **Garage elevation (t 4.5):** north and south car rows overlap like a traffic jam. Offset one row by half a bay (`canvas/section/cars.ts`).
- **Section base:** the strata stop in a hard line, then haze. Fade them into the fog over the last ~1.5 m, or add a crisp plinth base line.
- **Explore foreground smear:** near-camera planting smears next to the sun control. Cull planting within about 8 m of the camera in explore.
- **t 3.0 composition:** empty haze across the top 25% and cut-off foam trees. Drop the camera ~10 m, raise the target ~4 m.
- **Invitation card:** the embossed arch crosses the lettering. Shrink it to frame only the monogram and date, or put it behind a knockout (`components/night/InvitationCard.tsx`).
- **Shadow box size:** the fitted box changes size every frame and edges can crawl during scroll. Quantise the extents to powers of 1.25 with ~10% hysteresis (`canvas/Day.tsx fitShadow`).
- ⏸ *Deferred (mobile).* **Mid-tier geometry:**
  - Phones draw ~684–720k triangles. Target under 400k.
  - Draw half the planting instances.
  - No shadows from the smallest trees.
  - Coarser plinth.
  - Skip featured-home interiors until explode > 0.05.
  - Lighter car mesh.
- **Synchronous build on mount (~0.6–1 s):**
  - Bake ground height once into a shared 0.5 m `Float32Array` with bilinear sampling, and reuse it for the plinth, AO, height texture, trees and people.
  - Mount Section and Homes in `requestIdleCallback` after ready.
  - Optionally move geometry builders into a Worker.
- **Dead code:** `ScrollTrigger` is imported, registered and refreshed on every resize, but never used (`components/SmoothScroll.tsx`). Remove it. Also skip the re-measure when only `innerHeight` changes on touch devices (iOS toolbar).
- **First paint weight:** re-encode `hero-poster.jpg` (484 KB), `aerial-village.jpg` and `aerial-village-drawing.jpg` as AVIF/WebP with a `<picture>` JPEG fallback (poster ~150 KB). Add `loading="lazy"` to the HomePanel image and `fetchPriority="low"` to the aerials.
- **Hygiene:**
  - `stagesFromT(t, out)` writing into a scratch object (called 3+ times per frame).
  - Dispose `skyMat` in `canvas/Day.tsx`.
  - The `THREE.Clock` deprecation warning comes from R3F on three r186; accept it or track R3F.
- **Portrait keys** are chosen once at load. Re-pick them on orientation change.
- **Layout data (`lib/village.ts`):**
  - The `PATHS` link at x = −12 runs through house C-1-2; the link at x = 33 crosses the communal pool. The section module works around this, but the landscape paths and lights may still show the overlap.
  - Exclude the entrance-stair and portal-apron keep-out from `TREES` at the source.
- **Landscape finish:**
  - Water is milky at grazing angles at noon.
  - Lavender is pale at noon.
  - Hedges are plain rounded boxes.
  - The garage floor in the portal recess is dark.
- **Homes:**
  - Hover state can lag ~1 s while the camera eases.
  - Dawn hold-the-sun (0.1) is soft and pale.

---

## 4. Critique and polish for section + homes (never independently reviewed)

These two modules were finished and self-verified, but their critic agents were cut off. Before the pitch, review them deliberately:

**Section (t 4.0–5.0)**
- Frames to check: 3.95, 4.1, 4.25, 4.4, 4.55, 4.7, 4.85, 5.0, close-ups in the garage and of people on the lanes, and mobile at 4.1 / 4.5 / 4.8.
- Cars turning off the street into the portal: smooth, never reversing, no clipping through the portal back face (`landscape-portal-back` is hidden while cars pass).
- The iconic elevation: calm, symmetrical, strata reading, garage lighting not blown out.
- Figures and lane glows read as an architectural model, not a game.
- The transition into the homes chapter at 4.95 → 5.1.

**Homes (t 5.0–6.0 and explore)**
- Frames to check: journey 2.7, 3.6, 4.5 (the featured homes must look identical to their neighbours during build and section), 5.1, 5.5, 5.9; explore v3/v4; sun 0.1 / 0.5 / 0.72 / 0.92; mobile explore.
- Explode timing (2.2 s quart-out).
- Interiors legible.
- Lamps after dusk.
- Hover lift and the "open" cursor.
- Click-to-select (raycast through document pointer events, because `main.vl-journey` owns the pointer).
- The spec panel never covers the house.

---

## 5. Real-device QA (the pitch risk)

Nothing has been seen on real hardware. Test on:

| Device | Browser | Check |
|---|---|---|
| **The Windows pitch laptop** at its native display, on mains power (and the venue projector or 4K screen if used: mirror vs extend changes resolution) | Chrome **and** Edge | fps (DevTools → Rendering → Frame rendering stats), no stall on the first build sequence or first Explore after a cold start (reboot, then first load), tier = high, tilt-shift on, no black frames, hero video plays |
| A MacBook | Chrome + Safari | look and fps as a second reference |
| iPhone 13 or newer | Safari | hero video autoplay (muted, inline), memory/context loss (background the tab mid-scroll), portrait framing, tap targets, the form |
| Mid-range Android | Chrome | fps ≥ 30, heat over a full 4–5 min journey |
| Any | `?rm=1` and OS reduced-motion setting | crossfade path works, nothing moves on its own |
| Throttled network (DevTools "Fast 4G") | Chrome | time to first frame, poster shown instantly, no black flash |

Also check:
- Lenis wheel feel on mouse vs trackpad.
- Touch scrolling is native.
- The sound toggle (off by default) plays the ambient bed and the chime at t≈3.8 and on submit.
- The tab title and OG preview.

---

## 6. Pitch preparation

- **Backup video:** screen-record a full scroll-through on the pitch laptop at 60 fps (with sound on), in case the venue Wi-Fi fails. Also keep a local production build ready: `npm run build && npm start`.
- **Invitation form:** decided: it **stays simulated** (no backend; the card appears after ~900 ms). The confirmation reads "Your advisor will confirm your visit within one day." That's fine in a guided demo. If the link is left with the client unattended, change it to something like "Thank you, we'll be in touch" so no one waits for an email that never comes.
- **Windows specifics:**
  - Turn off Windows notifications / Focus Assist during the pitch.
  - Set the power plan to Best performance.
  - Set browser zoom to 100%.
  - Present in full screen (F11), so the svh-based chapter heights match what was tested.
- **Copy check with the client:** specs (V3 +250 m², 3 bed/3 bath…; V4 +400 m², coming 2028), tagline, partners (FCM, BPI, Porta da Frente), and "Artistic interpretation. Not to scale." in the footer.
- **Assets that would raise quality** (ask the client):
  - the film master (the current loop is cut from the compressed web video)
  - high-resolution renders
  - vector wordmark and arch symbol (currently PNG masks)
  - Normalidad web-font licence (currently Instrument Sans/Serif stand-ins)
  - soundtrack rights (the ambient bed is cut from their film)
- **Talking points:**
  - Their current site's hero is 132 MB; ours is a 34 s loop at under 8 MB that starts playing at once (it streams).
  - No horizontal overflow on phones.
  - A real enquiry flow.
  - Offer the two tiers from the earlier discussion: an Elementor upgrade with the 3D component dropped in, or the full Next.js flagship.

---

## 7. Phase 2 (after the pitch; from PLAN.md §9)

- The "Village heart" chapter with **Silent Focus**.
- "The view": a 3D coastline relief with drive times.
- Residence pages per typology.
- Portuguese (the `/pt` the current site has).
- Full sound design.
- Cinematic pre-rendered video fallbacks for tier low.
- A CMS for copy and contacts.
- Booking and CRM integration.
- Analytics (most-explored home, sun-study use).
- Legal and cookies.
- An accessibility audit.

---

## 8. Working on this codebase (for Claude Code or you)

**Module map (who owns what):**
- `lib/` holds the shared contracts:
  - `timeline.ts`: chapters, scroll → `t`, build stages incl. `plan`, day mapping
  - `day.ts`: time of day → light
  - `uniforms.ts`, `materials.ts`: shared uniforms; the white-model → material sweep, seam and section poché; `pocheStyle 'strata'`
  - `village.ts`: layout, `heightAt`
  - `camera.ts`: base keys; merges `canvas/section/shots.ts` and `canvas/homes/shots.ts`
  - `store.ts`: zustand state
- `canvas/`: the single persistent R3F canvas.
  - `Driver.tsx`: writes uniforms each frame
  - `Day.tsx`: sun, sky, fog, shadow fitting
  - `CameraRig.tsx`: path, explore blend, portrait logic
  - `Post.tsx`: SMAA, bloom at night, tilt-shift, grade and grain
  - `world/`: terrain, landscape, houses (`houses/architecture.ts` has the builder API documented in its header)
  - `section/`: garage, cars, life, anchors
  - `homes/`: featured homes, interiors, veil, jewels
- `components/`: the HTML layer: chapters, hero media, chrome (sun arc / hold the sun, header, index, sound), homes panel, invitation.

**Gotchas:**
- `main.vl-journey` receives all pointer events. 3D interaction must raycast from document-level pointer events (see `canvas/homes/Homes.tsx`).
- Per frame, read the store with `useJourney.getState()`, never with React state.
- Every material that can be cut must go through `patchVillageMaterial` (it handles clipping, sweep and poché).
- Keep the time of day moving forward only. Interactive modes override it via `sunOverride`.

**Loop:** change → `npm run typecheck` → screenshots at the affected t values → look → commit. One commit per finished item.

---

## Decisions

- **Pitch device:** Windows laptop. P0 targets are measured there (§3 P0, §5).
- **Visit form:** stays simulated (§6).
- **Branching:** `main` is the trunk. Point Vercel Production and the GitHub default branch at `main` (§0).
- **Claude Code locally:** yes. `CLAUDE.md` carries the project rules; this file is the backlog.

Still open: the pitch date, so the backlog can be cut to fit.
