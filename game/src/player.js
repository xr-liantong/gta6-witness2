// The player: walking, sprinting, aiming, the enter/leave-vehicle hop, and the weapon state
// carried between the two. On foot the body is a circle pushed out of the city's solid rects;
// behind the wheel the same actor simply follows the car it owns.

import { PLAYER, VEHICLES, WEAPONS } from './config.js';
import { clamp, damp, resolveCircleRect, turnToward } from './collision.js';
import { createVehicle, driveVehicle } from './vehicle.js';

export function createPlayer(x, y) {
  return {
    x, y,
    r: PLAYER.radius,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    aim: -Math.PI / 2,
    health: PLAYER.health,
    maxHealth: PLAYER.health,
    armour: PLAYER.armour,
    money: PLAYER.startMoney,
    weapon: 'pistol',
    weapons: {
      pistol: { ammo: WEAPONS.pistol.ammo },
      smg: { ammo: 0 },
      shotgun: { ammo: 0 },
    },
    clip: WEAPONS.pistol.clip,
    reload: 0,
    fireCooldown: 0,
    car: null,
    enterTimer: 0,
    exitTimer: 0,
    step: 0,
    footstep: 0,
    hurt: 0,
    dead: false,
    deathTimer: 0,
    inside: false,
  };
}

export function giveWeapon(player, name, ammo) {
  if (!WEAPONS[name] || name === 'fists') return;
  player.weapons[name].ammo += ammo;
  if (player.weapons[player.weapon].ammo <= 0) {
    player.weapon = name;
    player.clip = Math.min(WEAPONS[name].clip, player.weapons[name].ammo);
  }
}

export function weaponSpec(player) {
  return WEAPONS[player.weapon] ?? WEAPONS.pistol;
}

export function nearestCar(world, x, y, range) {
  let best = null;
  let bestDistance = range * range;
  for (const car of world.cars) {
    if (car.dead || car === world.player.car) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDistance) {
      bestDistance = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(world, car) {
  const player = world.player;
  if (!car || car.dead || player.car) return false;
  if (car.driver === 'police') return false;
  player.car = car;
  player.enterTimer = 0.28;
  player.exitTimer = 0;
  car.driver = 'player';
  car.vx *= 0.2;
  car.vy *= 0.2;
  car.locked = false;
  world.onEnterCar(car);
  return true;
}

export function leaveCar(world, silent = false) {
  const player = world.player;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  car.brake = true;
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * (car.spec.width / 2 + 18);
  player.y = car.y + Math.sin(side) * (car.spec.width / 2 + 18);
  player.r = PLAYER.radius;
  player.vx = 0;
  player.vy = 0;
  player.car = null;
  player.exitTimer = 0.22;
  if (!silent) world.onLeaveCar(car);
  resolveFoot(world, player);
}

function resolveFoot(world, player) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < world.city.solids.length; i += 1) {
      resolveCircleRect(player, world.city.solids[i]);
    }
    for (let i = 0; i < world.city.noGo.length; i += 1) {
      resolveCircleRect(player, world.city.noGo[i]);
    }
    for (let i = 0; i < world.cars.length; i += 1) {
      const car = world.cars[i];
      if (car.dead) continue;
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const min = player.r + car.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.001) {
        const d = Math.sqrt(d2);
        player.x += (dx / d) * (min - d);
        player.y += (dy / d) * (min - d);
      }
    }
  }
  player.x = clamp(player.x, 10, world.city.worldWidth - 10);
  player.y = clamp(player.y, 10, world.city.worldHeight - 10);
}

export function updateOnFoot(world, player, controls, dt) {
  if (player.enterTimer > 0) player.enterTimer -= dt;
  if (player.exitTimer > 0) player.exitTimer -= dt;
  let wishX = controls.x;
  let wishY = controls.y;
  const length = Math.hypot(wishX, wishY);
  if (length > 1) {
    wishX /= length;
    wishY /= length;
  }
  const speed = controls.run ? PLAYER.run : PLAYER.walk;
  const targetX = wishX * speed;
  const targetY = wishY * speed;
  player.vx = damp(player.vx, targetX, length > 0.05 ? PLAYER.accel / 90 : PLAYER.friction, dt);
  player.vy = damp(player.vy, targetY, length > 0.05 ? PLAYER.accel / 90 : PLAYER.friction, dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const moving = Math.hypot(player.vx, player.vy) > 12;
  if (moving) {
    player.angle = turnToward(player.angle, Math.atan2(player.vy, player.vx), 12 * dt);
    player.step += Math.hypot(player.vx, player.vy) * dt * 0.055;
    player.footstep -= dt * (controls.run ? 2.3 : 1.5);
    if (player.footstep <= 0) {
      player.footstep = 0.34;
      world.events.push({ type: 'step', x: player.x, y: player.y, run: controls.run });
    }
  } else {
    player.step = 0;
  }
  if (controls.aim !== undefined) player.aim = controls.aim;
  resolveFoot(world, player);
  if (player.hurt > 0) player.hurt -= dt;
}

export function updateDriving(world, player, controls, dt) {
  if (player.enterTimer > 0) player.enterTimer -= dt;
  const car = player.car;
  if (!car || car.dead) {
    if (car && car.dead) leaveCar(world, true);
    return;
  }
  const throttle = controls.throttle;
  const steer = controls.steer;
  driveVehicle(world, car, { throttle, steer, brake: controls.brake }, dt);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.aim = car.angle;
  player.vx = car.vx;
  player.vy = car.vy;
  if (Math.abs(throttle) > 0.1 || Math.abs(steer) > 0.1) {
    player.footstep -= dt;
    if (player.footstep <= 0) {
      player.footstep = 0.12;
      world.events.push({ type: 'tyre', x: car.x, y: car.y });
    }
  }
}

export function hurtPlayer(world, player, amount, fromX, fromY) {
  if (player.dead || player.enterTimer > 0.2) return;
  let damage = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, damage * 0.65);
    player.armour -= absorbed;
    damage -= absorbed;
  }
  player.health -= damage;
  player.hurt = 0.4;
  world.shake = Math.max(world.shake, 4);
  world.addBlood(player.x, player.y, fromX, fromY, 4);
  if (player.health <= 0 && !player.dead) {
    player.health = 0;
    player.dead = true;
    player.deathTimer = PLAYER.respawn;
    if (player.car) {
      player.car.driver = null;
      player.car = null;
    }
    world.events.push({ type: 'death', x: player.x, y: player.y });
  }
}

export function selectWeapon(player, index) {
  const names = ['pistol', 'smg', 'shotgun'];
  const name = names[index];
  if (!name) return false;
  if (player.weapons[name].ammo <= 0) return false;
  player.weapon = name;
  player.clip = Math.min(WEAPONS[name].clip, player.weapons[name].ammo);
  player.reload = 0;
  return true;
}

export function beginReload(player) {
  const spec = weaponSpec(player);
  if (player.reload > 0 || player.clip >= spec.clip) return false;
  if (player.weapons[player.weapon].ammo <= 0) return false;
  player.reload = spec.reload ?? 1;
  return true;
}

export function finishReload(player) {
  const spec = weaponSpec(player);
  const have = player.weapons[player.weapon].ammo;
  const need = spec.clip - player.clip;
  const take = Math.min(have, need);
  player.clip += take;
  player.weapons[player.weapon].ammo -= take;
}

export function spawnPlayerCar(world, kind, x, y, angle) {
  return createVehicle(world, kind, x, y, angle, { driver: 'player' });
}

export const PLAYER_VEHICLE_SPECS = VEHICLES;
