// Chess.coms publika API (kräver ingen inloggning).

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
const TIME = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', daily: 'Korrespondens' };

/** Gör om ett rått Chess.com-parti till ett parti i biblioteket. */
export function toChesscomGame(g, user) {
  const userColor = g.white.username.toLowerCase() === user ? 'w' : 'b';
  const me = userColor === 'w' ? g.white : g.black;
  const opp = userColor === 'w' ? g.black : g.white;
  const outcome = me.result === 'win' ? 'win' : DRAWS.has(me.result) ? 'draw' : 'loss';
  return {
    id: g.url || g.uuid,
    source: 'chesscom',
    pgn: g.pgn,
    userColor,
    opponent: opp.username,
    opponentRating: opp.rating,
    rating: me.rating,
    timeClass: TIME[g.time_class] || g.time_class,
    endTime: g.end_time * 1000,
    date: new Date(g.end_time * 1000).toLocaleDateString('sv-SE'),
    outcome,
    opening: chesscomOpening(g.eco),
    url: g.url,
  };
}

/** "https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation-6.Be3" -> "Sicilian Defense Najdorf Variation" */
export function chesscomOpening(url) {
  if (!url) return '';
  const slug = url.split('/openings/')[1] || '';
  return decodeURIComponent(slug).split(/-\d|\.\.\.\d/)[0].replace(/-/g, ' ').replace(/\.\.\.$/, '').trim();
}
