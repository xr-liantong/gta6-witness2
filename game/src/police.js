// The police: wanted stars, the units that answer them, the men who get out of those units,
// and the slow cooling that lets a good driver get away with it. Heat is what the player earns;
// stars are what the HUD shows; both go to zero when nobody has eyes on you long enough.

import { POLICE } from './config.js';
import { createVehicle, steerVehicle } from './vehicle.js';
import { spawnPed } from './crowd.js';

export function createWanted() {
  return {
    stars: 0,
    heat: 0,
    visible: false,
    seenTimer: 0,
    cool: 0,
    spawnTimer: 0,
    escalation: 0,
    flash: 0,
    busted: 0,
    cars: 0,
    label: '',
  };
}

export function reportCrime(world, crime, x = world.player.x, y = world.player.y) {
  const wanted = world.wanted;
  if (!wanted || world.player.dead) return false;
  const player = world.player;
  let witnessed = wanted.stars > 0;
  if (!witnessed) {
    for (const ped of world.peds) {
      if (ped.dead || ped.kind === 'gang') continue;
      if (Math.hypot(ped.x - x, ped.y - y) < 420) { witnessed = true; break; }
    }
  }
  if (!witnessed && crime !== 'heat' && crime !== 'steal') return false;
  if (crime === 'heat') {
    wanted.stars = Math.max(wanted.stars, 3);
  } else {
    const points = POLICE.crimes[crime] ?? 1;
    const cap = crime === 'killCop' ? 5 : crime === 'shot' ? 2 : 4;
    wanted.stars = Math.min(5, Math.max(wanted.stars + (wanted.stars === 0 ? 1 : 0), Math.min(cap, wanted.heat + points)));
    wanted.heat = Math.min(5, wanted.heat + points);
  }
  wanted.flash = 2.4;
  wanted.cool = 0;
  wanted.escalation = 0;
  wanted.label = crimeLabel(crime);
  world.events.push({ type: 'wanted', stars: wanted.stars, text: wanted.label });
  return true;
}

function crimeLabel(crime) {
  if (crime === 'killCop') return 'OFFICER DOWN';
  if (crime === 'killPed') return 'CIVILIAN DOWN';
  if (crime === 'ram') return 'ASSAULT ON POLICE';
  if (crime === 'steal') return 'GRAND THEFT AUTO';
  if (crime === 'heat') return 'ALL UNITS RESPOND';
  return 'SHOTS FIRED';
}

export function policeCarCount(world) {
  let count = 0;
  for (const car of world.cars) {
    if (car.kind === 'police' && !car.dead && car.driver === 'cop') count += 1;
  }
  return count;
}

export function spawnPoliceCar(world, x = null, y = null) {
  const city = world.city;
  const player = world.player;
  let node = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = city.nodes[Math.floor(world.rng.next() * city.nodes.length)];
    const d = Math.hypot(candidate.x - player.x, candidate.y - player.y);
    if (d > 640 && d < 1500) { node = candidate; break; }
  }
  if (!node) node = city.nodes[Math.floor(world.rng.next() * city.nodes.length)];
  const car = createVehicle(world, 'police', x ?? node.x, y ?? node.y, Math.atan2(player.y - node.y, player.x - node.x), {
    driver: 'cop',
    colour: '#12203f',
  });
  car.siren = true;
  car.crew = 2;
  car.chase = 0;
  world.events.push({ type: 'siren', x: car.x, y: car.y });
  return car;
}

function unloadCrew(world, car) {
  if (car.crew <= 0) return;
  const count = car.crew;
  car.crew = 0;
  car.driver = null;
  car.brake = true;
  car.vx *= 0.4;
  car.vy *= 0.4;
  const side = car.angle + Math.PI / 2;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * 34;
    const cop = spawnPed(world, car.x + Math.cos(side) * (car.spec.width + 8) + Math.cos(car.angle) * offset, car.y + Math.sin(side) * (car.spec.width + 8) + Math.sin(car.angle) * offset, 'cop');
    cop.health = POLICE.copHealth;
    cop.maxHealth = POLICE.copHealth;
    cop.weapon = 'pistol';
    cop.armed = true;
    cop.cooldown = 0.5 + i * 0.3;
    cop.fear = 0;
  }
}

function copCanSee(world, cop) {
  const player = world.player;
  if (player.dead) return false;
  const d = Math.hypot(player.x - cop.x, player.y - cop.y);
  if (d > 640) return false;
  return world.hasLineOfSight(cop.x, cop.y, player.x, player.y);
}

