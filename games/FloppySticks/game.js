// FloppySticks game.js v1.3
(function(){
'use strict';
const cv=document.getElementById('gameCanvas'),ctx=cv.getContext('2d',{alpha:false});
let W=0,H=0,mob=false;
function resize(){
  W=cv.width=innerWidth;H=cv.height=innerHeight;
  mob=W<1024||'ontouchstart' in window;
  if(gs!=='MENU')g('mc').style.display=mob?'flex':'none';
  if(P){P.gy=H-100;if(P.y>P.gy)P.y=P.gy;}
  if(B){B.gy=H-100;if(B.y>B.gy)B.y=B.gy;}
}
addEventListener('resize',resize);

const GV=0.55,MXPT=30,WPS=['Buster Sword','Assault Rifle','Smasher Club'],MX=3,CC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let gs='MENU',ps=0,bs=0,shk=0,dt=0,isHost=false,conn=null,peer=null,nt=0,sv=false,wasOnline=false;
const keys={a:0,d:0},pku=[],bul=[],ptl=[];
const clouds=[];

function g(id){return document.getElementById(id);}
function fx(x,y,c,n=5){
  const r=MXPT-ptl.length;
  for(let i=0;i<Math.min(n,r);i++)
    ptl.push({x,y,vx:(Math.random()-.5)*4,vy:(Math.random()-1)*3,c,sz:Math.random()*2+1,lf:Math.random()*15+10,mx:25});
}
function rDrop(){dt=Math.floor((Math.random()*14+1)*60);}
function initClouds(){
  clouds.length=0;
  for(let i=0;i<5;i++)clouds.push({x:Math.random()*W,y:Math.random()*(H*.25)+30,sp:Math.random()*.12+.05,sz:Math.random()*30+20});
}

// ── Stickman ──────────────────────────────────────────────────────────────
class S{
  constructor(x,c,bot=false){this.sx=x;this.c=c;this.bot=bot;this.gy=H-100;this.nx=null;this.ny=null;this._i();}
  _i(){
    this.x=this.sx;this.y=this.gy;this.vx=0;this.vy=0;this.hp=100;
    this.gr=false;this.at=0;this.fl=this.bot;this.wp=null;
    this.jc=0;this.fa=0;this.flp=false;this.sq=1;
    this.ac=0;this.asw=0;this.atk=false;this.ff=0;
    this.rd=false;this.rp=[];this.nx=null;this.ny=null;
  }
  respawn(){if(gs==='MATCH_OVER')return;this._i();this.sx=this.bot?W-200:200;this.x=this.sx;this._hud();}
  _hud(){
    if(!this.bot){g('p-hp').style.width=this.hp+'%';g('pwp').textContent=this.wp||'NONE';}
    else{g('b-hp').style.width=this.hp+'%';g('bwp').textContent=this.wp||'NONE';}
  }
  hit(a,kb){
    if(this.rd||gs==='MATCH_OVER')return;
    this.hp=Math.max(0,this.hp-a);this.ff=6;this.vx+=kb*5.5;this.vy-=2;shk=7;
    fx(this.x,this.y-40,'#fff',4);fx(this.x,this.y-40,'#f1c40f',2);
    this._hud();if(this.hp<=0)this._rag(kb);
  }
  _rag(f){
    this.rd=true;
    if(this.bot){ps++;g('psc').textContent=ps+' pts';}
    else{bs++;g('osc').textContent=bs+' pts';}
    [[0,-65,11,'c'],[0,-42,24,'l'],[-8,-48,18,'l'],[8,-48,18,'l'],[-6,-18,20,'l'],[6,-18,20,'l']]
      .forEach(([rx,ry,s,t])=>this.rp.push({
        x:this.x+rx,y:this.y+ry,vx:f*5+(Math.random()-.5)*4,vy:-3+(Math.random()-1.5)*2,
        ang:Math.random()*Math.PI,va:(Math.random()-.5)*.2,t,s
      }));
    if(gs==='ONLINE_MODE'&&conn?.open)send({type:'score',hs:isHost?ps:bs,gs2:isHost?bs:ps});
    if(ps>=MX||bs>=MX){gs='MATCH_OVER';send({type:'over'});_save();}
    else setTimeout(()=>{this.respawn();if(gs==='ONLINE_MODE')send({type:'ropp'});},1800);
  }
  attack(){
    if(this.ac>0||!this.wp||this.rd||gs!=='BOT_MODE'&&gs!=='ONLINE_MODE')return;
    this.atk=true;this.ac=this.wp==='Assault Rifle'?14:22;
    const d=this.fl?-1:1;
    if(this.wp==='Assault Rifle'){
      const bx=this.x+25*d,by=this.y-45;
      bul.push({x:bx,y:by,vx:d*15,bot:this.bot});
      fx(bx,by,'#e67e22',2);
      if(gs==='ONLINE_MODE'&&!this.bot)send({type:'bullet',x:bx,y:by,vx:d*15});
    }else{
      this.asw=-Math.PI/2.5;
      const foe=this.bot?P:B;
      if(!foe.rd){
        const sep=Math.abs(this.x-foe.x),fwd=(this.fl&&foe.x<this.x)||(!this.fl&&foe.x>this.x);
        if(sep<125&&fwd&&Math.abs(this.y-foe.y)<70){
          const dmg=this.wp==='Buster Sword'?24:35;
          if(gs==='ONLINE_MODE'&&!this.bot)send({type:'hit',a:dmg,kb:d});
          else foe.hit(dmg,d);
        }
      }
    }
  }
  update(){
    this.gy=H-100;
    if(this.rd){this.rp.forEach(p=>{p.vx*=.98;p.vy+=GV;p.x+=p.vx;p.y+=p.vy;p.ang+=p.va;if(p.y>=this.gy){p.y=this.gy;p.vy=-p.vy*.25;p.va*=.5;}});return;}
    if(gs==='MATCH_OVER'){this.vx*=.8;return;}
    if(this.ac>0)this.ac--;
    if(this.atk){this.asw+=.28;if(this.asw>=Math.PI/2){this.atk=false;this.asw=0;}}
    if(this.flp){this.fa+=this.fl?-.22:.22;if(Math.abs(this.fa)>=Math.PI*2){this.flp=false;this.fa=0;}}
    this.sq+=(1-this.sq)*.14;
    // Bot AI
    if(this.bot&&gs==='BOT_MODE'){
      const dist=Math.abs(this.x-P.x);this.fl=P.x<this.x;
      if(!P.rd){
        for(const b of bul)if(!b.bot&&Math.abs(this.x-b.x)<140&&this.gr){this.vy=-12;this.gr=false;this.jc=1;break;}
        let tx=P.x;
        if(!this.wp&&pku.length){let best=Infinity;for(const p of pku){const dd=Math.abs(this.x-p.x);if(dd<best){best=dd;tx=p.x;}}}
        if(this.x<tx-45)this.vx=3.8;else if(this.x>tx+45)this.vx=-3.8;else this.vx*=.5;
        if(this.gr&&this.jc===0&&dist<180&&Math.random()<.015){this.vy=-12;this.gr=false;this.jc=1;}
        if(dist<85||(this.wp==='Assault Rifle'&&dist<340))this.attack();
      }
    }
    // Player
    if(!this.bot){if(keys.a){this.vx=-5.5;this.fl=true;}else if(keys.d){this.vx=5.5;this.fl=false;}else this.vx*=.76;}
    this.vy+=GV;this.x+=this.vx;this.y+=this.vy;
    if(this.y>=this.gy){if(!this.gr){this.sq=.78;fx(this.x,this.gy,'#6a824e',2);}this.y=this.gy;this.vy=0;this.gr=true;this.jc=0;}
    else this.gr=false;
    this.x=Math.max(25,Math.min(W-25,this.x));
    if(Math.abs(this.vx)>.5&&this.gr)this.at+=.28;else if(!this.gr)this.at=1.1;else this.at*=.7;
  }
  draw(){
    if(this.rd){
      ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle=this.c;ctx.fillStyle=this.c;
      this.rp.forEach(p=>{
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.ang);ctx.beginPath();
        if(p.t==='c'){ctx.arc(0,0,p.s,0,Math.PI*2);ctx.fill();}else{ctx.moveTo(0,-p.s/2);ctx.lineTo(0,p.s/2);}
        ctx.stroke();ctx.restore();
      });return;
    }
    ctx.save();
    ctx.translate(this.x,this.y);ctx.scale(1,this.sq);ctx.translate(-this.x,-this.y);
    ctx.lineWidth=4;ctx.lineCap='round';
    let dc=this.c;if(this.ff>0){this.ff--;if(this.ff%2===0)dc='#fff';}
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
      ctx.save();ctx.translate(hx,hy3);if(this.fl)ctx.scale(-1,1);if(this.atk)ctx.rotate(this.asw);
      if(this.wp==='Buster Sword'){
        ctx.strokeStyle='#7f8c8d';ctx.fillStyle='#bdc3c7';ctx.lineWidth=3;
        ctx.beginPath();ctx.rect(0,-7,46,14);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#7a4a2a';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-8,0);ctx.stroke();
      }else if(this.wp==='Assault Rifle'){
        ctx.fillStyle='#2c3e50';ctx.fillRect(0,-5,32,10);ctx.fillStyle='#34495e';ctx.fillRect(10,2,6,7);
      }else{ctx.strokeStyle='#d35400';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(38,-3);ctx.stroke();}
      ctx.restore();
    }
    ctx.restore();
  }
}

