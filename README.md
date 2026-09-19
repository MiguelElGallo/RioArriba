# Rio Arriba

## Play the game

Open the published game here:

[https://miguelelgallo.github.io/RioArriba/](https://miguelelgallo.github.io/RioArriba/)

Rio Arriba is a mobile-first arcade river shooter inspired by the original
[River Raid](https://en.wikipedia.org/wiki/River_Raid).

You fly an electric plane up a winding river.

You steer through narrow channels, destroy enemies, recharge before your energy
runs out, and break bridges to move to the next level.

The first river is wide with gentle bends, single barges, and two chargers near
the center. Level 2 introduces drones; level 3 adds occasional paired threats;
jets arrive in level 4. Each level gradually narrows the river and increases the
bends and encounter pressure.

Bridge passages also tighten progressively: 320 world units in level 1, 220 in
level 4, and 140 in level 10. The banks change smoothly between levels and open
up again after each bridge. Difficulty reaches its ceiling at level 10; later
runs keep that challenge with varied encounters.

The first three levels have two guaranteed chargers each; later levels have one.
Clear space around chargers and bridge approaches gives you time to refuel and aim.
See [the difficulty progression](docs/difficulty-progression.md) for the tuning table.

## Icons and points

These are the main things you see in the game.

| Icon | Name | Points | What it means |
| --- | --- | ---: | --- |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-player-electric-plane.png" width="40" alt="Electric plane icon"> | Electric plane | - | This is you. Keep it inside the river and protect your charge. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-charger.png" width="40" alt="Charger icon"> | Charger | 80 | Fly over it slowly to recharge over time. You can also shoot it for points. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-barge.png" width="40" alt="Barge icon"> | Barge | 30 | A river craft. 3 gun hits or 1 missile. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-drone.png" width="40" alt="Drone icon"> | Drone | 60 | A crossing aircraft threat. 2 gun hits or 1 missile. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-jet.png" width="40" alt="Jet icon"> | Jet | 100 | A faster aircraft threat. 2 gun hits or 1 missile. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-bridge-gate.png" width="40" alt="Bridge icon"> | Bridge | 500 | 3 gun hits or 1 missile to level up. Hitting it crashes the plane. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-life-cell.png" width="40" alt="Life cell icon"> | Life cell | - | You start with 3 lives. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-fire.png" width="40" alt="Gun icon"> | Machine gun | - | Hold GUN or Space for fast, continuous rounds. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-slow.png" width="40" alt="Slow icon"> | Slow | - | Slow down to steer carefully and recharge more. |
| <img src="apps/rio-arriba-game/src/assets/designer-handoff/icons/icon-fast.png" width="40" alt="Fast icon"> | Fast | - | Speed up when the river is open. |

Choose **Start flight** or press `Enter` to begin.

On touch screens, drag anywhere on the playfield to steer relative to where you
put your finger down. Lift and place it again to recenter your hand. Hold the
visible **GUN** button with another finger to shoot. Tap **MISSILE** for a heavy
shot, or hold it to launch again after reloading. Drag up/down, or hold
**FAST/SLOW**, to change speed. Releasing speed controls returns to cruise.

On a keyboard, use the arrow keys or `WASD` to steer and change speed. Hold
`Space` for the machine gun and use `X` for missiles. Release both weapons and slow down over a charger to recharge without
destroying it.

The gun fires gold rounds at 900 world units/second, with a 0.1-second interval.
Missiles travel at the original 520 units/second, destroy a target in one hit,
and have a 1.5-second cooldown. Both weapons can fire together; gunfire remains
available while missiles reload. The missile button and HUD show the remaining
cooldown and **READY** when reloaded.

Enemies flash when hit. An amber tint persists after damage, and the small health
marks above each enemy show how many gun hits remain. Points and bridge progress
are awarded only on destruction. Chargers still break in one hit from either weapon.

Use **Pause** or `P` / `Esc` to pause and resume. Opening help, switching away
from the game, or resizing/rotating the screen pauses an active flight. Resume
explicitly when ready. After a crash, choose **Retry checkpoint** or press
`Enter`; after game over, choose **Play again**. Holding fire through a crash
does not automatically spend another life.

## Run it locally

First, install the dependencies from the game folder:

```bash
cd apps/rio-arriba-game
npm install
```

Then start the local server:

```bash
npm run dev
```

Open the URL printed by Vite.

By default, it is:

```text
http://localhost:5173/
```

You can also run the checks:

```bash
npm test
npm run build
```

Browser checks cover seven phone, tablet, and desktop sizes, two-finger touch,
pause/resume, rotation, crash/restart, both weapons, visible damage, and missile reload:

```bash
npx playwright install chromium
npm run test:e2e
```

To use an installed Chrome instead, run `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.
Screenshots and failure traces are written to `apps/rio-arriba-game/test-results/`
(ignored by Git).

The implemented improvement plan is in [docs/playability-plan.md](docs/playability-plan.md).

The game is built with Phaser, TypeScript, and Vite.
