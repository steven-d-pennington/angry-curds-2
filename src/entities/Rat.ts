import { Graphics } from "pixi.js";
import { Vec2, Circle, type Body } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";

const RAT_RADIUS = 0.3; // meters
const RAT_BODY_COLOR = 0x888888;
const RAT_EYE_COLOR = 0xff2222;

export interface RatUserData {
  type: "rat";
  rat: Rat;
}

export class Rat extends Entity {
  alive = true;
  private deathTimer = -1;
  private readonly engine: Engine;

  private constructor(body: Body, display: Graphics, engine: Engine) {
    super(body, display);
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

    const gfx = new Graphics();
    // Body
    gfx.circle(0, 0, rPx);
    gfx.fill({ color: RAT_BODY_COLOR });
    // Left eye
    gfx.circle(-rPx * 0.3, -rPx * 0.2, rPx * 0.18);
    gfx.fill({ color: RAT_EYE_COLOR });
    // Right eye
    gfx.circle(rPx * 0.3, -rPx * 0.2, rPx * 0.18);
    gfx.fill({ color: RAT_EYE_COLOR });

    engine.getLayer("entities").addChild(gfx);

    const rat = new Rat(body, gfx, engine);
    body.setUserData({ type: "rat", rat } satisfies RatUserData);
    engine.addEntity(rat);

    return rat;
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.deathTimer = 0.3; // fade out over 0.3s
  }

  override update(dt: number): void {
    if (!this.alive && this.deathTimer > 0) {
      this.deathTimer -= dt;
      this.display.alpha = Math.max(0, this.deathTimer / 0.3);
      if (this.deathTimer <= 0) {
        this.engine.removeEntity(this);
      }
    }
  }
}
