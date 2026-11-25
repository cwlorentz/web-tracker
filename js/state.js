// Project data model. Everything is plain JSON so it can be saved later.

export const NUM_TRACKS = 8;
export const SONG_ROWS = 256;
export const STEPS = 16; // rows in a chain, phrase or table
export const NUM_CHAINS = 255;
export const NUM_PHRASES = 255;
export const NUM_INSTRUMENTS = 128;
export const NUM_TABLES = 128;

// Effect commands available in phrase and table FX columns.
export const FX_COMMANDS = [
  'ARP', 'CHA', 'DEL', 'HOP', 'KIL', 'RAN', 'RET', 'REP',
  'NTH', 'PSL', 'PBN', 'PVB', 'PVX', 'SCA', 'SED', 'TBL',
  'THO', 'TIC', 'TPO', 'VMV', 'VOL', 'PIT', 'FIN', 'CUT',
];

export const INSTRUMENT_TYPES = ['WAVSYNTH', 'SAMPLER', 'FMSYNTH', 'NONE'];
export const WAVE_SHAPES = ['PULSE', 'SAW', 'TRI', 'SINE', 'NOISE'];
export const SAMPLES = ['KICK', 'SNARE', 'HAT', 'OPENHAT', 'CLAP', 'TOM', 'RIM', 'COWBELL'];
export const FM_PRESETS = ['BELL', 'BASS', 'EPIANO', 'METAL'];

// What the SHAPE row means depends on the instrument type.
export const SHAPE_OPTIONS = [WAVE_SHAPES, SAMPLES, FM_PRESETS, ['--']];
export const SHAPE_LABELS = ['SHAPE', 'SAMPLE', 'PRESET', 'SHAPE'];
export const FILTER_TYPES = ['OFF', 'LOWPASS', 'HIGHPASS', 'BANDPASS'];

const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

const emptyFx = () => range(3, () => ({ cmd: null, val: null }));

export function emptyPhraseStep() {
  return { note: null, vol: null, inst: null, fx: emptyFx() };
}

export function emptyInstrument(i) {
  return {
    name: `INST${i.toString(16).toUpperCase().padStart(2, '0')}`,
    type: 0, // index into INSTRUMENT_TYPES
    shape: 0,
    transpose: 0x80, // 80 = no transpose (signed around 80)
    volume: 0xff,
    attack: 0x00,
    decay: 0x60,
    sustain: 0x00,
    release: 0x30,
    filter: 0,
    cutoff: 0xff,
    resonance: 0x00,
    pan: 0x80,
    chorus: 0x00,
    delay: 0x00,
    reverb: 0x00,
  };
}

// A few ready-to-use instruments so a new project makes sound straight away.
function starterInstruments() {
  const list = range(NUM_INSTRUMENTS, emptyInstrument);
  const set = (i, props) => Object.assign(list[i], props);
  set(0, { name: 'SYNTH', type: 0, shape: 0, cutoff: 0xc0, decay: 0x70 });
  set(1, { name: 'KICK', type: 1, shape: 0, decay: 0xff, sustain: 0xff, release: 0x10 });
  set(2, { name: 'SNARE', type: 1, shape: 1, decay: 0xff, sustain: 0xff, release: 0x10 });
  set(3, { name: 'HAT', type: 1, shape: 2, decay: 0xff, sustain: 0xff, release: 0x10, volume: 0xb0 });
  set(4, { name: 'BASS', type: 0, shape: 1, filter: 1, cutoff: 0x80, resonance: 0x50, decay: 0x60, sustain: 0x40 });
  set(5, { name: 'BELL', type: 2, shape: 0, decay: 0xa0, delay: 0x60, reverb: 0x50 });
  return list;
}

export function createProject() {
  return {
    version: 1,
    name: 'NEWPROJECT',
    tempo: 120,
    transpose: 0x80,
    song: range(SONG_ROWS, () => range(NUM_TRACKS, () => null)),
    chains: range(NUM_CHAINS, () =>
      range(STEPS, () => ({ phrase: null, transpose: 0x00 })),
    ),
    phrases: range(NUM_PHRASES, () => range(STEPS, emptyPhraseStep)),
    instruments: starterInstruments(),
    tables: range(NUM_TABLES, () =>
      range(STEPS, () => ({ transpose: null, vol: null, fx: emptyFx() })),
    ),
    groove: range(STEPS, (i) => (i < 2 ? 6 : null)), // ticks per step
    mixer: {
      master: 0xe0,
      tracks: range(NUM_TRACKS, () => 0xe0),
      chorus: 0xc0,
      delay: 0xc0,
      reverb: 0xc0,
    },
  };
}
