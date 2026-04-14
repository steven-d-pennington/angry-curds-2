import type { Engine } from "../engine/Engine.js";
import type { SlowMotionConfig } from "./JuiceConfig.js";
import { DEFAULT_JUICE_CONFIG } from "./JuiceConfig.js";

/**
 * Slow-motion effect: drops timeScale, holds, then eases back to 1.0.
 * Uses real (unscaled) time so the effect duration is predictable.
 */
export class SlowMotion {
  private readonly engine: Engine;
  private readonly config: SlowMotionConfig;

  private active = false;
  private elapsed = 0;
  private readonly boundUpdate: (dt: number) => void;

  constructor(engine: Engine, config: SlowMotionConfig = DEFAULT_JUICE_CONFIG.slowMotion) {
    this.engine = engine;
    this.config = config;
    this.boundUpdate = this.update.bind(this);
    engine.addFrameCallback(this.boundUpdate);
  }

  /** Trigger the slow-motion effect. */
  trigger(): void {
    this.active = true;
    this.elapsed = 0;
    this.engine.timeScale = this.config.timeScale;
  }

  private update(realDt: number): void {
    if (!this.active) return;

    this.elapsed += realDt;
    const { holdDuration, easeDuration, timeScale } = this.config;
    const totalDuration = holdDuration + easeDuration;

    if (this.elapsed >= totalDuration) {
      // Done — restore normal speed
      this.active = false;
      this.engine.timeScale = 1;
      return;
    }

    if (this.elapsed > holdDuration) {
      // Ease back from timeScale → 1.0
      const easeProgress = (this.elapsed - holdDuration) / easeDuration;
      // Smooth ease-out (quadratic)
      const t = easeProgress * easeProgress;
      this.engine.timeScale = timeScale + (1 - timeScale) * t;
    }
  }

  /** Reset to normal speed (e.g. on level teardown). */
  reset(): void {
    this.active = false;
    this.engine.timeScale = 1;
  }

  destroy(): void {
    this.reset();
    this.engine.removeFrameCallback(this.boundUpdate);
  }
}
