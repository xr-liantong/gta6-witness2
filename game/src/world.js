// The world: one object that owns the city, the player, every body in play, the wanted level,
// the mission and the event queue the sound and HUD layers drain. `step` is the only place that
// advances simulation, so a paused or frozen (screenshot) world simply stops calling it.

import { CITY, PLAYER, COLORS, LIMITS, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity, areaName, nearestNode } from './city.js';
import { createVehicle } from './vehicle.js';
import {
  createPlayer, enterCar, leaveCar, hurtPlayer, updateDriving, updateOnFoot,
} from './player.js';
import { populateTraffic, updateTraffic, clearTraffic, panicTraffic } from './traffic.js';
import { populatePeds, updateCrowd, scarePeople, clearPeds } from './crowd.js';
import {
  playerShoot, updateBullets, updateParticles, updatePickups, spawnPickups,
  updatePlayerWeapon, explode, addBlood as addBloodParticles,
} from './combat.js';
import { createWanted, reportCrime, updatePolice, clearPolice, wantedReset } from './police.js';
import { missionSetup, updateMission, startMission as startContract } from './missions.js';

const START_NODE = { col: 2, row: 2 };

export function spawnPoint(city) {
  const node = nearestNode(city, city.width / 2 + 40, city.height / 2 - 30);
  return { x: node.x + 26, y: node.y + 34 };
}

function addLotCars(world) {
  for (const car of world.city.lotCars) {
    createVehicle(world, car.kind, car.x, car.y, car.angle, { driver: null, colour: car.colour });
  }
}

export function createWorld(options = {}) {
  const seed = options.seed ?? 20261119;
  const city = buildCity(seed);
  const start = spawnPoint(city);
  const world = {
    seed,
    city,
    rng: createRandom((seed ^ 0x51ed270b) >>> 0),
    player: createPlayer(start.x, start.y),
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    flashes: [],
    decals: [],
    pickups: [],
    events: [],
    wanted: createWanted(),
    mission: null,
    shake: 0,
    clock: 21.6,
    time: 0,
    mode: 'play',
    score: 0,
    stats: { kills: 0, copsDown: 0, crashes: 0, distance: 0, missions: 0, escapes: 0 },
    area: areaName(city, start.x, start.y),
    weather: 'clear',
    message: '',
    intro: 0,
    spawn: start,
    step,
  };
  bindWorld(world);
  resetWorld(world);
  return world;
}

/** Systems call these as world methods, so one world object is the whole simulation surface. */
function bindWorld(world) {
  world.report = (crime, x, y) => reportCrime(world, crime, x, y);
  world.hurtPed = (ped, amount, byPlayer, fx, fy) => hurtPed(world, ped, amount, byPlayer, fx, fy);
  world.explodeCar = (car) => explodeCar(world, car);
  world.addBlood = (x, y, fx, fy, amount) => addBloodParticles(world, x, y, fx, fy, amount);
  world.fireBullet = (options) => fireBullet(world, options);
  world.scare = (x, y, radius) => scare(world, x, y, radius);
  world.hasLineOfSight = (x0, y0, x1, y1) => hasLineOfSight(world, x0, y0, x1, y1);
  world.onEnterCar = (car) => onEnterCar(world, car);
  world.onLeaveCar = (car) => onLeaveCar(world, car);
}

export function resetWorld(world) {
  const start = world.spawn;
  world.cars = [];
  world.peds = [];
  world.bullets = [];
  world.particles = [];
  world.flashes = [];
  world.decals = [];
  world.pickups = [];
  world.events = [];
  world.shake = 0;
  world.time = 0;
  world.wanted = createWanted();
  world.player = createPlayer(start.x, start.y);
  world.player.angle = -Math.PI / 2;
  world.player.aim = -Math.PI / 2;
  world.mode = 'play';
  addLotCars(world);
  populateTraffic(world);
  populatePeds(world);
  spawnPickups(world);
  world.mission = missionSetup(world);
  world.intro = 2.5;
  world.area = areaName(world.city, start.x, start.y);
}

