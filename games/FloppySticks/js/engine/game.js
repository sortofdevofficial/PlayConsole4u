'use strict';

const cv = document.getElementById('gameCanvas');
const ctx = cv.getContext('2d', { alpha: false });
var W = window.innerWidth, H = window.innerHeight;

window.GV = 38.0; 
window.MX = 5; 
window.WPS = ['Buster Sword', 'Smasher Club'];

window.gs = 'MENU';
window.ps = 0;
window.bs = 0;
window.shk = 0;
window.dt = 0;

window.keys = { a: 0, d: 0 };
window.pku = [];
window.ptl = [];

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
    const sp = Math.random() * 5 + 3;
    window.ptl.push({
      x: x, y: y,
      vx: Math.cos(ang) * sp * (opts.spread || 1.5),
      vy: Math.sin(ang) * sp,
      lf: 35, mx: 35, c: c, sz: Math.random() * 4 + 2
    });
  }
}

function startBot() {
  window.gs = 'BOT_MODE';
  window.ps = 0; window.bs = 0; 
  window.pku = []; window.ptl = []; window.floatingTexts = [];
  
  if (document.getElementById('menu')) document.getElementById('menu').style.display = 'none';
  if (document.getElementById('hud')) document.getElementById('hud').style.display = 'flex';
  
  // Custom neon palettes matching the blue aura of image_f224a4.png
  window.P = new S(W * 0.25, '#00f0ff', false); 
  window.B = new S(W * 0.75, '#ff0055', true);
  
  window.addFloatingText(W / 2, H / 2.5, "READY... FIGHT!", "#00f0ff");
}

let spawnTimer = 4.0; // Instantly start timing up first drop faster
function processPickups(delta) {
  if (window.gs !== 'BOT_MODE') return;
  spawnTimer += delta;
  
  // Faster random spawning for immediate crate capture loops
  if (spawnTimer >= 6.0 && window.pku.length < 1) {
    spawnTimer = 0;
    const type = window.WPS[Math.floor(Math.random() * window.WPS.length)];
    window.pku.push({ type: type, x: Math.random() * (W - 300) + 150, y: -50, vy: 0, gr: false });
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

  // 1. Environmental Layer (draw.js)
  if (typeof drawBackground === 'function') drawBackground();

  // 2. State & Physics Engine Core
  if (window.gs === 'BOT_MODE' || window.gs === 'MATCH_OVER') {
    processPickups(delta);

    if (window.P) window.P.update(delta);
    if (window.B) window.B.update(delta);

    // Dynamic Physics Particles Iteration Loop
    for (let pi = window.ptl.length - 1; pi >= 0; pi--) {
      const p = window.ptl[pi];
      p.x += p.vx * 60 * delta;
      p.y += p.vy * 60 * delta;
      p.vy += window.GV * 0.4 * delta;
      p.lf -= 60 * delta;
      if (p.lf <= 0) window.ptl.splice(pi, 1);
    }

    // Drops Physics & Claim Collision Check
    const gy = H - 100;
    for (let qi = window.pku.length - 1; qi >= 0; qi--) {
      const pk = window.pku[qi];
      if (!pk.gr) {
        pk.vy += window.GV * delta;
        pk.y += pk.vy * 60 * delta;
        if (pk.y >= gy - 16) { pk.y = gy - 16; pk.gr = true; }
      }
      
      let claimed = false;
      [window.P, window.B].forEach(ent => {
        if (!claimed && ent && !ent.rd && Math.abs(ent.x - pk.x) < 36 && Math.abs((ent.y - 30) - pk.y) < 50) {
          ent.wp = pk.type;
          
          // Flash Glowing Weapon Drop Notification UI Text System
          window.addFloatingText(ent.x, ent.y - 85, `+ ${pk.type.toUpperCase()}`, '#fcd34d');
          fx(pk.x, pk.y, '#fcd34d', 10);
          
          window.pku.splice(qi, 1);
          claimed = true;
        }
      });
    }

    // 3. Complete Graphic Canvas Overlay Rendering
    if (typeof drawActiveGameplayElements === 'function') drawActiveGameplayElements();
    if (window.P) window.P.draw();
    if (window.B) window.B.draw();
  }
}

// Bootstrap Initialization
resize();
requestAnimationFrame(loop);