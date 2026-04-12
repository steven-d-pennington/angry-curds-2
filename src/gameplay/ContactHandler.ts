import type { Contact, ContactImpulse } from "planck";
import type { Body } from "planck";
import type { Block, BlockUserData } from "../entities/Block.js";
import type { Rat, RatUserData } from "../entities/Rat.js";
import type { Engine } from "../engine/Engine.js";
import type { GameState } from "./GameState.js";

interface CheeseUserData {
  type: "cheese";
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
 */
export function setupContactHandler(engine: Engine, state: GameState): void {
  const pendingBlockDestroys: Block[] = [];
  const pendingRatKills: Rat[] = [];

  engine.physics.world.on("post-solve", (_contact: Contact, impulse: ContactImpulse) => {
    const maxImpulse = getMaxImpulse(impulse);
    if (maxImpulse < 1) return; // ignore trivial contacts

    const bodyA = _contact.getFixtureA().getBody();
    const bodyB = _contact.getFixtureB().getBody();
    const udA = getUserData(bodyA);
    const udB = getUserData(bodyB);

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
  });

  // Process pending destroys outside the solver callback
  engine.physics.world.on("end-contact", () => {
    processPending(engine, state, pendingBlockDestroys, pendingRatKills);
  });

  // Also process after each step via a pre-solve as a safety net
  const originalStep = engine.physics.step.bind(engine.physics);
  engine.physics.step = (dt: number) => {
    originalStep(dt);
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

  // Direct cheese hit threshold: 15
  if (udOther?.type === "cheese" && impulse > 15) {
    pending.push(udTarget.rat);
    return;
  }
  // Crushed by block threshold: 10
  if (udOther?.type === "block" && impulse > 10) {
    pending.push(udTarget.rat);
    return;
  }
  // Any large hit (e.g. ground slam) — use block threshold
  if (impulse > 15) {
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
    state.onBlockDestroyed(block);
    engine.removeEntity(block);
  }

  while (rats.length > 0) {
    const rat = rats.pop()!;
    if (!rat.alive) continue;
    const pos = rat.body.getPosition();
    state.onRatKilled(rat, pos.x, pos.y);
    rat.kill();
  }
}
