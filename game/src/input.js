// Keyboard and mouse: one place that knows which physical key means which action, a set of
// keys currently down for held actions, and a per-frame set of freshly pressed keys so a tap
// opens a door once instead of sixty times. The aiming point is delivered in world units.

const ACTIONS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  reload: ['KeyR'],
  fire: ['Space'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  pause: ['Escape', 'KeyP'],
  map: ['KeyM'],
  mission: ['KeyJ'],
  horn: ['KeyH'],
  mute: ['KeyN'],
  confirm: ['Enter', 'NumpadEnter'],
};

export function createInput(canvas, view) {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();
  const mouse = { x: view.width / 2, y: view.height / 2, down: false, clicked: false, moved: false };
  const state = { down, pressed, released, mouse, actions: Object.keys(ACTIONS), view };

  function codeFor(action) {
    const codes = ACTIONS[action] ?? [];
    return codes.some((code) => down.has(code));
  }

  function press(code) {
    if (!down.has(code)) pressed.add(code);
    down.add(code);
  }

  function release(code) {
    if (down.has(code)) released.add(code);
    down.delete(code);
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Tab') event.preventDefault();
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    press(event.code);
  });
  window.addEventListener('keyup', (event) => {
    release(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });
  window.addEventListener('contextmenu', (event) => event.preventDefault());

  function scale(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * view.width;
    const y = ((event.clientY - rect.top) / rect.height) * view.height;
    return { x, y };
  }

  canvas.addEventListener('mousemove', (event) => {
    const point = scale(event);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.moved = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const point = scale(event);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });

  return {
    state,
    isDown(action) {
      return codeFor(action);
    },
    wasPressed(action) {
      const codes = ACTIONS[action] ?? [];
      return codes.some((code) => pressed.has(code));
    },
    wasReleased(action) {
      const codes = ACTIONS[action] ?? [];
      return codes.some((code) => released.has(code));
    },
    axis() {
      let x = 0;
      let y = 0;
      if (codeFor('left')) x -= 1;
      if (codeFor('right')) x += 1;
      if (codeFor('up')) y -= 1;
      if (codeFor('down')) y += 1;
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      return { x, y };
    },
    driveAxis() {
      let throttle = 0;
      let steer = 0;
      if (codeFor('up')) throttle += 1;
      if (codeFor('down')) throttle -= 1;
      if (codeFor('left')) steer -= 1;
      if (codeFor('right')) steer += 1;
      return { throttle, steer, brake: codeFor('run') };
    },
    endFrame() {
      pressed.clear();
      released.clear();
      mouse.clicked = false;
      mouse.moved = false;
    },
  };
}

export { ACTIONS };
