import { Graphics } from "pixi.js";
import { Circle, Vec2 } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";
import type {
  SwissConfig,
  SwissPierceConfig,
  ShotLifecycleConfig,
} from "./SlingshotConfig.js";
import {
  SWISS_PIERCE_FLASH_CONFIG,
  SWISS_PIERCE_EXIT_TRAIL_CONFIG,
} from "../engine/vfx/ParticleEmitter.js";

export type SwissState = "loaded" | "aiming" | "launched" | "piercing" | "settled" | "removed";

/**
 * Swiss cheese projectile — speed cheese with tap-to-pierce ability.
 *
 * After launch, tapping boosts velocity and temporarily disables contact
 * response so Swiss passes through the first block it hits. The pierced
 * block takes full impact damage. After pierce duration expires, contact
 * response is re-enabled and Swiss continues with reduced velocity.
 */
export class SwissProjectile extends Entity {
  private _state: SwissState = "loaded";
  private settledTimer = 0;
  private readonly settledSpeedThreshold: number;
  private readonly settledDuration: number;
  private readonly engine: Engine;
  private readonly pierceConfig: SwissPierceConfig;

  /** Timer tracking how long pierce mode has been active. */
  private pierceTimer = 0;
  /** Whether we've already pierced one block in this activation. */
  private hasPiercedBlock = false;
  /** Speed before pierce activation, used to calculate post-pierce velocity. */
  private prePierceSpeed = 0;

  /** True after first significant contact — pierce no longer available. */
  abilityUsed = false;

  /** Fires when this cheese reaches "settled" or "removed" state */
  onResolved: (() => void) | null = null;

  /** Fires when pierce is activated */
  onPierceActivated: (() => void) | null = null;

  get state(): SwissState {
    return this._state;
  }

  /** Whether pierce can still be activated. */
  get canPierce(): boolean {
    return this._state === "launched" && !this.abilityUsed;
  }

  /** Whether Swiss is currently in pierce mode (passing through blocks). */
  get isPiercing(): boolean {
    return this._state === "piercing";
  }

  /** Impulse to apply to pierced blocks (from config). */
  get pierceBlockImpulse(): number {
    return this.pierceConfig.pierceBlockImpulse;
  }

  constructor(
    engine: Engine,
    config: SwissConfig,
    pierceConfig: SwissPierceConfig,
    lifecycleConfig: ShotLifecycleConfig,
  ) {
    const body = engine.physics.createBody({
      type: "dynamic",
      position: Vec2(0, 0),
      bullet: true,
    });
    body.createFixture({
      shape: new Circle(config.radius),
      density: config.density,
      restitution: config.restitution,
      friction: config.friction,
    });
    body.setActive(false);

    const radiusPx = engine.metersToPixels(config.radius);
    const gfx = new Graphics();
    // Pale yellow body
    gfx.circle(0, 0, radiusPx);
    gfx.fill({ color: config.color });
    // Swiss holes
    const holeR = radiusPx * 0.15;
    gfx.circle(radiusPx * 0.3, -radiusPx * 0.1, holeR);
    gfx.fill({ color: config.holeColor });
    gfx.circle(-radiusPx * 0.2, radiusPx * 0.25, holeR * 0.8);
    gfx.fill({ color: config.holeColor });
    gfx.circle(radiusPx * 0.05, radiusPx * 0.35, holeR * 0.6);
    gfx.fill({ color: config.holeColor });

    engine.getLayer("projectile").addChild(gfx);

    super(body, gfx);

    body.setUserData({ type: "cheese", cheeseType: "swiss", swiss: this });

    this.engine = engine;
    this.pierceConfig = pierceConfig;
    this.settledSpeedThreshold = lifecycleConfig.settledSpeedThreshold;
    this.settledDuration = lifecycleConfig.settledDuration;
  }

  /** Place cheese at the slingshot anchor, ready for aiming. */
  loadAt(worldX: number, worldY: number): void {
    this._state = "loaded";
    this.body.setPosition(Vec2(worldX, worldY));
    this.body.setLinearVelocity(Vec2(0, 0));
    this.body.setAngularVelocity(0);
    this.body.setActive(false);
    this.display.visible = true;
  }

  /** Transition to aiming state (being dragged). */
  startAiming(): void {
    this._state = "aiming";
  }

  /** Move cheese position during aiming (no physics, direct placement). */
  aimAt(worldX: number, worldY: number): void {
    this.body.setPosition(Vec2(worldX, worldY));
  }

  /** Launch the cheese with the given world-space velocity vector. */
  launch(velocityX: number, velocityY: number): void {
    this._state = "launched";
    this.settledTimer = 0;
    this.abilityUsed = false;
    this.hasPiercedBlock = false;
    this.pierceTimer = 0;
    this.body.setActive(true);
    this.body.setAwake(true);
    this.body.setLinearVelocity(Vec2(velocityX, velocityY));
  }

  /** Called by ContactHandler when Swiss has a significant collision. */
  onFirstContact(): void {
    this.abilityUsed = true;
  }

