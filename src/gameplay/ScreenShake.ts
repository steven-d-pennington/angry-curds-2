import type { Container } from "pixi.js";
import type { ScreenShakeConfig } from "./JuiceConfig.js";
import { DEFAULT_JUICE_CONFIG } from "./JuiceConfig.js";

/**
 * Screen shake effect using decreasing sinusoidal oscillation.
 * Applies pixel offsets AND rotational shake to the stage container
 * so all layers shake together.
 *
 * Intensity scales with impact force — heavier impacts produce more
 * pronounced positional and rotational shake.
 */
export class ScreenShake {
  private readonly stage: Container;
  private readonly config: ScreenShakeConfig;

  private amplitude = 0;
  private duration = 0;
  private elapsed = 0;
  private active = false;

  constructor(stage: Container, config: ScreenShakeConfig = DEFAULT_JUICE_CONFIG.screenShake) {
    this.stage = stage;
    this.config = config;
  }

  /**
   * Trigger a shake. If already shaking, takes the stronger amplitude.
   */
  trigger(amplitude?: number): void {
    const amp = amplitude ?? this.config.amplitudeHeavy;
    if (this.active && amp <= this.amplitude) return;

    this.amplitude = amp;
    this.duration = this.config.duration;
    this.elapsed = 0;
    this.active = true;
  }

  /** Trigger a shake tuned for rat kills. */
  triggerRatKill(): void {
    this.trigger(this.config.amplitudeRatKill);
  }

  /**
   * Trigger shake from a collision impulse. Only fires if impulse
   * exceeds the configured threshold. Intensity scales with impulse.
   */
  triggerFromImpulse(impulse: number): void {
    if (impulse < this.config.impulseThreshold) return;
    // Scale amplitude with impulse (capped at 2x base)
    const scale = Math.min(impulse / this.config.impulseThreshold, 2);
    this.trigger(this.config.amplitudeHeavy * scale);
  }

  /**
   * Call once per frame with real (unscaled) delta time.
   */
  update(dt: number): void {
    if (!this.active) {
      this.stage.x = 0;
      this.stage.y = 0;
      this.stage.rotation = 0;
      return;
    }

    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
      this.stage.x = 0;
      this.stage.y = 0;
      this.stage.rotation = 0;
      return;
    }

    // Decreasing sinusoidal oscillation
    const progress = this.elapsed / this.duration;
    const decay = 1 - progress;
    const angle = this.elapsed * this.config.frequency * Math.PI * 2;
    const offset = Math.sin(angle) * this.amplitude * decay;

    // Apply positional shake in both axes with phase offset for organic feel
    this.stage.x = offset;
    this.stage.y = Math.cos(angle * 1.3) * this.amplitude * decay * 0.7;

    // Rotational shake: small rotation proportional to amplitude.
    // Max rotation ~0.02 rad (~1.1 deg) at amplitude 8, scales linearly.
    const maxRotation = 0.0025 * this.amplitude;
    this.stage.rotation = Math.sin(angle * 1.7) * maxRotation * decay;
  }

  /** Reset shake state (e.g. on level teardown). */
  reset(): void {
    this.active = false;
    this.stage.x = 0;
    this.stage.y = 0;
    this.stage.rotation = 0;
  }
}
