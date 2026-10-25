"use client";

/**
 * The classic site's opening comes first. Setup the visitor can't see yet
 * (scroll reveals, the pin, the scrubs: everything under the hero) waits until
 * the hero has settled (components/classic/Hero calls openUp), the visitor
 * reaches for the page, or a few seconds have passed, whichever is first. Then
 * it runs in idle time, a little per slot, so none of it lands on the film's
 * first seconds. `openingNow()` runs whatever is left at once, for anything
 * that measures the page first (a menu jump, a deep link).
 */

type Job = () => void;

const queue: Job[] = [];
let open = false;
let pumping = false;

const idle = (fn: (d?: IdleDeadline) => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 250 });
  else window.setTimeout(fn, 16);
};

function pump() {
  if (pumping) return;
  pumping = true;
  const step = (d?: IdleDeadline) => {
    // At least one job per slot, more while the frame has room.
    do queue.shift()?.();
    while (queue.length && d && d.timeRemaining() > 8);
    if (queue.length) idle(step);
    else pumping = false;
  };
  idle(step);
}

/**
 * Run `job` once the opening has passed (`first`: ahead of the jobs already
 * queued). Returns a cancel, for effect cleanups.
 */
export function afterOpening(job: Job, { first = false }: { first?: boolean } = {}): () => void {
  let live = true;
  const run = () => {
    if (live) job();
  };
  if (first) queue.unshift(run);
  else queue.push(run);
  if (open) pump();
  return () => {
    live = false;
  };
}

/** The opening is over: work through the queue in idle time. */
export function openUp() {
  if (open) return;
  open = true;
  pump();
}

/** Everything queued, now. */
export function openingNow() {
  open = true;
  while (queue.length) queue.shift()?.();
}
