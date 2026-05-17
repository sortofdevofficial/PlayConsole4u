const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const VW = 800, VH = 500;
canvas.width  = VW;
canvas.height = VH;

const G             = 0.48;
const MAX_RUN_SPEED = 4.2;
const MAX_FALL_SPEED= 12.5;
const FAN_CAP       = 0.55;

let cam, player, currentLvl, running, won, keys;
let timerStart = 0, elapsedMs = 0;

// Single fixed skin — no skin system
const CUBE = {
  body:   null,       // uses level accent
  shine:  'rgba(255,255,255,.28)',
  eyeW:   '#fff',
  pupil:  'rgba(0,0,0,.6)',
  glint:  'rgba(255,255,255,.65)',
};

const rectHit = (ax,ay,aw,ah,bx,by,bw,bh) =>
  ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;

function mkPlayer(sx,sy){
  return{ x:sx,y:sy,w:24,h:24,dx:0,dy:0,jumps:0,maxJumps:2,
    onWall:false,wallDir:0,onGround:false,
    prevX:sx,prevY:sy,rot:0,spin:0,sx,sy };
}

keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (/Space|ArrowUp|KeyW/.test(e.code) && running && !won) doJump();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function doJump(){
  if (player.onWall){
    player.dy   = -11.2;
    player.dx   = -player.wallDir * 7.5;
    player.jumps = 1;
    player.onWall = false;
    player.spin  = player.wallDir * 0.18;
  } else if (player.jumps < player.maxJumps){
    player.dy = -11.2;
    player.jumps++;
    const d = keys['KeyD']||keys['ArrowRight'] ? 1
             : keys['KeyA']||keys['ArrowLeft']  ? -1
             : player.dx > 0 ? 1 : -1;
    player.spin = d * 0.15;
  }
}

// Touch controls
function setupTouch(){
  document.getElementById('touch-hud')?.remove();
  const hud = document.createElement('div');
  hud.id = 'touch-hud';
  hud.innerHTML = `<style>
#touch-hud{
  position:fixed;bottom:0;left:0;width:100%;
  display:flex;justify-content:space-between;align-items:flex-end;
  padding:10px 14px 18px;box-sizing:border-box;
  pointer-events:none;z-index:30;
  background:linear-gradient(to top,rgba(0,0,0,.3),transparent);
}
.tb{width:62px;height:62px;background:rgba(255,255,255,.13);border:2px solid rgba(255,255,255,.26);border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;
  pointer-events:all;user-select:none;-webkit-user-select:none;backdrop-filter:blur(4px);transition:background .1s;}
.tb:active{background:rgba(255,255,255,.28)}
#t-dpad{display:flex;gap:12px}
#tj{background:rgba(124,58,237,.32);border-color:rgba(167,139,250,.55)}
#tj:active{background:rgba(124,58,237,.55)}
</style>
<div id="t-dpad"><div class="tb" id="tl">◀</div><div class="tb" id="tr">▶</div></div>
<div class="tb" id="tj">▲</div>`;
  document.body.appendChild(hud);
  const bind = (id, code) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e=>{e.preventDefault();keys[code]=true;},{passive:false});
    el.addEventListener('touchend',   e=>{e.preventDefault();keys[code]=false;},{passive:false});
  };
  bind('tl','KeyA'); bind('tr','KeyD');
  document.getElementById('tj').addEventListener('touchstart', e=>{
    e.preventDefault(); if(running&&!won) doJump();
  },{passive:false});
}

async function initGame(lvlNum){
  currentLvl = lvlNum;
  won = false; running = true;
  const lvl = LEVELS[lvlNum];
  lvl.platforms.forEach(p=>{
    if(p.moving){p._t=0;p._ox=p.x;p._oy=p.y;}
    p._lx=p.x;p._ly=p.y;
  });
  player = mkPlayer(lvl.spawn.x, lvl.spawn.y);
  cam    = {x:0,y:0};
  timerStart = performance.now();
  elapsedMs  = 0;
  setupTouch();
  requestAnimationFrame(loop);
}

