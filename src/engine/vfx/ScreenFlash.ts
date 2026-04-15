import { Graphics, type Application } from "pixi.js";

/**
 * Full-screen color flash overlay for explosions and heavy impacts.
 *
 * Draws a solid rectangle over the entire canvas that fades from a
 * starting alpha to transparent over a configurable duration.
 * Multiple trigger() calls during an active flash take the stronger alpha.
 */
export class ScreenFlash {
  private readonly app: Application;
  private readonly overlay: Graphics;
  private active = false;
  private elapsed = 0;
  private duration = 0;
  private startAlpha = 0;

  constructor(app: Application) {
    this.app = app;
    this.overlay = new Graphics();
    this.overlay.label = "screen_flash";
    this.overlay.visible = false;
    // Add at the very top of the stage so it covers everything
    app.stage.addChild(this.overlay);
  }

  /**
   * Trigger a flash overlay.
   * @param color Fill color (default white 0xffffff).
   * @param alpha Starting opacity (default 0.5).
   * @param duration Fade duration in seconds (default 0.1).
   */
  trigger(color = 0xffffff, alpha = 0.5, duration = 0.1): void {
    if (this.active && alpha <= this.startAlpha) return;

    this.duration = duration;
    this.startAlpha = alpha;
    this.elapsed = 0;
    this.active = true;

    const w = this.app.screen.width;
    const h = this.app.screen.height;

    this.overlay.clear();
    this.overlay.rect(0, 0, w, h);
    this.overlay.fill({ color });
    this.overlay.alpha = alpha;
    this.overlay.visible = true;
  }

  /** Call once per frame with real (unscaled) delta time. */
  update(dt: number): void {
    if (!this.active) return;

    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
      this.overlay.visible = false;
      this.overlay.alpha = 0;
      return;
    }

    const progress = this.elapsed / this.duration;
    this.overlay.alpha = this.startAlpha * (1 - progress);
  }

  /** Reset state (e.g. on level teardown). */
  reset(): void {
    this.active = false;
    this.overlay.visible = false;
    this.overlay.alpha = 0;
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
