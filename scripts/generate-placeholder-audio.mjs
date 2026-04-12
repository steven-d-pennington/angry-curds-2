#!/usr/bin/env node
/**
 * Generates minimal placeholder WAV files for the Angry Curds 2 vertical slice.
 * Each file is a short synthesized tone so the audio pipeline can be tested end-to-end.
 * Replace with real assets before shipping.
 */
import { writeFileSync } from "fs";
import { join } from "path";

const SAMPLE_RATE = 22050;
const OUT_DIR = join(import.meta.dirname, "..", "public", "audio");

/** Write a mono 16-bit PCM WAV file */
function writeWav(filepath, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);
  let off = 0;

  // RIFF header
  buf.write("RIFF", off); off += 4;
  buf.writeUInt32LE(fileSize - 8, off); off += 4;
  buf.write("WAVE", off); off += 4;

  // fmt chunk
  buf.write("fmt ", off); off += 4;
  buf.writeUInt32LE(16, off); off += 4;        // chunk size
  buf.writeUInt16LE(1, off); off += 2;         // PCM
  buf.writeUInt16LE(1, off); off += 2;         // mono
  buf.writeUInt32LE(SAMPLE_RATE, off); off += 4;
  buf.writeUInt32LE(SAMPLE_RATE * 2, off); off += 4; // byte rate
  buf.writeUInt16LE(2, off); off += 2;         // block align
  buf.writeUInt16LE(16, off); off += 2;        // bits per sample

  // data chunk
  buf.write("data", off); off += 4;
  buf.writeUInt32LE(dataSize, off); off += 4;

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), off);
    off += 2;
  }

  writeFileSync(filepath, buf);
}

/** Generate a sine tone with envelope */
function tone(freq, duration, { attack = 0.01, decay = 0.05, sustain = 0.7, release = 0.1, volume = 0.8 } = {}) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  const attackSamples = Math.floor(attack * SAMPLE_RATE);
  const releaseSamples = Math.floor(release * SAMPLE_RATE);

  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let env = sustain;
    if (i < attackSamples) env = (i / attackSamples);
    else if (i > len - releaseSamples) env = ((len - i) / releaseSamples) * sustain;

    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * volume;
  }
  return samples;
}

/** Noise burst (for impacts) */
function noiseBurst(duration, { attack = 0.005, release = 0.05, volume = 0.6 } = {}) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  const attackSamples = Math.floor(attack * SAMPLE_RATE);
  const releaseSamples = Math.floor(release * SAMPLE_RATE);

  for (let i = 0; i < len; i++) {
    let env = 1;
    if (i < attackSamples) env = i / attackSamples;
    else if (i > len - releaseSamples) env = (len - i) / releaseSamples;

    samples[i] = (Math.random() * 2 - 1) * env * volume;
  }
  return samples;
}

/** Mix multiple sample arrays (same length or trimmed to shortest) */
function mix(...arrays) {
  const len = Math.min(...arrays.map(a => a.length));
  const out = new Float64Array(len);
  for (const arr of arrays) {
    for (let i = 0; i < len; i++) out[i] += arr[i];
  }
  return out;
}

/** Concatenate sample arrays */
function concat(...arrays) {
  const totalLen = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Float64Array(totalLen);
  let off = 0;
  for (const arr of arrays) {
    out.set(arr, off);
    off += arr.length;
  }
  return out;
}

/** Frequency sweep (for launch whoosh) */
function sweep(startFreq, endFreq, duration, { volume = 0.5 } = {}) {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const freq = startFreq + (endFreq - startFreq) * t;
    const env = 1 - t; // fade out
    samples[i] = Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE)) * env * volume;
  }
  return samples;
}

// --- Generate each SFX ---

// Cheese launch: ascending whoosh + twang
const launch = mix(
  sweep(200, 800, 0.3, { volume: 0.4 }),
  tone(440, 0.15, { attack: 0.005, release: 0.1, volume: 0.5 }),
);
writeWav(join(OUT_DIR, "sfx_launch.wav"), launch);

