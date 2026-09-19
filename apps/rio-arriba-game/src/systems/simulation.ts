import { entitiesForRange } from "./spawner";
import { isInsideRiver, riverBoundsAt, SECTION_LENGTH, WORLD_WIDTH } from "./river";
import { ENTITY_RULES, EntityState, GameSnapshot, InputState, PlayerState, ShotState, WEAPON_RULES, WeaponKind } from "./types";

const PLAYER_RADIUS = 18;
const HIT_FLASH_MS = 180;
const SLOW_SPEED = 95;
const CHARGER_RECHARGE_PER_SECOND = 70;
const RECHARGE_SOUND_INTERVAL_MS = 320;
const TOUCH_STEER_GAIN = 12;
const TOUCH_MAX_VX = 285;
const LEVEL_MESSAGE_MS = 1800;

export class Simulation {
  private player: PlayerState = {
    x: WORLD_WIDTH / 2,
    y: 80,
    vx: 0,
    speed: 165,
    charge: 100,
    lives: 3,
    invulnerableMs: 1500
  };

  private input: InputState = { left: false, right: false, up: false, down: false, fire: false };
  private entities = new Map<string, EntityState>();
  private destroyedEntityIds = new Set<string>();
  private shots: ShotState[] = [];
  private shotId = 0;
  private score = 0;
  private level = 1;
  private state: GameSnapshot["state"] = "ready";
  private message = "READY TO FLY";
  private messageTtlMs = 0;
  private fireCooldownMs = 0;
  private missileCooldownMs = 0;
  private shotPreviousPositions = new Map<string, { x: number; y: number }>();
  private rechargeSoundCooldownMs = 0;
  private frameDt = 0;
  private checkpointY = 80;
  private soundCues: GameSnapshot["soundCues"] = [];

  setInput(next: Partial<InputState>): void {
    if (this.state === "paused") return;
    const firePressed = next.fire === true && !this.input.fire;
    this.input = { ...this.input, ...next };
    if (this.state === "ready" && Object.values(next).some(Boolean)) {
      this.state = "playing";
      this.message = "";
      this.messageTtlMs = 0;
    }
    if ((this.state === "crashed" || this.state === "game-over") && firePressed) {
      this.startOrResume();
    }
  }

  startOrResume(): void {
    this.input = { left: false, right: false, up: false, down: false, fire: false };
    if (this.state === "crashed" || this.state === "game-over") {
      this.reset(this.state === "game-over");
    } else if (this.state === "ready" || this.state === "paused") {
      this.state = "playing";
      this.message = "";
      this.messageTtlMs = 0;
      this.ensureEntities();
    }
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.input = { left: false, right: false, up: false, down: false, fire: false };
    this.player.vx = 0;
    this.soundCues = [];
    this.message = "PAUSED";
  }

