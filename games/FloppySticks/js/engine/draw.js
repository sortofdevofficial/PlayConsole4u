/**
 * FloppySticks — draw.js v2.1
 * Cozy daytime nature visuals, warm VFX, soft overlays.
 * Load order: stickman.js → network.js → draw.js → game.js
 */

'use strict';

// ── Birds (ambient life) ──────────────────────────────────────────────────────
let birds = [];
function initBirds() {
  birds = [];
  for (let i = 0; i < 6; i++)
    birds.push({
      x:  Math.random() * W,
      y:  Math.random() * (H * .3) + 30,
      sp: Math.random() * .6 + .3,
      flap: Math.random() * Math.PI * 2,
      sz: Math.random() * 4 + 3
    });
}

// ── Leaves (ambient particles) ────────────────────────────────────────────────
let leaves = [];
function initLeaves() {
  leaves = [];
  for (let i = 0; i < 12; i++)
    leaves.push({
      x:  Math.random() * W,
      y:  Math.random() * (H - 120),
      vx: -(Math.random() * .4 + .1),
      vy: Math.random() * .3 + .1,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - .5) * .04,
      sz: Math.random() * 4 + 3,
      c:  ['#a3be55','#7aab3a','#d4a847','#c8773a'][Math.floor(Math.random()*4)]
    });
}

