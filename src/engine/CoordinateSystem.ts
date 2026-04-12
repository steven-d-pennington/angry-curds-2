import { Vec2 } from "planck";

/**
 * Coordinate system conversion between Planck.js (Y-up, meters) and PixiJS (Y-down, pixels).
 *
 * Convention:
 *   - Planck world: origin at bottom-left of viewport, Y points UP, units in meters.
 *   - PixiJS screen: origin at top-left of canvas, Y points DOWN, units in pixels.
 *   - Scale: PIXELS_PER_METER pixels = 1 meter.
 *
 * The viewport is defined as a rectangle in world space (meters).
 * worldToScreen() maps world coords → canvas pixel coords.
 * screenToWorld() maps canvas pixel coords → world coords.
 */

export const PIXELS_PER_METER = 30;

export function worldToScreenX(worldX: number, viewportWidthPx: number, viewportWorldWidth: number): number {
  return (worldX / viewportWorldWidth) * viewportWidthPx;
}

export function worldToScreenY(worldY: number, viewportHeightPx: number, viewportWorldHeight: number): number {
  return viewportHeightPx - (worldY / viewportWorldHeight) * viewportHeightPx;
}

export function worldToScreen(
  worldPos: Vec2,
  viewportWidthPx: number,
  viewportHeightPx: number,
  viewportWorldWidth: number,
  viewportWorldHeight: number,
): { x: number; y: number } {
  return {
    x: worldToScreenX(worldPos.x, viewportWidthPx, viewportWorldWidth),
    y: worldToScreenY(worldPos.y, viewportHeightPx, viewportWorldHeight),
  };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
  viewportWorldWidth: number,
  viewportWorldHeight: number,
): Vec2 {
  return Vec2(
    (screenX / viewportWidthPx) * viewportWorldWidth,
    ((viewportHeightPx - screenY) / viewportHeightPx) * viewportWorldHeight,
  );
}

export function metersToPixels(meters: number, viewportWidthPx: number, viewportWorldWidth: number): number {
  return (meters / viewportWorldWidth) * viewportWidthPx;
}
