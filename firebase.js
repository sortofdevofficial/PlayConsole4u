// firebase.js — Firestore + Auth
//
// Path structure:
//   users/{uid}                   → { n, e, ph }
//   users/{uid}/G/CP/L/{ver}      → { "1":{t,ts,lp,uk}, … }   level times
//   users/{uid}/G/FS              → { w, l }                   match wins / losses
//
// Network lazy: disabled on load, enabled per-op, auto-off 1.5 s after last op.

firebase.initializeApp({
  apiKey:            "AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8",
  authDomain:        "playconsole4u-53a6a.firebaseapp.com",
  projectId:         "playconsole4u-53a6a",
  storageBucket:     "playconsole4u-53a6a.firebasestorage.app",
  messagingSenderId: "306379034842",
  appId:             "1:306379034842:web:1b891d0ef20cdacb0a55e3",
  measurementId:     "G-NZ50CHHLFX",
});

const auth = firebase.auth();
const db   = firebase.firestore();
const VER  = "1";

// ── Lazy network ─────────────────────────────────────────────────────────
db.disableNetwork();
let _netOn = false, _ops = 0, _offTimer = null;

function _netUp() {
  if (_offTimer) { clearTimeout(_offTimer); _offTimer = null; }
  if (!_netOn)   { db.enableNetwork(); _netOn = true; }
  _ops++;
}
function _netDn() {
  _ops = Math.max(0, _ops - 1);
  if (_ops === 0) {
    _offTimer = setTimeout(() => { db.disableNetwork(); _netOn = false; _offTimer = null; }, 1500);
  }
}
async function _go(fn) { _netUp(); try { return await fn(); } finally { _netDn(); } }

// ── Cache ─────────────────────────────────────────────────────────────────
const _cache = {};
const cSet = (k, v, ttl = 60000) => { _cache[k] = { v, x: Date.now() + ttl }; };
const cGet = (k) => { const e = _cache[k]; return e && Date.now() < e.x ? e.v : null; };
const cDel = (k) => { delete _cache[k]; };

// ── Refs ──────────────────────────────────────────────────────────────────
const uRef   = uid => db.collection('users').doc(uid);
const verRef = uid => uRef(uid).collection('G').doc('CP').collection('L').doc(VER);
const fsRef  = uid => uRef(uid).collection('G').doc('FS');   // win/loss

// ── Auth ──────────────────────────────────────────────────────────────────
const signInGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut      = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async user => {
    if (user) { cDel('p_' + user.uid); cDel('t_' + user.uid); await _ensureUser(user); }
    cb(user);
  });
}

async function _ensureUser(user) {
  try {
    await _go(async () => {
      const snap = await uRef(user.uid).get();
      const d    = snap.exists ? snap.data() : {};
      const up   = {};
      if (!d.n)                 up.n  = user.displayName || 'Anonymous';
      if (!d.e)                 up.e  = user.email || '';
      if (!d.ph && user.photoURL) up.ph = user.photoURL;
      if (Object.keys(up).length) {
        await uRef(user.uid).set(up, { merge: true });
        cSet('p_' + user.uid, { ...d, ...up });
      } else {
        cSet('p_' + user.uid, d);
      }
    });
  } catch (e) { console.warn('[FB]', e.message); }
}

// ── Profile ───────────────────────────────────────────────────────────────
async function getProfile(uid) {
  const hit = cGet('p_' + uid);
  if (hit) return hit;
  try {
    return await _go(async () => {
      const s = await uRef(uid).get();
      const v = s.exists ? s.data() : {};
      cSet('p_' + uid, v);
      return v;
    });
  } catch { return {}; }
}

async function saveProfile(uid, name) {
  cDel('p_' + uid);
  await _go(() => uRef(uid).set({ n: name }, { merge: true }));
}

