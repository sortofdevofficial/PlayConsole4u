firebase.initializeApp({
  apiKey: "AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8",
  authDomain: "playconsole4u-53a6a.firebaseapp.com",
  databaseURL: "https://playconsole4u-53a6a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "playconsole4u-53a6a",
  storageBucket: "playconsole4u-53a6a.firebasestorage.app",
  messagingSenderId: "306379034842",
  appId: "1:306379034842:web:1b891d0ef20cdacb0a55e3",
  measurementId: "G-NZ50CHHLFX"
});

const auth = firebase.auth();
const db   = firebase.database();

// ── Keep the realtime connection OFFLINE until we actually need it.
// Firebase opens a persistent WebSocket the moment you call db.ref().
// goOffline() stops that. We call goOnline() only when a DB op is needed,
// then goOffline() again once it completes.
db.goOffline();

let _dbOnline   = false;   // are we currently online?
let _opCount    = 0;       // how many ops are in-flight
let _offTimer   = null;    // debounce timer for going back offline

function _online() {
  if (_offTimer) { clearTimeout(_offTimer); _offTimer = null; }
  if (!_dbOnline) { db.goOnline(); _dbOnline = true; }
  _opCount++;
}

function _done() {
  _opCount = Math.max(0, _opCount - 1);
  if (_opCount === 0) {
    // Go offline after a short grace period so rapid sequential calls
    // don't thrash the connection on/off.
    _offTimer = setTimeout(() => {
      db.goOffline();
      _dbOnline = false;
      _offTimer = null;
    }, 1500);
  }
}

// Wrap every DB operation: go online → run → go offline
async function _db(fn) {
  _online();
  try   { return await fn(); }
  finally { _done(); }
}

// ── In-memory cache so repeated reads within the same session are free ──
const _cache = {};
function _cacheSet(key, val) { _cache[key] = { val, ts: Date.now() }; }
function _cacheGet(key, maxAgeMs = 30_000) {
  const c = _cache[key];
  return c && (Date.now() - c.ts) < maxAgeMs ? c.val : null;
}
function _cacheInvalidate(key) { delete _cache[key]; }

// ── Path helpers ──
const _user = uid => `users/${uid}`;
const _lvl  = (uid, n) => `users/${uid}/G/CP/L/L${n}`;
const _skin = uid => `users/${uid}/G/CP/C/S`;

// ── Auth ──
const signInGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const logOut       = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  // Auth state changes don't need the DB connection
  auth.onAuthStateChanged(async user => {
    if (user) {
      // Invalidate any cached user data on auth change
      _cacheInvalidate(_user(user.uid));
      _cacheInvalidate(`times_${user.uid}`);
      _cacheInvalidate(`skin_${user.uid}`);
      await _ensureDefaults(user);
    }
    cb(user);
  });
}

// Only write defaults if something is actually missing
async function _ensureDefaults(user) {
  try {
    await _db(async () => {
      const userRef = db.ref(_user(user.uid));
      const snap = await userRef.get();
      const val  = snap.exists() ? snap.val() : {};
      const up   = {};
      if (!val.name)                       up.name = user.displayName || 'Anonymous';
      if (!val.photo && user.photoURL)     up.photo = user.photoURL;
      if (!val.G?.CP?.C?.S?.eq)           up['G/CP/C/S/eq'] = 'default';
      if (!val.G?.CP?.C?.S?.own?.default) up['G/CP/C/S/own/default'] = true;
      if (Object.keys(up).length) {
        await userRef.update(up);
        // Store in cache after writing
        _cacheSet(_user(user.uid), { ...val, ...up });
      } else {
        _cacheSet(_user(user.uid), val);
      }
    });
  } catch (e) {
    console.warn('[FB] _ensureDefaults:', e.message);
  }
}

// ── Profile ──
async function getProfile(uid) {
  const cached = _cacheGet(_user(uid), 60_000);
  if (cached) return cached;
  try {
    return await _db(async () => {
      const snap = await db.ref(_user(uid)).get();
      const val  = snap.exists() ? snap.val() : {};
      _cacheSet(_user(uid), val);
      return val;
    });
  } catch { return {}; }
}

async function saveProfile(uid, name, photo) {
  const up = {};
  if (name  != null) up.name  = name;
  if (photo != null) up.photo = photo;
  _cacheInvalidate(_user(uid));
  await _db(() => db.ref(_user(uid)).update(up));
}

// ── Skins ──
async function getSkinData(uid) {
  const cached = _cacheGet(`skin_${uid}`, 60_000);
  if (cached) return cached;
  try {
    return await _db(async () => {
      const snap = await db.ref(_skin(uid)).get();
      const result = snap.exists()
        ? { eq: snap.val().eq || 'default', own: snap.val().own || { default: true } }
        : { eq: 'default', own: { default: true } };
      _cacheSet(`skin_${uid}`, result);
      return result;
    });
  } catch { return { eq: 'default', own: { default: true } }; }
}

async function equipSkin(uid, skinId) {
  _cacheInvalidate(`skin_${uid}`);
  await _db(() => db.ref(`${_skin(uid)}/eq`).set(skinId));
}

async function unlockSkin(uid, skinId) {
  _cacheInvalidate(`skin_${uid}`);
  await _db(() => db.ref(`${_skin(uid)}/own/${skinId}`).set(true));
}

// ── Level times ──
async function saveLevelTime(uid, levelNum, seconds) {
  try {
    return await _db(async () => {
      const levelRef = db.ref(_lvl(uid, levelNum));
      const snap = await levelRef.get();
      const t    = Math.round(seconds * 1000) / 1000;
      const prev = snap.exists() ? snap.val().t : null;
      const isRecord = prev === null || t < prev;
      if (isRecord) {
        await levelRef.update({ t, ts: Date.now() });
        // Update local times cache too so getMyTimes doesn't re-fetch
        const timesKey = `times_${uid}`;
        const cachedTimes = _cacheGet(timesKey, Infinity) || {};
        cachedTimes[`L${levelNum}`] = { t, ts: Date.now() };
        _cacheSet(timesKey, cachedTimes);
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
  const cached = _cacheGet(`times_${uid}`, 60_000);
  if (cached) return cached;
  try {
    return await _db(async () => {
      const snap = await db.ref(`users/${uid}/G/CP/L`).get();
      const val  = snap.exists() ? snap.val() : {};
      _cacheSet(`times_${uid}`, val);
      return val;
    });
  } catch { return {}; }
}

// ── Leaderboard — cache aggressively (2 min), no live listener needed ──
async function getLeaderboard(levelNum) {
  const key = `lb_${levelNum}`;
  const cached = _cacheGet(key, 120_000);
  if (cached) return cached;
  try {
    return await _db(async () => {
      const snap = await db.ref('users').get();
      if (!snap.exists()) return [];
      const rows = [];
      snap.forEach(userSnap => {
        const ld = userSnap.child(`G/CP/L/L${levelNum}`).val();
        if (ld && typeof ld.t === 'number') {
          rows.push({
            uid:   userSnap.key,
            name:  userSnap.child('name').val()  || 'Anonymous',
            photo: userSnap.child('photo').val() || '',
            t:     ld.t,
            ts:    ld.ts || 0
          });
        }
      });
      const sorted = rows.sort((a, b) => a.t - b.t);
      _cacheSet(key, sorted);
      return sorted;
    });
  } catch (e) {
    console.error('[FB] getLeaderboard:', e.message);
    return [];
  }
}

window.FB = {
  signInGoogle,
  signOut:    logOut,
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

console.log('[FB] Compat SDK loaded ✓');