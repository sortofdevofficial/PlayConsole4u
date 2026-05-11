import * as firebaseModule from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js";

// The CDN "compat" library exports the actual firebase object as 'default'
const firebase = firebaseModule.default;

const firebaseConfig = {
  apiKey: "AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8",
  authDomain: "playconsole4u-53a6a.firebaseapp.com",
  databaseURL: "https://playconsole4u-53a6a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "playconsole4u-53a6a",
  storageBucket: "playconsole4u-53a6a.firebasestorage.app",
  messagingSenderId: "306379034842",
  appId: "1:306379034842:web:1b891d0ef20cdacb0a55e3",
  measurementId: "G-NZ50CHHLFX"
};

// INITIALIZE
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

// EXPOSE TO WINDOW
window.FB = {
  signInGoogle: () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider);
  },
  signOut: () => auth.signOut(),
  onAuthChange: (cb) => {
    auth.onAuthStateChanged(async (user) => {
      // If you have a private function _ensureDefaults, keep it, otherwise remove the line below
      if (user && typeof _ensureDefaults === 'function') await _ensureDefaults(user);
      cb(user);
    });
  },
  currentUser: () => auth.currentUser,
  getProfile: (uid) => db.ref(`users/${uid}`).get().then(s => s.val() || {}),
  getMyTimes: (uid) => db.ref(`users/${uid}/G/CP/L`).get().then(s => s.val() || {}),
  saveProfile: (uid, name) => db.ref(`users/${uid}`).update({ name })
};
// 4. PATH HELPERS
const _user = uid => `users/${uid}`;
const _lvl  = (uid, n) => `users/${uid}/G/CP/L/L${n}`;
const _skin = uid => `users/${uid}/G/CP/C/S`;

// 5. AUTH FUNCTIONS (Switched to Popup for GitHub Pages stability)
const signInGoogle = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  return auth.signInWithPopup(provider)
    .catch(e => console.error('[FB] Popup Error:', e.message));
};

const logOut      = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await _ensureDefaults(user);
    }
    cb(user);
  });
}

// 6. DATA LOGIC
async function _ensureDefaults(user) {
  try {
    const userRef = db.ref(_user(user.uid));
    const snap = await userRef.get();
    const val  = snap.exists() ? snap.val() : {};
    const up   = {};

    if (!val.name)                  up.name = user.displayName || 'Anonymous';
    if (!val.photo && user.photoURL) up.photo = user.photoURL;
    if (!val.G?.CP?.C?.S?.eq)       up['G/CP/C/S/eq'] = 'default';
    if (!val.G?.CP?.C?.S?.own?.default) up['G/CP/C/S/own/default'] = true;

    if (Object.keys(up).length) await userRef.update(up);
  } catch (e) {
    console.warn('[FB] _ensureDefaults:', e.message);
  }
}

async function getProfile(uid) {
  try {
    const snap = await db.ref(_user(uid)).get();
    return snap.exists() ? snap.val() : {};
  } catch (e) {
    console.warn('[FB] getProfile:', e.message);
    return {};
  }
}

async function saveProfile(uid, name, photo) {
  const up = {};
  if (name  != null) up.name  = name;
  if (photo != null) up.photo = photo;
  await db.ref(_user(uid)).update(up);
}

async function getSkinData(uid) {
  try {
    const snap = await db.ref(_skin(uid)).get();
    if (!snap.exists()) return { eq: 'default', own: { default: true } };
    const v = snap.val();
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
    const levelRef = db.ref(_lvl(uid, levelNum));
    const snap = await levelRef.get();
    const t    = Math.round(seconds * 1000) / 1000;
    const prev = snap.exists() ? snap.val().t : null;
    const isRecord = prev === null || t < prev;

    if (isRecord) {
      await levelRef.update({ t, ts: Date.now() });
      const UNLOCKS = { 2:'ghost', 4:'neon', 6:'fire', 8:'void', 10:'rainbow' };
      if (UNLOCKS[levelNum]) await unlockSkin(uid, UNLOCKS[levelNum]);
    }

    return { saved: isRecord, isRecord, prev };
  } catch (e) {
    console.error('[FB] saveLevelTime FAILED:', e.code, e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

async function getMyTimes(uid) {
  try {
    const snap = await db.ref(`users/${uid}/G/CP/L`).get();
    return snap.exists() ? snap.val() : {};
  } catch (e) {
    console.warn('[FB] getMyTimes:', e.message);
    return {};
  }
}

async function getLeaderboard(levelNum) {
  try {
    const snap = await db.ref('users').get();
    if (!snap.exists()) return [];

    const rows = [];
    snap.forEach(userSnap => {
      const levelData = userSnap.child(`G/CP/L/L${levelNum}`).val();
      if (levelData && typeof levelData.t === 'number') {
        rows.push({
          uid:   userSnap.key,
          name:  userSnap.child('name').val()  || 'Anonymous',
          photo: userSnap.child('photo').val() || '',
          t:     levelData.t,
          ts:    levelData.ts || 0
        });
      }
    });

    return rows.sort((a, b) => a.t - b.t);
  } catch (e) {
    console.error('[FB] getLeaderboard:', e.message);
    return [];
  }
}

// 7. EXPOSE TO WINDOW
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

console.log('[FB] Compat SDK Loaded Correctly ✓');