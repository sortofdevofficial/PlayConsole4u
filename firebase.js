// firebase.js — Firestore edition
// Data structure:
//   users/{uid}/name
//   users/{uid}/email
//   users/{uid}/photo
//   users/{uid}/G/CP/L/{1..10}  → { t, ts }   (level times)
//   users/{uid}/G/CP/C/S        → { eq, own }  (skin data)
//
// Leaderboard: scans users collection, picks best time per level (top 100)
// Lazy network: Firestore stays offline until a real operation is needed.

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

// Stay offline until we actually need the network
db.disableNetwork();

let _netOn    = false;
let _opCount  = 0;
let _offTimer = null;

function _enableNet() {
  if (_offTimer) { clearTimeout(_offTimer); _offTimer = null; }
  if (!_netOn)   { db.enableNetwork(); _netOn = true; }
  _opCount++;
}
function _releaseNet() {
  _opCount = Math.max(0, _opCount - 1);
  if (_opCount === 0) {
    _offTimer = setTimeout(() => {
      db.disableNetwork();
      _netOn    = false;
      _offTimer = null;
    }, 1500);
  }
}
async function _net(fn) {
  _enableNet();
  try   { return await fn(); }
  finally { _releaseNet(); }
}

// ── Simple in-memory cache ──
const _cache = {};
function _cSet(k, v, ttl = 60_000) {
  _cache[k] = { v, exp: Date.now() + ttl };
}
function _cGet(k) {
  const e = _cache[k];
  return (e && Date.now() < e.exp) ? e.v : null;
}
function _cDel(k) { delete _cache[k]; }

// ── Firestore path helpers ──
// Root user doc: holds name, email, photo
const _userDoc  = uid => db.collection('users').doc(uid);

// Level time doc: users/{uid}/G/CP/L/{levelNum}
const _lvlDoc   = (uid, n) =>
  _userDoc(uid)
    .collection('G').doc('CP')
    .collection('L').doc(String(n));

// All levels subcollection: users/{uid}/G/CP/L
const _lvlCol   = uid =>
  _userDoc(uid)
    .collection('G').doc('CP')
    .collection('L');

// Skin doc: users/{uid}/G/CP/C/S
const _skinDoc  = uid =>
  _userDoc(uid)
    .collection('G').doc('CP')
    .collection('C').doc('S');

// ── Auth ──
const signInGoogle = () =>
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const logOut       = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async user => {
    if (user) {
      // Invalidate stale cache on auth change
      _cDel(`prof_${user.uid}`);
      _cDel(`times_${user.uid}`);
      _cDel(`skin_${user.uid}`);
      await _ensureDefaults(user);
    }
    cb(user);
  });
}

// Write only if something is missing — avoids unnecessary writes
async function _ensureDefaults(user) {
  try {
    await _net(async () => {
      const ref  = _userDoc(user.uid);
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      const up   = {};
      if (!data.name)              up.name  = user.displayName || 'Anonymous';
      if (!data.email)             up.email = user.email || '';
      if (!data.photo && user.photoURL) up.photo = user.photoURL;
      if (Object.keys(up).length) {
        await ref.set(up, { merge: true });
        _cSet(`prof_${user.uid}`, { ...data, ...up });
      } else {
        _cSet(`prof_${user.uid}`, data);
      }

      // Ensure skin doc exists
      const skinSnap = await _skinDoc(user.uid).get();
      if (!skinSnap.exists) {
        await _skinDoc(user.uid).set({ eq: 'default', own: { default: true } });
      }
    });
  } catch (e) {
    console.warn('[FB] _ensureDefaults:', e.message);
  }
}

// ── Profile ──
async function getProfile(uid) {
  const hit = _cGet(`prof_${uid}`);
  if (hit) return hit;
  try {
    return await _net(async () => {
      const snap = await _userDoc(uid).get();
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
  await _net(() => _userDoc(uid).set(up, { merge: true }));
}

// ── Skins ──
async function getSkinData(uid) {
  const hit = _cGet(`skin_${uid}`);
  if (hit) return hit;
  try {
    return await _net(async () => {
      const snap = await _skinDoc(uid).get();
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
  await _net(() => _skinDoc(uid).set({ eq: skinId }, { merge: true }));
}

async function unlockSkin(uid, skinId) {
  _cDel(`skin_${uid}`);
  await _net(() =>
    _skinDoc(uid).set({ own: { [skinId]: true } }, { merge: true })
  );
}

// ── Level times ──
async function saveLevelTime(uid, levelNum, seconds) {
  try {
    return await _net(async () => {
      const ref  = _lvlDoc(uid, levelNum);
      const snap = await ref.get();
      const t    = Math.round(seconds * 1000) / 1000;
      const prev = snap.exists ? snap.data().t : null;
      const isRecord = (prev === null || t < prev);

      if (isRecord) {
        await ref.set({ t, ts: Date.now() });

        // Update local times cache so grid refresh is free
        const tk = `times_${uid}`;
        const ct = _cGet(tk) || {};
        ct[String(levelNum)] = { t, ts: Date.now() };
        _cSet(tk, ct);

        // Skin unlocks
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

// Returns { "1": {t, ts}, "2": {t, ts}, ... } keyed by level number string
async function getMyTimes(uid) {
  const hit = _cGet(`times_${uid}`);
  if (hit) return hit;
  try {
    return await _net(async () => {
      const snap = await _lvlCol(uid).get();
      const result = {};
      snap.forEach(doc => { result[doc.id] = doc.data(); });
      _cSet(`times_${uid}`, result);
      return result;
    });
  } catch { return {}; }
}

// ── Leaderboard ──
// Scans all users, finds best time for the given level, returns top 100.
// Cached for 2 minutes so repeated tab-switches don't re-read.
async function getLeaderboard(levelNum) {
  const key = `lb_${levelNum}`;
  const hit = _cGet(key);
  if (hit) return hit;
  try {
    return await _net(async () => {
      const usersSnap = await db.collection('users').get();
      const rows = [];

      // We need each user's level time. Because of the nested subcollection
      // structure (users/{uid}/G/CP/L/{n}) we fetch each user's level doc
      // in parallel for speed.
      const fetches = [];
      usersSnap.forEach(userDoc => {
        fetches.push(
          _lvlDoc(userDoc.id, levelNum).get().then(lvlSnap => {
            if (lvlSnap.exists) {
              const d = userDoc.data();
              rows.push({
                uid:  userDoc.id,
                name: d.name  || 'Anonymous',
                t:    lvlSnap.data().t,
                ts:   lvlSnap.data().ts || 0
              });
            }
          }).catch(() => {}) // skip users with no data
        );
      });

      await Promise.all(fetches);
      const sorted = rows.sort((a, b) => a.t - b.t).slice(0, 100);
      _cSet(key, sorted, 120_000); // 2-minute cache
      return sorted;
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