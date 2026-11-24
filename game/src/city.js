// Builds Kestrel City from a seed: the road grid, every block's buildings and props, the
// coast with its beach, piers and water, the intersection graph the traffic follows, and the
// lookup tables the renderer and the missions use. Physics only ever sees the solid rects.

import { AREA_NAMES, CITY, COLORS } from './config.js';
import { createRandom } from './random.js';

const BLOCK_KINDS = [
  ['apartments', 'park', 'apartments', 'shops', 'park'],
  ['shops', 'tower', 'shops', 'tower', 'neon'],
  ['apartments', 'tower', 'plaza', 'tower', 'neon'],
  ['foundry', 'shops', 'apartments', 'tower', 'neon'],
  ['foundry', 'lot', 'foundry', 'shops', 'marina'],
];

const SIGN_WORDS = ['BAR', 'HOTEL', 'RAMEN', 'CLUB', '24H', 'PAWN', 'LIQUOR', 'TACO', 'MOTEL', 'DINER', 'GAS', 'NAILS', 'VINYL', 'PHO'];

function addBuilding(city, block, rng, x, y, w, h, tall) {
  const building = {
    x, y, w, h,
    roof: rng.int(0, COLORS.roof.length - 1),
    tall: tall + rng.range(-4, 6),
    lit: rng.range(0.22, 0.8),
    seed: rng.int(0, 9999),
    kind: block.kind,
    sign: null,
  };
  city.solids.push(building);
  block.buildings.push(building);
  return building;
}

function addSign(city, rng, building, vertical) {
  const colour = rng.pick(COLORS.neon);
  const word = rng.pick(SIGN_WORDS);
  const sign = vertical
    ? { x: building.x - 8, y: building.y + 18, w: 10, h: Math.min(76, building.h * 0.55), colour, word }
    : { x: building.x + 14, y: building.y - 9, w: Math.min(96, building.w * 0.7), h: 10, colour, word };
  building.sign = sign;
  city.signs.push(sign);
}

function buildTower(city, block, rng) {
  const pad = 44;
  const w = block.w - pad * 2 - rng.range(0, 40);
  const h = block.h - pad * 2 - rng.range(0, 40);
  const building = addBuilding(city, block, rng, block.x + pad, block.y + pad, w, h, 30);
  building.crown = rng.chance(0.5);
  if (rng.chance(0.7)) addSign(city, rng, building, rng.chance(0.5));
  city.props.push({ type: 'planter', x: block.x + 18, y: block.y + 18, r: 9 });
  city.props.push({ type: 'planter', x: block.x + block.w - 18, y: block.y + block.h - 18, r: 9 });
}

function buildShops(city, block, rng) {
  const count = rng.int(2, 3);
  const pad = 40;
  const innerW = block.w - pad * 2;
  const innerH = block.h - pad * 2;
  const front = rng.chance(0.5);
  for (let i = 0; i < count; i += 1) {
    const gap = 14;
    const w = (innerW - gap * (count - 1)) / count;
    const depth = innerH * rng.range(0.62, 0.8);
    const x = block.x + pad + i * (w + gap);
    const y = front ? block.y + pad : block.y + block.h - pad - depth;
    const building = addBuilding(city, block, rng, x, y, w, depth, 14);
    if (rng.chance(0.85)) addSign(city, rng, building, false);
    city.props.push({ type: 'bin', x: x + w - 6, y: front ? y + depth + 10 : y - 10, r: 5 });
  }
  city.props.push({ type: 'hydrant', x: block.x + 12, y: block.y + block.h - 12, r: 4 });
}

function buildApartments(city, block, rng) {
  const pad = 42;
  const innerW = block.w - pad * 2;
  const innerH = block.h - pad * 2;
  const rows = rng.int(1, 2);
  const cols = rng.int(1, 2);
  const gap = 18;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const w = (innerW - gap * (cols - 1)) / cols;
      const h = (innerH - gap * (rows - 1)) / rows;
      const building = addBuilding(city, block, rng, block.x + pad + c * (w + gap), block.y + pad + r * (h + gap), w, h, rng.range(10, 20));
      building.balcony = rng.chance(0.6);
      if (rng.chance(0.25)) addSign(city, rng, building, true);
    }
  }
  city.props.push({ type: 'bench', x: block.x + block.w / 2, y: block.y + 16, r: 6 });
}

