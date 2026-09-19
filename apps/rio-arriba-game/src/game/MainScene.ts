import Phaser from "phaser";
import { riverBoundsAt, WORLD_WIDTH } from "../systems/river";
import { Simulation } from "../systems/simulation";
import { GestureInputController, mergeInputStates } from "../systems/touchGestureInput";
import { ENTITY_RULES, EntityState, GameSnapshot, InputState, ShotState, WEAPON_RULES } from "../systems/types";

const VIEW_W = 480;
const HUD_CLEARANCE = 54;

const SPRITE_ASSETS: Record<string, string> = {
  player: new URL("../assets/designer-handoff/icons/player-electric-plane.png", import.meta.url).href,
  barge: new URL("../assets/designer-handoff/icons/enemy-barge.png", import.meta.url).href,
  drone: new URL("../assets/designer-handoff/icons/enemy-drone.png", import.meta.url).href,
  jet: new URL("../assets/designer-handoff/icons/enemy-jet.png", import.meta.url).href,
  charger: new URL("../assets/designer-handoff/icons/charging-station.png", import.meta.url).href,
  gate: new URL("../assets/designer-handoff/icons/bridge-gate.png", import.meta.url).href,
  shot: new URL("../assets/designer-handoff/icons/player-shot.png", import.meta.url).href,
  hitBurst: new URL("../assets/designer-handoff/icons/hit-burst.png", import.meta.url).href,
  crashBurst: new URL("../assets/designer-handoff/icons/crash-burst.png", import.meta.url).href,
  rechargePulse: new URL("../assets/designer-handoff/icons/recharge-pulse.png", import.meta.url).href
};

export class MainScene extends Phaser.Scene {
  private simulation = new Simulation();
  private audio = new AudioDirector();
  private gestureInput = new GestureInputController({ dragDeadZonePx: 8, speedThresholdPx: 46, steerScale: 1.18, firePulseMs: 170 });
  private graphics!: Phaser.GameObjects.Graphics;
  private controlsGraphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Image;
  private entitySprites = new Map<string, Phaser.GameObjects.Image>();
  private shotSprites = new Map<string, Phaser.GameObjects.Image>();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private missileKey!: Phaser.Input.Keyboard.Key;
  private missilePulseUntilMs = 0;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private buttonPointers = new Map<string, Set<number>>();
  private domEvents = new AbortController();
  private blockedKeys = new Set<number>();
  private lastUiState?: GameSnapshot["state"];
  private buttonInput: InputState = { left: false, right: false, up: false, down: false, fire: false };
  private previousInput: InputState = { left: false, right: false, up: false, down: false, fire: false };

  constructor() {
    super("main");
  }

  preload(): void {
    for (const [key, url] of Object.entries(SPRITE_ASSETS)) this.load.image(key, url);
  }

