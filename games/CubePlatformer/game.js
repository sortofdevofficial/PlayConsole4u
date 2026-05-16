const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const VW = 800, VH = 500;
canvas.width = VW;
canvas.height = VH;

const G = 0.48;
const MAX_RUN_SPEED = 4.2;
const MAX_FALL_SPEED = 12.5;
const FAN_FORCE_CAP = 0.55;

let cam, player, currentLvl, running, won, keys;
let timerStart = 0, elapsedMs = 0;
let activeSkin = 'default';
let currentSkin = null;

const rectHit = (ax,ay,aw,ah,bx,by,bw,bh) =>
  ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;

const SKINS = {
  default:{ body:null,                      eye:'#fff', pupil:'rgba(0,0,0,.6)',    shine:'rgba(255,255,255,.32)', label:'Default', jump:1,    accel:1,    air:1    },
  ghost:  { body:'rgba(220,230,255,.78)',    eye:'#c4b5fd', pupil:'rgba(60,20,120,.6)', shine:'rgba(255,255,255,.45)', label:'Ghost',   jump:1.06, accel:0.95, air:1.08 },
  neon:   { body:'#00ff88',                 eye:'#fff', pupil:'#004422',           shine:'rgba(255,255,255,.45)', label:'Neon',    jump:1.02, accel:1.08, air:1.02 },
  fire:   { body:'#ff4400',                 eye:'#ffe066', pupil:'#7a2000',        shine:'rgba(255,200,50,.4)',   label:'Fire',    jump:1.1,  accel:1.0,  air:0.98 },
  void:   { body:'#0d0d1a',                 eye:'#818cf8', pupil:'rgba(0,0,0,.9)', shine:'rgba(130,140,250,.32)',label:'Void',    jump:1.15, accel:0.93, air:1.12 },
  rainbow:{ body:null, rainbow:true,        eye:'#fff', pupil:'#222',              shine:'rgba(255,255,255,.38)', label:'Rainbow', jump:1.08, accel:1.02, air:1.0  }
};

function mkPlayer(sx, sy){
  return {
    x:sx, y:sy, w:24, h:24,
    dx:0, dy:0, jumps:0, maxJumps:2,
    onWall:false, wallDir:0, onGround:false,
    prevY:sy, prevX:sx, rotation:0, spinSpeed:0,
    sx, sy
  };
}

keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (/Space|ArrowUp|KeyW/.test(e.code) && running && !won) doJump();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function doJump(){
  const skin    = currentSkin || SKINS.default;
  const jumpPow = 11.2 * skin.jump;
  if (player.onWall){
    player.dy       = -jumpPow;
    player.dx       = -player.wallDir * 7.5 * skin.accel;
    player.jumps    = 1;
    player.onWall   = false;
    player.spinSpeed = player.wallDir * 0.18;
  } else if (player.jumps < player.maxJumps){
    player.dy = -jumpPow;
    player.jumps++;
    const d = keys['KeyD']||keys['ArrowRight'] ? 1
             : keys['KeyA']||keys['ArrowLeft']  ? -1
             : player.dx > 0 ? 1 : -1;
    player.spinSpeed = d * 0.15;
  }
}

function setupTouch(){
  document.getElementById('touch-hud')?.remove();
  const hud = document.createElement('div');
  hud.id = 'touch-hud';
  hud.innerHTML = `<style>
#touch-hud{
  position:fixed;bottom:0;left:0;width:100%;
  display:flex;justify-content:space-between;align-items:flex-end;
  padding:12px 16px 20px;box-sizing:border-box;
  pointer-events:none;z-index:30;
  background:linear-gradient(to top,rgba(0,0,0,.28),transparent);
}
.tb{
  width:64px;height:64px;
  background:rgba(255,255,255,.14);
  border:2px solid rgba(255,255,255,.28);
  border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:22px;color:#fff;
  pointer-events:all;user-select:none;-webkit-user-select:none;
  backdrop-filter:blur(4px);transition:background .1s;
}
.tb:active{background:rgba(255,255,255,.28)}
#t-dpad{display:flex;gap:14px}
#tj{background:rgba(91,58,247,.32);border-color:rgba(139,111,255,.55)}
#tj:active{background:rgba(91,58,247,.55)}
</style>
<div id="t-dpad">
  <div class="tb" id="tl">◀</div>
  <div class="tb" id="tr">▶</div>
</div>
<div class="tb" id="tj">▲</div>`;
  document.body.appendChild(hud);
  const bind = (id, code) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); keys[code] = true; }, {passive:false});
    el.addEventListener('touchend',   e => { e.preventDefault(); keys[code] = false; }, {passive:false});
  };
  bind('tl', 'KeyA');
  bind('tr', 'KeyD');
  document.getElementById('tj').addEventListener('touchstart', e => {
    e.preventDefault();
    if (running && !won) doJump();
  }, {passive:false});
}

