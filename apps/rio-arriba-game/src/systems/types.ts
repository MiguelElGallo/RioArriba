export type EntityKind = "barge" | "drone" | "jet" | "charger" | "gate";
export type SoundCue = "fire" | "missile" | "damage" | "hit" | "crash" | "recharge";
export type WeaponKind = "machine-gun" | "missile";

export const WEAPON_RULES = {
  "machine-gun": { speed: 900, damage: 1, cooldownMs: 100, hitWidth: 40, hitHeight: 18 },
  missile: { speed: 520, damage: 3, cooldownMs: 1500, hitWidth: 72, hitHeight: 34 }
} as const;

export interface EntityRules {
  displayName: string;
  description: string;
  shootable: boolean;
  score: number;
  maxHealth: number;
  playerContact: "crash" | "recharge";
  collisionMessage?: string;
}

export const ENTITY_RULES: Record<EntityKind, EntityRules> = {
  barge: { displayName: "Barge", description: "River craft. 3 gun hits or 1 missile.", shootable: true, score: 30, maxHealth: 3, playerContact: "crash" },
  drone: { displayName: "Drone", description: "Crossing aircraft. 2 gun hits or 1 missile.", shootable: true, score: 60, maxHealth: 2, playerContact: "crash" },
  charger: {
    displayName: "Charger",
    description: "Fly over slowly to recharge over time. Shoot for points.",
    shootable: true,
    score: 80,
    maxHealth: 1,
    playerContact: "recharge"
  },
  jet: { displayName: "Jet", description: "Fast aircraft. 2 gun hits or 1 missile.", shootable: true, score: 100, maxHealth: 2, playerContact: "crash" },
  gate: {
    displayName: "Bridge",
    description: "3 gun hits or 1 missile. Destroy to level up.",
    shootable: true,
    score: 500,
    maxHealth: 3,
    playerContact: "crash",
    collisionMessage: "BRIDGE COLLISION"
  }
};

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  missile?: boolean;
  steerTargetX?: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  speed: number;
  charge: number;
  lives: number;
  invulnerableMs: number;
}

export interface EntityState {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  alive: boolean;
  health: number;
  hitFlashMs: number;
}

export interface ShotState {
  id: string;
  kind: WeaponKind;
  x: number;
  y: number;
  vx: number;
  alive: boolean;
}

export interface GameSnapshot {
  player: PlayerState;
  entities: EntityState[];
  shots: ShotState[];
  score: number;
  section: number;
  level: number;
  distance: number;
  state: "ready" | "playing" | "paused" | "crashed" | "game-over";
  message: string;
  soundCues: SoundCue[];
  missileCooldownMs: number;
}
