import { Container, Graphics, Sprite, TilingSprite } from "pixi.js";
import { getEnvTexture } from "../AssetLoader.js";

/**
 * Multi-layer parallax background for the cheese cellar environment.
 *
 * Layer 0: Far stone wall      (parallax 0.1x)
 * Layer 1: Shelving units      (parallax 0.4x)
 * Layer 2: Ground plane        (parallax 0.8x)
 * Layer 3: Near foreground     (parallax 1.2x, sparse overlay)
 * + Light shafts and dust mote overlays for atmosphere
 *
 * Layers are added to the background rendering layer.
 * Call `resize()` when the canvas resizes to keep proportions correct.
 */

interface ParallaxLayer {
  sprite: Sprite | TilingSprite;
  factor: number;
}

/** A single floating dust mote for atmospheric effect. */
interface DustMote {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  alphaDir: number;
  radius: number;
}

export class ParallaxBackground {
  private readonly layers: ParallaxLayer[] = [];
  private readonly container: Container;
  private readonly dustMotes: DustMote[] = [];
  private dustContainer: Container | null = null;
  private cw = 0;
  private ch = 0;

  constructor(backgroundLayer: Container) {
    this.container = new Container();
    this.container.label = "parallax";
    backgroundLayer.addChild(this.container);
  }

  /** Build all parallax layers from loaded environment textures. */
  init(canvasWidth: number, canvasHeight: number): void {
    this.cw = canvasWidth;
    this.ch = canvasHeight;

    // Layer 0: Far wall (full screen, tiling)
    const wall = this.createTilingLayer("cellar_layer0", 0.1, 0, 0, canvasWidth, canvasHeight);
    wall.sprite.alpha = 0.7;

    // Light shafts from cellar windows (between wall and shelves)
    this.createLightShafts(canvasWidth, canvasHeight);

    // Layer 1: Shelves (upper 70% of screen)
    const shelves = this.createTilingLayer("cellar_layer1", 0.4, 0, 0, canvasWidth, canvasHeight * 0.7);
    shelves.sprite.alpha = 0.85;

    // Layer 2: Ground plane (bottom 15% of screen — cellar floor)
    const groundY = canvasHeight * 0.85;
    this.createTilingLayer("cellar_layer2", 0.8, 0, groundY, canvasWidth, canvasHeight - groundY);

    // Layer 3: Near foreground elements (sparse, in front of gameplay)
    // Beam across the top
    const beam = this.createSpriteLayer("cellar_layer3_beam", 1.2);
    beam.sprite.x = canvasWidth * 0.12;
    beam.sprite.y = canvasHeight * 0.06;
    beam.sprite.alpha = 0.3;
    beam.sprite.width = canvasWidth * 0.35;
    beam.sprite.height = canvasHeight * 0.035;

    // Pipe on the right side (uses the loaded but previously unused pipe texture)
    const pipe = this.createSpriteLayer("cellar_layer3_pipe", 1.1);
    pipe.sprite.x = canvasWidth * 0.88;
    pipe.sprite.y = canvasHeight * 0.02;
    pipe.sprite.alpha = 0.25;
    pipe.sprite.width = canvasWidth * 0.03;
    pipe.sprite.height = canvasHeight * 0.55;

    // Second beam on upper right for balance
    const beam2 = this.createSpriteLayer("cellar_layer3_beam", 1.15);
    beam2.sprite.x = canvasWidth * 0.55;
    beam2.sprite.y = canvasHeight * 0.03;
    beam2.sprite.alpha = 0.2;
    beam2.sprite.width = canvasWidth * 0.28;
    beam2.sprite.height = canvasHeight * 0.03;

    // Floating dust motes for atmosphere
    this.initDustMotes(canvasWidth, canvasHeight);
  }

  /** Draw angled light shafts to simulate cellar window light. */
  private createLightShafts(cw: number, ch: number): void {
    const shafts = new Graphics();

    // Two diagonal light shafts from upper-left (as if from cellar windows)
    const shaftData = [
      { x: cw * 0.2, w: cw * 0.08, alpha: 0.06 },
      { x: cw * 0.38, w: cw * 0.12, alpha: 0.04 },
      { x: cw * 0.7, w: cw * 0.06, alpha: 0.03 },
    ];

    for (const s of shaftData) {
      shafts.moveTo(s.x, 0);
      shafts.lineTo(s.x + s.w, 0);
      shafts.lineTo(s.x + s.w * 1.8, ch);
      shafts.lineTo(s.x + s.w * 0.8, ch);
      shafts.closePath();
      shafts.fill({ color: 0xffe8b0, alpha: s.alpha });
    }

    this.container.addChild(shafts);
  }

  /** Create floating dust motes that drift through the scene. */
  private initDustMotes(cw: number, ch: number): void {
    this.dustContainer = new Container();
    this.dustContainer.label = "dust";
    this.container.addChild(this.dustContainer);

    const count = Math.floor((cw * ch) / 25000); // Scale with screen size
    for (let i = 0; i < count; i++) {
      const radius = 1 + Math.random() * 2;
      const gfx = new Graphics();
      gfx.circle(0, 0, radius);
      gfx.fill({ color: 0xffe8b0 });

      const mote: DustMote = {
        gfx,
        x: Math.random() * cw,
        y: Math.random() * ch,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.1 - Math.random() * 0.15,
        alpha: Math.random() * 0.3,
        alphaDir: (Math.random() > 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.004),
        radius,
      };

      gfx.x = mote.x;
      gfx.y = mote.y;
      gfx.alpha = mote.alpha;

      this.dustContainer.addChild(gfx);
      this.dustMotes.push(mote);
    }
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
   * Update parallax positions and animate dust motes.
   * For now the camera is static, but this supports future scrolling.
   */
  update(cameraX: number = 0): void {
    for (const layer of this.layers) {
      if (layer.sprite instanceof TilingSprite) {
        layer.sprite.tilePosition.x = -cameraX * layer.factor;
      } else {
        layer.sprite.x += -cameraX * layer.factor * 0.01;
      }
    }

    // Animate dust motes
    for (const mote of this.dustMotes) {
      mote.x += mote.vx;
      mote.y += mote.vy;
      mote.alpha += mote.alphaDir;

      // Wrap around screen edges
      if (mote.x < -5) mote.x = this.cw + 5;
      if (mote.x > this.cw + 5) mote.x = -5;
      if (mote.y < -5) {
        mote.y = this.ch + 5;
        mote.x = Math.random() * this.cw;
      }
      if (mote.y > this.ch + 5) mote.y = -5;

      // Oscillate alpha
      if (mote.alpha > 0.35 || mote.alpha < 0.02) {
        mote.alphaDir = -mote.alphaDir;
      }

      mote.gfx.x = mote.x;
      mote.gfx.y = mote.y;
      mote.gfx.alpha = mote.alpha;
    }
  }

  /** Handle canvas resize. */
  resize(canvasWidth: number, canvasHeight: number): void {
    this.container.removeChildren();
    this.layers.length = 0;
    this.dustMotes.length = 0;
    this.dustContainer = null;
    this.init(canvasWidth, canvasHeight);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
