import { Chess } from '../../vendor/chess.js';
import { Board } from '../board.js';
import { OPENINGS } from '../data/openings.js';
import { getState, update, unlock } from '../store.js';

export function mount(view, [id]) {
  const o = OPENINGS.find((x) => x.id === id);
  if (o) return trainer(view, o);
  list(view);
}

function list(view) {
  const st = getState().openings;
  const section = (title, items) => `
    <h2 style="margin-top:22px">${title}</h2>
    <div class="grid">${items.map((o) => {
      const s = st[o.id];
      return `<a class="card" href="#/oppningar/${o.id}" style="text-decoration:none;color:inherit">
        <div class="row"><h3 style="margin:0">${o.name}</h3><span class="spacer"></span>${s?.perfect ? '<span class="pill ok">✓ Kan</span>' : s ? '<span class="pill warn">Påbörjad</span>' : ''}</div>
        <div class="row small muted" style="margin:4px 0 8px">${o.eco} · ${o.side === 'w' ? 'Som vit' : 'Som svart'} · ${o.level}</div>
        <p class="small muted" style="margin:0">${o.summary}</p></a>`;
    }).join('')}</div>`;
  view.innerHTML = `
    <h1>Öppningar</h1>
    <p class="muted">Lär dig idéerna bakom dragen och träna tills varianten sitter. Du spelar din sida – appen spelar motståndarens drag.</p>
    ${section('♔ Öppningar för vit', OPENINGS.filter((o) => o.side === 'w' && !o.trap))}
    ${section('♚ Försvar för svart', OPENINGS.filter((o) => o.side === 'b' && !o.trap))}
    ${section('🪤 Fällor att känna till', OPENINGS.filter((o) => o.trap))}`;
}

function trainer(view, o) {
  const line = o.moves.split(' ');
  let chess = new Chess();
  let idx = 0;
  let errors = 0;
  let hints = 0;
  let destroyed = false;
  let timer = null;

  view.innerHTML = `
    <div class="row" style="margin-bottom:10px"><a class="btn" href="#/oppningar">← Öppningar</a>
      <h1 style="margin:0 0 0 6px;font-size:1.3rem">${o.name}</h1><span class="pill">${o.eco}</span>
      <span class="pill">${o.side === 'w' ? 'Du spelar vit' : 'Du spelar svart'}</span></div>
    <div class="layout">
      <div class="board-col"><div id="board"></div></div>
      <div class="side">
        <div class="card">
          <p>${o.summary}</p>
          <h3>Viktiga idéer</h3>
          <ul style="margin:0;padding-left:20px">${o.ideas.map((i) => `<li>${i}</li>`).join('')}</ul>
        </div>
        <div class="card">
          <div class="progress"><div id="bar"></div></div>
          <div id="status" class="feedback" style="margin-top:12px"></div>
          <div id="note" class="muted small" style="margin-top:8px"></div>
          <div class="row" style="margin-top:12px">
            <button id="hint">💡 Visa drag</button>
            <button id="restart">↺ Börja om</button>
            <button id="demo">▶ Visa hela varianten</button>
          </div>
        </div>
        <div class="card"><h3>Varianten</h3><div id="line" class="small"></div></div>
      </div>
    </div>`;
  const $ = (s) => view.querySelector(s);
  const board = new Board($('#board'), { orientation: o.side, onMove: onUserMove });
  const status = (t, h) => { $('#status').className = 'feedback ' + t; $('#status').innerHTML = h; };

  function lastMove() {
    const h = chess.history({ verbose: true });
    const l = h[h.length - 1];
    return l ? { from: l.from, to: l.to } : null;
  }

  function render() {
    board.set(chess.fen(), { lastMove: lastMove() });
    $('#bar').style.width = (idx / line.length) * 100 + '%';
    let html = '';
    for (let i = 0; i < line.length; i++) {
      if (i % 2 === 0) html += `<b>${i / 2 + 1}.</b> `;
      html += i < idx ? `${line[i]} ` : '<span class="muted">… </span>';
    }
    $('#line').innerHTML = html;
    const note = o.notes?.[idx - 1];
    $('#note').innerHTML = note ? `💬 <b>${line[idx - 1]}</b>: ${note}` : '';
  }

  function step() {
    if (destroyed) return;
    if (idx >= line.length) return complete();
    const turn = chess.turn();
    if (turn !== o.side) {
      board.setMovable(null);
      timer = setTimeout(() => {
        if (destroyed) return;
        chess.move(line[idx]);
        idx++;
        render();
        step();
      }, 550);
    } else {
      board.setMovable(o.side);
      if (!$('#status').classList.contains('bad')) status('info', idx === 0 ? 'Din tur – spela första draget!' : 'Ditt drag. Vad spelar man här?');
    }
  }

  function onUserMove(m) {
    if (idx >= line.length || chess.turn() !== o.side) return;
    const test = new Chess(chess.fen());
    let mv;
    try { mv = test.move(m); } catch { return render(); }
    if (mv.san === line[idx]) {
      chess.move(m);
      idx++;
      status('ok', `<b>${mv.san}</b> ✓`);
      board.setArrows([]);
      render();
      step();
    } else {
      errors++;
      status('bad', `<b>${mv.san}</b> är inte huvudvarianten här. Försök igen – eller tryck på "Visa drag".`);
      board.set(chess.fen(), { lastMove: lastMove() });
      board.setMovable(o.side);
    }
  }

  function complete() {
    board.setMovable(null);
    $('#bar').style.width = '100%';
    const perfect = errors === 0 && hints === 0;
    status('ok', perfect ? '<b>Perfekt!</b> Du kan hela varianten utan fel. 🎉' :
      `<b>Klart!</b> ${errors} fel och ${hints} tips. Kör en gång till för att få den perfekt!`);
    update((s) => {
      const r = (s.openings[o.id] ||= { practiced: 0, perfect: false });
      r.practiced++;
      if (perfect) r.perfect = true;
    });
    const perfectCount = Object.values(getState().openings).filter((x) => x.perfect).length;
    if (perfectCount >= 1) unlock('opening_1');
    if (perfectCount >= 5) unlock('opening_5');
  }

  function restart() {
    clearTimeout(timer);
    chess = new Chess();
    idx = 0;
    errors = 0;
    hints = 0;
    board.setArrows([]);
    status('info', '');
    render();
    step();
  }

  $('#hint').onclick = () => {
    if (idx >= line.length || chess.turn() !== o.side) return;
    hints++;
    const mv = new Chess(chess.fen()).move(line[idx]);
    board.setArrows([{ from: mv.from, to: mv.to, color: 'blue' }]);
  };
  $('#restart').onclick = restart;
  $('#demo').onclick = async () => {
    clearTimeout(timer);
    chess = new Chess();
    idx = 0;
    board.setMovable(null);
    status('info', 'Visar varianten…');
    for (let i = 0; i < line.length; i++) {
      await new Promise((r) => (timer = setTimeout(r, 900)));
      if (destroyed) return;
      chess.move(line[i]);
      idx = i + 1;
      render();
    }
    status('info', 'Det var hela varianten. Tryck "Börja om" och spela den själv!');
    hints++;
  };

  render();
  step();
  return () => {
    destroyed = true;
    clearTimeout(timer);
    board.destroy();
  };
}
