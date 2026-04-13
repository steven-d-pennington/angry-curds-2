import type { CheeseType } from "./ShotManager.js";

/** Card deck configuration loaded from config files. */
export interface CardDeckConfig {
  /** Card visual width in pixels */
  cardWidth: number;
  /** Card visual height in pixels */
  cardHeight: number;
  /** Gap between cards in pixels */
  cardGap: number;
  /** Y offset for selected card (positive = lowered, for top-positioned hand) */
  selectedOffsetY: number;
  /** Top margin from screen edge in pixels */
  topMargin: number;
  /** Highlight border color for selected card */
  selectedBorderColor: number;
  /** Highlight border width in pixels */
  selectedBorderWidth: number;
}

export const DEFAULT_CARD_DECK_CONFIG: CardDeckConfig = {
  cardWidth: 40,
  cardHeight: 50,
  cardGap: 6,
  selectedOffsetY: 6,
  topMargin: 55,
  selectedBorderColor: 0xffd700,
  selectedBorderWidth: 2,
};

/**
 * Manages the card deck state for a level.
 *
 * The deck is an ordered array of cheese types. The player can select any
 * remaining card before each shot. Launching a shot consumes the selected card.
 *
 * States:
 * - Cards in the deck can be: available, selected, or consumed
 * - Selection is locked during slingshot aiming
 */
export class CardDeck {
  private readonly cards: CheeseType[];
  private selectedIndex = 0;
  private locked = false;

  /** Fires when the selected card changes (passes new index and type). */
  onSelectionChanged: ((index: number, type: CheeseType) => void) | null = null;
  /** Fires when a card is consumed (passes remaining count). */
  onCardConsumed: ((remaining: number) => void) | null = null;

  constructor(deck: CheeseType[]) {
    this.cards = [...deck];
  }

  /** Number of cards remaining in the hand. */
  get remaining(): number {
    return this.cards.length;
  }

  /** Whether the hand is empty. */
  get isEmpty(): boolean {
    return this.cards.length === 0;
  }

  /** Whether card selection is currently locked (during aiming). */
  get isLocked(): boolean {
    return this.locked;
  }

  /** The currently selected card index, or -1 if hand is empty. */
  get currentIndex(): number {
    return this.cards.length > 0 ? this.selectedIndex : -1;
  }

  /** The cheese type of the currently selected card, or null if empty. */
  get currentType(): CheeseType | null {
    if (this.cards.length === 0) return null;
    return this.cards[this.selectedIndex] ?? null;
  }

  /** A read-only view of the remaining cards. */
  get hand(): readonly CheeseType[] {
    return this.cards;
  }

  /**
   * Select a card by index within the current hand.
   * No-op if locked, out of range, or already selected.
   */
  select(index: number): boolean {
    if (this.locked) return false;
    if (index < 0 || index >= this.cards.length) return false;
    if (index === this.selectedIndex) return false;

    this.selectedIndex = index;
    this.onSelectionChanged?.(index, this.cards[index]!);
    return true;
  }

  /** Lock card selection (called when slingshot aiming begins). */
  lock(): void {
    this.locked = true;
  }

  /** Unlock card selection (called when aiming is cancelled). */
  unlock(): void {
    this.locked = false;
  }

  /**
   * Consume the currently selected card (called on launch).
   * Returns the consumed cheese type, or null if hand is empty.
   * Automatically selects the next available card.
   */
  consume(): CheeseType | null {
    if (this.cards.length === 0) return null;

    const consumed = this.cards.splice(this.selectedIndex, 1)[0]!;
    this.locked = false;

    if (this.cards.length > 0) {
      // Clamp selected index to valid range
      if (this.selectedIndex >= this.cards.length) {
        this.selectedIndex = this.cards.length - 1;
      }
      this.onSelectionChanged?.(this.selectedIndex, this.cards[this.selectedIndex]!);
    } else {
      this.selectedIndex = 0;
    }

    this.onCardConsumed?.(this.cards.length);
    return consumed;
  }

  /** Add more cards to the hand (used by the continue feature). */
  addCards(types: CheeseType[]): void {
    this.cards.push(...types);
    if (this.cards.length > 0 && this.selectedIndex >= this.cards.length) {
      this.selectedIndex = this.cards.length - 1;
    }
    this.onSelectionChanged?.(this.selectedIndex, this.cards[this.selectedIndex]!);
  }
}
