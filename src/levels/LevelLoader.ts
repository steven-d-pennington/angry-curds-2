import type { Engine } from "../engine/Engine.js";
import { Block } from "../entities/Block.js";
import { Rat } from "../entities/Rat.js";
import type { GameState } from "../gameplay/GameState.js";
import type { LevelData } from "./LevelData.js";
import { Graphics } from "pixi.js";

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

  for (const blockDef of data.blocks) {
    Block.spawn(
      {
        x: blockDef.x,
        y: blockDef.y,
        width: blockDef.width,
        height: blockDef.height,
        material: blockDef.material,
        angle: blockDef.angle,
      },
      engine,
    );
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

  const ground = new Graphics();
  ground.rect(0, groundScreenY, cw, ch - groundScreenY);
  ground.fill({ color: 0x4a7c3f });
  ground.rect(0, groundScreenY, cw, 3);
  ground.fill({ color: 0x5c3a1e });

  engine.getLayer("background").addChild(ground);
}
