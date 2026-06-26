/**
 * FloppySticks — game.js v3.0 (COMPLETE & FIXED)
 * Main engine: loop engine, delta calculation, input translation, particle generators.
 * All properties exposed dynamically on the shared global execution window context.
 */

'use strict';

const cv  = document.getElementById('gameCanvas');
const ctx = cv.getContext('2d', { alpha: false });
var W = 0, H = 0, mob = false;

const GV  = 33.0;   // Gravitational velocity constant scaled to match delta-time steps
const MXP = 40;     
const MX  = 3;      
const WPS = ['Buster Sword', 'Assault Rifle', 'Smasher Club'];

var gs  = 'MENU';   
var ps  = 0;        
var bs  = 0;        
var shk = 0;        
var dt  = 0;        
var wasOnline = false;
var sv  = false;

var keys   = { a: 0, d: 0 };
var bul    = [];
var pku    = [];
var ptl    = [];
var clouds = [];

function g(id) { return document.getElementById(id); }

// ── Particle Generator ───────────────────────────────────────────────────────
function fx(x, y, c, n, opts) {
  n = n === undefined ? 5 : n;
  opts = opts || {};
  const room = MXP - ptl.length;
  for (let i = 0; i < Math.min(n, room); i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp  = opts.glow ? (Math.random() * 1.5 + 0.5) : (Math.random() * 4 + 1.5);
    ptl.push({
      x:   x,
      y:   y,
      vx:  Math.cos(ang) * sp * (opts.spread || 1),
      vy:  Math.sin(ang) * sp - (opts.rise || 0),
      lf:  opts.glow ? (Math.random() * 25 + 15) : (Math.random() * 30 + 20),
      c:   c,
      sz:  opts.glow ? (Math.random() * 4 + 3) : (Math.random() * 3 + 2),
      gl:  !!opts.glow
    });
  }
}

// ── Scenery Setup ────────────────────────────────────────────────────────────
function initClouds() {
  clouds = [];
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * (window.innerHeight * 0.4) + 20,
      sp: Math.random() * 0.2 + 0.05,
      sz: Math.random() * 50 + 40
    });
  }
}

// ── Structural Dimensions ────────────────────────────────────────────────────
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width  = W;
  cv.height = H;
  mob = W < 768 || ('ontouchstart' in window);
  const ctrls = g('mob-ctrl');
  if (ctrls) ctrls.style.display = mob ? 'flex' : 'none';
  if (P) P.gy = H - 100;
  if (B) B.gy = H - 100;
  if (typeof window.initBirds === 'function') window.initBirds();
  if (typeof window.initLeaves === 'function') window.initLeaves();
}

// ── Environment Initializations ──────────────────────────────────────────────
var P = null, B = null;
function initE() {
  P = new S(W * 0.25, '#3b82f6', false);
  B = new S(W * 0.75, '#ef4444', true);
}

// ── Mode Handlers ────────────────────────────────────────────────────────────
function startBot() {
  gs = 'BOT_MODE';
  ps = 0; bs = 0; bul = []; pku = []; ptl = [];
  g('p-score').textContent = '0 pts';
  g('o-score').textContent = '0 pts';
  g('menu').style.opacity = 0;
  setTimeout(() => g('menu').style.display = 'none', 400);
  initE();
  B.bot = true;
  const bwp = g('b-weapon');
  if (bwp) bwp.textContent = 'NONE';
  const pwp = g('p-weapon');
  if (pwp) pwp.textContent = 'NONE';
  g('mode-badge').textContent = 'VS BOT';
  wasOnline = false;
}

function startOnline() {
  gs = 'ONLINE_MODE';
  ps = 0; bs = 0; bul = []; pku = []; ptl = [];
  g('p-score').textContent = '0 pts';
  g('o-score').textContent = '0 pts';
  g('menu').style.opacity = 0;
  setTimeout(() => g('menu').style.display = 'none', 400);
  initE();
  B.bot = false;
  const bwp = g('b-weapon');
  if (bwp) bwp.textContent = 'NONE';
  const pwp = g('p-weapon');
  if (pwp) pwp.textContent = 'NONE';
  g('mode-badge').textContent = 'ONLINE';
  window.closeOnlineModal();
  wasOnline = true;
  sv = false;
}

