// Coachen: förklarar misstag i klartext utifrån vad som händer på brädet
// (hängande pjäser, gafflar, missade slag, matthot) i stället för bara en värdering.

import { Chess } from '../vendor/chess.js';
import { uciToMove } from './board.js';

const NAME = { p: 'bonde', n: 'springare', b: 'löpare', r: 'torn', q: 'dam', k: 'kung' };
const DEF = { p: 'bonden', n: 'springaren', b: 'löparen', r: 'tornet', q: 'damen', k: 'kungen' };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export const MISTAKE_TYPES = {
  hanging: { name: 'Hängande pjäs', tip: 'Fråga dig före varje drag: "Står alla mina pjäser skyddade?"', theme: 'hangingPiece' },
  ignored_threat: { name: 'Missat hot', tip: 'Titta på motståndarens senaste drag: vad hotar det?', theme: 'hangingPiece' },
  fork: { name: 'Gaffel mot dig', tip: 'Se upp för springare som kan hoppa in och angripa två pjäser.', theme: 'fork' },
  allowed_mate: { name: 'Tillät matt', tip: 'Kolla alltid om motståndaren har schackar mot din kung.', theme: 'mateIn2' },
  missed_mate: { name: 'Missad matt', tip: 'Leta efter schackar först – ibland finns det matt!', theme: 'mateIn1' },
  missed_capture: { name: 'Missat slag', tip: 'Kolla om motståndaren har lämnat en pjäs oskyddad.', theme: 'hangingPiece' },
  missed_fork: { name: 'Missad gaffel', tip: 'Leta efter drag som angriper två saker samtidigt.', theme: 'fork' },
  other: { name: 'Övrigt', tip: 'Jämför ditt drag med motorns förslag och fundera på skillnaden.', theme: '' },
};

const sqTxt = (sq) => `<b>${sq}</b>`;
const din = (t) => (t === 'r' ? 'ditt torn' : 'din ' + NAME[t]);
const mateIn = (cp) => (Math.abs(cp) >= 9000 ? Math.max(1, Math.round((10000 - Math.abs(cp)) / 10)) : null);

/** Kan pjäsen på `sq` (färg `color`) vinnas: anfallen och oskyddad, eller anfallen av billigare pjäs? */
function isLoose(chess, sq, color) {
  const p = chess.get(sq);
  if (!p) return false;
  const opp = color === 'w' ? 'b' : 'w';
  const att = chess.attackers(sq, opp);
  if (!att.length) return false;
  const def = chess.attackers(sq, color);
  const minAtt = Math.min(...att.map((s) => VAL[chess.get(s).type]));
  return def.length === 0 || minAtt < VAL[p.type];
}

/** Pjäser som `piece` på `sq` angriper och som är värda att angripa (gaffel-detektering). */
function forkTargets(chess, sq) {
  const me = chess.get(sq);
  if (!me) return [];
  const targets = [];
  // Generera motståndarens "vy": vilka rutor angriper pjäsen? Använd attackers från varje motståndarruta.
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color === me.color) continue;
      if (!chess.attackers(p.square, me.color).includes(sq)) continue;
      const defended = chess.attackers(p.square, p.color).length > 0;
      if (p.type === 'k' || VAL[p.type] > VAL[me.type] || (!defended && VAL[p.type] >= 3)) targets.push(p);
    }
  }
  return targets;
}

function listTargets(ts) {
  const names = ts.map((t) => (t.type === 'k' ? 'kungen' : `${DEF[t.type]} på ${sqTxt(t.square)}`));
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' och ' + names.at(-1) : names[0];
}

function san(fen, uci) {
  try {
    return new Chess(fen).move(uciToMove(uci)).san;
  } catch {
    return null;
  }
}

/**
 * Förklarar varför ett drag var dåligt.
 * mv: chess.js verbose-drag (med before/after), bestUci: motorns bästa drag i ställningen före,
 * replyUci: motståndarens bästa svar efter draget, cpBefore/cpAfter: värdering ur vits perspektiv.
 * Returnerar { type, text } eller null om det inte går att säga något konkret.
 */
