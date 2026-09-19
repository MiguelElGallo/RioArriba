import { expect, test, type Page } from "@playwright/test";
import type { GameSnapshot } from "../src/systems/types";

async function snapshot(page: Page): Promise<GameSnapshot> {
  return page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
    const { game } = await import(modulePath);
    return game.scene.getScene("main").simulation.snapshot();
  });
}

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
];

for (const viewport of viewports) {
  test(`flight controls at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute("data-state", "ready");
    const start = await page.locator("#flight-action").boundingBox();
    expect(start!.y + start!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: testInfo.outputPath("ready.png") });
    await page.getByRole("button", { name: "Start flight", exact: true }).click();
    await expect(page.locator("#app")).toHaveAttribute("data-state", "playing");
    for (const id of ["slow", "fast", "fire", "missile"]) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    const dimensions = await page.evaluate(async () => {
      const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
      const { game } = await import(modulePath);
      return { width: game.scale.width, height: game.scale.height };
    });
    expect(dimensions.width).toBeGreaterThanOrEqual(480);
    expect(dimensions.height).toBeGreaterThanOrEqual(540);
    await page.keyboard.down("d");
    const initial = await snapshot(page);
    await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(initial.player.x + 12);
    await page.keyboard.up("d");
    await page.keyboard.down("Space");
    await expect.poll(async () => (await snapshot(page)).shots.length).toBeGreaterThan(0);
    await page.keyboard.up("Space");
    await page.screenshot({ path: testInfo.outputPath("playing.png") });
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(page.locator("#app")).toHaveAttribute("data-state", "paused");
    const paused = await snapshot(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#info-panel")).toBeHidden();
    await page.waitForTimeout(200);
    expect((await snapshot(page)).player).toEqual(paused.player);
    await page.screenshot({ path: testInfo.outputPath("paused.png") });
    await page.getByRole("button", { name: "Resume flight", exact: true }).click();
    await expect(page.locator("#app")).toHaveAttribute("data-state", "playing");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.locator("#app")).toHaveAttribute("data-state", "paused");
    await page.keyboard.press("Enter");
    await expect(page.locator("#app")).toHaveAttribute("data-state", "playing");
    expect(errors).toEqual([]);
  });
}

test("two thumbs steer and fire independently, cancel cleanly, and pause on rotation", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-state", "ready");
  await page.locator("#flight-action").click();
  const client = await context.newCDPSession(page);
  const fireBox = (await page.locator("#fire").boundingBox())!;
  const fire = { id: 2, x: fireBox.x + fireBox.width / 2, y: fireBox.y + fireBox.height / 2 };
  const steer = { id: 1, x: 90, y: 520 };
  const start = await snapshot(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [steer] });
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [steer, fire] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...steer, x: 120 }, fire] });
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(start.player.x + 10);
  await expect.poll(async () => (await snapshot(page)).shots.length).toBeGreaterThan(0);
  await expect(page.locator("#fire")).toHaveClass("held");
  await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(page.locator("#fire")).not.toHaveClass("held");
  const canceledInput = await page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
    const { game } = await import(modulePath);
    const scene = game.scene.getScene("main");
    return scene.gestureInput.stateAt(scene.time.now);
  });
  expect(canceledInput.steerTargetX).toBeUndefined();
  expect(canceledInput.fire).toBe(false);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#app")).toHaveAttribute("data-state", "paused");
  await page.locator("#flight-action").click();
  await expect(page.locator("#app")).toHaveAttribute("data-state", "playing");
});

test("a key held across pause must be released before it can steer again", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-state", "ready");
  await page.locator("#flight-action").click();
  await page.keyboard.down("d");
  await expect.poll(async () => (await snapshot(page)).player.vx).toBeGreaterThan(0);
  await page.locator("#pause-toggle").click();
  await page.locator("#flight-action").click();
  const resumed = await snapshot(page);
  await page.keyboard.down("d"); // Auto-repeat from the still-held physical key.
  await page.waitForTimeout(150);
  expect((await snapshot(page)).player.x).toBe(resumed.player.x);
  await page.keyboard.up("d");
  await page.keyboard.down("d");
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(resumed.player.x);
  await page.keyboard.up("d");
});

test("held fire cannot skip a crash or game over, and retry starts with neutral controls", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-state", "ready");
  await page.keyboard.press("Enter");
  for (const lives of [2, 1, 0]) {
    await page.keyboard.down("Space");
    await page.keyboard.down("ArrowLeft");
    await expect(page.locator("#app")).toHaveAttribute("data-state", lives ? "crashed" : "game-over");
    await page.waitForTimeout(200);
    expect((await snapshot(page)).player.lives).toBe(lives);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.up("Space");
    if (lives === 0) await page.screenshot({ path: testInfo.outputPath("game-over.png") });
    await page.locator("#flight-action").click();
    await expect(page.locator("#app")).toHaveAttribute("data-state", "playing");
    expect(Math.abs((await snapshot(page)).player.vx)).toBeLessThan(1);
  }
  expect((await snapshot(page)).player.lives).toBe(3);
  await page.screenshot({ path: testInfo.outputPath("restarted.png") });
});
