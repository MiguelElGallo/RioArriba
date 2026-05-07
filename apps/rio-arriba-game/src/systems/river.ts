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
  const center =
    WORLD_WIDTH / 2 +
    Math.sin(phase) * 55 +
    Math.sin(y * 0.0021 + section * 1.7) * 44;
  const difficulty = Math.min(120, section * 12);
  const width =
    292 -
    difficulty +
    Math.sin(y * 0.004 + 2.3) * 34 +
    Math.sin(y * 0.011) * 16;
  const clampedWidth = Math.max(132, Math.min(344, width));
  const left = Math.max(20, center - clampedWidth / 2);
  const right = Math.min(WORLD_WIDTH - 20, center + clampedWidth / 2);

  return { left, right, width: right - left };
}

export function isInsideRiver(x: number, y: number, radius: number): boolean {
  const bounds = riverBoundsAt(y);
  return x - radius > bounds.left && x + radius < bounds.right;
}
