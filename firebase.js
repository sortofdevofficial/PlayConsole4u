// firebase.js v1.5 — NO network toggling (fixes INTERNAL ASSERTION FAILED crash)
// users/{uid}              → { n, e, ph }
// users/{uid}/G/CP/L/{VER} → { "1":{t,ts,lp,uk}, … }
// users/{uid}/G/FS         → { w, l }

firebase.initializeApp({
  apiKey:'AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8',
  authDomain:'playconsole4u-53a6a.firebaseapp.com',
  projectId:'playconsole4u-53a6a',
  storageBucket:'playconsole4u-53a6a.firebasestorage.app',
  messagingSenderId:'306379034842',
  appId:'1:306379034842:web:1b891d0ef20cdacb0a55e3'
});

// Network ALWAYS ON — toggling it causes "INTERNAL ASSERTION FAILED: Unexpected state"
const _a = firebase.auth();
const _d = firebase.firestore();
const VER = '1';

// Simple in-memory cache (no network toggling needed)
const _c = {};
const cS = (k, v, ttl = 60000) => { _c[k] = { v, x: Date.now() + ttl }; };
const cG = k => { const e = _c[k]; return e && Date.now() < e.x ? e.v : null; };
const cD = k => { delete _c[k]; };

// Refs
const uRef = uid => _d.collection('users').doc(uid);
const lRef = uid => uRef(uid).collection('G').doc('CP').collection('L').doc(VER);
const fRef = uid => uRef(uid).collection('G').doc('FS');

// ── Auth ──────────────────────────────────────────────────────────────────
const signInGoogle = () => _a.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut      = () => _a.signOut();
const currentUser  = () => _a.currentUser;

function onAuthChange(cb) {
  _a.onAuthStateChanged(async user => {
    if (user) { cD('p_' + user.uid); await _ensureUser(user); }
    cb(user);
  });
}

async function _ensureUser(u) {
  try {
    const snap = await uRef(u.uid).get();
    const d = snap.exists ? snap.data() : {};
    const up = {};
    if (!d.n) up.n = u.displayName || 'Anonymous';
    if (!d.e) up.e = u.email || '';
    if (!d.ph && u.photoURL) up.ph = u.photoURL;
    if (Object.keys(up).length) {
      await uRef(u.uid).set(up, { merge: true });
      cS('p_' + u.uid, { ...d, ...up });
    } else {
      cS('p_' + u.uid, d);
    }
  } catch (e) { console.warn('[FB] ensureUser:', e.message); }
}

// ── Profile ───────────────────────────────────────────────────────────────
async function getProfile(uid) {
  const h = cG('p_' + uid); if (h) return h;
  try {
    const s = await uRef(uid).get();
    const v = s.exists ? s.data() : {};
    cS('p_' + uid, v); return v;
  } catch { return {}; }
}

async function saveProfile(uid, name) {
  cD('p_' + uid);
  await uRef(uid).set({ n: name }, { merge: true });
}

// ── CubePlatformer level times ─────────────────────────────────────────────
async function saveLevelTime(uid, lvl, secs) {
  try {
    const ref = lRef(uid);
    const snap = await ref.get();
    const all = snap.exists ? snap.data() : {};
    const f = String(lvl);
    const prev = all[f]?.t ?? null;
    const t = Math.round(secs * 1000) / 1000;
    const rec = prev === null || t < prev;
    const now = Date.now();
    const upd = {};
    upd[f] = { ...(all[f] || {}), lp: now, uk: true };
    if (rec) { upd[f].t = t; upd[f].ts = now; }
    await ref.set(upd, { merge: true });
    const ct = cG('t_' + uid) || {}; ct[f] = upd[f]; cS('t_' + uid, ct);
    return { saved: true, isRecord: rec, prev };
  } catch (e) {
    console.error('[FB] saveLevelTime:', e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

async function getMyTimes(uid) {
  const h = cG('t_' + uid); if (h) return h;
  try {
    const s = await lRef(uid).get();
    const v = s.exists ? s.data() : {};
    cS('t_' + uid, v); return v;
  } catch { return {}; }
}

async function unlockLevel(uid, lvl) {
  try {
    const tk = 't_' + uid, ct = cG(tk) || {}, f = String(lvl);
    if (ct[f]?.uk) return;
    const u = {}; u[f] = { ...(ct[f] || {}), uk: true };
    await lRef(uid).set(u, { merge: true });
    ct[f] = u[f]; cS(tk, ct);
  } catch (e) { console.warn('[FB] unlockLevel:', e.message); }
}

// ── FloppySticks W/L → users/{uid}/G/FS ──────────────────────────────────
// FieldValue.increment is atomic — no read needed, no race condition.
async function recordMatch(uid, won) {
  cD('fs_' + uid); // bust cache — next read will be fresh from server
  const INC = firebase.firestore.FieldValue.increment;
  try {
    await fRef(uid).set(
      won ? { w: INC(1), l: INC(0) } : { w: INC(0), l: INC(1) },
      { merge: true }
    );
    console.log('[FB] recordMatch saved  won=' + won);
  } catch (e) {
    console.error('[FB] recordMatch FAILED:', e.code, e.message);
    throw e;
  }
}

async function getMatchStats(uid) {
  cD('fs_' + uid); // always read fresh after a match
  try {
    const snap = await fRef(uid).get();
    const v = snap.exists ? snap.data() : { w: 0, l: 0 };
    return { w: v.w || 0, l: v.l || 0 };
  } catch (e) {
    console.warn('[FB] getMatchStats:', e.message);
    return { w: 0, l: 0 };
  }
}

// ── Leaderboard ───────────────────────────────────────────────────────────
async function getLeaderboard(lvl) {
  const key = 'lb_' + lvl, h = cG(key); if (h) return h;
  try {
    const users = await _d.collection('users').get(), rows = [];
    await Promise.all(users.docs.map(d =>
      lRef(d.id).get().then(s => {
        if (s.exists) {
          const ld = s.data()[String(lvl)];
          if (ld?.t != null) rows.push({ uid: d.id, name: d.data().n || 'Anonymous', t: ld.t, ts: ld.ts || 0 });
        }
      }).catch(() => {})
    ));
    const sorted = rows.sort((a, b) => a.t - b.t).slice(0, 100);
    cS(key, sorted, 120000); return sorted;
  } catch (e) { console.error('[FB] getLeaderboard:', e.message); return []; }
}

window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  getProfile, saveProfile,
  saveLevelTime, getMyTimes, unlockLevel,
  recordMatch, getMatchStats,
  getLeaderboard, VER
};
console.log('[FB] ready v' + VER);