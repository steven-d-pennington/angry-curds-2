import { Container, Graphics, Sprite } from "pixi.js";
import { getFrame } from "../AssetLoader.js";

/**
 * Lightweight particle emitter for VFX: cheese crumbs, dust puffs,
 * impact sparks, wood splinters, and hit stars.
 *
 * Each emitter spawns particles from a world-space origin and lets them
 * evolve with velocity, gravity, rotation, fade, and scale over lifetime.
 */

export interface ParticleConfig {
  /** Texture frame names to randomly pick from (from VFX atlas). */
  frameNames: string[];
  /** Number of particles to emit per burst. */
  count: number;
  /** Particle lifetime in seconds. */
  lifetime: number;
  /** Speed range [min, max] in pixels/s. */
  speed: [number, number];
  /** Angle range [min, max] in radians. Particles are emitted in this cone. */
  angleRange: [number, number];
  /** Gravity in px/s² (positive = down in screen space). */
  gravity: number;
  /** Start scale. */
  scaleStart: number;
  /** End scale (lerped over lifetime). */
  scaleEnd: number;
  /** Start alpha. */
  alphaStart: number;
  /** End alpha. */
  alphaEnd: number;
  /** Rotation speed in rad/s (randomized ±). */
  rotationSpeed: number;
}

interface Particle {
  sprite: Sprite | Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  scaleStart: number;
  scaleEnd: number;
  alphaStart: number;
  alphaEnd: number;
  rotSpeed: number;
}

export class ParticleEmitter {
  private readonly container: Container;
  private particles: Particle[] = [];

  constructor(vfxLayer: Container) {
    this.container = new Container();
    this.container.label = "particles";
    vfxLayer.addChild(this.container);
  }

  /**
   * Emit a burst of particles at the given screen position.
   */
  emit(screenX: number, screenY: number, config: ParticleConfig): void {
    for (let i = 0; i < config.count; i++) {
      const frameName = config.frameNames[Math.floor(Math.random() * config.frameNames.length)]!;
      const texture = getFrame(frameName);

      let visual: Sprite | Graphics;
      if (texture.label === "EMPTY" || !texture.source) {
        // Fallback: small colored circle
        const g = new Graphics();
        g.circle(0, 0, 3);
        g.fill({ color: 0xffb833 });
        visual = g;
      } else {
        visual = new Sprite(texture);
        visual.anchor.set(0.5);
      }

      visual.x = screenX;
      visual.y = screenY;

      const angle = config.angleRange[0] + Math.random() * (config.angleRange[1] - config.angleRange[0]);
      const speed = config.speed[0] + Math.random() * (config.speed[1] - config.speed[0]);

      const particle: Particle = {
        sprite: visual,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: config.lifetime,
        maxLife: config.lifetime,
        gravity: config.gravity,
        scaleStart: config.scaleStart,
        scaleEnd: config.scaleEnd,
        alphaStart: config.alphaStart,
        alphaEnd: config.alphaEnd,
        rotSpeed: (Math.random() - 0.5) * 2 * config.rotationSpeed,
      };

      visual.scale.set(config.scaleStart);
      visual.alpha = config.alphaStart;
      this.container.addChild(visual);
      this.particles.push(particle);
    }
  }

  /** Update all active particles. Call once per frame. */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;

      if (p.life <= 0) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
        continue;
      }

      const t = 1 - p.life / p.maxLife;

      p.vy += p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.rotSpeed * dt;
      const scale = p.scaleStart + (p.scaleEnd - p.scaleStart) * t;
      p.sprite.scale.set(scale);
      p.sprite.alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * t;
    }
  }

  destroy(): void {
    for (const p of this.particles) p.sprite.destroy();
    this.particles.length = 0;
    this.container.destroy();
  }
}

// --- Preset particle configs ---