let P,B;
function initE(){P=new S(200,'#2c3e50',false);B=new S(W-200,'#962d22',true);}

function spawnP(t,x){
  if(pku.length>=3)return;
  pku.push({type:t||WPS[Math.floor(Math.random()*WPS.length)],x:x!==undefined?x:Math.random()*(W-260)+130,y:H-115,bob:Math.random()*100});
}

// Firebase save
async function _save(){
  if(sv)return;sv=true;
  const won=ps>=MX;
  const u=window.FB?.currentUser?.();
  if(u){
    try{await FB.recordMatch(u.uid,won);}catch(e){console.warn(e);}
    try{const s=await FB.getMatchStats(u.uid);if(typeof showWL==='function')showWL(s.w||0,s.l||0);}catch(e){}
  }
}

function _start(){
  ps=0;bs=0;sv=false;bul.length=0;pku.length=0;ptl.length=0;
  g('psc').textContent='0 pts';g('osc').textContent='0 pts';
  rDrop();P.sx=200;P.respawn();B.sx=W-200;B.respawn();spawnP();
  const m=g('menu');m.style.opacity='0';
  setTimeout(()=>{m.style.display='none';g('hud').style.display='flex';if(mob)g('mc').style.display='flex';},400);
}

function startLocal(){
  gs='BOT_MODE';wasOnline=false;g('mbadge').style.display='none';
  g('plbl').textContent='YOU';g('olbl').textContent='AI';_start();
}
function startOnline(){
  gs='ONLINE_MODE';wasOnline=true;g('mbadge').style.display='block';
  g('plbl').textContent=isHost?'P1 (You)':'P2 (You)';g('olbl').textContent=isHost?'P2':'P1';
  _start();g('om').classList.remove('open');
}

