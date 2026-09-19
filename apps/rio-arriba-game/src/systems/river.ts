import { difficultyForSection } from "./difficulty";

export const WORLD_WIDTH = 480;
export const SECTION_LENGTH = 2200;

export interface RiverBounds {
  left: number;
  right: number;
  width: number;
}

export function bridgeYForSection(section: number): number {
  return (section + 1) * SECTION_LENGTH - 120;
}

export function riverBoundsAt(y: number): RiverBounds {
  const section = Math.floor(Math.max(0, y) / SECTION_LENGTH);
  const current = difficultyForSection(section);
  const next = difficultyForSection(section + 1);
  const progress = Math.max(0, y / SECTION_LENGTH - section);
  const blend = progress * progress * (3 - 2 * progress);
  const bend = lerp(current.bendAmplitude, next.bendAmplitude, blend);
  // Continuous phases avoid sudden sideways bank jumps at level boundaries.
  const baseCenter = WORLD_WIDTH / 2 + Math.sin(y * 0.0025) * bend + Math.sin(y * 0.006) * bend * 0.4;
  const baseWidth = lerp(current.riverWidth, next.riverWidth, blend) + Math.sin(y * 0.004) * 8;
  const bridgeFunnel = bridgeFunnelAt(y, section);
  const bridgeWidth = difficultyForSection(bridgeFunnel.section).bridgeWidth;
  const center = lerp(baseCenter, WORLD_WIDTH / 2, bridgeFunnel.strength * 0.58);
  const width = lerp(baseWidth, bridgeWidth, bridgeFunnel.strength);
  const clampedWidth = Math.max(140, Math.min(430, width));
  const clampedCenter = Math.max(20 + clampedWidth / 2, Math.min(WORLD_WIDTH - 20 - clampedWidth / 2, center));
  const left = clampedCenter - clampedWidth / 2;
  const right = clampedCenter + clampedWidth / 2;

  return { left, right, width: right - left };
}

function bridgeFunnelAt(y: number, section: number): { strength: number; section: number } {
  const upcoming = {
    section,
    strength: bridgeFunnelStrength(y, bridgeYForSection(section))
  };
  const previous = {
    section: Math.max(0, section - 1),
    strength: section > 0 ? bridgeFunnelStrength(y, bridgeYForSection(section - 1)) : 0
  };
  return previous.strength > upcoming.strength ? previous : upcoming;
}

function bridgeFunnelStrength(y: number, bridgeY: number): number {
  const distance = Math.abs(y - bridgeY);
  if (distance >= 560) return 0;
  const progress = 1 - distance / 560;
  return progress * progress * (3 - 2 * progress);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function isInsideRiver(x: number, y: number, radius: number): boolean {
  const bounds = riverBoundsAt(y);
  return x - radius > bounds.left && x + radius < bounds.right;
}
