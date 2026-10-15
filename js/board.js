import { Chess } from '../vendor/chess.js';

const FILES = 'abcdefgh';

/**
 * Interaktivt schackbräde (klicka eller dra för att flytta).
 * Brädet ändrar aldrig ställningen själv – den som äger brädet anropar set() efter ett drag.
 */
export class Board {
  constructor(container, opts = {}) {
    this.orientation = opts.orientation || 'w';
    this.movable = opts.movable ?? null; // 'w' | 'b' | 'both' | null
    this.onMove = opts.onMove || (() => {});
    this.fen = new Chess().fen();
    this.lastMove = null;
    this.arrowList = [];
    this.marks = {};
    this.selected = null;
    this.drag = null;

    this.el = document.createElement('div');
    this.el.className = 'board';
    this.squaresEl = document.createElement('div');
    this.squaresEl.className = 'squares';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 8 8');
    this.svg.classList.add('arrows');
    this.el.append(this.squaresEl, this.svg);
    container.append(this.el);

    this.el.addEventListener('pointerdown', (e) => this._down(e));
    this._move = (e) => this._dragMove(e);
    this._up = (e) => this._dragEnd(e);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.render();
  }

  destroy() {
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    this.el.remove();
  }

  set(fen, { lastMove = null, keepArrows = false } = {}) {
    this.fen = fen;
    this.lastMove = lastMove;
    this.selected = null;
    if (!keepArrows) this.arrowList = [];
    this.render();
  }

  setMovable(m) {
    this.movable = m;
    this.selected = null;
    this.render();
  }

  setOrientation(o) {
    this.orientation = o;
    this.render();
  }

  flip() {
    this.setOrientation(this.orientation === 'w' ? 'b' : 'w');
  }

  /** arrows: [{from, to, color: 'green'|'red'|'blue'|'yellow'}] */
  setArrows(list) {
    this.arrowList = list || [];
    this._renderArrows();
  }

  /** badge: { sq, cls, sym } – liten symbol i hörnet av en ruta (t.ex. ?? för blunder). */
  setBadge(badge) {
    this.badge = badge;
    this.render();
  }

  /** marks: { e4: 'good' | 'bad' | 'hint' | 'blunder' ... } */
  setMarks(marks) {
    this.marks = marks || {};
    this.render();
  }

  // ---------- rendering ----------

  _squareAt(row, col) {
    // row/col i visningskoordinater (0,0 = övre vänstra hörnet)
    const f = this.orientation === 'w' ? col : 7 - col;
    const r = this.orientation === 'w' ? 7 - row : row;
    return FILES[f] + (r + 1);
  }

  _coords(sq) {
    const f = FILES.indexOf(sq[0]);
    const r = parseInt(sq[1], 10) - 1;
    return this.orientation === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
  }