function jump(){
  if(P.rd||gs!=='BOT_MODE'&&gs!=='ONLINE_MODE')return;
  if(P.gr){P.vy=-13;P.gr=false;P.jc=1;P.sq=1.25;fx(P.x,H-100,'#95a5a6',3);}
  else if(P.jc===1){P.vy=-9.8;P.jc=2;P.flp=true;P.fa=0;fx(P.x,P.y-30,'#ecf0f1',3);}
}

// Input
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(k==='a'||k==='arrowleft')keys.a=1;
  if(k==='d'||k==='arrowright')keys.d=1;
  if(k==='w'||k===' '||k==='arrowup'){e.preventDefault();jump();}
  if(k==='enter'&&gs==='MATCH_OVER')toMenu();
});
addEventListener('keyup',e=>{
  const k=e.key.toLowerCase();
  if(k==='a'||k==='arrowleft')keys.a=0;
  if(k==='d'||k==='arrowright')keys.d=0;
});
addEventListener('mousedown',()=>{if((gs==='BOT_MODE'||gs==='ONLINE_MODE')&&!P.rd&&!mob)P.attack();});
addEventListener('touchstart',()=>{if(gs==='MATCH_OVER')toMenu();});

function tc(id,dn,up){
  const e2=g(id);if(!e2)return;
  e2.addEventListener('touchstart',e=>{e.preventDefault();dn?.();},{passive:false});
  e2.addEventListener('touchend',e=>{e.preventDefault();up?.();},{passive:false});
  e2.addEventListener('touchcancel',e=>{e.preventDefault();up?.();},{passive:false});
}
tc('btn-left',()=>keys.a=1,()=>keys.a=0);
tc('btn-right',()=>keys.d=1,()=>keys.d=0);
tc('btn-jump',()=>jump(),null);
tc('btn-attack',()=>{if((gs==='BOT_MODE'||gs==='ONLINE_MODE')&&!P.rd)P.attack();},null);
g('start-btn').onclick=startLocal;
g('start-btn').addEventListener('touchstart',e=>{e.preventDefault();startLocal();},{passive:false});
g('online-btn').onclick=openOM;

