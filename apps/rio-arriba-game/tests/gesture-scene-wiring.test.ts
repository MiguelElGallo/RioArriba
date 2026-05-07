import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(new URL("../src/game/MainScene.ts", import.meta.url), "utf8");

describe("gesture scene wiring", () => {
  it("keeps MainScene wired to the tested gesture input adapter", () => {
    expect(sceneSource).toContain("GestureInputController");
    expect(sceneSource).toContain("joystickDeadZonePx");
    expect(sceneSource).toContain("this.input.addPointer(2)");
    expect(sceneSource).toContain("mergeInputStates");
    expect(sceneSource).toContain("bindGestureControls()");
    expect(sceneSource).toContain("drawJoystick()");
    expect(sceneSource).toContain("joystickVisualState()");
    expect(sceneSource).toContain('interactiveTarget.on("pointerdown"');
    expect(sceneSource).toContain('interactiveTarget.on("pointercancel"');
    expect(sceneSource).toContain('document.getElementById("hud")');
  });
});
