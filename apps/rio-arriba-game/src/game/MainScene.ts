import Phaser from "phaser";
import { riverBoundsAt, WORLD_WIDTH } from "../systems/river";
import { Simulation } from "../systems/simulation";
import { GestureInputController, mergeInputStates } from "../systems/touchGestureInput";
import { EntityState, GameSnapshot, InputState, ShotState } from "../systems/types";

const VIEW_W = 480;
const HUD_CLEARANCE = 54;

export class MainScene extends Phaser.Scene {
  private simulation = new Simulation();
  private audio = new AudioDirector();
  private gestureInput = new GestureInputController({ joystickDeadZonePx: 8, joystickRadiusPx: 44, firePulseMs: 170 });
  private graphics!: Phaser.GameObjects.Graphics;
  private controlsGraphics!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private buttonInput: InputState = { left: false, right: false, up: false, down: false, fire: false };
  private previousInput: InputState = { left: false, right: false, up: false, down: false, fire: false };

  constructor() {
    super("main");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#071718");
    this.graphics = this.add.graphics();
    this.controlsGraphics = this.add.graphics();
    this.input.addPointer(2);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.bindButtonControls();
    this.bindGestureControls();
    this.input.keyboard?.on("keydown", () => this.audio.unlock());
    this.input.on("pointerdown", () => this.audio.unlock());
    window.addEventListener("blur", () => {
      this.gestureInput.cancelAll(this.time.now);
      this.buttonInput = { left: false, right: false, up: false, down: false, fire: false };
    });
  }

  update(_time: number, delta: number): void {
    const input = this.readInput();
    this.playInputTransitions(input);
    this.simulation.setInput(input);
    const snap = this.simulation.update(delta);
    this.draw(snap);
    this.drawJoystick();
    this.updateHud(snap);
    this.audio.updateEngine(snap.state === "playing", snap.player.speed);
    for (const cue of snap.soundCues) this.audio.playCue(cue);
    this.previousInput = input;
  }

  private readInput(): InputState {
    const keyboardInput: InputState = {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      fire: this.fireKey.isDown
    };
    return mergeInputStates(keyboardInput, this.buttonInput, this.gestureInput.stateAt(this.time.now));
  }