  create(): void {
    this.createWeaponTextures();
    this.cameras.main.setBackgroundColor("#071718");
    this.graphics = this.add.graphics();
    this.playerSprite = this.add.image(0, 0, "player").setVisible(false);
    this.controlsGraphics = this.add.graphics();
    this.input.addPointer(2);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
    this.missileKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X, false);
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D", false) as typeof this.wasd;
    this.bindButtonControls();
    this.bindGestureControls();
    this.input.keyboard?.on("keydown", () => this.audio.unlock());
    this.input.on("pointerdown", () => this.audio.unlock());
    this.bindSessionControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.domEvents.abort());
  }

  update(_time: number, delta: number): void {
    const before = this.simulation.snapshot().state;
    const input = this.helpIsOpen() ? { left: false, right: false, up: false, down: false, fire: false } : this.readInput();
    if (before !== "paused") {
      if (before === "playing") this.playInputTransitions(input);
      this.simulation.setInput(input);
    }
    const snap = this.simulation.update(delta);
    if (snap.state !== before && (snap.state === "crashed" || snap.state === "game-over")) this.clearInput(false);
    this.draw(snap);
    this.drawTouchControl();
    this.updateHud(snap);
    this.audio.updateEngine(snap.state === "playing", snap.player.speed);
    for (const cue of snap.soundCues) {
      this.audio.playCue(cue);
      this.playCueEffect(cue, snap);
    }
    this.previousInput = input;
  }

  private readInput(): InputState {
    const down = (key: Phaser.Input.Keyboard.Key) => key.isDown && !this.blockedKeys.has(key.keyCode);
    const keyboardInput: InputState = {
      left: down(this.cursors.left) || down(this.wasd.A),
      right: down(this.cursors.right) || down(this.wasd.D),
      up: down(this.cursors.up) || down(this.wasd.W),
      down: down(this.cursors.down) || down(this.wasd.S),
      fire: down(this.fireKey) && document.activeElement?.tagName !== "BUTTON",
      missile: down(this.missileKey) || this.time.now < this.missilePulseUntilMs
    };
    return mergeInputStates(keyboardInput, this.buttonInput, this.gestureInput.stateAt(this.time.now));
  }

  private bindButtonControls(): void {
    const bindings: Array<[keyof InputState, string]> = [
      ["left", "left"],
      ["right", "right"],
      ["up", "fast"],
      ["down", "slow"],
      ["fire", "fire"],
      ["missile", "missile"]
    ];

    for (const [key, id] of bindings) {
      const element = document.getElementById(id);
      if (!element) continue;
      const pointers = new Set<number>();
      this.buttonPointers.set(id, pointers);
      const set = (value: boolean) => {
        this.buttonInput = { ...this.buttonInput, [key]: value };
        element.classList.toggle("held", value);
      };
      element.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.simulation.snapshot().state !== "playing" || this.helpIsOpen()) return;
        this.audio.unlock();
        pointers.add(event.pointerId);
        if (key === "fire") this.gestureInput.pointerDown({ pointerId: -event.pointerId - 1, x: 0, y: 0, timeMs: this.time.now, isFireZone: true });
        if (key === "missile" && this.simulation.snapshot().missileCooldownMs === 0) this.missilePulseUntilMs = this.time.now + 150;
        set(true);
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }, { signal: this.domEvents.signal });
      const release = (event: PointerEvent) => {
        const wasHeld = pointers.delete(event.pointerId);
        if (key === "fire") {
          const point = { pointerId: -event.pointerId - 1, x: 0, y: 0, timeMs: this.time.now };
          if (event.type === "pointercancel" || event.type === "lostpointercapture") this.gestureInput.pointerCancel(point);
          else this.gestureInput.pointerUp(point);
        }
        if (key === "missile" && wasHeld && event.type !== "pointerup") this.missilePulseUntilMs = 0;
        set(pointers.size > 0);
      };
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
        element.addEventListener(name, release, { signal: this.domEvents.signal });
      }
    }
  }

  private helpIsOpen(): boolean {
    return document.getElementById("info-panel")?.hidden === false;
  }

  private clearInput(resetKeyboard = true): void {
    this.gestureInput.cancelAll(this.time.now);
    this.buttonInput = { left: false, right: false, up: false, down: false, fire: false, missile: false };
    this.missilePulseUntilMs = 0;
    this.previousInput = { ...this.buttonInput };
    for (const [id, pointers] of this.buttonPointers) {
      pointers.clear();
      document.getElementById(id)?.classList.remove("held");
    }
    if (resetKeyboard) {
      for (const key of [...Object.values(this.wasd), ...Object.values(this.cursors), this.fireKey, this.missileKey]) {
        if (key.isDown) this.blockedKeys.add(key.keyCode);
      }
      this.input.keyboard?.resetKeys();
    }
  }

  private pauseFlight(): void {
    this.simulation.pause();
    this.clearInput();
    this.audio.updateEngine(false, 0);
    this.updateHud(this.simulation.snapshot());
  }

  private continueFlight(): void {
    if (this.helpIsOpen()) return;
    this.clearInput();
    this.audio.unlock();
    this.simulation.startOrResume();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.updateHud(this.simulation.snapshot());
  }

  private bindSessionControls(): void {
    const options = { signal: this.domEvents.signal };
    document.getElementById("flight-action")?.addEventListener("click", () => this.continueFlight(), options);
    document.getElementById("pause-toggle")?.addEventListener("click", () => {
      if (this.simulation.snapshot().state === "playing") this.pauseFlight();
      else if (this.simulation.snapshot().state === "paused") this.continueFlight();
    }, options);
    window.addEventListener("blur", () => this.pauseFlight(), options);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pauseFlight();
    }, options);
    window.addEventListener("resize", () => this.pauseFlight(), options);
    window.addEventListener("flight-help", () => this.pauseFlight(), options);
    window.addEventListener("keyup", (event) => this.blockedKeys.delete(event.keyCode), options);
    window.addEventListener("keydown", (event) => {
      if (!event.repeat) this.blockedKeys.delete(event.keyCode);
      if (event.repeat || this.helpIsOpen()) return;
      const state = this.simulation.snapshot().state;
      if (event.code === "Escape" || event.code === "KeyP") {
        event.preventDefault();
        if (state === "playing") this.pauseFlight();
        else if (state === "paused") this.continueFlight();
      } else if (event.code === "Enter" && document.activeElement?.tagName !== "BUTTON") {
        event.preventDefault();
        if (state !== "playing") this.continueFlight();
      } else if (event.code === "Space" && document.activeElement?.tagName !== "BUTTON") {
        event.preventDefault();
      }
    }, options);
  }

  private bindGestureControls(): void {
    const interactiveTarget = this.input;
    const hud = document.getElementById("hud");
    hud?.addEventListener("pointerdown", (event) => event.stopPropagation());
    hud?.addEventListener("pointermove", (event) => event.stopPropagation());
    hud?.addEventListener("pointerup", (event) => event.stopPropagation());
    hud?.addEventListener("pointercancel", (event) => event.stopPropagation());

    const point = (pointer: Phaser.Input.Pointer) => ({
      pointerId: pointer.id,
      x: pointer.x,
      y: pointer.y,
      timeMs: this.time.now,
      playerX: this.simulation.snapshot().player.x
    });

    interactiveTarget.on("pointerdown", (pointer: Phaser.Input.Pointer, currentlyOver: unknown[] = []) => {
      if (currentlyOver.length > 0 || this.helpIsOpen() || this.simulation.snapshot().state !== "playing") return;
      this.audio.unlock();
      this.gestureInput.pointerDown(point(pointer));
    });
    interactiveTarget.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.gestureInput.pointerMove(point(pointer));
    });
    interactiveTarget.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.gestureInput.pointerUp(point(pointer));
    });
    interactiveTarget.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      this.gestureInput.pointerUp(point(pointer));
    });
    interactiveTarget.on("pointercancel", (pointer: Phaser.Input.Pointer) => {
      this.gestureInput.pointerCancel(point(pointer));
    });
  }

  private draw(snap: ReturnType<Simulation["snapshot"]>): void {
    const g = this.graphics;
    g.clear();
    g.setPosition(this.originX(), 0);
    this.drawTerrain(g, snap.player.y);
    for (const entity of snap.entities) this.drawEntityReticle(g, entity, snap.player.y);
    this.syncEntitySprites(snap.entities, snap.player.y);
    this.syncShotSprites(snap.shots, snap.player.y);
    this.syncPlayerSprite(
      snap.player.x,
      snap.state === "playing" && snap.player.invulnerableMs > 0 && Math.floor(snap.player.invulnerableMs / 120) % 2 === 0
    );
    this.children.bringToTop(this.controlsGraphics);
  }

  private drawTouchControl(): void {
    const touch = this.gestureInput.touchControlVisualState(this.time.now);
    const g = this.controlsGraphics;
    g.clear();
    if (touch.active) {
      g.lineStyle(3, 0x8cfffb, 0.38);
      g.lineBetween(touch.originX, touch.originY, touch.x, touch.y);
      g.fillStyle(0x8cfffb, 0.18);
      g.fillCircle(touch.originX, touch.originY, 18);
      g.lineStyle(2, 0x8cfffb, 0.64);
      g.strokeCircle(touch.originX, touch.originY, 18);
      g.fillStyle(0x95ff4f, 0.84);
      g.fillCircle(touch.x, touch.y, 12);
      g.lineStyle(2, 0xffffff, 0.72);
      g.strokeCircle(touch.x, touch.y, 12);
      if (touch.targetX !== undefined) {
        g.lineStyle(2, 0x95ff4f, 0.5);
        g.lineBetween(this.originX() + touch.targetX, this.playerScreenY() - 32, this.originX() + touch.targetX, this.playerScreenY() + 36);
      }
    }

  }

  private drawTerrain(g: Phaser.GameObjects.Graphics, playerY: number): void {
    const viewH = this.viewH();
    g.fillStyle(0x101f16, 1);
    g.fillRect(0, 0, VIEW_W, viewH);

    const left: Phaser.Math.Vector2[] = [];
    const right: Phaser.Math.Vector2[] = [];
    for (let sy = -20; sy <= viewH + 30; sy += 20) {
      const y = playerY + (this.playerScreenY() - sy);
      const bounds = riverBoundsAt(y);
      left.push(new Phaser.Math.Vector2(bounds.left, sy));
      right.push(new Phaser.Math.Vector2(bounds.right, sy));
    }

    g.fillStyle(0x123942, 1);
    g.beginPath();
    g.moveTo(left[0].x, left[0].y);
    for (const point of left) g.lineTo(point.x, point.y);
    for (const point of right.reverse()) g.lineTo(point.x, point.y);
    g.closePath();
    g.fillPath();

    g.lineStyle(3, 0x54e7cf, 0.5);
    for (const edge of [left, right.reverse()]) {
      g.beginPath();
      g.moveTo(edge[0].x, edge[0].y);
      for (const point of edge) g.lineTo(point.x, point.y);
      g.strokePath();
    }

    g.lineStyle(1, 0x2cb3d0, 0.18);
    for (let y = 0; y < viewH; y += 52) {
      g.lineBetween(190 + Math.sin((playerY + y) * 0.02) * 18, y, 290 + Math.cos((playerY + y) * 0.02) * 18, y + 18);
    }
  }

  private syncPlayerSprite(x: number, dimmed: boolean): void {
    const y = this.playerScreenY();
    this.playerSprite
      .setPosition(this.originX() + x, y)
      .setDisplaySize(88, 88)
      .setDepth(5)
      .setAlpha(dimmed ? 0.38 : 1)
      .setVisible(true);
  }

  private drawEntityReticle(g: Phaser.GameObjects.Graphics, entity: EntityState, playerY: number): void {
    const y = this.toScreenY(entity.y, playerY);
    if (y < HUD_CLEARANCE || y > this.viewH() + 80) return;
    if (ENTITY_RULES[entity.kind].maxHealth > 1) {
      const maxHealth = ENTITY_RULES[entity.kind].maxHealth;
      const barY = y - this.entityDisplaySize(entity).h / 2 - 12;
      const barX = entity.x - (maxHealth * 12 - 3) / 2;
      for (let i = 0; i < maxHealth; i++) {
        const filled = i < entity.health;
        g.fillStyle(filled ? (entity.health < maxHealth ? 0xffb45a : 0x8cfffb) : 0x203638, 1);
        g.fillRoundedRect(barX + i * 12, barY, 9, 5, 1);
        g.lineStyle(1, filled ? 0xffffff : 0x6d8385, 0.7);
        g.strokeRoundedRect(barX + i * 12, barY, 9, 5, 1);
      }
    }
    if (entity.kind === "charger") {
      this.drawTargetReticle(g, entity.x, y, 0x95ff4f, 0.45);
      return;
    }
    if (entity.kind === "gate") {
      this.drawTargetReticle(g, entity.x, y, 0xffe37a, 0.78);
      g.lineStyle(10, 0xffe37a, 0.16);
      g.lineBetween(entity.x - entity.w / 2 - 12, y, entity.x + entity.w / 2 + 12, y);
      g.lineStyle(3, 0xff5548, 0.9);
      g.lineBetween(entity.x - entity.w / 2, y - entity.h / 2 - 9, entity.x + entity.w / 2, y - entity.h / 2 - 9);
      g.lineBetween(entity.x - entity.w / 2, y + entity.h / 2 + 9, entity.x + entity.w / 2, y + entity.h / 2 + 9);
      return;
    }
    this.drawTargetReticle(g, entity.x, y, 0x8cfffb, 0.42);
  }

  private syncEntitySprites(entities: EntityState[], playerY: number): void {
    const active = new Set<string>();
    for (const entity of entities) {
      active.add(entity.id);
      const sprite = this.entitySprites.get(entity.id) ?? this.add.image(0, 0, entity.kind);
      this.entitySprites.set(entity.id, sprite);
      const y = this.toScreenY(entity.y, playerY);
      const visible = y >= HUD_CLEARANCE && y <= this.viewH() + 80;
      const size = this.entityDisplaySize(entity);
      sprite
        .setTexture(entity.kind)
        .setPosition(this.originX() + entity.x, y)
        .setDisplaySize(size.w, size.h)
        .setDepth(entity.kind === "gate" ? 4 : 3)
        .setVisible(visible);
      if (entity.hitFlashMs > 90) sprite.setTintFill(0xfff1b0);
      else if (entity.health < ENTITY_RULES[entity.kind].maxHealth) sprite.setTint(0xffaa66);
      else sprite.clearTint();
    }
    for (const [id, sprite] of this.entitySprites) {
      if (!active.has(id)) {
        if (sprite.visible) this.spawnEffect("hitBurst", sprite.x, sprite.y, 96, 220);
        sprite.destroy();
        this.entitySprites.delete(id);
      }
    }
  }

  private syncShotSprites(shots: ShotState[], playerY: number): void {
    const active = new Set<string>();
    for (const shot of shots) {
      active.add(shot.id);
      const sprite = this.shotSprites.get(shot.id) ?? this.add.image(0, 0, shot.kind);
      this.shotSprites.set(shot.id, sprite);
      const y = this.toScreenY(shot.y, playerY);
      sprite
        .setPosition(this.originX() + shot.x, y)
        .setDisplaySize(shot.kind === "missile" ? 20 : 7, shot.kind === "missile" ? 46 : 22)
        .setDepth(6)
        .setVisible(y >= HUD_CLEARANCE && y <= this.viewH() + 80);
    }
    for (const [id, sprite] of this.shotSprites) {
      if (!active.has(id)) {
        sprite.destroy();
        this.shotSprites.delete(id);
      }
    }
  }

  private entityDisplaySize(entity: EntityState): { w: number; h: number } {
    if (entity.kind === "charger") return { w: 66, h: 164 };
    if (entity.kind === "gate") return { w: Math.max(180, entity.w), h: 78 };
    if (entity.kind === "barge") return { w: 68, h: 68 };
    if (entity.kind === "drone") return { w: 78, h: 78 };
    return { w: 70, h: 70 };
  }

  private createWeaponTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffc94f, 0.35);
    g.fillRoundedRect(0, 0, 8, 24, 4);
    g.fillStyle(0xfff4b0, 1);
    g.fillRoundedRect(2, 0, 4, 17, 2);
    g.generateTexture("machine-gun", 8, 24);
    g.clear();
    g.fillStyle(0xff8b40, 0.85);
    g.fillTriangle(7, 32, 13, 32, 10, 46);
    g.fillStyle(0xd7edff, 1);
    g.fillTriangle(10, 0, 5, 10, 15, 10);
    g.fillRect(5, 10, 10, 22);
    g.fillStyle(0x6dbfff, 1);
    g.fillTriangle(5, 23, 0, 35, 10, 30);
    g.fillTriangle(15, 23, 20, 35, 10, 30);
    g.fillStyle(0xff734e, 1);
    g.fillRect(5, 13, 10, 4);
    g.generateTexture("missile", 20, 46);
    g.destroy();
  }

  private drawTargetReticle(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    g.strokeCircle(x, y, 27);
    g.lineBetween(x - 34, y, x - 22, y);
    g.lineBetween(x + 22, y, x + 34, y);
    g.lineBetween(x, y - 34, x, y - 22);
    g.lineBetween(x, y + 22, x, y + 34);
  }

  private playCueEffect(cue: GameSnapshot["soundCues"][number], snap: GameSnapshot): void {
    if (cue === "crash") {
      this.spawnEffect("crashBurst", this.originX() + snap.player.x, this.playerScreenY(), 132, 440);
    }
    if (cue === "recharge") {
      this.spawnEffect("rechargePulse", this.originX() + snap.player.x, this.playerScreenY(), 112, 360);
    }
  }

  private spawnEffect(texture: "hitBurst" | "crashBurst" | "rechargePulse", x: number, y: number, size: number, durationMs: number): void {
    const effect = this.add.image(x, y, texture).setDisplaySize(size, size).setDepth(7).setAlpha(0.92);
    this.tweens.add({
      targets: effect,
      alpha: 0,
      scaleX: effect.scaleX * 1.35,
      scaleY: effect.scaleY * 1.35,
      duration: durationMs,
      ease: "Quad.easeOut",
      onComplete: () => effect.destroy()
    });
  }

  private toScreenY(worldY: number, playerY: number): number {
    return this.playerScreenY() - (worldY - playerY);
  }

  private originX(): number {
    return (this.scale.width - VIEW_W) / 2;
  }

  private viewH(): number {
    return this.scale.height;
  }

  private playerScreenY(): number {
    const preferred = this.scale.height - 184;
    const lowestVisible = this.scale.height - 92;
    return Math.min(lowestVisible, Math.max(260, preferred));
  }

  private updateHud(snap: ReturnType<Simulation["snapshot"]>): void {
    const score = document.getElementById("score");
    const section = document.getElementById("section");
    const lives = document.getElementById("lives");
    const charge = document.getElementById("charge");
    const status = document.getElementById("status");
    const gameOver = document.getElementById("game-over-panel");
    const finalScore = document.getElementById("final-score");
    if (score) score.textContent = snap.score.toString().padStart(6, "0");
    if (section) section.textContent = `LEVEL ${snap.level}`;
    if (lives) lives.textContent = `${Math.max(0, snap.player.lives)} CELLS`;
    if (charge) {
      charge.style.width = `${Math.max(0, snap.player.charge)}%`;
      charge.classList.toggle("low", snap.player.charge < 25);
    }
    if (status) {
      status.hidden = snap.message.length === 0 || snap.state !== "playing";
      status.textContent = snap.message;
    }
    if (gameOver) gameOver.hidden = snap.state !== "game-over";
    if (finalScore) finalScore.textContent = snap.score.toString().padStart(6, "0");
    const chargeLabel = document.getElementById("charge-label");
    if (chargeLabel) chargeLabel.textContent = `${snap.player.charge < 25 ? "LOW CHARGE · " : "CHARGE "}${Math.max(0, Math.ceil(snap.player.charge))}%`;
    const speed = document.getElementById("speed-label");
    if (speed) speed.textContent = snap.player.speed < 130 ? "SLOW · RECHARGE" : snap.player.speed > 200 ? "FAST" : "CRUISE";
    const missile = document.getElementById("missile");
    const missileStatus = document.getElementById("missile-status");
    const missileHud = document.getElementById("missile-hud");
    const ready = snap.missileCooldownMs === 0;
    const reload = ready ? "READY" : `${(Math.ceil(snap.missileCooldownMs / 100) / 10).toFixed(1)}s`;
    if (missileStatus) missileStatus.textContent = reload;
    if (missileHud) missileHud.textContent = `MISSILE · ${reload}`;
    if (missile) {
      missile.classList.toggle("reloading", !ready);
      missile.style.setProperty("--reload-progress", `${(1 - snap.missileCooldownMs / WEAPON_RULES.missile.cooldownMs) * 100}%`);
    }
    if (this.lastUiState === snap.state) return;
    this.lastUiState = snap.state;
    document.getElementById("app")!.dataset.state = snap.state;
    const panel = document.getElementById("flight-panel")!;
    const title = document.getElementById("flight-title")!;
    const description = document.getElementById("flight-description")!;
    const action = document.getElementById("flight-action")!;
    const pause = document.getElementById("pause-toggle") as HTMLButtonElement;
    panel.hidden = snap.state === "playing";
    pause.disabled = snap.state !== "playing" && snap.state !== "paused";
    pause.textContent = snap.state === "paused" ? "Resume" : "Pause";
    title.textContent = snap.state === "ready" ? "Río Arriba" : snap.state === "paused" ? "Flight paused" : snap.state === "game-over" ? "Grid offline" : snap.message;
    description.textContent = snap.state === "ready" ? "Follow the river. Break bridges. Keep your charge." : snap.state === "paused" ? "Take your time. Resume when you’re ready." : snap.state === "game-over" ? "A new river run starts with 3 cells." : `${snap.player.lives} cells left. Retry from your last checkpoint.`;
    action.textContent = snap.state === "ready" ? "Start flight" : snap.state === "paused" ? "Resume flight" : snap.state === "game-over" ? "Play again" : "Retry checkpoint";
    if (!panel.hidden && !this.helpIsOpen() && snap.state !== "ready") action.focus({ preventScroll: true });
  }

  private playInputTransitions(input: InputState): void {
    if (input.up && !this.previousInput.up) this.audio.playAcceleration();
    if (input.down && !this.previousInput.down) this.audio.playDeceleration();
  }
}

