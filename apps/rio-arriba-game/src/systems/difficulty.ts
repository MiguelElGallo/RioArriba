export interface LevelDifficulty {
  riverWidth: number;
  bridgeWidth: number;
  bendAmplitude: number;
  encounterSpacing: number;
  droneWeight: number;
  jetWeight: number;
  pairChance: number;
  crossingSpeed: number;
  chargerOffsets: readonly number[];
}

// Introduce navigation, moving targets, then combined pressure. Level 10 is
// the ceiling: endless play must not shrink the river into an impossible lane.
const LEVELS: readonly LevelDifficulty[] = [
  { riverWidth: 420, bridgeWidth: 320, bendAmplitude: 10, encounterSpacing: 350, droneWeight: 0, jetWeight: 0, pairChance: 0, crossingSpeed: 28, chargerOffsets: [820, 1520] },
  { riverWidth: 388, bridgeWidth: 286, bendAmplitude: 20, encounterSpacing: 320, droneWeight: 0.3, jetWeight: 0, pairChance: 0, crossingSpeed: 32, chargerOffsets: [820, 1520] },
  { riverWidth: 356, bridgeWidth: 250, bendAmplitude: 30, encounterSpacing: 310, droneWeight: 0.5, jetWeight: 0, pairChance: 0.12, crossingSpeed: 36, chargerOffsets: [820, 1520] },
  { riverWidth: 326, bridgeWidth: 220, bendAmplitude: 40, encounterSpacing: 300, droneWeight: 0.4, jetWeight: 0.15, pairChance: 0.2, crossingSpeed: 40, chargerOffsets: [1280] },
  { riverWidth: 298, bridgeWidth: 194, bendAmplitude: 48, encounterSpacing: 250, droneWeight: 0.4, jetWeight: 0.25, pairChance: 0.28, crossingSpeed: 44, chargerOffsets: [1280] },
  { riverWidth: 274, bridgeWidth: 176, bendAmplitude: 55, encounterSpacing: 235, droneWeight: 0.4, jetWeight: 0.3, pairChance: 0.34, crossingSpeed: 48, chargerOffsets: [1280] },
  { riverWidth: 252, bridgeWidth: 164, bendAmplitude: 60, encounterSpacing: 225, droneWeight: 0.4, jetWeight: 0.35, pairChance: 0.4, crossingSpeed: 52, chargerOffsets: [1280] },
  { riverWidth: 232, bridgeWidth: 152, bendAmplitude: 64, encounterSpacing: 220, droneWeight: 0.4, jetWeight: 0.4, pairChance: 0.44, crossingSpeed: 56, chargerOffsets: [1280] },
  { riverWidth: 214, bridgeWidth: 144, bendAmplitude: 68, encounterSpacing: 215, droneWeight: 0.4, jetWeight: 0.42, pairChance: 0.48, crossingSpeed: 60, chargerOffsets: [1280] },
  { riverWidth: 200, bridgeWidth: 140, bendAmplitude: 70, encounterSpacing: 210, droneWeight: 0.4, jetWeight: 0.45, pairChance: 0.5, crossingSpeed: 64, chargerOffsets: [1280] }
];

export function difficultyForSection(section: number): LevelDifficulty {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, Math.floor(section)))];
}
