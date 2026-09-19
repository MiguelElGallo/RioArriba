import Phaser from "phaser";
import { MainScene } from "./game/MainScene";
import { ENTITY_RULES } from "./systems/types";
import type { EntityKind } from "./systems/types";
import "./styles/global.css";

function viewportSize(): { width: number; height: number } {
  // Keep the entire river and at least 540 world units of forward view visible.
  const zoom = Math.min(1, window.innerWidth / 480, window.innerHeight / 540);
  return { width: window.innerWidth / zoom, height: window.innerHeight / zoom };
}

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 480,
  height: 820,
  backgroundColor: "#071718",
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    ...viewportSize()
  },
  render: {
    pixelArt: false,
    antialias: true
  }
});

window.addEventListener("resize", () => {
  const { width, height } = viewportSize();
  game.scale.setGameSize(width, height);
});

const infoOrder: EntityKind[] = ["charger", "barge", "drone", "jet", "gate"];
const infoList = document.getElementById("info-list");
if (infoList) {
  infoList.replaceChildren(
    ...infoOrder.map((kind) => {
      const rules = ENTITY_RULES[kind];
      const row = document.createElement("article");
      row.className = "info-row";

      const icon = document.createElement("span");
      icon.className = `info-icon ${kind}`;
      icon.setAttribute("aria-hidden", "true");

      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${rules.displayName} - ${rules.score} pts`;
      const description = document.createElement("p");
      description.textContent = rules.description;

      text.append(title, description);
      row.append(icon, text);
      return row;
    })
  );
}

const infoToggle = document.getElementById("info-toggle");
const infoPanel = document.getElementById("info-panel");
const infoClose = document.getElementById("info-close");

function setInfoVisible(visible: boolean): void {
  if (!infoToggle || !infoPanel) return;
  infoPanel.hidden = !visible;
  infoToggle.setAttribute("aria-expanded", String(visible));
  for (const id of ["session-controls", "flight-panel", "touch-controls"]) {
    const element = document.getElementById(id);
    if (element) element.inert = visible;
  }
  if (visible) {
    window.dispatchEvent(new Event("flight-help"));
    infoClose?.focus();
  } else {
    infoToggle.focus();
  }
}

infoToggle?.addEventListener("click", () => setInfoVisible(infoPanel?.hidden ?? true));
infoClose?.addEventListener("click", () => setInfoVisible(false));
document.addEventListener("keydown", (event) => {
  if (infoPanel?.hidden === false && event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    setInfoVisible(false);
  }
  if (infoPanel?.hidden === false && event.key === "Tab") {
    event.preventDefault();
    infoClose?.focus();
  }
});
