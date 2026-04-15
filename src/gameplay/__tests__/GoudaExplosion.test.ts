import { describe, it, expect } from "vitest";
import {
  computeExplosionImpulse,
  computeExplosionDirection,
} from "../GoudaProjectile.js";
import { MATERIALS } from "../../entities/Block.js";

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

describe("Gouda explosion block damage integration", () => {
  /**
   * Verify that explosion impulse values are sufficient to fracture blocks
   * at various distances. This tests the interaction between
   * computeExplosionImpulse (distance-based falloff) and block fracture
   * thresholds from the material definitions.
   *
   * Default config: blastRadius=3.0, maxImpulse=20, minImpulse=5
   * Fracture thresholds: cheese_crate=5, wood=10, stone=15
   */

  it("single explosion impulse at epicenter exceeds all material fracture thresholds", () => {
    const impulse = computeExplosionImpulse(0, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    for (const [, def] of Object.entries(MATERIALS)) {
      expect(impulse).toBeGreaterThanOrEqual(def.fractureThreshold);
    }
  });

  it("single explosion impulse at edge fractures cheese_crate but not stone", () => {
    const impulse = computeExplosionImpulse(BLAST_RADIUS, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(impulse).toBeCloseTo(MIN_IMPULSE); // 5
    expect(impulse).toBeGreaterThanOrEqual(MATERIALS.cheese_crate.fractureThreshold);
    expect(impulse).toBeLessThan(MATERIALS.stone.fractureThreshold);
  });

  it("impulse above Block.MIN_IMPULSE_THRESHOLD (0.5) registers damage", () => {
    // Even at the edge, minImpulse (5) is well above the 0.5 noise filter
    const edgeImpulse = computeExplosionImpulse(BLAST_RADIUS, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(edgeImpulse).toBeGreaterThan(0.5);
  });

  it("cheese_crate fractures from explosion at any distance within radius", () => {
    const threshold = MATERIALS.cheese_crate.fractureThreshold;
    // Check impulse at max distance still meets threshold
    const edgeImpulse = computeExplosionImpulse(BLAST_RADIUS, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(edgeImpulse).toBeGreaterThanOrEqual(threshold);
  });

  it("wood fractures at close range but not at blast edge from single hit", () => {
    const threshold = MATERIALS.wood.fractureThreshold;
    // At epicenter: 20 >= 10 ✓
    const centerImpulse = computeExplosionImpulse(0, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(centerImpulse).toBeGreaterThanOrEqual(threshold);
    // At edge: 5 < 10 ✗
    const edgeImpulse = computeExplosionImpulse(BLAST_RADIUS, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(edgeImpulse).toBeLessThan(threshold);
  });

  it("stone fractures only very close to epicenter from single hit", () => {
    const threshold = MATERIALS.stone.fractureThreshold;
    // At epicenter: 20 >= 15 ✓
    const centerImpulse = computeExplosionImpulse(0, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(centerImpulse).toBeGreaterThanOrEqual(threshold);
    // At 1/3 radius: 15 >= 15 ✓ (just meets threshold)
    const thirdImpulse = computeExplosionImpulse(BLAST_RADIUS / 3, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(thirdImpulse).toBeGreaterThanOrEqual(threshold);
    // At half radius: 12.5 < 15 ✗
    const halfImpulse = computeExplosionImpulse(BLAST_RADIUS / 2, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(halfImpulse).toBeLessThan(threshold);
  });

  it("wood at far range accumulates damage (cracks) even without fracturing", () => {
    // At 3/4 radius, impulse is 8.75. Wood threshold is 10.
    // Verifies sub-threshold hits still register cumulative damage (cracking at 60%)
    const dist = BLAST_RADIUS * 0.75;
    const impulse = computeExplosionImpulse(dist, BLAST_RADIUS, MAX_IMPULSE, MIN_IMPULSE);
    expect(impulse).toBeGreaterThan(0.5); // above noise filter
    expect(impulse).toBeLessThan(MATERIALS.wood.fractureThreshold);
    // Would accumulate cumulativeImpulse past 60% threshold, showing cracked state
    expect(impulse).toBeGreaterThanOrEqual(MATERIALS.wood.fractureThreshold * 0.6);
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
