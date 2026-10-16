import { Chess } from '../../vendor/chess.js';
import { Board, uciToMove } from '../board.js';
import { Engine, sharedEngine, toWhiteCp, winProb } from '../engine.js';
import { diagnose } from '../coach.js';
import { BOTS, botMove } from '../bots.js';
import { getState, update, unlock } from '../store.js';
import { addGame } from '../library.js';
import { enqueue } from '../analyzer.js';
import { detectOpening } from '../data/openings.js';
import { play as playSound, playMove, soundOn } from '../sound.js';

export function mount(view, [botParam]) {
  let selectedBot = BOTS.find((b) => b.id === botParam) || BOTS.find((b) => b.id === getState().lastBot) || BOTS[2];
  let colorChoice = 'w';
  let cleanupGame = null;

  // Fortsätt ett pågående parti om det finns
  const saved = getState().current;
  if (saved && !botParam) {
    const bot = BOTS.find((b) => b.id === saved.botId);
    if (bot) return startGame(bot, saved.userColor, saved);
  }
  showSetup();

  function showSetup() {
    cleanupGame?.();
    cleanupGame = null;
    const st = getState();
    view.innerHTML = `
      <h1>Spela mot en bot</h1>
      <p class="muted">Välj motståndare. Efter partiet kan du få det bedömt drag för drag.</p>
      <div class="card">
        <h2>Motståndare</h2>
        <div class="bot-grid" id="bots"></div>
        <div id="botinfo" class="feedback info" style="margin-top:14px"></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h2>Din färg</h2>
        <div class="tabs" id="colors">
          <button data-c="w">♔ Vit</button>
          <button data-c="r">🎲 Slumpa</button>
          <button data-c="b">♚ Svart</button>
        </div>
        <div class="row" style="margin-top:16px">
          <button class="primary big" id="start">Starta parti</button>
        </div>
      </div>`;
    const grid = view.querySelector('#bots');
    const renderBots = () => {
      grid.innerHTML = '';
      for (const b of BOTS) {
        const r = st.botResults[b.id];
        const btn = document.createElement('button');
        btn.className = 'bot' + (b === selectedBot ? ' selected' : '');
        btn.innerHTML = `<span class="face">${b.face}</span><span>${b.name}${st.achievements['beat_' + b.id] ? ' ✅' : ''}</span>
          <span class="elo">ca ${b.elo}${b.id === 'stockfish' ? '+' : ''}</span>
          ${r ? `<span class="elo">${r.w}V ${r.d}O ${r.l}F</span>` : ''}`;
        btn.onclick = () => { selectedBot = b; renderBots(); };
        grid.append(btn);
      }
      view.querySelector('#botinfo').innerHTML = `<b>${selectedBot.face} ${selectedBot.name}</b> – ${selectedBot.bio}`;
    };
    renderBots();
    const colors = view.querySelector('#colors');
    const renderColors = () => colors.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.c === colorChoice));
    colors.onclick = (e) => { const c = e.target.closest('button')?.dataset.c; if (c) { colorChoice = c; renderColors(); } };
    renderColors();
    view.querySelector('#start').onclick = () => {
      const color = colorChoice === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
      update((s) => { s.lastBot = selectedBot.id; });
      startGame(selectedBot, color);
    };
  }

  function startGame(bot, userColor, resume) {
    cleanupGame = mountGame(view, {
      bot,
      userColor,
      resume,
      persist: true,
      onNew: showSetup,
    });
    return () => cleanupGame?.();
  }

  return () => cleanupGame?.();
}

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SYMBOLS = { w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' }, b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' } };

