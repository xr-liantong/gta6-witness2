// Vehicle bodies and physics: creation, the drift-aware drive model the player feels, a simple
// pursuit model for AI traffic and patrol cars, and the collisions that dent, spark and finally
// blow a car up. A car is a short cylinder to the collision grid, which keeps the city cheap.

import { CITY, VEHICLES } from './config.js';
import { clamp, resolveCircleRect, segmentRect, turnToward } from './collision.js';
import { laneOffset } from './city.js';

let nextVehicleId = 1;

export function createVehicle(world, kind, x, y, angle, options = {}) {
  const spec = VEHICLES[kind] ?? VEHICLES.sedan;
  const car = {
    id: nextVehicleId++,
    kind,
    spec,
    x, y, angle,
    vx: 0, vy: 0,
    r: spec.width / 2 + 2,
    health: spec.health,
    maxHealth: spec.health,
    colour: options.colour ?? world.rng.pick(spec.colours),
    driver: options.driver ?? null,
    ai: null,
    units: options.units ?? 0,
    dead: false,
    brake: false,
    siren: kind === 'police',
    steer: 0,
    hitFlash: 0,
    smokeTimer: 0,
    locked: options.locked ?? false,
    missionCar: options.missionCar ?? false,
  };
  world.cars.push(car);
  return car;
}

function collideWorld(world, car, dt) {
  let hit = false;
  for (let i = 0; i < world.city.solids.length; i += 1) {
    const rect = world.city.solids[i];
    if (car.x + 70 < rect.x || car.x - 70 > rect.x + rect.w || car.y + 70 < rect.y || car.y - 70 > rect.y + rect.h) continue;
    if (resolveCircleRect(car, rect) > 0) hit = true;
  }
  for (let i = 0; i < world.city.noGo.length; i += 1) {
    if (resolveCircleRect(car, world.city.noGo[i]) > 0) hit = true;
  }
  if (hit) {
    const speed = Math.hypot(car.vx, car.vy);
    car.vx *= -0.08;
    car.vy *= -0.08;
    if (speed > 120) {
      car.health -= ((speed - 120) / 9) * dt * 8;
      car.hitFlash = 0.2;
      world.events.push({ type: 'crash', x: car.x, y: car.y, power: clamp(speed / 420, 0.2, 1) });
      if (speed > 240) world.shake = Math.max(world.shake, 5);
    }
  }
  car.x = clamp(car.x, 12, world.city.worldWidth - 12);
  car.y = clamp(car.y, 12, world.city.worldHeight - 12);
}

function collideCars(world, car, dt) {
  for (let i = 0; i < world.cars.length; i += 1) {
    const other = world.cars[i];
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const min = car.r + other.r;
    const d2 = dx * dx + dy * dy;
    if (d2 > min * min || d2 < 0.0001) continue;
    const d = Math.sqrt(d2);
    const push = (min - d) / 2;
    const nx = dx / d;
    const ny = dy / d;
    car.x -= nx * push;
    car.y -= ny * push;
    other.x += nx * push;
    other.y += ny * push;
    const relative = Math.hypot(car.vx - other.vx, car.vy - other.vy);
    car.vx *= 0.88;
    car.vy *= 0.88;
    other.vx *= 0.88;
    other.vy *= 0.88;
    if (relative > 110) {
      const damage = Math.min(18, ((relative - 110) / 12) * dt * 30);
      car.health -= damage;
      other.health -= damage;
      car.hitFlash = 0.18;
      other.hitFlash = 0.18;
      world.events.push({ type: 'crash', x: (car.x + other.x) / 2, y: (car.y + other.y) / 2, power: clamp(relative / 460, 0.2, 1) });
      if (car.driver === 'player' && other.kind === 'police') world.report('ram', car.x, car.y);
      if (other.driver === 'player' && car.kind === 'police') world.report('ram', other.x, other.y);
    }
  }
}

function hitPeds(world, car) {
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 45) return;
  for (let i = 0; i < world.peds.length; i += 1) {
    const ped = world.peds[i];
    if (ped.dead || ped.hostile) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    if (dx * dx + dy * dy > (car.r + ped.r + 4) * (car.r + ped.r + 4)) continue;
    world.hurtPed(ped, speed / 8, car.driver === 'player', car.x, car.y);
    ped.x += Math.cos(car.angle) * 20;
    ped.y += Math.sin(car.angle) * 20;
    world.shake = Math.max(world.shake, 4);
    world.events.push({ type: 'thump', x: car.x, y: car.y });
  }
}

function tickDamage(world, car, dt) {
  if (car.hitFlash > 0) car.hitFlash -= dt;
  if (car.health <= 0 && !car.dead) {
    world.explodeCar(car);
    return;
  }
  if (car.health < car.maxHealth * 0.35) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.14;
      world.particles.push({
        x: car.x - Math.cos(car.angle) * car.spec.length * 0.34,
        y: car.y - Math.sin(car.angle) * car.spec.length * 0.34,
        vx: world.rng.range(-12, 12), vy: world.rng.range(-18, -4),
        life: 1.1, max: 1.1, size: 9, grow: 22,
        colour: car.health < 20 ? '#2d2d34' : '#6f7581', kind: 'smoke',
      });
    }
  }
}

export function moveVehicle(world, car, dt) {
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  collideWorld(world, car, dt);
  collideCars(world, car, dt);
  hitPeds(world, car);
  if (Math.hypot(car.vx, car.vy) > 8) car.angle = Math.atan2(car.vy, car.vx);
  tickDamage(world, car, dt);
}

