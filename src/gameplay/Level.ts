import type { Engine } from "../engine/Engine.js";
import { Block, type BlockDef } from "../entities/Block.js";
import { Rat } from "../entities/Rat.js";
import type { GameState } from "./GameState.js";
import { TilingSprite } from "pixi.js";
import { getFrame } from "../engine/AssetLoader.js";

const GROUND_Y = 1; // matches engine ground plane

/**
 * Hardcoded level layout: a multi-story fort on the right side with rats inside/on top.
 *
 * World coords: ground at y=1, viewport 20m wide x 12m high.
 * Fort positioned around x=13-17m. Slingshot at ~2m (handled by DON-69).
 */
export function buildLevel(engine: Engine, state: GameState): void {
  drawGround(engine);

  // === FORT STRUCTURE ===
  const blocks: BlockDef[] = [
    // --- Ground floor: two pillars with a platform ---
    { x: 13, y: 1.75, width: 0.4, height: 1.5, material: "wood" },
    { x: 15.5, y: 1.75, width: 0.4, height: 1.5, material: "wood" },
    { x: 14.25, y: 2.65, width: 3.0, height: 0.3, material: "wood" },

    // --- Ground floor fill: cheese crates inside ---
    { x: 14.0, y: 1.5, width: 0.8, height: 0.8, material: "cheese_crate" },
    { x: 14.8, y: 1.5, width: 0.6, height: 0.8, material: "cheese_crate" },

    // --- Second floor: narrower, taller pillars ---
    { x: 13.4, y: 3.45, width: 0.35, height: 1.3, material: "wood" },
    { x: 15.1, y: 3.45, width: 0.35, height: 1.3, material: "wood" },
    { x: 14.25, y: 4.25, width: 2.2, height: 0.3, material: "cheese_crate" },

    // --- Second floor fill ---
    { x: 14.25, y: 3.3, width: 0.7, height: 0.6, material: "cheese_crate" },

    // --- Third floor: precarious tower ---
    { x: 14.0, y: 4.95, width: 0.3, height: 1.1, material: "wood" },
    { x: 14.5, y: 4.95, width: 0.3, height: 1.1, material: "wood" },
    { x: 14.25, y: 5.65, width: 1.0, height: 0.25, material: "cheese_crate" },

    // --- Side tower (extra challenge, right side) ---
    { x: 16.5, y: 1.75, width: 0.4, height: 1.5, material: "wood" },
    { x: 17.3, y: 1.75, width: 0.4, height: 1.5, material: "wood" },
    { x: 16.9, y: 2.65, width: 1.2, height: 0.3, material: "wood" },
    { x: 16.9, y: 3.15, width: 0.6, height: 0.7, material: "cheese_crate" },
  ];

  for (const def of blocks) {
    Block.spawn(def, engine);
  }

  // === RATS ===
  const ratPositions: Array<{ x: number; y: number }> = [
    { x: 14.3, y: 1.7 },
    { x: 14.25, y: 4.7 },
    { x: 14.25, y: 6.1 },
    { x: 16.9, y: 3.8 },
  ];

  for (const pos of ratPositions) {
    const rat = Rat.spawn(pos.x, pos.y, engine);
    state.registerRat(rat);
  }
}

function drawGround(engine: Engine): void {
  const cw = engine.canvasWidth;
  const ch = engine.canvasHeight;
  const groundScreenY = ch - (GROUND_Y / engine.viewport.worldHeight) * ch;

  // Use ground sprites from props atlas
  const surfaceTex = getFrame("ground_surface");
  const dirtTex = getFrame("ground_dirt");

  // Tileable ground surface (moss/grass strip)
  const surfaceHeight = engine.metersToPixels(0.15);
  const surface = new TilingSprite({
    texture: surfaceTex,
    width: cw,
    height: surfaceHeight,
  });
  surface.y = groundScreenY - surfaceHeight * 0.5;
  engine.getLayer("background").addChild(surface);

  // Tileable dirt/flagstone below
  const dirt = new TilingSprite({
    texture: dirtTex,
    width: cw,
    height: ch - groundScreenY + surfaceHeight,
  });
  dirt.y = groundScreenY + surfaceHeight * 0.5;
  engine.getLayer("background").addChild(dirt);
}
