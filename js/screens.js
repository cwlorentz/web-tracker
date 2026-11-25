// Screen definitions. Each screen is a grid of editable cells.
// A cell spec says how to read, write, format and step a value.

import {
  NUM_TRACKS, SONG_ROWS, STEPS, NUM_CHAINS, NUM_PHRASES,
  NUM_INSTRUMENTS, NUM_TABLES, FX_COMMANDS, INSTRUMENT_TYPES,
  FILTER_TYPES, SHAPE_OPTIONS, SHAPE_LABELS, createProject,
} from './state.js';
import { exportFile, importFile } from './storage.js';
import { createDemo } from './demo.js';

export const hex = (v, w = 2) =>
  v == null ? '-'.repeat(w) : v.toString(16).toUpperCase().padStart(w, '0');

const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
export const noteName = (n) =>
  n == null ? '---' : NOTE_NAMES[n % 12] + Math.floor(n / 12).toString(36).toUpperCase();

const fxName = (v) => (v == null ? '---' : FX_COMMANDS[v]);
const signed80 = (v) => {
  const d = v - 0x80;
  return (d >= 0 ? '+' : '-') + Math.abs(d).toString(16).toUpperCase().padStart(2, '0');
};
const bar = (v, max = 0xff, len = 8) => {
  const filled = Math.round((v / max) * len);
  return '█'.repeat(filled) + '·'.repeat(len - filled);
};

// Helpers for building cell specs that read/write a property of an object.
function prop(getObj, key, opts) {
  return {
    get: () => getObj()[key],
    set: (v) => { getObj()[key] = v; },
    ...opts,
  };
}

// Phrase and table rows share FX column definitions.
function fxColumns(getStep, app) {
  const cols = [];
  for (let i = 0; i < 3; i++) {
    cols.push({
      label: `FX${i + 1}`, w: 3, gap: 0,
      cell: (r) => prop(() => getStep(r).fx[i], 'cmd', {
        min: 0, max: FX_COMMANDS.length - 1, big: 8, fmt: fxName,
        def: () => app.last.fx, remember: 'fx',
        clear: () => { getStep(r).fx[i].cmd = null; getStep(r).fx[i].val = null; },
      }),
    });
    cols.push({
      label: '', w: 2, gap: 1,
      cell: (r) => prop(() => getStep(r).fx[i], 'val', {
        min: 0, max: 0xff, big: 0x10, fmt: (v) => hex(v),
        def: () => app.last.fxVal, remember: 'fxVal',
      }),
    });
  }
  return cols;
}