export const CHEESE_CRUMB_CONFIG: ParticleConfig = {
  frameNames: ["cheese_crumb_01", "cheese_crumb_02", "cheese_crumb_03"],
  count: 6,
  lifetime: 0.8,
  speed: [40, 100],
  angleRange: [-Math.PI, 0], // upward burst
  gravity: 200,
  scaleStart: 1.0,
  scaleEnd: 0.3,
  alphaStart: 1.0,
  alphaEnd: 0.0,
  rotationSpeed: 3.0,
};

export const DUST_PUFF_CONFIG: ParticleConfig = {
  frameNames: ["dust_puff_01", "dust_puff_02", "dust_puff_03", "dust_puff_04"],
  count: 4,
  lifetime: 0.6,
  speed: [20, 50],
  angleRange: [-Math.PI, 0],
  gravity: -10,
  scaleStart: 0.5,
  scaleEnd: 1.5,
  alphaStart: 0.7,
  alphaEnd: 0.0,
  rotationSpeed: 1.0,
};

export const IMPACT_SPARK_CONFIG: ParticleConfig = {
  frameNames: ["impact_spark_01", "impact_spark_02", "impact_spark_03"],
  count: 5,
  lifetime: 0.4,
  speed: [60, 140],
  angleRange: [0, Math.PI * 2],
  gravity: 100,
  scaleStart: 1.0,
  scaleEnd: 0.1,
  alphaStart: 1.0,
  alphaEnd: 0.0,
  rotationSpeed: 5.0,
};

export const WOOD_SPLINTER_CONFIG: ParticleConfig = {
  frameNames: ["wood_splinter_01", "wood_splinter_02"],
  count: 4,
  lifetime: 0.7,
  speed: [30, 80],
  angleRange: [-Math.PI, 0],
  gravity: 180,
  scaleStart: 1.0,
  scaleEnd: 0.5,
  alphaStart: 1.0,
  alphaEnd: 0.2,
  rotationSpeed: 4.0,
};

export const HIT_STAR_CONFIG: ParticleConfig = {
  frameNames: ["star_01"],
  count: 5,
  lifetime: 0.6,
  speed: [20, 50],
  angleRange: [-Math.PI * 0.85, -Math.PI * 0.15], // wider upward arc
  gravity: -5,
  scaleStart: 1.0,
  scaleEnd: 0.2,
  alphaStart: 1.0,
  alphaEnd: 0.0,
  rotationSpeed: 3.0,
};

/** Bright flash/glow burst at point of destruction. */
export const DESTRUCTION_FLASH_CONFIG: ParticleConfig = {
  frameNames: ["dust_puff_01", "dust_puff_02"],
  count: 3,
  lifetime: 0.15,
  speed: [5, 15],
  angleRange: [0, Math.PI * 2],
  gravity: 0,
  scaleStart: 2.0,
  scaleEnd: 0.1,
  alphaStart: 0.9,
  alphaEnd: 0.0,
  rotationSpeed: 0,
};

/** Enhanced dust cloud for block destruction — more particles, bigger spread. */
export const HEAVY_DUST_CONFIG: ParticleConfig = {
  frameNames: ["dust_puff_01", "dust_puff_02", "dust_puff_03", "dust_puff_04"],
  count: 8,
  lifetime: 0.8,
  speed: [30, 80],
  angleRange: [-Math.PI, 0],
  gravity: -8,
  scaleStart: 0.6,
  scaleEnd: 2.0,
  alphaStart: 0.8,
  alphaEnd: 0.0,
  rotationSpeed: 1.5,
};

/** Debris chunks for wood blocks — heavier, more pieces. */
export const HEAVY_WOOD_CONFIG: ParticleConfig = {
  frameNames: ["wood_splinter_01", "wood_splinter_02"],
  count: 8,
  lifetime: 0.9,
  speed: [50, 130],
  angleRange: [-Math.PI * 0.9, -Math.PI * 0.1],
  gravity: 250,
  scaleStart: 1.2,
  scaleEnd: 0.4,
  alphaStart: 1.0,
  alphaEnd: 0.1,
  rotationSpeed: 6.0,
};

