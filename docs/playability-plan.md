# Playability and controls plan

## Goal

Make the first flight understandable, steering predictable, and interruptions
recoverable on phones and keyboards, while preserving the river, enemies,
charging rules, and artwork.

## Improvements

1. **Steering and input.** Replace sustained sideways acceleration with a bounded
   target velocity and strong release braking. Give keyboard directions priority
   over a stationary touch target. Keep relative touch steering, including the
   return to the original finger position, and support WASD alongside arrows.
2. **Visible touch controls.** Replace the invisible right-side firing region
   with a labeled FIRE button. Allow steering drags throughout the playfield.
   Keep simultaneous steering/firing and provide separate SLOW/FAST buttons with
   held feedback, pointer capture, cancellation, and release handling.
3. **Flight lifecycle.** Provide start, pause, resume, checkpoint retry, and new-run
   actions. Pause when help opens, focus is lost, the tab is hidden, or the screen
   resizes. Require explicit resume, and clear stale controls. A held fire input
   must not restart after a crash.
4. **Readability and fairness.** Fit the full river width and a minimum forward
   view on small screens. Show control instructions, speed mode, and numeric low
   charge feedback. Spawn retries at the checkpoint's river center; clear old
   checkpoint and weapon cooldown state on a new run. Use the same bounded frame
   time for movement and timers.
5. **Verification.** Extend simulation and gesture regressions. Run the production
   build and browser checks at 320×568, 390×844, 430×932, 844×390, 768×1024,
   1024×768, and 1440×900. Exercise actual simultaneous touch events, keyboard
   steering/firing, help, pause/resume, rotation, and all three lives.

## Acceptance

- Release drift stays below ten world units in the steering regression.
- The complete 480-unit river fits, with at least 540 vertical world units visible.
- Touch buttons stay inside the viewport and are at least 44 CSS pixels square.
- Paused flight cannot move or drain charge; help never resumes it automatically.
- Holding fire cannot skip a crash screen or a game-over score.
- A full restart cannot inherit an earlier run's checkpoint.
- Unit tests, build, and browser checks pass, with screenshots for visual review.

## Follow-up playtesting

Automation verifies mechanics and layout, not subjective comfort. Check thumb
reach and steering sensitivity on physical iOS and Android devices, especially
landscape and notched screens. Tune sensitivity from those sessions before
considering extra control modes or difficulty changes.

## Verification result — 2026-09-19

- 70 unit tests passed.
- TypeScript and the production build passed. Vite still reports the large
  Phaser bundle warning.
- 10 Chrome browser tests passed across all seven viewport sizes, including
  actual multitouch events, cancellation, held keys across pause, rotation,
  crash recovery, and game over. The viewport smoke checks reported no page errors.
- Reviewed screenshots for phone portrait, narrow phone, and phone landscape.
  Physical iOS/Android playtesting remains a follow-up.