function resetPlayer(){
  player.x=player.sx;player.y=player.sy;
  player.dx=0;player.dy=0;player.jumps=0;
  player.onWall=false;player.onGround=false;
  player.rot=0;player.spin=0;
  timerStart=performance.now();elapsedMs=0;
}

function updateCam(wW,wH){
  cam.x += (player.x+player.w/2-VW/2-cam.x)*0.12;
  cam.y += (player.y+player.h/2-VH/2-cam.y)*0.12;
  cam.x  = Math.max(0,Math.min(cam.x,wW-VW));
  cam.y  = Math.max(0,Math.min(cam.y,wH-VH));
}

function applySurface(s){
  if     (s==='ice')       player.dx*=0.995;
  else if(s==='mud')       player.dx*=0.75;
  else if(s==='conveyorL') player.x-=1;
  else if(s==='conveyorR') player.x+=1;
}

function hazardOn(item,cycle,phase=0){
  if(cycle==null)return true;
  const t=(performance.now()/16)%cycle;
  return t>phase && t<phase+cycle*0.5;
}

function loop(){
  if(!running||won)return;
  const lvl=LEVELS[currentLvl];
  elapsedMs=performance.now()-timerStart;

  // Move platforms
  for(const p of lvl.platforms){
    p._lx=p.x;p._ly=p.y;
    if(p.moving){
      p._t+=p.moving.speed*0.016;
      const off=Math.sin(p._t)*p.moving.range;
      if(p.moving.axis==='x') p.x=p._ox+off;
      else                    p.y=p._oy+off;
    }
    p._dx=p.x-p._lx;p._dy=p.y-p._ly;
  }

  // Player input
  if(keys['KeyD']||keys['ArrowRight']) player.dx+=0.82;
  if(keys['KeyA']||keys['ArrowLeft'])  player.dx-=0.82;
  player.dx*=player.onGround?0.84:0.985;
  player.dx=Math.max(-MAX_RUN_SPEED,Math.min(MAX_RUN_SPEED,player.dx));

  player.prevX=player.x;player.prevY=player.y;
  player.x+=player.dx;
  player.dy=Math.min(MAX_FALL_SPEED,player.dy+G);
  player.y+=player.dy;
  player.x=Math.max(0,Math.min(player.x,lvl.w-player.w));

  if(player.y>lvl.h+80){resetPlayer();return requestAnimationFrame(loop);}

  player.onGround=false;player.onWall=false;

  // Platform collisions
  for(const p of lvl.platforms){
    if(!rectHit(player.x,player.y,player.w,player.h,p.x,p.y,p.w,p.h))continue;
    const fT=player.prevY+player.h<=p.y+5  &&player.dy>=0;
    const fB=player.prevY          >=p.y+p.h-5&&player.dy<0;
    const fL=player.prevX+player.w<=p.x+5;
    const fR=player.prevX          >=p.x+p.w-5;
    if(fT){
      player.y=p.y-player.h;player.dy=0;player.jumps=0;player.onGround=true;
      if(p._dx||p._dy){player.x+=p._dx;player.y+=p._dy;}
      applySurface(p.surface);
    }else if(fB){
      player.y=p.y+p.h;player.dy=0;
    }else if(fL||fR){
      player.onWall=true;player.wallDir=fL?-1:1;
      player.dx=0;player.dy*=0.75;
    }
  }

  // Bounce pads
  for(const b of(lvl.bouncePads||[])){
    if(rectHit(player.x,player.y,player.w,player.h,b.x,b.y,b.w,b.h)&&player.dy>0){
      player.dy=-b.force;player.y=b.y-player.h;
      player.jumps=0;player.spin=(player.dx>0?1:-1)*0.3;
    }
  }

  // Wind fans
  for(const f of(lvl.windFans||[])){
    if(rectHit(player.x-20,player.y-20,player.w+40,player.h+40,f.x-10,f.y-10,f.w+20,f.h+20)){
      const force=Math.min(f.force||0,FAN_CAP);
      if(f.dir==='up')    player.dy-=force;
      if(f.dir==='down')  player.dy+=force;
      if(f.dir==='left')  player.dx-=force;
      if(f.dir==='right') player.dx+=force;
    }
  }

  // Static hazards
  for(const h of(lvl.hazards||[])){
    if(rectHit(player.x,player.y,player.w,player.h,h.x,h.y,h.w,h.h)){
      resetPlayer();return requestAnimationFrame(loop);
    }
  }

  // Lasers
  for(const l of(lvl.lasers||[])){
    if(hazardOn(l,l.cycle,l.phase||0)&&rectHit(player.x,player.y,player.w,player.h,l.x,l.y,l.w,l.h)){
      resetPlayer();return requestAnimationFrame(loop);
    }
  }

  // Timed spikes
  for(const s of(lvl.spikes||[])){
    if(hazardOn(s,s.cycle,s.phase||0)&&rectHit(player.x,player.y,player.w,player.h,s.x,s.y,s.w,s.h)){
      resetPlayer();return requestAnimationFrame(loop);
    }
  }

  // Spin in air
  if(!player.onGround){
    player.rot  +=player.spin;
    player.spin *=0.98;
    if(Math.abs(player.spin)<0.04) player.spin=player.dx*0.012;
  }

  // Goal
  const g=lvl.goal;
  if(rectHit(player.x,player.y,player.w,player.h,g.x,g.y,g.w,g.h)){
    won=true;running=false;
    const secs=elapsedMs/1000;
    const u=window.FB?.currentUser?.();
    if(u){
      window.FB.saveLevelTime(u.uid,currentLvl,secs)
        .then(async res=>{
          // Unlock next level if exists
          if(currentLvl<MAX_LEVELS) await window.FB.unlockLevel(u.uid,currentLvl+1);
          drawWin(secs,res.isRecord,res.prev);
        })
        .catch(()=>drawWin(secs,false,null));
    }else{
      drawWin(secs,false,null);
    }
    return;
  }

  updateCam(lvl.w,lvl.h);
  draw(lvl);
  requestAnimationFrame(loop);
}

