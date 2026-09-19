import { describe, expect, it } from "vitest";
import { isInsideRiver, riverBoundsAt, SECTION_LENGTH, WORLD_WIDTH } from "../src/systems/river";
import { difficultyForSection } from "../src/systems/difficulty";

describe("river generation", () => {
  it("keeps navigable banks inside the world", () => {
    for (let y = 0; y < SECTION_LENGTH * 50; y += 137) {
      const bounds = riverBoundsAt(y);
      expect(bounds.left).toBeGreaterThanOrEqual(20);
      expect(bounds.right).toBeLessThanOrEqual(WORLD_WIDTH - 20);
      expect(bounds.width).toBeGreaterThanOrEqual(140 - 0.000001);
    }
  });

  it("narrows the average channel as distance increases", () => {
    const early = averageWidth(0);
    const late = averageWidth(SECTION_LENGTH * 6);
    expect(late).toBeLessThan(early);
  });

  it("gives the starting lane enough room for early steering mistakes", () => {
    const start = riverBoundsAt(80);
    expect(start.width).toBeGreaterThanOrEqual(410);
    expect(isInsideRiver(WORLD_WIDTH / 2, 80, 42)).toBe(true);
  });

  it("keeps the first bridge forgiving and progressively narrows later bridges", () => {
    const bridgeY = SECTION_LENGTH - 120;
    const approach = riverBoundsAt(bridgeY - 40);
    const beforeApproach = riverBoundsAt(bridgeY - 680);
    const afterBridge = riverBoundsAt(bridgeY + 680);

    expect(approach.width).toBeGreaterThanOrEqual(320);
    expect(beforeApproach.width).toBeGreaterThan(approach.width + 50);
    expect(afterBridge.width).toBeGreaterThan(approach.width + 40);
    expect(isInsideRiver(WORLD_WIDTH / 2, bridgeY, 34)).toBe(true);
    for (let section = 0; section < 12; section++) {
      expect(riverBoundsAt((section + 1) * SECTION_LENGTH - 120).width).toBeCloseTo(difficultyForSection(section).bridgeWidth);
    }
  });

  it("makes each of the first ten levels narrower on average", () => {
    for (let section = 1; section < 10; section++) {
      expect(averageWidth(section * SECTION_LENGTH)).toBeLessThan(averageWidth((section - 1) * SECTION_LENGTH) - 5);
    }
  });

  it("never jumps sideways when crossing a level boundary", () => {
    for (let section = 1; section < 50; section++) {
      const before = riverBoundsAt(section * SECTION_LENGTH - 1);
      const after = riverBoundsAt(section * SECTION_LENGTH + 1);
      expect(Math.abs(after.left - before.left)).toBeLessThan(2);
      expect(Math.abs(after.right - before.right)).toBeLessThan(2);
    }
  });

  it("keeps early bends gentle and all banks trackable at full speed", () => {
    let firstLevelBend = 0;
    let laterBend = 0;
    for (let y = 0; y < SECTION_LENGTH * 15; y += 10) {
      const a = riverBoundsAt(y);
      const b = riverBoundsAt(y + 10);
      const centerChange = Math.abs((b.left + b.right - a.left - a.right) / 2);
      if (y < SECTION_LENGTH) firstLevelBend += centerChange;
      if (y >= SECTION_LENGTH * 8 && y < SECTION_LENGTH * 9) laterBend += centerChange;
      expect(Math.abs(b.left - a.left) / 10 * 265).toBeLessThan(220);
      expect(Math.abs(b.right - a.right) / 10 * 265).toBeLessThan(220);
    }
    expect(firstLevelBend).toBeLessThan(laterBend / 2);
  });

  it("keeps bridge funnel transitions smooth enough to read", () => {
    const bridgeY = SECTION_LENGTH - 120;
    let previous = riverBoundsAt(bridgeY - 560).width;

    for (let y = bridgeY - 460; y <= bridgeY + 460; y += 100) {
      const width = riverBoundsAt(y).width;
      expect(Math.abs(width - previous)).toBeLessThanOrEqual(72);
      previous = width;
    }
  });

  it("detects bank collisions with player radius", () => {
    const bounds = riverBoundsAt(900);
    expect(isInsideRiver((bounds.left + bounds.right) / 2, 900, 18)).toBe(true);
    expect(isInsideRiver(bounds.left + 5, 900, 18)).toBe(false);
  });
});

function averageWidth(start: number): number {
  let total = 0;
  let count = 0;
  for (let y = start; y < start + SECTION_LENGTH; y += 100) {
    total += riverBoundsAt(y).width;
    count += 1;
  }
  return total / count;
}
