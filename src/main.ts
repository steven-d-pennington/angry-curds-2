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
import { ScreenShake } from "./gameplay/ScreenShake.js";
import { SlowMotion } from "./gameplay/SlowMotion.js";
import { CameraController } from "./gameplay/CameraController.js";
import { DEFAULT_JUICE_CONFIG } from "./gameplay/JuiceConfig.js";
import { ScreenFlash } from "./engine/vfx/ScreenFlash.js";
import { CameraZoom } from "./engine/vfx/CameraZoom.js";

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
  private screenShake: ScreenShake | null = null;
  private slowMotion: SlowMotion | null = null;
  private cameraController: CameraController | null = null;
  private screenFlash: ScreenFlash | null = null;
  private cameraZoom: CameraZoom | null = null;
  private juiceFrameCallback: ((dt: number) => void) | null = null;

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

    // Clean up juice systems
    this.screenShake?.reset();
    this.slowMotion?.destroy();
    this.cameraController?.reset();
    this.screenFlash?.destroy();
    this.cameraZoom?.destroy();
    if (this.juiceFrameCallback) {
      this.engine.removeFrameCallback(this.juiceFrameCallback);
      this.juiceFrameCallback = null;
    }
    // Reset stage position/rotation/scale (shake/camera/zoom may have offset it)
    this.engine.app.stage.x = 0;
    this.engine.app.stage.y = 0;
    this.engine.app.stage.rotation = 0;
    this.engine.app.stage.scale.set(1);
    this.engine.app.stage.pivot.set(0);

    // Flush particle emitter memory before clearing layers
    this.engine.particles.reset();

    this.engine.destroyAllEntities();
    this.engine.physics.destroyAllDynamic();
    this.engine.clearLayers();

    // Re-attach the persistent particle emitter to the VFX layer
    this.engine.particles.reattach(this.engine.getLayer("vfx"));

    this.shotManager = null;
    this.updater = null;
    this.cardHand = null;
    this.state = null;
    this.cardDeck = null;
    this.screenShake = null;
    this.slowMotion = null;
    this.cameraController = null;
    this.screenFlash = null;
    this.cameraZoom = null;
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

    // Juice systems
    const juiceConfig = DEFAULT_JUICE_CONFIG;
    const screenShake = new ScreenShake(this.engine.app.stage, juiceConfig.screenShake);
    const slowMotion = new SlowMotion(this.engine, juiceConfig.slowMotion);
    const cameraController = new CameraController(this.engine, juiceConfig.camera);
    const screenFlash = new ScreenFlash(this.engine.app);
    const cameraZoom = new CameraZoom(this.engine.app.stage);
    this.screenShake = screenShake;
    this.slowMotion = slowMotion;
    this.cameraController = cameraController;
    this.screenFlash = screenFlash;
    this.cameraZoom = cameraZoom;

    state.init(this.engine, popups, hud, slowMotion, screenShake);

    // Frame callback: update juice systems and composite stage offset
    this.juiceFrameCallback = (realDt: number) => {
      cameraController.update(realDt);
      screenShake.update(realDt);
      // After shake sets stage.x/y/rotation, add camera pan offset
      this.engine.app.stage.x += cameraController.offsetX;
      // Update screen flash overlay
      screenFlash.update(realDt);
      // Update camera zoom punch
      cameraZoom.update(realDt);
    };
    this.engine.addFrameCallback(this.juiceFrameCallback);

    // Wire win/lose to React overlay (with a short delay so the
    // PixiJS HUD overlay is visible briefly before the React screen)
    state.onGameWin = (score, stars) => {
      setTimeout(() => onWin(score, stars), 1200);
    };
    state.onGameLose = (score) => {
      setTimeout(() => onLose(score), 1200);
    };

    setupContactHandler(this.engine, state, screenShake, screenFlash);
    loadLevel(levelData, this.engine, state);

    const shotManager = new ShotManager(this.engine, config, cardDeck);
    shotManager.onCheeseLaunched = (remaining) => {
      state.onCheeseLaunched();
      hud.updateCheese(remaining, levelData.totalCheese);
      cameraController.onLaunch();
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

    // Card hand UI — small cards centered at the top of the screen
    const cardHand = new CardHand(this.engine, cardDeck, DEFAULT_CARD_DECK_CONFIG);
    this.cardHand = cardHand;

    // Tap-to-activate: tapping anywhere (outside card area) while a special
    // cheese is in flight triggers its ability (split / detonate / pierce)
    const cardAreaHeight = cardHand.areaHeight;
    this.splitHandler = (e: PointerEvent) => {
      // Ignore taps in the card area at the top of the screen
      if (e.clientY < cardAreaHeight) return;

      // Brie: tap to split
      const brie = shotManager.activeBrie;
      if (brie && brie.canSplit) {
        brie.activateSplit();
        return;
      }

      // Gouda: tap to detonate (with screen flash + camera zoom)
      const gouda = shotManager.activeGouda;
      if (gouda && gouda.canDetonate) {
        gouda.onRatKilled = (rat, wx, wy) => state.onRatKilled(rat, wx, wy);
        gouda.onBlockDestroyed = (block, wx, wy) => {
          state.onBlockDestroyed(block, wx, wy);
          this.engine.removeEntity(block);
        };
        gouda.activateDetonation();
        screenFlash.trigger(0xffffff, 0.4, 0.1);
        cameraZoom.trigger(
          1.08, 0.1, 0.2,
          this.engine.canvasWidth, this.engine.canvasHeight,
        );
        screenShake.trigger(8);
        return;
      }

      // Swiss: tap to pierce
      const swiss = shotManager.activeSwiss;
      if (swiss && swiss.canPierce) {
        swiss.activatePierce();
        return;
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
  // Ensure custom fonts are loaded before rendering any text
  await document.fonts.ready;

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
          name: data.meta.name,
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
