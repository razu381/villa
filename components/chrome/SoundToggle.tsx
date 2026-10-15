"use client";

import { useJourney } from "@/lib/store";
import { sound } from "@/lib/audio";
import { UI } from "@/lib/ui-copy";

/** A thin waveform: a flat hairline when off, a slow travelling wave when on. */
export function SoundToggle() {
  const on = useJourney((s) => s.soundOn);
  const toggle = () => {
    const next = !useJourney.getState().soundOn;
    // Inside the click: unlocks audio on iOS.
    sound.setEnabled(next);
    useJourney.getState().setSoundOn(next);
  };
  // Two periods of a sine so the wave can travel seamlessly by one period.
  let d = "M0 7";
  for (let x = 0; x <= 56; x += 1) d += ` L${x} ${(7 + Math.sin((x / 28) * Math.PI * 2) * 4).toFixed(2)}`;
  return (
    <button type="button" className="vl-sound" aria-pressed={on} onClick={toggle} data-on={on ? "1" : "0"}>
      <span className="sr-only">{on ? UI.sound.on : UI.sound.off}</span>
      <svg viewBox="0 0 28 14" aria-hidden="true">
        <g className="vl-sound__amp">
          <path className="vl-sound__wave" d={d} />
        </g>
      </svg>
    </button>
  );
}
