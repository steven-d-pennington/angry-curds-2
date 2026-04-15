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

export interface BandPolishConfig {
  /** Band thickness at minimum pull (relaxed) */
  thicknessMin: number;
  /** Band thickness at maximum pull (fully stretched) */
  thicknessMax: number;
  /** Band color when relaxed (brown) */
  colorRelaxed: number;
  /** Band color when fully stretched (red-orange) */
  colorStretched: number;
  /** Maximum sag in pixels when relaxed (gravity droop) */
  sagMax: number;
  /** Number of line segments for tapered band rendering */
  taperSegments: number;
  /** Width ratio at the target/cheese end relative to fork end (0-1) */
  taperEndRatio: number;
}

export interface LaunchVfxConfig {
  /** Number of stretch lines radiating from fork on launch */
  stretchLineCount: number;
  /** Length of stretch lines in pixels */
  stretchLineLength: number;
  /** Duration of stretch line fade in seconds */
  stretchLineDuration: number;
  /** Duration of speed trail behind launched cheese in seconds */
  speedTrailDuration: number;
  /** Interval between speed trail particle emissions in seconds */
  speedTrailInterval: number;
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

export interface GoudaConfig {
  /** Radius of Gouda projectile in world meters */
  radius: number;
  /** Physics density (heavy cheese) */
  density: number;
  /** Physics restitution */
  restitution: number;
  /** Physics friction */
  friction: number;
  /** Fill color (orange-wax rind) */
  color: number;
  /** Rind stripe color */
  rindColor: number;
}

export interface GoudaExplosionConfig {
  /** Blast radius in world meters */
  blastRadius: number;
  /** Maximum radial impulse applied at epicenter */
  maxImpulse: number;
  /** Minimum impulse at the edge of blast radius (linear falloff) */
  minImpulse: number;
}

export interface SwissConfig {
  /** Radius of Swiss projectile in world meters */
  radius: number;
  /** Physics density */
  density: number;
  /** Physics restitution */
  restitution: number;
  /** Physics friction */
  friction: number;
  /** Fill color (pale yellow) */
  color: number;
  /** Hole color for the Swiss cheese visual */
  holeColor: number;
}

export interface SwissPierceConfig {
  /** Velocity multiplier applied on tap activation */
  boostFactor: number;
  /** Velocity retention after piercing through a block (0-1) */
  postPierceSpeedFactor: number;
  /** Duration in seconds that contact response is disabled during pierce */
  pierceDuration: number;
  /** Impulse applied to the pierced block */
  pierceBlockImpulse: number;
}

export interface GameplayConfig {
  slingshot: SlingshotConfig;
  cheese: CheeseConfig;
  brie: BrieConfig;
  brieSub: BrieSubConfig;
  brieSplit: BrieSplitConfig;
  gouda: GoudaConfig;
  goudaExplosion: GoudaExplosionConfig;
  swiss: SwissConfig;
  swissPierce: SwissPierceConfig;
  launch: LaunchConfig;
  shotLifecycle: ShotLifecycleConfig;
  trajectoryPreview: TrajectoryPreviewConfig;
  bandPolish: BandPolishConfig;
  launchVfx: LaunchVfxConfig;
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
  gouda: {
    radius: 0.45,
    density: 3.0,
    restitution: 0.15,
    friction: 0.5,
    color: 0xd4920b,
    rindColor: 0xc4820a,
  },
  goudaExplosion: {
    blastRadius: 3.0,
    maxImpulse: 20,
    minImpulse: 5,
  },
  swiss: {
    radius: 0.35,
    density: 1.8,
    restitution: 0.35,
    friction: 0.3,
    color: 0xfff4c2,
    holeColor: 0xf5e6a0,
  },
  swissPierce: {
    boostFactor: 1.8,
    postPierceSpeedFactor: 0.6,
    pierceDuration: 0.15,
    pierceBlockImpulse: 12,
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
    dotCount: 7,
    dotTimeStep: 0.15,
    dotRadius: 4,
    dotColor: 0xffffff,
    dotAlpha: 0.5,
  },
  bandPolish: {
    thicknessMin: 2,
    thicknessMax: 6,
    colorRelaxed: 0x8b5e3c,
    colorStretched: 0xff4400,
    sagMax: 25,
    taperSegments: 10,
    taperEndRatio: 0.35,
  },
  launchVfx: {
    stretchLineCount: 6,
    stretchLineLength: 40,
    stretchLineDuration: 0.25,
    speedTrailDuration: 0.5,
    speedTrailInterval: 0.03,
  },
};
