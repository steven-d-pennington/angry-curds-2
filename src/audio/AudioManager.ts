import { Howl, Howler } from "howler";

export type SfxId =
  | "cheeseLaunch"
  | "cheeseImpact"
  | "structureBreak"
  | "ratDeath"
  | "uiButton"
  | "levelComplete"
  | "levelFail";

const SFX_DEFS: readonly [SfxId, string][] = [
  ["cheeseLaunch", "audio/sfx_launch.wav"],
  ["cheeseImpact", "audio/sfx_impact.wav"],
  ["structureBreak", "audio/sfx_break.wav"],
  ["ratDeath", "audio/sfx_rat_death.wav"],
  ["uiButton", "audio/sfx_button.wav"],
  ["levelComplete", "audio/sfx_level_complete.wav"],
  ["levelFail", "audio/sfx_level_fail.wav"],
];

const MUSIC_SRC = "audio/music_gameplay.wav";

/**
 * Singleton that owns all Howler.js audio for the game.
 * Call `init()` once at startup, then `playSfx(id)` from game events.
 */
class AudioManagerImpl {
  private sfx = new Map<SfxId, Howl>();
  private music: Howl | null = null;
  private _muted = false;
  private sfxVolume = 0.7;
  private musicVolume = 0.4;
  private initialized = false;

  init(): void {
    if (this.initialized) return;

    for (const [id, src] of SFX_DEFS) {
      this.sfx.set(
        id,
        new Howl({ src: [src], volume: this.sfxVolume, preload: true }),
      );
    }

    this.music = new Howl({
      src: [MUSIC_SRC],
      volume: this.musicVolume,
      loop: true,
      preload: true,
    });

    this.initialized = true;
  }

  playSfx(id: SfxId): void {
    if (this._muted) return;
    this.sfx.get(id)?.play();
  }

  playMusic(): void {
    if (!this.music || this.music.playing()) return;
    this.music.play();
  }

  stopMusic(): void {
    this.music?.stop();
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    Howler.mute(muted);
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  setSfxVolume(vol: number): void {
    this.sfxVolume = vol;
    for (const howl of this.sfx.values()) {
      howl.volume(vol);
    }
  }

  setMusicVolume(vol: number): void {
    this.musicVolume = vol;
    this.music?.volume(vol);
  }

  /**
   * Resume the Web Audio context after a user gesture.
   * Must be called from a pointerdown / click handler to satisfy
   * the browser autoplay policy.
   */
  resumeContext(): void {
    const ctx = Howler.ctx;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }
}

export const audioManager = new AudioManagerImpl();
