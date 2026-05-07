# Mobile River Raid QA Checklist

Use this as the first QA gate for the mobile-first electric-plane browser game. Keep each pass tied to a specific build, viewport, and input mode.

## Critical Smoke

- Game boots to a playable first screen without requiring desktop-only controls.
- First touch, pointer, or keyboard input starts or resumes play predictably.
- Main loop keeps updating after orientation changes, tab blur, and tab focus.
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
- Recharge pickups increase energy once per pickup and cannot double-trigger after collection.
- Boost, firing, or special abilities consume energy according to visible rules.
- Empty-energy behavior is clear and does not create an unrecoverable soft lock.
- Collision with terrain, enemies, bridges, and pickups matches visible sprites or shapes.

## Responsive Automation Targets

Add automated checks once the app structure exists:

- Build command completes without warnings promoted to errors.
- Unit tests cover frame-rate independent energy drain and pickup collection.
- Simulation tests cover collision boundaries for river edge, obstacle, bridge, and recharge pickup.
- Playwright smoke test boots the app, verifies a nonblank canvas, starts gameplay, pauses, restarts, and captures screenshots at the mobile viewports above.
- Screenshot check confirms HUD and touch controls stay inside the viewport and outside the central forward path.

## Evidence To Capture

- One screenshot before start, one during normal play, one paused, one game-over, and one after restart.
- Console log summary from the same run.
- Viewport dimensions, device scale factor, browser, commit SHA, and build command used.