export function step(world, dt, controls) {
  if (world.mode === 'paused') return;
  const capped = Math.min(dt, 0.05);
  world.time += capped;
  world.clock += capped * 0.0008;
  const player = world.player;
  const previousX = player.x;
  const previousY = player.y;
  if (world.intro > 0) world.intro -= capped;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - capped * 22);

  if (player.dead) {
    player.deathTimer -= capped;
    if (player.deathTimer <= 0) respawnPlayer(world);
  } else if (player.car) {
    updateDriving(world, player, controls, capped);
    if (controls.shoot && !controls.aimOnly) playerShoot(world);
  } else {
    updateOnFoot(world, player, controls, capped);
    if (controls.shoot) playerShoot(world);
  }
  updatePlayerWeapon(world, capped);
  updateTraffic(world, capped);
  updateCrowd(world, capped);
  updatePolice(world, capped);
  updateMission(world, capped);
  updateBullets(world, capped);
  updateParticles(world, capped);
  updatePickups(world, capped);
  cleanup(world, capped);

  if (!player.dead) {
    world.stats.distance += Math.hypot(player.x - previousX, player.y - previousY);
    world.area = areaName(world.city, player.x, player.y);
  }
  world.area = player.car ? areaName(world.city, player.x, player.y) : world.area;
}

function cleanup(world, dt) {
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.dead) {
      car.removeAt = (car.removeAt ?? 6) - dt;
      if (car.removeAt <= 0) world.cars.splice(i, 1);
      continue;
    }
    if (Math.hypot(car.x - world.player.x, car.y - world.player.y) > 4200 && car.driver !== 'player') {
      world.cars.splice(i, 1);
    }
  }
}

export function respawnPlayer(world) {
  const player = world.player;
  const start = world.spawn;
  player.dead = false;
  player.health = 60;
  player.armour = 0;
  player.money = Math.max(0, player.money - 150);
  player.x = start.x;
  player.y = start.y;
  player.vx = 0;
  player.vy = 0;
  player.car = null;
  player.deathTimer = 0;
  player.reload = 0;
  player.weapon = 'pistol';
  if (player.weapons.pistol.ammo < 24) player.weapons.pistol.ammo = 24;
  player.clip = Math.min(12, player.weapons.pistol.ammo);
  world.wanted = createWanted();
  clearPolice(world);
  world.events.push({ type: 'respawn', text: 'STITCHED UP', sub: 'The hospital billed you $150' });
}

export function fireBullet(world, options) {
  const bullet = {
    x: options.x,
    y: options.y,
    px: options.x,
    py: options.y,
    vx: Math.cos(options.angle) * options.speed,
    vy: Math.sin(options.angle) * options.speed,
    damage: options.damage,
    owner: options.owner,
    life: (options.range ?? 600) / options.speed,
    colour: options.colour ?? COLORS.muzzle,
  };
  if (world.bullets.length > LIMITS.bullets) world.bullets.shift();
  world.bullets.push(bullet);
}

export function hasLineOfSight(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  if (length < 1) return true;
  for (const rect of world.city.solids) {
    const t = segmentHit(x0, y0, x1, y1, rect);
    if (t >= 0 && t < 0.97) return false;
  }
  return true;
}