  /**
   * Activate the pierce ability. Boosts velocity and disables contact
   * response for a short duration.
   * Returns true if activation succeeded.
   */
  activatePierce(): boolean {
    if (!this.canPierce) return false;

    this.abilityUsed = true;
    this._state = "piercing";
    this.pierceTimer = 0;
    this.hasPiercedBlock = false;

    // Boost velocity in current travel direction
    const vel = this.body.getLinearVelocity();
    this.prePierceSpeed = vel.length();
    const boostedVel = Vec2(
      vel.x * this.pierceConfig.boostFactor,
      vel.y * this.pierceConfig.boostFactor,
    );
    this.body.setLinearVelocity(boostedVel);

    // Disable contact response by setting all fixtures to sensors
    for (let f = this.body.getFixtureList(); f; f = f.getNext()) {
      f.setSensor(true);
    }

    // Speed blur VFX at activation point
    const pos = this.body.getPosition();
    const screen = this.engine.worldToScreenPos(pos.x, pos.y);
    this.engine.particles.emit(screen.x, screen.y, SWISS_PIERCE_FLASH_CONFIG);

    this.onPierceActivated?.();
    return true;
  }

  /**
   * Called by ContactHandler during piercing when Swiss overlaps a block.
   * Records that one block has been pierced and spawns exit trail VFX.
   */
  onBlockPierced(): void {
    this.hasPiercedBlock = true;

    // Impact flash on the pierced block + exit trail behind Swiss
    const pos = this.body.getPosition();
    const screen = this.engine.worldToScreenPos(pos.x, pos.y);
    this.engine.particles.emit(screen.x, screen.y, SWISS_PIERCE_FLASH_CONFIG);
    this.engine.particles.emit(screen.x, screen.y, SWISS_PIERCE_EXIT_TRAIL_CONFIG);
  }

  /** End pierce mode: re-enable contact, reduce velocity. */
  private endPierce(): void {
    this._state = "launched";

    // Re-enable contact response
    for (let f = this.body.getFixtureList(); f; f = f.getNext()) {
      f.setSensor(false);
    }

    // Reduce velocity after piercing
    const vel = this.body.getLinearVelocity();
    const speed = vel.length();
    if (speed > 0.001) {
      const reducedSpeed = this.prePierceSpeed * this.pierceConfig.postPierceSpeedFactor;
      const scale = reducedSpeed / speed;
      this.body.setLinearVelocity(Vec2(vel.x * scale, vel.y * scale));
    }
  }

  override update(dt: number): void {
    // Handle pierce duration
    if (this._state === "piercing") {
      this.pierceTimer += dt;

      // Check if Swiss left the viewport during pierce
      const pos = this.body.getPosition();
      const margin = 2;
      const vw = this.engine.viewport.worldWidth;
      const vh = this.engine.viewport.worldHeight;
      if (pos.x < -margin || pos.x > vw + margin || pos.y < -margin || pos.y > vh + margin) {
        this.resolve();
        return;
      }

      // End pierce when duration expires or after piercing a block
      if (this.pierceTimer >= this.pierceConfig.pierceDuration || this.hasPiercedBlock) {
        this.endPierce();
      }
      return;
    }

    if (this._state !== "launched") return;

    const vel = this.body.getLinearVelocity();
    const speed = vel.length();
    const pos = this.body.getPosition();

    // Check if cheese left the viewport (with margin)
    const margin = 2;
    const vw = this.engine.viewport.worldWidth;
    const vh = this.engine.viewport.worldHeight;
    if (pos.x < -margin || pos.x > vw + margin || pos.y < -margin || pos.y > vh + margin) {
      this.resolve();
      return;
    }

    // Check if settled
    if (speed < this.settledSpeedThreshold) {
      this.settledTimer += dt;
      if (this.settledTimer >= this.settledDuration) {
        this.resolve();
      }
    } else {
      this.settledTimer = 0;
    }
  }

  private resolve(): void {
    // Re-enable contact in case we resolve during pierce
    if (this._state === "piercing") {
      for (let f = this.body.getFixtureList(); f; f = f.getNext()) {
        f.setSensor(false);
      }
    }
    this._state = "settled";
    this.onResolved?.();
  }
}

/**
 * Pure-math helper: compute boosted velocity vector.
 * Exported for unit testing.
 */
export function computePierceBoost(
  velX: number,
  velY: number,
  boostFactor: number,
): { vx: number; vy: number } {
  return { vx: velX * boostFactor, vy: velY * boostFactor };
}

/**
 * Pure-math helper: compute post-pierce reduced velocity.
 * Exported for unit testing.
 */
export function computePostPierceVelocity(
  velX: number,
  velY: number,
  prePierceSpeed: number,
  postPierceSpeedFactor: number,
): { vx: number; vy: number } {
  const speed = Math.sqrt(velX * velX + velY * velY);
  if (speed < 0.001) return { vx: 0, vy: 0 };
  const reducedSpeed = prePierceSpeed * postPierceSpeedFactor;
  const scale = reducedSpeed / speed;
  return { vx: velX * scale, vy: velY * scale };
}
