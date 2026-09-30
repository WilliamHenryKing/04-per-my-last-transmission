import { expect, type Page, test } from "@playwright/test";

// Deliver the mug in mission 1 through the real UI: keyboard aiming, launch, one brake.
// The route tolerates a few ticks of timing either way (checked offline with the solver),
// so frame-granular key presses under a paused clock land it every time.

const LAUNCH_TICK = 106;
const BRAKE_STEP = 298;

interface Probe {
  tick: number;
  step: number;
  phase: string;
}

const probe = (page: Page) => page.evaluate(() => (window as unknown as { __pmlt: Probe }).__pmlt);

/** Advance the paused clock `ms` at a time (16 = one frame) until the condition holds. */
async function stepUntil(page: Page, done: (p: Probe) => boolean, ms = 16) {
  for (let i = 0; i < 1500; i++) {
    const p = await probe(page);
    if (done(p)) return p;
    await page.clock.runFor(ms);
  }
  throw new Error("condition never met");
}

test("mission 1: aim, launch, brake and get the mug signed for", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.install();
  // Gameplay test: the light render tier keeps SwiftShader frames fast.
  await page.goto("/?e2e&quality=low");
  await expect(page.locator("#arrival")).toHaveCount(0, { timeout: 20_000 });
  await page.clock.pauseAt(Date.now() + 60_000);

  await page.getByRole("button", { name: "Skip the guide" }).click();
  await expect(page.getByLabel("How to deliver")).toHaveCount(0);

  // Restart the mission from the manifest so the world clock is back at zero.
  await page.keyboard.press("l");
  await page.getByRole("button", { name: /^1\. A Mug for the Moon Café/ }).click();
  expect((await probe(page)).tick).toBe(0);

  // Default aim is 13° at 30%: right arrow turns clockwise, down arrow lowers power.
  for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowDown");
  await expect(page.getByLabel("Launch angle in degrees")).toHaveValue("358");
  await expect(page.getByLabel("Launch power in percent")).toHaveValue("10");

  await stepUntil(page, (p) => p.tick >= LAUNCH_TICK - 15, 96);
  await stepUntil(page, (p) => p.tick >= LAUNCH_TICK);
  await page.keyboard.press("Space");
  expect((await probe(page)).phase).toBe("flight");

  await stepUntil(page, (p) => p.step >= BRAKE_STEP - 15, 96);
  await stepUntil(page, (p) => p.step >= BRAKE_STEP);
  await page.keyboard.press("b");
  await expect(page.getByRole("button", { name: "Brake already used" })).toBeVisible();

  await stepUntil(page, (p) => p.phase === "result", 96);
  const card = page.getByRole("dialog", { name: "Delivered" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Delivered · Officially");
  await expect(card.getByRole("list", { name: "Stamps earned" })).toContainText("DELIVERED");
  await expect(card.getByRole("button", { name: /Next parcel/ })).toBeVisible();
  // Let the stamp slam finish (its animation runs on the paused clock) before the snapshot.
  await page.clock.runFor(1500);
  await page.screenshot({ path: "test-results/mission-one-delivered.png" });
  expect(errors).toEqual([]);
});
