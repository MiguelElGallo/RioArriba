# Rio Arriba Asset Handoff

Place final icon and sprite files in:

`apps/rio-arriba-game/src/assets/designer-handoff/icons/`

The game is mobile-first and runs in a 480px-wide Phaser canvas that scales to the device screen. Assets must read clearly on a phone while moving vertically.

## Required Format

- Preferred delivery: `PNG` with transparent background.
- Optional source files: `SVG`, `AI`, `Figma`, or layered `PSD`.
- Color space: `sRGB`.
- Export scale: provide `1x` and `2x` PNGs when possible.
- File naming: lowercase kebab-case, matching the names below.
- Do not include baked-in drop shadows that extend far beyond the canvas; soft glows are fine if transparent.
- Keep each asset centered in its canvas with consistent visual padding.

## Canvas Sizes

Gameplay sprites:

- Player plane/drone: `128x128` PNG.
- Barge: `96x96` PNG.
- Drone enemy: `96x96` PNG.
- Jet enemy: `96x96` PNG.
- Charging station: `96x192` PNG, vertical format.
- Bridge/gate: `256x96` PNG, horizontal format.
- Player shot/projectile: `32x64` PNG.
- Explosion/hit burst: `128x128` PNG.
- Recharge effect: `128x128` PNG.

Info/HUD icons:

- Export each as `64x64` PNG.
- These should visually match the gameplay sprites but be simpler and centered.

## Gameplay Restrictions

- Top-down view only.
- Strong silhouette is more important than fine detail.
- Avoid tiny text inside the image; it will be unreadable on mobile.
- Avoid using only green/red to communicate meaning; combine color with shape.
- Player should look electric/futuristic, more like a sleek electric plane or large drone than a traditional prop plane.
- Charging station must look beneficial and electrical, not like an obstacle.
- Bridge must read as a bridge/gate that should be shot, not something to fly over.
- Enemy categories must be visually distinct at small size:
  - Barge: river surface craft.
  - Drone: rotor/floating aircraft.
  - Jet: fast sharp aircraft.
- Keep the actual object inside the central 80% of the canvas so collision boxes can stay fair.

## Required Asset List

Gameplay sprites:

- `player-electric-plane.png`
- `enemy-barge.png`
- `enemy-drone.png`
- `enemy-jet.png`
- `charging-station.png`
- `bridge-gate.png`
- `player-shot.png`
- `hit-burst.png`
- `crash-burst.png`
- `recharge-pulse.png`

Info/HUD icons:

- `icon-player-electric-plane.png`
- `icon-charger.png`
- `icon-barge.png`
- `icon-drone.png`
- `icon-jet.png`
- `icon-bridge-gate.png`
- `icon-charge-cell.png`
- `icon-life-cell.png`
- `icon-fire.png`
- `icon-slow.png`
- `icon-fast.png`

Optional nice-to-have:

- `river-water-tile.png` at `256x256`, seamless if possible.
- `river-bank-tile.png` at `256x256`, seamless if possible.
- `warning-bridge.png` at `128x64`.
- `game-over-mark.png` at `256x128`.

## Review Checklist

Before delivery, verify:

- Every PNG has transparency.
- All required filenames are exact.
- Icons remain readable at `32x32`.
- Gameplay sprites remain readable at `48x48`.
- Bridge and charger are not visually confused with enemies.
- Player has a clear nose/top direction.
- No asset depends on a dark rectangular background.
