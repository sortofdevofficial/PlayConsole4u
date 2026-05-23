/**
 * FloppySticks — game.js v1.3
 * Fixes: Firebase W/L saves correctly, no camera bug, shorter code,
 *        "pts" score labels, W/L shown on menu, online lerp, favicon
 */
(function(){
'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d',{alpha:false});
let W=0,H=0,isMobile=false;

function resize(){
  W=canvas.width=window.innerWidth;
  H=canvas.height=window.innerHeight;
  isMobile=W<1024||'ontouchstart' in window;
  if(state!=='MENU') el('mob-ctrl').style.display=isMobile?'flex':'none';
  if(player){player.gy=H-100;if(player.y>player.gy)player.y=player.gy;}
  if(bot)   {bot.gy   =H-100;if(bot.y>bot.gy)   bot.y   =bot.gy;   }
}
window.addEventListener('resize',resize);

const GRAV=0.55, MAX_P=30, WEAPONS=['Buster Sword','Assault Rifle','Smasher Club'], MAX_PTS=3;
const CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let state='MENU', pScore=0, bScore=0, shake=0, dropTicks=0;
let isHost=false, conn=null, peer=null, netT=0, saved=false;
let wasOnline=false; // remember mode for win overlay label

const keys={a:false,d:false};
const pickups=[], bullets=[], parts=[];

const clouds=[];
function initClouds(){
  clouds.length=0;
  for(let i=0;i<5;i++) clouds.push({
    x:Math.random()*W, y:Math.random()*(H*.25)+30,
    sp:Math.random()*.12+.05, sz:Math.random()*30+20
  });
}

function fx(x,y,col,n=5){
  const room=MAX_P-parts.length;
  for(let i=0;i<Math.min(n,room);i++)
    parts.push({x,y,vx:(Math.random()-.5)*4,vy:(Math.random()-1)*3,
      col,sz:Math.random()*2+1,life:Math.random()*15+10,max:25});
}

function resetDrop(){dropTicks=Math.floor((Math.random()*14+1)*60);}

const el=id=>document.getElementById(id);

// ── Stickman ────────────────────────────────────────────────────────────
class Stickman{
  constructor(x,col,isBot=false){
    this.sx=x;this.col=col;this.isBot=isBot;this.gy=H-100;
    this.netX=null;this.netY=null;this._init();
  }
  _init(){
    this.x=this.sx;this.y=this.gy;this.vx=0;this.vy=0;this.hp=100;
    this.gr=false;this.at=0;this.fl=this.isBot;this.wp=null;
    this.jc=0;this.fa=0;this.flp=false;this.sqY=1;
    this.acd=0;this.asw=0;this.atk=false;this.ff=0;
    this.rd=false;this.rp=[];this.netX=null;this.netY=null;
  }
  respawn(){
    if(state==='MATCH_OVER')return;
    this._init();
    this.sx=this.isBot?W-200:200;this.x=this.sx;
    this._hud();
  }
  _hud(){
    if(!this.isBot){
      el('p-hp').style.width=this.hp+'%';
      el('p-weapon').textContent=this.wp||'NONE';
    }else{
      el('b-hp').style.width=this.hp+'%';
      el('b-weapon').textContent=this.wp||'NONE';
    }
  }
  hit(amt,kb){
    if(this.rd||state==='MATCH_OVER')return;
    this.hp=Math.max(0,this.hp-amt);
    this.ff=6;this.vx+=kb*5.5;this.vy-=2;shake=7;
    fx(this.x,this.y-40,'#fff',4);fx(this.x,this.y-40,'#f1c40f',2);
    this._hud();
    if(this.hp<=0)this._ragdoll(kb);
  }
  _ragdoll(f){
    this.rd=true;
    if(this.isBot){pScore++;el('p-score').textContent=pScore+' pts';}
    else          {bScore++;el('o-score').textContent=bScore+' pts';}
    [[0,-65,11,'c'],[0,-42,24,'l'],[-8,-48,18,'l'],[8,-48,18,'l'],[-6,-18,20,'l'],[6,-18,20,'l']]
      .forEach(([rx,ry,s,t])=>this.rp.push({
        x:this.x+rx,y:this.y+ry,
        vx:f*5+(Math.random()-.5)*4,vy:-3+(Math.random()-1.5)*2,
        ang:Math.random()*Math.PI,va:(Math.random()-.5)*.2,
        t,s
      }));
    if(state==='ONLINE_MODE'&&conn?.open)
      send({type:'score',hs:isHost?pScore:bScore,gs:isHost?bScore:pScore});
    if(pScore>=MAX_PTS||bScore>=MAX_PTS){
      state='MATCH_OVER';send({type:'over'});_save();
    }else{
      setTimeout(()=>{this.respawn();if(state==='ONLINE_MODE')send({type:'ropp'});},1800);
    }
  }
  attack(){
    if(this.acd>0||!this.wp||this.rd)return;
    if(state!=='BOT_MODE'&&state!=='ONLINE_MODE')return;
    this.atk=true;
    this.acd=this.wp==='Assault Rifle'?14:22;
    const d=this.fl?-1:1;
    if(this.wp==='Assault Rifle'){
      const bx=this.x+25*d,by=this.y-45;
      bullets.push({x:bx,y:by,vx:d*15,bot:this.isBot});
      fx(bx,by,'#e67e22',2);
      if(state==='ONLINE_MODE'&&!this.isBot)send({type:'bullet',x:bx,y:by,vx:d*15});
    }else{
      this.asw=-Math.PI/2.5;
      const foe=this.isBot?player:bot;
      if(!foe.rd){
        const sep=Math.abs(this.x-foe.x);
        const fwd=(this.fl&&foe.x<this.x)||(!this.fl&&foe.x>this.x);
        if(sep<125&&fwd&&Math.abs(this.y-foe.y)<70){
          const dmg=this.wp==='Buster Sword'?24:35;
          if(state==='ONLINE_MODE'&&!this.isBot)send({type:'hit',amt:dmg,kb:d});
          else foe.hit(dmg,d);
        }
      }
    }
  }
  update(){
    this.gy=H-100;
    if(this.rd){
      this.rp.forEach(p=>{
        p.vx*=.98;p.vy+=GRAV;p.x+=p.vx;p.y+=p.vy;p.ang+=p.va;
        if(p.y>=this.gy){p.y=this.gy;p.vy=-p.vy*.25;p.va*=.5;}
      });return;
    }
    if(state==='MATCH_OVER'){this.vx*=.8;return;}
    if(this.acd>0)this.acd--;
    if(this.atk){this.asw+=.28;if(this.asw>=Math.PI/2){this.atk=false;this.asw=0;}}
    if(this.flp){this.fa+=this.fl?-.22:.22;if(Math.abs(this.fa)>=Math.PI*2){this.flp=false;this.fa=0;}}
    this.sqY+=(1-this.sqY)*.14;

    // Bot AI
    if(this.isBot&&state==='BOT_MODE'){
      const dist=Math.abs(this.x-player.x);
      this.fl=player.x<this.x;
      if(!player.rd){
        // dodge bullets
        for(const b of bullets){
          if(!b.bot&&Math.abs(this.x-b.x)<140&&this.gr){
            this.vy=-12;this.gr=false;this.jc=1;break;
          }
        }
        // smart retreat when hp low
        if(this.hp<35&&dist<200){
          this.vx=player.x<this.x?4:-4;
        }else{
          let tx=player.x;
          if(!this.wp&&pickups.length){
            let best=Infinity;
            for(const p of pickups){const d=Math.abs(this.x-p.x);if(d<best){best=d;tx=p.x;}}
          }
          if(this.x<tx-45)this.vx=3.8;
          else if(this.x>tx+45)this.vx=-3.8;
          else this.vx*=.5;
          // occasional jump toward player
          if(this.gr&&this.jc===0&&dist<180&&Math.random()<.015){
            this.vy=-12;this.gr=false;this.jc=1;
          }
        }
        if(dist<85||(this.wp==='Assault Rifle'&&dist<340))this.attack();
      }
    }

    // Player input
    if(!this.isBot){
      if(keys.a){this.vx=-5.5;this.fl=true;}
      else if(keys.d){this.vx=5.5;this.fl=false;}
      else this.vx*=.76;
    }

    this.vy+=GRAV;this.x+=this.vx;this.y+=this.vy;
    const gy=this.gy;
    if(this.y>=gy){
      if(!this.gr){this.sqY=.78;fx(this.x,gy,'#6a824e',2);}
      this.y=gy;this.vy=0;this.gr=true;this.jc=0;
    }else this.gr=false;
    this.x=Math.max(25,Math.min(W-25,this.x));
    if(Math.abs(this.vx)>.5&&this.gr)this.at+=.28;
    else if(!this.gr)this.at=1.1;
    else this.at*=.7;
  }
  draw(){
    if(this.rd){
      ctx.lineWidth=4;ctx.lineCap='round';
      ctx.strokeStyle=this.col;ctx.fillStyle=this.col;
      this.rp.forEach(p=>{
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.ang);ctx.beginPath();
        if(p.t==='c'){ctx.arc(0,0,p.s,0,Math.PI*2);ctx.fill();}
        else{ctx.moveTo(0,-p.s/2);ctx.lineTo(0,p.s/2);}
        ctx.stroke();ctx.restore();
      });return;
    }
    ctx.save();
    ctx.translate(this.x,this.y);ctx.scale(1,this.sqY);ctx.translate(-this.x,-this.y);
    ctx.lineWidth=4;ctx.lineCap='round';
    let dc=this.col;
    if(this.ff>0){this.ff--;if(this.ff%2===0)dc='#fff';}
    ctx.strokeStyle=dc;ctx.fillStyle=dc;
    ctx.save();
    ctx.translate(this.x,this.y-30);
    if(this.gr&&Math.abs(this.vx)>.5)ctx.rotate(this.vx*.025);
    if(this.flp)ctx.rotate(this.fa);
    ctx.translate(-this.x,-(this.y-30));
    const bob=(this.gr&&Math.abs(this.vx)<=.5)?Math.sin(Date.now()*.005)*1.5:0;
    const ny=this.y-55+bob,hy=this.y-25,hy2=ny-12;
    ctx.beginPath();ctx.arc(this.x,hy2,11,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(this.x,ny);ctx.lineTo(this.x,hy);ctx.stroke();
    const sw=Math.sin(this.at)*16,fl=this.fl?-1:1;
    ctx.beginPath();ctx.moveTo(this.x,hy);ctx.lineTo(this.x+sw*fl,this.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(this.x,hy);ctx.lineTo(this.x-sw*fl,this.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(this.x,ny+4);ctx.lineTo(this.x-14*fl-sw*.1*fl,ny+14+sw);ctx.stroke();
    let hx=this.x+18*fl,hy3=ny+12-sw;
    if(this.atk&&this.wp!=='Assault Rifle'){hx=this.x+24*fl;hy3=ny+4;}
    ctx.beginPath();ctx.moveTo(this.x,ny+4);ctx.lineTo(hx,hy3);ctx.stroke();
    ctx.restore();
    if(this.wp){
      ctx.save();ctx.translate(hx,hy3);
      if(this.fl)ctx.scale(-1,1);
      if(this.atk)ctx.rotate(this.asw);
      if(this.wp==='Buster Sword'){
        ctx.strokeStyle='#7f8c8d';ctx.fillStyle='#bdc3c7';ctx.lineWidth=3;
        ctx.beginPath();ctx.rect(0,-7,46,14);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#7a4a2a';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-8,0);ctx.stroke();
      }else if(this.wp==='Assault Rifle'){
        ctx.fillStyle='#2c3e50';ctx.fillRect(0,-5,32,10);
        ctx.fillStyle='#34495e';ctx.fillRect(10,2,6,7);
      }else{
        ctx.strokeStyle='#d35400';ctx.lineWidth=6;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(38,-3);ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

let player,bot;
function initEntities(){
  player=new Stickman(200,'#2c3e50',false);
  bot   =new Stickman(W-200,'#962d22',true);
}

function spawnPickup(t,x){
  if(pickups.length>=3)return;
  pickups.push({
    type:t||WEAPONS[Math.floor(Math.random()*WEAPONS.length)],
    x:x!==undefined?x:Math.random()*(W-260)+130,
    y:H-115,bob:Math.random()*100
  });
}

// ── Firebase W/L save — ONLINE only, never vs AI bot ─────────────────
async function _save(){
  if(saved)return; saved=true;
  if(!wasOnline){
    console.log('[game] skipping W/L save — bot fight');
    return;
  }
  const u=window.FB?.currentUser?.();
  if(!u){
    console.warn('[game] skipping W/L save — not signed in');
    return;
  }
  const won=pScore>=MAX_PTS;
  console.log('[game] saving match result  won='+won+'  uid='+u.uid);
  try{
    await window.FB.recordMatch(u.uid,won);
    // wait a tick for Firestore to confirm write before reading back
    await new Promise(r=>setTimeout(r,800));
    const s=await window.FB.getMatchStats(u.uid).catch(()=>({w:0,l:0}));
    console.log('[game] stats after save:', s);
    if(typeof showWL==='function')showWL(s.w||0,s.l||0);
  }catch(e){console.error('[game] _save error:',e);}
}

// ── Start ─────────────────────────────────────────────────────────────
function _commonStart(){
  pScore=0;bScore=0;saved=false;
  bullets.length=0;pickups.length=0;parts.length=0;
  el('p-score').textContent='0 pts';
  el('o-score').textContent='0 pts';
  resetDrop();
  player.sx=200;    player.respawn();
  bot.sx   =W-200;  bot.respawn();
  spawnPickup();
  const m=el('menu');m.style.opacity='0';
  setTimeout(()=>{
    m.style.display='none';
    el('hud').style.display='flex';
    if(isMobile)el('mob-ctrl').style.display='flex';
  },400);
}

function startLocal(){
  state='BOT_MODE';wasOnline=false;
  el('mode-badge').style.display='none';
  el('p-label').textContent='YOU';
  el('o-label').textContent='AI';
  _commonStart();
}

function startOnline(){
  state='ONLINE_MODE';wasOnline=true;
  el('mode-badge').style.display='block';
  el('p-label').textContent=isHost?'P1 (You)':'P2 (You)';
  el('o-label').textContent=isHost?'P2':'P1';
  _commonStart();
  el('online-modal').classList.remove('open');
}

// ── Jump ─────────────────────────────────────────────────────────────
function jump(){
  if(player.rd)return;
  if(state!=='BOT_MODE'&&state!=='ONLINE_MODE')return;
  if(player.gr){
    player.vy=-13;player.gr=false;player.jc=1;player.sqY=1.25;
    fx(player.x,H-100,'#95a5a6',3);
  }else if(player.jc===1){
    player.vy=-9.8;player.jc=2;player.flp=true;player.fa=0;
    fx(player.x,player.y-30,'#ecf0f1',3);
  }
}

// ── Input ─────────────────────────────────────────────────────────────
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k==='a'||k==='arrowleft')keys.a=true;
  if(k==='d'||k==='arrowright')keys.d=true;
  if(k==='w'||k===' '||k==='arrowup'){e.preventDefault();jump();}
  if(k==='enter'&&state==='MATCH_OVER')toMenu();
});
window.addEventListener('keyup',e=>{
  const k=e.key.toLowerCase();
  if(k==='a'||k==='arrowleft')keys.a=false;
  if(k==='d'||k==='arrowright')keys.d=false;
});
window.addEventListener('mousedown',()=>{
  if((state==='BOT_MODE'||state==='ONLINE_MODE')&&!player.rd&&!isMobile)player.attack();
});
window.addEventListener('touchstart',()=>{if(state==='MATCH_OVER')toMenu();});

function tc(id,dn,up){
  const e2=el(id);if(!e2)return;
  e2.addEventListener('touchstart',e=>{e.preventDefault();dn?.();},{passive:false});
  e2.addEventListener('touchend',  e=>{e.preventDefault();up?.();},{passive:false});
  e2.addEventListener('touchcancel',e=>{e.preventDefault();up?.();},{passive:false});
}
tc('btn-left',  ()=>keys.a=true, ()=>keys.a=false);
tc('btn-right', ()=>keys.d=true, ()=>keys.d=false);
tc('btn-jump',  ()=>jump(),null);
tc('btn-attack',()=>{if((state==='BOT_MODE'||state==='ONLINE_MODE')&&!player.rd)player.attack();},null);

el('start-btn').addEventListener('click',startLocal);
el('start-btn').addEventListener('touchstart',e=>{e.preventDefault();startLocal();},{passive:false});
el('online-btn').addEventListener('click',openOnlineModal);

function toMenu(){
  state='MENU';keys.a=false;keys.d=false;
  bullets.length=0;pickups.length=0;parts.length=0;
  if(conn){try{conn.close();}catch(e){}conn=null;}
  if(peer){try{peer.destroy();}catch(e){}peer=null;}
  el('hud').style.display='none';
  el('mob-ctrl').style.display='none';
  el('mode-badge').style.display='none';
  const m=el('menu');m.style.display='flex';m.style.opacity='1';
  // Refresh W/L
  const u=window.FS?.currentUser?.();
  if(u)window.FS.getStats(u.uid).then(s=>showWLMenu(s.w||0,s.l||0)).catch(()=>{});
}

// ── PeerJS ────────────────────────────────────────────────────────────
function genCode(){let s='';for(let i=0;i<4;i++)s+=CHARS[Math.floor(Math.random()*CHARS.length)];return s;}

window.openOnlineModal = openOnlineModal;
window.closeOnlineModal= closeOnlineModal;
window.switchTab       = switchTab;
window.joinGame        = joinGame;

function openOnlineModal(){el('online-modal').classList.add('open');switchTab('host');initHost();}
function closeOnlineModal(){
  el('online-modal').classList.remove('open');
  if(conn){try{conn.close();}catch(e){}conn=null;}
  if(peer){try{peer.destroy();}catch(e){}peer=null;}
}
function switchTab(t){
  ['host','join'].forEach(x=>{
    el('tab-'+x).classList.toggle('active',x===t);
    el('panel-'+x).classList.toggle('active',x===t);
  });
  if(t==='host'&&!peer)initHost();
}

function initHost(){
  if(peer&&!peer.destroyed)return;
  isHost=true;
  const code=genCode();
  el('host-code-box').innerHTML=`<div class="code-val">${code}</div><div class="code-hint">Share this code with your friend</div>`;
  setHS('waiting','<span class="spin"></span>Waiting for opponent…');
  peer=new Peer('floppy-'+code,{debug:0,config:{iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:global.stun.twilio.com:3478'},
  ]}});
  peer.on('error',err=>{
    if(err.type==='unavailable-id'){peer.destroy();peer=null;setTimeout(initHost,500);return;}
    setHS('error','❌ Error — try again');
  });
  peer.on('connection',c=>{conn=c;setHS('connecting','<span class="spin"></span>Connecting…');setupConn(c,false);});
}

function joinGame(){
  const raw=el('join-input').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(raw.length!==4){setJS('error','❌ Enter a 4-letter code');return;}
  if(peer&&!peer.destroyed){peer.destroy();peer=null;}
  isHost=false;
  setJS('connecting','<span class="spin"></span>Connecting…');
  peer=new Peer(undefined,{debug:0,config:{iceServers:[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:global.stun.twilio.com:3478'},
  ]}});
  peer.on('open',()=>{const c=peer.connect('floppy-'+raw,{reliable:true});conn=c;setupConn(c,true);});
  peer.on('error',err=>setJS('error','❌ '+(err.message||'Failed')));
}

function setupConn(c,joiner){
  c.on('open',()=>{if(joiner)setJS('connected','✅ Connected! Starting…');send({type:'ready'});});
  c.on('data',onMsg);
  c.on('close',()=>{
    if(state==='ONLINE_MODE'){pScore=MAX_PTS;el('p-score').textContent=pScore+' pts';state='MATCH_OVER';_save();}
    conn=null;
  });
  c.on('error',e=>{const m='❌ '+(e.message||'Error');joiner?setJS('error',m):setHS('error',m);});
}

// ── Net messages ──────────────────────────────────────────────────────
function onMsg(d){
  if(!d?.type)return;
  switch(d.type){
    case 'ready':
      if(isHost)setHS('connected','✅ Connected! Starting…');
      setTimeout(startOnline,600);break;
    case 'state':
      if(state!=='ONLINE_MODE')return;
      // smooth lerp toward received position (applied in loop)
      bot.netX=d.x;bot.netY=d.y;
      Object.assign(bot,{vx:d.vx,vy:d.vy,fl:d.fl,at:d.at,gr:d.gr,sqY:d.sy,
        atk:d.ia,asw:d.as,flp:d.if,fa:d.fa,wp:d.wp||null,rd:d.rd,ff:d.ff||0});
      if(d.rd&&bot.rp.length===0&&d.rp)bot.rp=d.rp;
      el('b-hp').style.width=(d.hp||0)+'%';
      el('b-weapon').textContent=d.wp||'NONE';
      break;
    case 'hit':   if(state==='ONLINE_MODE')player.hit(d.amt,d.kb);break;
    case 'bullet':bullets.push({x:d.x,y:d.y,vx:d.vx,bot:true});break;
    case 'pickup_spawn':if(!isHost)spawnPickup(d.wt,d.px);break;
    case 'pickup_taken':
      if(pickups[d.i]){if(!isHost&&d.bot)bot.wp=d.wt;pickups.splice(d.i,1);}break;
    case 'score':
      pScore=isHost?d.hs:d.gs;bScore=isHost?d.gs:d.hs;
      el('p-score').textContent=pScore+' pts';
      el('o-score').textContent=bScore+' pts';break;
    case 'over':state='MATCH_OVER';_save();break;
    case 'ropp': bot.respawn();break;
  }
}
function send(o){if(conn?.open)try{conn.send(o);}catch(e){}}
function setHS(c,h){const e2=el('host-status');e2.className='om-status '+c;e2.innerHTML=h;}
function setJS(c,h){const e2=el('join-status');e2.style.display='block';e2.className='om-status '+c;e2.innerHTML=h;}

// ── Game loop ─────────────────────────────────────────────────────────
function loop(){
  requestAnimationFrame(loop);

  // Clear + sky
  ctx.fillStyle='#87CEEB';ctx.fillRect(0,0,W,H);

  ctx.save();
  if(shake>0){
    ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    shake*=.88;if(shake<.5)shake=0;
  }

  // Sky fade
  const sg=ctx.createLinearGradient(0,H*.5,0,H-100);
  sg.addColorStop(0,'rgba(224,244,255,0)');sg.addColorStop(1,'rgba(224,244,255,.6)');
  ctx.fillStyle=sg;ctx.fillRect(0,H*.5,W,H);

  // Clouds
  ctx.fillStyle='rgba(255,255,255,.75)';
  for(const c of clouds){
    c.x+=c.sp;if(c.x-c.sz>W)c.x=-c.sz;
    ctx.beginPath();
    ctx.arc(c.x,c.y,c.sz,0,Math.PI*2);
    ctx.arc(c.x+c.sz*.6,c.y-c.sz*.2,c.sz*.75,0,Math.PI*2);
    ctx.fill();
  }

  // Hills
  ctx.fillStyle='#9dc183';
  ctx.beginPath();ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=40)ctx.lineTo(x,(H-220)+Math.sin(x*.003)*35);
  ctx.lineTo(W,H);ctx.fill();
  ctx.fillStyle='#7da061';
  ctx.beginPath();ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=35)ctx.lineTo(x,(H-160)+Math.cos(x*.005)*20);
  ctx.lineTo(W,H);ctx.fill();

  // Ground
  ctx.fillStyle='#27ae60';ctx.fillRect(0,H-100,W,14);
  ctx.fillStyle='#795548';ctx.fillRect(0,H-86,W,86);

  if(state==='BOT_MODE'||state==='ONLINE_MODE'||state==='MATCH_OVER'){

    // Spawner
    if(state==='BOT_MODE'||state==='ONLINE_MODE'){
      dropTicks--;
      el('drop-timer').textContent='DROP: '+Math.max(0,dropTicks/60).toFixed(1)+'s';
      if(dropTicks<=0){
        if(state==='BOT_MODE'||isHost){
          const wt=WEAPONS[Math.floor(Math.random()*WEAPONS.length)];
          const px=Math.random()*(W-260)+130;
          spawnPickup(wt,px);
          if(state==='ONLINE_MODE')send({type:'pickup_spawn',wt,px});
        }
        resetDrop();
      }
    }

    // Update
    player.update();
    if(state==='BOT_MODE'){
      bot.update();
    }else{
      // Online: lerp bot to net position, still run ragdoll physics
      if(!bot.rd){
        if(bot.netX!==null)bot.x+=(bot.netX-bot.x)*.3;
        if(bot.netY!==null)bot.y+=(bot.netY-bot.y)*.3;
      }else bot.update();
    }

    // Particles
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i];
      p.x+=p.vx;p.y+=p.vy;p.vy+=.05;p.life--;
      if(p.life<=0||p.x<-10||p.x>W+10||p.y>H+10){parts.splice(i,1);continue;}
      ctx.globalAlpha=p.life/p.max;
      ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;

    // Bullets
    for(let i=bullets.length-1;i>=0;i--){
      const b=bullets[i];b.x+=b.vx;
      if(b.x<-20||b.x>W+20){bullets.splice(i,1);continue;}
      ctx.fillStyle='#e67e22';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();
      const tgt=b.bot?player:bot;
      if(!tgt.rd&&b.x>tgt.x-28&&b.x<tgt.x+28&&b.y<tgt.y&&b.y>tgt.y-65){
        const dmg=12,kb=b.vx>0?1:-1;
        tgt.hit(dmg,kb);
        if(state==='ONLINE_MODE'&&!b.bot)send({type:'hit',amt:dmg,kb});
        bullets.splice(i,1);
      }
    }

    // Pickups
    for(let i=pickups.length-1;i>=0;i--){
      const p=pickups[i];p.bob+=.06;
      const by=p.y+Math.sin(p.bob)*5;
      ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.ellipse(p.x,p.y+12,14,3,0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#e8b84b';ctx.fillRect(p.x-12,by-12,24,24);
      ctx.strokeStyle='#c49a2a';ctx.lineWidth=2;ctx.strokeRect(p.x-12,by-12,24,24);
      ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(p.x-12,by);ctx.lineTo(p.x+12,by);ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x,by-12);ctx.lineTo(p.x,by+12);ctx.stroke();
      ctx.fillStyle='#2c3e50';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
      ctx.fillText(p.type.toUpperCase(),p.x,by-15);
      let picked=false;
      for(let j=0;j<2;j++){
        const ent=j===0?player:bot,isB=j===1;
        if(!ent.rd&&Math.hypot(ent.x-p.x,(ent.y-30)-p.y)<38){
          ent.wp=p.type;
          if(!isB)el('p-weapon').textContent=p.type.toUpperCase();
          else el('b-weapon').textContent=p.type.toUpperCase();
          if(state==='ONLINE_MODE'&&isHost)send({type:'pickup_taken',i,bot:isB,wt:p.type});
          pickups.splice(i,1);picked=true;break;
        }
      }
      if(picked)continue;
    }

    player.draw();bot.draw();

    // Net state send (every 2 frames)
    if(state==='ONLINE_MODE'&&conn?.open&&++netT>=2){
      netT=0;
      const msg={type:'state',x:player.x,y:player.y,vx:player.vx,vy:player.vy,
        fl:player.fl,at:player.at,gr:player.gr,sy:player.sqY,
        ia:player.atk,as:player.asw,if:player.flp,fa:player.fa,
        wp:player.wp,rd:player.rd,hp:player.hp,ff:player.ff};
      if(player.rd&&player.rp.length)
        msg.rp=player.rp.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,ang:p.ang,va:p.va,t:p.t,s:p.s}));
      send(msg);
    }
  }

  // Match over
  if(state==='MATCH_OVER'){
    ctx.fillStyle='rgba(0,0,0,.48)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    const win=pScore>=MAX_PTS;
    ctx.font=`bold ${Math.min(58,W/7)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle=win?'#2ecc71':'#e74c3c';
    ctx.fillText(win?'🎉 YOU WIN!':'😢 YOU LOSE!',W/2,H/2-36);
    ctx.font=`bold ${Math.min(26,W/20)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle='#fff';
    ctx.fillText(`You: ${pScore}  —  ${wasOnline?'Opponent':'AI'}: ${bScore}`,W/2,H/2+12);
    ctx.font=`${Math.min(15,W/30)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle='rgba(255,255,255,.65)';
    ctx.fillText(isMobile?'Tap to return':'Press [ENTER] to return',W/2,H/2+50);
  }

  ctx.restore();
}

// Boot
resize();initClouds();initEntities();
requestAnimationFrame(loop);

})();