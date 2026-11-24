// Night renderer, top-down: ground and sea, blocks, roads, lamps and neon, buildings, cars,
// people, bullets, particles and the gold beam, finished with a screen-space vignette.

import { COLORS, VIEW, FONT, DISPLAY_FONT, VEHICLES } from './config.js';
import { visibleRect } from './camera.js';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(VIEW.width * dpr);
  canvas.height = Math.round(VIEW.height * dpr);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  return { ctx, dpr, canvas, width: VIEW.width, height: VIEW.height };
}

export function renderWorld(renderer, world, camera, clock) {
  const ctx = renderer.ctx;
  const dpr = renderer.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.void;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.save();
  ctx.translate(VIEW.width / 2 + camera.offsetX, VIEW.height / 2 + camera.offsetY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  const view = visibleRect(camera);
  drawGround(ctx, world, view, clock);
  drawDecals(ctx, world, view);
  drawPickups(ctx, world, view, clock);
  drawMarker(ctx, world, view, clock);
  drawCars(ctx, world, view, clock);
  drawPeople(ctx, world, view);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  drawBeam(ctx, world, view, clock);
  ctx.restore();
  drawNight(ctx, world);
}

function inView(view, x, y, pad = 0) {
  return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
}

function rectVisible(view, r) {
  return r.x + r.w > view.x - 40 && r.x < view.x + view.w + 40 && r.y + r.h > view.y - 40 && r.y < view.y + view.h + 40;
}

function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function drawGround(ctx, world, view, clock) {
  const city = world.city;
  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(0, 0, city.width, city.height);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(city.coast, 0, 170, city.height);
  ctx.fillStyle = COLORS.sandLight;
  for (let y = 0; y < city.height; y += 52) ctx.fillRect(city.coast + 8, y + ((y / 52) % 2) * 12, 154, 3);
  drawSea(ctx, world, view, clock);
  for (const block of city.blocks) if (rectVisible(view, block)) drawBlockBase(ctx, block);
  drawRoads(ctx, city, view);
  drawProps(ctx, city, view, clock);
  for (const solid of city.solids) if (rectVisible(view, solid)) drawBuilding(ctx, solid);
  for (const tree of city.trees) {
    if (!inView(view, tree.x, tree.y, 60)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.arc(tree.x + 5, tree.y + 7, tree.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1e4032';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2f6047';
    ctx.beginPath();
    ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.55, 0, TAU);
    ctx.fill();
  }
  drawPiers(ctx, city, view, clock);
}

function drawSea(ctx, world, view, clock) {
  const city = world.city;
  const x0 = city.coast + 170;
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0, 0, city.worldWidth, city.height);
  for (let band = 0; band < 10; band += 1) {
    ctx.fillStyle = band % 2 === 0 ? 'rgba(24,74,98,0.22)' : 'rgba(9,38,54,0.25)';
    ctx.fillRect(x0, band * 360 + Math.sin(clock * 0.3 + band) * 12, city.worldWidth, 150);
  }
  ctx.strokeStyle = 'rgba(120,200,220,0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const y = (i * 440 + clock * 18) % city.height;
    const offset = Math.sin(clock * 0.9 + i) * 30;
    ctx.beginPath();
    ctx.moveTo(x0 + 40 + offset, y);
    ctx.lineTo(x0 + 190 + offset * 0.4, y - 6);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200,240,245,0.26)';
  for (let y = 0; y < city.height; y += 30) ctx.fillRect(city.coast + 160 + Math.sin(clock * 1.4 + y * 0.05) * 4, y, 16, 12);
  for (const yacht of city.yachts) {
    if (!inView(view, yacht.x, yacht.y, 100)) continue;
    ctx.save();
    ctx.translate(yacht.x, yacht.y);
    ctx.rotate(yacht.angle);
    ctx.fillStyle = '#101a26';
    ctx.beginPath();
    ctx.ellipse(4, 6, 62, 26, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dfe8f2';
    ctx.beginPath();
    ctx.moveTo(-46, -14);
    ctx.quadraticCurveTo(0, -24, 58, -4);
    ctx.quadraticCurveTo(18, 16, -46, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.fillRect(28, -4, 8, 4);
    ctx.restore();
  }
}

function drawBlockBase(ctx, block) {
  ctx.fillStyle = COLORS.sidewalk;
  ctx.fillRect(block.x - 22, block.y - 22, block.w + 44, block.h + 44);
  ctx.fillStyle = COLORS.sidewalkEdge;
  ctx.fillRect(block.x - 22, block.y - 22, block.w + 44, 4);
  ctx.fillRect(block.x - 22, block.y + block.h + 18, block.w + 44, 4);
  if (block.kind === 'park') {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.fillStyle = COLORS.grassLight;
    for (let i = 0; i < 8; i += 1) ctx.fillRect(block.x + 20 + i * 64, block.y + 30 + ((i * 37) % 420), 30, 5);
    if (block.pond) {
      ctx.fillStyle = '#123a44';
      ctx.beginPath();
      ctx.ellipse(block.pond.x, block.pond.y, block.pond.r, block.pond.r * 0.7, 0, 0, TAU);
      ctx.fill();
    }
  } else if (block.kind === 'lot') {
    ctx.fillStyle = '#20293a';
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = 'rgba(203,216,235,0.24)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) ctx.strokeRect(block.x + 48 + (i % 4) * 96, block.y + 68 + ((i / 4) | 0) * 116, 88, 62);
  } else if (block.kind === 'marina') {
    ctx.fillStyle = '#233043';
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.fillStyle = '#1a6f86';
    ctx.beginPath();
    ctx.ellipse(block.x + block.w / 2, block.y + block.h * 0.42, block.w * 0.36, block.h * 0.24, 0, 0, TAU);
    ctx.fill();
  } else if (block.kind === 'plaza') {
    ctx.fillStyle = '#2b3548';
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.strokeStyle = 'rgba(160,180,210,0.16)';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(block.x + i * 120, block.y);
      ctx.lineTo(block.x + i * 120, block.y + block.h);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#242e40';
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
}

function drawRoads(ctx, city, view) {
  ctx.strokeStyle = 'rgba(185,199,220,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 26]);
  for (let i = 0; i <= 5; i += 1) {
    const y = i * 676 + 58;
    const x = i * 676 + 58;
    if (y > view.y - 40 && y < view.y + view.h + 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(city.width, y);
      ctx.stroke();
    }
    if (x > view.x - 40 && x < view.x + view.w + 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, city.height);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(214,226,244,0.62)';
  for (const node of city.nodes) {
    if (!inView(view, node.x, node.y, 120)) continue;
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(node.x - 40 + i * 28, node.y - 62, 14, 18);
      ctx.fillRect(node.x - 40 + i * 28, node.y + 44, 14, 18);
      ctx.fillRect(node.x - 62, node.y - 40 + i * 28, 18, 14);
      ctx.fillRect(node.x + 44, node.y - 40 + i * 28, 18, 14);
    }
  }
}

function drawProps(ctx, city, view, clock) {
  for (const lamp of city.lamps) {
    if (!inView(view, lamp.x, lamp.y, 160)) continue;
    const glow = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, lamp.r);
    const pulse = 0.72 + Math.sin(clock * 2 + lamp.x * 0.01) * 0.05;
    glow.addColorStop(0, `rgba(255,214,150,${0.34 * pulse})`);
    glow.addColorStop(0.45, 'rgba(255,196,120,0.12)');
    glow.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe6b0';
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
  }
  for (const prop of city.props) {
    if (!inView(view, prop.x, prop.y, 60)) continue;
    const x = prop.x;
    const y = prop.y;
    if (prop.type === 'bench') {
      ctx.fillStyle = '#3c3327';
      ctx.fillRect(x - 12, y - 4, 24, 8);
    } else if (prop.type === 'hydrant') {
      ctx.fillStyle = '#b23a3a';
      ctx.fillRect(x - 3, y - 6, 6, 12);
    } else if (prop.type === 'umbrella') {
      ctx.fillStyle = prop.x % 3 < 1 ? '#d9584a' : '#3f8fd9';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, TAU);
      ctx.fill();
    } else if (prop.type === 'hut') {
      ctx.fillStyle = '#3c4a3a';
      ctx.fillRect(x - 20, y - 18, 40, 36);
      ctx.fillStyle = '#ffca7a';
      ctx.fillRect(x - 6, y - 2, 12, 10);
    } else if (prop.type === 'crate') {
      ctx.fillStyle = '#4a3a28';
      ctx.fillRect(x - 8, y - 8, 16, 16);
    } else if (prop.type === 'planter') {
      ctx.fillStyle = '#1c3a2c';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, TAU);
      ctx.fill();
    }
  }
  for (const sign of city.signs) {
    if (!inView(view, sign.x, sign.y, 90)) continue;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = sign.colour;
    ctx.beginPath();
    ctx.ellipse(sign.x + sign.w / 2, sign.y + sign.h + 14, sign.w * 0.7, 22, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = sign.colour;
    ctx.fillRect(sign.x, sign.y, sign.w, sign.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(4,8,16,0.72)';
    ctx.font = `700 ${Math.max(9, Math.min(14, sign.h * 0.62))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(sign.x + sign.w / 2, sign.y + sign.h / 2);
    if (sign.h > sign.w) ctx.rotate(-Math.PI / 2);
    ctx.fillText(sign.word, 0, 0);
    ctx.restore();
  }
}

function drawBuilding(ctx, solid) {
  if (solid.kind === 'fountain') {
    ctx.fillStyle = '#22303f';
    ctx.beginPath();
    ctx.arc(solid.x + solid.w / 2, solid.y + solid.h / 2, solid.w / 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2f5a68';
    ctx.beginPath();
    ctx.arc(solid.x + solid.w / 2, solid.y + solid.h / 2, solid.w / 3.4, 0, TAU);
    ctx.fill();
    return;
  }
  const tall = solid.tall ?? 10;
  ctx.fillStyle = 'rgba(3,6,12,0.55)';
  ctx.fillRect(solid.x + tall * 0.28 + 8, solid.y + tall * 0.3 + 10, solid.w, solid.h);
  ctx.fillStyle = COLORS.roof[solid.roof % COLORS.roof.length];
  ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(solid.x, solid.y, solid.w, 3);
  ctx.fillStyle = COLORS.roofEdge;
  ctx.fillRect(solid.x, solid.y + solid.h - 3, solid.w, 3);
  const seed = solid.seed ?? 7;
  const lit = solid.lit ?? 0.4;
  for (let x = 10; x < solid.w - 12; x += 34) {
    const on = ((seed + x * 7) % 100) / 100 < lit;
    ctx.fillStyle = on ? COLORS.windowWarm : '#1a2231';
    ctx.fillRect(solid.x + x, solid.y + 6, 12, 5);
    ctx.fillRect(solid.x + x, solid.y + solid.h - 11, 12, 5);
  }
  for (let y = 16; y < solid.h - 14; y += 34) {
    const on = ((seed + y * 13) % 100) / 100 < lit;
    ctx.fillStyle = on ? COLORS.windowCool : '#1a2231';
    ctx.fillRect(solid.x + 5, solid.y + y, 5, 10);
    ctx.fillRect(solid.x + solid.w - 10, solid.y + y, 5, 10);
  }
  if (solid.crown) {
    ctx.strokeStyle = 'rgba(126,230,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(solid.x + 10, solid.y + 10, solid.w - 20, solid.h - 20);
  }
}

function drawPiers(ctx, city, view, clock) {
  for (const pier of city.piers) {
    if (!rectVisible(view, pier)) continue;
    ctx.fillStyle = '#6a5138';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = 'rgba(30,22,16,0.7)';
    ctx.lineWidth = 2;
    for (let x = pier.x; x < pier.x + pier.w; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, pier.y);
      ctx.lineTo(x, pier.y + pier.h);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffdf9e';
    for (let x = pier.x + 50; x < pier.x + pier.w; x += 170) {
      ctx.beginPath();
      ctx.arc(x, pier.y + pier.h / 2, 3.2, 0, TAU);
      ctx.fill();
    }
  }
}

function drawDecals(ctx, world, view) {
  for (const decal of world.decals) {
    if (!inView(view, decal.x, decal.y, 40)) continue;
    ctx.globalAlpha = decal.alpha;
    ctx.fillStyle = COLORS.blood;
    ctx.beginPath();
    ctx.arc(decal.x, decal.y, decal.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPickups(ctx, world, view, clock) {
  for (const pickup of world.pickups) {
    if (!inView(view, pickup.x, pickup.y, 40)) continue;
    const bob = Math.sin(clock * 3 + pickup.x) * 3;
    const colour = pickup.kind === 'health' ? COLORS.health : pickup.kind === 'armour' ? COLORS.armour : pickup.kind === 'ammo' ? COLORS.muzzle : COLORS.money;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a1018';
    rr(ctx, -9, -9, 18, 18, 4);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pickup.kind === 'health' ? '+' : pickup.kind === 'armour' ? 'A' : pickup.kind === 'ammo' ? '•' : '$', 0, 1);
    ctx.restore();
  }
}

function drawMarker(ctx, world, view, clock) {
  const m = world.marker;
  if (!m || !inView(view, m.x, m.y, 260)) return;
  const pulse = 0.6 + Math.sin(clock * 3.4) * 0.2;
  const grad = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.r * 1.7);
  grad.addColorStop(0, `rgba(255,207,74,${0.5 * pulse})`);
  grad.addColorStop(0.55, 'rgba(255,190,60,0.16)');
  grad.addColorStop(1, 'rgba(255,190,60,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * 1.7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,220,120,${0.5 + pulse * 0.3})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r + Math.sin(clock * 2.6) * 4, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,207,74,0.9)';
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - 16);
  ctx.lineTo(m.x + 13, m.y);
  ctx.lineTo(m.x, m.y + 16);
  ctx.lineTo(m.x - 13, m.y);
  ctx.fill();
}

function drawBeam(ctx, world, view, clock) {
  const m = world.marker;
  if (!m || !inView(view, m.x, m.y, 700)) return;
  const height = 620;
  const pulse = 0.72 + Math.sin(clock * 1.8) * 0.12;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(m.x, m.y, m.x, m.y - height);
  beam.addColorStop(0, `rgba(255,207,74,${0.34 * pulse})`);
  beam.addColorStop(0.4, 'rgba(255,190,60,0.12)');
  beam.addColorStop(1, 'rgba(255,180,40,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(m.x - 26, m.y);
  ctx.lineTo(m.x - 58, m.y - height);
  ctx.lineTo(m.x + 58, m.y - height);
  ctx.lineTo(m.x + 26, m.y);
  ctx.fill();
  ctx.restore();
}

function drawCars(ctx, world, view, clock) {
  for (const car of world.cars) {
    if (car.dead) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#1a1c22';
      rr(ctx, -car.spec.length / 2, -car.spec.width / 2, car.spec.length, car.spec.width, 5);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (!inView(view, car.x, car.y, 140)) continue;
    drawCar(ctx, car, clock);
  }
}

function drawCar(ctx, car, clock) {
  const w = car.spec.width;
  const h = car.spec.length;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  rr(ctx, -h / 2 + 5, -w / 2 + 7, h, w, 7);
  ctx.fill();
  ctx.fillStyle = car.hitFlash > 0 ? '#ffffff' : car.colour;
  rr(ctx, -h / 2, -w / 2, h, w, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(4,10,18,0.72)';
  rr(ctx, -h * 0.1, -w / 2 + 4, h * 0.42, w - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,210,255,0.32)';
  rr(ctx, -h * 0.26, -w / 2 + 5, h * 0.18, w - 10, 3);
  ctx.fill();
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#ffd75e';
    ctx.fillRect(h * 0.14, -7, 12, 14);
  }
  if (car.kind === 'police') {
    const blink = Math.floor(clock * 7) % 2 === 0;
    ctx.fillStyle = blink ? COLORS.policeRed : '#3a1020';
    ctx.fillRect(-h * 0.06, -w / 2 + 4, 8, 10);
    ctx.fillStyle = blink ? '#1a3a78' : COLORS.policeBlue;
    ctx.fillRect(-h * 0.06, w / 2 - 14, 8, 10);
  }
  ctx.fillStyle = '#ffe9b8';
  ctx.fillRect(h / 2 - 4, -w / 2 + 5, 4, 6);
  ctx.fillRect(h / 2 - 4, w / 2 - 11, 4, 6);
  ctx.restore();
  if (car.kind === 'police' && car.siren) {
    const blink = Math.floor(clock * 8) % 2 === 0;
    const glow = ctx.createRadialGradient(car.x, car.y, 8, car.x, car.y, 210);
    glow.addColorStop(0, blink ? 'rgba(255,45,74,0.30)' : 'rgba(43,108,255,0.30)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(car.x, car.y, 210, 0, TAU);
    ctx.fill();
    return;
  }
  if (car.kind !== 'police' && !car.brake) return;
  const hx = Math.cos(car.angle);
  const hy = Math.sin(car.angle);
  ctx.save();
  ctx.translate(car.x + hx * h * 0.48, car.y + hy * h * 0.48);
  ctx.rotate(car.angle);
  if (car.brake) {
    ctx.fillStyle = 'rgba(255,50,40,0.85)';
    ctx.fillRect(-h / 2, -w / 2 + 4, 3, 5);
    ctx.fillRect(-h / 2, w / 2 - 9, 3, 5);
  } else {
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(0, 0, 180, 0);
    beam.addColorStop(0, 'rgba(255,244,208,0.2)');
    beam.addColorStop(0.5, 'rgba(255,238,190,0.07)');
    beam.addColorStop(1, 'rgba(255,238,190,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.32);
    ctx.lineTo(180, -74);
    ctx.lineTo(180, 74);
    ctx.lineTo(0, w * 0.32);
    ctx.fill();
  }
  ctx.restore();
}

function drawPeople(ctx, world, view) {
  for (const ped of world.peds) {
    if (ped.dead) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.globalAlpha = Math.max(0.25, 1 + Math.min(0, ped.deadTimer) / 22);
      ctx.fillStyle = '#3a1a22';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      continue;
    }
    if (!inView(view, ped.x, ped.y, 40)) continue;
    drawPed(ctx, ped);
  }
  const player = world.player;
  if (!player.dead && !player.car) drawPlayer(ctx, player);
}

function drawPed(ctx, ped) {
  const swing = Math.sin(ped.phase) * 4;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 10, 7, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#20242e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.lineTo(-5 - swing, 2);
  ctx.moveTo(-2, 3);
  ctx.lineTo(-5 + swing, -2);
  ctx.stroke();
  ctx.fillStyle = ped.kind === 'cop' ? COLORS.cop : ped.kind === 'gang' ? '#3a1f2a' : ped.coat;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, TAU);
  ctx.fill();
  if (ped.hat || ped.kind === 'cop') {
    ctx.fillStyle = ped.kind === 'cop' ? '#111c30' : '#1a1e28';
    ctx.beginPath();
    ctx.arc(3, 0, 5, 0, TAU);
    ctx.fill();
  }
  if (ped.armed) {
    ctx.fillStyle = '#0d1118';
    ctx.fillRect(7, 2, 9, 2.4);
  }
  ctx.restore();
}

function drawPlayer(ctx, player) {
  const swing = Math.sin(player.step) * 5;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 11, 8, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(player.angle);
  ctx.strokeStyle = '#1b2028';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-6 - swing, 1);
  ctx.moveTo(-2, 4);
  ctx.lineTo(-6 + swing, -1);
  ctx.stroke();
  ctx.fillStyle = COLORS.playerJacket;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.playerHair;
  ctx.beginPath();
  ctx.arc(4, 0, 5.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aim);
  if (player.weapon !== 'fists') {
    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(8, -2, 13, 4);
  }
  ctx.restore();
  if (player.hurt > 0) {
    ctx.fillStyle = `rgba(255,40,60,${player.hurt * 0.6})`;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20, 0, TAU);
    ctx.fill();
  }
}

function drawBullets(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const bullet of world.bullets) {
    ctx.strokeStyle = bullet.colour;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - bullet.vx * 0.012, bullet.y - bullet.vy * 0.012);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, TAU);
    ctx.fill();
  }
  for (const flash of world.flashes) {
    const t = flash.life / flash.max;
    ctx.globalAlpha = t * 0.8;
    ctx.fillStyle = flash.colour;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, flash.r + (1 - t) * 90, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawNight(ctx, world) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dpr = ctx.canvas.width / VIEW.width;
  ctx.scale(dpr, dpr);
  const vignette = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.24, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.82);
  vignette.addColorStop(0, 'rgba(4,8,16,0)');
  vignette.addColorStop(0.7, 'rgba(4,8,16,0.26)');
  vignette.addColorStop(1, 'rgba(2,5,10,0.72)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (world.player.dead) {
    ctx.fillStyle = 'rgba(120,10,24,0.34)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  if (world.intro > 0) {
    ctx.globalAlpha = Math.min(1, world.intro / 1.4);
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function areaLabel(world) {
  return world.area ?? 'KESTREL CITY';
}

export const RENDER_FONT = DISPLAY_FONT;
export const RENDER_FONT_BODY = FONT;
export const RENDER_VEHICLES = VEHICLES;
