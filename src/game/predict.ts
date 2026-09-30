import { brake, cloneFlight, DT, isTerminal, launch, step } from "./physics";
import type { Aim, Closest, Flight, FlightEnd, Mission, Solution, Vec } from "./types";

export const SAMPLE_EVERY = 3;

export interface Prediction {
  points: Vec[];
  /** Set only if the flight ends inside the guide's horizon. */
  end: FlightEnd | null;
  endAt: Vec | null;
  /** Nearest pass to the dock within the horizon, and where the dock will be then. */
  closest: Closest;
}

/** Run a copy of the flight forward using the real step function. */
export function predictFrom(m: Mission, flight: Flight, seconds: number): Prediction {
  const f = cloneFlight(flight);
  const steps = Math.round(seconds / DT);
  const points: Vec[] = [{ ...f.p }];
  for (let i = 0; i < steps; i++) {
    const e = step(m, f);
    if (isTerminal(e)) {
      points.push({ ...f.p });
      return { points, end: e, endAt: { ...f.p }, closest: f.closest };
    }
    if (f.step % SAMPLE_EVERY === 0 || i === steps - 1) points.push({ ...f.p });
  }
  return { points, end: null, endAt: null, closest: f.closest };
}

export function predictLaunch(m: Mission, tick: number, aim: Aim): Prediction {
  return predictFrom(m, launch(m, tick, aim), m.guideSeconds);
}

/** What happens if the brake is pulled right now. */
export function predictBrake(m: Mission, flight: Flight): Prediction | null {
  if (flight.braked) return null;
  const f = cloneFlight(flight);
  brake(f);
  return predictFrom(m, f, m.guideSeconds);
}

export interface Run {
  end: FlightEnd;
  flight: Flight;
  path: Vec[];
}

/** Fly a whole attempt to its end, braking at a given step. Used by tests and the solver. */
export function run(m: Mission, s: Solution): Run {
  const f = launch(m, s.delayTicks, s.aim);
  const path: Vec[] = [{ ...f.p }];
  for (;;) {
    if (s.brakeStep !== null && f.step === s.brakeStep) brake(f);
    const e = step(m, f);
    if (f.step % SAMPLE_EVERY === 0) path.push({ ...f.p });
    if (isTerminal(e)) {
      path.push({ ...f.p });
      return { end: e, flight: f, path };
    }
  }
}
