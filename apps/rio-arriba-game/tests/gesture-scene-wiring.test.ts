import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(new URL("../src/game/MainScene.ts", import.meta.url), "utf8");

describe("gesture scene wiring", () => {
  it("keeps MainScene wired to the tested gesture input adapter", () => {
    expect(sceneSource).toContain("GestureInputController");
    expect(sceneSource).toContain("dragDeadZonePx");
    expect(sceneSource).toContain("isFireZone");
    expect(sceneSource).toContain("this.input.addPointer(2)");
    expect(sceneSource).toContain("mergeInputStates");
    expect(sceneSource).toContain("bindGestureControls()");
    expect(sceneSource).toContain("drawTouchControl()");
    expect(sceneSource).toContain("touchControlVisualState");
    expect(sceneSource).toContain('interactiveTarget.on("pointerdown"');
    expect(sceneSource).toContain('interactiveTarget.on("pointercancel"');
    expect(sceneSource).toContain('document.getElementById("hud")');
  });

  it("preloads designer sprites and gameplay effects through stable scene keys", () => {
    for (const asset of [
      "player-electric-plane.png",
      "enemy-barge.png",
      "enemy-drone.png",
      "enemy-jet.png",
      "charging-station.png",
      "bridge-gate.png",
      "player-shot.png",
      "hit-burst.png",
      "crash-burst.png",
      "recharge-pulse.png"
    ]) {
      expect(sceneSource).toContain(asset);
    }

    expect(sceneSource).toContain("preload(): void");
    expect(sceneSource).toContain("this.load.image");
    expect(sceneSource).toContain("syncEntitySprites");
    expect(sceneSource).toContain("syncShotSprites");
    expect(sceneSource).toContain("playCueEffect");
  });
});
