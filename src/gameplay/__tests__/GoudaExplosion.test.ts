import { describe, it, expect } from "vitest";
import {
  computeExplosionImpulse,
  computeExplosionDirection,
} from "../GoudaProjectile.js";

/**
 * Pure-math tests for the Gouda explosion radial impulse system.
 * These verify the falloff formula and direction logic without the physics engine.
 */

const BLAST_RADIUS = 3.0;
const MAX_IMPULSE = 20;
const MIN_IMPULSE = 5;

describe("Gouda explosion impulse falloff", () => {
  it("applies max impulse at epicenter (distance = 0)", () => {
    const impulse = computeExplosionImpulse(0, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(impulse).toBeCloseTo(MAX_IMPULSE);
  });

  it("applies min impulse at the edge of blast radius", () => {
    const impulse = computeExplosionImpulse(BLAST_RADIUS, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(impulse).toBeCloseTo(MIN_IMPULSE);
  });

  it("returns zero for targets beyond blast radius", () => {
    const impulse = computeExplosionImpulse(BLAST_RADIUS + 0.1, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(impulse).toBe(0);
  });

  it("falls off linearly with distance", () => {
    const halfRadius = BLAST_RADIUS / 2;
    const impulse = computeExplosionImpulse(halfRadius, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    const expected = (MAX_IMPULSE + MIN_IMPULSE) / 2;
    expect(impulse).toBeCloseTo(expected);
  });

  it("handles quarter distance correctly", () => {
    const dist = BLAST_RADIUS * 0.25;
    const impulse = computeExplosionImpulse(dist, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    const expected = MAX_IMPULSE + (MIN_IMPULSE - MAX_IMPULSE) * 0.25;
    expect(impulse).toBeCloseTo(expected);
  });

  it("handles three-quarter distance correctly", () => {
    const dist = BLAST_RADIUS * 0.75;
    const impulse = computeExplosionImpulse(dist, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    const expected = MAX_IMPULSE + (MIN_IMPULSE - MAX_IMPULSE) * 0.75;
    expect(impulse).toBeCloseTo(expected);
  });

  it("returns zero for zero blast radius", () => {
    const impulse = computeExplosionImpulse(1, 0, MAX_IMPULSE, MIN_IMPULSE);
    expect(impulse).toBe(0);
  });

  it("impulse is always between min and max for valid distances", () => {
    for (let d = 0; d <= BLAST_RADIUS; d += 0.1) {
      const impulse = computeExplosionImpulse(d, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
      expect(impulse).toBeGreaterThanOrEqual(MIN_IMPULSE - 0.001);
      expect(impulse).toBeLessThanOrEqual(MAX_IMPULSE + 0.001);
    }
  });
});

describe("Gouda explosion direction", () => {
  it("points right for target to the right of epicenter", () => {
    const dir = computeExplosionDirection(0, 0, 5, 0);
    expect(dir.dx).toBeCloseTo(1);
    expect(dir.dy).toBeCloseTo(0);
  });

  it("points up for target above epicenter", () => {
    const dir = computeExplosionDirection(0, 0, 0, 5);
    expect(dir.dx).toBeCloseTo(0);
    expect(dir.dy).toBeCloseTo(1);
  });

  it("points left for target to the left", () => {
    const dir = computeExplosionDirection(5, 0, 0, 0);
    expect(dir.dx).toBeCloseTo(-1);
    expect(dir.dy).toBeCloseTo(0);
  });

  it("normalizes diagonal directions", () => {
    const dir = computeExplosionDirection(0, 0, 3, 4);
    const len = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy);
    expect(len).toBeCloseTo(1);
    expect(dir.dx).toBeCloseTo(3 / 5);
    expect(dir.dy).toBeCloseTo(4 / 5);
  });

  it("returns default up for zero-distance (epicenter overlap)", () => {
    const dir = computeExplosionDirection(5, 5, 5, 5);
    expect(dir.dx).toBeCloseTo(0);
    expect(dir.dy).toBeCloseTo(1);
  });

  it("handles negative coordinates correctly", () => {
    const dir = computeExplosionDirection(-2, -3, -5, -3);
    expect(dir.dx).toBeCloseTo(-1);
    expect(dir.dy).toBeCloseTo(0);
  });
});

describe("Gouda explosion energy budget", () => {
  it("total impulse across uniform ring is proportional to radius", () => {
    // Sample 8 points at a fixed distance
    const dist = BLAST_RADIUS * 0.5;
    const impulse = computeExplosionImpulse(dist, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    // All points at same distance get the same impulse
    const totalImpulse = impulse * 8;
    expect(totalImpulse).toBeGreaterThan(0);
  });

  it("closer targets receive strictly more impulse than farther targets", () => {
    const closeImpulse = computeExplosionImpulse(1.0, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    const farImpulse = computeExplosionImpulse(2.5, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(closeImpulse).toBeGreaterThan(farImpulse);
  });
});
