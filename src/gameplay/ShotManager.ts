import { Graphics } from "pixi.js";
import type { Engine } from "../engine/Engine.js";
import type { Entity } from "../engine/entities/Entity.js";
import { CheeseProjectile } from "./CheeseProjectile.js";
import { BrieProjectile } from "./BrieProjectile.js";
import { Slingshot } from "./Slingshot.js";
import { SlingshotController } from "./SlingshotController.js";
import type { GameplayConfig, LaunchVfxConfig } from "./SlingshotConfig.js";
import { CHEESE_CRUMB_CONFIG, LAUNCH_BURST_CONFIG, SPEED_TRAIL_CONFIG } from "../engine/vfx/ParticleEmitter.js";
import type { CardDeck } from "./CardDeck.js";

/** Cheese type identifier matching design doc. */
export type CheeseType = "cheddar" | "brie";

/**
 * Manages the sequence of cheese shots: loading, launching, and tracking
 * when all cheese are exhausted.
 *
 * Supports multiple active projectiles (Brie split produces 3 sub-projectiles).
 * A shot resolves only when ALL active projectiles have settled or exited.
 *
 * When a CardDeck is provided, cheese type and remaining count are driven
 * by the deck instead of the flat totalCheese counter.
 */
export class ShotManager {
  private readonly engine: Engine;
  private readonly config: GameplayConfig;
  private readonly slingshot: Slingshot;
  private readonly controller: SlingshotController;
  private readonly cardDeck: CardDeck | null;
  private readonly launchVfxConfig: LaunchVfxConfig;

  private cheeseUsed = 0;
  /** The current cheese loaded on the slingshot (cheddar or brie). */
  private activePrimary: CheeseProjectile | BrieProjectile | null = null;
  /** All projectiles that must resolve before the next shot loads. */
  private readonly activeProjectiles: Set<Entity> = new Set();
  private loadTimer = 0;
  private waitingToLoad = false;

  /** Stretch-line VFX state */
  private stretchLines: Graphics | null = null;
  private stretchLineTimer = 0;

  /** Speed trail VFX state */
  private speedTrailTimer = 0;
  private speedTrailEmitTimer = 0;
  private speedTrailActive = false;

  /** Fires when all cheese are exhausted */
  onAllCheeseUsed: (() => void) | null = null;
  /** Fires when a cheese is launched (passes remaining count) */
  onCheeseLaunched: ((remaining: number) => void) | null = null;

  get remaining(): number {
    if (this.cardDeck) return this.cardDeck.remaining;
    return this.config.shotLifecycle.totalCheese - this.cheeseUsed;
  }

  get totalCheese(): number {
    return this.config.shotLifecycle.totalCheese;
  }

  /** The currently launched Brie (if any) — used by tap-to-split handler. */
  get activeBrie(): BrieProjectile | null {
    if (this.activePrimary instanceof BrieProjectile) {
      return this.activePrimary;
    }
    return null;
  }

  /** Whether the slingshot is currently being aimed (dragged). */
  get isAiming(): boolean {
    return this.controller.isAiming;
  }

