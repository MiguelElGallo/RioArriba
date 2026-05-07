export const WORLD_WIDTH = 480;
export const SECTION_LENGTH = 2200;

export interface RiverBounds {
  left: number;
  right: number;
  width: number;
}

export function riverBoundsAt(y: number): RiverBounds {
  const section = Math.floor(Math.max(0, y) / SECTION_LENGTH);
  const phase = y * 0.006;
  const baseCenter =
    WORLD_WIDTH / 2 +
    Math.sin(phase) * 55 +
    Math.sin(y * 0.0021 + section * 1.7) * 44;
  const difficulty = Math.min(240, section * 26);
  const baseWidth =
    394 -
    difficulty +
    Math.sin(y * 0.004 + 2.3) * 28 +
    Math.sin(y * 0.011) * 14;
  const bridgeFunnel = bridgeFunnelAt(y, section);
  const bridgeWidth = Math.max(140, 166 - bridgeFunnel.section * 6);
  const center = lerp(baseCenter, WORLD_WIDTH / 2, bridgeFunnel.strength * 0.58);
  const width = lerp(baseWidth, bridgeWidth, bridgeFunnel.strength);
  const clampedWidth = Math.max(118, Math.min(430, width));
  const left = Math.max(20, center - clampedWidth / 2);
  const right = Math.min(WORLD_WIDTH - 20, center + clampedWidth / 2);

  return { left, right, width: right - left };
}

function bridgeFunnelAt(y: number, section: number): { strength: number; section: number } {
  const upcoming = {
    section,
    strength: bridgeFunnelStrength(y, (section + 1) * SECTION_LENGTH - 120)
  };
  const previous = {
    section: Math.max(0, section - 1),
    strength: section > 0 ? bridgeFunnelStrength(y, section * SECTION_LENGTH - 120) : 0
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
