/**
 * FloppySticks — game.js v1.5
 * Main engine: canvas, game loop, input, particles, bullets, pickups,
 * menu/match flow, Firebase W/L save.
 *
 * NO IIFE wrapper — variables must be global so stickman.js and network.js
 * can read/write gs, P, B, W, H, bul, pku, ptl, keys, shk, ps, bs, etc.
 *
 * Load order in HTML: stickman.js → network.js → draw.js → game.js
 */

'use strict';

// ── Canvas ───────────────────────────────────────────────────────────────────
const cv  = document.getElementById('gameCanvas');
const ctx = cv.getContext('2d', { alpha: false });
var W = 0, H = 0, mob = false;

// ── Constants (read by stickman.js) ─────────────────────────────────────────
const GV  = 0.55;   // gravity per frame
const MXP = 30;     // max live particles
const MX  = 3;      // kills to win
const WPS = ['Buster Sword', 'Assault Rifle', 'Smasher Club'];

// ── Global state (read/written by stickman.js and network.js) ───────────────
var gs  = 'MENU';   // game state string
var ps  = 0;        // player score
var bs  = 0;        // opponent/bot score
var shk = 0;        // screen-shake intensity

var dt        = 0;
var wasOnline = false;
var sv        = false;   // save-guard

var keys   = { a: 0, d: 0 };
var bul    = [];   // bullets
var pku    = [];   // weapon pickups
var ptl    = [];   // particles
var clouds = [];

// ── DOM helper (used everywhere) ─────────────────────────────────────────────
function g(id) { return document.getElementById(id); }

// ── Particles ────────────────────────────────────────────────────────────────
function fx(x, y, c, n) {
  n = n === undefined ? 5 : n;
  var room = MXP - ptl.length;
  for (var i = 0; i < Math.min(n, room); i++)
    ptl.push({
      x: x, y: y,
      vx: (Math.random() - .5) * 4,
      vy: (Math.random() - 1)  * 3,
      c: c,
      sz: Math.random() * 2 + 1,
      lf: Math.random() * 15 + 10,
      mx: 25
    });
}

function rDrop() { dt = Math.floor((Math.random() * 14 + 1) * 60); }

function initClouds() {
  clouds.length = 0;
  for (var i = 0; i < 5; i++)
    clouds.push({
      x:  Math.random() * W,
      y:  Math.random() * (H * .25) + 30,
      sp: Math.random() * .12 + .05,
      sz: Math.random() * 30 + 20
    });
}

// ── Players (S class defined in stickman.js) ─────────────────────────────────
var P, B;

function initE() {
  P = new S(200,     '#2c3e50', false);
  B = new S(W - 200, '#962d22', true);
}

