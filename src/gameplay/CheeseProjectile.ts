import { Sprite, Texture } from "pixi.js";
import { Circle, Vec2 } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";
import type { CheeseConfig, ShotLifecycleConfig } from "./SlingshotConfig.js";
import { getFrame } from "../engine/AssetLoader.js";

export type CheeseState = "loaded" | "aiming" | "launched" | "settled" | "removed";

/**
 * Cheddar cheese projectile — uses sprite-based rendering with
 * state-driven texture swaps matching the character sheet poses.
 */
export class CheeseProjectile extends Entity {
  private _state: CheeseState = "loaded";
  private settledTimer = 0;
  private readonly settledSpeedThreshold: number;
  private readonly settledDuration: number;
  private readonly engine: Engine;
  private readonly sprite: Sprite;

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
    body.setActive(false);

    const radiusPx = engine.metersToPixels(config.radius);

    // Cheese sprite from character atlas
    const texture = getFrame("cheddar_idle_01");
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = radiusPx * 2;
    sprite.height = radiusPx * 2;

    engine.getLayer("projectile").addChild(sprite);

    super(body, sprite);

    body.setUserData({ type: "cheese" });

    this.sprite = sprite;
    this.engine = engine;
    this.settledSpeedThreshold = lifecycleConfig.settledSpeedThreshold;
    this.settledDuration = lifecycleConfig.settledDuration;
  }

  private setTexture(frameName: string): void {
    const tex = getFrame(frameName);
    if (tex !== Texture.EMPTY) {
      this.sprite.texture = tex;
    }
  }

  loadAt(worldX: number, worldY: number): void {
    this._state = "loaded";
    this.body.setPosition(Vec2(worldX, worldY));
    this.body.setLinearVelocity(Vec2(0, 0));
    this.body.setAngularVelocity(0);
    this.body.setActive(false);
    this.display.visible = true;
    this.setTexture("cheddar_loaded");
  }

  startAiming(): void {
    this._state = "aiming";
    this.setTexture("cheddar_aiming_01");
  }

  aimAt(worldX: number, worldY: number): void {
    this.body.setPosition(Vec2(worldX, worldY));
    // Switch to more nervous face at max pull (could use pull distance later)
    this.setTexture("cheddar_aiming_02");
  }

  launch(velocityX: number, velocityY: number): void {
    this._state = "launched";
    this.settledTimer = 0;
    this.body.setActive(true);
    this.body.setAwake(true);
    this.body.setLinearVelocity(Vec2(velocityX, velocityY));
    this.setTexture("cheddar_flying");
  }

  override update(dt: number): void {
    if (this._state !== "launched") return;

    const vel = this.body.getLinearVelocity();
    const speed = vel.length();
    const pos = this.body.getPosition();

    const margin = 2;
    const vw = this.engine.viewport.worldWidth;
    const vh = this.engine.viewport.worldHeight;
    if (pos.x < -margin || pos.x > vw + margin || pos.y < -margin || pos.y > vh + margin) {
      this.resolve();
      return;
    }

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
    this.setTexture("cheddar_settled");
    this.onResolved?.();
  }
}
