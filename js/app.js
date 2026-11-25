// Core app: holds state, reacts to the eight buttons, and plays the sequence.

import { createProject, NUM_TRACKS, SONG_ROWS, STEPS } from './state.js';
import { buildScreens, SCREEN_MAP } from './screens.js';
import { createEngine } from './audio.js';
import { loadSaved, saveLocal } from './storage.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createApp() {
  const app = {
    project: loadSaved() ?? createProject(),
    ctx: { chain: 0, phrase: 0, instrument: 0, table: 0 },
    last: { chain: 0, phrase: 0, note: 48, vol: 0x80, inst: 0, fx: 0, fxVal: 0 },
    held: { up: false, down: false, left: false, right: false, shift: false, play: false, option: false, edit: false },
    screenId: 'song',
    message: '',
    playing: null, // { mode, pos: [track positions] }
    engine: createEngine(),
    listeners: [],
  };
  app.screens = buildScreens(app);

  const screen = () => app.screens[app.screenId];
  const changed = () => app.listeners.forEach((fn) => fn());

  // Save to this browser shortly after any edit.
  let saveTimer;
  const edited = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLocal(app.project), 600);
  };
  app.edited = edited;
  let msgTimer;
  const say = (text) => {
    app.message = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { app.message = ''; changed(); }, 1800);
  };

  // Hear the note under the cursor while editing a phrase.
  function audition() {
    if (app.playing || app.screenId !== 'phrase') return;
    const step = app.project.phrases[app.ctx.phrase][screen().cursor.row];
    app.engine.preview(app.screens.song.cursor.col, step, app.project);
  }

  app.currentCell = () => {
    const s = screen();
    return s.columns[s.cursor.col].cell(s.cursor.row);
  };

  // ---- Cursor and screen navigation ----

  function moveCursor(dr, dc) {
    const s = screen();
    const c = s.cursor;
    c.row = clamp(c.row + dr, 0, s.rowCount - 1);
    c.col = clamp(c.col + dc, 0, s.columns.length - 1);
    if (c.row < c.scroll) c.scroll = c.row;
    if (c.row >= c.scroll + s.visible) c.scroll = c.row - s.visible + 1;
  }

  function findOnMap(id) {
    for (let y = 0; y < SCREEN_MAP.length; y++) {
      const x = SCREEN_MAP[y].indexOf(id);
      if (x >= 0) return { x, y };
    }
    return { x: 0, y: 1 };
  }

  function navigate(dx, dy) {
    const { x, y } = findOnMap(app.screenId);
    const target = SCREEN_MAP[y + dy]?.[x + dx];
    if (!target) return;
    const s = screen();
    const p = app.project;

    // Moving right drills into whatever the cursor points at.
    if (app.screenId === 'song' && target === 'chain') {
      const v = p.song[s.cursor.row][s.cursor.col];
      if (v == null) return say('NO CHAIN HERE');
      app.ctx.chain = v;
    }
    if (app.screenId === 'chain' && target === 'phrase') {
      const v = p.chains[app.ctx.chain][s.cursor.row].phrase;
      if (v == null) return say('NO PHRASE HERE');
      app.ctx.phrase = v;
    }
    if (app.screenId === 'phrase' && target === 'instrument') {
      const v = p.phrases[app.ctx.phrase][s.cursor.row].inst;
      if (v != null) app.ctx.instrument = v;
    }
    if (app.screenId === 'instrument' && target === 'table') {
      app.ctx.table = app.ctx.instrument;
    }
    app.screenId = target;
  }

  // ---- Value editing ----

  function remember(spec, v) {
    if (spec.remember && v != null) app.last[spec.remember] = v;
  }

  function insert(spec) {
    if (spec.action) return spec.action();
    if (spec.readOnly || !spec.set) return;
    if (spec.get() == null) {
      const v = spec.def ? spec.def() : spec.min;
      spec.set(v ?? spec.min);
      spec.onInsert?.();
      edited();
    }
    remember(spec, spec.get());
    audition();
  }

  function adjust(spec, delta) {
    if (spec.readOnly || !spec.set) return;
    const cur = spec.get();
    if (cur == null) return insert(spec);
    const v = clamp(cur + delta, spec.min, spec.max);
    if (v === cur) return;
    spec.set(v);
    remember(spec, v);
    edited();
    audition();
  }

  function clearCell(spec) {
    if (spec.readOnly || !spec.set || spec.nullable === false) return;
    if (spec.clear) spec.clear(); else spec.set(null);
    edited();
  }

  // Option + direction flips through chains / phrases / instruments / tables.
  function changeItem(delta) {
    const s = screen();
    if (!s.itemKey) return;
    app.ctx[s.itemKey] = clamp(app.ctx[s.itemKey] + delta, 0, s.itemMax);
  }

  // ---- Button handling ----

  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  app.press = (btn) => {
    app.engine.unlock();
    app.held[btn] = true;
    const h = app.held;
    if (DIRS[btn]) {
      const [dr, dc] = DIRS[btn];
      if (h.shift) navigate(dc, dr);
      else if (h.edit) {
        const spec = app.currentCell();
        adjust(spec, dc !== 0 ? dc : -dr * (spec.big ?? 0x10));
      } else if (h.option) changeItem(dc !== 0 ? dc : -dr * 0x10);
      else moveCursor(dr, dc);
    } else if (btn === 'edit') {
      if (h.option) clearCell(app.currentCell());
      else insert(app.currentCell());
    } else if (btn === 'option') {
      if (h.edit) clearCell(app.currentCell());
    } else if (btn === 'play') {
      app.togglePlay();
    }
    changed();
  };

  app.release = (btn) => {
    app.held[btn] = false;
    changed();
  };

  app.releaseAll = () => {
    for (const k of Object.keys(app.held)) app.held[k] = false;
    changed();
  };

  // ---- Sequencer ----
  // Each track keeps its own position, like on a hardware tracker.

  function firstPhraseStep(chainIdx, from = 0) {
    const ch = app.project.chains[chainIdx];
    for (let i = from; i < STEPS; i++) if (ch[i].phrase != null) return i;
    return -1;
  }

  function startSongTrack(t, row) {
    const p = app.project;
    for (let guard = 0; guard < SONG_ROWS; guard++) {
      if (row >= SONG_ROWS || p.song[row][t] == null) return null;
      const chain = p.song[row][t];
      const cs = firstPhraseStep(chain);
      if (cs >= 0) return { songRow: row, chain, chainStep: cs, phrase: p.chains[chain][cs].phrase, phraseStep: 0 };
      row++;
    }
    return null;
  }

  function blockStart(t, row) {
    while (row > 0 && app.project.song[row - 1][t] != null) row--;
    return row;
  }

  function advance(tp, t, mode) {
    const p = app.project;
    tp.phraseStep++;
    if (tp.phraseStep < STEPS) return tp;
    tp.phraseStep = 0;
    if (mode === 'phrase') return tp;
    const next = firstPhraseStep(tp.chain, tp.chainStep + 1);
    if (next >= 0) {
      tp.chainStep = next;
      tp.phrase = p.chains[tp.chain][next].phrase;
      return tp;
    }
    if (mode === 'chain') {
      const first = firstPhraseStep(tp.chain);
      if (first < 0) return null;
      tp.chainStep = first;
      tp.phrase = p.chains[tp.chain][first].phrase;
      return tp;
    }
    // Song mode: next row, or jump back to the top of this block.
    let row = tp.songRow + 1;
    if (row >= SONG_ROWS || p.song[row][t] == null) row = blockStart(t, tp.songRow);
    return startSongTrack(t, row);
  }

  function triggerStep(when) {
    const pos = app.playing.pos;
    for (let t = 0; t < NUM_TRACKS; t++) {
      const tp = pos[t];
      if (!tp) continue;
      const p = app.project;
      const step = p.phrases[tp.phrase][tp.phraseStep];
      let transpose = p.transpose - 0x80;
      if (tp.chain != null) {
        const tsp = p.chains[tp.chain][tp.chainStep].transpose;
        transpose += tsp >= 0x80 ? tsp - 0x100 : tsp;
      }
      app.engine.trigger(t, step, p, transpose, when);
    }
  }

  function stepMs(grooveIndex) {
    const ticks = app.project.groove.filter((g) => g != null);
    const tpb = ticks.length ? ticks[grooveIndex % ticks.length] : 6;
    return (60000 / (app.project.tempo * 24)) * tpb;
  }

  let timer = null;
  let grooveIndex = 0;
  let nextTime = 0;

  function tick() {
    if (!app.playing) return;
    // Schedule the sound slightly ahead so timer jitter is not audible.
    const late = performance.now() - nextTime;
    triggerStep(app.engine.now() + Math.max(0.005, 0.05 - late / 1000));
    changed();
    const pos = app.playing.pos;
    for (let t = 0; t < NUM_TRACKS; t++) {
      if (pos[t]) pos[t] = advance(pos[t], t, app.playing.mode);
    }
    nextTime += stepMs(grooveIndex++);
    timer = setTimeout(tick, Math.max(0, nextTime - performance.now()));
  }

  app.togglePlay = () => {
    if (app.playing) {
      clearTimeout(timer);
      app.playing = null;
      app.engine.stopAll();
      return;
    }
    const s = screen();
    const pos = Array(NUM_TRACKS).fill(null);
    let mode = 'song';
    if (app.screenId === 'chain') {
      mode = 'chain';
      const track = app.screens.song.cursor.col;
      const cs = firstPhraseStep(app.ctx.chain);
      if (cs >= 0) pos[track] = { songRow: null, chain: app.ctx.chain, chainStep: cs, phrase: app.project.chains[app.ctx.chain][cs].phrase, phraseStep: 0 };
    } else if (['phrase', 'instrument', 'table'].includes(app.screenId)) {
      mode = 'phrase';
      pos[app.screens.song.cursor.col] = { songRow: null, chain: null, chainStep: null, phrase: app.ctx.phrase, phraseStep: 0 };
    } else {
      const row = app.screenId === 'song' ? s.cursor.row : app.screens.song.cursor.row;
      for (let t = 0; t < NUM_TRACKS; t++) pos[t] = startSongTrack(t, row);
    }
    if (pos.every((x) => !x)) return say('NOTHING TO PLAY');
    app.playing = { mode, pos };
    grooveIndex = 0;
    nextTime = performance.now();
    tick();
  };

  app.say = (text) => { say(text); changed(); };
  app.changed = changed;
  app.replaceProject = (project) => {
    if (app.playing) app.togglePlay();
    app.project = project;
    app.ctx = { chain: 0, phrase: 0, instrument: 0, table: 0 };
    for (const s of Object.values(app.screens)) s.cursor = { row: 0, col: 0, scroll: 0 };
    saveLocal(project);
    changed();
  };

  app.onChange = (fn) => app.listeners.push(fn);
  app.screen = screen;
  return app;
}
