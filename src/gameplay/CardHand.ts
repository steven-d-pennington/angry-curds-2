import { Container, Graphics, Text } from "pixi.js";
import type { Engine } from "../engine/Engine.js";
import type { CardDeck, CardDeckConfig } from "./CardDeck.js";
import type { CheeseType } from "./ShotManager.js";

/** Cheese type display properties. */
const CHEESE_DISPLAY: Record<CheeseType, { color: number; label: string; icon: number }> = {
  cheddar: { color: 0xffa500, label: "Cheddar", icon: 0xffa500 },
  brie: { color: 0xfff8e7, label: "Brie", icon: 0xe8d5a3 },
};

/** Animation duration in seconds. */
const ANIM_DEAL_DURATION = 0.3;
const ANIM_DEAL_STAGGER = 0.06;
const ANIM_SHIFT_DURATION = 0.2;

interface CardAnim {
  container: Container;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startAlpha: number;
  targetAlpha: number;
  startScale: number;
  targetScale: number;
  elapsed: number;
  duration: number;
}

/**
 * Visual representation of the card hand at the top of the screen.
 *
 * Renders each remaining card as a rectangle with cheese type icon and label.
 * The selected card is lowered and highlighted with a gold border.
 * Handles pointer input for card selection.
 * Cards animate in with a stagger deal effect and shift smoothly when consumed.
 */
export class CardHand {
  private readonly container: Container;
  private readonly engine: Engine;
  private readonly deck: CardDeck;
  private readonly config: CardDeckConfig;
  private readonly cardContainers: Container[] = [];
  private readonly pointerHandler: (e: PointerEvent) => void;
  private readonly tickHandler: () => void;
  private animations: CardAnim[] = [];
  private isInitialDeal = true;

  constructor(engine: Engine, deck: CardDeck, config: CardDeckConfig) {
    this.engine = engine;
    this.deck = deck;
    this.config = config;

    this.container = new Container();
    engine.getLayer("hud").addChild(this.container);

    // Wire deck events to animated redraw
    const origSelectionChanged = deck.onSelectionChanged;
    deck.onSelectionChanged = (index, type) => {
      origSelectionChanged?.(index, type);
      this.animatedRedraw(false);
    };
    const origCardConsumed = deck.onCardConsumed;
    deck.onCardConsumed = (remaining) => {
      origCardConsumed?.(remaining);
      this.animatedRedraw(false);
    };

    // Handle card tap input
    this.pointerHandler = (e: PointerEvent) => {
      this.handlePointer(e);
    };
    engine.app.canvas.addEventListener("pointerdown", this.pointerHandler);

    // Animation tick
    this.tickHandler = () => {
      this.updateAnimations();
    };
    engine.app.ticker.add(this.tickHandler);

    // Initial deal animation
    this.animatedRedraw(true);
  }

  /** Rebuild all card visuals with animation. */
  private animatedRedraw(isDeal: boolean): void {
    // Record old positions before clearing
    const oldPositions = this.cardContainers.map((c) => ({
      x: c.x,
      y: c.y,
    }));

    // Clear existing
    for (const c of this.cardContainers) {
      c.destroy({ children: true });
    }
    this.cardContainers.length = 0;
    this.container.removeChildren();
    this.animations = [];

    const hand = this.deck.hand;
    if (hand.length === 0) return;

    const { cardWidth, cardHeight, cardGap, selectedOffsetY, topMargin } = this.config;
    const handWidth = hand.length * (cardWidth + cardGap) - cardGap;
    const startX = (this.engine.canvasWidth - handWidth) / 2;
    const baseY = topMargin;
    const selectedIdx = this.deck.currentIndex;

    for (let i = 0; i < hand.length; i++) {
      const type = hand[i]!;
      const isSelected = i === selectedIdx;
      const card = this.createCard(type, isSelected, cardWidth, cardHeight);

      const targetX = startX + i * (cardWidth + cardGap);
      const targetY = isSelected ? baseY + selectedOffsetY : baseY;

      if (isDeal && this.isInitialDeal) {
        // Deal animation: cards slide in from above with stagger
        const fromY = -cardHeight - 20;
        card.x = targetX;
        card.y = fromY;
        card.alpha = 0;
        card.scale.set(0.8);

        this.animations.push({
          container: card,
          startX: targetX,
          startY: fromY,
          targetX,
          targetY,
          startAlpha: 0,
          targetAlpha: 1,
          startScale: 0.8,
          targetScale: 1,
          elapsed: -i * ANIM_DEAL_STAGGER, // negative = delayed start
          duration: ANIM_DEAL_DURATION,
        });
      } else if (!isDeal && oldPositions.length > 0) {
        // Shift animation: cards move to new positions
        const oldPos = oldPositions[i] ?? { x: targetX, y: targetY - 15 };
        card.x = oldPos.x;
        card.y = oldPos.y;

        if (oldPos.x !== targetX || oldPos.y !== targetY) {
          this.animations.push({
            container: card,
            startX: oldPos.x,
            startY: oldPos.y,
            targetX,
            targetY,
            startAlpha: 1,
            targetAlpha: 1,
            startScale: 1,
            targetScale: 1,
            elapsed: 0,
            duration: ANIM_SHIFT_DURATION,
          });
        } else {
          card.x = targetX;
          card.y = targetY;
        }
      } else {
        card.x = targetX;
        card.y = targetY;
      }

      this.container.addChild(card);
      this.cardContainers.push(card);
    }

    if (isDeal) {
      this.isInitialDeal = false;
    }
  }

