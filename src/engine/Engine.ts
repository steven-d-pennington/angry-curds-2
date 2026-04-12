import { Application, Container } from "pixi.js";
import { PhysicsWorld } from "./physics/PhysicsWorld.js";
import { LayerStack, type LayerName } from "./rendering/LayerStack.js";
import { Viewport } from "./rendering/Viewport.js";
import { DebugDraw } from "./rendering/DebugDraw.js";
import { ParallaxBackground } from "./rendering/ParallaxBackground.js";
import { ParticleEmitter } from "./vfx/ParticleEmitter.js";
import { Entity } from "./entities/Entity.js";
import { loadAllAssets } from "./AssetLoader.js";
import { Vec2 } from "planck";
import { worldToScreen, metersToPixels } from "./CoordinateSystem.js";

/**
 * Core engine facade.
 *
 * Owns the PixiJS application, physics world, layer stack, viewport,
 * and the fixed-timestep game loop. Gameplay code interacts through
 * this single entry point.
 *
 * ## Game Loop (fixed timestep, TDD Section 9.1)
 * - Physics steps at a fixed 60Hz (FIXED_DT = 1/60 s).
 * - requestAnimationFrame drives the render tick.
 * - An accumulator collects real elapsed time.
 * - Physics steps consume the accumulator in FIXED_DT increments.
 * - Rendering interpolates entity positions between the previous
 *   and current physics state using the leftover accumulator fraction.
 */

const FIXED_DT = 1 / 60;
const MAX_FRAME_TIME = 0.25; // Clamp to avoid spiral of death

export interface EngineOptions {
  /** World-space viewport width in meters. Default 20. */
  viewportWidth?: number;
  /** World-space viewport height in meters. Default 12. */
  viewportHeight?: number;
  /** Y position of ground plane in world meters. Default 1. */
  groundY?: number;
  /** Width of ground plane in world meters. Default 40. */
  groundWidth?: number;
}

export class Engine {
  readonly app: Application;
  readonly physics: PhysicsWorld;
  readonly layers: LayerStack;
  readonly viewport: Viewport;
  readonly debugDraw: DebugDraw;
  readonly parallax: ParallaxBackground;
  readonly particles: ParticleEmitter;

  private readonly entities: Set<Entity> = new Set();
  private accumulator = 0;
  private lastTime = 0;
  private running = false;

  private constructor(
    app: Application,
    physics: PhysicsWorld,
    layers: LayerStack,
    viewport: Viewport,
    debugDraw: DebugDraw,
    parallax: ParallaxBackground,
    particles: ParticleEmitter,
  ) {
    this.app = app;
    this.physics = physics;
    this.layers = layers;
    this.viewport = viewport;
    this.debugDraw = debugDraw;
    this.parallax = parallax;
    this.particles = particles;
  }

  /**
   * Async factory — initialises PixiJS Application, physics world,
   * layers, viewport, and debug draw. Call this once at startup.
   */
  static async create(options: EngineOptions = {}): Promise<Engine> {
    const {
      viewportWidth = 20,
      viewportHeight = 12,
      groundY = 1,
      groundWidth = 40,
    } = options;

    const app = new Application();
    await app.init({
      resizeTo: window,
      background: 0x2a1e14, // Deep warm brown per environment spec
      antialias: true,
    });

    document.getElementById("app")!.appendChild(app.canvas);

    // Load all sprite sheets and environment textures before building the scene
    await loadAllAssets();

    const physics = new PhysicsWorld(groundY, groundWidth);
    const layers = new LayerStack(app.stage);
    const viewport = new Viewport(viewportWidth, viewportHeight);

    // Parallax background (renders into the background layer)
    const parallax = new ParallaxBackground(layers.get("background"));
    parallax.init(app.screen.width, app.screen.height);

    // Particle emitter (renders into VFX layer)
    const particles = new ParticleEmitter(layers.get("vfx"));

    // Debug draw lives above all layers
    const debugContainer = new Container();
    debugContainer.label = "debug";
    app.stage.addChild(debugContainer);
    const debugDraw = new DebugDraw(debugContainer);

    return new Engine(app, physics, layers, viewport, debugDraw, parallax, particles);
  }

  /** Register an entity so the engine syncs its transform each frame. */
  addEntity(entity: Entity): void {
    this.entities.add(entity);
  }

  /** Unregister and destroy an entity. */
  removeEntity(entity: Entity): void {
    this.entities.delete(entity);
    this.physics.destroyBody(entity.body);
    entity.destroy();
  }

  /** Access a named rendering layer. */
  getLayer(name: LayerName): Container {
    return this.layers.get(name);
  }

  /** Start the game loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.app.ticker.add(this.tick, this);
  }

  /** Stop the game loop. */
  stop(): void {
    this.running = false;
    this.app.ticker.remove(this.tick, this);
  }

  /** Main tick — called by PixiJS ticker each frame. */
  private tick(): void {
    const now = performance.now() / 1000;
    let frameTime = now - this.lastTime;
    this.lastTime = now;

    // Clamp to avoid spiral of death after alt-tab / breakpoint
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    this.accumulator += frameTime;

    // Fixed-timestep physics steps
    while (this.accumulator >= FIXED_DT) {
      this.physics.step(FIXED_DT);
      for (const entity of this.entities) {
        entity.update(FIXED_DT);
      }
      this.accumulator -= FIXED_DT;
    }

    // Sync entity display positions from physics
    const cw = this.app.screen.width;
    const ch = this.app.screen.height;

    for (const entity of this.entities) {
      const pos = entity.body.getPosition();
      const screen = worldToScreen(
        pos, cw, ch,
        this.viewport.worldWidth, this.viewport.worldHeight,
      );
      entity.display.x = screen.x;
      entity.display.y = screen.y;
      entity.display.rotation = -entity.body.getAngle(); // Flip for Y-down

      // Scale display objects if they were authored at 1px = 1m
      // Subclasses can override for custom sizing
    }

    // Update particle effects
    this.particles.update(frameTime);

    // Debug draw
    this.debugDraw.draw(this.physics, this.viewport, cw, ch);
  }

  /** Remove and destroy all registered entities. */
  destroyAllEntities(): void {
    for (const entity of this.entities) {
      this.physics.destroyBody(entity.body);
      entity.destroy();
    }
    this.entities.clear();
  }

  /** Clear all children from every rendering layer. */
  clearLayers(): void {
    this.layers.clearAll();
  }

  /** Current canvas width in pixels. */
  get canvasWidth(): number {
    return this.app.screen.width;
  }

  /** Current canvas height in pixels. */
  get canvasHeight(): number {
    return this.app.screen.height;
  }

  /** Convert a size in world meters to pixels at current canvas size. */
  metersToPixels(meters: number): number {
    return metersToPixels(meters, this.app.screen.width, this.viewport.worldWidth);
  }

  /** Convert a world position to screen coordinates. */
  worldToScreenPos(worldX: number, worldY: number): { x: number; y: number } {
    return worldToScreen(
      Vec2(worldX, worldY),
      this.app.screen.width,
      this.app.screen.height,
      this.viewport.worldWidth,
      this.viewport.worldHeight,
    );
  }
}
