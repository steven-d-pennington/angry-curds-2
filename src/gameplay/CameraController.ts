import type { Engine } from "../engine/Engine.js";
import type { CameraConfig } from "./JuiceConfig.js";
import { DEFAULT_JUICE_CONFIG } from "./JuiceConfig.js";

/**
 * Subtle camera movements: eases toward the structure area after launch,
 * then eases back for the next shot. Works by applying a pixel offset
 * to the stage container (same approach as ScreenShake, but smooth).
 *
 * The camera offset is stored separately from shake offset. The stage
 * position is set to cameraOffset + shakeOffset each frame by the
 * juice coordinator in main.ts.
 */
export class CameraController {
  private readonly engine: Engine;
  private readonly config: CameraConfig;

  /** Current camera offset in pixels (x only — horizontal pan). */
  offsetX = 0;

  private state: "idle" | "easing_in" | "waiting" | "easing_back" = "idle";
  private elapsed = 0;
  private targetOffsetX = 0;

  constructor(engine: Engine, config: CameraConfig = DEFAULT_JUICE_CONFIG.camera) {
    this.engine = engine;
    this.config = config;
  }

  /** Called when cheese is launched — start easing toward the structure area. */
  onLaunch(): void {
    // Convert world-space ease distance to pixels
    const pxPerMeter = this.engine.canvasWidth / this.engine.viewport.worldWidth;
    // Negative X = pan camera right (show more of the structure area on the right)
    this.targetOffsetX = -this.config.easeDistance * pxPerMeter;

    this.state = "easing_in";
    this.elapsed = 0;
  }

  /** Call once per frame with real delta time. */
  update(dt: number): void {
    if (this.state === "idle") return;

    this.elapsed += dt;

    switch (this.state) {
      case "easing_in": {
        const t = Math.min(this.elapsed / this.config.easeDuration, 1);
        // Smooth ease-out (cubic)
        const eased = 1 - (1 - t) * (1 - t) * (1 - t);
        this.offsetX = this.targetOffsetX * eased;

        if (t >= 1) {
          this.state = "waiting";
          this.elapsed = 0;
        }
        break;
      }
      case "waiting": {
        if (this.elapsed >= this.config.easeBackDelay) {
          this.state = "easing_back";
          this.elapsed = 0;
        }
        break;
      }
      case "easing_back": {
        const t = Math.min(this.elapsed / this.config.easeBackDuration, 1);
        // Smooth ease-in-out (quadratic)
        const eased = t * t * (3 - 2 * t);
        this.offsetX = this.targetOffsetX * (1 - eased);

        if (t >= 1) {
          this.offsetX = 0;
          this.state = "idle";
        }
        break;
      }
    }
  }

  /** Reset to neutral (e.g. on level teardown). */
  reset(): void {
    this.state = "idle";
    this.offsetX = 0;
    this.elapsed = 0;
  }
}
