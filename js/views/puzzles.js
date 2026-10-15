import { Board } from '../board.js';
import { runPuzzle } from '../puzzle.js';
import { nextPuzzle, dailyPuzzle, THEMES, themeName } from '../lichess.js';
import { getState, update, unlock } from '../store.js';

export function mount(view, [mode]) {
  if (mode === 'mistakes') return mountMistakes(view);
  return mountLichess(view, mode === 'daily');
}

function shell(view, title, sub) {
  view.innerHTML = `
    <h1>${title}</h1>
    ${sub ? `<p class="muted">${sub}</p>` : ''}
    <div class="layout">
      <div class="board-col"><div id="board"></div></div>
      <div class="side">
        <div class="card" id="info"></div>
        <div class="card">
          <div id="status" class="feedback"></div>
          <div class="row" style="margin-top:12px">
            <button id="hint">💡 Tips</button>
            <button id="solution">👁 Visa lösning</button>
            <span class="spacer"></span>
            <button class="primary" id="next">Nästa →</button>
          </div>
        </div>
        <div class="card" id="extra"></div>
      </div>
    </div>`;
  const board = new Board(view.querySelector('#board'));
  const status = view.querySelector('#status');
  const setStatus = (type, html) => { status.className = 'feedback ' + (type || ''); status.innerHTML = html; };
  return { board, setStatus, $: (s) => view.querySelector(s) };
}

export function updateRating(puzzleRating, success, themes = []) {
  let delta = 0;
  update((s) => {
    const p = s.puzzle;
    const n = p.solved + p.failed;
    const k = n < 20 ? 40 : 24;
    const exp = 1 / (1 + Math.pow(10, (puzzleRating - p.rating) / 400));
    delta = k * ((success ? 1 : 0) - exp);
    p.rating = Math.max(400, p.rating + delta);
    if (success) { p.solved++; p.streak = (p.streak || 0) + 1; } else { p.failed++; p.streak = 0; }
    p.history.push({ t: Date.now(), r: Math.round(p.rating) });
    if (p.history.length > 500) p.history = p.history.slice(-500);
    for (const t of themes) {
      const th = (p.themes[t] ||= { s: 0, f: 0 });
      th[success ? 's' : 'f']++;
    }
  });
  const p = getState().puzzle;
  if (p.solved >= 10) unlock('puzzles_10');
  if (p.solved >= 50) unlock('puzzles_50');
  if (p.streak >= 5) unlock('streak_5');
  if (p.rating >= 1500) unlock('rating_1500');
  return delta;
}

