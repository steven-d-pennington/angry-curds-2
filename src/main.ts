import React from "react";
import { createRoot } from "react-dom/client";
import { Engine } from "./engine/Engine.js";
import { Entity } from "./engine/entities/Entity.js";
import { ShotManager } from "./gameplay/ShotManager.js";
import { DEFAULT_CONFIG } from "./gameplay/SlingshotConfig.js";
import { GameState } from "./gameplay/GameState.js";
import { HUD } from "./gameplay/HUD.js";
import { ScorePopupManager } from "./gameplay/ScorePopup.js";
import { setupContactHandler } from "./gameplay/ContactHandler.js";
import { CardDeck, DEFAULT_CARD_DECK_CONFIG } from "./gameplay/CardDeck.js";
import { CardHand } from "./gameplay/CardHand.js";
import { LevelManager } from "./levels/LevelManager.js";
import { loadLevel } from "./levels/LevelLoader.js";
import { audioManager } from "./audio/AudioManager.js";
import { MenuOverlay, type MenuCallbacks, type MenuOverlayHandle } from "./ui/MenuOverlay.js";
import type { LevelInfo } from "./ui/screens/LevelSelectScreen.js";
import { getBestStars } from "./gameplay/StarRating.js";
import { Vec2 } from "planck";
import { Container } from "pixi.js";
import type { CheeseType } from "./gameplay/ShotManager.js";

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

/**
 * Manages a single gameplay session — creating/destroying all gameplay
 * objects for a level without recreating the engine.
 */
class GameSession {
  private readonly engine: Engine;
  private readonly levels: LevelManager;
  private shotManager: ShotManager | null = null;
  private updater: GameplayUpdater | null = null;
  private splitHandler: ((e: PointerEvent) => void) | null = null;
  private cardHand: CardHand | null = null;
  private state: GameState | null = null;
  private cardDeck: CardDeck | null = null;

  constructor(engine: Engine, levels: LevelManager) {
    this.engine = engine;
    this.levels = levels;
  }

  /** Tear down the current level, cleaning up all entities and physics. */
  teardown(): void {
    this.engine.stop();
    this.shotManager?.destroy();
    this.cardHand?.destroy();
    if (this.updater) {
      this.engine.removeEntity(this.updater);
    }
    if (this.splitHandler) {
      this.engine.app.canvas.removeEventListener("pointerdown", this.splitHandler);
      this.splitHandler = null;
    }
    this.engine.destroyAllEntities();
    this.engine.physics.destroyAllDynamic();
    this.engine.clearLayers();

    this.shotManager = null;
    this.updater = null;
    this.cardHand = null;
    this.state = null;
    this.cardDeck = null;
  }

  /** Build and start a level with win/lose callbacks for the React overlay. */
  start(
    onWin: (score: number, stars: number) => void,
    onLose: (score: number) => void,
  ): void {
    const levelData = this.levels.current;
    const config = { ...DEFAULT_CONFIG };
    config.shotLifecycle = {
      ...config.shotLifecycle,
      totalCheese: levelData.totalCheese,
    };

    // Build card deck from level data (falls back to all-cheddar)
    const deckTypes: CheeseType[] = levelData.deck ??
      Array.from<CheeseType>({ length: levelData.totalCheese }).fill("cheddar");
    const cardDeck = new CardDeck(deckTypes);

    const starThresholds =
      levelData.starThresholds ?? ([1000, 2000, 3000] as const);
    const state = new GameState(
      levelData.totalCheese,
      levelData.meta.number,
      starThresholds,
      cardDeck,
    );
    const popups = new ScorePopupManager(this.engine);
    const hud = new HUD(this.engine, levelData.totalCheese);
    state.init(this.engine, popups, hud);

    // Wire win/lose to React overlay (with a short delay so the
    // PixiJS HUD overlay is visible briefly before the React screen)
    state.onGameWin = (score, stars) => {
      setTimeout(() => onWin(score, stars), 1200);
    };
    state.onGameLose = (score) => {
      setTimeout(() => onLose(score), 1200);
    };

    setupContactHandler(this.engine, state);
    loadLevel(levelData, this.engine, state);

    const shotManager = new ShotManager(this.engine, config, cardDeck);
    shotManager.onCheeseLaunched = (remaining) => {
      state.onCheeseLaunched();
      hud.updateCheese(remaining, levelData.totalCheese);
      console.log(`Cheese launched! ${remaining} remaining.`);
    };
    shotManager.onAllCheeseUsed = () => {
      console.log("All cheese used — waiting for physics to settle...");
    };

    // When card selection changes mid-hand, reload the slingshot with the new type
    // (only when not currently aiming or in-flight).
    // Must be set BEFORE CardHand so CardHand's constructor can chain it with redraw.
    cardDeck.onSelectionChanged = (_index, type) => {
      if (!shotManager.isAiming && shotManager.remaining > 0) {
        shotManager.reloadCurrent(type);
      }
    };

    // Card hand UI — position cards to the right of the slingshot interaction zone
    // Slingshot center at positionX with 1.5m interaction radius + visual buffer
    const slingshotClearanceX = config.slingshot.positionX + 2.0;
    const slingshotClearancePixels = this.engine.worldToScreenPos(slingshotClearanceX, 0).x;
    const cardDeckConfig = { ...DEFAULT_CARD_DECK_CONFIG, leftMargin: Math.ceil(slingshotClearancePixels) };
    const cardHand = new CardHand(this.engine, cardDeck, cardDeckConfig);
    this.cardHand = cardHand;

    // Tap-to-split: tapping anywhere (outside card area) while a Brie
    // is in flight triggers the split ability
    const cardAreaHeight = cardHand.areaHeight;
    this.splitHandler = (e: PointerEvent) => {
      // Ignore taps in the card area at the bottom of the screen
      if (e.clientY > this.engine.canvasHeight - cardAreaHeight) return;
      const brie = shotManager.activeBrie;
      if (brie && brie.canSplit) {
        brie.activateSplit();
      }
    };
    this.engine.app.canvas.addEventListener("pointerdown", this.splitHandler);

    const updater = new GameplayUpdater(
      this.engine,
      shotManager,
      popups,
      state,
    );
    this.engine.addEntity(updater);

    this.shotManager = shotManager;
    this.updater = updater;
    this.state = state;
    this.cardDeck = cardDeck;

    this.engine.start();
  }

