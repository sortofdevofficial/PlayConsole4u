/**
 * FloppySticks — draw.js
 * Dedicated graphics rendering file. Handles backgrounds, scenery, 
 * environmental animation layers, and UI overlays.
 * * Load order in HTML: stickman.js → network.js → draw.js → game.js
 */

'use strict';

// ── Background & Environmental Rendering Functions ───────────────────────────

function drawBackground() {
  // Clear screen canvas context
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, W, H);
  
  ctx.save();

  // Screen shake application context modifier
  if (shk > 0) {
    ctx.translate((Math.random() - .5) * shk, (Math.random() - .5) * shk);
    shk *= .88;
    if (shk < .5) shk = 0;
  }

  // Soft sky atmosphere gradient overlay
  const sg = ctx.createLinearGradient(0, H * .5, 0, H - 100);
  sg.addColorStop(0, 'rgba(224,244,255,0)');
  sg.addColorStop(1, 'rgba(224,244,255,.6)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, H * .5, W, H);

  // Cloud Simulation and Render Loop
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let ci = 0; ci < clouds.length; ci++) {
    const c = clouds[ci];
    c.x += c.sp;
    if (c.x - c.sz > W) c.x = -c.sz;
    
    ctx.beginPath();
    ctx.arc(c.x,           c.y,           c.sz,       0, Math.PI * 2);
    ctx.arc(c.x + c.sz*.6, c.y - c.sz*.2, c.sz * .75, 0, Math.PI * 2);
    ctx.fill();
  }

  // Background hills layer 1 (Distant Parallax)
  ctx.fillStyle = '#9dc183';
  ctx.beginPath(); 
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) {
    ctx.lineTo(x, (H - 220) + Math.sin(x * .003) * 35);
  }
  ctx.lineTo(W, H); 
  ctx.fill();

  // Foreground hills layer 2 (Mid Ground)
  ctx.fillStyle = '#7da061';
  ctx.beginPath(); 
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 35) {
    ctx.lineTo(x, (H - 160) + Math.cos(x * .005) * 20);
  }
  ctx.lineTo(W, H); 
  ctx.fill();

  // Ground structure solid layers (Grass surface + Subsurface Dirt)
  ctx.fillStyle = '#27ae60'; ctx.fillRect(0, H - 100, W, 14);
  ctx.fillStyle = '#795548'; ctx.fillRect(0, H -  86, W, 86);
}

function drawActiveGameplayElements() {
  // NOTE: Background layer matrix transforms must be preserved until objects are painted!
  
  // Render Active Particle Arrays (Blood, debris, impacts)
  for (let pi = ptl.length - 1; pi >= 0; pi--) {
    const p = ptl[pi];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.lf / p.mx));
    ctx.fillStyle   = p.c;
    ctx.beginPath(); 
    ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); 
    ctx.fill();
    ctx.restore();
  }

  // Render Bullet Sprites with clean fast tracers
  ctx.save();
  for (let bi = bul.length - 1; bi >= 0; bi--) {
    const b = bul[bi];
    
    // Draw horizontal tracer tail line for high-velocity projectiles
    ctx.strokeStyle = 'rgba(230, 126, 34, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - (b.vx * 1.5), b.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Fire glowing impact tip bullet point
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); 
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); 
    ctx.fill();
  }
  ctx.restore();

  // Render Weapon Pickups Floating Box Elements
  for (let qi = pku.length - 1; qi >= 0; qi--) {
    const pk = pku[qi];
    const by = pk.y + Math.sin(pk.bob) * 5;
    
    // Drop shadow under floating cache box
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); 
    ctx.ellipse(pk.x, H - 94, 16, 4, 0, 0, Math.PI * 2); 
    ctx.fill();
    
    // Outer Box Frame Structure
    ctx.fillStyle   = '#e8b84b'; 
    ctx.fillRect(pk.x - 12, by - 12, 24, 24);
    ctx.strokeStyle = '#c49a2a'; 
    ctx.lineWidth = 2; 
    ctx.strokeRect(pk.x - 12, by - 12, 24, 24);
    
    // Crate structural metallic crossed-bracing lines
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pk.x - 12, by); ctx.lineTo(pk.x + 12, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pk.x, by - 12); ctx.lineTo(pk.x, by + 12); ctx.stroke();
    
    // Stylized Weapon Text Label Overlay
    ctx.fillStyle = '#2c3e50'; 
    ctx.font = "bold 11px 'Segoe UI', sans-serif"; 
    ctx.textAlign = 'center';
    
    // Draw subtle soft background text plate for readability over hectic maps
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(pk.x - 45, by - 30, 90, 14);
    
    ctx.fillStyle = '#2c3e50';
    ctx.fillText(pk.type.toUpperCase(), pk.x, by - 19);
  }

  // CRITICAL: Clean up background tracking and screen-shake matrix offset mutations safely here
  ctx.restore();
}

function drawMatchOverOverlay() {
  if (gs !== 'MATCH_OVER') return;
  
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  
  const win = ps >= MX;
  
  // Title Configs
  ctx.font      = 'bold ' + Math.min(58, W / 7) + "px 'Segoe UI',sans-serif";
  ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
  
  // Subtle text depth shadow drop
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.fillText(win ? '🎉 YOU WIN!' : '😢 YOU LOSE!', W / 2, H / 2 - 36);
  
  // Reset shadows for baseline text
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  
  // Match Statistics breakdown string
  ctx.font      = 'bold ' + Math.min(26, W / 20) + "px 'Segoe UI',sans-serif";
  ctx.fillStyle = '#fff';
  ctx.fillText('You: ' + ps + '  —  ' + (wasOnline ? 'Opponent' : 'AI') + ': ' + bs, W / 2, H / 2 + 12);
  
  // Action prompts
  ctx.font      = Math.min(15, W / 30) + "px 'Segoe UI',sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillText(mob ? 'Tap to return' : 'Press [ENTER] to return', W / 2, H / 2 + 50);
  ctx.restore();
}