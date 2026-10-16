// Synk mellan enheter via en hemlig GitHub Gist i ditt eget GitHub-konto.
// Varje enhet slår ihop sina framsteg med det som finns i gisten, så inget går förlorat
// även om du har tränat på flera enheter utan internet.

import { getState, replaceState, onStateChange } from './store.js';
import { ownGames, mergeGames, onLibraryChange } from './library.js';

const KEY = 'schackcoach-sync'; // { token, gistId, login, lastSync, expires, expired } – synkas aldrig
const FILE = 'schackcoach-sync.json';
const API = 'https://api.github.com';

let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { cfg = {}; }
const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* ignorera */ } };

const listeners = new Set();
const EXPIRED_MSG = 'Din GitHub-nyckel har gått ut, så synken har stannat. Skapa en ny nyckel och klistra in den här.';
let status = cfg.expired ? { state: 'expired', message: EXPIRED_MSG } : { state: cfg.token ? 'idle' : 'off', message: '' };
export const onSyncStatus = (fn) => { listeners.add(fn); fn(status); return () => listeners.delete(fn); };
const setStatus = (state, message = '') => { status = { state, message, lastSync: cfg.lastSync, login: cfg.login }; listeners.forEach((fn) => fn(status)); };

export const syncConfig = () => ({ enabled: !!cfg.token, login: cfg.login, lastSync: cfg.lastSync, expires: cfg.expires || null, expired: !!cfg.expired });

class ExpiredError extends Error {}

/** Sparar nyckelns utgångsdatum om GitHub skickar med det (bara nycklar med ett slutdatum har ett). */
function readExpiry(res) {
  // Formatet är t.ex. "2026-01-15 12:00:00 UTC" eller "2026-01-15 12:00:00 +0100".
  const m = (res.headers.get('github-authentication-token-expiration') || '').match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ?(UTC|[+-]\d\d:?\d\d)?/);
  if (!m) return;
  const zone = !m[3] || m[3] === 'UTC' ? 'Z' : m[3].replace(/(\d\d)(\d\d)$/, '$1:$2');
  const t = Date.parse(`${m[1]}T${m[2]}${zone}`);
  if (!Number.isNaN(t) && t !== cfg.expires) { cfg.expires = t; saveCfg(); }
}

/** Nyckeln fungerar inte längre: markera synken som stoppad tills en ny nyckel kopplas. */
function markExpired() {
  cfg.expired = true;
  saveCfg();
  setStatus('expired', EXPIRED_MSG);
}

