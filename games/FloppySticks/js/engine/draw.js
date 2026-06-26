'use strict';

window.floatingTexts = [];

window.addFloatingText = function(x, y, text, color) {
  window.floatingTexts.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
};

function drawBackground() {
  ctx.save();
  
  // Screen Shake calculation
  if (window.shk > 0) {
    ctx.translate((Math.random() - 0.5) * window.shk, (Math.random() - 0.5) * window.shk);
    window.shk *= 0.82;
    if (window.shk < 0.4) window.shk = 0;
  }

  // Neon Cyber Sky Background Gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#020617');
  sky.addColorStop(0.7, '#0f172a');
  sky.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const GY = H - 100;

  // OVERHAUL: ONLY GRASS SYSTEM (No dirt blocks anywhere)
  // Deep underlying foundational green layer
  const grassBase = ctx.createLinearGradient(0, GY, 0, H);
  grassBase.addColorStop(0, '#166534');
  grassBase.addColorStop(0.3, '#14532d');
  grassBase.addColorStop(1, '#062f17');
  ctx.fillStyle = grassBase;
  ctx.fillRect(0, GY, W, H - GY);

  // Surface highlight line
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, GY, W, 4);

  // Dense, anti-flicker procedural layered lawn blades
  ctx.lineCap = 'round';
  
  // Layer 1: Dark background blades
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 3;
  for (let i = -5; i < W + 10; i += 8) {
    let h = 14 + (Math.sin(i * 0.04) * 6);
    let tilt = Math.cos(i * 0.02) * 4;
    ctx.beginPath();
    ctx.moveTo(i, GY + 2);
    ctx.lineTo(i + tilt, GY - h);
    ctx.stroke();
  }

  // Layer 2: Bright neon foreground blades
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2.5;
  for (let i = -2; i < W + 10; i += 12) {
    let h = 10 + (Math.sin(i * 0.08) * 4);
    let tilt = Math.sin(i * 0.03) * 5;
    ctx.beginPath();
    ctx.moveTo(i, GY + 1);
    ctx.lineTo(i + tilt, GY - h);
    ctx.stroke();
  }

  ctx.restore();
}

function drawActiveGameplayElements() {
  const now = Date.now();
  
  // Draw Crate Pickups with custom floating matrix
  for (let qi = 0; qi < window.pku.length; qi++) {
    const pk = window.pku[qi];
    const hoverY = pk.y + Math.sin(now * 0.006 + qi) * 7;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#f59e0b';
    
    // Outer Crate Core Glow
    ctx.fillStyle = '#d97706';
    ctx.fillRect(pk.x - 16, hoverY - 16, 32, 32);
    
    // Interlines Cross Frame Accent
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.strokeRect(pk.x - 12, hoverY - 12, 24, 24);
    ctx.beginPath();
    ctx.moveTo(pk.x - 12, hoverY - 12); ctx.lineTo(pk.x + 12, hoverY + 12);
    ctx.moveTo(pk.x + 12, hoverY - 12); ctx.lineTo(pk.x - 12, hoverY + 12);
    ctx.stroke();
    
    ctx.restore();
  }

  // Canvas Native Floating HUD Text Handler
  for (let i = window.floatingTexts.length - 1; i >= 0; i--) {
    let t = window.floatingTexts[i];
    t.y -= 48 * window.dt; 
    t.life -= window.dt;
    
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.font = 'bold 26px Impact, sans-serif';
    ctx.textAlign = 'center';
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();

    if (t.life <= 0) {
      window.floatingTexts.splice(i, 1);
    }
  }

  // Global Engine Particles Render
  for (let pi = window.ptl.length - 1; pi >= 0; pi--) {
    const p = window.ptl[pi];
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.lf / p.mx);
    ctx.fillStyle = p.c;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}