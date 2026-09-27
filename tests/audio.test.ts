import { describe, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { bedLevels, hitsForCue, humRate, parseMuted, SOUND_IDS, SOUNDS } from "../src/audio/sounds";
import { MISSIONS } from "../src/game/missions";
import { DT } from "../src/game/physics";
import { type Cue, Session } from "../src/game/session";

const AUDIO_DIR = join(import.meta.dir, "..", "public", "audio");

describe("sound manifest", () => {
  test("every sound has a file, and the set stays within budget", () => {
    let bytes = 0;
    for (const id of SOUND_IDS) {
      const file = join(AUDIO_DIR, `${id}.mp3`);
      expect(existsSync(file)).toBe(true);
      bytes += statSync(file).size;
    }
    expect(bytes).toBeLessThan(3.2 * 1024 * 1024);
  });

  test("only the beds and the flight hum loop", () => {
    const loops = SOUND_IDS.filter((id) => SOUNDS[id].loop).sort();
    expect(loops).toEqual(["ambience-space", "flight-hum", "music-hold"]);
  });
});

describe("cues to sounds", () => {
  test("every meaningful event is heard", () => {
    for (const cue of ["launch", "brake", "bounce", "circled", "near"] as Cue[]) {
      expect(hitsForCue(cue, null).length).toBeGreaterThan(0);
    }
  });

  test("each verdict gets its own sound and a stamp", () => {
    const heads = (["delivered", "rejected", "crashed", "lost"] as const).map((v) => {
      const hits = hitsForCue("end", v).map((h) => h.id);
      expect(hits).toContain("stamp");
      return hits.find((id) => id !== "stamp");
    });
    expect(new Set(heads).size).toBe(4);
  });

  test("pausing silences the beds; flight swaps music for space", () => {
    expect(bedLevels("paused")).toEqual({ music: 0, ambience: 0, hum: false });
    expect(bedLevels("flight").music).toBeLessThan(bedLevels("aim").music);
    expect(bedLevels("flight").hum).toBe(true);
  });

  test("hum pitch is clamped and mute parses strictly", () => {
    expect(humRate(0)).toBe(0.7);
    expect(humRate(100)).toBe(1.5);
    expect(parseMuted("1")).toBe(true);
    expect(parseMuted(null)).toBe(false);
    expect(parseMuted("yes")).toBe(false);
  });
});

test("a close pass to the dock cues one near-miss whoosh", () => {
  const m = MISSIONS[0];
  if (!m) throw new Error("no missions");
  const s = new Session(0);
  s.setAim(m.reference.aim);
  for (let i = 0; i < m.reference.delayTicks; i++) s.advance(DT);
  s.launch();
  const cues: Cue[] = [];
  while (s.phase === "flight") {
    if (s.flight?.step === m.reference.brakeStep) s.brake();
    s.advance(DT);
    cues.push(...s.drain());
  }
  expect(cues.filter((c) => c === "near")).toHaveLength(1);
  expect(cues.indexOf("near")).toBeLessThan(cues.indexOf("end"));
});
