# Vila Leku — Immersive 3D Experience Plan

A plan for a Next.js + React Three Fiber experience for **Vila Leku**, the car‑free residential village by Phidias in Leceia, Oeiras (Lisbon coast). The first goal is a pitch demo good enough to win the client. The second is a production site that sells homes.

---

## 1. North star

> **"One day at Vila Leku."**
> Scrolling the site is living one day in the village, from dawn over the Atlantic to the lit windows at night.
> Time of day is both the story and the navigation.

The brand already has the pieces:
- **"Living in harmony"**: the tagline.
- **"building harmony"**: the Phidias end card of the film.
- **The three‑arch symbol.** In this experience **the arch becomes the sun's path**. A small sun travels along the arch as you scroll and acts as the progress indicator, so the logo literally tells the time.

Three words guide every decision:

| Calm | Tactile | Truthful |
|---|---|---|
| Slow camera, generous space, one idea per screen. Nothing bounces, nothing shouts. | Limestone and cork you can almost touch: raking light, grain, sound. | A real sun for the real coordinates, real units and real availability. Luxury buyers trust precision. |

### Art direction in one sentence
Use 3D for **understanding**: a living architect's model in limestone white, lit by a moving sun. Use the photoreal renders and film for **desire**. Never try to make real‑time 3D compete with the offline renders.

---

## 2. Five signature moments (what people will retell)

1. **The day passes as you scroll.** Light, sky, fog, shadows and sound all move from dawn to night. The sun‑arc progress indicator is the brand symbol.
2. **The ground opens: "Cars below. Life above."** The model's plinth is cut in section. Miniature cars glide down the ramp into the garage under the village, then the camera rises to the car‑free gardens above. Their best idea, made obvious in five seconds.
3. **Choose your home.** Tap a house on the model and the camera cranes to it. The roof lifts and the floors separate into an exploded axonometric drawing (each level pulled apart in 3D). Tap a level to get its floor plan.
4. **Your light.** A date and time slider puts the real sun for Leceia (≈ 38.72° N, 9.28° W, to be confirmed) on that house: winter mornings, summer sunsets, terrace shadows. Genuinely useful, and nobody else does it.
5. **Silent Focus.** In the Village Heart chapter, the cowork room makes the site go quiet. The ambient sound fades to nothing, the interface recedes, and one line of text remains.

**Bonus, the invitation.** After booking a private visit, the confirmation is an invitation card showing *their* chosen house lit at the exact hour of their visit. It's a snapshot of the 3D model with the sun set to that time.

---

## 3. The journey — chapter by chapter

