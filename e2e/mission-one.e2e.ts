import { expect, type Locator, type Page, test } from "@playwright/test";
import { MISSIONS } from "../src/game/missions";

interface Probe {
  tick: number;
  step: number;
  phase: string;
}
const probe = (page: Page) => page.evaluate(() => (window as unknown as { __pmlt: Probe }).__pmlt);
async function stepUntil(page: Page, done: (p: Probe) => boolean, ms = 16) {
  for (let i = 0; i < 1500; i++) {
    const p = await probe(page);
    if (done(p)) return p;
    await page.clock.runFor(ms);
  }
  throw new Error("condition never met");
}
function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}
async function range(input: Locator, value: number, max: number) {
  const upper = value > max / 2;
  await input.press(upper ? "End" : "Home");
  for (let i = 0; i < (upper ? max - value : value); i++)
    await input.press(upper ? "ArrowLeft" : "ArrowRight");
  await expect(input).toHaveValue(String(value));
}
async function resumeFromManifest(page: Page, index: number) {
  await page.getByRole("button", { name: /^Missions/ }).click();
  const manifest = page.getByRole("dialog", { name: "Delivery manifest" });
  await expect(manifest).toBeFocused();
  await expect(page.locator(".play-hud")).toHaveAttribute("inert", "");
  await expect(page.locator("canvas.stage")).toHaveAttribute("inert", "");
  await page.keyboard.press("Tab");
  await expect(manifest.getByRole("button", { name: /^Close/ })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(manifest.getByRole("button", { name: /^Sound/ })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(manifest.getByRole("button", { name: /^1\. A Mug/ })).toBeFocused();
  await manifest
    .getByRole("button", {
      name: new RegExp(
        `^${index + 1}\\. ${MISSIONS[index]?.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      ),
    })
    .click();
  expect((await probe(page)).tick).toBe(0);
}

test("all eight deliveries, paused manifest, guarded controls, ending and replay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = watch(page);
  await page.clock.install();
  await page.goto("/?e2e&quality=low");
  await expect(page.locator("#arrival")).toHaveCount(0, { timeout: 30_000 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.getByRole("button", { name: "Skip the guide" }).click();
  await resumeFromManifest(page, 0);
  // Let the installed clock's first queued animation frame catch up after pausing.
  await stepUntil(page, (p) => p.tick > 0, 96);
  expect((await probe(page)).tick).toBeGreaterThan(0);
  await page.keyboard.press("r");
  expect((await probe(page)).tick).toBe(0);

  for (const [index, mission] of MISSIONS.entries()) {
    const route = mission.reference;
    await range(page.getByLabel("Launch angle in degrees"), route.aim.angle, 359);
    await range(page.getByLabel("Launch power in percent"), route.aim.power, 100);
    await stepUntil(page, (p) => p.tick >= route.delayTicks - 15, 96);
    await stepUntil(page, (p) => p.tick >= route.delayTicks);
    await page.getByRole("button", { name: "Launch parcel (Space)", exact: true }).click();
    expect((await probe(page)).phase).toBe("flight");
    if (index === 0) {
      await page.getByRole("button", { name: /^Missions/ }).click();
      const before = await probe(page);
      await page.clock.runFor(500);
      await page.keyboard.press("b");
      expect(await probe(page)).toEqual(before);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: /^Missions/ })).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Brake, one use (B)", exact: true }),
      ).toBeEnabled();
    }
    if (route.brakeStep !== null) {
      await stepUntil(page, (p) => p.step >= (route.brakeStep ?? 0) - 15, 96);
      await stepUntil(page, (p) => p.step >= (route.brakeStep ?? 0));
      await page.keyboard.press("b");
      await expect(page.getByRole("button", { name: "Brake already used" })).toBeVisible();
    }
    await stepUntil(page, (p) => p.phase === "result", 96);
    const result = page.getByRole("dialog", { name: "Delivered" });
    await expect(result).toBeVisible();
    await expect(result.getByRole("list", { name: "Stamps earned" })).toContainText("DELIVERED");
    await page.clock.runFor(1500);
    await page.screenshot({ path: `test-results/delivery-${index + 1}.png` });
    const next = result.getByRole("button", {
      name: index === 7 ? /File report/ : /Next parcel/,
    });
    await next.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await page.clock.runFor(16);
    if (index < 7) expect((await probe(page)).phase).toBe("aim");
  }
  const ending = page.getByRole("dialog", { name: "Per my last transmission" });
  await expect(ending).toBeVisible();
  await expect(ending).toContainText("All eight parcels have been delivered");
  await page.clock.runFor(1200);
  await page.screenshot({ path: "test-results/ending.png" });
  await ending.getByRole("button", { name: "Start the round again" }).click();
  await expect(page.getByLabel("Launch angle in degrees")).toBeEnabled();
  await page.getByRole("button", { name: "Replay the guide" }).click();
  await expect(page.getByLabel("How to deliver", { exact: true })).toContainText("1/4");
  await page.getByRole("button", { name: "Skip the guide" }).click();
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [390, 844],
  [568, 320],
] as const) {
  test(`touch controls and panels at ${width}×${height}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = watch(page);
    try {
      await page.goto("http://127.0.0.1:4614/?e2e&intro&quality=low");
      await expect(page.locator("#arrival")).toHaveCount(0, { timeout: 30_000 });
      await page.screenshot({ path: `test-results/title-${width}.png` });
      await page.getByRole("button", { name: "Report for duty" }).tap();
      const guide = page.getByLabel("How to deliver", { exact: true });
      await expect(guide).toBeVisible();
      await guide.focus();
      await page.keyboard.press("Space");
      expect((await probe(page)).phase).toBe("aim");
      await page.screenshot({ path: `test-results/guide-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByLabel("Launch angle in degrees").tap();
      await expect(guide).toContainText("2/4");
      await page.getByRole("button", { name: "Launch parcel (Space)" }).tap();
      await expect(guide).toContainText("3/4");
      await page.getByRole("button", { name: "Brake, one use (B)" }).tap();
      await expect(guide).toContainText("4/4");
      const failed = page.getByRole("dialog");
      await expect(failed).toBeVisible({ timeout: 15_000 });
      await expect(failed).toBeFocused();
      await page.screenshot({ path: `test-results/result-${width}.png` });
      await page.keyboard.press("Space");
      expect((await probe(page)).phase).toBe("result");
      await page.keyboard.press("Tab");
      await expect(failed.getByRole("button", { name: /^Retry/ })).toBeFocused();
      await failed.getByRole("button", { name: /^Retry/ }).tap();
      await expect(guide).toContainText("1/4");
      await page.getByRole("button", { name: "Skip the guide" }).tap();
      await page.getByRole("button", { name: /^Missions/ }).tap();
      const manifest = page.getByRole("dialog", { name: "Delivery manifest" });
      await expect(manifest).toBeVisible();
      await page.screenshot({ path: `test-results/manifest-${width}.png` });
      const sound = manifest.getByRole("button", { name: /^Sound/ });
      const muted = await sound.getAttribute("aria-pressed");
      await sound.tap();
      await expect(sound).not.toHaveAttribute("aria-pressed", muted ?? "false");
      await page.keyboard.press("Escape");
      await expect(manifest).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("live motion preference ends glide; held activation does not spend the brake", async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto("/?e2e&intro&quality=low");
  await expect(page.locator("#arrival")).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole("button", { name: "Report for duty" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByLabel("Launch controls")).toBeVisible({ timeout: 1500 });
  await page.getByRole("button", { name: "Skip the guide" }).click();
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(page.getByRole("button", { name: "Brake, one use (B)" })).toBeEnabled();
  expect(errors).toEqual([]);
});
