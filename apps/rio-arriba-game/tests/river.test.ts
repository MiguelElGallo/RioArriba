import { describe, expect, it } from "vitest";
import { isInsideRiver, riverBoundsAt, SECTION_LENGTH, WORLD_WIDTH } from "../src/systems/river";

describe("river generation", () => {
  it("keeps navigable banks inside the world", () => {
    for (let y = 0; y < SECTION_LENGTH * 8; y += 137) {
      const bounds = riverBoundsAt(y);
      expect(bounds.left).toBeGreaterThanOrEqual(20);
      expect(bounds.right).toBeLessThanOrEqual(WORLD_WIDTH - 20);
      expect(bounds.width).toBeGreaterThanOrEqual(120);
    }
  });

  it("narrows the average channel as distance increases", () => {
    const early = averageWidth(0);
    const late = averageWidth(SECTION_LENGTH * 6);
    expect(late).toBeLessThan(early);
  });

  it("gives the starting lane enough room for early steering mistakes", () => {
    const start = riverBoundsAt(80);
    expect(start.width).toBeGreaterThanOrEqual(350);
    expect(isInsideRiver(WORLD_WIDTH / 2, 80, 42)).toBe(true);
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