// ── Level times ───────────────────────────────────────────────────────────
async function saveLevelTime(uid, lvlNum, secs) {
  try {
    return await _go(async () => {
      const ref   = verRef(uid);
      const snap  = await ref.get();
      const all   = snap.exists ? snap.data() : {};
      const prev  = all[String(lvlNum)]?.t ?? null;
      const t     = Math.round(secs * 1000) / 1000;
      const isRec = prev === null || t < prev;
      const now   = Date.now();
      const field = String(lvlNum);
      const cur   = all[field] || {};
      const update = {};
      update[field] = { ...cur, lp: now, uk: true };
      if (isRec) { update[field].t = t; update[field].ts = now; }
      await ref.set(update, { merge: true });
      const ct = cGet('t_' + uid) || {};
      ct[field] = update[field];
      cSet('t_' + uid, ct);
      return { saved: true, isRecord: isRec, prev };
    });
  } catch (e) {
    console.error('[FB] saveLevelTime:', e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

async function getMyTimes(uid) {
  const hit = cGet('t_' + uid);
  if (hit) return hit;
  try {
    return await _go(async () => {
      const snap = await verRef(uid).get();
      const v = snap.exists ? snap.data() : {};
      cSet('t_' + uid, v);
      return v;
    });
  } catch { return {}; }
}

async function unlockLevel(uid, lvlNum) {
  try {
    const tk = 't_' + uid;
    const ct = cGet(tk) || {};
    const f  = String(lvlNum);
    if (ct[f]?.uk) return;
    await _go(async () => {
      const update = {};
      update[f] = { ...(ct[f] || {}), uk: true };
      await verRef(uid).set(update, { merge: true });
      ct[f] = update[f];
      cSet(tk, ct);
    });
  } catch (e) { console.warn('[FB] unlockLevel:', e.message); }
}

// ── Match W / L  →  users/{uid}/G/FS  ────────────────────────────────────
// Fields: w (wins)  l (losses)

async function recordMatch(uid, won) {
  const key = 'fs_' + uid;
  try {
    await _go(async () => {
      const ref  = fsRef(uid);
      const snap = await ref.get();
      const d    = snap.exists ? snap.data() : { w: 0, l: 0 };
      const next = {
        w: (d.w || 0) + (won ? 1 : 0),
        l: (d.l || 0) + (won ? 0 : 1),
      };
      await ref.set(next, { merge: true });
      cSet(key, next, 30000);
    });
  } catch (e) { console.warn('[FB] recordMatch:', e.message); }
}

async function getMatchStats(uid) {
  const key = 'fs_' + uid;
  const hit = cGet(key);
  if (hit) return hit;
  try {
    return await _go(async () => {
      const snap = await fsRef(uid).get();
      const v = snap.exists ? snap.data() : { w: 0, l: 0 };
      cSet(key, v, 30000);
      return v;
    });
  } catch { return { w: 0, l: 0 }; }
}

// ── Leaderboard ───────────────────────────────────────────────────────────
async function getLeaderboard(lvlNum) {
  const key = 'lb_' + lvlNum;
  const hit = cGet(key);
  if (hit) return hit;
  try {
    return await _go(async () => {
      const users = await db.collection('users').get();
      const rows  = [];
      await Promise.all(users.docs.map(ud =>
        verRef(ud.id).get()
          .then(vs => {
            if (vs.exists) {
              const ld = vs.data()[String(lvlNum)];
              if (ld?.t != null)
                rows.push({ uid: ud.id, name: ud.data().n || 'Anonymous', t: ld.t, ts: ld.ts || 0 });
            }
          })
          .catch(() => {})
      ));
      const sorted = rows.sort((a, b) => a.t - b.t).slice(0, 100);
      cSet(key, sorted, 120000);
      return sorted;
    });
  } catch (e) { console.error('[FB] getLeaderboard:', e.message); return []; }
}

// ── Exports ───────────────────────────────────────────────────────────────
window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  getProfile, saveProfile,
  saveLevelTime, getMyTimes, unlockLevel,
  recordMatch, getMatchStats,
  getLeaderboard,
  VER,
};

console.log('[FB] ready  ver=' + VER);