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
  playerX?: number;
  isFireZone?: boolean;
}

export interface GestureInputOptions {
  dragDeadZonePx?: number;
  speedThresholdPx?: number;
  steerScale?: number;
  dragThresholdPx?: number;
  firePulseMs?: number;
  tapMaxMs?: number;
}

export interface TouchControlVisualState {
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
  targetX?: number;
  fireActive: boolean;
}

interface DragPointer {
  pointerId: number;
  startX: number;
  startY: number;
  startPlayerX: number;
  startTimeMs: number;
  x: number;
  y: number;
}

const DEFAULT_DRAG_DEAD_ZONE_PX = 8;
const DEFAULT_SPEED_THRESHOLD_PX = 42;
const DEFAULT_STEER_SCALE = 1.12;
const DEFAULT_FIRE_PULSE_MS = 150;
const DEFAULT_TAP_MAX_MS = 220;

export function mergeInputStates(...states: Array<Partial<InputState> | undefined>): InputState {
  return states.reduce<InputState>(
    (merged, state) => ({
      left: merged.left || state?.left === true,
      right: merged.right || state?.right === true,
      up: merged.up || state?.up === true,
      down: merged.down || state?.down === true,
      fire: merged.fire || state?.fire === true,
      steerTargetX: state?.steerTargetX ?? merged.steerTargetX
    }),
    { ...EMPTY_INPUT_STATE }
  );
}

export class GestureInputController {
  private readonly dragDeadZonePx: number;
  private readonly speedThresholdPx: number;
  private readonly steerScale: number;
  private readonly firePulseMs: number;
  private readonly tapMaxMs: number;
  private dragPointer: DragPointer | null = null;
  private firePointerIds = new Set<number>();
  private firePulseUntilMs = 0;

  constructor(options: GestureInputOptions = {}) {
    this.dragDeadZonePx = options.dragDeadZonePx ?? options.dragThresholdPx ?? DEFAULT_DRAG_DEAD_ZONE_PX;
    this.speedThresholdPx = options.speedThresholdPx ?? DEFAULT_SPEED_THRESHOLD_PX;
    this.steerScale = options.steerScale ?? DEFAULT_STEER_SCALE;
    this.firePulseMs = options.firePulseMs ?? DEFAULT_FIRE_PULSE_MS;
    this.tapMaxMs = options.tapMaxMs ?? DEFAULT_TAP_MAX_MS;
  }

  pointerDown(pointer: GesturePointer): InputState {
    if (pointer.isFireZone) {
      this.firePointerIds.add(pointer.pointerId);
      this.firePulseUntilMs = Math.max(this.firePulseUntilMs, pointer.timeMs + this.firePulseMs);
      return this.stateAt(pointer.timeMs);
    }

    if (!this.dragPointer) {
      this.dragPointer = {
        pointerId: pointer.pointerId,
        startX: pointer.x,
        startY: pointer.y,
        startPlayerX: pointer.playerX ?? pointer.x,
        startTimeMs: pointer.timeMs,
        x: pointer.x,
        y: pointer.y
      };
      return this.stateAt(pointer.timeMs);
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
    this.firePointerIds.delete(pointer.pointerId);
    if (this.dragPointer?.pointerId === pointer.pointerId) {
      this.dragPointer = null;
    }

    return this.stateAt(pointer.timeMs);
  }

  pointerCancel(pointer: GesturePointer): InputState {
    this.firePointerIds.delete(pointer.pointerId);
    if (this.dragPointer?.pointerId === pointer.pointerId) {
      this.dragPointer = null;
    }

    return this.stateAt(pointer.timeMs);
  }

  cancelAll(timeMs: number): InputState {
    this.dragPointer = null;
    this.firePointerIds.clear();
    this.firePulseUntilMs = 0;
    return this.stateAt(timeMs);
  }

  stateAt(timeMs: number): InputState {
    const dragInput = this.dragPointer ? this.dragInput() : EMPTY_INPUT_STATE;
    return {
      ...dragInput,
      fire: this.firePointerIds.size > 0 || timeMs < this.firePulseUntilMs
    };
  }

  touchControlVisualState(timeMs = 0): TouchControlVisualState {
    if (!this.dragPointer) {
      return {
        active: false,
        originX: 0,
        originY: 0,
        x: 0,
        y: 0,
        fireActive: this.firePointerIds.size > 0 || timeMs < this.firePulseUntilMs
      };
    }

    const input = this.dragInput();
    return {
      active: true,
      originX: this.dragPointer.startX,
      originY: this.dragPointer.startY,
      x: this.dragPointer.x,
      y: this.dragPointer.y,
      targetX: input.steerTargetX,
      fireActive: this.firePointerIds.size > 0 || timeMs < this.firePulseUntilMs
    };
  }

  joystickVisualState(): TouchControlVisualState {
    return this.touchControlVisualState();
  }

  private dragInput(): InputState {
    if (!this.dragPointer) return { ...EMPTY_INPUT_STATE };

    const dx = this.dragPointer.x - this.dragPointer.startX;
    const dy = this.dragPointer.y - this.dragPointer.startY;
    const steerTargetX =
      Math.abs(dx) >= this.dragDeadZonePx ? this.dragPointer.startPlayerX + dx * this.steerScale : undefined;

    const input: InputState = {
      left: false,
      right: false,
      up: dy <= -this.speedThresholdPx,
      down: dy >= this.speedThresholdPx,
      fire: false
    };
    if (steerTargetX !== undefined) input.steerTargetX = steerTargetX;
    return input;
  }
}
