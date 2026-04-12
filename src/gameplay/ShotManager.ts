import type { Engine } from "../engine/Engine.js";
import type { Entity } from "../engine/entities/Entity.js";
import { CheeseProjectile } from "./CheeseProjectile.js";
import { BrieProjectile } from "./BrieProjectile.js";
import { Slingshot } from "./Slingshot.js";
import { SlingshotController } from "./SlingshotController.js";
import type { GameplayConfig } from "./SlingshotConfig.js";

/** Cheese type identifier matching design doc. */
export type CheeseType = "cheddar" | "brie";

/**
 * Manages the sequence of cheese shots: loading, launching, and tracking
 * when all cheese are exhausted.
 *
 * Supports multiple active projectiles (Brie split produces 3 sub-projectiles).
 * A shot resolves only when ALL active projectiles have settled or exited.
 */
export class ShotManager {
  private readonly engine: Engine;
  private readonly config: GameplayConfig;
  private readonly slingshot: Slingshot;
  private readonly controller: SlingshotController;

  private cheeseUsed = 0;
  /** The current cheese loaded on the slingshot (cheddar or brie). */
  private activePrimary: CheeseProjectile | BrieProjectile | null = null;
  /** All projectiles that must resolve before the next shot loads. */
  private readonly activeProjectiles: Set<Entity> = new Set();
  private loadTimer = 0;
  private waitingToLoad = false;

  /** Fires when all cheese are exhausted */
  onAllCheeseUsed: (() => void) | null = null;
  /** Fires when a cheese is launched (passes remaining count) */
  onCheeseLaunched: ((remaining: number) => void) | null = null;

  get remaining(): number {
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

  constructor(engine: Engine, config: GameplayConfig) {
    this.engine = engine;
    this.config = config;

    this.slingshot = new Slingshot(engine, config.slingshot);
    this.controller = new SlingshotController(
      engine,
      this.slingshot,
      config.launch,
      config.trajectoryPreview,
    );

    this.controller.onLaunch = () => {
      this.cheeseUsed++;
      this.onCheeseLaunched?.(this.remaining);
    };

    // Load first cheese immediately
    this.loadNextCheese();
  }

  /**
   * Must be called each frame to manage cheese lifecycle timing.
   */
  update(dt: number): void {
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
   * Load the next cheese. Accepts an optional type to support
   * the card-based selection system (defaults to "cheddar").
   */
  loadNextCheese(type: CheeseType = "cheddar"): void {
    const anchor = this.slingshot.anchorWorld;

    if (type === "brie") {
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

  destroy(): void {
    this.controller.destroy();
    this.slingshot.destroy();
    for (const entity of this.activeProjectiles) {
      this.engine.removeEntity(entity);
    }
    this.activeProjectiles.clear();
    this.activePrimary = null;
  }
}
