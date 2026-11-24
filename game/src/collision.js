// Geometry shared by movement, traffic and bullets: clamping, circle-versus-rectangle
// resolution, and segment hits. Everything is plane geometry on the city's x/y pixels.

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, rate, dt) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function dist(x0, y0, x1, y1) {
  return Math.hypot(x1 - x0, y1 - y0);
}

export function dist2(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy;
}

export function shortestAngle(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function turnToward(from, to, maxStep) {
  const delta = shortestAngle(from, to);
  if (Math.abs(delta) <= maxStep) return to;
  return from + Math.sign(delta) * maxStep;
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Moves a circle out of one rectangle; returns the penetration depth, 0 when clear. */
export function resolveCircleRect(body, rect) {
  const closestX = clamp(body.x, rect.x, rect.x + rect.w);
  const closestY = clamp(body.y, rect.y, rect.y + rect.h);
  let dx = body.x - closestX;
  let dy = body.y - closestY;
  const radius = body.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return 0;
  if (d2 > 0.000001) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    body.x += (dx / d) * push;
    body.y += (dy / d) * push;
    return push;
  }
  const left = body.x - rect.x;
  const right = rect.x + rect.w - body.x;
  const top = body.y - rect.y;
  const bottom = rect.y + rect.h - body.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) body.x = rect.x - radius;
  else if (min === right) body.x = rect.x + rect.w + radius;
  else if (min === top) body.y = rect.y - radius;
  else body.y = rect.y + rect.h + radius;
  return radius + min;
}

/** True when the axis-aligned circle overlaps any solid rect; used to keep spawns clean. */
export function circleHitsRects(x, y, r, rects) {
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    const cx = clamp(x, rect.x, rect.x + rect.w);
    const cy = clamp(y, rect.y, rect.y + rect.h);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

/** Entry time of a segment into a rectangle, or -1. Slab method, inclusive edges. */
export function segmentRect(x0, y0, x1, y1, rect) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < rect.x || x0 > rect.x + rect.w) return -1;
  } else {
    const inv = 1 / dx;
    let t1 = (rect.x - x0) * inv;
    let t2 = (rect.x + rect.w - x0) * inv;
    if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y0 < rect.y || y0 > rect.y + rect.h) return -1;
  } else {
    const inv = 1 / dy;
    let t1 = (rect.y - y0) * inv;
    let t2 = (rect.y + rect.h - y0) * inv;
    if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

/** Entry time of a segment into a circle, or -1. */
export function segmentCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return fx * fx + fy * fy <= r * r ? 0 : -1;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  const t2 = (-b + disc) / (2 * a);
  if (t2 >= 0 && t2 <= 1) return t2;
  return -1;
}
