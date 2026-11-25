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
function fitScreen() {
  const { width, height } = lcd.getBoundingClientRect();
  const size = Math.min((width - 16) / (COLS * 0.6), (height - 12) / (ROWS * 1.3));
  screenEl.style.fontSize = `${Math.floor(size * 10) / 10}px`;
}
new ResizeObserver(fitScreen).observe(lcd);
fitScreen();

bindKeyboard(app);
bindButtons(app, device);
render(screenEl, app);

// Handy for poking at things from the browser console.
window.tracker = app;