function toMenu(){
  gs='MENU';keys.a=0;keys.d=0;bul.length=0;pku.length=0;ptl.length=0;
  if(conn){try{conn.close();}catch(e){}conn=null;}
  if(peer){try{peer.destroy();}catch(e){}peer=null;}
  g('hud').style.display='none';g('mc').style.display='none';g('mbadge').style.display='none';
  const m=g('menu');m.style.display='flex';m.style.opacity='1';
  const u=window.FB?.currentUser?.();
  if(u)FB.getMatchStats(u.uid).then(s=>typeof showWL==='function'&&showWL(s.w||0,s.l||0)).catch(()=>{});
}

// PeerJS
function genCode(){let s='';for(let i=0;i<4;i++)s+=CC[Math.floor(Math.random()*CC.length)];return s;}
window.openOM=openOM;window.closeOM=closeOM;window.switchTab=switchTab;window.joinGame=joinGame;

function openOM(){g('om').classList.add('open');switchTab('host');initHost();}
function closeOM(){
  g('om').classList.remove('open');
  if(conn){try{conn.close();}catch(e){}conn=null;}
  if(peer){try{peer.destroy();}catch(e){}peer=null;}
}
function switchTab(t){
  ['host','join'].forEach(x=>{g('t'+x[0]).classList.toggle('on',x===t);g('p'+x[0]).classList.toggle('on',x===t);});
  if(t==='host'&&!peer)initHost();
}
function initHost(){
  if(peer&&!peer.destroyed)return;
  isHost=true;const code=genCode();
  g('codebox').innerHTML=`<div class="codeval">${code}</div><div class="codehint">Share with your friend</div>`;
  setH('wait','<span class="sp"></span>Waiting for opponent…');
  peer=new Peer('floppy-'+code,{debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]}});
  peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();peer=null;setTimeout(initHost,500);return;}setH('err','❌ Error — try again');});
  peer.on('connection',c=>{conn=c;setH('conn','<span class="sp"></span>Connecting…');setupConn(c,false);});
}
function joinGame(){
  const raw=g('jinp').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(raw.length!==4){setJ('err','❌ Enter a 4-letter code');return;}
  if(peer&&!peer.destroyed){peer.destroy();peer=null;}
  isHost=false;setJ('conn','<span class="sp"></span>Connecting…');
  peer=new Peer(undefined,{debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}]}});
  peer.on('open',()=>{const c=peer.connect('floppy-'+raw,{reliable:true});conn=c;setupConn(c,true);});
  peer.on('error',e=>setJ('err','❌ '+(e.message||'Failed')));
}
function setupConn(c,joiner){
  c.on('open',()=>{if(joiner)setJ('ok','✅ Connected! Starting…');send({type:'ready'});});
  c.on('data',onMsg);
  c.on('close',()=>{if(gs==='ONLINE_MODE'){ps=MX;g('psc').textContent=ps+' pts';gs='MATCH_OVER';_save();}conn=null;});
  c.on('error',e=>{const m='❌ '+(e.message||'Error');joiner?setJ('err',m):setH('err',m);});
}

