// The story contract: a gold coupé sitting in a lot, a marina drop, then a tail of police cars
// that has to be lost. The mission is a small state machine with three steps, a gold marker the
// HUD and the world renderer both read, and a payday at the end.

import { MISSION } from './config.js';
import { createVehicle } from './vehicle.js';

const STEPS = [
  { id: 'steal', title: 'HOT WHEELS', line: 'Steal the gold coupé from the lot' },
  { id: 'deliver', title: 'MARINA DROP', line: 'Drive it to the marina dock' },
  { id: 'escape', title: 'LOSE THE HEAT', line: 'Shake the police before the clock runs out' },
];

function findBlock(city, kind) {
  return city.blocks.find((block) => block.kind === kind) ?? city.blocks[0];
}

export function missionSetup(world) {
  const city = world.city;
  const lot = findBlock(city, 'lot');
  const marina = findBlock(city, 'marina');
  const startX = lot.x + lot.w / 2;
  const startY = lot.y + lot.h / 2;
  const car = createVehicle(world, 'sports', startX, startY - 30, -Math.PI / 2, {
    driver: null,
    colour: '#ffcf4a',
    missionCar: true,
    locked: true,
  });
  car.missionTag = true;
  const mission = {
    active: true,
    complete: false,
    failed: false,
    step: 0,
    car,
    timer: 0,
    escapeSeconds: 38,
    reward: MISSION.reward[4],
    blurb: 'A collector wants the coupé. He does not want to know how you got it.',
    marker: { x: car.x, y: car.y - 20 },
    startMarker: { x: startX, y: startY - 30 },
    marinaMarker: { x: marina.x + marina.w / 2, y: marina.y + 74 },
    failReason: '',
    flash: 0,
    hint: 0,
  };
  return mission;
}

export function startMission(world) {
  const mission = world.mission;
  if (!mission || mission.failed) {
    world.mission = missionSetup(world);
    world.events.push({ type: 'mission', text: 'MISSION STARTED', sub: world.mission.blurb });
    return;
  }
  mission.active = true;
}

export function advanceMission(world, text, sub) {
  const mission = world.mission;
  mission.flash = 2.6;
  mission.hint = 6;
  world.events.push({ type: 'mission', text, sub });
}

export function missionMarker(world) {
  const mission = world.mission;
  if (!mission || mission.complete || mission.failed) return null;
  if (mission.step === 0) return { x: mission.marker.x, y: mission.marker.y, r: MISSION.markerRadius, kind: 'steal' };
  if (mission.step === 1) return { x: mission.marinaMarker.x, y: mission.marinaMarker.y, r: MISSION.markerRadius + 24, kind: 'deliver' };
  return { x: mission.marinaMarker.x, y: mission.marinaMarker.y, r: MISSION.markerRadius, kind: 'escape' };
}

export function missionObjective(world) {
  const mission = world.mission;
  if (!mission) return { step: 0, total: STEPS.length, title: 'NO CONTRACT', line: 'Press J to look for work', done: false };
  if (mission.complete) return { step: STEPS.length, total: STEPS.length, title: 'PAID IN FULL', line: `The coupé is gone. $${mission.reward} is yours.`, done: true };
  if (mission.failed) return { step: mission.step, total: STEPS.length, title: 'CONTRACT BLOWN', line: mission.failReason || 'Press J to try again', done: false };
  const step = STEPS[Math.min(mission.step, STEPS.length - 1)];
  let line = step.line;
  if (mission.step === 2) line = `${step.line} — ${Math.ceil(mission.timer)}s`;
  return { step: mission.step + 1, total: STEPS.length, title: step.title, line, done: false };
}

function failMission(world, reason) {
  const mission = world.mission;
  if (!mission || mission.complete || mission.failed) return;
  mission.failed = true;
  mission.active = false;
  mission.failReason = reason;
  mission.flash = 2.6;
  world.events.push({ type: 'mission', text: 'CONTRACT BLOWN', sub: reason });
}

function completeMission(world) {
  const mission = world.mission;
  if (!mission || mission.complete) return;
  mission.complete = true;
  mission.active = false;
  mission.flash = 3.2;
  world.player.money += mission.reward;
  world.score += 1;
  world.events.push({ type: 'mission', text: 'PAID IN FULL', sub: `+$${mission.reward} · the marina never saw you` });
  if (mission.car && !mission.car.dead) {
    mission.car.missionCar = false;
    mission.car.locked = false;
  }
}

export function resetMission(world) {
  if (world.mission?.car && !world.mission.car.dead) {
    world.cars = world.cars.filter((car) => car !== world.mission.car);
  }
  world.mission = missionSetup(world);
}

export function updateMission(world, dt) {
  const mission = world.mission;
  if (!mission) return;
  if (mission.flash > 0) mission.flash -= dt;
  if (mission.hint > 0) mission.hint -= dt;
  if (mission.complete || mission.failed) return;
  const player = world.player;
  if (player.dead) {
    failMission(world, 'You bled out before the handoff');
    return;
  }
  if (mission.car && mission.car.dead) {
    failMission(world, 'The coupé is scrap now');
    return;
  }
  if (mission.step === 0) {
    const d = Math.hypot(player.x - mission.marker.x, player.y - mission.marker.y);
    if (player.car === mission.car) {
      mission.step = 1;
      mission.marker = mission.marinaMarker;
      world.report('steal', player.x, player.y);
      advanceMission(world, 'STEP 2 — MARINA DROP', 'The gold coupé is yours. Get it to the dock.');
    } else if (d < 90 && mission.hint <= 0) {
      mission.hint = 5;
      world.events.push({ type: 'hint', text: 'Press E beside the gold coupé' });
    }
    return;
  }
  if (mission.step === 1) {
    const d = Math.hypot(player.x - mission.marinaMarker.x, player.y - mission.marinaMarker.y);
    if (player.car === mission.car && d < MISSION.markerRadius + 34) {
      mission.step = 2;
      mission.timer = mission.escapeSeconds;
      world.report('heat', player.x, player.y);
      advanceMission(world, 'STEP 3 — LOSE THE HEAT', 'The marina called it in. Drive like you mean it.');
    } else if (player.car !== mission.car && mission.hint <= 0) {
      mission.hint = 6;
      world.events.push({ type: 'hint', text: 'The coupé is not with you. Go back for it.' });
    }
    return;
  }
  if (mission.step === 2) {
    mission.timer -= dt;
    if (world.wanted.stars === 0) {
      completeMission(world);
      return;
    }
    if (mission.timer <= 0) {
      mission.timer = 22;
      world.report('heat', player.x, player.y);
      world.events.push({ type: 'hint', text: 'More units inbound. Keep moving.' });
    }
  }
}

export function missionCar(world) {
  return world.mission?.car ?? null;
}

export const MISSION_STEPS = STEPS;
