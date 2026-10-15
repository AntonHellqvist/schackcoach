// Enkel lokal lagring av framsteg (sparas i webbläsaren).

const KEY = 'schackcoach-v1';

const defaults = () => ({
  settings: { chesscomUser: '', autoAnalyse: true },
  puzzle: { rating: 1200, history: [], solved: 0, failed: 0, themes: {} },
  games: [], // spelade/analyserade partier: { id, date, source, white, black, result, userColor, accuracy, counts, opening }
  mistakes: [], // egna misstag att träna på: { id, fen, best, played, cls, gameId, solved }
  botResults: {}, // { botId: { w, d, l } }
  achievements: {}, // { id: timestamp }
  openings: {}, // { openingId: { practiced, perfect } }
  mates: {}, // { mateId: true }
});

let state;
try {
  state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch {
  state = defaults();
}

export function getState() {
  return state;
}

export function save() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return;
    } catch (e) {
      // Fullt lagringsutrymme: släng de detaljerade analyserna för de äldsta partierna
      // (statistiken finns kvar, partiet kan analyseras om vid behov).
      const withEvals = state.games.filter((g) => g.evals);
      if (!withEvals.length) return console.warn('Kunde inte spara', e);
      for (const g of withEvals.slice(0, Math.ceil(withEvals.length / 4))) delete g.evals;
    }
  }
}

export function update(fn) {
  fn(state);
  save();
}

const listeners = new Set();
export function onAchievement(fn) {
  listeners.add(fn);
}

export function unlock(id) {
  if (state.achievements[id]) return false;
  state.achievements[id] = Date.now();
  save();
  for (const fn of listeners) fn(id);
  return true;
}

export function resetAll() {
  state = defaults();
  save();
}
