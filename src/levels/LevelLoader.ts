import type { Engine } from "../engine/Engine.js";
import { Block, type BlockDef } from "../entities/Block.js";
import { Rat } from "../entities/Rat.js";
import type { GameState } from "../gameplay/GameState.js";
import type { LevelData } from "./LevelData.js";
import { TilingSprite } from "pixi.js";
import { getFrame } from "../engine/AssetLoader.js";
import { EnvironmentProps } from "../engine/rendering/EnvironmentProps.js";

const GROUND_Y = 1; // matches engine ground plane

/**
 * Instantiates all entities described by a LevelData object.
 *
 * Reuses existing Block.spawn / Rat.spawn factories so physics and
 * rendering behaviour stays identical to the old hardcoded path.
 */
export function loadLevel(
  data: LevelData,
  engine: Engine,
  state: GameState,
): void {
  drawGround(engine);
  placeEnvironmentProps(engine);

  for (const blockDef of data.blocks) {
    const def: BlockDef = {
      x: blockDef.x,
      y: blockDef.y,
      width: blockDef.width,
      height: blockDef.height,
      material: blockDef.material,
    };
    if (blockDef.angle != null) def.angle = blockDef.angle;
    Block.spawn(def, engine);
  }

  for (const ratDef of data.rats) {
    const rat = Rat.spawn(ratDef.x, ratDef.y, engine);
    state.registerRat(rat);
  }
}

function drawGround(engine: Engine): void {
  const cw = engine.canvasWidth;
  const ch = engine.canvasHeight;
  const groundScreenY = ch - (GROUND_Y / engine.viewport.worldHeight) * ch;

  const surfaceTexture = getFrame("ground_surface");
  const dirtTexture = getFrame("ground_dirt");

  // Grass surface layer — tiled across viewport width at ground line
  const surfaceHeight = 48;
  const surface = new TilingSprite({
    texture: surfaceTexture,
    width: cw,
    height: surfaceHeight,
  });
  surface.y = groundScreenY - surfaceHeight * 0.4; // Overlap so grass sits above ground line

  // Dirt layer — fills from below the surface to the bottom of the screen
  const dirtTop = surface.y + surfaceHeight * 0.6;
  const dirt = new TilingSprite({
    texture: dirtTexture,
    width: cw,
    height: ch - dirtTop,
  });
  dirt.y = dirtTop;

  const bgLayer = engine.getLayer("background");
  bgLayer.addChild(dirt);
  bgLayer.addChild(surface);
}

function placeEnvironmentProps(engine: Engine): void {
  const cw = engine.canvasWidth;
  const ch = engine.canvasHeight;
  const groundScreenY = ch - (GROUND_Y / engine.viewport.worldHeight) * ch;

  const props = new EnvironmentProps(engine.getLayer("background"));
  props.init(cw, ch, groundScreenY);
}
