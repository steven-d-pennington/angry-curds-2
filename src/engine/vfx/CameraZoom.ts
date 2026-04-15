import type { Container } from "pixi.js";

/**
 * Brief camera zoom punch effect for heavy impacts (e.g. Gouda explosion).
 *
 * Scales the stage container with an ease-in-out curve:
 *   1. Zoom in over `zoomInDuration`
 *   2. Zoom out back to 1.0 over `zoomOutDuration`
 *
 * Zoom is applied around the screen center. Multiple triggers take the
 * stronger (larger) zoom if one is already active.
 */
export class CameraZoom {
  private readonly stage: Container;
  private active = false;
  private elapsed = 0;
  private zoomAmount = 0;
  private zoomInDuration = 0;
  private zoomOutDuration = 0;
  private totalDuration = 0;
  /** Screen-space pivot (center of zoom). */
  private pivotX = 0;
  private pivotY = 0;

  constructor(stage: Container) {
    this.stage = stage;
  }

  /**
   * Trigger a zoom punch.
   * @param amount Scale factor above 1.0 (e.g. 1.08 = 8% zoom-in).
   * @param zoomIn Duration of zoom-in phase in seconds.
   * @param zoomOut Duration of zoom-out phase in seconds.
   * @param screenWidth Current canvas width for centering.
   * @param screenHeight Current canvas height for centering.
   */
  trigger(
    amount = 1.08,
    zoomIn = 0.1,
    zoomOut = 0.2,
    screenWidth = 960,
    screenHeight = 540,
  ): void {
    if (this.active && amount <= this.zoomAmount) return;

    this.zoomAmount = amount;
    this.zoomInDuration = zoomIn;
    this.zoomOutDuration = zoomOut;
    this.totalDuration = zoomIn + zoomOut;
    this.elapsed = 0;
    this.active = true;
    this.pivotX = screenWidth / 2;
    this.pivotY = screenHeight / 2;
  }

  /** Call once per frame with real (unscaled) delta time. */
  update(dt: number): void {
    if (!this.active) {
      return;
    }

    this.elapsed += dt;
    if (this.elapsed >= this.totalDuration) {
      this.active = false;
      this.stage.scale.set(1);
      this.stage.pivot.set(0);
      this.stage.position.set(0);
      return;
    }

    let scale: number;
    if (this.elapsed < this.zoomInDuration) {
      // Ease-in: smoothstep from 1.0 → zoomAmount
      const t = this.elapsed / this.zoomInDuration;
      const smooth = t * t * (3 - 2 * t);
      scale = 1 + (this.zoomAmount - 1) * smooth;
    } else {
      // Ease-out: smoothstep from zoomAmount → 1.0
      const t = (this.elapsed - this.zoomInDuration) / this.zoomOutDuration;
      const smooth = t * t * (3 - 2 * t);
      scale = this.zoomAmount + (1 - this.zoomAmount) * smooth;
    }

    // Apply scale around screen center
    this.stage.pivot.set(this.pivotX, this.pivotY);
    this.stage.position.set(this.pivotX, this.pivotY);
    this.stage.scale.set(scale);
  }

  /** Reset state (e.g. on level teardown). */
  reset(): void {
    this.active = false;
    this.stage.scale.set(1);
    this.stage.pivot.set(0);
    this.stage.position.set(0);
  }

  destroy(): void {
    this.reset();
  }
}
