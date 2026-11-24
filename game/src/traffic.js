// Traffic: the civilian cars that fill the grid. They follow the same node graph the player
// can learn, keep right, queue behind each other, speed up when a fight breaks out, and are
// recycled far from the camera so a small pool feels like a whole city.

import { CITY, LIMITS } from './config.js';
import { createVehicle, followRoute, steerVehicle, vehicleBlockedAhead } from './vehicle.js';

const TRAFFIC_KINDS = ['sedan', 'sedan', 'taxi', 'van', 'muscle', 'sports'];

export function spawnTrafficCar(world, nearX, nearY) {
  const city = world.city;
  let node = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = city.nodes[Math.floor(world.rng.next() * city.nodes.length)];
    const d = Math.hypot(candidate.x - nearX, candidate.y - nearY);
    if (d > 520 && d < 2100) {
      node = candidate;
      break;
    }
  }
  if (!node) node = city.nodes[Math.floor(world.rng.next() * city.nodes.length)];
  const kind = world.rng.pick(TRAFFIC_KINDS);
  const heading = world.rng.chance(0.5) ? 0 : Math.PI / 2;
  const car = createVehicle(world, kind, node.x + world.rng.range(-24, 24), node.y + world.rng.range(-24, 24), heading, {
    driver: 'ai',
    colour: world.rng.pick(world.rng.pick([1, 2, 3, 4]).toString()),
  });
  car.colour = world.rng.pick(car.spec.colours);
  car.patrol = false;
  return car;
}

export function populateTraffic(world) {
  const player = world.player;
  while (world.cars.filter((car) => car.driver === 'ai').length < LIMITS.traffic) {
    spawnTrafficCar(world, player.x, player.y);
  }
}

export function updateTraffic(world, dt) {
  const player = world.player;
  for (let i = 0; i < world.cars.length; i += 1) {
    const car = world.cars[i];
    if (car.dead || car.driver !== 'ai') continue;
    const away = Math.hypot(car.x - player.x, car.y - player.y);
    if (away > 2400) {
      const city = world.city;
      let node = city.nodes[Math.floor(world.rng.next() * city.nodes.length)];
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = city.nodes[Math.floor(world.rng.next() * city.nodes.length)];
        const d = Math.hypot(candidate.x - player.x, candidate.y - player.y);
        if (d > 700 && d < 1600) { node = candidate; break; }
      }
      car.x = node.x;
      car.y = node.y;
      car.vx = 0;
      car.vy = 0;
      car.ai = null;
      continue;
    }
    let speed = car.panic > 0 ? 250 : 122 + (car.id % 5) * 9;
    if (car.panic > 0) car.panic -= dt;
    if (vehicleBlockedAhead(world, car, 74)) speed = 0;
    if (speed < 40) {
      steerVehicle(world, car, car.x + Math.cos(car.angle) * 40, car.y + Math.sin(car.angle) * 40, 0, dt);
    } else {
      followRoute(world, car, dt, speed);
    }
  }
}

export function panicTraffic(world, x, y, radius) {
  for (const car of world.cars) {
    if (car.driver !== 'ai' || car.dead) continue;
    if (Math.hypot(car.x - x, car.y - y) < radius) car.panic = 4;
  }
}

export function clearTraffic(world) {
  world.cars = world.cars.filter((car) => car.driver !== 'ai');
}

export const TRAFFIC_POOL = LIMITS.traffic;
export const TRAFFIC_ROAD = CITY.road;
