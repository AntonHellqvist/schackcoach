// Tunn wrapper runt Stockfish (UCI) i en web worker.
// Alla anrop köas så att flera analyser aldrig blandas ihop.

export class Engine {
  constructor() {
    const wasm = typeof WebAssembly === 'object';
    this.worker = new Worker(wasm ? 'vendor/stockfish.js' : 'vendor/stockfish.asm.js');
    this.listeners = new Set();
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const fn of [...this.listeners]) fn(line);
    };
    this.queue = Promise.resolve();
    this.ready = this._init();
  }

  send(cmd) {
    this.worker.postMessage(cmd);
  }

  _waitFor(pred) {
    return new Promise((resolve) => {
      const fn = (line) => {
        if (pred(line)) {
          this.listeners.delete(fn);
          resolve(line);
        }
      };
      this.listeners.add(fn);
    });
  }

  async _init() {
    const ok = this._waitFor((l) => l === 'uciok');
    this.send('uci');
    await ok;
    await this._isReady();
  }

  async _isReady() {
    const ok = this._waitFor((l) => l === 'readyok');
    this.send('isready');
    await ok;
  }

  _enqueue(task) {
    const run = this.queue.then(() => this.ready).then(task);
    this.queue = run.catch(() => {});
    return run;
  }

  /** Avbryter pågående sökning (resultatet av den returneras ändå). */
  stop() {
    this.send('stop');
  }

  newGame() {
    return this._enqueue(async () => {
      this.send('ucinewgame');
      await this._isReady();
    });
  }

  /**
   * Analyserar en ställning.
   * opts: { depth, movetime, multipv, skill }
   * Returnerar { bestmove, lines: [{ multipv, depth, score: {cp}|{mate}, pv: [uci...] }] }
   * Poängen är ur perspektivet för den som är vid draget.
   */
  analyse(fen, opts = {}) {
    return this._enqueue(async () => {
      const multipv = opts.multipv || 1;
      this.send(`setoption name MultiPV value ${multipv}`);
      this.send(`setoption name Skill Level value ${opts.skill ?? 20}`);
      await this._isReady();

      const lines = new Map();
      const onInfo = (line) => {
        if (!line.startsWith('info') || !line.includes(' pv ')) return;
        const t = line.split(' ');
        const get = (k) => t[t.indexOf(k) + 1];
        const mpv = t.includes('multipv') ? parseInt(get('multipv'), 10) : 1;
        const si = t.indexOf('score');
        if (si < 0) return;
        const score = t[si + 1] === 'mate' ? { mate: parseInt(t[si + 2], 10) } : { cp: parseInt(t[si + 2], 10) };
        // Ignorera "lowerbound/upperbound"-rader, de är inte exakta.
        if (t[si + 3] === 'lowerbound' || t[si + 3] === 'upperbound') return;
        const pv = t.slice(t.indexOf('pv') + 1);
        lines.set(mpv, { multipv: mpv, depth: parseInt(get('depth'), 10), score, pv });
        opts.onInfo?.([...lines.values()].sort((a, b) => a.multipv - b.multipv));
      };
      this.listeners.add(onInfo);
      const done = this._waitFor((l) => l.startsWith('bestmove'));
      this.send(`position fen ${fen}`);
      let go = 'go';
      if (opts.depth) go += ` depth ${opts.depth}`;
      if (opts.movetime) go += ` movetime ${opts.movetime}`;
      if (!opts.depth && !opts.movetime) go += ' depth 12';
      this.send(go);
      const best = await done;
      this.listeners.delete(onInfo);
      const bestmove = best.split(' ')[1];
      return {
        bestmove: bestmove === '(none)' ? null : bestmove,
        lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
      };
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

let shared = null;
/** En delad motor för analyser/tips. Bottarna skapar egna instanser. */
export function sharedEngine() {
  if (!shared) shared = new Engine();
  return shared;
}

// ---------- Hjälpfunktioner för värderingar ----------

/** Gör om en motorpoäng (för sidan vid draget) till centibönder ur vits perspektiv. */
export function toWhiteCp(score, turn) {
  let cp;
  if (score.mate !== undefined) {
    const m = score.mate;
    cp = m > 0 ? 10000 - m * 10 : m < 0 ? -10000 - m * 10 : -10000;
  } else cp = score.cp;
  return turn === 'w' ? cp : -cp;
}

/** Vinstchans (0..1) för vit utifrån centibönder (samma kurva som Lichess). */
export function winProb(cp) {
  const c = Math.max(-2000, Math.min(2000, cp));
  return 1 / (1 + Math.exp(-0.00368208 * c));
}

export function formatScore(score, turn) {
  if (!score) return '';
  if (score.mate !== undefined) {
    const whiteMates = (score.mate > 0) === (turn === 'w');
    return (whiteMates ? '' : '-') + 'M' + Math.abs(score.mate);
  }
  const cp = turn === 'w' ? score.cp : -score.cp;
  return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
}

export function formatWhiteCp(cp) {
  if (Math.abs(cp) >= 9000) {
    const m = Math.round((10000 - Math.abs(cp)) / 10);
    return (cp > 0 ? '' : '-') + 'M' + Math.max(m, 0);
  }
  return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
}
