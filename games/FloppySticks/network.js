/**
 * FloppySticks — network.js v1.5
 * PeerJS peer-to-peer multiplayer networking.
 *
 * KEY FIX v1.5: Y positions are sent as yRel = y - gy (offset from ground).
 * The receiver reconstructs absolute Y as: B.gy + yRel.
 * This makes positions screen-size-independent — the opponent no longer
 * floats in the air on screens with a different resolution.
 *
 * Depends on globals from game.js: gs, P, B, ps, bs, MX, bul, pku, WPS,
 *   spawnP(), startOnline(), _save(), g(), mob
 */

'use strict';

// ── Module state ────────────────────────────────────────────────────────────
let isHost = false;
let conn   = null;
let peer   = null;
let nt     = 0;       // frame counter for state throttle

const CC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Expose to other modules
window.isHost = false;   // kept in sync below

// ── Helpers ──────────────────────────────────────────────────────────────────
function genCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CC[Math.floor(Math.random() * CC.length)];
  return s;
}

function send(o) {
  if (conn?.open) try { conn.send(o); } catch (e) {}
}

function setH(c, h) {
  const e = g('host-status');
  e.className = 'om-status ' + c;
  e.innerHTML = h;
}

function setJ(c, h) {
  const e = g('join-status');
  e.style.display = 'block';
  e.className = 'om-status ' + c;
  e.innerHTML = h;
}

// ── Online modal UI ──────────────────────────────────────────────────────────
function openOM() {
  g('online-modal').classList.add('open');
  switchTab('host');
  initHost();
}

function closeOM() {
  g('online-modal').classList.remove('open');
  if (conn)  { try { conn.close();    } catch (e) {} conn  = null; }
  if (peer)  { try { peer.destroy();  } catch (e) {} peer  = null; }
}

function switchTab(t) {
  ['host', 'join'].forEach(x => {
    g('tab-'   + x).classList.toggle('active', x === t);
    g('panel-' + x).classList.toggle('active', x === t);
  });
  if (t === 'host' && !peer) initHost();
}

// ── Host ─────────────────────────────────────────────────────────────────────
function initHost() {
  if (peer && !peer.destroyed) return;
  isHost = true; window.isHost = true;
  const code = genCode();

  g('host-code-box').innerHTML =
    `<div class="code-val">${code}</div>` +
    `<div class="code-hint">Share this code with your friend</div>`;
  setH('waiting', '<span class="spin"></span>Waiting for opponent…');

  peer = new Peer('floppy-' + code, {
    debug: 0,
    config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]}
  });

  peer.on('error', e => {
    if (e.type === 'unavailable-id') {
      peer.destroy(); peer = null;
      setTimeout(initHost, 500);
      return;
    }
    setH('error', '❌ Error — try again');
  });

  peer.on('connection', c => {
    conn = c;
    setH('connecting', '<span class="spin"></span>Connecting…');
    setupConn(c, false);
  });
}

// ── Join ─────────────────────────────────────────────────────────────────────
function joinGame() {
  const raw = g('join-input').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 4) { setJ('error', '❌ Enter a 4-letter code'); return; }

  if (peer && !peer.destroyed) { peer.destroy(); peer = null; }
  isHost = false; window.isHost = false;
  setJ('connecting', '<span class="spin"></span>Connecting…');

  peer = new Peer(undefined, {
    debug: 0,
    config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]}
  });

  peer.on('open', () => {
    const c = peer.connect('floppy-' + raw, { reliable: true });
    conn = c;
    setupConn(c, true);
  });

  peer.on('error', e => setJ('error', '❌ ' + (e.message || 'Failed')));
}

// ── Connection setup ─────────────────────────────────────────────────────────
function setupConn(c, joiner) {
  c.on('open', () => {
    if (joiner) setJ('connected', '✅ Connected! Starting…');
    send({ type: 'ready' });
  });

  c.on('data', onMsg);

  c.on('close', () => {
    if (gs === 'ONLINE_MODE') {
      ps = MX;
      g('p-score').textContent = ps + ' pts';
      gs = 'MATCH_OVER';
      _save();
    }
    conn = null;
  });

  c.on('error', e => {
    const m = '❌ ' + (e.message || 'Error');
    joiner ? setJ('error', m) : setH('error', m);
  });
}

// ── Message handler ───────────────────────────────────────────────────────────
function onMsg(d) {
  if (!d?.type) return;

  switch (d.type) {

    case 'ready':
      if (isHost) setH('connected', '✅ Connected! Starting…');
      setTimeout(startOnline, 600);
      break;

    // KEY FIX: reconstruct Y from yRel (ground-relative offset).
    // d.yRel = sender's (P.y - P.gy). We add our own B.gy so the position
    // is correct regardless of screen height differences.
    case 'state':
      if (gs !== 'ONLINE_MODE') return;
      B.nx  = d.x;
      B.ny  = B.gy + (d.yRel ?? 0);   // ← ground-normalised Y
      B.vx  = d.vx;  B.vy  = d.vy;
      B.fl  = d.fl;  B.at  = d.at;
      B.gr  = d.gr;  B.sq  = d.sy;
      B.atk = d.ia;  B.asw = d.as;
      B.flp = d.if;  B.fa  = d.fa;
      B.wp  = d.wp || null;
      B.rd  = d.rd;  B.ff  = d.ff || 0;
      if (d.rd && !B.rp.length && d.rp) B.rp = d.rp;
      g('b-hp').style.width     = (d.hp || 0) + '%';
      g('b-weapon').textContent = d.wp || 'NONE';
      break;

    case 'hit':
      if (gs === 'ONLINE_MODE') P.hit(d.amt, d.kb);
      break;

    case 'bullet':
      bul.push({ x: d.x, y: d.y, vx: d.vx, bot: true });
      break;

    case 'pickup_spawn':
      if (!isHost) spawnP(d.wt, d.px);
      break;

    case 'pickup_taken':
      if (pku[d.i]) {
        if (!isHost && d.bot) B.wp = d.wt;
        pku.splice(d.i, 1);
      }
      break;

    case 'score':
      ps = isHost ? d.hs : d.gs;
      bs = isHost ? d.gs : d.hs;
      g('p-score').textContent = ps + ' pts';
      g('o-score').textContent = bs + ' pts';
      break;

    case 'over':
      gs = 'MATCH_OVER';
      _save();
      break;

    case 'ropp':
      B.respawn();
      break;
  }
}

// ── Expose to game.js and HTML onclick attrs ─────────────────────────────────
window.openOnlineModal  = openOM;
window.closeOnlineModal = closeOM;
window.switchTab        = switchTab;
window.joinGame         = joinGame;