export function buildScreens(app) {
  const p = () => app.project;

  const song = {
    id: 'song', letter: 'S',
    title: () => 'SONG',
    rowCount: SONG_ROWS, visible: 16,
    rowLabel: (r) => hex(r),
    columns: Array.from({ length: NUM_TRACKS }, (_, t) => ({
      label: String(t + 1), w: 2, gap: 1,
      cell: (r) => ({
        get: () => p().song[r][t],
        set: (v) => { p().song[r][t] = v; },
        min: 0, max: NUM_CHAINS - 1, big: 0x10, fmt: (v) => hex(v),
        def: () => app.last.chain, remember: 'chain',
      }),
    })),
    playRows: (pos) => pos.map((tp) => (tp ? tp.songRow : null)),
  };

  const chainOf = () => p().chains[app.ctx.chain];
  const chain = {
    id: 'chain', letter: 'C',
    title: () => `CHAIN ${hex(app.ctx.chain)}`,
    rowCount: STEPS, visible: 16,
    rowLabel: (r) => r.toString(16).toUpperCase(),
    columns: [
      {
        label: 'PH', w: 2, gap: 1,
        cell: (r) => prop(() => chainOf()[r], 'phrase', {
          min: 0, max: NUM_PHRASES - 1, big: 0x10, fmt: (v) => hex(v),
          def: () => app.last.phrase, remember: 'phrase',
        }),
      },
      {
        label: 'TSP', w: 2, gap: 2,
        cell: (r) => prop(() => chainOf()[r], 'transpose', {
          min: 0, max: 0xff, big: 0x0c, fmt: (v) => hex(v), def: () => 0, nullable: false,
        }),
      },
    ],
    itemKey: 'chain', itemMax: NUM_CHAINS - 1,
  };

  const phraseOf = () => p().phrases[app.ctx.phrase];
  const phrase = {
    id: 'phrase', letter: 'P',
    title: () => `PHRASE ${hex(app.ctx.phrase)}`,
    rowCount: STEPS, visible: 16,
    rowLabel: (r) => r.toString(16).toUpperCase(),
    columns: [
      {
        label: 'N', w: 3, gap: 1,
        cell: (r) => prop(() => phraseOf()[r], 'note', {
          min: 0, max: 119, big: 12, fmt: noteName,
          def: () => app.last.note, remember: 'note',
          onInsert: () => {
            const s = phraseOf()[r];
            if (s.inst == null) s.inst = app.last.inst;
          },
        }),
      },
      {
        label: 'V', w: 2, gap: 1,
        cell: (r) => prop(() => phraseOf()[r], 'vol', {
          min: 0, max: 0xff, big: 0x10, fmt: (v) => hex(v),
          def: () => app.last.vol, remember: 'vol',
        }),
      },
      {
        label: 'I', w: 2, gap: 1,
        cell: (r) => prop(() => phraseOf()[r], 'inst', {
          min: 0, max: NUM_INSTRUMENTS - 1, big: 0x10, fmt: (v) => hex(v),
          def: () => app.last.inst, remember: 'inst',
        }),
      },
      ...fxColumns((r) => phraseOf()[r], app),
    ],
    itemKey: 'phrase', itemMax: NUM_PHRASES - 1,
  };

  const inst = () => p().instruments[app.ctx.instrument];
  const num = (key, label, opts = {}) => ({
    label,
    ...prop(inst, key, { min: 0, max: 0xff, big: 0x10, fmt: (v) => hex(v), nullable: false, ...opts }),
  });
  const instrument = {
    id: 'instrument', letter: 'I',
    title: () => `INST. ${hex(app.ctx.instrument)}`,
    form: [
      {
        label: 'TYPE', get: () => inst().type, min: 0, max: INSTRUMENT_TYPES.length - 1, big: 1,
        nullable: false, fmt: (v) => INSTRUMENT_TYPES[v],
        set: (v) => { inst().type = v; inst().shape = 0; },
      },
      { label: 'NAME', get: () => inst().name, fmt: (v) => v, readOnly: true },
      {
        // Its meaning (and label) depends on the instrument type.
        get label() { return SHAPE_LABELS[inst().type]; },
        get max() { return SHAPE_OPTIONS[inst().type].length - 1; },
        get: () => inst().shape,
        set: (v) => { inst().shape = v; },
        min: 0, big: 1, nullable: false,
        fmt: (v) => SHAPE_OPTIONS[inst().type][v] ?? '--',
      },
      num('transpose', 'TRANSP.', { big: 12, fmt: signed80 }),
      num('volume', 'VOLUME'),
      num('attack', 'ATTACK'),
      num('decay', 'DECAY'),
      num('sustain', 'SUSTAIN'),
      num('release', 'RELEASE'),
      num('filter', 'FILTER', { max: FILTER_TYPES.length - 1, big: 1, fmt: (v) => FILTER_TYPES[v] }),
      num('cutoff', 'CUTOFF'),
      num('resonance', 'RES'),
      num('pan', 'PAN', { fmt: signed80 }),
      num('chorus', 'CHORUS'),
      num('delay', 'DELAY'),
      num('reverb', 'REVERB'),
    ],
    itemKey: 'instrument', itemMax: NUM_INSTRUMENTS - 1,
  };

  const tableOf = () => p().tables[app.ctx.table];
  const table = {
    id: 'table', letter: 'T',
    title: () => `TABLE ${hex(app.ctx.table)}`,
    rowCount: STEPS, visible: 16,
    rowLabel: (r) => r.toString(16).toUpperCase(),
    columns: [
      {
        label: 'N', w: 2, gap: 1,
        cell: (r) => prop(() => tableOf()[r], 'transpose', {
          min: 0, max: 0xff, big: 0x0c, fmt: (v) => hex(v), def: () => 0,
        }),
      },
      {
        label: 'V', w: 2, gap: 1,
        cell: (r) => prop(() => tableOf()[r], 'vol', {
          min: 0, max: 0xff, big: 0x10, fmt: (v) => hex(v), def: () => app.last.vol,
        }),
      },
      ...fxColumns((r) => tableOf()[r], app),
    ],
    itemKey: 'table', itemMax: NUM_TABLES - 1,
  };

  const mix = () => p().mixer;
  const level = (getter, setter, label) => ({
    label, get: getter, set: setter, min: 0, max: 0xff, big: 0x10, nullable: false,
    fmt: (v) => `${hex(v)} ${bar(v)}`,
  });
  const mixer = {
    id: 'mixer', letter: 'M',
    title: () => 'MIXER',
    form: [
      level(() => mix().master, (v) => { mix().master = v; }, 'MASTER'),
      ...Array.from({ length: NUM_TRACKS }, (_, t) =>
        level(() => mix().tracks[t], (v) => { mix().tracks[t] = v; }, `TRACK ${t + 1}`)),
      level(() => mix().chorus, (v) => { mix().chorus = v; }, 'CHORUS'),
      level(() => mix().delay, (v) => { mix().delay = v; }, 'DELAY'),
      level(() => mix().reverb, (v) => { mix().reverb = v; }, 'REVERB'),
    ],
  };

  // A row on the Project screen that does something when you press Edit.
  const action = (text, run) => ({
    label: '', get: () => text, fmt: (v) => `[${v}]`, action: run, isAction: true,
  });

  const project = {
    id: 'project', letter: 'J',
    title: () => 'PROJECT',
    form: [
      { label: 'NAME', get: () => p().name, fmt: (v) => v, readOnly: true },
      {
        label: 'TEMPO', get: () => p().tempo, set: (v) => { p().tempo = v; },
        min: 40, max: 300, big: 10, nullable: false, fmt: (v) => v.toFixed(0).padStart(3, '0'),
      },
      {
        label: 'TRANSPOSE', get: () => p().transpose, set: (v) => { p().transpose = v; },
        min: 0, max: 0xff, big: 12, nullable: false, fmt: signed80,
      },
      { label: '', get: () => '', fmt: () => '', readOnly: true },
      action('SAVE TO FILE', () => { exportFile(p()); app.say('SAVED TO FILE'); }),
      action('LOAD FROM FILE', () => {
        importFile(app.lastPressWasTouch)
          .then((proj) => { app.replaceProject(proj); app.say('LOADED'); })
          .catch(() => app.say('NOT A PROJECT FILE'));
      }),
      action('LOAD DEMO SONG', () => {
        if (confirm('Load the demo song? Your current project will be replaced. Save it to a file first if you want to keep it.')) {
          app.replaceProject(createDemo());
          app.say('DEMO LOADED - GO TO SONG, PRESS PLAY');
        }
      }),
      action('NEW PROJECT', () => {
        if (confirm('Start a new empty project? Your current project will be replaced.')) {
          app.replaceProject(createProject());
          app.say('NEW PROJECT');
        }
      }),
    ],
  };

  const groove = {
    id: 'groove', letter: 'G',
    title: () => 'GROOVE 00',
    rowCount: STEPS, visible: 16,
    rowLabel: (r) => r.toString(16).toUpperCase(),
    columns: [{
      label: 'TICKS', w: 2, gap: 1,
      cell: (r) => ({
        get: () => p().groove[r],
        set: (v) => { p().groove[r] = v; },
        min: 1, max: 0xff, big: 0x10, fmt: (v) => hex(v), def: () => 6,
      }),
    }],
  };

  // Turn form-style screens (one value per row) into the same grid shape.
  const all = { song, chain, phrase, instrument, table, mixer, project, groove };
  for (const s of Object.values(all)) {
    if (s.form) {
      s.rowCount = s.form.length;
      s.visible = s.form.length;
      s.labelWidth = Math.max(...s.form.map((f) => f.label.length)) + 1;
      if (s.id === 'project') s.labelWidth = 10;
      s.columns = [{ label: '', w: 14, gap: 0, cell: (r) => s.form[r] }];
    }
    s.cursor = { row: 0, col: 0, scroll: 0 };
  }
  return all;
}

// Layout of the screen map: Shift + arrows moves between neighbours.
export const SCREEN_MAP = [
  ['project', null, 'groove', null, null],
  ['song', 'chain', 'phrase', 'instrument', 'table'],
  ['mixer', null, null, null, null],
];