async function initGame(lvlNum){
  currentLvl = lvlNum;
  won = false; running = true;
  const lvl = LEVELS[lvlNum];
  lvl.platforms.forEach(p => {
    if (p.moving){ p._t = 0; p._ox = p.x; p._oy = p.y; }
    p._lastX = p.x; p._lastY = p.y;
  });
  player = mkPlayer(lvl.spawn.x, lvl.spawn.y);
  cam = {x:0, y:0};
  timerStart = performance.now();
  elapsedMs  = 0;
  const u = window.FB?.currentUser?.();
  if (u){
    try { const sd = await window.FB.getSkinData(u.uid); activeSkin = sd.eq || 'default'; }
    catch (_){ activeSkin = 'default'; }
  } else { activeSkin = 'default'; }
  currentSkin = SKINS[activeSkin] || SKINS.default;
  setupTouch();
  requestAnimationFrame(loop);
}

function resetPlayer(){
  player.x = player.sx; player.y = player.sy;
  player.dx = 0; player.dy = 0; player.jumps = 0;
  player.onWall = false; player.onGround = false;
  player.rotation = 0; player.spinSpeed = 0;
  timerStart = performance.now(); elapsedMs = 0;
}

function updateCam(wW, wH){
  cam.x += (player.x + player.w/2 - VW/2 - cam.x) * 0.12;
  cam.y += (player.y + player.h/2 - VH/2 - cam.y) * 0.12;
  cam.x = Math.max(0, Math.min(cam.x, wW - VW));
  cam.y = Math.max(0, Math.min(cam.y, wH - VH));
}

function applySurface(surface){
  if      (surface === 'ice')       player.dx *= 0.995;
  else if (surface === 'mud')       player.dx *= 0.75;
  else if (surface === 'conveyorL') player.x  -= 1.0;
  else if (surface === 'conveyorR') player.x  += 1.0;
}

function hazardOn(item, cycle, phase = 0){
  if (cycle == null) return true;
  const t = (performance.now() / 16) % cycle;
  return t > phase && t < phase + cycle * 0.5;
}

