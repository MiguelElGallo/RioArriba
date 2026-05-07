import { EntityState } from "./types";
import { SECTION_LENGTH, riverBoundsAt } from "./river";

export const SPAWN_ROW_SPACING = 230;
export const FIRST_SECTION_CHARGER_CHANCE = 0.9;
export const CHARGER_CHANCE_DECAY_PER_SECTION = 0.065;
export const MIN_CHARGER_CHANCE = 0.16;
export const CHARGER_ROW_STRIDE_START_SECTION = 0;
export const CHARGER_ROW_STRIDE_SECTION_STEP = 2;
export const MAX_CHARGER_ROW_STRIDE = 6;
export const MIN_CHARGER_ROW_GAP = 2;
export const FIRST_SECTION_BARGE_WEIGHT = 0.34;
export const MIN_BARGE_WEIGHT = 0.12;
export const FIRST_SECTION_JET_WEIGHT = 0.28;
export const MAX_JET_WEIGHT = 0.52;
export const FIRST_SECTION_SECONDARY_THREAT_CHANCE = 0.3;
export const MAX_SECONDARY_THREAT_CHANCE = 0.72;
export const CHARGER_WIDTH = 58;
export const CHARGER_HEIGHT = 160;

export interface ThreatWeights {
  barge: number;
  drone: number;
  jet: number;
}

function random(seed: number): number {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
}

export function chargerChanceForSection(section: number): number {
  return Math.max(MIN_CHARGER_CHANCE, FIRST_SECTION_CHARGER_CHANCE - Math.max(0, section) * CHARGER_CHANCE_DECAY_PER_SECTION);
}

export function chargerRowStrideForSection(section: number): number {
  const progressedSections = Math.max(0, section - CHARGER_ROW_STRIDE_START_SECTION);
  return Math.min(MAX_CHARGER_ROW_STRIDE, MIN_CHARGER_ROW_GAP + Math.floor(progressedSections / CHARGER_ROW_STRIDE_SECTION_STEP));
}

export function rowCanSpawnCharger(row: number, section: number): boolean {
  const stride = chargerRowStrideForSection(section);
  return row % stride === section % stride;
}

export function threatWeightsForSection(section: number): ThreatWeights {
  const safeSection = Math.max(0, section);
  const barge = Math.max(MIN_BARGE_WEIGHT, FIRST_SECTION_BARGE_WEIGHT - safeSection * 0.028);
  const jet = Math.min(MAX_JET_WEIGHT, FIRST_SECTION_JET_WEIGHT + safeSection * 0.03);
  return {
    barge,
    drone: Math.max(0, 1 - barge - jet),
    jet
  };
}

export function secondaryThreatChanceForSection(section: number): number {
  return Math.min(MAX_SECONDARY_THREAT_CHANCE, FIRST_SECTION_SECONDARY_THREAT_CHANCE + Math.max(0, section) * 0.055);
}

function idFor(row: number, lane: number, kind: string): string {
  return `${kind}-${row}-${lane}`;
}

export function entitiesForRange(fromY: number, toY: number): EntityState[] {
  const firstRow = Math.max(1, Math.floor(fromY / SPAWN_ROW_SPACING));
  const lastRow = Math.ceil(toY / SPAWN_ROW_SPACING);
  const entities: EntityState[] = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    const y = row * SPAWN_ROW_SPACING;
    const section = Math.floor(y / SECTION_LENGTH);
    const bridgeY = (section + 1) * SECTION_LENGTH - 120;
    const bounds = riverBoundsAt(y);
    const room = bounds.right - bounds.left;
    const chargerThreshold = 1 - chargerChanceForSection(section);
    const roll = random(row * 17 + section * 5);

    if (Math.abs(y - bridgeY) < 130) {
      entities.push({
        id: idFor(row, 0, "gate"),
        kind: "gate",
        x: (bounds.left + bounds.right) / 2,
        y,
        w: Math.min(230, room - 24),
        h: 46,
        vx: 0,
        alive: true
      });
      continue;
    }

    if (rowCanSpawnCharger(row, section) && roll > chargerThreshold) {
      entities.push({
        id: idFor(row, 0, "charger"),
        kind: "charger",
        x: bounds.left + room * (0.24 + random(row) * 0.52),
        y,
        w: CHARGER_WIDTH,
        h: CHARGER_HEIGHT,
        vx: 0,
        alive: true
      });
      continue;
    }

    entities.push(threatForRow(row, section, 0, y, bounds.left, room, 0));
    if (random(row * 43 + section * 19) < secondaryThreatChanceForSection(section)) {
      entities.push(threatForRow(row, section, 1, y + 92, bounds.left, room, 1));
    }
  }

  return entities;
}

function threatForRow(
  row: number,
  section: number,
  lane: number,
  y: number,
  left: number,
  room: number,
  seedOffset: number
): EntityState {
  const threatRoll = random(row * 31 + section * 11 + seedOffset * 97);
  const weights = threatWeightsForSection(section);
  const kind = threatRoll < weights.barge ? "barge" : threatRoll < weights.barge + weights.drone ? "drone" : "jet";
  const w = kind === "barge" ? 54 : 38;
  return {
    id: idFor(row, lane, kind),
    kind,
    x: left + room * (0.16 + random(row + 13 + seedOffset * 23) * 0.68),
    y,
    w,
    h: kind === "barge" ? 42 : 34,
    vx: kind === "barge" ? 0 : (random(row + 29 + seedOffset * 31) > 0.5 ? 44 : -44) * (1 + section * 0.08),
    alive: true
  };
}
