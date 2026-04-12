import { Graphics } from "pixi.js";
import type { Body, Fixture, Shape } from "planck";
import { CircleShape, PolygonShape, EdgeShape } from "planck";
import type { PhysicsWorld } from "../physics/PhysicsWorld.js";
import { worldToScreen, metersToPixels } from "../CoordinateSystem.js";
import type { Viewport } from "./Viewport.js";

/**
 * Toggle-able overlay that draws Planck body outlines using PixiJS Graphics.
 * For development only — not rendered in production builds.
 */
export class DebugDraw {
  private readonly gfx: Graphics;
  private _enabled = true;

  constructor(parentContainer: import("pixi.js").Container) {
    this.gfx = new Graphics();
    this.gfx.label = "debug-draw";
    parentContainer.addChild(this.gfx);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.gfx.visible = value;
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }

  draw(physics: PhysicsWorld, viewport: Viewport, canvasWidth: number, canvasHeight: number): void {
    this.gfx.clear();
    if (!this._enabled) return;

    physics.forEachBody((body: Body) => {
      const isStatic = body.isStatic();
      const color = isStatic ? 0x00ff00 : body.isAwake() ? 0xff4444 : 0x888888;

      for (let f: Fixture | null = body.getFixtureList(); f; f = f.getNext()) {
        this.drawShape(f.getShape(), body, color, viewport, canvasWidth, canvasHeight);
      }
    });
  }

  private drawShape(
    shape: Shape,
    body: Body,
    color: number,
    viewport: Viewport,
    cw: number,
    ch: number,
  ): void {
    const pos = body.getPosition();
    const angle = body.getAngle();

    if (shape instanceof CircleShape) {
      const center = shape.getCenter();
      // Rotate center by body angle and add body position
      const wx = pos.x + (center.x * Math.cos(angle) - center.y * Math.sin(angle));
      const wy = pos.y + (center.x * Math.sin(angle) + center.y * Math.cos(angle));
      const screen = worldToScreen(
        { x: wx, y: wy } as import("planck").Vec2,
        cw, ch, viewport.worldWidth, viewport.worldHeight,
      );
      const radiusPx = metersToPixels(shape.getRadius(), cw, viewport.worldWidth);
      this.gfx.circle(screen.x, screen.y, radiusPx);
      this.gfx.stroke({ width: 1, color });
    } else if (shape instanceof PolygonShape) {
      const vertices = shape.m_vertices;
      if (vertices.length === 0) return;
      const screenVerts = vertices.map((v) => {
        const wx = pos.x + (v.x * Math.cos(angle) - v.y * Math.sin(angle));
        const wy = pos.y + (v.x * Math.sin(angle) + v.y * Math.cos(angle));
        return worldToScreen(
          { x: wx, y: wy } as import("planck").Vec2,
          cw, ch, viewport.worldWidth, viewport.worldHeight,
        );
      });
      const first = screenVerts[0];
      if (!first) return;
      this.gfx.moveTo(first.x, first.y);
      for (let i = 1; i < screenVerts.length; i++) {
        const v = screenVerts[i];
        if (v) this.gfx.lineTo(v.x, v.y);
      }
      this.gfx.lineTo(first.x, first.y);
      this.gfx.stroke({ width: 1, color });
    } else if (shape instanceof EdgeShape) {
      const v1 = shape.m_vertex1;
      const v2 = shape.m_vertex2;
      const s1 = worldToScreen(
        { x: pos.x + v1.x, y: pos.y + v1.y } as import("planck").Vec2,
        cw, ch, viewport.worldWidth, viewport.worldHeight,
      );
      const s2 = worldToScreen(
        { x: pos.x + v2.x, y: pos.y + v2.y } as import("planck").Vec2,
        cw, ch, viewport.worldWidth, viewport.worldHeight,
      );
      this.gfx.moveTo(s1.x, s1.y);
      this.gfx.lineTo(s2.x, s2.y);
      this.gfx.stroke({ width: 2, color });
    }
  }
}
