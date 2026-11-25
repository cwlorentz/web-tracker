// Keyboard and on-screen buttons both drive the same eight buttons.

export const KEYMAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  Space: 'play',
  KeyZ: 'option',
  KeyX: 'edit',
};

const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

export function bindKeyboard(app) {
  window.addEventListener('keydown', (e) => {
    const btn = KEYMAP[e.code];
    if (!btn) return;
    e.preventDefault();
    // Holding an arrow repeats it; holding a modifier does not.
    if (e.repeat && !DIRECTIONS.has(btn)) return;
    app.lastPressWasTouch = false;
    app.press(btn);
  });
  window.addEventListener('keyup', (e) => {
    const btn = KEYMAP[e.code];
    if (!btn) return;
    e.preventDefault();
    app.release(btn);
  });
  window.addEventListener('blur', () => app.releaseAll());
}

export function bindButtons(app, root) {
  root.querySelectorAll('[data-btn]').forEach((el) => {
    const btn = el.dataset.btn;
    let repeatTimer = null;
    const stop = () => {
      clearTimeout(repeatTimer);
      clearInterval(repeatTimer);
      if (app.held[btn]) app.release(btn);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      app.lastPressWasTouch = e.pointerType !== 'mouse';
      app.press(btn);
      if (DIRECTIONS.has(btn)) {
        repeatTimer = setTimeout(() => {
          repeatTimer = setInterval(() => app.press(btn), 70);
        }, 350);
      }
    });
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // Light up on-screen buttons while their key is held.
  app.onChange(() => {
    root.querySelectorAll('[data-btn]').forEach((el) => {
      el.classList.toggle('held', !!app.held[el.dataset.btn]);
    });
  });
}
