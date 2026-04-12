import type { Block } from "../entities/Block.js";
import type { Rat } from "../entities/Rat.js";
import type { ScorePopupManager } from "./ScorePopup.js";
import type { HUD } from "./HUD.js";
import type { Engine } from "../engine/Engine.js";
import { calculateStars, saveStarRating } from "./StarRating.js";
import { audioManager } from "../audio/AudioManager.js";

const POINTS_RAT_KILLED = 500;
const POINTS_BLOCK_DESTROYED = 50;
const POINTS_UNUSED_CHEESE = 1000;

export class GameState {
  score = 0;
  totalCheese: number;
  cheeseUsed = 0;
  /** Star rating earned on win (0 before completion). */
  stars = 0;
  private readonly rats: Set<Rat> = new Set();
  private popups: ScorePopupManager | null = null;
  private hud: HUD | null = null;
  private engine: Engine | null = null;
  private settled = false;
  private gameOver = false;
  private readonly levelNumber: number;
  private readonly starThresholds: readonly [number, number, number];

  /** Called when the level is won — for UI overlay integration. */
  onGameWin: ((score: number, stars: number) => void) | null = null;
  /** Called when the level is lost — for UI overlay integration. */
  onGameLose: ((score: number) => void) | null = null;

  constructor(
    totalCheese: number,
    levelNumber: number,
    starThresholds: readonly [number, number, number],
  ) {
    this.totalCheese = totalCheese;
    this.levelNumber = levelNumber;
    this.starThresholds = starThresholds;
  }

  /** Wire up after all systems are initialized */
  init(engine: Engine, popups: ScorePopupManager, hud: HUD): void {
    this.engine = engine;
    this.popups = popups;
    this.hud = hud;
  }

  registerRat(rat: Rat): void {
    this.rats.add(rat);
  }

  get cheeseRemaining(): number {
    return this.totalCheese - this.cheeseUsed;
  }

  get aliveRats(): number {
    let count = 0;
    for (const rat of this.rats) {
      if (rat.alive) count++;
    }
    return count;
  }

  onCheeseLaunched(): void {
    this.cheeseUsed++;
    this.hud?.updateCheese(this.cheeseRemaining, this.totalCheese);
    this.settled = false;
    audioManager.playSfx("cheeseLaunch");
  }

  onBlockDestroyed(_block: Block): void {
    this.score += POINTS_BLOCK_DESTROYED;
    this.hud?.updateScore(this.score);
    audioManager.playSfx("structureBreak");
  }

  onRatKilled(_rat: Rat, worldX: number, worldY: number): void {
    this.rats.delete(_rat);
    this.score += POINTS_RAT_KILLED;
    this.popups?.spawn(worldX, worldY, POINTS_RAT_KILLED);
    this.hud?.updateScore(this.score);
    audioManager.playSfx("ratDeath");
  }

  /** Called each frame to check win/lose conditions */
  checkEndConditions(): void {
    if (this.gameOver) return;

    // Win: all rats dead
    if (this.aliveRats === 0) {
      this.gameOver = true;
      // Bonus for unused cheese
      const bonus = this.cheeseRemaining * POINTS_UNUSED_CHEESE;
      this.score += bonus;
      this.hud?.updateScore(this.score);

      // Calculate and persist star rating
      this.stars = calculateStars(this.score, this.starThresholds);
      saveStarRating(this.levelNumber, this.stars);

      audioManager.stopMusic();
      audioManager.playSfx("levelComplete");
      this.hud?.showWin(this.stars);
      this.engine?.stop();
      this.onGameWin?.(this.score, this.stars);
      return;
    }

    // Lose: all cheese used and physics settled
    if (this.cheeseRemaining <= 0 && !this.settled) {
      // Wait a couple seconds for physics to settle after last shot
      this.settled = true;
      if (this.engine) {
        setTimeout(() => {
          if (this.gameOver) return;
          if (this.aliveRats > 0) {
            this.gameOver = true;
            audioManager.stopMusic();
            audioManager.playSfx("levelFail");
            this.hud?.showLose();
            this.engine?.stop();
            this.onGameLose?.(this.score);
          }
        }, 3000);
      }
    }
  }
}