function buildPark(city, block, rng) {
  const cx = block.x + block.w / 2;
  const cy = block.y + block.h / 2;
  const pond = rng.chance(0.45);
  block.pond = pond ? { x: cx - 40, y: cy - 26, w: 96, h: 62 } : null;
  city.props.push({ type: 'fountain', x: cx, y: cy, r: 0 });
  for (let i = 0; i < 16; i += 1) {
    city.trees.push({
      x: block.x + rng.range(50, block.w - 50),
      y: block.y + rng.range(50, block.h - 50),
      r: rng.range(16, 27),
      kind: rng.chance(0.45) ? 'palm' : 'oak',
    });
  }
  city.props.push({ type: 'bench', x: cx - 70, y: cy + 60, r: 7 });
  city.props.push({ type: 'bench', x: cx + 40, y: cy - 74, r: 7 });
}

function buildPlaza(city, block, rng) {
  const cx = block.x + block.w / 2;
  const cy = block.y + block.h / 2;
  block.fountain = { x: cx, y: cy, r: 58 };
  city.solids.push({ x: cx - 52, y: cy - 52, w: 104, h: 104, roof: 2, tall: 4, lit: 1, seed: 3, kind: 'fountain', sign: null });
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    city.trees.push({ x: cx + Math.cos(angle) * 176, y: cy + Math.sin(angle) * 176, r: 19, kind: 'palm' });
  }
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    city.props.push({ type: 'bench', x: cx + Math.cos(angle) * 96, y: cy + Math.sin(angle) * 96, r: 7 });
  }
}

function buildLot(city, block, rng) {
  block.lot = true;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (!rng.chance(0.55)) continue;
      city.lotCars.push({
        x: block.x + 92 + col * 96,
        y: block.y + 110 + row * 116,
        angle: rng.chance(0.5) ? 0 : Math.PI,
        kind: rng.pick(['sedan', 'sedan', 'van', 'muscle', 'taxi']),
        colour: rng.pick(COLORS.neon),
      });
    }
  }
  city.props.push({ type: 'booth', x: block.x + 36, y: block.y + 30, r: 9 });
}

function buildFoundry(city, block, rng) {
  const pad = 34;
  const n = rng.int(1, 2);
  for (let i = 0; i < n; i += 1) {
    const w = block.w - pad * 2 - (n === 2 ? 60 : 0);
    const h = n === 2 ? (block.h - pad * 2 - 24) / 2 : block.h - pad * 2;
    const building = addBuilding(city, block, rng, block.x + pad + (n === 2 ? 70 : 0), block.y + pad + i * (h + 24), w, h, 18);
    building.kind = 'warehouse';
    building.vents = rng.int(2, 5);
  }
  for (let i = 0; i < 6; i += 1) {
    city.props.push({ type: 'crate', x: block.x + rng.range(40, block.w - 40), y: block.y + rng.range(40, block.h - 40), r: 8 });
  }
}

function buildMarina(city, block, rng) {
  block.sandLot = true;
  for (let i = 0; i < 7; i += 1) {
    city.trees.push({ x: block.x + 50 + i * 72, y: block.y + 52, r: 17, kind: 'palm' });
  }
  city.props.push({ type: 'hut', x: block.x + block.w - 80, y: block.y + block.h - 90, r: 22 });
}

