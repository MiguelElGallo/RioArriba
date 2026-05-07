import { entitiesForRange } from "./spawner";
import { isInsideRiver, riverBoundsAt, SECTION_LENGTH, WORLD_WIDTH } from "./river";
import { ENTITY_RULES, EntityState, GameSnapshot, InputState, PlayerState, ShotState } from "./types";

const PLAYER_RADIUS = 18;
const FIRE_INTERVAL_MS = 170;
const SHOT_HIT_WIDTH = 72;
const SHOT_HIT_HEIGHT = 34;
const SLOW_SPEED = 95;
const CHARGER_RECHARGE_PER_SECOND = 70;
const RECHARGE_SOUND_INTERVAL_MS = 320;

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
  private message = "HOLD TO STEER - TAP ELSEWHERE TO FIRE";
  private fireCooldownMs = 0;
  private rechargeSoundCooldownMs = 0;
  private frameDt = 0;
  private checkpointY = 80;
  private soundCues: GameSnapshot["soundCues"] = [];

  setInput(next: Partial<InputState>): void {
    this.input = { ...this.input, ...next };
    if (this.state === "ready" && Object.values(next).some(Boolean)) {
      this.state = "playing";
      this.message = "";
    }
    if ((this.state === "crashed" || this.state === "game-over") && next.fire) {
      this.reset(this.state === "game-over");
    }
  }

  update(deltaMs: number): GameSnapshot {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.frameDt = dt;
    this.soundCues = [];
    if (this.state !== "playing") return this.snapshot();

    this.fireCooldownMs = Math.max(0, this.fireCooldownMs - deltaMs);
    this.rechargeSoundCooldownMs = Math.max(0, this.rechargeSoundCooldownMs - deltaMs);
    this.player.invulnerableMs = Math.max(0, this.player.invulnerableMs - deltaMs);
    this.updatePlayer(dt);
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
      entities: [...this.entities.values()].filter((entity) => entity.alive),
      shots: this.shots.filter((shot) => shot.alive).map((shot) => ({ ...shot })),
      score: this.score,
      section: Math.floor(this.player.y / SECTION_LENGTH) + 1,
      level: this.level,
      distance: Math.floor(this.player.y),
      state: this.state,
      message: this.message,
      soundCues: [...this.soundCues]
    };
  }

  private updatePlayer(dt: number): void {
    const targetSpeed = this.input.up ? 265 : this.input.down ? 95 : 165;
    this.player.speed += (targetSpeed - this.player.speed) * Math.min(1, dt * 5);
    const thrust = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.player.vx += thrust * 720 * dt;
    this.player.vx *= Math.pow(0.002, dt);
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.speed * dt;
    this.player.charge -= 5.7 * dt;

    if (this.input.fire && this.fireCooldownMs === 0) {
      this.shots.push({
        id: `spark-${this.shotId++}`,
        x: this.player.x,
        y: this.player.y + 34,
        vx: this.player.vx * 0.18,
        alive: true
      });
      this.fireCooldownMs = FIRE_INTERVAL_MS;
      this.soundCues.push("fire");
    }

    if (this.player.charge <= 0) this.crash("OUT OF CHARGE");
    if (!isInsideRiver(this.player.x, this.player.y, PLAYER_RADIUS)) this.crash("BANK COLLISION");
  }

  private updateShots(dt: number): void {
    for (const shot of this.shots) {
      shot.y += 520 * dt;
      shot.x += shot.vx * dt;
    }
  }

  private updateEntities(dt: number): void {
    for (const entity of this.entities.values()) {
      if (!entity.alive || entity.vx === 0) continue;
      entity.x += entity.vx * dt;
      const bounds = riverBoundsAt(entity.y);
      if (entity.x - entity.w / 2 < bounds.left || entity.x + entity.w / 2 > bounds.right) {
        entity.vx *= -1;
      }
    }
  }

  private resolveCollisions(): void {
    for (const entity of this.entities.values()) {
      if (!entity.alive) continue;

      for (const shot of this.shots) {
        if (!shot.alive) continue;
        if (overlaps(shot.x, shot.y, SHOT_HIT_WIDTH, SHOT_HIT_HEIGHT, entity.x, entity.y, entity.w, entity.h)) {
          shot.alive = false;
          if (ENTITY_RULES[entity.kind].shootable) {
            entity.alive = false;
            this.destroyedEntityIds.add(entity.id);
            this.score += ENTITY_RULES[entity.kind].score;
            if (entity.kind === "gate") {
              const nextLevel = Math.floor(entity.y / SECTION_LENGTH) + 2;
              this.checkpointY = (nextLevel - 1) * SECTION_LENGTH + 80;
              this.level = Math.max(this.level, nextLevel);
              this.message = `LEVEL ${this.level}`;
            }
            this.soundCues.push("hit");
          }
        }
      }

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
    this.soundCues.push("crash");
  }

  private reset(full: boolean): void {
    const lives = full ? 3 : this.player.lives;
    const score = full ? 0 : this.score;
    const level = full ? 1 : this.level;
    this.player = {
      x: WORLD_WIDTH / 2,
      y: full ? 80 : this.checkpointY,
      vx: 0,
      speed: 165,
      charge: 100,
      lives,
      invulnerableMs: 1500
    };
    this.score = score;
    this.level = level;
    this.rechargeSoundCooldownMs = 0;
    this.entities.clear();
    if (full) this.destroyedEntityIds.clear();
    this.shots = [];
    this.soundCues = [];
    this.state = "playing";
    this.message = "";
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
