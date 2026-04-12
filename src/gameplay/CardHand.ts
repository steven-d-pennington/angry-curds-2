import { Container, Graphics, Text } from "pixi.js";
import type { Engine } from "../engine/Engine.js";
import type { CardDeck, CardDeckConfig } from "./CardDeck.js";
import type { CheeseType } from "./ShotManager.js";

/** Cheese type display properties. */
const CHEESE_DISPLAY: Record<CheeseType, { color: number; label: string; icon: number }> = {
  cheddar: { color: 0xffa500, label: "Cheddar", icon: 0xffa500 },
  brie: { color: 0xfff8e7, label: "Brie", icon: 0xe8d5a3 },
};

/**
 * Visual representation of the card hand at the bottom of the screen.
 *
 * Renders each remaining card as a rectangle with cheese type icon and label.
 * The selected card is raised and highlighted with a gold border.
 * Handles pointer input for card selection.
 */
export class CardHand {
  private readonly container: Container;
  private readonly engine: Engine;
  private readonly deck: CardDeck;
  private readonly config: CardDeckConfig;
  private readonly cardContainers: Container[] = [];
  private readonly pointerHandler: (e: PointerEvent) => void;

  constructor(engine: Engine, deck: CardDeck, config: CardDeckConfig) {
    this.engine = engine;
    this.deck = deck;
    this.config = config;

    this.container = new Container();
    engine.getLayer("hud").addChild(this.container);

    // Wire deck events to redraw
    const origSelectionChanged = deck.onSelectionChanged;
    deck.onSelectionChanged = (index, type) => {
      origSelectionChanged?.(index, type);
      this.redraw();
    };
    const origCardConsumed = deck.onCardConsumed;
    deck.onCardConsumed = (remaining) => {
      origCardConsumed?.(remaining);
      this.redraw();
    };

    // Handle card tap input
    this.pointerHandler = (e: PointerEvent) => {
      this.handlePointer(e);
    };
    engine.app.canvas.addEventListener("pointerdown", this.pointerHandler);

    this.redraw();
  }

  /** Rebuild all card visuals from current deck state. */
  redraw(): void {
    // Clear existing
    for (const c of this.cardContainers) {
      c.destroy({ children: true });
    }
    this.cardContainers.length = 0;
    this.container.removeChildren();

    const hand = this.deck.hand;
    if (hand.length === 0) return;

    const { cardWidth, cardHeight, cardGap, selectedOffsetY, bottomMargin } = this.config;
    const handWidth = hand.length * (cardWidth + cardGap) - cardGap;
    const startX = (this.engine.canvasWidth - handWidth) / 2;
    const baseY = this.engine.canvasHeight - cardHeight - bottomMargin;
    const selectedIdx = this.deck.currentIndex;

    for (let i = 0; i < hand.length; i++) {
      const type = hand[i]!;
      const isSelected = i === selectedIdx;
      const card = this.createCard(type, isSelected, cardWidth, cardHeight);

      card.x = startX + i * (cardWidth + cardGap);
      card.y = isSelected ? baseY + selectedOffsetY : baseY;

      this.container.addChild(card);
      this.cardContainers.push(card);
    }
  }

  private createCard(
    type: CheeseType,
    isSelected: boolean,
    width: number,
    height: number,
  ): Container {
    const container = new Container();
    const display = CHEESE_DISPLAY[type];
    const { selectedBorderColor, selectedBorderWidth } = this.config;

    // Card background
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 6);
    bg.fill({ color: 0x2a2a2a, alpha: 0.85 });

    if (isSelected) {
      bg.roundRect(0, 0, width, height, 6);
      bg.stroke({ color: selectedBorderColor, width: selectedBorderWidth });
    } else {
      bg.roundRect(0, 0, width, height, 6);
      bg.stroke({ color: 0x666666, width: 1 });
    }
    container.addChild(bg);

    // Cheese icon (circle)
    const iconSize = Math.min(width, height) * 0.35;
    const icon = new Graphics();
    icon.circle(width / 2, height * 0.38, iconSize);
    icon.fill({ color: display.color });

    // Add rind for brie
    if (type === "brie") {
      icon.arc(width / 2, height * 0.38, iconSize, -Math.PI, 0);
      icon.stroke({ color: display.icon, width: iconSize * 0.15 });
    }
    container.addChild(icon);

    // Label
    const label = new Text({
      text: display.label,
      style: {
        fontFamily: "Arial",
        fontSize: 10,
        fontWeight: "bold",
        fill: 0xffffff,
        align: "center",
      },
    });
    label.anchor.set(0.5, 0);
    label.x = width / 2;
    label.y = height * 0.7;
    container.addChild(label);

    return container;
  }

  /** Hit-test pointer events against card positions. */
  private handlePointer(e: PointerEvent): void {
    if (this.deck.isLocked) return;

    const hand = this.deck.hand;
    if (hand.length === 0) return;

    const { cardWidth, cardHeight, cardGap, bottomMargin } = this.config;
    const handWidth = hand.length * (cardWidth + cardGap) - cardGap;
    const startX = (this.engine.canvasWidth - handWidth) / 2;
    const baseY = this.engine.canvasHeight - cardHeight - bottomMargin;

    const px = e.clientX;
    const py = e.clientY;

    // Only process taps in the card area
    if (py < baseY - 20 || py > this.engine.canvasHeight) return;

    for (let i = 0; i < hand.length; i++) {
      const cx = startX + i * (cardWidth + cardGap);
      if (px >= cx && px <= cx + cardWidth) {
        this.deck.select(i);
        return;
      }
    }
  }

  /** Height of the card area from the bottom of the screen (for tap exclusion). */
  get areaHeight(): number {
    return this.config.cardHeight + this.config.bottomMargin - this.config.selectedOffsetY;
  }

  destroy(): void {
    this.engine.app.canvas.removeEventListener("pointerdown", this.pointerHandler);
    for (const c of this.cardContainers) {
      c.destroy({ children: true });
    }
    this.container.destroy({ children: true });
  }
}
