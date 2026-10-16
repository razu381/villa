# Prompts for executing the resume plan with Claude Code

Two prompts. Use **A** once to start. Use **B** to start each fresh session afterwards: one backlog item, or a small group of related items, per session keeps context and usage low.

---

## A. Kickoff (first session)

```
You are continuing work on the Vila Leku immersive 3D pitch demo (Next.js 16 + React Three Fiber). The full backlog is in resumeplanlocal.md; the project rules are in CLAUDE.md (already loaded) and the creative intent is in PLAN.md. Read resumeplanlocal.md fully before doing anything.

Context you must keep in mind:
- The pitch runs on a WINDOWS LAPTOP (Chrome/Edge on ANGLE/Direct3D 11). Performance and look are judged there, on the real GPU.
- Quality bar: "every frame a poster": calm, composed, lit, tactile. No game-like effects, no bouncy easing.
- Nothing has been tested on a real GPU yet. Everything so far ran in headless software WebGL.
- The visit form stays simulated. main is the trunk.

This session, do exactly these steps in order, then stop and report:

1. Setup (resumeplanlocal.md §1): npm install, then make scripts/shot.mjs portable per §1.1:
   - local playwright import
   - executablePath only from VL_CHROMIUM
   - SwiftShader flags only behind --swiftshader
   - real GPU by default (try channel "msedge" or "chrome")
   - screenshot timeout 90 s
   Prove it works: run `node scripts/shot.mjs --t 2.6,4.5 --out shots/smoke --info` and look at the images.
   Commit: "shot.mjs: run locally on the real GPU".

2. Baseline on this machine:
   - Open chrome://gpu and report the GPU string.
   - Shoot the journey at t 0.8, 1.6, 2.6, 3.5, 4.5, 5.5, 6.6 plus `--q "home=v4&sun=0.72"` at 5.5. Combine into one contact sheet with montage and read the sheet.
   - Note fps and any stalls you can measure (DevTools performance or the --info stats).
   This baseline is the reference for everything after.

3. §2: visually verify every row of the QA part 1 table. Fix anything that looks wrong. Commit.

Rules for every change:
- Read the relevant code before editing. Keep changes minimal and in the style of the surrounding code.
- After each change run `npm run typecheck`, then screenshot the affected t values (contact sheet), and actually look.
- `npm run build` must pass before you push.
- One commit per finished item, with a clear message. Tick the item off in resumeplanlocal.md in the same commit (change "**3.x" to "✅ **3.x" or add a "Done" note).
- Push to origin main after each commit that builds.
- If a fix needs a product or creative decision, or you're unsure the reviewer's claim is right, stop and ask me instead of guessing.
- Usage economy: read screenshots as contact sheets, not one by one. Don't re-read large files you've already read. Don't launch multi-agent workflows.

End the session with a short report:
- what you did (commit hashes)
- the GPU and fps baseline
- anything that looked wrong
- the exact next item to work on.
```

---

## B. Next item (every following session)

```
Continue the Vila Leku demo. Read resumeplanlocal.md and pick up the NEXT unfinished item in priority order: §2 if it isn't done, then P0 3.1 → 3.8, then §4 (the section/homes review), then P1 3.9 → 3.23, then P2. Skip anything already marked done. CLAUDE.md has the rules; the pitch target is the Windows laptop.

For this session, work only on: <ITEM, e.g. "3.1 shader warm-up"> (or, if left blank, the next unfinished item plus any closely related ones that touch the same files).

Process:
1. Restate the item's goal and its "done when" from the plan.
2. Read the files it names.
3. Make the change. Keep it minimal and consistent with the existing code.
4. Verify:
   - `npm run typecheck`
   - screenshots at the affected t values via `node scripts/shot.mjs`, read as one montage contact sheet; check against the "done when"
   - for performance items, measure before and after on this machine (fps, program count from --info, stalls)
   - `npm run build`
5. Commit with a clear message, marking the item done in resumeplanlocal.md, and push to origin main.
6. If something in the plan turns out wrong or unnecessary on this machine, say so and note it in resumeplanlocal.md rather than forcing it.

Ask me before any decision that changes the look, story or timing in a way the plan doesn't already specify. End with a short report: what changed (commit hash), before/after evidence, and the next item.
```

---

## Tips

- **Model:** Opus 5.5 for P0 and the visual P1 items; Sonnet 5.5 is fine for the routine items (3.5, 3.20–3.22, most of P2). Switch with `/model`.
- **Before the pitch,** run prompt B with the item "§5 real-device QA on this laptop". It runs the full checklist and reports any regressions.
- If a session runs long, finish and commit the current item, then start a fresh session with prompt B.
