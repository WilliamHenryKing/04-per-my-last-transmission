import { MISSIONS } from "./missions";
import { brake, DT, isTerminal, launch, positionOf, step } from "./physics";
import { SAMPLE_EVERY } from "./predict";
import { judge, type Outcome } from "./rules";
import type { Aim, Closest, Flight, Mission, Vec } from "./types";

// The whole game loop as a plain state machine: aim → flight → result → retry.
// No DOM, no rendering; the UI and scene read it every frame.

export type Phase = "aim" | "flight" | "result";
export type Cue = "launch" | "brake" | "bounce" | "circled" | "near" | "end";

/** Passing this close to the dock earns a whoosh, once per flight. */
export const NEAR_DISTANCE = 1;

export interface Attempt {
  aim: Aim;
  launchTick: number;
  path: Vec[];
  brakeAt: Vec | null;
  closest: Closest;
  outcome: Outcome;
}

const MAX_STEPS_PER_ADVANCE = 12;

export function wrapAngle(deg: number): number {
  const a = ((deg % 360) + 360) % 360;
  return Math.round(a * 10) / 10;
}

export function defaultAim(m: Mission): Aim {
  const motion = m.dock.motion;
  const target =
    motion.kind === "orbit" && motion.around
      ? positionOf(m, m.bodies.find((b) => b.id === motion.around)?.motion ?? motion, 0)
      : positionOf(m, motion, 0);
  const angle = (Math.atan2(target.y - m.depot.y, target.x - m.depot.x) * 180) / Math.PI;
  return { angle: wrapAngle(Math.round(angle)), power: 30 };
}

export class Session {
  index = 0;
  mission: Mission;
  phase: Phase = "aim";
  tick = 0;
  aim: Aim;
  flight: Flight | null = null;
  trail: Vec[] = [];
  brakeAt: Vec | null = null;
  outcome: Outcome | null = null;
  last: Attempt | null = null;
  attempts = 0;
  /** Bumped on every discrete change so the UI can re-render cheaply. */
  version = 0;
  private cues: Cue[] = [];
  private near = false;
  private acc = 0;

  constructor(index = 0) {
    this.mission = MISSIONS[0] as Mission;
    this.aim = defaultAim(this.mission);
    this.select(index);
  }

  select(index: number) {
    const i = Math.min(MISSIONS.length - 1, Math.max(0, index));
    this.index = i;
    this.mission = MISSIONS[i] as Mission;
    this.aim = defaultAim(this.mission);
    this.last = null;
    this.attempts = 0;
    this.reset();
  }

  /** Immediate retry: the clock restarts so the same launch reproduces exactly. */
  reset() {
    this.phase = "aim";
    this.tick = 0;
    this.acc = 0;
    this.flight = null;
    this.trail = [];
    this.brakeAt = null;
    this.outcome = null;
    this.version++;
  }

  setAim(next: Partial<Aim>) {
    if (this.phase !== "aim") return;
    const angle = wrapAngle(next.angle ?? this.aim.angle);
    const power = Math.round(Math.min(100, Math.max(0, next.power ?? this.aim.power)));
    if (angle === this.aim.angle && power === this.aim.power) return;
    this.aim = { angle, power };
    this.version++;
  }

  launch(): boolean {
    if (this.phase !== "aim") return false;
    this.flight = launch(this.mission, this.tick, this.aim);
    this.trail = [{ ...this.flight.p }];
    this.near = false;
    this.phase = "flight";
    this.attempts++;
    this.cue("launch");
    return true;
  }

  brake(): boolean {
    if (this.phase !== "flight" || !this.flight || !brake(this.flight)) return false;
    this.brakeAt = { ...this.flight.p };
    this.cue("brake");
    return true;
  }

  get time(): number {
    return (this.tick + (this.flight?.step ?? 0)) * DT;
  }

  /** Advance real time. The world clock runs while aiming: launch timing matters. */
  advance(seconds: number) {
    if (this.phase === "result" || !(seconds > 0)) return;
    this.acc = Math.min(this.acc + seconds, MAX_STEPS_PER_ADVANCE * DT);
    while (this.acc >= DT) {
      this.acc -= DT;
      if (this.phase === "aim") this.tick++;
      else if (this.stepFlight()) break;
    }
  }

  /** One flight step; true when the flight ended. */
  private stepFlight(): boolean {
    const f = this.flight;
    if (!f) return true;
    const e = step(this.mission, f);
    if (f.step % SAMPLE_EVERY === 0) this.trail.push({ ...f.p });
    if (e?.kind === "bounce") this.cue("bounce");
    if (e?.kind === "circled") this.cue("circled");
    if (!this.near && f.closest.distance < NEAR_DISTANCE) {
      this.near = true;
      this.cue("near");
    }
    if (!isTerminal(e)) return false;
    this.trail.push({ ...f.p });
    this.outcome = judge(this.mission, e, this.aim.power, f.braked, f.closest.distance);
    this.last = {
      aim: { ...this.aim },
      launchTick: f.launchTick,
      path: this.trail,
      brakeAt: this.brakeAt,
      closest: f.closest,
      outcome: this.outcome,
    };
    this.phase = "result";
    this.acc = 0;
    this.cue("end");
    return true;
  }

  private cue(c: Cue) {
    this.cues.push(c);
    this.version++;
  }

  /** Cues since the last call, for sound-free feedback in the HUD and scene. */
  drain(): Cue[] {
    const out = this.cues;
    this.cues = [];
    return out;
  }
}
