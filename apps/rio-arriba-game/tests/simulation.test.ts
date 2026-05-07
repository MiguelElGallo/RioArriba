import { describe, expect, it } from "vitest";
import { Simulation } from "../src/systems/simulation";
import { riverBoundsAt, SECTION_LENGTH, WORLD_WIDTH } from "../src/systems/river";
import { CHARGER_HEIGHT, CHARGER_WIDTH, entitiesForRange } from "../src/systems/spawner";
import { ENTITY_RULES, EntityKind, EntityState, InputState, PlayerState, ShotState } from "../src/systems/types";

function setPrivate<T>(simulation: Simulation, key: string, value: T): void {
  (simulation as unknown as Record<string, T>)[key] = value;
}

function startPlaying(sim: Simulation, input: Partial<InputState> = {}): void {
  sim.setInput({ up: true });
  setPrivate(sim, "input", { left: false, right: false, up: false, down: false, fire: false, ...input });
}

function disableGeneratedEntities(sim: Simulation): void {
  (sim as unknown as { ensureEntities: () => void }).ensureEntities = () => {};
}

function entity(kind: EntityKind, overrides: Partial<EntityState> = {}): EntityState {
  return {
    id: `${kind}-test`,
    kind,
    x: WORLD_WIDTH / 2,
    y: 400,
    w: kind === "gate" ? 120 : kind === "barge" ? 54 : kind === "charger" ? CHARGER_WIDTH : 38,
    h: kind === "gate" ? 28 : kind === "barge" ? 42 : kind === "charger" ? CHARGER_HEIGHT : 34,
    vx: 0,
    alive: true,
    ...overrides
  };
}