function updateCop(world, cop, dt) {
  const player = world.player;
  const wanted = world.wanted;
  cop.cooldown -= dt;
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const distance = Math.hypot(dx, dy);
  const seen = copCanSee(world, cop);
  const wantedAngle = Math.atan2(dy, dx);
  if (distance > 34) {
    const speed = distance > 280 ? POLICE.copRun : POLICE.copWalk;
    cop.angle = Math.atan2(dy, dx);
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    cop.phase += speed * dt * 0.2;
    cop.speed = speed;
  } else {
    cop.angle = wantedAngle;
    cop.speed = 0;
  }
  if (seen && distance < POLICE.range && cop.cooldown <= 0 && !player.dead) {
    cop.cooldown = POLICE.fireRate + world.rng.range(-0.12, 0.24);
    const miss = 1 - POLICE.accuracy;
    const spread = world.rng.range(-miss * 0.36, miss * 0.36);
    world.fireBullet({
      x: cop.x + Math.cos(cop.angle) * 16,
      y: cop.y + Math.sin(cop.angle) * 16,
      angle: cop.angle + spread,
      speed: 1220,
      damage: POLICE.damage,
      owner: 'cop',
      range: POLICE.range,
      colour: '#bfe1ff',
    });
    world.events.push({ type: 'gunshot', x: cop.x, y: cop.y, small: true });
  }
  if (seen && wanted) wanted.seenTimer = 0;
}

function updateCopCar(world, car, dt) {
  const player = world.player;
  const wanted = world.wanted;
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const distance = Math.hypot(dx, dy);
  car.chase += dt;
  const targetX = player.x + player.vx * 0.5;
  const targetY = player.y + player.vy * 0.5;
  if (player.car ? distance < 90 : distance < 280) {
    unloadCrew(world, car);
    return;
  }
  const speed = distance > 320 ? 360 : 240;
  steerVehicle(world, car, targetX, targetY, speed, dt, 60);
  if (distance < 420 && world.hasLineOfSight(car.x, car.y, player.x, player.y)) wanted.seenTimer = 0;
  if (distance < 58 && player.car && Math.hypot(car.vx - player.car.vx, car.vy - player.car.vy) > 220) {
    world.report('ram', car.x, car.y);
  }
}

function clearUnits(world) {
  for (const car of world.cars) {
    if (car.kind === 'police' && car.driver === 'cop') {
      car.driver = null;
      car.siren = false;
      car.dead = true;
      car.health = 0;
      car.removeAt = 0;
    }
  }
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    const ped = world.peds[i];
    if (ped.kind === 'cop' && !ped.dead) world.peds.splice(i, 1);
  }
}

export function updatePolice(world, dt) {
  const wanted = world.wanted;
  if (!wanted) return;
  const player = world.player;
  if (wanted.flash > 0) wanted.flash -= dt;
  wanted.seenTimer += dt;
  wanted.visible = false;
  for (const ped of world.peds) {
    if (ped.kind !== 'cop' || ped.dead) continue;
    if (copCanSee(world, ped)) { wanted.visible = true; wanted.seenTimer = 0; break; }
  }
  if (!wanted.visible) {
    for (const car of world.cars) {
      if (car.kind !== 'police' || car.dead || car.driver !== 'cop') continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) < 560 && world.hasLineOfSight(car.x, car.y, player.x, player.y)) {
        wanted.visible = true;
        wanted.seenTimer = 0;
        break;
      }
    }
  }
  if (wanted.stars > 0) {
    if (wanted.visible) {
      wanted.escalation += dt;
      if (wanted.escalation >= POLICE.starSeconds && wanted.stars < 5) {
        wanted.stars += 1;
        wanted.escalation = 0;
        wanted.flash = 2;
        world.events.push({ type: 'wanted', stars: wanted.stars, text: 'PURSUIT ESCALATING' });
      }
    } else {
      wanted.cool += dt;
      if (wanted.cool >= POLICE.escapeSeconds) {
        wanted.cool = 0;
        wanted.stars = Math.max(0, wanted.stars - 1);
        wanted.heat = Math.max(0, wanted.heat - 1);
        wanted.escalation = 0;
        if (wanted.stars === 0) {
          world.events.push({ type: 'wanted', stars: 0, text: 'YOU LOST THEM' });
        }
      }
    }
  }
  if (wanted.stars === 0) {
    wanted.cars = policeCarCount(world);
    if (wanted.cars > 0) {
      wanted.cool += dt;
      if (wanted.cool > 10) { clearUnits(world); wanted.cool = 0; }
    }
    return;
  }
  wanted.spawnTimer -= dt;
  wanted.cars = policeCarCount(world);
  const maxCars = POLICE.maxCars[wanted.stars] ?? 2;
  if (wanted.cars < maxCars && wanted.spawnTimer <= 0) {
    spawnPoliceCar(world);
    wanted.spawnTimer = POLICE.spawnDelay[wanted.stars] ?? 4;
  }
  for (const car of world.cars) {
    if (car.kind === 'police' && !car.dead && car.driver === 'cop') updateCopCar(world, car, dt);
  }
  for (const ped of world.peds) {
    if (ped.kind === 'cop' && !ped.dead) updateCop(world, ped, dt);
  }
}

export function clearPolice(world) {
  wantedReset(world);
  clearUnits(world);
}

export function wantedReset(world) {
  world.wanted = createWanted();
}

export const POLICE_CALLS = {
  ram: 'ASSAULT ON POLICE',
  shot: 'SHOTS FIRED',
};
