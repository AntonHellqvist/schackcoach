import { getState, update, resetAll } from '../store.js';
import { connect, disconnect, syncNow, onSyncStatus, syncConfig } from '../sync.js';
import { play as playSound, soundOn } from '../sound.js';
import { BOARD_THEMES, boardTheme } from '../themes.js';

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
      <h2>🎨 Bräde</h2>
      <div class="theme-grid" id="themes"></div>
      <label class="row small" style="margin-top:14px;font-weight:500;cursor:pointer">
        <input type="checkbox" id="anim" ${s.settings.animations !== false ? 'checked' : ''}> Animationer (pjäser som glider, konfetti när du vinner)</label>
    </div>

    <div class="card" style="margin-top:14px">
      <h2>🔊 Ljud</h2>
      <label class="row small" style="font-weight:500;cursor:pointer">
        <input type="checkbox" id="sound" ${soundOn() ? 'checked' : ''}> Spela ljud under partierna</label>
      <p class="muted small" style="margin:8px 0 0">Träklick när pjäserna flyttas, ett skarpare klick vid slag, en egen signal när en kung står i schack och en ton när partiet börjar och slutar. På iPhone hörs inget om ljudet är avstängt med knappen på sidan.</p>
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
  const themes = $('#themes');
  const renderThemes = () => {
    themes.innerHTML = BOARD_THEMES.map((t) => `
      <button type="button" data-id="${t.id}" class="${t.id === boardTheme() ? 'active' : ''}">
        <span class="theme-swatch" style="--l:${t.light};--d:${t.dark}"><img src="vendor/pieces/wN.svg" alt=""><img src="vendor/pieces/bK.svg" alt=""></span>
        ${t.name}
      </button>`).join('');
  };
  themes.onclick = (e) => {
    const id = e.target.closest('button')?.dataset.id;
    if (!id) return;
    update((st) => { st.settings.boardTheme = id; });
    renderThemes();
  };
  renderThemes();
  $('#anim').onchange = (e) => update((st) => { st.settings.animations = e.target.checked; });
  $('#sound').onchange = (e) => {
    update((st) => { st.settings.sound = e.target.checked; });
    playSound('check');
  };
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

function tokenForm(button) {
  return `
      <div class="row">
        <input id="token" type="password" placeholder="ghp_…" autocomplete="off" style="flex:1;min-width:200px">
        <button class="primary" id="connect">${button}</button>
      </div>
      <div id="syncmsg" style="margin-top:10px"></div>`;
}

/** Kopplar knappen och fältet i tokenForm(). */
function wireTokenForm(pane) {
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
}

function wireDisconnect(pane) {
  pane.querySelector('#off').onclick = () => {
    if (confirm('Koppla från synken på den här enheten? Din data finns kvar både här och på GitHub.')) disconnect();
  };
}

const fmtDate = (t) => new Date(t).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

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
      ${tokenForm('Koppla')}`;
    wireTokenForm(pane);
    return;
  }
  if (cfg.expired) {
    pane.innerHTML = `
      <div class="feedback bad">⚠️ <b>Synken har stannat – din GitHub-nyckel har gått ut.</b>
        <div class="small muted" style="margin-top:4px">Dina framsteg finns kvar här och på GitHub. När du kopplar en ny nyckel fortsätter synken där den slutade.</div>
      </div>
      <ol style="padding-left:20px;margin:12px 0">
        <li><a href="${TOKEN_URL}" target="_blank" rel="noopener">Skapa en ny nyckel på GitHub ↗</a> – rutan <b>gist</b> är redan ikryssad. Välj <i>No expiration</i> under Expiration så slipper du göra om det här, och tryck <b>Generate token</b>.</li>
        <li>Kopiera nyckeln och klistra in den här.</li>
        <li>Byt nyckel på din andra enhet också – den gamla slutar fungera där med.</li>
      </ol>
      ${tokenForm('Byt nyckel')}
      <div class="row" style="margin-top:6px"><button id="off" class="ghost">Koppla från den här enheten</button></div>`;
    wireTokenForm(pane);
    wireDisconnect(pane);
    return;
  }
  const when = cfg.lastSync ? new Date(cfg.lastSync).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : 'aldrig';
  const soon = cfg.expires && cfg.expires - Date.now() < 7 * 864e5;
  pane.innerHTML = `
    <div class="feedback ${st.state === 'error' ? 'bad' : soon ? 'warn' : 'ok'}">
      ${st.state === 'syncing' ? '<span class="spinner"></span> Synkar…' : st.state === 'error' ? `⚠️ ${st.message}` : '✓ Synken är påslagen'}
      <div class="small muted" style="margin-top:4px">Kopplad till GitHub-kontot <b>${cfg.login || '?'}</b> · senast synkad ${when}</div>
      ${cfg.expires ? `<div class="small${soon ? '' : ' muted'}" style="margin-top:4px">🔑 Nyckeln går ut ${fmtDate(cfg.expires)}${soon ? ' – byt till en ny nedan' : ''}</div>` : ''}
    </div>
    <p class="muted small" style="margin:10px 0">Appen synkar automatiskt när du öppnar den, när du byter tillbaka till den och strax efter att du tränat.</p>
    <div class="row"><button id="now">↻ Synka nu</button><button id="off" class="ghost">Koppla från den här enheten</button></div>
    ${soon ? `<p class="small" style="margin:14px 0 6px"><a href="${TOKEN_URL}" target="_blank" rel="noopener">Skapa en ny nyckel på GitHub ↗</a> (välj <i>No expiration</i>) och klistra in den här:</p>${tokenForm('Byt nyckel')}` : ''}`;
  pane.querySelector('#now').onclick = () => syncNow();
  wireDisconnect(pane);
  if (soon) wireTokenForm(pane);
}
