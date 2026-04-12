import { World, Vec2, Body, type BodyDef, type FixtureDef, Edge } from "planck";

const GRAVITY = Vec2(0, -30);
const VELOCITY_ITERATIONS = 8;
const POSITION_ITERATIONS = 3;

/**
 * Wrapper around Planck.js World.
 * Provides a clean API for creating/destroying bodies and stepping the simulation.
 */
export class PhysicsWorld {
  readonly world: World;
  private groundBody: Body;

  constructor(groundY = 0, groundWidth = 100) {
    this.world = new World({ gravity: GRAVITY });

    // Static ground plane
    this.groundBody = this.world.createBody({ type: "static", position: Vec2(0, groundY) });
    this.groundBody.createFixture({
      shape: new Edge(Vec2(-groundWidth / 2, 0), Vec2(groundWidth / 2, 0)),
      friction: 0.6,
    });
  }

  step(dt: number): void {
    this.world.step(dt, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
  }

  createBody(def: BodyDef): Body {
    return this.world.createBody(def);
  }

  addFixture(body: Body, def: FixtureDef): void {
    body.createFixture(def);
  }

  destroyBody(body: Body): void {
    this.world.destroyBody(body);
  }

  getGround(): Body {
    return this.groundBody;
  }

  /** Destroy all dynamic and kinematic bodies, keeping only the ground. */
  destroyAllDynamic(): void {
    let body = this.world.getBodyList();
    while (body) {
      const next = body.getNext();
      if (body !== this.groundBody) {
        this.world.destroyBody(body);
      }
      body = next;
    }
  }

  /** Iterate all bodies — used by debug draw and entity sync. */
  forEachBody(callback: (body: Body) => void): void {
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      callback(b);
    }
  }
}
