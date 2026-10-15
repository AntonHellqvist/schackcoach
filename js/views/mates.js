import { Chess } from '../../vendor/chess.js';
import { Board } from '../board.js';
import { runPuzzle, sanToUci } from '../puzzle.js';
import { MATES } from '../data/mates.js';
import { getState, update, unlock } from '../store.js';
import { markDaily } from '../daily.js';

function startFen(m) {
  const c = new Chess(m.fen);
  let last = null;
  if (m.moves) for (const s of m.moves.split(' ')) { const mv = c.move(s); last = { from: mv.from, to: mv.to }; }
  return { fen: c.fen(), last };
}

export function mount(view, [id]) {
  const idx = MATES.findIndex((x) => x.id === id);
  if (idx >= 0) return solve(view, idx);
  const solved = getState().mates;
  view.innerHTML = `
    <h1>Snygga matter</h1>
    <p class="muted">Klassiska mattmönster som alla schackspelare bör känna igen. När du sett mönstret en gång hittar du det i dina egna partier!</p>
    <div class="grid">${MATES.map((m) => `
      <a class="card" href="#/matter/${m.id}" style="text-decoration:none;color:inherit">
        <div class="row"><h3 style="margin:0">${m.name}</h3><span class="spacer"></span>${solved[m.id] ? '<span class="pill ok">✓ Löst</span>' : ''}</div>
        <div class="muted small">Matt i ${m.n}</div>
      </a>`).join('')}
    </div>`;
}

function solve(view, i) {
  const m = MATES[i];
  const next = MATES[i + 1];
  const { fen, last } = startFen(m);
  view.innerHTML = `
    <div class="row" style="margin-bottom:10px"><a class="btn" href="#/matter">← Alla matter</a>
      <h1 style="margin:0 0 0 6px;font-size:1.3rem">${m.name}</h1><span class="pill">Matt i ${m.n}</span></div>
    <div class="layout">
      <div class="board-col"><div id="board"></div></div>
      <div class="side">
        <div class="card">
          <div id="status" class="feedback"></div>
          <div class="row" style="margin-top:12px">
            <button id="hint">💡 Tips</button>
            <button id="solution">👁 Visa lösning</button>
            <span class="spacer"></span>
            ${next ? `<a class="btn primary" href="#/matter/${next.id}">Nästa →</a>` : '<a class="btn primary" href="#/matter">Klart →</a>'}
          </div>
        </div>
        <div class="card hidden" id="explain"><h3>Mönstret</h3><p>${m.text}</p></div>
      </div>
    </div>`;
  const $ = (s) => view.querySelector(s);
  const board = new Board($('#board'));
  const setStatus = (t, h) => { $('#status').className = 'feedback ' + (t || ''); $('#status').innerHTML = h; };
  const runner = runPuzzle({
    board, fen, lastMove: last, solution: sanToUci(fen, m.solution), mode: 'mate',
    onStatus: (t, h) => setStatus(t, h.replace('Hitta det bästa draget!', `Hitta matt i ${m.n}!`)),
    onResult: ({ success }) => {
      if (!success) return;
      $('#explain').classList.remove('hidden');
      update((s) => { s.mates[m.id] = true; });
      if (markDaily('mate', { ref: m.id })) {
        $('#explain').insertAdjacentHTML('beforeend', '<a class="btn primary" href="#/traning">🔥 Tillbaka till dagens träning →</a>');
      }
      const n = Object.keys(getState().mates).length;
      if (n >= 5) unlock('mates_5');
      if (MATES.every((x) => getState().mates[x.id])) unlock('mates_all');
    },
  });
  $('#hint').onclick = () => runner.hint();
  $('#solution').onclick = async () => {
    await runner.showSolution();
    $('#explain').classList.remove('hidden');
  };
  return () => {
    runner.destroy();
    board.destroy();
  };
}
