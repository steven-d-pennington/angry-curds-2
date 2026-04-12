/**
 * All tunable gameplay values for the slingshot and cheese projectile systems.
 * Designers can adjust these without touching gameplay code.
 */

export interface SlingshotConfig {
  /** X position of slingshot center in world meters */
  positionX: number;
  /** Y position of slingshot base in world meters */
  positionY: number;
  /** Height of slingshot posts in world meters */
  postHeight: number;
  /** Width between the two posts in world meters */
  postSpacing: number;
  /** Post visual thickness in world meters */
  postThickness: number;
  /** Color of the slingshot posts */
  postColor: number;
  /** Color of the rubber band */
  bandColor: number;
  /** Rubber band visual thickness in pixels */
  bandThickness: number;
}

export interface CheeseConfig {
  /** Radius of cheese projectile in world meters */
  radius: number;
  /** Physics density */
  density: number;
  /** Physics restitution (bounciness) */
  restitution: number;
  /** Physics friction */
  friction: number;
  /** Fill color for placeholder circle */
  color: number;
}

export interface LaunchConfig {
  /** Maximum pull-back distance in world meters */
  maxPullDistance: number;
  /** Velocity multiplier: launch speed = pullDistance * launchVelocityScale */
  launchVelocityScale: number;
  /** Maximum launch speed in m/s */
  maxLaunchSpeed: number;
}

export interface ShotLifecycleConfig {
  /** Speed threshold (m/s) below which cheese is considered settled */
  settledSpeedThreshold: number;
  /** Time in seconds cheese must stay below speed threshold to be removed */
  settledDuration: number;
  /** Number of cheese available per level */
  totalCheese: number;
  /** Delay in seconds before next cheese loads after previous resolves */
  nextCheeseDelay: number;
}

export interface TrajectoryPreviewConfig {
  /** Number of dots in the trajectory arc */
  dotCount: number;
  /** Time step between dots in seconds */
  dotTimeStep: number;
  /** Dot radius in pixels */
  dotRadius: number;
  /** Dot color */
  dotColor: number;
  /** Dot alpha (0-1) */
  dotAlpha: number;
}

export interface BrieConfig {
  /** Radius of Brie projectile in world meters */
  radius: number;
  /** Physics density */
  density: number;
  /** Physics restitution (bounciness) */
  restitution: number;
  /** Physics friction */
  friction: number;
  /** Fill color (cream body) */
  color: number;
  /** Rind arc color */
  rindColor: number;
}

export interface BrieSubConfig {
  /** Number of sub-projectiles on split */
  count: number;
  /** Radius of each sub-projectile in world meters */
  radius: number;
  /** Physics density */
  density: number;
  /** Physics restitution */
  restitution: number;
  /** Physics friction */
  friction: number;
  /** Fill color */
  color: number;
}

export interface BrieSplitConfig {
  /** Fan angle in radians between outer sub-projectiles */
  spreadAngle: number;
  /** Speed retention factor on split (0-1) */
  speedFactor: number;
}

export interface GameplayConfig {
  slingshot: SlingshotConfig;
  cheese: CheeseConfig;
  brie: BrieConfig;
  brieSub: BrieSubConfig;
  brieSplit: BrieSplitConfig;
  launch: LaunchConfig;
  shotLifecycle: ShotLifecycleConfig;
  trajectoryPreview: TrajectoryPreviewConfig;
}

export const DEFAULT_CONFIG: GameplayConfig = {
  slingshot: {
    positionX: 3,
    positionY: 1, // ground level
    postHeight: 2.0,
    postSpacing: 0.6,
    postThickness: 0.15,
    postColor: 0x8b4513,
    bandColor: 0xcc3300,
    bandThickness: 3,
  },
  cheese: {
    radius: 0.4,
    density: 2.0,
    restitution: 0.3,
    friction: 0.4,
    color: 0xffa500,
  },
  brie: {
    radius: 0.35,
    density: 1.5,
    restitution: 0.4,
    friction: 0.3,
    color: 0xfff8e7,
    rindColor: 0xe8d5a3,
  },
  brieSub: {
    count: 3,
    radius: 0.2,
    density: 2.5,
    restitution: 0.35,
    friction: 0.3,
    color: 0xfff8e7,
  },
  brieSplit: {
    spreadAngle: (20 * Math.PI) / 180, // 20 degrees
    speedFactor: 0.85,
  },
  launch: {
    maxPullDistance: 3.0,
    launchVelocityScale: 12,
    maxLaunchSpeed: 40,
  },
  shotLifecycle: {
    settledSpeedThreshold: 0.3,
    settledDuration: 1.0,
    totalCheese: 5,
    nextCheeseDelay: 0.5,
  },
  trajectoryPreview: {
    dotCount: 30,
    dotTimeStep: 0.05,
    dotRadius: 3,
    dotColor: 0xffffff,
    dotAlpha: 0.4,
  },
};
