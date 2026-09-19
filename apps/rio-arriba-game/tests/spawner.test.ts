import { describe, expect, it } from "vitest";
import { difficultyForSection } from "../src/systems/difficulty";
import { bridgeYForSection, riverBoundsAt, SECTION_LENGTH } from "../src/systems/river";
import { CHARGER_HEIGHT, CHARGER_WIDTH, entitiesForRange } from "../src/systems/spawner";

function level(section: number) {
  return entitiesForRange(section * SECTION_LENGTH, (section + 1) * SECTION_LENGTH - 1);
}

describe("deliberate difficulty progression", () => {
  it("opens with a clear runway, single barges, and two easy-to-reach chargers", () => {
    const opening = level(0);
    const enemies = opening.filter((entity) => !["charger", "gate"].includes(entity.kind));
    expect(enemies.length).toBeGreaterThanOrEqual(2);
    expect(enemies.every((entity) => entity.kind === "barge" && entity.vx === 0)).toBe(true);
    expect(enemies.every((entity) => entity.y >= 480)).toBe(true);
    const chargers = opening.filter((entity) => entity.kind === "charger");
    expect(chargers).toHaveLength(2);
    for (const charger of chargers) {
      const bounds = riverBoundsAt(charger.y);
      expect(charger.x).toBeCloseTo((bounds.left + bounds.right) / 2);
    }
  });

  it("introduces drones before jets and keeps paired threats out of the first two levels", () => {
    expect(level(1).some((entity) => entity.kind === "drone")).toBe(true);
    for (let section = 0; section < 3; section++) expect(level(section).some((entity) => entity.kind === "jet")).toBe(false);
    expect([3, 4, 5].flatMap(level).some((entity) => entity.kind === "jet")).toBe(true);
    for (const section of [0, 1]) expect(level(section).some((entity) => entity.id.startsWith("threat-") && entity.id.endsWith("-1"))).toBe(false);
  });

  it("increases encounter pressure and crossing speed gradually, with a finite ceiling", () => {
    const threats = (sections: number[]) => sections.flatMap(level).filter((entity) => !["charger", "gate"].includes(entity.kind));
    const early = threats([0, 1, 2]);
    const late = threats([7, 8, 9]);
    expect(late.length).toBeGreaterThan(early.length);
    expect(late.filter((entity) => entity.vx !== 0).length).toBeGreaterThan(early.filter((entity) => entity.vx !== 0).length);
    expect(difficultyForSection(1000)).toEqual(difficultyForSection(9));
    expect(difficultyForSection(9).crossingSpeed).toBeLessThanOrEqual(64);
  });
});

describe("fair and deterministic encounters", () => {
  it("guarantees recharge opportunities even in very late levels", () => {
    for (let section = 0; section < 50; section++) {
      const chargers = level(section).filter((entity) => entity.kind === "charger");
      expect(chargers.length).toBe(section < 3 ? 2 : 1);
      for (const charger of chargers) {
        expect(charger.w).toBe(CHARGER_WIDTH);
        expect(charger.h).toBe(CHARGER_HEIGHT);
      }
    }
    const stations = entitiesForRange(0, SECTION_LENGTH * 20).filter((entity) => entity.kind === "charger");
    for (let i = 1; i < stations.length; i++) {
      const gap = stations[i].y - stations[i - 1].y;
      expect(gap).toBeGreaterThanOrEqual(700);
      expect(gap / 165 * 5.7).toBeLessThan(80);
    }
  });

  it("gives chargers and bridge approaches space free of overlapping enemies", () => {
    for (let section = 0; section < 30; section++) {
      const entities = level(section);
      const enemies = entities.filter((entity) => !["charger", "gate"].includes(entity.kind));
      const stations = entities.filter((entity) => entity.kind === "charger");
      for (const enemy of enemies) {
        expect(bridgeYForSection(section) - enemy.y).toBeGreaterThan(200);
        for (const charger of stations) expect(Math.abs(enemy.y - charger.y)).toBeGreaterThanOrEqual(180);
      }
    }
  });

  it("aligns exactly one bridge with each river funnel and spans the opening", () => {
    for (let section = 0; section < 50; section++) {
      const gates = level(section).filter((entity) => entity.kind === "gate");
      expect(gates).toHaveLength(1);
      const gate = gates[0];
      const bounds = riverBoundsAt(gate.y);
      expect(gate.y).toBe(bridgeYForSection(section));
      expect(gate.w).toBeCloseTo(bounds.width - 24);
      expect(gate.x).toBeCloseTo((bounds.left + bounds.right) / 2);
    }
  });

  it("spawns entities inside the river including the whole length of a charger", () => {
    for (const entity of entitiesForRange(0, SECTION_LENGTH * 30)) {
      for (const y of [entity.y - entity.h / 2, entity.y, entity.y + entity.h / 2]) {
        const bounds = riverBoundsAt(y);
        expect(entity.x - entity.w / 2).toBeGreaterThanOrEqual(bounds.left);
        expect(entity.x + entity.w / 2).toBeLessThanOrEqual(bounds.right);
      }
    }
  });

  it("produces identical entities whether a range is requested together or in pieces", () => {
    const whole = entitiesForRange(0, SECTION_LENGTH * 3 - 1);
    const pieces = [0, 1, 2].flatMap(level);
    expect(whole).toEqual(pieces);
    expect(new Set(whole.map((entity) => entity.id)).size).toBe(whole.length);
    expect(entitiesForRange(700, 1700)).toEqual(whole.filter((entity) => entity.y >= 700 && entity.y <= 1700));
  });
});
