#!/usr/bin/env node
/**
 * Generates polished sprite sheet PNGs and TexturePacker JSON-hash manifests.
 * Produces hand-painted-style sprites matching the art bible specifications:
 *   - Warm brown outlines (#3B2510), 2-3px thick
 *   - Painted highlights and soft shadows
 *   - Cheddar: cheese wedge with face, holes, expressions
 *   - Rat: angular body with pointed ears, beady red eyes
 *   - Wood: grain texture, warm tones
 *   - Copper slingshot, textured ground
 *
 * Usage: node scripts/generate-placeholder-sprites.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const assetsDir = join(root, "public", "assets");

mkdirSync(join(assetsDir, "sprites"), { recursive: true });
mkdirSync(join(assetsDir, "environment"), { recursive: true });

// ═══════════════════════════════════════════════════════════════════
// Art Bible Colors
// ═══════════════════════════════════════════════════════════════════
const C = {
  // Outlines
  warmBrown:    [0x3B, 0x25, 0x10],
  coolDark:     [0x2E, 0x2E, 0x3A],
  // Cheese
  cheddarGold:  [0xF5, 0xA6, 0x23],
  cheeseHi:     [0xFF, 0xD7, 0x6E],
  agedCheddar:  [0xC4, 0x7B, 0x12],
  cheeseRind:   [0x8B, 0x5A, 0x0B],
  cream:        [0xFF, 0xF4, 0xD6],
  // Rat
  steelGray:    [0x6B, 0x6B, 0x7B],
  moonlight:    [0x98, 0x98, 0xA8],
  shadowFur:    [0x42, 0x42, 0x4E],
  midnight:     [0x2E, 0x2E, 0x3A],
  ratRed:       [0xE5, 0x22, 0x22],
  ratRedHi:     [0xFF, 0x66, 0x66],
  earPink:      [0xA8, 0x55, 0x55],
  bellyPatch:   [0x88, 0x88, 0xA0],
  // Wood
  agedOak:      [0xB8, 0x84, 0x5A],
  cellarWood:   [0x8B, 0x5E, 0x3C],
  darkTimber:   [0x5C, 0x3A, 0x1E],
  // Environment
  copper:       [0xA8, 0x7D, 0x4E],
  copperHi:     [0xD4, 0xA8, 0x62],
  copperDark:   [0x7A, 0x58, 0x32],
  cellarMoss:   [0x5A, 0x8C, 0x47],
  mossHi:       [0x72, 0xA8, 0x5C],
  mossDark:     [0x42, 0x6E, 0x32],
  earthBrown:   [0x6B, 0x50, 0x40],
  earthDark:    [0x4A, 0x3D, 0x30],
  // VFX
  scoreGold:    [0xFF, 0xEE, 0x44],
  sparkOrange:  [0xFF, 0xB8, 0x33],
  dust:         [0xC8, 0xB8, 0x98],
  dustLight:    [0xE0, 0xD4, 0xB8],
  // Stone
  warmLimestone:[0xA8, 0x98, 0x80],
  cellarStone:  [0x7A, 0x6B, 0x58],
  deepStone:    [0x4A, 0x3D, 0x30],
  flagstone:    [0x6B, 0x5D, 0x4F],
};

// ═══════════════════════════════════════════════════════════════════
// PixelBuffer — Drawing Primitives
// ═══════════════════════════════════════════════════════════════════
class PixelBuffer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4); // RGBA, all zeros (transparent)
  }

  idx(x, y) { return (y * this.w + x) * 4; }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = this.idx(x, y);
    if (a >= 255) {
      this.data[i] = r; this.data[i+1] = g; this.data[i+2] = b; this.data[i+3] = 255;
    } else if (a > 0) {
      const sa = a / 255;
      const da = this.data[i+3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa > 0) {
        this.data[i]   = Math.round((r * sa + this.data[i]   * da * (1 - sa)) / oa);
        this.data[i+1] = Math.round((g * sa + this.data[i+1] * da * (1 - sa)) / oa);
        this.data[i+2] = Math.round((b * sa + this.data[i+2] * da * (1 - sa)) / oa);
        this.data[i+3] = Math.round(oa * 255);
      }
    }
  }

  fillRect(x1, y1, w, h, r, g, b, a = 255) {
    for (let y = y1; y < y1 + h; y++)
      for (let x = x1; x < x1 + w; x++)
        this.setPixel(x, y, r, g, b, a);
  }

  fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
      for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) {
          this.setPixel(x, y, r, g, b, a);
        } else if (d2 <= (radius + 1) * (radius + 1)) {
          // Anti-alias edge
          const edge = Math.sqrt(d2) - radius;
          if (edge < 1) {
            const aa = Math.round(a * (1 - edge));
            this.setPixel(x, y, r, g, b, aa);
          }
        }
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const d2 = dx * dx + dy * dy;
        if (d2 <= 1.0) {
          this.setPixel(x, y, r, g, b, a);
        } else if (d2 <= 1.15) {
          const edge = (Math.sqrt(d2) - 1.0) / 0.15;
          this.setPixel(x, y, r, g, b, Math.round(a * (1 - edge)));
        }
      }
    }
  }

  strokeCircle(cx, cy, radius, thickness, r, g, b, a = 255) {
    const outer = radius + thickness / 2;
    const inner = radius - thickness / 2;
    for (let y = Math.floor(cy - outer - 1); y <= Math.ceil(cy + outer + 1); y++) {
      for (let x = Math.floor(cx - outer - 1); x <= Math.ceil(cx + outer + 1); x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist >= inner && dist <= outer) {
          this.setPixel(x, y, r, g, b, a);
        } else if (dist > outer && dist < outer + 1) {
          this.setPixel(x, y, r, g, b, Math.round(a * (1 - (dist - outer))));
        } else if (dist < inner && dist > inner - 1) {
          this.setPixel(x, y, r, g, b, Math.round(a * (1 - (inner - dist))));
        }
      }
    }
  }

  drawLine(x0, y0, x1, y1, r, g, b, a = 255, thickness = 1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) { this.setPixel(x0, y0, r, g, b, a); return; }
    const steps = Math.max(Math.ceil(len * 2), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      if (thickness <= 1) {
        this.setPixel(Math.round(px), Math.round(py), r, g, b, a);
      } else {
        this.fillCircle(px, py, thickness / 2, r, g, b, a);
      }
    }
  }

  // Vertical gradient fill within a rectangle
  gradientRectV(x1, y1, w, h, c1, c2) {
    for (let y = 0; y < h; y++) {
      const t = h > 1 ? y / (h - 1) : 0;
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
      for (let x = x1; x < x1 + w; x++) {
        this.setPixel(x, y1 + y, r, g, b);
      }
    }
  }

  // Radial gradient circle fill
  gradientCircle(cx, cy, radius, cInner, cOuter) {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (d <= radius) {
          const t = d / radius;
          const r = Math.round(cInner[0] + (cOuter[0] - cInner[0]) * t);
          const g = Math.round(cInner[1] + (cOuter[1] - cInner[1]) * t);
          const b = Math.round(cInner[2] + (cOuter[2] - cInner[2]) * t);
          this.setPixel(x, y, r, g, b);
        }
      }
    }
  }

  // Fill a convex polygon defined by vertices [{x,y}, ...]
  fillPoly(verts, r, g, b, a = 255) {
    if (verts.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const v of verts) { minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = [];
      for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length;
        const v0 = verts[i], v1 = verts[j];
        if ((v0.y <= y && v1.y > y) || (v1.y <= y && v0.y > y)) {
          const t = (y - v0.y) / (v1.y - v0.y);
          xs.push(v0.x + t * (v1.x - v0.x));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i += 2) {
        for (let x = Math.floor(xs[i]); x <= Math.ceil(xs[i + 1]); x++) {
          this.setPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  // Stroke polygon outline
  strokePoly(verts, thickness, r, g, b, a = 255) {
    for (let i = 0; i < verts.length; i++) {
      const j = (i + 1) % verts.length;
      this.drawLine(verts[i].x, verts[i].y, verts[j].x, verts[j].y, r, g, b, a, thickness);
    }
  }

  // Fill a rounded rectangle
  fillRoundRect(x, y, w, h, radius, r, g, b, a = 255) {
    radius = Math.min(radius, Math.floor(w / 2), Math.floor(h / 2));
    // Center fill
    this.fillRect(x + radius, y, w - 2 * radius, h, r, g, b, a);
    // Left/right strips
    this.fillRect(x, y + radius, radius, h - 2 * radius, r, g, b, a);
    this.fillRect(x + w - radius, y + radius, radius, h - 2 * radius, r, g, b, a);
    // Corners
    const corners = [
      [x + radius, y + radius],
      [x + w - radius - 1, y + radius],
      [x + radius, y + h - radius - 1],
      [x + w - radius - 1, y + h - radius - 1],
    ];
    for (const [cx, cy] of corners) {
      this.fillCircle(cx, cy, radius, r, g, b, a);
    }
  }

  // Stroke rounded rectangle
  strokeRoundRect(x, y, w, h, radius, thickness, r, g, b, a = 255) {
    radius = Math.min(radius, Math.floor(w / 2), Math.floor(h / 2));
    const half = thickness / 2;
    // Top/bottom edges
    this.drawLine(x + radius, y, x + w - radius, y, r, g, b, a, thickness);
    this.drawLine(x + radius, y + h - 1, x + w - radius, y + h - 1, r, g, b, a, thickness);
    // Left/right edges
    this.drawLine(x, y + radius, x, y + h - radius, r, g, b, a, thickness);
    this.drawLine(x + w - 1, y + radius, x + w - 1, y + h - radius, r, g, b, a, thickness);
    // Corners (arcs approximated)
    const cornerCenters = [
      [x + radius, y + radius],
      [x + w - radius - 1, y + radius],
      [x + radius, y + h - radius - 1],
      [x + w - radius - 1, y + h - radius - 1],
    ];
    for (const [cx, cy] of cornerCenters) {
      this.strokeCircle(cx, cy, radius, thickness, r, g, b, a);
    }
  }

  // Fill triangle
  fillTriangle(x0, y0, x1, y1, x2, y2, r, g, b, a = 255) {
    this.fillPoly([{x: x0, y: y0}, {x: x1, y: y1}, {x: x2, y: y2}], r, g, b, a);
  }

  // Blit another PixelBuffer onto this one at (dx, dy)
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const si = src.idx(x, y);
        const a = src.data[si + 3];
        if (a > 0) {
          this.setPixel(dx + x, dy + y, src.data[si], src.data[si+1], src.data[si+2], a);
        }
      }
    }
  }

  // Noise texture overlay — adds subtle variation
  applyNoise(x, y, w, h, intensity = 15) {
    // Deterministic pseudo-random based on position
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const i = this.idx(px, py);
        if (px < 0 || px >= this.w || py < 0 || py >= this.h) continue;
        if (this.data[i + 3] === 0) continue;
        const noise = ((px * 7919 + py * 104729 + px * py * 13) % (intensity * 2)) - intensity;
        this.data[i]   = Math.max(0, Math.min(255, this.data[i]   + noise));
        this.data[i+1] = Math.max(0, Math.min(255, this.data[i+1] + noise));
        this.data[i+2] = Math.max(0, Math.min(255, this.data[i+2] + noise));
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// PNG Encoder
// ═══════════════════════════════════════════════════════════════════
function encodePNG(pb) {
  const { w, h, data } = pb;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? (0xedb88320 ^ (v >>> 1)) : v >>> 1;
      table[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, d) {
    const tb = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length, 0);
    const combined = Buffer.concat([tb, d]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, combined, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  const scanlineSize = 1 + w * 4;
  const rawData = Buffer.alloc(h * scanlineSize);
  for (let y = 0; y < h; y++) {
    const offset = y * scanlineSize;
    rawData[offset] = 0; // filter: none
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(rawData, offset + 1);
  }

  return Buffer.concat([
    signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rawData)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing Functions — CHEDDAR (Cheese Wedge Hero)
// ═══════════════════════════════════════════════════════════════════

function drawCheddarBase(pb, ox, oy, bodyColor = C.cheddarGold) {
  // Wedge shape: wider at bottom, pointed at top
  // Within 128x128 cell, centered with padding
  const cx = ox + 64, cy = oy + 64;

  // Wedge body — triangle with rounded points
  // Tip at top-center, wide base at bottom
  const tip = { x: cx, y: oy + 18 };
  const bl = { x: ox + 22, y: oy + 105 };
  const br = { x: ox + 106, y: oy + 105 };

  // Fill wedge body with gradient
  for (let y = tip.y; y <= bl.y; y++) {
    const t = (y - tip.y) / (bl.y - tip.y);
    // Interpolate width at this y
    const leftX = tip.x + (bl.x - tip.x) * t;
    const rightX = tip.x + (br.x - tip.x) * t;
    // Gradient: highlight at top-left, shadow at bottom-right
    for (let x = Math.floor(leftX); x <= Math.ceil(rightX); x++) {
      const xt = (x - leftX) / (rightX - leftX + 1);
      const yt = t;
      // Highlight bias toward top-left
      const highlightT = Math.max(0, 1 - (xt * 0.7 + yt * 0.8));
      const r = Math.round(bodyColor[0] + (C.cheeseHi[0] - bodyColor[0]) * highlightT * 0.5);
      const g = Math.round(bodyColor[1] + (C.cheeseHi[1] - bodyColor[1]) * highlightT * 0.5);
      const b = Math.round(bodyColor[2] + (C.cheeseHi[2] - bodyColor[2]) * highlightT * 0.5);
      pb.setPixel(x, y, r, g, b);
    }
  }

  // Shadow on bottom-right
  for (let y = Math.floor(bl.y - 20); y <= bl.y; y++) {
    const t = (y - tip.y) / (bl.y - tip.y);
    const leftX = tip.x + (bl.x - tip.x) * t;
    const rightX = tip.x + (br.x - tip.x) * t;
    for (let x = Math.floor(rightX - 15); x <= Math.ceil(rightX); x++) {
      if (x >= leftX) {
        const st = Math.min(1, (x - (rightX - 15)) / 15) * 0.4;
        pb.setPixel(x, y, ...C.agedCheddar, Math.round(st * 255));
      }
    }
  }

  // Rind edge — darker band along bottom
  for (let x = Math.floor(bl.x); x <= Math.ceil(br.x); x++) {
    for (let dy = 0; dy < 5; dy++) {
      const a = Math.round(200 * (1 - dy / 5));
      pb.setPixel(x, bl.y - dy, ...C.cheeseRind, a);
    }
  }

  // Cross-section sliver on left edge (cream color)
  for (let y = Math.floor(tip.y + 10); y < bl.y - 5; y++) {
    const t = (y - tip.y) / (bl.y - tip.y);
    const leftX = tip.x + (bl.x - tip.x) * t;
    for (let dx = 0; dx < 4; dx++) {
      const a = Math.round(180 * (1 - dx / 4));
      pb.setPixel(Math.floor(leftX) + dx, y, ...C.cream, a);
    }
  }

  // Cheese holes (3-4 elliptical holes)
  const holes = [
    { x: cx - 12, y: cy + 8, rx: 7, ry: 5 },
    { x: cx + 14, y: cy + 15, rx: 5, ry: 4 },
    { x: cx - 3, y: cy + 25, rx: 8, ry: 6 },
    { x: cx + 8, y: cy - 2, rx: 4, ry: 3 },
  ];
  for (const hole of holes) {
    pb.fillEllipse(hole.x, hole.y, hole.rx, hole.ry, ...C.agedCheddar);
    // Inner shadow on hole
    pb.fillEllipse(hole.x + 1, hole.y + 1, hole.rx - 2, hole.ry - 2, ...C.cheeseRind, 180);
  }

  // Warm brown outline (2-3px)
  const outVerts = [tip, br, bl];
  pb.strokePoly(outVerts, 3, ...C.warmBrown);

  // Subtle texture noise
  pb.applyNoise(ox + 20, oy + 18, 86, 90, 8);
}

function drawCheddarFace(pb, ox, oy, expression = "happy") {
  const cx = ox + 64, cy = oy + 55;

  // Eyes — large, oval, vertically oriented
  const eyeSpacing = 14;
  const eyeY = cy - 4;
  const leftEyeX = cx - eyeSpacing;
  const rightEyeX = cx + eyeSpacing;

  if (expression === "x_eyes" || expression === "defeated") {
    // X eyes
    for (const ex of [leftEyeX, rightEyeX]) {
      pb.drawLine(ex - 5, eyeY - 5, ex + 5, eyeY + 5, ...C.warmBrown, 255, 2);
      pb.drawLine(ex + 5, eyeY - 5, ex - 5, eyeY + 5, ...C.warmBrown, 255, 2);
    }
  } else if (expression === "spiral") {
    // Spiral/dizzy eyes
    for (const ex of [leftEyeX, rightEyeX]) {
      pb.strokeCircle(ex, eyeY, 5, 2, ...C.warmBrown);
      pb.strokeCircle(ex, eyeY, 2, 1.5, ...C.warmBrown);
    }
  } else if (expression === "closed") {
    // Squeezed shut
    for (const ex of [leftEyeX, rightEyeX]) {
      pb.drawLine(ex - 6, eyeY, ex + 6, eyeY, ...C.warmBrown, 255, 2);
      pb.drawLine(ex - 4, eyeY + 2, ex + 4, eyeY + 2, ...C.warmBrown, 255, 1);
    }
  } else if (expression === "sad") {
    // Droopy eyes
    for (const ex of [leftEyeX, rightEyeX]) {
      pb.fillEllipse(ex, eyeY + 2, 6, 5, ...C.cream);
      pb.fillCircle(ex, eyeY + 3, 3, ...C.warmBrown);
      // Droopy eyelid
      pb.drawLine(ex - 6, eyeY - 2, ex + 6, eyeY + 1, ...C.warmBrown, 255, 2);
    }
  } else if (expression === "sparkle") {
    // Big sparkly win eyes
    for (const ex of [leftEyeX, rightEyeX]) {
      pb.fillEllipse(ex, eyeY, 8, 7, ...C.cream);
      pb.fillCircle(ex, eyeY, 4, ...C.warmBrown);
      // Sparkle highlights
      pb.fillCircle(ex - 2, eyeY - 2, 2, 255, 255, 255);
      pb.fillCircle(ex + 3, eyeY + 1, 1, 255, 255, 255);
    }
  } else if (expression === "wide") {
    // Wide nervous eyes
    for (const ex of [leftEyeX, rightEyeX]) {
      pb.fillEllipse(ex, eyeY, 8, 7, ...C.cream);
      pb.fillCircle(ex, eyeY, 3, ...C.warmBrown);
      // Highlight
      pb.fillCircle(ex - 2, eyeY - 2, 1.5, 255, 255, 255);
    }
  } else {
    // Normal happy eyes
    for (const ex of [leftEyeX, rightEyeX]) {
      pb.fillEllipse(ex, eyeY, 6, 7, ...C.cream);
      pb.fillCircle(ex, eyeY, 3, ...C.warmBrown);
      // Highlight
      pb.fillCircle(ex - 2, eyeY - 2, 1.5, 255, 255, 255);
    }
  }

  // Mouth
  const mouthY = cy + 10;
  if (expression === "happy" || expression === "sparkle") {
    // Smile curve
    for (let dx = -8; dx <= 8; dx++) {
      const curve = Math.round(2 * Math.sin((dx + 8) / 16 * Math.PI));
      pb.setPixel(cx + dx, mouthY + curve, ...C.warmBrown);
      pb.setPixel(cx + dx, mouthY + curve + 1, ...C.warmBrown);
    }
  } else if (expression === "wide" || expression === "closed") {
    // Open mouth (scream/nervous)
    pb.fillEllipse(cx, mouthY + 2, 8, 6, ...C.warmBrown);
    pb.fillEllipse(cx, mouthY + 1, 5, 3, ...C.cheeseRind);
  } else if (expression === "sad" || expression === "defeated") {
    // Frown
    for (let dx = -8; dx <= 8; dx++) {
      const curve = -Math.round(2 * Math.sin((dx + 8) / 16 * Math.PI));
      pb.setPixel(cx + dx, mouthY + 3 + curve, ...C.warmBrown);
      pb.setPixel(cx + dx, mouthY + 4 + curve, ...C.warmBrown);
    }
  } else if (expression === "spiral") {
    // Tongue out
    pb.fillEllipse(cx, mouthY + 2, 6, 4, ...C.warmBrown);
    pb.fillEllipse(cx, mouthY + 6, 4, 4, 0xE0, 0x60, 0x60); // pink tongue
  } else {
    // Neutral
    pb.drawLine(cx - 6, mouthY, cx + 6, mouthY, ...C.warmBrown, 255, 2);
  }
}

function drawCheddar(pb, ox, oy, expression = "happy") {
  drawCheddarBase(pb, ox, oy);
  drawCheddarFace(pb, ox, oy, expression);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing Functions — RAT (Villain)
// ═══════════════════════════════════════════════════════════════════

function drawRatBase(pb, ox, oy, bodyColor = C.steelGray) {
  const cx = ox + 48, cy = oy + 70;

  // Body — pear-shaped: wider at bottom
  pb.fillEllipse(cx, cy + 10, 26, 22, ...bodyColor);
  // Belly patch
  pb.fillEllipse(cx, cy + 12, 16, 14, ...C.bellyPatch, 120);

  // Head — smaller circle on top
  pb.fillEllipse(cx, cy - 12, 20, 18, ...bodyColor);
  // Highlight on head top
  pb.fillEllipse(cx - 4, cy - 18, 10, 6, ...C.moonlight, 100);

  // Shadow on body underside
  pb.fillEllipse(cx, cy + 24, 22, 8, ...C.shadowFur, 140);

  // Ears — tall triangles
  const earH = 28;
  const earW = 14;
  // Left ear
  pb.fillTriangle(
    cx - 16, cy - 22,  // base left
    cx - 10, cy - 22,  // base right
    cx - 18, cy - 22 - earH, // tip
    ...bodyColor
  );
  pb.fillTriangle(
    cx - 15, cy - 23,
    cx - 11, cy - 23,
    cx - 17, cy - 23 - earH + 5,
    ...C.earPink, 200
  );
  // Right ear
  pb.fillTriangle(
    cx + 10, cy - 22,
    cx + 16, cy - 22,
    cx + 18, cy - 22 - earH,
    ...bodyColor
  );
  pb.fillTriangle(
    cx + 11, cy - 23,
    cx + 15, cy - 23,
    cx + 17, cy - 23 - earH + 5,
    ...C.earPink, 200
  );

  // Snout — pointed, protruding forward
  pb.fillTriangle(
    cx - 6, cy - 10,
    cx + 8, cy - 6,
    cx + 18, cy - 12,
    ...C.bellyPatch
  );
  // Nose at tip
  pb.fillCircle(cx + 17, cy - 12, 3, ...C.midnight);

  // Tail — curving upward from body right
  let tailX = cx + 22, tailY = cy + 15;
  for (let i = 0; i < 30; i++) {
    const t = i / 30;
    const tx = tailX + i * 0.8;
    const ty = tailY - i * 1.2 + Math.sin(t * Math.PI * 2) * 4;
    const thick = 2 - t * 1.5;
    pb.fillCircle(tx, ty, Math.max(0.5, thick), ...bodyColor);
  }

  // Feet — small stubs at bottom
  pb.fillEllipse(cx - 14, cy + 30, 6, 4, ...C.shadowFur);
  pb.fillEllipse(cx + 14, cy + 30, 6, 4, ...C.shadowFur);

  // Cool dark outline for key shapes
  // Head outline
  pb.strokeCircle(cx, cy - 12, 18, 2.5, ...C.coolDark);
  // Body outline
  pb.strokeCircle(cx, cy + 10, 22, 2.5, ...C.coolDark);
  // Ear outlines
  pb.strokePoly([
    {x: cx - 16, y: cy - 22}, {x: cx - 10, y: cy - 22}, {x: cx - 18, y: cy - 22 - earH}
  ], 2, ...C.coolDark);
  pb.strokePoly([
    {x: cx + 10, y: cy - 22}, {x: cx + 16, y: cy - 22}, {x: cx + 18, y: cy - 22 - earH}
  ], 2, ...C.coolDark);

  pb.applyNoise(ox, oy, 96, 128, 6);
}

function drawRatFace(pb, ox, oy, expression = "smug") {
  const cx = ox + 48, cy = oy + 58;

  // Eyes — small, beady, red
  const eyeSpacing = 10;
  const eyeY = cy - 2;

  if (expression === "x_eyes") {
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      pb.drawLine(ex - 3, eyeY - 3, ex + 3, eyeY + 3, ...C.ratRed, 255, 2);
      pb.drawLine(ex + 3, eyeY - 3, ex - 3, eyeY + 3, ...C.ratRed, 255, 2);
    }
  } else if (expression === "wide") {
    // Alert — fully open
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      pb.fillCircle(ex, eyeY, 4, ...C.ratRed);
      pb.fillCircle(ex + 1, eyeY - 1, 1.5, ...C.ratRedHi);
    }
  } else if (expression === "shut") {
    // Hit — squeezed shut
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      pb.drawLine(ex - 4, eyeY, ex + 4, eyeY, ...C.coolDark, 255, 2);
    }
  } else {
    // Normal/smug — half-lidded
    for (const ex of [cx - eyeSpacing, cx + eyeSpacing]) {
      pb.fillCircle(ex, eyeY, 3, ...C.ratRed);
      pb.fillCircle(ex + 1, eyeY - 1, 1, ...C.ratRedHi);
      // Half-lid line
      pb.drawLine(ex - 4, eyeY - 2, ex + 4, eyeY - 2, ...C.shadowFur, 255, 1.5);
    }
  }

  // Mouth (mostly hidden behind snout, only visible in some states)
  if (expression === "taunt") {
    // Tongue sticking out
    pb.fillEllipse(cx + 14, cy - 4, 4, 3, ...C.coolDark);
    pb.fillEllipse(cx + 16, cy - 2, 3, 4, 0xE0, 0x60, 0x60);
  } else if (expression === "x_eyes" || expression === "shut") {
    // Open mouth showing teeth
    pb.fillEllipse(cx + 14, cy - 4, 4, 3, ...C.coolDark);
    // Two front teeth
    pb.fillRect(cx + 12, cy - 5, 2, 4, ...C.cream);
    pb.fillRect(cx + 15, cy - 5, 2, 4, ...C.cream);
  }
}

function drawRat(pb, ox, oy, expression = "smug") {
  drawRatBase(pb, ox, oy);
  drawRatFace(pb, ox, oy, expression);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing — WOOD PLANKS
// ═══════════════════════════════════════════════════════════════════

function drawWoodPlank(pb, ox, oy, w, h, cracked = false) {
  const radius = Math.min(6, Math.floor(w / 4), Math.floor(h / 4));

  // Base wood fill with vertical gradient (lighter at top)
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(C.agedOak[0] + (C.cellarWood[0] - C.agedOak[0]) * t);
    const g = Math.round(C.agedOak[1] + (C.cellarWood[1] - C.agedOak[1]) * t);
    const b = Math.round(C.agedOak[2] + (C.cellarWood[2] - C.agedOak[2]) * t);
    for (let x = 0; x < w; x++) {
      // Only fill within rounded rect bounds
      const inCorner = (
        (x < radius && y < radius && (x - radius) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x >= w - radius && y < radius && (x - (w - radius - 1)) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x < radius && y >= h - radius && (x - radius) ** 2 + (y - (h - radius - 1)) ** 2 > radius ** 2) ||
        (x >= w - radius && y >= h - radius && (x - (w - radius - 1)) ** 2 + (y - (h - radius - 1)) ** 2 > radius ** 2)
      );
      if (!inCorner) {
        pb.setPixel(ox + x, oy + y, r, g, b);
      }
    }
  }

  // Wood grain lines (horizontal, slightly wavy)
  const grainCount = Math.max(3, Math.floor(h / 20));
  for (let i = 0; i < grainCount; i++) {
    const baseY = Math.round((i + 0.5) / grainCount * h);
    for (let x = 2; x < w - 2; x++) {
      const wave = Math.sin(x * 0.15 + i * 2.5) * 1.5;
      const gy = oy + baseY + Math.round(wave);
      pb.setPixel(ox + x, gy, ...C.darkTimber, 80);
      pb.setPixel(ox + x, gy + 1, ...C.darkTimber, 40);
    }
  }

  // Knot marks (1-2 per plank)
  const knots = Math.max(1, Math.floor(h / 150));
  for (let k = 0; k < knots; k++) {
    const kx = ox + 15 + ((k * 37 + 11) % (w - 30));
    const ky = oy + 30 + ((k * 73 + 23) % (h - 60));
    pb.fillEllipse(kx, ky, 5, 4, ...C.darkTimber, 120);
    pb.strokeCircle(kx, ky, 4, 1, ...C.darkTimber, 60);
    pb.strokeCircle(kx, ky, 7, 1, ...C.darkTimber, 30);
  }

  // Highlight on left edge
  for (let y = radius; y < h - radius; y++) {
    pb.setPixel(ox + 2, oy + y, ...C.agedOak, 120);
    pb.setPixel(ox + 3, oy + y, ...C.agedOak, 60);
  }

  // Crack lines for damaged variant
  if (cracked) {
    // Darken the overall tone
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = pb.idx(ox + x, oy + y);
        if (pb.data[i + 3] > 0) {
          pb.data[i]   = Math.max(0, pb.data[i] - 25);
          pb.data[i+1] = Math.max(0, pb.data[i+1] - 20);
          pb.data[i+2] = Math.max(0, pb.data[i+2] - 15);
        }
      }
    }
    // Diagonal crack
    const crackStartY = Math.round(h * 0.2);
    const crackEndY = Math.round(h * 0.8);
    let cx = w / 2;
    for (let y = crackStartY; y < crackEndY; y++) {
      cx += ((y * 13 + 7) % 5 - 2) * 0.8;
      cx = Math.max(5, Math.min(w - 5, cx));
      pb.setPixel(ox + Math.round(cx), oy + y, ...C.darkTimber);
      pb.setPixel(ox + Math.round(cx) + 1, oy + y, ...C.darkTimber, 180);
      pb.setPixel(ox + Math.round(cx) - 1, oy + y, ...C.darkTimber, 100);
    }
    // Branch crack
    let bx = cx;
    for (let y = Math.round(h * 0.5); y < Math.round(h * 0.65); y++) {
      bx += 1.2;
      pb.setPixel(ox + Math.round(bx), oy + y, ...C.darkTimber);
    }
  }

  // Outline (warm brown, 2px)
  pb.strokeRoundRect(ox, oy, w, h, radius, 2.5, ...C.warmBrown);

  // Subtle noise
  pb.applyNoise(ox, oy, w, h, 6);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing — CHEESE CRATES
// ═══════════════════════════════════════════════════════════════════

function drawCheeseCrate(pb, ox, oy, size, cracked = false) {
  const pad = 4;
  const innerSize = size - pad * 2;

  // Base fill with gradient
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const r = Math.round(C.cheeseHi[0] + (C.cheddarGold[0] - C.cheeseHi[0]) * t);
    const g = Math.round(C.cheeseHi[1] + (C.cheddarGold[1] - C.cheeseHi[1]) * t);
    const b = Math.round(C.cheeseHi[2] + (C.cheddarGold[2] - C.cheeseHi[2]) * t);
    for (let x = 0; x < size; x++) {
      pb.setPixel(ox + x, oy + y, r, g, b);
    }
  }

  // Crate slat lines (horizontal boards)
  const slats = 3;
  for (let s = 1; s < slats; s++) {
    const sy = Math.round(s / slats * size);
    pb.drawLine(ox + 2, oy + sy, ox + size - 2, oy + sy, ...C.agedCheddar, 200, 1.5);
  }

  // Cross brace (diagonal)
  pb.drawLine(ox + 4, oy + 4, ox + size - 4, oy + size - 4, ...C.agedCheddar, 120, 2);

  // Small cheese holes pattern
  const holeCount = size > 100 ? 5 : 3;
  for (let i = 0; i < holeCount; i++) {
    const hx = ox + 15 + ((i * 29 + 7) % (size - 30));
    const hy = oy + 15 + ((i * 41 + 13) % (size - 30));
    pb.fillCircle(hx, hy, 4, ...C.agedCheddar, 150);
    pb.fillCircle(hx + 1, hy + 1, 2, ...C.cheeseRind, 120);
  }

  // Shadow on right and bottom edges
  for (let y = 0; y < size; y++) {
    for (let dx = 0; dx < 4; dx++) {
      const a = Math.round(80 * (1 - dx / 4));
      pb.setPixel(ox + size - 1 - dx, oy + y, ...C.agedCheddar, a);
    }
  }
  for (let x = 0; x < size; x++) {
    for (let dy = 0; dy < 4; dy++) {
      const a = Math.round(80 * (1 - dy / 4));
      pb.setPixel(ox + x, oy + size - 1 - dy, ...C.agedCheddar, a);
    }
  }

  if (cracked) {
    // Darken tone
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = pb.idx(ox + x, oy + y);
        if (pb.data[i + 3] > 0) {
          pb.data[i]   = Math.max(0, pb.data[i] - 30);
          pb.data[i+1] = Math.max(0, pb.data[i+1] - 20);
          pb.data[i+2] = Math.max(0, pb.data[i+2] - 10);
        }
      }
    }
    // Crack lines
    let cx = size * 0.3;
    for (let y = 3; y < size - 3; y++) {
      cx += ((y * 17 + 11) % 5 - 2) * 0.6;
      pb.setPixel(ox + Math.round(cx), oy + y, ...C.cheeseRind);
      pb.setPixel(ox + Math.round(cx) + 1, oy + y, ...C.cheeseRind, 150);
    }
  }

  // Outline
  pb.strokeRoundRect(ox, oy, size, size, 4, 2.5, ...C.warmBrown);
  pb.applyNoise(ox, oy, size, size, 6);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing — SLINGSHOT
// ═══════════════════════════════════════════════════════════════════

function drawSlingshot(pb, ox, oy) {
  const cx = ox + 64, baseY = oy + 240;
  const forkY = oy + 60;

  // Main trunk (copper colored, slightly tapered)
  for (let y = forkY + 40; y < baseY; y++) {
    const t = (y - forkY - 40) / (baseY - forkY - 40);
    const halfW = Math.round(10 + t * 4); // widens toward base
    const r = Math.round(C.copper[0] + (C.copperDark[0] - C.copper[0]) * t * 0.5);
    const g = Math.round(C.copper[1] + (C.copperDark[1] - C.copper[1]) * t * 0.5);
    const b = Math.round(C.copper[2] + (C.copperDark[2] - C.copper[2]) * t * 0.5);
    for (let x = -halfW; x <= halfW; x++) {
      // Cylindrical highlight
      const xt = Math.abs(x) / halfW;
      const highlight = Math.max(0, 1 - xt * 2) * 0.4;
      const pr = Math.min(255, Math.round(r + (C.copperHi[0] - r) * highlight));
      const pg = Math.min(255, Math.round(g + (C.copperHi[1] - g) * highlight));
      const pbb = Math.min(255, Math.round(b + (C.copperHi[2] - b) * highlight));
      pb.setPixel(cx + x, y, pr, pg, pbb);
    }
  }

  // Left fork arm
  for (let t = 0; t <= 1; t += 0.005) {
    const x = cx - 8 - t * 28;
    const y = forkY + 40 - t * 40;
    const halfW = 7 - t * 2;
    for (let dx = -halfW; dx <= halfW; dx++) {
      const xt = Math.abs(dx) / halfW;
      const highlight = Math.max(0, 1 - xt * 2) * 0.3;
      const r = Math.round(C.copper[0] + (C.copperHi[0] - C.copper[0]) * highlight);
      const g = Math.round(C.copper[1] + (C.copperHi[1] - C.copper[1]) * highlight);
      const b = Math.round(C.copper[2] + (C.copperHi[2] - C.copper[2]) * highlight);
      pb.setPixel(Math.round(x + dx * 0.4), Math.round(y + dx * 0.7), r, g, b);
    }
  }

  // Right fork arm
  for (let t = 0; t <= 1; t += 0.005) {
    const x = cx + 8 + t * 28;
    const y = forkY + 40 - t * 40;
    const halfW = 7 - t * 2;
    for (let dx = -halfW; dx <= halfW; dx++) {
      const xt = Math.abs(dx) / halfW;
      const highlight = Math.max(0, 1 - xt * 2) * 0.3;
      const r = Math.round(C.copper[0] + (C.copperHi[0] - C.copper[0]) * highlight);
      const g = Math.round(C.copper[1] + (C.copperHi[1] - C.copper[1]) * highlight);
      const b = Math.round(C.copper[2] + (C.copperHi[2] - C.copper[2]) * highlight);
      pb.setPixel(Math.round(x + dx * 0.4), Math.round(y - dx * 0.7), r, g, b);
    }
  }

  // Fork tips — small rounded caps
  pb.fillCircle(cx - 36, forkY, 6, ...C.copper);
  pb.fillCircle(cx - 36, forkY, 3, ...C.copperHi, 120);
  pb.fillCircle(cx + 36, forkY, 6, ...C.copper);
  pb.fillCircle(cx + 36, forkY, 3, ...C.copperHi, 120);

  // Base plate
  pb.fillRoundRect(cx - 18, baseY - 8, 36, 16, 4, ...C.copperDark);
  pb.fillRoundRect(cx - 16, baseY - 6, 32, 6, 3, ...C.copperHi, 80);

  // Highlight streak down center of trunk
  for (let y = forkY + 45; y < baseY - 10; y++) {
    pb.setPixel(cx - 2, y, ...C.copperHi, 80);
    pb.setPixel(cx - 1, y, ...C.copperHi, 60);
  }

  // Outline key edges
  // Trunk sides
  for (let y = forkY + 40; y < baseY; y++) {
    const t = (y - forkY - 40) / (baseY - forkY - 40);
    const halfW = Math.round(10 + t * 4);
    pb.setPixel(cx - halfW - 1, y, ...C.warmBrown);
    pb.setPixel(cx + halfW + 1, y, ...C.warmBrown);
  }

  pb.applyNoise(ox, oy, 128, 256, 5);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing — GROUND
// ═══════════════════════════════════════════════════════════════════

function drawGroundSurface(pb, ox, oy, w, h) {
  // Grass layer — gradient from moss to darker
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(C.cellarMoss[0] + (C.mossDark[0] - C.cellarMoss[0]) * t);
    const g = Math.round(C.cellarMoss[1] + (C.mossDark[1] - C.cellarMoss[1]) * t);
    const b = Math.round(C.cellarMoss[2] + (C.mossDark[2] - C.cellarMoss[2]) * t);
    for (let x = 0; x < w; x++) {
      pb.setPixel(ox + x, oy + y, r, g, b);
    }
  }

  // Grass tufts along top edge
  for (let x = 0; x < w; x += 3) {
    const tuftH = 4 + ((x * 7 + 13) % 8);
    const lean = ((x * 11 + 3) % 5) - 2;
    for (let t = 0; t < tuftH; t++) {
      const ty = oy - t;
      const tx = ox + x + Math.round(lean * t / tuftH);
      const shade = 1 - t / tuftH * 0.3;
      pb.setPixel(tx, ty, Math.round(C.mossHi[0] * shade), Math.round(C.mossHi[1] * shade), Math.round(C.mossHi[2] * shade), Math.round(255 * (1 - t / tuftH * 0.3)));
    }
  }

  // Surface line at top
  pb.drawLine(ox, oy, ox + w, oy, ...C.mossDark, 255, 2);

  pb.applyNoise(ox, oy, w, h, 10);
}

function drawGroundDirt(pb, ox, oy, w, h) {
  // Dirt layers — gradient
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.round(C.earthBrown[0] + (C.earthDark[0] - C.earthBrown[0]) * t);
    const g = Math.round(C.earthBrown[1] + (C.earthDark[1] - C.earthBrown[1]) * t);
    const b = Math.round(C.earthBrown[2] + (C.earthDark[2] - C.earthBrown[2]) * t);
    for (let x = 0; x < w; x++) {
      pb.setPixel(ox + x, oy + y, r, g, b);
    }
  }

  // Rock/pebble specks
  for (let i = 0; i < 20; i++) {
    const rx = ox + ((i * 47 + 13) % w);
    const ry = oy + ((i * 31 + 7) % h);
    pb.fillCircle(rx, ry, 2 + (i % 3), ...C.deepStone, 100);
  }

  // Subtle horizontal strata lines
  for (let s = 0; s < 4; s++) {
    const sy = oy + Math.round((s + 0.5) / 4 * h);
    for (let x = 0; x < w; x++) {
      const wave = Math.sin(x * 0.08 + s * 1.7) * 2;
      pb.setPixel(ox + x, sy + Math.round(wave), ...C.earthDark, 60);
    }
  }

  pb.applyNoise(ox, oy, w, h, 12);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing — WOOD PLATFORM
// ═══════════════════════════════════════════════════════════════════

function drawWoodPlatform(pb, ox, oy, w, h, cracked = false) {
  // Draw as a set of horizontal boards
  const boardCount = 3;
  const boardH = Math.floor(h / boardCount);

  for (let i = 0; i < boardCount; i++) {
    const by = oy + i * boardH;
    const bh = (i === boardCount - 1) ? h - i * boardH : boardH;

    // Board fill with slight gradient
    for (let y = 0; y < bh; y++) {
      const t = y / bh;
      const shade = 0.9 + 0.1 * Math.sin(t * Math.PI);
      for (let x = 0; x < w; x++) {
        const r = Math.round(C.agedOak[0] * shade);
        const g = Math.round(C.agedOak[1] * shade);
        const b = Math.round(C.agedOak[2] * shade);
        pb.setPixel(ox + x, by + y, r, g, b);
      }
    }

    // Wood grain (horizontal wavy lines)
    for (let gi = 0; gi < 2; gi++) {
      const gy = by + Math.round((gi + 0.5) / 2 * bh);
      for (let x = 0; x < w; x++) {
        const wave = Math.sin(x * 0.1 + i * 3 + gi * 1.5) * 1;
        pb.setPixel(ox + x, gy + Math.round(wave), ...C.cellarWood, 80);
      }
    }

    // Board separation line
    if (i > 0) {
      pb.drawLine(ox, by, ox + w, by, ...C.darkTimber, 150, 1);
    }
  }

  if (cracked) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = pb.idx(ox + x, oy + y);
        if (pb.data[i + 3] > 0) {
          pb.data[i]   = Math.max(0, pb.data[i] - 30);
          pb.data[i+1] = Math.max(0, pb.data[i+1] - 25);
          pb.data[i+2] = Math.max(0, pb.data[i+2] - 15);
        }
      }
    }
    // Crack across
    let cx = 0;
    for (let x = 0; x < w; x++) {
      cx += ((x * 13 + 7) % 5 - 2) * 0.3;
      const cy = Math.round(h / 2 + cx);
      pb.setPixel(ox + x, oy + cy, ...C.darkTimber);
      pb.setPixel(ox + x, oy + cy + 1, ...C.darkTimber, 150);
    }
  }

  pb.strokeRoundRect(ox, oy, w, h, 3, 2, ...C.warmBrown);
  pb.applyNoise(ox, oy, w, h, 5);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing — VFX Particles
// ═══════════════════════════════════════════════════════════════════

function drawCheeseCrumb(pb, ox, oy, w, h) {
  const cx = ox + w / 2, cy = oy + h / 2;
  // Irregular cheese chunk
  const verts = [];
  const r = Math.min(w, h) / 2 - 1;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const rr = r * (0.6 + ((i * 17 + 5) % 10) / 25);
    verts.push({ x: cx + Math.cos(angle) * rr, y: cy + Math.sin(angle) * rr });
  }
  pb.fillPoly(verts, ...C.cheddarGold);
  pb.strokePoly(verts, 1, ...C.agedCheddar);
  // Small highlight
  pb.fillCircle(cx - 1, cy - 1, r * 0.3, ...C.cheeseHi, 150);
}

function drawDustPuff(pb, ox, oy, w, h, frame) {
  const cx = ox + w / 2, cy = oy + h / 2;
  const maxR = Math.min(w, h) / 2 - 2;
  const progress = frame / 3; // 0 to 1
  const radius = maxR * (0.4 + progress * 0.6);
  const alpha = Math.round(200 * (1 - progress * 0.6));
  pb.gradientCircle(cx, cy, radius, C.dustLight, C.dust);
  // Fade edges
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d > radius * 0.6 && d <= radius) {
        const i = pb.idx(x, y);
        if (x >= 0 && x < pb.w && y >= 0 && y < pb.h && pb.data[i+3] > 0) {
          const edgeFade = (d - radius * 0.6) / (radius * 0.4);
          pb.data[i+3] = Math.round(pb.data[i+3] * (1 - edgeFade * 0.7));
        }
      }
    }
  }
}

function drawImpactSpark(pb, ox, oy, w, h, frame) {
  const cx = ox + w / 2, cy = oy + h / 2;
  const r = Math.min(w, h) / 2 - 2;
  const colors = [C.sparkOrange, C.scoreGold, C.sparkOrange];
  const color = colors[frame] || C.sparkOrange;

  // 4-pointed star
  const points = 4;
  const innerR = r * 0.3;
  const outerR = r * (0.7 + frame * 0.15);
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 4;
    const nextAngle = ((i + 0.5) / points) * Math.PI * 2 - Math.PI / 4;
    const outerX = cx + Math.cos(angle) * outerR;
    const outerY = cy + Math.sin(angle) * outerR;
    const innerX = cx + Math.cos(nextAngle) * innerR;
    const innerY = cy + Math.sin(nextAngle) * innerR;
    pb.fillTriangle(cx, cy, outerX, outerY, innerX, innerY, ...color);
  }
  // Center glow
  pb.fillCircle(cx, cy, innerR + 1, 255, 255, 220, 200);
}

function drawWoodSplinter(pb, ox, oy, w, h) {
  // Thin angled shard
  const verts = [
    { x: ox + 1, y: oy + h / 2 - 1 },
    { x: ox + w - 1, y: oy },
    { x: ox + w, y: oy + h / 2 },
    { x: ox + w - 1, y: oy + h },
    { x: ox + 1, y: oy + h / 2 + 1 },
  ];
  pb.fillPoly(verts, ...C.cellarWood);
  // Grain line
  pb.drawLine(ox + 2, oy + Math.round(h / 2), ox + w - 2, oy + Math.round(h / 2), ...C.agedOak, 120, 1);
}

function drawStar(pb, ox, oy, w, h) {
  const cx = ox + w / 2, cy = oy + h / 2;
  const outerR = Math.min(w, h) / 2 - 1;
  const innerR = outerR * 0.35;
  const points = 4;
  const starVerts = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    starVerts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  pb.fillPoly(starVerts, ...C.scoreGold);
  pb.fillCircle(cx, cy, innerR, 255, 255, 240, 180);
}

// ═══════════════════════════════════════════════════════════════════
// Sprite Drawing — SLINGSHOT BAND
// ═══════════════════════════════════════════════════════════════════

function drawSlingshotBand(pb, ox, oy, w, h) {
  // Rubber band segment — warm brown with highlight
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const shade = 1 - Math.abs(t - 0.3) * 0.5;
    for (let x = 0; x < w; x++) {
      const r = Math.round(0x8B * shade);
      const g = Math.round(0x3E * shade);
      const b = Math.round(0x1C * shade);
      pb.setPixel(ox + x, oy + y, r, g, b);
    }
  }
  // Highlight stripe
  for (let x = 0; x < w; x++) {
    pb.setPixel(ox + x, oy + Math.round(h * 0.3), 0xB0, 0x60, 0x30, 100);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Environment Textures
// ═══════════════════════════════════════════════════════════════════

function drawCellarWall(w, h) {
  const pb = new PixelBuffer(w, h);
  // Stone wall with mortar lines
  for (let y = 0; y < h; y++) {
    const t = y / h;
    for (let x = 0; x < w; x++) {
      const r = Math.round(C.cellarStone[0] + (C.warmLimestone[0] - C.cellarStone[0]) * (1 - t) * 0.3);
      const g = Math.round(C.cellarStone[1] + (C.warmLimestone[1] - C.cellarStone[1]) * (1 - t) * 0.3);
      const b = Math.round(C.cellarStone[2] + (C.warmLimestone[2] - C.cellarStone[2]) * (1 - t) * 0.3);
      pb.setPixel(x, y, r, g, b);
    }
  }
  // Mortar grid
  const stoneH = 24;
  const stoneW = 40;
  for (let row = 0; row < Math.ceil(h / stoneH); row++) {
    const rowY = row * stoneH;
    const offset = (row % 2) * (stoneW / 2);
    pb.drawLine(0, rowY, w, rowY, ...C.deepStone, 100, 1);
    for (let col = 0; col <= Math.ceil(w / stoneW); col++) {
      const colX = col * stoneW + offset;
      pb.drawLine(colX, rowY, colX, rowY + stoneH, ...C.deepStone, 80, 1);
    }
  }
  pb.applyNoise(0, 0, w, h, 10);
  return pb;
}

function drawCellarShelves(w, h) {
  const pb = new PixelBuffer(w, h);
  // Wood shelves background
  pb.gradientRectV(0, 0, w, h, C.cellarWood, C.darkTimber);
  // Shelf planks
  for (let s = 0; s < 3; s++) {
    const sy = Math.round((s + 0.5) / 3 * h);
    pb.fillRect(0, sy - 3, w, 8, ...C.agedOak);
    pb.drawLine(0, sy - 3, w, sy - 3, ...C.warmBrown, 200, 1);
    pb.drawLine(0, sy + 5, w, sy + 5, ...C.darkTimber, 150, 1);
    // Shelf bracket
    for (let bx = 30; bx < w; bx += 80) {
      pb.fillRect(bx, sy + 5, 4, 12, ...C.copper);
    }
  }
  pb.applyNoise(0, 0, w, h, 8);
  return pb;
}

function drawCellarFloor(w, h) {
  const pb = new PixelBuffer(w, h);
  // Flagstone
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      pb.setPixel(x, y, ...C.flagstone);
    }
  }
  // Tile lines
  const tileW = 32;
  for (let col = 0; col < Math.ceil(w / tileW); col++) {
    pb.drawLine(col * tileW, 0, col * tileW, h, ...C.deepStone, 80, 1);
  }
  pb.applyNoise(0, 0, w, h, 8);
  return pb;
}

function drawCellarBeam(w, h) {
  const pb = new PixelBuffer(w, h);
  // Horizontal wooden beam
  pb.gradientRectV(0, 0, w, h, C.agedOak, C.cellarWood);
  // Grain lines
  for (let g = 0; g < 4; g++) {
    const gy = Math.round((g + 0.5) / 4 * h);
    for (let x = 0; x < w; x++) {
      const wave = Math.sin(x * 0.05 + g * 2) * 1;
      pb.setPixel(x, gy + Math.round(wave), ...C.darkTimber, 60);
    }
  }
  pb.drawLine(0, 0, w, 0, ...C.warmBrown, 180, 2);
  pb.drawLine(0, h - 1, w, h - 1, ...C.warmBrown, 180, 2);
  pb.applyNoise(0, 0, w, h, 6);
  return pb;
}

function drawCellarPipe(w, h) {
  const pb = new PixelBuffer(w, h);
  const cx = w / 2;
  // Vertical copper pipe
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.abs(x - cx) / (w / 2);
      if (dist < 0.7) {
        const highlight = Math.max(0, 1 - dist * 2) * 0.5;
        const r = Math.round(C.copper[0] + (C.copperHi[0] - C.copper[0]) * highlight);
        const g = Math.round(C.copper[1] + (C.copperHi[1] - C.copper[1]) * highlight);
        const b = Math.round(C.copper[2] + (C.copperHi[2] - C.copper[2]) * highlight);
        pb.setPixel(x, y, r, g, b);
      }
    }
  }
  // Pipe edges
  for (let y = 0; y < h; y++) {
    pb.setPixel(Math.round(cx - w * 0.35), y, ...C.warmBrown, 180);
    pb.setPixel(Math.round(cx + w * 0.35), y, ...C.warmBrown, 180);
  }
  // Joint rings
  for (let j = 0; j < 3; j++) {
    const jy = Math.round((j + 0.5) / 3 * h);
    for (let x = 0; x < w; x++) {
      if (Math.abs(x - cx) < w * 0.4) {
        pb.setPixel(x, jy, ...C.copperDark, 200);
        pb.setPixel(x, jy + 1, ...C.copperHi, 120);
      }
    }
  }
  pb.applyNoise(0, 0, w, h, 5);
  return pb;
}

// ═══════════════════════════════════════════════════════════════════
// Atlas Assembly
// ═══════════════════════════════════════════════════════════════════

// Frame layout definitions (same positions as original for compatibility)
const propsLayout = {
  wood_plank_short:            { x: 0,   y: 0,   w: 64,  h: 192 },
  wood_plank_medium:           { x: 66,  y: 0,   w: 64,  h: 256 },
  wood_plank_long:             { x: 132, y: 0,   w: 64,  h: 384 },
  wood_plank_short_cracked:    { x: 198, y: 0,   w: 64,  h: 192 },
  wood_plank_medium_cracked:   { x: 264, y: 0,   w: 64,  h: 256 },
  wood_plank_long_cracked:     { x: 330, y: 0,   w: 64,  h: 384 },
  wood_platform:               { x: 0,   y: 400, w: 384, h: 48 },
  wood_platform_cracked:       { x: 0,   y: 450, w: 384, h: 48 },
  cheese_crate_small:          { x: 400, y: 0,   w: 96,  h: 96 },
  cheese_crate_large:          { x: 400, y: 100, w: 112, h: 112 },
  cheese_crate_small_cracked:  { x: 400, y: 216, w: 96,  h: 96 },
  cheese_crate_large_cracked:  { x: 400, y: 316, w: 112, h: 112 },
  slingshot_base:              { x: 520, y: 0,   w: 128, h: 256 },
  slingshot_band_segment:      { x: 520, y: 260, w: 32,  h: 8 },
  ground_surface:              { x: 0,   y: 510, w: 512, h: 64 },
  ground_dirt:                 { x: 0,   y: 580, w: 512, h: 128 },
};

const charsLayout = {
  cheddar_idle_01:   { x: 0,   y: 0,   w: 128, h: 128 },
  cheddar_idle_02:   { x: 130, y: 0,   w: 128, h: 128 },
  cheddar_loaded:    { x: 260, y: 0,   w: 128, h: 128 },
  cheddar_aiming_01: { x: 390, y: 0,   w: 128, h: 128 },
  cheddar_aiming_02: { x: 520, y: 0,   w: 128, h: 128 },
  cheddar_flying:    { x: 650, y: 0,   w: 128, h: 128 },
  cheddar_impact:    { x: 780, y: 0,   w: 128, h: 128 },
  cheddar_settled:   { x: 0,   y: 130, w: 128, h: 128 },
  cheddar_win:       { x: 130, y: 130, w: 128, h: 128 },
  cheddar_lose:      { x: 260, y: 130, w: 128, h: 128 },
  rat_idle_01:       { x: 0,   y: 260, w: 96,  h: 128 },
  rat_idle_02:       { x: 100, y: 260, w: 96,  h: 128 },
  rat_idle_03:       { x: 100, y: 260, w: 96,  h: 128 },
  rat_alert:         { x: 200, y: 260, w: 96,  h: 128 },
  rat_hit:           { x: 300, y: 260, w: 96,  h: 128 },
  rat_defeated:      { x: 400, y: 260, w: 96,  h: 128 },
  rat_taunt:         { x: 500, y: 260, w: 96,  h: 128 },
};

const vfxLayout = {
  cheese_crumb_01:   { x: 0,   y: 0,  w: 16, h: 16 },
  cheese_crumb_02:   { x: 18,  y: 0,  w: 24, h: 24 },
  cheese_crumb_03:   { x: 44,  y: 0,  w: 12, h: 12 },
  dust_puff_01:      { x: 0,   y: 28, w: 48, h: 48 },
  dust_puff_02:      { x: 50,  y: 28, w: 48, h: 48 },
  dust_puff_03:      { x: 100, y: 28, w: 48, h: 48 },
  dust_puff_04:      { x: 150, y: 28, w: 48, h: 48 },
  impact_spark_01:   { x: 0,   y: 80, w: 32, h: 32 },
  impact_spark_02:   { x: 34,  y: 80, w: 32, h: 32 },
  impact_spark_03:   { x: 68,  y: 80, w: 32, h: 32 },
  wood_splinter_01:  { x: 0,   y: 114, w: 24, h: 8 },
  wood_splinter_02:  { x: 26,  y: 114, w: 32, h: 6 },
  star_01:           { x: 0,   y: 124, w: 16, h: 16 },
};

function buildJSON(layout, atlasW, atlasH, image) {
  const out = {};
  for (const [name, f] of Object.entries(layout)) {
    out[name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
  }
  return { frames: out, meta: { app: "angry-curds-2", version: "1.0", image, format: "RGBA8888", size: { w: atlasW, h: atlasH }, scale: "1" } };
}

// ═══════════════════════════════════════════════════════════════════
// Generate All Assets
// ═══════════════════════════════════════════════════════════════════

console.log("Generating props atlas...");
const propsW = 768, propsH = 768;
const propsAtlas = new PixelBuffer(propsW, propsH);

// Wood planks
drawWoodPlank(propsAtlas, 0, 0, 64, 192, false);
drawWoodPlank(propsAtlas, 66, 0, 64, 256, false);
drawWoodPlank(propsAtlas, 132, 0, 64, 384, false);
drawWoodPlank(propsAtlas, 198, 0, 64, 192, true);
drawWoodPlank(propsAtlas, 264, 0, 64, 256, true);
drawWoodPlank(propsAtlas, 330, 0, 64, 384, true);

// Wood platforms
drawWoodPlatform(propsAtlas, 0, 400, 384, 48, false);
drawWoodPlatform(propsAtlas, 0, 450, 384, 48, true);

// Cheese crates
drawCheeseCrate(propsAtlas, 400, 0, 96, false);
drawCheeseCrate(propsAtlas, 400, 100, 112, false);
drawCheeseCrate(propsAtlas, 400, 216, 96, true);
drawCheeseCrate(propsAtlas, 400, 316, 112, true);

// Slingshot
drawSlingshot(propsAtlas, 520, 0);
drawSlingshotBand(propsAtlas, 520, 260, 32, 8);

// Ground
drawGroundSurface(propsAtlas, 0, 510, 512, 64);
drawGroundDirt(propsAtlas, 0, 580, 512, 128);

writeFileSync(join(assetsDir, "sprites", "props.json"), JSON.stringify(buildJSON(propsLayout, propsW, propsH, "props.png"), null, 2));
writeFileSync(join(assetsDir, "sprites", "props.png"), encodePNG(propsAtlas));

console.log("Generating characters atlas...");
const charsW = 910, charsH = 400;
const charsAtlas = new PixelBuffer(charsW, charsH);

// Cheddar states
drawCheddar(charsAtlas, 0, 0, "happy");        // idle_01
drawCheddar(charsAtlas, 130, 0, "happy");       // idle_02 (slight variation)
drawCheddar(charsAtlas, 260, 0, "happy");       // loaded
drawCheddar(charsAtlas, 390, 0, "wide");        // aiming_01 (nervous)
drawCheddar(charsAtlas, 520, 0, "wide");        // aiming_02 (more nervous)
drawCheddar(charsAtlas, 650, 0, "closed");      // flying (eyes shut, screaming)
drawCheddar(charsAtlas, 780, 0, "x_eyes");      // impact
drawCheddar(charsAtlas, 0, 130, "spiral");      // settled (dizzy)
drawCheddar(charsAtlas, 130, 130, "sparkle");   // win
drawCheddar(charsAtlas, 260, 130, "sad");       // lose

// Rat states
drawRat(charsAtlas, 0, 260, "smug");            // idle_01
drawRat(charsAtlas, 100, 260, "smug");          // idle_02
// rat_idle_03 shares position with idle_02 in layout
drawRat(charsAtlas, 200, 260, "wide");          // alert
drawRat(charsAtlas, 300, 260, "shut");          // hit
drawRat(charsAtlas, 400, 260, "x_eyes");        // defeated
drawRat(charsAtlas, 500, 260, "taunt");         // taunt

writeFileSync(join(assetsDir, "sprites", "characters.json"), JSON.stringify(buildJSON(charsLayout, charsW, charsH, "characters.png"), null, 2));
writeFileSync(join(assetsDir, "sprites", "characters.png"), encodePNG(charsAtlas));

console.log("Generating VFX atlas...");
const vfxW = 256, vfxH = 142;
const vfxAtlas = new PixelBuffer(vfxW, vfxH);

// Cheese crumbs
drawCheeseCrumb(vfxAtlas, 0, 0, 16, 16);
drawCheeseCrumb(vfxAtlas, 18, 0, 24, 24);
drawCheeseCrumb(vfxAtlas, 44, 0, 12, 12);

// Dust puffs (4-frame animation)
drawDustPuff(vfxAtlas, 0, 28, 48, 48, 0);
drawDustPuff(vfxAtlas, 50, 28, 48, 48, 1);
drawDustPuff(vfxAtlas, 100, 28, 48, 48, 2);
drawDustPuff(vfxAtlas, 150, 28, 48, 48, 3);

// Impact sparks (3-frame)
drawImpactSpark(vfxAtlas, 0, 80, 32, 32, 0);
drawImpactSpark(vfxAtlas, 34, 80, 32, 32, 1);
drawImpactSpark(vfxAtlas, 68, 80, 32, 32, 2);

// Wood splinters
drawWoodSplinter(vfxAtlas, 0, 114, 24, 8);
drawWoodSplinter(vfxAtlas, 26, 114, 32, 6);

// Star
drawStar(vfxAtlas, 0, 124, 16, 16);

writeFileSync(join(assetsDir, "sprites", "vfx.json"), JSON.stringify(buildJSON(vfxLayout, vfxW, vfxH, "vfx.png"), null, 2));
writeFileSync(join(assetsDir, "sprites", "vfx.png"), encodePNG(vfxAtlas));

console.log("Generating environment textures...");
const envDir = join(assetsDir, "environment");

const wall = drawCellarWall(256, 128);
writeFileSync(join(envDir, "cellar_layer0_wall.png"), encodePNG(wall));

const shelves = drawCellarShelves(256, 128);
writeFileSync(join(envDir, "cellar_layer1_shelves.png"), encodePNG(shelves));

const floor = drawCellarFloor(256, 32);
writeFileSync(join(envDir, "cellar_layer2_floor.png"), encodePNG(floor));

const beam = drawCellarBeam(256, 64);
writeFileSync(join(envDir, "cellar_layer3_beam_01.png"), encodePNG(beam));

const pipe = drawCellarPipe(64, 256);
writeFileSync(join(envDir, "cellar_layer3_pipe_01.png"), encodePNG(pipe));

console.log("Done! Polished sprite assets generated in public/assets/");
