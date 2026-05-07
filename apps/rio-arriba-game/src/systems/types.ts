export type EntityKind = "barge" | "drone" | "jet" | "charger" | "gate";
export type SoundCue = "fire" | "hit" | "crash" | "recharge";

export interface EntityRules {
  displayName: string;
  description: string;
  shootable: boolean;
  score: number;
  playerContact: "crash" | "recharge";
  collisionMessage?: string;
}

export const ENTITY_RULES: Record<EntityKind, EntityRules> = {
  barge: { displayName: "Barge", description: "River craft. Shoot it or avoid it.", shootable: true, score: 30, playerContact: "crash" },
  drone: { displayName: "Drone", description: "Rotor aircraft crossing the river.", shootable: true, score: 60, playerContact: "crash" },
  charger: {
    displayName: "Charger",
    description: "Fly over slowly to recharge over time. Shoot for points.",
    shootable: true,
    score: 80,
    playerContact: "recharge"
  },
  jet: { displayName: "Jet", description: "Fast aircraft threat.", shootable: true, score: 100, playerContact: "crash" },
  gate: {
    displayName: "Bridge",
    description: "Destroy to finish the river and level up.",
    shootable: true,
    score: 500,
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
}

export interface ShotState {
  id: string;
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
  state: "ready" | "playing" | "crashed" | "game-over";
  message: string;
  soundCues: SoundCue[];
}
