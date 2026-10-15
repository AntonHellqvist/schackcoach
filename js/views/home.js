import { getState, update } from '../store.js';
import { ACHIEVEMENTS } from '../achievements.js';
import { libraryGames, onLibraryChange, syncChesscom } from '../library.js';
import { getAnalysis, onQueueChange, enqueue } from '../analyzer.js';

export function mount(view) {
  const s = getState();
  const done = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
  const reviewed = s.games.filter((g) => g.accuracy != null && g.userColor);
  const avgAcc = reviewed.length ? Math.round(reviewed.slice(-10).reduce((a, g) => a + g.accuracy, 0) / Math.min(10, reviewed.length)) : null;
  const openMistakes = s.mistakes.filter((m) => !m.solved).length;
  const next = ACHIEVEMENTS.find((a) => !s.achievements[a.id]);

  view.innerHTML = `
    <div class="card hero" style="margin-bottom:16px">
      <h1>Välkommen tillbaka! ♞</h1>
      <p class="muted">Spela, analysera och träna. Varje parti du bedömer gör din träning mer personlig.</p>
      <div class="row">
        <a class="btn primary" href="#/spela">♟ Spela mot bot</a>
        <a class="btn" href="#/pussel">🧩 Lös pussel</a>
        <a class="btn" href="#/analys">📈 Mina partier</a>
      </div>
    </div>
    ${s.settings.chesscomUser ? '' : `<div class="card" id="connect" style="margin-bottom:16px">
      <h2>🔗 Koppla ditt Chess.com-konto</h2>
      <p class="muted small">Då hämtas dina partier automatiskt och analyseras i bakgrunden.</p>
      <div class="row"><input id="ccuser" placeholder="Användarnamn på Chess.com" autocomplete="off" style="width:220px">
        <button class="primary" id="ccgo">Koppla</button><span class="small" id="ccmsg"></span></div>
    </div>`}
    <div class="grid">
      <div class="card"><div class="muted small">Pusselrating</div><div class="stat">${Math.round(s.puzzle.rating)}</div>
        <div class="muted small">${s.puzzle.solved} lösta pussel</div></div>
      <div class="card"><div class="muted small">Snitt träffsäkerhet (senaste 10)</div><div class="stat">${avgAcc != null ? avgAcc + ' %' : '–'}</div>
        <div class="muted small">${reviewed.length} analyserade partier</div></div>
      <div class="card"><div class="muted small">Egna misstag att träna på</div><div class="stat">${openMistakes}</div>
        <a class="small" href="#/pussel/mistakes">Träna nu →</a></div>
      <div class="card"><div class="muted small">Utmaningar klara</div><div class="stat">${done} / ${ACHIEVEMENTS.length}</div>
        ${next ? `<a class="small" href="${next.link}">Nästa: ${next.icon} ${next.title} →</a>` : '<span class="small">Alla klara! 🏆</span>'}</div>
    </div>
    <div class="row" style="margin-top:24px"><h2 style="margin:0">Senaste partier</h2><span class="spacer"></span><a class="small" href="#/analys">Visa alla →</a></div>
    <div class="card" id="recent" style="margin-top:10px"></div>
    <h2 style="margin-top:24px">Lär dig</h2>
    <div class="grid">
      <a class="card" href="#/oppningar" style="text-decoration:none;color:inherit"><h3>📖 Öppningar</h3>
        <p class="muted small">Lär dig populära öppningar och idéerna bakom dragen – träna tills de sitter.</p></a>
      <a class="card" href="#/matter" style="text-decoration:none;color:inherit"><h3>♚ Snygga matter</h3>
        <p class="muted small">Klassiska mattmönster som kvävningsmatt, Anastasias matt och Bodens matt.</p></a>
      <a class="card" href="#/utmaningar" style="text-decoration:none;color:inherit"><h3>🏆 Utmaningar</h3>
        <p class="muted small">Pusselrush, slutspelsmatter mot Stockfish och bottar att besegra.</p></a>
      <a class="card" href="#/utveckling" style="text-decoration:none;color:inherit"><h3>📊 Min utveckling</h3>
        <p class="muted small">Se hur din träffsäkerhet och rating utvecklas, och vilka öppningar som går bäst.</p></a>
    </div>`;

  const renderRecent = () => {
    const games = libraryGames().slice(0, 5);
    view.querySelector('#recent').innerHTML = games.length ? games.map((g) => {
      const a = getAnalysis(g.id);
      return `<a class="list-item" href="#/analys/g:${encodeURIComponent(g.id)}" style="color:inherit;text-decoration:none">
        <span class="result ${g.outcome}">${g.outcome === 'win' ? 'V' : g.outcome === 'loss' ? 'F' : 'R'}</span>
        <span style="flex:1;min-width:0"><b>${g.opponent || '?'}</b>${g.opponentRating ? ` <span class="muted">(${g.opponentRating})</span>` : ''}
          <br><span class="muted small">${g.timeClass || ''} · ${g.date || ''}</span></span>
        ${a ? `<span class="pill ok">${a.accuracy} %</span>` : '<span class="pill">Analysera</span>'}</a>`;
    }).join('') : '<p class="muted small" style="margin:0">Inga partier än – synka med Chess.com under <a href="#/analys">Mina partier</a> eller spela mot en bot.</p>';
  };
  renderRecent();
  const connect = async () => {
    const user = view.querySelector('#ccuser').value.trim();
    if (!user) return;
    update((st) => { st.settings.chesscomUser = user; });
    view.querySelector('#ccmsg').innerHTML = '<span class="spinner"></span> Hämtar partier…';
    try {
      const { added } = await syncChesscom({ force: true });
      enqueue([...added].sort((a, b) => b.endTime - a.endTime).slice(0, 5));
      view.querySelector('#connect')?.remove();
    } catch (e) {
      update((st) => { st.settings.chesscomUser = ''; });
      view.querySelector('#ccmsg').innerHTML = `<span style="color:var(--danger)">${e.message}</span>`;
    }
  };
  view.querySelector('#ccgo')?.addEventListener('click', connect);
  view.querySelector('#ccuser')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
  const off1 = onLibraryChange(renderRecent);
  const off2 = onQueueChange(renderRecent);
  return () => { off1(); off2(); };
}