function loop(){
  if (!running || won) return;
  const lvl  = LEVELS[currentLvl];
  const skin = currentSkin || SKINS.default;
  elapsedMs  = performance.now() - timerStart;

  // Move platforms
  for (const p of lvl.platforms){
    p._lastX = p.x; p._lastY = p.y;
    if (p.moving){
      p._t += p.moving.speed * 0.016;
      const off = Math.sin(p._t) * p.moving.range;
      if (p.moving.axis === 'x') p.x = p._ox + off;
      else                       p.y = p._oy + off;
    }
    p._dx = p.x - p._lastX;
    p._dy = p.y - p._lastY;
  }

  // Player movement
  if (keys['KeyD'] || keys['ArrowRight']) player.dx +=  0.82 * skin.accel;
  if (keys['KeyA'] || keys['ArrowLeft'])  player.dx -=  0.82 * skin.accel;
  player.dx *= player.onGround ? 0.84 : 0.985;
  player.dx  = Math.max(-MAX_RUN_SPEED, Math.min(MAX_RUN_SPEED, player.dx));

  player.prevX = player.x; player.prevY = player.y;
  player.x += player.dx;
  player.dy += G;
  player.dy  = Math.min(MAX_FALL_SPEED, player.dy);
  player.y  += player.dy;
  player.x   = Math.max(0, Math.min(player.x, lvl.w - player.w));

  if (player.y > lvl.h + 80){ resetPlayer(); return requestAnimationFrame(loop); }

  player.onGround = false;
  player.onWall   = false;

  // Platform collisions
  for (const p of lvl.platforms){
    if (!rectHit(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) continue;
    const fromTop    = player.prevY + player.h <= p.y + 5   && player.dy >= 0;
    const fromBottom = player.prevY             >= p.y+p.h-5 && player.dy  < 0;
    const fromLeft   = player.prevX + player.w <= p.x + 5;
    const fromRight  = player.prevX             >= p.x+p.w-5;
    if (fromTop){
      player.y = p.y - player.h; player.dy = 0;
      player.jumps = 0; player.onGround = true;
      if (p._dx || p._dy){ player.x += p._dx; player.y += p._dy; }
      applySurface(p.surface);
    } else if (fromBottom){
      player.y = p.y + p.h; player.dy = 0;
    } else if (fromLeft || fromRight){
      player.onWall   = true;
      player.wallDir  = fromLeft ? -1 : 1;
      player.dx       = 0;
      player.dy      *= 0.75;
    }
  }

  // Bounce pads
  for (const b of (lvl.bouncePads || [])){
    if (rectHit(player.x,player.y,player.w,player.h,b.x,b.y,b.w,b.h) && player.dy > 0){
      player.dy = -b.force; player.y = b.y - player.h;
      player.jumps = 0; player.spinSpeed = (player.dx > 0 ? 1 : -1) * 0.3;
    }
  }

  // Wind fans
  for (const fan of (lvl.windFans || [])){
    if (rectHit(player.x-20,player.y-20,player.w+40,player.h+40,fan.x-10,fan.y-10,fan.w+20,fan.h+20)){
      const f = Math.min(fan.force || 0, FAN_FORCE_CAP);
      if (fan.dir==='up')    player.dy -= f;
      if (fan.dir==='down')  player.dy += f;
      if (fan.dir==='left')  player.dx -= f;
      if (fan.dir==='right') player.dx += f;
    }
  }

  // Static hazards
  for (const h of (lvl.hazards || [])){
    if (rectHit(player.x,player.y,player.w,player.h,h.x,h.y,h.w,h.h)){
      resetPlayer(); return requestAnimationFrame(loop);
    }
  }

  // Lasers
  for (const l of (lvl.lasers || [])){
    if (hazardOn(l,l.cycle,l.phase||0) && rectHit(player.x,player.y,player.w,player.h,l.x,l.y,l.w,l.h)){
      resetPlayer(); return requestAnimationFrame(loop);
    }
  }

  // Timed spikes
  for (const s of (lvl.spikes || [])){
    if (hazardOn(s,s.cycle,s.phase||0) && rectHit(player.x,player.y,player.w,player.h,s.x,s.y,s.w,s.h)){
      resetPlayer(); return requestAnimationFrame(loop);
    }
  }

  // Spin in air
  if (!player.onGround){
    player.rotation  += player.spinSpeed;
    player.spinSpeed *= 0.98;
    if (Math.abs(player.spinSpeed) < 0.04)
      player.spinSpeed = player.dx * 0.012 * skin.air;
  }

  // Goal
  const g = lvl.goal;
  if (rectHit(player.x,player.y,player.w,player.h,g.x,g.y,g.w,g.h)){
    won = true; running = false;
    const secs = elapsedMs / 1000;
    const u    = window.FB?.currentUser?.();
    if (u){
      window.FB.saveLevelTime(u.uid, currentLvl, secs)
        .then(res => drawWin(secs, res.isRecord, res.prev))
        .catch(()  => drawWin(secs, false, null));
    } else {
      drawWin(secs, false, null);
    }
    return;
  }

  updateCam(lvl.w, lvl.h);
  draw(lvl);
  requestAnimationFrame(loop);
}

/* ─── DRAW ─── */
function draw(lvl){
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, lvl.bgA);
  gr.addColorStop(1, lvl.bgB);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, VW, VH);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // ── Platforms ──
  for (const p of lvl.platforms){
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 5); ctx.fill();

    if (p.surface === 'ice'){
      ctx.fillStyle = 'rgba(180,220,255,.4)';
      ctx.fillRect(p.x+3, p.y+2, p.w-6, 3);
    } else if (p.surface === 'mud'){
      ctx.fillStyle = 'rgba(60,30,0,.18)';
      ctx.fillRect(p.x, p.y+p.h-4, p.w, 4);
    } else if (p.surface === 'conveyorL' || p.surface === 'conveyorR'){
      const offset = ((performance.now() / 60) % 12) * (p.surface === 'conveyorL' ? -1 : 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      for (let i = -12; i < p.w + 12; i += 12){
        const x = p.x + ((i + offset) % 12 + 12) % 12 + (i - ((i + offset) % 12 + 12) % 12);
        ctx.fillRect(x, p.y + 3, 7, p.h - 6);
      }
      // Arrow hint
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(p.surface === 'conveyorL' ? '◄◄' : '►►', p.x+5, p.y+p.h-4);
    }

    if (p.moving){
      ctx.strokeStyle = lvl.accent + '44';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x+1,p.y+1,p.w-2,p.h-2,5); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  // ── Bounce pads ──
  for (const b of (lvl.bouncePads || [])){
    ctx.fillStyle = 'rgba(0,0,0,.1)';
    ctx.beginPath(); ctx.roundRect(b.x,b.y,b.w,b.h,4); ctx.fill();
    ctx.strokeStyle = lvl.accent; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++){
      const cx = b.x + (b.w/4)*(i+0.5);
      ctx.beginPath(); ctx.moveTo(cx-4,b.y+b.h); ctx.lineTo(cx+4,b.y+2); ctx.stroke();
    }
    ctx.fillStyle = lvl.accent;
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▲', b.x+b.w/2, b.y-3);
    ctx.textAlign = 'left'; ctx.lineWidth = 1;
  }

  // ── Wind fans ──
  for (const fan of (lvl.windFans || [])){
    ctx.fillStyle = 'rgba(100,180,255,.16)';
    ctx.beginPath(); ctx.roundRect(fan.x,fan.y,fan.w,fan.h,6); ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,.45)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(fan.x, fan.y, fan.w, fan.h);
    ctx.fillStyle = 'rgba(160,210,255,.85)';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(
      fan.dir==='up'?'↑':fan.dir==='down'?'↓':fan.dir==='left'?'←':'→',
      fan.x+6, fan.y+25
    );
    ctx.lineWidth = 1;
  }

  // ── Static hazards (ground spikes) ──
  for (const h of (lvl.hazards || [])){
    ctx.fillStyle = '#3f0000';
    ctx.beginPath(); ctx.roundRect(h.x,h.y,h.w,h.h,3); ctx.fill();
    ctx.fillStyle = '#ef4444';
    const n = Math.floor(h.w / 14);
    for (let i = 0; i < n; i++){
      const sx = h.x + i*14 + 7;
      ctx.beginPath();
      ctx.moveTo(sx-5, h.y); ctx.lineTo(sx, h.y-10); ctx.lineTo(sx+5, h.y);
      ctx.closePath(); ctx.fill();
    }
  }

  // ── Lasers ──
  for (const l of (lvl.lasers || [])){
    if (hazardOn(l, l.cycle, l.phase||0)){
      ctx.fillStyle   = '#f43f5e';
      ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 14;
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.shadowBlur  = 0;
    } else {
      ctx.fillStyle = 'rgba(244,63,94,.12)';
      ctx.fillRect(l.x, l.y, l.w, l.h);
    }
  }

  // ── Timed spikes ──
  for (const s of (lvl.spikes || [])){
    const on = hazardOn(s, s.cycle, s.phase||0);
    ctx.fillStyle = on ? '#d946ef' : 'rgba(217,70,239,.2)';
    const n = Math.max(1, Math.floor(s.w/12));
    for (let i = 0; i < n; i++){
      const x = s.x + i*12;
      ctx.beginPath();
      ctx.moveTo(x, s.y+s.h); ctx.lineTo(x+6, on ? s.y : s.y+s.h*0.4); ctx.lineTo(x+12, s.y+s.h);
      ctx.closePath(); ctx.fill();
    }
  }

  // ── Goal ──
  const g = lvl.goal;
  ctx.fillStyle   = lvl.accent;
  ctx.shadowColor = lvl.accent; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 6); ctx.fill();
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('★', g.x+g.w/2, g.y+g.h/2+5);
  ctx.textAlign   = 'left';

  drawPlayer(lvl.accent);
  ctx.restore();
  drawHUD(lvl);
}

