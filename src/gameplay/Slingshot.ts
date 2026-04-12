import { Graphics, Sprite } from "pixi.js";
import type { Engine } from "../engine/Engine.js";
import type { SlingshotConfig } from "./SlingshotConfig.js";
import { getFrame } from "../engine/AssetLoader.js";

/**
 * Visual slingshot: copper Y-fork sprite for the posts + dynamic band.
 * The band is still drawn with Graphics (it stretches dynamically).
 */
export class Slingshot {
  private readonly engine: Engine;
  private readonly config: SlingshotConfig;
  private readonly postSprite: Sprite;
  private readonly band: Graphics;

  readonly leftForkWorld: { x: number; y: number };
  readonly rightForkWorld: { x: number; y: number };
  readonly anchorWorld: { x: number; y: number };

  constructor(engine: Engine, config: SlingshotConfig) {
    this.engine = engine;
    this.config = config;

    const halfSpacing = config.postSpacing / 2;
    const forkY = config.positionY + config.postHeight;

    this.leftForkWorld = { x: config.positionX - halfSpacing, y: forkY };
    this.rightForkWorld = { x: config.positionX + halfSpacing, y: forkY };
    this.anchorWorld = { x: config.positionX, y: forkY - 0.2 };

    // Slingshot base sprite (copper Y-fork)
    const texture = getFrame("slingshot_base");
    this.postSprite = new Sprite(texture);
    this.postSprite.anchor.set(0.5, 1.0); // Anchor at bottom-center

    // Position and size the slingshot sprite
    const baseScreen = this.worldToScreen(config.positionX, config.positionY);
    const topScreen = this.worldToScreen(config.positionX, forkY + 0.3);
    this.postSprite.x = baseScreen.x;
    this.postSprite.y = baseScreen.y;
    this.postSprite.width = engine.metersToPixels(config.postSpacing + 0.4);
    this.postSprite.height = baseScreen.y - topScreen.y;

    engine.getLayer("structures").addChild(this.postSprite);

    // Dynamic rubber band (drawn with Graphics)
    this.band = new Graphics();
    engine.getLayer("entities").addChild(this.band);
  }

  drawBand(targetWorldX: number, targetWorldY: number): void {
    const cfg = this.config;
    const left = this.worldToScreen(this.leftForkWorld.x, this.leftForkWorld.y);
    const right = this.worldToScreen(this.rightForkWorld.x, this.rightForkWorld.y);
    const target = this.worldToScreen(targetWorldX, targetWorldY);

    this.band.clear();
    // Leather strap / cheese-wire band (warm brown color)
    this.band
      .moveTo(left.x, left.y)
      .lineTo(target.x, target.y)
      .stroke({ width: cfg.bandThickness, color: 0x8b5e3c, cap: "round" });

    this.band
      .moveTo(right.x, right.y)
      .lineTo(target.x, target.y)
      .stroke({ width: cfg.bandThickness, color: 0x8b5e3c, cap: "round" });
  }

  drawBandIdle(): void {
    const cfg = this.config;
    const left = this.worldToScreen(this.leftForkWorld.x, this.leftForkWorld.y);
    const right = this.worldToScreen(this.rightForkWorld.x, this.rightForkWorld.y);

    this.band.clear();
    this.band
      .moveTo(left.x, left.y)
      .lineTo(right.x, right.y)
      .stroke({ width: cfg.bandThickness, color: 0x8b5e3c, cap: "round" });
  }

  clearBand(): void {
    this.band.clear();
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cw = this.engine.canvasWidth;
    const ch = this.engine.canvasHeight;
    const vw = this.engine.viewport.worldWidth;
    const vh = this.engine.viewport.worldHeight;
    return {
      x: (wx / vw) * cw,
      y: ch - (wy / vh) * ch,
    };
  }

  destroy(): void {
    this.postSprite.destroy();
    this.band.destroy();
  }
}