function quitToMenu() {
  gs = 'MENU';
  g('menu').style.display = 'flex';
  setTimeout(() => g('menu').style.opacity = 1, 10);
  if (typeof window.closeOnlineModal === 'function') window.closeOnlineModal();
}

// ── Match Save Sequence ──────────────────────────────────────────────────────
async function _save() {
  if (!wasOnline || sv || !window.FB?.isUserSignedIn()) return;
  sv = true;
  const win = ps >= MX;
  await window.FB.saveMatchResult(win).catch(()=>{});
}

// ── Item Drops ───────────────────────────────────────────────────────────────
let spawnTimer = 0;
function processPickups(delta) {
  if (gs === 'MATCH_OVER' || (gs === 'ONLINE_MODE' && !window.isHost)) return;
  spawnTimer += delta;
  if (spawnTimer >= 10.0) {
    spawnTimer = 0;
    if (pku.length < 2) {
      const type = WPS[Math.floor(Math.random() * WPS.length)];
      const posX = Math.random() * (W - 200) + 100;
      if (gs === 'ONLINE_MODE') {
        send({ type: 'pickup_spawn', wt: type, px: posX });
      }
      spawnP(type, posX);
    }
  }
}

function spawnP(type, x) {
  pku.push({ type: type, x: x, y: -40, vy: 0, gr: false, bounce: Math.random() * Math.PI });
}

// ── Input Mappings ───────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (gs === 'MENU') return;
  if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft')  keys.a = 1;
  if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') keys.d = 1;
  if ((e.key.toLowerCase() === 'w' || e.key === 'ArrowUp') && P) P.jump();
  if ((e.key === ' ' || e.key.toLowerCase() === 'f') && P) P.attack();
});

window.addEventListener('keyup', e => {
  if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft')  keys.a = 0;
  if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') keys.d = 0;
});

// Touch Inputs
function setupTouch(id, action) {
  const e = g(id);
  if (!e) return;
  const start = (ev) => { ev.preventDefault(); action(true); };
  const end = (ev) => { ev.preventDefault(); action(false); };
  e.addEventListener('touchstart', start, { passive: false });
  e.addEventListener('touchend', end, { passive: false });
  e.addEventListener('touchcancel', end, { passive: false });
}
setTimeout(() => {
  setupTouch('btn-l', (v) => keys.a = v ? 1 : 0);
  setupTouch('btn-r', (v) => keys.d = v ? 1 : 0);
  setupTouch('btn-j', (v) => { if (v && P) P.jump(); });
  setupTouch('btn-a', (v) => { if (v && P) P.attack(); });
}, 500);

// ── Engine Main Loop ─────────────────────────────────────────────────────────
let lastFrameTime = 0;
let _nt = 0;

