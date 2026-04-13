import { Sprite, Texture } from "pixi.js";
import { Vec2, Box, type Body } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";
import { getFrame } from "../engine/AssetLoader.js";

export type BlockMaterial = "cheese_crate" | "wood";

export interface MaterialDef {
  density: number;
  restitution: number;
  friction: number;
  fractureThreshold: number;
  color: number;
}

export const MATERIALS: Record<BlockMaterial, MaterialDef> = {
  cheese_crate: {
    density: 0.5,
    restitution: 0.2,
    friction: 0.6,
    fractureThreshold: 5,
    color: 0xe8c547,
  },
  wood: {
    density: 0.7,
    restitution: 0.15,
    friction: 0.5,
    fractureThreshold: 10,
    color: 0x8b5e3c,
  },
};

export interface BlockDef {
  x: number;
  y: number;
  width: number;
  height: number;
  material: BlockMaterial;
  angle?: number;
}

export interface BlockUserData {
  type: "block";
  block: Block;
}

/** Map block dimensions to the correct sprite frame name. */
function pickBlockFrame(material: BlockMaterial, width: number, height: number, cracked: boolean): string {
  const suffix = cracked ? "_cracked" : "";

  if (material === "cheese_crate") {
    // Small (~0.6m) vs large (~0.8m)
    const size = Math.max(width, height) <= 0.65 ? "small" : "large";
    return `cheese_crate_${size}${suffix}`;
  }

  // Wood: categorize by longer dimension
  const longer = Math.max(width, height);
  if (longer >= 2.0) {
    return `wood_platform${suffix}`;
  }
  if (longer >= 0.9) {
    return `wood_plank_long${suffix}`;
  }
  if (longer >= 0.5) {
    return `wood_plank_medium${suffix}`;
  }
  return `wood_plank_short${suffix}`;
}

export class Block extends Entity {
  readonly material: BlockMaterial;
  readonly materialDef: MaterialDef;
  readonly widthM: number;
  readonly heightM: number;
  cumulativeImpulse = 0;
  destroyed = false;
  private cracked = false;
  private readonly sprite: Sprite;

  private constructor(
    body: Body,
    sprite: Sprite,
    material: BlockMaterial,
    widthM: number,
    heightM: number,
  ) {
    super(body, sprite);
    this.sprite = sprite;
    this.material = material;
    this.materialDef = MATERIALS[material];
    this.widthM = widthM;
    this.heightM = heightM;
  }

  static spawn(def: BlockDef, engine: Engine): Block {
    const mat = MATERIALS[def.material];

    const body = engine.physics.createBody({
      type: "dynamic",
      position: Vec2(def.x, def.y),
      angle: def.angle ?? 0,
    });
    body.createFixture({
      shape: new Box(def.width / 2, def.height / 2),
      density: mat.density,
      restitution: mat.restitution,
      friction: mat.friction,
    });

    const wPx = engine.metersToPixels(def.width);
    const hPx = engine.metersToPixels(def.height);

    // Get sprite frame from atlas
    const frameName = pickBlockFrame(def.material, def.width, def.height, false);
    const texture = getFrame(frameName);

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = wPx;
    sprite.height = hPx;

    engine.getLayer("structures").addChild(sprite);

    const block = new Block(body, sprite, def.material, def.width, def.height);
    body.setUserData({ type: "block", block } satisfies BlockUserData);
    engine.addEntity(block);

    return block;
  }

  applyImpulse(impulse: number): boolean {
    if (this.destroyed) return false;
    this.cumulativeImpulse += impulse;

    // Show cracked sprite when past 60% of fracture threshold
    if (!this.cracked && this.cumulativeImpulse >= this.materialDef.fractureThreshold * 0.6) {
      this.cracked = true;
      const crackedFrame = pickBlockFrame(this.material, this.widthM, this.heightM, true);
      const crackedTex = getFrame(crackedFrame);
      if (crackedTex !== Texture.EMPTY) {
        this.sprite.texture = crackedTex;
      }
    }

    return this.cumulativeImpulse >= this.materialDef.fractureThreshold;
  }
}
