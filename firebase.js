// firebase.js v1.4
// users/{uid}              → { n, e, ph }
// users/{uid}/G/CP/L/{VER} → { "1":{t,ts,lp,uk}, … }
// users/{uid}/G/FS         → { w, l }  ← FloppySticks W/L

firebase.initializeApp({
  apiKey:'AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8',
  authDomain:'playconsole4u-53a6a.firebaseapp.com',
  projectId:'playconsole4u-53a6a',
  storageBucket:'playconsole4u-53a6a.firebasestorage.app',
  messagingSenderId:'306379034842',
  appId:'1:306379034842:web:1b891d0ef20cdacb0a55e3'
});

const _a=firebase.auth(), _d=firebase.firestore(), VER='1';

// Lazy network — disabled by default, enabled per-op, turned off 2s after last op
_d.disableNetwork();
let _on=false,_ops=0,_ot=null;
function _up(){if(_ot){clearTimeout(_ot);_ot=null;}if(!_on){_d.enableNetwork();_on=true;}_ops++;}
function _dn(){_ops=Math.max(0,_ops-1);if(!_ops){_ot=setTimeout(()=>{_d.disableNetwork();_on=false;_ot=null;},2000);}}
async function _go(fn){_up();try{return await fn();}finally{_dn();}}

// Cache
const _c={};
const cS=(k,v,ttl=60000)=>{_c[k]={v,x:Date.now()+ttl};};
const cG=k=>{const e=_c[k];return e&&Date.now()<e.x?e.v:null;};
const cD=k=>{delete _c[k];};

// Refs
const uRef=uid=>_d.collection('users').doc(uid);
const lRef=uid=>uRef(uid).collection('G').doc('CP').collection('L').doc(VER);
const fRef=uid=>uRef(uid).collection('G').doc('FS');

// Auth
const signInGoogle=()=>_a.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut=()=>_a.signOut();
const currentUser=()=>_a.currentUser;

function onAuthChange(cb){
  _a.onAuthStateChanged(async u=>{
    if(u){cD('p_'+u.uid);await _ensureUser(u);}
    cb(u);
  });
}
async function _ensureUser(u){
  try{await _go(async()=>{
    const s=await uRef(u.uid).get(),d=s.exists?s.data():{},up={};
    if(!d.n)up.n=u.displayName||'Anonymous';
    if(!d.e)up.e=u.email||'';
    if(!d.ph&&u.photoURL)up.ph=u.photoURL;
    if(Object.keys(up).length){await uRef(u.uid).set(up,{merge:true});cS('p_'+u.uid,{...d,...up});}
    else cS('p_'+u.uid,d);
  });}catch(e){console.warn('[FB] ensureUser:',e.message);}
}

// Profile
async function getProfile(uid){
  const h=cG('p_'+uid);if(h)return h;
  try{return await _go(async()=>{const s=await uRef(uid).get(),v=s.exists?s.data():{};cS('p_'+uid,v);return v;});}
  catch{return{};}
}
async function saveProfile(uid,name){
  cD('p_'+uid);await _go(()=>uRef(uid).set({n:name},{merge:true}));
}

// CP Level times
async function saveLevelTime(uid,lvl,secs){
  try{return await _go(async()=>{
    const ref=lRef(uid),snap=await ref.get(),all=snap.exists?snap.data():{};
    const f=String(lvl),prev=all[f]?.t??null,t=Math.round(secs*1000)/1000,rec=prev===null||t<prev,now=Date.now();
    const upd={};upd[f]={...(all[f]||{}),lp:now,uk:true};
    if(rec){upd[f].t=t;upd[f].ts=now;}
    await ref.set(upd,{merge:true});
    const ct=cG('t_'+uid)||{};ct[f]=upd[f];cS('t_'+uid,ct);
    return{saved:true,isRecord:rec,prev};
  });}catch(e){console.error('[FB] saveLevelTime:',e.message);return{saved:false,isRecord:false,prev:null};}
}
async function getMyTimes(uid){
  const h=cG('t_'+uid);if(h)return h;
  try{return await _go(async()=>{const s=await lRef(uid).get(),v=s.exists?s.data():{};cS('t_'+uid,v);return v;});}
  catch{return{};}
}
async function unlockLevel(uid,lvl){
  try{
    const tk='t_'+uid,ct=cG(tk)||{},f=String(lvl);if(ct[f]?.uk)return;
    await _go(async()=>{const u={};u[f]={...(ct[f]||{}),uk:true};await lRef(uid).set(u,{merge:true});ct[f]=u[f];cS(tk,ct);});
  }catch(e){console.warn('[FB] unlockLevel:',e.message);}
}

// ── FloppySticks W/L → users/{uid}/G/FS ──────────────────────────────────
// Uses FieldValue.increment — atomic, no race condition, works even if doc is missing.
// Network is force-enabled and kept alive until write confirms.
async function recordMatch(uid, won){
  cD('fs_'+uid); // bust cache so next read is always fresh
  const INC=firebase.firestore.FieldValue.increment;
  // Force network on — do NOT rely on lazy _go here, write must land
  _d.enableNetwork();
  _on=true;
  if(_ot){clearTimeout(_ot);_ot=null;}
  try{
    await fRef(uid).set(
      won?{w:INC(1),l:INC(0)}:{w:INC(0),l:INC(1)},
      {merge:true}
    );
    console.log('[FB] recordMatch OK  won='+won);
  }catch(e){
    console.error('[FB] recordMatch FAILED:',e.code,e.message);
    throw e; // re-throw so caller knows it failed
  }finally{
    // Keep network alive 4s to guarantee write flushes to server
    if(_ot)clearTimeout(_ot);
    _ot=setTimeout(()=>{_d.disableNetwork();_on=false;_ot=null;},4000);
  }
}

async function getMatchStats(uid){
  cD('fs_'+uid); // always fresh — never use cache for stats
  _d.enableNetwork();_on=true;
  try{
    const snap=await fRef(uid).get();
    const v=snap.exists?snap.data():{w:0,l:0};
    return{w:v.w||0,l:v.l||0};
  }catch(e){console.warn('[FB] getMatchStats:',e.message);return{w:0,l:0};}
}

// Leaderboard
async function getLeaderboard(lvl){
  const key='lb_'+lvl,h=cG(key);if(h)return h;
  try{return await _go(async()=>{
    const us=await _d.collection('users').get(),rows=[];
    await Promise.all(us.docs.map(d=>lRef(d.id).get().then(s=>{
      if(s.exists){const ld=s.data()[String(lvl)];if(ld?.t!=null)rows.push({uid:d.id,name:d.data().n||'Anonymous',t:ld.t,ts:ld.ts||0});}
    }).catch(()=>{})));
    const sorted=rows.sort((a,b)=>a.t-b.t).slice(0,100);cS(key,sorted,120000);return sorted;
  });}catch(e){console.error('[FB] getLeaderboard:',e.message);return[];}
}

window.FB={
  signInGoogle,signOut,onAuthChange,currentUser,
  getProfile,saveProfile,
  saveLevelTime,getMyTimes,unlockLevel,
  recordMatch,getMatchStats,
  getLeaderboard,VER
};
console.log('[FB] ready v'+VER);