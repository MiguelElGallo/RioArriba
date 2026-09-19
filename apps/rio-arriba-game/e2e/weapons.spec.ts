import { expect, test, type Page } from "@playwright/test";
import type { GameSnapshot } from "../src/systems/types";

async function snapshot(page: Page): Promise<GameSnapshot> {
  return page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
    const { game } = await import(modulePath);
    return game.scene.getScene("main").simulation.snapshot();
  });
}

async function prepareRange(page: Page, withTarget: boolean): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-state", "ready");
  await page.locator("#flight-action").click();
  await page.evaluate(async (withTarget) => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
    const { game } = await import(modulePath);
    const sim = game.scene.getScene("main").simulation;
    sim.ensureEntities = () => {};
    sim.entities.clear();
    if (withTarget) {
      sim.entities.set("target", {
        id: "target", kind: "barge", x: sim.player.x, y: sim.player.y + 260,
        w: 54, h: 42, vx: 0, alive: true, health: 3, hitFlashMs: 0
      });
    }
  }, withTarget);
}

test("gun damage stays visible and a keyboard missile finishes the target", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await prepareRange(page, true);
  await page.keyboard.down("Space");
  await expect.poll(async () => (await snapshot(page)).shots.some((shot) => shot.kind === "machine-gun"), { intervals: [10] }).toBe(true);
  await page.keyboard.up("Space");
  await expect.poll(async () => (await snapshot(page)).entities[0]?.health, { intervals: [10] }).toBe(2);
  expect((await snapshot(page)).score).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("enemy-hit-flash.png") });
  await expect.poll(async () => (await snapshot(page)).entities[0]?.hitFlashMs).toBe(0);
  const tint = await page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
    const { game } = await import(modulePath);
    return game.scene.getScene("main").entitySprites.get("target").tintTopLeft;
  });
  expect(tint).toBe(0xffaa66);
  await page.screenshot({ path: testInfo.outputPath("enemy-persistent-damage.png") });
  await page.keyboard.down("x");
  await expect.poll(async () => (await snapshot(page)).shots.some((shot) => shot.kind === "missile"), { intervals: [10] }).toBe(true);
  await page.keyboard.up("x");
  await expect(page.locator("#missile")).toHaveClass(/reloading/);
  await expect(page.locator("#missile-status")).toHaveText(/\d\.\ds/);
  await page.screenshot({ path: testInfo.outputPath("missile-in-flight.png") });
  await expect.poll(async () => (await snapshot(page)).score).toBe(30);
  expect((await snapshot(page)).entities).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("quick missile taps launch once, respect reload, and do not queue another missile", async ({ page }) => {
  await prepareRange(page, false);
  await page.locator("#missile").tap();
  await expect.poll(async () => (await snapshot(page)).missileCooldownMs).toBeGreaterThan(0);
  const initialMissile = (await snapshot(page)).shots.find((shot) => shot.kind === "missile")!;
  expect(initialMissile).toBeDefined();
  await page.locator("#missile").tap();
  await page.waitForTimeout(1600);
  await expect(page.locator("#missile-status")).toHaveText("READY");
  expect((await snapshot(page)).shots.every((shot) => shot.id === initialMissile.id)).toBe(true);
  await page.locator("#missile").tap();
  await expect.poll(async () => (await snapshot(page)).shots.some((shot) => shot.kind === "missile" && shot.id !== initialMissile.id)).toBe(true);
});
