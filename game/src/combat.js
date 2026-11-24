// Bullets, impact sparks, blood, smoke and explosions, plus the weapon trigger the player pulls
// and the pickups lying around town. Every hit is resolved on the segment the bullet travelled
// this step, so nothing tunnels through a wall at 1300 pixels a second.

import { LIMITS, WEAPONS } from './config.js';
import { clamp, segmentCircle, segmentRect } from './collision.js';
import { beginReload, finishReload, hurtPlayer, weaponSpec } from './player.js';

export function spawnBullet(world, options) {
  if (world.bullets.length >= LIMITS.bullets) world.bullets.shift();
  const speed = options.speed;
  world.bullets.push({
    x: options.x,
    y: options.y,
    px: options.x,
    py: options.y,
    vx: Math.cos(options.angle) * speed,
    vy: Math.sin(options.angle) * speed,
    damage: options.damage,
    owner: options.owner,
    life: (options.range ?? 600) / speed,
    colour: options.colour ?? '#ffe6a8',
  });
}

export function muzzle(world, x, y, angle, size = 1) {
  world.particles.push({
    x, y,
    vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
    life: 0.08, max: 0.08, size: 9 * size, grow: 26, colour: '#fff1c2', kind: 'flash',
  });
  world.particles.push({
    x, y,
    vx: Math.cos(angle + 0.5) * 20, vy: Math.sin(angle + 0.5) * 20,
    life: 0.05, max: 0.05, size: 14 * size, grow: 30, colour: '#ffd166', kind: 'flash',
  });
}

export function sparks(world, x, y, angle, count = 5) {
  for (let i = 0; i < count; i += 1) {
    const spread = angle + world.rng.range(-0.9, 0.9);
    const speed = world.rng.range(40, 190);
    world.particles.push({
      x, y,
      vx: Math.cos(spread) * speed,
      vy: Math.sin(spread) * speed,
      life: 0.3, max: 0.3, size: 2, grow: 0, colour: i % 3 === 0 ? '#ffe6a8' : '#ffb04a', kind: 'spark',
    });
  }
}

export function addBlood(world, x, y, fromX, fromY, amount = 6) {
  const angle = Math.atan2(y - fromY, x - fromX);
  for (let i = 0; i < amount; i += 1) {
    const a = angle + world.rng.range(-0.7, 0.7);
    const speed = world.rng.range(20, 120);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.55, max: 0.55, size: 3, grow: 0, colour: '#8e1226', kind: 'blood',
    });
  }
  if (world.decals.length > 90) world.decals.shift();
  world.decals.push({ x, y, r: world.rng.range(7, 14), alpha: 0.55, kind: 'blood' });
}

export function explode(world, x, y, radius) {
  world.flashes.push({ x, y, r: 30, life: 0.5, max: 0.5, colour: '#ffd08a' });
  world.shake = Math.max(world.shake, 12);
  for (let i = 0; i < 26; i += 1) {
    const a = world.rng.range(0, Math.PI * 2);
    const speed = world.rng.range(40, 300);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: world.rng.range(0.4, 0.9), max: 1, size: world.rng.range(5, 13), grow: 20,
      colour: i % 3 === 0 ? '#ffb02e' : i % 3 === 1 ? '#ff5a2e' : '#3b3b42',
      kind: i % 3 === 2 ? 'smoke' : 'fire',
    });
  }
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) world.hurtPed(ped, 130 * (1 - d / radius), true, x, y);
  }
  for (const car of world.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < radius * 1.2) {
      car.health -= 90 * (1 - d / (radius * 1.2));
      car.hitFlash = 0.3;
    }
  }
  const player = world.player;
  if (!player.dead && Math.hypot(player.x - x, player.y - y) < radius) {
    hurtPlayer(world, player, 70, x, y);
  }
  world.scare(x, y, radius * 4);
}

function hitPerson(world, bullet, wallT) {
  const fromX = bullet.px - bullet.vx;
  const fromY = bullet.py - bullet.vy;
  let bestT = wallT;
  let victim = null;
  if (bullet.owner === 'player') {
    for (const ped of world.peds) {
      if (ped.dead) continue;
      const t = segmentCircle(bullet.px, bullet.py, bullet.x, bullet.y, ped.x, ped.y, ped.r);
      if (t >= 0 && t < bestT) { bestT = t; victim = ped; }
    }
  } else {
    const player = world.player;
    if (!player.dead && player.enterTimer <= 0) {
      const t = segmentCircle(bullet.px, bullet.py, bullet.x, bullet.y, player.x, player.y, player.r + 2);
      if (t >= 0 && t < bestT) { bestT = t; victim = player; }
    }
    if (bullet.owner === 'cop') {
      for (const ped of world.peds) {
        if (ped.dead || ped.kind !== 'gang') continue;
        const t = segmentCircle(bullet.px, bullet.py, bullet.x, bullet.y, ped.x, ped.y, ped.r);
        if (t >= 0 && t < bestT) { bestT = t; victim = ped; }
      }
    }
  }
  if (!victim) return null;
  const x = bullet.px + (bullet.x - bullet.px) * bestT;
  const y = bullet.py + (bullet.y - bullet.py) * bestT;
  if (victim === world.player) hurtPlayer(world, victim, bullet.damage, fromX, fromY);
  else world.hurtPed(victim, bullet.damage, bullet.owner === 'player', fromX, fromY);
  return { x, y };
}

