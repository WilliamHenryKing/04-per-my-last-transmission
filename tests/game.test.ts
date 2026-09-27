import { describe, expect, test } from "bun:test";
import { MISSIONS } from "../src/game/missions";
import {
  BRAKE_KEEP,
  brake,
  cloneFlight,
  DT,
  isTerminal,
  launch,
  launchSpeed,
  positionOf,
  step,
} from "../src/game/physics";
import { predictBrake, predictLaunch, run } from "../src/game/predict";
import { EMPTY_PROGRESS, parseProgress, record, totalStamps } from "../src/game/progress";
import { judge, PARCELS } from "../src/game/rules";
import { Session, wrapAngle } from "../src/game/session";
import type { Mission } from "../src/game/types";

const first = MISSIONS[0] as Mission;

function mission(over: Partial<Mission>): Mission {
  return { ...first, ...over };
}

describe("orbits", () => {
  test("a dock orbits its moon at a fixed radius", () => {
    const moon = positionOf(first, (first.bodies[0] as Mission["bodies"][0]).motion, 0);
    for (const t of [0, 1.3, 7.9]) {
      const d = positionOf(first, first.dock.motion, t);
      expect(Math.hypot(d.x - moon.x, d.y - moon.y)).toBeCloseTo(1.7, 6);
    }
  });

  test("nested orbits follow their moving parent", () => {
    const cake = MISSIONS.find((m) => m.id === "cake") as Mission;
    const moon = cake.bodies[1] as Mission["bodies"][0];
    const a = positionOf(cake, moon.motion, 0);
    const b = positionOf(cake, moon.motion, 5);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1);
    const dock = positionOf(cake, cake.dock.motion, 5);
    expect(Math.hypot(dock.x - b.x, dock.y - b.y)).toBeCloseTo(1.2, 6);
  });
});

describe("flight", () => {
  test("power maps monotonically to launch speed", () => {
    expect(launchSpeed(0)).toBeLessThan(launchSpeed(50));
    expect(launchSpeed(50)).toBeLessThan(launchSpeed(100));
    expect(launchSpeed(250)).toBe(launchSpeed(100));
  });

  test("gravity bends a straight launch towards the moon", () => {
    const f = launch(first, 0, { angle: 0, power: 20 });
    for (let i = 0; i < 240; i++) step(first, f);
    expect(f.p.y).toBeGreaterThan(-2 + 0.05);
  });

  test("the guide is honest: prediction equals the real flight", () => {
    const aim = { angle: 12, power: 40 };
    const guess = predictLaunch(first, 90, aim);
    const f = launch(first, 90, aim);
    let last = { ...f.p };
    const steps = guess.end ? Number.POSITIVE_INFINITY : Math.round(first.guideSeconds / DT);
    for (let i = 0; i < steps; i++) {
      const e = step(first, f);
      last = { ...f.p };
      if (isTerminal(e)) break;
    }
    const tip = guess.points[guess.points.length - 1];
    expect(tip?.x).toBe(last.x);
    expect(tip?.y).toBe(last.y);
  });

  test("the brake ghost matches braking for real", () => {
    const f = launch(first, 0, { angle: 5, power: 60 });
    for (let i = 0; i < 60; i++) step(first, f);
    const ghost = predictBrake(first, f);
    const real = cloneFlight(f);
    brake(real);
    for (let i = 0; i < 12; i++) step(first, real);
    expect(ghost?.points[4]).toEqual(real.p);
  });

  test("the brake works exactly once", () => {
    const f = launch(first, 0, { angle: 0, power: 50 });
    const v = f.v.x;
    expect(brake(f)).toBe(true);
    expect(f.v.x).toBeCloseTo(v * BRAKE_KEEP, 9);
    expect(brake(f)).toBe(false);
    expect(f.v.x).toBeCloseTo(v * BRAKE_KEEP, 9);
    expect(predictBrake(first, f)).toBeNull();
  });

  test("flying into the moon returns the parcel to sender", () => {
    const r = run(mission({ dock: { ...first.dock, captureRadius: 0.01 } }), {
      delayTicks: 0,
      aim: { angle: 13, power: 60 },
      brakeStep: null,
    });
    expect(r.end).toEqual({ kind: "crashed", into: "Minor Moon" });
  });

  test("leaving the zone loses the parcel", () => {
    const r = run(first, { delayTicks: 0, aim: { angle: 180, power: 100 }, brakeStep: null });
    expect(r.end).toEqual({ kind: "lost", reason: "bounds" });
  });

  test("fragile parcels break on debris; robust parcels ricochet", () => {
    const rock = {
      id: "rock",
      radius: 0.5,
      motion: { kind: "fixed" as const, at: { x: -4, y: -2 } },
    };
    const setup = { obstacles: [rock] };
    const aim = { angle: 0, power: 50 };
    const fragile = run(mission({ ...setup, parcel: "fragile" }), {
      delayTicks: 0,
      aim,
      brakeStep: null,
    });
    expect(fragile.end).toEqual({ kind: "crashed", into: "debris" });
    const robust = run(mission({ ...setup, parcel: "robust" }), {
      delayTicks: 0,
      aim,
      brakeStep: null,
    });
    expect(robust.flight.bounces).toBeGreaterThan(0);
    expect(robust.flight.v.x).toBeLessThan(0);
  });

  test("a second orbit is noticed exactly once", () => {
    const m = mission({ maxFlightSeconds: 30, dock: { ...first.dock, captureRadius: 0.001 } });
    const moon = { x: 1.5, y: 0 };
    const f = launch(m, 0, { angle: 0, power: 0 });
    // Place the parcel in a circular orbit around the moon.
    f.p = { x: moon.x, y: moon.y - 2.4 };
    f.v = { x: Math.sqrt(7 / 2.4), y: 0 };
    f.prevAngle = -Math.PI / 2;
    let circled = 0;
    for (let i = 0; i < 30 / DT; i++) {
      const e = step(m, f);
      if (e?.kind === "circled") circled++;
      if (isTerminal(e)) break;
    }
    expect(circled).toBe(1);
  });
});