export function buildCity(seed) {
  const rng = createRandom((seed ^ 0x9e3779b9) >>> 0);
  const city = {
    width: CITY.width,
    height: CITY.height,
    worldWidth: CITY.worldWidth,
    worldHeight: CITY.worldHeight,
    coast: CITY.coast,
    blocks: [],
    solids: [],
    noGo: [],
    nodes: [],
    lamps: [],
    signs: [],
    props: [],
    trees: [],
    lotCars: [],
    sidewalkPoints: [],
    crosswalks: [],
    waterRects: [],
    piers: [],
    yachts: [],
  };

  for (let row = 0; row < CITY.rows; row += 1) {
    for (let col = 0; col < CITY.cols; col += 1) {
      const kind = BLOCK_KINDS[row][col];
      const block = {
        col, row, kind,
        x: col * CITY.pitch + CITY.road,
        y: row * CITY.pitch + CITY.road,
        w: CITY.block,
        h: CITY.block,
        buildings: [],
        pond: null,
        fountain: null,
      };
      city.blocks.push(block);
      if (kind === 'tower') buildTower(city, block, rng);
      else if (kind === 'shops' || kind === 'neon') buildShops(city, block, rng);
      else if (kind === 'apartments') buildApartments(city, block, rng);
      else if (kind === 'park') buildPark(city, block, rng);
      else if (kind === 'plaza') buildPlaza(city, block, rng);
      else if (kind === 'lot') buildLot(city, block, rng);
      else if (kind === 'foundry') buildFoundry(city, block, rng);
      else buildMarina(city, block, rng);
    }
  }

  for (let row = 0; row <= CITY.rows; row += 1) {
    for (let col = 0; col <= CITY.cols; col += 1) {
      city.nodes.push({
        col, row,
        x: col * CITY.pitch + CITY.road / 2,
        y: row * CITY.pitch + CITY.road / 2,
      });
    }
  }

  for (const block of city.blocks) {
    const step = 68;
    for (let x = block.x + 18; x < block.x + block.w - 12; x += step) {
      city.sidewalkPoints.push({ x, y: block.y + 15 }, { x, y: block.y + block.h - 15 });
    }
    for (let y = block.y + 18; y < block.y + block.h - 12; y += step) {
      city.sidewalkPoints.push({ x: block.x + 15, y }, { x: block.x + block.w - 15, y });
    }
  }

  for (const node of city.nodes) {
    city.crosswalks.push({ x: node.x, y: node.y });
    city.lamps.push({ x: node.x - CITY.road / 2 - 12, y: node.y - CITY.road / 2 - 12, r: 150 });
    city.lamps.push({ x: node.x + CITY.road / 2 + 12, y: node.y + CITY.road / 2 + 12, r: 150 });
    if (node.row === 0 || node.row === CITY.rows) {
      city.lamps.push({ x: node.x + CITY.road / 2 + 12, y: node.y - CITY.road / 2 - 12, r: 130 });
    }
  }

  const seaX = city.coast + CITY.sand;
  const pierA = { x: city.coast + CITY.sand * 0.35, y: city.height * 0.27, w: CITY.sand * 0.65 + 240, h: 62, id: 0 };
  const pierB = { x: city.coast + CITY.sand * 0.35, y: city.height * 0.64, w: CITY.sand * 0.65 + 300, h: 58, id: 1 };
  city.piers.push(pierA, pierB);
  const gaps = [
    { y: 0, h: pierA.y - 4 },
    { y: pierA.y + pierA.h + 4, h: pierB.y - pierA.y - pierA.h - 8 },
    { y: pierB.y + pierB.h + 4, h: city.height - pierB.y - pierB.h - 4 },
  ];
  for (const gap of gaps) {
    if (gap.h > 0) city.waterRects.push({ x: seaX, y: gap.y, w: CITY.sea, h: gap.h });
  }
  city.noGo.push(...city.waterRects);

  for (let i = 0; i < 11; i += 1) {
    const x = city.coast + CITY.sand + 40 + rng.range(0, CITY.sea - 110);
    const y = rng.range(60, city.height - 60);
    if (city.piers.some((pier) => y > pier.y - 50 && y < pier.y + pier.h + 50)) continue;
    city.yachts.push({ x, y, angle: Math.PI / 2 + rng.range(-0.15, 0.15), kind: 'yacht' });
  }
  for (let i = 0; i < 14; i += 1) {
    city.props.push({ type: 'umbrella', x: city.coast + rng.range(24, CITY.sand - 24), y: rng.range(40, city.height - 40), r: 10 });
  }
  for (let i = 0; i < 18; i += 1) {
    city.trees.push({ x: city.coast + rng.range(18, CITY.sand - 18), y: rng.range(30, city.height - 30), r: 18, kind: 'palm' });
  }

  return city;
}

export function blockCenter(city, col, row) {
  return { x: col * CITY.pitch + CITY.road + CITY.block / 2, y: row * CITY.pitch + CITY.road + CITY.block / 2 };
}

export function nodePoint(city, col, row) {
  return city.nodes[row * (CITY.cols + 1) + col];
}

export function nearestNode(city, x, y) {
  let best = city.nodes[0];
  let bestDistance = Infinity;
  for (const node of city.nodes) {
    const d = (node.x - x) * (node.x - x) + (node.y - y) * (node.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = node;
    }
  }
  return best;
}

export function areaName(city, x, y) {
  const nx = x / city.worldWidth;
  const ny = y / city.worldHeight;
  let best = AREA_NAMES[0];
  let bestDistance = Infinity;
  for (const area of AREA_NAMES) {
    const d = (area.x - nx) * (area.x - nx) + (area.y - ny) * (area.y - ny);
    if (d < bestDistance) {
      bestDistance = d;
      best = area;
    }
  }
  return best.name;
}

export function laneOffset(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * 24, y: (dx / len) * 24 };
}
