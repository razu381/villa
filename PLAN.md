# Vila Leku — Immersive 3D Experience Plan (v2)

A Next.js + React Three Fiber experience for **Vila Leku**, the car‑free village by Phidias in Leceia, Oeiras (Lisbon coast).

**Brief:** gorgeous and memorable, not a precise data tool. The 3D village is an **artistic interpretation**: house count, layout and scale are composed for beauty, not copied from the site plan. One quiet line in the footer covers it: *"Artistic interpretation. Not to scale."* That freedom is the point: every camera angle, house position and tree can be art‑directed.

---

## 1. The idea

> **"One day at Vila Leku."**
> Scrolling is living one day in the village, from first light to lit windows at night.
> As the day unfolds, **the village builds itself**: a line drawing becomes a model, then stone and cork, then a living place.

Two stories run as one:
- **The day:** dawn → noon → golden hour → night. It gives the experience its rhythm and emotion.
- **The making:** drawing → model → material → life. It's Phidias' own *"building harmony"*, shown rather than said.

**The signature:** the brand's three‑arch symbol is the sun's path. A small sun travels along the arch as you scroll, and later you can grab it and move the sun yourself.

### Pillars
| Calm | Tactile | Cinematic |
|---|---|---|
| Slow camera, generous space, one idea per screen. Nothing bounces, nothing shouts. | Limestone and cork you can almost touch: raking light, grain, haze, sound. | Long lenses, composed frames, a colour grade shared with the film. **Every frame is a poster.** |

### The quality bar: "every frame a poster"
Pause anywhere mid‑scroll and take a screenshot. It should look composed, lit and finished, never mid‑transition chaos. Every chapter is designed as **key frames first** (style frames in week 1), and motion only travels between approved frames.

---

## 2. Experience rules

1. **The day only moves forward.** While you scroll the journey, the sun advances and never jumps back, so the arch indicator always tells the truth.
2. **Interactive moments pause the day.** When you explore a house or hold the sun, scroll‑driven motion stops, the arch's sun dims to "paused", and the scene uses its own lighting. Scroll again and the day resumes.
3. **Three layers, three looks.** The visitor always knows what is clickable:

   | Layer | What | Visual rule |
   |---|---|---|
   | Atmosphere | Light, sky, landscape, transitions, sound | **Never clickable**, no affordances |
   | Understanding | Section cut, annotations, map | **Hairline annotations** that reveal on hover/tap |
   | Action | Choose a house, hold the sun, book a visit | **The only solid buttons** and the only labelled cursor (*Open*, *Drag*) |

4. **Stop to read.** When text is on screen, the camera settles. Words never sit over moving imagery.
5. **Never trapped.** "Skip to the homes" and a chapter index (tap the arch) are always one tap away. Touch scrolling stays native.
6. **Sound is off by default.** There is no entry gate, just a visible toggle (a thin animated waveform). Every moment works muted. Presenters turn it on in the pitch.

---

## 3. Five signature moments

### ① The village builds itself (dawn → midday)
A blank limestone‑paper ground. **Contour lines** of the hill draw themselves in hairline strokes, then the **architect's line drawing** of the houses traces itself in. Volumes **rise from their plans** as a white model, staggered house by house, while foam‑like trees fade in. A slow band of sunlight then **sweeps across the village and leaves real materials behind**: cork, limestone, glass. Finally foliage takes colour and starts to sway, and the pools fill with light. *building harmony.*

### ② Cars below. Life above. (midday)
The ground is **cut in section** like a slice of cake. The cut face shows earth layers in cork tones and the garage beneath. Tiny cars glide down the ramp and disappear under the village, then the camera rises to the car‑free gardens above as the paths light up. The idea becomes obvious in five seconds.

### ③ Two ways to live (golden hour)
Two homes, presented like jewels on a plinth: the **V3 Townhouse** and the **V4 Villa**. Choose one and the camera cranes in. The roof lifts and the floors separate into an exploded drawing. The floor plan draws itself on each level. Specs come from the site: bedrooms, bathrooms, m², garden, pool, elevator.

