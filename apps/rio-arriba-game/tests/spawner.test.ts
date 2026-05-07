import { describe, expect, it } from "vitest";
import { SECTION_LENGTH } from "../src/systems/river";
import {
  chargerChanceForSection,
  chargerRowStrideForSection,
  entitiesForRange,
  FIRST_SECTION_CHARGER_CHANCE,
  MIN_CHARGER_CHANCE,
  threatWeightsForSection
} from "../src/systems/spawner";

describe("spawner charger pacing", () => {
  it("makes early chargers more available while keeping later sections scarcer", () => {
    expect(chargerChanceForSection(0)).toBe(FIRST_SECTION_CHARGER_CHANCE);
    expect(chargerChanceForSection(0)).toBeGreaterThan(0.58);
    expect(chargerChanceForSection(2)).toBeLessThan(chargerChanceForSection(0));
    expect(chargerChanceForSection(8)).toBeLessThan(chargerChanceForSection(2));
    expect(chargerChanceForSection(12)).toBe(MIN_CHARGER_CHANCE);
  });

  it("spaces charger-eligible rows farther apart as sections progress", () => {
    expect(chargerRowStrideForSection(0)).toBe(1);
    expect(chargerRowStrideForSection(2)).toBe(1);
    expect(chargerRowStrideForSection(4)).toBe(2);
    expect(chargerRowStrideForSection(8)).toBeGreaterThan(chargerRowStrideForSection(4));
  });

  it("generates more chargers in early level bands than late level bands", () => {
    const early = chargerCountForLevels(1, 3);
    const middle = chargerCountForLevels(4, 6);
    const late = chargerCountForLevels(7, 9);

    expect(early).toBeGreaterThan(0);
    expect(early).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(late);
  });
});

describe("spawner threat pacing", () => {
  it("shifts later sections toward more drones and jets", () => {
    const low = threatWeightsForSection(0);
    const high = threatWeightsForSection(8);

    expect(high.barge).toBeLessThan(low.barge);
    expect(high.drone + high.jet).toBeGreaterThan(low.drone + low.jet);
    expect(high.jet).toBeGreaterThan(low.jet);
  });

  it("generates more drones and jets in high level bands than low level bands", () => {
    const low = threatCountsForLevels(1, 3);
    const high = threatCountsForLevels(7, 9);

    expect(high.drone).toBeGreaterThan(low.drone);
    expect(high.jet).toBeGreaterThan(low.jet);
  });
});

function chargerCountForLevels(firstLevel: number, lastLevel: number): number {
  const fromY = (firstLevel - 1) * SECTION_LENGTH;
  const toY = lastLevel * SECTION_LENGTH - 1;
  return entitiesForRange(fromY, toY).filter((entity) => entity.kind === "charger").length;
}

function threatCountsForLevels(firstLevel: number, lastLevel: number): { drone: number; jet: number } {
  const fromY = (firstLevel - 1) * SECTION_LENGTH;
  const toY = lastLevel * SECTION_LENGTH - 1;
  const entities = entitiesForRange(fromY, toY);

  return {
    drone: entities.filter((entity) => entity.kind === "drone").length,
    jet: entities.filter((entity) => entity.kind === "jet").length
  };
}
