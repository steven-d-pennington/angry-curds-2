/**
 * Star rating calculation and persistence.
 *
 * Thresholds come from level JSON (LevelData.starThresholds).
 * Ratings are persisted per-level in localStorage so level-select
 * UI can display earned stars.
 */

const STORAGE_KEY = "angry-curds-2:star-ratings";

/** Calculate how many stars (0-3) a score earns against the given thresholds. */
export function calculateStars(
  score: number,
  thresholds: readonly [number, number, number],
): number {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

/** Read the full map of saved best-star ratings from localStorage. */
export function loadStarRatings(): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, number>;
  } catch {
    return {};
  }
}

/** Get the best star rating for a single level (0 if never completed). */
export function getBestStars(levelNumber: number): number {
  const ratings = loadStarRatings();
  return ratings[levelNumber] ?? 0;
}

/**
 * Persist a star rating for a level, keeping only the best.
 * Returns the best rating (may be the existing one if higher).
 */
export function saveStarRating(levelNumber: number, stars: number): number {
  const ratings = loadStarRatings();
  const previous = ratings[levelNumber] ?? 0;
  const best = Math.max(previous, stars);
  ratings[levelNumber] = best;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
  } catch {
    // Storage full or unavailable — degrade gracefully
  }
  return best;
}
