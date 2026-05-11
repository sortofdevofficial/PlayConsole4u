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
const db = firebase.database();

const _user = uid => `users/${uid}`;
const _lvl  = (uid, n) => `users/${uid}/G/CP/L/L${n}`;
const _skin = uid => `users/${uid}/G/CP/C/S`;

const signInGoogle = () => auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
const logOut       = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.getRedirectResult().then(result => {
    if (result && result.user) {
      console.log('[FB] Signed in:', result.user.displayName);
    }
  }).catch(e => {
    console.warn('[FB] getRedirectResult:', e.message);
  }).finally(() => {
    auth.onAuthStateChanged(async (user) => {
      if (user) await _ensureDefaults(user);
      cb(user);
    });
  });
}

async function _ensureDefaults(user) {
  try {
    const userRef = db.ref(_user(user.uid));
    const snap = await userRef.get();
    const val  = snap.exists() ? snap.val() : {};
    const up   = {};
    if (!val.name)                       up.name = user.displayName || 'Anonymous';
    if (!val.photo && user.photoURL)     up.photo = user.photoURL;
    if (!val.G?.CP?.C?.S?.eq)           up['G/CP/C/S/eq'] = 'default';
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
  } catch (e) { return {}; }
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
  } catch { return { eq: 'default', own: { default: true } }; }
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
    console.error('[FB] saveLevelTime:', e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

async function getMyTimes(uid) {
  try {
    const snap = await db.ref(`users/${uid}/G/CP/L`).get();
    return snap.exists() ? snap.val() : {};
  } catch (e) { return {}; }
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