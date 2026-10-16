# Schackcoach ♞

En schackapp i webbläsaren som bedömer dina partier, utvecklar ditt spel och har utmaningar.

## Öppna appen

**På nätet (mobil och dator):** https://antonhellqvist.github.io/schackcoach/

På mobilen: öppna länken i Safari → Dela → *Lägg till på hemskärmen* så får du en app-ikon.

## Köra lokalt

Dubbelklicka på **Starta Schackcoach.command** – eller kör:

    python3 serve.py

Appen öppnas på http://localhost:8642. Inget behöver installeras (bara Python 3, som redan finns på Mac).

## Funktioner

- **Dagens träning** 🔥 – ett personligt pass på 10–15 min varje dag (pussel i ditt svagaste tema, dina egna misstag,
  en öppning och ett mattmönster) med streak.
- **Coachen** 🛟 – förklarar misstag i klartext (hängande pjäser, gafflar, missade slag, matthot) och kan varna
  *innan* du gör ett dåligt drag mot bottarna. Min utveckling visar dina vanligaste typer av misstag.
- **Synk mellan enheter** ☁️ – under Inställningar kopplar du appen till en hemlig gist i ditt GitHub-konto
  så följer framstegen med mellan mobil och dator. Går nyckeln ut får du en notis i appen (och en varning en vecka innan).
- **Ljud** 🔊 – träklick när pjäserna flyttas (i stil med Chess.com), eget ljud vid slag, rockad och förvandling,
  en tydlig signal vid schack och en ton när partiet börjar och slutar. Stängs av under Inställningar eller med 🔊-knappen.
- **Bräde, pjäser och animationer** 🎨 – nio brädfärger och 13 pjäsuppsättningar att välja mellan, pjäser som glider,
  tagna pjäser som tonar bort och konfetti när du vinner. Väljs under Inställningar → Bräde och pjäser.

- **Kompisutmaning** ⚔️ – lös några pussel med klockan igång och skicka en länk. Kompisarna får samma pussel och ni
  ser vem som löste flest, med minst fel och snabbast. Ingen inloggning – allas resultat följer med i länken.
- **Spela** mot 8 bottar från ca 400 till full Stockfish-styrka, med tips och ångra.
- **Partibedömning** drag för drag (briljant, bästa, inexakt, misstag, blunder …), träffsäkerhet,
  värderingsgraf och coachkommentarer. Vid dina misstag och blunders får du först **försöka igen** och leta efter
  ett bättre drag själv innan svaret visas. Hämtar dina partier direkt från **Chess.com**, eller klistra in PGN.
- **Träna på dina misstag** – dina blunders och misstag sparas automatiskt som pussel.
- **Taktikpussel** från Lichess med teman, egen pusselrating och dagens pussel.
- **Utmaningar**: pusselrush (3 min), slutspelsmatter mot Stockfish, besegra bottarna och ett 30-tal utmaningar.
- **Öppningar**: 12 öppningar + 3 fällor med idéer och kommentarer – träna tills varianten sitter.
- **Snygga matter**: klassiska mattmönster (kvävningsmatt, Anastasias, Bodens, Morphys operamatt …).
- **Min utveckling**: träffsäkerhet och rating över tid, öppningsstatistik, starka/svaga teman och förslag.

All data sparas lokalt i webbläsaren.

## Teknik

Ren HTML/CSS/JavaScript utan byggsteg. Stockfish 10 (WebAssembly) körs i en web worker,
reglerna sköts av chess.js och pjäserna kommer från Lichess (licenser i `vendor/pieces/LICENSES.md`). Allt ligger i `vendor/`.