  /** Update running animations each frame. */
  private updateAnimations(): void {
    if (this.animations.length === 0) return;

    const dt = this.engine.app.ticker.deltaMS / 1000;
    const completed: number[] = [];

    for (let i = 0; i < this.animations.length; i++) {
      const anim = this.animations[i]!;
      anim.elapsed += dt;

      if (anim.elapsed < 0) continue; // delayed start

      const t = Math.min(anim.elapsed / anim.duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      anim.container.x = anim.startX + (anim.targetX - anim.startX) * eased;
      anim.container.y = anim.startY + (anim.targetY - anim.startY) * eased;
      anim.container.alpha = anim.startAlpha + (anim.targetAlpha - anim.startAlpha) * eased;

      const s = anim.startScale + (anim.targetScale - anim.startScale) * eased;
      anim.container.scale.set(s);

      if (t >= 1) {
        completed.push(i);
      }
    }

    // Remove completed animations in reverse order
    for (let i = completed.length - 1; i >= 0; i--) {
      this.animations.splice(completed[i]!, 1);
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
    bg.roundRect(0, 0, width, height, 8);
    bg.fill({ color: 0x2a2a2a, alpha: 0.9 });

    if (isSelected) {
      bg.roundRect(0, 0, width, height, 8);
      bg.stroke({ color: selectedBorderColor, width: selectedBorderWidth });
    } else {
      bg.roundRect(0, 0, width, height, 8);
      bg.stroke({ color: 0x555555, width: 1 });
    }
    container.addChild(bg);

    // Cheese icon (circle with glow for selected)
    const iconSize = Math.min(width, height) * 0.35;
    const icon = new Graphics();

    if (isSelected) {
      // Subtle glow behind selected card icon
      icon.circle(width / 2, height * 0.38, iconSize + 3);
      icon.fill({ color: display.color, alpha: 0.2 });
    }

    icon.circle(width / 2, height * 0.38, iconSize);
    icon.fill({ color: display.color });

    // Add rind for brie
    if (type === "brie") {
      icon.arc(width / 2, height * 0.38, iconSize, -Math.PI, 0);
      icon.stroke({ color: display.icon, width: iconSize * 0.15 });
    }
    container.addChild(icon);

    // Label
    const fontSize = Math.max(7, Math.round(width * 0.2));
    const label = new Text({
      text: display.label,
      style: {
        fontFamily: "Nunito, Arial, sans-serif",
        fontSize,
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

    const { cardWidth, cardHeight, cardGap, topMargin, selectedOffsetY } = this.config;
    const handWidth = hand.length * (cardWidth + cardGap) - cardGap;
    const startX = (this.engine.canvasWidth - handWidth) / 2;
    const baseY = topMargin;

    const px = e.clientX;
    const py = e.clientY;

    // Only process taps in the card area at the top of the screen
    if (py < baseY || py > baseY + cardHeight + selectedOffsetY + 10) return;

    for (let i = 0; i < hand.length; i++) {
      const cx = startX + i * (cardWidth + cardGap);
      if (px >= cx && px <= cx + cardWidth) {
        this.deck.select(i);
        return;
      }
    }
  }

  /** Height of the card area from the top of the screen (for tap exclusion). */
  get areaHeight(): number {
    return this.config.topMargin + this.config.cardHeight + this.config.selectedOffsetY;
  }

  destroy(): void {
    this.engine.app.canvas.removeEventListener("pointerdown", this.pointerHandler);
    this.engine.app.ticker.remove(this.tickHandler);
    this.animations = [];
    for (const c of this.cardContainers) {
      c.destroy({ children: true });
    }
    this.container.destroy({ children: true });
  }
}
