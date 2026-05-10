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

const rectHit = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

const SKINS = {
  default: { body: null, eye: '#fff', pupil: 'rgba(0,0,0,.55)', shine: 'rgba(255,255,255,.35)', label: 'Default', jump: 1, accel: 1, air: 1 },
  ghost:   { body: 'rgba(220,230,255,.75)', eye: '#c4b5fd', pupil: 'rgba(60,20,120,.6)', shine: 'rgba(255,255,255,.5)', label: 'Ghost', jump: 1.06, accel: 0.95, air: 1.08 },
  neon:    { body: '#00ff88', eye: '#fff', pupil: '#004422', shine: 'rgba(255,255,255,.5)', label: 'Neon', jump: 1.02, accel: 1.08, air: 1.02 },
  fire:    { body: '#ff4400', eye: '#ffe066', pupil: '#7a2000', shine: 'rgba(255,200,50,.45)', label: 'Fire', jump: 1.1, accel: 1.0, air: 0.98 },
  void:    { body: '#0d0d1a', eye: '#818cf8', pupil: 'rgba(0,0,0,.9)', shine: 'rgba(130,140,250,.35)', label: 'Void', jump: 1.15, accel: 0.93, air: 1.12 },
  rainbow: { body: null, rainbow: true, eye: '#fff', pupil: '#333', shine: 'rgba(255,255,255,.4)', label: 'Rainbow', jump: 1.08, accel: 1.02, air: 1.0 }
};

function mkPlayer(sx, sy) {
  return {
    x: sx, y: sy, w: 24, h: 24,
    dx: 0, dy: 0, jumps: 0, maxJumps: 2,
    onWall: false, wallDir: 0, onGround: false,
    prevY: sy, prevX: sx, rotation: 0, spinSpeed: 0,
    sx, sy
  };
}

keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (/Space|ArrowUp|KeyW/.test(e.code) && running && !won) doJump();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function doJump() {
  const skin = currentSkin || SKINS.default;
  const jumpPow = 11.2 * skin.jump;
  if (player.onWall) {
    player.dy = -jumpPow;
    player.dx = -player.wallDir * 7.5 * skin.accel;
    player.jumps = 1;
    player.onWall = false;
    player.spinSpeed = player.wallDir * 0.18;
  } else if (player.jumps < player.maxJumps) {
    player.dy = -jumpPow;
    player.jumps++;
    const d = keys['KeyD'] || keys['ArrowRight'] ? 1 : keys['KeyA'] || keys['ArrowLeft'] ? -1 : player.dx > 0 ? 1 : -1;
    player.spinSpeed = d * 0.15;
  }
}

function setupTouch() {
  document.getElementById('touch-hud')?.remove();
  const hud = document.createElement('div');
  hud.id = 'touch-hud';
  hud.innerHTML = `<style>
#touch-hud{position:fixed;bottom:14px;left:0;width:100%;display:flex;justify-content:space-between;padding:0 16px;box-sizing:border-box;pointer-events:none;z-index:30}
.tb{width:60px;height:60px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;pointer-events:all;user-select:none;-webkit-user-select:none}
#t-dpad{display:flex;gap:12px}
</style>
<div id="t-dpad"><div class="tb" id="tl">◀</div><div class="tb" id="tr">▶</div></div>
<div class="tb" id="tj">▲</div>`;
  document.body.appendChild(hud);
  const bind = (id, code) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); keys[code] = true; }, { passive: false });
    el.addEventListener('touchend', e => { e.preventDefault(); keys[code] = false; }, { passive: false });
  };
  bind('tl', 'KeyA');
  bind('tr', 'KeyD');
  document.getElementById('tj').addEventListener('touchstart', e => {
    e.preventDefault();
    if (running && !won) doJump();
  }, { passive: false });
}

async function initGame(lvlNum) {
  currentLvl = lvlNum;
  won = false;
  running = true;

  const lvl = LEVELS[lvlNum];
  lvl.platforms.forEach(p => {
    if (p.moving) {
      p._t = 0;
      p._ox = p.x;
      p._oy = p.y;
    }
    p._lastX = p.x;
    p._lastY = p.y;
    if (p.falling) {
      p._timer = 0;
      p._fall = false;
      p._startY = p.y;
    }
  });

  player = mkPlayer(lvl.spawn.x, lvl.spawn.y);
  cam = { x: 0, y: 0 };
  timerStart = performance.now();
  elapsedMs = 0;

  const u = window.FB?.currentUser?.();
  if (u) {
    try {
      const sd = await window.FB.getSkinData(u.uid);
      activeSkin = sd.eq || 'default';
    } catch (_) {
      activeSkin = 'default';
    }
  } else {
    activeSkin = 'default';
  }

  currentSkin = SKINS[activeSkin] || SKINS.default;
  setupTouch();
  requestAnimationFrame(loop);
}

