/**
 * FloppySticks — draw.js v4.1
 * Simple arena layout, clean environment geometry, stylized combat VFX, cutscene layer.
 */

'use strict';

let birds = [];
let leaves = [];

function initBirds() {
  birds = [];
  for (let i = 0; i < 4; i++)
    birds.push({
      x:  Math.random() * W,
      y:  Math.random() * H * 0.25 + 25,
      sp: Math.random() * 0.4 + 0.2,
      flap: Math.random() * Math.PI * 2,
      sz: Math.random() * 2.5 + 2.5
    });
}

function initLeaves() {
  leaves = [];
  for (let i = 0; i < 6; i++)
    leaves.push({
      x: Math.random() * W, y: Math.random() * (H - 140),
      vx: -(Math.random() * 0.25 + 0.1), vy: Math.random() * 0.15 + 0.05,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.02,
      sz: Math.random() * 2.5 + 2,
      c: ['#9ccc65','#cbd5e1','#fef08a','#f97316'][Math.floor(Math.random()*4)]
    });
}

function drawBackground() {
  ctx.save();

  if (shk > 0) {
    ctx.translate((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk);
    shk *= 0.82;
    if (shk < 0.4) shk = 0;
  }

  // Pure Minimalist Sky Gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,    '#bae6fd');
  sky.addColorStop(0.6,  '#f0f9ff');
  sky.addColorStop(1,    '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Clean Sun Disc
  ctx.fillStyle = 'rgba(255,253,224,0.7)';
  ctx.beginPath(); ctx.arc(W * 0.85, H * 0.15, 24, 0, Math.PI * 2); ctx.fill();

  for (const c of clouds) {
    c.x += c.sp;
    if (c.x - c.sz * 2.5 > W) c.x = -c.sz * 2.5;
    _cloud(c.x, c.y, c.sz);
  }

  // Ambient Birds Vector Track
  ctx.strokeStyle = 'rgba(100,116,139,0.4)';
  ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (const b of birds) {
    b.x += b.sp;
    b.flap += 0.06;
    if (b.x > W + 30) { b.x = -30; b.y = Math.random() * H * 0.22 + 25; }
    const wg = Math.sin(b.flap) * b.sz * 0.6;
    ctx.beginPath();
    ctx.moveTo(b.x - b.sz, b.y + wg);
    ctx.quadraticCurveTo(b.x, b.y - b.sz * 0.3, b.x + b.sz, b.y + wg);
    ctx.stroke();
  }

  // Flat Minimalist Base Ridge Line (Zero Trees)
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 100)
    ctx.lineTo(x, H - 160 + Math.sin(x * 0.001) * 20);
  ctx.lineTo(W, H); ctx.fill();

  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 80)
    ctx.lineTo(x, H - 130 + Math.cos(x * 0.002) * 15);
  ctx.lineTo(W, H); ctx.fill();

  for (const lf of leaves) {
    lf.x += lf.vx; lf.y += lf.vy; lf.rot += lf.vr;
    if (lf.y > H - 95) { lf.y = -8; lf.x = Math.random() * W; }
    ctx.save();
    ctx.translate(lf.x, lf.y); ctx.rotate(lf.rot);
    ctx.fillStyle = lf.c; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.ellipse(0, 0, lf.sz, lf.sz * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ── Modern Clean Solid Ground Platform ──
  const GY = H - 100;

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, GY - 6, W, 12);

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, GY + 6, W, H - GY - 6);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, GY - 6); ctx.lineTo(W, GY - 6); ctx.stroke();
}

function _cloud(x, y, sz) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x,           y,          sz,       0, Math.PI * 2);
  ctx.arc(x + sz * 0.7, y - sz * 0.1, sz * 0.65, 0, Math.PI * 2);
  ctx.arc(x - sz * 0.5, y + sz * 0.1, sz * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawActiveGameplayElements() {
  // Glow Particles System
  for (let i = ptl.length - 1; i >= 0; i--) {
    const p = ptl[i];
    const a = Math.max(0, p.lf / p.mx);
    ctx.globalAlpha = a * 0.95;
    ctx.fillStyle   = p.c;
    const sz = Math.max(0.5, p.sz * (0.3 + a * 0.7));
    if (p.gl) {
      ctx.shadowColor = p.c;
      ctx.shadowBlur  = 8;
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // Kinetic Bullet Vectors
  ctx.save();
  for (const b of bul) {
    for (let ti = 1; ti < 5; ti++) {
      ctx.globalAlpha = (1 - ti / 5) * 0.3;
      ctx.fillStyle   = '#f97316';
      ctx.beginPath(); ctx.arc(b.x - b.vx * ti * 0.0008, b.y, 3 - ti * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // Weapon Crates
  const now = Date.now();
  for (let qi = 0; qi < pku.length; qi++) {
    const pk  = pku[qi];
    const by  = pk.y + Math.sin(pk.bounce) * 4;
    const pulse = 0.5 + Math.sin(now * 0.003 + qi) * 0.5;

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath(); ctx.ellipse(pk.x, H - 95, 16, 4, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.1 + pulse * 0.08;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(pk.x, by, 28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(pk.x - 14, by - 13, 28, 26, 4); ctx.fill(); ctx.stroke();
    
    ctx.fillStyle = '#64748b';
    ctx.beginPath(); ctx.roundRect(pk.x - 13, by - 12, 26, 12, [3,3,0,0]); ctx.fill();
    
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(pk.x - 2, by - 1, 4, 4);

    ctx.fillStyle = 'rgba(15,23,42,0.6)';
    ctx.beginPath(); ctx.roundRect(pk.x - 26, by - 27, 52, 13, 3); ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = "bold 8px 'Inter',sans-serif"; ctx.textAlign = 'center';
    ctx.fillText(pk.type.toUpperCase(), pk.x, by - 18);
  }

  ctx.restore(); 
}

function drawMatchOverOverlay() {
  if (gs !== 'MATCH_OVER') return;
  ctx.save();

  ctx.fillStyle = 'rgba(15,23,42,0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  const win = ps >= MX;

  ctx.font      = `900 ${Math.min(64, W / 6.5)}px 'Bebas Neue', sans-serif`;
  ctx.fillStyle = win ? '#4ade80' : '#f87171';
  ctx.shadowColor = win ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)';
  ctx.shadowBlur  = 24;
  ctx.fillText(win ? '🎉 YOU WIN!' : '💀 YOU LOSE!', W/2, H/2 - 40);
  ctx.shadowBlur = 0;

  ctx.font      = `700 ${Math.min(20, W/24)}px 'Inter', sans-serif`;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText(`You: ${ps}  —  ${wasOnline ? 'Opponent' : 'AI'}: ${bs}`, W/2, H/2 + 12);

  ctx.font      = `${Math.min(13, W/32)}px 'Inter', sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(mob ? 'Tap anywhere to return' : 'Press [ENTER] to return', W/2, H/2 + 52);

  ctx.restore();
}

window.initBirds  = initBirds;
window.initLeaves = initLeaves;