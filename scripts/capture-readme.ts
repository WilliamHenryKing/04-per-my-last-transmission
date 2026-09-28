// README media from the production build: bun run build && bun scripts/capture-readme.ts
// Writes docs/readme/desktop.png, phone.png and preview.gif. Frames are stitched into the GIF
// with ffmpeg (palettegen/paletteuse); set FFMPEG to its path if it is not on PATH.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:4614";
const OUT = join(import.meta.dir, "..", "docs", "readme");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

interface Probe {
  tick: number;
  step: number;
  phase: string;
}

const DT = 1 / 120;
const probe = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as { __pmlt: Probe }).__pmlt;
    return { tick: p.tick, step: p.step, phase: p.phase };
  });

/** Unlock every mission and skip the first-time hint, as a returning player would see it. */
const RETURNING = () => {
  localStorage.setItem("pmlt.hint.v1", "seen");
  localStorage.setItem("pmlt.muted.v1", "1");
  localStorage.setItem(
    "pmlt.progress.v1",
    JSON.stringify({ unlocked: 7, best: {}, finished: false }),
  );
};

// Deterministic without a fake page clock: game time is frozen by the capture hook
// (src/visualTest.ts) and stepped exactly with advance(); animations follow the stepped time.
async function open(browser: Browser, width: number, height: number, scale: number) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
    isMobile: width < 600,
    hasTouch: width < 600,
  });
  page.setDefaultTimeout(600_000);
  await page.addInitScript(RETURNING);
  await page.goto(`${BASE}/?e2e`);
  await page.waitForFunction("window.__VISUAL_TEST__?.isReady === true", null, { polling: 500 });
  await page.evaluate("window.__VISUAL_TEST__.freeze(true)");
  return page;
}

/** Step game time by `seconds` and wait for that moment to be drawn. */
async function step(page: Page, seconds: number) {
  await page.evaluate(`window.__VISUAL_TEST__.advance(${seconds})`);
  await page.evaluate("window.__VISUAL_TEST__.settle(2)");
}

async function pickMission(page: Page, n: number) {
  await page.getByRole("button", { name: /^Missions/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${n}\\. `) }).click();
}

async function aim(page: Page, dAngle: number, dPower: number) {
  const key = (k: string, n: number) =>
    Array.from({ length: Math.abs(n) }).reduce<Promise<void>>(
      (p) => p.then(() => page.keyboard.press(k)),
      Promise.resolve(),
    );
  await key(dAngle > 0 ? "ArrowLeft" : "ArrowRight", dAngle);
  await key(dPower > 0 ? "ArrowUp" : "ArrowDown", dPower);
}

/** Step exactly to a tick (before launch) or a flight step (after). */
async function stepTo(page: Page, field: "tick" | "step", target: number) {
  const now = (await probe(page))[field];
  if (target > now) await step(page, (target - now) * DT);
}

async function screenshots(browser: Browser) {
  // Desktop: the finale mid-aim, guide bending between two wells.
  const desk = await open(browser, 1440, 900, 1);
  await pickMission(desk, 8);
  await aim(desk, -3, 5);
  await step(desk, 1.2);
  await desk.screenshot({ path: join(OUT, "desktop.png") });
  await desk.close();

  // Phone: mission 1 in flight, with the brass brake ghost showing.
  const phone = await open(browser, 390, 844, 2);
  await pickMission(phone, 1);
  await aim(phone, -15, -20);
  await stepTo(phone, "tick", 106);
  await phone.keyboard.press("Space");
  await stepTo(phone, "step", 200);
  await phone.screenshot({ path: join(OUT, "phone.png") });
  await phone.close();
}

async function gifFrames(browser: Browser, dir: string) {
  const page = await open(browser, 800, 500, 1);
  await pickMission(page, 1);
  let n = 0;
  const frame = async (seconds = 1 / 30) => {
    if (n > 400) throw new Error("capture ran long: the scripted route did not land");
    await step(page, seconds);
    await page.screenshot({ path: join(dir, `f${String(n++).padStart(4, "0")}.png`) });
  };
  // A beat on the default aim, then sweep the cannon onto the route while the dock comes round.
  for (let i = 0; i < 8; i++) await frame();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("ArrowRight");
    if (i % 3 === 0) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await frame();
  }
  while ((await probe(page)).tick < 102) await frame();
  await stepTo(page, "tick", 106);
  await page.keyboard.press("Space");
  if ((await probe(page)).phase !== "flight") throw new Error("launch did not register");
  while ((await probe(page)).step < 294) await frame();
  await stepTo(page, "step", 298);
  await page.keyboard.press("b");
  while ((await probe(page)).phase !== "result") await frame();
  for (let i = 0; i < 75; i++) await frame();
  await page.close();
  return n;
}

const server = spawn("bunx", ["vite", "preview"], { stdio: "ignore" });
try {
  for (let i = 0; i < 50; i++) {
    const ok = await fetch(BASE).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) break;
    await Bun.sleep(200);
  }
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: GL_ARGS });
  await screenshots(browser);
  const dir = mkdtempSync(join(tmpdir(), "pmlt-gif-"));
  const frames = await gifFrames(browser, dir);
  await browser.close();
  const gif = join(OUT, "preview.gif");
  const filter =
    "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle";
  const res = spawnSync(
    FFMPEG,
    ["-v", "error", "-y", "-framerate", "30", "-i", join(dir, "f%04d.png"), "-vf", filter, gif],
    { stdio: "inherit" },
  );
  rmSync(dir, { recursive: true, force: true });
  if (res.status !== 0) throw new Error("ffmpeg failed; set FFMPEG to an ffmpeg binary");
  console.log(`${frames} frames → preview.gif ${(statSync(gif).size / 1e6).toFixed(2)} MB`);
} finally {
  server.kill();
}
