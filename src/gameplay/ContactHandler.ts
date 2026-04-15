import type { Contact, ContactImpulse } from "planck";
import type { Body } from "planck";
import type { Block, BlockUserData } from "../entities/Block.js";
import type { Rat, RatUserData } from "../entities/Rat.js";
import type { Engine } from "../engine/Engine.js";
import type { GameState } from "./GameState.js";
import type { ScreenShake } from "./ScreenShake.js";
import { audioManager } from "../audio/AudioManager.js";
import {
  CHEESE_CRUMB_CONFIG,
  IMPACT_SPARK_CONFIG,
  WOOD_SPLINTER_CONFIG,
  HIT_STAR_CONFIG,
  DESTRUCTION_FLASH_CONFIG,
  HEAVY_DUST_CONFIG,
  HEAVY_WOOD_CONFIG,
  CHEESE_DEBRIS_CONFIG,
  RAT_KILL_BURST_CONFIG,
  HEAVY_STONE_CONFIG,
  STONE_CHIP_CONFIG,
  STONE_DUST_CONFIG,
} from "../engine/vfx/ParticleEmitter.js";

import type { BrieProjectile } from "./BrieProjectile.js";

interface CheeseUserData {
  type: "cheese";
  cheeseType?: "brie";
  brie?: BrieProjectile;
}

type EntityUserData = BlockUserData | RatUserData | CheeseUserData | null | undefined;

function getMaxImpulse(impulse: ContactImpulse): number {
  const normals = impulse.normalImpulses;
  let max = 0;
  for (let i = 0; i < normals.length; i++) {
    const v = normals[i];
    if (v !== undefined && v > max) max = v;
  }
  return max;
}

function getUserData(body: Body): EntityUserData {
  return body.getUserData() as EntityUserData;
}

/**
 * Registers Planck post-solve listener to handle:
 * - Block fracture (cumulative impulse > threshold)
 * - Rat death (cheese hit > 15, block crush > 10)
 * - Screen shake on heavy impacts
 * - Enhanced destruction VFX
 */
export function setupContactHandler(engine: Engine, state: GameState, screenShake?: ScreenShake): void {
  const pendingBlockDestroys: Block[] = [];
  const pendingRatKills: Rat[] = [];

  engine.physics.world.on("post-solve", (_contact: Contact, impulse: ContactImpulse) => {
    const maxImpulse = getMaxImpulse(impulse);
    if (maxImpulse < 0.5) return; // ignore trivial contacts

    const bodyA = _contact.getFixtureA().getBody();
    const bodyB = _contact.getFixtureB().getBody();
    const udA = getUserData(bodyA);
    const udB = getUserData(bodyB);

    // Cheese impact SFX + VFX on significant collision
    if (maxImpulse > 5) {
      if (udA?.type === "cheese" || udB?.type === "cheese") {
        audioManager.playSfx("cheeseImpact");

        // Spawn impact sparks at contact point
        const cheeseBody = udA?.type === "cheese" ? bodyA : bodyB;
        const cPos = cheeseBody.getPosition();
        const cScreen = engine.worldToScreenPos(cPos.x, cPos.y);
        engine.particles.emit(cScreen.x, cScreen.y, IMPACT_SPARK_CONFIG);
        if (maxImpulse > 10) {
          engine.particles.emit(cScreen.x, cScreen.y, CHEESE_CRUMB_CONFIG);
        }
      }

    }

    // Brie first-contact lockout: any significant contact locks out the split ability
    if (udA?.type === "cheese" && udA.cheeseType === "brie" && udA.brie) {
      udA.brie.onFirstContact();
    }
    if (udB?.type === "cheese" && udB.cheeseType === "brie" && udB.brie) {
      udB.brie.onFirstContact();
    }

    // All damage/effects suppressed during settling grace period
    if (!state.isSettling()) {
      // Screen shake on heavy impacts
      if (maxImpulse > 5) {
        screenShake?.triggerFromImpulse(maxImpulse);
      }

      // Block damage
      if (udA?.type === "block") {
        if (udA.block.applyImpulse(maxImpulse)) {
          pendingBlockDestroys.push(udA.block);
        }
      }
      if (udB?.type === "block") {
        if (udB.block.applyImpulse(maxImpulse)) {
          pendingBlockDestroys.push(udB.block);
        }
      }

      // Rat death
      checkRatDeath(udA, udB, maxImpulse, pendingRatKills);
      checkRatDeath(udB, udA, maxImpulse, pendingRatKills);
    }
  });

  // Process pending destroys outside the solver callback
  engine.physics.world.on("end-contact", () => {
    processPending(engine, state, pendingBlockDestroys, pendingRatKills);
  });

  // Also process after each step via a pre-solve as a safety net
  const originalStep = engine.physics.step.bind(engine.physics);
  engine.physics.step = (dt: number) => {
    originalStep(dt);
    state.tickSettling();
    processPending(engine, state, pendingBlockDestroys, pendingRatKills);
  };
}