  constructor(engine: Engine, config: GameplayConfig, cardDeck?: CardDeck) {
    this.engine = engine;
    this.config = config;
    this.cardDeck = cardDeck ?? null;
    this.launchVfxConfig = config.launchVfx;

    this.slingshot = new Slingshot(engine, config.slingshot, config.bandPolish);
    this.controller = new SlingshotController(
      engine,
      this.slingshot,
      config.launch,
      config.trajectoryPreview,
    );

    // Lock card selection when aiming begins, unlock on cancel
    this.controller.onAimStart = () => {
      this.cardDeck?.lock();
    };
    this.controller.onAimCancel = () => {
      this.cardDeck?.unlock();
    };

    this.controller.onLaunch = () => {
      if (this.cardDeck) {
        this.cardDeck.consume();
      } else {
        this.cheeseUsed++;
      }
      this.onCheeseLaunched?.(this.remaining);

      // Cheese crumb particles on launch
      const anchor = this.slingshot.anchorWorld;
      const screen = engine.worldToScreenPos(anchor.x, anchor.y);
      engine.particles.emit(screen.x, screen.y, CHEESE_CRUMB_CONFIG);
    };

    // Launch VFX: stretch lines + particle burst + speed trail
    this.controller.onLaunchVfx = (pullRatio, _velX, _velY) => {
      const anchor = this.slingshot.anchorWorld;
      const screen = engine.worldToScreenPos(anchor.x, anchor.y);

      // Particle burst at release point
      engine.particles.emit(screen.x, screen.y, LAUNCH_BURST_CONFIG);

      // Stretch lines radiating from fork
      this.spawnStretchLines(screen.x, screen.y, pullRatio);

      // Start speed trail behind the launched cheese
      this.speedTrailActive = true;
      this.speedTrailTimer = 0;
      this.speedTrailEmitTimer = 0;
    };

    // Load first cheese immediately
    this.loadNextCheese();
  }

  /**
   * Must be called each frame to manage cheese lifecycle timing.
   */
  update(dt: number): void {
    // Update stretch line VFX
    this.updateStretchLines(dt);

    // Update speed trail VFX
    this.updateSpeedTrail(dt);

    // Check if all active projectiles have resolved
    if (this.activeProjectiles.size > 0) {
      for (const entity of this.activeProjectiles) {
        if (entity instanceof CheeseProjectile) {
          if (entity.state === "settled" || entity.state === "removed") {
            this.engine.removeEntity(entity);
            this.activeProjectiles.delete(entity);
          }
        } else if (entity instanceof BrieProjectile) {
          if (entity.state === "settled" || entity.state === "removed" || entity.state === "split") {
            if (entity.state === "split") {
              // Parent split — don't remove from engine yet, just stop tracking
              // Sub-projectiles are tracked separately
            } else {
              this.engine.removeEntity(entity);
            }
            this.activeProjectiles.delete(entity);
          }
        } else {
          // Sub-projectile: check resolved via custom property
          const sub = entity as Entity & { isResolved?: boolean };
          if (sub.isResolved) {
            this.engine.removeEntity(entity);
            this.activeProjectiles.delete(entity);
          }
        }
      }

      // All resolved?
      if (this.activeProjectiles.size === 0) {
        // Clean up split parent if it still exists
        if (this.activePrimary instanceof BrieProjectile && this.activePrimary.state === "split") {
          this.engine.removeEntity(this.activePrimary);
        }
        this.activePrimary = null;

        if (this.remaining <= 0) {
          this.slingshot.clearBand();
          this.onAllCheeseUsed?.();
        } else {
          this.waitingToLoad = true;
          this.loadTimer = 0;
        }
      }
    }

    // Handle delayed loading
    if (this.waitingToLoad) {
      this.loadTimer += dt;
      if (this.loadTimer >= this.config.shotLifecycle.nextCheeseDelay) {
        this.waitingToLoad = false;
        this.loadNextCheese();
      }
    }
  }

  /**
   * Load the next cheese. When a CardDeck is active, reads the
   * currently selected card type. Otherwise accepts an explicit type.
   */
  loadNextCheese(type?: CheeseType): void {
    const cheeseType = type ?? this.cardDeck?.currentType ?? "cheddar";
    const anchor = this.slingshot.anchorWorld;

    if (cheeseType === "brie") {
      const brie = new BrieProjectile(
        this.engine,
        this.config.brie,
        this.config.brieSub,
        this.config.brieSplit,
        this.config.shotLifecycle,
      );
      brie.loadAt(anchor.x, anchor.y);

      // When Brie splits, track the sub-projectiles
      brie.onSplit = (subs) => {
        for (const sub of subs) {
          this.activeProjectiles.add(sub);
          // Wire up sub-projectile resolve callback
          const s = sub as Entity & { onResolved: (() => void) | null };
          s.onResolved = () => {
            // Resolved tracking handled in update()
          };
        }
      };

      this.engine.addEntity(brie);
      this.activePrimary = brie;
      this.activeProjectiles.add(brie);
      this.controller.setCheese(brie);
    } else {
      const cheese = new CheeseProjectile(
        this.engine,
        this.config.cheese,
        this.config.shotLifecycle,
      );
      cheese.loadAt(anchor.x, anchor.y);

      this.engine.addEntity(cheese);
      this.activePrimary = cheese;
      this.activeProjectiles.add(cheese);
      this.controller.setCheese(cheese);
    }
  }

