// A short example song so there is something to explore and play.

import { createProject } from './state.js';

// Note names to numbers: n('C-4') === 48
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const n = (name) => NAMES.indexOf(name.slice(0, 2)) + 12 * Number(name[2]);

function fill(phrase, steps) {
  for (const [row, note, inst, vol] of steps) {
    phrase[row].note = n(note);
    phrase[row].inst = inst;
    if (vol != null) phrase[row].vol = vol;
  }
}

export function createDemo() {
  const p = createProject();
  p.name = 'DEMO';
  p.tempo = 118;
  const ph = p.phrases;

  // 00: kick
  fill(ph[0], [[0, 'C-4', 1], [4, 'C-4', 1], [8, 'C-4', 1], [12, 'C-4', 1], [14, 'C-4', 1, 0x90]]);
  // 01: snare and hats
  fill(ph[1], [
    [0, 'C-4', 3, 0x70], [2, 'C-4', 3], [4, 'C-4', 2], [6, 'C-4', 3],
    [8, 'C-4', 3, 0x70], [10, 'C-4', 3], [12, 'C-4', 2], [14, 'C-4', 3], [15, 'C-4', 3, 0x60],
  ]);
  // 02 / 03: bass line
  fill(ph[2], [[0, 'C-2', 4], [3, 'C-2', 4], [6, 'D#2', 4], [8, 'C-2', 4], [11, 'G-1', 4], [14, 'A#1', 4]]);
  fill(ph[3], [[0, 'G#1', 4], [3, 'G#1', 4], [6, 'C-2', 4], [8, 'G#1', 4], [11, 'D#2', 4], [14, 'G-1', 4]]);
  // 04 / 05: bell melody
  fill(ph[4], [[0, 'G-4', 5], [3, 'D#4', 5], [6, 'C-4', 5], [10, 'D-4', 5], [12, 'D#4', 5]]);
  fill(ph[5], [[0, 'C-4', 5], [3, 'G#3', 5], [6, 'C-4', 5], [10, 'D#4', 5], [12, 'G-4', 5]]);

  // Chains: lists of phrases
  p.chains[0][0].phrase = 0;
  p.chains[1][0].phrase = 1;
  p.chains[2][0].phrase = 2; p.chains[2][1].phrase = 3;
  p.chains[3][0].phrase = 4; p.chains[3][1].phrase = 5;

  // Song: four rows of every chain, so the song loops
  for (let r = 0; r < 4; r++) {
    p.song[r][0] = 0;
    p.song[r][1] = 1;
    p.song[r][2] = 2;
    p.song[r][3] = 3;
  }
  return p;
}
