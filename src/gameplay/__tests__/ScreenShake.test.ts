import { describe, it, expect, beforeEach } from "vitest";
import { ScreenShake } from "../ScreenShake.js";

/** Minimal mock for pixi Container */
function mockStage() {
  return { x: 0, y: 0 } as { x: number; y: number };
}

const TEST_CONFIG = {
  amplitudeHeavy: 8,
  amplitudeRatKill: 4,
  duration: 0.3,
  frequency: 12,
  impulseThreshold: 5,
};

describe("ScreenShake", () => {
  let stage: ReturnType<typeof mockStage>;
  let shake: ScreenShake;

  beforeEach(() => {
    stage = mockStage();
    shake = new ScreenShake(stage as any, TEST_CONFIG);
  });

  it("should reset stage position when inactive", () => {
    // Set stage to some non-zero offset (simulating camera pan)
    stage.x = 50;
    stage.y = 30;

    // update while inactive should zero out stage
    shake.update(0.016);

    expect(stage.x).toBe(0);
    expect(stage.y).toBe(0);
  });

  it("should apply offset when active", () => {
    shake.trigger();
    shake.update(0.016);

    // During shake, stage should have non-zero offset
    expect(stage.x !== 0 || stage.y !== 0).toBe(true);
  });

  it("should reset stage when shake finishes", () => {
    shake.trigger();
    // Advance past full duration
    shake.update(TEST_CONFIG.duration + 0.01);

    expect(stage.x).toBe(0);
    expect(stage.y).toBe(0);
  });

  it("should allow camera offset compositing after inactive update", () => {
    // Simulate the main.ts pattern: shake.update() zeros stage, then += cameraOffset
    stage.x = 999; // stale value from prior frame
    shake.update(0.016); // inactive → resets to 0
    stage.x += -144; // camera pan offset applied after

    expect(stage.x).toBe(-144);
  });

  it("should not accumulate offset across frames when inactive", () => {
    const cameraOffset = -144;

    // Simulate multiple frames
    for (let i = 0; i < 60; i++) {
      shake.update(0.016);
      stage.x += cameraOffset;
    }

    // Should be exactly one frame's camera offset, not accumulated
    // Each frame: shake resets to 0, then += -144, so always -144
    expect(stage.x).toBe(-144);
  });

  it("should not trigger from impulse below threshold", () => {
    shake.triggerFromImpulse(TEST_CONFIG.impulseThreshold - 1);
    shake.update(0.016);

    // Should be inactive → stage reset to 0
    expect(stage.x).toBe(0);
    expect(stage.y).toBe(0);
  });

  it("should trigger from impulse at or above threshold", () => {
    shake.triggerFromImpulse(TEST_CONFIG.impulseThreshold);
    shake.update(0.016);

    expect(stage.x !== 0 || stage.y !== 0).toBe(true);
  });

  it("should take stronger amplitude when already shaking", () => {
    shake.trigger(2);
    shake.update(0.001);
    const weakOffset = Math.abs(stage.x) + Math.abs(stage.y);

    // Reset and trigger with stronger
    shake.trigger(TEST_CONFIG.amplitudeHeavy);
    shake.update(0.001);
    const strongOffset = Math.abs(stage.x) + Math.abs(stage.y);

    expect(strongOffset).toBeGreaterThanOrEqual(weakOffset);
  });
});