describe("Simulation", () => {
  it("starts on an actionable ready state", () => {
    const sim = new Simulation();
    const snap = sim.snapshot();
    expect(snap.state).toBe("ready");
    expect(snap.player.charge).toBe(100);
    expect(snap.player.lives).toBe(3);
    expect(snap.level).toBe(1);
  });

  it("drains charge at the same rate at slow and fast speeds", () => {
    const slow = new Simulation();
    slow.setInput({ down: true });
    slow.update(1000);

    const fast = new Simulation();
    fast.setInput({ up: true });
    fast.update(1000);

    expect(slow.snapshot().player.charge).toBeCloseTo(fast.snapshot().player.charge, 4);
  });

  it("spawns electric shots while fire is held", () => {
    const sim = new Simulation();
    sim.setInput({ fire: true });
    const firstShot = sim.update(16);
    expect(firstShot.shots.length).toBe(1);
    expect(firstShot.soundCues).toEqual(["fire"]);
    sim.update(200);
    expect(sim.snapshot().shots.length).toBeGreaterThan(1);
  });

  it("exposes readable shootability rules for every entity kind", () => {
    expect(Object.keys(ENTITY_RULES).sort()).toEqual(["barge", "charger", "drone", "gate", "jet"]);
    for (const [kind, rules] of Object.entries(ENTITY_RULES)) {
      expect(rules.displayName).toMatch(/^[A-Z][a-z]+$/);
      expect(rules.description.length).toBeGreaterThan(10);
      expect(rules.shootable).toBe(true);
      expect(rules.score).toBeGreaterThan(0);
      expect(["crash", "recharge"]).toContain(rules.playerContact);
      expect(rules.playerContact).toBe(kind === "charger" ? "recharge" : "crash");
      if (kind === "gate") expect(rules.collisionMessage).toBe("BRIDGE COLLISION");
    }
  });

  it("fires shots in forward world coordinates so they can hit real targets ahead of the player", () => {
    const sim = new Simulation();
    startPlaying(sim, { fire: true });
    const startY = 400;
    const target = entity("drone", { y: startY + 45 });

    setPrivate(sim, "player", {
      ...sim.snapshot().player,
      x: target.x,
      y: startY,
      invulnerableMs: 0
    });
    setPrivate(sim, "entities", new Map([[target.id, target]]));

    const snap = sim.update(16);

    expect(snap.entities.some((candidate) => candidate.id === target.id)).toBe(false);
    expect(snap.score).toBe(ENTITY_RULES.drone.score);
    expect(snap.soundCues).toEqual(["fire", "hit"]);
  });

  it("gives electric shots enough hit area for practical mobile aiming", () => {
    const sim = new Simulation();
    startPlaying(sim);
    const target = entity("barge", { x: WORLD_WIDTH / 2 + 55, y: 500 });
    const shot: ShotState = { id: "shot-test", x: WORLD_WIDTH / 2, y: target.y, vx: 0, alive: true };

    setPrivate(sim, "entities", new Map([[target.id, target]]));
    setPrivate(sim, "shots", [shot]);

    const snap = sim.update(0);

    expect(snap.entities.some((candidate) => candidate.id === target.id)).toBe(false);
    expect(snap.soundCues).toEqual(["hit"]);
  });

  it.each(Object.keys(ENTITY_RULES) as EntityKind[])("lets shots destroy shootable %s entities for their rule score", (kind) => {
    const sim = new Simulation();
    startPlaying(sim);
    const target = entity(kind, { y: 620 });
    const shot: ShotState = { id: "shot-test", x: target.x, y: target.y, vx: 0, alive: true };

    setPrivate(sim, "entities", new Map([[target.id, target]]));
    setPrivate(sim, "shots", [shot]);

    const snap = sim.update(0);

    expect(snap.entities.some((candidate) => candidate.id === target.id)).toBe(false);
    expect(snap.shots.some((candidate) => candidate.id === shot.id)).toBe(false);
    expect(snap.score).toBe(ENTITY_RULES[kind].score);
    expect(snap.soundCues).toEqual(["hit"]);
  });

  it("levels up and checkpoints after a bridge is destroyed", () => {
    const sim = new Simulation();
    startPlaying(sim);
    const bridge = entitiesForRange(2000, 2300).find((candidate) => candidate.kind === "gate");
    expect(bridge).toBeDefined();
    const shot: ShotState = { id: "shot-test", x: bridge!.x, y: bridge!.y, vx: 0, alive: true };

    setPrivate(sim, "entities", new Map([[bridge!.id, bridge!]]));
    setPrivate(sim, "shots", [shot]);

    const snap = sim.update(0);

    expect(snap.level).toBe(2);
    expect(snap.message).toBe("LEVEL 2");
    expect(snap.score).toBe(ENTITY_RULES.gate.score);
  });

  it("restarts after the last destroyed bridge when a life remains", () => {
    const sim = new Simulation();
    startPlaying(sim);
    const bridge = entitiesForRange(2000, 2300).find((candidate) => candidate.kind === "gate");
    expect(bridge).toBeDefined();
    const shot: ShotState = { id: "shot-test", x: bridge!.x, y: bridge!.y, vx: 0, alive: true };

    setPrivate(sim, "entities", new Map([[bridge!.id, bridge!]]));
    setPrivate(sim, "shots", [shot]);
    sim.update(0);
    setPrivate(sim, "player", { ...sim.snapshot().player, x: WORLD_WIDTH / 2, y: 2400, charge: 0.01, invulnerableMs: 0 });
    expect(sim.update(16).state).toBe("crashed");
    expect(sim.snapshot().player.lives).toBe(2);

    sim.setInput({ fire: true });

    expect(sim.snapshot().state).toBe("playing");
    expect(sim.snapshot().player.y).toBe(SECTION_LENGTH + 80);
    expect(sim.snapshot().level).toBe(2);
    expect(sim.snapshot().player.lives).toBe(2);
    expect(sim.snapshot().score).toBe(ENTITY_RULES.gate.score);
  });

  it("does not respawn a destroyed generated entity while its spawn range remains visible", () => {
    const sim = new Simulation();
    const target = entitiesForRange(200, 1200).find((candidate) => candidate.kind !== "charger");
    expect(target).toBeDefined();
    const playerY = target!.y - 200;
    const playerBounds = riverBoundsAt(playerY);
    const shot: ShotState = { id: "shot-test", x: target!.x, y: target!.y, vx: 0, alive: true };

    startPlaying(sim);
    setPrivate(sim, "player", {
      ...sim.snapshot().player,
      x: (playerBounds.left + playerBounds.right) / 2,
      y: playerY,
      invulnerableMs: 0
    });
    setPrivate(sim, "entities", new Map([[target!.id, { ...target! }]]));
    setPrivate(sim, "shots", [shot]);

    expect(sim.update(0).entities.some((candidate) => candidate.id === target!.id)).toBe(false);
    expect(sim.update(16).entities.some((candidate) => candidate.id === target!.id)).toBe(false);
  });

  it("recharges over time without consuming the charging station", () => {
    const sim = new Simulation();
    sim.setInput({ fire: true });
    sim.setInput({ fire: false });
    const player: PlayerState = {
      ...sim.snapshot().player,
      x: WORLD_WIDTH / 2,
      y: 400,
      charge: 40,
      invulnerableMs: 0
    };
    const charger: EntityState = {
      id: "charger-test",
      kind: "charger",
      x: player.x,
      y: player.y,
      w: CHARGER_WIDTH,
      h: CHARGER_HEIGHT,
      vx: 0,
      alive: true
    };

    setPrivate(sim, "player", player);
    setPrivate(sim, "entities", new Map([[charger.id, charger]]));
    setPrivate(sim, "input", { left: false, right: false, up: false, down: false, fire: false });
    disableGeneratedEntities(sim);

    sim.update(100);
    const afterFirstPickup = sim.snapshot();
    sim.update(100);
    const afterSecondFrame = sim.snapshot();

    expect(afterFirstPickup.player.charge).toBeGreaterThan(40);
    expect(afterSecondFrame.player.charge).toBeGreaterThan(afterFirstPickup.player.charge);
    expect(afterSecondFrame.entities.some((entity) => entity.id === charger.id)).toBe(true);
  });

  it("recharges more at slow speed and caps charge at full", () => {
    const normal = rechargeFrom(40, {}, 165, 1000).player.charge;
    const slow = rechargeFrom(40, { down: true }, 95, 1000).player.charge;

    expect(normal).toBeGreaterThan(40);
    expect(slow).toBeGreaterThan(normal + 10);
    expect(rechargeFrom(90, { down: true }, 95, 1000).player.charge).toBe(100);
  });

  it("lets a full slow pass through a long charger restore enough charge to cap at full", () => {
    const sim = new Simulation();
    startPlaying(sim, { down: true });
    const charger = entity("charger", { y: 520 });
    const startY = charger.y - charger.h / 2 - 21;
    setPrivate(sim, "player", { ...sim.snapshot().player, x: charger.x, y: startY, speed: 95, charge: 1, invulnerableMs: 0 });
    setPrivate(sim, "entities", new Map([[charger.id, charger]]));
    disableGeneratedEntities(sim);

    for (let elapsed = 0; elapsed < 2100; elapsed += 50) sim.update(50);

    const snap = sim.snapshot();
    expect(snap.player.y).toBeGreaterThan(charger.y + charger.h / 2);
    expect(snap.player.charge).toBe(100);
  });

  it("emits recharge intermittently while overlapping and clears sound cues on quiet updates", () => {
    const sim = new Simulation();
    startPlaying(sim);
    const charger = entity("charger");
    setPrivate(sim, "player", { ...sim.snapshot().player, x: charger.x, y: charger.y, charge: 50 });
    setPrivate(sim, "entities", new Map([[charger.id, charger]]));
    disableGeneratedEntities(sim);

    expect(sim.update(50).soundCues).toEqual(["recharge"]);
    expect(sim.update(50).soundCues).toEqual([]);
    expect(sim.update(320).soundCues).toEqual(["recharge"]);
  });

  it("reports bridge collision message and sound when the player hits a gate", () => {
    const sim = new Simulation();
    startPlaying(sim);
    const bridge = entity("gate");
    setPrivate(sim, "player", { ...sim.snapshot().player, x: bridge.x, y: bridge.y, invulnerableMs: 0 });
    setPrivate(sim, "entities", new Map([[bridge.id, bridge]]));

    const snap = sim.update(0);

    expect(snap.state).toBe("crashed");
    expect(snap.message).toBe("BRIDGE COLLISION");
    expect(snap.soundCues).toEqual(["crash"]);
  });

  it("crashes when charge is exhausted", () => {
    const sim = new Simulation();
    startPlaying(sim);
    setPrivate(sim, "player", { ...sim.snapshot().player, x: WORLD_WIDTH / 2, y: 400, charge: 0.01, invulnerableMs: 0 });

    const snap = sim.update(16);

    expect(snap.state).toBe("crashed");
    expect(snap.message).toBe("OUT OF CHARGE");
    expect(snap.soundCues).toEqual(["crash"]);
    expect(sim.update(16).soundCues).toEqual([]);
  });

  it("enters game over when the last displayed cell is lost", () => {
    const sim = new Simulation();
    sim.setInput({ fire: true });
    sim.setInput({ fire: false });
    const player: PlayerState = {
      ...sim.snapshot().player,
      x: WORLD_WIDTH / 2,
      y: 400,
      lives: 1,
      invulnerableMs: 0
    };
    const obstacle: EntityState = {
      id: "barge-test",
      kind: "barge",
      x: player.x,
      y: player.y,
      w: 54,
      h: 42,
      vx: 0,
      alive: true
    };

    setPrivate(sim, "player", player);
    setPrivate(sim, "entities", new Map([[obstacle.id, obstacle]]));

    sim.update(16);

    expect(sim.snapshot().state).toBe("game-over");
    expect(sim.snapshot().player.lives).toBe(0);
  });

  it("starts a full new game with three lives after game over", () => {
    const sim = new Simulation();
    startPlaying(sim);
    const obstacle = entity("barge");

    setPrivate(sim, "player", { ...sim.snapshot().player, x: obstacle.x, y: obstacle.y, lives: 1, invulnerableMs: 0 });
    setPrivate(sim, "entities", new Map([[obstacle.id, obstacle]]));
    expect(sim.update(0).state).toBe("game-over");

    sim.setInput({ fire: true });

    expect(sim.snapshot().state).toBe("playing");
    expect(sim.snapshot().player.lives).toBe(3);
    expect(sim.snapshot().level).toBe(1);
  });
});

function rechargeFrom(charge: number, input: Partial<InputState>, speed: number, totalMs: number) {
  const sim = new Simulation();
  startPlaying(sim, input);
  const charger = entity("charger");
  setPrivate(sim, "player", { ...sim.snapshot().player, x: charger.x, y: charger.y, speed, charge });
  setPrivate(sim, "entities", new Map([[charger.id, charger]]));
  disableGeneratedEntities(sim);
  let snap = sim.snapshot();
  for (let elapsed = 0; elapsed < totalMs; elapsed += 50) snap = sim.update(50);
  return snap;
}
