// Kestrel City — every tuning number, vehicle class, weapon and colour in one place.
// World units are pixels at a fixed 1280x720 design resolution; the renderer scales the
// canvas to the window, so no rule below depends on the screen size. One block is 560 px
// of buildings and sidewalk plus a 116 px road, and the coast sits east of the grid.

export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export const CITY = {
  cols: 5,
  rows: 5,
  road: 116,
  block: 560,
  pitch: 676,
  sidewalk: 30,
  inset: 12,
  sand: 170,
  sea: 470,
};
CITY.width = CITY.cols * CITY.pitch + CITY.road;
CITY.height = CITY.rows * CITY.pitch + CITY.road;
CITY.coast = CITY.width;
CITY.worldWidth = CITY.width + CITY.sand + CITY.sea;
CITY.worldHeight = CITY.height;

export const PLAYER = {
  radius: 12,
  walk: 148,
  run: 246,
  accel: 1400,
  friction: 11,
  health: 100,
  armour: 25,
  hitFlash: 0.35,
  respawn: 2.4,
  enterRange: 74,
  exitOffset: 30,
  startMoney: 240,
};

export const VEHICLE_KINDS = ['sedan', 'sports', 'taxi', 'van', 'muscle', 'police', 'bus'];

export const VEHICLES = {
  sedan: {
    name: 'Sedan', length: 46, width: 21, height: 34, mass: 1,
    maxSpeed: 312, reverse: 116, accel: 300, brake: 640, drag: 0.55, turn: 2.35,
    grip: 7.2, health: 110, seats: 4,
    colours: ['#c8d3e2', '#5f7fa8', '#8c2f3a', '#2f4a3e', '#b8a06a', '#3c3f52'],
  },
  sports: {
    name: 'Coupé', length: 50, width: 22, height: 30, mass: 0.9,
    maxSpeed: 438, reverse: 150, accel: 470, brake: 760, drag: 0.42, turn: 2.72,
    grip: 8.6, health: 88, seats: 2,
    colours: ['#ff3d6e', '#28d7ff', '#ffd24a', '#7b5cff', '#f4f6fb'],
  },
  taxi: {
    name: 'Taxi', length: 46, width: 21, height: 36, mass: 1.05,
    maxSpeed: 292, reverse: 110, accel: 286, brake: 600, drag: 0.6, turn: 2.28,
    grip: 7, health: 108, seats: 4,
    colours: ['#f2c437'],
  },
  van: {
    name: 'Van', length: 58, width: 25, height: 46, mass: 1.5,
    maxSpeed: 248, reverse: 96, accel: 230, brake: 540, drag: 0.72, turn: 1.92,
    grip: 6.1, health: 155, seats: 3,
    colours: ['#d9dee6', '#4a6b52', '#7a4a36', '#3b4a63'],
  },
  muscle: {
    name: 'Muscle', length: 49, width: 22, height: 32, mass: 1.1,
    maxSpeed: 386, reverse: 128, accel: 420, brake: 680, drag: 0.5, turn: 2.5,
    grip: 7.8, health: 120, seats: 2,
    colours: ['#1f2a3d', '#b3261e', '#e7e2d3', '#2f6d4f', '#6a3b8f'],
  },
  bus: {
    name: 'City Bus', length: 112, width: 27, height: 52, mass: 2.4,
    maxSpeed: 196, reverse: 70, accel: 170, brake: 430, drag: 0.9, turn: 1.5,
    grip: 5.4, health: 240, seats: 18,
    colours: ['#e8b33c', '#d9503f'],
  },
  police: {
    name: 'Patrol', length: 48, width: 22, height: 34, mass: 1.05,
    maxSpeed: 418, reverse: 130, accel: 410, brake: 720, drag: 0.46, turn: 2.55,
    grip: 8.2, health: 150, seats: 3,
    colours: ['#e9eef7'],
  },
};

