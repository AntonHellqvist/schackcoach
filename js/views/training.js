import { Board } from '../board.js';
import { runPuzzle } from '../puzzle.js';
import { nextPuzzle, themeName } from '../lichess.js';
import { getDaily, markDaily, stepDone, dailyProgress, streakInfo } from '../daily.js';
import { getState, update, unlock } from '../store.js';
import { updateRating } from './puzzles.js';

export function mount(view) {
  let cleanup = null;
  const setCleanup = (fn) => { cleanup?.(); cleanup = fn; };
  overview();
  return () => cleanup?.();

  function overview() {
    setCleanup(null);
    const d = getDaily();
    const { done, total } = dailyProgress(d);
    const streak = streakInfo();
    const next = d.steps.find((st) => !stepDone(d, st));

    view.innerHTML = `
      <div class="card hero">
        <div class="row">
          <div><h1 style="margin:0">Dagens träning</h1>
            <p class="muted" style="margin:4px 0 0">Ett personligt pass på 10–15 minuter. Nytt varje dag.</p></div>
          <span class="spacer"></span>
          <div style="text-align:center"><div class="stat">🔥 ${streak.current}</div>
            <div class="muted small">${streak.current === 1 ? 'dag' : 'dagar'} i rad · rekord ${streak.best}</div></div>
        </div>
        <div class="progress" style="margin-top:14px"><div style="width:${(done / total) * 100}%"></div></div>
        <div class="muted small" style="margin-top:6px">${done} av ${total} klara</div>
      </div>
      ${d.completed ? `<div class="feedback ok" style="margin-top:14px"><b>Klart för idag! 🎉</b> ${streak.current > 1 ? `Du har tränat ${streak.current} dagar i rad – grymt!` : 'Bra start på din streak!'} Kom tillbaka imorgon för ett nytt pass.</div>` : ''}
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
        ${d.steps.map((st) => {
          const n = Math.min(d.progress[st.id] || 0, st.target);
          const ok = stepDone(d, st);
          return `<div class="card row" style="gap:14px;${ok ? 'border-color:var(--accent)' : ''}">
            <span style="font-size:1.8rem">${ok ? '✅' : st.icon}</span>
            <div style="flex:1;min-width:0"><b>${st.title}</b><div class="muted small">${st.sub}</div>
              ${st.target > 1 ? `<div class="progress" style="margin-top:6px;max-width:220px"><div style="width:${(n / st.target) * 100}%"></div></div>` : ''}</div>
            ${ok ? '<span class="pill ok">Klart</span>' : `<button class="${st === next ? 'primary' : ''}" data-step="${st.id}">${n ? 'Fortsätt' : 'Starta'}</button>`}
          </div>`;
        }).join('')}
      </div>
      ${next ? `<div class="row" style="margin-top:16px"><button class="primary big" data-step="${next.id}">▶ ${done ? 'Fortsätt passet' : 'Starta passet'}</button></div>` : ''}`;

    view.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => start(b.dataset.step)));
  }

  function start(stepId) {
    const d = getDaily();
    const st = d.steps.find((x) => x.id === stepId);
    if (!st) return;
    if (st.kind === 'opening') return (location.hash = '#/oppningar/' + st.ref);
    if (st.kind === 'mate') return (location.hash = '#/matter/' + st.ref);
    setCleanup(puzzleStep(st));
  }

  function puzzleStep(st) {
    view.innerHTML = `
      <div class="row" style="margin-bottom:10px"><button id="back">← Dagens träning</button>
        <h1 style="margin:0 0 0 6px;font-size:1.2rem">${st.icon} ${st.title}</h1></div>
      <div class="layout">
        <div class="board-col"><div id="board"></div>
          <div class="progress"><div id="bar"></div></div>
          <div class="muted small" id="count"></div>
        </div>
        <div class="side">
          <div class="card">
            <div id="info" class="muted small" style="margin-bottom:10px"></div>
            <div id="status" class="feedback"></div>
            <div class="row" style="margin-top:12px">
              <button id="hint">💡 Tips</button>
              <button id="solution">👁 Visa lösning</button>
              <span class="spacer"></span>
              <button class="primary hidden" id="next">Nästa →</button>
            </div>
            <div id="why" style="margin-top:10px"></div>
          </div>
        </div>
      </div>`;
    const $ = (s) => view.querySelector(s);
    const board = new Board($('#board'));
    const setStatus = (t, h) => { $('#status').className = 'feedback ' + (t || ''); $('#status').innerHTML = h; };
    let runner = null;
    let destroyed = false;
    let prefetch = null;
    const mistakes = st.kind === 'mistakes'
      ? getState().mistakes.filter((m) => !m.solved).sort((a, b) => (b.cls === 'blunder') - (a.cls === 'blunder'))
      : [];

    const doneCount = () => Math.min(getDaily().progress[st.id] || 0, st.target);
    const fetchPuzzle = () => nextPuzzle({ theme: st.theme, rating: getState().puzzle.rating }).catch(() => null);

    function finishOne() {
      markDaily(st.kind, { stepId: st.id });
      const n = doneCount();
      $('#bar').style.width = (n / st.target) * 100 + '%';
      $('#count').textContent = `${n} av ${st.target}`;
      $('#next').classList.remove('hidden');
      $('#next').textContent = n >= st.target ? 'Klart – tillbaka →' : 'Nästa →';
    }

    async function load() {
      runner?.destroy();
      board.setArrows([]);
      $('#why').innerHTML = '';
      $('#next').classList.add('hidden');
      const n = doneCount();
      $('#bar').style.width = (n / st.target) * 100 + '%';
      $('#count').textContent = `${n} av ${st.target}`;
      if (n >= st.target) return overview();

      let finished = false;
      const onDone = () => { if (!finished) { finished = true; finishOne(); } };

      if (st.kind === 'mistakes') {
        const m = mistakes.shift();
        if (!m) return overview();
        $('#info').innerHTML = `I partiet spelade du <b>${m.played}</b> (${m.cls === 'blunder' ? 'blunder' : 'misstag'}). Hitta ett bättre drag!`;
        let firstOk = null;
        runner = runPuzzle({
          board, fen: m.fen, solution: [m.best], mode: 'engine', bestCp: m.bestCp, onStatus: setStatus,
          onResult: ({ success, firstTry }) => {
            if (firstOk === null && firstTry) firstOk = success;
            if (!success) return;
            if (firstOk) {
              update((s) => { const x = s.mistakes.find((y) => y.id === m.id); if (x) x.solved = true; });
              if (getState().mistakes.filter((x) => x.solved).length >= 5) unlock('mistakes_5');
            }
            if (m.why) $('#why').innerHTML = `<div class="feedback info small"><b>Coachen:</b> ${m.why}</div>`;
            onDone();
          },
        });
        $('#solution').onclick = async () => { await runner.showSolution(); onDone(); };
        return;
      }

      setStatus('', '<span class="spinner"></span> Hämtar pussel…');
      const p = await (prefetch || fetchPuzzle());
      prefetch = fetchPuzzle();
      if (destroyed) return;
      if (!p) return setStatus('bad', 'Kunde inte hämta pussel. Kontrollera internetanslutningen och försök igen.');
      $('#info').innerHTML = `Tema: <b>${themeName(st.theme)}</b> · pusselrating ${p.rating}`;
      let reported = false;
      runner = runPuzzle({
        board, fen: p.fen, solution: p.solution, lastMove: p.lastMove, mode: 'strict', onStatus: setStatus,
        onResult: ({ success, firstTry }) => {
          if (!reported && firstTry) { reported = true; updateRating(p.rating, success, p.themes); }
          if (success) onDone();
        },
      });
      $('#solution').onclick = async () => { await runner.showSolution(); onDone(); };
    }

    $('#back').onclick = overview;
    $('#hint').onclick = () => runner?.hint();
    $('#next').onclick = load;
    load();
    return () => {
      destroyed = true;
      runner?.destroy();
      board.destroy();
    };
  }
}
