// HUD: stats, wanted stars, the contract card, the minimap, the speedometer, toasts and prompts.

import { VIEW, COLORS, FONT, DISPLAY_FONT, WEAPONS, POLICE } from './config.js';
import { missionObjective } from './missions.js';

const MARGIN = Math.round(VIEW.width * 0.02) + 8;
const TAU = Math.PI * 2;

export function drawHud(ctx, world, camera, ui) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  drawStats(ctx, world);
  drawWanted(ctx, world);
  drawMissionCard(ctx, world);
  drawMinimap(ctx, world);
  drawSpeed(ctx, world);
  drawToasts(ctx, ui);
  drawPrompt(ctx, ui);
  drawPause(ctx, ui);
  ctx.restore();
}

function text(ctx, value, x, y, font, colour, align = 'left') {
  ctx.fillStyle = colour;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, accent) {
  ctx.fillStyle = 'rgba(8,13,22,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,180,220,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (accent) {
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + 10, 3, h - 20);
  }
}

function bar(ctx, x, y, w, h, value, max, colour) {
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  const pct = Math.max(0, Math.min(1, value / max));
  if (pct <= 0) return;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(3, w * pct), h, h / 2);
  ctx.fill();
}

function clockLabel(clock) {
  return `${String(Math.floor(clock) % 24).padStart(2, '0')}:${String(Math.floor((clock % 1) * 60)).padStart(2, '0')}`;
}

function drawStats(ctx, world) {
  const player = world.player;
  const x = MARGIN;
  const y = 18;
  panel(ctx, x, y, 268, 118, COLORS.playerJacket);
  text(ctx, world.area.toUpperCase(), x + 14, y + 20, `600 11px ${FONT}`, COLORS.muted);
  text(ctx, clockLabel(world.clock), x + 254, y + 20, `700 12px ${FONT}`, COLORS.text, 'right');
  text(ctx, 'HP', x + 14, y + 44, `700 13px ${FONT}`, COLORS.text);
  bar(ctx, x + 42, y + 34, 176, 12, player.health, player.maxHealth, COLORS.health);
  text(ctx, String(Math.ceil(Math.max(0, player.health))), x + 226, y + 44, `600 11px ${FONT}`, COLORS.muted);
  text(ctx, 'AR', x + 14, y + 64, `700 13px ${FONT}`, COLORS.text);
  bar(ctx, x + 42, y + 54, 176, 8, player.armour, 100, COLORS.armour);
  text(ctx, String(Math.ceil(Math.max(0, player.armour))), x + 226, y + 64, `600 11px ${FONT}`, COLORS.muted);
  text(ctx, `$${player.money}`, x + 14, y + 94, `700 22px ${DISPLAY_FONT}`, COLORS.money);
  const spec = WEAPONS[player.weapon] ?? WEAPONS.pistol;
  const ammo = player.reload > 0 ? 'RELOAD' : `${player.clip} / ${player.weapons[player.weapon].ammo}`;
  text(ctx, `${spec.name.toUpperCase()}  ${ammo}`, x + 254, y + 92, `600 12px ${FONT}`, COLORS.text, 'right');
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x + 14, y + 102, 240, 1);
  text(ctx, 'KESTREL CITY · NIGHT SHIFT', x + 14, y + 112, `500 10px ${FONT}`, COLORS.muted);
}

function starPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawWanted(ctx, world) {
  const stars = world.wanted.stars;
  const x = VIEW.width - MARGIN - 194;
  const y = 18;
  panel(ctx, x, y, 194, 64);
  for (let i = 0; i < POLICE.stars; i += 1) {
    starPath(ctx, x + 26 + i * 34, y + 26, 11, 4.8);
    if (i < stars) {
      ctx.globalAlpha = 0.8 + Math.sin(world.time * 6 + i) * 0.2;
      ctx.fillStyle = i >= 3 ? 'rgba(255,86,74,0.92)' : 'rgba(255,214,90,0.92)';
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(20,14,6,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(180,195,220,0.28)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  text(ctx, stars > 0 ? `WANTED · ${world.wanted.visible ? 'SPOTTED' : 'SEARCHING'}` : 'NO HEAT', x + 184, y + 52, `700 10px ${FONT}`, stars > 0 ? 'rgba(255,120,96,0.95)' : COLORS.muted, 'right');
  if (world.wanted.flash > 0) {
    ctx.globalAlpha = Math.min(1, world.wanted.flash);
    ctx.strokeStyle = 'rgba(255,74,94,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 4, 202, 72, 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function wrapText(ctx, value, x, y, maxWidth, lineHeight) {
  let line = '';
  let cursor = y;
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      cursor += lineHeight;
      line = word;
    } else line = next;
  }
  if (line) ctx.fillText(line, x, cursor);
}

function drawMissionCard(ctx, world) {
  const objective = missionObjective(world);
  if (!objective) return;
  const x = MARGIN;
  const y = 148;
  const w = 268;
  const h = 96;
  panel(ctx, x, y, w, h, objective.done ? COLORS.gold : 'rgba(255,207,74,0.7)');
  text(ctx, 'CONTRACT', x + 14, y + 18, `700 10px ${FONT}`, COLORS.muted);
  text(ctx, `${objective.step} / ${objective.total}`, x + w - 14, y + 18, `700 10px ${FONT}`, COLORS.gold, 'right');
  text(ctx, objective.title, x + 14, y + 40, `800 15px ${DISPLAY_FONT}`, COLORS.text);
  ctx.font = `500 11px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  wrapText(ctx, objective.line, x + 14, y + 58, w - 28, 15);
  for (let i = 0; i < objective.total; i += 1) {
    ctx.fillStyle = i < objective.step ? COLORS.gold : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(x + 14 + i * 22, y + h - 18, 14, 4, 2);
    ctx.fill();
  }
  if (world.mission?.reward && !objective.done) text(ctx, `$${world.mission.reward}`, x + w - 14, y + h - 14, `700 10px ${FONT}`, 'rgba(255,207,74,0.8)', 'right');
}

function drawMinimap(ctx, world) {
  const size = 186;
  const x = MARGIN;
  const y = VIEW.height - size - 24;
  const span = 1500;
  const scale = size / span;
  const px = world.player.x;
  const py = world.player.y;
  const city = world.city;
  const mapX = (wx) => x + size / 2 + (wx - px) * scale;
  const mapY = (wy) => y + size / 2 + (wy - py) * scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 14);
  ctx.clip();
  ctx.fillStyle = '#0a1018';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = 'rgba(12,44,60,0.9)';
  ctx.fillRect(mapX(city.coast + 170), y, size, size);
  ctx.fillStyle = '#22303f';
  for (const block of city.blocks) ctx.fillRect(mapX(block.x), mapY(block.y), block.w * scale, block.h * scale);
  ctx.strokeStyle = 'rgba(120,150,190,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const roadY = mapY(i * 676 + 58);
    const roadX = mapX(i * 676 + 58);
    ctx.beginPath();
    ctx.moveTo(x, roadY);
    ctx.lineTo(x + size, roadY);
    ctx.moveTo(roadX, y);
    ctx.lineTo(roadX, y + size);
    ctx.stroke();
  }
  for (const car of world.cars) {
    if (car.dead) continue;
    const cx = mapX(car.x);
    const cy = mapY(car.y);
    if (cx < x || cx > x + size || cy < y || cy > y + size) continue;
    ctx.fillStyle = car.kind === 'police' ? '#ff4a5e' : car === world.player.car ? '#ffffff' : 'rgba(160,180,210,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, car.kind === 'police' ? 3 : 2, 0, TAU);
    ctx.fill();
  }
  if (world.marker) {
    const mx = mapX(world.marker.x);
    const my = mapY(world.marker.y);
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(mx, my, 5 + Math.sin(world.time * 4) * 1.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,207,74,0.6)';
    ctx.beginPath();
    ctx.arc(mx, my, 10, 0, TAU);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(world.player.car ? world.player.car.angle : world.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-2.5, 0);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(160,190,225,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, size - 1, size - 1, 14);
  ctx.stroke();
  ctx.fillStyle = 'rgba(6,10,18,0.7)';
  ctx.fillRect(x + 8, y + 8, 26, 16);
  text(ctx, 'N', x + 21, y + 20, `700 10px ${FONT}`, COLORS.text, 'center');
  text(ctx, `${Math.round(world.stats.distance)} m`, x + 12, y + size - 10, `600 10px ${FONT}`, COLORS.muted);
}

function drawSpeed(ctx, world) {
  const car = world.player.car;
  if (!car) return;
  const speed = Math.hypot(car.vx, car.vy);
  const x = VIEW.width - MARGIN - 168;
  const y = VIEW.height - 94;
  const healthy = car.health > car.maxHealth * 0.4;
  panel(ctx, x, y, 168, 70);
  text(ctx, String(Math.round(speed * 0.42)), x + 118, y + 44, `800 30px ${DISPLAY_FONT}`, COLORS.text, 'right');
  text(ctx, 'KM/H', x + 118, y + 58, `600 10px ${FONT}`, COLORS.muted, 'right');
  text(ctx, car.kind.toUpperCase(), x + 14, y + 22, `700 10px ${FONT}`, healthy ? 'rgba(120,230,150,0.8)' : 'rgba(255,90,90,0.9)');
  bar(ctx, x + 14, y + 30, 92, 6, car.health, car.maxHealth, healthy ? COLORS.health : COLORS.danger);
  for (let i = 0; i < 8; i += 1) {
    const lit = i < Math.round(Math.min(1, speed / 420) * 8);
    ctx.fillStyle = lit ? (i > 5 ? COLORS.danger : COLORS.gold) : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 14 + i * 17, y + 47, 12, 4);
  }
}

function drawToasts(ctx, ui) {
  if (!ui?.toasts) return;
  let y = VIEW.height * 0.26;
  for (const toast of ui.toasts) {
    ctx.globalAlpha = Math.min(1, toast.life * 1.6);
    text(ctx, toast.text, VIEW.width / 2, y, `800 ${toast.big ? 26 : 17}px ${DISPLAY_FONT}`, toast.colour ?? COLORS.gold, 'center');
    if (toast.sub) text(ctx, toast.sub, VIEW.width / 2, y + 20, `500 12px ${FONT}`, 'rgba(230,238,250,0.75)', 'center');
    ctx.globalAlpha = 1;
    y += toast.sub ? 50 : 30;
  }
}

function drawPrompt(ctx, ui) {
  if (!ui?.prompt) return;
  ctx.font = `600 13px ${FONT}`;
  const width = ctx.measureText(ui.prompt).width + 46;
  const x = VIEW.width / 2 - width / 2;
  const y = VIEW.height - 96;
  ctx.fillStyle = 'rgba(8,13,22,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, 34, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,207,74,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, 'E', x + 18, y + 22, `800 12px ${FONT}`, COLORS.gold);
  text(ctx, ui.prompt.replace(/^E\s*·?\s*/, ''), x + 32, y + 22, `600 12px ${FONT}`, COLORS.text);
}

function drawPause(ctx, ui) {
  if (!ui?.paused) return;
  ctx.fillStyle = 'rgba(4,8,14,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  text(ctx, 'PAUSED', VIEW.width / 2, VIEW.height / 2 - 10, `800 44px ${DISPLAY_FONT}`, COLORS.text, 'center');
  text(ctx, 'Escape to resume · M for map · K to save', VIEW.width / 2, VIEW.height / 2 + 24, `500 13px ${FONT}`, COLORS.muted, 'center');
}

export const HUD_MARGIN = MARGIN;