function hitCar(world, bullet) {
  for (const car of world.cars) {
    if (car.dead) continue;
    if (bullet.owner === 'player' && car.driver === 'player') continue;
    const t = segmentCircle(bullet.px, bullet.py, bullet.x, bullet.y, car.x, car.y, car.r);
    if (t < 0) continue;
    car.health -= bullet.damage * 0.42;
    car.hitFlash = 0.12;
    sparks(world, car.x, car.y, Math.atan2(bullet.vy, bullet.vx), 3);
    if (bullet.owner === 'player') world.report('shot', bullet.x, bullet.y);
    return true;
  }
  return false;
}

export function updateBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.bullets[i];
    bullet.px = bullet.x;
    bullet.py = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    let wallT = 1;
    let wall = null;
    for (const rect of world.city.solids) {
      const t = segmentRect(bullet.px, bullet.py, bullet.x, bullet.y, rect);
      if (t >= 0 && t < wallT) { wallT = t; wall = rect; }
    }
    const person = hitPerson(world, bullet, wallT);
    if (person) {
      sparks(world, person.x, person.y, Math.atan2(bullet.vy, bullet.vx), 2);
      world.bullets.splice(i, 1);
      continue;
    }
    if (wall) {
      sparks(world, bullet.px + (bullet.x - bullet.px) * wallT, bullet.py + (bullet.y - bullet.py) * wallT, Math.atan2(bullet.vy, bullet.vx) + Math.PI, 4);
      world.bullets.splice(i, 1);
      continue;
    }
    if (hitCar(world, bullet)) {
      world.bullets.splice(i, 1);
      continue;
    }
    if (bullet.life <= 0) world.bullets.splice(i, 1);
  }
}

export function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      world.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.grow) p.size += p.grow * dt;
  }
  for (let i = world.flashes.length - 1; i >= 0; i -= 1) {
    const flash = world.flashes[i];
    flash.life -= dt;
    if (flash.life <= 0) world.flashes.splice(i, 1);
  }
}

export function playerShoot(world) {
  const player = world.player;
  if (player.dead || player.car || player.reload > 0 || player.fireCooldown > 0) return false;
  const spec = weaponSpec(player);
  if (player.clip <= 0) {
    beginReload(player);
    return false;
  }
  player.clip -= 1;
  player.fireCooldown = spec.rate;
  const pellets = spec.pellets ?? 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = world.rng.range(-spec.spread, spec.spread);
    spawnBullet(world, {
      x: player.x + Math.cos(player.aim) * 16,
      y: player.y + Math.sin(player.aim) * 16,
      angle: player.aim + spread,
      speed: spec.speed,
      damage: spec.damage,
      owner: 'player',
      range: spec.range,
      colour: '#ffe6a8',
    });
  }
  muzzle(world, player.x + Math.cos(player.aim) * 18, player.y + Math.sin(player.aim) * 18, player.aim, spec === WEAPONS.shotgun ? 1.5 : 1);
  player.vx -= Math.cos(player.aim) * (spec === WEAPONS.shotgun ? 90 : 25);
  player.vy -= Math.sin(player.aim) * (spec === WEAPONS.shotgun ? 90 : 25);
  world.events.push({ type: 'gunshot', x: player.x, y: player.y, small: spec === WEAPONS.pistol });
  world.report('shot', player.x, player.y);
  world.scare(player.x, player.y, 380);
  return true;
}

export function updatePickups(world, dt) {
  const player = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    pickup.spin = (pickup.spin ?? 0) + dt * 2.4;
    pickup.life -= dt;
    if (pickup.life <= 0) { world.pickups.splice(i, 1); continue; }
    if (player.car || player.dead) continue;
    if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > 30) continue;
    if (pickup.kind === 'health') player.health = Math.min(player.maxHealth, player.health + 40);
    else if (pickup.kind === 'armour') player.armour = Math.min(100, player.armour + 45);
    else if (pickup.kind === 'cash') player.money += pickup.value ?? 120;
    else if (pickup.kind === 'ammo') {
      player.weapons.smg.ammo += 40;
      player.weapons.shotgun.ammo += 10;
      player.weapons.pistol.ammo += 24;
    } else continue;
    world.events.push({ type: 'pickup', x: pickup.x, y: pickup.y, kind: pickup.kind });
    world.pickups.splice(i, 1);
  }
}

export function spawnPickups(world) {
  const kinds = ['health', 'armour', 'ammo', 'cash', 'cash'];
  for (let i = 0; i < 14; i += 1) {
    const point = world.city.sidewalkPoints[Math.floor(world.rng.next() * world.city.sidewalkPoints.length)];
    world.pickups.push({
      x: point.x + world.rng.range(-14, 14),
      y: point.y + world.rng.range(-14, 14),
      kind: world.rng.pick(kinds),
      value: 80 + Math.floor(world.rng.next() * 120),
      life: 120,
      spin: world.rng.range(0, 6),
    });
  }
}

export function updatePlayerWeapon(world, dt) {
  const player = world.player;
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.reload > 0) {
    player.reload -= dt;
    if (player.reload <= 0) {
      player.reload = 0;
      finishReload(player);
    }
  }
  if (player.clip <= 0 && player.reload <= 0) beginReload(player);
}

export const COMBAT_RANGE = clamp(WEAPONS.pistol.range, 0, 9999);
