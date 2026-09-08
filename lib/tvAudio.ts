// Sound design for the CRT hero.
//
// Everything is synthesised with Web Audio — no asset downloads, no license
// worries, and each sound can be tuned by ear in code. One shared AudioContext
// is reused for the whole page: creating a fresh context per press leaks
// hardware voices and eventually makes the browser refuse to start new ones.
//
// Browsers start the context suspended until a user gesture. Every play helper
// calls `ctx()` which resumes it, so the first real click unlocks audio.

let _ctx: AudioContext | null = null;
let _muted = false;

type AnyWindow = Window & { webkitAudioContext?: typeof AudioContext };

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) {
      const Ctor = window.AudioContext || (window as AnyWindow).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    if (_ctx.state === "suspended") void _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

export function setMuted(muted: boolean) {
  _muted = muted;
}

/** Short burst of white noise — the raw material for clicks and static. */
function noiseBuffer(c: AudioContext, seconds: number) {
  const frames = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Hard-clipping curve for a WaveShaperNode. Nonlinear clipping adds overtones,
 * which is what makes the channel-change burst sound gritty and electrical
 * rather than like a clean filtered noise sweep.
 */
function makeClippingCurve(amount: number) {
  const n = 8192;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/**
 * Rubber-dome remote button: a bright plastic tick layered over a small
 * low thud, so it reads as a physical press rather than a beep. `down`
 * gives the sharper press; `up` is the softer release.
 */
export function playButtonPress(down = true) {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;

  // Bright plastic tick — filtered noise with a near-instant decay.
  const tick = c.createBufferSource();
  tick.buffer = noiseBuffer(c, 0.05);
  const tickFilter = c.createBiquadFilter();
  tickFilter.type = "bandpass";
  tickFilter.frequency.value = down ? 2600 : 1900;
  tickFilter.Q.value = 1.1;
  const tickGain = c.createGain();
  tickGain.gain.setValueAtTime(down ? 0.16 : 0.09, now);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + (down ? 0.035 : 0.025));
  tick.connect(tickFilter).connect(tickGain).connect(c.destination);
  tick.start(now);
  tick.stop(now + 0.06);

  // Body of the press: the dome bottoming out against the shell.
  const thud = c.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(down ? 190 : 150, now);
  thud.frequency.exponentialRampToValueAtTime(down ? 90 : 80, now + 0.05);
  const thudGain = c.createGain();
  thudGain.gain.setValueAtTime(0.0001, now);
  thudGain.gain.exponentialRampToValueAtTime(down ? 0.1 : 0.05, now + 0.004);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  thud.connect(thudGain).connect(c.destination);
  thud.start(now);
  thud.stop(now + 0.08);
}

/**
 * Power switch: a heavy two-stage relay clack, then either the rising
 * degauss thump of a CRT waking up or the collapsing whine of one dying.
 */
export function playPower(on: boolean) {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  const now = c.currentTime;

  // Mechanical relay — two contacts closing a few milliseconds apart.
  [0, 0.038].forEach((offset, i) => {
    const clack = c.createBufferSource();
    clack.buffer = noiseBuffer(c, 0.04);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = i === 0 ? 1200 : 800;
    f.Q.value = 2.2;
    const g = c.createGain();
    const t0 = now + offset;
    g.gain.setValueAtTime(0.22, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    clack.connect(f).connect(g).connect(c.destination);
    clack.start(t0);
    clack.stop(t0 + 0.05);
  });

  const t0 = now + 0.07;

  if (on) {
    // Degauss thump: the coil pulse a CRT makes as the tube energises,
    // a low sine dropping in pitch under a short burst of tube hiss.
    const coil = c.createOscillator();
    coil.type = "sine";
    coil.frequency.setValueAtTime(120, t0);
    coil.frequency.exponentialRampToValueAtTime(38, t0 + 0.45);
    const coilGain = c.createGain();
    coilGain.gain.setValueAtTime(0.0001, t0);
    coilGain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.03);
    coilGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    coil.connect(coilGain).connect(c.destination);
    coil.start(t0);
    coil.stop(t0 + 0.55);

    // The 15.7kHz flyback whine, dropped to something audible and pleasant.
    const whine = c.createOscillator();
    whine.type = "triangle";
    whine.frequency.setValueAtTime(2200, t0 + 0.05);
    whine.frequency.exponentialRampToValueAtTime(9800, t0 + 0.4);
    const whineGain = c.createGain();
    whineGain.gain.setValueAtTime(0.0001, t0 + 0.05);
    whineGain.gain.exponentialRampToValueAtTime(0.035, t0 + 0.12);
    whineGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    whine.connect(whineGain).connect(c.destination);
    whine.start(t0 + 0.05);
    whine.stop(t0 + 0.5);
  } else {
    // Power down: the picture collapsing to a line, pitch falling away.
    const collapse = c.createOscillator();
    collapse.type = "triangle";
    collapse.frequency.setValueAtTime(1400, t0);
    collapse.frequency.exponentialRampToValueAtTime(60, t0 + 0.32);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
    collapse.connect(g).connect(c.destination);
    collapse.start(t0);
    collapse.stop(t0 + 0.4);
  }
}

/**
 * Channel change: an unstable sawtooth pushed through hard clipping, so the
 * result buzzes and tears like a tuner losing lock. Duration is passed in by
 * the caller so it stays synced to the on-screen static.
 */
export function playChannelStatic(durationMs: number) {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  const dur = durationMs / 1000;
  const now = c.currentTime;

  const shaper = c.createWaveShaper();
  shaper.curve = makeClippingCurve(650);
  shaper.oversample = "4x";

  // A signal that cannot hold a lock: pitch jitters every 20ms.
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, now);
  for (let t = 0; t < dur; t += 0.02) {
    osc.frequency.setValueAtTime(60 + Math.random() * 180, now + t);
  }

  const tone = c.createBiquadFilter();
  tone.type = "bandpass";
  tone.Q.value = 0.6;
  tone.frequency.setValueAtTime(1800, now);
  tone.frequency.exponentialRampToValueAtTime(220, now + dur);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(shaper).connect(tone).connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + dur);

  // Snow on top of the tear, so it reads as picture loss and not just a buzz.
  const snow = c.createBufferSource();
  snow.buffer = noiseBuffer(c, dur);
  const snowFilter = c.createBiquadFilter();
  snowFilter.type = "highpass";
  snowFilter.frequency.value = 1400;
  const snowGain = c.createGain();
  snowGain.gain.setValueAtTime(0.07, now);
  snowGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  snow.connect(snowFilter).connect(snowGain).connect(c.destination);
  snow.start(now);
  snow.stop(now + dur);
}

