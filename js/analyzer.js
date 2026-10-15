// Sparar analyser och kör en bakgrundskö som analyserar partier medan du gör annat i appen.

import { Chess } from '../vendor/chess.js';
import { Engine } from './engine.js';
import { analysePositions, classifyMoves, accuracy, countClasses } from './analysis.js';
import { bookSet, detectOpening } from './data/openings.js';
import { chesscomOpening } from './chesscom.js';
import { getState, update, unlock } from './store.js';
import { addGame, getLibraryGame } from './library.js';

export const DEPTH = 14;
export const BOOK = bookSet(Chess);

export function getAnalysis(id) {
  const g = getState().games.find((x) => x.id === id);
  return g && g.depth === DEPTH && g.evals ? g : null;
}

/** Läser ett parti och returnerar drag + ställningar. */
export function parseGame(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history({ verbose: true });
  const fens = moves.length ? [moves[0].before, ...moves.map((m) => m.after)] : [chess.fen()];
  return { headers: chess.getHeaders(), moves, fens };
}

const compact = (evals) => evals.map((e) => ({ ...e, pv: e.pv.slice(0, 6) }));

export function saveAnalysis(meta, moves, evals, headers, userColor) {
  const classified = classifyMoves(moves, evals, BOOK);
  const opening = detectOpening(moves.map((m) => m.san))?.name || meta.opening || chesscomOpening(headers.ECOUrl) || headers.Opening || '';
  const counts = countClasses(classified, userColor);
  const entry = {
    id: meta.id,
    source: meta.source || 'pgn',
    date: meta.date || (headers.Date || '').replace(/\./g, '-'),
    endTime: meta.endTime || Date.now(),
    white: headers.White || 'Vit',
    black: headers.Black || 'Svart',
    result: headers.Result || '*',
    userColor,
    accuracy: accuracy(classified, userColor),
    oppAccuracy: accuracy(classified, userColor === 'w' ? 'b' : 'w'),
    counts,
    opening,
    timeClass: meta.timeClass || null,
    evals: compact(evals),
    depth: DEPTH,
    analysedAt: Date.now(),
  };
  // Partiet (PGN) bor i biblioteket – se till att det finns där.
  if (!getLibraryGame(meta.id)) {
    addGame({
      id: meta.id, source: meta.source || 'pgn', pgn: meta.pgn, userColor,
      opponent: userColor === 'w' ? entry.black : entry.white, timeClass: meta.timeClass || (meta.source === 'bot' ? 'Mot bot' : 'PGN'),
      endTime: entry.endTime, date: entry.date, opening,
      outcome: entry.result === '1/2-1/2' ? 'draw' : (entry.result === '1-0') === (userColor === 'w') ? 'win' : 'loss',
    });
  }
  update((s) => {
    s.games = s.games.filter((g) => g.id !== entry.id);
    s.games.push(entry);
    s.games.sort((a, b) => (a.endTime || 0) - (b.endTime || 0));
    if (s.games.length > 400) s.games = s.games.slice(-400);
    for (const m of classified) {
      if (m.color !== userColor || (m.cls !== 'mistake' && m.cls !== 'blunder') || !m.bestUci) continue;
      const id = entry.id + '-' + m.i;
      if (s.mistakes.some((x) => x.id === id)) continue;
      const e0 = evals[m.i];
      s.mistakes.push({
        id, fen: moves[m.i].before, best: m.bestUci, bestSan: m.bestSan, played: m.san, cls: m.cls,
        bestCp: userColor === 'w' ? e0.cp : -e0.cp, gameId: entry.id, solved: false, added: Date.now(),
      });
    }
    if (s.mistakes.length > 400) s.mistakes = s.mistakes.slice(-400);
  });
  unlock('first_review');
  const userMoves = classified.filter((m) => m.color === userColor).length;
  if (entry.accuracy >= 80 && userMoves >= 10) unlock('accuracy_80');
  if (entry.accuracy >= 90 && userMoves >= 10) unlock('accuracy_90');
  if (userMoves >= 20 && counts.blunder === 0) unlock('no_blunder');
  return entry;
}

// ---------------------------------------------------------------- bakgrundskö

const queue = [];
let current = null;
let progress = 0;
let engine = null;
let paused = 0;
let running = false;
const listeners = new Set();

export const onQueueChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(queueStatus()));

export function queueStatus() {
  return { current, queued: queue.length, progress, ids: new Set([...queue.map((g) => g.id), ...(current ? [current.id] : [])]) };
}

/** Lägger partier i kön (de som redan är analyserade hoppas över). */
export function enqueue(games, { front = false } = {}) {
  const st = queueStatus();
  const fresh = games.filter((g) => g.pgn && !getAnalysis(g.id) && !st.ids.has(g.id));
  if (!fresh.length) return 0;
  if (front) queue.unshift(...fresh);
  else queue.push(...fresh);
  emit();
  run();
  return fresh.length;
}

/** Tar bort ett parti ur kön (t.ex. när det analyseras i förgrunden). */
export function dequeue(id) {
  const i = queue.findIndex((g) => g.id === id);
  if (i >= 0) queue.splice(i, 1);
  emit();
}

export function clearQueue() {
  queue.length = 0;
  emit();
}

/** Pausar bakgrundsanalysen så att förgrunden får all kraft. Returnerar en resume-funktion. */
export function pauseBackground() {
  paused++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    paused--;
    if (!paused) run();
  };
}

async function run() {
  if (running || paused) return;
  running = true;
  engine ||= new Engine();
  while (queue.length && !paused) {
    current = queue.shift();
    progress = 0;
    emit();
    try {
      const { headers, moves, fens } = parseGame(current.pgn);
      let interrupted = false;
      const evals = await analysePositions(engine, fens, {
        depth: DEPTH,
        isCancelled: () => (paused ? (interrupted = true) : false),
        onProgress: (n, total) => { progress = n / total; emit(); },
      });
      if (evals) saveAnalysis(current, moves, evals, headers, current.userColor);
      else if (interrupted) queue.unshift(current);
    } catch (e) {
      console.warn('Kunde inte analysera', current?.id, e);
    }
    current = null;
    emit();
  }
  running = false;
  if (!queue.length && engine) {
    engine.terminate();
    engine = null;
  }
}
