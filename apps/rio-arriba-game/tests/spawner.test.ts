import { describe, expect, it } from "vitest";
import { riverBoundsAt, SECTION_LENGTH } from "../src/systems/river";
import {
  chargerChanceForSection,
  CHARGER_HEIGHT,
  CHARGER_WIDTH,
  chargerRowStrideForSection,
  entitiesForRange,
  FIRST_SECTION_CHARGER_CHANCE,
  MIN_CHARGER_CHANCE,
  MIN_CHARGER_ROW_GAP,
  secondaryThreatChanceForSection,
  SPAWN_ROW_SPACING,
  threatWeightsForSection
} from "../src/systems/spawner";

describe("spawner charger pacing", () => {
  it("makes early chargers more available while keeping later sections scarcer", () => {
    expect(chargerChanceForSection(0)).toBe(FIRST_SECTION_CHARGER_CHANCE);
    expect(chargerChanceForSection(0)).toBeGreaterThan(0.58);
    expect(chargerChanceForSection(2)).toBeLessThan(chargerChanceForSection(0));
    expect(chargerChanceForSection(8)).toBeLessThan(chargerChanceForSection(2));
    expect(chargerChanceForSection(18)).toBe(MIN_CHARGER_CHANCE);
  });

  it("spaces charger-eligible rows farther apart as sections progress", () => {
    expect(chargerRowStrideForSection(0)).toBe(MIN_CHARGER_ROW_GAP);
    expect(chargerRowStrideForSection(2)).toBe(chargerRowStrideForSection(0));
    expect(chargerRowStrideForSection(3)).toBeGreaterThan(chargerRowStrideForSection(0));
    expect(chargerRowStrideForSection(4)).toBeGreaterThan(chargerRowStrideForSection(2));
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

  it("keeps more chargers overall while making later chargers farther apart", () => {
    const earlyChargers = chargerPositionsForLevels(1, 6);
    const lateChargers = chargerPositionsForLevels(7, 12);

    expect(earlyChargers.length).toBeGreaterThanOrEqual(10);
    expect(lateChargers.length).toBeGreaterThan(0);
    expect(averageGap(lateChargers)).toBeGreaterThan(averageGap(earlyChargers));
  });

  it("prevents charging stations from spawning in adjacent rows", () => {
    const chargers = chargerPositionsForLevels(1, 12);
    expect(minGap(chargers)).toBeGreaterThanOrEqual(SPAWN_ROW_SPACING * MIN_CHARGER_ROW_GAP);
  });

  it("makes chargers long enough to support sustained slow recharging", () => {
    const charger = entitiesForRange(0, SECTION_LENGTH).find((entity) => entity.kind === "charger");

    expect(charger).toBeDefined();
    expect(charger!.w).toBe(CHARGER_WIDTH);
    expect(charger!.h).toBe(CHARGER_HEIGHT);
    expect(charger!.h).toBeGreaterThanOrEqual(150);
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

  it("increases secondary enemy pressure in later sections", () => {
    expect(secondaryThreatChanceForSection(0)).toBeLessThan(secondaryThreatChanceForSection(6));
    expect(threatCountForLevels(1, 3)).toBeGreaterThan(18);
  });
});

describe("spawner bridges", () => {
  it("places one visible bridge gate near the end of every section", () => {
    for (let section = 0; section < 8; section += 1) {
      const fromY = section * SECTION_LENGTH;
      const toY = (section + 1) * SECTION_LENGTH - 1;
      const gates = entitiesForRange(fromY, toY).filter((entity) => entity.kind === "gate" && entity.y >= fromY && entity.y <= toY);

      expect(gates).toHaveLength(1);
      expect(gates[0].y).toBeGreaterThan(toY - SECTION_LENGTH * 0.16);
      const room = riverBoundsAt(gates[0].y).width;
      expect(gates[0].h).toBeGreaterThanOrEqual(46);
      expect(gates[0].w).toBeLessThanOrEqual(room - 24);
      expect(gates[0].w).toBeGreaterThanOrEqual(110);
      if (section === 0) expect(gates[0].w).toBeLessThan(230);
    }
  });
});

function chargerCountForLevels(firstLevel: number, lastLevel: number): number {
  return chargerPositionsForLevels(firstLevel, lastLevel).length;
}

function chargerPositionsForLevels(firstLevel: number, lastLevel: number): number[] {
  const fromY = (firstLevel - 1) * SECTION_LENGTH;
  const toY = lastLevel * SECTION_LENGTH - 1;
  return entitiesForRange(fromY, toY)
    .filter((entity) => entity.kind === "charger")
    .map((entity) => entity.y);
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

function averageGap(positions: number[]): number {
  const sorted = [...positions].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((position, index) => position - sorted[index]);
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

function minGap(positions: number[]): number {
  const sorted = [...positions].sort((a, b) => a - b);
  return Math.min(...sorted.slice(1).map((position, index) => position - sorted[index]));
}

function threatCountForLevels(firstLevel: number, lastLevel: number): number {
  const fromY = (firstLevel - 1) * SECTION_LENGTH;
  const toY = lastLevel * SECTION_LENGTH - 1;
  return entitiesForRange(fromY, toY).filter((entity) => !["charger", "gate"].includes(entity.kind)).length;
}
