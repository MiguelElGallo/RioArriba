# Level difficulty progression

The opening level teaches steering, aiming, and charging with room to make
mistakes. Later levels combine narrower channels, stronger bends, moving targets,
and more encounters. Flight controls, player speed, weapons, damage, and recharge
rates are unchanged.

| Level | Typical average river width | Bridge passage | Introduction | Chargers |
| --- | ---: | ---: | --- | ---: |
| 1 | 392 | 320 | Gentle bends, single barges, clear runway | 2 |
| 2 | 354 | 286 | First drone, wider spacing between threats | 2 |
| 3 | 322 | 250 | More drones, occasional paired threats | 2 |
| 4 | 292 | 220 | First jet, more moving targets | 1 |
| 5 | 265 | 194 | Tighter bends, more combined threats | 1 |
| 6 | 243 | 176 | Faster crossings | 1 |
| 7 | 224 | 164 | More precise navigation | 1 |
| 8 | 207 | 152 | Narrower channels and denser encounters | 1 |
| 9 | 192 | 144 | Stronger bends and crossing pressure | 1 |
| 10+ | About 185 | 140 | Capped challenge, varied encounters | 1 |

Widths are world units on the 480-unit playfield. Average widths are rounded
samples from the first ten generated levels; individual bends and approaches
vary. River geometry blends continuously between profiles instead of jumping
sideways at a level boundary. Difficulty settings live together in
`apps/rio-arriba-game/src/systems/difficulty.ts`.

Each section has exactly one bridge at its funnel center. The opening bridge
spans its wider river, so the objective remains to destroy it. After a bridge,
the channel reopens before the next approach. Enemies stay clear of chargers and
bridge approaches; late levels never remove all charging opportunities.

The first encounter starts 400 world units ahead of a checkpoint spawn. Chargers
sit near the river center in the first two levels, then require more deliberate
positioning. Their maximum spacing uses less than 80% of a full charge at cruise
speed; slowing down over them still matters.

Regression checks cover monotonically narrowing early levels, smooth boundaries,
navigable minimum widths, capped late difficulty, staged enemy introductions,
recharge spacing, bridge alignment, and deterministic spawn queries. Browser
screenshots compare the bridge approaches in levels 1, 4, and 10.
