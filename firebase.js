// firebase.js — Firestore edition
// Lazy connections: network disabled by default, enabled only per-operation.
// In-memory cache reduces repeat reads within a session.

firebase.initializeApp({
  apiKey: "AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8",
  authDomain: "playconsole4u-53a6a.firebaseapp.com",
  projectId: "playconsole4u-53a6a",
  storageBucket: "playconsole4u-53a6a.firebasestorage.app",
  messagingSenderId: "306379034842",
  appId: "1:306379034842:web:1b891d0ef20cdacb0a55e3",
  measurementId: "G-NZ50CHHLFX"
});

const auth = firebase.auth();
const db   = firebase.firestore();

// Keep network off until we actually need it
db.disableNetwork();

let _netOn    = false;
let _opCount  = 0;
let _offTimer = null;

function _enableNet() {
  if (_offTimer) { clearTimeout(_offTimer); _offTimer = null; }
  if (!_netOn) { db.enableNetwork(); _netOn = true; }
  _opCount++;
}
function _releaseNet() {
  _opCount = Math.max(0, _opCount - 1);
  if (_opCount === 0) {
    _offTimer = setTimeout(() => {
      db.disableNetwork();
      _netOn = false;
      _offTimer = null;
    }, 1500);
  }
}
async function _net(fn) {
  _enableNet();
  try   { return await fn(); }
  finally { _releaseNet(); }
}

// ── In-memory cache ──
const _cache = {};
function _cSet(k, v, ttl = 60_000) { _cache[k] = { v, exp: Date.now() + ttl }; }
function _cGet(k) { const e = _cache[k]; return e && Date.now() < e.exp ? e.v : null; }
function _cDel(k) { delete _cache[k]; }

// ── Firestore refs ──
const _userRef = uid => db.collection('users').doc(uid);
const _lvlRef  = (uid, n) => _userRef(uid).collection('levels').doc(`L${n}`);
const _skinRef = uid => _userRef(uid).collection('meta').doc('skin');
const _lbRef   = n => db.collection('leaderboard').doc(`L${n}`).collection('entries');

// ── Auth ──
const signInGoogle = () =>
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const logOut       = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async user => {
    if (user) {
      _cDel(`prof_${user.uid}`);
      _cDel(`times_${user.uid}`);
      _cDel(`skin_${user.uid}`);
      await _ensureDefaults(user);
    }
    cb(user);
  });
}

async function _ensureDefaults(user) {
  try {
    await _net(async () => {
      const ref  = _userRef(user.uid);
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      const up   = {};
      if (!data.name)  up.name  = user.displayName || 'Anonymous';
      if (!data.email) up.email = user.email || '';
      if (!data.photo && user.photoURL) up.photo = user.photoURL;
      if (Object.keys(up).length) {
        await ref.set(up, { merge: true });
        _cSet(`prof_${user.uid}`, { ...data, ...up });
      } else {
        _cSet(`prof_${user.uid}`, data);
      }
      const skinSnap = await _skinRef(user.uid).get();
      if (!skinSnap.exists) {
        await _skinRef(user.uid).set({ eq: 'default', own: { default: true } });
      }
    });
  } catch (e) {
    console.warn('[FB] _ensureDefaults:', e.message);
  }
}

// ── Profile ──
async function getProfile(uid) {
  const cached = _cGet(`prof_${uid}`);
  if (cached) return cached;
  try {
    return await _net(async () => {
      const snap = await _userRef(uid).get();
      const val  = snap.exists ? snap.data() : {};
      _cSet(`prof_${uid}`, val);
      return val;
    });
  } catch { return {}; }
}

async function saveProfile(uid, name, photo) {
  _cDel(`prof_${uid}`);
  const up = {};
  if (name  != null) up.name  = name;
  if (photo != null) up.photo = photo;
  await _net(() => _userRef(uid).set(up, { merge: true }));
}

// ── Skins ──
async function getSkinData(uid) {
  const cached = _cGet(`skin_${uid}`);
  if (cached) return cached;
  try {
    return await _net(async () => {
      const snap = await _skinRef(uid).get();
      const result = snap.exists
        ? { eq: snap.data().eq || 'default', own: snap.data().own || { default: true } }
        : { eq: 'default', own: { default: true } };
      _cSet(`skin_${uid}`, result);
      return result;
    });
  } catch { return { eq: 'default', own: { default: true } }; }
}

async function equipSkin(uid, skinId) {
  _cDel(`skin_${uid}`);
  await _net(() => _skinRef(uid).set({ eq: skinId }, { merge: true }));
}

async function unlockSkin(uid, skinId) {
  _cDel(`skin_${uid}`);
  await _net(() =>
    _skinRef(uid).set({ own: { [skinId]: true } }, { merge: true })
  );
}

// ── Level times ──
async function saveLevelTime(uid, levelNum, seconds) {
  try {
    return await _net(async () => {
      const ref  = _lvlRef(uid, levelNum);
      const snap = await ref.get();
      const t    = Math.round(seconds * 1000) / 1000;
      const prev = snap.exists ? snap.data().t : null;
      const isRecord = prev === null || t < prev;
      if (isRecord) {
        await ref.set({ t, ts: Date.now() });
        // update local cache
        const tk = `times_${uid}`;
        const ct = _cGet(tk) || {};
        ct[`L${levelNum}`] = { t, ts: Date.now() };
        _cSet(tk, ct);
        // push to leaderboard collection
        await _lbRef(levelNum).doc(uid).set({
          uid,
          name: currentUser()?.displayName || 'Anonymous',
          t,
          ts: Date.now()
        });
        const UNLOCKS = { 2:'ghost', 4:'neon', 6:'fire', 8:'void', 10:'rainbow' };
        if (UNLOCKS[levelNum]) await unlockSkin(uid, UNLOCKS[levelNum]);
      }
      return { saved: isRecord, isRecord, prev };
    });
  } catch (e) {
    console.error('[FB] saveLevelTime:', e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

async function getMyTimes(uid) {
  const cached = _cGet(`times_${uid}`);
  if (cached) return cached;
  try {
    return await _net(async () => {
      const snap = await _userRef(uid).collection('levels').get();
      const result = {};
      snap.forEach(doc => { result[doc.id] = doc.data(); });
      _cSet(`times_${uid}`, result);
      return result;
    });
  } catch { return {}; }
}

// ── Leaderboard — flat collection, ordered query, 2-min cache ──
async function getLeaderboard(levelNum) {
  const key    = `lb_${levelNum}`;
  const cached = _cGet(key);
  if (cached) return cached;
  try {
    return await _net(async () => {
      const snap = await _lbRef(levelNum)
        .orderBy('t', 'asc')
        .limit(100)
        .get();
      const rows = [];
      snap.forEach(doc => rows.push(doc.data()));
      _cSet(key, rows, 120_000);
      return rows;
    });
  } catch (e) {
    console.error('[FB] getLeaderboard:', e.message);
    return [];
  }
}

window.FB = {
  signInGoogle,
  signOut: logOut,
  onAuthChange,
  currentUser,
  getProfile,
  saveProfile,
  getSkinData,
  equipSkin,
  unlockSkin,
  saveLevelTime,
  getMyTimes,
  getLeaderboard
};

console.log('[FB] Firestore SDK loaded ✓');