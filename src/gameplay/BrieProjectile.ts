import { Graphics } from "pixi.js";
import { Circle, Vec2 } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";
import type {
  BrieConfig,
  BrieSubConfig,
  BrieSplitConfig,
  ShotLifecycleConfig,
} from "./SlingshotConfig.js";
import {
  BRIE_SPLIT_SPARKLE_CONFIG,
  BRIE_SUB_TRAIL_CONFIG,
} from "../engine/vfx/ParticleEmitter.js";

export type BrieState = "loaded" | "aiming" | "launched" | "split" | "settled" | "removed";

/**
 * Brie cheese projectile — can split into sub-projectiles mid-flight.
 *
 * Split is activated by calling `activateSplit()` while in "launched" state.
 * Once the Brie contacts any surface (first post-solve impulse > 1),
 * the split ability is locked out.
 */
export class BrieProjectile extends Entity {
  private _state: BrieState = "loaded";
  private settledTimer = 0;
  private readonly settledSpeedThreshold: number;
  private readonly settledDuration: number;
  private readonly engine: Engine;
  private readonly subConfig: BrieSubConfig;
  private readonly splitConfig: BrieSplitConfig;
  private readonly lifecycleConfig: ShotLifecycleConfig;

  /** True after first significant contact — split no longer available. */
  abilityUsed = false;

  /** Fires when this cheese reaches "settled" or "removed" state */
  onResolved: (() => void) | null = null;

  /** Fires when split occurs, providing the sub-projectile entities */
  onSplit: ((subs: Entity[]) => void) | null = null;

  get state(): BrieState {
    return this._state;
  }

  /** Whether split can still be activated. */
  get canSplit(): boolean {
    return this._state === "launched" && !this.abilityUsed;
  }

  constructor(
    engine: Engine,
    config: BrieConfig,
    subConfig: BrieSubConfig,
    splitConfig: BrieSplitConfig,
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
    // Cream body
    gfx.circle(0, 0, radiusPx);
    gfx.fill({ color: config.color });
    // Rind arc (top half)
    gfx.arc(0, 0, radiusPx, -Math.PI, 0);
    gfx.stroke({ color: config.rindColor, width: radiusPx * 0.15 });

    engine.getLayer("projectile").addChild(gfx);

    super(body, gfx);

    body.setUserData({ type: "cheese", cheeseType: "brie", brie: this });

    this.engine = engine;
    this.subConfig = subConfig;
    this.splitConfig = splitConfig;
    this.lifecycleConfig = lifecycleConfig;
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

  /** Called by ContactHandler when Brie has a significant collision. */
  onFirstContact(): void {
    this.abilityUsed = true;
  }

  /**
   * Activate the split ability. Destroys this Brie and spawns sub-projectiles.
   * Returns the sub-projectile entities, or empty array if split not available.
   */
  activateSplit(): Entity[] {
    if (!this.canSplit) return [];

    this.abilityUsed = true;
    this._state = "split";

    const pos = this.body.getPosition();
    const vel = this.body.getLinearVelocity();
    const parentSpeed = vel.length();
    const parentAngle = Math.atan2(vel.y, vel.x);
    const subSpeed = parentSpeed * this.splitConfig.speedFactor;

    // Spawn sub-projectiles
    const subs: Entity[] = [];
    const spread = this.splitConfig.spreadAngle;
    const angles = [parentAngle + spread, parentAngle, parentAngle - spread];

    for (let i = 0; i < this.subConfig.count; i++) {
      const angle = angles[i] ?? parentAngle;
      const sub = this.spawnSub(pos.x, pos.y, subSpeed, angle);
      subs.push(sub);
    }

    // Sparkle burst VFX at split point
    const splitScreen = this.engine.worldToScreenPos(pos.x, pos.y);
    this.engine.particles.emit(splitScreen.x, splitScreen.y, BRIE_SPLIT_SPARKLE_CONFIG);

    // Remove parent from physics world
    this.display.visible = false;
    this.body.setActive(false);

    this.onSplit?.(subs);
    return subs;
  }

  private spawnSub(
    x: number,
    y: number,
    speed: number,
    angle: number,
  ): Entity {
    const cfg = this.subConfig;
    const body = this.engine.physics.createBody({
      type: "dynamic",
      position: Vec2(x, y),
      bullet: true,
    });
    body.createFixture({
      shape: new Circle(cfg.radius),
      density: cfg.density,
      restitution: cfg.restitution,
      friction: cfg.friction,
    });
    body.setLinearVelocity(Vec2(
      speed * Math.cos(angle),
      speed * Math.sin(angle),
    ));
    body.setUserData({ type: "cheese" });

    const radiusPx = this.engine.metersToPixels(cfg.radius);
    const gfx = new Graphics();
    gfx.circle(0, 0, radiusPx);
    gfx.fill({ color: cfg.color });
    this.engine.getLayer("projectile").addChild(gfx);

    const sub = new SubProjectile(body, gfx, this.engine, this.lifecycleConfig);
    this.engine.addEntity(sub);
    return sub;
  }

  override update(dt: number): void {
    if (this._state === "split") {
      // Parent is inert after split — resolution tracked by ShotManager via subs
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
 * A sub-projectile spawned by Brie split. Lightweight entity with
 * its own settle tracking. Tagged as "cheese" for contact handling.
 */
class SubProjectile extends Entity {
  private _settled = false;
  private settledTimer = 0;
  private readonly engine: Engine;
  private readonly settledSpeedThreshold: number;
  private readonly settledDuration: number;
  /** Mini trail emit timer. */
  private trailEmitTimer = 0;
  private trailDuration = 0.4; // Mini trail lasts 0.4s after split
  private trailElapsed = 0;

  onResolved: (() => void) | null = null;

  get isResolved(): boolean {
    return this._settled;
  }

  constructor(
    body: import("planck").Body,
    display: import("pixi.js").Graphics,
    engine: Engine,
    lifecycleConfig: ShotLifecycleConfig,
  ) {
    super(body, display);
    this.engine = engine;
    this.settledSpeedThreshold = lifecycleConfig.settledSpeedThreshold;
    this.settledDuration = lifecycleConfig.settledDuration;
  }

  override update(dt: number): void {
    if (this._settled) return;

    const vel = this.body.getLinearVelocity();
    const speed = vel.length();
    const pos = this.body.getPosition();

    // Mini trail VFX on sub-projectiles for a short duration after split
    this.trailElapsed += dt;
    this.trailEmitTimer += dt;
    if (this.trailElapsed < this.trailDuration && this.trailEmitTimer >= 0.04) {
      this.trailEmitTimer = 0;
      const screen = this.engine.worldToScreenPos(pos.x, pos.y);
      this.engine.particles.emit(screen.x, screen.y, BRIE_SUB_TRAIL_CONFIG);
    }

    const margin = 2;
    const vw = this.engine.viewport.worldWidth;
    const vh = this.engine.viewport.worldHeight;
    if (pos.x < -margin || pos.x > vw + margin || pos.y < -margin || pos.y > vh + margin) {
      this._settled = true;
      this.onResolved?.();
      return;
    }

    if (speed < this.settledSpeedThreshold) {
      this.settledTimer += dt;
      if (this.settledTimer >= this.settledDuration) {
        this._settled = true;
        this.onResolved?.();
      }
    } else {
      this.settledTimer = 0;
    }
  }
}
