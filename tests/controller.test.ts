import { afterEach, beforeEach, expect, test } from "bun:test";
import { DT } from "../src/game/physics";
import { Controller, type Sound } from "../src/ui/controller";

const originalWindow = globalThis.window;
const sounds: string[] = [];
const sound: Sound = {
  muted: true,
  play: (id) => {
    sounds.push(id);
  },
  setMuted() {},
};
beforeEach(() => {
  const storage = new Map<string, string>();
  Object.assign(globalThis, {
    window: {
      location: { search: "?e2e" },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  sounds.length = 0;
});
afterEach(() => Object.assign(globalThis, { window: originalWindow }));

function delivered(game: Controller) {
  const s = game.session;
  const route = s.mission.reference;
  s.setAim(route.aim);
  for (let i = 0; i < route.delayTicks; i++) s.advance(DT);
  s.launch();
  while (s.phase === "flight") {
    if (s.flight?.step === route.brakeStep) s.brake();
    s.advance(DT);
  }
  expect(s.outcome?.verdict).toBe("delivered");
}

test("a manifest blocks aim, brake, retry and guide changes until it closes", () => {
  const game = new Controller(sound);
  game.openMissions();
  const before = { ...game.session.aim };
  game.nudgeAim(30, 20);
  game.launch();
  game.replayGuide();
  expect(game.session.aim).toEqual(before);
  expect(game.session.phase).toBe("aim");
  game.closePanel();
  game.launch();
  game.openMissions();
  game.brake();
  game.retry();
  expect(game.session.phase).toBe("flight");
  expect(game.session.flight?.braked).toBe(false);
});

test("opening gates all play actions; switching reduced motion ends a live glide", () => {
  window.location.search = "?e2e&intro";
  const game = new Controller(sound);
  game.openMissions();
  game.select(0);
  game.nudgeAim(20, 20);
  game.launch();
  expect(game.view).toBe("play");
  expect(game.session.phase).toBe("aim");
  expect(sounds).toEqual([]);
  game.begin(false);
  expect(game.opening).toBe("glide");
  game.setReducedMotion(true);
  expect(game.opening).toBe("done");
  game.launch();
  expect(game.session.phase).toBe("flight");
});

test("invalid and locked mission indices leave the current game intact", () => {
  const game = new Controller(sound);
  game.openMissions();
  for (const index of [-1, 0.5, 1, 8, Number.NaN, Number.POSITIVE_INFINITY]) game.select(index);
  expect(game.view).toBe("missions");
  expect(game.session.index).toBe(0);
});

test("next records the delivered parcel even before its end cue is drained", () => {
  const game = new Controller(sound);
  delivered(game);
  game.next();
  game.next();
  expect(game.session.index).toBe(1);
  expect(game.progress.unlocked).toBe(1);
  expect(game.progress.best.mug?.stamps).toContain("DELIVERED");
  game.frame(0, game.session.drain());
  expect(Object.keys(game.progress.best)).toEqual(["mug"]);
});

test("retry publishes its reset immediately and replay guide reflects a spent brake", () => {
  const game = new Controller(sound);
  game.launch();
  game.brake();
  game.replayGuide();
  expect(game.guideStep).toBe(3);
  const version = game.version;
  game.retry();
  expect(game.version).toBeGreaterThan(version);
  expect(game.session.phase).toBe("aim");
  expect(game.guideStep).toBe(0);
});

test("retry can restart the moving address clock before the first launch", () => {
  const game = new Controller(sound);
  game.session.advance(0.1);
  expect(game.session.tick).toBeGreaterThan(0);
  game.retry();
  expect(game.session.tick).toBe(0);
  expect(game.session.attempts).toBe(0);
  expect(game.session.last).toBeNull();
});

test("eight normal deliveries reach the ending once and replay preserves earned stamps", () => {
  const game = new Controller(sound);
  for (let i = 0; i < 8; i++) {
    delivered(game);
    game.next();
  }
  expect(game.view).toBe("ending");
  expect(game.progress.finished).toBe(true);
  expect(Object.keys(game.progress.best)).toHaveLength(8);
  const endings = sounds.filter((id) => id === "ending").length;
  game.next();
  expect(sounds.filter((id) => id === "ending")).toHaveLength(endings);
  game.select(0);
  expect(game.view).toBe("play");
  expect(game.session.index).toBe(0);
  expect(Object.keys(game.progress.best)).toHaveLength(8);
});