function resetPlayer() {
  player.x = player.sx;
  player.y = player.sy;
  player.dx = 0;
  player.dy = 0;
  player.jumps = 0;
  player.onWall = false;
  player.onGround = false;
  player.rotation = 0;
  player.spinSpeed = 0;
  timerStart = performance.now();
  elapsedMs = 0;
}

function updateCam(wW, wH) {
  cam.x += (player.x + player.w / 2 - VW / 2 - cam.x) * 0.12;
  cam.y += (player.y + player.h / 2 - VH / 2 - cam.y) * 0.12;
  cam.x = Math.max(0, Math.min(cam.x, wW - VW));
  cam.y = Math.max(0, Math.min(cam.y, wH - VH));
}

function applySurface(surface) {
  if (surface === 'ice') player.dx *= 0.995;
  else if (surface === 'mud') player.dx *= 0.75;
  else if (surface === 'conveyorL') player.x -= 1.0;
  else if (surface === 'conveyorR') player.x += 1.0;
}

function hazardOn(item, cycle, phase = 0) {
  if (cycle == null) return true;
  const t = (performance.now() / 16) % cycle;
  return t > phase && t < phase + cycle * 0.5;
}

function loop() {
  if (!running || won) return;

  const lvl = LEVELS[currentLvl];
  const skin = currentSkin || SKINS.default;
  elapsedMs = performance.now() - timerStart;

  for (const p of lvl.platforms) {
    p._lastX = p.x;
    p._lastY = p.y;
    if (p.moving) {
      p._t += p.moving.speed * 0.016;
      const off = Math.sin(p._t) * p.moving.range;
      if (p.moving.axis === 'x') p.x = p._ox + off;
      else p.y = p._oy + off;
    }
    if (p.falling) {
      p._timer++;
      if (!p._fall && p._timer > p.delay) p._fall = true;
      if (p._fall) p.y += p.fallSpeed;
    }
    p._dx = p.x - p._lastX;
    p._dy = p.y - p._lastY;
  }

  if (keys['KeyD'] || keys['ArrowRight']) player.dx += 0.82 * skin.accel;
  if (keys['KeyA'] || keys['ArrowLeft']) player.dx -= 0.82 * skin.accel;
  if (player.onGround) player.dx *= 0.84;
  else player.dx *= 0.985;

  player.dx = Math.max(-MAX_RUN_SPEED, Math.min(MAX_RUN_SPEED, player.dx));

  player.prevX = player.x;
  player.prevY = player.y;

  player.x += player.dx;
  player.dy += G;
  player.dy = Math.min(MAX_FALL_SPEED, player.dy);
  player.y += player.dy;

  player.x = Math.max(0, Math.min(player.x, lvl.w - player.w));

  if (player.y > lvl.h + 80) {
    resetPlayer();
    return requestAnimationFrame(loop);
  }

  player.onGround = false;
  player.onWall = false;

  for (const p of lvl.platforms) {
    if (!rectHit(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) continue;

    const fromTop = player.prevY + player.h <= p.y + 5 && player.dy >= 0;
    const fromBottom = player.prevY >= p.y + p.h - 5 && player.dy < 0;
    const fromLeft = player.prevX + player.w <= p.x + 5;
    const fromRight = player.prevX >= p.x + p.w - 5;

    if (fromTop) {
      player.y = p.y - player.h;
      player.dy = 0;
      player.jumps = 0;
      player.onGround = true;
      if (p._dx || p._dy) {
        player.x += p._dx;
        player.y += p._dy;
      }
      applySurface(p.surface);
    } else if (fromBottom) {
      player.y = p.y + p.h;
      player.dy = 0;
    } else if (fromLeft || fromRight) {
      player.onWall = true;
      player.wallDir = fromLeft ? -1 : 1;
      player.dx = 0;
      player.dy *= 0.75;
    }
  }

  for (const b of (lvl.bouncePads || [])) {
    if (rectHit(player.x, player.y, player.w, player.h, b.x, b.y, b.w, b.h) && player.dy > 0) {
      player.dy = -b.force;
      player.y = b.y - player.h;
      player.jumps = 0;
      player.spinSpeed = (player.dx > 0 ? 1 : -1) * 0.3;
    }
  }

  for (const fan of (lvl.windFans || [])) {
    if (rectHit(player.x - 20, player.y - 20, player.w + 40, player.h + 40, fan.x - 10, fan.y - 10, fan.w + 20, fan.h + 20)) {
      const f = Math.min(fan.force || 0, FAN_FORCE_CAP);
      if (fan.dir === 'up') player.dy -= f;
      if (fan.dir === 'down') player.dy += f;
      if (fan.dir === 'left') player.dx -= f;
      if (fan.dir === 'right') player.dx += f;
    }
  }

  for (const h of (lvl.hazards || [])) {
    if (rectHit(player.x, player.y, player.w, player.h, h.x, h.y, h.w, h.h)) {
      resetPlayer();
      return requestAnimationFrame(loop);
    }
  }

  for (const l of (lvl.lasers || [])) {
    if (hazardOn(l, l.cycle, l.phase || 0) && rectHit(player.x, player.y, player.w, player.h, l.x, l.y, l.w, l.h)) {
      resetPlayer();
      return requestAnimationFrame(loop);
    }
  }

  for (const s of (lvl.spikes || [])) {
    if (hazardOn(s, s.cycle, s.phase || 0) && rectHit(player.x, player.y, player.w, player.h, s.x, s.y, s.w, s.h)) {
      resetPlayer();
      return requestAnimationFrame(loop);
    }
  }

  for (const saw of (lvl.saws || [])) {
    const t = (performance.now() / 16) * saw.speed * 0.02 + (saw.phase || 0);
    const sx = saw.x + (saw.axis === 'x' ? Math.sin(t) * saw.range : 0);
    const sy = saw.y + (saw.axis === 'y' ? Math.sin(t) * saw.range : 0);
    if (rectHit(player.x, player.y, player.w, player.h, sx - saw.r, sy - saw.r, saw.r * 2, saw.r * 2)) {
      resetPlayer();
      return requestAnimationFrame(loop);
    }
  }

  if (!player.onGround) {
    player.rotation += player.spinSpeed;
    player.spinSpeed *= 0.98;
    if (Math.abs(player.spinSpeed) < 0.04) player.spinSpeed = player.dx * 0.012 * skin.air;
  }

  const g = lvl.goal;
  if (rectHit(player.x, player.y, player.w, player.h, g.x, g.y, g.w, g.h)) {
    won = true;
    running = false;
    const secs = elapsedMs / 1000;
    const u = window.FB?.currentUser?.();
    if (u) {
      window.FB.saveLevelTime(u.uid, currentLvl, secs)
        .then(res => drawWin(secs, res.isRecord, res.prev))
        .catch(() => drawWin(secs, false, null));
    } else {
      drawWin(secs, false, null);
    }
    return;
  }

  updateCam(lvl.w, lvl.h);
  draw(lvl);
  requestAnimationFrame(loop);
}

function draw(lvl) {
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, lvl.bgA);
  gr.addColorStop(1, lvl.bgB);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, VW, VH);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  for (const p of lvl.platforms) {
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, 5);
    ctx.fill();

    if (p.surface === 'ice') {
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(p.x, p.y + 2, p.w, 2);
    } else if (p.surface === 'mud') {
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
    } else if (p.surface === 'conveyorL' || p.surface === 'conveyorR') {
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < p.w; i += 12) ctx.fillRect(p.x + i, p.y + p.h / 2 - 1, 7, 2);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(p.surface === 'conveyorL' ? '◄◄◄' : '►►►', p.x + 8, p.y + 12);
    }

    if (p.moving) {
      ctx.strokeStyle = lvl.accent + '66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2, 5);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  for (const b of (lvl.bouncePads || [])) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.strokeStyle = lvl.accent;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const cx = b.x + (b.w / 4) * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - 4, b.y + b.h);
      ctx.lineTo(cx + 4, b.y + 2);
      ctx.stroke();
    }
    ctx.fillStyle = lvl.accent;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲', b.x + b.w / 2, b.y - 3);
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;
  }

  for (const fan of (lvl.windFans || [])) {
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.roundRect(fan.x, fan.y, fan.w, fan.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#fff4';
    ctx.strokeRect(fan.x, fan.y, fan.w, fan.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(fan.dir === 'up' ? '↑' : fan.dir === 'down' ? '↓' : fan.dir === 'left' ? '←' : '→', fan.x + 8, fan.y + 24);
  }

  for (const h of (lvl.hazards || [])) {
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.roundRect(h.x, h.y, h.w, h.h, 3);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    const n = Math.floor(h.w / 14);
    for (let i = 0; i < n; i++) {
      const sx = h.x + i * 14 + 7;
      ctx.beginPath();
      ctx.moveTo(sx - 5, h.y);
      ctx.lineTo(sx, h.y - 9);
      ctx.lineTo(sx + 5, h.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (const l of (lvl.lasers || [])) {
    if (hazardOn(l, l.cycle, l.phase || 0)) {
      ctx.fillStyle = '#ff4d6d';
      ctx.shadowColor = '#ff4d6d';
      ctx.shadowBlur = 18;
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.shadowBlur = 0;
    }
  }

  for (const s of (lvl.spikes || [])) {
    if (hazardOn(s, s.cycle, s.phase || 0)) {
      ctx.fillStyle = '#d946ef';
      const n = Math.max(1, Math.floor(s.w / 12));
      for (let i = 0; i < n; i++) {
        const x = s.x + i * 12;
        ctx.beginPath();
        ctx.moveTo(x, s.y + s.h);
        ctx.lineTo(x + 6, s.y);
        ctx.lineTo(x + 12, s.y + s.h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  for (const saw of (lvl.saws || [])) {
    const t = (performance.now() / 16) * saw.speed * 0.02 + (saw.phase || 0);
    const x = saw.x + (saw.axis === 'x' ? Math.sin(t) * saw.range : 0);
    const y = saw.y + (saw.axis === 'y' ? Math.sin(t) * saw.range : 0);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(x, y, saw.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * (saw.r + 5), y + Math.sin(a) * (saw.r + 5));
      ctx.stroke();
    }
  }

  const g = lvl.goal;
  ctx.fillStyle = lvl.accent;
  ctx.shadowColor = lvl.accent;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.roundRect(g.x, g.y, g.w, g.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', g.x + g.w / 2, g.y + g.h / 2 + 5);
  ctx.textAlign = 'left';

  drawPlayer(lvl.accent);
  ctx.restore();
  drawHUD(lvl);
}

function drawPlayer(accent) {
  const skin = currentSkin || SKINS.default;
  const hw = player.w / 2, hh = player.h / 2;

  ctx.save();
  ctx.translate(player.x + hw, player.y + hh);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(2, hh + 4, hw + 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.rotation);

  if (skin.rainbow) {
    const rg = ctx.createLinearGradient(-hw, -hh, hw, hh);
    const t = (Date.now() % 2000) / 2000;
    const hsl = h => `hsl(${(h * 360 + t * 360) % 360}, 100%, 60%)`;
    rg.addColorStop(0, hsl(0));
    rg.addColorStop(0.33, hsl(0.33));
    rg.addColorStop(0.66, hsl(0.66));
    rg.addColorStop(1, hsl(1));
    ctx.fillStyle = rg;
  } else {
    ctx.fillStyle = skin.body || accent;
  }

  ctx.beginPath();
  ctx.roundRect(-hw, -hh, player.w, player.h, 4);
  ctx.fill();

  ctx.fillStyle = skin.shine;
  ctx.beginPath();
  ctx.roundRect(-hw + 3, -hh + 3, hw - 2, hh - 2, 3);
  ctx.fill();

  ctx.fillStyle = skin.eye;
  ctx.beginPath();
  ctx.arc(-3, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.pupil;
  ctx.beginPath();
  ctx.arc(-3, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHUD(lvl) {
  const t = (elapsedMs / 1000).toFixed(2);
  ctx.fillStyle = 'rgba(0,0,0,.65)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 310, 30, 8);
  ctx.fill();
  ctx.fillStyle = lvl.accent;
  ctx.font = 'bold 11px Nunito,sans-serif';
  ctx.fillText(`LVL ${currentLvl}/${MAX_LEVELS} · ⏱ ${t}s · SKIN: ${(currentSkin || SKINS.default).label}`, 18, 30);
}

function drawWin(secs, isRecord, prev) {
  const lvl = LEVELS[currentLvl];
  ctx.fillStyle = 'rgba(0,0,0,.92)';
  ctx.fillRect(0, 0, VW, VH);
  const grd = ctx.createRadialGradient(VW / 2, VH / 2, 0, VW / 2, VH / 2, 200);
  grd.addColorStop(0, lvl.accent + '44');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = lvl.accent;
  ctx.shadowColor = lvl.accent;
  ctx.shadowBlur = 28;
  ctx.font = 'bold 46px Nunito,sans-serif';
  ctx.fillText('✓ LEVEL CLEAR!', VW / 2, VH / 2 - 64);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Nunito,sans-serif';
  ctx.fillText('⏱ ' + secs.toFixed(3) + 's', VW / 2, VH / 2 - 18);
  if (isRecord) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px Nunito,sans-serif';
    ctx.fillText('🏅 NEW PERSONAL BEST!' + (prev != null ? ` (prev: ${prev.toFixed(3)}s)` : ''), VW / 2, VH / 2 + 14);
  }
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = 'bold 14px Nunito,sans-serif';
  ctx.fillText(currentLvl >= MAX_LEVELS ? '🎉 YOU BEAT ALL 10 LEVELS!' : 'Level ' + (currentLvl + 1) + ' unlocked ★', VW / 2, VH / 2 + (isRecord ? 38 : 22));
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.font = '12px Nunito,sans-serif';
  ctx.fillText('Tap or click to continue', VW / 2, VH / 2 + (isRecord ? 62 : 46));
  ctx.textAlign = 'left';
  const back = () => location.reload();
  canvas.addEventListener('click', back, { once: true });
  canvas.addEventListener('touchend', back, { once: true });
}