function materialInfo(chess) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
  for (const p of chess.board().flat()) if (p) count[p.color][p.type]++;
  const out = {};
  for (const c of ['w', 'b']) {
    const opp = c === 'w' ? 'b' : 'w';
    // pjäser som c har tagit = motståndarens saknade pjäser
    let s = '';
    for (const t of ['q', 'r', 'b', 'n', 'p']) s += SYMBOLS[opp][t].repeat(Math.max(0, start[t] - count[opp][t]));
    out[c] = { captured: s, value: Object.entries(count[c]).reduce((a, [t, n]) => a + VALUES[t] * n, 0) };
  }
  return out;
}

/** Konfetti över skärmen när du vinner. */
function confetti() {
  if (getState().settings.animations === false || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#7fb34d', '#f7c631', '#4a90d9', '#e0524f', '#1baca6', '#ece8e2'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() - 0.5) * 30 + 'vw');
    p.style.setProperty('--rot', (Math.random() - 0.5) * 1440 + 'deg');
    p.style.setProperty('--dur', 1.8 + Math.random() * 1.6 + 's');
    p.style.setProperty('--delay', Math.random() * 0.5 + 's');
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4200);
}

/**
 * Ett parti mot en bot. Används både av "Spela" och av utmaningarna.
 * opts: { bot, userColor, fen, resume, persist, title, goal, onEnd(result, chess), onNew }
 */