/* ── DRAW ── */
function draw(lvl){
  const gr=ctx.createLinearGradient(0,0,0,VH);
  gr.addColorStop(0,lvl.bgA);gr.addColorStop(1,lvl.bgB);
  ctx.fillStyle=gr;ctx.fillRect(0,0,VW,VH);

  ctx.save();
  ctx.translate(-cam.x,-cam.y);

  // Platforms
  for(const p of lvl.platforms){
    ctx.fillStyle=p.c;
    ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,5);ctx.fill();
    if(p.surface==='ice'){
      ctx.fillStyle='rgba(180,225,255,.35)';
      ctx.fillRect(p.x+3,p.y+2,p.w-6,3);
    }else if(p.surface==='mud'){
      ctx.fillStyle='rgba(50,25,0,.2)';
      ctx.fillRect(p.x,p.y+p.h-4,p.w,4);
    }else if(p.surface==='conveyorL'||p.surface==='conveyorR'){
      ctx.fillStyle='rgba(255,255,255,.12)';
      for(let i=0;i<p.w;i+=12)ctx.fillRect(p.x+i,p.y+3,7,p.h-6);
      ctx.fillStyle='rgba(255,255,255,.45)';
      ctx.font='8px sans-serif';
      ctx.fillText(p.surface==='conveyorL'?'◄◄':'►►',p.x+5,p.y+p.h-4);
    }
    if(p.moving){
      ctx.strokeStyle=lvl.accent+'40';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(p.x+1,p.y+1,p.w-2,p.h-2,5);ctx.stroke();
      ctx.lineWidth=1;
    }
  }

  // Bounce pads
  for(const b of(lvl.bouncePads||[])){
    ctx.fillStyle='rgba(0,0,0,.12)';
    ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,4);ctx.fill();
    ctx.strokeStyle=lvl.accent;ctx.lineWidth=2;
    for(let i=0;i<4;i++){
      const cx=b.x+(b.w/4)*(i+.5);
      ctx.beginPath();ctx.moveTo(cx-4,b.y+b.h);ctx.lineTo(cx+4,b.y+2);ctx.stroke();
    }
    ctx.fillStyle=lvl.accent;ctx.font='bold 9px sans-serif';ctx.textAlign='center';
    ctx.fillText('▲',b.x+b.w/2,b.y-3);
    ctx.textAlign='left';ctx.lineWidth=1;
  }

  // Wind fans
  for(const f of(lvl.windFans||[])){
    ctx.fillStyle='rgba(100,180,255,.15)';
    ctx.beginPath();ctx.roundRect(f.x,f.y,f.w,f.h,6);ctx.fill();
    ctx.strokeStyle='rgba(100,180,255,.4)';ctx.lineWidth=1.5;
    ctx.strokeRect(f.x,f.y,f.w,f.h);
    ctx.fillStyle='rgba(160,215,255,.8)';ctx.font='bold 13px sans-serif';
    ctx.fillText(f.dir==='up'?'↑':f.dir==='down'?'↓':f.dir==='left'?'←':'→',f.x+6,f.y+25);
    ctx.lineWidth=1;
  }

  // Static hazards
  for(const h of(lvl.hazards||[])){
    ctx.fillStyle='#3f0000';
    ctx.beginPath();ctx.roundRect(h.x,h.y,h.w,h.h,3);ctx.fill();
    ctx.fillStyle='#ef4444';
    const n=Math.floor(h.w/14);
    for(let i=0;i<n;i++){
      const sx=h.x+i*14+7;
      ctx.beginPath();ctx.moveTo(sx-5,h.y);ctx.lineTo(sx,h.y-10);ctx.lineTo(sx+5,h.y);
      ctx.closePath();ctx.fill();
    }
  }

  // Lasers
  for(const l of(lvl.lasers||[])){
    if(hazardOn(l,l.cycle,l.phase||0)){
      ctx.fillStyle='#f43f5e';ctx.shadowColor='#f43f5e';ctx.shadowBlur=14;
      ctx.fillRect(l.x,l.y,l.w,l.h);ctx.shadowBlur=0;
    }else{
      ctx.fillStyle='rgba(244,63,94,.1)';ctx.fillRect(l.x,l.y,l.w,l.h);
    }
  }

  // Timed spikes
  for(const s of(lvl.spikes||[])){
    const on=hazardOn(s,s.cycle,s.phase||0);
    ctx.fillStyle=on?'#d946ef':'rgba(217,70,239,.18)';
    const n=Math.max(1,Math.floor(s.w/12));
    for(let i=0;i<n;i++){
      const x=s.x+i*12;
      ctx.beginPath();
      ctx.moveTo(x,s.y+s.h);ctx.lineTo(x+6,on?s.y:s.y+s.h*.4);ctx.lineTo(x+12,s.y+s.h);
      ctx.closePath();ctx.fill();
    }
  }

  // Goal
  const g=lvl.goal;
  ctx.fillStyle=lvl.accent;ctx.shadowColor=lvl.accent;ctx.shadowBlur=18;
  ctx.beginPath();ctx.roundRect(g.x,g.y,g.w,g.h,6);ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
  ctx.fillText('★',g.x+g.w/2,g.y+g.h/2+5);ctx.textAlign='left';

  drawCube(lvl.accent);
  ctx.restore();
  drawHUD(lvl);
}

