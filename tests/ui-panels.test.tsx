import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MISSIONS } from "../src/game/missions";
import { EMPTY_PROGRESS } from "../src/game/progress";
import { judge } from "../src/game/rules";
import { Session } from "../src/game/session";
import { Controls } from "../src/ui/Controls";
import type { Controller } from "../src/ui/controller";
import { Ending } from "../src/ui/Ending";
import { cycleDialogFocus } from "../src/ui/focus";
import { Hint } from "../src/ui/Hint";
import { MissionList } from "../src/ui/MissionList";
import { ResultCard } from "../src/ui/ResultCard";

function fixture() {
  return {
    session: new Session(),
    progress: { ...EMPTY_PROGRESS, best: {} },
    muted: true,
  } as unknown as Controller;
}

test("Tab remains inside a dialog and Shift-Tab from its reading surface goes to the last action", () => {
  const focused: number[] = [];
  let prevented = 0;
  const actions = Array.from(
    { length: 3 },
    (_, index) =>
      ({
        focus: () => focused.push(index),
      }) as unknown as HTMLElement,
  );
  const event = (target: EventTarget | null, shiftKey = false, key = "Tab") => ({
    key,
    target,
    shiftKey,
    preventDefault: () => {
      prevented++;
    },
  });
  cycleDialogFocus(event(null), actions);
  cycleDialogFocus(event(actions[2] ?? null), actions);
  cycleDialogFocus(event(actions[0] ?? null, true), actions);
  cycleDialogFocus(event(null, true), actions);
  expect(focused).toEqual([0, 0, 2, 2]);
  expect(prevented).toBe(4);
  cycleDialogFocus(event(null, false, "ArrowDown"), actions);
  cycleDialogFocus(event(null), []);
  expect(prevented).toBe(4);
});

test("fresh aiming exposes a clock-reset Retry and matching canonical angle readouts", () => {
  const game = fixture();
  game.session.setAim({ angle: 359.8, power: 43 });
  const html = renderToStaticMarkup(<Controls game={game} />);
  expect(html).toContain('aria-label="Launch angle in degrees" aria-valuetext="0 degrees"');
  expect(html).toContain('aria-label="Launch power in percent" aria-valuetext="43 percent"');
  const retry = html.match(/<button[^>]+aria-label="Retry mission \(R\)"[^>]*>/)?.[0];
  expect(retry).toBeDefined();
  expect(retry).not.toContain("disabled");
});

test("the one-use brake remains discoverable but is disabled after use", () => {
  const game = fixture();
  game.session.launch();
  let html = renderToStaticMarkup(<Controls game={game} />);
  expect(html).toContain('aria-label="Brake, one use (B)"');
  game.session.brake();
  html = renderToStaticMarkup(<Controls game={game} />);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Brake already used"/);
});

test("failed and delivered results preserve their primary action and readable description", () => {
  const game = fixture();
  const s = game.session;
  s.phase = "result";
  s.outcome = judge(s.mission, { kind: "lost", reason: "bounds" }, 30, false, 2);
  let html = renderToStaticMarkup(<ResultCard game={game} reducedMotion />);
  expect(html).toContain('aria-describedby="result-detail result-meta" tabindex="0"');
  expect(html).toMatch(/<button[^>]*data-result-primary="true"[^>]*>Retry/);
  expect(html).not.toContain("Next parcel");
  s.outcome = judge(s.mission, { kind: "arrived", relSpeed: 0.1 }, 30, false, 0);
  html = renderToStaticMarkup(<ResultCard game={game} reducedMotion />);
  expect(html).toMatch(/<button[^>]*data-result-primary="true"[^>]*>Next parcel/);
  expect(html).toContain('aria-label="Stamps earned"');
});

test("manifest and ending provide named reading surfaces, sound and dismissal within each modal", () => {
  const game = fixture();
  const manifest = renderToStaticMarkup(<MissionList game={game} onPlayFocus={() => {}} />);
  expect(manifest).toContain('aria-modal="true" aria-labelledby="missions-title"');
  expect(manifest).toContain('aria-describedby="manifest-key" tabindex="-1"');
  expect(manifest).toContain('aria-label="Sound off. Turn sound on (M)"');
  expect(manifest).toMatch(/<button[^>]*disabled=""[^>]*aria-label="2. Locked/);
  const ending = renderToStaticMarkup(<Ending game={game} reducedMotion onPlayFocus={() => {}} />);
  expect(ending).toContain('aria-modal="true" aria-labelledby="ending-title"');
  expect(ending).toContain('aria-describedby="ending-copy" tabindex="-1"');
  expect(ending).toContain('aria-label="Sound off. Turn sound on (M)"');
  expect(ending).toContain("Close report");
  for (const mission of MISSIONS) expect(ending).toContain(mission.title);
});

test("each guide step offers a named keyboard scrolling stop and a touch-sized dismiss action", () => {
  for (let step = 0; step < 4; step++) {
    const html = renderToStaticMarkup(<Hint step={step} onDismiss={() => {}} />);
    expect(html).toContain('aria-label="How to deliver" aria-live="polite" tabindex="0"');
    expect(html).toContain(`${step + 1}/4`);
    expect(html).toContain("min-h-11");
  }
});
