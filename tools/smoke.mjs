// Headless smoke test: build the world, drive the player around for 20 simulated seconds while
// firing, then report counters. Any exception fails the process with a non-zero exit.

import { createWorld, step, drainEvents, saveSnapshot, loadSnapshot, startMission } from '../game/src/world.js';

const world = createWorld({ seed: 20261119 });
let thrown = 0;
const controls = { x: 1, y: 0, run: true, aim: 0, throttle: 0, steer: 0, brake: false, shoot: false };
for (let frame = 0; frame < 1200; frame += 1) {
  controls.x = Math.cos(frame / 90);
  controls.y = Math.sin(frame / 70);
  controls.aim = Math.atan2(Math.sin(frame / 40), Math.cos(frame / 40));
  controls.shoot = frame > 240 && frame < 300;
  try {
    step(world, 1 / 60, controls);
  } catch (error) {
    thrown += 1;
    console.error('frame', frame, error instanceof Error ? error.stack : String(error));
    break;
  }
  if (frame === 600) startMission(world);
  drainEvents(world);
}
const snapshot = saveSnapshot(world);
const restored = loadSnapshot(world, snapshot);
console.log(JSON.stringify({
  thrown,
  cars: world.cars.length,
  peds: world.peds.length,
  bullets: world.bullets.length,
  particles: world.particles.length,
  wanted: world.wanted.stars,
  missionStep: world.mission.step,
  money: world.player.money,
  health: Math.round(world.player.health),
  restored,
  distance: Math.round(world.stats.distance),
}, null, 2));
process.exit(thrown === 0 ? 0 : 1);
