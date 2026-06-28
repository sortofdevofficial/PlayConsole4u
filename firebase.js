// firebase.js v3.2 - Ultra-Fast Optimistic Caching Edition
// users/{uid}                     → { n, e, ph }
// users/{uid}/G/CP/L/{VER}        → CubePlatformer times
// users/{uid}/G/FS                → { w, l, k, h, s }  
// users/{uid}/G/CC                → { w, l, k, h, s, likes }  (Camo Chameleon specific)
// users/{uid}/G/CC/Likes/{vUid}   → { t, by } (Who liked them and when)
// users/{uid}/subscription        → { active, FTL, plan, start, next, activatedBy }

firebase.initializeApp({
  apiKey:'AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8',
  authDomain:'playconsole4u-53a6a.firebaseapp.com',
  projectId:'playconsole4u-53a6a',
  storageBucket:'playconsole4u-53a6a.firebasestorage.app',
  messagingSenderId:'306379034842',
  appId:'1:306379034842:web:1b891d0ef20cdacb0a55e3'
});

const _a = firebase.auth();
const _d = firebase.firestore();
const VER = '3.2';

// ── Cache ──────────────────────────────────────────────────────────────────────
const _c = {};
const cS = (k,v,ttl=60000) => { _c[k]={v,x:Date.now()+ttl}; };
const cG = k => { const e=_c[k]; return e&&Date.now()<e.x?e.v:null; };
const cD = k => { delete _c[k]; };

// ── Refs ───────────────────────────────────────────────────────────────────────
const uRef  = uid => _d.collection('users').doc(uid);
const lRef  = uid => uRef(uid).collection('G').doc('CP').collection('L').doc('1');
const fsRef = uid => uRef(uid).collection('G').doc('FS');
const ccRef = uid => uRef(uid).collection('G').doc('CC');
const subRef= uid => uRef(uid).collection('subscription').doc('info');

// ── Auth ───────────────────────────────────────────────────────────────────────
const signInGoogle = () => _a.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut      = () => _a.signOut();
const currentUser  = () => _a.currentUser;

function onAuthChange(cb) {
  _a.onAuthStateChanged(async user => {
    if (user) { cD('p_'+user.uid); await _ensureUser(user); }
    cb(user);
  });
}

async function _ensureUser(u) {
  try {
    const snap = await uRef(u.uid).get();
    const d = snap.exists ? snap.data() : {};
    const up = {};
    if (!d.n) up.n = u.displayName||'Anonymous';
    if (!d.e) up.e = u.email||'';
    if (!d.ph&&u.photoURL) up.ph = u.photoURL;
    if (Object.keys(up).length) {
      await uRef(u.uid).set(up,{merge:true});
      cS('p_'+u.uid,{...d,...up});
    } else { cS('p_'+u.uid,d); }
  } catch(e) { console.warn('[FB] ensureUser:',e.message); }
}

async function getProfile(uid) {
  const h=cG('p_'+uid); if(h) return h;
  try { const s=await uRef(uid).get(); const v=s.exists?s.data():{}; cS('p_'+uid,v); return v; } catch { return {}; }
}

async function saveProfile(uid,name) {
  const key = 'p_'+uid;
  const current = cG(key) || {};
  current.n = name;
  cS(key, current, 60000); // Instant local cache update
  
  try {
    await uRef(uid).set({n:name},{merge:true});
  } catch(e) {
    cD(key); // Rollback on failure
    console.error('[FB] saveProfile failed:', e.message);
  }
}

// ── Subscription ──────────────────────────────────────────────────────────────
async function getSubscription(uid) {
  const h=cG('sub_'+uid); if(h) return h;
  try {
    const s=await subRef(uid).get();
    const v=s.exists?s.data():{ active:false };
    cS('sub_'+uid,v,30000);
    return v;
  } catch { return { active:false }; }
}

async function activateLite(uid) {
  cD('sub_'+uid);
  const existing = await getSubscription(uid);
  const isFirstTime = !existing.FTL;
  const now = Date.now();
  const data = {
    active: true, plan: 'lite', FTL: true,
    firstActivated: existing.firstActivated || now,
    start: now, next: now + 30*24*60*60*1000,
    activatedBy: 'admin', price: isFirstTime ? 39 : 49,
  };
  cS('sub_'+uid, data, 30000); // Cache instantly
  await subRef(uid).set(data, {merge:true});
  console.log('[FB] Lite activated for', uid, isFirstTime?'(₹39 first time)':'(₹49 renewal)');
  return data;
}

async function deactivateLite(uid) {
  const data = { active: false };
  cS('sub_'+uid, data, 30000);
  await subRef(uid).set(data, {merge:true});
}

async function isLiteActive(uid) {
  const sub = await getSubscription(uid);
  return sub.active === true;
}

// ── CubePlatformer ────────────────────────────────────────────────────────────
async function saveLevelTime(uid,lvl,secs) {
  try {
    const ref=lRef(uid);
    const snap=await ref.get();
    const all=snap.exists?snap.data():{};
    const f=String(lvl);
    const prev=all[f]?.t??null;
    const t=Math.round(secs*1000)/1000;
    const rec=prev===null||t<prev;
    const now=Date.now();
    const upd={};
    upd[f]={...(all[f]||{}),lp:now,uk:true};
    if(rec){upd[f].t=t;upd[f].ts=now;}
    
    // Save locally to cache instantly before awaiting database
    const ct=cG('t_'+uid)||{}; ct[f]=upd[f]; cS('t_'+uid,ct);
    
    await ref.set(upd,{merge:true});
    return {saved:true,isRecord:rec,prev};
  } catch(e){console.error('[FB] saveLevelTime:',e.message);return{saved:false,isRecord:false,prev:null};}
}

