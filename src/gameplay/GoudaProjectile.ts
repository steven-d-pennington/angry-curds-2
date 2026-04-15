import { Graphics } from "pixi.js";
import { AABB, Circle, Vec2 } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";
import type {
  GoudaConfig,
  GoudaExplosionConfig,
  ShotLifecycleConfig,
} from "./SlingshotConfig.js";
import {
  GOUDA_EXPLOSION_CONFIG,
  GOUDA_DUST_CONFIG,
  SHOCKWAVE_RING_CONFIG,
  RAT_KILL_BURST_CONFIG,
  RAT_KILL_CONFETTI_CONFIG,
  HIT_STAR_CONFIG,
  DESTRUCTION_FLASH_CONFIG,
} from "../engine/vfx/ParticleEmitter.js";
import type { Rat } from "../entities/Rat.js";
import type { Block } from "../entities/Block.js";

export type GoudaState = "loaded" | "aiming" | "launched" | "detonated" | "settled" | "removed";

/**
 * Gouda cheese projectile — heavy cheese with tap-to-detonate ability.
 *
 * After launch, tapping activates an area-of-effect explosion that applies
 * radial impulse to all blocks/rats within blast radius.
 * Once the Gouda contacts any surface (first post-solve impulse > 1),
 * the ability is locked out.
 */
export class GoudaProjectile extends Entity {
  private _state: GoudaState = "loaded";
  private settledTimer = 0;
  private readonly settledSpeedThreshold: number;
  private readonly settledDuration: number;
  private readonly engine: Engine;
  private readonly explosionConfig: GoudaExplosionConfig;

  /** True after first significant contact — detonation no longer available. */
  abilityUsed = false;

  /** Fires when this cheese reaches "settled" or "removed" state */
  onResolved: (() => void) | null = null;

  /** Fires when explosion occurs, providing affected body count */
  onDetonated: ((affectedCount: number) => void) | null = null;

  /** Fires for each rat killed by the explosion, for scoring/state tracking */
  onRatKilled: ((rat: Rat, worldX: number, worldY: number) => void) | null = null;

  /** Fires for each block destroyed by the explosion, for scoring/VFX/removal */
  onBlockDestroyed: ((block: Block, worldX: number, worldY: number) => void) | null = null;

  get state(): GoudaState {
    return this._state;
  }

  /** Whether detonation can still be activated. */
  get canDetonate(): boolean {
    return this._state === "launched" && !this.abilityUsed;
  }

  constructor(
    engine: Engine,
    config: GoudaConfig,
    explosionConfig: GoudaExplosionConfig,
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
    // Orange-wax body
    gfx.circle(0, 0, radiusPx);
    gfx.fill({ color: config.color });
    // Rind ring
    gfx.circle(0, 0, radiusPx);
    gfx.stroke({ color: config.rindColor, width: radiusPx * 0.2 });

    engine.getLayer("projectile").addChild(gfx);

    super(body, gfx);

    body.setUserData({ type: "cheese", cheeseType: "gouda", gouda: this });

    this.engine = engine;
    this.explosionConfig = explosionConfig;
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
    this.body.setActive(true);
    this.body.setAwake(true);
    this.body.setLinearVelocity(Vec2(velocityX, velocityY));
  }

  /** Called by ContactHandler when Gouda has a significant collision. */
  onFirstContact(): void {
    this.abilityUsed = true;
  }

  /**
   * Activate the explosion ability. Applies radial impulse to nearby bodies
   * and destroys this Gouda.
   * Returns the number of bodies affected, or 0 if detonation not available.
   */
  activateDetonation(): number {
    if (!this.canDetonate) return 0;

    this.abilityUsed = true;
    this._state = "detonated";

    const epicenter = this.body.getPosition();
    const affected = this.applyExplosionImpulse(epicenter.x, epicenter.y);

    // Explosion VFX: radial debris + shockwave ring + heavy dust
    const screen = this.engine.worldToScreenPos(epicenter.x, epicenter.y);
    this.engine.particles.emit(screen.x, screen.y, GOUDA_EXPLOSION_CONFIG);
    this.engine.particles.emit(screen.x, screen.y, GOUDA_DUST_CONFIG);
    this.engine.particles.emit(screen.x, screen.y, SHOCKWAVE_RING_CONFIG);

    // Remove from physics world
    this.display.visible = false;
    this.body.setActive(false);

    this.onDetonated?.(affected);
    return affected;
  }

