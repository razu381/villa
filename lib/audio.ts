"use client";

/**
 * Sound — off by default, never auto-plays. The header toggle turns it on
 * (inside the click, so iOS unlocks the AudioContext).
 *
 *  - Ambient bed: media/audio/ambient.webm (Opus) or .m4a, looped, ~0.35, 1.5 s fades,
 *    routed through WebAudio so fades work on iOS too. Paused while the tab is hidden.
 *  - Motif: three soft notes (three arches), synthesised — when the village
 *    finishes building and when a visit is requested.
 */

const BED_VOLUME = 0.35;
const FADE = 1.5;

type AC = typeof AudioContext;

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private fx: GainNode | null = null;
  private el: HTMLAudioElement | null = null;
  private on = false;
  private pauseTimer = 0;
  private lastChime = 0;
  private visBound = false;

  get enabled() {
    return this.on;
  }

  private ensure() {
    if (typeof window === "undefined") return false;
    if (!this.el) {
      const el = new Audio();
      const webm = el.canPlayType('audio/webm; codecs="opus"');
      el.src = webm ? "/media/audio/ambient.webm" : "/media/audio/ambient.m4a";
      el.loop = true;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      this.el = el;
    }
    if (!this.ctx) {
      const Ctx: AC | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
      if (Ctx) {
        try {
          const ctx = new Ctx();
          const master = ctx.createGain();
          master.gain.value = 1;
          master.connect(ctx.destination);
          const bedGain = ctx.createGain();
          bedGain.gain.value = 0;
          bedGain.connect(master);
          const src = ctx.createMediaElementSource(this.el);
          src.connect(bedGain);
          const fx = ctx.createGain();
          fx.gain.value = 1;
          fx.connect(master);
          this.ctx = ctx;
          this.master = master;
          this.bedGain = bedGain;
          this.fx = fx;
        } catch {
          this.ctx = null;
        }
      }
      if (!this.ctx) this.el.volume = 0;
    }
    if (!this.visBound) {
      this.visBound = true;
      document.addEventListener("visibilitychange", () => {
        if (!this.on) return;
        if (document.hidden) this.fadeBed(0, 0.4, true);
        else this.startBed();
      });
    }
    return true;
  }

  private fadeBed(to: number, seconds: number, pauseAfter: boolean) {
    window.clearTimeout(this.pauseTimer);
    const el = this.el;
    if (!el) return;
    if (this.ctx && this.bedGain) {
      const g = this.bedGain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(to, now + seconds);
    } else {
      // Fallback (no WebAudio): step the element volume.
      const from = el.volume;
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
        el.volume = from + (to - from) * k;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    if (pauseAfter) this.pauseTimer = window.setTimeout(() => el.pause(), seconds * 1000 + 60);
  }

  private startBed() {
    if (!this.el) return;
    this.ctx?.resume().catch(() => {});
    this.el.play().catch(() => {});
    this.fadeBed(BED_VOLUME, FADE, false);
  }

  setEnabled(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    if (on) {
      if (!this.ensure()) return;
      if (!document.hidden) this.startBed();
    } else if (this.el) {
      this.fadeBed(0, FADE, true);
    }
  }

  /** Three soft notes rising like three arches. Only when sound is on. */
  chime() {
    if (!this.on || !this.ctx || !this.fx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastChime < 2500) return;
    this.lastChime = nowMs;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.16;
    // Gentle space: a short synthetic room.
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(ctx, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    out.connect(lp);
    lp.connect(this.fx);
    lp.connect(verb);
    verb.connect(wet);
    wet.connect(this.fx);

    // D5 · A5 · E6 — open fifths, calm and unresolved like a held breath.
    const notes = [587.33, 880.0, 1318.51];
    const t0 = ctx.currentTime + 0.05;
    notes.forEach((f, i) => {
      const t = t0 + i * 0.32;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1 - i * 0.18, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 2.8);
      g.connect(out);
      const partials: [number, number, OscillatorType][] = [
        [1, 1, "sine"],
        [2.0, 0.18, "sine"],
        [3.01, 0.06, "triangle"],
      ];
      for (const [mult, amp, type] of partials) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        const pg = ctx.createGain();
        pg.gain.value = amp;
        o.connect(pg);
        pg.connect(g);
        o.start(t);
        o.stop(t + 3);
      }
    });
    window.setTimeout(() => {
      out.disconnect();
      verb.disconnect();
      wet.disconnect();
      lp.disconnect();
    }, 6500);
  }

  private impulse(ctx: AudioContext, seconds: number) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }
}

export const sound = new Sound();
