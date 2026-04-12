import { Graphics } from "pixi.js";
import { Circle, Vec2 } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";
import type { CheeseConfig, ShotLifecycleConfig } from "./SlingshotConfig.js";

export type CheeseState = "loaded" | "aiming" | "launched" | "settled" | "removed";

/**
 * Cheddar cheese projectile — a circle physics body that can be launched
 * from the slingshot. Tracks its own lifecycle state.
 */
export class CheeseProjectile extends Entity {
  private _state: CheeseState = "loaded";
  private settledTimer = 0;
  private readonly settledSpeedThreshold: number;
  private readonly settledDuration: number;
  private readonly engine: Engine;

  /** Fires when this cheese reaches "settled" or "removed" state */
  onResolved: (() => void) | null = null;

  get state(): CheeseState {
    return this._state;
  }

  constructor(engine: Engine, config: CheeseConfig, lifecycleConfig: ShotLifecycleConfig) {
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
    // Start inactive until placed on slingshot
    body.setActive(false);

    const radiusPx = engine.metersToPixels(config.radius);
    const gfx = new Graphics();
    gfx.circle(0, 0, radiusPx);
    gfx.fill({ color: config.color });
    // Small wedge detail to make it look like cheese
    gfx.circle(radiusPx * 0.3, -radiusPx * 0.2, radiusPx * 0.12);
    gfx.fill({ color: 0xffcc00 });
    gfx.circle(-radiusPx * 0.2, radiusPx * 0.15, radiusPx * 0.08);
    gfx.fill({ color: 0xffcc00 });

    engine.getLayer("projectile").addChild(gfx);

    super(body, gfx);

    body.setUserData({ type: "cheese" });

    this.engine = engine;
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
    this.body.setActive(true);
    this.body.setAwake(true);
    this.body.setLinearVelocity(Vec2(velocityX, velocityY));
  }

  override update(dt: number): void {
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