function mountLichess(view, daily) {
  const ui = shell(view, daily ? 'Dagens pussel' : 'Taktikpussel',
    daily ? 'Ett nytt pussel från Lichess varje dag.' : 'Pussel från riktiga partier på Lichess, anpassade efter din rating.');
  let theme = getState().puzzleTheme || '';
  let current = null;
  let runner = null;
  let prefetch = null;
  let destroyed = false;

  const fetchOne = () => (daily ? dailyPuzzle() : nextPuzzle({ theme, rating: getState().puzzle.rating }));

  function renderInfo(revealThemes) {
    const p = getState().puzzle;
    ui.$('#info').innerHTML = `
      <div class="row"><div><div class="muted small">Din pusselrating</div><div class="stat">${Math.round(p.rating)}</div></div>
        <span class="spacer"></span>
        <div style="text-align:right"><div class="muted small">Lösta / missade</div><b>${p.solved} / ${p.failed}</b>
        ${p.streak ? `<div class="small">🔥 ${p.streak} i rad</div>` : ''}</div></div>
      ${!daily ? `<div style="margin-top:10px"><label class="small">Tema</label>
        <select id="theme" style="width:100%;margin-top:4px">${THEMES.map(([k, v]) => `<option value="${k}" ${k === theme ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}`;
    ui.$('#theme')?.addEventListener('change', (e) => {
      theme = e.target.value;
      update((s) => { s.puzzleTheme = theme; });
      prefetch = null;
      load();
    });
    ui.$('#extra').innerHTML = current && revealThemes ? `
      <div class="muted small">Pusselrating: <b>${current.rating}</b></div>
      <div class="row" style="margin-top:6px">${current.themes.map((t) => `<span class="pill">${themeName(t)}</span>`).join('')}</div>
      <a class="small" href="${current.gameUrl}" target="_blank" rel="noopener">Se originalpartiet på Lichess ↗</a>` :
      '<span class="muted small">Teman visas när pusslet är klart.</span>';
  }

  async function load() {
    runner?.destroy();
    ui.setStatus('', '<span class="spinner"></span> Hämtar pussel…');
    ui.$('#next').disabled = true;
    try {
      current = await (prefetch || fetchOne());
    } catch (e) {
      ui.setStatus('bad', `Kunde inte hämta pussel (${e.message}). Kontrollera internetanslutningen.`);
      ui.$('#next').disabled = false;
      return;
    }
    prefetch = null;
    if (destroyed) return;
    renderInfo(false);
    let reported = false;
    runner = runPuzzle({
      board: ui.board, fen: current.fen, solution: current.solution, lastMove: current.lastMove, mode: 'strict',
      onStatus: ui.setStatus,
      onResult: ({ success, firstTry }) => {
        if (!reported && firstTry) {
          reported = true;
          const d = updateRating(current.rating, success, current.themes);
          if (success && daily) unlock('daily');
          setTimeout(() => {
            if (destroyed) return;
            ui.setStatus(success ? 'ok' : 'bad', (success ? '<b>Rätt!</b> Snyggt löst! 🎉' : 'Inte riktigt – men du kan fortsätta försöka.') +
              ` <span class="pill ${d >= 0 ? 'ok' : 'warn'}">${d >= 0 ? '+' : ''}${Math.round(d)}</span>`);
          }, 0);
        }
        if (success) {
          renderInfo(true);
          ui.$('#next').disabled = false;
        }
      },
    });
    ui.$('#next').disabled = daily;
    if (!daily) prefetch = fetchOne().catch(() => null);
  }

  ui.$('#hint').onclick = () => runner?.hint();
  ui.$('#solution').onclick = async () => {
    await runner?.showSolution();
    renderInfo(true);
    ui.$('#next').disabled = daily;
  };
  ui.$('#next').onclick = () => (daily ? (location.hash = '#/pussel') : load());
  if (daily) ui.$('#next').textContent = 'Fler pussel →';
  load();

  return () => {
    destroyed = true;
    runner?.destroy();
    ui.board.destroy();
  };
}

function mountMistakes(view) {
  const ui = shell(view, 'Träna på dina misstag', 'Ställningar från dina egna partier där du missade ett bättre drag. Hitta draget du borde ha spelat!');
  let runner = null;
  let queue = getState().mistakes.filter((m) => !m.solved).sort((a, b) => (a.cls === 'blunder' ? -1 : 1) - (b.cls === 'blunder' ? -1 : 1));
  let current = null;

  function load() {
    runner?.destroy();
    ui.board.setArrows([]);
    if (!queue.length) {
      const total = getState().mistakes.length;
      ui.$('#info').innerHTML = total
        ? '<h2>Alla misstag lösta! 🎉</h2><p class="muted">Analysera fler partier för att få nya träningsställningar.</p><a class="btn primary" href="#/analys">Analysera partier</a>'
        : '<h2>Inga misstag än</h2><p class="muted">När du analyserar dina partier sparas dina misstag här som pussel.</p><a class="btn primary" href="#/analys">Analysera ett parti</a>';
      ui.setStatus('info', 'Inget att träna på just nu.');
      ui.$('#extra').innerHTML = '';
      ['#hint', '#solution', '#next'].forEach((s) => (ui.$(s).disabled = true));
      return;
    }
    current = queue.shift();
    const left = queue.length;
    ui.$('#info').innerHTML = `
      <div class="row"><span class="cls cls-${current.cls}">${current.cls === 'blunder' ? '??' : '?'}</span>
        <b>I partiet spelade du ${current.played}</b></div>
      <p class="muted small" style="margin-top:6px">Det var ${current.cls === 'blunder' ? 'en blunder' : 'ett misstag'}. Hitta ett bättre drag!</p>
      <div class="muted small">${left} kvar efter detta</div>`;
    ui.$('#extra').innerHTML = '';
    let firstOk = null;
    runner = runPuzzle({
      board: ui.board, fen: current.fen, solution: [current.best], mode: 'engine', bestCp: current.bestCp,
      onStatus: ui.setStatus,
      onResult: ({ success, firstTry }) => {
        if (firstOk === null && firstTry) firstOk = success;
        if (success) {
          if (firstOk) {
            update((s) => {
              const m = s.mistakes.find((x) => x.id === current.id);
              if (m) m.solved = true;
            });
            if (getState().mistakes.filter((m) => m.solved).length >= 5) unlock('mistakes_5');
          } else queue.push(current); // tillbaka i kön tills det sitter
          ui.$('#extra').innerHTML = `<div class="muted small">Motorns förstaval: <b>${current.bestSan}</b></div>`;
        }
      },
    });
  }

  ui.$('#hint').onclick = () => runner?.hint();
  ui.$('#solution').onclick = () => {
    runner?.showSolution();
    if (current && !queue.includes(current)) queue.push(current);
  };
  ui.$('#next').onclick = load;
  load();
  return () => {
    runner?.destroy();
    ui.board.destroy();
  };
}
