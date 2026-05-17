// firebase.js — Firestore
//
// Path structure:
//   users/{uid}                     → { n, e, ph }        name, email, photo
//   users/{uid}/G/CP/L/{ver}/{n}   → { t, ts, lp, uk }   level data
//
//   t  = best time (float, seconds)
//   ts = unix ms when best time was set
//   lp = unix ms last played
//   uk = unlocked (bool)
//
//   {ver} = game version string e.g. "1"
//   {n}   = level number string "1" … "5"
//
// Network is disabled on load. Enabled per-operation, auto-off 1.5s after last op.
// In-memory cache prevents duplicate reads within same session.

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

const VER = "1"; // bump when releasing a new game version

// ── Lazy network ──
db.disableNetwork();
let _on = false, _ops = 0, _t = null;
function _up(){
  if(_t){clearTimeout(_t);_t=null;}
  if(!_on){db.enableNetwork();_on=true;}
  _ops++;
}
function _dn(){
  _ops=Math.max(0,_ops-1);
  if(_ops===0){
    _t=setTimeout(()=>{db.disableNetwork();_on=false;_t=null;},1500);
  }
}
async function _go(fn){_up();try{return await fn();}finally{_dn();}}

// ── Cache ──
const _c={};
const cSet=(k,v,ttl=60000)=>{_c[k]={v,x:Date.now()+ttl};};
const cGet=(k)=>{const e=_c[k];return e&&Date.now()<e.x?e.v:null;};
const cDel=(k)=>{delete _c[k];};

// ── Refs ──
// User root doc
const uRef = uid => db.collection('users').doc(uid);

// Level doc: users/{uid}/G/CP/L/{ver}/{n}
// The path has 3 collection/doc pairs under users/{uid}:
//   collection('G') → doc('CP') → collection('L') → doc(ver) → collection(n) ← NO, we want doc
// Firestore alternates collection/doc. To get to users/{uid}/G/CP/L/{ver}/{n}:
//   users/{uid}  → .collection('G').doc('CP').collection('L').doc(ver).collection('levels').doc(n)
// BUT the requirement is NO extra named collection inside ver —
// levels 1-5 should sit DIRECTLY inside the ver doc as FIELDS (not subcollections).
// So we store all 5 levels as fields on ONE doc: users/{uid}/G/CP/L/{ver}
// Field names: "1","2","3","4","5"  each = { t, ts, lp, uk }
const verRef = uid => uRef(uid).collection('G').doc('CP').collection('L').doc(VER);

// ── Auth ──
const signInGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const logOut       = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb){
  auth.onAuthStateChanged(async user=>{
    if(user){
      cDel('p_'+user.uid);
      cDel('t_'+user.uid);
      await _ensureUser(user);
    }
    cb(user);
  });
}

async function _ensureUser(user){
  try{
    await _go(async()=>{
      const snap=await uRef(user.uid).get();
      const d=snap.exists?snap.data():{};
      const up={};
      if(!d.n)  up.n  = user.displayName||'Anonymous';
      if(!d.e)  up.e  = user.email||'';
      if(!d.ph&&user.photoURL) up.ph=user.photoURL;
      if(Object.keys(up).length){
        await uRef(user.uid).set(up,{merge:true});
        cSet('p_'+user.uid,{...d,...up});
      }else{
        cSet('p_'+user.uid,d);
      }
    });
  }catch(e){console.warn('[FB]',e.message);}
}

// ── Profile ──
async function getProfile(uid){
  const hit=cGet('p_'+uid);
  if(hit)return hit;
  try{
    return await _go(async()=>{
      const s=await uRef(uid).get();
      const v=s.exists?s.data():{};
      cSet('p_'+uid,v);
      return v;
    });
  }catch{return {};}
}

async function saveProfile(uid,name){
  cDel('p_'+uid);
  await _go(()=>uRef(uid).set({n:name},{merge:true}));
}

// ── Level times ──
// All levels stored as fields on ONE doc: users/{uid}/G/CP/L/{ver}
// e.g. { "1": {t,ts,lp,uk}, "2": {t,ts,lp,uk}, ... }

async function saveLevelTime(uid,lvlNum,secs){
  try{
    return await _go(async()=>{
      const ref  = verRef(uid);
      const snap = await ref.get();
      const all  = snap.exists?snap.data():{};
      const prev = all[String(lvlNum)]?.t??null;
      const t    = Math.round(secs*1000)/1000;
      const isRecord = prev===null||t<prev;
      const now  = Date.now();
      const field= String(lvlNum);
      const cur  = all[field]||{};
      const update={};
      update[field]={...cur, lp:now, uk:true};
      if(isRecord){update[field].t=t;update[field].ts=now;}
      await ref.set(update,{merge:true});
      // update cache
      const tk='t_'+uid;
      const ct=cGet(tk)||{};
      ct[field]=update[field];
      cSet(tk,ct);
      return {saved:true,isRecord,prev};
    });
  }catch(e){
    console.error('[FB] saveLevelTime:',e.message);
    return {saved:false,isRecord:false,prev:null};
  }
}

// Returns { "1":{t,ts,lp,uk}, "2":..., ... }
async function getMyTimes(uid){
  const hit=cGet('t_'+uid);
  if(hit)return hit;
  try{
    return await _go(async()=>{
      const snap=await verRef(uid).get();
      const v=snap.exists?snap.data():{};
      cSet('t_'+uid,v);
      return v;
    });
  }catch{return {};}
}

// Unlock a level (writes uk:true if not already set)
async function unlockLevel(uid,lvlNum){
  try{
    const tk='t_'+uid;
    const ct=cGet(tk)||{};
    const f=String(lvlNum);
    if(ct[f]?.uk)return; // already unlocked in cache
    await _go(async()=>{
      const update={};
      update[f]={...(ct[f]||{}),uk:true};
      await verRef(uid).set(update,{merge:true});
      ct[f]=update[f];
      cSet(tk,ct);
    });
  }catch(e){console.warn('[FB] unlockLevel:',e.message);}
}

// ── Leaderboard ──
// Scans all users, reads each user's ver doc (single read per user), builds top 100.
// 2-min cache.
async function getLeaderboard(lvlNum){
  const key='lb_'+lvlNum;
  const hit=cGet(key);
  if(hit)return hit;
  try{
    return await _go(async()=>{
      const users=await db.collection('users').get();
      const rows=[];
      await Promise.all(users.docs.map(ud=>
        verRef(ud.id).get()
          .then(vs=>{
            if(vs.exists){
              const ld=vs.data()[String(lvlNum)];
              if(ld?.t!=null){
                rows.push({uid:ud.id,name:ud.data().n||'Anonymous',t:ld.t,ts:ld.ts||0});
              }
            }
          })
          .catch(()=>{})
      ));
      const sorted=rows.sort((a,b)=>a.t-b.t).slice(0,100);
      cSet(key,sorted,120000);
      return sorted;
    });
  }catch(e){console.error('[FB] getLeaderboard:',e.message);return [];}
}

window.FB={signInGoogle,signOut:logOut,onAuthChange,currentUser,getProfile,saveProfile,saveLevelTime,getMyTimes,unlockLevel,getLeaderboard,VER};
console.log('[FB] ready ver='+VER);