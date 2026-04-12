import { describe, it, expect, beforeEach, vi } from "vitest";
import { CardDeck } from "../CardDeck.js";
import type { CheeseType } from "../ShotManager.js";

describe("CardDeck", () => {
  let deck: CardDeck;
  const defaultDeck: CheeseType[] = ["cheddar", "cheddar", "brie", "cheddar", "cheddar"];

  beforeEach(() => {
    deck = new CardDeck(defaultDeck);
  });

  describe("initialization", () => {
    it("has correct remaining count", () => {
      expect(deck.remaining).toBe(5);
    });

    it("auto-selects the first card", () => {
      expect(deck.currentIndex).toBe(0);
      expect(deck.currentType).toBe("cheddar");
    });

    it("is not empty", () => {
      expect(deck.isEmpty).toBe(false);
    });

    it("is not locked", () => {
      expect(deck.isLocked).toBe(false);
    });

    it("provides a read-only view of the hand", () => {
      expect(deck.hand).toEqual(defaultDeck);
    });

    it("does not mutate the original array", () => {
      const original: CheeseType[] = ["cheddar", "brie"];
      const d = new CardDeck(original);
      d.consume();
      expect(original).toEqual(["cheddar", "brie"]);
    });
  });

  describe("selection", () => {
    it("can select a different card", () => {
      expect(deck.select(2)).toBe(true);
      expect(deck.currentIndex).toBe(2);
      expect(deck.currentType).toBe("brie");
    });

    it("fires onSelectionChanged callback", () => {
      const cb = vi.fn();
      deck.onSelectionChanged = cb;
      deck.select(2);
      expect(cb).toHaveBeenCalledWith(2, "brie");
    });

    it("returns false for same index (no-op)", () => {
      expect(deck.select(0)).toBe(false);
    });

    it("returns false for out-of-range index", () => {
      expect(deck.select(-1)).toBe(false);
      expect(deck.select(5)).toBe(false);
      expect(deck.select(100)).toBe(false);
    });

    it("returns false when locked", () => {
      deck.lock();
      expect(deck.select(2)).toBe(false);
      expect(deck.currentIndex).toBe(0);
    });
  });

  describe("locking", () => {
    it("lock prevents selection", () => {
      deck.lock();
      expect(deck.isLocked).toBe(true);
      expect(deck.select(1)).toBe(false);
    });

    it("unlock allows selection again", () => {
      deck.lock();
      deck.unlock();
      expect(deck.isLocked).toBe(false);
      expect(deck.select(1)).toBe(true);
    });
  });

  describe("consumption", () => {
    it("consumes the selected card and returns its type", () => {
      const consumed = deck.consume();
      expect(consumed).toBe("cheddar");
      expect(deck.remaining).toBe(4);
    });

    it("auto-selects the next card after consumption", () => {
      deck.consume();
      expect(deck.currentIndex).toBe(0);
      expect(deck.currentType).toBe("cheddar"); // second card
    });

    it("fires onCardConsumed callback", () => {
      const cb = vi.fn();
      deck.onCardConsumed = cb;
      deck.consume();
      expect(cb).toHaveBeenCalledWith(4);
    });

    it("fires onSelectionChanged when auto-selecting after consume", () => {
      const cb = vi.fn();
      deck.onSelectionChanged = cb;
      deck.consume();
      expect(cb).toHaveBeenCalled();
    });

    it("clamps selection index when last card is consumed", () => {
      // Select last card
      deck.select(4);
      deck.consume(); // remove last -> 4 cards remain, index clamped to 3
      expect(deck.currentIndex).toBe(3);
      expect(deck.remaining).toBe(4);
    });

    it("returns null when hand is empty", () => {
      // Consume all 5
      for (let i = 0; i < 5; i++) {
        deck.consume();
      }
      expect(deck.isEmpty).toBe(true);
      expect(deck.consume()).toBeNull();
    });

    it("unlocks selection after consumption", () => {
      deck.lock();
      deck.consume();
      expect(deck.isLocked).toBe(false);
    });

    it("reports -1 index and null type when empty", () => {
      for (let i = 0; i < 5; i++) deck.consume();
      expect(deck.currentIndex).toBe(-1);
      expect(deck.currentType).toBeNull();
    });
  });

  describe("consuming from middle of hand", () => {
    it("correctly removes the selected card from the middle", () => {
      deck.select(2); // Select the brie
      const consumed = deck.consume();
      expect(consumed).toBe("brie");
      expect(deck.remaining).toBe(4);
      // All remaining should be cheddar
      expect(deck.hand).toEqual(["cheddar", "cheddar", "cheddar", "cheddar"]);
    });
  });

  describe("full game flow", () => {
    it("plays through a complete level deck", () => {
      const types: CheeseType[] = [];

      while (!deck.isEmpty) {
        types.push(deck.currentType!);
        deck.consume();
      }

      expect(types).toEqual(["cheddar", "cheddar", "brie", "cheddar", "cheddar"]);
      expect(deck.remaining).toBe(0);
      expect(deck.isEmpty).toBe(true);
    });

    it("allows reordering via selection before consumption", () => {
      // Player picks brie first (index 2), then plays through
      deck.select(2);
      expect(deck.consume()).toBe("brie");
      expect(deck.consume()).toBe("cheddar"); // auto-selects index 0
    });
  });

  describe("edge cases", () => {
    it("handles single-card deck", () => {
      const d = new CardDeck(["brie"]);
      expect(d.remaining).toBe(1);
      expect(d.currentType).toBe("brie");
      expect(d.consume()).toBe("brie");
      expect(d.isEmpty).toBe(true);
    });

    it("handles all-brie deck", () => {
      const d = new CardDeck(["brie", "brie", "brie"]);
      for (let i = 0; i < 3; i++) {
        expect(d.currentType).toBe("brie");
        d.consume();
      }
      expect(d.isEmpty).toBe(true);
    });

    it("rapid selection changes work correctly", () => {
      deck.select(1);
      deck.select(2);
      deck.select(3);
      deck.select(4);
      expect(deck.currentIndex).toBe(4);
      expect(deck.currentType).toBe("cheddar");
    });
  });
});