function drawCube(accent){
  const hw=player.w/2, hh=player.h/2;
  ctx.save();
  ctx.translate(player.x+hw, player.y+hh);
  // Shadow
  ctx.fillStyle='rgba(0,0,0,.16)';
  ctx.beginPath();ctx.ellipse(2,hh+4,hw+2,4,0,0,Math.PI*2);ctx.fill();
  ctx.rotate(player.rot);
  // Body
  ctx.fillStyle=accent;
  ctx.beginPath();ctx.roundRect(-hw,-hh,player.w,player.h,4);ctx.fill();
  // Shine
  ctx.fillStyle=CUBE.shine;
  ctx.beginPath();ctx.roundRect(-hw+2,-hh+2,hw-1,hh-1,3);ctx.fill();
  // Eye white
  ctx.fillStyle=CUBE.eyeW;
  ctx.beginPath();ctx.arc(3,-2,4.5,0,Math.PI*2);ctx.fill();
  // Pupil
  ctx.fillStyle=CUBE.pupil;
  ctx.beginPath();ctx.arc(4,-1.5,2,0,Math.PI*2);ctx.fill();
  // Glint
  ctx.fillStyle=CUBE.glint;
  ctx.beginPath();ctx.arc(2.5,-2.8,0.9,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawHUD(lvl){
  const t=(elapsedMs/1000).toFixed(2);
  ctx.fillStyle='rgba(255,255,255,.82)';
  ctx.beginPath();ctx.roundRect(10,10,230,30,9);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.05)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(10,10,230,30,9);ctx.stroke();
  ctx.lineWidth=1;
  // Level badge
  ctx.fillStyle=lvl.accent;
  ctx.beginPath();ctx.roundRect(14,14,40,22,6);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 10px "DM Sans",sans-serif';ctx.textAlign='center';
  ctx.fillText('LV '+currentLvl,34,28);ctx.textAlign='left';
  // Timer
  ctx.fillStyle='#1a1625';ctx.font='bold 11px "DM Mono","DM Sans",sans-serif';
  ctx.fillText('⏱ '+t+'s',60,28);
}

function drawWin(secs,isRecord,prev){
  const lvl=LEVELS[currentLvl];
  ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(0,0,VW,VH);
  const grd=ctx.createRadialGradient(VW/2,VH/2,0,VW/2,VH/2,240);
  grd.addColorStop(0,lvl.accent+'22');grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd;ctx.fillRect(0,0,VW,VH);
  ctx.textAlign='center';
  ctx.fillStyle=lvl.accent;ctx.shadowColor=lvl.accent;ctx.shadowBlur=22;
  ctx.font='bold 44px "Syne","DM Sans",sans-serif';
  ctx.fillText('✓ LEVEL CLEAR!',VW/2,VH/2-62);ctx.shadowBlur=0;
  ctx.fillStyle='#1a1625';ctx.font='bold 28px "Syne","DM Sans",sans-serif';
  ctx.fillText('⏱ '+secs.toFixed(3)+'s',VW/2,VH/2-16);
  if(isRecord){
    ctx.fillStyle=lvl.accent;ctx.font='bold 13px "DM Sans",sans-serif';
    ctx.fillText('🏅 NEW BEST!'+(prev!=null?' (prev: '+prev.toFixed(3)+'s)':''),VW/2,VH/2+16);
  }
  ctx.fillStyle='#6b6579';ctx.font='bold 14px "DM Sans",sans-serif';
  ctx.fillText(
    currentLvl>=MAX_LEVELS?'🎉 YOU BEAT ALL LEVELS!':'Level '+(currentLvl+1)+' unlocked ★',
    VW/2,VH/2+(isRecord?44:26)
  );
  ctx.fillStyle='#a09ab0';ctx.font='12px "DM Sans",sans-serif';
  ctx.fillText('Tap or click to continue',VW/2,VH/2+(isRecord?68:50));
  ctx.textAlign='left';
  const back=()=>location.reload();
  canvas.addEventListener('click',back,{once:true});
  canvas.addEventListener('touchend',back,{once:true});
}