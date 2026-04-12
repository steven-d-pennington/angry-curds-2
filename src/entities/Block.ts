import { Graphics } from "pixi.js";
import { Vec2, Box, type Body } from "planck";
import { Entity } from "../engine/entities/Entity.js";
import type { Engine } from "../engine/Engine.js";

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
    fractureThreshold: 30,
    color: 0xe8c547, // yellow/tan
  },
  wood: {
    density: 0.7,
    restitution: 0.15,
    friction: 0.5,
    fractureThreshold: 50,
    color: 0x8b5e3c, // brown
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

export class Block extends Entity {
  readonly material: BlockMaterial;
  readonly materialDef: MaterialDef;
  readonly widthM: number;
  readonly heightM: number;
  cumulativeImpulse = 0;
  destroyed = false;

  private constructor(
    body: Body,
    display: Graphics,
    material: BlockMaterial,
    widthM: number,
    heightM: number,
  ) {
    super(body, display);
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

    const gfx = new Graphics();
    gfx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    gfx.fill({ color: mat.color });
    gfx.stroke({ color: 0x000000, width: 1, alpha: 0.3 });

    engine.getLayer("structures").addChild(gfx);

    const block = new Block(body, gfx, def.material, def.width, def.height);
    body.setUserData({ type: "block", block } satisfies BlockUserData);
    engine.addEntity(block);

    return block;
  }

  applyImpulse(impulse: number): boolean {
    if (this.destroyed) return false;
    this.cumulativeImpulse += impulse;
    return this.cumulativeImpulse >= this.materialDef.fractureThreshold;
  }
}
