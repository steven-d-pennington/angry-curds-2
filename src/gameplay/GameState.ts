import type { Block } from "../entities/Block.js";
import type { Rat } from "../entities/Rat.js";
import type { ScorePopupManager } from "./ScorePopup.js";
import type { HUD } from "./HUD.js";
import type { Engine } from "../engine/Engine.js";

const POINTS_RAT_KILLED = 500;
const POINTS_BLOCK_DESTROYED = 50;
const POINTS_UNUSED_CHEESE = 1000;

export class GameState {
  score = 0;
  totalCheese: number;
  cheeseUsed = 0;
  private readonly rats: Set<Rat> = new Set();
  private popups: ScorePopupManager | null = null;
  private hud: HUD | null = null;
  private engine: Engine | null = null;
  private settled = false;
  private gameOver = false;

  constructor(totalCheese: number) {
    this.totalCheese = totalCheese;
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
  }

  onBlockDestroyed(_block: Block): void {
    this.score += POINTS_BLOCK_DESTROYED;
    this.hud?.updateScore(this.score);
  }

  onRatKilled(_rat: Rat, worldX: number, worldY: number): void {
    this.rats.delete(_rat);
    this.score += POINTS_RAT_KILLED;
    this.popups?.spawn(worldX, worldY, POINTS_RAT_KILLED);
    this.hud?.updateScore(this.score);
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
      this.hud?.showWin();
      this.engine?.stop();
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
            this.hud?.showLose();
            this.engine?.stop();
          }
        }, 3000);
      }
    }
  }
}
