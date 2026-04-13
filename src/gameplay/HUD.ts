import { Text } from "pixi.js";
import type { Container } from "pixi.js";
import type { Engine } from "../engine/Engine.js";

export class HUD {
  private readonly cheeseText: Text;
  private readonly scoreText: Text;
  private readonly overlayText: Text;
  private readonly layer: Container;

  constructor(engine: Engine, totalCheese: number) {
    this.layer = engine.getLayer("hud");

    this.cheeseText = new Text({
      text: `Cheese: ${totalCheese}/${totalCheese}`,
      style: {
        fontFamily: "Arial",
        fontSize: 28,
        fontWeight: "bold",
        fill: 0xffcc00,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    this.cheeseText.x = 20;
    this.cheeseText.y = 20;
    this.layer.addChild(this.cheeseText);

    this.scoreText = new Text({
      text: "Score: 0",
      style: {
        fontFamily: "Arial",
        fontSize: 28,
        fontWeight: "bold",
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    this.scoreText.anchor.set(1, 0);
    this.scoreText.x = engine.canvasWidth - 20;
    this.scoreText.y = 20;
    this.layer.addChild(this.scoreText);

    this.overlayText = new Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontSize: 64,
        fontWeight: "bold",
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 5 },
        align: "center",
      },
    });
    this.overlayText.anchor.set(0.5);
    this.overlayText.x = engine.canvasWidth / 2;
    this.overlayText.y = engine.canvasHeight / 2;
    this.overlayText.visible = false;
    this.layer.addChild(this.overlayText);
  }

  updateCheese(remaining: number, total: number): void {
    this.cheeseText.text = `Cheese: ${remaining}/${total}`;
  }

  updateScore(score: number): void {
    this.scoreText.text = `Score: ${score}`;
  }

  showWin(stars: number = 0): void {
    const starDisplay = "★".repeat(stars) + "☆".repeat(3 - stars);
    this.overlayText.text = `LEVEL COMPLETE!\n${starDisplay}`;
    this.overlayText.style.fill = 0x44ff44;
    this.overlayText.visible = true;
  }

  showLose(): void {
    this.overlayText.text = "TRY AGAIN";
    this.overlayText.style.fill = 0xff4444;
    this.overlayText.visible = true;
  }

  hideOverlay(): void {
    this.overlayText.visible = false;
  }
}
