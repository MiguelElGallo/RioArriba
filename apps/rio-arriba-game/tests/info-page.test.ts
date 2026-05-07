import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENTITY_RULES } from "../src/systems/types";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

describe("info page", () => {
  it("exposes an accessible icons and points panel", () => {
    expect(html).toContain('id="info-toggle"');
    expect(html).toContain('aria-controls="info-panel"');
    expect(html).toContain('id="info-panel"');
    expect(html).toContain("Icons & Points");

    for (const rules of Object.values(ENTITY_RULES)) {
      expect(rules.displayName).toMatch(/^[A-Z][a-z]+$/);
      expect(rules.description.length).toBeGreaterThan(10);
      expect(rules.score).toBeGreaterThan(0);
    }
  });

  it("binds the info panel controls at runtime", () => {
    expect(mainSource).toContain('document.getElementById("info-panel")');
    expect(mainSource).toContain('document.getElementById("info-list")');
    expect(mainSource).toContain('addEventListener("click"');
  });

  it("includes a final game-over score screen", () => {
    expect(html).toContain('id="game-over-panel"');
    expect(html).toContain('id="final-score"');
    expect(html).toContain("Tap to restart");
  });

  it("keeps local and GitHub Pages publish assumptions explicit", () => {
    expect(html).toContain("http://localhost:5173/");
    expect(html).not.toContain("http://localhost:5176/");
    expect(viteConfig).toContain('base: command === "build" || isPreview ? "/RioArriba/" : "/"');
  });
});
