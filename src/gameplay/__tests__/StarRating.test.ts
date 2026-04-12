import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateStars,
  loadStarRatings,
  getBestStars,
  saveStarRating,
} from "../StarRating.js";

describe("calculateStars", () => {
  const thresholds: [number, number, number] = [1000, 2000, 3000];

  it("returns 0 stars below 1-star threshold", () => {
    expect(calculateStars(0, thresholds)).toBe(0);
    expect(calculateStars(500, thresholds)).toBe(0);
    expect(calculateStars(999, thresholds)).toBe(0);
  });

  it("returns 1 star at exactly the 1-star threshold", () => {
    expect(calculateStars(1000, thresholds)).toBe(1);
  });

  it("returns 1 star between 1-star and 2-star thresholds", () => {
    expect(calculateStars(1500, thresholds)).toBe(1);
    expect(calculateStars(1999, thresholds)).toBe(1);
  });

  it("returns 2 stars at exactly the 2-star threshold", () => {
    expect(calculateStars(2000, thresholds)).toBe(2);
  });

  it("returns 2 stars between 2-star and 3-star thresholds", () => {
    expect(calculateStars(2500, thresholds)).toBe(2);
    expect(calculateStars(2999, thresholds)).toBe(2);
  });

  it("returns 3 stars at exactly the 3-star threshold", () => {
    expect(calculateStars(3000, thresholds)).toBe(3);
  });

  it("returns 3 stars above the 3-star threshold", () => {
    expect(calculateStars(5000, thresholds)).toBe(3);
    expect(calculateStars(999999, thresholds)).toBe(3);
  });

  it("handles zero thresholds", () => {
    expect(calculateStars(0, [0, 0, 0])).toBe(3);
  });

  it("handles very large thresholds", () => {
    const big: [number, number, number] = [100000, 200000, 300000];
    expect(calculateStars(50000, big)).toBe(0);
    expect(calculateStars(150000, big)).toBe(1);
    expect(calculateStars(250000, big)).toBe(2);
    expect(calculateStars(300000, big)).toBe(3);
  });
});

describe("persistence", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    const fakeStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      get length() { return store.size; },
      key: (_index: number) => null,
    } satisfies Storage;

    vi.stubGlobal("localStorage", fakeStorage);
  });

  it("loadStarRatings returns empty object when nothing saved", () => {
    expect(loadStarRatings()).toEqual({});
  });

  it("getBestStars returns 0 for unsaved level", () => {
    expect(getBestStars(1)).toBe(0);
    expect(getBestStars(99)).toBe(0);
  });

  it("saveStarRating persists and returns the saved value", () => {
    const best = saveStarRating(1, 2);
    expect(best).toBe(2);
    expect(getBestStars(1)).toBe(2);
  });

  it("saveStarRating keeps the higher value", () => {
    saveStarRating(1, 3);
    const best = saveStarRating(1, 1);
    expect(best).toBe(3);
    expect(getBestStars(1)).toBe(3);
  });

  it("saveStarRating upgrades when new value is higher", () => {
    saveStarRating(1, 1);
    const best = saveStarRating(1, 3);
    expect(best).toBe(3);
    expect(getBestStars(1)).toBe(3);
  });

  it("tracks multiple levels independently", () => {
    saveStarRating(1, 2);
    saveStarRating(2, 3);
    saveStarRating(3, 1);
    expect(getBestStars(1)).toBe(2);
    expect(getBestStars(2)).toBe(3);
    expect(getBestStars(3)).toBe(1);
  });

  it("loadStarRatings returns all saved levels", () => {
    saveStarRating(1, 2);
    saveStarRating(5, 3);
    const all = loadStarRatings();
    expect(all[1]).toBe(2);
    expect(all[5]).toBe(3);
  });

  it("loadStarRatings handles corrupted localStorage gracefully", () => {
    store.set("angry-curds-2:star-ratings", "not valid json{{{");
    expect(loadStarRatings()).toEqual({});
  });
});
