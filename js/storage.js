// Saving: projects are kept in this browser automatically, and can be
// saved to / loaded from a file to back them up or move between devices.

import { createProject } from './state.js';

const KEY = 'pocket-tracker:project';

// Fill in anything missing (e.g. from an older save) with defaults.
function normalise(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.song)) return null;
  const fresh = createProject();
  const merged = { ...fresh, ...data, mixer: { ...fresh.mixer, ...data.mixer } };
  merged.instruments = fresh.instruments.map((def, i) => ({ ...def, ...(data.instruments?.[i] ?? {}) }));
  return merged;
}

export function loadSaved() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function exportFile(project) {
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.toLowerCase() || 'project'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Opening a file picker needs a "real" tap. On touch screens that only counts
// when the finger lifts, so we wait for it when the press came from a tap.
export function importFile(fromTouch) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = normalise(JSON.parse(await file.text()));
        if (!data) throw new Error('not a project');
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    if (fromTouch) window.addEventListener('pointerup', () => input.click(), { once: true });
    else input.click();
  });
}
