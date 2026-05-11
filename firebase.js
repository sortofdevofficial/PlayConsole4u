import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getDatabase, 
  ref, 
  get, 
  update, 
  set, 
  child 
} from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC_fNfUQUcdhicNNx-e0weEGURbz-mZs8g",
  authDomain: "playconsole4u.firebaseapp.com",
  databaseURL: "https://playconsole4u-default-rtdb.firebaseio.com",
  projectId: "playconsole4u",
  storageBucket: "playconsole4u.firebasestorage.app",
  messagingSenderId: "383598421108",
  appId: "1:383598421108:web:12767cf3738cef9d8a9d21",
  measurementId: "G-FFXMD1550D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Path Helpers
const _user = uid => `users/${uid}`;
const _lvl = (uid, n) => `users/${uid}/G/CP/L/L${n}`;
const _skin = uid => `users/${uid}/G/CP/C/S`;

// Auth Functions
const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
const logOut = () => signOut(auth);
const currentUser = () => auth.currentUser;

function onAuthChange(cb) {
  onAuthStateChanged(auth, async (user) => {
    if (user) await _ensureDefaults(user);
    cb(user);
  });
}

async function _ensureDefaults(user) {
  try {
    const userRef = ref(db, _user(user.uid));
    const snap = await get(userRef);
    const val = snap.exists() ? snap.val() : {};
    
    const up = {};
    if (!val.name) up.name = user.displayName || 'Anonymous';
    if (!val.photo && user.photoURL) up.photo = user.photoURL;
    if (!val.G?.CP?.C?.S?.eq) up['G/CP/C/S/eq'] = 'default';
    if (!val.G?.CP?.C?.S?.own?.default) up['G/CP/C/S/own/default'] = true;

    if (Object.keys(up).length) await update(userRef, up);
  } catch (e) {
    console.warn('[FB] _ensureDefaults:', e.message);
  }
}

// Data Functions
async function getProfile(uid) {
  try {
    const snap = await get(ref(db, _user(uid)));
    return snap.exists() ? snap.val() : {};
  } catch (e) {
    console.warn('[FB] getProfile:', e.message);
    return {};
  }
}

async function saveProfile(uid, name, photo) {
  const up = {};
  if (name != null) up.name = name;
  if (photo != null) up.photo = photo;
  await update(ref(db, _user(uid)), up);
}

async function getSkinData(uid) {
  try {
    const snap = await get(ref(db, _skin(uid)));
    if (!snap.exists()) return { eq: 'default', own: { default: true } };
    const v = snap.val();
    return { eq: v.eq || 'default', own: v.own || { default: true } };
  } catch {
    return { eq: 'default', own: { default: true } };
  }
}

async function equipSkin(uid, skinId) {
  await set(ref(db, `${_skin(uid)}/eq`), skinId);
}

async function unlockSkin(uid, skinId) {
  await set(ref(db, `${_skin(uid)}/own/${skinId}`), true);
}

async function saveLevelTime(uid, levelNum, seconds) {
  try {
    const levelRef = ref(db, _lvl(uid, levelNum));
    const snap = await get(levelRef);
    const t = Math.round(seconds * 1000) / 1000;
    const prev = snap.exists() ? snap.val().t : null;
    const isRecord = prev === null || t < prev;

    if (isRecord) {
      const ts = Date.now();
      await update(levelRef, { t, ts });

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
    const snap = await get(ref(db, `users/${uid}/G/CP/L`));
    return snap.exists() ? snap.val() : {};
  } catch (e) {
    console.warn('[FB] getMyTimes:', e.message);
    return {};
  }
}

async function getLeaderboard(levelNum) {
  try {
    const snap = await get(ref(db, 'users'));
    if (!snap.exists()) return [];

    const rows = [];
    snap.forEach(userSnap => {
      const uid = userSnap.key;
      const levelData = userSnap.child(`G/CP/L/L${levelNum}`).val();
      if (levelData && typeof levelData.t === 'number') {
        rows.push({
          uid,
          name: userSnap.child('name').val() || 'Anonymous',
          photo: userSnap.child('photo').val() || '',
          t: levelData.t,
          ts: levelData.ts || 0
        });
      }
    });

    return rows.sort((a, b) => a.t - b.t);
  } catch (e) {
    console.error('[FB] getLeaderboard:', e.message);
    return [];
  }
}

// Global Export for legacy scripts
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

console.log('[FB] Modular SDK loaded ✓');