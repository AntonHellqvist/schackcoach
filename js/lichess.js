import { Chess } from '../vendor/chess.js';

// Pussel från Lichess öppna API (ingen inloggning krävs).

export const THEMES = [
  ['', 'Blandat'],
  ['mateIn1', 'Matt i 1'],
  ['mateIn2', 'Matt i 2'],
  ['mateIn3', 'Matt i 3'],
  ['fork', 'Gaffel'],
  ['pin', 'Bindning'],
  ['skewer', 'Spett'],
  ['discoveredAttack', 'Avdragsangrepp'],
  ['hangingPiece', 'Hängande pjäs'],
  ['sacrifice', 'Offer'],
  ['backRankMate', 'Bakre raden'],
  ['deflection', 'Avledning'],
  ['attraction', 'Lockning'],
  ['defensiveMove', 'Försvarsdrag'],
  ['endgame', 'Slutspel'],
  ['opening', 'Öppning'],
];

const THEME_SV = {
  ...Object.fromEntries(THEMES),
  mate: 'Matt', mateIn4: 'Matt i 4', mateIn5: 'Långt matt', short: 'Kort', long: 'Lång', veryLong: 'Mycket lång',
  middlegame: 'Mittspel', crushing: 'Avgörande', advantage: 'Fördel', equality: 'Utjämning', master: 'Mästarparti',
  kingsideAttack: 'Kungsangrepp', queensideAttack: 'Damflygelangrepp', advancedPawn: 'Framskjuten bonde',
  promotion: 'Förvandling', underPromotion: 'Underförvandling', rookEndgame: 'Tornslutspel', pawnEndgame: 'Bondeslutspel',
  queenEndgame: 'Damslutspel', bishopEndgame: 'Löparslutspel', knightEndgame: 'Springarslutspel', zugzwang: 'Dragtvång',
  quietMove: 'Tyst drag', intermezzo: 'Mellandrag', clearance: 'Röjning', interference: 'Avskärning', xRayAttack: 'Röntgen',
  trappedPiece: 'Fångad pjäs', capturingDefender: 'Ta försvararen', doubleCheck: 'Dubbelschack', smotheredMate: 'Kvävningsmatt',
  anastasiaMate: 'Anastasias matt', arabianMate: 'Arabisk matt', bodenMate: 'Bodens matt', hookMate: 'Krokmatt',
  dovetailMate: 'Svalstjärtsmatt', exposedKing: 'Blottad kung', enPassant: 'En passant', castling: 'Rockad',
  oneMove: 'Ett drag', masterVsMaster: 'Mästare mot mästare', superGM: 'Superstormästare', attackingF2F7: 'Angrepp på f2/f7',
};

export const themeName = (t) => THEME_SV[t] || t;

function difficultyFor(rating) {
  const d = rating - 1500;
  if (d < -450) return 'easiest';
  if (d < -150) return 'easier';
  if (d < 150) return 'normal';
  if (d < 450) return 'harder';
  return 'hardest';
}

function parse(data) {
  const c = new Chess();
  c.loadPgn(data.game.pgn);
  const h = c.history({ verbose: true });
  const l = h[h.length - 1];
  return {
    id: data.puzzle.id,
    rating: data.puzzle.rating,
    themes: data.puzzle.themes || [],
    solution: data.puzzle.solution,
    fen: c.fen(),
    lastMove: l ? { from: l.from, to: l.to } : null,
    gameUrl: `https://lichess.org/${data.game.id}`,
  };
}

export async function nextPuzzle({ theme = '', rating = 1500, difficulty } = {}) {
  const params = new URLSearchParams({ difficulty: difficulty || difficultyFor(rating) });
  if (theme) params.set('angle', theme);
  const res = await fetch('https://lichess.org/api/puzzle/next?' + params);
  if (!res.ok) throw new Error('Lichess svarade med fel ' + res.status);
  return parse(await res.json());
}

/** Ett bestämt pussel (används av kompisutmaningar, där alla löser samma pussel). */
export async function getPuzzle(id) {
  const res = await fetch('https://lichess.org/api/puzzle/' + encodeURIComponent(id));
  if (!res.ok) throw new Error('Lichess svarade med fel ' + res.status);
  return parse(await res.json());
}

export async function dailyPuzzle() {
  const res = await fetch('https://lichess.org/api/puzzle/daily');
  if (!res.ok) throw new Error('Lichess svarade med fel ' + res.status);
  return parse(await res.json());
}
