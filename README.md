# Pocket Tracker

A browser sketchpad for learning a handheld-tracker workflow: Song, Chain,
Phrase, Instrument and Table screens driven by eight buttons.

**Play it:** https://cwlorentz.github.io/web-tracker/

## Controls

| Button | Keyboard |
| ------ | -------- |
| Arrows | Arrow keys |
| Shift  | Shift |
| Play   | Space |
| Option | Z |
| Edit   | X |

- **Arrows** move the cursor.
- **Shift + arrows** move between screens (see the map in the top right).
- **Edit** on an empty cell puts in the last value you used.
- **Edit + arrows** change a value (left/right small steps, up/down big steps).
- **Option + Edit** clears a cell.
- **Option + arrows** flip to the next/previous chain, phrase, instrument or table.
- **Play** starts and stops.

## Sound and saving

- Six starter instruments: 00 synth, 01 kick, 02 snare, 03 hat, 04 bass, 05 bell.
- Instrument types: WAVSYNTH (pulse, saw, triangle, sine, noise), SAMPLER
  (built-in drum kit), FMSYNTH (bell, bass, e-piano, metal).
- Your project saves in the browser automatically. The Project screen
  (Shift + Up from Song) can save to a file, load a file, load a demo song or
  start a new project.
- Working FX so far: KIL (stop the note) and VOL (set volume).

No build step: it is plain HTML, CSS and JavaScript. To run locally, serve the
folder with any static server, e.g. `python3 -m http.server`.
