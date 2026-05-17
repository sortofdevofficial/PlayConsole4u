// firebase.js — Firestore, minimal
// Path: users/{uid}/G/CP/L/{ver}/lv/{n}  → { t, ts, lp, uk }
//   t  = best time (seconds)
//   ts = timestamp when best was set
//   lp = last played timestamp
//   uk = unlocked (bool)
// users/{uid} → { n, e, ph }  (name, email, photo)

firebase.initializeApp({
  apiKey:            "AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8",
  authDomain:        "playconsole4u-53a6a.firebaseapp.com",
  projectId:         "playconsole4u-53a6a",
  storageBucket:     "playconsole4u-53a6a.firebasestorage.app",
  messagingSenderId: "306379034842",
  appId:             "1:306379034842:web:1b891d0ef20cdacb0a55e3",
  measurementId:     "G-NZ50CHHLFX"
});

const auth = firebase.auth();
const db   = firebase.firestore();

// Game version — bump to "2" when releasing a new version
const VER = "1";

// Lazy network — offline until needed
db.disableNetwork();
let _on = false, _ops = 0, _timer = null;

function _up() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  if (!_on) { db.enableNetwork(); _on = true; }
  _ops++;
}
function _dn() {
  _ops = Math.max(0, _ops - 1);
  if (_ops === 0) {
    _timer = setTimeout(() => { db.disableNetwork(); _on = false; _timer = null; }, 1500);
  }
}
async function _go(fn) { _up(); try { return await fn(); } finally { _dn(); } }

// Cache
const _c = {};
const cSet = (k, v, ttl = 60000) => { _c[k] = { v, x: Date.now() + ttl }; };
const cGet = k => { const e = _c[k]; return e && Date.now() < e.x ? e.v : null; };
const cDel = k => { delete _c[k]; };

// Refs
const uRef  = uid => db.collection('users').doc(uid);
const lvRef = (uid, n) => uRef(uid).collection('G').doc('CP').collection('L').doc(VER).collection('lv').doc(String(n));
const lvCol = uid => uRef(uid).collection('G').doc('CP').collection('L').doc(VER).collection('lv');

// Auth
const signInGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const logOut       = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async user => {
    if (user) {
      cDel('p_' + user.uid);
      cDel('t_' + user.uid);
      await _ensureUser(user);
    }
    cb(user);
  });
}

async function _ensureUser(user) {
  try {
    await _go(async () => {
      const snap = await uRef(user.uid).get();
      const d = snap.exists ? snap.data() : {};
      const up = {};
      if (!d.n)  up.n  = user.displayName || 'Anonymous';
      if (!d.e)  up.e  = user.email || '';
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

// Level times
// Returns { saved, isRecord, prev }
async function saveLevelTime(uid, lvlNum, secs) {
  try {
    return await _go(async () => {
      const ref  = lvRef(uid, lvlNum);
      const snap = await ref.get();
      const t    = Math.round(secs * 1000) / 1000;
      const prev = snap.exists ? (snap.data().t ?? null) : null;
      const isRecord = prev === null || t < prev;
      const now  = Date.now();
      const data = { lp: now, uk: true };
      if (isRecord) { data.t = t; data.ts = now; }
      await ref.set(data, { merge: true });
      // Update cache
      const tk = 't_' + uid;
      const ct = cGet(tk) || {};
      ct[String(lvlNum)] = { ...(snap.exists ? snap.data() : {}), ...data };
      cSet(tk, ct);
      return { saved: true, isRecord, prev };
    });
  } catch (e) {
    console.error('[FB] saveLevelTime:', e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

// Returns { "1":{t,ts,lp,uk}, ... }
async function getMyTimes(uid) {
  const hit = cGet('t_' + uid);
  if (hit) return hit;
  try {
    return await _go(async () => {
      const snap = await lvCol(uid).get();
      const r = {};
      snap.forEach(d => { r[d.id] = d.data(); });
      cSet('t_' + uid, r);
      return r;
    });
  } catch { return {}; }
}

// Unlock level explicitly (called when previous level is beaten)
async function unlockLevel(uid, lvlNum) {
  try {
    await _go(async () => {
      const ref = lvRef(uid, lvlNum);
      const snap = await ref.get();
      if (!snap.exists || !snap.data().uk) {
        await ref.set({ uk: true }, { merge: true });
        const tk = 't_' + uid;
        const ct = cGet(tk) || {};
        ct[String(lvlNum)] = { ...(ct[String(lvlNum)] || {}), uk: true };
        cSet(tk, ct);
      }
    });
  } catch (e) { console.warn('[FB] unlockLevel:', e.message); }
}

// Leaderboard — parallel fetch, top 100, 2min cache
async function getLeaderboard(lvlNum) {
  const key = 'lb_' + lvlNum;
  const hit = cGet(key);
  if (hit) return hit;
  try {
    return await _go(async () => {
      const users = await db.collection('users').get();
      const rows  = [];
      await Promise.all(users.docs.map(ud =>
        lvRef(ud.id, lvlNum).get()
          .then(ls => {
            if (ls.exists && ls.data().t != null) {
              rows.push({ uid: ud.id, name: ud.data().n || 'Anonymous', t: ls.data().t, ts: ls.data().ts || 0 });
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

window.FB = { signInGoogle, signOut: logOut, onAuthChange, currentUser, getProfile, saveProfile, saveLevelTime, getMyTimes, unlockLevel, getLeaderboard, VER };
console.log('[FB] ready, ver=' + VER);