# Vila Leku — immersive 3D pitch demo

A scroll-driven 3D experience for Vila Leku (Leceia, Oeiras — by Phidias):
**"One day at Vila Leku"** — the village builds itself as the day unfolds. See `PLAN.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000 (classic site) · http://localhost:3000/3d-immersive (the 3D, direct link only)
npm run build && npm start
```

## Debug / screenshot parameters

On the 3D route, `/3d-immersive`.

| Param | Effect |
|---|---|
| `?t=3.4` | Jump to journey position 3.4 (chapter index + progress) |
| `?snap=1` | Skip damping — deterministic frames |
| `?home=v3\|v4` | Explore mode on a featured home |
| `?sun=0..1` | Hold the sun (dawn → night) |
| `?tier=high\|mid\|low` | Force device tier |
| `?rm=1` | Force reduced motion |

`node scripts/shot.mjs --t 1.5,3.4 [--mobile] [--q "home=v4"]` renders screenshots with headless Chromium.

## Architecture

- `lib/timeline.ts` — chapters, scroll → `t`, build stages, day mapping (the contract)
- `lib/day.ts` — time of day → sun, sky, fog, night
- `lib/village.ts` — the village layout (artistic interpretation), terrain height, garage, trees
- `lib/uniforms.ts`, `lib/materials.ts` — shared shader uniforms; white-model → material sweep, seam glow, section poché
- `canvas/` — one persistent R3F canvas: Driver (uniforms), Day (light), CameraRig, world, section, homes, Post
- `components/` — the HTML journey: chapters, hero film, chrome (SunArc, header, sound)

*Artistic interpretation. Not to scale.* Renders and film © Phidias / Vila Leku, used for this pitch.
