import { describe, expect, it } from "vitest";
import { Simulation } from "../src/systems/simulation";
import { entitiesForRange } from "../src/systems/spawner";
import { ENTITY_RULES, WEAPON_RULES, type EntityKind, type EntityState, type ShotState } from "../src/systems/types";

function internals(sim: Simulation) {
  return sim as unknown as {
    entities: Map<string, EntityState>;
    shots: ShotState[];
    ensureEntities: () => void;
  };
}

function arena(): Simulation {
  const sim = new Simulation();
  internals(sim).ensureEntities = () => {};
  sim.startOrResume();
  return sim;
}

function target(kind: EntityKind, y = 500): EntityState {
  return { id: `${kind}-${y}`, kind, x: 240, y, w: 40, h: 34, vx: 0, health: ENTITY_RULES[kind].maxHealth, hitFlashMs: 0, alive: true };
}

function shot(entity: EntityState, kind: ShotState["kind"] = "machine-gun", id = "round"): ShotState {
  return { id, kind, x: entity.x, y: entity.y, vx: 0, alive: true };
}

describe("two-weapon combat", () => {
  it("spawns all targets at full health without damage feedback", () => {
    for (const entity of entitiesForRange(0, 10000)) {
      expect(entity.health).toBe(ENTITY_RULES[entity.kind].maxHealth);
      expect(entity.hitFlashMs).toBe(0);
    }
  });

  it.each([["drone", 2], ["jet", 2], ["barge", 3], ["gate", 3], ["charger", 1]] as const)(
    "%s needs exactly %i gun hits; damage is visible and score waits for destruction",
    (kind, hits) => {
      const sim = arena();
      const enemy = target(kind);
      internals(sim).entities.set(enemy.id, enemy);
      for (let hit = 1; hit <= hits; hit++) {
        const before = sim.snapshot();
        internals(sim).shots = [shot(enemy)];
        const after = sim.update(0);
        expect(before.entities[0].health).toBe(hits - hit + 1);
        if (hit < hits) {
          expect(after.entities[0].health).toBe(hits - hit);
          expect(after.entities[0].hitFlashMs).toBeGreaterThan(0);
          expect(after.score).toBe(0);
          expect(after.soundCues).toEqual(["damage"]);
          for (let i = 0; i < 4; i++) sim.update(50);
          expect(sim.snapshot().entities[0].health).toBe(hits - hit);
          expect(sim.snapshot().entities[0].hitFlashMs).toBe(0);
        } else {
          expect(after.entities).toHaveLength(0);
          expect(after.score).toBe(ENTITY_RULES[kind].score);
          expect(after.soundCues).toEqual(["hit"]);
        }
      }
    }
  );

  it("awards a kill once when several missiles arrive in the same frame", () => {
    const sim = arena();
    const enemy = target("barge");
    internals(sim).entities.set(enemy.id, enemy);
    internals(sim).shots = [shot(enemy, "missile", "a"), shot(enemy, "missile", "b")];
    const snap = sim.update(0);
    expect(snap.score).toBe(30);
    expect(snap.soundCues).toEqual(["hit"]);
    expect(snap.shots).toHaveLength(1);
  });

  it("moves gun rounds at 900 units/s and missiles at the original 520 units/s", () => {
    const sim = arena();
    const point = target("barge");
    internals(sim).shots = [shot(point), shot(point, "missile", "missile")];
    const snap = sim.update(50);
    expect(snap.shots[0].y - point.y).toBeCloseTo(45);
    expect(snap.shots[1].y - point.y).toBeCloseTo(26);
  });

  it("hits a thin target crossed between frames and chooses the nearest target", () => {
    const sim = arena();
    const near = { ...target("drone", 320), h: 4 };
    const far = { ...target("barge", 345), h: 4 };
    internals(sim).entities = new Map([[far.id, far], [near.id, near]]);
    internals(sim).shots = [{ ...shot(near), y: 300 }];
    const snap = sim.update(50);
    expect(snap.entities.find((entity) => entity.id === near.id)?.health).toBe(1);
    expect(snap.entities.find((entity) => entity.id === far.id)?.health).toBe(3);
    expect(snap.shots).toHaveLength(0);
  });

  it("keeps gun fire available during missile reload and launches again only after 1.5s", () => {
    const sim = arena();
    sim.setInput({ fire: true, missile: true });
    const launch = sim.update(0);
    expect(launch.shots.map((shot) => shot.kind)).toEqual(["machine-gun", "missile"]);
    expect(launch.missileCooldownMs).toBe(1500);
    let gunshots = 0;
    for (let i = 0; i < 29; i++) {
      const snap = sim.update(50);
      expect(snap.soundCues).not.toContain("missile");
      if (snap.soundCues.includes("fire")) gunshots++;
    }
    expect(gunshots).toBeGreaterThan(10);
    expect(sim.snapshot().missileCooldownMs).toBe(50);
    expect(sim.update(50).soundCues).toContain("missile");
    expect(sim.snapshot().missileCooldownMs).toBe(WEAPON_RULES.missile.cooldownMs);
  });

  it("freezes reload during pause and clears weapon input on resume", () => {
    const sim = arena();
    sim.setInput({ missile: true });
    sim.update(0);
    sim.pause();
    expect(sim.update(5000).missileCooldownMs).toBe(1500);
    sim.startOrResume();
    for (let i = 0; i < 30; i++) expect(sim.update(50).soundCues).not.toContain("missile");
    expect(sim.snapshot().missileCooldownMs).toBe(0);
    sim.setInput({ missile: true });
    expect(sim.update(0).soundCues).toContain("missile");
  });

  it("restores a ready missile after a crash retry", () => {
    const sim = arena();
    sim.setInput({ missile: true, left: true });
    for (let i = 0; i < 30 && sim.snapshot().state === "playing"; i++) sim.update(50);
    expect(sim.snapshot().state).toBe("crashed");
    expect(sim.snapshot().missileCooldownMs).toBeGreaterThan(0);
    sim.startOrResume();
    expect(sim.snapshot().missileCooldownMs).toBe(0);
    expect(sim.update(16).shots).toHaveLength(0);
  });
});
