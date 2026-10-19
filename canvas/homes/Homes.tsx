"use client";

/**
 * "Two ways to live" — the two featured homes (FEATURED.v3 townhouse in row C,
 * FEATURED.v4 villa in row D). See FeaturedHome for the journey / jewel /
 * exploded-view behaviour. Hovering or focusing a home's HTML card
 * (`.vl-card[data-home]`) lights the matching home in 3D.
 *
 * Pointer: the HTML journey sits above the canvas (its <main> takes the
 * pointer wherever no chapter control does), so the canvas never sees pointer
 * events. The homes listen on the document instead and raycast their own hit
 * boxes, only where the pointer is not over an HTML control: hover lifts and
 * brightens a home (pointer cursor, the labelled "open" cursor), a click or a
 * tap opens it.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Raycaster, Vector2, Vector3 } from "three";
import { markTurned, orbit, resetOrbit, turnHome } from "@/lib/orbit";
import { openPlace, useJourney, type HomeId } from "@/lib/store";
import { stagesFromT } from "@/lib/timeline";
import { FeaturedHome } from "./FeaturedHome";
import { Spots } from "./Spots";
import { homesState } from "./state";
import { Veil } from "./Veil";

/** Debug: `?homes=off` leaves the featured homes out (isolating issues). */
const disabled = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("homes") === "off";

const cardHome = (t: EventTarget | null): HomeId | null => {
  const el = (t as Element | null)?.closest?.(".vl-card[data-home]") as HTMLElement | null;
  const h = el?.dataset.home;
  return h === "v3" || h === "v4" ? h : null;
};

/** HTML the pointer may be over that owns it (never pick a home through these). */
const CONTROLS = "a, button, input, select, textarea, label, summary, [role='button'], [data-interactive], [data-cursor]:not(body), .vl-card, .vl-panel";

