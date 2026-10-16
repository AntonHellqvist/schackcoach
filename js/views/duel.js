// Kompisutmaning: alla löser samma pussel med klockan igång och jämför resultaten.
// Det finns ingen server – utmaningen och allas resultat ligger i själva länken som skickas runt.

import { Board } from '../board.js';
import { runPuzzle } from '../puzzle.js';
import { nextPuzzle, getPuzzle } from '../lichess.js';
import { getState, update } from '../store.js';
import { play as playSound } from '../sound.js';
import { confetti } from './play.js';

const LEVELS = { easiest: 'Lätt', normal: 'Medel', harder: 'Svår' };
const COUNTS = [3, 5, 10];
const MAX_PLAYERS = 20;

// ---------------------------------------------------------------- länkformat

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function encode(d) {
  const json = JSON.stringify(d);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Läser en utmaning ur länken. Allt kontrolleras, eftersom länken kan komma från vem som helst. */
function decode(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (d.v !== 1 || !Array.isArray(d.p) || !d.p.length || d.p.length > 20) return null;
    if (!d.p.every((id) => typeof id === 'string' && /^[A-Za-z0-9]{4,10}$/.test(id))) return null;
    const num = (x) => (Number.isFinite(x) && x >= 0 ? x : 0);
    const r = (Array.isArray(d.r) ? d.r : []).slice(0, MAX_PLAYERS).map((x) => ({
      i: String(x.i || '').slice(0, 12),
      n: String(x.n || '?').slice(0, 24),
      t: num(x.t), s: Math.min(num(x.s), d.p.length), e: num(x.e),
      d: (Array.isArray(x.d) ? x.d : []).slice(0, d.p.length).map((y) => [num(y?.[0]), num(y?.[1]), y?.[2] ? 1 : 0]),
    })).filter((x) => x.i);
    return { v: 1, p: d.p, l: LEVELS[d.l] ? d.l : 'normal', r };
  } catch {
    return null;
  }
}

const duelId = (d) => d.p.join('.');
const link = (d) => `${location.origin}${location.pathname}#/duell/${encode(d)}`;

/** Bästa först: flest lösta, sedan minst fel, sedan snabbast. */
const rank = (r) => [...r].sort((a, b) => b.s - a.s || a.e - b.e || a.t - b.t);

function fmtTime(ms) {
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1).replace('.', ',') + ' s';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function me() {
  let { playerId, playerName, chesscomUser } = getState().settings;
  if (!playerId) {
    playerId = Math.random().toString(36).slice(2, 10);
    update((s) => { s.settings.playerId = playerId; });
  }
  return { id: playerId, name: playerName || chesscomUser || '' };
}

/** Sparar utmaningen i din historik och slår ihop resultaten med det du redan har sett. */
function remember(d) {
  update((s) => {
    const list = (s.duels ||= []);
    const old = list.find((x) => x.id === duelId(d));
    const results = new Map((old?.r || []).map((x) => [x.i, x]));
    for (const x of d.r) results.set(x.i, x);
    const entry = { id: duelId(d), p: d.p, l: d.l, r: [...results.values()].slice(0, MAX_PLAYERS), at: old?.at || Date.now(), seen: Date.now() };
    if (old) Object.assign(old, entry);
    else list.unshift(entry);
    if (list.length > 30) list.length = 30;
  });
  return getState().duels.find((x) => x.id === duelId(d));
}

// ---------------------------------------------------------------- vyer

export function mount(view, [code]) {
  if (code) {
    const d = decode(code);
    if (!d) {
      view.innerHTML = `<h1>⚔️ Kompisutmaning</h1><div class="feedback bad">Länken verkar vara trasig. Be din kompis skicka den igen.</div>
        <p><a class="btn" href="#/duell">Till kompisutmaningar</a></p>`;
      return;
    }
    const saved = remember(d);
    const merged = { ...d, r: saved.r };
    if (merged.r.some((x) => x.i === me().id)) return showResults(view, merged);
    return showIntro(view, merged);
  }
  return showHome(view);
}

function nameField(value) {
  return `<div class="row"><label for="pname">Ditt namn</label>
    <input id="pname" value="${esc(value)}" placeholder="Så ser dina kompisar dig" maxlength="24" autocomplete="off" style="flex:1;min-width:160px"></div>`;
}

function readName(view) {
  const input = view.querySelector('#pname');
  const name = input.value.trim();
  if (!name) {
    input.focus();
    input.style.borderColor = 'var(--danger)';
    return null;
  }
  update((s) => { s.settings.playerName = name; });
  return name;
}