function checkRatDeath(
  udTarget: EntityUserData,
  udOther: EntityUserData,
  impulse: number,
  pending: Rat[],
): void {
  if (udTarget?.type !== "rat" || !udTarget.rat.alive) return;

  // Direct cheese hit threshold: 0.5 (any contact kills)
  if (udOther?.type === "cheese" && impulse > 0.5) {
    pending.push(udTarget.rat);
    return;
  }
  // Crushed by block threshold: 0.5 (any falling block kills)
  if (udOther?.type === "block" && impulse > 0.5) {
    pending.push(udTarget.rat);
    return;
  }
  // Any large hit (e.g. ground slam)
  if (impulse > 1.5) {
    pending.push(udTarget.rat);
  }
}

function processPending(
  engine: Engine,
  state: GameState,
  blocks: Block[],
  rats: Rat[],
): void {
  while (blocks.length > 0) {
    const block = blocks.pop()!;
    if (block.destroyed) continue;
    block.destroyed = true;

    // Spawn enhanced VFX at block position
    const bPos = block.body.getPosition();
    const bScreen = engine.worldToScreenPos(bPos.x, bPos.y);

    // Flash at impact point
    engine.particles.emit(bScreen.x, bScreen.y, DESTRUCTION_FLASH_CONFIG);

    // Material-specific debris
    if (block.material === "stone") {
      engine.particles.emit(bScreen.x, bScreen.y, HEAVY_STONE_CONFIG);
      engine.particles.emit(bScreen.x, bScreen.y, STONE_CHIP_CONFIG);
      engine.particles.emit(bScreen.x, bScreen.y, STONE_DUST_CONFIG);
    } else if (block.material === "wood") {
      engine.particles.emit(bScreen.x, bScreen.y, HEAVY_WOOD_CONFIG);
      engine.particles.emit(bScreen.x, bScreen.y, WOOD_SPLINTER_CONFIG);
      engine.particles.emit(bScreen.x, bScreen.y, HEAVY_DUST_CONFIG);
    } else {
      // cheese_crate or default
      engine.particles.emit(bScreen.x, bScreen.y, CHEESE_DEBRIS_CONFIG);
      engine.particles.emit(bScreen.x, bScreen.y, HEAVY_DUST_CONFIG);
    }

    state.onBlockDestroyed(block, bPos.x, bPos.y);
    engine.removeEntity(block);
  }

  while (rats.length > 0) {
    const rat = rats.pop()!;
    if (!rat.alive) continue;
    const pos = rat.body.getPosition();

    // Spawn celebratory burst around rat
    const rScreen = engine.worldToScreenPos(pos.x, pos.y);
    engine.particles.emit(rScreen.x, rScreen.y, RAT_KILL_BURST_CONFIG);
    engine.particles.emit(rScreen.x, rScreen.y, HIT_STAR_CONFIG);
    engine.particles.emit(rScreen.x, rScreen.y, DESTRUCTION_FLASH_CONFIG);

    state.onRatKilled(rat, pos.x, pos.y);
    rat.kill();
  }
}
