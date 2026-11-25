import { createApp } from './app.js';
import { render, COLS, ROWS } from './render.js';
import { bindKeyboard, bindButtons } from './input.js';

const app = createApp();
const screenEl = document.getElementById('screen');
const device = document.getElementById('device');

let queued = false;
app.onChange(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(screenEl, app); });
});

// Scale the character grid so all of it fits the LCD at any window size.
const lcd = screenEl.parentElement;
const MAX_FONT = 16;
function fitScreen() {
  // Fill the width first, then shrink if the page would need scrolling.
  const style = getComputedStyle(lcd);
  const innerW = lcd.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  let size = Math.min(MAX_FONT, innerW / (COLS * 0.602));
  screenEl.style.fontSize = `${size}px`;
  const overflow = document.documentElement.scrollHeight - window.innerHeight;
  if (overflow > 0) {
    const h = screenEl.offsetHeight;
    size = Math.max(4, size * Math.max(0.2, (h - overflow - 2) / h));
    screenEl.style.fontSize = `${size}px`;
  }
}
let fitQueued = false;
const queueFit = () => {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fitScreen(); });
};
window.addEventListener('resize', queueFit);
window.addEventListener('orientationchange', queueFit);
document.fonts?.ready.then(queueFit);
fitScreen();

// Browsers only allow sound after the user interacts. Touch screens count
// the moment a finger lifts, so listen for every kind of interaction.
for (const type of ['pointerup', 'touchend', 'keydown', 'click']) {
  window.addEventListener(type, () => app.engine.unlock(), { capture: true, passive: true });
}

bindKeyboard(app);
bindButtons(app, device);
render(screenEl, app);

// Handy for poking at things from the browser console.
window.tracker = app;
