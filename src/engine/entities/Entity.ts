import type { Body } from "planck";
import type { Container } from "pixi.js";

/**
 * Base class linking a Planck physics body to a PixiJS display object.
 * Subclasses add gameplay behavior; the engine calls syncToRender()
 * each frame to copy the physics transform onto the sprite.
 *
 * Coordinate conversion is handled externally by the Engine, which
 * knows the viewport dimensions. Entity just stores the raw references.
 */
export class Entity {
  readonly body: Body;
  readonly display: Container;

  constructor(body: Body, display: Container) {
    this.body = body;
    this.display = display;
  }

  /** Called by Engine after physics step. Override for custom behavior. */
  update(_dt: number): void {
    // Default: no-op. Subclasses can add per-frame logic here.
  }

  destroy(): void {
    this.display.destroy();
    // Body destruction handled by PhysicsWorld.destroyBody()
  }
}
