import { expect, test } from "@playwright/test";

for (const level of [1, 4, 10]) {
  test(`level ${level} has a visible, navigable bridge approach`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute("data-state", "ready");
    await page.locator("#flight-action").click();
    const geometry = await page.evaluate(async (level) => {
      const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
      const { game } = await import(modulePath);
      const scene = game.scene.getScene("main");
      const riverPath = "/src/systems/river.ts";
      const { riverBoundsAt, bridgeYForSection, SECTION_LENGTH } = await import(riverPath);
      const sim = scene.simulation;
      const y = (level - 1) * SECTION_LENGTH + 1650;
      const banks = riverBoundsAt(y);
      sim.player = { ...sim.player, y, x: (banks.left + banks.right) / 2, vx: 0, charge: 100, invulnerableMs: 1500 };
      sim.level = level;
      sim.entities.clear();
      sim.shots = [];
      scene.update(0, 0);
      const bridge = sim.snapshot().entities.find((entity: { kind: string }) => entity.kind === "gate");
      const sprite = scene.entitySprites.get(bridge.id);
      return {
        channelWidth: riverBoundsAt(bridgeYForSection(level - 1)).width,
        bridgeWidth: bridge.w,
        spriteVisible: sprite.visible,
        spriteY: sprite.y,
        logicalHeight: game.scale.height
      };
    }, level);
    await expect(page.locator("#section")).toHaveText(`LEVEL ${level}`);
    expect(geometry.channelWidth).toBeCloseTo(level === 1 ? 320 : level === 4 ? 220 : 140);
    expect(geometry.bridgeWidth).toBeCloseTo(geometry.channelWidth - 24);
    expect(geometry.spriteVisible).toBe(true);
    expect(geometry.spriteY).toBeGreaterThan(54);
    expect(geometry.spriteY).toBeLessThan(geometry.logicalHeight - 184);
    await page.screenshot({ path: testInfo.outputPath(`level-${level}-bridge.png`) });
    expect(errors).toEqual([]);
  });
}
