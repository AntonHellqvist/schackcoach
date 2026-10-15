import { Chess } from '../vendor/chess.js';
import { toWhiteCp, winProb, formatWhiteCp } from './engine.js';
import { pvToSan, uciToMove } from './board.js';

export const CLASSES = {
  brilliant: { name: 'Briljant', sym: '!!' },
  great: { name: 'Starkt drag', sym: '!' },
  best: { name: 'Bästa draget', sym: '★' },
  excellent: { name: 'Utmärkt', sym: '✓' },
  good: { name: 'Bra', sym: '✓' },
  book: { name: 'Teori', sym: 'T' },
  inaccuracy: { name: 'Inexakt', sym: '?!' },
  mistake: { name: 'Misstag', sym: '?' },
  blunder: { name: 'Blunder', sym: '??' },
};
export const CLASS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/**
 * Analyserar alla ställningar i ett parti med motorn.
 * Returnerar en lista med { cp (vits perspektiv), best (uci), pv: [uci], cp2 } för varje ställning.
 */
export async function analysePositions(engine, fens, { depth = 12, onProgress, isCancelled } = {}) {
  const out = [];
  for (let i = 0; i < fens.length; i++) {
    if (isCancelled?.()) return null;
    const c = new Chess(fens[i]);
    if (c.isGameOver()) {
      const cp = c.isCheckmate() ? (c.turn() === 'w' ? -10000 : 10000) : 0;
      out.push({ cp, best: null, pv: [], cp2: null });
    } else {
      const legal = c.moves().length;
      const r = await engine.analyse(fens[i], { depth, multipv: Math.min(3, legal) });
      const l1 = r.lines[0];
      const l2 = r.lines[1];
      out.push({
        cp: l1 ? toWhiteCp(l1.score, c.turn()) : 0,
        best: r.bestmove,
        pv: (l1?.pv || []).slice(0, 8),
        cp2: l2 ? toWhiteCp(l2.score, c.turn()) : null,
        // motorns topp-drag med värdering, för konsekvent jämförelse med det spelade draget
        alts: r.lines.map((l) => [l.pv[0], toWhiteCp(l.score, c.turn())]),
      });
    }
    onProgress?.(i + 1, fens.length, out[i]);
  }
  return out;
}

function isSacrifice(move) {
  // Draget lämnar en pjäs (ej bonde) som kan slås med vinst för motståndaren.
  if (move.piece === 'p' || move.piece === 'k') return false;
  const after = new Chess(move.after);
  const opp = move.color === 'w' ? 'b' : 'w';
  const attackers = after.attackers(move.to, opp);
  if (!attackers.length) return false;
  const v = VAL[move.piece];
  const gained = move.captured ? VAL[move.captured] : 0;
  if (v - gained < 2) return false;
  const defenders = after.attackers(move.to, move.color);
  const minAtt = Math.min(...attackers.map((sq) => VAL[after.get(sq).type]));
  return defenders.length === 0 || minAtt < v;
}

function mateIn(cp) {
  return Math.abs(cp) >= 9000 ? Math.max(1, Math.round((10000 - Math.abs(cp)) / 10)) : null;
}

/**
 * Klassar varje drag utifrån motoranalysen.
 * moves: chess.js verbose-historik, evals: resultat från analysePositions, book: Set med bokställningar.
 */
