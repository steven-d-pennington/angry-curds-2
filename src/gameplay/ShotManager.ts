import type { Engine } from "../engine/Engine.js";
import { CheeseProjectile } from "./CheeseProjectile.js";
import { Slingshot } from "./Slingshot.js";
import { SlingshotController } from "./SlingshotController.js";
import type { GameplayConfig } from "./SlingshotConfig.js";

/**
 * Manages the sequence of cheese shots: loading, launching, and tracking
 * when all cheese are exhausted.
 */
export class ShotManager {
  private readonly engine: Engine;
  private readonly config: GameplayConfig;
  private readonly slingshot: Slingshot;
  private readonly controller: SlingshotController;

  private cheeseUsed = 0;
  private activeCheese: CheeseProjectile | null = null;
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
   * Must be called each frame (from the engine update loop or manually)
   * to manage cheese lifecycle timing.
   */
  update(dt: number): void {
    // Check if active cheese has resolved
    if (this.activeCheese && (this.activeCheese.state === "settled" || this.activeCheese.state === "removed")) {
      // Remove resolved cheese from engine
      this.engine.removeEntity(this.activeCheese);
      this.activeCheese = null;

      if (this.remaining <= 0) {
        this.slingshot.clearBand();
        this.onAllCheeseUsed?.();
      } else {
        // Start timer for next cheese
        this.waitingToLoad = true;
        this.loadTimer = 0;
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

  private loadNextCheese(): void {
    const cheese = new CheeseProjectile(
      this.engine,
      this.config.cheese,
      this.config.shotLifecycle,
    );

    const anchor = this.slingshot.anchorWorld;
    cheese.loadAt(anchor.x, anchor.y);

    cheese.onResolved = () => {
      // Handled in update() — just need the callback registered
    };

    this.engine.addEntity(cheese);
    this.activeCheese = cheese;
    this.controller.setCheese(cheese);
  }

  destroy(): void {
    this.controller.destroy();
    this.slingshot.destroy();
    if (this.activeCheese) {
      this.engine.removeEntity(this.activeCheese);
      this.activeCheese = null;
    }
  }
}
