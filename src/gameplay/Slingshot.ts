import { Graphics, Sprite } from "pixi.js";
import type { Engine } from "../engine/Engine.js";
import type { SlingshotConfig, BandPolishConfig } from "./SlingshotConfig.js";
import { getFrame } from "../engine/AssetLoader.js";
import {
  computeBandControlPoint,
  interpolateBandColor,
  computeBandThickness,
  sampleBezier,
} from "./bandMath.js";

/**
 * Visual slingshot: copper Y-fork sprite for the posts + dynamic bezier band.
 * The band uses quadratic bezier curves with natural sag, dynamic tension
 * coloring, and tapered thickness from fork to projectile contact point.
 */
export class Slingshot {
  private readonly engine: Engine;
  private readonly bandConfig: BandPolishConfig;
  private readonly postSprite: Sprite;
  private readonly band: Graphics;
  private readonly initialPostRotation: number;

  readonly leftForkWorld: { x: number; y: number };
  readonly rightForkWorld: { x: number; y: number };
  readonly anchorWorld: { x: number; y: number };

  constructor(engine: Engine, config: SlingshotConfig, bandConfig: BandPolishConfig) {
    this.engine = engine;
    this.bandConfig = bandConfig;

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
    this.initialPostRotation = this.postSprite.rotation;

    engine.getLayer("structures").addChild(this.postSprite);

    // Dynamic rubber band (drawn with Graphics)
    this.band = new Graphics();
    engine.getLayer("entities").addChild(this.band);
  }

  /**
   * Draw the rubber band from both fork points to the target (cheese) position.
   * Uses bezier curves with sag, dynamic color (brown → red-orange), and
   * tapered thickness (thick at fork, thin at cheese contact).
   *
   * @param pullRatio 0 = resting at anchor, 1 = fully stretched to max pull distance
   */
  drawBand(targetWorldX: number, targetWorldY: number, pullRatio: number): void {
    const left = this.worldToScreen(this.leftForkWorld.x, this.leftForkWorld.y);
    const right = this.worldToScreen(this.rightForkWorld.x, this.rightForkWorld.y);
    const target = this.worldToScreen(targetWorldX, targetWorldY);

    const bc = this.bandConfig;
    const color = interpolateBandColor(pullRatio, bc.colorRelaxed, bc.colorStretched);
    const baseThickness = computeBandThickness(pullRatio, bc.thicknessMin, bc.thicknessMax);

    this.band.clear();

    // Draw each band segment (left fork → target, right fork → target) as
    // a series of short line segments with decreasing width for taper effect.
    this.drawTaperedBezierSegment(left, target, pullRatio, color, baseThickness);
    this.drawTaperedBezierSegment(right, target, pullRatio, color, baseThickness);

    // Fork flex: slight rotation toward pull direction
    this.applyForkFlex(pullRatio, targetWorldX);
  }

  /**
   * Draw the idle band (no cheese loaded) as a gentle sagging curve
   * between the two fork points.
   */
  drawBandIdle(): void {
    const bc = this.bandConfig;
    const left = this.worldToScreen(this.leftForkWorld.x, this.leftForkWorld.y);
    const right = this.worldToScreen(this.rightForkWorld.x, this.rightForkWorld.y);

    const cp = computeBandControlPoint(
      left.x, left.y, right.x, right.y, bc.sagMax, 0,
    );

    this.band.clear();
    this.band
      .moveTo(left.x, left.y)
      .quadraticCurveTo(cp.x, cp.y, right.x, right.y)
      .stroke({ width: bc.thicknessMin, color: bc.colorRelaxed, cap: "round" });
  }

  clearBand(): void {
    this.band.clear();
    // Reset fork flex
    this.postSprite.rotation = this.initialPostRotation;
  }

  /**
   * Draw a single tapered bezier segment from fork to target.
   * Samples the bezier curve and draws short line segments with
   * linearly decreasing stroke width from fork (thick) to target (thin).
   */
  private drawTaperedBezierSegment(
    from: { x: number; y: number },
    to: { x: number; y: number },
    pullRatio: number,
    color: number,
    baseThickness: number,
  ): void {
    const bc = this.bandConfig;
    const cp = computeBandControlPoint(
      from.x, from.y, to.x, to.y, bc.sagMax, pullRatio,
    );

    const points = sampleBezier(
      from.x, from.y, cp.x, cp.y, to.x, to.y, bc.taperSegments,
    );

    // Draw segments with tapering width
    for (let i = 0; i < points.length - 1; i++) {
      const t = i / (points.length - 1);
      const width = baseThickness * (1 - t * (1 - bc.taperEndRatio));
      const p0 = points[i]!;
      const p1 = points[i + 1]!;

      this.band
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({ width, color, cap: "round" });
    }
  }

  /**
   * Apply a subtle rotation to the slingshot fork sprite based on pull direction.
   * Makes the fork "flex" toward where the player is pulling.
   */
  private applyForkFlex(pullRatio: number, targetWorldX: number): void {
    const anchorX = this.anchorWorld.x;
    const dx = targetWorldX - anchorX;

    // Max flex angle of ~3 degrees, scaled by pull ratio
    const maxFlexRad = 0.05;
    const direction = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    this.postSprite.rotation = this.initialPostRotation + direction * pullRatio * maxFlexRad;
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
