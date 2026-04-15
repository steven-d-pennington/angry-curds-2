import { describe, it, expect } from "vitest";
import {
  computePierceBoost,
  computePostPierceVelocity,
} from "../SwissProjectile.js";

/**
 * Pure-math tests for the Swiss pierce velocity mechanics.
 * These verify boost and post-pierce formulas without the physics engine.
 */

const BOOST_FACTOR = 1.8;
const POST_PIERCE_SPEED_FACTOR = 0.6;

describe("Swiss pierce boost", () => {
  it("boosts horizontal velocity by boost factor", () => {
    const result = computePierceBoost(10, 0, BOOST_FACTOR);
    expect(result.vx).toBeCloseTo(18);
    expect(result.vy).toBeCloseTo(0);
  });

  it("boosts vertical velocity by boost factor", () => {
    const result = computePierceBoost(0, 15, BOOST_FACTOR);
    expect(result.vx).toBeCloseTo(0);
    expect(result.vy).toBeCloseTo(27);
  });

  it("boosts diagonal velocity correctly", () => {
    const result = computePierceBoost(3, 4, BOOST_FACTOR);
    expect(result.vx).toBeCloseTo(3 * BOOST_FACTOR);
    expect(result.vy).toBeCloseTo(4 * BOOST_FACTOR);
  });

  it("preserves direction after boost", () => {
    const vx = 10, vy = -5;
    const result = computePierceBoost(vx, vy, BOOST_FACTOR);
    const originalAngle = Math.atan2(vy, vx);
    const boostedAngle = Math.atan2(result.vy, result.vx);
    expect(boostedAngle).toBeCloseTo(originalAngle);
  });

  it("boosted speed equals original speed times factor", () => {
    const vx = 8, vy = 6;
    const result = computePierceBoost(vx, vy, BOOST_FACTOR);
    const originalSpeed = Math.sqrt(vx * vx + vy * vy);
    const boostedSpeed = Math.sqrt(result.vx ** 2 + result.vy ** 2);
    expect(boostedSpeed).toBeCloseTo(originalSpeed * BOOST_FACTOR);
  });

  it("handles zero velocity", () => {
    const result = computePierceBoost(0, 0, BOOST_FACTOR);
    expect(result.vx).toBe(0);
    expect(result.vy).toBe(0);
  });

  it("boost factor of 1.0 preserves velocity", () => {
    const result = computePierceBoost(10, 5, 1.0);
    expect(result.vx).toBeCloseTo(10);
    expect(result.vy).toBeCloseTo(5);
  });
});

describe("Swiss post-pierce velocity reduction", () => {
  it("reduces speed to pre-pierce speed times factor", () => {
    const prePierceSpeed = 10;
    // After boost and some physics, current velocity may differ
    const result = computePostPierceVelocity(18, 0, prePierceSpeed, POST_PIERCE_SPEED_FACTOR);
    const resultSpeed = Math.sqrt(result.vx ** 2 + result.vy ** 2);
    expect(resultSpeed).toBeCloseTo(prePierceSpeed * POST_PIERCE_SPEED_FACTOR);
  });

  it("preserves direction after reduction", () => {
    const vx = 12, vy = -8;
    const prePierceSpeed = 10;
    const result = computePostPierceVelocity(vx, vy, prePierceSpeed, POST_PIERCE_SPEED_FACTOR);
    const originalAngle = Math.atan2(vy, vx);
    const resultAngle = Math.atan2(result.vy, result.vx);
    expect(resultAngle).toBeCloseTo(originalAngle);
  });

  it("handles zero current velocity", () => {
    const result = computePostPierceVelocity(0, 0, 10, POST_PIERCE_SPEED_FACTOR);
    expect(result.vx).toBe(0);
    expect(result.vy).toBe(0);
  });

  it("post-pierce speed is less than original pre-pierce speed", () => {
    const prePierceSpeed = 15;
    const result = computePostPierceVelocity(20, 10, prePierceSpeed, POST_PIERCE_SPEED_FACTOR);
    const resultSpeed = Math.sqrt(result.vx ** 2 + result.vy ** 2);
    expect(resultSpeed).toBeLessThan(prePierceSpeed);
  });

  it("factor of 1.0 restores original pre-pierce speed", () => {
    const prePierceSpeed = 10;
    const result = computePostPierceVelocity(15, 0, prePierceSpeed, 1.0);
    const resultSpeed = Math.sqrt(result.vx ** 2 + result.vy ** 2);
    expect(resultSpeed).toBeCloseTo(prePierceSpeed);
  });

  it("factor of 0.0 produces zero velocity", () => {
    const result = computePostPierceVelocity(10, 5, 10, 0.0);
    expect(result.vx).toBeCloseTo(0);
    expect(result.vy).toBeCloseTo(0);
  });
});

describe("Swiss pierce edge cases", () => {
  it("boost with negative velocity components", () => {
    const result = computePierceBoost(-10, -5, BOOST_FACTOR);
    expect(result.vx).toBeCloseTo(-10 * BOOST_FACTOR);
    expect(result.vy).toBeCloseTo(-5 * BOOST_FACTOR);
  });

  it("very small velocity gets boosted proportionally", () => {
    const result = computePierceBoost(0.001, 0, BOOST_FACTOR);
    expect(result.vx).toBeCloseTo(0.001 * BOOST_FACTOR);
  });

  it("very large velocity scales correctly", () => {
    const result = computePierceBoost(1000, 1000, BOOST_FACTOR);
    expect(result.vx).toBeCloseTo(1000 * BOOST_FACTOR);
    expect(result.vy).toBeCloseTo(1000 * BOOST_FACTOR);
  });

  it("post-pierce with upward velocity preserves direction", () => {
    const result = computePostPierceVelocity(0, 20, 10, POST_PIERCE_SPEED_FACTOR);
    expect(result.vx).toBeCloseTo(0);
    expect(result.vy).toBeGreaterThan(0);
    const resultSpeed = Math.sqrt(result.vx ** 2 + result.vy ** 2);
    expect(resultSpeed).toBeCloseTo(10 * POST_PIERCE_SPEED_FACTOR);
  });
});

describe("Swiss KE comparison with Cheddar", () => {
  it("Swiss post-pierce KE is lower than original Cheddar KE", () => {
    const prePierceSpeed = 30;
    const massCheddar = 2.0 * Math.PI * 0.4 ** 2;
    const massSwiss = 1.8 * Math.PI * 0.35 ** 2;

    const cheddarKE = 0.5 * massCheddar * prePierceSpeed ** 2;

    const postPierceSpeed = prePierceSpeed * POST_PIERCE_SPEED_FACTOR;
    const swissPostKE = 0.5 * massSwiss * postPierceSpeed ** 2;

    expect(swissPostKE).toBeLessThan(cheddarKE);
  });

  it("Swiss pre-boost KE is similar to Cheddar (different radius/density)", () => {
    const speed = 30;
    const massCheddar = 2.0 * Math.PI * 0.4 ** 2;
    const massSwiss = 1.8 * Math.PI * 0.35 ** 2;

    const cheddarKE = 0.5 * massCheddar * speed ** 2;
    const swissKE = 0.5 * massSwiss * speed ** 2;

    // Swiss lighter — expect lower KE at same speed
    expect(swissKE).toBeLessThan(cheddarKE);
    expect(swissKE / cheddarKE).toBeGreaterThan(0.5);
  });
});
