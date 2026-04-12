import { Container, Sprite, TilingSprite } from "pixi.js";
import { getEnvTexture } from "../AssetLoader.js";

/**
 * 4-layer parallax background for the cheese cellar environment.
 *
 * Layer 0: Far stone wall  (parallax 0.1x)
 * Layer 1: Shelving units  (parallax 0.4x)
 * Layer 2: Ground plane     (parallax 0.8x)
 * Layer 3: Near foreground  (parallax 1.2x, sparse overlay)
 *
 * Layers are added to the background rendering layer.
 * Call `resize()` when the canvas resizes to keep proportions correct.
 */

interface ParallaxLayer {
  sprite: Sprite | TilingSprite;
  factor: number;
}

export class ParallaxBackground {
  private readonly layers: ParallaxLayer[] = [];
  private readonly container: Container;

  constructor(backgroundLayer: Container) {
    this.container = new Container();
    this.container.label = "parallax";
    backgroundLayer.addChild(this.container);
  }

  /** Build all parallax layers from loaded environment textures. */
  init(canvasWidth: number, canvasHeight: number): void {

    // Layer 0: Far wall (full screen, tiling)
    const wall = this.createTilingLayer("cellar_layer0", 0.1, 0, 0, canvasWidth, canvasHeight);
    wall.sprite.alpha = 0.7; // Desaturated feel

    // Layer 1: Shelves (upper 70% of screen)
    this.createTilingLayer("cellar_layer1", 0.4, 0, 0, canvasWidth, canvasHeight * 0.7);

    // Layer 2: Ground plane (bottom 20% of screen)
    const groundY = canvasHeight * 0.85;
    this.createTilingLayer("cellar_layer2", 0.8, 0, groundY, canvasWidth, canvasHeight - groundY);

    // Layer 3: Near foreground elements (sparse, in front of gameplay)
    const beam = this.createSpriteLayer("cellar_layer3_beam", 1.2);
    beam.sprite.x = canvasWidth * 0.15;
    beam.sprite.y = canvasHeight * 0.08;
    beam.sprite.alpha = 0.35;
    beam.sprite.width = canvasWidth * 0.3;
    beam.sprite.height = canvasHeight * 0.04;
  }

  private createTilingLayer(
    textureAlias: string,
    factor: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): ParallaxLayer {
    const texture = getEnvTexture(textureAlias);
    const sprite = new TilingSprite({ texture, width, height });
    sprite.x = x;
    sprite.y = y;
    this.container.addChild(sprite);
    const layer = { sprite, factor };
    this.layers.push(layer);
    return layer;
  }

  private createSpriteLayer(textureAlias: string, factor: number): ParallaxLayer {
    const texture = getEnvTexture(textureAlias);
    const sprite = new Sprite(texture);
    this.container.addChild(sprite);
    const layer = { sprite, factor };
    this.layers.push(layer);
    return layer;
  }

  /**
   * Update parallax positions based on a camera offset.
   * For now the camera is static, but this supports future scrolling.
   */
  update(cameraX: number = 0): void {
    for (const layer of this.layers) {
      if (layer.sprite instanceof TilingSprite) {
        layer.sprite.tilePosition.x = -cameraX * layer.factor;
      } else {
        // Offset sprite layers
        layer.sprite.x += -cameraX * layer.factor * 0.01;
      }
    }
  }

  /** Handle canvas resize. */
  resize(canvasWidth: number, canvasHeight: number): void {
    this.container.removeChildren();
    this.layers.length = 0;
    this.init(canvasWidth, canvasHeight);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