  private bindButtonControls(): void {
    const bindings: Array<[keyof InputState, string]> = [
      ["left", "left"],
      ["right", "right"],
      ["up", "fast"],
      ["down", "slow"],
      ["fire", "fire"]
    ];

    for (const [key, id] of bindings) {
      const element = document.getElementById(id);
      if (!element) continue;
      const set = (value: boolean) => {
        this.buttonInput = { ...this.buttonInput, [key]: value };
      };
      element.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.audio.unlock();
        set(true);
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      });
      element.addEventListener("pointerup", () => set(false));
      element.addEventListener("pointercancel", () => set(false));
      element.addEventListener("pointerleave", () => set(false));
    }
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
      timeMs: this.time.now
    });

    interactiveTarget.on("pointerdown", (pointer: Phaser.Input.Pointer, currentlyOver: unknown[] = []) => {
      if (currentlyOver.length > 0) return;
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
    for (const entity of snap.entities) this.drawEntity(g, entity, snap.player.y);
    for (const shot of snap.shots) this.drawShot(g, shot, snap.player.y);
    this.drawPlayer(
      g,
      snap.player.x,
      snap.state === "playing" && snap.player.invulnerableMs > 0 && Math.floor(snap.player.invulnerableMs / 120) % 2 === 0
    );
  }

  private drawJoystick(): void {
    const joystick = this.gestureInput.joystickVisualState();
    const g = this.controlsGraphics;
    g.clear();
    if (!joystick.active) return;

    g.lineStyle(2, 0x8cfffb, 0.68);
    g.fillStyle(0x071718, 0.26);
    g.fillCircle(joystick.originX, joystick.originY, joystick.radius);
    g.strokeCircle(joystick.originX, joystick.originY, joystick.radius);
    g.lineStyle(2, 0x95ff4f, 0.4);
    g.lineBetween(joystick.originX - 16, joystick.originY, joystick.originX + 16, joystick.originY);
    g.lineBetween(joystick.originX, joystick.originY - 16, joystick.originX, joystick.originY + 16);
    g.fillStyle(0x95ff4f, 0.84);
    g.fillCircle(joystick.knobX, joystick.knobY, 15);
    g.lineStyle(2, 0xffffff, 0.78);
    g.strokeCircle(joystick.knobX, joystick.knobY, 15);
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

  private drawPlayer(g: Phaser.GameObjects.Graphics, x: number, hidden: boolean): void {
    if (hidden) return;
    const y = this.playerScreenY();
    g.lineStyle(8, 0x48f7ff, 0.18);
    g.strokeTriangle(x, y - 40, x - 44, y + 19, x + 44, y + 19);
    g.fillStyle(0xeaffff, 1);
    g.fillTriangle(x, y - 42, x - 13, y + 25, x + 13, y + 25);
    g.fillStyle(0x20e9ff, 1);
    g.fillTriangle(x, y - 28, x - 40, y + 15, x + 40, y + 15);
    g.fillStyle(0x102d35, 1);
    g.fillTriangle(x, y - 25, x - 7, y + 2, x + 7, y + 2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(x - 12, y + 19, 24, 9);
    g.fillStyle(0x89f7ff, 0.55);
    g.fillTriangle(x - 11, y + 29, x - 4, y + 46, x + 1, y + 29);
    g.fillTriangle(x + 11, y + 29, x + 4, y + 46, x - 1, y + 29);
    g.lineStyle(2, 0xffffff, 0.95);
    g.strokeTriangle(x, y - 42, x - 40, y + 15, x + 40, y + 15);
  }

  private drawEntity(g: Phaser.GameObjects.Graphics, entity: EntityState, playerY: number): void {
    const y = this.toScreenY(entity.y, playerY);
    if (y < HUD_CLEARANCE || y > this.viewH() + 80) return;
    if (entity.kind === "charger") {
      this.drawTargetReticle(g, entity.x, y, 0x95ff4f, 0.45);
      const h = entity.h;
      g.fillStyle(0x0d2d28, 1);
      g.fillRoundedRect(entity.x - entity.w / 2, y - h / 2, entity.w, h, 8);
      g.fillStyle(0x143f38, 1);
      g.fillRoundedRect(entity.x - 18, y - h / 2 + 10, 36, h - 20, 6);
      g.fillStyle(0x95ff4f, 1);
      g.fillRect(entity.x + 10, y - h / 2 - 9, 14, 9);
      g.lineStyle(3, 0xb6ff70, 1);
      g.strokeRoundedRect(entity.x - entity.w / 2, y - h / 2, entity.w, h, 8);
      g.lineStyle(4, 0xd8ff70, 1);
      g.beginPath();
      g.moveTo(entity.x + 3, y - 28);
      g.lineTo(entity.x - 10, y);
      g.lineTo(entity.x + 5, y);
      g.lineTo(entity.x - 6, y + 30);
      g.strokePath();
      g.lineStyle(2, 0x7fffe1, 1);
      for (let railY = y - h / 2 + 22; railY < y + h / 2 - 10; railY += 24) {
        g.lineBetween(entity.x - entity.w / 2 + 9, railY, entity.x - 24, railY + 8);
        g.lineBetween(entity.x + entity.w / 2 - 9, railY, entity.x + 24, railY + 8);
      }
      return;
    }
    if (entity.kind === "gate") {
      this.drawTargetReticle(g, entity.x, y, 0xffe37a, 0.55);
      g.fillStyle(0x5b4b39, 1);
      g.fillRect(entity.x - entity.w / 2, y - 16, entity.w, 32);
      g.fillStyle(0x2d241b, 1);
      for (let x = entity.x - entity.w / 2 + 16; x < entity.x + entity.w / 2; x += 34) {
        g.fillRect(x, y - 18, 12, 36);
      }
      g.lineStyle(3, 0xffe37a, 1);
      g.strokeRect(entity.x - entity.w / 2, y - 16, entity.w, 32);
      return;
    }
    this.drawTargetReticle(g, entity.x, y, 0x8cfffb, 0.42);
    if (entity.kind === "barge") this.drawBarge(g, entity, y);
    if (entity.kind === "drone") this.drawDrone(g, entity, y);
    if (entity.kind === "jet") this.drawEnemyJet(g, entity, y);
  }

  private drawShot(g: Phaser.GameObjects.Graphics, shot: ShotState, playerY: number): void {
    const y = this.toScreenY(shot.y, playerY);
    g.lineStyle(16, 0x8cfffb, 0.18);
    g.lineBetween(shot.x, y - 22, shot.x, y + 12);
    g.lineStyle(8, 0x8cfffb, 0.35);
    g.lineBetween(shot.x, y - 20, shot.x, y + 10);
    g.lineStyle(4, 0x8cfffb, 1);
    g.lineBetween(shot.x, y - 18, shot.x, y + 8);
    g.lineStyle(1, 0xffffff, 1);
    g.lineBetween(shot.x, y - 16, shot.x, y + 8);
  }

  private drawTargetReticle(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number): void {
    g.lineStyle(2, color, alpha);
    g.strokeCircle(x, y, 27);
    g.lineBetween(x - 34, y, x - 22, y);
    g.lineBetween(x + 22, y, x + 34, y);
    g.lineBetween(x, y - 34, x, y - 22);
    g.lineBetween(x, y + 22, x, y + 34);
  }

  private drawBarge(g: Phaser.GameObjects.Graphics, entity: EntityState, y: number): void {
    g.fillStyle(0xd95f3f, 1);
    g.fillTriangle(entity.x - 32, y - 12, entity.x + 32, y - 12, entity.x + 22, y + 18);
    g.fillTriangle(entity.x - 32, y - 12, entity.x - 22, y + 18, entity.x + 22, y + 18);
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(entity.x - 15, y - 25, 30, 17, 4);
    g.lineStyle(2, 0x240f0c, 1);
    g.strokeTriangle(entity.x - 32, y - 12, entity.x + 32, y - 12, entity.x + 22, y + 18);
  }

  private drawDrone(g: Phaser.GameObjects.Graphics, entity: EntityState, y: number): void {
    g.fillStyle(0xffc857, 1);
    g.fillRoundedRect(entity.x - 20, y - 13, 40, 26, 8);
    g.fillStyle(0x17120a, 1);
    g.fillCircle(entity.x - 27, y - 18, 8);
    g.fillCircle(entity.x + 27, y - 18, 8);
    g.lineStyle(3, 0xfff3b0, 1);
    g.lineBetween(entity.x - 40, y - 18, entity.x - 14, y - 18);
    g.lineBetween(entity.x + 14, y - 18, entity.x + 40, y - 18);
    g.lineStyle(2, 0x201508, 1);
    g.strokeRoundedRect(entity.x - 20, y - 13, 40, 26, 8);
  }

  private drawEnemyJet(g: Phaser.GameObjects.Graphics, entity: EntityState, y: number): void {
    g.fillStyle(0xa94dff, 1);
    g.fillTriangle(entity.x, y - 24, entity.x - 13, y + 20, entity.x + 13, y + 20);
    g.fillStyle(0xf2d6ff, 1);
    g.fillTriangle(entity.x, y - 4, entity.x - 30, y + 10, entity.x + 30, y + 10);
    g.lineStyle(2, 0x26083d, 1);
    g.strokeTriangle(entity.x, y - 24, entity.x - 30, y + 10, entity.x + 30, y + 10);
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
    if (score) score.textContent = snap.score.toString().padStart(6, "0");
    if (section) section.textContent = `LEVEL ${snap.level}`;
    if (lives) lives.textContent = `${Math.max(0, snap.player.lives)} CELLS`;
    if (charge) {
      charge.style.width = `${Math.max(0, snap.player.charge)}%`;
      charge.classList.toggle("low", snap.player.charge < 25);
    }
    if (status) {
      status.hidden = snap.message.length === 0;
      status.textContent = snap.message;
    }
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
    if (cue === "fire") this.blip(820, 0.07, 0.035, "square");
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
