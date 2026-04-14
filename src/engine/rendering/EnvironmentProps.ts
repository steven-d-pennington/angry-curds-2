import { Container, Graphics } from "pixi.js";

/**
 * Non-interactive decorative props placed in the cellar scene.
 * Drawn procedurally with Graphics to avoid needing extra asset files.
 * Added to the background layer, behind structures and entities.
 */
export class EnvironmentProps {
  private readonly container: Container;

  constructor(layer: Container) {
    this.container = new Container();
    this.container.label = "env_props";
    layer.addChild(this.container);
  }

  /** Place all decorative props relative to canvas dimensions. */
  init(cw: number, ch: number, groundScreenY: number): void {
    this.drawBarrel(cw * 0.04, groundScreenY, cw, ch);
    this.drawBarrel(cw * 0.92, groundScreenY, cw, ch);
    this.drawCheeseCrumbs(cw, groundScreenY);
    this.drawCobwebs(cw, ch);
    this.drawSmallRocks(cw, groundScreenY);
  }

  /** A simple wooden barrel sitting on the ground. */
  private drawBarrel(x: number, groundY: number, cw: number, _ch: number): void {
    const g = new Graphics();
    const bw = cw * 0.035;
    const bh = bw * 1.3;
    const bx = x;
    const by = groundY - bh;

    // Barrel body
    g.roundRect(bx, by, bw, bh, bw * 0.15);
    g.fill({ color: 0x8b6914 });

    // Metal bands
    const bandH = bh * 0.06;
    for (const ratio of [0.15, 0.5, 0.85]) {
      g.rect(bx - 1, by + bh * ratio - bandH / 2, bw + 2, bandH);
      g.fill({ color: 0x5a5a5a });
    }

    // Barrel stave lines
    g.moveTo(bx + bw * 0.33, by + 2);
    g.lineTo(bx + bw * 0.33, by + bh - 2);
    g.stroke({ color: 0x7a5c10, width: 1, alpha: 0.4 });

    g.moveTo(bx + bw * 0.66, by + 2);
    g.lineTo(bx + bw * 0.66, by + bh - 2);
    g.stroke({ color: 0x7a5c10, width: 1, alpha: 0.4 });

    g.alpha = 0.7;
    this.container.addChild(g);
  }

  /** Scatter small cheese crumbs near the ground. */
  private drawCheeseCrumbs(cw: number, groundY: number): void {
    const g = new Graphics();
    // Deterministic placement for consistency
    const crumbs = [
      { x: 0.15, size: 4, alpha: 0.5 },
      { x: 0.22, size: 3, alpha: 0.4 },
      { x: 0.35, size: 5, alpha: 0.55 },
      { x: 0.42, size: 2, alpha: 0.35 },
      { x: 0.58, size: 4, alpha: 0.45 },
      { x: 0.65, size: 3, alpha: 0.5 },
      { x: 0.73, size: 5, alpha: 0.4 },
      { x: 0.78, size: 2, alpha: 0.45 },
      { x: 0.85, size: 3, alpha: 0.35 },
    ];

    for (const c of crumbs) {
      const cx = cw * c.x;
      const cy = groundY - c.size * 0.5 - 2;
      // Irregular cheese crumb shape
      g.circle(cx, cy, c.size);
      g.fill({ color: 0xf5d442, alpha: c.alpha });
      // Darker hole detail on larger crumbs
      if (c.size >= 4) {
        g.circle(cx + 1, cy - 1, c.size * 0.25);
        g.fill({ color: 0xe0b820, alpha: c.alpha * 0.7 });
      }
    }

    this.container.addChild(g);
  }

  /** Draw cobwebs in the upper corners. */
  private drawCobwebs(cw: number, _ch: number): void {
    // Upper-left cobweb
    this.drawCobweb(0, 0, 1, 1, cw);
    // Upper-right cobweb
    this.drawCobweb(cw, 0, -1, 1, cw);
  }

  private drawCobweb(ox: number, oy: number, dx: number, dy: number, cw: number): void {
    const g = new Graphics();
    const size = cw * 0.06;

    // Radial strands
    const strands = 5;
    for (let i = 0; i <= strands; i++) {
      const t = i / strands;
      const ex = ox + dx * size * (1 - t);
      const ey = oy + dy * size * t;
      g.moveTo(ox, oy);
      g.lineTo(ex, ey);
    }
    g.stroke({ color: 0xcccccc, width: 1, alpha: 0.15 });

    // Concentric arcs
    for (const r of [0.3, 0.6, 0.9]) {
      const arcSize = size * r;
      g.moveTo(ox + dx * arcSize, oy + dy * arcSize * 0.05);
      g.quadraticCurveTo(
        ox + dx * arcSize * 0.5, oy + dy * arcSize * 0.5,
        ox + dx * arcSize * 0.05, oy + dy * arcSize,
      );
      g.stroke({ color: 0xcccccc, width: 0.8, alpha: 0.12 });
    }

    this.container.addChild(g);
  }

  /** Small scattered rocks near the ground line for edge detail. */
  private drawSmallRocks(cw: number, groundY: number): void {
    const g = new Graphics();
    const rocks = [
      { x: 0.08, s: 3 },
      { x: 0.18, s: 4 },
      { x: 0.31, s: 2 },
      { x: 0.47, s: 3 },
      { x: 0.56, s: 5 },
      { x: 0.69, s: 3 },
      { x: 0.82, s: 4 },
      { x: 0.95, s: 2 },
    ];

    for (const r of rocks) {
      const rx = cw * r.x;
      const ry = groundY - r.s * 0.3;
      g.ellipse(rx, ry, r.s * 1.2, r.s * 0.7);
      g.fill({ color: 0x6b6b6b, alpha: 0.4 });
    }

    this.container.addChild(g);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
