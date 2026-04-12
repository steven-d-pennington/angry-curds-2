import { Assets, Spritesheet, Texture } from "pixi.js";

/**
 * Loads all game sprite sheets and environment textures.
 * Call `loadAll()` once during engine init, then access textures by frame name.
 */

const SPRITE_SHEETS = [
  { alias: "props", src: "assets/sprites/props.json" },
  { alias: "characters", src: "assets/sprites/characters.json" },
  { alias: "vfx", src: "assets/sprites/vfx.json" },
];

const ENVIRONMENT_TEXTURES = [
  { alias: "cellar_layer0", src: "assets/environment/cellar_layer0_wall.png" },
  { alias: "cellar_layer1", src: "assets/environment/cellar_layer1_shelves.png" },
  { alias: "cellar_layer2", src: "assets/environment/cellar_layer2_floor.png" },
  { alias: "cellar_layer3_beam", src: "assets/environment/cellar_layer3_beam_01.png" },
  { alias: "cellar_layer3_pipe", src: "assets/environment/cellar_layer3_pipe_01.png" },
];

let loaded = false;

export async function loadAllAssets(): Promise<void> {
  if (loaded) return;

  // Load sprite sheets (TexturePacker JSON-hash format)
  await Assets.load(SPRITE_SHEETS);

  // Load environment textures
  await Assets.load(ENVIRONMENT_TEXTURES);

  loaded = true;
}

/**
 * Get a texture from a loaded spritesheet by frame name.
 * Falls back to Texture.EMPTY if the frame isn't found.
 */
export function getFrame(frameName: string): Texture {
  // PixiJS 8 resolves spritesheet frames globally by frame name
  const tex = Assets.get<Texture>(frameName);
  if (tex) return tex;

  // Try looking in each spritesheet
  for (const sheet of SPRITE_SHEETS) {
    const ss = Assets.get<Spritesheet>(sheet.alias);
    if (ss?.textures?.[frameName]) {
      return ss.textures[frameName];
    }
  }

  return Texture.EMPTY;
}

/**
 * Get an environment layer texture by alias.
 */
export function getEnvTexture(alias: string): Texture {
  return Assets.get<Texture>(alias) ?? Texture.EMPTY;
}
