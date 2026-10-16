import { Board } from '../board.js';
import { runPuzzle } from '../puzzle.js';
import { nextPuzzle } from '../lichess.js';
import { mountGame } from './play.js';
import { BOTS } from '../bots.js';
import { ACHIEVEMENTS } from '../achievements.js';
import { getState, update, unlock } from '../store.js';

const ENDGAMES = {
  kq: { title: 'Damsmatt', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', ach: 'endgame_kq',
    goal: '<b>Mål:</b> Matta Stockfish med dam och kung. Tips: använd damen för att krympa kungens "låda" – men se upp för patt! Kungen måste hjälpa till på slutet.' },
  kr: { title: 'Tornmatt', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', ach: 'endgame_kr',
    goal: '<b>Mål:</b> Matta Stockfish med torn och kung. Tips: ställ kungarna mitt emot varandra (opposition) och ge schack med tornet. Tornet skär av kungen rad för rad.' },
  kbb: { title: 'Två löpare', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', ach: 'endgame_kbb',
    goal: '<b>Mål:</b> Matta med två löpare. Löparna bildar en vägg tillsammans; driv kungen mot ett hörn och låt din kung hjälpa till. Svårare än det ser ut!' },
};

const DEFENDER = { id: 'stockfish-def', name: 'Stockfish', face: '🤖', elo: 3000, movetime: 400, skill: 20, multipv: 1 };

export function mount(view, [id]) {
  if (id === 'rush') return rush(view);
  if (ENDGAMES[id]) return endgame(view, id);
  overview(view);
}

function overview(view) {
  const s = getState();
  const has = (id) => !!s.achievements[id];
  const botsBeaten = BOTS.filter((b) => has('beat_' + b.id)).length;
  const nextBot = BOTS.find((b) => !has('beat_' + b.id));
  const card = (icon, title, desc, href, done, extra = '') => `
    <a class="card challenge ${done ? 'done' : ''}" href="${href}" style="text-decoration:none;color:inherit">
      <div class="row"><span class="icon">${icon}</span><span class="spacer"></span>${done ? '<span class="pill ok">✓ Klar</span>' : ''}</div>
      <h3 style="margin:0">${title}</h3><p class="muted small" style="margin:0">${desc}</p>${extra}</a>`;

  view.innerHTML = `
    <h1>Utmaningar</h1>
    <p class="muted">Testa dig själv och lås upp utmaningar. Du har klarat <b>${Object.keys(s.achievements).length}</b> av ${ACHIEVEMENTS.length}.</p>
    <div class="grid">
      ${card('⚔️', 'Kompisutmaning', 'Lös samma pussel som dina kompisar och se vem som är snabbast. Skicka bara en länk!', '#/duell', false)}
      ${card('📅', 'Dagens pussel', 'Ett nytt pussel varje dag från Lichess.', '#/pussel/daily', has('daily'))}
      ${card('⚡', 'Pusselrush', 'Lös så många pussel du kan på 3 minuter. Tre fel och det är slut!', '#/utmaningar/rush', has('rush_10'),
        `<div class="small">Rekord: <b>${s.rushBest || 0}</b></div>`)}
      ${card('🤖', 'Besegra bottarna', nextBot ? `Nästa: ${nextBot.face} ${nextBot.name} (ca ${nextBot.elo}). Utan tips eller ångra!` : 'Du har besegrat alla bottar!',
        nextBot ? '#/spela/' + nextBot.id : '#/spela', !nextBot,
        `<div class="progress"><div style="width:${(botsBeaten / BOTS.length) * 100}%"></div></div><div class="small">${botsBeaten} / ${BOTS.length}</div>`)}
      ${card('♛', 'Damsmatt mot Stockfish', 'Kan du matta med dam mot ensam kung – utan att göra patt?', '#/utmaningar/kq', has('endgame_kq'))}
      ${card('♜', 'Tornmatt mot Stockfish', 'Den viktigaste grundmatten. Torn och kung mot kung.', '#/utmaningar/kr', has('endgame_kr'))}
      ${card('♝', 'Två löpare', 'Svår slutspelsmatt. Bara för de modiga!', '#/utmaningar/kbb', has('endgame_kbb'))}
      ${card('🔁', 'Lär av misstagen', 'Lös 5 ställningar från dina egna partier.', '#/pussel/mistakes', has('mistakes_5'))}
    </div>
    <h2 style="margin-top:24px">Alla utmaningar</h2>
    <div class="card">${ACHIEVEMENTS.map((a) => `
      <a class="list-item" href="${a.link}" style="color:inherit;text-decoration:none">
        <span style="font-size:1.4rem;width:32px;text-align:center;${has(a.id) ? '' : 'filter:grayscale(1);opacity:.5'}">${a.icon}</span>
        <span style="flex:1"><b>${a.title}</b><br><span class="muted small">${a.desc}</span></span>
        ${has(a.id) ? `<span class="pill ok">✓ ${new Date(s.achievements[a.id]).toLocaleDateString('sv-SE')}</span>` : ''}
      </a>`).join('')}</div>`;
}

