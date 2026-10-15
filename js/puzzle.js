import { Chess } from '../vendor/chess.js';
import { uciToMove } from './board.js';
import { sharedEngine, winProb, toWhiteCp } from './engine.js';

const toUci = (m) => m.from + m.to + (m.promotion || '');

/** Gör om en lista SAN-drag till UCI från en ställning. */
export function sanToUci(fen, sans) {
  const c = new Chess(fen);
  return sans.map((s) => toUci(c.move(s)));
}

/**
 * Kör ett pussel på ett befintligt bräde.
 * opts: {
 *   board, fen, solution: [uci...] (första draget är spelarens),
 *   mode: 'strict' | 'mate' | 'engine',
 *   bestCp: (för 'engine') värdering av bästa draget ur spelarens perspektiv,
 *   onStatus(type, html), onResult({ success, firstTry }), lastMove
 * }
 * Returnerar { hint(), showSolution(), destroy() }
 */
export function runPuzzle(opts) {
  const { board } = opts;
  const chess = new Chess(opts.fen);
  const userColor = chess.turn();
  let idx = 0;
  let failed = false;
  let finished = false;
  let offBook = false; // spelaren hittade en annan vinnande väg – motorn svarar
  let destroyed = false;
  let busy = false;
  const userMovesTotal = Math.ceil(opts.solution.length / 2);

  board.setOrientation(userColor);
  board.set(chess.fen(), { lastMove: opts.lastMove || null });
  board.setMovable(userColor);
  board.onMove = (m) => onUserMove(m);
  opts.onStatus?.('info', `Du spelar ${userColor === 'w' ? 'vit' : 'svart'}. Hitta det bästa draget!`);

  function last() {
    const h = chess.history({ verbose: true });
    const l = h[h.length - 1];
    return l ? { from: l.from, to: l.to } : opts.lastMove;
  }

  async function onUserMove(m) {
    if (finished || busy) return;
    let mv;
    try {
      mv = chess.move(m);
    } catch {
      board.set(chess.fen(), { lastMove: last() });
      return;
    }
    board.set(chess.fen(), { lastMove: { from: mv.from, to: mv.to } });
    board.setMovable(null);
    const uci = toUci(mv);
    let ok = !offBook && uci === opts.solution[idx];
    if (!ok && chess.isCheckmate()) ok = true;

    if (!ok && (opts.mode === 'mate' || opts.mode === 'engine' || offBook)) {
      busy = true;
      opts.onStatus?.('', '<span class="spinner"></span> Kontrollerar ditt drag…');
      const r = await sharedEngine().analyse(chess.fen(), { depth: 14 });
      busy = false;
      if (destroyed) return;
      const s = r.lines[0]?.score;
      if (s) {
        if (opts.mode === 'mate' || offBook) {
          const userMovesLeft = userMovesTotal - Math.floor(idx / 2) - 1;
          // s är ur motståndarens perspektiv: negativ mate = motståndaren blir mattad
          ok = s.mate !== undefined && s.mate < 0 && -s.mate <= userMovesLeft;
        } else {
          const whiteCp = toWhiteCp(s, chess.turn());
          const cpUser = userColor === 'w' ? whiteCp : -whiteCp;
          const best = opts.bestCp ?? cpUser;
          // Godkänn drag som är (nästan) lika bra som motorns bästa.
          ok = winProb(best) - winProb(cpUser) < 0.04 || cpUser >= best - 40;
        }
      }
      if (ok && opts.mode !== 'engine') offBook = true;
    }

    if (!ok) {
      if (!failed) {
        failed = true;
        opts.onResult?.({ success: false, firstTry: true });
      }
      opts.onStatus?.('bad', `<b>${mv.san}</b> är inte rätt. Försök igen!`);
      setTimeout(() => {
        if (destroyed) return;
        chess.undo();
        board.set(chess.fen(), { lastMove: last() });
        board.setMovable(userColor);
      }, 700);
      return;
    }

    idx++;
    const done = chess.isGameOver() || (!offBook && idx >= opts.solution.length) || opts.mode === 'engine';
    if (done) return finish();
    opts.onStatus?.('ok', `<b>${mv.san}</b> – bra! Fortsätt…`);
    busy = true;
    setTimeout(async () => {
      if (destroyed) return;
      let reply;
      if (offBook) {
        const r = await sharedEngine().analyse(chess.fen(), { depth: 12 });
        reply = r.bestmove && uciToMove(r.bestmove);
      } else reply = uciToMove(opts.solution[idx]);
      if (destroyed) return;
      const rm = reply && chess.move(reply);
      idx++;
      busy = false;
      board.set(chess.fen(), { lastMove: rm ? { from: rm.from, to: rm.to } : null });
      if (chess.isGameOver() || (!offBook && idx >= opts.solution.length)) return finish();
      board.setMovable(userColor);
    }, 450);
  }

  function finish() {
    finished = true;
    board.setMovable(null);
    opts.onStatus?.('ok', failed ? 'Löst! Nästa gång sitter det på första försöket. 💪' : '<b>Rätt!</b> Snyggt löst! 🎉');
    if (!failed) opts.onResult?.({ success: true, firstTry: true });
    else opts.onResult?.({ success: true, firstTry: false });
  }

  return {
    hint() {
      if (finished || busy || offBook) return;
      const m = uciToMove(opts.solution[idx]);
      board.setMarks({ [m.from]: 'hint' });
      setTimeout(() => !destroyed && board.setMarks({}), 2500);
    },
    async showSolution() {
      if (finished) return;
      if (!failed) {
        failed = true;
        opts.onResult?.({ success: false, firstTry: true });
      }
      finished = true;
      board.setMovable(null);
      if (offBook) return;
      for (; idx < opts.solution.length; idx++) {
        const mv = chess.move(uciToMove(opts.solution[idx]));
        board.set(chess.fen(), { lastMove: { from: mv.from, to: mv.to } });
        board.setArrows([{ from: mv.from, to: mv.to, color: chess.turn() === userColor ? 'red' : 'green' }]);
        await new Promise((r) => setTimeout(r, 900));
        if (destroyed) return;
      }
      opts.onStatus?.('warn', 'Här är lösningen. Titta på mönstret – du får det nästa gång!');
    },
    destroy() {
      destroyed = true;
    },
    get chess() { return chess; },
  };
}