function loop(timestamp) {
  requestAnimationFrame(loop);
  if (!lastFrameTime) { lastFrameTime = timestamp; return; }
  
  // Calculate standard frame step delta seconds
  let delta = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  // Enforce frame safety clamp to handle sudden application stutter or context tab shifting
  if (delta > 0.1) delta = 0.1;
  dt = delta;

  // Process Background Rendering
  if (typeof window.drawBackground === 'function') {
    window.drawBackground();
  } else {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, W, H);
  }

  if (gs === 'BOT_MODE' || gs === 'ONLINE_MODE' || gs === 'MATCH_OVER') {
    processPickups(delta);

    // Characters Physics Steps
    if (P) P.update(delta);
    if (B) {
      if (gs === 'BOT_MODE' || B.rd) {
        B.update(delta);
      } else {
        // Precise network position interpolation scaling with delta time steps
        if (B.nx !== null) B.x += (B.nx - B.x) * 12 * delta;
        if (B.ny !== null) {
          if (Math.abs(B.ny - B.gy) < 2) B.y = B.gy;
          else B.y += (B.ny - B.y) * 12 * delta;
        }
      }
    }

    // Process Projectiles
    for (let bi = bul.length - 1; bi >= 0; bi--) {
      const b = bul[bi];
      b.x += b.vx * delta;
      
      if (b.x < -40 || b.x > W + 40) { 
        bul.splice(bi, 1); 
        continue; 
      }
      
      const target = b.bot ? P : B;
      if (target && !target.rd) {
        if (b.x > target.x - 26 && b.x < target.x + 26 && b.y < target.y && b.y > target.y - 65) {
          target.hit(12, b.vx > 0 ? 1 : -1);
          if (gs === 'ONLINE_MODE' && !b.bot) {
            send({ type: 'hit', amt: 12, kb: b.vx > 0 ? 1 : -1 });
          }
          bul.splice(bi, 1);
        }
      }
    }

    // Process Visual Particles
    for (let pi = ptl.length - 1; pi >= 0; pi--) {
      const p = ptl[pi];
      p.x += p.vx * 60 * delta;
      p.y += p.vy * 60 * delta;
      if (!p.gl) p.vy += GV * 0.8 * delta; // standard particle atmospheric tracking
      p.lf -= 60 * delta;
      if (p.lf <= 0) ptl.splice(pi, 1);
    }

    // Process Item Box Crates Drops Physics
    const gy = H - 100;
    for (let qi = pku.length - 1; qi >= 0; qi--) {
      const pk = pku[qi];
      pk.bounce += 2 * delta;
      if (!pk.gr) {
        pk.vy += GV * delta;
        pk.y  += pk.vy * 60 * delta;
        if (pk.y >= gy - 16) {
          pk.y = gy - 16;
          pk.vy = 0;
          pk.gr = true;
        }
      }
      
      // Pickup colliders loop checks
      let itemClaimed = false;
      for (let ji = 0; ji < 2; ji++) {
        const ent = ji === 0 ? P : B;
        const isB = ji === 1;
        if (ent && !ent.rd && Math.hypot(ent.x - pk.x, (ent.y - 30) - pk.y) < 40) {
          ent.wp = pk.type;
          const weaponUi = g(isB ? 'b-weapon' : 'p-weapon');
          if (weaponUi) weaponUi.textContent = pk.type.toUpperCase();
          fx(pk.x, pk.y, '#f59e0b', 8, { glow: true, spread: 6, rise: 3 });
          if (gs === 'ONLINE_MODE' && window.isHost) {
            send({ type: 'pickup_taken', i: qi, bot: isB, wt: pk.type });
          }
          pku.splice(qi, 1); 
          itemClaimed = true; 
          break;
        }
      }
      if (itemClaimed) continue;
    }

    // Call draw layers inside draw.js
    if (typeof window.drawActiveGameplayElements === 'function') {
      window.drawActiveGameplayElements();
    }
    if (P) P.draw();
    if (B) B.draw();

    // Outbound state sync rate
    if (gs === 'ONLINE_MODE' && conn && conn.open && ++_nt >= 2) {
      _nt = 0;
      send({
        type: 'state',
        x:    P.x, 
        yRel: P.y - P.gy,
        vx:   P.vx, 
        vy:   P.vy,
        fl:   P.fl, 
        at:   P.at, 
        gr:   P.gr, 
        sy:   P.sq,
        ia:   P.atk, 
        as:   P.asw, 
        if:   P.flp, 
        fa:   P.fa,
        wp:   P.wp,  
        rd:   P.rd, 
        hp:   P.hp, 
        ff:   P.ff
      });
    }
  }

  if (typeof window.drawMatchOverOverlay === 'function') {
    window.drawMatchOverOverlay();
  }
}

// Bootstrap
window.addEventListener('resize', resize);
window.startBot = startBot;
window.startOnline = startOnline;
window.quitToMenu = quitToMenu;

resize();
initClouds();
initE();
requestAnimationFrame(loop);