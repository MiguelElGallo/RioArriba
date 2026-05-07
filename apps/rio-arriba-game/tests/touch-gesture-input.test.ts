import { describe, expect, it } from "vitest";
import { EMPTY_INPUT_STATE, GestureInputController, mergeInputStates } from "../src/systems/touchGestureInput";

describe("GestureInputController", () => {
  it("keeps the first pointer idle until it crosses the drag threshold", () => {
    const input = new GestureInputController({ dragThresholdPx: 20 });

    expect(input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0 })).toEqual(EMPTY_INPUT_STATE);
    expect(input.pointerMove({ pointerId: 1, x: 119, y: 81, timeMs: 16 })).toEqual(EMPTY_INPUT_STATE);
  });

  it("maps relative horizontal drag to a steering target and vertical drag to speed", () => {
    const input = new GestureInputController({ dragThresholdPx: 20, speedThresholdPx: 20, steerScale: 1 });

    input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0, playerX: 240 });

    expect(input.pointerMove({ pointerId: 1, x: 130, y: 70, timeMs: 16 })).toEqual({
      left: false,
      right: false,
      up: true,
      down: false,
      fire: false,
      steerTargetX: 270
    });

    expect(input.pointerMove({ pointerId: 1, x: 70, y: 130, timeMs: 32 })).toEqual({
      left: false,
      right: false,
      up: false,
      down: true,
      fire: false,
      steerTargetX: 210
    });
  });

  it("ignores non-primary pointer movement for steering", () => {
    const input = new GestureInputController({ dragThresholdPx: 20 });

    input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0 });
    input.pointerDown({ pointerId: 2, x: 300, y: 300, timeMs: 10 });

    expect(input.pointerMove({ pointerId: 2, x: 40, y: 40, timeMs: 16 })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: false
    });
  });

  it("fires a pulse when a second pointer taps the fire zone while the first pointer controls direction", () => {
    const input = new GestureInputController({ dragThresholdPx: 20, firePulseMs: 120, steerScale: 1 });

    input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0, playerX: 240 });
    input.pointerMove({ pointerId: 1, x: 130, y: 100, timeMs: 16 });

    expect(input.pointerDown({ pointerId: 2, x: 220, y: 180, timeMs: 20, isFireZone: true })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: true,
      steerTargetX: 270
    });
    expect(input.pointerUp({ pointerId: 2, x: 220, y: 180, timeMs: 24 }).fire).toBe(true);
    expect(input.stateAt(139).fire).toBe(true);
    expect(input.stateAt(140).fire).toBe(false);
  });

  it("ignores a second pointer outside the fire zone while the first pointer steers", () => {
    const input = new GestureInputController({ dragDeadZonePx: 8, firePulseMs: 120 });

    expect(input.pointerDown({ pointerId: 1, x: 96, y: 520, timeMs: 0 })).toEqual(EMPTY_INPUT_STATE);

    expect(input.pointerDown({ pointerId: 2, x: 360, y: 260, timeMs: 40 })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: false
    });
  });

  it("uses small drag movement for target steering and exposes touch visual state", () => {
    const input = new GestureInputController({ dragDeadZonePx: 8, speedThresholdPx: 8, steerScale: 1 });

    input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0, playerX: 240 });
    expect(input.pointerMove({ pointerId: 1, x: 109, y: 91, timeMs: 16 })).toEqual({
      left: false,
      right: false,
      up: true,
      down: false,
      fire: false,
      steerTargetX: 249
    });

    input.pointerMove({ pointerId: 1, x: 160, y: 100, timeMs: 32 });
    expect(input.touchControlVisualState()).toEqual({
      active: true,
      originX: 100,
      originY: 100,
      x: 160,
      y: 100,
      targetX: 300,
      fireActive: false
    });
  });

  it("fires from the right-side fire zone without taking steering ownership", () => {
    const input = new GestureInputController({ dragDeadZonePx: 8, firePulseMs: 120 });

    expect(input.pointerDown({ pointerId: 1, x: 340, y: 640, timeMs: 0, isFireZone: true })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: true
    });
    expect(input.pointerMove({ pointerId: 1, x: 210, y: 620, timeMs: 20 })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: true
    });
    expect(input.stateAt(300).fire).toBe(true);
    expect(input.pointerUp({ pointerId: 1, x: 210, y: 620, timeMs: 320 }).fire).toBe(false);
  });

  it("keeps steering active while a right-side fire pointer is held", () => {
    const input = new GestureInputController({ dragDeadZonePx: 8, firePulseMs: 120, steerScale: 1 });

    input.pointerDown({ pointerId: 1, x: 90, y: 600, timeMs: 0, playerX: 240 });
    input.pointerMove({ pointerId: 1, x: 120, y: 600, timeMs: 16 });

    expect(input.pointerDown({ pointerId: 2, x: 340, y: 620, timeMs: 20, isFireZone: true })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: true,
      steerTargetX: 270
    });
    expect(input.pointerUp({ pointerId: 2, x: 340, y: 620, timeMs: 40 })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: true,
      steerTargetX: 270
    });
  });

  it("does not fire on a quick steering-zone tap", () => {
    const input = new GestureInputController({ dragThresholdPx: 20, firePulseMs: 120, tapMaxMs: 180 });

    input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0 });

    expect(input.pointerUp({ pointerId: 1, x: 106, y: 104, timeMs: 80 })).toEqual({
      left: false,
      right: false,
      up: false,
      down: false,
      fire: false
    });
  });

  it("does not fire when the primary pointer drag crosses the dead zone", () => {
    const input = new GestureInputController({ dragThresholdPx: 20, firePulseMs: 120, tapMaxMs: 180 });

    input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0 });
    input.pointerMove({ pointerId: 1, x: 130, y: 100, timeMs: 16 });

    expect(input.pointerUp({ pointerId: 1, x: 130, y: 100, timeMs: 80 })).toEqual(EMPTY_INPUT_STATE);
  });

  it("resets directional input when the controlling pointer releases or cancels", () => {
    const released = new GestureInputController({ dragThresholdPx: 20 });
    released.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0 });
    released.pointerMove({ pointerId: 1, x: 130, y: 70, timeMs: 16 });

    expect(released.pointerUp({ pointerId: 1, x: 130, y: 70, timeMs: 32 })).toEqual(EMPTY_INPUT_STATE);

    const canceled = new GestureInputController({ dragThresholdPx: 20 });
    canceled.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0 });
    canceled.pointerMove({ pointerId: 1, x: 70, y: 130, timeMs: 16 });

    expect(canceled.pointerCancel({ pointerId: 1, x: 70, y: 130, timeMs: 32 })).toEqual(EMPTY_INPUT_STATE);
  });

  it("resets every active gesture on cancelAll", () => {
    const input = new GestureInputController({ dragThresholdPx: 20, firePulseMs: 120 });

    input.pointerDown({ pointerId: 1, x: 100, y: 100, timeMs: 0 });
    input.pointerMove({ pointerId: 1, x: 130, y: 70, timeMs: 16 });
    input.pointerDown({ pointerId: 2, x: 220, y: 180, timeMs: 20 });

    expect(input.cancelAll(24)).toEqual(EMPTY_INPUT_STATE);
  });
});

describe("mergeInputStates", () => {
  it("combines keyboard, touch button, and gesture states without mutating inputs", () => {
    const keyboard = { left: true, right: false, up: false, down: false, fire: false };
    const gesture = { left: false, right: true, up: true, down: false, fire: false, steerTargetX: 260 };
    const buttons = { fire: true };

    expect(mergeInputStates(keyboard, gesture, buttons)).toEqual({
      left: true,
      right: true,
      up: true,
      down: false,
      fire: true,
      steerTargetX: 260
    });
    expect(keyboard).toEqual({ left: true, right: false, up: false, down: false, fire: false });
  });

  it("treats undefined and partial states as inactive controls", () => {
    expect(mergeInputStates(undefined, { down: true })).toEqual({
      left: false,
      right: false,
      up: false,
      down: true,
      fire: false
    });
  });
});
