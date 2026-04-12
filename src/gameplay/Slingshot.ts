import { Graphics } from "pixi.js";
import type { Engine } from "../engine/Engine.js";
import type { SlingshotConfig } from "./SlingshotConfig.js";

/**
 * Visual-only slingshot entity: two upright posts and a rubber band.
 * Does not own a physics body — it's a static visual anchor.
 * The rubber band is drawn dynamically based on the current cheese/drag position.
 */
export class Slingshot {
  private readonly engine: Engine;
  private readonly config: SlingshotConfig;
  private readonly posts: Graphics;
  private readonly band: Graphics;

  /** World-space position of the left fork tip */
  readonly leftForkWorld: { x: number; y: number };
  /** World-space position of the right fork tip */
  readonly rightForkWorld: { x: number; y: number };
  /** World-space position of the anchor point (where cheese sits) */
  readonly anchorWorld: { x: number; y: number };

  constructor(engine: Engine, config: SlingshotConfig) {
    this.engine = engine;
    this.config = config;

    const halfSpacing = config.postSpacing / 2;
    const forkY = config.positionY + config.postHeight;

    this.leftForkWorld = { x: config.positionX - halfSpacing, y: forkY };
    this.rightForkWorld = { x: config.positionX + halfSpacing, y: forkY };
    this.anchorWorld = { x: config.positionX, y: forkY - 0.2 };

    // Posts graphics (static, drawn once)
    this.posts = new Graphics();
    engine.getLayer("structures").addChild(this.posts);

    // Rubber band graphics (redrawn every frame during aiming)
    this.band = new Graphics();
    engine.getLayer("entities").addChild(this.band);

    this.drawPosts();
  }

  private drawPosts(): void {
    const cfg = this.config;
    const ppm = this.engine.canvasWidth / this.engine.viewport.worldWidth;
    const thickPx = cfg.postThickness * ppm;
    const halfSpacing = cfg.postSpacing / 2;

    // Left post
    const lBase = this.worldToScreen(cfg.positionX - halfSpacing, cfg.positionY);
    const lTop = this.worldToScreen(cfg.positionX - halfSpacing, cfg.positionY + cfg.postHeight);

    // Right post
    const rBase = this.worldToScreen(cfg.positionX + halfSpacing, cfg.positionY);
    const rTop = this.worldToScreen(cfg.positionX + halfSpacing, cfg.positionY + cfg.postHeight);

    this.posts.clear();
    this.posts
      .moveTo(lBase.x, lBase.y)
      .lineTo(lTop.x, lTop.y)
      .stroke({ width: thickPx, color: cfg.postColor, cap: "round" });

    this.posts
      .moveTo(rBase.x, rBase.y)
      .lineTo(rTop.x, rTop.y)
      .stroke({ width: thickPx, color: cfg.postColor, cap: "round" });

    // Small fork tips (slightly angled outward)
    const forkLen = 0.3;
    const lForkEnd = this.worldToScreen(
      cfg.positionX - halfSpacing - 0.1,
      cfg.positionY + cfg.postHeight + forkLen,
    );
    const rForkEnd = this.worldToScreen(
      cfg.positionX + halfSpacing + 0.1,
      cfg.positionY + cfg.postHeight + forkLen,
    );

    this.posts
      .moveTo(lTop.x, lTop.y)
      .lineTo(lForkEnd.x, lForkEnd.y)
      .stroke({ width: thickPx * 0.8, color: cfg.postColor, cap: "round" });

    this.posts
      .moveTo(rTop.x, rTop.y)
      .lineTo(rForkEnd.x, rForkEnd.y)
      .stroke({ width: thickPx * 0.8, color: cfg.postColor, cap: "round" });
  }

  /**
   * Draw the rubber band stretched to a world-space position (cheese or drag point).
   * Called each frame during aiming.
   */
  drawBand(targetWorldX: number, targetWorldY: number): void {
    const cfg = this.config;
    const left = this.worldToScreen(this.leftForkWorld.x, this.leftForkWorld.y);
    const right = this.worldToScreen(this.rightForkWorld.x, this.rightForkWorld.y);
    const target = this.worldToScreen(targetWorldX, targetWorldY);

    this.band.clear();
    // Left fork to target
    this.band
      .moveTo(left.x, left.y)
      .lineTo(target.x, target.y)
      .stroke({ width: cfg.bandThickness, color: cfg.bandColor, cap: "round" });

    // Right fork to target
    this.band
      .moveTo(right.x, right.y)
      .lineTo(target.x, target.y)
      .stroke({ width: cfg.bandThickness, color: cfg.bandColor, cap: "round" });
  }

  /** Draw the band at rest (between the two fork tips). */
  drawBandIdle(): void {
    const cfg = this.config;
    const left = this.worldToScreen(this.leftForkWorld.x, this.leftForkWorld.y);
    const right = this.worldToScreen(this.rightForkWorld.x, this.rightForkWorld.y);

    this.band.clear();
    this.band
      .moveTo(left.x, left.y)
      .lineTo(right.x, right.y)
      .stroke({ width: cfg.bandThickness, color: cfg.bandColor, cap: "round" });
  }

  /** Hide the rubber band entirely. */
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
    this.posts.destroy();
    this.band.destroy();
  }
}
