import { Chess } from '../../vendor/chess.js';
import { Board, uciToMove } from '../board.js';
import { Engine, sharedEngine, toWhiteCp, winProb, formatWhiteCp } from '../engine.js';
import { analysePositions, classifyMoves, accuracy, countClasses, CLASSES, CLASS_ORDER } from '../analysis.js';
import { getState, update } from '../store.js';
import { libraryGames, getLibraryGame, syncChesscom, lastSync, onLibraryChange } from '../library.js';
import {
  BOOK, DEPTH, getAnalysis, parseGame, saveAnalysis, enqueue, dequeue, clearQueue, queueStatus, onQueueChange, pauseBackground,
} from '../analyzer.js';
import { play as playSound, playMove } from '../sound.js';

export function mount(view, [param]) {
  let cleanup = null;

  if (param === 'senaste') {
    try {
      const meta = JSON.parse(localStorage.getItem('schackcoach-review'));
      if (meta) cleanup = openGame(view, { ...meta, id: meta.id || 'pgn-' + hash(meta.pgn) });
    } catch { /* ignore */ }
  } else if (param && param.startsWith('g:')) {
    const id = param.slice(2);
    const g = getLibraryGame(id) || getState().games.find((x) => x.id === id && x.pgn);
    if (g) cleanup = openGame(view, g);
  }
  if (!cleanup) cleanup = showLibrary(view);
  return () => cleanup?.();
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const PAGE = 40;

// ---------------------------------------------------------------- partibiblioteket

function showLibrary(view) {
  const st = getState();
  const filter = { source: 'all', time: 'all', result: 'all', ...(st.libraryFilter || {}) };
  let shown = PAGE;

  view.innerHTML = `
    <h1>Mina partier</h1>
    <p class="muted">Dina partier från Chess.com och mot bottarna i appen. Nya partier hämtas automatiskt.</p>
    <div class="card">
      <div class="row">
        <label for="user">Chess.com</label>
        <input id="user" placeholder="Användarnamn" value="${st.settings.chesscomUser || ''}" autocomplete="off" style="width:180px">
        <button class="primary" id="sync">↻ Synka nu</button>
        <span class="muted small" id="syncinfo"></span>
      </div>
      <label class="row small" style="margin-top:10px;font-weight:500;cursor:pointer">
        <input type="checkbox" id="auto" ${st.settings.autoAnalyse !== false ? 'checked' : ''}> Analysera nya partier automatiskt i bakgrunden
      </label>
    </div>
    <div class="row" style="margin:14px 0">
      <div class="tabs" id="source">
        <button data-v="all">Alla</button><button data-v="chesscom">Chess.com</button><button data-v="bot">Mot bottar</button><button data-v="pgn">Inklistrade</button>
      </div>
      <select id="time"><option value="all">Alla tidskontroller</option><option>Bullet</option><option>Blitz</option><option>Rapid</option><option>Korrespondens</option><option>Mot bot</option><option>Utmaning</option></select>
      <select id="result"><option value="all">Alla resultat</option><option value="win">Vinster</option><option value="loss">Förluster</option><option value="draw">Remier</option></select>
      <span class="spacer"></span>
      <button id="batch"></button>
      <button id="stopq" class="ghost hidden">Töm kön</button>
    </div>
    <div class="card" id="list"></div>
    <details class="card" style="margin-top:14px">
      <summary style="cursor:pointer;font-weight:600">📋 Klistra in ett parti (PGN)</summary>
      <div id="pgnpane" style="margin-top:12px"></div>
    </details>`;

  const $ = (s) => view.querySelector(s);
  $('#time').value = filter.time;
  $('#result').value = filter.result;

  const saveFilter = () => update((s) => { s.libraryFilter = { ...filter }; });

  function filtered() {
    return libraryGames().filter((g) =>
      (filter.source === 'all' || g.source === filter.source) &&
      (filter.time === 'all' || g.timeClass === filter.time) &&
      (filter.result === 'all' || g.outcome === filter.result));
  }

  function renderSyncInfo(text) {
    const n = libraryGames().filter((g) => g.source === 'chesscom').length;
    const t = lastSync();
    $('#syncinfo').innerHTML = text ?? (t ? `${n} partier · synkad ${new Date(t).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : '');
  }

  function pill(g, q) {
    const a = getAnalysis(g.id);
    if (a) {
      const blunders = a.counts?.blunder || 0;
      return `<span class="pill ok">${a.accuracy ?? '–'} %</span>${blunders ? `<span class="pill" title="Blunders">${blunders} ??</span>` : ''}`;
    }
    if (q.current?.id === g.id) return `<span class="pill warn"><span class="spinner" style="width:10px;height:10px"></span> ${Math.round(q.progress * 100)} %</span>`;
    if (q.ids.has(g.id)) return '<span class="pill">I kö</span>';
    return '<span class="pill">Ej analyserad</span>';
  }

  function renderList() {
    const q = queueStatus();
    const games = filtered();
    const unanalysed = games.filter((g) => !getAnalysis(g.id) && !q.ids.has(g.id));
    $('#source').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === filter.source));
    $('#batch').textContent = `⚙️ Analysera alla oanalyserade (${unanalysed.length})`;
    $('#batch').disabled = !unanalysed.length;
    $('#stopq').classList.toggle('hidden', !q.queued);

    const list = $('#list');
    if (!games.length) {
      list.innerHTML = `<p class="muted">${libraryGames().length ? 'Inga partier matchar filtret.' :
        'Inga partier än. Skriv in ditt Chess.com-namn och tryck på Synka – eller <a href="#/spela">spela mot en bot</a>.'}</p>`;
      return;
    }
    let html = '';
    let month = '';
    for (const g of games.slice(0, shown)) {
      const d = new Date(g.endTime || 0);
      const m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (m !== month) {
        month = m;
        html += `<div class="muted small" style="padding:10px 10px 4px;font-weight:700;text-transform:capitalize">${m}</div>`;
      }
      html += `<a class="list-item" href="#/analys/g:${encodeURIComponent(g.id)}" style="color:inherit;text-decoration:none">
        <span class="result ${g.outcome}">${g.outcome === 'win' ? 'V' : g.outcome === 'loss' ? 'F' : 'R'}</span>
        <span title="${g.userColor === 'w' ? 'Du spelade vit' : 'Du spelade svart'}">${g.userColor === 'w' ? '♔' : '♚'}</span>
        <span style="flex:1;min-width:0">
          <b>${g.opponent || '?'}</b>${g.opponentRating ? ` <span class="muted">(${g.opponentRating})</span>` : ''}<br>
          <span class="muted small">${g.source === 'bot' ? '🤖 ' : ''}${g.timeClass || ''} · ${g.date || ''}${g.opening ? ' · ' + g.opening : ''}</span>
        </span>
        <span class="row" style="gap:4px">${pill(g, q)}</span>
      </a>`;
    }
    if (games.length > shown) html += `<div class="row" style="justify-content:center;margin-top:8px"><button id="more">Visa fler (${games.length - shown} kvar)</button></div>`;
    list.innerHTML = html;
    $('#more')?.addEventListener('click', () => { shown += PAGE; renderList(); });
  }

  async function doSync(force) {
    const user = $('#user').value.trim();
    if (user !== getState().settings.chesscomUser) update((s) => { s.settings.chesscomUser = user; });
    if (!user) return renderSyncInfo('');
    renderSyncInfo('<span class="spinner" style="width:12px;height:12px"></span> Hämtar partier…');
    $('#sync').disabled = true;
    try {
      const { added, firstSync } = await syncChesscom({ force });
      renderSyncInfo();
      if (added.length && getState().settings.autoAnalyse !== false) {
        const newest = [...added].sort((a, b) => b.endTime - a.endTime);
        enqueue(firstSync ? newest.slice(0, 5) : newest);
      }
    } catch (e) {
      renderSyncInfo(`<span style="color:var(--danger)">${e.message}</span>`);
    }
    $('#sync').disabled = false;
    renderList();
  }

  $('#sync').onclick = () => doSync(true);
  $('#user').onkeydown = (e) => { if (e.key === 'Enter') doSync(true); };
  $('#auto').onchange = (e) => update((s) => { s.settings.autoAnalyse = e.target.checked; });
  $('#source').onclick = (e) => {
    const v = e.target.closest('button')?.dataset.v;
    if (!v) return;
    filter.source = v; shown = PAGE; saveFilter(); renderList();
  };
  $('#time').onchange = (e) => { filter.time = e.target.value; shown = PAGE; saveFilter(); renderList(); };
  $('#result').onchange = (e) => { filter.result = e.target.value; shown = PAGE; saveFilter(); renderList(); };
  $('#batch').onclick = () => {
    const q = queueStatus();
    const todo = filtered().filter((g) => !getAnalysis(g.id) && !q.ids.has(g.id));
    if (todo.length > 20 && !confirm(`Analysera ${todo.length} partier? Det tar ungefär ${Math.ceil(todo.length * 20 / 60)} minuter, men du kan använda appen som vanligt under tiden.`)) return;
    enqueue(todo);
  };
  $('#stopq').onclick = () => clearQueue();
  showPgn($('#pgnpane'));

  const offQ = onQueueChange(() => renderList());
  const offL = onLibraryChange(() => { renderSyncInfo(); renderList(); });
  renderSyncInfo();
  renderList();
  doSync(false);
  return () => { offQ(); offL(); };
}

function showPgn(pane) {
  pane.innerHTML = `
    <p class="muted small">Klistra in ett parti i PGN-format (finns under "Dela" / "Ladda ner" på de flesta schacksajter).</p>
    <textarea id="pgn" placeholder="1. e4 e5 2. Nf3 Nc6 ..."></textarea>
    <div class="row" style="margin-top:10px">
      <label>Jag spelade</label>
      <select id="color"><option value="w">Vit</option><option value="b">Svart</option></select>
      <button class="primary" id="go">Analysera</button>
    </div>
    <div id="err"></div>`;
  pane.querySelector('#go').onclick = () => {
    const pgn = pane.querySelector('#pgn').value.trim();
    const c = new Chess();
    try {
      c.loadPgn(pgn);
      if (!c.history().length) throw new Error('Inga drag hittades');
    } catch (e) {
      pane.querySelector('#err').innerHTML = `<div class="feedback bad" style="margin-top:10px">Kunde inte läsa PGN: ${e.message}</div>`;
      return;
    }
    localStorage.setItem('schackcoach-review', JSON.stringify({
      pgn, userColor: pane.querySelector('#color').value, source: 'pgn', id: 'pgn-' + hash(pgn), timeClass: 'PGN',
    }));
    location.hash = '#/analys/senaste';
  };
}

// ---------------------------------------------------------------- analys av ett parti

function openGame(view, meta) {
  let parsed;
  try {
    parsed = parseGame(meta.pgn);
  } catch (e) {
    view.innerHTML = `<div class="feedback bad">Kunde inte läsa partiet: ${e.message}</div>`;
    return () => {};
  }
  const { headers, moves, fens } = parsed;
  const userColor = meta.userColor || 'w';

  let cancelled = false;
  let engine = null;
  let reviewCleanup = null;
  let resume = null;
  let offQ = null;

  const saved = getAnalysis(meta.id);
  if (saved?.evals?.length === fens.length) {
    reviewCleanup = showReview(view, { meta: saved, moves, fens, evals: saved.evals, headers, userColor });
  } else if (queueStatus().current?.id === meta.id) {
    waitForBackground();
  } else {
    runAnalysis();
  }

  function progressScreen() {
    view.innerHTML = `
      <h1>Analyserar partiet…</h1>
      <div class="layout">
        <div class="board-col"><div id="board"></div></div>
        <div class="side"><div class="card">
          <p>Stockfish går igenom varje drag. Det tar en liten stund.</p>
          <div class="progress"><div id="bar" style="width:0%"></div></div>
          <p class="muted small" id="ptext" style="margin-top:8px">0 / ${fens.length}</p>
          <a class="btn" href="#/analys">Tillbaka</a>
        </div></div>
      </div>`;
    const board = new Board(view.querySelector('#board'), { orientation: userColor });
    const setProgress = (n) => {
      view.querySelector('#bar').style.width = (n / fens.length) * 100 + '%';
      view.querySelector('#ptext').textContent = `${n} / ${fens.length} ställningar`;
      const mv = moves[n - 1];
      board.set(fens[Math.min(n, fens.length - 1)], { lastMove: mv ? { from: mv.from, to: mv.to } : null });
    };
    return { board, setProgress };
  }

  function waitForBackground() {
    const { board, setProgress } = progressScreen();
    offQ = onQueueChange((q) => {
      if (q.current?.id === meta.id) return setProgress(Math.round(q.progress * fens.length));
      offQ();
      offQ = null;
      board.destroy();
      const a = getAnalysis(meta.id);
      if (a?.evals) reviewCleanup = showReview(view, { meta: a, moves, fens, evals: a.evals, headers, userColor });
      else runAnalysis();
    });
  }

  async function runAnalysis() {
    dequeue(meta.id);
    resume = pauseBackground();
    const { board, setProgress } = progressScreen();
    engine = new Engine();
    const evals = await analysePositions(engine, fens, {
      depth: DEPTH,
      isCancelled: () => cancelled,
      onProgress: (n) => { if (!cancelled) setProgress(n); },
    });
    engine.terminate();
    engine = null;
    resume();
    board.destroy();
    if (!evals || cancelled) return;
    const entry = saveAnalysis(meta, moves, evals, headers, userColor);
    reviewCleanup = showReview(view, { meta: entry, moves, fens, evals, headers, userColor });
  }

  return () => {
    cancelled = true;
    engine?.terminate();
    resume?.();
    offQ?.();
    reviewCleanup?.();
  };
}

function praise(acc) {
  if (acc == null) return '';
  if (acc >= 90) return 'Fantastiskt parti! Nästan felfritt. 🌟';
  if (acc >= 80) return 'Riktigt bra spelat! 💪';
  if (acc >= 70) return 'Bra parti – några missar att lära sig av.';
  if (acc >= 55) return 'Stabilt kämpat. Titta på nyckelögonblicken nedan.';
  return 'Ett lärorikt parti – här finns mycket att vinna på att gå igenom!';
}

function showReview(view, { meta, moves, fens, evals, headers, userColor }) {
  const classified = classifyMoves(moves, evals, BOOK);
  const accW = accuracy(classified, 'w');
  const accB = accuracy(classified, 'b');
  const cW = countClasses(classified, 'w');
  const cB = countClasses(classified, 'b');
  const userAcc = userColor === 'w' ? accW : accB;
  const key = classified.filter((m) => m.color === userColor && (m.cls === 'blunder' || m.cls === 'mistake'));
  const nice = classified.filter((m) => m.color === userColor && (m.cls === 'brilliant' || m.cls === 'great'));
  let cur = 0;
  let showBest = true;
  // "Försök igen": vid dina misstag får du först leta efter ett bättre drag själv.
  let retry = getState().settings.retryMistakes !== false;
  const done = new Set(); // drag (ply) där du hittat svaret eller valt att se det
  let found = null; // { ply, san, best } – senast hittade drag
  let tries = 0;
  let destroyed = false;
  const isRetry = (cm) => retry && cm && cm.color === userColor && (cm.cls === 'mistake' || cm.cls === 'blunder') && cm.bestUci && !done.has(cm.i + 1);

  view.innerHTML = `
    <div class="row" style="margin-bottom:10px">
      <a class="btn" href="#/analys">← Alla partier</a>
      <h1 style="margin:0 0 0 6px;font-size:1.3rem">${headers.White || 'Vit'} – ${headers.Black || 'Svart'}</h1>
      <span class="pill">${headers.Result || ''}</span>
      ${meta.opening ? `<span class="pill">${meta.opening}</span>` : ''}
    </div>
    <div class="layout">
      <div class="board-col">
        <div class="board-wrap">
          <div class="evalbar" id="evalbar"><div class="white"></div><span class="label"></span></div>
          <div class="board-holder" id="board"></div>
        </div>
        <div class="row" style="justify-content:center">
          <button class="icon" id="first" title="Början">⏮</button>
          <button class="icon" id="prev" title="Föregående (←)">◀</button>
          <button class="icon" id="next" title="Nästa (→)">▶</button>
          <button class="icon" id="last" title="Slutet">⏭</button>
          <button class="icon" id="flip" title="Vänd brädet">⇅</button>
          <button id="toggleBest" title="Visa/dölj bästa drag">Visa bästa drag: på</button>
          <button id="toggleRetry" title="Försök hitta ett bättre drag själv innan svaret visas"></button>
        </div>
        <div class="card chart" id="graph"></div>
      </div>
      <div class="side">
        <div class="card">
          <div class="feedback info"><b>Coach:</b> ${praise(userAcc)}</div>
          <table class="summary-table" style="margin-top:12px">
            <tr><td>${userColor === 'w' ? 'Du' : ''}<br><span class="accuracy">${accW ?? '–'}</span></td>
                <td class="muted" style="text-align:center">Träffsäkerhet</td>
                <td>${userColor === 'b' ? 'Du' : ''}<br><span class="accuracy">${accB ?? '–'}</span></td></tr>
            ${CLASS_ORDER.map((k) => `<tr><td>${cW[k]}</td><td><span class="row" style="gap:6px"><span class="cls cls-${k}">${CLASSES[k].sym}</span>${CLASSES[k].name}</span></td><td>${cB[k]}</td></tr>`).join('')}
          </table>
        </div>
        <div class="card">
          <h3>Det här draget</h3>
          <div id="coach" class="feedback"></div>
          <div id="line" class="muted small" style="margin-top:8px"></div>
          <div id="retrybtns" class="row hidden" style="margin-top:12px">
            <button id="rhint">💡 Tips</button>
            <button id="reveal">👁 Visa svaret</button>
            <button id="skip" class="ghost">Hoppa över →</button>
          </div>
        </div>
        ${key.length || nice.length ? `<div class="card"><h3>Nyckelögonblick</h3><div class="row" id="keys">
          ${[...nice, ...key].sort((a, b) => a.i - b.i).map((m) => `<button data-ply="${m.i + 1}"><span class="cls cls-${m.cls}">${CLASSES[m.cls].sym}</span>${Math.floor(m.i / 2) + 1}${m.color === 'w' ? '.' : '…'} ${m.san}</button>`).join('')}
          </div>${key.length ? `<p class="small muted" style="margin-top:10px">Dina misstag har sparats som träningspussel.</p>
          <a class="btn" href="#/pussel/mistakes">🔁 Träna på dina misstag</a>` : ''}</div>` : ''}
        <div class="card">
          <h3>Drag</h3>
          <div class="moves" id="moves"></div>
        </div>
      </div>
    </div>`;

  const $ = (s) => view.querySelector(s);
  const board = new Board($('#board'), { orientation: userColor, onMove: (m) => tryMove(m) });

  // drag-lista
  let mhtml = '';
  const startBlack = moves[0]?.color === 'b';
  const list = startBlack ? [null, ...classified] : classified;
  const firstNo = parseInt((moves[0]?.before || '').split(' ')[5], 10) || 1;
  for (let i = 0; i < list.length; i += 2) {
    mhtml += `<div class="num">${firstNo + i / 2}.</div>`;
    for (const m of [list[i], list[i + 1]]) {
      mhtml += m ? `<div class="mv" data-ply="${m.i + 1}"><span class="cls cls-${m.cls}">${CLASSES[m.cls].sym}</span>${m.san}</div>` : '<div></div>';
    }
  }
  $('#moves').innerHTML = mhtml;
  $('#moves').onclick = (e) => { const p = e.target.closest('[data-ply]'); if (p) go(+p.dataset.ply); };
  $('#keys')?.addEventListener('click', (e) => { const p = e.target.closest('[data-ply]'); if (p) go(+p.dataset.ply); });

  function renderGraph() {
    const W = 600, H = 120, n = evals.length - 1 || 1;
    const pts = evals.map((e, i) => [(i / n) * W, (1 - winProb(e.cp)) * H]);
    const line = pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
    let dots = '';
    for (const m of classified) {
      if (m.cls !== 'blunder' && m.cls !== 'mistake' && m.cls !== 'brilliant') continue;
      const [x, y] = pts[m.i + 1];
      dots += `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--c-${m.cls})" stroke="#000" stroke-width="1"/>`;
    }
    const cx = (cur / n) * W;
    $('#graph').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:120px;cursor:pointer;border-radius:6px">
      <rect width="${W}" height="${H}" fill="#403d39"/>
      <polygon points="0,${H} ${line} ${W},${H}" fill="#f1f1f1"/>
      <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#888" stroke-dasharray="4 4" stroke-width="1"/>
      <line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="var(--accent)" stroke-width="2"/>
      ${dots}</svg>`;
    $('#graph svg').onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      go(Math.round(((e.clientX - r.left) / r.width) * n));
    };
  }

  function go(ply) {
    const next = Math.max(0, Math.min(fens.length - 1, ply));
    // Dragljud när man stegar framåt ett drag i taget (inte när ett misstag ska försökas igen).
    if (next === cur + 1 && !isRetry(classified[next - 1])) playMove(moves[next - 1], new Chess(fens[next]));
    cur = next;
    tries = 0;
    render();
  }

  function renderEval(cp) {
    const wp = winProb(cp);
    const bar = $('#evalbar');
    const white = bar.querySelector('.white');
    const flipped = board.orientation === 'b';
    white.style.height = wp * 100 + '%';
    white.style.top = flipped ? '0' : 'auto';
    white.style.bottom = flipped ? 'auto' : '0';
    const label = bar.querySelector('.label');
    label.textContent = formatWhiteCp(cp).replace('+', '');
    const whiteAhead = cp >= 0;
    label.style.color = whiteAhead ? '#333' : '#eee';
    const atBottom = whiteAhead !== flipped;
    label.style.top = atBottom ? 'auto' : '4px';
    label.style.bottom = atBottom ? '4px' : 'auto';
  }

  function markCurrent() {
    view.querySelectorAll('#moves .mv').forEach((el) => el.classList.toggle('current', +el.dataset.ply === cur));
    view.querySelector('#moves .mv.current')?.scrollIntoView({ block: 'nearest' });
    renderGraph();
  }

  /** Ställningen före ditt misstag: hitta ett bättre drag själv. */
  function renderRetry(cm) {
    const prev = moves[cur - 2];
    board.set(fens[cur - 1], { lastMove: prev ? { from: prev.from, to: prev.to } : null });
    board.setBadge(null);
    board.setArrows([]);
    board.setMarks({});
    board.setMovable(userColor);
    renderEval(evals[cur - 1].cp);
    const coach = $('#coach');
    coach.className = 'feedback warn';
    coach.innerHTML = `<div class="row" style="gap:8px;margin-bottom:4px"><span class="cls cls-${cm.cls}">${CLASSES[cm.cls].sym}</span>
      <b>Försök igen!</b></div>
      I partiet spelade du <b>${Math.floor(cm.i / 2) + 1}${cm.color === 'w' ? '.' : '…'} ${cm.san}</b> här – ${cm.cls === 'blunder' ? 'en blunder' : 'ett misstag'}.
      Hitta ett bättre drag på brädet.`;
    $('#line').innerHTML = '';
    $('#retrybtns').classList.remove('hidden');
    $('#reveal').classList.toggle('primary', tries >= 3);
    markCurrent();
  }

  /** Bedömer ditt försök: lika bra som motorns bästa drag (högst 5 % sämre vinstchans) räknas som rätt. */
  async function tryMove(m) {
    const ply = cur;
    const cm = classified[ply - 1];
    if (!isRetry(cm)) return;
    const fen = fens[ply - 1];
    const c = new Chess(fen);
    let mv;
    try { mv = c.move(m); } catch { return; }
    playMove(mv, c);
    board.set(c.fen(), { lastMove: { from: mv.from, to: mv.to } });
    board.setMovable(null);
    board.setMarks({});
    $('#line').innerHTML = '<span class="spinner"></span> Coachen tittar på draget…';

    const e0 = evals[ply - 1];
    const sign = userColor === 'w' ? 1 : -1;
    const uci = mv.from + mv.to + (mv.promotion || '');
    let cpAfter;
    const alt = e0.alts?.find((a) => a[0] === uci);
    if (uci === e0.best) cpAfter = e0.cp;
    else if (alt) cpAfter = alt[1];
    else if (c.isCheckmate()) cpAfter = sign * 10000;
    else if (c.isGameOver()) cpAfter = 0;
    else {
      const r = await sharedEngine().analyse(c.fen(), { depth: 12 });
      cpAfter = r.lines[0] ? toWhiteCp(r.lines[0].score, c.turn()) : e0.cp;
    }
    if (destroyed || cur !== ply) return;
    const loss = winProb(sign * e0.cp) - winProb(sign * cpAfter);

    if (loss < 0.05) {
      done.add(ply);
      found = { ply, san: mv.san, best: uci === e0.best };
      playSound('correct');
      render();
      return;
    }
    tries++;
    playSound('wrong', 0.15);
    const better = loss < cm.loss - 0.03;
    $('#line').innerHTML = `<span style="color:var(--${better ? 'warn' : 'danger'})">${better
      ? `<b>${mv.san}</b> är bättre än i partiet, men det finns ett ännu starkare drag.`
      : `<b>${mv.san}</b> är inte heller så bra.`} Försök igen!</span>`;
    setTimeout(() => {
      if (destroyed || cur !== ply || done.has(ply)) return;
      const prev = moves[ply - 2];
      board.set(fen, { lastMove: prev ? { from: prev.from, to: prev.to } : null });
      board.setMovable(userColor);
      $('#reveal').classList.toggle('primary', tries >= 3);
    }, 900);
  }

  function render() {
    const mv = moves[cur - 1];
    const cm = classified[cur - 1];
    $('#toggleRetry').textContent = '🎯 Försök själv: ' + (retry ? 'på' : 'av');
    if (isRetry(cm)) return renderRetry(cm);
    $('#retrybtns').classList.add('hidden');
    board.setMovable(null);
    board.setMarks({});
    board.set(fens[cur], { lastMove: mv ? { from: mv.from, to: mv.to } : null });
    board.setBadge(cm ? { sq: mv.to, cls: cm.cls, sym: CLASSES[cm.cls].sym } : null);
    const arrows = [];
    if (showBest && cm && cm.bestUci && !['best', 'book', 'brilliant', 'great'].includes(cm.cls)) {
      const b = uciToMove(cm.bestUci);
      arrows.push({ from: b.from, to: b.to, color: 'green' });
    }
    board.setArrows(arrows);
    renderEval(evals[cur].cp);

    const coach = $('#coach');
    if (!cm) {
      coach.className = 'feedback info';
      coach.innerHTML = 'Startställningen. Använd pilarna (← →) eller klicka på ett drag.';
      $('#line').innerHTML = '';
    } else {
      const bad = ['inaccuracy', 'mistake', 'blunder'].includes(cm.cls);
      coach.className = 'feedback ' + (bad ? (cm.cls === 'inaccuracy' ? 'warn' : 'bad') : 'ok');
      const win = found?.ply === cur
        ? `<div class="feedback ok" style="margin-bottom:10px">✅ <b>Snyggt!</b> Du hittade <b>${found.san}</b>${found.best ? ' – motorns bästa drag.' : ' – lika starkt som motorns förslag.'}</div>` : '';
      coach.innerHTML = `${win}<div class="row" style="gap:8px;margin-bottom:4px"><span class="cls cls-${cm.cls}">${CLASSES[cm.cls].sym}</span>
        <b>${CLASSES[cm.cls].name}</b><span class="muted small">${cm.color === userColor ? 'ditt drag' : 'motståndarens drag'}</span></div>${cm.text}`;
      $('#line').innerHTML = bad && cm.pvSan.length ? `Bästa variant: ${cm.pvSan.join(' ')}` : '';
    }
    markCurrent();
  }

  $('#first').onclick = () => go(0);
  $('#prev').onclick = () => go(cur - 1);
  $('#next').onclick = () => go(cur + 1);
  $('#last').onclick = () => go(fens.length - 1);
  $('#flip').onclick = () => { board.flip(); render(); };
  $('#toggleRetry').onclick = () => {
    retry = !retry;
    update((s) => { s.settings.retryMistakes = retry; });
    render();
  };
  $('#rhint').onclick = () => {
    const cm = classified[cur - 1];
    if (!isRetry(cm)) return;
    board.setMarks({ [uciToMove(cm.bestUci).from]: 'hint' });
    $('#line').innerHTML = 'Tips: den markerade pjäsen har ett bra drag.';
  };
  $('#reveal').onclick = () => {
    done.add(cur);
    found = null;
    render();
  };
  $('#skip').onclick = () => go(cur + 1);
  $('#toggleBest').onclick = (e) => {
    showBest = !showBest;
    e.target.textContent = 'Visa bästa drag: ' + (showBest ? 'på' : 'av');
    render();
  };
  const onKey = (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowLeft') go(cur - 1);
    if (e.key === 'ArrowRight') go(cur + 1);
  };
  window.addEventListener('keydown', onKey);
  render();

  return () => {
    destroyed = true;
    window.removeEventListener('keydown', onKey);
    board.destroy();
  };
}
