'use strict';

const cv = document.getElementById('gameCanvas');
const ctx = cv.getContext('2d', { alpha: false });
var W = window.innerWidth, H = window.innerHeight;

window.GV = 35.0; // Gravity
window.MX = 3; // Max Score
window.WPS = ['Buster Sword', 'Smasher Club'];

window.gs = 'MENU';
window.ps = 0;
window.bs = 0;
window.shk = 0;
window.dt = 0;

window.keys = { a: 0, d: 0 };
window.pku = [];
window.ptl = [];

// Expose entities globally so other scripts find them easily
window.P = null;
window.B = null;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width = W;
  cv.height = H;
  if (window.P) window.P.gy = H - 100;
  if (window.B) window.B.gy = H - 100;
}
window.addEventListener('resize', resize);

function fx(x, y, c, n, opts = {}) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = Math.random() * 4 + 2;
    window.ptl.push({
      x: x, y: y,
      vx: Math.cos(ang) * sp * (opts.spread || 1),
      vy: Math.sin(ang) * sp,
      lf: 30, mx: 30, c: c, sz: Math.random() * 3 + 2
    });
  }
}

function startBot() {
  window.gs = 'BOT_MODE';
  window.ps = 0; window.bs = 0; 
  window.pku = []; window.ptl = []; window.floatingTexts = [];
  
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  
  window.P = new S(W * 0.25, '#3b82f6', false);
  window.B = new S(W * 0.75, '#ef4444', true);
  
  // Big intro text
  window.addFloatingText(W / 2, H / 2, "FIGHT!", "#fbbf24");
}

let spawnTimer = 0;
function processPickups(delta) {
  if (window.gs !== 'BOT_MODE') return; // simplified for bot context
  spawnTimer += delta;
  
  if (spawnTimer >= 8.0 && window.pku.length < 1) {
    spawnTimer = 0;
    const type = window.WPS[Math.floor(Math.random() * window.WPS.length)];
    window.pku.push({ type: type, x: Math.random() * (W - 200) + 100, y: -40, vy: 0, gr: false });
  }
}

window.addEventListener('keydown', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') window.keys.a = 1;
  if (e.key === 'd' || e.key === 'ArrowRight') window.keys.d = 1;
  if ((e.key === 'w' || e.key === 'ArrowUp') && window.P) window.P.jump();
  if ((e.key === ' ' || e.key === 'f') && window.P) window.P.attack();
});

window.addEventListener('keyup', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') window.keys.a = 0;
  if (e.key === 'd' || e.key === 'ArrowRight') window.keys.d = 0;
});

let lastFrameTime = performance.now();

function loop(timestamp) {
  requestAnimationFrame(loop);
  
  let delta = (timestamp - lastFrameTime) / 1000;
  if (delta > 0.1) delta = 0.1;
  lastFrameTime = timestamp;
  window.dt = delta;

  // 1. Draw Environment (from draw.js)
  if (typeof drawBackground === 'function') drawBackground();

  // 2. Logic Update
  if (window.gs === 'BOT_MODE' || window.gs === 'MATCH_OVER') {
    processPickups(delta);

    if (window.P) window.P.update(delta);
    if (window.B) window.B.update(delta);

    // Particles logic
    for (let pi = window.ptl.length - 1; pi >= 0; pi--) {
      const p = window.ptl[pi];
      p.x += p.vx * 60 * delta;
      p.y += p.vy * 60 * delta;
      p.vy += window.GV * 0.5 * delta;
      p.lf -= 60 * delta;
      if (p.lf <= 0) window.ptl.splice(pi, 1);
    }

    // Pickup physics & collision
    const gy = H - 100;
    for (let qi = window.pku.length - 1; qi >= 0; qi--) {
      const pk = window.pku[qi];
      if (!pk.gr) {
        pk.vy += window.GV * delta;
        pk.y += pk.vy * 60 * delta;
        if (pk.y >= gy - 15) { pk.y = gy - 15; pk.gr = true; }
      }
      
      let claimed = false;
      [window.P, window.B].forEach(ent => {
        if (!claimed && ent && !ent.rd && Math.abs(ent.x - pk.x) < 30 && Math.abs((ent.y - 30) - pk.y) < 40) {
          ent.wp = pk.type;
          // UI Drop Text Notification!
          window.addFloatingText(ent.x, ent.y - 60, `+ ${pk.type.toUpperCase()}`, '#fcd34d');
          window.pku.splice(qi, 1);
          claimed = true;
        }
      });
    }

    // 3. Draw Entities & UI Overlays
    if (typeof drawActiveGameplayElements === 'function') drawActiveGameplayElements();
    if (window.P) window.P.draw();
    if (window.B) window.B.draw();
  }
}

// Bootstrap
resize();
requestAnimationFrame(loop);