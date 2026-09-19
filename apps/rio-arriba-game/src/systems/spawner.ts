import { difficultyForSection } from "./difficulty";
import { ENTITY_RULES, EntityKind, EntityState } from "./types";
import { SECTION_LENGTH, bridgeYForSection, riverBoundsAt } from "./river";

export const CHARGER_WIDTH = 58;
export const CHARGER_HEIGHT = 160;
const FIRST_ENCOUNTER_Y = 480;
const CHARGER_CLEARANCE = 180;
const BRIDGE_CLEARANCE = 200;

function random(seed: number): number {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
}

export function entitiesForRange(fromY: number, toY: number): EntityState[] {
  const entities: EntityState[] = [];
  const firstSection = Math.max(0, Math.floor(fromY / SECTION_LENGTH));
  const lastSection = Math.max(0, Math.floor(toY / SECTION_LENGTH));

  for (let section = firstSection; section <= lastSection; section++) {
    const difficulty = difficultyForSection(section);
    const start = section * SECTION_LENGTH;
    const bridgeY = bridgeYForSection(section);
    // Guaranteed stations create predictable refuelling opportunities rather
    // than random stretches that can be impossible to finish on one charge.
    for (const [index, offset] of difficulty.chargerOffsets.entries()) {
      const bounds = riverBoundsAt(start + offset);
      const lane = section < 2 ? 0.5 : 0.3 + random(section * 31 + index) * 0.4;
      entities.push(makeEntity(`charger-${section}-${index}`, "charger", start + offset, bounds.left + bounds.width * lane));
    }

    for (let row = 0, offset = FIRST_ENCOUNTER_Y; offset < SECTION_LENGTH; row++, offset += difficulty.encounterSpacing) {
      const y = start + offset;
      const clear = (position: number) => position < bridgeY - BRIDGE_CLEARANCE &&
        difficulty.chargerOffsets.every((charger) => Math.abs(position - start - charger) >= CHARGER_CLEARANCE);
      if (!clear(y)) continue;
      entities.push(threatForRow(section, row, 0, y));
      if (clear(y + 96) && random(section * 83 + row * 43) < difficulty.pairChance) {
        entities.push(threatForRow(section, row, 1, y + 96));
      }
    }

    const bounds = riverBoundsAt(bridgeY);
    const bridge = makeEntity(`gate-${section}`, "gate", bridgeY, (bounds.left + bounds.right) / 2);
    // The bridge spans the opening even in the forgiving first level.
    bridge.w = bounds.width - 24;
    entities.push(bridge);
  }
  return entities.filter((entity) => entity.y >= fromY && entity.y <= toY).sort((a, b) => a.y - b.y);
}

function threatForRow(section: number, row: number, lane: number, y: number): EntityState {
  const difficulty = difficultyForSection(section);
  const roll = random(section * 137 + row * 31 + lane * 97);
  const kind = section === 1 && row === 0 ? "drone" : section === 3 && row === 0 ? "jet" :
    roll < difficulty.jetWeight ? "jet" : roll < difficulty.jetWeight + difficulty.droneWeight ? "drone" : "barge";
  const bounds = riverBoundsAt(y);
  const x = bounds.left + bounds.width * (0.24 + random(section * 17 + row + lane * 23) * 0.52);
  const entity = makeEntity(`threat-${section}-${row}-${lane}`, kind, y, x);
  if (kind !== "barge") {
    entity.vx = (random(section * 7 + row * 29 + lane) > 0.5 ? 1 : -1) * difficulty.crossingSpeed;
  }
  return entity;
}

function makeEntity(id: string, kind: EntityKind, y: number, x: number): EntityState {
  return {
    id, kind, x, y,
    w: kind === "charger" ? CHARGER_WIDTH : kind === "barge" ? 54 : 38,
    h: kind === "charger" ? CHARGER_HEIGHT : kind === "barge" ? 42 : kind === "gate" ? 46 : 34,
    vx: 0, alive: true, health: ENTITY_RULES[kind].maxHealth, hitFlashMs: 0
  };
}
