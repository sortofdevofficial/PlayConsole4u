// firebase.js v1.3
// users/{uid}              → { n, e, ph }
// users/{uid}/G/CP/L/{VER} → { "1":{t,ts,lp,uk}, … }
// users/{uid}/G/FS         → { w, l }

firebase.initializeApp({
  apiKey:            "AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8",
  authDomain:        "playconsole4u-53a6a.firebaseapp.com",
  projectId:         "playconsole4u-53a6a",
  storageBucket:     "playconsole4u-53a6a.firebasestorage.app",
  messagingSenderId: "306379034842",
  appId:             "1:306379034842:web:1b891d0ef20cdacb0a55e3",
  measurementId:     "G-NZ50CHHLFX",
});

const _auth = firebase.auth();
const _db   = firebase.firestore();
const VER   = "1";

// ── Lazy network ──────────────────────────────────────────────────────────
_db.disableNetwork();
let _on=false,_ops=0,_ot=null;
function _up(){if(_ot){clearTimeout(_ot);_ot=null;}if(!_on){_db.enableNetwork();_on=true;}_ops++;}
function _dn(){_ops=Math.max(0,_ops-1);if(!_ops){_ot=setTimeout(()=>{_db.disableNetwork();_on=false;_ot=null;},1500);}}
async function _go(fn){_up();try{return await fn();}finally{_dn();}}

// ── Cache ─────────────────────────────────────────────────────────────────
const _c={};
const cSet=(k,v,ttl=60000)=>{_c[k]={v,x:Date.now()+ttl};};
const cGet=k=>{const e=_c[k];return e&&Date.now()<e.x?e.v:null;};
const cDel=k=>{delete _c[k];};

// ── Refs ──────────────────────────────────────────────────────────────────
const uRef   = uid=>_db.collection('users').doc(uid);
const verRef = uid=>uRef(uid).collection('G').doc('CP').collection('L').doc(VER);
const fsRef  = uid=>uRef(uid).collection('G').doc('FS');

// ── Auth ──────────────────────────────────────────────────────────────────
const signInGoogle = ()=>_auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut      = ()=>_auth.signOut();
const currentUser  = ()=>_auth.currentUser;

function onAuthChange(cb){
  _auth.onAuthStateChanged(async user=>{
    if(user){cDel('p_'+user.uid);await _ensureUser(user);}
    cb(user);
  });
}

async function _ensureUser(u){
  try{
    await _go(async()=>{
      const snap=await uRef(u.uid).get();
      const d=snap.exists?snap.data():{};
      const up={};
      if(!d.n)up.n=u.displayName||'Anonymous';
      if(!d.e)up.e=u.email||'';
      if(!d.ph&&u.photoURL)up.ph=u.photoURL;
      if(Object.keys(up).length){await uRef(u.uid).set(up,{merge:true});cSet('p_'+u.uid,{...d,...up});}
      else cSet('p_'+u.uid,d);
    });
  }catch(e){console.warn('[FB]',e.message);}
}

// ── Profile ───────────────────────────────────────────────────────────────
async function getProfile(uid){
  const h=cGet('p_'+uid);if(h)return h;
  try{return await _go(async()=>{const s=await uRef(uid).get();const v=s.exists?s.data():{};cSet('p_'+uid,v);return v;});}
  catch{return{};}
}
async function saveProfile(uid,name){
  cDel('p_'+uid);
  await _go(()=>uRef(uid).set({n:name},{merge:true}));
}

// ── CP Level times ────────────────────────────────────────────────────────
async function saveLevelTime(uid,lvl,secs){
  try{
    return await _go(async()=>{
      const ref=verRef(uid),snap=await ref.get(),all=snap.exists?snap.data():{};
      const prev=all[String(lvl)]?.t??null;
      const t=Math.round(secs*1000)/1000,isRec=prev===null||t<prev;
      const now=Date.now(),f=String(lvl),cur=all[f]||{},upd={};
      upd[f]={...cur,lp:now,uk:true};
      if(isRec){upd[f].t=t;upd[f].ts=now;}
      await ref.set(upd,{merge:true});
      const ct=cGet('t_'+uid)||{};ct[f]=upd[f];cSet('t_'+uid,ct);
      return{saved:true,isRecord:isRec,prev};
    });
  }catch(e){console.error('[FB] saveLevelTime:',e.message);return{saved:false,isRecord:false,prev:null};}
}

async function getMyTimes(uid){
  const h=cGet('t_'+uid);if(h)return h;
  try{return await _go(async()=>{const snap=await verRef(uid).get();const v=snap.exists?snap.data():{};cSet('t_'+uid,v);return v;});}
  catch{return{};}
}

async function unlockLevel(uid,lvl){
  try{
    const tk='t_'+uid,ct=cGet(tk)||{},f=String(lvl);
    if(ct[f]?.uk)return;
    await _go(async()=>{const u={};u[f]={...(ct[f]||{}),uk:true};await verRef(uid).set(u,{merge:true});ct[f]=u[f];cSet(tk,ct);});
  }catch(e){console.warn('[FB] unlockLevel:',e.message);}
}

// ── FloppySticks W / L ────────────────────────────────────────────────────
// Uses FieldValue.increment so no read needed — atomic, works even if doc missing
async function recordMatch(uid,won){
  cDel('fs_'+uid); // bust cache so next getMatchStats reads fresh
  const INC=firebase.firestore.FieldValue.increment;
  // Always enable network for the write, keep it on long enough to flush
  _db.enableNetwork();
  try{
    await fsRef(uid).set(
      won ? {w:INC(1),l:INC(0)} : {w:INC(0),l:INC(1)},
      {merge:true}
    );
    console.log('[FB] recordMatch saved  won='+won);
  }catch(e){
    console.error('[FB] recordMatch FAILED:',e.code,e.message);
  }finally{
    // give Firestore 3s to flush before allowing network off
    setTimeout(()=>{ if(!_ops){_db.disableNetwork();_on=false;} },3000);
  }
}

async function getMatchStats(uid){
  cDel('fs_'+uid); // always read fresh after a match
  _db.enableNetwork();
  try{
    const snap=await fsRef(uid).get();
    const v=snap.exists?snap.data():{w:0,l:0};
    cSet('fs_'+uid,v,10000); // short 10s cache
    return v;
  }catch(e){console.warn('[FB] getMatchStats:',e.message);return{w:0,l:0};}
}

// ── Leaderboard ───────────────────────────────────────────────────────────
async function getLeaderboard(lvl){
  const key='lb_'+lvl,h=cGet(key);if(h)return h;
  try{
    return await _go(async()=>{
      const users=await _db.collection('users').get(),rows=[];
      await Promise.all(users.docs.map(ud=>
        verRef(ud.id).get().then(vs=>{
          if(vs.exists){const ld=vs.data()[String(lvl)];if(ld?.t!=null)rows.push({uid:ud.id,name:ud.data().n||'Anonymous',t:ld.t,ts:ld.ts||0});}
        }).catch(()=>{})
      ));
      const sorted=rows.sort((a,b)=>a.t-b.t).slice(0,100);
      cSet(key,sorted,120000);return sorted;
    });
  }catch(e){console.error('[FB] getLeaderboard:',e.message);return[];}
}

// ── Export ────────────────────────────────────────────────────────────────
window.FB={
  signInGoogle,signOut,onAuthChange,currentUser,
  getProfile,saveProfile,
  saveLevelTime,getMyTimes,unlockLevel,
  recordMatch,getMatchStats,
  getLeaderboard,
  VER,
};
console.log('[FB] ready ver='+VER);