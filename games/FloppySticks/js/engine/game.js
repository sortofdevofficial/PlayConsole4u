/**
 * FloppySticks — game.js v2.0
 * Main engine: canvas, loop, input, particles, bullets, pickups, flow, Firebase W/L.
 * NO IIFE — all globals accessible by other modules.
 * Load order: stickman.js → network.js → draw.js → game.js
 */

'use strict';

// ── Canvas ────────────────────────────────────────────────────────────────────
const cv  = document.getElementById('gameCanvas');
const ctx = cv.getContext('2d', { alpha: false });
var W = 0, H = 0, mob = false;

// ── Constants ─────────────────────────────────────────────────────────────────
const GV  = 0.55;
const MXP = 40;
const MX  = 3;
const WPS = ['Buster Sword', 'Assault Rifle', 'Smasher Club'];

// ── State ─────────────────────────────────────────────────────────────────────
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

// ── Particles ─────────────────────────────────────────────────────────────────
function fx(x, y, c, n, opts) {
  n = n === undefined ? 5 : n;
  opts = opts || {};
  const room = MXP - ptl.length;
  for (let i = 0; i < Math.min(n, room); i++)
    ptl.push({
      x, y,
      vx:  (Math.random() - .5) * (opts.spread || 5),
      vy:  (Math.random() - 1)  * (opts.rise   || 3.5),
      c,
      sz:  Math.random() * (opts.maxSz || 2.5) + .8,
      lf:  Math.random() * 18 + 10,
      mx:  28,
      glow: opts.glow || false
    });
}

function rDrop() { dt = Math.floor((Math.random() * 14 + 4) * 60); }

function initClouds() {
  clouds.length = 0;
  for (let i = 0; i < 6; i++)
    clouds.push({
      x:  Math.random() * W,
      y:  Math.random() * (H * .28) + 30,
      sp: Math.random() * .1 + .04,
      sz: Math.random() * 35 + 22
    });
}

// ── Players ───────────────────────────────────────────────────────────────────
var P, B;

function initE() {
  P = new S(200,     '#1a4a8a', false);
  B = new S(W - 200, '#8b1a1a', true);
}

