// Camera: follows the player with a little speed look-ahead, pulls back as the car goes faster,
// adds a short shake on impacts, and owns the world-to-screen transform everything else draws
// through. The view is square pixels: one world unit is one canvas pixel at zoom 1.

import { VIEW, CAMERA } from './config.js';

export function createCamera(world) {
  return {
    x: world.player.x,
    y: world.player.y,
    zoom: 1,
    shake: 0,
    offsetX: 0,
    offsetY: 0,
    dead: false,
  };
}

export function updateCamera(camera, world, dt) {
  const player = world.player;
  const look = clamp(CAMERA.lookAhead * 0.01, 0, 2);
  const speed = Math.hypot(player.vx, player.vy);
  const focusX = player.x + player.vx * 0.12 * look;
  const focusY = player.y + player.vy * 0.12 * look;
  const follow = CAMERA.follow * (player.dead ? 0.6 : 1);
  camera.x += (focusX - camera.x) * Math.min(1, follow * dt);
  camera.y += (focusY - camera.y) * Math.min(1, follow * dt);
  const targetZoom = player.dead ? CAMERA.deathZoom : player.car ? clamp(1 - speed / 1500, 0.82, 1) : 1;
  camera.zoom += (targetZoom - camera.zoom) * Math.min(1, 2.6 * dt);
  camera.zoom = clamp(camera.zoom, 0.7, 1.12);
  if (world.shake > 0) {
    camera.shake = Math.max(camera.shake, world.shake);
  }
  camera.shake *= Math.exp(-CAMERA.shakeDecay * dt);
  const power = camera.shake * 0.9;
  camera.offsetX = (world.rng.next() * 2 - 1) * power;
  camera.offsetY = (world.rng.next() * 2 - 1) * power;
  clampCamera(camera, world);
}

function clampCamera(camera, world) {
  const halfW = VIEW.width / (2 * camera.zoom);
  const halfH = VIEW.height / (2 * camera.zoom);
  const maxX = Math.max(halfW, world.city.worldWidth - halfW);
  const maxY = Math.max(halfH, world.city.worldHeight - halfH);
  camera.x = clamp(camera.x, Math.min(halfW, maxX), maxX);
  camera.y = clamp(camera.y, Math.min(halfH, maxY), maxY);
}

export function snapCamera(camera, world) {
  camera.x = world.player.x;
  camera.y = world.player.y;
  camera.zoom = world.player.car ? 0.94 : 1;
  clampCamera(camera, world);
}

export function applyCamera(ctx, camera) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(VIEW.width / 2 + camera.offsetX, VIEW.height / 2 + camera.offsetY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

export function worldToScreen(camera, x, y) {
  return {
    x: (x - camera.x) * camera.zoom + VIEW.width / 2 + camera.offsetX,
    y: (y - camera.y) * camera.zoom + VIEW.height / 2 + camera.offsetY,
  };
}

export function screenToWorld(camera, x, y) {
  return {
    x: (x - VIEW.width / 2 - camera.offsetX) / camera.zoom + camera.x,
    y: (y - VIEW.height / 2 - camera.offsetY) / camera.zoom + camera.y,
  };
}

export function visibleRect(camera) {
  const halfW = VIEW.width / (2 * camera.zoom);
  const halfH = VIEW.height / (2 * camera.zoom);
  return { x: camera.x - halfW, y: camera.y - halfH, w: halfW * 2, h: halfH * 2 };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