  /**
   * Apply radial impulse to all dynamic bodies within blast radius.
   * Impulse magnitude falls off linearly with distance from epicenter.
   */
  private applyExplosionImpulse(cx: number, cy: number): number {
    const r = this.explosionConfig.blastRadius;
    const maxImp = this.explosionConfig.maxImpulse;
    const minImp = this.explosionConfig.minImpulse;

    // Query AABB for candidate bodies
    const aabb = new AABB(
      Vec2(cx - r, cy - r),
      Vec2(cx + r, cy + r),
    );

    // Collect blocks that fracture — cannot destroy bodies during queryAABB iteration
    const fracturedBlocks: { block: Block; worldX: number; worldY: number }[] = [];

    let count = 0;
    this.engine.physics.world.queryAABB(aabb, (fixture) => {
      const target = fixture.getBody();
      // Skip our own body and static bodies
      if (target === this.body || target.isStatic()) return true;

      const targetPos = target.getWorldCenter();
      const dx = targetPos.x - cx;
      const dy = targetPos.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Must be within circular blast radius
      if (dist > r) return true;

      // Linear falloff: maxImpulse at center, minImpulse at edge
      const t = dist / r;
      const impulse = maxImp + (minImp - maxImp) * t;

      // Direction from epicenter to target
      const dirLen = dist > 0.001 ? dist : 1;
      const dirX = dx / dirLen;
      const dirY = dy / dirLen;

      target.applyLinearImpulse(
        Vec2(dirX * impulse, dirY * impulse),
        targetPos,
        true,
      );

      const ud = target.getUserData() as { type?: string; rat?: Rat; block?: Block } | null;

      // Apply block damage through the damage accumulation system
      if (ud?.type === "block" && ud.block) {
        if (ud.block.applyImpulse(impulse)) {
          const bPos = target.getWorldCenter();
          fracturedBlocks.push({ block: ud.block, worldX: bPos.x, worldY: bPos.y });
        }
      }

      // Kill rats within blast radius
      if (ud?.type === "rat" && (ud as { rat?: Rat }).rat?.alive) {
        const rat = (ud as { rat: Rat }).rat;
        const ratPos = target.getWorldCenter();

        // Rat kill VFX
        const rScreen = this.engine.worldToScreenPos(ratPos.x, ratPos.y);
        this.engine.particles.emit(rScreen.x, rScreen.y, RAT_KILL_BURST_CONFIG);
        this.engine.particles.emit(rScreen.x, rScreen.y, RAT_KILL_CONFETTI_CONFIG);
        this.engine.particles.emit(rScreen.x, rScreen.y, HIT_STAR_CONFIG);
        this.engine.particles.emit(rScreen.x, rScreen.y, DESTRUCTION_FLASH_CONFIG);

        this.onRatKilled?.(rat, ratPos.x, ratPos.y);
        rat.kill();
      }

      count++;
      return true; // continue querying
    });

    // Process fractured blocks after queryAABB completes (safe to modify world now)
    for (const { block, worldX, worldY } of fracturedBlocks) {
      if (block.destroyed) continue;
      block.destroyed = true;
      this.onBlockDestroyed?.(block, worldX, worldY);
    }

    return count;
  }

  override update(dt: number): void {
    if (this._state === "detonated") {
      // Gouda is inert after detonation — tracked by ShotManager
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
    this._state = "settled";
    this.onResolved?.();
  }
}

/**
 * Pure-math helper: compute explosion impulse for a target at given distance.
 * Exported for unit testing.
 */
export function computeExplosionImpulse(
  distance: number,
  blastRadius: number,
  maxImpulse: number,
  minImpulse: number,
): number {
  if (distance > blastRadius) return 0;
  if (blastRadius <= 0) return 0;
  const t = distance / blastRadius;
  return maxImpulse + (minImpulse - maxImpulse) * t;
}

/**
 * Pure-math helper: compute radial direction from epicenter to target.
 * Returns normalized direction vector. Exported for unit testing.
 */
export function computeExplosionDirection(
  cx: number,
  cy: number,
  tx: number,
  ty: number,
): { dx: number; dy: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return { dx: 0, dy: 1 }; // default up for zero-distance
  return { dx: dx / dist, dy: dy / dist };
}