function showHome(view) {
  let count = 5;
  let level = 'normal';
  const duels = getState().duels || [];
  const myId = me().id;
  view.innerHTML = `
    <h1>⚔️ Kompisutmaning</h1>
    <p class="muted">Lös några pussel med klockan igång och skicka en länk till dina kompisar. De får exakt samma pussel –
      sedan ser ni vem som löste flest, med minst fel och snabbast.</p>
    <div class="card">
      <h2>Ny utmaning</h2>
      ${nameField(me().name)}
      <div class="row" style="margin-top:14px"><label>Antal pussel</label>
        <div class="tabs" id="count">${COUNTS.map((n) => `<button data-v="${n}">${n}</button>`).join('')}</div></div>
      <div class="row" style="margin-top:10px"><label>Svårighet</label>
        <div class="tabs" id="level">${Object.entries(LEVELS).map(([k, v]) => `<button data-v="${k}">${v}</button>`).join('')}</div></div>
      <div class="row" style="margin-top:16px"><button class="primary big" id="start">Starta – du löser först</button></div>
      <div id="msg" style="margin-top:10px"></div>
    </div>
    ${duels.length ? `<div class="card" style="margin-top:14px"><h2>Dina utmaningar</h2>
      ${duels.map((d) => {
        const ranked = rank(d.r);
        const pos = ranked.findIndex((x) => x.i === myId);
        const others = d.r.filter((x) => x.i !== myId).map((x) => esc(x.n));
        return `<a class="list-item" href="#/duell/${encode({ v: 1, p: d.p, l: d.l, r: d.r })}" style="color:inherit;text-decoration:none">
          <span style="font-size:1.4rem">${pos === 0 && d.r.length > 1 ? '👑' : '⚔️'}</span>
          <span style="flex:1;min-width:0"><b>${d.p.length} pussel · ${LEVELS[d.l]}</b><br>
            <span class="muted small">${others.length ? 'Mot ' + others.join(', ') : 'Väntar på kompisar'} · ${new Date(d.at).toLocaleDateString('sv-SE')}</span></span>
          ${pos >= 0 ? `<span class="pill ${pos === 0 ? 'ok' : ''}">${pos + 1} av ${d.r.length}</span>` : '<span class="pill warn">Ej spelad</span>'}
        </a>`;
      }).join('')}</div>` : ''}`;

  const $ = (s) => view.querySelector(s);
  const tabs = () => {
    $('#count').querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.v === count));
    $('#level').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === level));
  };
  $('#count').onclick = (e) => { const v = e.target.closest('button')?.dataset.v; if (v) { count = +v; tabs(); } };
  $('#level').onclick = (e) => { const v = e.target.closest('button')?.dataset.v; if (v) { level = v; tabs(); } };
  tabs();

  let destroyed = false;
  $('#start').onclick = async () => {
    const name = readName(view);
    if (!name) return;
    $('#start').disabled = true;
    $('#msg').innerHTML = '<span class="spinner"></span> Hämtar pussel från Lichess…';
    const puzzles = [];
    try {
      for (let tries = 0; puzzles.length < count && tries < count * 3; tries++) {
        const p = await nextPuzzle({ difficulty: level });
        if (!puzzles.some((x) => x.id === p.id)) puzzles.push(p);
      }
      if (puzzles.length < count) throw new Error('fick för få pussel');
    } catch (e) {
      if (destroyed) return;
      $('#msg').innerHTML = `<div class="feedback bad">Kunde inte hämta pussel (${esc(e.message)}). Kontrollera internetanslutningen.</div>`;
      $('#start').disabled = false;
      return;
    }
    if (destroyed) return;
    cleanup = playDuel(view, { v: 1, p: puzzles.map((p) => p.id), l: level, r: [] }, puzzles, name);
  };
  let cleanup = null;
  return () => { destroyed = true; cleanup?.(); };
}

function showIntro(view, d) {
  const names = d.r.map((x) => `<b>${esc(x.n)}</b>`);
  const who = names.length > 2 ? `${names.slice(0, -1).join(', ')} och ${names.at(-1)}` : names.join(' och ');
  view.innerHTML = `
    <h1>⚔️ Kompisutmaning</h1>
    <div class="card">
      <h2>${who || 'En kompis'} utmanar dig!</h2>
      <p><b>${d.p.length} pussel</b> · ${LEVELS[d.l]}. Lös dem så snabbt du kan och med så få fel som möjligt.
        Klockan startar när första pusslet visas. Resultaten visas när du är klar.</p>
      <p class="muted small">Vinnare: flest lösta pussel. Lika? Då vinner den med minst fel, och sedan den snabbaste.</p>
      ${nameField(me().name)}
      <div class="row" style="margin-top:16px"><button class="primary big" id="start">Jag antar utmaningen!</button></div>
      <div id="msg" style="margin-top:10px"></div>
    </div>`;
  let destroyed = false;
  let cleanup = null;
  view.querySelector('#start').onclick = async () => {
    const name = readName(view);
    if (!name) return;
    const btn = view.querySelector('#start');
    btn.disabled = true;
    view.querySelector('#msg').innerHTML = '<span class="spinner"></span> Hämtar pusslen…';
    let puzzles;
    try {
      puzzles = await Promise.all(d.p.map((id) => getPuzzle(id)));
    } catch (e) {
      if (destroyed) return;
      view.querySelector('#msg').innerHTML = `<div class="feedback bad">Kunde inte hämta pusslen (${esc(e.message)}). Kontrollera internetanslutningen.</div>`;
      btn.disabled = false;
      return;
    }
    if (destroyed) return;
    cleanup = playDuel(view, d, puzzles, name);
  };
  return () => { destroyed = true; cleanup?.(); };
}

