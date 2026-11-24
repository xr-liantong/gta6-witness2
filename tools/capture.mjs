// Capture the four dossier screenshots from a debuggable Edge over CDP: sets an exact
// 1280x720 viewport, loads each ?shot= entry, reads window.__perf and saves a JPEG still.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.CDP_PORT ?? 9222);
const BASE = process.env.GAME_URL ?? 'http://127.0.0.1:8090/';
const OUT = process.env.SHOT_DIR ?? 'screenshots';
const WIDTH = 1280;
const HEIGHT = 720;
const SHOTS = [
  ['1-downtown.jpg', '?shot=downtown'],
  ['2-chase.jpg', '?shot=chase'],
  ['3-street.jpg', '?shot=street'],
  ['4-mission.jpg', '?shot=mission'],
];

mkdirSync(OUT, { recursive: true });
const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const page = list.find((target) => target.type === 'page');
if (!page) throw new Error('no page target on the debugging port');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let seq = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
  else waiter.resolve(message.result);
});
function send(method, params = {}) {
  const id = ++seq;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'about:blank' });
await sleep(300);

const report = [];
for (const [file, query] of SHOTS) {
  await send('Page.navigate', { url: `${BASE}${query}` });
  await sleep(1600);
  const perf = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__perf)', returnByValue: true });
  const shot = await send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 84,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
    captureBeyondViewport: false,
  });
  writeFileSync(join(OUT, file), Buffer.from(shot.data, 'base64'));
  let parsed = null;
  try {
    parsed = JSON.parse(perf.result.value);
  } catch {
    parsed = { error: 'no perf' };
  }
  report.push({ file, query, bytes: shot.data.length, perf: parsed });
}

await send('Page.navigate', { url: `${BASE}?demo=chase` });
await sleep(11000);
const demoPerf = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__perf)', returnByValue: true });
const demoShot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } });
writeFileSync(join(OUT, 'demo-chase.jpg'), Buffer.from(demoShot.data, 'base64'));

console.log(JSON.stringify({ report, demo: JSON.parse(demoPerf.result.value || 'null') }, null, 2));
socket.close();
