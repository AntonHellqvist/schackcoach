// Partibiblioteket: alla dina partier (Chess.com + mot bottar), oavsett om de är analyserade.
// Sparas under en egen nyckel så att huvudstatet hålls litet.

import { toChesscomGame } from './chesscom.js';
import { getState } from './store.js';

const KEY = 'schackcoach-library-v1';
const SYNC_INTERVAL = 5 * 60 * 1000;

let lib;
try {
  lib = JSON.parse(localStorage.getItem(KEY)) || null;
} catch {
  lib = null;
}
if (!lib) lib = { games: [], completeArchives: {}, lastSync: 0, user: '' };

const listeners = new Set();
export const onLibraryChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (info) => listeners.forEach((fn) => fn(info));

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lib));
  } catch (e) {
    console.warn('Kunde inte spara biblioteket', e);
  }
}

export function libraryGames() {
  return [...lib.games].sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
}

export function getLibraryGame(id) {
  return lib.games.find((g) => g.id === id);
}

export function lastSync() {
  return lib.lastSync;
}

/** Lägger till (eller ersätter) ett parti. Returnerar true om det var nytt. */
export function addGame(game) {
  const i = lib.games.findIndex((g) => g.id === game.id);
  if (i >= 0) lib.games[i] = { ...lib.games[i], ...game };
  else lib.games.push(game);
  save();
  emit({ added: i < 0 ? [game] : [] });
  return i < 0;
}

/** Egna partier (mot bottar / inklistrade) – de som inte kan hämtas om från Chess.com. */
export function ownGames() {
  return lib.games.filter((g) => g.source !== 'chesscom');
}

/** Lägger till partier från en annan enhet (befintliga partier behålls). */
export function mergeGames(games) {
  const known = new Set(lib.games.map((g) => g.id));
  const added = games.filter((g) => g?.id && g.pgn && !known.has(g.id));
  if (!added.length) return 0;
  lib.games.push(...added);
  save();
  emit({ added, fromSync: true });
  return added.length;
}

let syncing = null;

/**
 * Hämtar nya partier från Chess.com. Avslutade månader hämtas bara en gång,
 * innevarande månad hämtas om varje gång.
 */
export function syncChesscom({ force = false } = {}) {
  const user = (getState().settings.chesscomUser || '').trim().toLowerCase();
  if (!user) return Promise.resolve({ added: [] });
  if (syncing) return syncing;
  if (!force && lib.user === user && Date.now() - lib.lastSync < SYNC_INTERVAL) return Promise.resolve({ added: [] });

  syncing = (async () => {
    if (lib.user !== user) {
      // nytt konto: släng gamla Chess.com-partier
      lib.games = lib.games.filter((g) => g.source !== 'chesscom');
      lib.completeArchives = {};
      lib.user = user;
    }
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
    if (res.status === 404) throw new Error('Hittade ingen spelare med namnet ' + user);
    if (!res.ok) throw new Error('Chess.com svarade med fel ' + res.status);
    const { archives = [] } = await res.json();
    const hadAny = lib.games.some((g) => g.source === 'chesscom');
    const known = new Set(lib.games.map((g) => g.id));
    const added = [];
    for (let i = 0; i < archives.length; i++) {
      const url = archives[i];
      const isCurrent = i === archives.length - 1;
      if (lib.completeArchives[url] && !isCurrent) continue;
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      for (const raw of data.games || []) {
        if (raw.rules !== 'chess' || !raw.pgn) continue;
        const g = toChesscomGame(raw, user);
        if (known.has(g.id)) continue;
        known.add(g.id);
        lib.games.push(g);
        added.push(g);
      }
      if (!isCurrent) lib.completeArchives[url] = true;
    }
    lib.lastSync = Date.now();
    save();
    const info = { added, firstSync: !hadAny };
    if (added.length) emit(info);
    return info;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
