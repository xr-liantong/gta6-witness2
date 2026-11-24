// The four screenshot scenes. `setupShot(name)` keeps its single-argument signature: main binds
// the live world once, and each scene rebuilds the city (deterministic seed) into a composed
// moment — downtown heat, a chase, a street corner, and the gold coupé contract.

import { createVehicle } from './vehicle.js';
import { spawnPed, scarePeople } from './crowd.js';
import { enterCar } from './player.js';
import { resetWorld } from './world.js';
import { missionMarker } from './missions.js';

let bound = null;

export function bindShotWorld(world, camera) {
  bound = { world, camera };
}

function nodeAt(city, col, row) {
  return city.nodes[row * 6 + col];
}

function findBlock(city, kind) {
  return city.blocks.find((block) => block.kind === kind) ?? city.blocks[0];
}

function clearCars(world) {
  world.cars = [];
}

function addCar(world, kind, x, y, angle, driver = null, colour = null) {
  return createVehicle(world, kind, x, y, angle, { driver, colour: colour ?? undefined });
}

function addCopCar(world, x, y, angle) {
  const car = createVehicle(world, 'police', x, y, angle, { driver: 'cop', colour: '#12203f' });
  car.siren = true;
  car.crew = 0;
  return car;
}

function addPed(world, x, y, angle, kind = 'civilian') {
  const ped = spawnPed(world, x, y, kind);
  ped.angle = angle;
  ped.targetX = x;
  ped.targetY = y;
  ped.fear = 0;
  return ped;
}

function clearPeds(world) {
  world.peds = world.peds.filter((ped) => ped.kind === 'cop');
}

function hideIntro(world) {
  world.intro = 0;
  world.mode = 'shot';
  world.shotName = bound?.name ?? null;
}

