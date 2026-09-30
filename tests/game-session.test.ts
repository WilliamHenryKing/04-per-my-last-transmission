import { describe, expect, test } from "bun:test";
import { MISSIONS } from "../src/game/missions";
import { DT } from "../src/game/physics";
import { Session } from "../src/game/session";

function deliverFirst(session: Session) {
  const mission = MISSIONS[0];
  if (!mission) throw new Error("The opening mission must exist");
  const route = mission.reference;
  session.setAim(route.aim);
  for (let i = 0; i < route.delayTicks; i++) session.advance(DT);
  session.launch();
  while (session.phase === "flight") {
    if (session.flight?.step === route.brakeStep) session.brake();
    session.advance(DT);
  }
  expect(session.outcome?.verdict).toBe("delivered");
}

describe("flight recovery", () => {
  test("retry removes pending launch and brake cues from the aborted flight", () => {
    const session = new Session();
    session.launch();
    session.advance(DT);
    session.brake();
    session.reset();
    expect(session.drain()).toEqual([]);
    expect(session.phase).toBe("aim");
    expect(session.tick).toBe(0);
    expect(session.flight).toBeNull();
    session.launch();
    expect(session.drain()).toEqual(["launch"]);
  });

  test("changing missions discards pending outcome cues and the previous attempt", () => {
    const session = new Session();
    deliverFirst(session);
    session.select(1);
    expect(session.drain()).toEqual([]);
    expect(session.mission.id).toBe("paperwork");
    expect(session.phase).toBe("aim");
    expect(session.last).toBeNull();
    expect(session.outcome).toBeNull();
    expect(session.attempts).toBe(0);
  });

  test("retry retains an immutable learning path and reproduces the same route", () => {
    const session = new Session();
    deliverFirst(session);
    const previous = session.last;
    const saved = structuredClone(previous);
    session.reset();
    expect(session.last).toBe(previous);
    expect(session.drain()).toEqual([]);
    deliverFirst(session);
    expect(session.last).toEqual(saved);
    expect(previous).toEqual(saved);
    expect(session.attempts).toBe(2);
  });
});
