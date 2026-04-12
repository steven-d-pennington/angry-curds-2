#!/usr/bin/env node
/**
 * Generates TexturePacker JSON-hash sprite sheet manifests and small
 * placeholder PNGs for each atlas. Real art replaces these PNGs later.
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

// --- PNG generator using zlib for compression ---
function createPNG(width, height, r, g, b, a = 255) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? (0xedb88320 ^ (v >>> 1)) : v >>> 1;
      table[n] = v;
    }
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const combined = Buffer.concat([typeBytes, data]);
    const crcVal = crc32(combined);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, combined, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  // Build raw scanlines
  const scanlineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineSize);
  for (let y = 0; y < height; y++) {
    const offset = y * scanlineSize;
    rawData[offset] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 4;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  const compressed = deflateSync(rawData);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexToRGB(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function createAtlasPNG(frames, atlasW, atlasH) {
  const pixels = Buffer.alloc(atlasW * atlasH * 4, 0);
  for (const f of Object.values(frames)) {
    const [r, g, b] = hexToRGB(f.color);
    for (let y = f.y; y < f.y + f.h && y < atlasH; y++) {
      for (let x = f.x; x < f.x + f.w && x < atlasW; x++) {
        const idx = (y * atlasW + x) * 4;
        pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = 255;
      }
    }
  }

  // Build PNG with zlib compression
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n; for (let k = 0; k < 8; k++) v = v & 1 ? (0xedb88320 ^ (v >>> 1)) : v >>> 1;
      table[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const tb = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const combined = Buffer.concat([tb, data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, combined, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(atlasW, 0); ihdr.writeUInt32BE(atlasH, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  const scanlineSize = 1 + atlasW * 4;
  const rawData = Buffer.alloc(atlasH * scanlineSize);
  for (let y = 0; y < atlasH; y++) {
    const offset = y * scanlineSize;
    rawData[offset] = 0;
    pixels.copy(rawData, offset + 1, y * atlasW * 4, (y + 1) * atlasW * 4);
  }

  const compressed = deflateSync(rawData);

  return Buffer.concat([
    signature, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Frame definitions ---

const propsFrames = {
  wood_plank_short:            { x: 0,   y: 0,   w: 64,  h: 192, color: "#8B5E3C" },
  wood_plank_medium:           { x: 66,  y: 0,   w: 64,  h: 256, color: "#8B5E3C" },
  wood_plank_long:             { x: 132, y: 0,   w: 64,  h: 384, color: "#8B5E3C" },
  wood_plank_short_cracked:    { x: 198, y: 0,   w: 64,  h: 192, color: "#5C3A1E" },
  wood_plank_medium_cracked:   { x: 264, y: 0,   w: 64,  h: 256, color: "#5C3A1E" },
  wood_plank_long_cracked:     { x: 330, y: 0,   w: 64,  h: 384, color: "#5C3A1E" },
  wood_platform:               { x: 0,   y: 400, w: 384, h: 48,  color: "#B8845A" },
  wood_platform_cracked:       { x: 0,   y: 450, w: 384, h: 48,  color: "#5C3A1E" },
  cheese_crate_small:          { x: 400, y: 0,   w: 96,  h: 96,  color: "#E8C547" },
  cheese_crate_large:          { x: 400, y: 100, w: 112, h: 112, color: "#E8C547" },
  cheese_crate_small_cracked:  { x: 400, y: 216, w: 96,  h: 96,  color: "#C47B12" },
  cheese_crate_large_cracked:  { x: 400, y: 316, w: 112, h: 112, color: "#C47B12" },
  slingshot_base:              { x: 520, y: 0,   w: 128, h: 256, color: "#A87D4E" },
  slingshot_band_segment:      { x: 520, y: 260, w: 32,  h: 8,   color: "#8B5E3C" },
  ground_surface:              { x: 0,   y: 510, w: 512, h: 64,  color: "#5A8C47" },
  ground_dirt:                 { x: 0,   y: 580, w: 512, h: 128, color: "#6B5040" },
};

const charsFrames = {
  cheddar_idle_01:   { x: 0,   y: 0,   w: 128, h: 128, color: "#F5A623" },
  cheddar_idle_02:   { x: 130, y: 0,   w: 128, h: 128, color: "#F5A623" },
  cheddar_loaded:    { x: 260, y: 0,   w: 128, h: 128, color: "#F5A623" },
  cheddar_aiming_01: { x: 390, y: 0,   w: 128, h: 128, color: "#FFD76E" },
  cheddar_aiming_02: { x: 520, y: 0,   w: 128, h: 128, color: "#FFD76E" },
  cheddar_flying:    { x: 650, y: 0,   w: 128, h: 128, color: "#F5A623" },
  cheddar_impact:    { x: 780, y: 0,   w: 128, h: 128, color: "#C47B12" },
  cheddar_settled:   { x: 0,   y: 130, w: 128, h: 128, color: "#C47B12" },
  cheddar_win:       { x: 130, y: 130, w: 128, h: 128, color: "#FFD76E" },
  cheddar_lose:      { x: 260, y: 130, w: 128, h: 128, color: "#C47B12" },
  rat_idle_01:       { x: 0,   y: 260, w: 96,  h: 128, color: "#6B6B7B" },
  rat_idle_02:       { x: 100, y: 260, w: 96,  h: 128, color: "#6B6B7B" },
  rat_idle_03:       { x: 100, y: 260, w: 96,  h: 128, color: "#6B6B7B" },
  rat_alert:         { x: 200, y: 260, w: 96,  h: 128, color: "#9898A8" },
  rat_hit:           { x: 300, y: 260, w: 96,  h: 128, color: "#42424E" },
  rat_defeated:      { x: 400, y: 260, w: 96,  h: 128, color: "#42424E" },
  rat_taunt:         { x: 500, y: 260, w: 96,  h: 128, color: "#6B6B7B" },
};

const vfxFrames = {
  cheese_crumb_01:   { x: 0,   y: 0,  w: 16, h: 16, color: "#FFB833" },
  cheese_crumb_02:   { x: 18,  y: 0,  w: 24, h: 24, color: "#F5A623" },
  cheese_crumb_03:   { x: 44,  y: 0,  w: 12, h: 12, color: "#FFD76E" },
  dust_puff_01:      { x: 0,   y: 28, w: 48, h: 48, color: "#C8B898" },
  dust_puff_02:      { x: 50,  y: 28, w: 48, h: 48, color: "#C8B898" },
  dust_puff_03:      { x: 100, y: 28, w: 48, h: 48, color: "#C8B898" },
  dust_puff_04:      { x: 150, y: 28, w: 48, h: 48, color: "#C8B898" },
  impact_spark_01:   { x: 0,   y: 80, w: 32, h: 32, color: "#FFB833" },
  impact_spark_02:   { x: 34,  y: 80, w: 32, h: 32, color: "#FFEE44" },
  impact_spark_03:   { x: 68,  y: 80, w: 32, h: 32, color: "#FFB833" },
  wood_splinter_01:  { x: 0,   y: 114, w: 24, h: 8, color: "#8B5E3C" },
  wood_splinter_02:  { x: 26,  y: 114, w: 32, h: 6, color: "#B8845A" },
  star_01:           { x: 0,   y: 124, w: 16, h: 16, color: "#FFEE44" },
};

function buildJSON(frames, atlasW, atlasH, image) {
  const out = {};
  for (const [name, f] of Object.entries(frames)) {
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

// --- Generate ---

// Props (1024x1024 → use 768x768 for placeholder, fits all frames)
console.log("Generating props atlas...");
const propsW = 768, propsH = 768;
writeFileSync(join(assetsDir, "sprites", "props.json"), JSON.stringify(buildJSON(propsFrames, propsW, propsH, "props.png"), null, 2));
writeFileSync(join(assetsDir, "sprites", "props.png"), createAtlasPNG(propsFrames, propsW, propsH));

// Characters (use 910x400 to fit all frames)
console.log("Generating characters atlas...");
const charsW = 910, charsH = 400;
writeFileSync(join(assetsDir, "sprites", "characters.json"), JSON.stringify(buildJSON(charsFrames, charsW, charsH, "characters.png"), null, 2));
writeFileSync(join(assetsDir, "sprites", "characters.png"), createAtlasPNG(charsFrames, charsW, charsH));

// VFX (256x256)
console.log("Generating VFX atlas...");
const vfxW = 256, vfxH = 142;
writeFileSync(join(assetsDir, "sprites", "vfx.json"), JSON.stringify(buildJSON(vfxFrames, vfxW, vfxH, "vfx.png"), null, 2));
writeFileSync(join(assetsDir, "sprites", "vfx.png"), createAtlasPNG(vfxFrames, vfxW, vfxH));

// Environment layers (use small placeholders, 256px wide)
console.log("Generating environment placeholders...");
const envLayers = [
  { name: "cellar_layer0_wall",    w: 256, h: 128, color: "#7A6B58" },
  { name: "cellar_layer1_shelves", w: 256, h: 128, color: "#8B5E3C" },
  { name: "cellar_layer2_floor",   w: 256, h: 32,  color: "#6B5D4F" },
  { name: "cellar_layer3_beam_01", w: 256, h: 64,  color: "#B8845A" },
  { name: "cellar_layer3_pipe_01", w: 64,  h: 256, color: "#A87D4E" },
];
for (const l of envLayers) {
  const [r, g, b] = hexToRGB(l.color);
  writeFileSync(join(assetsDir, "environment", `${l.name}.png`), createPNG(l.w, l.h, r, g, b));
}

console.log("Done! Placeholder assets generated in public/assets/");