// Cheese impact: low thud + noise
const impact = mix(
  tone(80, 0.2, { attack: 0.005, decay: 0.02, sustain: 0.3, release: 0.15, volume: 0.8 }),
  noiseBurst(0.15, { volume: 0.4 }),
);
writeWav(join(OUT_DIR, "sfx_impact.wav"), impact);

// Structure break: crunch noise + mid tone
const breakSound = mix(
  noiseBurst(0.25, { volume: 0.7 }),
  tone(150, 0.2, { attack: 0.005, release: 0.15, volume: 0.4 }),
);
writeWav(join(OUT_DIR, "sfx_break.wav"), breakSound);

// Rat death: descending tone + squeak
const ratDeath = concat(
  tone(600, 0.08, { attack: 0.005, release: 0.03, volume: 0.6 }),
  sweep(500, 150, 0.25, { volume: 0.5 }),
);
writeWav(join(OUT_DIR, "sfx_rat_death.wav"), ratDeath);

// UI button: short click tone
const button = tone(800, 0.08, { attack: 0.005, release: 0.05, volume: 0.4 });
writeWav(join(OUT_DIR, "sfx_button.wav"), button);

// Level complete: ascending arpeggio (C-E-G-C)
const complete = concat(
  tone(523.25, 0.15, { attack: 0.01, release: 0.05, volume: 0.6 }),
  tone(659.25, 0.15, { attack: 0.01, release: 0.05, volume: 0.6 }),
  tone(783.99, 0.15, { attack: 0.01, release: 0.05, volume: 0.6 }),
  tone(1046.5, 0.4, { attack: 0.01, release: 0.3, volume: 0.7 }),
);
writeWav(join(OUT_DIR, "sfx_level_complete.wav"), complete);

// Level fail: descending sad tones
const fail = concat(
  tone(400, 0.2, { attack: 0.01, release: 0.1, volume: 0.5 }),
  tone(300, 0.2, { attack: 0.01, release: 0.1, volume: 0.5 }),
  tone(200, 0.4, { attack: 0.01, release: 0.3, volume: 0.5 }),
);
writeWav(join(OUT_DIR, "sfx_level_fail.wav"), fail);

// Music: simple looping melody (8 bars, ~8 seconds)
// Fun pentatonic bouncy loop
const bpm = 140;
const beatDur = 60 / bpm;
const notes = [
  // bar 1-2: bouncy theme
  [523, 0.5], [659, 0.5], [784, 0.5], [659, 0.5],
  [523, 0.25], [587, 0.25], [659, 0.5], [523, 0.5],
  // bar 3-4: variation
  [784, 0.5], [659, 0.25], [587, 0.25], [523, 0.5], [659, 0.5],
  [784, 0.5], [880, 0.5], [784, 1.0],
  // bar 5-6: bridge
  [440, 0.5], [523, 0.5], [587, 0.5], [523, 0.5],
  [440, 0.25], [392, 0.25], [440, 0.5], [523, 0.5],
  // bar 7-8: return
  [659, 0.5], [784, 0.5], [659, 0.25], [587, 0.25], [523, 0.5],
  [440, 0.5], [523, 1.0],
];

const musicParts = [];
for (const [freq, beats] of notes) {
  const dur = beats * beatDur;
  musicParts.push(tone(freq, dur, { attack: 0.01, decay: 0.05, sustain: 0.5, release: dur * 0.3, volume: 0.35 }));
}
const music = concat(...musicParts);
writeWav(join(OUT_DIR, "music_gameplay.wav"), music);

console.log("Generated placeholder audio files in public/audio/:");
console.log("  sfx_launch.wav, sfx_impact.wav, sfx_break.wav, sfx_rat_death.wav");
console.log("  sfx_button.wav, sfx_level_complete.wav, sfx_level_fail.wav");
console.log("  music_gameplay.wav");
