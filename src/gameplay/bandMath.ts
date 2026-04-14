/**
 * Pure math functions for slingshot band rendering.
 * Extracted for testability — no PixiJS or engine dependencies.
 */

/**
 * Compute the quadratic bezier control point for natural band sag.
 * The control point is offset perpendicular to the from→to line,
 * in the "downward" screen direction (positive Y).
 *
 * @param fromX - Fork point X (screen coords)
 * @param fromY - Fork point Y (screen coords)
 * @param toX   - Target/cheese point X (screen coords)
 * @param toY   - Target/cheese point Y (screen coords)
 * @param sagPixels - Maximum sag in pixels at zero pull
 * @param pullRatio - 0 = relaxed (max sag), 1 = fully stretched (minimal sag)
 */
export function computeBandControlPoint(
  fromX: number, fromY: number,
  toX: number, toY: number,
  sagPixels: number,
  pullRatio: number,
): { x: number; y: number } {
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  // Sag decreases as pull increases (band gets taut)
  const sag = sagPixels * (1 - pullRatio * 0.85);

  // Offset downward in screen space (positive Y = down)
  return { x: midX, y: midY + sag };
}

/**
 * Linearly interpolate between two hex colors.
 * Blends R, G, B channels independently.
 */
export function interpolateBandColor(
  pullRatio: number,
  relaxedColor: number,
  stretchedColor: number,
): number {
  const t = Math.max(0, Math.min(1, pullRatio));

  const r1 = (relaxedColor >> 16) & 0xff;
  const g1 = (relaxedColor >> 8) & 0xff;
  const b1 = relaxedColor & 0xff;

  const r2 = (stretchedColor >> 16) & 0xff;
  const g2 = (stretchedColor >> 8) & 0xff;
  const b2 = stretchedColor & 0xff;

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return (r << 16) | (g << 8) | b;
}

/**
 * Compute band thickness based on pull ratio.
 * More pull = thicker stretched band.
 */
export function computeBandThickness(
  pullRatio: number,
  minThickness: number,
  maxThickness: number,
): number {
  const t = Math.max(0, Math.min(1, pullRatio));
  return minThickness + (maxThickness - minThickness) * t;
}

/**
 * Sample N+1 points along a quadratic bezier curve (from, control, to).
 * Returns `segments + 1` points including start and end.
 */
export function sampleBezier(
  fromX: number, fromY: number,
  cpX: number, cpY: number,
  toX: number, toY: number,
  segments: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    points.push({
      x: mt * mt * fromX + 2 * mt * t * cpX + t * t * toX,
      y: mt * mt * fromY + 2 * mt * t * cpY + t * t * toY,
    });
  }
  return points;
}
