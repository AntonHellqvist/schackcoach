// Dagens träning: ett personligt pass på ~10–15 minuter som byts varje dag, plus en streak.

import { getState, update, unlock } from './store.js';
import { OPENINGS } from './data/openings.js';
import { MATES } from './data/mates.js';
import { MISTAKE_TYPES } from './coach.js';
import { themeName } from './lichess.js';

export const today = (d = new Date()) => d.toLocaleDateString('sv-SE'); // ÅÅÅÅ-MM-DD
const yesterday = () => today(new Date(Date.now() - 864e5));
const dayNumber = () => Math.floor(Date.now() / 864e5);

const IGNORE_THEMES = new Set(['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'crushing', 'advantage', 'middlegame', 'mate', 'endgame', 'opening', 'equality']);

/** Väljer tema för dagens pussel: svagaste pusseltema, annars ditt vanligaste misstag i partierna. */
function pickTheme(s) {
  const weak = Object.entries(s.puzzle.themes)
    .filter(([t, v]) => !IGNORE_THEMES.has(t) && v.s + v.f >= 3)
    .map(([t, v]) => [t, v.s / (v.s + v.f)])
    .filter(([, r]) => r < 0.7)
    .sort((a, b) => a[1] - b[1]);
  if (weak[0]) return { theme: weak[0][0], why: `ditt svagaste pusseltema (${Math.round(weak[0][1] * 100)} % rätt)` };

  const totals = {};
  for (const g of s.games) for (const [t, n] of Object.entries(g.mistakeTypes || {})) if (t !== 'other') totals[t] = (totals[t] || 0) + n;
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  if (top && MISTAKE_TYPES[top[0]]?.theme) {
    return { theme: MISTAKE_TYPES[top[0]].theme, why: `ditt vanligaste misstag i partierna: ${MISTAKE_TYPES[top[0]].name.toLowerCase()}` };
  }
  const rotation = ['hangingPiece', 'fork', 'mateIn1', 'pin', 'mateIn2', 'skewer', 'discoveredAttack'];
  return { theme: rotation[dayNumber() % rotation.length], why: 'dagens tema' };
}

function pickOpening(s) {
  const side = dayNumber() % 2 === 0 ? 'w' : 'b';
  const candidates = OPENINGS.filter((o) => !o.trap && o.side === side && o.level !== 'Avancerad');
  candidates.sort((a, b) => {
    const pa = s.openings[a.id], pb = s.openings[b.id];
    return (pa?.perfect ? 1 : 0) - (pb?.perfect ? 1 : 0) || (pa?.practiced || 0) - (pb?.practiced || 0);
  });
  return candidates[0] || OPENINGS[0];
}

function pickMate(s) {
  return MATES.find((m) => !s.mates[m.id]) || MATES[dayNumber() % MATES.length];
}

function makePlan(s) {
  const { theme, why } = pickTheme(s);
  const unsolved = s.mistakes.filter((m) => !m.solved).length;
  const opening = pickOpening(s);
  const mate = pickMate(s);
  const steps = [
    { id: 'puzzles', kind: 'puzzles', icon: '🧩', title: `5 pussel: ${themeName(theme)}`, sub: `Valt efter ${why}.`, theme, target: 5 },
    unsolved
      ? { id: 'mistakes', kind: 'mistakes', icon: '🔁', title: `${Math.min(2, unsolved)} av dina egna misstag`, sub: 'Ställningar från dina partier där du missade ett bättre drag.', target: Math.min(2, unsolved) }
      : { id: 'warmup', kind: 'puzzles', icon: '⚡', title: '3 snabba matt i 1', sub: 'Analysera partier så byts detta mot dina egna misstag.', theme: 'mateIn1', target: 3 },
    { id: 'opening', kind: 'opening', icon: '📖', title: `Öppning: ${opening.name}`, sub: `Spela igenom varianten som ${opening.side === 'w' ? 'vit' : 'svart'}.`, ref: opening.id, target: 1 },
    { id: 'mate', kind: 'mate', icon: '♚', title: `Mattmönster: ${mate.name}`, sub: `Matt i ${mate.n}.`, ref: mate.id, target: 1 },
  ];
  return { date: today(), steps, progress: {}, completed: false };
}

export function getDaily() {
  const s = getState();
  if (!s.daily || s.daily.date !== today()) update((st) => { st.daily = makePlan(st); });
  return getState().daily;
}

export function stepDone(d, step) {
  return (d.progress[step.id] || 0) >= step.target;
}

export function dailyProgress(d = getDaily()) {
  const done = d.steps.filter((st) => stepDone(d, st)).length;
  return { done, total: d.steps.length };
}

/** Bockar av en del av dagens pass. kind = 'puzzles' | 'mistakes' | 'opening' | 'mate'. */
export function markDaily(kind, { ref, stepId } = {}) {
  const d = getDaily();
  const step = d.steps.find((st) => (stepId ? st.id === stepId : st.kind === kind && (!st.ref || !ref || st.ref === ref)) && !stepDone(d, st));
  if (!step) return false;
  update((s) => {
    s.daily.progress[step.id] = (s.daily.progress[step.id] || 0) + 1;
  });
  const after = getDaily();
  if (!after.completed && after.steps.every((st) => stepDone(after, st))) completeDay();
  return true;
}

function completeDay() {
  update((s) => {
    s.daily.completed = true;
    const st = (s.streak ||= { current: 0, best: 0, last: null });
    if (st.last !== today()) {
      st.current = st.last === yesterday() ? st.current + 1 : 1;
      st.last = today();
      st.best = Math.max(st.best, st.current);
    }
  });
  const { current } = streakInfo();
  unlock('daily_first');
  if (current >= 3) unlock('streak_3');
  if (current >= 7) unlock('streak_7');
  if (current >= 30) unlock('streak_30');
}

/** Aktuell streak (räknas bara om du tränade idag eller igår). */
export function streakInfo() {
  const st = getState().streak || { current: 0, best: 0, last: null };
  const alive = st.last === today() || st.last === yesterday();
  return { current: alive ? st.current : 0, best: st.best || 0, doneToday: st.last === today() };
}
