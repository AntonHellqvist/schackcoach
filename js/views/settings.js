import { getState, update, resetAll } from '../store.js';
import { connect, disconnect, syncNow, onSyncStatus, syncConfig } from '../sync.js';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Schackcoach%20synk';

export function mount(view) {
  const s = getState();
  view.innerHTML = `
    <h1>Inställningar</h1>

    <div class="card">
      <h2>☁️ Synka mellan enheter</h2>
      <div id="syncpane"></div>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>♟ Chess.com</h2>
      <div class="row"><label for="ccuser">Användarnamn</label>
        <input id="ccuser" value="${s.settings.chesscomUser || ''}" placeholder="t.ex. Antonhellq" autocomplete="off" style="width:200px">
        <button id="ccsave">Spara</button><span class="small muted" id="ccmsg"></span></div>
      <label class="row small" style="margin-top:12px;font-weight:500;cursor:pointer">
        <input type="checkbox" id="auto" ${s.settings.autoAnalyse !== false ? 'checked' : ''}> Analysera nya partier automatiskt i bakgrunden</label>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>🛟 Coachen</h2>
      <label class="row small" style="font-weight:500;cursor:pointer">
        <input type="checkbox" id="coach" ${s.settings.coachMode !== false ? 'checked' : ''}> Varna innan jag gör ett dåligt drag mot bottarna</label>
      <p class="muted small" style="margin:8px 0 0">Coachen säger till om ett drag tappar en pjäs eller ger motståndaren matt, och låter dig tänka om. Vinster med coachens hjälp räknas inte som utmaningar.</p>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>🗑 Data</h2>
      <p class="muted small">All data sparas i den här webbläsaren${syncConfig().enabled ? ' och synkas till din GitHub' : ''}.</p>
      <button id="reset" class="ghost">Nollställ data på den här enheten</button>
    </div>`;

  const $ = (q) => view.querySelector(q);
  $('#ccsave').onclick = () => {
    update((st) => { st.settings.chesscomUser = $('#ccuser').value.trim(); });
    $('#ccmsg').textContent = '✓ Sparat';
  };
  $('#auto').onchange = (e) => update((st) => { st.settings.autoAnalyse = e.target.checked; });
  $('#coach').onchange = (e) => update((st) => { st.settings.coachMode = e.target.checked; });
  $('#reset').onclick = () => {
    const extra = syncConfig().enabled ? ' Synken är påslagen, så data som redan finns på GitHub kommer tillbaka vid nästa synk – koppla från synken först om du vill börja helt om.' : '';
    if (confirm('Detta raderar all statistik, analyser och utmaningar på den här enheten.' + extra + ' Fortsätt?')) {
      resetAll();
      location.reload();
    }
  };

  const pane = $('#syncpane');
  const off = onSyncStatus((st) => renderSync(pane, st));
  return off;
}

function renderSync(pane, st) {
  const cfg = syncConfig();
  if (!cfg.enabled) {
    pane.innerHTML = `
      <p class="muted">Koppla appen till ditt GitHub-konto så följer pusselrating, analyser, utmaningar och streak med mellan mobilen och datorn.
        Datan sparas i en hemlig gist i ditt eget konto.</p>
      <ol style="padding-left:20px;margin:0 0 12px">
        <li><a href="${TOKEN_URL}" target="_blank" rel="noopener">Skapa en nyckel på GitHub ↗</a> – rutan <b>gist</b> är redan ikryssad. Välj gärna <i>No expiration</i> under Expiration och tryck <b>Generate token</b>.</li>
        <li>Kopiera nyckeln (börjar med <code>ghp_</code>) och klistra in den här.</li>
        <li>Gör samma sak på din andra enhet – samma nyckel fungerar. Med Mac och iPhone kan du kopiera på datorn och klistra in på mobilen.</li>
      </ol>
      <div class="row">
        <input id="token" type="password" placeholder="ghp_…" autocomplete="off" style="flex:1;min-width:200px">
        <button class="primary" id="connect">Koppla</button>
      </div>
      <div id="syncmsg" style="margin-top:10px"></div>`;
    const go = async () => {
      const token = pane.querySelector('#token').value.trim();
      if (!token) return;
      pane.querySelector('#connect').disabled = true;
      pane.querySelector('#syncmsg').innerHTML = '<span class="spinner"></span> Kopplar…';
      try {
        await connect(token);
      } catch (e) {
        const msg = pane.querySelector('#syncmsg');
        if (msg) msg.innerHTML = `<div class="feedback bad">${e.message}</div>`;
        const btn = pane.querySelector('#connect');
        if (btn) btn.disabled = false;
      }
    };
    pane.querySelector('#connect').onclick = go;
    pane.querySelector('#token').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    return;
  }
  const when = cfg.lastSync ? new Date(cfg.lastSync).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : 'aldrig';
  pane.innerHTML = `
    <div class="feedback ${st.state === 'error' ? 'bad' : 'ok'}">
      ${st.state === 'syncing' ? '<span class="spinner"></span> Synkar…' : st.state === 'error' ? `⚠️ ${st.message}` : '✓ Synken är påslagen'}
      <div class="small muted" style="margin-top:4px">Kopplad till GitHub-kontot <b>${cfg.login || '?'}</b> · senast synkad ${when}</div>
    </div>
    <p class="muted small" style="margin:10px 0">Appen synkar automatiskt när du öppnar den, när du byter tillbaka till den och strax efter att du tränat.</p>
    <div class="row"><button id="now">↻ Synka nu</button><button id="off" class="ghost">Koppla från den här enheten</button></div>`;
  pane.querySelector('#now').onclick = () => syncNow();
  pane.querySelector('#off').onclick = () => {
    if (confirm('Koppla från synken på den här enheten? Din data finns kvar både här och på GitHub.')) disconnect();
  };
}
