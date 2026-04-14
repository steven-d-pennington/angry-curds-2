import type { LevelData } from "./LevelData.js";

// Static imports for all level JSON files.
// Add new levels here and they are automatically available via the manager.
import level1 from "./level1.json";
import level2 from "./level2.json";
import level3 from "./level3.json";
import level4 from "./level4.json";
import level5 from "./level5.json";

const LEVELS: LevelData[] = [
  level1 as LevelData,
  level2 as LevelData,
  level3 as LevelData,
  level4 as LevelData,
  level5 as LevelData,
];

/**
 * Manages the ordered list of levels and tracks progression.
 *
 * Public API is intentionally minimal — menu / UI code only needs
 * `current`, `advance`, and `levelCount`.
 */
export class LevelManager {
  private index = 0;

  /** Total number of available levels. */
  get levelCount(): number {
    return LEVELS.length;
  }

  /** 0-based index of the current level. */
  get currentIndex(): number {
    return this.index;
  }

  /** The data for the current level. */
  get current(): LevelData {
    return LEVELS[this.index]!;
  }

  /** Whether there is a next level after the current one. */
  get hasNext(): boolean {
    return this.index < LEVELS.length - 1;
  }

  /** Jump to a specific level by 0-based index. Returns the level data. */
  setLevel(index: number): LevelData {
    if (index < 0 || index >= LEVELS.length) {
      throw new RangeError(
        `Level index ${index} out of range [0, ${LEVELS.length - 1}]`,
      );
    }
    this.index = index;
    return this.current;
  }

  /** Advance to the next level. Returns the new level data, or null if already on the last level. */
  advance(): LevelData | null {
    if (!this.hasNext) return null;
    this.index++;
    return this.current;
  }
}
