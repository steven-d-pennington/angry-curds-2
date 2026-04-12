import { Engine } from "./engine/Engine.js";
import { Entity } from "./engine/entities/Entity.js";
import { ShotManager } from "./gameplay/ShotManager.js";
import { DEFAULT_CONFIG } from "./gameplay/SlingshotConfig.js";
import { GameState } from "./gameplay/GameState.js";
import { HUD } from "./gameplay/HUD.js";
import { ScorePopupManager } from "./gameplay/ScorePopup.js";
import { setupContactHandler } from "./gameplay/ContactHandler.js";
import { buildLevel } from "./gameplay/Level.js";
import { Vec2 } from "planck";
import { Container } from "pixi.js";

// Reset default page styles so the canvas fills the window
document.documentElement.style.margin = "0";
document.documentElement.style.padding = "0";
document.documentElement.style.overflow = "hidden";
document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.overflow = "hidden";

/**
 * Lightweight entity that drives per-frame updates for gameplay systems
 * that need to tick alongside physics (ShotManager, ScorePopups, win/lose).
 */
class GameplayUpdater extends Entity {
  private readonly shotManager: ShotManager;
  private readonly popups: ScorePopupManager;
  private readonly state: GameState;

  constructor(
    engine: Engine,
    shotManager: ShotManager,
    popups: ScorePopupManager,
    state: GameState,
  ) {
    // Dummy static body (no physics effect) + invisible container
    const body = engine.physics.createBody({
      type: "static",
      position: Vec2(0, 0),
    });
    const display = new Container();
    display.visible = false;
    super(body, display);
    this.shotManager = shotManager;
    this.popups = popups;
    this.state = state;
  }

  override update(dt: number): void {
    this.shotManager.update(dt);
    this.popups.update(dt);
    this.state.checkEndConditions();
  }
}

async function main(): Promise<void> {
  const engine = await Engine.create({
    viewportWidth: 20,
    viewportHeight: 12,
    groundY: 1,
    groundWidth: 40,
  });

  // --- Game state & HUD ---
  const config = { ...DEFAULT_CONFIG };
  const state = new GameState(config.shotLifecycle.totalCheese);
  const popups = new ScorePopupManager(engine);
  const hud = new HUD(engine, config.shotLifecycle.totalCheese);
  state.init(engine, popups, hud);

  // --- Physics contact handling (block fracture, rat death) ---
  setupContactHandler(engine, state);

  // --- Build the level (structures + rats) ---
  buildLevel(engine, state);

  // --- Slingshot & shot management ---
  const shotManager = new ShotManager(engine, config);

  shotManager.onCheeseLaunched = (remaining) => {
    state.onCheeseLaunched();
    console.log(`Cheese launched! ${remaining} remaining.`);
  };

  shotManager.onAllCheeseUsed = () => {
    console.log("All cheese used — waiting for physics to settle...");
  };

  // --- Register gameplay updater entity ---
  const updater = new GameplayUpdater(engine, shotManager, popups, state);
  engine.addEntity(updater);

  // Toggle debug draw with 'D' key
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "d" || e.key === "D") {
      engine.debugDraw.toggle();
    }
  });

  engine.start();
}

main().catch(console.error);