export const PED = {
  radius: 9,
  walk: 54,
  flee: 138,
  health: 40,
  count: 74,
  coat: ['#c96a4a', '#4a86c9', '#c9b04a', '#6a4ac9', '#4ac98a', '#d7dbe3', '#e06a9a'],
  skin: ['#f0c8a0', '#c98d62', '#8a5a3c', '#5f3a26', '#e8b98c'],
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 14, rate: 0.36, range: 38, clip: 0, ammo: 0, spread: 0, speed: 0, pellets: 0 },
  pistol: { name: 'Pistol', damage: 27, rate: 0.24, range: 560, clip: 12, ammo: 96, spread: 0.035, speed: 1350, pellets: 1, reload: 1.15 },
  smg: { name: 'SMG', damage: 16, rate: 0.085, range: 520, clip: 30, ammo: 240, spread: 0.075, speed: 1300, pellets: 1, reload: 1.6 },
  shotgun: { name: 'Shotgun', damage: 13, rate: 0.82, range: 380, clip: 6, ammo: 48, spread: 0.16, speed: 1150, pellets: 7, reload: 1.9 },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun'];

export const POLICE = {
  stars: 5,
  spawnDelay: [0, 7, 4.2, 3.2, 2.2, 1.4],
  maxCars: [0, 1, 2, 3, 4, 6],
  copHealth: 82,
  copWalk: 132,
  copRun: 188,
  fireRate: 0.62,
  damage: 9,
  range: 470,
  accuracy: 0.62,
  exitRange: 250,
  escapeSeconds: 24,
  starSeconds: 13,
  crimes: { shot: 1, killPed: 2, killCop: 2, steal: 1, ram: 1 },
};

export const MISSION = {
  markerRadius: 44,
  reward: [500, 800, 1200, 1600, 3000],
};

export const LIMITS = {
  traffic: 26,
  cops: 6,
  bullets: 160,
  particles: 320,
  pickups: 24,
};

export const CAMERA = {
  follow: 7.5,
  lookAhead: 150,
  zoom: 1,
  shakeDecay: 5.5,
  deathZoom: 0.82,
};

export const COLORS = {
  void: '#070b13',
  water: '#0b2231',
  waterLight: '#123449',
  foam: '#3d6a7a',
  sand: '#6b5a42',
  sandLight: '#7d6a4e',
  asphalt: '#161d2b',
  asphaltLight: '#1b2334',
  lane: '#b9c7dc',
  laneDim: '#3d4a60',
  crossing: '#cfd9e8',
  sidewalk: '#2e384d',
  sidewalkEdge: '#46536c',
  curb: '#59677f',
  grass: '#1d3a31',
  grassLight: '#274a3c',
  roof: ['#27324a', '#303c57', '#232e45', '#37324f', '#2b3640', '#3a4152'],
  roofEdge: '#111827',
  wall: '#0d131f',
  windowWarm: '#ffc887',
  windowCool: '#83e6ff',
  neon: ['#ff3d9a', '#2ee6ff', '#ffb02e', '#7dff6a', '#b06bff', '#ff6a3d'],
  car: '#cfd8e6',
  team: '#e9eef7',
  policeBlue: '#2b6cff',
  policeRed: '#ff2d4a',
  player: '#eef3fb',
  playerJacket: '#18c9bd',
  playerHair: '#20242e',
  cop: '#26324d',
  copSkin: '#d8a67c',
  money: '#65e08a',
  gold: '#ffcf4a',
  danger: '#ff4a5e',
  blood: '#8e1226',
  muzzle: '#ffe6a8',
  smoke: '#8a93a6',
  health: '#4fe08a',
  armour: '#53b7ff',
  panel: 'rgba(9,14,24,0.82)',
  text: '#eef3fb',
  muted: '#94a3bd',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const DISPLAY_FONT = '"Arial Black", "Segoe UI", system-ui, sans-serif';

export const SAVE_KEY = 'kestrel-city.save.v1';
export const MUTE_KEY = 'kestrel-city.muted';

export const SHOT_NAMES = ['downtown', 'chase', 'street', 'mission'];

export const AREA_NAMES = [
  { name: 'La Marina', x: 0.86, y: 0.5, r: 0.22 },
  { name: 'Neon Row', x: 0.72, y: 0.24, r: 0.18 },
  { name: 'Downtown', x: 0.5, y: 0.5, r: 0.2 },
  { name: 'Palm Heights', x: 0.48, y: 0.14, r: 0.2 },
  { name: 'Foundry', x: 0.24, y: 0.78, r: 0.22 },
  { name: 'Old Kestrel', x: 0.16, y: 0.34, r: 0.2 },
];
