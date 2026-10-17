@AGENTS.md

# Vila Leku — immersive 3D pitch demo

Scroll-driven 3D site for Vila Leku (Phidias, Leceia/Oeiras): "One day at Vila Leku". The village builds itself as the day passes.
Creative intent: `PLAN.md`. **Backlog and status: `resumeplanlocal.md`.** Start there, and work items in priority order (P0 first).

## Commands

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # must pass before every commit
npm run build        # must pass before every push (Vercel deploys main)
node scripts/shot.mjs --t 1.6,4.5 --out shots/x [--mobile] [--q "home=v4&sun=0.72"] [--info]
node scripts/flicker.mjs --t 0.8:6.9:0.1 --micro 0.0005 [--q "quality=3"]   # unstable pixels per t (heat-maps in shots/flicker/)
node scripts/flicker.mjs --t 5.5 --q "home=v4&sun=0.72" --through v4      # trees/planting inside an open home
```
Debug URL params: `?t=` (journey 0–7) `?snap=1` `?home=v3|v4` `?sun=0..1` `?tier=high|mid|low` `?rm=1` `?invite=demo` `?cam=x,y,z,tx,ty,tz,fov` `?yaw=&pitch=` (degrees, an open home turned) `?explode=0` (the whole house) `?quality=N` (pin a quality rung) `?grain=0` `?probe=1` (hooks for flicker.mjs) `?secdbg=hide:name|prefix*` (hide meshes by name, e.g. `landscape-trees*`).
Before relying on `scripts/shot.mjs` locally, make it portable (resumeplanlocal.md §1.1).

## Rules

- **Pitch target is a Windows laptop** (Chrome/Edge on ANGLE/D3D11). Judge performance there, not only on a Mac.
- **Verify visually.** For any change to look or motion, take screenshots at the affected `t` values and look at them (contact sheet via `montage`). Typecheck alone proves nothing about how it looks. Quality bar: every frame a poster: composed, lit, calm. No bouncy easing, no game-like effects.
- **One commit per finished backlog item**, with a clear message. Keep `main` green (typecheck and build pass). Use feature branches for bigger items. Tick items off in `resumeplanlocal.md` as they land.
- **The day only moves forward.** Interactive modes override it via `sunOverride`.
- **Per-frame code** reads the store with `useJourney.getState()` inside `useFrame`. Never use React state per frame. Don't allocate per frame.
- **Anything the section plane can cut** must use `patchVillageMaterial` (`lib/materials.ts`), which handles clipping, the white-model → material sweep, the seam and poché.
- **Pointer events:** `main.vl-journey` receives all pointer events; the R3F canvas gets none. For 3D interaction, raycast from document-level events (see `canvas/homes/Homes.tsx`).
- **Contracts live in `lib/`:**
  - `timeline.ts`: chapters, `t`, stages incl. `plan`
  - `day.ts`: light
  - `uniforms.ts`, `materials.ts`: shared uniforms, sweep, poché
  - `village.ts`: layout, `heightAt`
  - `camera.ts`: base keys; merges `canvas/section/shots.ts` and `canvas/homes/shots.ts`
  - `store.ts`: state

  Changing them affects every module, so re-check the whole journey (t 0.8 → 6.7) afterwards.

## Map

- `canvas/`: one persistent canvas.
  - `Driver.tsx`: uniforms per frame
  - `Day.tsx`: sun, sky, fog, shadow fitting
  - `CameraRig.tsx`: path, explore blend, portrait framing
  - `Post.tsx`: SMAA, night bloom, tilt-shift, grade and grain
  - `world/`: terrain, landscape, houses (`houses/architecture.ts` header documents the builder API)
  - `section/`: garage, cars, life, anchors
  - `homes/`: featured V3/V4, interiors, veil, jewels
- `components/`: the HTML layer. Chapters, `HeroMedia` (film + match cut), chrome (sun arc / hold the sun, header, index, sound), homes panel, invitation.
- `public/media/`: hero loops, posters, renders, brand masks, audio. All cut from the client's film and site, pitch use only.