// ── Background ────────────────────────────────────────────────────────────────
function drawBackground() {
  ctx.save();

  // Screen shake
  if (shk > 0) {
    ctx.translate((Math.random() - .5) * shk, (Math.random() - .5) * shk);
    shk *= .84;
    if (shk < .4) shk = 0;
  }

  // Warm daytime sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,    '#7ec8e3');  // bright sky blue
  sky.addColorStop(.42,  '#aad9f0');  // pale mid blue
  sky.addColorStop(.72,  '#d4eecc');  // horizon green-white
  sky.addColorStop(1,    '#c8e6a0');  // soft lime near ground
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun
  const sx = W * .15, sy = H * .13;
  const sunGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 120);
  sunGlow.addColorStop(0,   'rgba(255,240,160,.55)');
  sunGlow.addColorStop(.35, 'rgba(255,220,80,.18)');
  sunGlow.addColorStop(1,   'transparent');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, W * .5, H * .5);

  ctx.fillStyle = '#fff8d0';
  ctx.beginPath(); ctx.arc(sx, sy, 28, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI*2); ctx.fill();

  // Clouds (fluffy warm white)
  for (let ci = 0; ci < clouds.length; ci++) {
    const c = clouds[ci];
    c.x += c.sp;
    if (c.x - c.sz * 2 > W) c.x = -c.sz * 2;
    _drawCloud(ctx, c.x, c.y, c.sz);
  }

  // Birds
  const t = Date.now() * .001;
  ctx.strokeStyle = 'rgba(50,60,80,.55)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (const b of birds) {
    b.x += b.sp;
    b.flap += .07;
    if (b.x > W + 40) { b.x = -40; b.y = Math.random() * H * .28 + 30; }
    const wing = Math.sin(b.flap) * b.sz * .7;
    ctx.beginPath();
    ctx.moveTo(b.x - b.sz, b.y + wing);
    ctx.quadraticCurveTo(b.x, b.y - b.sz * .4, b.x + b.sz, b.y + wing);
    ctx.stroke();
  }

  // Far mountains — soft purple/blue haze
  ctx.fillStyle = 'rgba(150,170,200,.38)';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 55)
    ctx.lineTo(x, (H - 280) + Math.sin(x * .0022 + 1) * 70 + Math.cos(x * .006) * 35);
  ctx.lineTo(W, H); ctx.fill();

  // Mid hills — darker green
  ctx.fillStyle = '#5a9e4a';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40)
    ctx.lineTo(x, (H - 200) + Math.sin(x * .0035 + 2.5) * 45 + Math.cos(x * .009) * 20);
  ctx.lineTo(W, H); ctx.fill();

  // Trees on mid hill
  _drawTreeLine(ctx, H - 195, 14, 26);

  // Near hills — warm bright green
  ctx.fillStyle = '#7bc15a';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 30)
    ctx.lineTo(x, (H - 148) + Math.cos(x * .005 + 1) * 28 + Math.sin(x * .013) * 10);
  ctx.lineTo(W, H); ctx.fill();

  // Ambient leaves drifting
  for (const lf of leaves) {
    lf.x += lf.vx; lf.y += lf.vy; lf.rot += lf.vr;
    if (lf.y > H - 90) { lf.y = -10; lf.x = Math.random() * W; }
    ctx.save();
    ctx.translate(lf.x, lf.y);
    ctx.rotate(lf.rot);
    ctx.fillStyle = lf.c;
    ctx.globalAlpha = .65;
    ctx.beginPath();
    ctx.ellipse(0, 0, lf.sz, lf.sz * .5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Grass surface
  const grassGrad = ctx.createLinearGradient(0, H-103, 0, H-90);
  grassGrad.addColorStop(0, '#8ed45a');
  grassGrad.addColorStop(1, '#6ab840');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, H - 103, W, 16);

  // Grass top fringe (individual blade wisps)
  ctx.strokeStyle = '#9be060';
  ctx.lineWidth = 1.5;
  for (let x = 8; x < W; x += 14) {
    const sway = Math.sin(Date.now() * .001 + x * .05) * 2;
    ctx.beginPath();
    ctx.moveTo(x, H - 103);
    ctx.quadraticCurveTo(x + sway, H - 112, x + sway * 1.4, H - 118);
    ctx.stroke();
  }

  // Dirt band
  const dirt = ctx.createLinearGradient(0, H-87, 0, H);
  dirt.addColorStop(0, '#8B5E3C');
  dirt.addColorStop(.4, '#6b4226');
  dirt.addColorStop(1, '#3d2211');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, H - 87, W, 87);

  // Dirt pebble texture suggestion
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  for (let x = 20; x < W; x += 38) {
    ctx.beginPath(); ctx.ellipse(x, H - 70, 4, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 18, H - 50, 3, 1.5, 0, 0, Math.PI*2); ctx.fill();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _drawCloud(ctx, x, y, sz) {
  ctx.save();
  // Shadow under cloud
  ctx.fillStyle = 'rgba(180,200,220,.18)';
  ctx.beginPath();
  ctx.ellipse(x + sz*.3, y + sz*.6, sz*.9, sz*.25, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.beginPath();
  ctx.arc(x,           y,         sz,       0, Math.PI*2);
  ctx.arc(x + sz*.8,   y - sz*.1, sz * .75, 0, Math.PI*2);
  ctx.arc(x - sz*.6,   y + sz*.1, sz * .65, 0, Math.PI*2);
  ctx.arc(x + sz*.35,  y - sz*.3, sz * .55, 0, Math.PI*2);
  ctx.fill();

  // Soft belly shadow
  ctx.fillStyle = 'rgba(180,210,230,.28)';
  ctx.beginPath();
  ctx.ellipse(x + sz*.1, y + sz*.3, sz*.8, sz*.25, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function _drawTreeLine(ctx, baseY, minH, maxH) {
  const step = Math.floor(W / 22);
  for (let x = -30; x < W + 30; x += step + Math.sin(x * .3) * 6) {
    const h = minH + Math.abs(Math.sin(x * .07)) * (maxH - minH);
    const w = h * .55;
    // Trunk
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(x - 2, baseY, 4, h * .35);
    // Canopy layers
    ctx.fillStyle = '#3d7a30';
    ctx.beginPath(); ctx.arc(x, baseY - h * .45, w * .55, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#4e9a3e';
    ctx.beginPath(); ctx.arc(x - w*.15, baseY - h * .6, w * .5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5eb54a';
    ctx.beginPath(); ctx.arc(x + w*.1, baseY - h * .72, w * .42, 0, Math.PI*2); ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(160,230,100,.2)';
    ctx.beginPath(); ctx.arc(x - w*.1, baseY - h * .78, w * .22, 0, Math.PI*2); ctx.fill();
  }
}

// ── Gameplay elements ─────────────────────────────────────────────────────────
function drawActiveGameplayElements() {

  // Particles
  for (let pi = ptl.length - 1; pi >= 0; pi--) {
    const p = ptl[pi];
    const a = Math.max(0, p.lf / p.mx);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.5, p.sz * (.4 + a * .6)), 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Bullets — warm orange tracer
  ctx.save();
  for (let bi = bul.length - 1; bi >= 0; bi--) {
    const b = bul[bi];
    // Tracer
    for (let ti = 1; ti < 4; ti++) {
      ctx.globalAlpha = (1 - ti / 4) * .35;
      ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.arc(b.x - b.vx * ti * .6, b.y, 2.5 - ti * .5, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Weapon crates — warm wooden chest
  const now = Date.now();
  for (let qi = pku.length - 1; qi >= 0; qi--) {
    const pk = pku[qi];
    const by = pk.y + Math.sin(pk.bob) * 5;
    const pulse = .5 + Math.sin(now * .003 + qi) * .5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(pk.x, H - 95, 16, 4, 0, 0, Math.PI*2); ctx.fill();

    // Warm glow
    ctx.save();
    ctx.globalAlpha = .15 + pulse * .1;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(pk.x, by, 28, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Chest body — wood brown
    ctx.fillStyle = '#92400e';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(pk.x-14, by-13, 28, 26, 3); ctx.fill(); ctx.stroke();

    // Lid top lighter wood
    ctx.fillStyle = '#b45309';
    ctx.beginPath(); ctx.roundRect(pk.x-13, by-12, 26, 11, [3,3,0,0]); ctx.fill();

    // Wood grain lines
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pk.x-14, by+1); ctx.lineTo(pk.x+14, by+1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pk.x-14, by+7); ctx.lineTo(pk.x+14, by+7); ctx.stroke();

    // Gold latch
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(pk.x-3, by-2, 6, 5, 2); ctx.fill(); ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.roundRect(pk.x-26, by-27, 52, 13, 4); ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.font = "bold 9px 'Inter',sans-serif"; ctx.textAlign = 'center';
    ctx.fillText(pk.type.toUpperCase(), pk.x, by-18);
  }

  ctx.restore(); // close drawBackground's save
}

// ── Match over overlay ────────────────────────────────────────────────────────
function drawMatchOverOverlay() {
  if (gs !== 'MATCH_OVER') return;
  ctx.save();

  // Warm semi-dark overlay
  ctx.fillStyle = 'rgba(20,12,5,.62)';
  ctx.fillRect(0, 0, W, H);

  // Warm vignette
  const vig = ctx.createRadialGradient(W/2,H/2, H*.1, W/2,H/2, H*.75);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(10,5,0,.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  const win = ps >= MX;

  // Title
  ctx.font      = 'bold ' + Math.min(60, W/7) + "px 'Bebas Neue',sans-serif";
  ctx.fillStyle = win ? '#86efac' : '#fca5a5';
  ctx.shadowColor = win ? 'rgba(74,222,128,.4)' : 'rgba(239,68,68,.4)';
  ctx.shadowBlur  = 22;
  ctx.fillText(win ? '🎉 YOU WIN!' : '💀 YOU LOSE!', W/2, H/2-36);
  ctx.shadowBlur = 0;

  // Score
  ctx.font      = 'bold ' + Math.min(22, W/22) + "px 'Inter',sans-serif";
  ctx.fillStyle = 'rgba(255,240,210,.9)';
  ctx.fillText('You: ' + ps + '  —  ' + (wasOnline ? 'Opponent' : 'AI') + ': ' + bs, W/2, H/2+14);

  // Prompt
  ctx.font      = Math.min(13, W/32) + "px 'Inter',sans-serif";
  ctx.fillStyle = 'rgba(255,230,180,.45)';
  ctx.fillText(mob ? 'Tap anywhere to return' : 'Press [ENTER] to return', W/2, H/2+52);

  ctx.restore();
}
