import { Text } from "pixi.js";
import type { Container } from "pixi.js";
import { Vec2 } from "planck";
import type { Engine } from "../engine/Engine.js";
import { worldToScreen } from "../engine/CoordinateSystem.js";

interface ActivePopup {
  text: Text;
  worldX: number;
  worldY: number;
  age: number;
}

const POPUP_DURATION = 0.8;
const POPUP_RISE_SPEED = 2; // meters per second

export class ScorePopupManager {
  private readonly popups: ActivePopup[] = [];
  private readonly layer: Container;
  private readonly engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
    this.layer = engine.getLayer("vfx");
  }

  spawn(worldX: number, worldY: number, points: number): void {
    const text = new Text({
      text: `+${points}`,
      style: {
        fontFamily: "Arial",
        fontSize: 24,
        fontWeight: "bold",
        fill: 0xffff00,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    text.anchor.set(0.5);
    this.layer.addChild(text);

    this.popups.push({ text, worldX, worldY, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.age += dt;
      p.worldY += POPUP_RISE_SPEED * dt;

      const screen = worldToScreen(
        Vec2(p.worldX, p.worldY),
        this.engine.canvasWidth,
        this.engine.canvasHeight,
        this.engine.viewport.worldWidth,
        this.engine.viewport.worldHeight,
      );
      p.text.x = screen.x;
      p.text.y = screen.y;
      p.text.alpha = Math.max(0, 1 - p.age / POPUP_DURATION);

      if (p.age >= POPUP_DURATION) {
        p.text.destroy();
        this.popups.splice(i, 1);
      }
    }
  }
}
