// firebase.js v1.3
firebase.initializeApp({
  apiKey:'AIzaSyCZPK5A0UQSFB2D_zNj3wjZ5-Tbyb1VYn8',
  authDomain:'playconsole4u-53a6a.firebaseapp.com',
  projectId:'playconsole4u-53a6a',
  storageBucket:'playconsole4u-53a6a.firebasestorage.app',
  messagingSenderId:'306379034842',
  appId:'1:306379034842:web:1b891d0ef20cdacb0a55e3'
});

const auth=firebase.auth(),db=firebase.firestore(),VER='1';
db.disableNetwork();
let _on=false,_ops=0,_t=null;
const _up=()=>{if(_t){clearTimeout(_t);_t=null;}if(!_on){db.enableNetwork();_on=true;}_ops++;};
const _dn=()=>{if(!--_ops)_t=setTimeout(()=>{db.disableNetwork();_on=false;_t=null;},1500);};
const _go=async f=>{_up();try{return await f();}finally{_dn();}};

const C={};
const cs=(k,v,ttl=60000)=>C[k]={v,x:Date.now()+ttl};
const cg=k=>{const e=C[k];return e&&Date.now()<e.x?e.v:null;};
const cd=k=>delete C[k];

const uRef=u=>db.collection('users').doc(u);
const lRef=u=>uRef(u).collection('G').doc('CP').collection('L').doc(VER);
const fRef=u=>uRef(u).collection('G').doc('FS');

const signInGoogle=()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut=()=>auth.signOut();
const currentUser=()=>auth.currentUser;

function onAuthChange(cb){
  auth.onAuthStateChanged(async u=>{
    if(u){cd('p_'+u.uid);await _ensureUser(u);}
    cb(u);
  });
}
async function _ensureUser(u){
  try{await _go(async()=>{
    const s=await uRef(u.uid).get(),d=s.exists?s.data():{},up={};
    if(!d.n)up.n=u.displayName||'Anon';
    if(!d.e)up.e=u.email||'';
    if(!d.ph&&u.photoURL)up.ph=u.photoURL;
    if(Object.keys(up).length){await uRef(u.uid).set(up,{merge:true});cs('p_'+u.uid,{...d,...up});}
    else cs('p_'+u.uid,d);
  });}catch(e){console.warn('[FB]',e.message);}
}

async function getProfile(uid){
  const h=cg('p_'+uid);if(h)return h;
  try{return await _go(async()=>{const s=await uRef(uid).get(),v=s.exists?s.data():{};cs('p_'+uid,v);return v;});}
  catch{return{};}
}
async function saveProfile(uid,n){cd('p_'+uid);await _go(()=>uRef(uid).set({n},{merge:true}));}

async function saveLevelTime(uid,lvl,secs){
  try{return await _go(async()=>{
    const ref=lRef(uid),snap=await ref.get(),all=snap.exists?snap.data():{};
    const f=String(lvl),prev=all[f]?.t??null,t=Math.round(secs*1000)/1000,rec=prev===null||t<prev,now=Date.now();
    const update={};update[f]={...(all[f]||{}),lp:now,uk:true};
    if(rec){update[f].t=t;update[f].ts=now;}
    await ref.set(update,{merge:true});
    const ct=cg('t_'+uid)||{};ct[f]=update[f];cs('t_'+uid,ct);
    return{saved:true,isRecord:rec,prev};
  });}catch(e){console.error('[FB]',e.message);return{saved:false,isRecord:false,prev:null};}
}
async function getMyTimes(uid){
  const h=cg('t_'+uid);if(h)return h;
  try{return await _go(async()=>{const s=await lRef(uid).get(),v=s.exists?s.data():{};cs('t_'+uid,v);return v;});}
  catch{return{};}
}
async function unlockLevel(uid,lvl){
  try{
    const tk='t_'+uid,ct=cg(tk)||{},f=String(lvl);if(ct[f]?.uk)return;
    await _go(async()=>{const u={};u[f]={...(ct[f]||{}),uk:true};await lRef(uid).set(u,{merge:true});ct[f]=u[f];cs(tk,ct);});
  }catch(e){console.warn('[FB]',e.message);}
}

// W/L → users/{uid}/G/FS  {w,l}
async function recordMatch(uid,won){
  try{
    cd('fs_'+uid);
    await _go(async()=>{
      const ref=fRef(uid),s=await ref.get(),d=s.exists?s.data():{w:0,l:0};
      const next={w:(d.w||0)+(won?1:0),l:(d.l||0)+(won?0:1)};
      await ref.set(next,{merge:true});cs('fs_'+uid,next,30000);
    });
  }catch(e){console.warn('[FB] recordMatch:',e.message);}
}
async function getMatchStats(uid){
  const h=cg('fs_'+uid);if(h)return h;
  try{return await _go(async()=>{const s=await fRef(uid).get(),v=s.exists?s.data():{w:0,l:0};cs('fs_'+uid,v,30000);return v;});}
  catch{return{w:0,l:0};}
}

async function getLeaderboard(lvl){
  const k='lb_'+lvl,h=cg(k);if(h)return h;
  try{return await _go(async()=>{
    const us=await db.collection('users').get(),rows=[];
    await Promise.all(us.docs.map(d=>lRef(d.id).get().then(s=>{
      if(s.exists){const ld=s.data()[String(lvl)];if(ld?.t!=null)rows.push({uid:d.id,name:d.data().n||'Anon',t:ld.t,ts:ld.ts||0});}
    }).catch(()=>{})));
    const sorted=rows.sort((a,b)=>a.t-b.t).slice(0,100);cs(k,sorted,120000);return sorted;
  });}catch(e){console.error('[FB]',e.message);return[];}
}

window.FB={signInGoogle,signOut,onAuthChange,currentUser,getProfile,saveProfile,saveLevelTime,getMyTimes,unlockLevel,recordMatch,getMatchStats,getLeaderboard,VER};
console.log('[FB] ready v'+VER);