# Schackcoach ♞

En schackapp i webbläsaren som bedömer dina partier, utvecklar ditt spel och har utmaningar.

## Starta

Dubbelklicka på **Starta Schackcoach.command** – eller kör:

    python3 serve.py

Appen öppnas på http://localhost:8642. Inget behöver installeras (bara Python 3, som redan finns på Mac).

## Funktioner

- **Spela** mot 8 bottar från ca 400 till full Stockfish-styrka, med tips och ångra.
- **Partibedömning** drag för drag (briljant, bästa, inexakt, misstag, blunder …), träffsäkerhet,
  värderingsgraf och coachkommentarer. Hämtar dina partier direkt från **Chess.com**, eller klistra in PGN.
- **Träna på dina misstag** – dina blunders och misstag sparas automatiskt som pussel.
- **Taktikpussel** från Lichess med teman, egen pusselrating och dagens pussel.
- **Utmaningar**: pusselrush (3 min), slutspelsmatter mot Stockfish, besegra bottarna och ett 30-tal utmaningar.
- **Öppningar**: 12 öppningar + 3 fällor med idéer och kommentarer – träna tills varianten sitter.
- **Snygga matter**: klassiska mattmönster (kvävningsmatt, Anastasias, Bodens, Morphys operamatt …).
- **Min utveckling**: träffsäkerhet och rating över tid, öppningsstatistik, starka/svaga teman och förslag.

All data sparas lokalt i webbläsaren.

## Teknik

Ren HTML/CSS/JavaScript utan byggsteg. Stockfish 10 (WebAssembly) körs i en web worker,
reglerna sköts av chess.js och pjäserna är Lichess "cburnett"-set. Allt ligger i `vendor/`.
