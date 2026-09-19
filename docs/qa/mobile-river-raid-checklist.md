# Mobile River Raid QA Checklist

Use this as the first QA gate for the mobile-first electric-plane browser game. Keep each pass tied to a specific build, viewport, and input mode.

## Critical Smoke

- Game boots to a playable first screen without requiring desktop-only controls.
- Start flight / Enter starts play; Resume flight / P / Esc explicitly resumes.
- Orientation changes and tab blur pause play; focus alone never resumes it.
- Pause, crash, out-of-energy, restart, and game-over states are reachable and recoverable.
- No console errors during boot, gameplay, pause, restart, or resize.

## Mobile Viewports

Test at least:

- `390x844` iPhone portrait
- `430x932` large phone portrait
- `844x390` phone landscape
- `768x1024` tablet portrait
- `1024x768` tablet landscape

Checks:

- Canvas fills the intended play area without cropping the plane, river lanes, HUD, or controls.
- Safe-area insets do not hide HUD, menus, or touch controls.
- HUD does not cover upcoming obstacles, fuel gates, enemies, or river edges.
- Text remains readable without viewport-width font scaling.
- Restart and pause controls are reachable with one thumb in portrait.

## Gameplay Readability

- Player plane silhouette is visible over river, land, bridge, enemy, and explosion colors.
- Fuel or battery pickups are distinguishable from hazards at mobile size.
- Incoming obstacles are visible early enough for touch steering reaction time.
- Hit feedback is clear without hiding the next navigational decision.
- Score, distance, energy, and current state are legible during motion.
- Visual effects do not obscure narrow channels or bridge gaps.

## Controls

- Touch steering works from both left and right sides if the design supports it.
- Holding touch input does not trigger browser scroll, zoom, text selection, or pull-to-refresh.
- Multitouch does not wedge steering, pause, fire, or boost state.
- Keyboard controls remain available for desktop QA.
- Input state resets when the game pauses, loses focus, or restarts.

## Electric-Plane Rules

- Energy drain is tied to time or distance consistently, not frame rate.
- Chargers refill over time while overlapping; slow flight restores more charge, capped at 100%.
- Boost, firing, or special abilities consume energy according to visible rules.
- Empty-energy behavior is clear and does not create an unrecoverable soft lock.
- Collision with terrain, enemies, bridges, and pickups matches visible sprites or shapes.

## Weapons and Damage

- Hold GUN / Space for fast gold rounds. Drones and jets take 2 hits; barges and bridges take 3.
- MISSILE / X launches a distinct slower projectile, destroying a target in one hit.
- Missile reload lasts 1.5 seconds of active play. Gunfire continues during reload.
- The missile button and HUD show the countdown and READY; quick taps launch reliably.
- A tap during reload does not queue a later launch. Holding launches again when ready.
- Surviving enemies flash on impact and retain an amber tint and depleted health marks.
- Score and bridge checkpoints change only on destruction, once per target.
- Pause freezes reload; resume clears held weapons; retry restores a ready missile.
- Touch cancellation clears both weapons without a stuck firing state.

## Responsive Automation Targets

Run `npm test`, `npm run build`, and `npm run test:e2e` from the game folder:

- Build command completes without warnings promoted to errors.
- Unit tests cover frame-rate independent energy drain and sustained recharging.
- Simulation tests cover collision boundaries for river edge, obstacle, bridge, and recharge pickup.
- Playwright smoke test boots the app, verifies a nonblank canvas, starts gameplay, pauses, restarts, and captures screenshots at the mobile viewports above.
- Screenshot check confirms HUD and touch controls stay inside the viewport and outside the central forward path.

## Evidence To Capture

- One screenshot before start, one during normal play, one paused, one game-over, and one after restart.
- Console log summary from the same run.
- Viewport dimensions, device scale factor, browser, commit SHA, and build command used.
