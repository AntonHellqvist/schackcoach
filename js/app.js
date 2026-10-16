import { onAchievement, getState } from './store.js';
import { ACHIEVEMENTS } from './achievements.js';
import { syncChesscom } from './library.js';
import { enqueue, onQueueChange } from './analyzer.js';
import { startAutoSync, onSyncStatus, syncConfig } from './sync.js';

const routes = {
  '': () => import('./views/home.js'),
  traning: () => import('./views/training.js'),
  spela: () => import('./views/play.js'),
  analys: () => import('./views/review.js'),
  pussel: () => import('./views/puzzles.js'),
  utmaningar: () => import('./views/challenges.js'),
  oppningar: () => import('./views/openings.js'),
  matter: () => import('./views/mates.js'),
  utveckling: () => import('./views/progress.js'),
  installningar: () => import('./views/settings.js'),
};

const view = document.getElementById('view');
let cleanup = null;
let token = 0;

async function route() {
  const [name, ...params] = location.hash.replace(/^#\/?/, '').split('/');
  const load = routes[name] || routes[''];
  const my = ++token;
  if (cleanup) {
    try { cleanup(); } catch (e) { console.error(e); }
    cleanup = null;
  }
  document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === (routes[name] ? name : '')));
  const inMore = !!document.querySelector('#more-sheet [data-route].active');
  document.getElementById('more-btn').classList.toggle('active', inMore);
  document.getElementById('more-sheet').classList.add('hidden');
  view.innerHTML = '<div class="row muted"><span class="spinner"></span> Laddar…</div>';
  const mod = await load();
  if (my !== token) return;
  view.innerHTML = '';
  cleanup = (await mod.mount(view, params.map(decodeURIComponent))) || null;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

// "Mer"-menyn på mobil
const sheet = document.getElementById('more-sheet');
document.getElementById('more-btn').addEventListener('click', () => sheet.classList.toggle('hidden'));
sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('a')) sheet.classList.add('hidden'); });
route();

export function toast(html, ms = 4000) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), ms);
}

onAchievement((id) => {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (a) toast(`<b>${a.icon} Utmaning klar!</b><br>${a.title}`, 5000);
});


// ---------- Notis om GitHub-nyckeln ----------

const banner = document.getElementById('banner');
const DISMISS_KEY = 'schackcoach-banner-dismissed';
const dismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY); } catch { return null; } };

function renderBanner() {
  const cfg = syncConfig();
  const daysLeft = cfg.expires ? Math.ceil((cfg.expires - Date.now()) / 864e5) : null;
  let kind = null, html = '';
  if (cfg.enabled && cfg.expired) {
    kind = 'expired';
    html = '<b>⚠️ Synken har stannat</b> – din GitHub-nyckel har gått ut. <a href="#/installningar">Skapa en ny →</a>';
  } else if (cfg.enabled && daysLeft !== null && daysLeft <= 7) {
    kind = 'soon-' + daysLeft;
    html = `<b>🔑 Din GitHub-nyckel går ut ${daysLeft <= 0 ? 'idag' : daysLeft === 1 ? 'i morgon' : `om ${daysLeft} dagar`}</b> – sedan stannar synken. <a href="#/installningar">Byt nyckel →</a>`;
  }
  const show = kind && dismissed() !== kind && !location.hash.startsWith('#/installningar');
  banner.classList.toggle('hidden', !show);
  banner.classList.toggle('bad', kind === 'expired');
  if (!show) return;
  banner.innerHTML = `<span>${html}</span><button type="button" class="ghost" aria-label="Dölj">✕</button>`;
  banner.querySelector('button').onclick = () => {
    try { sessionStorage.setItem(DISMISS_KEY, kind); } catch { /* ignorera */ }
    renderBanner();
  };
}
onSyncStatus(renderBanner);
window.addEventListener('hashchange', renderBanner);

// ---------- Chess.com-synk och bakgrundsanalys ----------

async function sync(force = false) {
  try {
    const { added, firstSync } = await syncChesscom({ force });
    if (!added.length) return;
    const newest = [...added].sort((a, b) => b.endTime - a.endTime);
    if (firstSync) {
      toast(`<b>🔗 ${added.length} partier hämtade från Chess.com</b><br>De 5 senaste analyseras nu i bakgrunden.`, 6000);
    } else {
      toast(`<b>♟ ${added.length} ${added.length === 1 ? 'nytt parti' : 'nya partier'} från Chess.com</b><br>${getState().settings.autoAnalyse !== false ? 'Analyseras i bakgrunden.' : ''}`, 6000);
    }
    if (getState().settings.autoAnalyse !== false) enqueue(firstSync ? newest.slice(0, 5) : newest);
  } catch (e) {
    console.warn('Synk misslyckades', e);
  }
}
startAutoSync();
window.addEventListener('focus', () => sync());
setInterval(() => sync(), 5 * 60 * 1000);
sync();

const bg = document.getElementById('bg-status');
onQueueChange(({ current, queued, progress }) => {
  bg.classList.toggle('hidden', !current && !queued);
  if (!current && !queued) return;
  bg.innerHTML = `<span>⚙️ Analyserar ${current ? `mot ${current.opponent || '…'}` : '…'}${queued ? ` (+${queued} i kö)` : ''}</span>
    <div class="progress"><div style="width:${Math.round(progress * 100)}%"></div></div>`;
});
