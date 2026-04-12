import { describe, it, expect } from "vitest";
import {
  clampPull,
  computeLaunchVelocity,
  trajectoryPoint,
  computeTrajectoryPoints,
} from "../launchMath.js";

describe("clampPull", () => {
  it("returns original vector when within max distance", () => {
    const result = clampPull(1, 2, 5);
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(2);
    expect(result.dist).toBeCloseTo(Math.sqrt(5));
  });

  it("clamps vector to max pull distance", () => {
    const result = clampPull(3, 4, 2.5); // dist = 5, clamped to 2.5
    expect(result.dist).toBeCloseTo(2.5);
    // Direction preserved: (3/5, 4/5) * 2.5
    expect(result.dx).toBeCloseTo(1.5);
    expect(result.dy).toBeCloseTo(2.0);
  });

  it("handles zero vector", () => {
    const result = clampPull(0, 0, 3);
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.dist).toBe(0);
  });

  it("handles exact max distance", () => {
    const result = clampPull(3, 4, 5); // dist = 5, exactly max
    expect(result.dist).toBeCloseTo(5);
    expect(result.dx).toBe(3);
    expect(result.dy).toBe(4);
  });
});

describe("computeLaunchVelocity", () => {
  it("returns zero velocity for zero pull distance", () => {
    const result = computeLaunchVelocity(0, 0, 0, 12, 40);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("returns zero for sub-threshold pull distance", () => {
    const result = computeLaunchVelocity(0.0001, 0, 0.0001, 12, 40);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("launches in opposite direction to pull", () => {
    // Pull to the left (negative x)
    const result = computeLaunchVelocity(-2, 0, 2, 12, 40);
    expect(result.x).toBeGreaterThan(0); // Launches right
    expect(result.y).toBeCloseTo(0);
  });

  it("launches with correct speed = pullDist * scale", () => {
    const pullDist = 2.5;
    const scale = 12;
    const result = computeLaunchVelocity(-pullDist, 0, pullDist, scale, 100);
    expect(result.x).toBeCloseTo(pullDist * scale);
    expect(result.y).toBeCloseTo(0);
  });

  it("caps velocity at maxLaunchSpeed", () => {
    const pullDist = 3.0;
    const scale = 12; // 3 * 12 = 36
    const maxSpeed = 30;
    const result = computeLaunchVelocity(-pullDist, 0, pullDist, scale, maxSpeed);
    const speed = Math.sqrt(result.x * result.x + result.y * result.y);
    expect(speed).toBeCloseTo(maxSpeed);
  });

  it("preserves direction when capping speed", () => {
    const result = computeLaunchVelocity(-3, -4, 5, 12, 10); // Would be 60, capped to 10
    const speed = Math.sqrt(result.x * result.x + result.y * result.y);
    expect(speed).toBeCloseTo(10);
    // Direction should be opposite to (-3, -4), i.e., (3/5, 4/5) normalized
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
    expect(result.x / result.y).toBeCloseTo(3 / 4);
  });

  it("handles diagonal pull", () => {
    // Pull down-left, should launch up-right
    const result = computeLaunchVelocity(-1, -1, Math.SQRT2, 12, 100);
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
    expect(result.x).toBeCloseTo(result.y); // 45-degree launch
  });
});

describe("trajectoryPoint", () => {
  it("returns start position at t=0", () => {
    const p = trajectoryPoint(5, 10, 20, 15, -30, 0);
    expect(p.x).toBe(5);
    expect(p.y).toBe(10);
  });

  it("applies linear motion without gravity at small t", () => {
    const p = trajectoryPoint(0, 0, 10, 0, 0, 1);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });

  it("applies gravity correctly", () => {
    // Starting at origin, zero horizontal velocity, gravity = -30
    const p = trajectoryPoint(0, 0, 0, 0, -30, 1);
    // y = 0 + 0*1 + 0.5*(-30)*1 = -15
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-15);
  });

  it("computes correct arc position", () => {
    // Standard projectile: x0=0, y0=0, vx=10, vy=20, g=-30, t=2
    const p = trajectoryPoint(0, 0, 10, 20, -30, 2);
    // x = 10*2 = 20
    // y = 20*2 + 0.5*(-30)*4 = 40 - 60 = -20
    expect(p.x).toBeCloseTo(20);
    expect(p.y).toBeCloseTo(-20);
  });
});

describe("computeTrajectoryPoints", () => {
  it("generates correct number of points", () => {
    // Launch upward with enough height so none go below ground
    const points = computeTrajectoryPoints(0, 10, 5, 30, -30, 10, 0.05);
    expect(points.length).toBeLessThanOrEqual(10);
    expect(points.length).toBeGreaterThan(0);
  });

  it("stops when trajectory goes below y=0", () => {
    // Start at y=1, launch horizontally with strong downward gravity
    const points = computeTrajectoryPoints(0, 1, 10, 0, -30, 100, 0.1);
    // At some point y goes below 0
    expect(points.length).toBeLessThan(100);
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns empty array for straight-down launch from ground", () => {
    // Start at y=0, gravity pulls down: first point at t=0.05 is below ground
    const points = computeTrajectoryPoints(0, 0, 0, 0, -30, 10, 0.05);
    // t=0.05: y = 0 + 0 + 0.5*(-30)*0.0025 = -0.0375 < 0
    expect(points.length).toBe(0);
  });

  it("points follow parabolic arc", () => {
    const vx = 15;
    const vy = 25;
    const gravity = -30;
    const points = computeTrajectoryPoints(0, 5, vx, vy, gravity, 5, 0.1);

    for (let i = 0; i < points.length; i++) {
      const t = (i + 1) * 0.1;
      expect(points[i]!.x).toBeCloseTo(vx * t);
      expect(points[i]!.y).toBeCloseTo(5 + vy * t + 0.5 * gravity * t * t);
    }
  });
});