function onMsg(d){
  if(!d?.type)return;
  switch(d.type){
    case 'ready':
      if(isHost)setH('ok','✅ Connected! Starting…');setTimeout(startOnline,600);break;
    case 'state':
      if(gs!=='ONLINE_MODE')return;
      B.nx=d.x;B.ny=d.y;
      Object.assign(B,{vx:d.vx,vy:d.vy,fl:d.fl,at:d.at,gr:d.gr,sq:d.sq,atk:d.ia,asw:d.asw,flp:d.flp,fa:d.fa,wp:d.wp||null,rd:d.rd,ff:d.ff||0});
      if(d.rd&&!B.rp.length&&d.rp)B.rp=d.rp;
      g('b-hp').style.width=(d.hp||0)+'%';g('bwp').textContent=d.wp||'NONE';break;
    case 'hit':if(gs==='ONLINE_MODE')P.hit(d.a,d.kb);break;
    case 'bullet':bul.push({x:d.x,y:d.y,vx:d.vx,bot:true});break;
    case 'pickup_spawn':if(!isHost)spawnP(d.wt,d.px);break;
    case 'pickup_taken':if(pku[d.i]){if(!isHost&&d.bot)B.wp=d.wt;pku.splice(d.i,1);}break;
    case 'score':
      ps=isHost?d.hs:d.gs2;bs=isHost?d.gs2:d.hs;
      g('psc').textContent=ps+' pts';g('osc').textContent=bs+' pts';break;
    case 'over':gs='MATCH_OVER';_save();break;
    case 'ropp':B.respawn();break;
  }
}
function send(o){if(conn?.open)try{conn.send(o);}catch(e){}}
function setH(c,h){const e=g('hst');e.className='omst '+c;e.innerHTML=h;}
function setJ(c,h){const e=g('jst');e.style.display='block';e.className='omst '+c;e.innerHTML=h;}

