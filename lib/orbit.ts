/**
 * The 360° look around an open home. The visitor drags the scene
 * (canvas/homes/Homes.tsx), presses ← / →, or uses the panel's turn buttons;
 * canvas/CameraRig.tsx turns the explore shot about the home by the damped
 * yaw / pitch. Mutable and read per frame — never React state. It goes back to
 * 0 whenever a home opens, changes or closes.
 *
 *   yaw    radians about the vertical through the home (+ = the camera moves to its right)
 *   pitch  radians of extra elevation (+ = higher); CameraRig keeps it within its limits
 *
 * Debug: `?yaw=90&pitch=10` (degrees) starts an explore shot turned (scripts/shot.mjs).
 */
const param = (k: string) => (typeof window !== "undefined" ? parseFloat(new URLSearchParams(window.location.search).get(k) ?? "") : NaN);
const deg = (k: string) => (Number.isFinite(param(k)) ? (param(k) * Math.PI) / 180 : 0);

export const orbit = { yaw: deg("yaw"), pitch: deg("pitch"), dragging: false };

/** A press of a turn button or an arrow key. */
export const ORBIT_STEP = Math.PI / 4;

/** Turn the home: dir +1 = to the right (as a drag to the right), −1 = to the left. */
export function turnHome(dir: number, step = ORBIT_STEP) {
  orbit.yaw -= dir * step;
  markTurned();
}

export function resetOrbit() {
  orbit.yaw = 0;
  orbit.pitch = 0;
  orbit.dragging = false;
}

/** Once the visitor has turned a home, the "drag to look around" hint can go (CSS). */
export function markTurned() {
  if (typeof document !== "undefined") document.documentElement.dataset.turned = "1";
}