export function mountGame(view, opts) {
  const { bot, userColor } = opts;
  const engine = new Engine();
  const chess = new Chess(opts.fen || undefined);
  const startFen = chess.fen();
  if (opts.resume?.moves) for (const m of opts.resume.moves) chess.move(m);
  let over = false;
  let thinking = false;
  let destroyed = false;
  let hintsUsed = 0;
  let takebacks = 0;
  let coachSaves = 0; // gånger coachen varnade och du tänkte om
  let coach = getState().settings.coachMode !== false;
  let pre = null; // { fen, promise } – motorns värdering av ställningen innan ditt drag
  let pending = null; // drag som coachen varnar för

  view.innerHTML = `
    ${opts.title ? `<h1>${opts.title}</h1>` : ''}
    ${opts.goal ? `<div class="feedback info" style="margin-bottom:14px">${opts.goal}</div>` : ''}
    <div class="layout">
      <div class="board-col">
        <div class="player-bar" id="top"></div>
        <div id="board"></div>
        <div class="player-bar" id="bottom"></div>
        <div id="coachbox" class="feedback warn hidden"></div>
      </div>
      <div class="side">
        <div class="card">
          <div class="row"><h2 style="margin:0">${bot.face} ${bot.name}</h2><span class="pill">ca ${bot.elo}</span></div>
          <div id="status" class="feedback" style="margin-top:12px"></div>
          <div class="row" style="margin-top:12px">
            <button id="hint" title="Visa motorns bästa drag">💡 Tips</button>
            <button id="undo" title="Ta tillbaka ditt senaste drag">↶ Ångra</button>
            <button id="flip" title="Vänd brädet">⇅ Vänd</button>
            <button id="resign" title="Ge upp">🏳 Ge upp</button>
            <button id="coach" title="Coachen varnar innan du gör ett dåligt drag"></button>
            <button id="sound" title="Ljud av eller på"></button>
          </div>
        </div>
        <div class="card">
          <h3>Drag</h3>
          <div class="moves" id="moves"></div>
        </div>
        <div class="card hidden" id="endcard"></div>
      </div>
    </div>`;

  const board = new Board(view.querySelector('#board'), {
    orientation: userColor,
    movable: null,
    onMove: (m) => userMove(m),
  });

  const $ = (s) => view.querySelector(s);

  function persist() {
    if (!opts.persist) return;
    update((s) => {
      s.current = over ? null : { botId: bot.id, userColor, moves: chess.history() };
    });
  }

  function lastMove() {
    const h = chess.history({ verbose: true });
    const l = h[h.length - 1];
    return l ? { from: l.from, to: l.to } : null;
  }

  function render() {
    board.set(chess.fen(), { lastMove: lastMove() });
    board.setMovable(!over && !thinking && chess.turn() === userColor ? userColor : null);
    const mat = materialInfo(chess);
    const bar = (color, isUser) => {
      const diff = mat[color].value - mat[color === 'w' ? 'b' : 'w'].value;
      return `<span class="avatar">${isUser ? '🙋' : bot.face}</span>
        <span>${isUser ? 'Du' : bot.name}<span class="sub"> · ${color === 'w' ? 'vit' : 'svart'}</span></span>
        <span class="captured">${mat[color].captured}</span>${diff > 0 ? `<span class="sub">+${diff}</span>` : ''}
        ${!isUser && thinking ? '<span class="spinner"></span>' : ''}`;
    };
    const botColor = userColor === 'w' ? 'b' : 'w';
    const top = board.orientation === userColor ? botColor : userColor;
    $('#top').innerHTML = bar(top, top === userColor);
    $('#bottom').innerHTML = bar(top === userColor ? botColor : userColor, top !== userColor);

    const hist = chess.history();
    const startBlack = new Chess(startFen).turn() === 'b';
    const moveNo = parseInt(startFen.split(' ')[5], 10) || 1;
    let html = '';
    const all = startBlack ? ['…', ...hist] : hist;
    for (let i = 0; i < all.length; i += 2) {
      html += `<div class="num">${moveNo + i / 2}.</div><div class="mv">${all[i]}</div><div class="mv">${all[i + 1] || ''}</div>`;
    }
    $('#moves').innerHTML = html;
    $('#moves').scrollTop = 1e6;

    const status = $('#status');
    if (over) return;
    if (thinking) {
      status.className = 'feedback';
      status.textContent = `${bot.name} tänker…`;
    } else {
      status.className = 'feedback info';
      status.textContent = chess.inCheck() ? 'Du står i schack! Ditt drag.' : 'Ditt drag.';
    }
    $('#undo').disabled = thinking || chess.history().length < (userColor === 'w' ? 1 : 2);
    $('#hint').disabled = thinking;
    // Coachen förbereder sig medan du tänker
    if (coach && !thinking && chess.turn() === userColor && pre?.fen !== chess.fen()) {
      const fen = chess.fen();
      pre = { fen, promise: sharedEngine().analyse(fen, { depth: 11 }) };
    }
  }

  function renderCoachBtn() {
    $('#coach').textContent = coach ? '🛟 Coach: på' : '🛟 Coach: av';
    $('#coach').classList.toggle('primary', coach);
  }

  /** Coachen kollar draget innan det spelas. Returnerar true om draget kan spelas direkt. */
  async function coachCheck(m) {
    const fen = chess.fen();
    const temp = new Chess(fen);
    let mv;
    try { mv = temp.move(m); } catch { return true; }
    if (temp.isGameOver()) return true;
    board.set(temp.fen(), { lastMove: { from: mv.from, to: mv.to } });
    board.setMovable(null);
    $('#status').className = 'feedback';
    $('#status').innerHTML = '<span class="spinner"></span> Coachen tittar på draget…';
    const before = await (pre?.fen === fen ? pre.promise : sharedEngine().analyse(fen, { depth: 11 }));
    const after = await sharedEngine().analyse(temp.fen(), { depth: 11 });
    if (destroyed || chess.fen() !== fen || !before.lines[0] || !after.lines[0]) return true;
    const sign = userColor === 'w' ? 1 : -1;
    const cpBefore = toWhiteCp(before.lines[0].score, userColor);
    const cpAfter = toWhiteCp(after.lines[0].score, temp.turn());
    const wpB = winProb(sign * cpBefore);
    const wpA = winProb(sign * cpAfter);
    if (wpB - wpA < 0.15 || wpB < 0.12) return true;

    const d = diagnose(mv, { bestUci: before.bestmove, replyUci: after.bestmove, cpBefore, cpAfter });
    pending = m;
    const arrows = [];
    if (after.bestmove) arrows.push({ ...uciToMove(after.bestmove), color: 'red' });
    board.setArrows(arrows);
    const box = $('#coachbox');
    box.classList.remove('hidden');
    box.innerHTML = `<b>🛟 Vänta lite!</b> ${d?.text && d.type !== 'other' ? d.text : `<b>${mv.san}</b> försämrar din ställning mycket.${d?.text ? ' ' + d.text : ''}`}
      <div class="row" style="margin-top:10px">
        <button class="primary" id="rethink">↶ Tänk om</button>
        <button id="playanyway">Spela ändå</button>
      </div>`;
    $('#status').className = 'feedback info';
    $('#status').textContent = 'Coachen har en fundering…';
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    box.querySelector('#rethink').onclick = () => {
      coachSaves++;
      pending = null;
      box.classList.add('hidden');
      board.setArrows([]);
      render();
    };
    box.querySelector('#playanyway').onclick = () => {
      const pm = pending;
      pending = null;
      box.classList.add('hidden');
      board.setArrows([]);
      commitMove(pm);
    };
    return false;
  }

  async function userMove(m) {
    if (over || thinking || pending) return;
    if (coach && !(await coachCheck(m))) return;
    commitMove(m);
  }

  async function commitMove(m) {
    try {
      playMove(chess.move(m), chess);
    } catch {
      playSound('illegal');
      render();
      return;
    }
    board.setArrows([]);
    persist();
    if (checkEnd()) return;
    await botTurn();
  }

  async function botTurn() {
    thinking = true;
    render();
    const fen = chess.fen();
    const m = await botMove(engine, fen, bot);
    if (destroyed || fen !== chess.fen()) return;
    thinking = false;
    if (m) playMove(chess.move(m), chess);
    persist();
    if (!checkEnd()) render();
  }

  function checkEnd(resigned = false) {
    let result = null;
    let reason = '';
    if (resigned) {
      result = userColor === 'w' ? '0-1' : '1-0';
      reason = 'Du gav upp';
    } else if (chess.isCheckmate()) {
      result = chess.turn() === 'w' ? '0-1' : '1-0';
      reason = 'Schackmatt';
    } else if (chess.isStalemate()) { result = '1/2-1/2'; reason = 'Patt'; }
    else if (chess.isInsufficientMaterial()) { result = '1/2-1/2'; reason = 'Otillräckligt material'; }
    else if (chess.isThreefoldRepetition()) { result = '1/2-1/2'; reason = 'Trefaldig upprepning'; }
    else if (chess.isDrawByFiftyMoves()) { result = '1/2-1/2'; reason = '50-dragsregeln'; }
    if (!result) return false;

    over = true;
    const userWon = (result === '1-0' && userColor === 'w') || (result === '0-1' && userColor === 'b');
    const draw = result === '1/2-1/2';
    // Vänta in dragljudet innan partislutet hörs.
    playSound(userWon ? 'win' : draw ? 'draw' : 'loss', resigned ? 0 : 0.4);
    if (userWon) confetti();
    render();
    board.setMovable(null);
    persist();

    const status = $('#status');
    status.className = 'feedback ' + (userWon ? 'ok' : draw ? 'warn' : 'bad');
    status.innerHTML = `<b>${reason}.</b> ${userWon ? 'Du vann! 🎉' : draw ? 'Remi.' : `${bot.name} vann.`}`;

    chess.header('White', userColor === 'w' ? 'Du' : bot.name, 'Black', userColor === 'b' ? 'Du' : bot.name,
      'Result', result, 'Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'), 'Event', `Mot ${bot.name}`);
    if (startFen !== new Chess().fen()) chess.header('SetUp', '1', 'FEN', startFen);

    const now = Date.now();
    const gameMeta = {
      id: 'bot-' + now, source: 'bot', pgn: chess.pgn(), userColor, opponent: bot.name, opponentRating: bot.elo,
      timeClass: opts.onEnd ? 'Utmaning' : 'Mot bot', endTime: now, date: new Date(now).toLocaleDateString('sv-SE'),
      outcome: userWon ? 'win' : draw ? 'draw' : 'loss', opening: detectOpening(chess.history())?.name || '',
    };
    // Spara partiet i biblioteket och analysera det i bakgrunden.
    if (chess.history().length >= 6) {
      addGame(gameMeta);
      if (getState().settings.autoAnalyse !== false) enqueue([gameMeta]);
    }

    if (opts.onEnd) opts.onEnd({ result, userWon, draw, reason }, chess);
    else if (chess.history().length >= 2) {
      update((s) => {
        const r = (s.botResults[bot.id] ||= { w: 0, d: 0, l: 0 });
        r[userWon ? 'w' : draw ? 'd' : 'l']++;
      });
      unlock('first_game');
      if (userWon && hintsUsed === 0 && takebacks === 0 && coachSaves === 0) unlock('beat_' + bot.id);
    }

    const end = $('#endcard');
    end.classList.remove('hidden');
    end.innerHTML = `
      <h2>${userWon ? 'Snyggt spelat!' : draw ? 'Jämnt!' : 'Bra kämpat!'}</h2>
      <p class="muted">${userWon && (hintsUsed || takebacks || coachSaves) && !opts.onEnd ? 'Vinsten räknas inte som utmaning eftersom du fick hjälp (tips, ångra eller coachen) – men bra jobbat ändå! Prova utan hjälp nästa gång.' :
        'Titta på bedömningen för att se var partiet avgjordes och vad du kan göra bättre.'}</p>
      <div class="row">
        <button class="primary" id="review">📈 Bedöm partiet</button>
        ${opts.onNew ? '<button id="again">Nytt parti</button>' : ''}
        ${opts.onRetry ? '<button id="retry">Försök igen</button>' : ''}
      </div>`;
    end.querySelector('#review').onclick = () => {
      localStorage.setItem('schackcoach-review', JSON.stringify(gameMeta));
      location.hash = '#/analys/senaste';
    };
    end.querySelector('#again')?.addEventListener('click', () => opts.onNew());
    end.querySelector('#retry')?.addEventListener('click', () => opts.onRetry());
    return true;
  }

  $('#flip').onclick = () => { board.flip(); render(); };
  $('#coach').onclick = () => {
    coach = !coach;
    update((s) => { s.settings.coachMode = coach; });
    renderCoachBtn();
    render();
  };
  renderCoachBtn();
  const renderSoundBtn = () => { $('#sound').textContent = soundOn() ? '🔊 Ljud' : '🔇 Ljud'; };
  $('#sound').onclick = () => {
    update((s) => { s.settings.sound = !soundOn(); });
    renderSoundBtn();
    playSound('move');
  };
  renderSoundBtn();
  $('#resign').onclick = () => {
    if (over) return;
    if (confirm('Vill du ge upp partiet?')) {
      engine.stop();
      thinking = false;
      checkEnd(true);
    }
  };
  $('#undo').onclick = () => {
    if (over || thinking) return;
    chess.undo();
    if (chess.turn() !== userColor) chess.undo();
    takebacks++;
    board.setArrows([]);
    persist();
    render();
  };
  $('#hint').onclick = async () => {
    if (over || thinking || chess.turn() !== userColor) return;
    hintsUsed++;
    const btn = $('#hint');
    btn.disabled = true;
    const res = await sharedEngine().analyse(chess.fen(), { depth: 14 });
    btn.disabled = false;
    if (destroyed || !res.bestmove) return;
    const m = uciToMove(res.bestmove);
    board.setArrows([{ from: m.from, to: m.to, color: 'blue' }]);
  };

  engine.newGame();
  if (!opts.resume) playSound('start');
  render();
  if (!chess.isGameOver() && chess.turn() !== userColor) botTurn();
  else checkEnd();

  return () => {
    destroyed = true;
    engine.terminate();
    board.destroy();
  };
}
