// ---------- Paradoxify Fruits 3D — bootstrap ----------
import { Game } from './game.js';

const fill = document.getElementById('load-fill');
const status = document.getElementById('load-status');

async function boot() {
  const game = new Game();
  window.__paradoxify = game; // debug handle
  try {
    await game.init((pct, msg) => {
      fill.style.width = pct + '%';
      status.textContent = msg;
    });
  } catch (err) {
    console.error(err);
    status.textContent = 'Failed to start: ' + err.message + ' — check your connection (Three.js CDN) and reload.';
    status.style.color = '#ff6b81';
    return;
  }
  document.getElementById('loading').style.display = 'none';
  game.start();
}

boot();
