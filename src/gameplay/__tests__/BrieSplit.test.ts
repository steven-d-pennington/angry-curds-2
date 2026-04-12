import { describe, it, expect } from "vitest";

/**
 * Pure-math tests for the Brie split velocity distribution.
 * These verify the fan-out formula without needing the physics engine.
 */

const SPLIT_SPREAD = (20 * Math.PI) / 180; // 20 degrees in radians
const SPEED_FACTOR = 0.85;

interface SubVelocity {
  vx: number;
  vy: number;
}

/** Compute sub-projectile velocities from parent velocity. */
function computeSplitVelocities(
  parentVx: number,
  parentVy: number,
  spread: number,
  speedFactor: number,
): [SubVelocity, SubVelocity, SubVelocity] {
  const parentSpeed = Math.sqrt(parentVx * parentVx + parentVy * parentVy);
  const parentAngle = Math.atan2(parentVy, parentVx);
  const subSpeed = parentSpeed * speedFactor;

  const angles = [
    parentAngle + spread,
    parentAngle,
    parentAngle - spread,
  ];

  return angles.map((angle) => ({
    vx: subSpeed * Math.cos(angle),
    vy: subSpeed * Math.sin(angle),
  })) as [SubVelocity, SubVelocity, SubVelocity];
}

describe("Brie split velocity distribution", () => {
  it("center sub retains parent direction", () => {
    const [, center] = computeSplitVelocities(10, 0, SPLIT_SPREAD, SPEED_FACTOR);
    expect(center.vx).toBeCloseTo(10 * SPEED_FACTOR);
    expect(center.vy).toBeCloseTo(0);
  });

  it("all subs have reduced speed", () => {
    const subs = computeSplitVelocities(10, 5, SPLIT_SPREAD, SPEED_FACTOR);
    const parentSpeed = Math.sqrt(100 + 25);
    const expectedSpeed = parentSpeed * SPEED_FACTOR;

    for (const sub of subs) {
      const speed = Math.sqrt(sub.vx * sub.vx + sub.vy * sub.vy);
      expect(speed).toBeCloseTo(expectedSpeed);
    }
  });

  it("outer subs fan out by spread angle", () => {
    const parentVx = 20;
    const parentVy = 0;
    const [left, center, right] = computeSplitVelocities(
      parentVx, parentVy, SPLIT_SPREAD, SPEED_FACTOR,
    );

    const leftAngle = Math.atan2(left.vy, left.vx);
    const centerAngle = Math.atan2(center.vy, center.vx);
    const rightAngle = Math.atan2(right.vy, right.vx);

    expect(leftAngle - centerAngle).toBeCloseTo(SPLIT_SPREAD);
    expect(centerAngle - rightAngle).toBeCloseTo(SPLIT_SPREAD);
  });

  it("spread is symmetric around parent direction", () => {
    const [left, , right] = computeSplitVelocities(10, 10, SPLIT_SPREAD, SPEED_FACTOR);

    const leftAngle = Math.atan2(left.vy, left.vx);
    const rightAngle = Math.atan2(right.vy, right.vx);
    const parentAngle = Math.atan2(10, 10);

    expect(leftAngle - parentAngle).toBeCloseTo(SPLIT_SPREAD);
    expect(parentAngle - rightAngle).toBeCloseTo(SPLIT_SPREAD);
  });

  it("zero speed parent produces zero speed subs", () => {
    const subs = computeSplitVelocities(0, 0, SPLIT_SPREAD, SPEED_FACTOR);
    for (const sub of subs) {
      expect(sub.vx).toBeCloseTo(0);
      expect(sub.vy).toBeCloseTo(0);
    }
  });

  it("total sub KE is less than an equivalent Cheddar shot", () => {
    const parentVx = 30;
    const parentVy = 15;
    const parentSpeed = Math.sqrt(parentVx ** 2 + parentVy ** 2);
    // Design doc masses
    const massCheddar = 2.0 * Math.PI * 0.4 ** 2;
    const massSub = 2.5 * Math.PI * 0.2 ** 2;

    const cheddarKE = 0.5 * massCheddar * parentSpeed ** 2;

    const subs = computeSplitVelocities(parentVx, parentVy, SPLIT_SPREAD, SPEED_FACTOR);
    let totalSubKE = 0;
    for (const sub of subs) {
      const speed = Math.sqrt(sub.vx ** 2 + sub.vy ** 2);
      totalSubKE += 0.5 * massSub * speed ** 2;
    }

    // Design doc: total sub energy ~68% of Cheddar — trades power for coverage
    expect(totalSubKE).toBeLessThan(cheddarKE);
    expect(totalSubKE / cheddarKE).toBeGreaterThan(0.5); // not too weak
  });

  it("speed factor of 1.0 preserves parent speed", () => {
    const [, center] = computeSplitVelocities(10, 0, SPLIT_SPREAD, 1.0);
    expect(center.vx).toBeCloseTo(10);
    expect(center.vy).toBeCloseTo(0);
  });

  it("handles upward parent velocity correctly", () => {
    const subs = computeSplitVelocities(0, 20, SPLIT_SPREAD, SPEED_FACTOR);
    const [left, center, right] = subs;

    // Center should go straight up
    expect(center.vx).toBeCloseTo(0);
    expect(center.vy).toBeCloseTo(20 * SPEED_FACTOR);

    // Left fans to the left (negative x for upward parent)
    expect(left.vx).toBeLessThan(0);
    expect(left.vy).toBeGreaterThan(0);

    // Right fans to the right
    expect(right.vx).toBeGreaterThan(0);
    expect(right.vy).toBeGreaterThan(0);
  });
});