/** The player's drive model: engine along the nose, lateral grip, brake, reverse and drift. */
export function driveVehicle(world, car, controls, dt) {
  if (car.dead) return;
  const spec = car.spec;
  const headingX = Math.cos(car.angle);
  const headingY = Math.sin(car.angle);
  const rightX = -headingY;
  const rightY = headingX;
  let forward = car.vx * headingX + car.vy * headingY;
  let lateral = car.vx * rightX + car.vy * rightY;

  if (controls.throttle > 0) forward += spec.accel * controls.throttle * dt;
  else if (controls.throttle < 0) forward += spec.accel * 0.6 * controls.throttle * dt;
  if (controls.brake) forward -= Math.sign(forward) * spec.brake * dt;
  forward -= forward * spec.drag * dt;
  forward = clamp(forward, -spec.reverse, spec.maxSpeed);
  if (Math.abs(forward) < 4 && controls.throttle === 0) forward = 0;

  const speedFactor = clamp(Math.abs(forward) / 90, 0, 1);
  const reverseSign = forward < -6 ? -1 : 1;
  car.angle += controls.steer * spec.turn * speedFactor * reverseSign * dt;
  car.steer = controls.steer;
  car.brake = controls.brake || controls.throttle < 0;

  lateral *= Math.exp(-spec.grip * dt);
  car.vx = headingX * forward + rightX * lateral;
  car.vy = headingY * forward + rightY * lateral;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.x = clamp(car.x, 12, world.city.worldWidth - 12);
  car.y = clamp(car.y, 12, world.city.worldHeight - 12);
  collideWorld(world, car, dt);
  collideCars(world, car, dt);
  hitPeds(world, car);
  tickDamage(world, car, dt);
}

/** AI steering toward a point: accelerates, eases off when it has to turn, brakes when close. */
export function steerVehicle(world, car, tx, ty, wanted, dt, arrive = 0) {
  if (car.dead) return 0;
  const distance = Math.hypot(tx - car.x, ty - car.y);
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const diff = Math.abs(((desired - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const grounded = clamp(Math.abs((car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle)) / 80), 0, 1);
  const maxTurn = car.spec.turn * 1.2 * grounded * dt;
  car.angle = turnToward(car.angle, desired, maxTurn);
  const speed = car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
  let target = wanted;
  if (diff > 0.9) target = Math.min(target, 110);
  if (distance < 160 && arrive > 0) target = Math.min(target, 28 + distance * 2);
  const accel = target > speed ? car.spec.accel * 0.72 : -car.spec.brake * 0.45;
  const next = clamp(speed + accel * dt, -car.spec.reverse, car.spec.maxSpeed);
  car.vx = Math.cos(car.angle) * next;
  car.vy = Math.sin(car.angle) * next;
  car.brake = accel < 0;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  collideWorld(world, car, dt);
  collideCars(world, car, dt);
  hitPeds(world, car);
  tickDamage(world, car, dt);
  return distance;
}

function pickNext(city, node, previous, rng) {
  const options = [];
  if (node.col > 0) options.push(city.nodes[node.row * (CITY.cols + 1) + node.col - 1]);
  if (node.col < CITY.cols) options.push(city.nodes[node.row * (CITY.cols + 1) + node.col + 1]);
  if (node.row > 0) options.push(city.nodes[(node.row - 1) * (CITY.cols + 1) + node.col]);
  if (node.row < CITY.rows) options.push(city.nodes[(node.row + 1) * (CITY.cols + 1) + node.col]);
  const filtered = options.filter((candidate) => candidate !== previous);
  const pool = filtered.length > 0 ? filtered : options;
  return pool[Math.floor(rng.next() * pool.length)];
}

/** Walks a car's route: follow the lane to the next intersection, then choose the next node. */
export function followRoute(world, car, dt, speed) {
  const city = world.city;
  if (!car.ai) {
    const start = city.nodes[Math.floor(world.rng.next() * city.nodes.length)];
    car.ai = { node: start, next: pickNext(city, start, null, world.rng), previous: null };
  }
  const lane = laneOffset(car.ai.node, car.ai.next);
  const d = steerVehicle(world, car, car.ai.next.x + lane.x, car.ai.next.y + lane.y, speed, dt, 44);
  if (d < 58) {
    car.ai.previous = car.ai.node;
    car.ai.node = car.ai.next;
    car.ai.next = pickNext(city, car.ai.node, car.ai.previous, world.rng);
  }
  return d;
}

export function vehicleBlockedAhead(world, car, distance) {
  const hx = Math.cos(car.angle);
  const hy = Math.sin(car.angle);
  const ax = car.x + hx * distance;
  const ay = car.y + hy * distance;
  for (let i = 0; i < world.cars.length; i += 1) {
    const other = world.cars[i];
    if (other === car || other.dead) continue;
    const dx = other.x - ax;
    const dy = other.y - ay;
    if (dx * dx + dy * dy < 28 * 28) return true;
  }
  for (let i = 0; i < world.city.solids.length; i += 1) {
    if (segmentRect(car.x, car.y, ax, ay, world.city.solids[i]) >= 0) return true;
  }
  return false;
}

export function carHeadlight(car, side) {
  const hx = Math.cos(car.angle);
  const hy = Math.sin(car.angle);
  return {
    x: car.x + hx * car.spec.length * 0.44 - hy * car.spec.width * 0.3 * side,
    y: car.y + hy * car.spec.length * 0.44 + hx * car.spec.width * 0.3 * side,
  };
}
