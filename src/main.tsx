import { createRoot } from "react-dom/client";
import { AudioEngine } from "./audio/engine";
import { hitsForCue } from "./audio/sounds";
import { predictBrake, predictFrom, predictLaunch } from "./game/predict";
import { worldReady } from "./loader";
import { createStage } from "./scene/stage";
import { World } from "./scene/world";
import { App } from "./ui/App";
import { Controller } from "./ui/controller";
import "./ui/styles.css";

// Wiring: one controller (rules + UI state), one three.js world, one frame loop.

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const audio = new AudioEngine();
const game = new Controller(audio);
const session = game.session;

const canvas = document.createElement("canvas");
canvas.className = "stage";
canvas.setAttribute("role", "img");
canvas.setAttribute(
  "aria-label",
  "Orbital chart: the depot, planets, the moving receiving dock and the predicted route",
);
document.body.prepend(canvas);

const stage = createStage(canvas);
const world = new World(stage);
let missionShown = "";

function aimFromPointer(e: PointerEvent) {
  const p = stage.toGround(e.clientX, e.clientY);
  if (!p) return;
  const d = session.mission.depot;
  const dx = p.x - d.x;
  const dy = p.y - d.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.3) return;
  // Direction from the depot; distance sets power (5 units of drag = full power).
  game.setAim({
    angle: Math.round((Math.atan2(dy, dx) * 180) / Math.PI),
    power: Math.round(Math.min(100, (dist / 5) * 100)),
  });
}

canvas.addEventListener("pointerdown", (e) => {
  if (session.phase !== "aim" || game.view !== "play") return;
  canvas.setPointerCapture(e.pointerId);
  aimFromPointer(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (canvas.hasPointerCapture(e.pointerId)) aimFromPointer(e);
});
canvas.addEventListener("pointerup", (e) => {
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});

// Browsers only allow sound after a gesture: the first press anywhere wakes the audio.
for (const type of ["pointerdown", "keydown"] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
}

window.addEventListener("resize", () => stage.resize());
stage.resize();

let prev = performance.now();
let first = true;

function frame(now: number) {
  // Clamp: a backwards timestamp must never rewind the world, a stall never leaps it.
  const dt = Math.max(0, Math.min(0.1, (now - prev) / 1000));
  prev = now;
  if (missionShown !== session.mission.id) {
    missionShown = session.mission.id;
    world.setMission(session.mission);
  }
  if (game.view === "play") session.advance(dt);
  const cues = session.drain();
  for (const cue of cues) world.react(cue, session, motionQuery.matches);
  if (cues.includes("end")) {
    const v = session.outcome?.verdict;
    if (v === "crashed" || v === "rejected") world.shatter(motionQuery.matches);
  }
  game.frame(dt, cues);
  for (const cue of cues) {
    for (const hit of hitsForCue(cue, session.outcome?.verdict ?? null)) {
      audio.play(hit.id, hit.delay, hit.rate);
    }
  }
  // Panels pause the game, so the beds and hum pause with it.
  audio.setMood(
    game.view === "missions" ? "paused" : game.view === "ending" ? "result" : session.phase,
  );
  if (session.flight) audio.setSpeed(Math.hypot(session.flight.v.x, session.flight.v.y));

  const m = session.mission;
  const f = session.flight;
  world.update({
    session,
    dt,
    reducedMotion: motionQuery.matches,
    guide: session.phase === "aim" ? predictLaunch(m, session.tick, session.aim) : null,
    course: session.phase === "flight" && f ? predictFrom(m, f, m.guideSeconds) : null,
    brakeGhost: session.phase === "flight" && f ? predictBrake(m, f) : null,
  });
  stage.render();
  if (first) {
    first = false;
    requestAnimationFrame(() => worldReady());
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only probe for the end-to-end test (only with ?e2e): frames can't hit exact ticks,
// so the test reads the clock to time its key presses.
if (new URLSearchParams(window.location.search).has("e2e")) {
  Object.assign(window, {
    __pmlt: {
      get tick() {
        return session.tick;
      },
      get step() {
        return session.flight?.step ?? 0;
      },
      get phase() {
        return session.phase;
      },
    },
  });
}

const root = document.getElementById("root");
if (root) {
  const app = createRoot(root);
  const render = () => app.render(<App game={game} reducedMotion={motionQuery.matches} />);
  motionQuery.addEventListener("change", render);
  render();
}
