import { getState, resetAll } from '../store.js';
import { BOTS } from '../bots.js';
import { themeName } from '../lichess.js';
import { CLASSES } from '../analysis.js';
import { libraryGames } from '../library.js';
import { MISTAKE_TYPES } from '../coach.js';
import { backfillMistakeTypes } from '../analyzer.js';

function lineChart(values, { min, max, color = 'var(--accent)', height = 140, labels = [] } = {}) {
  if (values.length < 2) return '<p class="muted small">För lite data än – fortsätt träna så dyker grafen upp!</p>';
  const W = 600, H = height, P = 24;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const x = (i) => P + (i / (values.length - 1)) * (W - P * 2);
  const y = (v) => H - P - ((v - lo) / span) * (H - P * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grid = [lo, (lo + hi) / 2, hi].map((v) => `
    <line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" stroke="#45413d" stroke-width="1"/>
    <text x="2" y="${y(v) + 4}" fill="#a8a29a" font-size="11">${Math.round(v)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}">${grid}
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${color}"><title>${labels[i] || ''} ${Math.round(v)}</title></circle>`).join('')}
  </svg>`;
}

export function mount(view) {
  // Äldre analyser saknar misstagstyper – räkna fram dem och rita om.
  let alive = true;
  backfillMistakeTypes().then((n) => { if (n && alive) render(view); });
  render(view);
  return () => { alive = false; };
}

function render(view) {
  const s = getState();
  const games = s.games.filter((g) => g.accuracy != null);
  const accs = games.slice(-20).map((g) => g.accuracy);
  const half = Math.floor(games.length / 2);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const early = avg(games.slice(0, half).map((g) => g.accuracy));
  const late = avg(games.slice(half).map((g) => g.accuracy));

  const ratingHist = s.puzzle.history.map((h) => h.r);
  const ratingPts = ratingHist.length > 60 ? ratingHist.filter((_, i) => i % Math.ceil(ratingHist.length / 60) === 0).concat(ratingHist.at(-1)) : ratingHist;

  // Öppningar
  const byOpening = new Map();
  for (const g of games) {
    const k = (g.opening || 'Okänd') + '|' + g.userColor;
    const o = byOpening.get(k) || { name: g.opening || 'Okänd', color: g.userColor, n: 0, w: 0, d: 0, l: 0, acc: [] };
    o.n++;
    const won = (g.result === '1-0' && g.userColor === 'w') || (g.result === '0-1' && g.userColor === 'b');
    const draw = g.result === '1/2-1/2';
    if (won) o.w++; else if (draw) o.d++; else o.l++;
    o.acc.push(g.accuracy);
    byOpening.set(k, o);
  }
  const openings = [...byOpening.values()].sort((a, b) => b.n - a.n).slice(0, 12);

  // Teman
  const themes = Object.entries(s.puzzle.themes)
    .filter(([t, v]) => v.s + v.f >= 3 && !['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'crushing', 'advantage', 'middlegame', 'mate'].includes(t))
    .map(([t, v]) => ({ t, rate: v.s / (v.s + v.f), n: v.s + v.f }))
    .sort((a, b) => a.rate - b.rate);
  const weakest = themes.slice(0, 3);
  const strongest = [...themes].reverse().slice(0, 3);

  // Misstag per parti
  const totals = games.reduce((a, g) => { a.b += g.counts?.blunder || 0; a.m += g.counts?.mistake || 0; a.i += g.counts?.inaccuracy || 0; return a; }, { b: 0, m: 0, i: 0 });

  // Chess.com-rating och resultat per tidskontroll
  const cc = libraryGames().filter((g) => g.source === 'chesscom').reverse();
  const byTime = {};
  for (const g of cc) {
    const t = (byTime[g.timeClass] ||= { ratings: [], dates: [], w: 0, d: 0, l: 0 });
    if (g.rating) { t.ratings.push(g.rating); t.dates.push(g.date); }
    t[g.outcome === 'win' ? 'w' : g.outcome === 'draw' ? 'd' : 'l']++;
  }
  const timeClasses = Object.entries(byTime).sort((a, b) => b[1].ratings.length - a[1].ratings.length);
  const ratingCharts = timeClasses.filter(([, t]) => t.ratings.length >= 2).slice(0, 3).map(([name, t]) => {
    const first = t.ratings[0], last = t.ratings.at(-1);
    return `<div class="card chart"><div class="row"><h3 style="margin:0">Chess.com ${name}</h3><span class="spacer"></span>
      <span class="stat" style="font-size:1.3rem">${last}</span><span class="pill ${last >= first ? 'ok' : 'warn'}">${last >= first ? '+' : ''}${last - first}</span></div>
      <div class="muted small" style="margin-bottom:6px">${t.w} vinster · ${t.d} remier · ${t.l} förluster</div>
      ${lineChart(t.ratings, { labels: t.dates, color: 'var(--accent)' })}</div>`;
  }).join('');

  // Vanligaste misstagen
  const typeTotals = {};
  for (const g of games) for (const [t, n] of Object.entries(g.mistakeTypes || {})) typeTotals[t] = (typeTotals[t] || 0) + n;
  const typeSum = Object.values(typeTotals).reduce((a, b) => a + b, 0);
  const typeRows = Object.entries(typeTotals).sort((a, b) => b[1] - a[1]);
  const topType = typeRows.find(([t]) => t !== 'other');

  // Rekommendationer
  const tips = [];
  const unsolved = s.mistakes.filter((m) => !m.solved).length;
  if (!games.length) tips.push(['📈', 'Analysera ditt första parti', 'Hämta dina partier från Chess.com eller spela mot en bot och få dem bedömda.', '#/analys']);
  if (unsolved) tips.push(['🔁', `Träna på ${unsolved} egna misstag`, 'Det snabbaste sättet att bli bättre är att lära av sina egna fel.', '#/pussel/mistakes']);
  if (topType && typeSum >= 5) tips.push(['🎯', `Ditt vanligaste misstag: ${MISTAKE_TYPES[topType[0]].name.toLowerCase()}`,
    `${Math.round((topType[1] / typeSum) * 100)} % av dina misstag. ${MISTAKE_TYPES[topType[0]].tip}`, '#/traning']);
  if (games.length && totals.b / games.length >= 1.5) tips.push(['🛡️', 'Färre blunders', `Du gör i snitt ${(totals.b / games.length).toFixed(1)} blunders per parti. Innan varje drag: fråga dig "vad hotar motståndaren?" och "är min pjäs skyddad?".`, '#/pussel']);
  if (weakest[0] && weakest[0].rate < 0.6) tips.push(['🧩', `Öva på ${themeName(weakest[0].t).toLowerCase()}`, `Du löser ${Math.round(weakest[0].rate * 100)} % av pusslen med detta tema.`, '#/pussel']);
  const badOpening = openings.find((o) => o.n >= 3 && o.l / o.n > 0.6);
  if (badOpening) tips.push(['📖', `Se över ${badOpening.name}`, `Du har förlorat ${badOpening.l} av ${badOpening.n} partier med ${badOpening.color === 'w' ? 'vit' : 'svart'} i den här öppningen.`, '#/oppningar']);
  if (Object.keys(s.mates).length < 5) tips.push(['♚', 'Lär dig mattmönstren', 'Känner du igen mönstren hittar du matterna i dina egna partier.', '#/matter']);

  view.innerHTML = `
    <h1>Min utveckling</h1>
    <p class="muted">Allt sparas lokalt i din webbläsare.</p>
    ${early != null && late != null && games.length >= 4 ? `<div class="feedback ${late >= early ? 'ok' : 'info'}" style="margin-bottom:14px">
      ${late >= early ? `Din träffsäkerhet har ökat från <b>${early.toFixed(1)} %</b> till <b>${late.toFixed(1)} %</b>. Snyggt jobbat! 📈` :
      `Din träffsäkerhet ligger på <b>${late.toFixed(1)} %</b> i de senaste partierna (tidigare ${early.toFixed(1)} %). Upp- och nedgångar är helt normala – fortsätt träna!`}</div>` : ''}
    <div class="grid">
      <div class="card"><div class="muted small">Pusselrating</div><div class="stat">${Math.round(s.puzzle.rating)}</div><div class="muted small">${s.puzzle.solved} lösta · ${s.puzzle.failed} missade</div></div>
      <div class="card"><div class="muted small">Analyserade partier</div><div class="stat">${games.length}</div><div class="muted small">Snitt ${avg(games.map((g) => g.accuracy))?.toFixed(1) ?? '–'} % träffsäkerhet</div></div>
      <div class="card"><div class="muted small">Per parti (snitt)</div><div class="stat" style="font-size:1.2rem;margin-top:8px">
        <span class="cls cls-blunder">??</span> ${games.length ? (totals.b / games.length).toFixed(1) : '–'}
        &nbsp;<span class="cls cls-mistake">?</span> ${games.length ? (totals.m / games.length).toFixed(1) : '–'}
        &nbsp;<span class="cls cls-inaccuracy">?!</span> ${games.length ? (totals.i / games.length).toFixed(1) : '–'}</div>
        <div class="muted small">${CLASSES.blunder.name} · ${CLASSES.mistake.name} · ${CLASSES.inaccuracy.name}</div></div>
    </div>

    ${tips.length ? `<h2 style="margin-top:22px">Coachens förslag</h2><div class="grid">${tips.slice(0, 4).map(([i, t, d, h]) => `
      <a class="card" href="${h}" style="text-decoration:none;color:inherit"><div style="font-size:1.6rem">${i}</div><h3>${t}</h3><p class="muted small" style="margin:0">${d}</p></a>`).join('')}</div>` : ''}

    ${ratingCharts ? `<div class="grid" style="margin-top:22px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">${ratingCharts}</div>` : ''}
    <div class="grid" style="margin-top:14px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="card chart"><h3>Träffsäkerhet (senaste 20 partierna)</h3>${lineChart(accs, { min: 0, max: 100, labels: games.slice(-20).map((g) => g.date) })}</div>
      <div class="card chart"><h3>Pusselrating</h3>${lineChart(ratingPts, { color: 'var(--info)' })}</div>
    </div>

    <div class="card" style="margin-top:14px"><h3>Dina vanligaste misstag</h3>
      ${typeSum ? `<p class="muted small">Från ${games.length} analyserade partier (${typeSum} misstag och blunders).</p>
      ${typeRows.map(([t, n]) => `<div style="margin:10px 0">
        <div class="row" style="justify-content:space-between"><b>${MISTAKE_TYPES[t]?.name || t}</b><span class="muted small">${n} st · ${Math.round((n / typeSum) * 100)} %</span></div>
        <div class="progress" style="margin:4px 0"><div style="width:${(n / typeSum) * 100}%;background:${t === 'other' ? 'var(--muted)' : 'var(--c-mistake)'}"></div></div>
        ${t !== 'other' ? `<div class="muted small">💡 ${MISTAKE_TYPES[t].tip}</div>` : ''}</div>`).join('')}` :
      '<p class="muted small">Analysera några partier så visar coachen vilka typer av misstag du gör oftast.</p>'}
    </div>

    <div class="grid" style="margin-top:14px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="card"><h3>Öppningar</h3>${openings.length ? `<table class="summary-table" style="font-size:.9rem">
        <tr class="muted"><td style="text-align:left">Öppning</td><td>Partier</td><td>V/R/F</td><td>Träffs.</td></tr>
        ${openings.map((o) => `<tr><td style="text-align:left;font-weight:500;width:auto">${o.color === 'w' ? '♔' : '♚'} ${o.name}</td><td>${o.n}</td>
          <td style="width:80px">${o.w}/${o.d}/${o.l}</td><td>${avg(o.acc).toFixed(0)} %</td></tr>`).join('')}</table>` : '<p class="muted small">Analysera partier för att se hur det går i dina öppningar.</p>'}</div>
      <div class="card"><h3>Pusselteman</h3>${themes.length ? `
        <div class="small muted">Starkast</div><div class="row" style="margin:4px 0 10px">${strongest.map((t) => `<span class="pill ok">${themeName(t.t)} ${Math.round(t.rate * 100)} %</span>`).join('')}</div>
        <div class="small muted">Att öva på</div><div class="row" style="margin-top:4px">${weakest.map((t) => `<span class="pill warn">${themeName(t.t)} ${Math.round(t.rate * 100)} %</span>`).join('')}</div>` :
        '<p class="muted small">Lös fler pussel för att se dina starka och svaga teman.</p>'}</div>
      <div class="card"><h3>Mot bottarna</h3><table class="summary-table" style="font-size:.9rem">
        ${BOTS.map((b) => { const r = s.botResults[b.id] || { w: 0, d: 0, l: 0 }; return `<tr><td style="text-align:left;width:auto;font-weight:500">${b.face} ${b.name} <span class="muted">(${b.elo})</span></td>
          <td class="result win">${r.w}</td><td class="result draw">${r.d}</td><td class="result loss">${r.l}</td></tr>`; }).join('')}
      </table></div>
    </div>
    <div style="margin-top:28px"><button id="reset" class="ghost small">Nollställ all data</button></div>`;

  view.querySelector('#reset').onclick = () => {
    if (confirm('Detta raderar all din statistik, alla analyserade partier och utmaningar. Är du säker?')) {
      resetAll();
      location.reload();
    }
  };
}