### ④ Hold the sun (golden hour, interactive)
The sun on the arch **becomes a handle**. Drag it, or use the arrow keys, and the day sweeps across the chosen house:
- morning light rakes the cork
- noon shadows tuck under the terrace
- gold floods through the floors of the exploded view
- past sunset, the windows glow on

No numbers, just *dawn · noon · dusk* in wide‑tracked lowercase. It's the brand symbol turned into the most delightful control on the site.

### ⑤ The village switches on (night)
Windows light up one by one, warm path lights follow, and stars come out. *"Come experience Vila Leku."* The private‑visit form appears as an **invitation card**. After booking, the confirmation shows the visitor's chosen home lit at the hour of their visit.

*Phase 2 delight:* **Silent Focus.** In the Village Heart chapter, the cowork room makes the site go quiet: the interface fades, motion stops and one line of text remains. If sound is on, it fades to nothing.

---

## 4. The journey

| # | Time | Chapter | What happens | Demo |
|---|---|---|---|---|
| 0 | First light | **Hero** | A short film loop (coast at dawn) with the wordmark in limestone white. The 3D world loads silently behind it. | ✅ |
| 1 | Dawn | **The drawing** | **Match cut:** the film's aerial frame dissolves into the 3D camera at the same angle. Contours and line drawing draw in. | ✅ |
| 2 | Morning | **The model** | Houses rise as a white model. A slow crane orbit. *"A contemporary stronghold."* | ✅ |
| 3 | Midday | **The making** | A sun sweep leaves cork and limestone behind. Short notes: *Autonomy · Durability*. | ✅ |
| 4 | Midday | **Cars below. Life above.** | ② The section cut. | ✅ |
| 5 | Afternoon | **Village heart** | Renders and film clips framed in arches: Botanical Playground, Boutique Fitness, **Silent Focus**. | Phase 2 |
| 6 | Golden hour | **Two ways to live** | ③ + ④ Exploded homes and holding the sun. | ✅ |
| 7 | Sunset | **The view** | Terrace sunset (film). The camera lifts off onto a 3D relief of the coast in their illustrated‑map style, with drive‑time lines to Lisbon, Cascais and the airport. | Phase 2 |
| 8 | Night | **Invitation** | ⑤ The village switches on, then the invitation form. | ✅ |

Full journey: about 4–5 minutes. Demo journey: about 2–3 minutes.

---

## 5. Art direction

### 5.1 The 3D look: "a living architect's model"
It starts as a pure white model and **matures into a softly stylised, material‑rich miniature**. It's never photoreal, so it never competes with the renders. Instead it complements them.

- **Lens:** long focal lengths (a 25–32° field of view) for elegant, undistorted architecture. Slow crane and dolly moves. The camera never cuts and never snaps.
- **Light:**
  - one sun with soft shadows
  - ambient occlusion in every crevice
  - sky and environment lighting tinted by time of day
  - **height fog** for morning haze
  - **dust motes** drifting through sunbeams
  - gentle bloom only on the sun, glowing windows and path lights
- **Materials:**
  - **Limestone:** warm off‑white with fine grain.
  - **Cork:** deep granular brown that catches raking light.
  - **Glass:** dark and tinted, reflective but not refractive.
  - **Water:** satin with a caustic shimmer.
  - Mostly procedural, so it's sharp up close and tiny to download.
- **Nature:**
  - Trees start as model‑maker's foam spheres and bloom into soft stylised foliage with wind sway.
  - Lavender and grasses, like in the film.
  - A few birds at dawn and dusk.
- **Miniature feel:** a subtle tilt‑shift depth of field in the model chapters, switched off in close‑ups.
- **One colour grade:** a LUT (colour‑grading preset) sampled from the film is applied to the 3D render, so footage, renders and 3D feel like one piece. A fine film grain sits over everything, HTML included.

### 5.2 Palette (sampled from the current site)
| Token | Hex | Use |
|---|---|---|
| Limestone | `#E5E3D7` | Main background, the white model |
| Stone | `#D2CFBC` | Secondary surfaces |
| Taupe | `#94917E` | Hairlines, quiet interface |
| Sage | `#A69E79` | Foliage, accents |
| Olive | `#474F1F` | Wordmark, text accent |
| Forest | `#515443` | Deep surfaces |
| Cork | *sample from facade render* | Material, earth layers |
| Ink (new) | `#1C1E17` | Night |
| Sun (new) | `#C9A46A` | The sun dot, golden hour, selection |

