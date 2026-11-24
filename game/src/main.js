// Bootstrap: canvas, clock, mode machine (title, play, pause, shot, demo, frozen), save slot and
// the browser-facing hooks (`window.__perf`, `window.setupShot`). Simulation lives in world.js.

import { VIEW, STEP, MAX_FRAME, SHOT_NAMES, COLORS } from './config.js';
import { createWorld, step, saveSnapshot, loadSnapshot, startMission, drainEvents } from './world.js';
import { createCamera, updateCamera, snapCamera } from './camera.js';
import { createRenderer, renderWorld } from './render.js';
import { createInput } from './input.js';
import { drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { bindShotWorld, setupShot } from './shots.js';
import { nearestCar, enterCar, leaveCar, selectWeapon, beginReload } from './player.js';
import { createVehicle } from './vehicle.js';
import { spawnPoliceCar } from './police.js';
import { nodePoint } from './city.js';
import { clamp } from './collision.js';
import { hasSave, readSave, writeSave, readMuted, writeMuted } from './save.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const demoParam = params.get('demo');
const canvas = document.querySelector('#game');
const titleEl = document.querySelector('#title');
const playButton = document.querySelector('#play');
const continueButton = document.querySelector('#continue');
const buildTag = document.querySelector('#build');

const perf = { rafs: 0, worst: 0, thrown: 0, error: null, mode: 'boot', since: Math.round(performance.now()), fps: 0, cars: 0, peds: 0 };
window.__perf = perf;

const world = createWorld({ seed: 20261119 });
const camera = createCamera(world);
const renderer = createRenderer(canvas);
const input = createInput(canvas, VIEW);
const audio = createAudio();
const ui = { toasts: [], prompt: null, paused: false };
bindShotWorld(world, camera);

let mode = 'title';
let accumulator = 0;
let last = performance.now();
let muted = readMuted();
let nextAutosave = performance.now() + 20000;
let lastMissionStep = world.mission ? world.mission.step : 0;
let demoUntil = 0;
let titleTime = 0;
let frames = 0;
let fpsWindow = performance.now();

audio.setMuted(muted);
if (buildTag) buildTag.textContent = 'SEED 20261119 · 2D CANVAS · NIGHT SHIFT';

function setTitle(on) {
  if (titleEl) titleEl.classList.toggle('hidden', !on);
  document.body.dataset.title = on ? 'on' : 'off';
}

function setMode(next, label) {
  mode = next;
  world.mode = next === 'frozen' ? 'frozen' : next;
  perf.mode = label ?? next;
  document.body.dataset.mode = perf.mode;
}

function toast(text, sub = null, colour = COLORS.gold, life = 3, big = false) {
  ui.toasts.push({ text, sub, colour, life, big });
  if (ui.toasts.length > 4) ui.toasts.shift();
}

function beginPlay() {
  setTitle(false);
  audio.unlock();
  setMode('play');
  world.intro = 2.2;
  snapCamera(camera, world);
  if (!world.mission || (!world.mission.active && !world.mission.complete)) {
    toast('NIGHT SHIFT', 'Find the gold coupé on the lot east of Neon Row', COLORS.gold, 4);
  }
}

function continueGame() {
  const data = readSave();
  if (!data || !loadSnapshot(world, data)) {
    beginPlay();
    return;
  }
  setTitle(false);
  audio.unlock();
  setMode('play');
  world.intro = 0.8;
  snapCamera(camera, world);
  toast('WELCOME BACK', `$${world.player.money} · ${world.wanted.stars > 0 ? 'still wanted' : 'heat is cold'}`, COLORS.gold, 3.4);
}

function togglePause() {
  if (mode === 'title') return;
  if (mode === 'paused') {
    ui.paused = false;
    last = performance.now();
    setMode('play');
  } else if (mode === 'play') {
    ui.paused = true;
    setMode('paused');
  }
}

function nearHint() {
  const player = world.player;
  if (player.car) return null;
  const mission = world.mission;
  if (mission && !mission.active && !mission.complete && mission.car) {
    if (Math.hypot(mission.car.x - player.x, mission.car.y - player.y) <= 96) return 'STEAL THE GOLD COUPÉ';
  }
  const car = nearestCar(world, player.x, player.y, 74);
  return car ? `${car.spec.name.toUpperCase()} · PRESS E` : null;
}

function aimPoint() {
  const mouse = input.state.mouse;
  const zoom = camera.zoom || 1;
  return {
    x: camera.x + (mouse.x - VIEW.width / 2 - camera.offsetX) / zoom,
    y: camera.y + (mouse.y - VIEW.height / 2 - camera.offsetY) / zoom,
  };
}

function controlsForFrame() {
  const player = world.player;
  const shoot = input.isDown('fire') || input.state.mouse.down;
  if (player.car) {
    const drive = input.driveAxis();
    return { throttle: drive.throttle, steer: drive.steer, brake: drive.brake, shoot };
  }
  const axis = input.axis();
  const aim = aimPoint();
  return { x: axis.x, y: axis.y, run: input.isDown('run'), aim: Math.atan2(aim.y - player.y, aim.x - player.x), shoot };
}

function handleInput() {
  if (input.wasPressed('mute')) {
    muted = !muted;
    audio.setMuted(muted);
    writeMuted(muted);
    toast(muted ? 'SOUND OFF' : 'SOUND ON', null, COLORS.muted, 1.4);
  }
  if (input.wasPressed('pause')) {
    togglePause();
    return;
  }
  if (mode !== 'play') return;
  const player = world.player;
  if (input.wasPressed('enter')) {
    if (player.car) leaveCar(world);
    else {
      const car = nearestCar(world, player.x, player.y, 74);
      if (car) enterCar(world, car);
    }
  }
  if (input.wasPressed('reload')) beginReload(player);
  if (input.wasPressed('weapon1')) selectWeapon(player, 0);
  if (input.wasPressed('weapon2')) selectWeapon(player, 1);
  if (input.wasPressed('weapon3')) selectWeapon(player, 2);
  if (input.wasPressed('mission') && world.mission && !world.mission.active) startMission(world);
}

function collectEvents() {
  const events = drainEvents(world);
  for (const event of events) {
    if (event.type === 'mission') {
      const good = event.text === 'PAID IN FULL';
      toast(event.text, event.sub ?? null, good ? COLORS.health : COLORS.gold, 3.6, good);
    } else if (event.type === 'hint') toast(event.text, null, COLORS.muted, 2.4);
    else if (event.type === 'respawn') toast(event.text, event.sub ?? null, COLORS.muted, 2.8);
    else if (event.type === 'wanted') {
      if (event.stars > 0) toast(event.text || `WANTED ${event.stars}`, 'Lose the patrol cars', COLORS.danger, 2.6);
      else toast('HEAT LOST', 'The city forgets, eventually', COLORS.health, 2.4);
    } else if (event.type === 'pickup') {
      const labels = { health: '+ HEALTH', armour: '+ ARMOUR', ammo: '+ AMMO', cash: '+ CASH' };
      toast(labels[event.kind] ?? 'PICKED UP', null, COLORS.health, 1.5);
    } else if (event.type === 'death') {
      toast('WASTED', 'St. Kestrel General will stitch you up', COLORS.danger, 3.6, true);
      writeSave(saveSnapshot(world));
    }
  }
  audio.handle(events);
}

function advance(dt) {
  accumulator += dt;
  let guard = 0;
  while (accumulator >= STEP && guard < 5) {
    step(world, STEP, controlsForFrame());
    accumulator -= STEP;
    guard += 1;
  }
  if (accumulator > STEP * 5) accumulator = 0;
}

function runDemo(dt) {
  const car = world.player.car;
  const steer = car ? clamp(((car.demoLane ?? car.x) - car.x) * 0.02, -0.3, 0.3) : 0;
  step(world, dt, { throttle: 1, steer, brake: false, shoot: false });
  if (performance.now() > demoUntil) {
    setMode('frozen', 'demo-frozen');
    writeSave(saveSnapshot(world));
  }
}

function startDemo(kind) {
  setTitle(false);
  audio.unlock();
  setMode('demo');
  const node = nodePoint(world.city, 2, 4);
  const car = createVehicle(world, 'sports', node.x + 26, node.y - 160, -Math.PI / 2, { colour: '#ff3d6e' });
  car.vy = -250;
  car.demoLane = node.x + 26;
  world.cars.push(car);
  enterCar(world, car);
  world.player.money = 4200;
  if (kind === 'chase') {
    Object.assign(world.wanted, { stars: 3, heat: 930, visible: true, label: 'PURSUIT IN PROGRESS' });
    spawnPoliceCar(world, car.x - 20, car.y + 380);
    spawnPoliceCar(world, car.x + 34, car.y + 520);
    ui.toasts.length = 0;
    toast('WANTED 3', 'Demo pursuit · ten second run', COLORS.danger, 4);
  } else toast('NIGHT DRIVE', 'Demo drive · ten second run', COLORS.gold, 4);
  snapCamera(camera, world);
  demoUntil = performance.now() + 10000;
}

function setShot(name) {
  if (!SHOT_NAMES.includes(name)) return false;
  setTitle(false);
  if (!setupShot(name)) return false;
  ui.paused = false;
  setMode('shot');
  document.body.dataset.shot = name;
  return true;
}
window.setupShot = setShot;
window.__game = () => ({ world, camera, mode, perf, ui });

function renderFrame(clock) {
  renderWorld(renderer, world, camera, clock);
  drawHud(renderer.ctx, world, camera, ui);
}

function frame(now) {
  perf.rafs += 1;
  const raw = (now - last) / 1000;
  last = now;
  perf.worst = Math.max(perf.worst, Math.min(MAX_FRAME, raw) * 1000);
  frames += 1;
  if (now - fpsWindow > 1000) {
    perf.fps = Math.round((frames * 1000) / (now - fpsWindow));
    frames = 0;
    fpsWindow = now;
  }
  try {
    const dt = Math.min(MAX_FRAME, Math.max(0, raw));
    ui.toasts = ui.toasts.filter((entry) => {
      entry.life -= dt;
      return entry.life > 0;
    });
    if (mode === 'title') {
      titleTime += dt;
      camera.x = world.player.x + Math.sin(titleTime * 0.12) * 420;
      camera.y = world.player.y + Math.cos(titleTime * 0.09) * 300;
      camera.zoom = 0.78;
      world.intro = Math.max(world.intro, 0.55);
      renderFrame(world.time + titleTime);
    } else if (mode === 'shot' || mode === 'frozen') {
      renderFrame(world.time);
    } else {
      handleInput();
      if (mode === 'play') {
        advance(dt);
        collectEvents();
        if (now > nextAutosave) {
          writeSave(saveSnapshot(world));
          nextAutosave = now + 20000;
          toast('AUTOSAVED', null, COLORS.muted, 1.4);
        }
        const stepNow = world.mission ? world.mission.step : 0;
        if (stepNow !== lastMissionStep) {
          lastMissionStep = stepNow;
          writeSave(saveSnapshot(world));
        }
      } else if (mode === 'demo') {
        runDemo(dt);
        collectEvents();
      }
      updateCamera(camera, world, dt);
      ui.prompt = mode === 'play' ? nearHint() : null;
      renderFrame(world.time);
    }
    perf.cars = world.cars.length;
    perf.peds = world.peds.length;
    if (mode !== 'shot' && mode !== 'frozen' && mode !== 'title') perf.mode = mode;
    input.endFrame();
  } catch (error) {
    perf.thrown += 1;
    perf.error = error && error.stack ? String(error.stack) : String(error);
    if (window.console) console.error(error);
    input.endFrame();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('error', (event) => {
  perf.thrown += 1;
  perf.error = String(event.message || event.error || 'unknown error');
});

if (playButton) playButton.addEventListener('click', () => { if (mode === 'title') beginPlay(); });
if (continueButton) continueButton.addEventListener('click', () => { if (mode === 'title') continueGame(); });

window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (mode === 'title' && (code === 'Enter' || code === 'NumpadEnter')) {
    event.preventDefault();
    beginPlay();
    return;
  }
  if (mode !== 'play') return;
  if (code === 'KeyK') {
    const saved = writeSave(saveSnapshot(world));
    toast(saved ? 'GAME SAVED' : 'SAVE UNAVAILABLE', null, saved ? COLORS.health : COLORS.danger, 1.8);
  } else if (code === 'KeyL') {
    const data = readSave();
    if (data && loadSnapshot(world, data)) {
      snapCamera(camera, world);
      toast('SAVE LOADED', null, COLORS.gold, 1.8);
    } else toast('NO SAVE FOUND', null, COLORS.muted, 1.6);
  }
});

if (shotParam && SHOT_NAMES.includes(shotParam)) {
  setShot(shotParam);
  perf.mode = 'shot';
} else if (demoParam === 'drive' || demoParam === 'chase') {
  startDemo(demoParam);
} else {
  setTitle(true);
  if (continueButton) continueButton.style.display = hasSave() ? 'inline-flex' : 'none';
  setMode('title');
}

requestAnimationFrame(frame);