export function diagnose(mv, { bestUci, replyUci, cpBefore, cpAfter }) {
  const me = mv.color;
  const sign = me === 'w' ? 1 : -1;
  const after = new Chess(mv.after);
  const bestSan = bestUci ? san(mv.before, bestUci) : null;
  const replySan = replyUci ? san(mv.after, replyUci) : null;

  // 1. Tillåter matt
  const m1 = cpAfter != null ? mateIn(cpAfter) : null;
  if (m1 && Math.sign(cpAfter) === -sign) {
    return {
      type: 'allowed_mate',
      text: m1 === 1 ? `Motståndaren kan sätta dig matt direkt med <b>${replySan}</b>!`
        : `Det här ger motståndaren matt i ${m1}${replySan ? `, med början <b>${replySan}</b>` : ''}. Titta på schackarna mot din kung.`,
    };
  }
  // 2. Missad matt
  const m0 = cpBefore != null ? mateIn(cpBefore) : null;
  if (m0 && Math.sign(cpBefore) === sign && !(m1 && Math.sign(cpAfter) === sign)) {
    return { type: 'missed_mate', text: m0 === 1 ? `Du hade matt i ett drag: <b>${bestSan}</b>!` : `Du hade matt i ${m0}, med början <b>${bestSan}</b>!` };
  }

  // 3. Motståndarens svar tar en pjäs
  if (replyUci) {
    const r = uciToMove(replyUci);
    const target = after.get(r.to);
    const taker = after.get(r.from);
    if (target && target.color === me && taker && isLoose(after, r.to, me)) {
      const takerTxt = `${DEF[taker.type]} på ${sqTxt(r.from)}`;
      const undefended = after.attackers(r.to, me).length === 0;
      if (r.to === mv.to) {
        return {
          type: 'hanging',
          text: `Du flyttade ${DEF[target.type]} till ${sqTxt(r.to)}, där ${takerTxt} kan ta den${undefended ? ' – och den är oskyddad.' : '. Den är skyddad, men är värd mer än ' + DEF[taker.type] + ' som tar.'}`,
        };
      }
      const before = new Chess(mv.before);
      const wasLoose = before.get(r.to)?.color === me && isLoose(before, r.to, me);
      if (wasLoose) {
        return { type: 'ignored_threat', text: `${din(target.type).replace(/^d/, 'D')} på ${sqTxt(r.to)} var redan hotad av ${takerTxt}. Du behövde flytta eller skydda den.` };
      }
      return { type: 'hanging', text: `Efter draget kan ${takerTxt} ta din ${NAME[target.type]} på ${sqTxt(r.to)}${undefended ? ', som nu står oskyddad.' : '.'}` };
    }
    // 4. Gaffel mot dig
    try {
      const c = new Chess(mv.after);
      const rm = c.move(r);
      const ts = forkTargets(c, rm.to);
      if (ts.length >= 2) return { type: 'fork', text: `Motståndaren kan gaffla med <b>${rm.san}</b> – den angriper ${listTargets(ts)} samtidigt.` };
    } catch { /* ignorera */ }
  }

  // 5. Missade du något?
  if (bestUci) {
    const b = uciToMove(bestUci);
    const before = new Chess(mv.before);
    const victim = before.get(b.to);
    const attacker = before.get(b.from);
    if (victim && victim.color !== me && attacker && isLoose(before, b.to, victim.color)) {
      return { type: 'missed_capture', text: `Du missade att du kunde vinna ${DEF[victim.type]} på ${sqTxt(b.to)} med <b>${bestSan}</b>.` };
    }
    try {
      const c = new Chess(mv.before);
      const bm = c.move(b);
      const ts = forkTargets(c, bm.to);
      if (ts.length >= 2) return { type: 'missed_fork', text: `<b>${bm.san}</b> hade angripit ${listTargets(ts)} samtidigt – en gaffel!` };
    } catch { /* ignorera */ }
  }
  return { type: 'other', text: replySan ? `Motståndaren svarar bäst med <b>${replySan}</b>.` : '' };
}
