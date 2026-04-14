import { describe, it, expect } from "vitest";
import {
  computeBandControlPoint,
  interpolateBandColor,
  computeBandThickness,
  sampleBezier,
} from "../bandMath.js";

describe("computeBandControlPoint", () => {
  it("places control point at midpoint with full sag when pullRatio is 0", () => {
    const cp = computeBandControlPoint(0, 0, 100, 0, 30, 0);
    expect(cp.x).toBe(50);
    expect(cp.y).toBe(30); // midY (0) + sagMax (30) * (1 - 0)
  });

  it("reduces sag when pull ratio increases", () => {
    const cp0 = computeBandControlPoint(0, 0, 100, 0, 30, 0);
    const cp1 = computeBandControlPoint(0, 0, 100, 0, 30, 1);
    // At pullRatio=1, sag = 30 * (1 - 0.85) = 4.5
    expect(cp1.y).toBeLessThan(cp0.y);
    expect(cp1.y).toBeCloseTo(4.5);
  });

  it("places control point at midpoint between from and to", () => {
    const cp = computeBandControlPoint(20, 40, 80, 40, 10, 0.5);
    expect(cp.x).toBe(50); // midpoint x
  });

  it("handles vertical from-to line", () => {
    const cp = computeBandControlPoint(50, 10, 50, 90, 20, 0);
    expect(cp.x).toBe(50);
    expect(cp.y).toBe(50 + 20); // midY=50 + sag=20
  });

  it("handles zero sag", () => {
    const cp = computeBandControlPoint(0, 0, 100, 0, 0, 0);
    expect(cp.x).toBe(50);
    expect(cp.y).toBe(0); // no sag
  });
});

describe("interpolateBandColor", () => {
  it("returns relaxed color at pullRatio 0", () => {
    const color = interpolateBandColor(0, 0x8b5e3c, 0xff4400);
    expect(color).toBe(0x8b5e3c);
  });

  it("returns stretched color at pullRatio 1", () => {
    const color = interpolateBandColor(1, 0x8b5e3c, 0xff4400);
    expect(color).toBe(0xff4400);
  });

  it("blends colors at pullRatio 0.5", () => {
    const color = interpolateBandColor(0.5, 0x000000, 0xffffff);
    // Each channel: 0 + (255 - 0) * 0.5 = 127.5, rounded to 128
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    expect(r).toBe(128);
    expect(g).toBe(128);
    expect(b).toBe(128);
  });

  it("clamps pullRatio below 0", () => {
    const color = interpolateBandColor(-0.5, 0x8b5e3c, 0xff4400);
    expect(color).toBe(0x8b5e3c);
  });

  it("clamps pullRatio above 1", () => {
    const color = interpolateBandColor(1.5, 0x8b5e3c, 0xff4400);
    expect(color).toBe(0xff4400);
  });

  it("handles same color for both endpoints", () => {
    const color = interpolateBandColor(0.5, 0xaabbcc, 0xaabbcc);
    expect(color).toBe(0xaabbcc);
  });
});

describe("computeBandThickness", () => {
  it("returns min thickness at pullRatio 0", () => {
    const t = computeBandThickness(0, 2, 6);
    expect(t).toBe(2);
  });

  it("returns max thickness at pullRatio 1", () => {
    const t = computeBandThickness(1, 2, 6);
    expect(t).toBe(6);
  });

  it("interpolates linearly at pullRatio 0.5", () => {
    const t = computeBandThickness(0.5, 2, 6);
    expect(t).toBe(4);
  });

  it("clamps pullRatio below 0", () => {
    const t = computeBandThickness(-1, 2, 6);
    expect(t).toBe(2);
  });

  it("clamps pullRatio above 1", () => {
    const t = computeBandThickness(2, 2, 6);
    expect(t).toBe(6);
  });
});

describe("sampleBezier", () => {
  it("returns correct number of points (segments + 1)", () => {
    const points = sampleBezier(0, 0, 50, 50, 100, 0, 10);
    expect(points.length).toBe(11);
  });

  it("first point is the from position", () => {
    const points = sampleBezier(10, 20, 50, 50, 90, 30, 5);
    expect(points[0]!.x).toBeCloseTo(10);
    expect(points[0]!.y).toBeCloseTo(20);
  });

  it("last point is the to position", () => {
    const points = sampleBezier(10, 20, 50, 50, 90, 30, 5);
    const last = points[points.length - 1]!;
    expect(last.x).toBeCloseTo(90);
    expect(last.y).toBeCloseTo(30);
  });

  it("midpoint is influenced by control point", () => {
    // Straight line: control point on the line
    const straight = sampleBezier(0, 0, 50, 0, 100, 0, 4);
    const straightMid = straight[2]!; // t = 0.5
    expect(straightMid.y).toBeCloseTo(0);

    // Curved: control point offset
    const curved = sampleBezier(0, 0, 50, 100, 100, 0, 4);
    const curvedMid = curved[2]!; // t = 0.5
    // At t=0.5: y = 0.25*0 + 0.5*100 + 0.25*0 = 50
    expect(curvedMid.y).toBeCloseTo(50);
  });

  it("produces correct quadratic bezier values", () => {
    // B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 50, y: 100 };
    const p2 = { x: 100, y: 0 };
    const points = sampleBezier(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, 4);

    // t = 0.25
    const t = 0.25;
    const mt = 0.75;
    const expectedX = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const expectedY = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    expect(points[1]!.x).toBeCloseTo(expectedX);
    expect(points[1]!.y).toBeCloseTo(expectedY);
  });

  it("handles single segment (2 points)", () => {
    const points = sampleBezier(0, 0, 50, 50, 100, 0, 1);
    expect(points.length).toBe(2);
    expect(points[0]!.x).toBe(0);
    expect(points[1]!.x).toBe(100);
  });
});
