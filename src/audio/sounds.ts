import type { Verdict } from "../game/rules";
import type { Cue } from "../game/session";

// The sound manifest and which sounds answer which game events. Pure: no Web Audio here.
// Gains are set from measured loudness so nothing jumps out of the mix.

export type SoundId =
  | "ui-click"
  | "ui-tick"
  | "ui-open"
  | "ui-close"
  | "ui-toggle"
  | "ui-retry"
  | "ui-next"
  | "launch-clunk"
  | "launch-whoosh"
  | "flight-hum"
  | "brake"
  | "bounce"
  | "circled"
  | "stamp"
  | "delivered"
  | "rejected"
  | "crashed"
  | "lost"
  | "ending"
  | "music-hold"
  | "ambience-space";

export type Bus = "sfx" | "music" | "ambience";

export interface SoundSpec {
  gain: number;
  bus: Bus;
  loop?: boolean;
  /** Play only this many seconds, with a short fade out. */
  maxSeconds?: number;
}

export const SOUNDS: Record<SoundId, SoundSpec> = {
  "ui-click": { gain: 0.45, bus: "sfx" },
  "ui-tick": { gain: 0.25, bus: "sfx" },
  "ui-open": { gain: 0.45, bus: "sfx" },
  "ui-close": { gain: 0.45, bus: "sfx" },
  "ui-toggle": { gain: 0.7, bus: "sfx" },
  "ui-retry": { gain: 0.8, bus: "sfx" },
  "ui-next": { gain: 0.4, bus: "sfx" },
  "launch-clunk": { gain: 0.8, bus: "sfx" },
  "launch-whoosh": { gain: 0.9, bus: "sfx", maxSeconds: 1.3 },
  "flight-hum": { gain: 0.12, bus: "sfx", loop: true },
  brake: { gain: 0.7, bus: "sfx" },
  bounce: { gain: 1, bus: "sfx" },
  circled: { gain: 0.35, bus: "sfx" },
  stamp: { gain: 0.9, bus: "sfx" },
  delivered: { gain: 0.6, bus: "sfx" },
  rejected: { gain: 0.9, bus: "sfx" },
  crashed: { gain: 0.5, bus: "sfx" },
  lost: { gain: 0.35, bus: "sfx" },
  ending: { gain: 0.9, bus: "sfx" },
  "music-hold": { gain: 1, bus: "music", loop: true },
  "ambience-space": { gain: 1, bus: "ambience", loop: true },
};

export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

export function soundUrl(id: SoundId): string {
  return `${import.meta.env?.BASE_URL ?? "/"}audio/${id}.mp3`;
}

export interface Hit {
  id: SoundId;
  /** Seconds after the event. */
  delay: number;
  /** Playback rate; the near-miss reuses the launch whoosh, higher and shorter. */
  rate?: number;
}

/** Which sounds a session cue triggers. The result stamp lands with its animation. */
export function hitsForCue(cue: Cue, verdict: Verdict | null): Hit[] {
  switch (cue) {
    case "launch":
      return [
        { id: "launch-clunk", delay: 0 },
        { id: "launch-whoosh", delay: 0.02 },
      ];
    case "brake":
      return [{ id: "brake", delay: 0 }];
    case "bounce":
      return [{ id: "bounce", delay: 0 }];
    case "circled":
      return [{ id: "circled", delay: 0 }];
    case "near":
      return [{ id: "launch-whoosh", delay: 0, rate: 1.7 }];
    case "end":
      if (verdict === "delivered") {
        return [
          { id: "stamp", delay: 0.12 },
          { id: "delivered", delay: 0.3 },
        ];
      }
      if (verdict === "rejected") {
        return [
          { id: "rejected", delay: 0 },
          { id: "stamp", delay: 0.2 },
        ];
      }
      if (verdict === "crashed") {
        return [
          { id: "crashed", delay: 0 },
          { id: "stamp", delay: 0.3 },
        ];
      }
      return [
        { id: "lost", delay: 0 },
        { id: "stamp", delay: 0.3 },
      ];
  }
}

export type AudioMood = "aim" | "flight" | "result" | "paused";

/** Bed levels per mood: hold music while you wait, space while you fly. */
export function bedLevels(mood: AudioMood): { music: number; ambience: number; hum: boolean } {
  switch (mood) {
    case "aim":
      return { music: 0.3, ambience: 0.22, hum: false };
    case "flight":
      return { music: 0.07, ambience: 0.4, hum: true };
    case "result":
      return { music: 0.18, ambience: 0.3, hum: false };
    case "paused":
      return { music: 0, ambience: 0, hum: false };
  }
}

/** Flight hum pitch follows parcel speed, within a musical range. */
export function humRate(speed: number): number {
  return Math.min(1.5, Math.max(0.7, 0.7 + speed * 0.12));
}

export function parseMuted(raw: string | null): boolean {
  return raw === "1";
}
