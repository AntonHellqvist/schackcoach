import { BOTS } from './bots.js';

export const ACHIEVEMENTS = [
  { id: 'first_game', icon: '♟', title: 'Första partiet', desc: 'Spela klart ett parti mot en bot.', link: '#/spela' },
  ...BOTS.map((b) => ({
    id: 'beat_' + b.id, icon: b.face, title: `Besegra ${b.name}`, desc: `Vinn mot ${b.name} (ca ${b.elo}).`,
    link: '#/spela/' + b.id, group: 'bots',
  })),
  { id: 'first_review', icon: '📈', title: 'Lär av partiet', desc: 'Analysera ett parti med partibedömningen.', link: '#/analys' },
  { id: 'chesscom_import', icon: '🔗', title: 'Kopplad till Chess.com', desc: 'Hämta dina partier från Chess.com.', link: '#/analys' },
  { id: 'accuracy_80', icon: '🎯', title: 'Precisionsspelare', desc: 'Nå minst 80 % träffsäkerhet i ett parti.', link: '#/spela' },
  { id: 'accuracy_90', icon: '💎', title: 'Nästan felfritt', desc: 'Nå minst 90 % träffsäkerhet i ett parti.', link: '#/spela' },
  { id: 'no_blunder', icon: '🛡️', title: 'Inga blunders', desc: 'Spela ett helt parti (minst 20 drag) utan en enda blunder.', link: '#/spela' },
  { id: 'daily', icon: '📅', title: 'Dagens pussel', desc: 'Lös dagens pussel.', link: '#/pussel/daily' },
  { id: 'puzzles_10', icon: '🧩', title: '10 lösta pussel', desc: 'Lös 10 pussel.', link: '#/pussel' },
  { id: 'puzzles_50', icon: '🧠', title: '50 lösta pussel', desc: 'Lös 50 pussel.', link: '#/pussel' },
  { id: 'streak_5', icon: '🔥', title: 'Fem i rad', desc: 'Lös 5 pussel i rad utan fel.', link: '#/pussel' },
  { id: 'rating_1500', icon: '📈', title: 'Pusselrating 1500', desc: 'Nå 1500 i pusselrating.', link: '#/pussel' },
  { id: 'rush_10', icon: '⚡', title: 'Pusselrush 10', desc: 'Lös 10 pussel på 3 minuter i Pusselrush.', link: '#/utmaningar/rush' },
  { id: 'mistakes_5', icon: '🔁', title: 'Lär av misstagen', desc: 'Lös 5 av dina egna misstag från analyserade partier.', link: '#/pussel/mistakes' },
  { id: 'endgame_kq', icon: '♛', title: 'Damsmatt', desc: 'Matta Stockfish med dam och kung mot ensam kung.', link: '#/utmaningar/kq' },
  { id: 'endgame_kr', icon: '♜', title: 'Tornmatt', desc: 'Matta Stockfish med torn och kung mot ensam kung.', link: '#/utmaningar/kr' },
  { id: 'endgame_kbb', icon: '♝', title: 'Två löpare', desc: 'Matta Stockfish med två löpare och kung.', link: '#/utmaningar/kbb' },
  { id: 'opening_1', icon: '📖', title: 'Första öppningen', desc: 'Spela igenom en öppning felfritt.', link: '#/oppningar' },
  { id: 'opening_5', icon: '📚', title: 'Öppningsrepertoar', desc: 'Spela igenom 5 olika öppningar felfritt.', link: '#/oppningar' },
  { id: 'mates_5', icon: '♚', title: 'Mattmönster', desc: 'Lös 5 klassiska mattmönster.', link: '#/matter' },
  { id: 'mates_all', icon: '🏅', title: 'Mattmästare', desc: 'Lös alla klassiska mattmönster.', link: '#/matter' },
];