/** Cheese debris for cheese_crate block destruction. */
export const CHEESE_DEBRIS_CONFIG: ParticleConfig = {
  frameNames: ["cheese_crumb_01", "cheese_crumb_02", "cheese_crumb_03"],
  count: 8,
  lifetime: 0.9,
  speed: [40, 110],
  angleRange: [-Math.PI * 0.9, -Math.PI * 0.1],
  gravity: 220,
  scaleStart: 1.1,
  scaleEnd: 0.3,
  alphaStart: 1.0,
  alphaEnd: 0.1,
  rotationSpeed: 5.0,
};

/** Big burst of stars for rat kill — more celebratory. */
export const RAT_KILL_BURST_CONFIG: ParticleConfig = {
  frameNames: ["star_01", "impact_spark_01", "impact_spark_02"],
  count: 10,
  lifetime: 0.7,
  speed: [40, 100],
  angleRange: [0, Math.PI * 2], // full radial burst
  gravity: 60,
  scaleStart: 1.0,
  scaleEnd: 0.1,
  alphaStart: 1.0,
  alphaEnd: 0.0,
  rotationSpeed: 4.0,
};

/** Satisfying burst at slingshot release point. */
export const LAUNCH_BURST_CONFIG: ParticleConfig = {
  frameNames: ["impact_spark_01", "impact_spark_02", "impact_spark_03"],
  count: 8,
  lifetime: 0.35,
  speed: [50, 120],
  angleRange: [0, Math.PI * 2],
  gravity: 50,
  scaleStart: 0.8,
  scaleEnd: 0.1,
  alphaStart: 0.9,
  alphaEnd: 0.0,
  rotationSpeed: 6.0,
};

/** Angular stone chip debris for stone block destruction. */
export const STONE_CHIP_CONFIG: ParticleConfig = {
  frameNames: ["stone_chip_01", "stone_chip_02", "stone_chip_03"],
  count: 6,
  lifetime: 0.8,
  speed: [50, 130],
  angleRange: [-Math.PI * 0.9, -Math.PI * 0.1],
  gravity: 280,
  scaleStart: 1.2,
  scaleEnd: 0.4,
  alphaStart: 1.0,
  alphaEnd: 0.2,
  rotationSpeed: 5.0,
};

/** Heavy stone debris burst — more pieces, heavier gravity than wood. */
export const HEAVY_STONE_CONFIG: ParticleConfig = {
  frameNames: ["stone_chip_01", "stone_chip_02", "stone_chip_03"],
  count: 10,
  lifetime: 1.0,
  speed: [60, 150],
  angleRange: [-Math.PI * 0.85, -Math.PI * 0.15],
  gravity: 300,
  scaleStart: 1.4,
  scaleEnd: 0.3,
  alphaStart: 1.0,
  alphaEnd: 0.1,
  rotationSpeed: 7.0,
};

/** Heavy gray-brown dust cloud for stone destruction — denser than wood dust. */
export const STONE_DUST_CONFIG: ParticleConfig = {
  frameNames: ["stone_dust_01", "stone_dust_02"],
  count: 10,
  lifetime: 1.0,
  speed: [25, 70],
  angleRange: [-Math.PI, 0],
  gravity: -5,
  scaleStart: 0.7,
  scaleEnd: 2.5,
  alphaStart: 0.9,
  alphaEnd: 0.0,
  rotationSpeed: 1.0,
};

/** Speed trail particles emitted behind launched cheese during flight. */
export const SPEED_TRAIL_CONFIG: ParticleConfig = {
  frameNames: ["dust_puff_01", "dust_puff_02"],
  count: 2,
  lifetime: 0.2,
  speed: [5, 15],
  angleRange: [0, Math.PI * 2],
  gravity: 0,
  scaleStart: 0.4,
  scaleEnd: 0.1,
  alphaStart: 0.5,
  alphaEnd: 0.0,
  rotationSpeed: 0,
};
