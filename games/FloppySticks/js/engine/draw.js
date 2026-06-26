'use strict';

// Add this to your global variables in game.js if not already there, 
// or it will just live globally here:
window.floatingTexts = [];

window.addFloatingText = function(x, y, text, color) {
  window.floatingTexts.push({ x, y, text, color, life: 1.5, maxLife: 1.5 });
};

function drawBackground() {
  ctx.save();
  
  if (window.shk > 0) {
    ctx.translate((Math.random() - 0.5) * window.shk, (Math.random() - 0.5) * window.shk);
    window.shk *= 0.8;
    if (window.shk < 0.5) window.shk = 0;
  }

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#7dd3fc');
  sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const GY = H - 100;

  // Draw Dirt Underground
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, GY, W, H - GY);

  // Draw Top Grass Layer
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(0, GY, W, 15);

  // Procedural Grass Blades
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  // Seeded predictable grass so it doesn't flicker every frame
  for (let i = 0; i < W; i += 12) {
    let height = 8 + (Math.sin(i * 0.1) * 4); 
    let tilt = Math.cos(i * 0.05) * 5;
    
    ctx.beginPath();
    ctx.moveTo(i, GY + 2);
    ctx.lineTo(i + tilt, GY - height);
    ctx.stroke();
  }

  ctx.restore();
}

function drawActiveGameplayElements() {
  // Draw Pickups
  const now = Date.now();
  for (let qi = 0; qi < window.pku.length; qi++) {
    const pk = window.pku[qi];
    const by = pk.y + Math.sin(now * 0.005 + qi) * 5;

    ctx.save();
    // Crate Box
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 10;
    ctx.fillRect(pk.x - 15, by - 15, 30, 30);
    ctx.shadowBlur = 0;
    
    // Label
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('CRATE', pk.x, by + 4);
    ctx.restore();
  }

  // Render Floating Drop Texts
  for (let i = window.floatingTexts.length - 1; i >= 0; i--) {
    let t = window.floatingTexts[i];
    t.y -= 40 * window.dt; // Float upwards
    t.life -= window.dt;
    
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.font = 'bold 24px Bebas Neue, sans-serif';
    ctx.textAlign = 'center';
    // Outline for visibility
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();

    if (t.life <= 0) {
      window.floatingTexts.splice(i, 1);
    }
  }

  // Draw particles
  for (let pi = window.ptl.length - 1; pi >= 0; pi--) {
    const p = window.ptl[pi];
    ctx.globalAlpha = Math.max(0, p.lf / p.mx);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}