  /**
   * Replace the currently loaded (not launched) cheese with a different type.
   * Used when the player switches card selection before launching.
   */
  reloadCurrent(type: CheeseType): void {
    // Only reload if a cheese is currently loaded (not launched)
    if (!this.activePrimary) return;
    const state = this.activePrimary.state;
    if (state !== "loaded") return;

    // Remove the current cheese
    this.engine.removeEntity(this.activePrimary);
    this.activeProjectiles.delete(this.activePrimary);
    this.activePrimary = null;

    // Load new type
    this.loadNextCheese(type);
  }

  /**
   * Spawn stretch lines radiating outward from the slingshot fork on launch.
   * Lines fade out over stretchLineDuration.
   */
  private spawnStretchLines(screenX: number, screenY: number, pullRatio: number): void {
    const cfg = this.launchVfxConfig;
    const gfx = new Graphics();
    this.engine.getLayer("vfx").addChild(gfx);

    const lineCount = cfg.stretchLineCount;
    const lineLen = cfg.stretchLineLength * (0.5 + pullRatio * 0.5);

    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const endX = screenX + Math.cos(angle) * lineLen;
      const endY = screenY + Math.sin(angle) * lineLen;

      gfx.moveTo(screenX, screenY)
        .lineTo(endX, endY)
        .stroke({ width: 2, color: 0xffe0a0, alpha: 0.8, cap: "round" });
    }

    this.stretchLines = gfx;
    this.stretchLineTimer = cfg.stretchLineDuration;
  }

  /** Fade and remove stretch lines over time. */
  private updateStretchLines(dt: number): void {
    if (!this.stretchLines || this.stretchLineTimer <= 0) return;

    this.stretchLineTimer -= dt;
    if (this.stretchLineTimer <= 0) {
      this.stretchLines.destroy();
      this.stretchLines = null;
    } else {
      const t = this.stretchLineTimer / this.launchVfxConfig.stretchLineDuration;
      this.stretchLines.alpha = t;
    }
  }

  /**
   * Emit speed trail particles behind the launched cheese for the first
   * ~0.5 seconds of flight.
   */
  private updateSpeedTrail(dt: number): void {
    if (!this.speedTrailActive) return;

    this.speedTrailTimer += dt;
    this.speedTrailEmitTimer += dt;

    if (this.speedTrailTimer >= this.launchVfxConfig.speedTrailDuration) {
      this.speedTrailActive = false;
      return;
    }

    // Emit trail particles at intervals
    if (this.speedTrailEmitTimer >= this.launchVfxConfig.speedTrailInterval) {
      this.speedTrailEmitTimer = 0;

      // Get current cheese position
      if (this.activePrimary) {
        const body = (this.activePrimary as unknown as { body: { getPosition(): { x: number; y: number } } }).body;
        if (body) {
          const pos = body.getPosition();
          const screen = this.engine.worldToScreenPos(pos.x, pos.y);
          this.engine.particles.emit(screen.x, screen.y, SPEED_TRAIL_CONFIG);
        }
      }
    }
  }

  destroy(): void {
    this.controller.destroy();
    this.slingshot.destroy();
    if (this.stretchLines) {
      this.stretchLines.destroy();
      this.stretchLines = null;
    }
    this.speedTrailActive = false;
    for (const entity of this.activeProjectiles) {
      this.engine.removeEntity(entity);
    }
    this.activeProjectiles.clear();
    this.activePrimary = null;
  }
}