### 5.3 Typography
- **Display:** one refined serif. Licensed options: PP Editorial New, Canela or Saol. Free option: Instrument Serif.
- **Text:** the brand sans **Normalidad**, 17–18px, left‑aligned, never justified.
- **Captions:** wide‑tracked lowercase, like the film's end card *"b u i l d i n g  h a r m o n y"*.
- **Script:** *"Living in harmony"* once, as a signature.

### 5.4 Motion
- One easing family (quart/expo out): 1.2–1.6s for the world, 0.6–0.8s for the interface. No springs or bounces.
- Text reveals line by line through masks.
- Images reveal through **arch‑shaped masks**, the recurring motif.
- Chapter transitions: **arch wipes** and **match cuts**, never hard cuts.

### 5.5 Sound (off by default)
- An ambient bed that changes with the day: sea and wind at dawn, birds in the morning, cicadas at noon, swallows at golden hour, crickets at night.
- A **3‑note motif** (three arches) when the village finishes building and when a visit is booked.
- Interface sounds barely there. About 1.5 MB in total, streamed.

### 5.6 Never do these
Bouncy easing · auto‑playing sound · loaders over 3s · carousel arrows · stock icons · urgency banners · text over moving imagery · cursor trails · trapping the scroll · any frame that wouldn't survive a screenshot.

---

## 6. How each moment is built

| Moment | Technique |
|---|---|
| **Hero → 3D match cut** | Edit a 10–15s loop from the film that ends on an aerial. The 3D camera's first frame is composed to match it, and a 600ms crossfade with a slight blur hides the seam. The film also hides the 3D loading time. |
| **The village builds itself** | One `uBuild` value per stage drives a custom shader layered on the standard material. (a) **Contours:** lines generated from terrain height in the shader. (b) **Line drawing:** house edges drawn progressively with animated dashed lines. (c) **Rise:** each house's height scales up from the ground with a per‑house delay. (d) **Material sweep:** a soft world‑space front with a noisy edge and a thin glowing seam; white on one side, materials on the other. (e) **Life:** foliage colour and wind fade in, water fills. |
| **Cars below** | An animated cutting plane slices the model, with a strata‑shaded cap filling the cut face. The garage is a simple void. Instanced cars follow a curved path down the ramp. |
| **Two ways to live** | Each home is split into floors in Blender. Exploding them is a GSAP timeline (roof lifts, floors part), and the floor plan is an SVG drawn onto each floor. Specs are HTML. |
| **Hold the sun** | The `SunArc` SVG becomes a draggable control (pointer + arrow keys). It drives `dayProgress`, which sets sun direction, sky, fog, shadows and window glow from one source. |
| **Village switches on** | Window glow staggered randomly. Path lights faked with glowing sprites plus bloom (no real point lights, so it stays cheap). Stars as points. |
| **Modular village** | Houses are 2–3 modular pieces from Blender (V3 module, V4 module, garden/terrace), **placed by a layout array in code**. We can recompose the village for a better frame in seconds, and instancing keeps it fast and small. |

### Stack
- **Framework:** Next.js (App Router, TypeScript), React 19.
- **3D:** three, @react-three/fiber, @react-three/drei, @react-three/postprocessing (AO, bloom, depth of field, LUT, grain), three-custom-shader-material.
- **Scroll:** Lenis (smooths mouse‑wheel scrolling only; touch stays native) synced with GSAP ScrollTrigger and SplitText. GSAP is free, plugins included.
- **State:** zustand. The 3D reads it every frame without React re‑renders.
- **Styling:** Tailwind + CSS variables for the palette.
- **Assets:** Blender → glTF → gltf-transform (meshopt compression, KTX2 textures) → `gltfjsx` typed components.
- **Hosting:** Vercel preview link for the pitch.

