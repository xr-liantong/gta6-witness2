// Pedestrians and the two kinds of armed people who are not police: civilians who walk the
// sidewalks and scatter from gunfire, and gang lookouts who hold a block and shoot at the
// player when a mission puts them on the street. Cops live in police.js.

import { PED } from './config.js';
import { clamp, resolveCircleRect, turnToward } from './collision.js';

export function spawnPed(world, x, y, kind = 'civilian', options = {}) {
  const ped = {
    x, y,
    r: PED.radius,
    angle: world.rng.range(-Math.PI, Math.PI),
    speed: 0,
    phase: world.rng.range(0, 6.28),
    coat: world.rng.pick(PED.coat),
    skin: world.rng.pick(PED.skin),
    kind,
    health: kind === 'gang' ? 70 : PED.health,
    maxHealth: kind === 'gang' ? 70 : PED.health,
    dead: false,
    deadTimer: 0,
    fear: 0,
    fearX: 0,
    fearY: 0,
    targetX: x,
    targetY: y,
    think: world.rng.range(0, 0.6),
    hostile: kind === 'gang',
    weapon: kind === 'gang' ? 'pistol' : null,
    cooldown: world.rng.range(0.2, 1),
    hitFlash: 0,
    armed: kind === 'gang',
    alert: 0,
    hat: world.rng.chance(kind === 'gang' ? 0.8 : 0.3),
    phone: world.rng.chance(0.18),
    home: options.home ?? null,
  };
  world.peds.push(ped);
  return ped;
}

function sidewalkNear(world, x, y, radius) {
  const points = world.city.sidewalkPoints;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const point = points[Math.floor(world.rng.next() * points.length)];
    if (Math.hypot(point.x - x, point.y - y) < radius) return point;
  }
  return points[Math.floor(world.rng.next() * points.length)];
}

export function populatePeds(world) {
  while (world.peds.filter((ped) => ped.kind === 'civilian').length < PED.count) {
    const point = world.city.sidewalkPoints[Math.floor(world.rng.next() * world.city.sidewalkPoints.length)];
    if (Math.hypot(point.x - world.player.x, point.y - world.player.y) < 260) continue;
    spawnPed(world, point.x, point.y, 'civilian');
  }
}

function keepInside(world, ped) {
  for (let i = 0; i < world.city.solids.length; i += 1) {
    const rect = world.city.solids[i];
    if (ped.x + 30 < rect.x || ped.x - 30 > rect.x + rect.w || ped.y + 30 < rect.y || ped.y - 30 > rect.y + rect.h) continue;
    resolveCircleRect(ped, rect);
  }
  for (let i = 0; i < world.city.noGo.length; i += 1) resolveCircleRect(ped, world.city.noGo[i]);
  ped.x = clamp(ped.x, 10, world.city.worldWidth - 10);
  ped.y = clamp(ped.y, 10, world.city.worldHeight - 10);
}

function walkPed(world, ped, dt, speed, tx, ty) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return distance;
  const wanted = Math.atan2(dy, dx);
  ped.angle = turnToward(ped.angle, wanted, 7 * dt);
  ped.speed = speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.phase += speed * dt * 0.22;
  keepInside(world, ped);
  return distance;
}

function updateCivilian(world, ped, dt) {
  ped.think -= dt;
  if (ped.fear > 0) {
    ped.fear -= dt;
    const away = Math.atan2(ped.y - ped.fearY, ped.x - ped.fearX);
    walkPed(world, ped, dt, PED.flee, ped.x + Math.cos(away) * 120, ped.y + Math.sin(away) * 120);
    if (ped.fear <= 0) {
      const point = sidewalkNear(world, ped.x, ped.y, 420);
      ped.targetX = point.x;
      ped.targetY = point.y;
    }
    return;
  }
  const distance = walkPed(world, ped, dt, PED.walk + (ped.phone ? -12 : 0), ped.targetX, ped.targetY);
  if (distance < 18 || ped.think <= 0) {
    ped.think = world.rng.range(1.4, 3.6);
    const point = sidewalkNear(world, ped.x, ped.y, 360);
    ped.targetX = point.x;
    ped.targetY = point.y;
  }
}

function updateGang(world, ped, dt) {
  const player = world.player;
  const distance = Math.hypot(player.x - ped.x, player.y - ped.y);
  if (distance > 1100) {
    ped.alert = 0;
    if (ped.think <= 0) {
      ped.think = 2;
      const point = sidewalkNear(world, ped.x, ped.y, 200);
      ped.targetX = point.x;
      ped.targetY = point.y;
    }
    ped.think -= dt;
    walkPed(world, ped, dt, PED.walk * 0.6, ped.targetX, ped.targetY);
    return;
  }
  ped.alert = Math.min(1, ped.alert + dt);
  ped.cooldown -= dt;
  const lineOfSight = world.hasLineOfSight(ped.x, ped.y, player.x, player.y);
  const wanted = Math.atan2(player.y - ped.y, player.x - ped.x);
  ped.angle = turnToward(ped.angle, wanted, 6 * dt);
  if (!lineOfSight || distance > 300) {
    walkPed(world, ped, dt, PED.walk * 1.5, player.x, player.y);
  } else if (distance < 120) {
    walkPed(world, ped, dt, PED.walk, ped.x + Math.cos(wanted) * -40, ped.y + Math.sin(wanted) * -40);
  } else {
    ped.speed = 0;
  }
  if (lineOfSight && distance < 430 && ped.cooldown <= 0 && !player.dead && !player.car) {
    ped.cooldown = world.rng.range(0.5, 1.1);
    const spread = world.rng.range(-0.09, 0.09);
    world.fireBullet({
      x: ped.x + Math.cos(wanted) * 18,
      y: ped.y + Math.sin(wanted) * 18,
      angle: wanted + spread,
      speed: 1080,
      damage: 8,
      owner: 'gang',
      range: 430,
      colour: '#ffd27a',
    });
    world.events.push({ type: 'gunshot', x: ped.x, y: ped.y, small: true });
  }
}

export function updateCrowd(world, dt) {
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    const ped = world.peds[i];
    if (ped.hitFlash > 0) ped.hitFlash -= dt;
    if (ped.dead) {
      ped.deadTimer -= dt;
      if (ped.kind === 'cop') {
        if (ped.deadTimer <= 0) world.peds.splice(i, 1);
      } else if (ped.deadTimer < -18) {
        world.peds.splice(i, 1);
      }
      continue;
    }
    if (ped.kind === 'cop') continue;
    if (ped.kind === 'gang') updateGang(world, ped, dt);
    else updateCivilian(world, ped, dt);
  }
}

export function scarePeople(world, x, y, radius) {
  for (const ped of world.peds) {
    if (ped.dead || ped.kind === 'cop') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d > radius) continue;
    ped.fear = Math.max(ped.fear, 7);
    ped.fearX = x;
    ped.fearY = y;
    if (ped.kind === 'civilian') ped.phone = false;
  }
}

export function clearPeds(world, keep = 0) {
  let kept = 0;
  world.peds = world.peds.filter((ped) => {
    if (ped.kind === 'civilian' && kept < keep) { kept += 1; return true; }
    return ped.kind !== 'civilian' && ped.kind !== 'gang';
  });
}

export function pedColour(ped) {
  if (ped.kind === 'cop') return '#26324d';
  if (ped.kind === 'gang') return '#3a1f2a';
  return ped.coat;
}
