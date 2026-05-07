import { InputState } from "./types";

export const EMPTY_INPUT_STATE: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false
};

export interface GesturePointer {
  pointerId: number;
  x: number;
  y: number;
  timeMs: number;
}

export interface GestureInputOptions {
  joystickDeadZonePx?: number;
  joystickRadiusPx?: number;
  dragThresholdPx?: number;
  firePulseMs?: number;
  tapMaxMs?: number;
}

export interface JoystickVisualState {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
  radius: number;
}

interface DragPointer {
  pointerId: number;
  startX: number;
  startY: number;
  startTimeMs: number;
  x: number;
  y: number;
}

const DEFAULT_JOYSTICK_DEAD_ZONE_PX = 10;
const DEFAULT_JOYSTICK_RADIUS_PX = 42;
const DEFAULT_FIRE_PULSE_MS = 150;
const DEFAULT_TAP_MAX_MS = 220;

export function mergeInputStates(...states: Array<Partial<InputState> | undefined>): InputState {
  return states.reduce<InputState>(
    (merged, state) => ({
      left: merged.left || state?.left === true,
      right: merged.right || state?.right === true,
      up: merged.up || state?.up === true,
      down: merged.down || state?.down === true,
      fire: merged.fire || state?.fire === true
    }),
    { ...EMPTY_INPUT_STATE }
  );
}

export class GestureInputController {
  private readonly joystickDeadZonePx: number;
  private readonly joystickRadiusPx: number;
  private readonly firePulseMs: number;
  private readonly tapMaxMs: number;
  private dragPointer: DragPointer | null = null;
  private firePulseUntilMs = 0;

  constructor(options: GestureInputOptions = {}) {
    this.joystickDeadZonePx =
      options.joystickDeadZonePx ?? options.dragThresholdPx ?? DEFAULT_JOYSTICK_DEAD_ZONE_PX;
    this.joystickRadiusPx = options.joystickRadiusPx ?? DEFAULT_JOYSTICK_RADIUS_PX;
    this.firePulseMs = options.firePulseMs ?? DEFAULT_FIRE_PULSE_MS;
    this.tapMaxMs = options.tapMaxMs ?? DEFAULT_TAP_MAX_MS;
  }

  pointerDown(pointer: GesturePointer): InputState {
    if (!this.dragPointer) {
      this.dragPointer = {
        pointerId: pointer.pointerId,
        startX: pointer.x,
        startY: pointer.y,
        startTimeMs: pointer.timeMs,
        x: pointer.x,
        y: pointer.y
      };
      return this.stateAt(pointer.timeMs);
    }

    if (this.dragPointer.pointerId !== pointer.pointerId) {
      this.firePulseUntilMs = Math.max(this.firePulseUntilMs, pointer.timeMs + this.firePulseMs);
    }

    return this.stateAt(pointer.timeMs);
  }

  pointerMove(pointer: GesturePointer): InputState {
    if (this.dragPointer?.pointerId === pointer.pointerId) {
      this.dragPointer = {
        ...this.dragPointer,
        x: pointer.x,
        y: pointer.y
      };
    }

    return this.stateAt(pointer.timeMs);
  }

  pointerUp(pointer: GesturePointer): InputState {
    if (this.dragPointer?.pointerId === pointer.pointerId) {
      if (this.isPrimaryTap(pointer)) {
        this.firePulseUntilMs = Math.max(this.firePulseUntilMs, pointer.timeMs + this.firePulseMs);
      }
      this.dragPointer = null;
    }

    return this.stateAt(pointer.timeMs);
  }

  pointerCancel(pointer: GesturePointer): InputState {
    if (this.dragPointer?.pointerId === pointer.pointerId) {
      this.dragPointer = null;
    }

    return this.stateAt(pointer.timeMs);
  }

  cancelAll(timeMs: number): InputState {
    this.dragPointer = null;
    this.firePulseUntilMs = 0;
    return this.stateAt(timeMs);
  }

  stateAt(timeMs: number): InputState {
    const dragInput = this.dragPointer ? this.dragInput() : EMPTY_INPUT_STATE;
    return {
      ...dragInput,
      fire: timeMs < this.firePulseUntilMs
    };
  }

  joystickVisualState(): JoystickVisualState {
    if (!this.dragPointer) {
      return {
        active: false,
        originX: 0,
        originY: 0,
        knobX: 0,
        knobY: 0,
        radius: this.joystickRadiusPx
      };
    }

    const { x, y } = this.clampedKnobOffset();
    return {
      active: true,
      originX: this.dragPointer.startX,
      originY: this.dragPointer.startY,
      knobX: this.dragPointer.startX + x,
      knobY: this.dragPointer.startY + y,
      radius: this.joystickRadiusPx
    };
  }

  private dragInput(): InputState {
    if (!this.dragPointer) return { ...EMPTY_INPUT_STATE };

    const dx = this.dragPointer.x - this.dragPointer.startX;
    const dy = this.dragPointer.y - this.dragPointer.startY;

    return {
      left: dx <= -this.joystickDeadZonePx,
      right: dx >= this.joystickDeadZonePx,
      up: dy <= -this.joystickDeadZonePx,
      down: dy >= this.joystickDeadZonePx,
      fire: false
    };
  }

  private isPrimaryTap(pointer: GesturePointer): boolean {
    if (!this.dragPointer) return false;
    const dx = pointer.x - this.dragPointer.startX;
    const dy = pointer.y - this.dragPointer.startY;
    const distance = Math.hypot(dx, dy);
    return distance < this.joystickDeadZonePx && pointer.timeMs - this.dragPointer.startTimeMs <= this.tapMaxMs;
  }

  private clampedKnobOffset(): { x: number; y: number } {
    if (!this.dragPointer) return { x: 0, y: 0 };
    const dx = this.dragPointer.x - this.dragPointer.startX;
    const dy = this.dragPointer.y - this.dragPointer.startY;
    const distance = Math.hypot(dx, dy);
    if (distance <= this.joystickRadiusPx) return { x: dx, y: dy };
    const scale = this.joystickRadiusPx / distance;
    return { x: dx * scale, y: dy * scale };
  }
}