async function getMyTimes(uid) {
  const h=cG('t_'+uid);if(h)return h;
  try{const s=await lRef(uid).get();const v=s.exists?s.data():{};cS('t_'+uid,v);return v;}catch{return{};}
}

async function unlockLevel(uid,lvl) {
  try{
    const tk='t_'+uid,ct=cG(tk)||{},f=String(lvl);
    if(ct[f]?.uk)return;
    const u={};u[f]={...(ct[f]||{}),uk:true};
    ct[f]=u[f]; cS(tk,ct); // Instant cache write
    await lRef(uid).set(u,{merge:true});
  }catch(e){console.warn('[FB] unlockLevel:',e.message);}
}

// ── FloppySticks W/L ──────────────────────────────────────────────────────────
async function recordMatch(uid,won) {
  const key = 'fs_'+uid;
  const current = cG(key) || { w: 0, l: 0 };
  if(won) current.w++; else current.l++;
  cS(key, current, 60000); // Optimistic UI update

  const INC=firebase.firestore.FieldValue.increment;
  try{
    await fsRef(uid).set(won?{w:INC(1),l:INC(0)}:{w:INC(0),l:INC(1)},{merge:true});
  }catch(e){
    cD(key); // Evict cache on failure
    console.error('[FB] recordMatch:',e.message);
    throw e;
  }
}

async function getMatchStats(uid) {
  const h = cG('fs_'+uid); if(h) return h;
  try{
    const s=await fsRef(uid).get();
    const v=s.exists?s.data():{};
    const stats = {w:v.w||0,l:v.l||0};
    cS('fs_'+uid, stats, 60000);
    return stats;
  } catch(e){
    console.warn('[FB] getMatchStats:',e.message);
    return {w:0,l:0};
  }
}

// ── Camo Chameleon Stats & Likes (G/CC) ───────────────────────────────────────
async function recordRound(uid,{won,kills=0,role}){
  const key = 'cc_'+uid;
  const current = cG(key) || {w:0,l:0,k:0,h:0,s:0,likes:0};
  
  // Optimistically speed up visual updates locally
  if(won) current.w++; else current.l++;
  current.k += kills;
  if(role==='hunter') current.h++;
  if(role==='seeker') current.s++;
  cS(key, current, 60000);

  const INC=firebase.firestore.FieldValue.increment;
  const upd={
    w:INC(won?1:0), l:INC(!won?1:0),
    k:INC(kills), h:INC(role==='hunter'?1:0), s:INC(role==='seeker'?1:0),
  };
  try{
    await ccRef(uid).set(upd,{merge:true});
  }catch(e){
    cD(key); // clear bad cache if network fails
    console.error('[FB] recordRound:',e.message);
    throw e;
  }
}

async function getStats(uid){
  const h=cG('cc_'+uid); if(h) return h;
  try{
    const s=await ccRef(uid).get();
    const v=s.exists?s.data():{};
    const statsData = {w:v.w||0,l:v.l||0,k:v.k||0,h:v.h||0,s:v.s||0,likes:v.likes||0};
    cS('cc_'+uid, statsData, 30000); // 30-second cache hit speed
    return statsData;
  } catch(e){
    console.warn('[FB] getStats:',e.message);
    return {w:0,l:0,k:0,h:0,s:0,likes:0};
  }
}

async function likePlayer(targetUid) {
  const me = currentUser();
  if (!me || me.uid === targetUid) return false;
  
  try {
    const likeDoc = ccRef(targetUid).collection('Likes').doc(me.uid);
    const snap = await likeDoc.get();
    if (snap.exists) return false; 
    
    // Update local cache data structure immediately so UI reflects the honor like
    const targetKey = 'cc_'+targetUid;
    const currentTargetStats = cG(targetKey);
    if(currentTargetStats) {
      currentTargetStats.likes++;
      cS(targetKey, currentTargetStats, 30000);
    }
    
    await likeDoc.set({ by: me.uid, t: Date.now() });
    await ccRef(targetUid).set({ likes: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    return true;
  } catch (e) {
    cD('cc_'+targetUid);
    console.error("[FB] Error liking player:", e.message);
    return false;
  }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
async function getLeaderboard(lvl) {
  const key='lb_'+lvl,h=cG(key);if(h)return h;
  try{
    const users=await _d.collection('users').get(),rows=[];
    await Promise.all(users.docs.map(d=>
      lRef(d.id).get().then(s=>{
        if(s.exists){const ld=s.data()[String(lvl)];if(ld?.t!=null)rows.push({uid:d.id,name:d.data().n||'Anonymous',t:ld.t,ts:ld.ts||0});}
      }).catch(()=>{})
    ));
    const sorted=rows.sort((a,b)=>a.t-b.t).slice(0,100);
    cS(key,sorted,120000);return sorted;
  }catch(e){console.error('[FB] getLeaderboard:',e.message);return[];}
}

window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  getProfile, saveProfile,
  getSubscription, activateLite, deactivateLite, isLiteActive,
  saveLevelTime, getMyTimes, unlockLevel,
  recordMatch, getMatchStats,
  recordRound, getStats, likePlayer,
  getLeaderboard, VER
};
console.log('[FB] ready v'+VER);