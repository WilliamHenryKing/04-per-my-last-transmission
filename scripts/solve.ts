// Offline route finder for authoring missions: bun scripts/solve.ts [missionId]
// Grid-searches launch delay, angle, power and one brake moment with the real rules,
// reports how forgiving each mission is and prints a reference solution.
import { MISSIONS } from "../src/game/missions";
import { brake, cloneFlight, DT, isTerminal, launch, positionOf, step } from "../src/game/physics";
import { run } from "../src/game/predict";
import { judge } from "../src/game/rules";
import type { Mission, Solution } from "../src/game/types";

const DELAY_STEP = 30;
const DELAY_MAX = Number(process.env.DELAY_MAX ?? 900);
const BRAKE_STRIDE = 6;

interface Found {
  s: Solution;
  rel: number;
  fuel: number;
}

function bodyOf(m: Mission, id: string) {
  const b = m.bodies.find((x) => x.id === id);
  if (!b) throw new Error(id);
  return b.motion;
}

function solve(m: Mission) {
  const found: Found[] = [];
  let tried = 0;
  for (let delay = 0; delay <= DELAY_MAX; delay += DELAY_STEP) {
    const target =
      m.dock.motion.kind === "orbit" && m.dock.motion.around
        ? positionOf(m, bodyOf(m, m.dock.motion.around), 0)
        : { x: 0, y: 0 };
    const centre = Math.round(
      (Math.atan2(target.y - m.depot.y, target.x - m.depot.x) * 180) / Math.PI,
    );
    for (let angle = centre - 70; angle <= centre + 70; angle += 2) {
      for (let power = 5; power <= 100; power += 5) {
        tried++;
        const aim = { angle, power };
        const base = launch(m, delay, aim);
        const f = cloneFlight(base);
        const snapshots = [cloneFlight(f)];
        let end = null;
        while (!end) {
          const e = step(m, f);
          if (isTerminal(e)) end = e;
          else if (f.step % BRAKE_STRIDE === 0) snapshots.push(cloneFlight(f));
        }
        if (f.closest.distance > 1.6) continue;
        const consider = (s: Solution, e: typeof end, braked: boolean, closest: number) => {
          const o = judge(m, e, power, braked, closest);
          if (o.verdict === "delivered" && o.relSpeed !== null) {
            found.push({ s, rel: o.relSpeed, fuel: o.fuel });
          }
        };
        consider({ delayTicks: delay, aim, brakeStep: null }, end, false, f.closest.distance);
        for (const snap of snapshots) {
          const g = cloneFlight(snap);
          const brakeStep = g.step;
          brake(g);
          let e2 = null;
          while (!e2) {
            const e = step(m, g);
            if (isTerminal(e)) e2 = e;
          }
          consider({ delayTicks: delay, aim, brakeStep }, e2, true, g.closest.distance);
        }
      }
    }
  }
  const launches = new Set(found.map((x) => `${x.s.delayTicks}/${x.s.aim.angle}/${x.s.aim.power}`));
  const unbraked = found.filter((x) => x.s.brakeStep === null);
  found.sort((a, b) => a.fuel - b.fuel || a.rel - b.rel);
  const gentlest = [...found].sort((a, b) => a.rel - b.rel)[0];
  console.log(
    `\n== ${m.id}: ${launches.size}/${tried} launches can deliver (${unbraked.length} without brake)`,
  );
  console.log("cheapest", JSON.stringify(found[0]));
  console.log("gentlest", JSON.stringify(gentlest));
  console.log("cheapest unbraked", JSON.stringify(unbraked.sort((a, b) => a.fuel - b.fuel)[0]));
  const sample = found[Math.floor(found.length / 2)];
  if (sample) {
    const r = run(m, sample.s);
    console.log(
      "median sample",
      JSON.stringify(sample),
      r.end,
      `flight ${(r.flight.step * DT).toFixed(2)}s`,
    );
  }
}

const only = process.argv[2];
for (const m of MISSIONS) if (!only || m.id === only) solve(m);
