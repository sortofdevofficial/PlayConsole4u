/**
 * FloppySticks — network.js v3.0 (COMPLETE & FIXED)
 * Custom Firestore automated Matchmaking, strict 1v1 protection, and 1-hour session limits.
 */

'use strict';

let isHost = false;
let conn   = null;
let peer   = null;
let joinTimeout = null;
let roomCreatedAt = null;

let isQueued = false;
let mmDocRef = null;
let mmUnsubscribe = null;

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
  if (e) { e.className = 'om-status ' + c; e.innerHTML = h; }
}

function setJ(c, h) {
  const e = g('join-status');
  if (e) { e.style.display = 'block'; e.className = 'om-status ' + c; e.innerHTML = h; }
}

function setMM(c, h) {
  const e = g('mm-status');
  if (e) { e.className = 'om-status ' + c; e.innerHTML = h; }
}

function openOM() {
  g('online-modal').classList.add('open');
  switchTab('host');
}

function closeOnlineModal() {
  g('online-modal').classList.remove('open');
  stopMatchmaking();
  if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
  if (conn) { try { conn.close(); } catch(e) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }
}

function switchTab(t) {
  ['host', 'join', 'mm'].forEach(x => {
    const tab = g('tab-' + x);
    const panel = g('panel-' + x);
    if (tab) tab.classList.toggle('active', x === t);
    if (panel) panel.classList.toggle('active', x === t);
  });
  stopMatchmaking();
  if (peer) { try { peer.destroy(); } catch(e){} peer = null; }

  if (t === 'host') initHost();
}

// ── Strict 1-Hour Code & Session Lifetime Trackers ───────────────────────────
function verifySessionLiveliness() {
  if (roomCreatedAt && (Date.now() - roomCreatedAt > 3600000)) {
    roomCreatedAt = null;
    alert("Code expired, launch other match");
    closeOnlineModal();
    if (typeof quitToMenu === 'function') quitToMenu();
  }
}
window.checkCodeExpiration = verifySessionLiveliness;

// ── Host Room System ─────────────────────────────────────────────────────────
function initHost() {
  isHost = true; 
  window.isHost = true;
  const code = genCode();
  roomCreatedAt = Date.now();

  const box = g('host-code-box');
  if (box) box.innerHTML = `<div class="code-val">${code}</div><div class="code-hint">Share this code with your friend (Expires in 1 Hour)</div>`;
  setH('waiting', '<span class="spin"></span>Waiting for opponent…');

  peer = new Peer('floppy-' + code, {
    debug: 0,
    host: '0.peerjs.com', port: 443, secure: true,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }]}
  });

  peer.on('error', e => {
    if (e.type === 'unavailable-id') { peer.destroy(); peer = null; setTimeout(initHost, 600); return; }
    setH('error', '❌ Error creating room — try again');
  });

  peer.on('connection', c => {
    if (conn && conn.open) {
      c.send({ type: 'rejected', reason: 'Match full' });
      setTimeout(() => c.close(), 500);
      return;
    }
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

  if (peer) { peer.destroy(); peer = null; }
  isHost = false; 
  window.isHost = false;
  setJ('connecting', '<span class="spin"></span>Connecting…');

  peer = new Peer(undefined, {
    debug: 0, host: '0.peerjs.com', port: 443, secure: true,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]}
  });

  if (joinTimeout) clearTimeout(joinTimeout);
  joinTimeout = setTimeout(() => {
    setJ('error', '❌ Timeout — check code or connection');
    if (peer) { peer.destroy(); peer = null; }
  }, 15000);

  peer.on('open', () => {
    const c = peer.connect('floppy-' + raw, { reliable: true, serialization: 'json' });
    conn = c;
    setupConn(c, true);
  });

  peer.on('error', () => { 
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    setJ('error', '❌ Connection failed'); 
  });
}

