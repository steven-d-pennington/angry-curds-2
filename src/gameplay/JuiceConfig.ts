/**
 * Configuration for all "game feel" / juice effects.
 * Designers can tune these values without touching gameplay code.
 */

export interface ScreenShakeConfig {
  /** Base amplitude in pixels for heavy impacts. */
  amplitudeHeavy: number;
  /** Base amplitude in pixels for rat kills. */
  amplitudeRatKill: number;
  /** Duration in seconds. */
  duration: number;
  /** Oscillation frequency in Hz. */
  frequency: number;
  /** Impulse threshold to trigger shake from collisions. */
  impulseThreshold: number;
}

export interface SlowMotionConfig {
  /** Time scale during slow-mo (0.25 = quarter speed). */
  timeScale: number;
  /** Duration at minimum time scale in seconds (real time). */
  holdDuration: number;
  /** Ease-back duration in seconds (real time). */
  easeDuration: number;
}

export interface ScorePopupConfig {
  /** Points awarded for block destruction. */
  blockPoints: number;
  /** Points awarded for rat kill. */
  ratPoints: number;
  /** Font size for block popups. */
  blockFontSize: number;
  /** Font size for rat popups. */
  ratFontSize: number;
  /** Color for block popups. */
  blockColor: number;
  /** Color for rat popups. */
  ratColor: number;
}

export interface CameraConfig {
  /** How far the camera eases toward the structure area (in meters). */
  easeDistance: number;
  /** Duration of the ease toward action in seconds. */
  easeDuration: number;
  /** Duration of the ease back in seconds. */
  easeBackDuration: number;
  /** Delay before easing back after launch in seconds. */
  easeBackDelay: number;
}

export interface DestructionVfxConfig {
  /** Extra particle count multiplier for block destruction. */
  particleMultiplier: number;
  /** Flash glow duration in seconds. */
  flashDuration: number;
  /** Flash glow max radius in pixels. */
  flashRadius: number;
}

export interface JuiceConfig {
  screenShake: ScreenShakeConfig;
  slowMotion: SlowMotionConfig;
  scorePopup: ScorePopupConfig;
  camera: CameraConfig;
  destructionVfx: DestructionVfxConfig;
}

export const DEFAULT_JUICE_CONFIG: JuiceConfig = {
  screenShake: {
    amplitudeHeavy: 4,
    amplitudeRatKill: 5,
    duration: 0.2,
    frequency: 30,
    impulseThreshold: 8,
  },
  slowMotion: {
    timeScale: 0.25,
    holdDuration: 0.6,
    easeDuration: 0.4,
  },
  scorePopup: {
    blockPoints: 50,
    ratPoints: 500,
    blockFontSize: 20,
    ratFontSize: 28,
    blockColor: 0xffffff,
    ratColor: 0xffff00,
  },
  camera: {
    easeDistance: 1.5,
    easeDuration: 0.8,
    easeBackDuration: 0.6,
    easeBackDelay: 1.5,
  },
  destructionVfx: {
    particleMultiplier: 2,
    flashDuration: 0.15,
    flashRadius: 20,
  },
};
