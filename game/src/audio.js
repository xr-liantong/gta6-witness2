// Sound: a tiny WebAudio synth. No asset files, no network. The engine is one oscillator whose
// pitch follows the car, the siren is two oscillators trading places, and everything else is a
// short generated burst. Audio only starts after the first click, as browsers require.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let muted = false;
  let noise = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch (error) {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, duration, type, volume, sweep) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function burst(volume, duration, lowpass = 1400) {
    if (!ensure() || muted) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  function startEngine() {
    if (!ensure() || engine) return;
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 44;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0001;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engine.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engine.start();
  }

  function startSiren() {
    if (!ensure() || siren) return;
    siren = ctx.createOscillator();
    siren.type = 'square';
    siren.frequency.value = 640;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0001;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    siren.connect(filter);
    filter.connect(sirenGain);
    sirenGain.connect(master);
    siren.start();
  }

  function update(world, dt) {
    if (!ctx) return;
    const player = world.player;
    const car = player.car;
    startEngine();
    startSiren();
    const targetEngine = car && !player.dead ? Math.min(0.13, 0.03 + Math.hypot(car.vx, car.vy) / 4200) : 0.0001;
    engineGain.gain.setTargetAtTime(muted ? 0.0001 : targetEngine, ctx.currentTime, 0.08);
    if (car) {
      const speed = Math.hypot(car.vx, car.vy);
      engine.frequency.setTargetAtTime(40 + speed * 0.28, ctx.currentTime, 0.06);
    }
    let nearestSiren = Infinity;
    for (const police of world.cars) {
      if (police.kind !== 'police' || police.dead) continue;
      nearestSiren = Math.min(nearestSiren, Math.hypot(police.x - player.x, police.y - player.y));
    }
    const sirenOn = world.wanted.stars > 0 && nearestSiren < 1600 && !player.dead;
    sirenGain.gain.setTargetAtTime(muted || !sirenOn ? 0.0001 : 0.035, ctx.currentTime, 0.1);
    if (sirenOn) {
      const wobble = Math.sin(world.time * 3.4) > 0 ? 720 : 540;
      siren.frequency.setTargetAtTime(wobble, ctx.currentTime, 0.05);
    }
  }

  function handle(events) {
    if (!ctx || muted) return;
    for (const event of events) {
      if (event.type === 'gunshot') {
        burst(0.18, event.small ? 0.08 : 0.14, event.small ? 1900 : 1300);
        blip(180, 0.07, 'square', 0.05, 70);
      } else if (event.type === 'explosion') {
        burst(0.5, 0.7, 900);
        blip(90, 0.55, 'sine', 0.2, 28);
      } else if (event.type === 'crash') {
        burst(0.16, 0.18, 2200);
      } else if (event.type === 'pickup') {
        blip(660, 0.09, 'triangle', 0.08, 990);
        blip(990, 0.1, 'triangle', 0.05, 1320);
      } else if (event.type === 'mission') {
        blip(523, 0.16, 'triangle', 0.07, 523);
        setTimeout(() => blip(784, 0.22, 'triangle', 0.07, 784), 120);
      } else if (event.type === 'wanted') {
        blip(event.stars > 0 ? 440 : 320, 0.14, 'sawtooth', 0.05, event.stars > 0 ? 300 : 200);
      } else if (event.type === 'step') {
        blip(90, 0.05, 'sine', 0.02, 60);
      } else if (event.type === 'tyre') {
        burst(0.02, 0.05, 3000);
      } else if (event.type === 'engine') {
        startEngine();
      } else if (event.type === 'siren') {
        startSiren();
      } else if (event.type === 'death') {
        blip(220, 0.5, 'sawtooth', 0.08, 60);
      } else if (event.type === 'pedDown') {
        burst(0.06, 0.12, 700);
      }
    }
  }

  function setMuted(value) {
    muted = value;
    if (!ctx) return;
    master.gain.setTargetAtTime(muted ? 0.0001 : 0.5, ctx.currentTime, 0.05);
  }

  return {
    unlock,
    update,
    handle,
    setMuted,
    isMuted: () => muted,
    dispose() {
      try {
        if (ctx) ctx.close();
      } catch (error) {
        /* closing an already closed context is not interesting */
      }
      ctx = null;
    },
  };
}
