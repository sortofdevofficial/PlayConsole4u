if (typeof firebase === 'undefined') throw new Error('[FB] Load Firebase compat SDK scripts before firebase.js');

if (!firebase.apps.length) firebase.initializeApp({
  apiKey: "AIzaSyC_fNfUQUcdhicNNx-e0weEGURbz-mZs8g",
  authDomain: "playconsole4u.firebaseapp.com",
  databaseURL: "https://playconsole4u-default-rtdb.firebaseio.com",
  projectId: "playconsole4u",
  storageBucket: "playconsole4u.firebasestorage.app",
  messagingSenderId: "383598421108",
  appId: "1:383598421108:web:12767cf3738cef9d8a9d21",
  measurementId: "G-FFXMD1550D"
});

const auth = firebase.auth();
const db = firebase.database();

const _user = uid => `users/${uid}`;
const _lvl = (uid, n) => `users/${uid}/G/CP/L/L${n}`;
const _skin = uid => `users/${uid}/G/CP/C/S`;

const signInGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut = () => auth.signOut();
const currentUser = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async user => {
    if (user) await _ensureDefaults(user);
    cb(user);
  });
}

async function _ensureDefaults(user) {
  try {
    const snap = await db.ref(_user(user.uid)).get();
    const val = snap.exists() ? (snap.val() || {}) : {};
    const up = {};
    if (!val.name) up.name = user.displayName || 'Anonymous';
    if (!val.photo && user.photoURL) up.photo = user.photoURL;
    if (!val.G?.CP?.C?.S?.eq) up['G/CP/C/S/eq'] = 'default';
    if (!val.G?.CP?.C?.S?.own?.default) up['G/CP/C/S/own/default'] = true;
    if (Object.keys(up).length) await db.ref(_user(user.uid)).update(up);
  } catch (e) {
    console.warn('[FB] _ensureDefaults:', e.message);
  }
}

async function getProfile(uid) {
  try {
    const s = await db.ref(_user(uid)).get();
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) {
    console.warn('[FB] getProfile:', e.message);
    return {};
  }
}

async function saveProfile(uid, name, photo) {
  const u = {};
  if (name != null) u.name = name;
  if (photo != null) u.photo = photo;
  await db.ref(_user(uid)).update(u);
}

async function getSkinData(uid) {
  try {
    const s = await db.ref(_skin(uid)).get();
    if (!s.exists()) return { eq: 'default', own: { default: true } };
    const v = s.val() || {};
    return { eq: v.eq || 'default', own: v.own || { default: true } };
  } catch {
    return { eq: 'default', own: { default: true } };
  }
}

async function equipSkin(uid, skinId) {
  await db.ref(`${_skin(uid)}/eq`).set(skinId);
}

async function unlockSkin(uid, skinId) {
  await db.ref(`${_skin(uid)}/own/${skinId}`).set(true);
}

async function saveLevelTime(uid, levelNum, seconds) {
  try {
    const snap = await db.ref(_lvl(uid, levelNum)).get();
    const t = Math.round(seconds * 1000) / 1000;
    const prev = snap.exists() ? snap.val().t : null;
    const isRecord = prev === null || t < prev;

    if (isRecord) {
      const profile = await getProfile(uid);
      const name = profile.name || currentUser()?.displayName || 'Anonymous';
      const photo = profile.photo || currentUser()?.photoURL || '';
      const ts = Date.now();

      await db.ref().update({
        [_lvl(uid, levelNum)]: { t, ts }
      });

      const UNLOCKS = { 2:'ghost', 4:'neon', 6:'fire', 8:'void', 10:'rainbow' };
      if (UNLOCKS[levelNum]) unlockSkin(uid, UNLOCKS[levelNum]).catch(() => {});
    }

    return { saved: isRecord, isRecord, prev };
  } catch (e) {
    console.error('[FB] saveLevelTime FAILED:', e.code, e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

async function getMyTimes(uid) {
  try {
    const s = await db.ref(`users/${uid}/G/CP/L`).get();
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) {
    console.warn('[FB] getMyTimes:', e.message);
    return {};
  }
}

async function getLeaderboard(levelNum) {
  try {
    const usersSnap = await db.ref('users').get();
    if (!usersSnap.exists()) return [];

    const rows = [];
    usersSnap.forEach(userSnap => {
      const uid = userSnap.key;
      const v = userSnap.child(`G/CP/L/L${levelNum}`).val();
      if (v && typeof v.t === 'number') {
        rows.push({
          uid,
          name: userSnap.child('name').val() || 'Anonymous',
          photo: userSnap.child('photo').val() || '',
          t: v.t,
          ts: v.ts || 0
        });
      }
    });

    rows.sort((a, b) => a.t - b.t);
    return rows;
  } catch (e) {
    console.error('[FB] getLeaderboard:', e.message);
    return [];
  }
}

window.FB = {
  signInGoogle,
  signOut,
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

console.log('[FB] loaded ✓ users-only, no root LB');