  render() {
    const chess = new Chess(this.fen);
    const legal = this.selected ? chess.moves({ square: this.selected, verbose: true }) : [];
    const targets = new Map(legal.map((m) => [m.to, m]));
    let checkSq = null;
    if (chess.inCheck()) {
      const b = chess.board().flat().find((p) => p && p.type === 'k' && p.color === chess.turn());
      checkSq = b?.square;
    }

    const frag = document.createDocumentFragment();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = this._squareAt(row, col);
        const d = document.createElement('div');
        const light = (FILES.indexOf(sq[0]) + parseInt(sq[1], 10)) % 2 === 1;
        d.className = 'sq ' + (light ? 'light' : 'dark');
        d.dataset.sq = sq;
        if (this.lastMove && (sq === this.lastMove.from || sq === this.lastMove.to)) d.classList.add('last');
        if (sq === this.selected) d.classList.add('selected');
        if (sq === checkSq) d.classList.add('check');
        if (this.marks[sq]) d.classList.add('mark-' + this.marks[sq]);
        const p = chess.get(sq);
        if (targets.has(sq)) d.classList.add(p ? 'target-capture' : 'target');
        if (p) {
          const img = document.createElement('img');
          img.src = `vendor/pieces/${p.color}${p.type.toUpperCase()}.svg`;
          img.className = 'piece';
          img.draggable = false;
          img.alt = '';
          if (this.drag && this.drag.from === sq) img.classList.add('dragging');
          d.append(img);
        }
        if (this.badge && this.badge.sq === sq) {
          d.insertAdjacentHTML('beforeend', `<span class="badge cls cls-${this.badge.cls}">${this.badge.sym}</span>`);
        }
        if (col === 0) d.insertAdjacentHTML('beforeend', `<span class="coord rank">${sq[1]}</span>`);
        if (row === 7) d.insertAdjacentHTML('beforeend', `<span class="coord file">${sq[0]}</span>`);
        frag.append(d);
      }
    }
    this.squaresEl.replaceChildren(frag);
    this._renderArrows();
  }

  _renderArrows() {
    const colors = { green: '#5fb85f', red: '#e0524f', blue: '#4a90d9', yellow: '#e6b422' };
    let html = '<defs>';
    for (const [name, c] of Object.entries(colors)) {
      html += `<marker id="ah-${name}" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="${c}"/></marker>`;
    }
    html += '</defs>';
    for (const a of this.arrowList) {
      const s = this._coords(a.from);
      const t = this._coords(a.to);
      const x1 = s.col + 0.5, y1 = s.row + 0.5;
      let x2 = t.col + 0.5, y2 = t.row + 0.5;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const shorten = 0.35;
      x2 -= ((x2 - x1) / len) * shorten;
      y2 -= ((y2 - y1) / len) * shorten;
      const c = a.color || 'green';
      html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[c]}" stroke-width="0.17" stroke-linecap="round" opacity="0.85" marker-end="url(#ah-${c})"/>`;
    }
    this.svg.innerHTML = html;
  }

  // ---------- interaktion ----------

  _canMove(chess, sq) {
    if (!this.movable) return false;
    const p = chess.get(sq);
    if (!p || p.color !== chess.turn()) return false;
    return this.movable === 'both' || this.movable === p.color;
  }

  _sqFromPoint(x, y) {
    const r = this.el.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * 8);
    const row = Math.floor(((y - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return this._squareAt(row, col);
  }

  _down(e) {
    if (e.button !== 0) return;
    const sq = this._sqFromPoint(e.clientX, e.clientY);
    if (!sq) return;
    const chess = new Chess(this.fen);

    if (this.selected && this.selected !== sq) {
      const ok = chess.moves({ square: this.selected, verbose: true }).some((m) => m.to === sq);
      if (ok) {
        e.preventDefault();
        this._tryMove(this.selected, sq);
        return;
      }
    }
    if (this._canMove(chess, sq)) {
      e.preventDefault();
      this.selected = sq;
      const p = chess.get(sq);
      const ghost = document.createElement('img');
      ghost.src = `vendor/pieces/${p.color}${p.type.toUpperCase()}.svg`;
      ghost.className = 'ghost';
      const size = this.el.getBoundingClientRect().width / 8;
      ghost.style.width = ghost.style.height = size + 'px';
      document.body.append(ghost);
      this.drag = { from: sq, ghost, size, moved: false, startX: e.clientX, startY: e.clientY };
      this._placeGhost(e);
      this.render();
    } else {
      this.selected = null;
      this.render();
    }
  }

  _placeGhost(e) {
    const g = this.drag.ghost;
    g.style.left = e.clientX - this.drag.size / 2 + 'px';
    g.style.top = e.clientY - this.drag.size / 2 + 'px';
  }

  _dragMove(e) {
    if (!this.drag) return;
    if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 4) this.drag.moved = true;
    this._placeGhost(e);
  }

  _dragEnd(e) {
    if (!this.drag) return;
    const { from, ghost, moved } = this.drag;
    ghost.remove();
    this.drag = null;
    const to = this._sqFromPoint(e.clientX, e.clientY);
    if (moved && to && to !== from) {
      const chess = new Chess(this.fen);
      if (chess.moves({ square: from, verbose: true }).some((m) => m.to === to)) {
        this._tryMove(from, to);
        return;
      }
      this.selected = null;
    }
    this.render();
  }

  _tryMove(from, to) {
    const chess = new Chess(this.fen);
    const p = chess.get(from);
    const isPromo = p.type === 'p' && (to[1] === '8' || to[1] === '1');
    this.selected = null;
    if (isPromo) {
      this._askPromotion(p.color).then((promotion) => {
        if (promotion) this.onMove({ from, to, promotion });
        else this.render();
      });
    } else {
      this.render();
      this.onMove({ from, to });
    }
  }

  _askPromotion(color) {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'promo';
      for (const t of ['q', 'r', 'b', 'n']) {
        const b = document.createElement('button');
        b.innerHTML = `<img src="vendor/pieces/${color}${t.toUpperCase()}.svg" alt="${t}">`;
        b.onclick = (ev) => {
          ev.stopPropagation();
          ov.remove();
          resolve(t);
        };
        ov.append(b);
      }
      ov.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        if (ev.target === ov) {
          ov.remove();
          resolve(null);
        }
      });
      this.el.append(ov);
    });
  }
}

/** Gör om ett UCI-drag (e2e4, e7e8q) till ett drag-objekt. */
export function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

/** Översätter en UCI-variant till SAN-drag från en given ställning. */
export function pvToSan(fen, pv, max = 8) {
  const c = new Chess(fen);
  const out = [];
  for (const u of pv.slice(0, max)) {
    try {
      out.push(c.move(uciToMove(u)).san);
    } catch {
      break;
    }
  }
  return out;
}