function playDuel(view, d, puzzles, name) {
  view.innerHTML = `
    <div class="layout">
      <div class="board-col"><div id="board"></div></div>
      <div class="side">
        <div class="card">
          <div class="row"><div><div class="muted small">Pussel</div><div class="stat" id="num"></div></div>
            <span class="spacer"></span>
            <div style="text-align:right"><div class="muted small">Tid</div><div class="stat duel-clock" id="clock">0,0 s</div></div></div>
          <div class="duel-dots" id="dots"></div>
        </div>
        <div class="card">
          <div id="status" class="feedback"></div>
          <div class="row" style="margin-top:12px"><span class="muted small" id="errs"></span><span class="spacer"></span>
            <button id="giveup" class="ghost">Ge upp pusslet</button></div>
        </div>
      </div>
    </div>`;
  const $ = (s) => view.querySelector(s);
  const board = new Board($('#board'));
  const per = []; // [ms, fel, löst]
  let idx = -1;
  let runner = null;
  let started = 0;
  let errors = 0;
  let solving = false;
  let destroyed = false;
  const elapsed = () => per.reduce((a, x) => a + x[0], 0) + (solving ? performance.now() - started : 0);
  const tick = setInterval(() => { $('#clock').textContent = fmtTime(elapsed()); }, 100);

  function dots() {
    $('#dots').innerHTML = puzzles.map((_, i) => {
      const r = per[i];
      return `<span class="${r ? (r[2] ? (r[1] ? 'ok-late' : 'ok') : 'bad') : i === idx ? 'cur' : ''}"></span>`;
    }).join('');
  }

  function next() {
    runner?.destroy();
    idx++;
    if (idx >= puzzles.length) return finish();
    const p = puzzles[idx];
    errors = 0;
    $('#num').textContent = `${idx + 1} / ${puzzles.length}`;
    $('#errs').textContent = '';
    $('#giveup').disabled = false;
    board.setArrows([]);
    dots();
    runner = runPuzzle({
      board, fen: p.fen, solution: p.solution, lastMove: p.lastMove, mode: 'strict',
      onStatus: (type, html) => { $('#status').className = 'feedback ' + (type || ''); $('#status').innerHTML = html; },
      onWrong: () => { errors++; $('#errs').textContent = `${errors} fel`; playSound('wrong', 0.1); },
      onResult: ({ success }) => {
        if (!success || !solving) return;
        done(true);
      },
    });
    started = performance.now();
    solving = true;
  }

  function done(ok) {
    per.push([Math.round(performance.now() - started), errors, ok ? 1 : 0]);
    solving = false;
    $('#giveup').disabled = true;
    dots();
    if (ok) {
      playSound('correct');
      setTimeout(() => { if (!destroyed) next(); }, 900);
    }
  }

  $('#giveup').onclick = async () => {
    if (!solving) return;
    done(false);
    await runner.showSolution(); // visar lösningen drag för drag
    setTimeout(() => { if (!destroyed) next(); }, 1200);
  };

  function finish() {
    clearInterval(tick);
    const result = { i: me().id, n: name, t: per.reduce((a, x) => a + x[0], 0), s: per.filter((x) => x[2]).length, e: per.reduce((a, x) => a + x[1], 0), d: per };
    const out = { ...d, r: [...d.r.filter((x) => x.i !== result.i), result] };
    remember(out);
    try { sessionStorage.setItem('schackcoach-duel-done', duelId(out)); } catch { /* ignorera */ }
    location.hash = '#/duell/' + encode(out);
  }

  next();
  return () => {
    destroyed = true;
    clearInterval(tick);
    runner?.destroy();
    board.destroy();
  };
}

