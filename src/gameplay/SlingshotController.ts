import { Graphics } from "pixi.js";
import { screenToWorld } from "../engine/CoordinateSystem.js";
import type { Engine } from "../engine/Engine.js";
import type { Slingshot } from "./Slingshot.js";
import type { Launchable } from "./Launchable.js";
import type { LaunchConfig, TrajectoryPreviewConfig } from "./SlingshotConfig.js";
import { clampPull, computeLaunchVelocity, computeTrajectoryPoints } from "./launchMath.js";

/**
 * Handles mouse input for the slingshot: pull-back aiming, trajectory preview,
 * and launching the cheese on release.
 */
export class SlingshotController {
  private readonly engine: Engine;
  private readonly slingshot: Slingshot;
  private readonly launchConfig: LaunchConfig;
  private readonly previewConfig: TrajectoryPreviewConfig;
  private readonly trajectoryGfx: Graphics;

  private activeCheese: Launchable | null = null;
  private dragging = false;
  private dragWorldPos: { x: number; y: number } = { x: 0, y: 0 };

  /** Fires when a cheese is launched */
  onLaunch: (() => void) | null = null;
  /** Fires when aiming begins (pointer down on cheese). */
  onAimStart: (() => void) | null = null;
  /** Fires when aiming is cancelled (release below min pull). */
  onAimCancel: (() => void) | null = null;

  constructor(
    engine: Engine,
    slingshot: Slingshot,
    launchConfig: LaunchConfig,
    previewConfig: TrajectoryPreviewConfig,
  ) {
    this.engine = engine;
    this.slingshot = slingshot;
    this.launchConfig = launchConfig;
    this.previewConfig = previewConfig;

    this.trajectoryGfx = new Graphics();
    engine.getLayer("vfx").addChild(this.trajectoryGfx);

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    const canvas = engine.app.canvas;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerUp);
  }

  /** Whether the slingshot is currently being aimed (dragged). */
  get isAiming(): boolean {
    return this.dragging;
  }

  /** Set the cheese that's currently loaded on the slingshot. */
  setCheese(cheese: Launchable | null): void {
    this.activeCheese = cheese;
    this.dragging = false;
    this.trajectoryGfx.clear();
    if (cheese) {
      this.slingshot.drawBand(
        this.slingshot.anchorWorld.x,
        this.slingshot.anchorWorld.y,
      );
    } else {
      this.slingshot.clearBand();
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.activeCheese || this.activeCheese.state !== "loaded") return;

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    const anchor = this.slingshot.anchorWorld;
    const dx = worldPos.x - anchor.x;
    const dy = worldPos.y - anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Must click near the cheese/anchor to start dragging (1.5m radius)
    if (dist > 1.5) return;

    this.dragging = true;
    this.activeCheese.startAiming();
    this.dragWorldPos = { x: worldPos.x, y: worldPos.y };
    this.onAimStart?.();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragging || !this.activeCheese) return;

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    const anchor = this.slingshot.anchorWorld;

    // Calculate pull vector from anchor to mouse, clamped
    const rawDx = worldPos.x - anchor.x;
    const rawDy = worldPos.y - anchor.y;
    const clamped = clampPull(rawDx, rawDy, this.launchConfig.maxPullDistance);
    const { dx, dy, dist } = clamped;

    const cheeseX = anchor.x + dx;
    const cheeseY = anchor.y + dy;
    this.dragWorldPos = { x: cheeseX, y: cheeseY };

    // Move cheese visual
    this.activeCheese.aimAt(cheeseX, cheeseY);

    // Update rubber band
    this.slingshot.drawBand(cheeseX, cheeseY);

    // Calculate launch velocity (opposite to pull direction)
    const launchVel = computeLaunchVelocity(
      dx, dy, dist,
      this.launchConfig.launchVelocityScale,
      this.launchConfig.maxLaunchSpeed,
    );

    // Draw trajectory preview
    this.drawTrajectoryPreview(anchor.x, anchor.y, launchVel.x, launchVel.y);
  }

  private onPointerUp(_e: PointerEvent): void {
    if (!this.dragging || !this.activeCheese) return;
    this.dragging = false;

    const anchor = this.slingshot.anchorWorld;
    const dx = this.dragWorldPos.x - anchor.x;
    const dy = this.dragWorldPos.y - anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clear visuals
    this.trajectoryGfx.clear();
    this.slingshot.clearBand();

    // Minimum pull distance to register a shot
    if (dist < 0.2) {
      // Snap back — aiming cancelled
      this.activeCheese.loadAt(anchor.x, anchor.y);
      this.slingshot.drawBand(anchor.x, anchor.y);
      this.onAimCancel?.();
      return;
    }

    const launchVel = computeLaunchVelocity(
      dx, dy, dist,
      this.launchConfig.launchVelocityScale,
      this.launchConfig.maxLaunchSpeed,
    );

    // Launch from anchor position (not drag position)
    this.activeCheese.aimAt(anchor.x, anchor.y);
    this.activeCheese.launch(launchVel.x, launchVel.y);

    this.activeCheese = null;
    this.onLaunch?.();
  }

  /**
   * Draw a dotted trajectory arc showing predicted flight path.
   * Uses simple projectile motion (no collision prediction).
   */
  private drawTrajectoryPreview(
    startX: number,
    startY: number,
    velX: number,
    velY: number,
  ): void {
    const cfg = this.previewConfig;
    const gravity = -30; // Match engine gravity

    this.trajectoryGfx.clear();

    const points = computeTrajectoryPoints(
      startX, startY, velX, velY,
      gravity, cfg.dotCount, cfg.dotTimeStep,
    );

    for (const [i, p] of points.entries()) {
      if (p.x < -2 || p.x > this.engine.viewport.worldWidth + 2) break;

      const screen = this.worldToScreen(p.x, p.y);
      const alpha = cfg.dotAlpha * (1 - i / cfg.dotCount);

      this.trajectoryGfx.circle(screen.x, screen.y, cfg.dotRadius);
      this.trajectoryGfx.fill({ color: cfg.dotColor, alpha });
    }
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const cw = this.engine.canvasWidth;
    const ch = this.engine.canvasHeight;
    const vw = this.engine.viewport.worldWidth;
    const vh = this.engine.viewport.worldHeight;
    const v = screenToWorld(screenX, screenY, cw, ch, vw, vh);
    return { x: v.x, y: v.y };
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cw = this.engine.canvasWidth;
    const ch = this.engine.canvasHeight;
    const vw = this.engine.viewport.worldWidth;
    const vh = this.engine.viewport.worldHeight;
    return {
      x: (wx / vw) * cw,
      y: ch - (wy / vh) * ch,
    };
  }

  destroy(): void {
    const canvas = this.engine.app.canvas;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerUp);
    this.trajectoryGfx.destroy();
  }
}
