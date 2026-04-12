/**
 * Pure math functions for slingshot launch computation and trajectory prediction.
 * Extracted from SlingshotController for testability.
 */

/**
 * Clamp a pull vector to the maximum pull distance.
 * Returns the clamped offset and actual distance.
 */
export function clampPull(
  dx: number,
  dy: number,
  maxPullDistance: number,
): { dx: number; dy: number; dist: number } {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= maxPullDistance) {
    return { dx, dy, dist };
  }
  const scale = maxPullDistance / dist;
  return {
    dx: dx * scale,
    dy: dy * scale,
    dist: maxPullDistance,
  };
}

/**
 * Compute launch velocity from a pull offset.
 * Direction is opposite to pull direction; magnitude scales with distance.
 */
export function computeLaunchVelocity(
  pullDx: number,
  pullDy: number,
  pullDist: number,
  launchVelocityScale: number,
  maxLaunchSpeed: number,
): { x: number; y: number } {
  if (pullDist < 0.001) return { x: 0, y: 0 };

  let speed = pullDist * launchVelocityScale;
  if (speed > maxLaunchSpeed) {
    speed = maxLaunchSpeed;
  }

  const nx = -pullDx / pullDist;
  const ny = -pullDy / pullDist;

  return { x: nx * speed, y: ny * speed };
}

/**
 * Compute a trajectory point at time t using projectile motion.
 * Returns world-space coordinates.
 */
export function trajectoryPoint(
  startX: number,
  startY: number,
  velX: number,
  velY: number,
  gravity: number,
  t: number,
): { x: number; y: number } {
  return {
    x: startX + velX * t,
    y: startY + velY * t + 0.5 * gravity * t * t,
  };
}

/**
 * Generate trajectory preview points.
 */
export function computeTrajectoryPoints(
  startX: number,
  startY: number,
  velX: number,
  velY: number,
  gravity: number,
  dotCount: number,
  dotTimeStep: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < dotCount; i++) {
    const t = (i + 1) * dotTimeStep;
    const p = trajectoryPoint(startX, startY, velX, velY, gravity, t);
    if (p.y < 0) break;
    points.push(p);
  }
  return points;
}
