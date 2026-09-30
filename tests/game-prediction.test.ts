import { describe, expect, test } from "bun:test";
import { MISSIONS } from "../src/game/missions";
import { brake, cloneFlight, DT, isTerminal, launch, step, velocityOf } from "../src/game/physics";
import { predictBrake, predictFrom } from "../src/game/predict";

describe("live flight prediction", () => {
  for (const offset of [1, 2]) {
    test(`the off-stride course ends at its actual horizon from step ${offset}`, () => {
      const mission = MISSIONS[0];
      if (!mission) throw new Error("The opening mission must exist");
      const flight = launch(mission, 60, { angle: 0, power: 50 });
      for (let i = 0; i < offset; i++) step(mission, flight);
      const original = cloneFlight(flight);
      const predicted = predictFrom(mission, flight, 9 * DT);
      const actual = cloneFlight(flight);
      for (let i = 0; i < 9; i++) step(mission, actual);
      expect(predicted.end).toBeNull();
      expect(predicted.points.at(-1)).toEqual(actual.p);
      expect(flight).toEqual(original);
    });
  }

  test("the brake ghost reaches its horizon without using the player's brake", () => {
    const mission = MISSIONS[0];
    if (!mission) throw new Error("The opening mission must exist");
    const flight = launch(mission, 60, { angle: 0, power: 50 });
    step(mission, flight);
    const original = cloneFlight(flight);
    const ghost = predictBrake(mission, flight);
    const actual = cloneFlight(flight);
    brake(actual);
    for (let i = 0; i < Math.round(mission.guideSeconds / DT); i++) {
      if (isTerminal(step(mission, actual))) break;
    }
    expect(ghost?.points.at(-1)).toEqual(actual.p);
    expect(flight).toEqual(original);
    expect(flight.braked).toBe(false);
  });

  test("nested dock velocity includes both of its independently moving orbits", () => {
    const mission = MISSIONS.find((m) => m.id === "cake");
    if (!mission) throw new Error("The nested-orbit mission must exist");
    for (const time of [0, 2.25, 7.8, 31]) {
      const moonAngle = -2.3 + 0.2 * time;
      const dockAngle = 0.6 * time;
      const expected = {
        x: -4 * 0.2 * Math.sin(moonAngle) - 1.2 * 0.6 * Math.sin(dockAngle),
        y: 4 * 0.2 * Math.cos(moonAngle) + 1.2 * 0.6 * Math.cos(dockAngle),
      };
      const actual = velocityOf(mission, mission.dock.motion, time);
      expect(Math.abs(actual.x - expected.x)).toBeLessThan(1e-7);
      expect(Math.abs(actual.y - expected.y)).toBeLessThan(1e-7);
    }
  });
});
