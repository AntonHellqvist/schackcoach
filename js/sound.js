// Ljud under partierna. Allt skapas med Web Audio i webbläsaren, så inga ljudfiler behövs.
// Brädljuden låter som en träpjäs mot brädet; schack, matt och partislut har egna toner.

import { getState } from './store.js';

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Mobilwebbläsare spelar bara upp ljud efter en tryckning, så väck ljudet vid första tryck.
const unlock = () => { if (soundOn()) audio(); };
window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
window.addEventListener('keydown', unlock, { capture: true });

export const soundOn = () => getState().settings.sound !== false;

let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

/** En träknack: kort brusstöt genom ett bandpassfilter plus en dov ton. */
function knock(c, t, { freq = 900, tone = 190, gain = 0.5, len = 0.09 } = {}) {
  const n = noise(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  n.connect(bp).connect(g).connect(master);
  n.start(t);
  n.stop(t + len + 0.02);

  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(tone * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(tone, t + 0.04);
  const og = c.createGain();
  og.gain.setValueAtTime(gain * 0.7, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + len * 0.9);
  o.connect(og).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

/** En ren ton (för schack, matt och partislut). */
function note(c, t, freq, { len = 0.18, gain = 0.22, type = 'triangle' } = {}) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

const SOUNDS = {
  move: (c, t) => knock(c, t),
  capture: (c, t) => {
    knock(c, t, { freq: 1500, tone: 240, gain: 0.7, len: 0.07 });
    knock(c, t + 0.055, { freq: 700, tone: 160, gain: 0.55, len: 0.11 });
  },
  castle: (c, t) => {
    knock(c, t, { gain: 0.45 });
    knock(c, t + 0.11, { freq: 800, tone: 170, gain: 0.5 });
  },
  promote: (c, t) => {
    knock(c, t);
    [523, 659, 784, 1047].forEach((f, i) => note(c, t + 0.06 + i * 0.06, f, { len: 0.16, gain: 0.14 }));
  },
  // Schack: en tydlig, lite larmande dubbelton som skiljer sig från vanliga drag.
  check: (c, t) => {
    knock(c, t, { gain: 0.45 });
    note(c, t + 0.03, 988, { len: 0.12, gain: 0.2, type: 'square' });
    note(c, t + 0.15, 1319, { len: 0.22, gain: 0.2, type: 'square' });
  },
  win: (c, t) => [523, 659, 784, 1047].forEach((f, i) => note(c, t + i * 0.12, f, { len: i === 3 ? 0.6 : 0.2, gain: 0.2 })),
  loss: (c, t) => [494, 440, 392, 330].forEach((f, i) => note(c, t + i * 0.16, f, { len: i === 3 ? 0.7 : 0.24, gain: 0.18, type: 'sine' })),
  draw: (c, t) => { note(c, t, 587, { len: 0.3, gain: 0.18 }); note(c, t + 0.22, 587, { len: 0.45, gain: 0.18 }); },
  illegal: (c, t) => note(c, t, 150, { len: 0.12, gain: 0.15, type: 'sawtooth' }),
};

export function play(name, delay = 0) {
  if (!soundOn() || !SOUNDS[name]) return;
  const c = audio();
  if (!c) return;
  try { SOUNDS[name](c, c.currentTime + 0.01 + delay); } catch (e) { console.warn('Ljud', e); }
}

/**
 * Spelar rätt ljud för ett drag. move är ett verbose-drag från chess.js, chess är ställningen efter draget.
 * Schack går före slag, eftersom det är det viktigaste att höra.
 */
export function playMove(move, chess) {
  if (!move) return;
  if (chess.inCheck()) return play('check');
  if (move.promotion) return play('promote');
  if (move.flags.includes('k') || move.flags.includes('q')) return play('castle');
  if (move.captured) return play('capture');
  play('move');
}
