/**
 * Static camera/viewport mapping a world-space rectangle to the canvas.
 * Default: 20m wide x 12m tall world area shown in the full canvas.
 */
export class Viewport {
  /** World-space width in meters */
  readonly worldWidth: number;
  /** World-space height in meters */
  readonly worldHeight: number;

  constructor(worldWidth = 20, worldHeight = 12) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /** Pixels per world meter, horizontally. */
  scaleX(canvasWidth: number): number {
    return canvasWidth / this.worldWidth;
  }

  /** Pixels per world meter, vertically. */
  scaleY(canvasHeight: number): number {
    return canvasHeight / this.worldHeight;
  }
}