describe("arrival rules", () => {
  const arrived = (relSpeed: number) => ({ kind: "arrived" as const, relSpeed });

  test("too fast is rejected with enthusiasm", () => {
    const o = judge(first, arrived(PARCELS.fragile.tolerance + 0.1), 40, true, 0);
    expect(o.verdict).toBe("rejected");
    expect(o.headline).toBe("Arrived with excessive enthusiasm");
    expect(o.stamps).toEqual([]);
  });

  test("robust parcels forgive what fragile ones do not", () => {
    const speed = PARCELS.fragile.tolerance + 0.5;
    const robust = mission({ parcel: "robust" });
    expect(judge(robust, arrived(speed), 40, true, 0).verdict).toBe("delivered");
  });

  test("stamps reward gentleness, thrift and no correction", () => {
    const all = judge(first, arrived(0.2), first.fuelPar, false, 0);
    expect(all.stamps).toEqual(["DELIVERED", "GENTLE", "FRUGAL", "UNCORRECTED"]);
    const some = judge(first, arrived(1.2), 100, true, 0);
    expect(some.stamps).toEqual(["DELIVERED"]);
    expect(some.fuel).toBe(125);
  });

  test("misses report the closest pass", () => {
    const o = judge(first, { kind: "lost", reason: "bounds" }, 30, false, 0.734);
    expect(o.verdict).toBe("lost");
    expect(o.detail).toContain("0.73");
  });
});

describe("missions", () => {
  test("there are eight, with both parcel behaviours", () => {
    expect(MISSIONS).toHaveLength(8);
    expect(new Set(MISSIONS.map((m) => m.parcel))).toEqual(new Set(["fragile", "robust"]));
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(8);
  });

  for (const m of MISSIONS) {
    test(`${m.id}: the reference route delivers`, () => {
      const r = run(m, m.reference);
      expect(r.end.kind).toBe("arrived");
      const o = judge(m, r.end, m.reference.aim.power, r.flight.braked, r.flight.closest.distance);
      expect(o.verdict).toBe("delivered");
    });
  }
});

describe("session", () => {
  test("aim → flight → result → retry keeps the last attempt", () => {
    const s = new Session(0);
    for (let i = 0; i < 60; i++) s.advance(DT);
    expect(s.tick).toBe(60);

    expect(s.launch()).toBe(true);
    expect(s.launch()).toBe(false);
    s.setAim({ power: 99 });
    expect(s.aim.power).not.toBe(99);
    for (let i = 0; i < 2000 && s.phase === "flight"; i++) s.advance(0.1);
    expect(s.phase).toBe("result");
    expect(s.outcome).not.toBeNull();
    expect(s.last?.launchTick).toBe(60);
    expect(s.drain()).toContain("end");
    s.reset();
    expect(s.phase).toBe("aim");
    expect(s.tick).toBe(0);
    expect(s.last?.path.length).toBeGreaterThan(2);
  });

  test("the reference route replays through the session", () => {
    const m = first;
    const s = new Session(0);
    s.setAim(m.reference.aim);
    for (let i = 0; i < m.reference.delayTicks; i++) s.advance(DT);
    expect(s.tick).toBe(m.reference.delayTicks);
    s.launch();
    while (s.phase === "flight") {
      if (s.flight?.step === m.reference.brakeStep) s.brake();
      s.advance(DT);
    }
    expect(s.outcome?.verdict).toBe("delivered");
  });

  test("a long frame never fast-forwards more than a few steps", () => {
    const s = new Session(0);
    s.advance(5);
    expect(s.tick).toBeGreaterThan(0);
    expect(s.tick).toBeLessThanOrEqual(12);
  });

  test("angles wrap and power clamps", () => {
    expect(wrapAngle(-10)).toBe(350);
    expect(wrapAngle(725)).toBe(5);
    const s = new Session(0);
    s.setAim({ power: 140 });
    expect(s.aim.power).toBe(100);
  });
});

describe("progress", () => {
  const delivered = judge(first, { kind: "arrived", relSpeed: 0.3 }, 90, true, 0);

  test("a delivery unlocks the next mission and keeps the best stamps", () => {
    const p1 = record(EMPTY_PROGRESS, "mug", 0, 8, delivered);
    expect(p1.unlocked).toBe(1);
    const cheap = judge(first, { kind: "arrived", relSpeed: 1.2 }, 10, false, 0);
    const p2 = record(p1, "mug", 0, 8, cheap);
    expect(p2.best.mug?.stamps).toEqual(["DELIVERED", "GENTLE", "FRUGAL", "UNCORRECTED"]);
    expect(totalStamps(p2)).toBe(4);
    expect(p2.finished).toBe(false);
    expect(record(p2, "complaint", 7, 8, cheap).finished).toBe(true);
  });

  test("failures change nothing", () => {
    const miss = judge(first, { kind: "lost", reason: "timeout" }, 50, false, 2);
    expect(record(EMPTY_PROGRESS, "mug", 0, 8, miss)).toBe(EMPTY_PROGRESS);
  });

  test("saved progress is parsed defensively", () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("{nope")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress('{"unlocked":"x"}')).toEqual(EMPTY_PROGRESS);
    expect(parseProgress('{"unlocked":3,"best":{},"finished":true}').unlocked).toBe(3);
  });
});
