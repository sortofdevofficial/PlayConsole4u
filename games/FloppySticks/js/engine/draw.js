'use strict';

window.floatingTexts = [];

window.addFloatingText = function(x, y, text, color) {
  window.floatingTexts.push({ x, y, text, color, life: 1.4, maxLife: 1.4 });
};

function drawBackground() {
  ctx.save();
  
  if (window.shk > 0) {
    ctx.translate((Math.random() - 0.5) * window.shk, (Math.random() - 0.5) * window.shk);
    window.shk *= 0.82;
    if (window.shk < 0.4) window.shk = 0;
  }

  // Normal Sky Gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#60a5fa'); // light blue
  sky.addColorStop(1, '#e0f2fe'); // pale blue near the horizon
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Simple Fluffy Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const t = Date.now() * 0.015; // Slow drift
  
  const drawCloud = (cx, cy, scale) => {
    // Make clouds wrap around the screen
    let realX = ((cx + t * scale) % (W + 200)) - 100;
    ctx.beginPath();
    ctx.arc(realX, cy, 30 * scale, 0, Math.PI * 2);
    ctx.arc(realX + 40 * scale, cy - 15 * scale, 40 * scale, 0, Math.PI * 2);
    ctx.arc(realX + 80 * scale, cy, 35 * scale, 0, Math.PI * 2);
    ctx.fill();
  };

  drawCloud(W * 0.1, H * 0.15, 1.2);
  drawCloud(W * 0.6, H * 0.25, 0.8);
  drawCloud(W * 0.9, H * 0.1, 1.5);

  const GY = H - 100;

  // Normal Grass Floor Only
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(0, GY, W, H - GY);

  // Simple grass blades at the top edge
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < W; i += 15) {
    ctx.beginPath();
    ctx.moveTo(i, GY + 5);
    ctx.lineTo(i + 5, GY - 10);
    ctx.stroke();
  }

  ctx.restore();
}

function drawActiveGameplayElements() {
  const now = Date.now();
  
  // Draw Standard Crate Pickups
  for (let qi = 0; qi < window.pku.length; qi++) {
    const pk = window.pku[qi];
    const hoverY = pk.y + Math.sin(now * 0.006 + qi) * 7;

    ctx.save();
    // Solid wooden crate look
    ctx.fillStyle = '#d97706';
    ctx.fillRect(pk.x - 16, hoverY - 16, 32, 32);
    
    // Standard border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(pk.x - 16, hoverY - 16, 32, 32);
    
    // Diagonal lines
    ctx.beginPath();
    ctx.moveTo(pk.x - 16, hoverY - 16); ctx.lineTo(pk.x + 16, hoverY + 16);
    ctx.moveTo(pk.x + 16, hoverY - 16); ctx.lineTo(pk.x - 16, hoverY + 16);
    ctx.stroke();
    ctx.restore();
  }

  // Floating Drop Texts
  for (let i = window.floatingTexts.length - 1; i >= 0; i--) {
    let t = window.floatingTexts[i];
    t.y -= 48 * window.dt; 
    t.life -= window.dt;
    
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Simple thin outline for text readability
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();

    if (t.life <= 0) {
      window.floatingTexts.splice(i, 1);
    }
  }

  // Normal Particles
  for (let pi = window.ptl.length - 1; pi >= 0; pi--) {
    const p = window.ptl[pi];
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.lf / p.mx);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}