// ── Loop ──────────────────────────────────────────────────────────────────
function loop(){
  requestAnimationFrame(loop);
  ctx.fillStyle='#87CEEB';ctx.fillRect(0,0,W,H);
  ctx.save();
  if(shk>0){ctx.translate((Math.random()-.5)*shk,(Math.random()-.5)*shk);shk*=.88;if(shk<.5)shk=0;}

  // Sky fade
  const sg=ctx.createLinearGradient(0,H*.5,0,H-100);
  sg.addColorStop(0,'rgba(224,244,255,0)');sg.addColorStop(1,'rgba(224,244,255,.6)');
  ctx.fillStyle=sg;ctx.fillRect(0,H*.5,W,H);

  // Clouds
  ctx.fillStyle='rgba(255,255,255,.75)';
  for(const c of clouds){c.x+=c.sp;if(c.x-c.sz>W)c.x=-c.sz;ctx.beginPath();ctx.arc(c.x,c.y,c.sz,0,Math.PI*2);ctx.arc(c.x+c.sz*.6,c.y-c.sz*.2,c.sz*.75,0,Math.PI*2);ctx.fill();}

  // Hills
  ctx.fillStyle='#9dc183';ctx.beginPath();ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=40)ctx.lineTo(x,(H-220)+Math.sin(x*.003)*35);
  ctx.lineTo(W,H);ctx.fill();
  ctx.fillStyle='#7da061';ctx.beginPath();ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=35)ctx.lineTo(x,(H-160)+Math.cos(x*.005)*20);
  ctx.lineTo(W,H);ctx.fill();

  // Ground
  ctx.fillStyle='#27ae60';ctx.fillRect(0,H-100,W,14);
  ctx.fillStyle='#795548';ctx.fillRect(0,H-86,W,86);

  if(gs==='BOT_MODE'||gs==='ONLINE_MODE'||gs==='MATCH_OVER'){
    if(gs==='BOT_MODE'||gs==='ONLINE_MODE'){
      dt--;g('droptimer').textContent='DROP: '+Math.max(0,dt/60).toFixed(1)+'s';
      if(dt<=0){
        if(gs==='BOT_MODE'||isHost){
          const wt=WPS[Math.floor(Math.random()*WPS.length)],px=Math.random()*(W-260)+130;
          spawnP(wt,px);if(gs==='ONLINE_MODE')send({type:'pickup_spawn',wt,px});
        }
        rDrop();
      }
    }

    P.update();
    if(gs==='BOT_MODE')B.update();
    else if(!B.rd){if(B.nx!==null)B.x+=(B.nx-B.x)*.3;if(B.ny!==null)B.y+=(B.ny-B.y)*.3;}
    else B.update();

    // Particles
    for(let i=ptl.length-1;i>=0;i--){
      const p=ptl[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.05;p.lf--;
      if(p.lf<=0||p.x<-10||p.x>W+10||p.y>H+10){ptl.splice(i,1);continue;}
      ctx.globalAlpha=p.lf/p.mx;ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;

    // Bullets
    for(let i=bul.length-1;i>=0;i--){
      const b=bul[i];b.x+=b.vx;
      if(b.x<-20||b.x>W+20){bul.splice(i,1);continue;}
      ctx.fillStyle='#e67e22';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();
      const tgt=b.bot?P:B;
      if(!tgt.rd&&b.x>tgt.x-28&&b.x<tgt.x+28&&b.y<tgt.y&&b.y>tgt.y-65){
        const dmg=12,kb=b.vx>0?1:-1;tgt.hit(dmg,kb);
        if(gs==='ONLINE_MODE'&&!b.bot)send({type:'hit',a:dmg,kb});
        bul.splice(i,1);
      }
    }

    // Pickups
    for(let i=pku.length-1;i>=0;i--){
      const p=pku[i];p.bob+=.06;const by=p.y+Math.sin(p.bob)*5;
      ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.x,p.y+12,14,3,0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#e8b84b';ctx.fillRect(p.x-12,by-12,24,24);
      ctx.strokeStyle='#c49a2a';ctx.lineWidth=2;ctx.strokeRect(p.x-12,by-12,24,24);
      ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.x-12,by);ctx.lineTo(p.x+12,by);ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x,by-12);ctx.lineTo(p.x,by+12);ctx.stroke();
      ctx.fillStyle='#2c3e50';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
      ctx.fillText(p.type.toUpperCase(),p.x,by-15);
      let picked=false;
      for(let j=0;j<2;j++){
        const ent=j===0?P:B,isB=j===1;
        if(!ent.rd&&Math.hypot(ent.x-p.x,(ent.y-30)-p.y)<38){
          ent.wp=p.type;if(!isB)g('pwp').textContent=p.type.toUpperCase();else g('bwp').textContent=p.type.toUpperCase();
          if(gs==='ONLINE_MODE'&&isHost)send({type:'pickup_taken',i,bot:isB,wt:p.type});
          pku.splice(i,1);picked=true;break;
        }
      }
      if(picked)continue;
    }

    P.draw();B.draw();

    // Net send every 2 frames
    if(gs==='ONLINE_MODE'&&conn?.open&&++nt>=2){
      nt=0;
      const m={type:'state',x:P.x,y:P.y,vx:P.vx,vy:P.vy,fl:P.fl,at:P.at,gr:P.gr,sq:P.sq,ia:P.atk,asw:P.asw,flp:P.flp,fa:P.fa,wp:P.wp,rd:P.rd,hp:P.hp,ff:P.ff};
      if(P.rd&&P.rp.length)m.rp=P.rp.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,ang:p.ang,va:p.va,t:p.t,s:p.s}));
      send(m);
    }
  }

  // Match over
  if(gs==='MATCH_OVER'){
    ctx.fillStyle='rgba(0,0,0,.48)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    const win=ps>=MX;
    ctx.font=`bold ${Math.min(58,W/7)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle=win?'#2ecc71':'#e74c3c';
    ctx.fillText(win?'🎉 YOU WIN!':'😢 YOU LOSE!',W/2,H/2-36);
    ctx.font=`bold ${Math.min(26,W/20)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle='#fff';
    ctx.fillText(`You: ${ps}  —  ${wasOnline?'Opponent':'AI'}: ${bs}`,W/2,H/2+12);
    ctx.font=`${Math.min(15,W/30)}px 'Segoe UI',sans-serif`;
    ctx.fillStyle='rgba(255,255,255,.65)';
    ctx.fillText(mob?'Tap to return':'Press [ENTER] to return',W/2,H/2+50);
  }
  ctx.restore();
}

resize();initClouds();initE();requestAnimationFrame(loop);
})();