function endgame(view, id) {
  const eg = ENDGAMES[id];
  let cleanup = null;
  const start = () => {
    cleanup?.();
    cleanup = mountGame(view, {
      bot: DEFENDER, userColor: 'w', fen: eg.fen, title: eg.title, goal: eg.goal,
      onEnd: ({ userWon }) => { if (userWon) unlock(eg.ach); },
      onRetry: start,
    });
  };
  start();
  return () => cleanup?.();
}

function rush(view) {
  const TIME = 180;
  let score = 0;
  let strikes = 0;
  let left = TIME;
  let running = false;
  let destroyed = false;
  let runner = null;
  let tick = null;
  const queue = [];

  view.innerHTML = `
    <div class="row" style="margin-bottom:10px"><a class="btn" href="#/utmaningar">← Utmaningar</a>
      <h1 style="margin:0 0 0 6px;font-size:1.3rem">⚡ Pusselrush</h1></div>
    <div class="layout">
      <div class="board-col"><div id="board"></div></div>
      <div class="side">
        <div class="card">
          <div class="row" style="justify-content:space-around;text-align:center">
            <div><div class="muted small">Tid</div><div class="stat" id="time">3:00</div></div>
            <div><div class="muted small">Lösta</div><div class="stat" id="score">0</div></div>
            <div><div class="muted small">Fel</div><div class="stat" id="strikes">○○○</div></div>
          </div>
        </div>
        <div class="card"><div id="status" class="feedback info">Pusslen blir svårare ju fler du löser. Rekord: <b>${getState().rushBest || 0}</b></div>
          <div class="row" style="margin-top:12px"><button class="primary big" id="start">Starta</button></div></div>
      </div>
    </div>`;
  const $ = (s) => view.querySelector(s);
  const board = new Board($('#board'));
  const setStatus = (t, h) => { $('#status').className = 'feedback ' + (t || ''); $('#status').innerHTML = h; };

  const difficulty = () => (score < 4 ? 'easiest' : score < 9 ? 'easier' : score < 15 ? 'normal' : 'harder');
  const fill = () => {
    while (queue.length < 3) queue.push(nextPuzzle({ difficulty: difficulty() }).catch(() => null));
  };

  function hud() {
    $('#time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('#score').textContent = score;
    $('#strikes').textContent = '●'.repeat(strikes) + '○'.repeat(3 - strikes);
  }

  async function next() {
    if (!running || destroyed) return;
    runner?.destroy();
    fill();
    const p = await queue.shift();
    fill();
    if (!running || destroyed) return;
    if (!p) return next();
    let done = false;
    runner = runPuzzle({
      board, fen: p.fen, solution: p.solution, lastMove: p.lastMove, mode: 'strict',
      onStatus: (t, h) => setStatus(t, h),
      onResult: ({ success }) => {
        if (done || !running) return;
        done = true;
        if (success) score++;
        else strikes++;
        hud();
        if (strikes >= 3) return end();
        setTimeout(next, success ? 300 : 900);
      },
    });
  }

  function end() {
    running = false;
    clearInterval(tick);
    runner?.destroy();
    board.setMovable(null);
    const best = Math.max(getState().rushBest || 0, score);
    const record = score > (getState().rushBest || 0);
    update((s) => { s.rushBest = best; });
    if (score >= 10) unlock('rush_10');
    setStatus('ok', `<b>Slut!</b> Du löste ${score} pussel. ${record ? 'Nytt rekord! 🎉' : `Rekord: ${best}.`}`);
    $('#start').textContent = 'Spela igen';
    $('#start').disabled = false;
  }

  $('#start').onclick = () => {
    score = 0; strikes = 0; left = TIME; running = true;
    $('#start').disabled = true;
    hud();
    clearInterval(tick);
    tick = setInterval(() => {
      left--;
      hud();
      if (left <= 0) end();
    }, 1000);
    next();
  };
  fill();

  return () => {
    destroyed = true;
    running = false;
    clearInterval(tick);
    runner?.destroy();
    board.destroy();
  };
}
