import { Chess } from '../vendor/chess.js';
import { uciToMove } from './board.js';

// Bottar med olika styrka. Elo är ungefärliga uppskattningar.
// Svagare bottar väljer ibland näst bästa drag (tolerance) eller gör rena misstag (blunder),
// så att de känns mänskligare än en motor som bara spelar sämre på djupet.
export const BOTS = [
  { id: 'sixten', name: 'Sixten', face: '🐣', elo: 400, depth: 1, skill: 0, multipv: 5, tolerance: 350, blunder: 0.25,
    bio: 'Har precis lärt sig hur pjäserna går. Hänger gärna pjäser.' },
  { id: 'lisa', name: 'Lisa', face: '🙂', elo: 700, depth: 2, skill: 2, multipv: 4, tolerance: 160, blunder: 0.12,
    bio: 'Gillar att anfalla men glömmer ibland att försvara sig.' },
  { id: 'erik', name: 'Erik', face: '🧢', elo: 1000, depth: 4, skill: 5, multipv: 3, tolerance: 90, blunder: 0.06,
    bio: 'Klubbspelare som kan sina öppningsprinciper.' },
  { id: 'maja', name: 'Maja', face: '🎓', elo: 1300, depth: 6, skill: 8, multipv: 3, tolerance: 55, blunder: 0.03,
    bio: 'Taktiskt vaken. Straffar hängande pjäser.' },
  { id: 'oskar', name: 'Oskar', face: '🦊', elo: 1600, depth: 8, skill: 11, multipv: 2, tolerance: 30, blunder: 0.012,
    bio: 'Listig och tålmodig. Svår att lura.' },
  { id: 'ingrid', name: 'Ingrid', face: '👑', elo: 1900, depth: 11, skill: 15, multipv: 1, tolerance: 0, blunder: 0,
    bio: 'Stark turneringsspelare med bra slutspel.' },
  { id: 'trollkarlen', name: 'Trollkarlen', face: '🧙', elo: 2300, depth: 14, skill: 19, multipv: 1, tolerance: 0, blunder: 0,
    bio: 'Mästarnivå. Kräver att du spelar ditt bästa schack.' },
  { id: 'stockfish', name: 'Stockfish', face: '🤖', elo: 3000, movetime: 1500, skill: 20, multipv: 1, tolerance: 0, blunder: 0,
    bio: 'Full styrka. Lycka till!' },
];

/** Låter boten välja ett drag i ställningen. Returnerar ett drag-objekt {from,to,promotion}. */
export async function botMove(engine, fen, bot) {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;

  if (bot.blunder && Math.random() < bot.blunder) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    // Liten väntan så att det inte känns direkt.
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  const start = performance.now();
  const res = await engine.analyse(fen, {
    depth: bot.depth,
    movetime: bot.movetime,
    multipv: Math.min(bot.multipv || 1, legal.length),
    skill: bot.skill,
  });
  let uci = res.bestmove;
  if (bot.tolerance && res.lines.length > 1) {
    const val = (l) => (l.score.mate !== undefined ? (l.score.mate > 0 ? 100000 - l.score.mate : -100000 - l.score.mate) : l.score.cp);
    const best = val(res.lines[0]);
    const ok = res.lines.filter((l) => best - val(l) <= bot.tolerance);
    uci = ok[Math.floor(Math.random() * ok.length)].pv[0];
  }
  // Svaga bottar "tänker" lite så att det känns naturligt.
  const elapsed = performance.now() - start;
  const minThink = 350 + Math.random() * 500;
  if (elapsed < minThink) await new Promise((r) => setTimeout(r, minThink - elapsed));
  return uci ? uciToMove(uci) : null;
}
