// Draws the current screen into a fixed character grid, like a small LCD.

import { SCREEN_MAP, hex } from './screens.js';
import { NUM_TRACKS } from './state.js';

export const COLS = 42;
export const ROWS = 23;
const SIDEBAR_X = 33;

function makeBuffer() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ ch: ' ', cls: '' })));
}

function write(buf, x, y, text, cls = '') {
  for (let i = 0; i < text.length; i++) {
    const cx = x + i;
    if (cx < 0 || cx >= COLS || y < 0 || y >= ROWS) continue;
    buf[y][cx] = { ch: text[i], cls };
  }
}

function toHtml(buf) {
  const esc = (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c);
  return buf.map((line) => {
    let html = '';
    let run = '';
    let cls = null;
    const flush = () => {
      if (!run) return;
      html += cls ? `<span class="${cls}">${run}</span>` : run;
      run = '';
    };
    for (const cell of line) {
      if (cell.cls !== cls) { flush(); cls = cell.cls; }
      run += esc(cell.ch);
    }
    flush();
    return html;
  }).join('\n');
}

// Which rows (and which columns on the song screen) the playhead is on.
function playMarks(app) {
  const marks = new Set();
  if (!app.playing) return marks;
  app.playing.pos.forEach((tp, t) => {
    if (!tp) return;
    switch (app.screenId) {
      case 'song': if (tp.songRow != null) marks.add(`${tp.songRow}:${t}`); break;
      case 'chain': if (tp.chain === app.ctx.chain) marks.add(`${tp.chainStep}`); break;
      case 'phrase': if (tp.phrase === app.ctx.phrase) marks.add(`${tp.phraseStep}`); break;
      default: break;
    }
  });
  return marks;
}

function drawGrid(buf, app, s) {
  const marks = playMarks(app);
  const { row: cr, col: cc, scroll } = s.cursor;
  const top = 3;
  const labelW = s.form ? s.labelWidth : s.rowLabel(0).length + 1;

  // Column headers
  if (!s.form) {
    let x = labelW;
    for (const col of s.columns) {
      write(buf, x, top - 1, col.label, 'dim');
      x += col.w + col.gap;
    }
  }

  for (let i = 0; i < s.visible && scroll + i < s.rowCount; i++) {
    const r = scroll + i;
    const y = top + i;
    const rowPlaying = marks.has(`${r}`);
    if (s.form) write(buf, 0, y, s.form[r].label, r === cr ? 'label-on' : 'dim');
    else write(buf, 0, y, s.rowLabel(r), rowPlaying ? 'play' : (r % 4 === 0 ? 'beat' : 'dim'));

    let x = labelW;
    s.columns.forEach((col, ci) => {
      const spec = col.cell(r);
      const v = spec.get();
      const shown = String(spec.fmt(v));
      const text = s.form ? shown : shown.padEnd(col.w).slice(0, col.w);
      let cls = v == null ? 'empty' : 'val';
      if (marks.has(`${r}:${ci}`) || rowPlaying) cls += ' playing';
      if (r === cr && ci === cc) cls = app.held.edit ? 'cur editing' : 'cur';
      write(buf, x, y, text, cls);
      x += col.w + col.gap;
    });
  }
}

function drawSidebar(buf, app) {
  // Screen map
  SCREEN_MAP.forEach((line, y) => {
    line.forEach((id, x) => {
      if (!id) { write(buf, SIDEBAR_X + x * 2, y, '·', 'faint'); return; }
      const letter = app.screens[id].letter;
      write(buf, SIDEBAR_X + x * 2, y, letter, id === app.screenId ? 'map-on' : 'map');
    });
  });

  // Track activity
  write(buf, SIDEBAR_X, 5, 'TRACKS', 'dim');
  for (let t = 0; t < NUM_TRACKS; t++) {
    const tp = app.playing?.pos[t];
    const y = 6 + t;
    write(buf, SIDEBAR_X, y, String(t + 1), tp ? 'play' : 'dim');
    if (tp) write(buf, SIDEBAR_X + 2, y, `${hex(tp.phrase)}:${tp.phraseStep.toString(16).toUpperCase()}`, 'val');
    else write(buf, SIDEBAR_X + 2, y, '--:-', 'faint');
  }

  write(buf, SIDEBAR_X, 15, `BPM ${app.project.tempo}`, 'val');
  write(buf, SIDEBAR_X, 16, app.playing ? '▶ PLAY' : '■ STOP', app.playing ? 'play' : 'dim');
}

export function render(el, app) {
  const buf = makeBuffer();
  const s = app.screen();
  write(buf, 0, 0, s.title(), 'title');
  drawGrid(buf, app, s);
  drawSidebar(buf, app);
  if (app.message) write(buf, 0, ROWS - 1, app.message, 'msg');
  el.innerHTML = toHtml(buf);
}