| # | Time | Chapter | What you see / do | Medium | Sound (opt‑in) |
|---|---|---|---|---|---|
| 0 | Pre‑dawn | **Threshold** | The three arches draw themselves in a hairline stroke with a quiet % counter. Choice: *Enter with sound* / *Enter in silence*. | SVG | — |
| 1 | Dawn | **From the Atlantic** | A short hero loop from the film (coastline, the white line tracing the coast). The wordmark rises in limestone white. Scrolling freezes the frame, which dissolves into a 3D relief of the coast styled like their illustrated map. The camera descends along the same white line to Leceia, where one point of light marks the village. | Video → 3D terrain | Sea, wind, first birds |
| 2 | Morning | **Arrival** | An **arch mask** opens (the brand's signature transition) and we pass through the gate. The whole village appears as an architect's model on a limestone plinth, with tilt‑shift depth of field so it reads as a miniature. A slow crane orbit follows the scroll. *"A contemporary stronghold."* | 3D | Birdsong, gravel steps |
| 3 | Midday | **Cars below. Life above.** | ★ The plinth is cut in section, revealing earth strata in cork tones and the garage. Cars enter from the street ramp (as in the film). Lifts and stairs rise into the homes. The camera surfaces as pedestrian paths, gardens and the playground light up. Three notes: car‑free living, elevated living, buried services. | 3D | Cicadas (Portuguese summer noon) |
| 4 | Afternoon | **Made to age with the land** | A 3D material board of limestone and cork samples. Scroll moves a raking light across them so the grain comes alive. Then the model's roofs reveal solar arrays and fine flowing lines trace water recycling into the gardens. *Autonomy · Durability*. | 3D + macro photos | Breeze in olive trees |
| 5 | Late afternoon | **The village heart** | Three rooms in a horizontal sequence, each framed in an arch: **Botanical Playground** (birdsong), **Boutique Fitness**, **Silent Focus** (★ silence). | Renders + film clips | Layered, then silence |
| 6 | Golden hour | **Find your place** | The model returns with units lit by status: available = warm glow, sold = matte, the **V4 2028 phase drawn as ghosted wireframe volumes** ("not yet built"). ★ Choose your home → exploded floors → floor plans → ★ *Your light* sun study. Spec panel: V3 Townhouse / V4 Premium Villa. | 3D + 2D plans | Swallows, warm hush |
| 7 | Sunset | **The view** | From the selected terrace: the river at sunset (film footage, or a 360° view if available). The camera lifts off and pulls back onto the terrain. Drive‑time lines are drawn to Lisbon (15 min), Cascais (15 min) and the airport (25 min). Filters: City · Leisure · Education · Business. *"Close to everything. Far from the noise."* | Film → 3D terrain | Distant city hum fades |
| 8 | Night | **An invitation** | The village at night: warm windows, path lights, stars. *"Come experience Vila Leku."* A three‑step private‑visit invitation, the advisor's portrait and direct line, and the brochure. Footer: FCM · BPI · Porta da Frente · Phidias, *building harmony*. | 3D + DOM | Crickets, 3‑note motif |

**Pacing:** about 4–6 minutes for the full journey. A **"Skip to residences"** link and a **chapter index** (click the sun arc) are always one tap away. Nobody is ever trapped in a cinematic.

---

## 4. Art direction

### 4.1 The 3D look — "living architect's model"
- **Model:** limestone‑white massing with crisp edges and softly baked ambient occlusion (shading baked into the textures). Cork‑brown accents on the facades. Dark tinted glass, not refractive.
- **Plinth:** the village sits on a cut block of terrain, and its cut face shows earth layers. That face is the stage for the Chapter 3 section reveal.
- **Trees:** stylised sage forms like model‑maker's foam, with a subtle wind sway in a shader. Use instancing (one draw call for every tree).
- **Water (Tagus/Atlantic):** a satin plane with soft specular light. No busy waves.
- **Camera:** always a crane or dolly. It never cuts and never snaps. Heavy damping.
- **Post‑processing:** tilt‑shift depth of field (the miniature effect), gentle bloom only for night windows, vignette, and a fine film grain shared with the HTML layer so the 3D, renders and film feel like one medium.

### 4.2 Palette (sampled from the current site and film)

| Token | Hex | Use |
|---|---|---|
| Limestone | `#E5E3D7` | Main background, the model |
| Stone | `#D2CFBC` | Secondary surfaces |
| Taupe | `#94917E` | Hairlines, quiet UI |
| Sage | `#A69E79` | Accents, foliage |
| Olive | `#474F1F` | Wordmark, primary text accent |
| Forest | `#515443` | Deep surfaces, footer |
| Cork | *sample from facade texture* | Material accents, earth strata |
| Ink (proposed) | `#1C1E17` | Night chapter |
| Sun (proposed) | `#C9A46A` | Golden hour, selection, the sun dot |

The 3D lighting colour temperature drifts with the time of day: cool dawn, neutral noon, amber golden hour, blue‑ink night. The HTML layer follows the same palette.

### 4.3 Typography
- **Display:** one refined serif for big moments. Licensed options: PP Editorial New, Canela or Saol. Free fallback: Instrument Serif.
- **Text and interface:** keep the brand sans **Normalidad** (check the web licence). Body text 17–18px, left‑aligned, never justified.
- **Captions and eyebrows:** wide‑tracked lowercase, like the film's *"b u i l d i n g  h a r m o n y"*.
- **Script:** *"Living in harmony"* appears **once**, as a signature. Nowhere else.

### 4.4 Motion principles
- **Easing:** one family only (quart/expo out). Large moves take 1.2–1.6s and interface moves 0.6–0.8s. No springs or bounces.
- **Text:** reveals line by line through masks (GSAP SplitText).
- **Images:** reveal through **arch‑shaped masks**, the brand's recurring motif.
- **Parallax:** at most 8–10%. Smooth scroll stays light so it still feels native.
- **Cursor:** native everywhere. Inside 3D zones only, a hairline ring with a label (*Drag*, *Open*).

### 4.5 Sound design
- **Opt‑in only**, and the choice is remembered. A thin animated waveform is the toggle.
- **Ambient beds per time of day** crossfade with the scroll: dawn sea, morning birds, noon cicadas, olive breeze, swallows, night crickets.
- **A 3‑note motif** (three arches) on entering and on booking a visit. Interface sounds are barely there: soft stone or paper taps.
- About 1.5 MB of audio in total, streamed. Sound ducks when the tab is hidden. If the client owns the rights, the film's soundtrack can supply the motif.

### 4.6 Luxury guardrails — never do these
Bouncy easing · auto‑playing sound · loaders longer than 3s · carousel arrows · stock icons · urgency banners or countdowns · text over busy imagery without a scrim · more than one idea per screen · cursor trails · trapping the user in a scroll sequence.

---

## 5. Information architecture

```
/[locale]                  The journey (chapters 0–8)
/[locale]/residences       All units: model + accessible list, filters, status
/[locale]/residences/[slug] A unit or typology (V3, V4): camera flies in, exploded floors, plans, sun study
/[locale]/village          Concept, materials, autonomy, village heart (deep‑linkable)
/[locale]/location         Terrain map, drive times, categories
/[locale]/visit            Private visit invitation + brochure
/[locale]/film             The full film, streamed on demand
/[locale]/legal/*          Privacy, cookies, terms
```
Languages: `en` and `pt`, with hreflang links between them. The 3D canvas **persists across routes**, so going from the journey to a residence page is a camera move, not a page reload.

---

## 6. Technical architecture

### 6.1 Stack
| Concern | Choice |
|---|---|
| Framework | **Next.js** (latest stable, App Router, TypeScript), React 19 |
| 3D | **three**, **@react-three/fiber** v9, **@react-three/drei**, **@react-three/postprocessing** |
| Scroll | **Lenis** (`lenis/react`) synced with **GSAP ScrollTrigger**. GSAP and all its plugins, SplitText included, are now free. |
| State | **zustand**. 3D reads it each frame without triggering React re‑renders. |
| Sun | **suncalc** (real sun position for the site's coordinates and orientation) |
| Device tiers | **detect-gpu** + drei `PerformanceMonitor` |
| Styling | Tailwind CSS + CSS variables (palette tokens) |
| i18n | next-intl |
| CMS | Sanity (or Payload) for units, availability, copy, contacts |
| Leads | Server action → zod validation → email (Resend) + the client's CRM; booking via Cal.com or their existing Google appointment page |
| Video | Hero loops as AV1/HEVC + H.264, plus mobile cuts and posters. Full film streamed adaptively (Mux, Cloudflare Stream or Bunny). |
| Analytics | Plausible or Umami (privacy‑friendly) with custom events |
| Hosting | Vercel (preview links for the pitch) |

### 6.2 Runtime architecture
```
app/[locale]/layout.tsx
 ├─ <SmoothScroll>         Lenis → ScrollTrigger.update (one shared GSAP ticker)
 ├─ <Experience>           ONE fixed full-screen <Canvas>, loaded lazily after the main image
 │    ├─ <TimeOfDay>       one source of truth: sun direction, sky, fog, light temperature, window glow
 │    ├─ <CameraRig>       camera paths per chapter (authored), damped scrubbing; orbit mode in Residences
 │    ├─ <World>           Terrain · Village · SectionCut · Residence(s) · Trees · Cars
 │    └─ <Post>            tilt-shift DoF · AO · bloom (night) · vignette · grain · SMAA (per tier)
 ├─ <Chrome>               header · sun-arc progress / chapter index · sound toggle · labelled cursor
 └─ {children}             HTML chapters: real text that registers ScrollTriggers → store
```
- **Chapters are normal HTML sections.** Each one writes `{chapter, progress}` into `useJourney`. The 3D world reads it in `useFrame` through `getState()`, so nothing re‑renders per frame.
- **Camera choreography:** author camera paths in Blender and export them as glTF animations, then scrub the animation with scroll progress. A 3D artist can art‑direct the shots without code changes. Fallback: Catmull‑Rom curves plus look‑at targets in code.
- **Time of day:** a single `sunDirection` and `dayProgress` drive every material, so the light is always consistent. The sun study simply overrides `dayProgress` with `suncalc(date, time, lat, lng)`.
- **Section cut:** clipping planes with stencil caps for a solid cut look, or pre‑modelled "cut" meshes in Blender, whichever reads cleaner on mobile.
- **Units:** each house is a named node in the model (`UNIT_07`) linked to a CMS record. Status drives its material. The accessible HTML list of units drives the same selection, so the keyboard works.
- **Rendering control:** render while a 3D chapter is visible, pause when HTML covers the canvas or the tab is hidden.

### 6.3 3D asset pipeline
1. **Source:** the architects' model (Revit, ArchiCAD, SketchUp or 3ds Max). Without it, build a massing model from the film's aerials and the renders (the houses are simple stacked volumes in roughly four staggered terraces), labelled *illustrative*.
2. **Blender:** clean up, decimate, merge by material, and split nodes per unit and per floor (needed for the exploded view). Unwrap UVs and bake AO and soft lighting.
3. **Terrain:** public elevation data (Copernicus GLO‑30) for Lisbon–Cascais → heightmap → displaced, decimated mesh, draped with a higher‑resolution redraw of their illustrated map.
4. **Export and optimise:** glTF → `gltf-transform` (dedupe, prune, weld, meshopt compression) → KTX2 textures (ETC1S for colour, UASTC for normals) → `gltfjsx --types` to generate typed components.

### 6.4 Performance budgets
| Item | Budget |
|---|---|
| First content (main image) | < 2.0s on 4G; LCP ≤ 2.5s, CLS 0, INP < 200ms |
| Hero loop | ≤ 4 MB desktop / ≤ 2 MB mobile (currently **132 MB**) |
| JS (excluding three) | ≤ 200 KB gzip on first load; 3D bundle loaded lazily |
| Village model | ≤ 3 MB · each residence ≤ 1.5 MB · terrain ≤ 1.5 MB |
| Frame rate | 60 fps on recent laptops; ≥ 30 fps on iPhone 13 / mid Android |

### 6.5 Device tiers and fallbacks
| Tier | Detection | Experience |
|---|---|---|
| High | detect‑gpu tier 3 | Pixel ratio up to 2, live sun shadows, tilt‑shift, AO, full post‑processing |
| Mid | tier 2 / battery saver | Pixel ratio 1.25–1.5, baked AO only, no depth of field |
| Low / no WebGL2 / Save‑Data | tier ≤ 1 | **Cinematic fallback:** each 3D chapter as a pre‑rendered video from the same Blender cameras (same story, no WebGL). Residences via an interactive SVG site plan. |
| Reduced motion | `prefers-reduced-motion` | No scroll‑scrubbed camera. Chapters crossfade, no parallax, posters instead of loops. |

### 6.6 Accessibility and SEO
- All narrative content is real HTML text. The canvas is `aria-hidden` and purely an enhancement.
- WCAG AA contrast (scrims over imagery), visible focus, keyboard‑operable unit selection, captions on the film, alt text on every image.
- Metadata rendered on the server, OG images per residence, JSON‑LD structured data for the residences, sitemap, hreflang EN/PT.

### 6.7 Analytics the sales team will love
Track these events: `chapter_reached`, `sound_on`, `unit_opened(unitId)`, `sun_study_used`, `film_played`, `brochure_requested`, `visit_requested(unitId)`. Then send the developer a weekly **"most‑explored units"** report. That's a concrete business reason to choose this over the current site.

### 6.8 Proposed repo structure
```
app/[locale]/{layout,page}.tsx, residences/[slug], village, location, visit, film, legal
components/chrome/     Header, SunArc, SoundToggle, Cursor, ArchMask
components/chapters/   Threshold, Dawn, Arrival, Stronghold, Materials, VillageHeart, Residences, View, Invitation
components/ui/         Reveal, SplitLines, ArchFrame, Button
canvas/                Experience, Post, tiers
canvas/world/          Terrain, Village, SectionCut, Residence, Trees, Cars, Sky
canvas/rigs/           CameraRig (rails), OrbitRig (residences)
canvas/materials/      limestone, cork, foliage-wind
lib/                   journey-store, scroll (Lenis+ScrollTrigger), sun (suncalc), audio, analytics
sanity/                schemas: residenceType, unit, chapter, settings
pipeline/              gltf-transform scripts, Blender export notes
public/                models (.glb), textures (.ktx2), video, audio
```

---

## 7. What we need from the client

- [ ] Architects' 3D model (any format) + **site plan with unit numbers and north arrow**
- [ ] Floor plans per typology (V3 Townhouse, V4 Premium Villa) and per unit if they differ
- [ ] Unit list: number, type, status, phase (V4 = 2028), price policy (*price on request*?)
- [ ] Original high‑resolution renders and the **film master** (+ soundtrack rights)
- [ ] Exact coordinates and orientation (for the sun study)
- [ ] Real contact details: advisor (photo, phone, WhatsApp, email), CRM, calendar
- [ ] Brochure PDF, legal texts, cookie policy
- [ ] Font licences (Normalidad web licence)
- [ ] Copy approval EN/PT

---

## 8. Phases

### Phase 1 — Pitch demo (≈ 2 weeks, one front‑end dev + Blender time)
**Scope:** chapters 0 → 1 → 2 → 3 → 6 → 8 (threshold, hero loop and descent, model orbit, section cut, choose your home with exploded floors and sun study, invitation form). Also the sun‑arc progress, two sound layers, basic device tiers and a reduced‑motion path. English only, phone‑ready, deployed to a preview link.

| Week | Work |
|---|---|
| 1 | Scaffold (Next, R3F, Lenis+GSAP, store, persistent canvas). Massing model v1 + terrain in Blender. Look development (light, materials, tilt‑shift). Time‑of‑day system. Hero loop encode. Threshold + sun arc. |
| 2 | Section cut. Unit selection + exploded floors + sun study. Invitation form. Sound. Mobile pass + tiers. Polish. Deploy. **Record a backup screen‑capture video** in case the meeting room's Wi‑Fi fails. |

**Acceptance:** runs at the budgets above on a recent MacBook and an iPhone 13. The whole demo is ≤ 10 MB. Works in Safari, Chrome and Firefox. The reduced‑motion path works.

**The pitch itself:** open it on *their* phone. Show the hard numbers side by side: page weight (132 MB → ~5 MB), the mobile overflow fixed, and leads captured versus none today. Offer the two tiers: an Elementor upgrade with the 3D component dropped in, or the full Next.js flagship.

### Phase 2 — Full build (≈ 6–8 weeks after sign‑off)
Real CAD model, all chapters, CMS + live unit availability, residence pages, location chapter, PT translation, fallback videos rendered in Blender, CRM and booking integration, analytics, legal and cookies.

### Phase 3 — Launch and after
Testing on a range of real devices, accessibility audit, redirects from the WordPress URLs (keep `/pt/`), monitoring, handover docs. Ongoing: unit status updates and seasonal content (e.g. a construction progress chapter).

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| No CAD model available | Build the massing model from aerials and renders, labelled *illustrative*. The model style forgives approximation. |
| Real‑time 3D looks cheaper than the renders | The model style is deliberate. Photoreal stays with the renders and film. |
| Mobile GPU and heat limits | Device tiers, adaptive pixel ratio, pausing rendering when hidden, cinematic video fallback |
| Scroll fatigue / feeling trapped | Light Lenis, "Skip to residences", chapter index, 4–6 min total |
| Sun study taken as a promise | Accurate coordinates and an *indicative* note |
| Client's team can't edit | Sanity for units and copy. Alternatively keep WordPress as the editing tool and pull content from it (WPGraphQL). |
| Pitch day network failure | Locally served build plus a recorded video walkthrough |

---

## 10. Next steps
1. Confirm the asset list (section 7). The single most valuable item is the architects' model plus the site plan.
2. Scaffold the Next.js project in this repo and start Week 1.