function segmentHit(x0, y0, x1, y1, rect) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tmin = 0;
  let tmax = 1;
  for (let axis = 0; axis < 2; axis += 1) {
    const origin = axis === 0 ? x0 : y0;
    const delta = axis === 0 ? dx : dy;
    const min = axis === 0 ? rect.x : rect.y;
    const max = axis === 0 ? rect.x + rect.w : rect.y + rect.h;
    if (Math.abs(delta) < 0.00001) {
      if (origin < min || origin > max) return -1;
    } else {
      let t1 = (min - origin) / delta;
      let t2 = (max - origin) / delta;
      if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

export function hurtPed(world, ped, amount, byPlayer, fromX, fromY) {
  if (ped.dead) return;
  ped.health -= amount;
  ped.hitFlash = 0.22;
  world.addBlood(ped.x, ped.y, fromX, fromY, 5);
  if (ped.health > 0) return;
  ped.dead = true;
  ped.deadTimer = 12;
  ped.speed = 0;
  world.events.push({ type: 'pedDown', x: ped.x, y: ped.y });
  if (byPlayer) {
    world.stats.kills += 1;
    if (ped.kind === 'cop') {
      world.stats.copsDown += 1;
      world.report('killCop', ped.x, ped.y);
      world.player.money += 60;
    } else if (ped.kind === 'civilian') {
      world.report('killPed', ped.x, ped.y);
    } else {
      world.player.money += 45;
    }
  }
  world.scare(ped.x, ped.y, 260);
}

export function explodeCar(world, car) {
  if (car.dead) return;
  car.dead = true;
  car.health = 0;
  car.removeAt = 7;
  explode(world, car.x, car.y, 128);
  world.events.push({ type: 'explosion', x: car.x, y: car.y });
  world.stats.crashes += 1;
  const player = world.player;
  if (player.car === car) {
    player.car = null;
    hurtPlayer(world, player, 140, car.x, car.y);
  }
  if (car.driver === 'cop') world.report('killCop', car.x, car.y);
}

export function scare(world, x, y, radius) {
  scarePeople(world, x, y, radius);
  panicTraffic(world, x, y, radius * 1.3);
}

export function addBlood(world, x, y, fromX, fromY, amount) {
  addBloodParticles(world, x, y, fromX, fromY, amount);
}

export function onEnterCar(world, car) {
  world.events.push({ type: 'engine', x: car.x, y: car.y });
  if (car.missionTag) world.events.push({ type: 'hint', text: 'The coupé is yours. Move.' });
}

export function onLeaveCar(world) {
  world.events.push({ type: 'door', x: world.player.x, y: world.player.y });
}

export function drainEvents(world) {
  if (world.events.length === 0) return [];
  const events = world.events;
  world.events = [];
  return events;
}

export function startMission(world) {
  startContract(world);
}

export function saveSnapshot(world) {
  const player = world.player;
  return {
    version: 1,
    seed: world.seed,
    time: world.time,
    score: world.score,
    stats: world.stats,
    player: {
      x: player.x,
      y: player.y,
      health: player.health,
      armour: player.armour,
      money: player.money,
      weapon: player.weapon,
      clip: player.clip,
      weapons: {
        pistol: player.weapons.pistol.ammo,
        smg: player.weapons.smg.ammo,
        shotgun: player.weapons.shotgun.ammo,
      },
    },
    wanted: { stars: world.wanted.stars, heat: world.wanted.heat },
    mission: world.mission
      ? { step: world.mission.step, complete: world.mission.complete, failed: world.mission.failed, timer: world.mission.timer }
      : null,
  };
}

export function loadSnapshot(world, data) {
  if (!data || data.version !== 1) return false;
  resetWorld(world);
  const player = world.player;
  player.x = data.player.x;
  player.y = data.player.y;
  player.health = data.player.health;
  player.armour = data.player.armour;
  player.money = data.player.money;
  player.weapons.pistol.ammo = data.player.weapons.pistol;
  player.weapons.smg.ammo = data.player.weapons.smg;
  player.weapons.shotgun.ammo = data.player.weapons.shotgun;
  player.weapon = data.player.weapon;
  player.clip = data.player.clip;
  world.wanted.stars = data.wanted.stars;
  world.wanted.heat = data.wanted.heat;
  world.score = data.score;
  world.stats = { ...world.stats, ...data.stats };
  if (data.mission && world.mission) {
    world.mission.step = data.mission.step;
    world.mission.complete = data.mission.complete;
    world.mission.failed = data.mission.failed;
    world.mission.timer = data.mission.timer;
  }
  return true;
}

export function fadeWanted(world) {
  wantedReset(world);
}

export const WORLD_CONSTANTS = { CITY, PLAYER, STEP, START_NODE, LIMITS };
