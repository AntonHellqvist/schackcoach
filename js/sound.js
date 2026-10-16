// Ljud under partierna, i samma stil som Chess.com: torra, korta träklick för dragen och en mjuk
// marimbaton för partiets start och slut. Allt skapas med Web Audio i webbläsaren, så inga ljudfiler behövs.

import { getState } from './store.js';

let ctx = null;
let master = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
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
    noiseBuf = c.createBuffer(1, Math.round(c.sampleRate * 0.05), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

/** En dämpad sinuston som klingar av exponentiellt – byggstenen i både träklick och marimba. */
function partial(c, t, freq, gain, decay) {
  const o = c.createOscillator();
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + decay + 0.02);
}

/**
 * Ett träklick: en mycket kort brusstöt (själva "kicket" när pjäsen nuddar brädet)
 * plus några oharmoniska delar som klingar av på några hundradelar, som en träkloss.
 */
function click(c, t, { pitch = 1, gain = 0.5, bright = 1, body = 1 } = {}) {
  const n = noise(c);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800 * bright;
  const ng = c.createGain();
  ng.gain.setValueAtTime(gain * 0.9, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);
  n.connect(hp).connect(ng).connect(master);
  n.start(t);
  n.stop(t + 0.02);

  partial(c, t, 620 * pitch, gain * 0.9 * body, 0.055);
  partial(c, t, 1480 * pitch, gain * 0.45, 0.03);
  partial(c, t, 2650 * pitch * bright, gain * 0.22, 0.018);
  partial(c, t, 150 * pitch, gain * 0.35 * body, 0.04);
}

/** En marimbaton: grundton + den fjärde deltonen, som klingar ut mjukt. */
function marimba(c, t, freq, gain = 0.28, len = 0.7) {
  partial(c, t, freq, gain, len);
  partial(c, t, freq * 3.93, gain * 0.18, len * 0.25);
  partial(c, t, freq * 9.2, gain * 0.05, len * 0.1);
}

const SOUNDS = {
  move: (c, t) => click(c, t),
  // Slag: skarpare och hårdare, med ett litet efterklick när den tagna pjäsen knuffas undan.
  capture: (c, t) => {
    click(c, t, { pitch: 1.12, gain: 0.62, bright: 1.25, body: 0.8 });
    click(c, t + 0.028, { pitch: 1.5, gain: 0.25, bright: 1.4, body: 0.4 });
  },
  castle: (c, t) => {
    click(c, t, { gain: 0.45 });
    click(c, t + 0.1, { pitch: 0.92, gain: 0.5 });
  },
  promote: (c, t) => {
    click(c, t);
    marimba(c, t + 0.05, 1047, 0.14, 0.35);
    marimba(c, t + 0.12, 1568, 0.12, 0.45);
  },
  // Schack: ett ljusare, hårdare klick med en kort klang efter, så att det hörs att något hänt.
  check: (c, t) => {
    click(c, t, { pitch: 1.3, gain: 0.65, bright: 1.3 });
    marimba(c, t + 0.01, 1319, 0.16, 0.28);
    marimba(c, t + 0.09, 1760, 0.13, 0.32);
  },
  start: (c, t) => { marimba(c, t, 784, 0.22, 0.5); marimba(c, t + 0.11, 1047, 0.22, 0.7); },
  win: (c, t) => { marimba(c, t, 784); marimba(c, t + 0.12, 1047); marimba(c, t + 0.24, 1319, 0.26, 0.9); },
  loss: (c, t) => { marimba(c, t, 880, 0.22); marimba(c, t + 0.16, 659, 0.22); marimba(c, t + 0.32, 523, 0.22, 0.9); },
  draw: (c, t) => { marimba(c, t, 880, 0.22, 0.5); marimba(c, t + 0.16, 880, 0.22, 0.8); },
  correct: (c, t) => { marimba(c, t, 1047, 0.2, 0.4); marimba(c, t + 0.09, 1568, 0.2, 0.6); },
  wrong: (c, t) => { marimba(c, t, 330, 0.2, 0.25); marimba(c, t + 0.1, 277, 0.2, 0.35); },
  illegal: (c, t) => { partial(c, t, 196, 0.3, 0.09); partial(c, t + 0.07, 185, 0.25, 0.1); },
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
