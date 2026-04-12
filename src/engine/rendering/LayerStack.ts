import { Container } from "pixi.js";

/**
 * Named rendering layers, added to the stage in back-to-front order.
 * Gameplay code accesses layers by name to attach display objects.
 */

export const LAYER_NAMES = [
  "background",
  "structures",
  "entities",
  "projectile",
  "vfx",
  "hud",
] as const;

export type LayerName = (typeof LAYER_NAMES)[number];

export class LayerStack {
  private readonly layers: Map<LayerName, Container> = new Map();
  readonly root: Container;

  constructor(stage: Container) {
    this.root = stage;
    for (const name of LAYER_NAMES) {
      const container = new Container();
      container.label = name;
      this.layers.set(name, container);
      stage.addChild(container);
    }
  }

  get(name: LayerName): Container {
    const layer = this.layers.get(name);
    if (!layer) throw new Error(`Layer "${name}" not found`);
    return layer;
  }

  /** Remove all children from every layer. */
  clearAll(): void {
    for (const layer of this.layers.values()) {
      layer.removeChildren();
    }
  }
}