export function classifyMoves(moves, evals, book) {
  const result = [];
  let inBook = true;
  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i];
    const e0 = evals[i];
    const e1 = evals[i + 1];
    const sign = mv.color === 'w' ? 1 : -1;
    const uci = mv.from + mv.to + (mv.promotion || '');
    const isBest = uci === e0.best;
    // Om draget fanns bland motorns förstaval används värderingen från samma sökning (mindre brus).
    const alt = e0.alts?.find((a) => a[0] === uci);
    const cpAfter = alt ? alt[1] : e1.cp;
    const wpBefore = winProb(sign * e0.cp);
    const wpAfter = winProb(sign * cpAfter);
    const loss = Math.max(0, wpBefore - wpAfter);
    const key = mv.after.split(' ').slice(0, 2).join(' ');

    let cls;
    if (inBook && book.has(key)) cls = 'book';
    else {
      inBook = false;
      if (isBest || loss < 0.005) cls = 'best';
      else if (loss < 0.02) cls = 'excellent';
      else if (loss < (i < 16 ? 0.08 : 0.05)) cls = 'good'; // lite mer marginal i öppningen där motorn brusar
      else if (loss < 0.1) cls = 'inaccuracy';
      else if (loss < 0.2) cls = 'mistake';
      else cls = 'blunder';

      if (cls === 'best') {
        const wp2 = e0.cp2 != null ? winProb(sign * e0.cp2) : null;
        if (isSacrifice(mv) && wpAfter > 0.5 && wpBefore < 0.97) cls = 'brilliant';
        else if (wp2 != null && wpBefore - wp2 > 0.18 && wpAfter > 0.4 && !mv.captured) cls = 'great';
      }
    }

    // Träffsäkerhet per drag (Lichess-formeln)
    const lossPct = loss * 100;
    const acc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * lossPct) - 3.1669));

    const bestSan = e0.best ? pvToSan(mv.before, [e0.best], 1)[0] : null;
    const pvSan = pvToSan(mv.before, e0.pv, 6);
    const replySan = e1.best ? pvToSan(mv.after, [e1.best], 1)[0] : null;

    result.push({
      i, san: mv.san, color: mv.color, cls, loss, acc, bestSan, bestUci: e0.best, pvSan, replySan,
      text: explain(mv, cls, e0, e1, bestSan, replySan, sign),
      cpAfter: e1.cp,
    });
  }
  return result;
}

function explain(mv, cls, e0, e1, bestSan, replySan, sign) {
  const name = CLASSES[cls].name.toLowerCase();
  const evalTxt = `(${formatWhiteCp(e1.cp)})`;
  const m0 = mateIn(e0.cp);
  const m1 = mateIn(e1.cp);
  const hadMate = m0 && Math.sign(e0.cp) === sign;
  const allowsMate = m1 && Math.sign(e1.cp) === -sign;
  const after = new Chess(mv.after);

  if (after.isCheckmate()) return `<b>${mv.san}</b> – schackmatt! 🎉`;
  switch (cls) {
    case 'book': return `<b>${mv.san}</b> är ett teoridrag. Bra att du kan öppningen!`;
    case 'brilliant': return `<b>${mv.san}</b> är briljant! Ett modigt offer som håller. ${evalTxt}`;
    case 'great': return `<b>${mv.san}</b> är ett starkt drag – det enda draget som håller ställningen. ${evalTxt}`;
    case 'best': return `<b>${mv.san}</b> är det bästa draget! ${evalTxt}`;
    case 'excellent':
    case 'good':
      return `<b>${mv.san}</b> är ${name}. ${bestSan && bestSan !== mv.san ? `Motorn föredrog <b>${bestSan}</b>.` : ''} ${evalTxt}`;
  }
  let why = '';
  if (allowsMate) why = `Det tillåter matt i ${m1}${replySan ? `, med början ${replySan}` : ''}.`;
  else if (hadMate && !(m1 && Math.sign(e1.cp) === sign)) why = `Du hade matt i ${m0}!`;
  else if (replySan && replySan.includes('x')) why = `Motståndaren kan svara <b>${replySan}</b> och vinna material.`;
  else if (replySan) why = `Motståndaren svarar bäst med <b>${replySan}</b>.`;
  const pre = cls === 'inaccuracy' ? 'är lite inexakt' : cls === 'mistake' ? 'är ett misstag' : 'är en blunder';
  return `<b>${mv.san}</b> ${pre}. ${why} ${bestSan ? `Bättre var <b>${bestSan}</b>.` : ''} ${evalTxt}`;
}

/** Träffsäkerhet för en sida: medelvärde av aritmetiskt och harmoniskt medel. */
export function accuracy(classified, color) {
  const a = classified.filter((m) => m.color === color).map((m) => m.acc);
  if (!a.length) return null;
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const harm = a.length / a.reduce((x, y) => x + 1 / Math.max(y, 1), 0);
  return Math.round(((mean + harm) / 2) * 10) / 10;
}

export function countClasses(classified, color) {
  const c = Object.fromEntries(CLASS_ORDER.map((k) => [k, 0]));
  for (const m of classified) if (m.color === color) c[m.cls]++;
  return c;
}

export { uciToMove };