// ── Draw player cube — NO text, just geometry ──
function drawPlayer(accent){
  const skin = currentSkin || SKINS.default;
  const hw   = player.w / 2;
  const hh   = player.h / 2;

  ctx.save();
  ctx.translate(player.x + hw, player.y + hh);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath();
  ctx.ellipse(2, hh+4, hw+2, 4, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.rotate(player.rotation);

  // Body
  if (skin.rainbow){
    const rg = ctx.createLinearGradient(-hw,-hh,hw,hh);
    const t  = (Date.now() % 2000) / 2000;
    const hsl = h => `hsl(${(h*360 + t*360) % 360},100%,55%)`;
    rg.addColorStop(0,    hsl(0));
    rg.addColorStop(0.33, hsl(0.33));
    rg.addColorStop(0.66, hsl(0.66));
    rg.addColorStop(1,    hsl(1));
    ctx.fillStyle = rg;
  } else {
    ctx.fillStyle = skin.body || accent;
  }
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, player.w, player.h, 4);
  ctx.fill();

  // Shine highlight (top-left corner)
  ctx.fillStyle = skin.shine;
  ctx.beginPath();
  ctx.roundRect(-hw+2, -hh+2, hw-1, hh-1, 3);
  ctx.fill();

  // Eye white — single circle, no text
  ctx.fillStyle = skin.eye;
  ctx.beginPath();
  ctx.arc(3, -2, 4.5, 0, Math.PI*2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = skin.pupil;
  ctx.beginPath();
  ctx.arc(4, -1.5, 2, 0, Math.PI*2);
  ctx.fill();

  // Pupil glint
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath();
  ctx.arc(3, -2.5, 0.8, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

// ── HUD ──
function drawHUD(lvl){
  const t         = (elapsedMs / 1000).toFixed(2);
  const skinLabel = (currentSkin || SKINS.default).label;

  // Pill background
  ctx.fillStyle = 'rgba(255,255,255,.84)';
  ctx.beginPath(); ctx.roundRect(10, 10, 290, 30, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(10, 10, 290, 30, 9); ctx.stroke();
  ctx.lineWidth = 1;

  // Level badge
  ctx.fillStyle = lvl.accent;
  ctx.beginPath(); ctx.roundRect(14, 14, 42, 22, 6); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px "DM Sans",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('LV ' + currentLvl, 35, 28);
  ctx.textAlign = 'left';

  // Timer
  ctx.fillStyle = '#1a1625';
  ctx.font = 'bold 11px "DM Mono","DM Sans",sans-serif';
  ctx.fillText('⏱ ' + t + 's', 63, 28);

  // Skin name
  ctx.fillStyle = lvl.accent;
  ctx.font = '10px "DM Sans",sans-serif';
  ctx.fillText('· ' + skinLabel, 148, 28);
}

// ── Win screen ──
function drawWin(secs, isRecord, prev){
  const lvl = LEVELS[currentLvl];

  // Frosted white overlay
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fillRect(0, 0, VW, VH);

  // Accent radial glow
  const grd = ctx.createRadialGradient(VW/2, VH/2, 0, VW/2, VH/2, 240);
  grd.addColorStop(0, lvl.accent + '22');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, VW, VH);

  ctx.textAlign = 'center';

  // Title
  ctx.fillStyle   = lvl.accent;
  ctx.shadowColor = lvl.accent; ctx.shadowBlur = 22;
  ctx.font = 'bold 44px "Syne","DM Sans",sans-serif';
  ctx.fillText('✓ LEVEL CLEAR!', VW/2, VH/2-62);
  ctx.shadowBlur = 0;

  // Time
  ctx.fillStyle = '#1a1625';
  ctx.font = 'bold 28px "Syne","DM Sans",sans-serif';
  ctx.fillText('⏱ ' + secs.toFixed(3) + 's', VW/2, VH/2-16);

  // Personal best
  if (isRecord){
    ctx.fillStyle = lvl.accent;
    ctx.font = 'bold 13px "DM Sans",sans-serif';
    ctx.fillText(
      '🏅 NEW PERSONAL BEST!' + (prev != null ? ` (prev: ${prev.toFixed(3)}s)` : ''),
      VW/2, VH/2+16
    );
  }

  // Unlock message
  ctx.fillStyle = '#6b6579';
  ctx.font = 'bold 14px "DM Sans",sans-serif';
  ctx.fillText(
    currentLvl >= MAX_LEVELS ? '🎉 YOU BEAT ALL 10 LEVELS!' : 'Level ' + (currentLvl+1) + ' unlocked ★',
    VW/2, VH/2 + (isRecord ? 44 : 26)
  );

  // Tap hint
  ctx.fillStyle = '#a09ab0';
  ctx.font = '12px "DM Sans",sans-serif';
  ctx.fillText('Tap or click to continue', VW/2, VH/2 + (isRecord ? 68 : 50));
  ctx.textAlign = 'left';

  const back = () => location.reload();
  canvas.addEventListener('click',    back, {once:true});
  canvas.addEventListener('touchend', back, {once:true});
}