// ── Automated Matchmaking Pipeline (Firestore Enabled) ──────────────────────
async function toggleMM() {
  if (isQueued) {
    stopMatchmaking();
    setMM('waiting', 'Matchmaking canceled. Ready to search.');
    g('mm-action-btn').textContent = "Find Match";
  } else {
    isQueued = true;
    g('mm-action-btn').textContent = "Cancel Search";
    setMM('connecting', '<span class="spin"></span>Searching for active combatants...');
    
    if (peer) { try { peer.destroy(); } catch(e){} }
    
    const myId = 'fsmm-' + Math.floor(100000 + Math.random() * 900000);
    roomCreatedAt = Date.now();
    
    peer = new Peer(myId, {
      debug: 0, host: '0.peerjs.com', port: 443, secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]}
    });

    peer.on('error', () => { stopMatchmaking(); setMM('error', '❌ Node tracking breakdown.'); });

    peer.on('connection', c => {
      if (conn && conn.open) { c.close(); return; }
      conn = c;
      setupConn(c, false);
    });

    peer.on('open', async () => {
      try {
        const db = firebase.firestore();
        const mmColl = db.collection('fsticks_matchmaking');
        
        const snapshot = await mmColl.where('status', '==', 'waiting').orderBy('time', 'asc').limit(1).get();
        if (!snapshot.empty) {
          const targetDoc = snapshot.docs[0];
          const targetData = targetDoc.data();
          
          await mmColl.doc(targetDoc.id).update({ status: 'matched', matchedWith: myId });
          
          isHost = false; window.isHost = false;
          conn = peer.connect(targetData.peerId, { reliable: true, serialization: 'json' });
          setupConn(conn, true);
        } else {
          isHost = true; window.isHost = true;
          mmDocRef = mmColl.doc(myId);
          await mmDocRef.set({
            peerId: myId,
            status: 'waiting',
            time: firebase.firestore.FieldValue.serverTimestamp()
          });

          mmUnsubscribe = mmDocRef.onSnapshot(doc => {
            const data = doc.data();
            if (data && data.status === 'matched') {
              if (mmUnsubscribe) mmUnsubscribe();
              mmDocRef.delete().catch(()=>{});
            }
          });
        }
      } catch (err) {
        stopMatchmaking();
        setMM('error', '❌ Crossplay pool unavailable.');
      }
    });
  }
}

function stopMatchmaking() {
  isQueued = false;
  const btn = g('mm-action-btn');
  if (btn) btn.textContent = "Find Match";
  if (mmUnsubscribe) { mmUnsubscribe(); mmUnsubscribe = null; }
  if (mmDocRef) { mmDocRef.delete().catch(()=>{}); mmDocRef = null; }
}

// ── Connection Lifecycles ────────────────────────────────────────────────────
function setupConn(c, joiner) {
  c.on('open', () => {
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    stopMatchmaking();
    
    if (joiner) setJ('connected', '✅ Match configured! Syncing runtime...');
    else setH('connected', '✅ Challenger matched!');
    
    send({ type: 'ready', name: window.currentUsername || 'Anonymous' });
  });

  c.on('data', onMsg);

  c.on('close', () => {
    if (gs === 'ONLINE_MODE') {
      ps = MX;
      const sc = g('p-score');
      if (sc) sc.textContent = ps + ' pts';
      gs = 'MATCH_OVER';
      _save();
    }
    conn = null;
  });
}

// ── Network Message Processor ────────────────────────────────────────────────
function onMsg(d) {
  if (!d?.type) return;
  
  if (d.type === 'rejected') {
    alert("Connection rejected: " + d.reason);
    closeOnlineModal();
    return;
  }

  switch (d.type) {
    case 'ready':
      const opponentName = d.name || "Opponent";
      const lbl = g('o-label');
      if (lbl) lbl.textContent = opponentName.toUpperCase();
      
      if (isHost) {
        setH('connected', '✅ Connected to ' + opponentName);
        send({ type: 'ready_ack', name: window.currentUsername || 'Anonymous' });
        setTimeout(startOnline, 600);
      }
      break;

    case 'ready_ack':
      const hostName = d.name || "Host";
      const oLbl = g('o-label');
      if (oLbl) oLbl.textContent = hostName.toUpperCase();
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
window.closeOnlineModal = closeOnlineModal;
window.switchTab        = switchTab;
window.joinGame         = joinGame;
window.toggleMM         = toggleMM;