// ── Pickup spawner (called by network.js too) ─────────────────────────────────
function spawnP(t, x) {
  if (pku.length >= 3) return;
  pku.push({
    type: t || WPS[Math.floor(Math.random() * WPS.length)],
    x:    x !== undefined ? x : Math.random() * (W - 260) + 130,
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

// ── Firebase W/L save ─────────────────────────────────────────────────────────
async function _save() {
  if (sv) return; sv = true;
  var u = window.FB?.currentUser?.();
  if (!u) { console.warn('[FS] not signed in'); return; }
  var won = ps >= MX;
  console.log('[FS] saving  won=' + won + '  uid=' + u.uid);
  try {
    await window.FB.recordMatch(u.uid, won);
    await new Promise(function(r) { setTimeout(r, 1000); });
    var s = await window.FB.getMatchStats(u.uid);
    if (window.showWL) window.showWL(s.w || 0, s.l || 0);
  } catch(e) { console.error('[FS] save error:', e); }
}

// ── Match start helpers ───────────────────────────────────────────────────────
function _start() {
  ps = 0; bs = 0; sv = false;
  bul.length = 0; pku.length = 0; ptl.length = 0;
  g('p-score').textContent = '0 pts';
  g('o-score').textContent = '0 pts';
  rDrop();
  P.sx = 200;     P.respawn();
  B.sx = W - 200; B.respawn();
  spawnP();
  var m = g('menu');
  m.style.opacity = '0';
  setTimeout(function() {
    m.style.display = 'none';
    g('hud').style.display = 'flex';
    if (mob) g('mob-ctrl').style.display = 'flex';
  }, 400);
}

function startLocal() {
  gs = 'BOT_MODE'; wasOnline = false;
  g('mode-badge').style.display = 'none';
  g('p-label').textContent = 'YOU';
  g('o-label').textContent = 'AI';
  _start();
}

// Called by network.js after handshake
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
    P.vy = -13; P.gr = false; P.jc = 1; P.sq = 1.25;
    fx(P.x, H - 100, '#95a5a6', 3);
  } else if (P.jc === 1) {
    P.vy = -9.8; P.jc = 2; P.flp = true; P.fa = 0;
    fx(P.x, P.y - 30, '#ecf0f1', 3);
  }
}

// ── Return to menu ────────────────────────────────────────────────────────────
function toMenu() {
  gs = 'MENU';
  keys.a = 0; keys.d = 0;
  bul.length = 0; pku.length = 0; ptl.length = 0;
  if (typeof conn  !== 'undefined' && conn)  { try { conn.close();   } catch(e) {} conn  = null; }
  if (typeof peer  !== 'undefined' && peer)  { try { peer.destroy(); } catch(e) {} peer  = null; }
  g('hud').style.display        = 'none';
  g('mob-ctrl').style.display   = 'none';
  g('mode-badge').style.display = 'none';
  var m = g('menu');
  m.style.display = 'flex';
  m.style.opacity = '1';
  var u = window.FB?.currentUser?.();
  if (u) window.FB.getMatchStats(u.uid)
    .then(function(s) { if (window.showWL) window.showWL(s.w || 0, s.l || 0); })
    .catch(function(){});
}

// ── Input ─────────────────────────────────────────────────────────────────────
addEventListener('keydown', function(e) {
  var k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft')             keys.a = 1;
  if (k === 'd' || k === 'arrowright')            keys.d = 1;
  if (k === 'w' || k === ' ' || k === 'arrowup')  { e.preventDefault(); jump(); }
  if (k === 'enter' && gs === 'MATCH_OVER')       toMenu();
});
addEventListener('keyup', function(e) {
  var k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft')  keys.a = 0;
  if (k === 'd' || k === 'arrowright') keys.d = 0;
});
addEventListener('mousedown', function() {
  if ((gs === 'BOT_MODE' || gs === 'ONLINE_MODE') && !P.rd && !mob) P.attack();
});
addEventListener('touchstart', function() {
  if (gs === 'MATCH_OVER') toMenu();
}, { passive: true });

function tc(id, dn, up) {
  var e = g(id); if (!e) return;
  e.addEventListener('touchstart',  function(ev) { ev.preventDefault(); if(dn) dn(); }, { passive: false });
  e.addEventListener('touchend',    function(ev) { ev.preventDefault(); if(up) up(); }, { passive: false });
  e.addEventListener('touchcancel', function(ev) { ev.preventDefault(); if(up) up(); }, { passive: false });
}
tc('btn-left',   function(){ keys.a = 1; }, function(){ keys.a = 0; });
tc('btn-right',  function(){ keys.d = 1; }, function(){ keys.d = 0; });
tc('btn-jump',   function(){ jump(); },     null);
tc('btn-attack', function(){ if ((gs === 'BOT_MODE' || gs === 'ONLINE_MODE') && !P.rd) P.attack(); }, null);

g('start-btn').onclick = startLocal;
g('start-btn').addEventListener('touchstart', function(e){ e.preventDefault(); startLocal(); }, { passive: false });
g('online-btn').onclick = openOnlineModal;

// ── Game loop ─────────────────────────────────────────────────────────────────
var _nt = 0;  // frame counter for state throttle

function loop() {
  requestAnimationFrame(loop);

  // 1. Process Environmental Layout & Background (Called from draw.js)
  drawBackground();

  // ── Active gameplay calculations & updates ───────────────────────────────
  if (gs === 'BOT_MODE' || gs === 'ONLINE_MODE' || gs === 'MATCH_OVER') {

    // Drop timer tick
    if (gs === 'BOT_MODE' || gs === 'ONLINE_MODE') {
      dt--;
      g('drop-timer').textContent = 'DROP: ' + Math.max(0, dt / 60).toFixed(1) + 's';
      if (dt <= 0) {
        if (gs === 'BOT_MODE' || isHost) {
          var wt = WPS[Math.floor(Math.random() * WPS.length)];
          var px = Math.random() * (W - 260) + 130;
          spawnP(wt, px);
          if (gs === 'ONLINE_MODE') send({ type: 'pickup_spawn', wt: wt, px: px });
        }
        rDrop();
      }
    }

    // Update characters
    P.update();
    if (gs === 'BOT_MODE') {
      B.update();
    } else if (!B.rd) {
      if (B.nx !== null) {
        var dx = B.nx - B.x;
        B.x += Math.abs(dx) < 1 ? dx : dx * .4;
      }
      if (B.ny !== null) {
        if (Math.abs(B.ny - B.gy) < 3) {
          B.y = B.gy;
        } else {
          var dy = B.ny - B.y;
          B.y += Math.abs(dy) < 1 ? dy : dy * .4;
        }
      }
    } else {
      B.update();
    }

    // Process Particle Lifecycles
    for (var pi = ptl.length - 1; pi >= 0; pi--) {
      var p = ptl[pi];
      p.x += p.vx; p.y += p.vy; p.vy += .05; p.lf--;
      if (p.lf <= 0 || p.x < -10 || p.x > W + 10 || p.y > H + 10) { ptl.splice(pi, 1); }
    }

    // Process Bullet Logic & Collision
    for (var bi = bul.length - 1; bi >= 0; bi--) {
      var b = bul[bi];
      b.x += b.vx;
      if (b.x < -20 || b.x > W + 20) { bul.splice(bi, 1); continue; }
      
      var tgt = b.bot ? P : B;
      if (!tgt.rd && b.x > tgt.x - 28 && b.x < tgt.x + 28 && b.y < tgt.y && b.y > tgt.y - 65) {
        var dmg = 12, kb = b.vx > 0 ? 1 : -1;
        tgt.hit(dmg, kb);
        if (gs === 'ONLINE_MODE' && !b.bot) send({ type: 'hit', amt: dmg, kb: kb });
        bul.splice(bi, 1);
      }
    }

    // Process Pickups Logic & Collision
    for (var qi = pku.length - 1; qi >= 0; qi--) {
      var pk = pku[qi];
      pk.bob += .06;
      var picked = false;
      for (var ji = 0; ji < 2; ji++) {
        var ent = ji === 0 ? P : B, isB = ji === 1;
        if (!ent.rd && Math.hypot(ent.x - pk.x, (ent.y - 30) - pk.y) < 38) {
          ent.wp = pk.type;
          g(isB ? 'b-weapon' : 'p-weapon').textContent = pk.type.toUpperCase();
          if (gs === 'ONLINE_MODE' && isHost) send({ type: 'pickup_taken', i: qi, bot: isB, wt: pk.type });
          pku.splice(qi, 1); picked = true; break;
        }
      }
      if (picked) continue;
    }

    // 2. Render Projectiles, Weapons & Item boxes (Called from draw.js)
    drawActiveGameplayElements();

    // 3. Render Stickmen models (Methods are native inside stickman.js)
    P.draw(); 
    B.draw();

    // Send status via network connection (Throttle handling)
    if (gs === 'ONLINE_MODE' && conn && conn.open && ++_nt >= 2) {
      _nt = 0;
      var m = {
        type: 'state',
        x:    P.x,
        yRel: P.y - P.gy,
        vx:   P.vx, vy: P.vy,
        fl:   P.fl, at: P.at, gr: P.gr, sy: P.sq,
        ia:   P.atk, as: P.asw, 'if': P.flp, fa: P.fa,
        wp:   P.wp,  rd: P.rd,  hp: P.hp,  ff: P.ff
      };
      if (P.rd && P.rp.length)
        m.rp = P.rp.map(function(rp) {
          return { x: rp.x, y: rp.y, vx: rp.vx, vy: rp.vy, ang: rp.ang, va: rp.va, t: rp.t, s: rp.s };
        });
      send(m);
    }
  }

  // 4. Draw Match Over Text Overlays if triggered (Called from draw.js)
  drawMatchOverOverlay();

  ctx.restore();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
resize();
initClouds();
initE();
requestAnimationFrame(loop);