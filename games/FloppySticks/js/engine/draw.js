/**
 * FloppySticks — draw.js v2.0
 * All rendering: background, VFX, overlays.
 * Load order: stickman.js → network.js → draw.js → game.js
 */

'use strict';

// ── Star field (distant bg layer) ─────────────────────────────────────────────
let stars = [];
function initStars() {
  stars = [];
  for (let i = 0; i < 60; i++)
    stars.push({ x: Math.random() * W, y: Math.random() * H * .5, r: Math.random() * 1.2 + .3, a: Math.random() });
}

// ── Background ────────────────────────────────────────────────────────────────
function drawBackground() {
  ctx.fillStyle = '#0d1b2a';
  ctx.fillRect(0, 0, W, H);
  ctx.save();

  // Screen shake
  if (shk > 0) {
    ctx.translate((Math.random() - .5) * shk, (Math.random() - .5) * shk);
    shk *= .84;
    if (shk < .4) shk = 0;
  }

  // Deep sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,   '#0d1b2a');
  sky.addColorStop(.45, '#1a3a5c');
  sky.addColorStop(.75, '#2d6a4f');
  sky.addColorStop(1,   '#1b4332');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars
  const t = Date.now() * .001;
  for (const s of stars) {
    ctx.globalAlpha = (.4 + Math.sin(t * .8 + s.a * 6) * .3) * s.a;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon / light source
  const mx = W * .78, my = H * .14;
  const moonGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
  moonGlow.addColorStop(0,   'rgba(200,230,255,.18)');
  moonGlow.addColorStop(.4,  'rgba(150,200,255,.08)');
  moonGlow.addColorStop(1,   'transparent');
  ctx.fillStyle = moonGlow;
  ctx.fillRect(0, 0, W, H * .4);

  ctx.fillStyle = 'rgba(230,245,255,.92)';
  ctx.beginPath(); ctx.arc(mx, my, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.fill();
  // Crater detail
  ctx.fillStyle = 'rgba(180,210,240,.5)';
  ctx.beginPath(); ctx.arc(mx + 6, my - 4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx - 5, my + 5, 3, 0, Math.PI * 2); ctx.fill();

  // Clouds (night-tinted)
  ctx.fillStyle = 'rgba(30,60,100,.55)';
  for (let ci = 0; ci < clouds.length; ci++) {
    const c = clouds[ci];
    c.x += c.sp;
    if (c.x - c.sz > W) c.x = -c.sz;
    ctx.beginPath();
    ctx.arc(c.x,            c.y,           c.sz,       0, Math.PI * 2);
    ctx.arc(c.x + c.sz*.65, c.y - c.sz*.2, c.sz * .75, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far mountains silhouette
  ctx.fillStyle = '#0f2d1a';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 50) {
    const h = (H - 260) + Math.sin(x * .0025 + 1) * 60 + Math.cos(x * .007) * 30;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(W, H); ctx.fill();

  // Mid hills
  ctx.fillStyle = '#14422a';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) {
    const h = (H - 180) + Math.sin(x * .004 + 2) * 40 + Math.cos(x * .009) * 18;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(W, H); ctx.fill();

  // Near hills with edge highlight
  ctx.fillStyle = '#1a5c35';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 30) {
    const h = (H - 130) + Math.cos(x * .006) * 22 + Math.sin(x * .012) * 10;
    ctx.lineTo(x, h);
  }
  ctx.lineTo(W, H); ctx.fill();

  // Grass band top edge shimmer
  const grassShimmer = ctx.createLinearGradient(0, H - 105, 0, H - 95);
  grassShimmer.addColorStop(0, 'rgba(74,222,128,.0)');
  grassShimmer.addColorStop(.5, 'rgba(74,222,128,.25)');
  grassShimmer.addColorStop(1, 'rgba(74,222,128,.0)');
  ctx.fillStyle = grassShimmer;
  ctx.fillRect(0, H - 105, W, 14);

  // Grass solid
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(0, H - 100, W, 14);

  // Dirt
  const dirt = ctx.createLinearGradient(0, H - 86, 0, H);
  dirt.addColorStop(0, '#3d2b1f');
  dirt.addColorStop(1, '#1a1208');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, H - 86, W, 86);

  // Ground edge line
  ctx.strokeStyle = 'rgba(74,222,128,.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H - 100); ctx.lineTo(W, H - 100); ctx.stroke();

  // Ambient fog at ground
  const fog = ctx.createLinearGradient(0, H - 120, 0, H - 90);
  fog.addColorStop(0, 'transparent');
  fog.addColorStop(1, 'rgba(20,60,40,.25)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, H - 120, W, 30);
}

// ── Gameplay elements ─────────────────────────────────────────────────────────
function drawActiveGameplayElements() {

  // Particles
  for (let pi = ptl.length - 1; pi >= 0; pi--) {
    const p = ptl[pi];
    const a = Math.max(0, p.lf / p.mx);
    ctx.globalAlpha = a;
    // Glow for bright particles
    if (p.glow) {
      ctx.shadowColor = p.c;
      ctx.shadowBlur  = 8;
    }
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (.5 + a * .5), 0, Math.PI * 2); ctx.fill();
    if (p.glow) ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // Bullets with tracer trail
  ctx.save();
  for (let bi = bul.length - 1; bi >= 0; bi--) {
    const b = bul[bi];
    // Tracer trail
    const tlen = 3;
    for (let ti = 0; ti < tlen; ti++) {
      ctx.globalAlpha = (1 - ti / tlen) * .4;
      ctx.fillStyle   = '#fb923c';
      ctx.beginPath();
      ctx.arc(b.x - b.vx * ti * .7, b.y, 2.5 - ti * .5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Tip glow
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#fef3c7';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur  = 0;
  }
  ctx.restore();

  // Pickup crates
  const now = Date.now();
  for (let qi = pku.length - 1; qi >= 0; qi--) {
    const pk = pku[qi];
    const by = pk.y + Math.sin(pk.bob) * 6;

    // Ground shadow ellipse
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(pk.x, H - 94, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing glow aura
    const pulse = .5 + Math.sin(now * .004 + qi) * .5;
    const aura  = ctx.createRadialGradient(pk.x, by, 0, pk.x, by, 30);
    aura.addColorStop(0,   `rgba(251,191,36,${.18 * pulse})`);
    aura.addColorStop(1,   'transparent');
    ctx.fillStyle = aura;
    ctx.fillRect(pk.x - 30, by - 30, 60, 60);

    // Crate body
    ctx.fillStyle   = '#d97706';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(pk.x - 14, by - 14, 28, 28, 4);
    ctx.fill(); ctx.stroke();

    // Top face highlight
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.roundRect(pk.x - 12, by - 13, 24, 10, [4,4,0,0]);
    ctx.fill();

    // Crosshatch
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pk.x - 14, by); ctx.lineTo(pk.x + 14, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pk.x, by - 14); ctx.lineTo(pk.x, by + 14); ctx.stroke();

    // Label badge
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.beginPath();
    ctx.roundRect(pk.x - 28, by - 30, 56, 14, 4);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.font = "bold 9px 'Inter',sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(pk.type.toUpperCase(), pk.x, by - 20);
  }

  ctx.restore(); // close save from drawBackground
}

// ── Match over overlay ─────────────────────────────────────────────────────────
function drawMatchOverOverlay() {
  if (gs !== 'MATCH_OVER') return;

  ctx.save();

  // Darken
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(0, 0, W, H);

  // Vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*.15, W/2, H/2, H*.8);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  const win = ps >= MX;

  // Title shadow
  ctx.font      = 'bold ' + Math.min(62, W / 7) + "px 'Bebas Neue',sans-serif";
  ctx.fillStyle = win ? 'rgba(74,222,128,.25)' : 'rgba(248,113,113,.25)';
  ctx.fillText(win ? '🎉 YOU WIN!' : '😢 YOU LOSE!', W/2 + 3, H/2 - 33);

  // Title
  ctx.shadowColor   = win ? '#4ade80' : '#f87171';
  ctx.shadowBlur    = 30;
  ctx.fillStyle     = win ? '#4ade80' : '#f87171';
  ctx.fillText(win ? '🎉 YOU WIN!' : '😢 YOU LOSE!', W/2, H/2 - 36);
  ctx.shadowBlur = 0;

  // Score line
  ctx.font      = 'bold ' + Math.min(22, W / 22) + "px 'Inter',sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText('You: ' + ps + '  —  ' + (wasOnline ? 'Opponent' : 'AI') + ': ' + bs, W/2, H/2 + 14);

  // Prompt
  ctx.font      = Math.min(13, W / 32) + "px 'Inter',sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fillText(mob ? 'Tap anywhere to return' : 'Press [ENTER] to return', W/2, H/2 + 52);

  ctx.restore();
}