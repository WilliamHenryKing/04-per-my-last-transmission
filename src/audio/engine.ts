import {
  type AudioMood,
  type Bus,
  bedLevels,
  humRate,
  parseMuted,
  SOUND_IDS,
  SOUNDS,
  type SoundId,
  soundUrl,
} from "./sounds";

// Web Audio playback: three buses (sfx, music, ambience) into a master gain.
// Nothing is created until the first user gesture; muting persists; hidden tabs suspend.

const MUTE_KEY = "pmlt.muted.v1";
const FADE = 0.35;
const TICK_GAP_MS = 55;

function readMuted(): boolean {
  try {
    return parseMuted(window.localStorage.getItem(MUTE_KEY));
  } catch {
    return false;
  }
}

/** Find the audible span so looping MP3s skip their encoder padding. */
function audibleSpan(buffer: AudioBuffer): { start: number; end: number } {
  const data = buffer.getChannelData(0);
  const threshold = 0.002;
  let first = 0;
  let last = data.length - 1;
  while (first < last && Math.abs(data[first] ?? 0) < threshold) first++;
  while (last > first && Math.abs(data[last] ?? 0) < threshold) last--;
  return { start: first / buffer.sampleRate, end: (last + 1) / buffer.sampleRate };
}

export class AudioEngine {
  muted = readMuted();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses = new Map<Bus, GainNode>();
  private buffers = new Map<SoundId, AudioBuffer>();
  private hum: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private beds = false;
  private mood: AudioMood = "aim";
  private lastTick = 0;
  private hidden = false;

  constructor() {
    document.addEventListener("visibilitychange", () => {
      this.hidden = document.hidden;
      if (!this.ctx) return;
      if (this.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  /** Call from a user gesture: creates the context and loads everything once. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !this.hidden) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    for (const bus of ["sfx", "music", "ambience"] as Bus[]) {
      const g = ctx.createGain();
      g.gain.value = bus === "sfx" ? 1 : 0;
      g.connect(this.master);
      this.buses.set(bus, g);
    }
    void this.load(ctx);
  }

  private async load(ctx: AudioContext) {
    // Short effects first so the first interactions are never silent for long.
    const order = [...SOUND_IDS].sort(
      (a, b) => Number(!!SOUNDS[a].loop) - Number(!!SOUNDS[b].loop),
    );
    for (const id of order) {
      try {
        const res = await fetch(soundUrl(id));
        const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(id, buffer);
      } catch {
        // A missing or undecodable file only silences that one sound.
      }
    }
    this.startBeds();
    this.setMood(this.mood, true);
  }

  private startBeds() {
    if (this.beds || !this.ctx) return;
    this.beds = true;
    for (const id of ["music-hold", "ambience-space"] as SoundId[]) {
      const buffer = this.buffers.get(id);
      const bus = this.buses.get(SOUNDS[id].bus);
      if (!buffer || !bus) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const span = audibleSpan(buffer);
      src.loopStart = span.start;
      src.loopEnd = span.end;
      src.connect(bus);
      src.start(0, span.start);
    }
  }

  play(id: SoundId, delay = 0, rate = 1) {
    const ctx = this.ctx;
    const buffer = this.buffers.get(id);
    const bus = this.buses.get(SOUNDS[id].bus);
    if (!ctx || !buffer || !bus || ctx.state !== "running") return;
    if (id === "ui-tick") {
      const now = performance.now();
      if (now - this.lastTick < TICK_GAP_MS) return;
      this.lastTick = now;
    }
    const spec = SOUNDS[id];
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    const at = ctx.currentTime + delay;
    gain.gain.setValueAtTime(spec.gain, at);
    const length = spec.maxSeconds ? spec.maxSeconds / rate : 0;
    if (length) {
      gain.gain.setValueAtTime(spec.gain, at + length - 0.3 / rate);
      gain.gain.linearRampToValueAtTime(0, at + length);
    }
    src.connect(gain).connect(bus);
    src.start(at);
    if (length) src.stop(at + length + 0.05);
  }

  /** Fade the beds to suit what the player is doing; the flight hum only plays in flight. */
  setMood(mood: AudioMood, force = false) {
    if (mood === this.mood && !force) return;
    this.mood = mood;
    const ctx = this.ctx;
    if (!ctx) return;
    const levels = bedLevels(mood);
    const now = ctx.currentTime;
    for (const bus of ["music", "ambience"] as const) {
      const g = this.buses.get(bus)?.gain;
      g?.cancelScheduledValues(now);
      g?.setValueAtTime(g.value, now);
      g?.linearRampToValueAtTime(levels[bus], now + FADE);
    }
    if (levels.hum) this.startHum();
    else this.stopHum();
  }

  setSpeed(speed: number) {
    if (this.hum && this.ctx) {
      this.hum.source.playbackRate.setTargetAtTime(humRate(speed), this.ctx.currentTime, 0.1);
    }
  }

  private startHum() {
    const ctx = this.ctx;
    const buffer = this.buffers.get("flight-hum");
    const bus = this.buses.get("sfx");
    if (this.hum || !ctx || !buffer || !bus) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const span = audibleSpan(buffer);
    source.loopStart = span.start;
    source.loopEnd = span.end;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(SOUNDS["flight-hum"].gain, ctx.currentTime + 0.3);
    source.connect(gain).connect(bus);
    source.start(0, span.start);
    this.hum = { source, gain };
  }

  private stopHum() {
    const ctx = this.ctx;
    const hum = this.hum;
    if (!ctx || !hum) return;
    this.hum = null;
    hum.gain.gain.cancelScheduledValues(ctx.currentTime);
    hum.gain.gain.setValueAtTime(hum.gain.gain.value, ctx.currentTime);
    hum.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
    hum.source.stop(ctx.currentTime + 0.3);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // Unsaved preference is fine; it still applies for this visit.
    }
    const ctx = this.ctx;
    const g = this.master?.gain;
    if (!ctx || !g) return;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(muted ? 0 : 0.9, ctx.currentTime + 0.12);
  }
}