function showResults(view, d) {
  const myId = me().id;
  const ranked = rank(d.r);
  const mine = d.r.find((x) => x.i === myId);
  let justDone = false;
  try {
    justDone = sessionStorage.getItem('schackcoach-duel-done') === duelId(d);
    sessionStorage.removeItem('schackcoach-duel-done');
  } catch { /* ignorera */ }
  const alone = d.r.length === 1;
  const won = !alone && ranked[0].i === myId;
  const url = link(d);
  const shareText = alone
    ? `♞ Jag löste ${mine.s} av ${d.p.length} pussel på ${fmtTime(mine.t)}. Kan du slå mig?`
    : `♞ ${won ? 'Jag leder' : 'Min tur!'} – ${mine.s} av ${d.p.length} pussel på ${fmtTime(mine.t)}. Se resultatet:`;

  // Snabbast per pussel (bland dem som löste det)
  const fastest = d.p.map((_, i) => {
    const solved = d.r.filter((x) => x.d[i]?.[2]);
    return solved.length ? Math.min(...solved.map((x) => x.d[i][0])) : null;
  });

  view.innerHTML = `
    <div class="row" style="margin-bottom:10px"><a class="btn" href="#/duell">← Kompisutmaningar</a></div>
    <h1>${alone ? '✅ Klart!' : won ? '👑 Du leder!' : '⚔️ Resultat'}</h1>
    <div class="card">
      ${alone ? `<p>Du löste <b>${mine.s} av ${d.p.length}</b> pussel på <b>${fmtTime(mine.t)}</b> med <b>${mine.e}</b> fel.
        Skicka länken till dina kompisar så får de samma pussel.</p>` : ''}
      <table class="duel-table">
        <thead><tr><th></th><th>Spelare</th><th>Lösta</th><th>Fel</th><th>Tid</th></tr></thead>
        <tbody>${ranked.map((x, i) => `<tr class="${x.i === myId ? 'me' : ''}">
          <td>${i === 0 && !alone ? '👑' : i + 1}</td>
          <td><b>${esc(x.n)}</b>${x.i === myId ? ' <span class="muted small">(du)</span>' : ''}</td>
          <td>${x.s} / ${d.p.length}</td><td>${x.e}</td><td>${fmtTime(x.t)}</td></tr>`).join('')}</tbody>
      </table>
      <p class="muted small" style="margin:10px 0 0">Flest lösta vinner. Lika? Då vinner den med minst fel, och sedan den snabbaste.</p>
    </div>
    ${!alone ? `<div class="card" style="margin-top:14px"><h3>Pussel för pussel</h3>
      <div style="overflow-x:auto"><table class="duel-table small">
        <thead><tr><th>#</th>${ranked.map((x) => `<th>${esc(x.n)}</th>`).join('')}</tr></thead>
        <tbody>${d.p.map((_, i) => `<tr><td>${i + 1}</td>${ranked.map((x) => {
          const r = x.d[i];
          if (!r) return '<td class="muted">–</td>';
          if (!r[2]) return '<td class="muted">✗ gav upp</td>';
          return `<td class="${r[0] === fastest[i] ? 'best' : ''}">${r[0] === fastest[i] ? '⚡ ' : ''}${fmtTime(r[0])}${r[1] ? ` <span class="muted">(${r[1]} fel)</span>` : ''}</td>`;
        }).join('')}</tr>`).join('')}</tbody>
      </table></div></div>` : ''}
    <div class="card" style="margin-top:14px">
      <h3>📤 ${alone ? 'Utmana en kompis' : 'Skicka vidare'}</h3>
      <p class="muted small" style="margin-top:0">${alone
        ? 'Skicka länken. När din kompis har spelat får hen en ny länk med båda era resultat – be hen skicka tillbaka den så ser du vem som vann.'
        : 'Länken innehåller allas resultat hittills. Skicka den till den du spelar mot, eller till fler kompisar som också vill vara med.'}</p>
      <div class="row">
        <button class="primary" id="share">📤 Dela länken</button>
        <button id="copy">📋 Kopiera länken</button>
        <span class="small" id="copied"></span>
      </div>
      <input id="url" readonly value="${esc(url)}" style="width:100%;margin-top:10px;font-size:.8rem">
    </div>
    <div class="row" style="margin-top:14px"><a class="btn" href="#/duell">⚔️ Ny utmaning</a></div>`;

  const $ = (s) => view.querySelector(s);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${shareText} ${url}`); }
    catch { $('#url').select(); document.execCommand?.('copy'); }
    $('#copied').textContent = '✓ Kopierad';
  };
  $('#copy').onclick = copy;
  $('#share').onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Schackcoach – kompisutmaning', text: shareText, url }); } catch { /* avbrutet */ }
    } else copy();
  };
  $('#url').onclick = (e) => e.target.select();
  if (justDone) {
    if (won || (alone && mine.s === d.p.length)) { confetti(); playSound('win'); }
    else playSound(alone ? 'draw' : 'loss');
  }
}
