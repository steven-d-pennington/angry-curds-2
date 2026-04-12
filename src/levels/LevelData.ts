import type { BlockMaterial } from "../entities/Block.js";
import type { CheeseType } from "../gameplay/ShotManager.js";

/** JSON-serializable definition for a single level */
export interface LevelData {
  /** Level metadata */
  meta: {
    /** Level number (1-based, used for display) */
    number: number;
    /** Human-readable level name */
    name: string;
  };

  /** Slingshot placement in world meters */
  slingshot: {
    x: number;
    y: number;
  };

  /** Number of cheese projectiles available */
  totalCheese: number;

  /**
   * Ordered deck of cheese types for card-based shot selection.
   * When present, replaces `totalCheese` as the source of truth for
   * how many shots are available and what type each shot is.
   * Falls back to an all-cheddar deck of `totalCheese` length.
   */
  deck?: CheeseType[];

  /** Score thresholds for star rating (1-star, 2-star, 3-star) */
  starThresholds: [number, number, number];

  /** Destructible blocks forming the structure */
  blocks: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    material: BlockMaterial;
    /** Rotation in radians (default 0) */
    angle?: number;
  }>;

  /** Rat enemy positions */
  rats: Array<{
    x: number;
    y: number;
  }>;
}