export function setupShot(name) {
  if (!bound) return false;
  const { world, camera } = bound;
  resetWorld(world);
  world.intro = 0;
  world.events = [];
  const city = world.city;
  const player = world.player;
  world.shotName = name;
  world.mode = 'shot';
  world.wanted.stars = 0;
  world.wanted.heat = 0;
  world.wanted.visible = false;

  if (name === 'downtown') {
    const node = nodeAt(city, 2, 2);
    clearCars(world);
    clearPeds(world);
    player.x = node.x + 16;
    player.y = node.y + 6;
    player.angle = -0.4;
    player.aim = -1.2;
    player.money = 1840;
    addCopCar(world, node.x - 86, node.y + 152, -Math.PI / 2);
    addCopCar(world, node.x + 186, node.y - 78, Math.PI);
    addCar(world, 'bus', node.x - 236, node.y + 46, 0.02, 'ai', '#e8b33c');
    addCar(world, 'sedan', node.x - 120, node.y - 84, Math.PI / 2, 'ai', '#c8d3e2');
    addCar(world, 'taxi', node.x + 62, node.y + 282, -Math.PI / 2, 'ai', '#f2c437');
    addCar(world, 'muscle', node.x - 300, node.y - 66, 0, 'ai', '#b3261e');
    addPed(world, node.x + 84, node.y + 60, -0.6);
    addPed(world, node.x + 118, node.y + 96, 2.2);
    addPed(world, node.x - 44, node.y + 88, 0.4);
    addPed(world, node.x + 42, node.y - 96, 1.6);
    addPed(world, node.x - 210, node.y + 120, -1.1);
    addPed(world, node.x + 210, node.y + 130, 2.8);
    world.wanted.stars = 3;
    world.wanted.heat = 3;
    world.wanted.visible = true;
    world.wanted.label = 'ALL UNITS RESPOND';
    if (world.mission) {
      world.mission.step = 1;
      world.mission.marker = world.mission.marinaMarker;
    }
    camera.x = node.x + 8;
    camera.y = node.y + 34;
    camera.zoom = 0.94;
    world.area = 'DOWNTOWN';
  } else if (name === 'chase') {
    const node = nodeAt(city, 2, 3);
    clearCars(world);
    clearPeds(world);
    const car = addCar(world, 'sports', node.x - 26, node.y + 180, -Math.PI / 2, null, '#ff3d6e');
    car.vx = 6;
    car.vy = -330;
    player.x = car.x;
    player.y = car.y;
    enterCar(world, car);
    player.health = 82;
    player.armour = 40;
    addCopCar(world, node.x - 26, node.y + 366, -Math.PI / 2);
    addCopCar(world, node.x + 30, node.y + 438, -Math.PI / 2);
    addCopCar(world, node.x - 82, node.y + 520, -Math.PI / 2);
    addCar(world, 'van', node.x + 96, node.y - 40, -Math.PI / 2, 'ai', '#d9dee6');
    addCar(world, 'sedan', node.x - 96, node.y - 210, Math.PI / 2, 'ai', '#5f7fa8');
    world.cars[1].vx = 0;
    world.cars[1].vy = -300;
    world.cars[2].vx = 0;
    world.cars[2].vy = -305;
    addPed(world, node.x + 70, node.y + 120, -0.2);
    addPed(world, node.x - 76, node.y + 60, 1.2);
    world.wanted.stars = 3;
    world.wanted.heat = 3;
    world.wanted.visible = true;
    world.wanted.label = 'PURSUIT IN PROGRESS';
    if (world.mission) {
      world.mission.step = 2;
      world.mission.timer = 27;
      world.mission.marker = world.mission.marinaMarker;
    }
    camera.x = car.x;
    camera.y = car.y - 40;
    camera.zoom = 0.9;
    world.area = 'NEON ROW';
  } else if (name === 'street') {
    const block = findBlock(city, 'neon');
    clearCars(world);
    clearPeds(world);
    player.x = block.x - 34;
    player.y = block.y + 210;
    player.angle = -0.2;
    player.aim = -0.2;
    player.money = 640;
    addCar(world, 'sedan', block.x - 96, block.y + 150, Math.PI, 'ai', '#8c2f3a');
    addCar(world, 'sports', block.x - 84, block.y + 300, 0, 'ai', '#28d7ff');
    addPed(world, block.x + 6, block.y + 160, 0.4);
    addPed(world, block.x + 20, block.y + 250, 2.4);
    addPed(world, block.x - 22, block.y + 330, -0.8);
    addPed(world, block.x + 34, block.y + 80, 1.2);
    addPed(world, block.x - 16, block.y + 60, 2.8);
    addPed(world, block.x + 8, block.y + 400, 0.2);
    if (world.mission) {
      world.mission.step = 0;
      world.mission.marker = { x: world.mission.marker.x, y: world.mission.marker.y };
    }
    camera.x = player.x + 40;
    camera.y = player.y + 10;
    camera.zoom = 1;
    world.area = 'NEON ROW';
  } else if (name === 'mission') {
    const mission = world.mission;
    clearCars(world);
    clearPeds(world);
    const car = mission?.car;
    if (car) {
      car.x = mission.startMarker.x;
      car.y = mission.startMarker.y;
      car.angle = -Math.PI / 2;
      car.vx = 0;
      car.vy = 0;
      world.cars.push(car);
      player.x = car.x - 54;
      player.y = car.y + 74;
    } else {
      player.x = city.width / 2;
      player.y = city.height / 2;
    }
    player.angle = -0.6;
    player.aim = -1.1;
    player.money = 1240;
    addCar(world, 'sedan', player.x - 60, player.y + 130, Math.PI / 2, 'ai', '#b8a06a');
    addPed(world, player.x + 76, player.y - 20, -0.4);
    addPed(world, player.x - 96, player.y + 26, 2.2);
    addPed(world, player.x + 24, player.y + 150, 0.9);
    if (mission) {
      mission.step = 0;
      mission.marker = { x: car.x, y: car.y - 20 };
      world.marker = missionMarker(world);
    }
    camera.x = player.x + 44;
    camera.y = player.y - 30;
    camera.zoom = 1;
    world.area = 'OLD KESTREL';
  } else {
    return false;
  }

  if (name !== 'downtown' && name !== 'chase') {
    world.marker = missionMarker(world);
  }
  scarePeople(world, player.x, player.y, 0);
  bound.name = name;
  return true;
}

export { findBlock };