async function gh(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (res.status === 401) throw new ExpiredError(EXPIRED_MSG);
  readExpiry(res);
  if (!res.ok) throw new Error(`GitHub svarade ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- data

/** Det som synkas: allt utom detaljanalyser (evals) och pågående parti. */
function payload() {
  const s = getState();
  const rest = { ...s };
  delete rest.current;
  return {
    v: 1,
    state: { ...rest, games: s.games.map((g) => { const c = { ...g }; delete c.evals; return c; }) },
    ownGames: ownGames(),
  };
}

const max = (a, b) => Math.max(a || 0, b || 0);

function mergeById(a = [], b = [], pick) {
  const map = new Map(a.map((x) => [x.id, x]));
  for (const y of b) {
    const x = map.get(y.id);
    map.set(y.id, x ? pick(x, y) : y);
  }
  return [...map.values()];
}

/** Slår ihop lokala och fjärrdata utan att tappa framsteg från någon enhet. */
export function merge(local, remote) {
  if (!remote) return local;
  const out = { ...local };

  // Pussel: räknare = max, rating från den senaste händelsen, historik = union
  const lp = local.puzzle, rp = remote.puzzle || {};
  const hist = new Map();
  for (const h of [...(lp.history || []), ...(rp.history || [])]) hist.set(h.t, h);
  const history = [...hist.values()].sort((a, b) => a.t - b.t).slice(-500);
  const themes = { ...(rp.themes || {}) };
  for (const [t, v] of Object.entries(lp.themes || {})) themes[t] = { s: max(v.s, themes[t]?.s), f: max(v.f, themes[t]?.f) };
  const lastL = lp.history?.at(-1)?.t || 0, lastR = rp.history?.at(-1)?.t || 0;
  out.puzzle = {
    ...lp,
    rating: lastR > lastL ? rp.rating : lp.rating,
    streak: lastR > lastL ? rp.streak : lp.streak,
    solved: max(lp.solved, rp.solved),
    failed: max(lp.failed, rp.failed),
    history,
    themes,
  };

  // Analyser: union; behåll den lokala detaljanalysen (evals) om den finns
  out.games = mergeById(local.games, remote.games, (x, y) => {
    const newer = (y.analysedAt || 0) > (x.analysedAt || 0) ? y : x;
    return { ...newer, evals: x.evals || y.evals };
  }).sort((a, b) => (a.endTime || 0) - (b.endTime || 0));
  out.mistakes = mergeById(local.mistakes, remote.mistakes, (x, y) => ({ ...x, solved: x.solved || y.solved }));

  out.botResults = { ...(remote.botResults || {}) };
  for (const [id, r] of Object.entries(local.botResults || {})) {
    const o = out.botResults[id] || {};
    out.botResults[id] = { w: max(r.w, o.w), d: max(r.d, o.d), l: max(r.l, o.l) };
  }
  out.achievements = { ...(remote.achievements || {}) };
  for (const [id, t] of Object.entries(local.achievements || {})) out.achievements[id] = Math.min(t, out.achievements[id] || t);
  out.openings = { ...(remote.openings || {}) };
  for (const [id, o] of Object.entries(local.openings || {})) {
    const r = out.openings[id] || {};
    out.openings[id] = { practiced: max(o.practiced, r.practiced), perfect: !!(o.perfect || r.perfect) };
  }
  out.mates = { ...(remote.mates || {}), ...(local.mates || {}) };
  out.rushBest = max(local.rushBest, remote.rushBest);

  // Dagens träning: samma dag → slå ihop framstegen, annars den senaste dagen
  const ld = local.daily, rd = remote.daily;
  if (ld && rd && ld.date === rd.date) {
    const progress = { ...rd.progress };
    for (const [k, n] of Object.entries(ld.progress || {})) progress[k] = max(n, progress[k]);
    out.daily = { ...ld, progress, completed: !!(ld.completed || rd.completed) };
  } else if (rd && (!ld || rd.date > ld.date)) out.daily = rd;

  const ls = local.streak, rs = remote.streak;
  if (rs && (!ls || (rs.last || '') > (ls.last || '') || (rs.last === ls.last && rs.current > ls.current))) out.streak = { ...rs, best: max(rs.best, ls?.best) };
  else if (ls) out.streak = { ...ls, best: max(ls.best, rs?.best) };

  // Inställningar: Chess.com-namnet följer med om det saknas här
  out.settings = { ...(remote.settings || {}), ...local.settings };
  if (!local.settings?.chesscomUser && remote.settings?.chesscomUser) out.settings.chesscomUser = remote.settings.chesscomUser;
  return out;
}

// ---------------------------------------------------------------- synk

let busy = null;
let lastPushed = '';
let pushTimer = null;

async function findOrCreateGist() {
  if (cfg.gistId) return cfg.gistId;
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const found = list.find((g) => g.files && g.files[FILE]);
    if (found) return (cfg.gistId = found.id);
    if (list.length < 100) break;
  }
  const created = await gh('/gists', {
    method: 'POST',
    body: JSON.stringify({ description: 'Schackcoach – synkdata (ändra inte för hand)', public: false, files: { [FILE]: { content: JSON.stringify(payload()) } } }),
  });
  return (cfg.gistId = created.id);
}

async function readRemote() {
  const g = await gh(`/gists/${cfg.gistId}`);
  const f = g.files?.[FILE];
  if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  try { return { data: JSON.parse(text), text }; } catch { return { data: null, text }; }
}

/** Hämtar, slår ihop och skickar upp. */
export function syncNow() {
  if (!cfg.token || cfg.expired) return Promise.resolve();
  if (busy) return busy;
  busy = (async () => {
    setStatus('syncing', 'Synkar…');
    try {
      await findOrCreateGist();
      const remote = await readRemote();
      const data = remote?.data;
      if (data?.state) {
        const merged = merge(getState(), data.state);
        if (JSON.stringify(merged) !== JSON.stringify(getState())) replaceState(merged);
        if (data.ownGames) mergeGames(data.ownGames);
      }
      // Skicka upp om det sammanslagna skiljer sig från det som ligger i gisten.
      const content = JSON.stringify(payload());
      if (content !== remote?.text) await upload(content);
      lastPushed = content;
      cfg.lastSync = Date.now();
      saveCfg();
      setStatus('ok', 'Synkad');
    } catch (e) {
      if (e instanceof ExpiredError) markExpired();
      else setStatus('error', e.message);
    } finally {
      busy = null;
    }
  })();
  return busy;
}

async function upload(content) {
  await gh(`/gists/${cfg.gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) });
}

async function push() {
  const content = JSON.stringify(payload());
  if (content === lastPushed) return;
  await upload(content);
  lastPushed = content;
}

function schedulePush() {
  if (!cfg.token || !cfg.gistId || cfg.expired) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    if (busy) return schedulePush();
    try {
      await push();
      cfg.lastSync = Date.now();
      saveCfg();
      setStatus('ok', 'Synkad');
    } catch (e) {
      if (e instanceof ExpiredError) markExpired();
      else setStatus('error', e.message);
    }
  }, 4000);
}

/** Kopplar synken med en GitHub-nyckel (med behörigheten "gist"). */
export async function connect(token) {
  const prev = cfg;
  cfg = { token: token.trim() };
  setStatus('syncing', 'Kontrollerar nyckeln…');
  try {
    const res = await fetch(API + '/user', { headers: { Authorization: `Bearer ${cfg.token}` } });
    if (!res.ok) throw new Error('GitHub godkände inte nyckeln. Kontrollera att du kopierade hela.');
    readExpiry(res);
    const scopes = res.headers.get('x-oauth-scopes');
    if (scopes !== null && !scopes.split(',').map((x) => x.trim()).includes('gist')) {
      throw new Error('Nyckeln saknar behörigheten "gist". Skapa en ny och kryssa i "gist".');
    }
    cfg.login = (await res.json()).login;
    // Samma GitHub-konto: behåll gisten så att en ny nyckel tar vid där den gamla slutade.
    if (prev.gistId && prev.login === cfg.login) cfg.gistId = prev.gistId;
    saveCfg();
    await syncNow();
    if (status.state === 'error' || status.state === 'expired') throw new Error(status.message);
  } catch (e) {
    cfg = prev;
    saveCfg();
    if (cfg.expired) setStatus('expired', EXPIRED_MSG);
    else setStatus(cfg.token ? 'idle' : 'off', '');
    throw e;
  }
}

export function disconnect() {
  cfg = {};
  saveCfg();
  setStatus('off');
}

/** Startar automatisk synk: vid start, när fliken blir aktiv, varannan minut och strax efter varje ändring. */
export function startAutoSync() {
  onStateChange(schedulePush);
  onLibraryChange((info) => { if (!info?.fromSync) schedulePush(); });
  window.addEventListener('focus', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => syncNow(), 2 * 60 * 1000);
  syncNow();
}
