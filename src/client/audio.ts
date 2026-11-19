// All sound in OhNo! is synthesized live with the Web Audio API: no audio files.
// The music (complete public-domain pieces) lives in ./songs.ts.

import { SONGS, type MusicEvent, type Song } from "./songs";

export { SONGS };

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const compile = (song: Song) => song.build();

// ---------------------------------------------------------------------------

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private mode: "calm" | "game" | null = null;
  private timer = 0;
  private playlist: Song[] = [];
  private songIdx = 0;
  private loops = 0;
  private compiled = compile(SONGS[0]!);
  private cursor = 0;
  private cursorBeat = 0;
  private cursorTime = 0;
  private tempo = 1;
  sfxEnabled = true;
  private listeners = new Set<() => void>();

  /** Must be called from a user gesture at least once (browser autoplay rules). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.build();
      this.ctx.addEventListener("statechange", () => this.listeners.forEach((f) => f()));
    }
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
  }

  get ready() {
    return this.ctx?.state === "running";
  }

  onStateChange(f: () => void) {
    this.listeners.add(f);
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    // A brick-wall limiter last, so loud chords squash instead of clipping (that's the crackle).
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    this.master.connect(comp).connect(limiter).connect(ctx.destination);

    // A little warm room echo on everything.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(wet).connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.musicBus.connect(delay);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(delay);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  // ---------- music ----------

  /** "calm" (lobby / between rounds), "game" (lively, rotates tunes), or null to stop. */
  setMusic(mode: "calm" | "game" | null) {
    if (!this.ctx || mode === this.mode) return;
    this.mode = mode;
    const g = this.musicBus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    clearInterval(this.timer);
    if (!mode) {
      g.linearRampToValueAtTime(0, now + 0.6);
      return;
    }
    g.setValueAtTime(0, now + 0.05);
    g.linearRampToValueAtTime(this.level(), now + 1.5);
    this.playlist = SONGS.filter((x) => x.mode === mode);
    this.songIdx = Math.floor(Math.random() * this.playlist.length);
    this.loops = 0;
    this.compiled = compile(this.playlist[this.songIdx]!);
    this.cursor = 0;
    this.cursorBeat = 0;
    this.cursorTime = now + 0.15;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  private level() {
    return this.mode === "calm" ? 0.45 : 0.55;
  }

  /** 1 = normal; >1 speeds the music up (someone's on their last card!). */
  setTempo(mult: number) {
    this.tempo = mult;
  }

  /** Dip the music for a moment so a sound effect can land. */
  duck(seconds = 2.2, to = 0.12) {
    if (!this.ctx || !this.mode) return;
    const g = this.musicBus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + 0.15);
    g.setValueAtTime(to, now + seconds);
    g.linearRampToValueAtTime(this.level(), now + seconds + 1.2);
  }

  private schedule() {
    const ctx = this.ctx!;
    const song = this.playlist[this.songIdx]!;
    const spb = 60 / (song.bpm * (song.mode === "game" ? this.tempo : 1));
    // Schedule well ahead: if the page is busy redrawing, the music keeps going.
    const horizon = ctx.currentTime + 0.6;
    for (let guard = 0; guard < 400; guard++) {
      const ev = this.compiled.events[this.cursor];
      if (!ev) {
        // End of the loop: move on to the next tune every two plays.
        this.cursorTime += (this.compiled.length - this.cursorBeat) * spb;
        this.cursorBeat = 0;
        this.cursor = 0;
        // Songs are complete pieces now: move on to the next one after each play.
        if (++this.loops > 0 && this.playlist.length > 1) {
          this.songIdx = (this.songIdx + 1) % this.playlist.length;
          this.compiled = compile(this.playlist[this.songIdx]!);
          this.cursorTime += 60 / song.bpm; // a breath between songs
        }
        return;
      }
      let t = this.cursorTime + (ev.beat - this.cursorBeat) * spb;
      if (t < ctx.currentTime - 0.15) {
        // We fell behind (the tab was asleep): pick up from this note instead of
        // blasting every missed one. (Only when a note is actually late; rests are fine.)
        this.cursorTime = ctx.currentTime + 0.05;
        this.cursorBeat = ev.beat;
        t = this.cursorTime;
      }
      if (t > horizon) return;
      this.playEvent(ev, t, ev.dur * spb);
      this.cursorTime = t;
      this.cursorBeat = ev.beat;
      this.cursor++;
    }
  }

  /** When each sounding music note ends, so very busy passages can't pile up hundreds of voices. */
  private voiceEnds: number[] = [];
  private static MAX_VOICES = 28;

  private playEvent(ev: MusicEvent, t: number, dur: number) {
    this.voiceEnds = this.voiceEnds.filter((e) => e > t);
    // The tune always plays; accompaniment gives way when too much is already ringing.
    if (ev.voice !== "lead" && this.voiceEnds.length >= AudioEngine.MAX_VOICES) return;
    // Keep the score's dynamics (soft passages stay soft) without letting quiet notes vanish.
    const dyn = 0.6 + 0.4 * ev.vel;
    // A music box can't sound very low notes, so lift anything too deep up by octaves.
    const lift = (m: number, floor: number) => {
      while (m < floor) m += 12;
      return m;
    };
    let len: number;
    if (ev.voice === "lead") this.musicBox(hz(lift(ev.midi, 57)), t, (len = Math.min(4, Math.max(0.35, dur * 1.6))), 0.22 * dyn, this.musicBus);
    else if (ev.voice === "harmony") this.musicBox(hz(lift(ev.midi, 50)), t, (len = Math.min(2.5, Math.max(0.3, dur * 1.4))), 0.1 * dyn, this.musicBus, true);
    else if (ev.voice === "bass") this.bass(hz(lift(ev.midi, 36)), t, (len = Math.min(3, Math.max(0.2, dur))), this.musicBus, dyn);
    else {
      this.noiseHit(t, 0.05, 7000, 0.025, "highpass", this.musicBus);
      return;
    }
    this.voiceEnds.push(t + len);
  }

  // ---------- instruments ----------

  private env(t: number, peak: number, attack: number, decay: number, dest: AudioNode) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, len: number, dest: AudioNode, glideTo?: number) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + len);
    o.connect(dest);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }

  /** Plucked music-box / celesta tone. */
  private musicBox(f: number, t: number, len: number, vol: number, dest: AudioNode, light = false) {
    const g = this.env(t, vol, 0.004, len, dest);
    this.osc("sine", f, t, len, g);
    const h = this.env(t, vol * 0.35, 0.003, len * 0.4, dest);
    this.osc("sine", f * 2, t, len * 0.4, h);
    if (light) return; // accompaniment: skip the third partial (fewer voices, same sound in a chord)
    const k = this.env(t, vol * 0.12, 0.002, len * 0.15, dest);
    this.osc("triangle", f * 3, t, len * 0.15, k);
  }

  private bass(f: number, t: number, len: number, dest: AudioNode, dyn = 1) {
    const lp = this.ctx!.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    lp.connect(dest);
    const g = this.env(t, 0.2 * dyn, 0.01, len, lp);
    this.osc("triangle", f, t, len, g);
    // A soft octave overtone so the bass is still heard on small TV speakers.
    const o = this.env(t, 0.07 * dyn, 0.01, len * 0.6, lp);
    this.osc("sine", f * 2, t, len * 0.6, o);
  }

  private noiseHit(t: number, len: number, freq: number, vol: number, type: BiquadFilterType, dest: AudioNode, sweepTo?: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + len);
    const g = this.env(t, vol, 0.005, len, dest);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.05);
  }

  // ---------- sound effects ----------

  private sfx(fn: (t: number, out: AudioNode) => void) {
    if (!this.ctx || !this.sfxEnabled || this.ctx.state !== "running") return;
    fn(this.ctx.currentTime + 0.01, this.sfxBus);
  }

  /** A card landing on the pile. Heavier for draw cards, sparkly for wilds. */
  cardPlay(kind: "normal" | "action" | "draw" | "wild" = "normal") {
    this.sfx((t, out) => {
      this.noiseHit(t, 0.07, 2400, 0.5, "bandpass", out);
      const g = this.env(t, kind === "draw" ? 0.7 : 0.4, 0.003, 0.12, out);
      this.osc("sine", kind === "draw" ? 120 : 170, t, 0.12, g, 50);
      if (kind === "wild")
        [72, 76, 79, 84, 88].forEach((m, i) => this.musicBox(hz(m + 12), t + 0.06 + i * 0.05, 0.4, 0.12, out));
      if (kind === "draw") this.noiseHit(t + 0.02, 0.25, 300, 0.25, "lowpass", out);
    });
  }

  /** Soft slide of a card coming off the deck. */
  draw(count = 1) {
    this.sfx((t, out) => {
      for (let i = 0; i < Math.min(count, 6); i++) this.noiseHit(t + i * 0.11, 0.12, 5000, 0.18, "highpass", out, 1500);
    });
  }

  skip() {
    this.sfx((t, out) => {
      const lp = this.ctx!.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      lp.connect(out);
      [392, 262].forEach((f, i) => {
        const g = this.env(t + i * 0.14, 0.22, 0.01, 0.16, lp);
        this.osc("square", f, t + i * 0.14, 0.16, g);
      });
    });
  }

  reverse() {
    this.sfx((t, out) => {
      this.noiseHit(t, 0.28, 300, 0.4, "bandpass", out, 3200);
      this.noiseHit(t + 0.28, 0.3, 3200, 0.35, "bandpass", out, 300);
    });
  }

  /**
   * The OhNo! sting: rumble + rising tremolo, then "dun… dun… DUNNN".
   * `short` is the phone version (just the rise and one hit).
   */
  ohno(short = false) {
    this.sfx((t, out) => {
      const ctx = this.ctx!;
      const rise = short ? 0.55 : 1.25;
      // rumble
      this.noiseHit(t, rise + 0.3, 140, 0.35, "lowpass", out);
      // tremolo strings rising
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.exponentialRampToValueAtTime(2200, t + rise);
      const trem = ctx.createGain();
      trem.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 13;
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = 0.5;
      lfo.connect(lfoAmt).connect(trem.gain);
      lfo.start(t);
      lfo.stop(t + rise + 0.1);
      const swell = ctx.createGain();
      swell.gain.setValueAtTime(0.0001, t);
      swell.gain.exponentialRampToValueAtTime(0.28, t + rise);
      swell.gain.exponentialRampToValueAtTime(0.0001, t + rise + 0.08);
      trem.connect(lp).connect(swell).connect(out);
      this.osc("sawtooth", 110, t, rise, trem, 233);
      this.osc("sawtooth", 165, t, rise, trem, 349);

      // dun… dun… DUNNN (C minor stabs)
      const hits = short ? [{ at: rise + 0.05, len: 1.1, v: 0.5 }] : [
        { at: rise + 0.1, len: 0.22, v: 0.32 },
        { at: rise + 0.42, len: 0.22, v: 0.34 },
        { at: rise + 0.78, len: 1.6, v: 0.55 },
      ];
      for (const h of hits) {
        const ht = t + h.at;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(2600, ht);
        f.frequency.exponentialRampToValueAtTime(400, ht + h.len);
        f.connect(out);
        const g = this.env(ht, h.v * 0.32, 0.008, h.len, f); // 4 voices share this gain
        [36, 48, 55, 63].forEach((m) => this.osc("sawtooth", hz(m), ht, h.len, g));
        const boom = this.env(ht, h.v * 0.75, 0.005, h.len * 0.7, out);
        this.osc("sine", 75, ht, h.len * 0.7, boom, 42);
      }
    });
    if (!short) this.duck(3.4);
  }

  caught() {
    this.sfx((t, out) => {
      const lp = this.ctx!.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      lp.connect(out);
      const g = this.env(t, 0.3, 0.01, 0.4, lp);
      this.osc("square", 98, t, 0.4, g);
      this.osc("square", 104, t, 0.4, g);
      [0, 1, 2].forEach((i) => {
        const w = this.env(t + 0.45 + i * 0.22, 0.2, 0.01, 0.22, lp);
        this.osc("triangle", 330 - i * 50, t + 0.45 + i * 0.22, 0.22, w, 300 - i * 60);
      });
    });
    this.duck(1.4, 0.2);
  }

  /** Gentle two-note bell: it's your turn. */
  turn() {
    this.sfx((t, out) => {
      this.musicBox(hz(88), t, 0.9, 0.3, out);
      this.musicBox(hz(95), t + 0.16, 1.2, 0.3, out);
    });
  }

  /** Fizzle!: a fuse catching and sizzling. */
  hiss() {
    this.sfx((t, out) => {
      this.noiseHit(t, 1.1, 6000, 0.22, "highpass", out, 3000);
      for (let i = 0; i < 6; i++) this.noiseHit(t + 0.1 + i * 0.13 + Math.random() * 0.05, 0.03, 4500, 0.25, "bandpass", out);
    });
  }

  /** Fizzle!: the firecracker goes off. */
  boom() {
    this.sfx((t, out) => {
      this.noiseHit(t, 1.4, 900, 0.9, "lowpass", out, 80);
      const g = this.env(t, 0.9, 0.004, 0.9, out);
      this.osc("sine", 110, t, 0.9, g, 32);
      this.noiseHit(t + 0.02, 0.25, 3000, 0.5, "bandpass", out, 600);
    });
    this.duck(2, 0.1);
  }

  /** Fizzle!: water douses the fuse. */
  splash() {
    this.sfx((t, out) => {
      this.noiseHit(t, 0.5, 5000, 0.4, "bandpass", out, 700);
      this.noiseHit(t + 0.12, 0.6, 2500, 0.18, "lowpass", out, 400);
    });
  }

  /** Euchre: a loon's wail across the lake (someone got euchred). */
  loon() {
    this.sfx((t, out) => {
      const ctx = this.ctx!;
      const wail = (start: number, from: number, to: number, len: number, vol: number) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(vol, start + 0.18);
        g.gain.setValueAtTime(vol, start + len - 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, start + len);
        g.connect(out);
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(from, start);
        o.frequency.exponentialRampToValueAtTime(to, start + 0.35);
        o.frequency.setValueAtTime(to, start + len * 0.7);
        o.frequency.exponentialRampToValueAtTime(to * 0.94, start + len);
        // A slow, wobbly vibrato makes it sound like a bird rather than a whistle.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const depth = ctx.createGain();
        depth.gain.value = to * 0.012;
        lfo.connect(depth).connect(o.frequency);
        const h = ctx.createGain();
        h.gain.value = 0.18;
        const o2 = ctx.createOscillator();
        o2.type = "triangle";
        o2.frequency.setValueAtTime(from * 2, start);
        o2.frequency.exponentialRampToValueAtTime(to * 2, start + 0.35);
        o.connect(g);
        o2.connect(h).connect(g);
        for (const x of [o, o2, lfo]) {
          x.start(start);
          x.stop(start + len + 0.05);
        }
      };
      wail(t, 520, 780, 1.1, 0.22);
      wail(t + 1.05, 700, 1040, 1.3, 0.2);
    });
    this.duck(2.6, 0.2);
  }

  /** A single music-box note (Hush plays one per card, pitched by its number). */
  note(midi: number, vol = 0.3) {
    this.sfx((t, out) => this.musicBox(hz(midi), t, 1.4, vol, out));
  }

  tick() {
    this.sfx((t, out) => {
      const g = this.env(t, 0.12, 0.002, 0.03, out);
      this.osc("triangle", 1800, t, 0.03, g);
    });
  }

  error() {
    this.sfx((t, out) => {
      const g = this.env(t, 0.25, 0.005, 0.14, out);
      this.osc("sine", 190, t, 0.14, g, 140);
    });
  }

  pop() {
    this.sfx((t, out) => {
      const g = this.env(t, 0.25, 0.005, 0.12, out);
      this.osc("sine", 520, t, 0.12, g, 900);
    });
  }

  shuffle() {
    this.sfx((t, out) => {
      for (let i = 0; i < 14; i++) this.noiseHit(t + i * 0.055 + Math.random() * 0.02, 0.04, 3500, 0.22, "bandpass", out);
    });
  }

  fanfare() {
    this.sfx((t, out) => {
      [72, 76, 79, 84].forEach((m, i) => this.musicBox(hz(m), t + i * 0.12, 0.6, 0.3, out));
      [72, 76, 79, 84, 88].forEach((m) => this.musicBox(hz(m), t + 0.55, 2.2, 0.16, out));
      const g = this.env(t + 0.55, 0.12, 0.05, 2, out);
      [60, 67, 72].forEach((m) => this.osc("triangle", hz(m), t + 0.55, 2, g));
      for (let i = 0; i < 8; i++) this.musicBox(hz(96 + (i % 3) * 4), t + 0.8 + i * 0.09, 0.3, 0.06, out);
    });
    this.duck(3, 0.1);
  }
}

export const audio = new AudioEngine();

/** Unlock audio on the first tap/click/key anywhere (browsers require a gesture). */
export function unlockOnFirstGesture() {
  const go = () => audio.unlock();
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, go, { capture: true, passive: true });
}

// ---------- haptics ----------

const PATTERNS = {
  turn: [90, 60, 90, 60, 220],
  play: 18,
  select: 8,
  error: [40, 40, 40],
  ohno: [30, 50, 30, 50, 140],
  caught: [200, 80, 200],
} as const;

/** Vibrate on Android. iPhones don't allow websites to vibrate, so this quietly does nothing there. */
export function haptic(kind: keyof typeof PATTERNS) {
  try {
    navigator.vibrate?.(PATTERNS[kind] as number | number[]);
  } catch {
    /* unsupported */
  }
}

// Per-device preference.
export function loadPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(`ohno.${key}`);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
export function savePref(key: string, on: boolean) {
  try {
    localStorage.setItem(`ohno.${key}`, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