  /** Continue the current level by adding 3 extra cheddar cheese. */
  continue(): void {
    if (!this.state || !this.cardDeck || !this.shotManager) return;

    const extraCards: CheeseType[] = ["cheddar", "cheddar", "cheddar"];
    this.cardDeck.addCards(extraCards);
    this.state.continueGame(3);
    this.engine.start();
    this.shotManager.loadNextCheese();
  }
}

async function main(): Promise<void> {
  const engine = await Engine.create({
    viewportWidth: 20,
    viewportHeight: 12,
    groundY: 1,
    groundWidth: 40,
  });

  const levels = new LevelManager();
  const session = new GameSession(engine, levels);

  // --- Audio ---
  audioManager.init();

  // Resume audio context on first user interaction (autoplay policy)
  const resumeAudio = () => {
    audioManager.resumeContext();
    window.removeEventListener("pointerdown", resumeAudio);
    window.removeEventListener("keydown", resumeAudio);
  };
  window.addEventListener("pointerdown", resumeAudio);
  window.addEventListener("keydown", resumeAudio);

  // Toggle debug draw with 'D' key, 'M' to mute
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "d" || e.key === "D") {
      engine.debugDraw.toggle();
    }
    if (e.key === "m" || e.key === "M") {
      audioManager.toggleMute();
    }
  });

  // ── React menu overlay ──────────────────────────────────────
  let menuHandle: MenuOverlayHandle | null = null;

  const startCurrentLevel = () => {
    session.teardown();
    session.start(
      (score, stars) => menuHandle?.showWin(score, stars),
      (score) => menuHandle?.showLose(score),
    );
  };

  const menuCallbacks: MenuCallbacks = {
    startLevel: (levelIndex: number) => {
      levels.setLevel(levelIndex);
      audioManager.playMusic();
      startCurrentLevel();
    },
    retryLevel: () => {
      audioManager.playMusic();
      startCurrentLevel();
    },
    continueLevel: () => {
      audioManager.playMusic();
      session.continue();
    },
    getLevels: () => {
      const result: LevelInfo[] = [];
      const currentIdx = levels.currentIndex;
      for (let i = 0; i < levels.levelCount; i++) {
        const data = levels.setLevel(i);
        // A level is unlocked if it's level 1, or the previous level has stars > 0
        const unlocked = i === 0 || getBestStars(i) > 0;
        result.push({
          number: data.meta.number,
          unlocked,
          bestStars: getBestStars(data.meta.number),
        });
      }
      // Restore the current index
      levels.setLevel(currentIdx);
      return result;
    },
    hasNextLevel: () => levels.hasNext,
    startNextLevel: () => {
      const nextData = levels.advance();
      if (nextData) {
        audioManager.playMusic();
        startCurrentLevel();
      }
    },
  };

  // Mount React overlay
  const overlayDiv = document.getElementById("menu-overlay")!;
  const root = createRoot(overlayDiv);
  root.render(
    React.createElement(MenuOverlay, {
      callbacks: menuCallbacks,
      onHandle: (handle: MenuOverlayHandle) => {
        menuHandle = handle;
      },
    }),
  );
}

main().catch(console.error);
