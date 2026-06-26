/**
 * FloppySticks — network.js v3.0 (COMPLETE & FIXED)
 * PeerJS peer-to-peer multiplayer networking module.
 * Globals from game.js: gs, P, B, ps, bs, MX, bul, pku, WPS, spawnP(), startOnline(), _save(), g(), mob
 */

'use strict';

let isHost = false;
let conn   = null;
let peer   = null;
let joinTimeout = null;

const CC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

window.isHost = false;

function genCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CC[Math.floor(Math.random() * CC.length)];
  return s;
}

function send(o) {
  if (conn?.open) try { conn.send(o); } catch(e) {}
}

function setH(c, h) {
  const e = g('host-status');
  if (e) {
    e.className = 'om-status ' + c;
    e.innerHTML = h;
  }
}

function setJ(c, h) {
  const e = g('join-status');
  if (e) {
    e.style.display = 'block';
    e.className = 'om-status ' + c;
    e.innerHTML = h;
  }
}

// ── Modal UI Controls ────────────────────────────────────────────────────────
function openOM() {
  g('online-modal').classList.add('open');
  switchTab('host');
  initHost();
}

function closeOM() {
  g('online-modal').classList.remove('open');
  if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
  if (conn) { try { conn.close();   } catch(e) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }
}

function switchTab(t) {
  ['host','join'].forEach(x => {
    const tab = g('tab-' + x);
    const panel = g('panel-' + x);
    if (tab) tab.classList.toggle('active', x === t);
    if (panel) panel.classList.toggle('active', x === t);
  });
  if (t === 'host' && !peer) initHost();
}

// ── Host Room System ─────────────────────────────────────────────────────────
function initHost() {
  if (peer && !peer.destroyed) return;
  isHost = true; 
  window.isHost = true;
  const code = genCode();

  const box = g('host-code-box');
  if (box) {
    box.innerHTML =
      `<div class="code-val">${code}</div>` +
      `<div class="code-hint">Share this code with your friend</div>`;
  }
  setH('waiting', '<span class="spin"></span>Waiting for opponent…');

  peer = new Peer('floppy-' + code, {
    debug: 0,
    host: '0.peerjs.com', port: 443, secure: true,
    config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]}
  });

  peer.on('error', e => {
    if (e.type === 'unavailable-id') { 
      peer.destroy(); 
      peer = null; 
      setTimeout(initHost, 600); 
      return; 
    }
    setH('error', '❌ Error creating room — try again');
  });

  peer.on('connection', c => {
    conn = c;
    setH('connecting', '<span class="spin"></span>Connecting…');
    setupConn(c, false);
  });
}

// ── Joiner System ────────────────────────────────────────────────────────────
function joinGame() {
  const inputEl = g('join-input');
  if (!inputEl) return;
  const raw = inputEl.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (raw.length !== 4) { setJ('error', '❌ Enter a 4-letter code'); return; }

  if (peer && !peer.destroyed) { peer.destroy(); peer = null; }
  isHost = false; 
  window.isHost = false;
  setJ('connecting', '<span class="spin"></span>Connecting…');

  peer = new Peer(undefined, {
    debug: 0,
    host: '0.peerjs.com', port: 443, secure: true,
    config: { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]}
  });

  if (joinTimeout) clearTimeout(joinTimeout);

  joinTimeout = setTimeout(() => {
    setJ('error', '❌ Timeout — check code or connection');
    if (peer) { try { peer.destroy(); } catch(e){} peer = null; }
  }, 15000);

  peer.on('open', () => {
    const c = peer.connect('floppy-' + raw, { reliable: true, serialization: 'json' });
    conn = c;
    setupConn(c, true);
  });

  peer.on('error', e => { 
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    setJ('error', '❌ Connection failed'); 
  });
}

// ── Connection Lifecycles ────────────────────────────────────────────────────
function setupConn(c, joiner) {
  c.on('open', () => {
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    if (joiner) setJ('connected', '✅ Connected! Starting match…');
    send({ type: 'ready' });
  });

  c.on('data', onMsg);

  c.on('close', () => {
    if (gs === 'ONLINE_MODE') {
      ps = MX;
      const scoreEl = g('p-score');
      if (scoreEl) scoreEl.textContent = ps + ' pts';
      gs = 'MATCH_OVER';
      _save();
    }
    conn = null;
  });

  c.on('error', e => {
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    const m = '❌ Connection error occurred';
    joiner ? setJ('error', m) : setH('error', m);
  });
}

// ── Network Message Processor ────────────────────────────────────────────────
function onMsg(d) {
  if (!d?.type) return;
  switch (d.type) {

    case 'ready':
      if (isHost) setH('connected', '✅ Connected! Starting match…');
      setTimeout(startOnline, 600);
      break;

    case 'state':
      if (gs !== 'ONLINE_MODE' || !B) return;
      B.nx  = d.x;
      B.ny  = B.gy + (d.yRel ?? 0);
      B.vx  = d.vx;  
      B.vy  = d.vy;
      B.fl  = d.fl;  
      B.at  = d.at;
      B.gr  = d.gr;  
      B.sq  = d.sy;
      B.atk = d.ia;  
      B.asw = d.as;
      B.flp = d.if;  
      B.fa  = d.fa;
      B.wp  = d.wp || null;
      B.rd  = d.rd;  
      B.ff  = d.ff || 0;
      if (d.rd && !B.rp.length && d.rp) B.rp = d.rp;
      
      const bhp = g('b-hp');
      const bwp = g('b-weapon');
      if (bhp) bhp.style.width = (d.hp || 0) + '%';
      if (bwp) bwp.textContent = d.wp || 'NONE';
      break;

    case 'hit':
      if (gs === 'ONLINE_MODE' && P) P.hit(d.amt, d.kb);
      break;

    case 'bullet':
      bul.push({ x: d.x, y: d.y, vx: d.vx, bot: true });
      break;

    case 'pickup_spawn':
      if (!isHost) spawnP(d.wt, d.px);
      break;

    case 'pickup_taken':
      if (pku[d.i]) {
        if (!isHost && d.bot && B) { 
          B.wp = d.wt; 
          const bwpEl = g('b-weapon');
          if (bwpEl) bwpEl.textContent = d.wt; 
        }
        pku.splice(d.i, 1);
      }
      break;

    case 'score':
      ps = isHost ? d.hs : d.gs;
      bs = isHost ? d.gs : d.hs;
      const psEl = g('p-score');
      const osEl = g('o-score');
      if (psEl) psEl.textContent = ps + ' pts';
      if (osEl) osEl.textContent = bs + ' pts';
      break;

    case 'over':
      gs = 'MATCH_OVER';
      _save();
      break;

    case 'ropp':
      if (B) B.respawn();
      break;
  }
}

window.openOnlineModal  = openOM;
window.closeOnlineModal = closeOM;
window.switchTab        = switchTab;
window.joinGame         = joinGame;