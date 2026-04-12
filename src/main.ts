import { Engine } from "./engine/Engine.js";
import { Entity } from "./engine/entities/Entity.js";
import { Graphics } from "pixi.js";
import { Vec2, Circle } from "planck";

// Reset default page styles so the canvas fills the window
document.documentElement.style.margin = "0";
document.documentElement.style.padding = "0";
document.documentElement.style.overflow = "hidden";
document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.overflow = "hidden";

async function main(): Promise<void> {
  const engine = await Engine.create({
    viewportWidth: 20,
    viewportHeight: 12,
    groundY: 1,
    groundWidth: 40,
  });

  // --- Demo: spawn a test circle that falls under gravity ---
  const testBody = engine.physics.createBody({
    type: "dynamic",
    position: Vec2(10, 10), // Center-ish, near top
    bullet: false,
  });
  testBody.createFixture({
    shape: new Circle(0.5), // 0.5m radius
    density: 1,
    restitution: 0.5,
    friction: 0.3,
  });

  const radiusPx = engine.metersToPixels(0.5);
  const circle = new Graphics();
  circle.circle(0, 0, radiusPx);
  circle.fill({ color: 0xffcc00 });
  engine.getLayer("entities").addChild(circle);

  const testEntity = new Entity(testBody, circle);
  engine.addEntity(testEntity);

  // Toggle debug draw with 'D' key
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "d" || e.key === "D") {
      engine.debugDraw.toggle();
    }
  });

  engine.start();
}

main().catch(console.error);
