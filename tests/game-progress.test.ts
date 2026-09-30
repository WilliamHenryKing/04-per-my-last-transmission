import { describe, expect, test } from "bun:test";
import { MISSIONS } from "../src/game/missions";
import {
  type Best,
  EMPTY_PROGRESS,
  parseProgress,
  record,
  totalStamps,
} from "../src/game/progress";
import { judge } from "../src/game/rules";

const first = MISSIONS[0];
if (!first) throw new Error("The opening mission must exist");
const best: Best = { stamps: ["DELIVERED", "GENTLE"], fuel: 30, relSpeed: 0.4 };

describe("saved mission progress", () => {
  test("keeps valid legacy stamps and clamps the manifest to authored missions", () => {
    const progress = parseProgress(
      JSON.stringify({
        unlocked: 999,
        best: { mug: { ...best, stamps: [...best.stamps, "UNCORRECTED", "DELIVERED"] } },
        finished: true,
      }),
    );
    expect(progress.unlocked).toBe(MISSIONS.length - 1);
    expect(progress.best.mug).toEqual(best);
    expect(progress.finished).toBe(true);
  });

  test("unknown saved missions do not inflate the ending's stamp count", () => {
    const progress = parseProgress(
      JSON.stringify({ unlocked: 1, best: { mug: best, retired: best } }),
    );
    expect(Object.keys(progress.best)).toEqual(["mug"]);
    expect(totalStamps(progress)).toBe(2);
  });

  for (const broken of [
    { fuel: undefined },
    { fuel: "thirty" },
    { fuel: -1 },
    { fuel: null },
    { relSpeed: undefined },
    { relSpeed: "slow" },
    { relSpeed: -1 },
    { relSpeed: null },
    { stamps: ["GENTLE", "FRUGAL"] },
  ]) {
    test(`discards malformed best metrics: ${JSON.stringify(broken)}`, () => {
      const progress = parseProgress(
        JSON.stringify({ unlocked: 1, best: { mug: { ...best, ...broken } } }),
      );
      expect(progress.unlocked).toBe(1);
      expect(progress.best.mug).toBeUndefined();
      const outcome = judge(first, { kind: "arrived", relSpeed: 0.3 }, 20, false, 0);
      const repaired = record(progress, first.id, 0, MISSIONS.length, outcome);
      expect(repaired.best.mug?.fuel).toBe(20);
      expect(repaired.best.mug?.relSpeed).toBe(0.3);
      expect(repaired.best.mug?.stamps).toEqual(["DELIVERED", "GENTLE", "FRUGAL"]);
    });
  }

  test("nonfinite JSON numbers cannot enter the manifest or best metrics", () => {
    expect(parseProgress('{"unlocked":1e309,"best":{}}')).toEqual(EMPTY_PROGRESS);
    for (const metric of ["fuel", "relSpeed"]) {
      const raw = JSON.stringify({ unlocked: 1, best: { mug: best } }).replace(
        `"${metric}":${best[metric as "fuel" | "relSpeed"]}`,
        `"${metric}":1e309`,
      );
      expect(parseProgress(raw).best.mug).toBeUndefined();
    }
  });

  test("a best-score array and a truthy completion string are not saved records", () => {
    expect(parseProgress('{"unlocked":2,"best":[]}')).toEqual(EMPTY_PROGRESS);
    expect(
      parseProgress(JSON.stringify({ unlocked: 2, best: {}, finished: "false" })).finished,
    ).toBe(false);
  });

  test("saved object keys cannot become inherited best scores", () => {
    const progress = parseProgress(
      '{"unlocked":1,"best":{"__proto__":{"stamps":["DELIVERED"],"fuel":0,"relSpeed":0}}}',
    );
    expect(Object.getPrototypeOf(progress.best)).toBe(Object.prototype);
    expect(Object.keys(progress.best)).toEqual([]);
    expect(totalStamps(progress)).toBe(0);
  });
});