export function Homes() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const recheckHover = useRef<() => void>(() => {});
  const seen = useRef({ pos: new Vector3(), at: 0 });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    // Dev aid (scripts / console): the scene graph, for isolating render issues.
    (window as unknown as { __VL_SCENE?: unknown }).__VL_SCENE = scene;
  }, [scene]);

  // The HTML cards answer the 3D homes.
  useEffect(() => {
    const over = (e: Event) => {
      homesState.cardHover = cardHome(e.target);
    };
    const out = (e: Event) => {
      const next = cardHome((e as PointerEvent | FocusEvent).relatedTarget);
      homesState.cardHover = next;
    };
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("focusin", over);
    document.addEventListener("focusout", out);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", over);
      document.removeEventListener("focusout", out);
      homesState.cardHover = null;
    };
  }, []);

  // The 3D homes answer the pointer.
  useEffect(() => {
    const ray = new Raycaster();
    const ndc = new Vector2();
    const last = { x: 0, y: 0, mouse: false };
    const pick = (x: number, y: number, target: Element | null): HomeId | null => {
      const s = useJourney.getState();
      if (s.mode !== "journey" || stagesFromT(s.t).homes <= 0.5) return null;
      if (!target || target.closest?.(CONTROLS)) return null;
      const r = gl.domElement.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let best: HomeId | null = null;
      let bestD = Infinity;
      for (const [id, m] of homesState.proxies) {
        const hit = ray.intersectObject(m, false)[0];
        if (hit && hit.distance < bestD) {
          bestD = hit.distance;
          best = id;
        }
      }
      return best;
    };
    const body = document.body;
    const setHover = (id: HomeId | null) => {
      if (homesState.hover === id) return;
      homesState.hover = id;
      if (id) {
        body.style.cursor = "pointer";
        body.dataset.cursor = "open"; // components/chrome/Cursor labels it
      } else {
        body.style.cursor = "";
        delete body.dataset.cursor;
      }
    };
    // Document listeners run before window ones: the labelled cursor sees the
    // hover in the same event.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last.x = e.clientX;
      last.y = e.clientY;
      last.mouse = true;
      setHover(pick(e.clientX, e.clientY, e.target as Element | null));
    };
    const recheck = () => {
      if (!last.mouse) return setHover(null);
      setHover(pick(last.x, last.y, document.elementFromPoint(last.x, last.y)));
    };
    recheckHover.current = recheck;
    const onClick = (e: MouseEvent) => {
      const id = pick(e.clientX, e.clientY, e.target as Element | null);
      if (!id) return;
      setHover(null);
      const s = useJourney.getState();
      s.setHome(id);
      s.setExplode(1);
      s.setMode("explore");
    };
    const onLeave = () => {
      last.mouse = false;
      setHover(null);
    };
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(recheck, 80);
    };
    const unsub = useJourney.subscribe((s, p) => {
      if (s.mode !== p.mode) recheck();
    });
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("click", onClick);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      unsub();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("click", onClick);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      recheckHover.current = () => {};
      setHover(null);
    };
  }, [camera, gl]);

  // The 360° look (lib/orbit.ts): while a place is open, dragging the scene turns it
  // (a screen width ≈ a full turn, up and down within limits), ← / → turn it by a step.
  // Mouse and pen only; touch keeps native scrolling (which lets the home go).
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    let drag: { x: number; y: number; id: number } | null = null;
    // (Not while its photos are open: the viewer owns the pointer and the arrows.)
    const open = () => {
      const s = useJourney.getState();
      return openPlace(s) != null && !s.viewer;
    };
    const overScene = (t: EventTarget | null) => !(t as Element | null)?.closest?.(CONTROLS);
    const label = (on: boolean) => {
      if (on) body.dataset.cursor = "drag"; // components/chrome/Cursor labels it
      else if (body.dataset.cursor === "drag") delete body.dataset.cursor;
    };
    const mark = () => {
      if (drag) root.dataset.orbit = "drag";
      else if (open()) root.dataset.orbit = "1";
      else delete root.dataset.orbit;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType === "touch" || !open() || !overScene(e.target)) return;
      e.preventDefault(); // no text selection while turning
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      orbit.dragging = true;
      mark();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (drag && e.pointerId === drag.id) {
        const k = (2 * Math.PI) / Math.max(640, window.innerWidth);
        orbit.yaw -= (e.clientX - drag.x) * k;
        orbit.pitch += (e.clientY - drag.y) * k * 0.6;
        drag.x = e.clientX;
        drag.y = e.clientY;
        markTurned();
        return;
      }
      label(open() && overScene(e.target));
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      orbit.dragging = false;
      mark();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!open() || e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      if ((e.target as Element | null)?.closest?.("input, select, textarea, [role='slider'], [contenteditable='true']")) return;
      e.preventDefault(); // (the page would scroll, and a scroll lets the home go)
      turnHome(e.key === "ArrowRight" ? 1 : -1);
    };
    const unsub = useJourney.subscribe((s, p) => {
      if (openPlace(s) === openPlace(p)) return;
      // A place opens, changes or closes: the view starts from its authored shot.
      resetOrbit();
      drag = null;
      mark();
      if (!open()) label(false);
    });
    mark();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      unsub();
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      label(false);
      delete root.dataset.orbit;
    };
  }, []);

  // While the camera eases (after a scroll, towards a home) the homes move under a
  // still pointer: re-pick every ~100 ms until it settles, so hover never lags.
  useFrame((state) => {
    const p = seen.current;
    if (camera.position.distanceToSquared(p.pos) < 1e-4) return;
    const now = state.clock.elapsedTime;
    if (now - p.at < 0.1) return;
    p.at = now;
    p.pos.copy(camera.position);
    recheckHover.current();
  });

  if (disabled()) return null;
  return (
    <group name="homes">
      <FeaturedHome id="v3" />
      <FeaturedHome id="v4" />
      <Veil />
      <Spots />
    </group>
  );
}