// ── Pickup spawner ────────────────────────────────────────────────────────────
function spawnP(t, x) {
  if (pku.length >= 3) return;
  pku.push({
    type: t || WPS[Math.floor(Math.random() * WPS.length)],
    x:    x !== undefined ? x : Math.random() * (W - 280) + 140,
    y:    H - 115,
    bob:  Math.random() * 100
  });
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resize() {
  W = cv.width  = innerWidth;
  H = cv.height = innerHeight;
  mob = W < 1024 || 'ontouchstart' in window;
  if (gs !== 'MENU') g('mob-ctrl').style.display = mob ? 'flex' : 'none';
  if (P) { P.gy = H - 100; if (P.y > P.gy) P.y = P.gy; }
  if (B) { B.gy = H - 100; if (B.y > B.gy) B.y = B.gy; }
}
addEventListener('resize', resize);

// ── Firebase W/L ─────────────────────────────────────────────────────────────
async function _save() {
  if (sv) return; sv = true;
  const u = window.FB?.currentUser?.();
  if (!u) return;
  const won = ps >= MX;
  try {
    await window.FB.recordMatch(u.uid, won);
    await new Promise(r => setTimeout(r, 800));
    const s = await window.FB.getMatchStats(u.uid);
    if (window.showWL) window.showWL(s.w || 0, s.l || 0);
  } catch(e) { console.error('[FS] save error:', e); }
}

// ── Match flow ────────────────────────────────────────────────────────────────
function _start() {
  ps = 0; bs = 0; sv = false;
  bul.length = 0; pku.length = 0; ptl.length = 0;
  g('p-score').textContent = '0 pts';
  g('o-score').textContent = '0 pts';
  g('p-weapon').textContent = 'NONE';
  g('b-weapon').textContent = 'NONE';
  rDrop();
  P.sx = 200;     P.respawn();
  B.sx = W - 200; B.respawn();
  spawnP();
  const m = g('menu');
  m.style.opacity = '0';
  setTimeout(() => {
    m.style.display = 'none';
    g('hud').style.display = 'flex';
    if (mob) g('mob-ctrl').style.display = 'flex';
  }, 450);
}

function startLocal() {
  gs = 'BOT_MODE'; wasOnline = false;
  g('mode-badge').style.display = 'none';
  g('p-label').textContent = 'YOU';
  g('o-label').textContent = 'AI';
  _start();
}

function startOnline() {
  gs = 'ONLINE_MODE'; wasOnline = true;
  g('mode-badge').style.display = 'block';
  g('p-label').textContent = isHost ? 'P1 (You)' : 'P2 (You)';
  g('o-label').textContent = isHost ? 'P2' : 'P1';
  _start();
  g('online-modal').classList.remove('open');
}

// ── Jump ──────────────────────────────────────────────────────────────────────
function jump() {
  if (P.rd || (gs !== 'BOT_MODE' && gs !== 'ONLINE_MODE')) return;
  if (P.gr) {
    P.vy = -13.5; P.gr = false; P.jc = 1; P.sq = 1.28;
    fx(P.x, H - 100, '#a8956a', 3, { spread: 4, rise: 1 });
  } else if (P.jc === 1) {
    P.vy = -10; P.jc = 2; P.flp = true; P.fa = 0;
    fx(P.x, P.y - 30, '#d4c89a', 4, { spread: 5, rise: 2 });
  }
}

// ── Return to menu ────────────────────────────────────────────────────────────
function toMenu() {
  gs = 'MENU';
  keys.a = 0; keys.d = 0;
  bul.length = 0; pku.length = 0; ptl.length = 0;
  if (typeof conn !== 'undefined' && conn)  { try { conn.close();   } catch(e) {} conn = null; }
  if (typeof peer !== 'undefined' && peer)  { try { peer.destroy(); } catch(e) {} peer = null; }
  g('hud').style.display        = 'none';
  g('mob-ctrl').style.display   = 'none';
  g('mode-badge').style.display = 'none';
  const m = g('menu');
  m.style.display = 'flex';
  requestAnimationFrame(() => m.style.opacity = '1');
  const u = window.FB?.currentUser?.();
  if (u) window.FB.getMatchStats(u.uid)
    .then(s => { if (window.showWL) window.showWL(s.w || 0, s.l || 0); })
    .catch(() => {});
}

// ── Input ─────────────────────────────────────────────────────────────────────
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft')            keys.a = 1;
  if (k === 'd' || k === 'arrowright')           keys.d = 1;
  if (k === 'w' || k === ' ' || k === 'arrowup') { e.preventDefault(); jump(); }
  if (k === 'enter' && gs === 'MATCH_OVER')      toMenu();
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft')  keys.a = 0;
  if (k === 'd' || k === 'arrowright') keys.d = 0;
});
addEventListener('mousedown', () => {
  if ((gs === 'BOT_MODE' || gs === 'ONLINE_MODE') && !P.rd && !mob) P.attack();
});
addEventListener('touchstart', () => {
  if (gs === 'MATCH_OVER') toMenu();
}, { passive: true });

function tc(id, dn, up) {
  const e = g(id); if (!e) return;
  e.addEventListener('touchstart',  ev => { ev.preventDefault(); if (dn) dn(); }, { passive: false });
  e.addEventListener('touchend',    ev => { ev.preventDefault(); if (up) up(); }, { passive: false });
  e.addEventListener('touchcancel', ev => { ev.preventDefault(); if (up) up(); }, { passive: false });
}
tc('btn-left',   () => { keys.a = 1; }, () => { keys.a = 0; });
tc('btn-right',  () => { keys.d = 1; }, () => { keys.d = 0; });
tc('btn-jump',   () => jump(), null);
tc('btn-attack', () => { if ((gs === 'BOT_MODE' || gs === 'ONLINE_MODE') && !P.rd) P.attack(); }, null);

g('start-btn').onclick = startLocal;
g('start-btn').addEventListener('touchstart', e => { e.preventDefault(); startLocal(); }, { passive: false });
g('online-btn').onclick = openOnlineModal;

// ── Game loop ─────────────────────────────────────────────────────────────────
let _nt = 0;

