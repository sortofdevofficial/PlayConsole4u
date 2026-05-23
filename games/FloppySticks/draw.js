/**
 * FloppySticks — draw.js
 * Dedicated graphics rendering file. Handles backgrounds, scenery, 
 * environmental animation layers, and UI overlays.
 * * Load order in HTML: stickman.js → network.js → draw.js → game.js
 */

'use strict';

// ── Background & Environmental Rendering Functions ───────────────────────────

function drawBackground() {
  // Clear screen
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, W, H);
  ctx.save();

  // Screen shake application
  if (shk > 0) {
    ctx.translate((Math.random() - .5) * shk, (Math.random() - .5) * shk);
    shk *= .88;
    if (shk < .5) shk = 0;
  }

  // Sky gradient overlay
  var sg = ctx.createLinearGradient(0, H * .5, 0, H - 100);
  sg.addColorStop(0, 'rgba(224,244,255,0)');
  sg.addColorStop(1, 'rgba(224,244,255,.6)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, H * .5, W, H);

  // Cloud Simulation and Render Loop
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (var ci = 0; ci < clouds.length; ci++) {
    var c = clouds[ci];
    c.x += c.sp;
    if (c.x - c.sz > W) c.x = -c.sz;
    ctx.beginPath();
    ctx.arc(c.x,           c.y,           c.sz,       0, Math.PI * 2);
    ctx.arc(c.x + c.sz*.6, c.y - c.sz*.2, c.sz * .75, 0, Math.PI * 2);
    ctx.fill();
  }

  // Background hills layer 1
  ctx.fillStyle = '#9dc183';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (var x = 0; x <= W; x += 40) ctx.lineTo(x, (H - 220) + Math.sin(x * .003) * 35);
  ctx.lineTo(W, H); ctx.fill();

  // Foreground hills layer 2
  ctx.fillStyle = '#7da061';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (var x = 0; x <= W; x += 35) ctx.lineTo(x, (H - 160) + Math.cos(x * .005) * 20);
  ctx.lineTo(W, H); ctx.fill();

  // Ground structure solid layers
  ctx.fillStyle = '#27ae60'; ctx.fillRect(0, H - 100, W, 14);
  ctx.fillStyle = '#795548'; ctx.fillRect(0, H -  86, W, 86);
}

function drawActiveGameplayElements() {
  // Render Active Particle Arrays
  for (var pi = ptl.length - 1; pi >= 0; pi--) {
    var p = ptl[pi];
    ctx.globalAlpha = p.lf / p.mx;
    ctx.fillStyle   = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Render Bullet Sprites
  for (var bi = bul.length - 1; bi >= 0; bi--) {
    var b = bul[bi];
    ctx.fillStyle = '#e67e22';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Render Weapon Pickups Floating Box Elements
  for (var qi = pku.length - 1; qi >= 0; qi--) {
    var pk = pku[qi];
    var by = pk.y + Math.sin(pk.bob) * 5;
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 12, 14, 3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle   = '#e8b84b'; ctx.fillRect(pk.x - 12, by - 12, 24, 24);
    ctx.strokeStyle = '#c49a2a'; ctx.lineWidth = 2; ctx.strokeRect(pk.x - 12, by - 12, 24, 24);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pk.x - 12, by); ctx.lineTo(pk.x + 12, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pk.x, by - 12); ctx.lineTo(pk.x, by + 12); ctx.stroke();
    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.type.toUpperCase(), pk.x, by - 15);
  }
}

function drawMatchOverOverlay() {
  if (gs !== 'MATCH_OVER') return;
  
  ctx.fillStyle = 'rgba(0,0,0,.48)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  var win = ps >= MX;
  ctx.font      = 'bold ' + Math.min(58, W / 7) + "px 'Segoe UI',sans-serif";
  ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
  ctx.fillText(win ? '🎉 YOU WIN!' : '😢 YOU LOSE!', W / 2, H / 2 - 36);
  ctx.font      = 'bold ' + Math.min(26, W / 20) + "px 'Segoe UI',sans-serif";
  ctx.fillStyle = '#fff';
  ctx.fillText('You: ' + ps + '  —  ' + (wasOnline ? 'Opponent' : 'AI') + ': ' + bs, W / 2, H / 2 + 12);
  ctx.font      = Math.min(15, W / 30) + "px 'Segoe UI',sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillText(mob ? 'Tap to return' : 'Press [ENTER] to return', W / 2, H / 2 + 50);
}