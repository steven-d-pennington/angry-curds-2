import { Sprite, Texture } from "pixi.js";
import { Vec2, Circle, type Body } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";
import { getFrame } from "../engine/AssetLoader.js";

const RAT_RADIUS = 0.3; // meters

export interface RatUserData {
  type: "rat";
  rat: Rat;
}

export class Rat extends Entity {
  alive = true;
  private deathTimer = -1;
  private readonly engine: Engine;
  private readonly sprite: Sprite;
  private idleTimer = 0;

  private constructor(body: Body, sprite: Sprite, engine: Engine) {
    super(body, sprite);
    this.sprite = sprite;
    this.engine = engine;
  }

  static spawn(x: number, y: number, engine: Engine): Rat {
    const body = engine.physics.createBody({
      type: "dynamic",
      position: Vec2(x, y),
      fixedRotation: false,
    });
    body.createFixture({
      shape: new Circle(RAT_RADIUS),
      density: 1.0,
      restitution: 0.1,
      friction: 0.5,
    });

    const rPx = engine.metersToPixels(RAT_RADIUS);

    // Rat sprite from character atlas
    const texture = getFrame("rat_idle_01");
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    // Size to match physics body (96x128 sprite in a 0.6m diameter circle)
    sprite.width = rPx * 2;
    sprite.height = rPx * 2 * (128 / 96); // Preserve aspect ratio (taller with ears)

    engine.getLayer("entities").addChild(sprite);

    const rat = new Rat(body, sprite, engine);
    body.setUserData({ type: "rat", rat } satisfies RatUserData);
    engine.addEntity(rat);

    return rat;
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.deathTimer = 0.3;

    // Switch to defeated sprite
    const defeatedTex = getFrame("rat_defeated");
    if (defeatedTex !== Texture.EMPTY) {
      this.sprite.texture = defeatedTex;
    }
  }

  override update(dt: number): void {
    if (!this.alive && this.deathTimer > 0) {
      this.deathTimer -= dt;
      this.display.alpha = Math.max(0, this.deathTimer / 0.3);
      if (this.deathTimer <= 0) {
        this.engine.removeEntity(this);
      }
      return;
    }

    // Simple idle animation: swap between idle frames
    if (this.alive) {
      this.idleTimer += dt;
      const frameIndex = Math.floor(this.idleTimer / 0.8) % 3;
      const frameNames = ["rat_idle_01", "rat_idle_02", "rat_idle_03"] as const;
      const tex = getFrame(frameNames[frameIndex]!);
      if (tex !== Texture.EMPTY) {
        this.sprite.texture = tex;
      }
    }
  }
}