function loop() {
  requestAnimationFrame(loop);

  // Background + screen shake
  drawBackground();

  if (gs === 'BOT_MODE' || gs === 'ONLINE_MODE' || gs === 'MATCH_OVER') {

    // Drop timer
    if (gs === 'BOT_MODE' || gs === 'ONLINE_MODE') {
      dt--;
      g('drop-timer').textContent = 'DROP: ' + Math.max(0, dt / 60).toFixed(1) + 's';
      if (dt <= 0) {
        if (gs === 'BOT_MODE' || isHost) {
          const wt = WPS[Math.floor(Math.random() * WPS.length)];
          const px = Math.random() * (W - 280) + 140;
          spawnP(wt, px);
          if (gs === 'ONLINE_MODE') send({ type: 'pickup_spawn', wt, px });
        }
        rDrop();
      }
    }

    // Update P
    P.update();

    // Update B
    if (gs === 'BOT_MODE') {
      B.update();
    } else if (!B.rd) {
      if (B.nx !== null) { const dx = B.nx - B.x; B.x += Math.abs(dx) < 1 ? dx : dx * .38; }
      if (B.ny !== null) {
        const dy = B.ny - B.y;
        if (Math.abs(B.ny - B.gy) < 3) B.y = B.gy;
        else B.y += Math.abs(dy) < 1 ? dy : dy * .38;
      }
    } else {
      B.update();
    }

    // Particles
    for (let pi = ptl.length - 1; pi >= 0; pi--) {
      const p = ptl[pi];
      p.x += p.vx; p.y += p.vy;
      p.vy += .06; p.lf--;
      if (p.lf <= 0 || p.y > H + 10) ptl.splice(pi, 1);
    }

    // Bullets
    for (let bi = bul.length - 1; bi >= 0; bi--) {
      const b = bul[bi];
      b.x += b.vx;
      if (b.x < -30 || b.x > W + 30) { bul.splice(bi, 1); continue; }
      const tgt = b.bot ? P : B;
      if (!tgt.rd && b.x > tgt.x - 30 && b.x < tgt.x + 30 && b.y < tgt.y && b.y > tgt.y - 68) {
        const dmg = 12, kb = b.vx > 0 ? 1 : -1;
        tgt.hit(dmg, kb);
        fx(b.x, b.y, '#f97316', 4, { glow: true, spread: 4, rise: 2 });
        if (gs === 'ONLINE_MODE' && !b.bot) send({ type: 'hit', amt: dmg, kb });
        bul.splice(bi, 1);
      }
    }

    // Pickups collision
    for (let qi = pku.length - 1; qi >= 0; qi--) {
      const pk = pku[qi];
      pk.bob += .07;
      let picked = false;
      for (let ji = 0; ji < 2; ji++) {
        const ent = ji === 0 ? P : B, isB = ji === 1;
        if (!ent.rd && Math.hypot(ent.x - pk.x, (ent.y - 30) - pk.y) < 40) {
          ent.wp = pk.type;
          g(isB ? 'b-weapon' : 'p-weapon').textContent = pk.type.toUpperCase();
          fx(pk.x, pk.y, '#f59e0b', 8, { glow: true, spread: 6, rise: 3 });
          if (gs === 'ONLINE_MODE' && isHost) send({ type: 'pickup_taken', i: qi, bot: isB, wt: pk.type });
          pku.splice(qi, 1); picked = true; break;
        }
      }
      if (picked) continue;
    }

    // Draw gameplay elements (particles, bullets, crates)
    drawActiveGameplayElements();

    // Draw stickmen
    P.draw();
    B.draw();

    // Network state sync
    if (gs === 'ONLINE_MODE' && conn && conn.open && ++_nt >= 2) {
      _nt = 0;
      const m = {
        type: 'state',
        x: P.x, yRel: P.y - P.gy,
        vx: P.vx, vy: P.vy,
        fl: P.fl, at: P.at, gr: P.gr, sy: P.sq,
        ia: P.atk, as: P.asw, 'if': P.flp, fa: P.fa,
        wp: P.wp, rd: P.rd, hp: P.hp, ff: P.ff
      };
      if (P.rd && P.rp.length)
        m.rp = P.rp.map(rp => ({ x: rp.x, y: rp.y, vx: rp.vx, vy: rp.vy, ang: rp.ang, va: rp.va, t: rp.t, s: rp.s }));
      send(m);
    }
  }

  // Match over overlay
  drawMatchOverOverlay();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
resize();
initClouds();
initBirds();
initLeaves();
initE();

requestAnimationFrame(loop);
