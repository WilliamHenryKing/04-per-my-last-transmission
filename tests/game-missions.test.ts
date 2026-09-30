import { describe, expect, test } from "bun:test";
import { MISSIONS } from "../src/game/missions";
import { DT } from "../src/game/physics";
import { run } from "../src/game/predict";
import { EMPTY_PROGRESS, parseProgress, record, totalStamps } from "../src/game/progress";
import { judge, PARCELS } from "../src/game/rules";
import { Session } from "../src/game/session";
import type { Mission } from "../src/game/types";

/** The same integer aim and power increments the normal keyboard/range controls allow. */
function setControls(session: Session, mission: Mission) {
  const change = ((mission.reference.aim.angle - session.aim.angle + 540) % 360) - 180;
  for (let i = 0; i < Math.abs(change); i++)
    session.setAim({ angle: session.aim.angle + Math.sign(change) });
  const powerChange = mission.reference.aim.power - session.aim.power;
  for (let i = 0; i < Math.abs(powerChange); i++)
    session.setAim({ power: session.aim.power + Math.sign(powerChange) });
  expect(session.aim).toEqual(mission.reference.aim);
}

function deliver(session: Session, mission: Mission) {
  setControls(session, mission);
  for (let i = 0; i < mission.reference.delayTicks; i++) session.advance(DT);
  expect(session.tick).toBe(mission.reference.delayTicks);
  expect(session.launch()).toBe(true);
  expect(session.launch()).toBe(false);
  while (session.phase === "flight") {
    if (session.flight?.step === mission.reference.brakeStep) {
      expect(session.brake()).toBe(true);
      expect(session.brake()).toBe(false);
    }
    session.advance(DT);
  }
  expect(session.outcome?.verdict).toBe("delivered");
  const exact = run(mission, mission.reference);
  expect(session.flight?.p).toEqual(exact.flight.p);
  expect(session.flight?.v).toEqual(exact.flight.v);
  expect(session.last?.launchTick).toBe(mission.reference.delayTicks);
  if (mission.id === "anvil") expect(session.flight?.bounces).toBe(1);
}

describe("the full eight-mission round", () => {
  test("normal controls unlock every parcel, survive save/reload and complete a full replay", () => {
    let progress = EMPTY_PROGRESS;
    const session = new Session();
    for (let round = 0; round < 2; round++) {
      for (const [index, mission] of MISSIONS.entries()) {
        expect(index).toBeLessThanOrEqual(progress.unlocked);
        session.select(index);
        deliver(session, mission);
        const outcome = session.outcome;
        expect(outcome).not.toBeNull();
        if (!outcome) throw new Error("A completed flight must have an outcome");
        progress = record(progress, mission.id, index, MISSIONS.length, outcome);
        progress = parseProgress(JSON.stringify(progress));
        expect(progress.best[mission.id]?.stamps).toContain("DELIVERED");
        expect(progress.unlocked).toBe(
          round > 0 ? MISSIONS.length - 1 : Math.min(index + 1, MISSIONS.length - 1),
        );
        expect(progress.finished).toBe(round > 0 || index === MISSIONS.length - 1);
      }
      expect(Object.keys(progress.best)).toEqual(MISSIONS.map((mission) => mission.id));
      expect(totalStamps(progress)).toBeGreaterThanOrEqual(8);
      const loaded = new Session(progress.unlocked);
      expect(loaded.index).toBe(MISSIONS.length - 1);
      expect(loaded.phase).toBe("aim");
    }
  });

  for (const mission of MISSIONS) {
    test(`${mission.id}: normal frame timing can vary by two ticks in either direction`, () => {
      for (let delay = -2; delay <= 2; delay++) {
        for (let correction = -2; correction <= 2; correction++) {
          const route = {
            ...mission.reference,
            delayTicks: mission.reference.delayTicks + delay,
            brakeStep:
              mission.reference.brakeStep === null
                ? null
                : mission.reference.brakeStep + correction,
          };
          const result = run(mission, route);
          const outcome = judge(
            mission,
            result.end,
            route.aim.power,
            result.flight.braked,
            result.flight.closest.distance,
          );
          expect(outcome.verdict).toBe("delivered");
          expect(outcome.relSpeed).toBeLessThanOrEqual(PARCELS[mission.parcel].tolerance);
          expect(result.flight.step * DT).toBeLessThan(mission.maxFlightSeconds);
        }
      }
    });
  }
});