  update(deltaMs: number): GameSnapshot {
    // Use the same bounded clock for movement, protection, and weapon timers.
    const elapsedMs = Math.max(0, Math.min(50, deltaMs));
    const dt = elapsedMs / 1000;
    this.frameDt = dt;
    this.soundCues = [];
    if (this.state !== "playing") return this.snapshot();

    this.fireCooldownMs = Math.max(0, this.fireCooldownMs - elapsedMs);
    this.missileCooldownMs = Math.max(0, this.missileCooldownMs - elapsedMs);
    this.rechargeSoundCooldownMs = Math.max(0, this.rechargeSoundCooldownMs - elapsedMs);
    this.updateTransientMessage(elapsedMs);
    this.player.invulnerableMs = Math.max(0, this.player.invulnerableMs - elapsedMs);
    this.updatePlayer(dt);
    if (this.state !== "playing") return this.snapshot();
    this.ensureEntities();
    this.updateShots(dt);
    this.updateEntities(dt);
    this.resolveCollisions();
    this.cull();

    return this.snapshot();
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.player },
      entities: [...this.entities.values()].filter((entity) => entity.alive).map((entity) => ({ ...entity })),
      shots: this.shots.filter((shot) => shot.alive).map((shot) => ({ ...shot })),
      score: this.score,
      section: Math.floor(this.player.y / SECTION_LENGTH) + 1,
      level: this.level,
      distance: Math.floor(this.player.y),
      state: this.state,
      message: this.message,
      soundCues: [...this.soundCues],
      missileCooldownMs: this.missileCooldownMs
    };
  }

  private updatePlayer(dt: number): void {
    const targetSpeed = this.input.down ? 95 : this.input.up ? 265 : 165;
    this.player.speed += (targetSpeed - this.player.speed) * (1 - Math.exp(-dt * 5));
    const thrust = Number(this.input.right) - Number(this.input.left);
    if (thrust !== 0) {
      this.player.vx += (thrust * TOUCH_MAX_VX - this.player.vx) * (1 - Math.exp(-dt * 20));
    } else if (this.input.steerTargetX !== undefined) {
      const error = clamp(this.input.steerTargetX, 18, WORLD_WIDTH - 18) - this.player.x;
      const targetVx = clamp(error * TOUCH_STEER_GAIN, -TOUCH_MAX_VX, TOUCH_MAX_VX);
      this.player.vx += (targetVx - this.player.vx) * (1 - Math.exp(-dt * 20));
    } else {
      this.player.vx *= Math.exp(-dt * 30);
    }
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.speed * dt;
    this.player.charge -= 5.7 * dt;

    if (this.input.fire && this.fireCooldownMs === 0) {
      this.fireShot("machine-gun");
      this.fireCooldownMs = WEAPON_RULES["machine-gun"].cooldownMs;
      this.soundCues.push("fire");
    }
    if (this.input.missile && this.missileCooldownMs === 0) {
      this.fireShot("missile");
      this.missileCooldownMs = WEAPON_RULES.missile.cooldownMs;
      this.soundCues.push("missile");
    }

    if (this.player.charge <= 0) this.crash("OUT OF CHARGE");
    if (!isInsideRiver(this.player.x, this.player.y, PLAYER_RADIUS)) this.crash("BANK COLLISION");
  }

  private updateShots(dt: number): void {
    this.shotPreviousPositions.clear();
    for (const shot of this.shots) {
      this.shotPreviousPositions.set(shot.id, { x: shot.x, y: shot.y });
      shot.y += WEAPON_RULES[shot.kind].speed * dt;
      shot.x += shot.vx * dt;
    }
  }

  private fireShot(kind: WeaponKind): void {
    this.shots.push({
      id: `shot-${this.shotId++}`,
      kind,
      x: this.player.x,
      y: this.player.y + 34,
      vx: this.player.vx * 0.18,
      alive: true
    });
  }

  private updateEntities(dt: number): void {
    for (const entity of this.entities.values()) {
      entity.hitFlashMs = Math.max(0, entity.hitFlashMs - dt * 1000);
      if (!entity.alive || entity.vx === 0) continue;
      entity.x += entity.vx * dt;
      const bounds = riverBoundsAt(entity.y);
      if (entity.x - entity.w / 2 < bounds.left || entity.x + entity.w / 2 > bounds.right) {
        entity.vx *= -1;
      }
    }
  }

  private resolveCollisions(): void {
    // Resolve each projectile against its first impact, even when a fast round
    // crosses a target between frames. A projectile can damage only one target.
    for (const shot of this.shots) {
      if (!shot.alive) continue;
      const previous = this.shotPreviousPositions.get(shot.id) ?? shot;
      const weapon = WEAPON_RULES[shot.kind];
      let first: EntityState | undefined;
      let firstTime = Infinity;
      for (const entity of this.entities.values()) {
        if (!entity.alive) continue;
        const impactTime = segmentHitTime(previous, shot, entity, weapon.hitWidth, weapon.hitHeight);
        if (impactTime < firstTime) {
          first = entity;
          firstTime = impactTime;
        }
      }
      if (!first) continue;
      shot.alive = false;
      if (!ENTITY_RULES[first.kind].shootable) continue;
      first.health = Math.max(0, first.health - weapon.damage);
      first.hitFlashMs = HIT_FLASH_MS;
      if (first.health > 0) {
        this.soundCues.push("damage");
        continue;
      }
      first.alive = false;
      this.destroyedEntityIds.add(first.id);
      this.score += ENTITY_RULES[first.kind].score;
      if (first.kind === "gate") {
        const nextLevel = Math.floor(first.y / SECTION_LENGTH) + 2;
        this.checkpointY = (nextLevel - 1) * SECTION_LENGTH + 80;
        this.level = Math.max(this.level, nextLevel);
        this.message = `LEVEL ${this.level}`;
        this.messageTtlMs = LEVEL_MESSAGE_MS;
      }
      this.soundCues.push("hit");
    }

    for (const entity of this.entities.values()) {
      if (!entity.alive) continue;
      if (overlaps(this.player.x, this.player.y, 34, 42, entity.x, entity.y, entity.w, entity.h)) {
        if (ENTITY_RULES[entity.kind].playerContact === "recharge") {
          this.rechargeFromStation();
        } else if (ENTITY_RULES[entity.kind].playerContact === "crash" && this.player.invulnerableMs === 0) {
          this.crash(ENTITY_RULES[entity.kind].collisionMessage ?? "COLLISION");
        }
      }
    }
  }

  private ensureEntities(): void {
    const ahead = entitiesForRange(this.player.y - 200, this.player.y + 1100);
    for (const entity of ahead) {
      if (this.destroyedEntityIds.has(entity.id)) continue;
      if (!this.entities.has(entity.id)) this.entities.set(entity.id, entity);
    }
  }

  private cull(): void {
    for (const [id, entity] of this.entities) {
      if (entity.y < this.player.y - 520 || !entity.alive) this.entities.delete(id);
    }
    this.shots = this.shots.filter((shot) => shot.alive && shot.y < this.player.y + 850);
  }

  private crash(reason: string): void {
    if (this.state !== "playing") return;
    this.player.lives -= 1;
    this.state = this.player.lives <= 0 ? "game-over" : "crashed";
    this.message = this.state === "game-over" ? "GRID OFFLINE" : reason;
    this.messageTtlMs = 0;
    this.soundCues.push("crash");
  }

  private reset(full: boolean): void {
    const lives = full ? 3 : this.player.lives;
    const score = full ? 0 : this.score;
    const level = full ? 1 : this.level;
    if (full) this.checkpointY = 80;
    const bounds = riverBoundsAt(this.checkpointY);
    this.player = {
      x: (bounds.left + bounds.right) / 2,
      y: this.checkpointY,
      vx: 0,
      speed: 165,
      charge: 100,
      lives,
      invulnerableMs: 1500
    };
    this.score = score;
    this.level = level;
    this.rechargeSoundCooldownMs = 0;
    this.fireCooldownMs = 0;
    this.missileCooldownMs = 0;
    this.shotPreviousPositions.clear();
    this.entities.clear();
    if (full) this.destroyedEntityIds.clear();
    this.shots = [];
    this.soundCues = [];
    this.state = "playing";
    this.message = "";
    this.messageTtlMs = 0;
  }

  private updateTransientMessage(deltaMs: number): void {
    if (this.messageTtlMs === 0) return;
    this.messageTtlMs = Math.max(0, this.messageTtlMs - deltaMs);
    if (this.messageTtlMs === 0) this.message = "";
  }

  private rechargeFromStation(): void {
    if (this.player.charge >= 100) return;
    const speedFactor = Math.max(0.72, Math.min(1, SLOW_SPEED / Math.max(SLOW_SPEED, this.player.speed)));
    const gained = CHARGER_RECHARGE_PER_SECOND * speedFactor * this.frameDt;
    this.player.charge = Math.min(100, this.player.charge + gained);
    if (this.rechargeSoundCooldownMs === 0) {
      this.soundCues.push("recharge");
      this.rechargeSoundCooldownMs = RECHARGE_SOUND_INTERVAL_MS;
    }
  }
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function segmentHitTime(from: { x: number; y: number }, to: { x: number; y: number }, entity: EntityState, width: number, height: number): number {
  let entry = 0;
  let exit = 1;
  for (const [axis, halfSize] of [["x", (entity.w + width) / 2], ["y", (entity.h + height) / 2]] as const) {
    const delta = to[axis] - from[axis];
    const near = entity[axis] - halfSize;
    const far = entity[axis] + halfSize;
    if (delta === 0) {
      if (from[axis] <= near || from[axis] >= far) return Infinity;
      continue;
    }
    const a = (near - from[axis]) / delta;
    const b = (far - from[axis]) / delta;
    entry = Math.max(entry, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (entry > exit) return Infinity;
  }
  return entry;
}
