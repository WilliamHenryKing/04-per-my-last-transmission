// Visual evidence: bun run build && bun scripts/capture-visual.ts <baseline|after>
// Renders the camera bookmarks from src/scene/bookmarks.ts on headless Chromium with
// SwiftShader into docs/visual/captures/<label>/, logging the WebGL renderer string.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";

const label = process.argv[2] ?? "baseline";
const BASE = "http://127.0.0.1:4614";
const OUT = join(import.meta.dir, "..", "docs", "visual", "captures", label);
const GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-gl=angle"];
const DESKTOP_SHOTS = ["wide", "hero", "closeup", "grazing"] as const;

type Api = {
  isReady: boolean;
  freeze(on?: boolean): void;
  setBookmark(name: string | null): void;
  settle(frames?: number): Promise<void>;
};
const api = "window.__VISUAL_TEST__";

async function run(page: Page, frames: number) {
  const settled = page.evaluate(
    (n) => (window as unknown as { __VISUAL_TEST__: Api }).__VISUAL_TEST__.settle(n),
    frames,
  );
  for (let i = 0; i < frames * 3; i++) await page.clock.runFor(16);
  await settled;
}

async function open(browser: Browser, width: number, height: number, scale: number) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  page.setDefaultTimeout(300_000);
  await page.addInitScript(() => {
    localStorage.setItem("pmlt.hint.v1", "seen");
    localStorage.setItem("pmlt.muted.v1", "1");
  });
  await page.clock.install();
  await page.goto(`${BASE}/?e2e`);
  await page.locator("#arrival").waitFor({ state: "detached", timeout: 60_000 });
  await page.clock.pauseAt(Date.now() + 60_000);
  for (let i = 0; i < 600; i++) {
    if (await page.evaluate(`${api}.isReady`)) break;
    await page.clock.runFor(50);
    await page.waitForTimeout(20);
  }
  // Restart mission 1 so the world clock (and every orbit) is at t = 0, then freeze.
  await page.keyboard.press("l");
  await page.getByRole("button", { name: /^1\. / }).click();
  await page.evaluate(`${api}.freeze(true)`);
  return page;
}

async function shoot(page: Page, name: string, file = name) {
  await page.evaluate(`${api}.setBookmark(${JSON.stringify(name)})`);
  await run(page, 4);
  // SwiftShader renders the full post chain on the CPU: frames can take many seconds.
  await page.screenshot({ path: join(OUT, `${file}.png`), timeout: 300_000 });
}

const server = spawn("bunx", ["vite", "preview"], { stdio: "ignore" });
try {
  for (let i = 0; i < 50; i++) {
    if (
      await fetch(BASE).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    await Bun.sleep(200);
  }
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: GL_ARGS });
  const desk = await open(browser, 1440, 900, 1);
  const renderer = await desk.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });
  console.log(`renderer: ${renderer}`);
  for (const shot of DESKTOP_SHOTS) await shoot(desk, shot);
  // The hero again in flight: parcel, wake and brake preview (not a bookmark of its own).
  await desk.evaluate(`${api}.freeze(false)`);
  await desk.keyboard.press("Space");
  for (let i = 0; i < 80; i++) await desk.clock.runFor(16);
  await desk.evaluate(`${api}.freeze(true)`);
  await shoot(desk, "hero", "hero-flight");
  await desk.close();
  const phone = await open(browser, 390, 844, 2);
  await shoot(phone, "phone-hero");
  await phone.close();
  await browser.close();
  writeFileSync(
    join(OUT, "capture-info.json"),
    `${JSON.stringify({ label, renderer, date: new Date().toISOString(), args: GL_ARGS }, null, 2)}\n`,
  );
  console.log(`captures → docs/visual/captures/${label}/`);
} finally {
  server.kill();
}
