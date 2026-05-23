/**
 * FloppySticks — game.js v1.5
 * Main engine: canvas setup, game loop, input, particle/bullet/pickup systems,
 * menu/match flow, Firebase W/L save.
 *
 * Load order: stickman.js → network.js → game.js
 */

(function () {
'use strict';

// ── Canvas ───────────────────────────────────────────────────────────────────
const cv  = document.getElementById('gameCanvas');
const ctx = cv.getContext('2d', { alpha: false });
let W = 0, H = 0, mob = false;

// ── Constants ────────────────────────────────────────────────────────────────
const GV  = 0.55;          // gravity per frame
const MXP = 30;            // max live particles
const MX  = 3;             // kills to win a match
const WPS = ['Buster Sword', 'Assault Rifle', 'Smasher Club'];

// ── Global state (read by stickman.js / network.js) ─────────────────────────
/* exported */ var gs  = 'MENU'; // game state
/* exported */ var ps  = 0;      // player score
/* exported */ var bs  = 0;      // bot / opponent score
/* exported */ var shk = 0;      // screen-shake intensity
let dt = 0;                       // drop-timer frames
let wasOnline = false;
let sv = false;                   // save-guard flag

const keys   = { a: 0, d: 0 };
const bul    = [];   // bullets
const pku    = [];   // weapon pickups
const ptl    = [];   // particles
const clouds = [];

// ── Shorthand ────────────────────────────────────────────────────────────────
/* exported */ function g(id) { return document.getElementById(id); }

// ── Particles ────────────────────────────────────────────────────────────────
/* exported */ function fx(x, y, c, n = 5) {
  const room = MXP - ptl.length;
  for (let i = 0; i < Math.min(n, room); i++)
    ptl.push({
      x, y,
      vx: (Math.random() - .5) * 4,
      vy: (Math.random() - 1) * 3,
      c,
      sz: Math.random() * 2 + 1,
      lf: Math.random() * 15 + 10,
      mx: 25
    });
}

function rDrop() { dt = Math.floor((Math.random() * 14 + 1) * 60); }

function initClouds() {
  clouds.length = 0;
  for (let i = 0; i < 5; i++)
    clouds.push({
      x:  Math.random() * W,
      y:  Math.random() * (H * .25) + 30,
      sp: Math.random() * .12 + .05,
      sz: Math.random() * 30 + 20
    });
}

// ── Players ───────────────────────────────────────────────────────────────────
/* exported */ var P, B;

function initE() {
  P = new S(200,     '#2c3e50', false);
  B = new S(W - 200, '#962d22', true);
}

// ── Pickup spawner ────────────────────────────────────────────────────────────
/* exported */ function spawnP(t, x) {
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
/* exported */ async function _save() {
  if (sv) return; sv = true;
  const u = window.FB?.currentUser?.();
  if (!u) { console.warn('[FS] not signed in — W/L not saved'); return; }
  const won = ps >= MX;
  console.log('[FS] saving  won=' + won + '  uid=' + u.uid);
  try {
    await window.FB.recordMatch(u.uid, won);
    await new Promise(r => setTimeout(r, 1000));
    const s = await window.FB.getMatchStats(u.uid);
    console.log('[FS] stats after save:', s);
    if (window.showWL) window.showWL(s.w || 0, s.l || 0);
  } catch (e) { console.error('[FS] save error:', e); }
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
  const m = g('menu');
  m.style.opacity = '0';
  setTimeout(() => {
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

/* exported */ function startOnline() {
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
  if (conn)  { try { conn.close();   } catch (e) {} conn  = null; }
  if (peer)  { try { peer.destroy(); } catch (e) {} peer  = null; }
  g('hud').style.display       = 'none';
  g('mob-ctrl').style.display  = 'none';
  g('mode-badge').style.display = 'none';
  const m = g('menu');
  m.style.display = 'flex';
  m.style.opacity = '1';
  // Refresh W/L
  const u = window.FB?.currentUser?.();
  if (u) window.FB.getMatchStats(u.uid)
    .then(s => { if (window.showWL) window.showWL(s.w || 0, s.l || 0); })
    .catch(() => {});
}

// ── Input ─────────────────────────────────────────────────────────────────────
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft')              keys.a = 1;
  if (k === 'd' || k === 'arrowright')             keys.d = 1;
  if (k === 'w' || k === ' ' || k === 'arrowup')  { e.preventDefault(); jump(); }
  if (k === 'enter' && gs === 'MATCH_OVER')        toMenu();
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
  e.addEventListener('touchstart',  ev => { ev.preventDefault(); dn?.(); }, { passive: false });
  e.addEventListener('touchend',    ev => { ev.preventDefault(); up?.(); }, { passive: false });
  e.addEventListener('touchcancel', ev => { ev.preventDefault(); up?.(); }, { passive: false });
}
tc('btn-left',   () => keys.a = 1, () => keys.a = 0);
tc('btn-right',  () => keys.d = 1, () => keys.d = 0);
tc('btn-jump',   () => jump(), null);
tc('btn-attack', () => { if ((gs === 'BOT_MODE' || gs === 'ONLINE_MODE') && !P.rd) P.attack(); }, null);

g('start-btn').onclick = startLocal;
g('start-btn').addEventListener('touchstart', e => { e.preventDefault(); startLocal(); }, { passive: false });
g('online-btn').onclick = openOnlineModal;

// ── Game loop ─────────────────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);

  // Sky
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, W, H);

  ctx.save();

  // Screen shake
  if (shk > 0) {
    ctx.translate((Math.random() - .5) * shk, (Math.random() - .5) * shk);
    shk *= .88;
    if (shk < .5) shk = 0;
  }

  // Sky gradient overlay
  const sg = ctx.createLinearGradient(0, H * .5, 0, H - 100);
  sg.addColorStop(0, 'rgba(224,244,255,0)');
  sg.addColorStop(1, 'rgba(224,244,255,.6)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, H * .5, W, H);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const c of clouds) {
    c.x += c.sp;
    if (c.x - c.sz > W) c.x = -c.sz;
    ctx.beginPath();
    ctx.arc(c.x,            c.y,            c.sz,       0, Math.PI * 2);
    ctx.arc(c.x + c.sz*.6,  c.y - c.sz*.2,  c.sz * .75, 0, Math.PI * 2);
    ctx.fill();
  }

  // Background hills
  ctx.fillStyle = '#9dc183';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40)
    ctx.lineTo(x, (H - 220) + Math.sin(x * .003) * 35);
  ctx.lineTo(W, H); ctx.fill();

  ctx.fillStyle = '#7da061';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 35)
    ctx.lineTo(x, (H - 160) + Math.cos(x * .005) * 20);
  ctx.lineTo(W, H); ctx.fill();

  // Ground
  ctx.fillStyle = '#27ae60'; ctx.fillRect(0, H - 100, W, 14);
  ctx.fillStyle = '#795548'; ctx.fillRect(0, H -  86, W, 86);

  // ── Active gameplay ─────────────────────────────────────────────────────
  if (gs === 'BOT_MODE' || gs === 'ONLINE_MODE' || gs === 'MATCH_OVER') {

    // Drop timer
    if (gs === 'BOT_MODE' || gs === 'ONLINE_MODE') {
      dt--;
      g('drop-timer').textContent = 'DROP: ' + Math.max(0, dt / 60).toFixed(1) + 's';
      if (dt <= 0) {
        if (gs === 'BOT_MODE' || isHost) {
          const wt = WPS[Math.floor(Math.random() * WPS.length)];
          const px = Math.random() * (W - 260) + 130;
          spawnP(wt, px);
          if (gs === 'ONLINE_MODE') send({ type: 'pickup_spawn', wt, px });
        }
        rDrop();
      }
    }

    // Update characters
    P.update();
    if (gs === 'BOT_MODE') {
      B.update();
    } else if (!B.rd) {
      // Interpolate remote opponent.
      // KEY FIX: B.ny is already in local screen-space (set by network.js
      // as B.gy + yRel), so interpolation is now screen-size-correct.
      if (B.nx !== null) {
        const dx = B.nx - B.x;
        B.x += Math.abs(dx) < 1 ? dx : dx * .4;
      }
      if (B.ny !== null) {
        // Snap to ground when opponent is standing to avoid micro-float
        if (Math.abs(B.ny - B.gy) < 3) {
          B.y = B.gy;
        } else {
          const dy = B.ny - B.y;
          B.y += Math.abs(dy) < 1 ? dy : dy * .4;
        }
      }
    } else {
      B.update(); // ragdoll pieces still need physics
    }

    // Particles
    for (let i = ptl.length - 1; i >= 0; i--) {
      const p = ptl[i];
      p.x += p.vx; p.y += p.vy; p.vy += .05; p.lf--;
      if (p.lf <= 0 || p.x < -10 || p.x > W + 10 || p.y > H + 10) {
        ptl.splice(i, 1); continue;
      }
      ctx.globalAlpha = p.lf / p.mx;
      ctx.fillStyle   = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Bullets
    for (let i = bul.length - 1; i >= 0; i--) {
      const b = bul[i];
      b.x += b.vx;
      if (b.x < -20 || b.x > W + 20) { bul.splice(i, 1); continue; }
      ctx.fillStyle = '#e67e22';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();

      const tgt = b.bot ? P : B;
      if (!tgt.rd && b.x > tgt.x - 28 && b.x < tgt.x + 28 && b.y < tgt.y && b.y > tgt.y - 65) {
        const dmg = 12, kb = b.vx > 0 ? 1 : -1;
        tgt.hit(dmg, kb);
        if (gs === 'ONLINE_MODE' && !b.bot) send({ type: 'hit', amt: dmg, kb });
        bul.splice(i, 1);
      }
    }

    // Pickups
    for (let i = pku.length - 1; i >= 0; i--) {
      const p = pku[i];
      p.bob += .06;
      const by = p.y + Math.sin(p.bob) * 5;

      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 14, 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle   = '#e8b84b'; ctx.fillRect(p.x - 12, by - 12, 24, 24);
      ctx.strokeStyle = '#c49a2a'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 12, by - 12, 24, 24);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - 12, by); ctx.lineTo(p.x + 12, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x, by - 12); ctx.lineTo(p.x, by + 12); ctx.stroke();
      ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.type.toUpperCase(), p.x, by - 15);

      let picked = false;
      for (let j = 0; j < 2; j++) {
        const ent = j === 0 ? P : B, isB = j === 1;
        if (!ent.rd && Math.hypot(ent.x - p.x, (ent.y - 30) - p.y) < 38) {
          ent.wp = p.type;
          g(isB ? 'b-weapon' : 'p-weapon').textContent = p.type.toUpperCase();
          if (gs === 'ONLINE_MODE' && isHost)
            send({ type: 'pickup_taken', i, bot: isB, wt: p.type });
          pku.splice(i, 1);
          picked = true;
          break;
        }
      }
      if (picked) continue;
    }

    P.draw(); B.draw();

    // Send state to opponent (throttled: every 2 frames)
    if (gs === 'ONLINE_MODE' && conn?.open && ++nt >= 2) {
      nt = 0;
      // KEY FIX: send yRel instead of absolute y so the receiver can
      // reconstruct a position relative to *their* ground level.
      const m = {
        type: 'state',
        x:    P.x,
        yRel: P.y - P.gy,   // ← normalised: 0 = on ground, negative = in air
        vx:   P.vx, vy: P.vy,
        fl:   P.fl, at: P.at, gr: P.gr, sy: P.sq,
        ia:   P.atk, as: P.asw, if: P.flp, fa: P.fa,
        wp:   P.wp,  rd: P.rd,  hp: P.hp, ff: P.ff
      };
      if (P.rd && P.rp.length)
        m.rp = P.rp.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, ang: p.ang, va: p.va, t: p.t, s: p.s }));
      send(m);
    }
  }

  // ── Match over overlay ──────────────────────────────────────────────────
  if (gs === 'MATCH_OVER') {
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const win = ps >= MX;
    ctx.font      = `bold ${Math.min(58, W / 7)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
    ctx.fillText(win ? '🎉 YOU WIN!' : '😢 YOU LOSE!', W / 2, H / 2 - 36);
    ctx.font      = `bold ${Math.min(26, W / 20)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(
      'You: ' + ps + '  —  ' + (wasOnline ? 'Opponent' : 'AI') + ': ' + bs,
      W / 2, H / 2 + 12
    );
    ctx.font      = `${Math.min(15, W / 30)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.fillText(mob ? 'Tap to return' : 'Press [ENTER] to return', W / 2, H / 2 + 50);
  }

  ctx.restore();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
resize();
initClouds();
initE();
requestAnimationFrame(loop);

})();