### Runtime shape
```
app/layout.tsx
 ├─ <SmoothScroll>     Lenis ⇄ ScrollTrigger on one GSAP ticker
 ├─ <Experience>       ONE fixed <Canvas>, loaded lazily behind the hero film
 │   ├─ <Day>          dayProgress → sun, sky, fog, light colour, window glow (single source)
 │   ├─ <CameraRig>    authored key frames per chapter, damped scroll scrub; free orbit in "Two ways to live"
 │   ├─ <Village>      modular houses + terrain + trees + water + cars (build stages via uBuild)
 │   └─ <Post>         AO · tilt‑shift · bloom · LUT · grain (per device tier)
 ├─ <Chrome>           header · SunArc (indicator → handle) · sound toggle · labelled cursor
 └─ chapters           real HTML text; each writes {chapter, progress} to the store
```

### Devices and performance
| Tier | Experience |
|---|---|
| High (recent laptops) | Full post‑processing, soft shadows, pixel ratio up to 2 |
| Mid (most phones) | Pixel ratio 1.25–1.5, baked AO, no depth of field, fewer motes |
| Low / no WebGL2 | **Cinematic fallback:** the same chapters as short pre‑rendered videos from the same scene |
| Reduced motion | No scroll‑scrubbed camera. Chapters crossfade between key frames. |

- **Frame rate:** 60 fps on recent laptops, ≥ 30 fps on an iPhone 13 or mid‑range Android.
- **Download:** hero loop ≤ 4 MB desktop / ≤ 2 MB mobile; whole demo ≤ 10 MB.
- **iOS Safari memory:** one persistent canvas holds every loaded asset in GPU memory, and Safari can kill the 3D context. Use KTX2 textures, dispose of chapters far behind, and recover gracefully if the context is lost.
- **Idle cost:** render only when something moves. Pause when HTML covers the canvas or the tab is hidden.

---

## 7. Assets
**Needed:** high‑resolution renders, the **film master** (to edit the hero loop and match cut), vector logo, arch symbol and wordmark (SVG), brand font files, and the soundtrack if they own it.
**Nice to have:** any architect's model or site plan as *reference* for proportions. Not required.

---

## 8. Pitch demo — 2 weeks

**Scope:** chapters 0 → 1 → 2 → 3 → 4 → 6 → 8 (see the journey table). That's moments ①②③④⑤, plus the arch indicator, one sound bed with the motif, device tiers and reduced motion. English only, works on phones, live on a preview link.

| Days | Work |
|---|---|
| 1–2 | **Style frames.** Model the modular kit in Blender. Compose and light the 6 key frames (dawn drawing, white model, materials, section cut, exploded home, night). Approve the look before any motion. |
| 3–5 | Scaffold Next + R3F + Lenis/GSAP + store. The day system. Camera key frames and scroll scrub. SunArc indicator. Hero loop edit and match cut. |
| 6–7 | **The village builds itself** (all stages). |
| 8 | **Cars below** section cut. |
| 9 | **Two ways to live** + **Hold the sun**. |
| 10 | **Night** + invitation form. Sound. Mobile pass, device tiers, reduced motion. |
| 11–12 | Polish to "every frame a poster". Performance pass on real devices. Deploy. **Record a backup video walkthrough** in case the meeting room's Wi‑Fi fails. |

**If time runs short, cut in this order:** the line‑drawing stage (fade the model in instead) → sound → tilt‑shift. Never cut polish on ①, ② or ③.

**In the pitch:** open it on *their* phone, with sound on. Then show the contrast: 132 MB hero → ~4 MB, no sideways scrolling, a real enquiry form.

---

## 9. Phase 2 — the full site
Village heart with **Silent Focus** · **The view** with the 3D coastline relief and drive times · residence pages per typology · Portuguese · full sound design · cinematic video fallbacks · CMS for copy and contacts · enquiry and booking integration · analytics · legal and cookies · accessibility audit.

---

## 10. Risks
| Risk | Mitigation |
|---|---|
| Real‑time 3D looks cheaper than the renders | Stylised model look by design. Photoreal stays with film and renders. Shared LUT and grain. |
| Too many effects, visual fatigue | Five moments only. Rules 1–4. Style frames approved before motion. |
| Phone performance and memory | Device tiers, KTX2 textures, disposal, context‑loss recovery, video fallback |
| Two weeks is tight | Fixed cut order (section 8). Modular kit instead of bespoke modelling. |
| Pitch‑day network | Locally served build plus recorded video |
