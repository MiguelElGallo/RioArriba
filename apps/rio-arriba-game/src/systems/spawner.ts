import { EntityState } from "./types";
import { SECTION_LENGTH, riverBoundsAt } from "./river";

export const SPAWN_ROW_SPACING = 260;
export const FIRST_SECTION_CHARGER_CHANCE = 0.74;
export const CHARGER_CHANCE_DECAY_PER_SECTION = 0.07;
export const MIN_CHARGER_CHANCE = 0.18;
export const CHARGER_ROW_STRIDE_START_SECTION = 2;
export const CHARGER_ROW_STRIDE_SECTION_STEP = 2;
export const MAX_CHARGER_ROW_STRIDE = 5;
export const FIRST_SECTION_BARGE_WEIGHT = 0.34;
export const MIN_BARGE_WEIGHT = 0.12;
export const FIRST_SECTION_JET_WEIGHT = 0.28;
export const MAX_JET_WEIGHT = 0.52;
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
  return Math.min(MAX_CHARGER_ROW_STRIDE, 1 + Math.floor(progressedSections / CHARGER_ROW_STRIDE_SECTION_STEP));
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

    if (Math.abs(y - bridgeY) < 120) {
      entities.push({
        id: idFor(row, 0, "gate"),
        kind: "gate",
        x: (bounds.left + bounds.right) / 2,
        y,
        w: Math.min(170, room - 34),
        h: 28,
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
    } else {
      const threatRoll = random(row * 31 + section * 11);
      const weights = threatWeightsForSection(section);
      const kind = threatRoll < weights.barge ? "barge" : threatRoll < weights.barge + weights.drone ? "drone" : "jet";
      const w = kind === "barge" ? 54 : 38;
      entities.push({
        id: idFor(row, 0, kind),
        kind,
        x: bounds.left + room * (0.18 + random(row + 13) * 0.64),
        y,
        w,
        h: kind === "barge" ? 42 : 34,
        vx: kind === "barge" ? 0 : (random(row + 29) > 0.5 ? 42 : -42) * (1 + section * 0.08),
        alive: true
      });
    }
  }

  return entities;
}