class AudioDirector {
  private context?: AudioContext;
  private engineOsc?: OscillatorNode;
  private engineGain?: GainNode;

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.engineOsc = this.context.createOscillator();
      this.engineGain = this.context.createGain();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 72;
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain).connect(this.context.destination);
      this.engineOsc.start();
    }
    void this.context.resume();
  }

  updateEngine(playing: boolean, speed: number): void {
    if (!this.context || !this.engineOsc || !this.engineGain) return;
    const now = this.context.currentTime;
    const targetGain = playing ? 0.045 : 0;
    const targetFreq = 62 + speed * 0.36;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.12);
  }

  playAcceleration(): void {
    this.sweep(140, 310, 0.18, 0.04, "triangle");
  }

  playDeceleration(): void {
    this.sweep(250, 95, 0.22, 0.04, "triangle");
  }

  playCue(cue: GameSnapshot["soundCues"][number]): void {
    if (cue === "fire") this.blip(980, 0.04, 0.025, "square");
    if (cue === "missile") this.sweep(180, 65, 0.22, 0.07, "sawtooth");
    if (cue === "damage") this.blip(230, 0.06, 0.04, "triangle");
    if (cue === "hit") this.noiseBurst(0.11, 0.08);
    if (cue === "crash") this.sweep(120, 32, 0.42, 0.16, "sawtooth");
    if (cue === "recharge") this.sweep(420, 880, 0.28, 0.07, "sine");
  }

  private blip(frequency: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  private sweep(from: number, to: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  private noiseBurst(duration: number, volume: number): void {
    if (!this.context) return;
    const bufferSize = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(this.context.destination);
    source.start();
  }
}
