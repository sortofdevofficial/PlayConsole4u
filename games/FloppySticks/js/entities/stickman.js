/**
 * FloppySticks — stickman.js v4.1
 * Authentic stickman anatomy, smooth anims, hit-freeze, KO ragdoll, cutscenes.
 */

'use strict';

let cutscene = null; 
let hitFreeze = 0; // frames to freeze combat actions for heavy impact juice

function startFightCutscene(cb) {
  cutscene = { timer: 0, onDone: cb, fired: false };
}

function drawCutscene(dt) {
  if (!cutscene) return false;
  cutscene.timer += dt;
  const t = cutscene.timer;

  ctx.save();
  // Cinematic Letterbox Bars
  const barH = Math.min(H * 0.15, 80);
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, W, barH);
  ctx.fillRect(0, H - barH, W, barH);

  // Dynamic "FIGHT!" Pop Intro
  if (t > 0.2) {
    const progress = t - 0.2;
    const alpha = progress < 0.2 ? progress / 0.2 : (progress > 0.8 ? Math.max(0, 1 - (progress - 0.8) / 0.3) : 1);
    const scale = progress < 0.2 ? 1.6 - (progress / 0.2) * 0.6 : 1.0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.font = `900 ${Math.min(W / 5, 95)}px 'Bebas Neue', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Impact Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText('FIGHT!', 4, 4);

    // Gold Blaze Gradient
    const grad = ctx.createLinearGradient(0, -40, 0, 40);
    grad.addColorStop(0, '#fff176');
    grad.addColorStop(0.5, '#ff9800');
    grad.addColorStop(1, '#e65100');
    ctx.fillStyle = grad;
    ctx.fillText('FIGHT!', 0, 0);
    ctx.restore();
  }

  ctx.restore();

  if (t >= 1.4) {
    if (!cutscene.fired) {
      cutscene.fired = true;
      const cb = cutscene.onDone;
      cutscene = null;
      if (cb) cb();
    }
    return false;
  }
  return true;
}

window.drawCutscene = drawCutscene;
window.startFightCutscene = startFightCutscene;

class S {
  constructor(x, c, bot = false) {
    this.sx  = x;
    this.c   = c;
    this.bot = bot;
    this.gy  = H - 100;
    this.nx  = null;
    this.ny  = null;
    this.walkCycle = Math.random() * Math.PI * 2;
    this._i();
  }

  _i() {
    this.x   = this.sx;  this.y   = this.gy;
    this.vx  = 0;        this.vy  = 0;
    this.hp  = 100;
    this.gr  = false;    this.at  = 0;
    this.fl  = this.bot; this.wp  = null;
    this.jc  = 0;        this.fa  = 0;
    this.flp = false;    this.sq  = 1;
    this.ac  = 0;        this.asw = 0;
    this.atk = false;    this.ff  = 0;
    this.rd  = false;    this.rp  = [];
    this.nx  = null;     this.ny  = null;
    this.koTimer   = 0;
    this.atkPhase  = 0; 
    this.atkPhaseTmr = 0;
    this.landSquish  = 0;
    this.jumpStretch = 0;
  }

  respawn() {
    this._i();
    this.hp = 100;
    const hpUi = g(this.bot ? 'b-hp' : 'p-hp');
    if (hpUi) hpUi.style.width = '100%';
    const wpUi = g(this.bot ? 'b-weapon' : 'p-weapon');
    if (wpUi) wpUi.textContent = 'NONE';
  }

  jump() {
    if (this.rd || gs === 'MATCH_OVER' || window.cutsceneActive) return;
    if (this.gr) {
      this.vy = -14.5;
      this.gr = false;
      this.sq = 1.5;
      this.jumpStretch = 0.4;
      this.jc = 1;
      fx(this.x, this.gy, '#aad4ff', 6);
      fx(this.x, this.gy, '#ffffff', 4, { glow: true, spread: 2 });
    } else if (this.jc < 2) {
      this.vy = -12.5;
      this.jc = 2;
      this.sq = 1.3;
      this.jumpStretch = 0.25;
      fx(this.x, this.y, '#e2e8f0', 6, { glow: true });
    }
  }

  attack() {
    if (this.rd || gs === 'MATCH_OVER' || this.ac > 0 || window.cutsceneActive) return;
    if (!this.wp) return;

    if (this.wp === 'Buster Sword' || this.wp === 'Smasher Club') {
      this.atk = true;
      this.asw = -0.6;
      this.atkPhase = 1;
      this.atkPhaseTmr = 0;
      this.ac = this.wp === 'Buster Sword' ? 22 : 32;

      const op = this.bot ? P : B;
      const range  = this.wp === 'Buster Sword' ? 78 : 65;
      const damage = this.wp === 'Buster Sword' ? 22 : 30;
      const dir = this.fl ? -1 : 1;

      setTimeout(() => {
        if (!op || op.rd) return;
        const reached = dir > 0
          ? (op.x > this.x - 10 && op.x < this.x + range)
          : (op.x < this.x + 10 && op.x > this.x - range);
        if (reached && Math.abs(op.y - this.y) < 55) {
          hitFreeze = 6; 
          op.hit(damage, dir);
          if (gs === 'ONLINE_MODE' && !this.bot) send({ type: 'hit', amt: damage, kb: dir });
        }
      }, this.wp === 'Buster Sword' ? 120 : 150);

    } else if (this.wp === 'Assault Rifle') {
      this.ac = 8;
      this.atk = true;
      this.atkPhase = 2;
      this.atkPhaseTmr = 0;
      const fX = this.x + (this.fl ? -32 : 32);
      const fY = this.y - 42;
      const bVx = this.fl ? -780 : 780;
      bul.push({ x: fX, y: fY, vx: bVx, bot: this.bot });
      fx(fX, fY, '#fff9c4', 4, { glow: true, spread: 3 });
      fx(fX, fY, '#fbbf24', 3, { glow: true, spread: 2 });
      if (gs === 'ONLINE_MODE' && !this.bot) send({ type: 'bullet', x: fX, y: fY, vx: bVx });
    }
  }

  hit(amt, kbDir) {
    if (this.rd || gs === 'MATCH_OVER') return;
    this.hp = Math.max(0, this.hp - amt);
    this.ff = 8;
    this.vx += kbDir * 390;
    this.vy -= 4.5;
    shk = 15;

    fx(this.x, this.y - 40, '#ff3333', 6, { spread: 5 });
    fx(this.x, this.y - 40, '#ffffff', 4, { spread: 3 });
    fx(this.x, this.y - 40, '#ffc107', 4, { glow: true, spread: 4 });

    const ov = document.getElementById('dmg-overlay');
    if (!this.bot && ov) {
      ov.classList.add('flash');
      setTimeout(() => ov.classList.remove('flash'), 120);
    }

    this._hud();
    if (this.hp <= 0) this._rag(kbDir);
  }

  _hud() {
    const hpUi = g(this.bot ? 'b-hp' : 'p-hp');
    if (hpUi) hpUi.style.width = this.hp + '%';
  }

  _rag(dir) {
    this.rd = true;
    this.rp = [];
    shk = 22;

    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        fx(this.x, this.y - 40, '#ffea00', 8, { glow: true, spread: 8, rise: 2 });
        fx(this.x, this.y - 40, '#ff3d00', 5, { spread: 6 });
      }, i * 80);
    }

    const parts = [
      { o: [0, -62], r: 9, isHead: true },  
      { o: [0, -44], r: 3,  isTorso: true }, 
      { o: [0, -30], r: 3,  isTorso: true }, 
      { o: [0, -18], r: 3,  isTorso: true }, 
      { o: [-14, -44], r: 3 }, 
      { o: [14,  -44], r: 3 }, 
      { o: [-10, -10], r: 3.5 }, 
      { o: [10,  -10], r: 3.5 }, 
    ];
    parts.forEach((p, idx) => {
      this.rp.push({
        x:   this.x + p.o[0],
        y:   this.y + p.o[1],
        vx:  this.vx * 0.35 + (Math.random() - 0.5) * 5 + dir * (2 + Math.random() * 3),
        vy:  this.vy * 0.3 - Math.random() * 6 - 3,
        r:   p.r,
        ang: Math.random() * Math.PI * 2,
        va:  (Math.random() - 0.5) * 0.3,
        isHead: !!p.isHead,
        isTorso: !!p.isTorso
      });
    });

    if (gs === 'ONLINE_MODE' && window.isHost) {
      setTimeout(() => this._scoreRule(), 1400);
    } else if (gs === 'BOT_MODE') {
      setTimeout(() => this._scoreRule(), 1400);
    }
  }

  _scoreRule() {
    if (gs === 'MATCH_OVER') return;
    if (this.bot) ps++; else bs++;

    const psUi = g('p-score'), osUi = g('o-score');
    if (psUi) psUi.textContent = ps + ' pts';
    if (osUi) osUi.textContent = bs + ' pts';

    if (gs === 'ONLINE_MODE' && window.isHost) send({ type: 'score', hs: ps, gs: bs });

    if (ps >= MX || bs >= MX) {
      gs = 'MATCH_OVER';
      if (gs === 'ONLINE_MODE' && window.isHost) send({ type: 'over' });
      _save();
    } else {
      if (gs === 'ONLINE_MODE' && window.isHost) { this.respawn(); send({ type: 'ropp' }); }
      else if (gs === 'BOT_MODE') { P.respawn(); B.respawn(); }
    }
  }

  _ai(dt) {
    if (!this.bot || this.rd || gs !== 'BOT_MODE' || !P || window.cutsceneActive) return;
    const dist = P.x - this.x;
    this.fl = dist < 0;

    const targetDist = this.wp === 'Assault Rifle' ? 280 : (this.wp ? 60 : 130);
    if (Math.abs(dist) > targetDist + 10) {
      this.vx = dist > 0 ? 175 : -175;
    } else {
      this.vx *= Math.pow(0.15, dt * 60);
    }

    if (P.y < this.y - 55 && Math.random() < 0.025) this.jump();

    const atkDist = this.wp === 'Assault Rifle' ? 300 : 72;
    if (this.wp && Math.abs(dist) < atkDist && Math.random() < 0.07) this.attack();
  }

  update(dt) {
    this.gy = H - 100;

    if (hitFreeze > 0) {
      hitFreeze--;
      return;
    }

    if (this.rd) {
      this.rp.forEach(p => {
        p.vx *= Math.pow(0.94, dt * 60);
        p.vy += GV * dt;
        p.x  += p.vx * 60 * dt;
        p.y  += p.vy * 60 * dt;
        p.ang += p.va * 60 * dt;
        if (p.y >= this.gy - p.r) {
          p.y   = this.gy - p.r;
          p.vy  = -p.vy * 0.18;
          p.vx *= 0.75;
          p.va *= 0.4;
        }
      });
      return;
    }

    if (gs === 'MATCH_OVER') {
      this.vx *= Math.pow(0.7, dt * 60);
      this.vy += GV * dt;
      this.y  += this.vy * 60 * dt;
      if (this.y >= this.gy) { this.y = this.gy; this.vy = 0; }
      return;
    }

    if (this.ac > 0) this.ac -= 60 * dt;
    if (this.ff > 0) this.ff -= 60 * dt;

    if (this.atk) {
      this.atkPhaseTmr += dt;
      if (this.atkPhase === 1) { 
        this.asw = -0.6 + this.atkPhaseTmr * 2.5;
        if (this.atkPhaseTmr > 0.12) { this.atkPhase = 2; this.atkPhaseTmr = 0; }
      } else if (this.atkPhase === 2) { 
        this.asw = -0.6 + 0.3 + this.atkPhaseTmr * 8;
        if (this.atkPhaseTmr > 0.1) { this.atkPhase = 3; this.atkPhaseTmr = 0; }
      } else { 
        this.asw = Math.max(0, this.asw - dt * 5);
        if (this.atkPhaseTmr > 0.2) { this.atk = false; this.asw = 0; this.atkPhase = 0; }
      }
    }

    if (this.bot) {
      this._ai(dt);
    } else {
      if (window.cutsceneActive) {
        this.vx *= Math.pow(0.12, dt * 60);
      } else if (keys.a) { 
        this.vx = -225; this.fl = true; 
      } else if (keys.d) { 
        this.vx = 225; this.fl = false; 
      } else { 
        this.vx *= Math.pow(0.12, dt * 60); 
      }
    }

    this.vy += GV * dt;
    this.x  += this.vx * dt;
    this.y  += this.vy * 60 * dt;
    this.x   = Math.max(24, Math.min(W - 24, this.x));

    if (this.y >= this.gy) {
      if (!this.gr) {
        this.landSquish = 0.5;
        fx(this.x, this.gy, '#aad4ff', 3);
      }
      this.y  = this.gy;
      this.vy = 0;
      this.gr = true;
      this.jc = 0;
    } else {
      this.gr = false;
    }

    if (Math.abs(this.vx) > 15) {
      this.walkCycle += dt * Math.min(Math.abs(this.vx) * 0.014, 0.4);
    }

    this.landSquish  += (0 - this.landSquish)  * 10 * dt;
    this.jumpStretch += (0 - this.jumpStretch) * 8  * dt;
    const baseSquash = this.gr ? (1 - this.landSquish * 0.35) : (1 + this.jumpStretch * 0.3);
    this.sq += (baseSquash - this.sq) * 12 * dt;
  }

  draw() {
    if (this.rd) {
      this._drawRagdoll();
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.fl ? -1 : 1, 1);

    const scaleX = 2 - this.sq;
    const scaleY = this.sq;
    const flash = this.ff > 0;
    const color = flash ? '#ffffff' : this.c;
    const lw = 4; // Clear, clean stickman line thickness

    const wk = Math.sin(this.walkCycle) * (Math.abs(this.vx) > 15 ? 1 : 0);
    const wk2 = Math.cos(this.walkCycle) * (Math.abs(this.vx) > 15 ? 1 : 0);
    const isMoving = Math.abs(this.vx) > 15;
    const isAir = !this.gr;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    // ── Precise Stickman Proportion Space Mapping ──
    const FOOT   = 0;
    const HIP    = -22;
    const WAIST  = -32;
    const CHEST  = -52;
    const NECK   = -58;
    const HEAD   = -70;

    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = color;

    // ── Authentic Vector Legs ──
    let lLegX, rLegX, lKneeX, rKneeX;
    if (isAir) {
      lLegX = -9; rLegX = 9;
      lKneeX = -12; rKneeX = 12;
    } else if (isMoving) {
      lLegX  = wk * 12;
      rLegX  = -wk * 12;
      lKneeX = wk * 6;
      rKneeX = -wk * 6;
    } else {
      lLegX = -6; rLegX = 6; lKneeX = -6; rKneeX = 6;
    }

    // Left Leg
    ctx.beginPath();
    ctx.moveTo(0, HIP);
    ctx.lineTo(lKneeX, (HIP + FOOT) / 2);
    ctx.lineTo(lLegX, FOOT);
    ctx.stroke();

    // Right Leg
    ctx.beginPath();
    ctx.moveTo(0, HIP);
    ctx.lineTo(rKneeX, (HIP + FOOT) / 2);
    ctx.lineTo(rLegX, FOOT);
    ctx.stroke();

    // ── Backbone Linear Spine ──
    ctx.beginPath();
    ctx.moveTo(0, HIP);
    ctx.lineTo(0, CHEST);
    ctx.stroke();

    // ── Perfect Round Stick Head ──
    const headTilt = isAir ? (this.vy > 0 ? 0.1 : -0.06) : (flash ? 0.15 : wk * 0.04);
    ctx.save();
    ctx.translate(0, HEAD);
    ctx.rotate(headTilt);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();

    // Sharp Dynamic Combat Eye Expression
    ctx.fillStyle = flash ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(4, -2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Vector Arms & Weapons ──
    if (this.wp) {
      ctx.save();
      ctx.translate(0, CHEST);
      const swingAng = this.atk ? this.asw : (isMoving ? -wk2 * 0.25 : 0);
      ctx.rotate(swingAng);
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(20, 6);
      ctx.stroke();
      
      this._drawWeapon(ctx);
      ctx.restore();

      // Rear Arm Balanced Support Line
      ctx.beginPath();
      ctx.moveTo(0, CHEST);
      ctx.lineTo(-14, CHEST + 14);
      ctx.stroke();
    } else {
      const lArmSwing = isAir ? -0.4 : wk2 * 0.5;
      const rArmSwing = isAir ?  0.4 : -wk2 * 0.5;

      // Left Arm
      ctx.beginPath();
      ctx.moveTo(0, CHEST);
      ctx.lineTo(-12 + Math.sin(lArmSwing) * 8, CHEST + 18 + Math.cos(lArmSwing) * 3);
      ctx.stroke();

      // Right Arm
      ctx.beginPath();
      ctx.moveTo(0, CHEST);
      ctx.lineTo(12 + Math.sin(rArmSwing) * 8, CHEST + 18 + Math.cos(rArmSwing) * 3);
      ctx.stroke();
    }

    ctx.restore(); 
    ctx.restore(); 
  }

  _drawWeapon(ctx) {
    ctx.save();
    if (this.wp === 'Buster Sword') {
      ctx.strokeStyle = '#90a4ae'; ctx.fillStyle = '#cfd8dc'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(48, 5);
      ctx.stroke();
      
      ctx.fillStyle = '#b0bec5';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(48, 2); ctx.lineTo(48, 10); ctx.lineTo(0, 6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke();

      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(3, 5); ctx.stroke();

    } else if (this.wp === 'Assault Rifle') {
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(0, -3, 36, 7);
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(-10, -2, 12, 5);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(34, -1, 14, 3);
      ctx.fillStyle = '#3d2b1f';
      ctx.fillRect(10, 4, 6, 9);
      ctx.fillStyle = '#555';
      ctx.fillRect(16, 4, 7, 11);

    } else if (this.wp === 'Smasher Club') {
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, 4); ctx.stroke();
      ctx.fillStyle = '#795548';
      ctx.beginPath();
      ctx.ellipse(40, 4, 12, 10, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#bdbdbd';
      for (let si = 0; si < 4; si++) {
        const ang = (si / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(40 + Math.cos(ang) * 10, 4 + Math.sin(ang) * 8);
        ctx.lineTo(40 + Math.cos(ang) * 16, 4 + Math.sin(ang) * 13);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawRagdoll() {
    const rp = this.rp;
    if (!rp.length) return;

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    if (rp.length >= 8) {
      ctx.strokeStyle = this.c;
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(rp[1].x, rp[1].y);
      ctx.lineTo(rp[2].x, rp[2].y);
      ctx.lineTo(rp[3].x, rp[3].y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rp[1].x, rp[1].y); ctx.lineTo(rp[4].x, rp[4].y); 
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rp[1].x, rp[1].y); ctx.lineTo(rp[5].x, rp[5].y); 
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rp[3].x, rp[3].y); ctx.lineTo(rp[6].x, rp[6].y); 
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rp[3].x, rp[3].y); ctx.lineTo(rp[7].x, rp[7].y); 
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rp[0].x, rp[0].y); ctx.lineTo(rp[1].x, rp[1].y);
      ctx.stroke();
    }

    rp.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.ang);
      ctx.fillStyle = this.c;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }
}