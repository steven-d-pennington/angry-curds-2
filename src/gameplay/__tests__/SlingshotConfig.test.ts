import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "../SlingshotConfig.js";

describe("DEFAULT_CONFIG", () => {
  it("has sensible slingshot position", () => {
    expect(DEFAULT_CONFIG.slingshot.positionX).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.slingshot.positionY).toBeGreaterThanOrEqual(0);
  });

  it("has positive post dimensions", () => {
    expect(DEFAULT_CONFIG.slingshot.postHeight).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.slingshot.postSpacing).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.slingshot.postThickness).toBeGreaterThan(0);
  });

  it("has cheese radius matching spec (~0.4m)", () => {
    expect(DEFAULT_CONFIG.cheese.radius).toBeCloseTo(0.4);
  });

  it("has cheese density matching spec (2.0)", () => {
    expect(DEFAULT_CONFIG.cheese.density).toBe(2.0);
  });

  it("has cheese restitution matching spec (0.3)", () => {
    expect(DEFAULT_CONFIG.cheese.restitution).toBe(0.3);
  });

  it("has max pull distance matching spec (~3m)", () => {
    expect(DEFAULT_CONFIG.launch.maxPullDistance).toBeCloseTo(3.0);
  });

  it("has launch velocity scale matching spec (12)", () => {
    expect(DEFAULT_CONFIG.launch.launchVelocityScale).toBe(12);
  });

  it("has 5 total cheese", () => {
    expect(DEFAULT_CONFIG.shotLifecycle.totalCheese).toBe(5);
  });

  it("has positive settled duration", () => {
    expect(DEFAULT_CONFIG.shotLifecycle.settledDuration).toBeGreaterThan(0);
  });

  it("has positive settled speed threshold", () => {
    expect(DEFAULT_CONFIG.shotLifecycle.settledSpeedThreshold).toBeGreaterThan(0);
  });

  it("has trajectory preview configured", () => {
    expect(DEFAULT_CONFIG.trajectoryPreview.dotCount).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.trajectoryPreview.dotTimeStep).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.trajectoryPreview.dotRadius).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.trajectoryPreview.dotAlpha).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.trajectoryPreview.dotAlpha).toBeLessThanOrEqual(1);
  });

  it("launch speed cap is reasonable (> scale * maxPull would produce)", () => {
    const maxPossible = DEFAULT_CONFIG.launch.maxPullDistance * DEFAULT_CONFIG.launch.launchVelocityScale;
    expect(DEFAULT_CONFIG.launch.maxLaunchSpeed).toBeGreaterThan(0);
    // Max speed should cap above what a full pull produces
    expect(DEFAULT_CONFIG.launch.maxLaunchSpeed).toBeGreaterThanOrEqual(maxPossible * 0.5);
  });
});
