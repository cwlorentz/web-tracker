// Sound engine built on the Web Audio API.
// Each of the 8 tracks plays one note at a time, like on a hardware tracker.

import { NUM_TRACKS, INSTRUMENT_TYPES, FX_COMMANDS } from './state.js';

const TYPE = Object.fromEntries(INSTRUMENT_TYPES.map((t, i) => [t, i]));
const FX = Object.fromEntries(FX_COMMANDS.map((c, i) => [c, i]));
const FILTERS = [null, 'lowpass', 'highpass', 'bandpass'];
const FM = [
  { ratio: 3.5, index: 4, decay: 0.8 }, // BELL
  { ratio: 1, index: 2.5, decay: 0.25 }, // BASS
  { ratio: 1, index: 1.5, decay: 0.6 }, // EPIANO
  { ratio: 1.41, index: 6, decay: 0.4 }, // METAL
];

const midiToHz = (n) => 440 * 2 ** ((n - 57) / 12); // 57 = A-4 in this tracker's numbering
const envTime = (v) => 0.002 + (v / 255) ** 2 * 3; // 00..FF -> ~0..3 seconds
const signed80 = (v) => v - 0x80;

export function createEngine() {
  let ctx = null;
  let master, trackGains, buses, samples, noise, pulseWave;
  const voices = Array(NUM_TRACKS).fill(null);
  const trackVol = Array(NUM_TRACKS).fill(1);

  // ---- Setup (must happen after the user touches or presses something) ----

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(ctx.destination);
    master = ctx.createGain();
    master.connect(limiter);

    trackGains = Array.from({ length: NUM_TRACKS }, () => {
      const g = ctx.createGain();
      g.connect(master);
      return g;
    });

    buses = { chorus: makeChorus(), delay: makeDelay(), reverb: makeReverb() };
    samples = makeDrumKit();
    noise = makeNoise(2);
    pulseWave = makePulseWave(0.25);
  }

  function makeChorus() {
    const input = ctx.createGain();
    const out = ctx.createGain();
    const d = ctx.createDelay(0.1);
    d.delayTime.value = 0.018;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.7;
    depth.gain.value = 0.004;
    lfo.connect(depth).connect(d.delayTime);
    lfo.start();
    input.connect(d).connect(out);
    out.connect(master);
    return { input, out };
  }

  function makeDelay() {
    const input = ctx.createGain();
    const out = ctx.createGain();
    const d = ctx.createDelay(2);
    const fb = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3500;
    fb.gain.value = 0.42;
    d.delayTime.value = 0.375;
    input.connect(d);
    d.connect(tone).connect(fb).connect(d);
    tone.connect(out);
    out.connect(master);
    return { input, out, node: d };
  }

  function makeReverb() {
    const input = ctx.createGain();
    const out = ctx.createGain();
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    conv.buffer = ir;
    input.connect(conv).connect(out);
    out.connect(master);
    return { input, out };
  }

  function makeNoise(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makePulseWave(width) {
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * width) * 2;
    return ctx.createPeriodicWave(real, imag);
  }

  // Drum sounds are generated in code, so no sample files are needed.
  function makeDrumKit() {
    const sr = ctx.sampleRate;
    const make = (seconds, fn) => {
      const len = Math.floor(sr * seconds);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const state = { phase: 0, phase2: 0, last: 0 };
      for (let i = 0; i < len; i++) d[i] = fn(i / sr, state);
      return buf;
    };
    const rnd = () => Math.random() * 2 - 1;
    const hiNoise = (s) => { const n = rnd(); const v = n - s.last; s.last = n; return v * 0.5; };
    const sine = (s, hz, key = 'phase') => { s[key] += (2 * Math.PI * hz) / sr; return Math.sin(s[key]); };
    const sq = (s, hz, key) => { s[key] += hz / sr; return s[key] % 1 < 0.5 ? 1 : -1; };

    return [
      make(0.6, (t, s) => sine(s, 45 + 110 * Math.exp(-t * 28)) * Math.exp(-t * 6) * 1.1), // KICK
      make(0.3, (t, s) => (rnd() * 0.7 * Math.exp(-t * 16)) + sine(s, 185) * Math.exp(-t * 30) * 0.6), // SNARE
      make(0.08, (t, s) => hiNoise(s) * Math.exp(-t * 60)), // HAT
      make(0.45, (t, s) => hiNoise(s) * Math.exp(-t * 7)), // OPENHAT
      make(0.3, (t) => { // CLAP
        const burst = [0, 0.011, 0.022].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) * 90) : 0), 0);
        return rnd() * (t < 0.03 ? burst * 0.6 : Math.exp(-(t - 0.022) * 14) * 0.7);
      }),
      make(0.5, (t, s) => sine(s, 95 + 90 * Math.exp(-t * 14)) * Math.exp(-t * 7)), // TOM
      make(0.06, (t, s) => (sine(s, 1700) * 0.5 + sine(s, 420, 'phase2') * 0.5) * Math.exp(-t * 70)), // RIM
      make(0.35, (t, s) => (sq(s, 545, 'phase') + sq(s, 815, 'phase2')) * 0.25 * Math.exp(-t * 9)), // COWBELL
    ];
  }

  // ---- Voices ----

  function stopVoice(track, time, fade) {
    const v = voices[track];
    if (!v) return;
    voices[track] = null;
    const g = v.amp.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(time);
    else { g.cancelScheduledValues(time); }
    g.setTargetAtTime(0, time, Math.max(0.003, fade / 4));
    const end = time + fade + 0.05;
    v.sources.forEach((src) => { try { src.stop(end); } catch { /* already stopped */ } });
  }

  function startVoice(track, inst, note, vel, time) {
    stopVoice(track, time, 0.006);
    if (inst.type === TYPE.NONE) return;

    const amp = ctx.createGain();
    amp.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = signed80(inst.pan) / 127;
    let head = amp;

    const ftype = FILTERS[inst.filter];
    if (ftype) {
      const f = ctx.createBiquadFilter();
      f.type = ftype;
      f.frequency.value = 20 * 2 ** ((inst.cutoff / 255) * 10);
      f.Q.value = 0.7 + (inst.resonance / 255) * 18;
      f.connect(amp);
      head = f;
    }
    amp.connect(pan).connect(trackGains[track]);
    for (const bus of ['chorus', 'delay', 'reverb']) {
      if (!inst[bus]) continue;
      const send = ctx.createGain();
      send.gain.value = inst[bus] / 255;
      pan.connect(send).connect(buses[bus].input);
    }

    const pitch = note + signed80(inst.transpose);
    const hz = midiToHz(pitch);
    const sources = [];

    if (inst.type === TYPE.SAMPLER) {
      const src = ctx.createBufferSource();
      src.buffer = samples[inst.shape] ?? samples[0];
      src.playbackRate.value = 2 ** ((pitch - 48) / 12); // C-4 plays the sample as recorded
      src.connect(head);
      sources.push(src);
    } else if (inst.type === TYPE.FMSYNTH) {
      const p = FM[inst.shape] ?? FM[0];
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const idx = ctx.createGain();
      car.frequency.value = hz;
      mod.frequency.value = hz * p.ratio;
      idx.gain.setValueAtTime(hz * p.index, time);
      idx.gain.setTargetAtTime(hz * p.index * 0.15, time, p.decay / 3);
      mod.connect(idx).connect(car.frequency);
      car.connect(head);
      sources.push(car, mod);
    } else if (inst.shape === 4) { // NOISE
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.playbackRate.value = Math.min(4, 2 ** ((pitch - 60) / 24));
      src.connect(head);
      sources.push(src);
    } else {
      const osc = ctx.createOscillator();
      if (inst.shape === 0) osc.setPeriodicWave(pulseWave);
      else osc.type = ['square', 'sawtooth', 'triangle', 'sine'][inst.shape];
      osc.frequency.value = hz;
      osc.connect(head);
      sources.push(osc);
    }

    // Amp envelope: attack, then decay down to the sustain level.
    const peak = (inst.volume / 255) * vel * (inst.type === TYPE.SAMPLER ? 0.9 : 0.35);
    const a = envTime(inst.attack) * 0.5;
    const g = amp.gain;
    g.setValueAtTime(0, time);
    g.linearRampToValueAtTime(peak, time + a + 0.002);
    g.setTargetAtTime(peak * (inst.sustain / 255), time + a + 0.002, envTime(inst.decay) / 4);

    sources.forEach((s) => s.start(time));
    const release = envTime(inst.release);
    voices[track] = { amp, sources, release, peak };
    // A sample that finishes on its own frees the track.
    if (inst.type === TYPE.SAMPLER) {
      sources[0].onended = () => { if (voices[track]?.amp === amp) voices[track] = null; };
    }
  }

  function applyFx(track, fx, time) {
    for (const { cmd, val } of fx) {
      if (cmd == null) continue;
      if (cmd === FX.KIL) stopVoice(track, time + ((val ?? 0) & 0x0f) * 0.02, 0.01);
      if (cmd === FX.VOL && voices[track]) {
        const v = voices[track];
        v.amp.gain.setTargetAtTime(v.peak * ((val ?? 0) / 255), time, 0.005);
      }
    }
  }

  function applyMixer(project) {
    const m = project.mixer;
    master.gain.value = (m.master / 0xe0) * 0.6;
    m.tracks.forEach((v, t) => { trackGains[t].gain.value = (v / 0xe0) * trackVol[t]; });
    buses.chorus.out.gain.value = m.chorus / 0xe0;
    buses.delay.out.gain.value = m.delay / 0xe0;
    buses.reverb.out.gain.value = m.reverb / 0xe0;
    buses.delay.node.delayTime.value = Math.min(1.9, (60 / project.tempo) * 0.75);
  }

  // ---- Public API ----

  const engine = {
    // Browsers only allow sound after a tap or key press.
    unlock() {
      if (!ctx) init();
      if (ctx.state !== 'running') ctx.resume();
    },
    get ready() { return !!ctx; },
    now() { return ctx ? ctx.currentTime : 0; },

    // Play one phrase row on a track.
    trigger(track, step, project, transpose = 0, time = null) {
      if (!ctx) return;
      const when = time ?? ctx.currentTime + 0.01;
      applyMixer(project);
      if (step.note != null) {
        const inst = project.instruments[step.inst ?? 0];
        const vel = step.vol == null ? 1 : step.vol / 255;
        startVoice(track, inst, step.note + transpose, vel, when);
      } else if (step.vol != null && voices[track]) {
        voices[track].amp.gain.setTargetAtTime(voices[track].peak * (step.vol / 255), when, 0.005);
      }
      applyFx(track, step.fx, when);
    },

    // Hear a note while editing it.
    preview(track, step, project) {
      if (!ctx || step.note == null) return;
      engine.trigger(track, { ...step, fx: [] }, project);
      const v = voices[track];
      if (v) setTimeout(() => { if (voices[track] === v) stopVoice(track, ctx.currentTime, v.release); }, 350);
    },

    stopAll() {
      if (!ctx) return;
      for (let t = 0; t < NUM_TRACKS; t++) stopVoice(t, ctx.currentTime, 0.03);
    },
  };
  return engine;
}

