'use strict';

class S {
  constructor(x, c, bot = false) {
    this.sx = x;
    this.c = c;
    this.bot = bot;
    this._i();
  }

  _i() {
    this.x = this.sx;
    this.y = H - 100;
    this.gy = H - 100;
    this.vx = 0;
    this.vy = 0;
    this.hp = 100;
    this.gr = false;
    this.fl = this.bot; 
    this.wp = null;
    this.jc = 0;
    this.ac = 0; // attack cooldown/animation
    this.atk = false;
    this.ff = 0; // flash frames (hit)
    this.rd = false; // ragdoll (dead)
    this.rp = [];
    this.walkCycle = 0;
    
    // Smooth animation targets
    this.sq = 1; // squash/stretch
  }

  respawn() {
    this._i();
    if (document.getElementById(this.bot ? 'b-hp' : 'p-hp')) {
      document.getElementById(this.bot ? 'b-hp' : 'p-hp').style.width = '100%';
    }
  }

  jump() {
    if (this.rd || gs === 'MATCH_OVER' || window.cutsceneActive) return;
    if (this.gr) {
      this.vy = -14;
      this.gr = false;
      this.sq = 1.4; // Stretch on jump
      this.jc = 1;
      fx(this.x, this.gy, '#ffffff', 5, { spread: 2 });
    } else if (this.jc < 2) {
      this.vy = -12;
      this.jc = 2;
      this.sq = 1.2;
      fx(this.x, this.y, '#e2e8f0', 5);
    }
  }

  attack() {
    if (this.rd || gs === 'MATCH_OVER' || this.ac > 0 || window.cutsceneActive) return;
    this.atk = true;
    
    // Weapon logic
    if (this.wp === 'Buster Sword' || this.wp === 'Smasher Club' || !this.wp) {
      this.ac = this.wp ? 25 : 20; 
      const range = this.wp ? 70 : 45;
      const damage = this.wp === 'Buster Sword' ? 25 : (this.wp === 'Smasher Club' ? 30 : 10);
      const dir = this.fl ? -1 : 1;

      // Hitbox delay
      setTimeout(() => {
        const op = this.bot ? P : B;
        if (!op || op.rd) return;
        const reached = dir > 0
          ? (op.x > this.x && op.x < this.x + range)
          : (op.x < this.x && op.x > this.x - range);
          
        if (reached && Math.abs(op.y - this.y) < 60) {
          op.hit(damage, dir);
        }
      }, 100);
    }
  }

  hit(amt, kbDir) {
    if (this.rd || gs === 'MATCH_OVER') return;
    this.hp = Math.max(0, this.hp - amt);
    this.ff = 10;
    this.vx = kbDir * 300;
    this.vy = -5;
    window.shk = 10; // Screen shake

    addFloatingText(this.x, this.y - 80, `-${amt}`, '#ef4444');
    fx(this.x, this.y - 40, '#ff3333', 8, { spread: 4 });

    const hpUi = document.getElementById(this.bot ? 'b-hp' : 'p-hp');
    if (hpUi) hpUi.style.width = this.hp + '%';

    if (this.hp <= 0) this._rag(kbDir);
  }

  _rag(dir) {
    this.rd = true;
    this.rp = [];
    window.shk = 20;
    
    // Spawn ragdoll parts based on exact joints
    const parts = [
      { o: [0, -70], r: 12 }, // Head
      { o: [0, -50], r: 4 },  // Chest
      { o: [0, -30], r: 4 },  // Hips
      { o: [-10, -15], r: 4 },// Leg L
      { o: [10, -15], r: 4 }, // Leg R
      { o: [-15, -40], r: 3 },// Arm L
      { o: [15, -40], r: 3 }  // Arm R
    ];

    parts.forEach(p => {
      this.rp.push({
        x: this.x + p.o[0],
        y: this.y + p.o[1],
        vx: this.vx * 0.5 + (Math.random() - 0.5) * 150 + dir * 200,
        vy: this.vy - 100 - Math.random() * 200,
        r: p.r,
        ang: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 10
      });
    });

    setTimeout(() => this._scoreRule(), 1500);
  }

  _scoreRule() {
    if (gs === 'MATCH_OVER') return;
    if (this.bot) window.ps++; else window.bs++;
    
    document.getElementById('p-score').textContent = window.ps + ' pts';
    document.getElementById('o-score').textContent = window.bs + ' pts';

    if (window.ps >= window.MX || window.bs >= window.MX) {
      window.gs = 'MATCH_OVER';
    } else {
      if (P) P.respawn();
      if (B) B.respawn();
    }
  }

  _ai(dt) {
    if (!this.bot || this.rd || window.gs !== 'BOT_MODE' || !P || window.cutsceneActive) return;
    
    const dist = P.x - this.x;
    this.fl = dist < 0; // Always face player
    const absDist = Math.abs(dist);

    const targetDist = this.wp === 'Assault Rifle' ? 250 : 60;

    // AI Movement Logic
    if (absDist > targetDist + 10) {
      this.vx = this.fl ? -180 : 180; // Run towards
    } else if (absDist < targetDist - 10) {
      this.vx = this.fl ? 100 : -100; // Back away slightly if too close
    } else {
      this.vx *= Math.pow(0.1, dt * 60); // Stop
    }

    // AI Attack Logic
    if (absDist <= targetDist + 15 && this.ac <= 0 && Math.random() < 0.05) {
      this.attack();
    }

    // AI Jump Logic (if player jumps or randomly to dodge)
    if ((P.y < this.y - 40 && Math.random() < 0.05) || (Math.random() < 0.01)) {
      this.jump();
    }
  }

  update(dt) {
    if (this.rd) {
      this.rp.forEach(p => {
        p.vy += window.GV * dt * 0.8;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.ang += p.va * dt;
        if (p.y >= this.gy - p.r) {
          p.y = this.gy - p.r;
          p.vy = -p.vy * 0.4;
          p.vx *= 0.8;
          p.va *= 0.8;
        }
      });
      return;
    }

    if (this.ac > 0) this.ac -= 60 * dt;
    if (this.ff > 0) this.ff -= 60 * dt;
    if (this.ac <= 0) this.atk = false;

    if (this.bot) {
      this._ai(dt);
    } else if (!window.cutsceneActive) {
      // Player Input
      if (keys.a) { this.vx = -240; this.fl = true; }
      else if (keys.d) { this.vx = 240; this.fl = false; }
      else { this.vx *= Math.pow(0.1, dt * 60); }
    }

    this.vy += window.GV * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt * 60;

    // Arena bounds
    this.x = Math.max(30, Math.min(W - 30, this.x));

    // Ground Collision
    if (this.y >= this.gy) {
      if (!this.gr) {
        this.sq = 0.6; // Squash on land
        fx(this.x, this.gy, '#a3e635', 4); // Grass particle effect on land
      }
      this.y = this.gy;
      this.vy = 0;
      this.gr = true;
      this.jc = 0;
    }

    // Walk cycle animation
    if (Math.abs(this.vx) > 20 && this.gr) {
      this.walkCycle += dt * 15;
    } else {
      this.walkCycle = 0;
    }

    // Recover squash/stretch
    this.sq += (1 - this.sq) * 10 * dt;
  }

  draw() {
    if (this.rd) {
      this._drawRagdoll();
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.fl ? -1 : 1, 1);
    
    // Apply Squash & Stretch
    ctx.scale(2 - this.sq, this.sq);

    const isMoving = Math.abs(this.vx) > 20 && this.gr;
    const isAir = !this.gr;
    const color = this.ff > 0 ? '#ffffff' : this.c;

    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;

    // RIG CONSTANTS (Relative to feet at 0,0)
    const HIPS = -30;
    const NECK = -55;
    const HEAD_Y = -68;

    // ANIMATION VARIABLES
    let swing1 = 0, swing2 = 0;
    if (isMoving) {
      swing1 = Math.sin(this.walkCycle) * 15;
      swing2 = Math.cos(this.walkCycle) * 15;
    } else if (isAir) {
      swing1 = -10;
      swing2 = 10;
    }

    // DRAW LEGS
    ctx.beginPath();
    // Back Leg
    ctx.moveTo(0, HIPS);
    ctx.lineTo(swing2, -15); 
    ctx.lineTo(isMoving ? swing2 * 1.5 : (isAir ? 5 : 8), 0);
    // Front Leg
    ctx.moveTo(0, HIPS);
    ctx.lineTo(swing1, -15);
    ctx.lineTo(isMoving ? swing1 * 1.5 : (isAir ? -5 : -8), 0);
    ctx.stroke();

    // DRAW SPINE
    ctx.beginPath();
    ctx.moveTo(0, HIPS);
    ctx.lineTo(0, NECK);
    ctx.stroke();

    // DRAW ARMS & WEAPON
    ctx.beginPath();
    
    let armTargetX = isMoving ? -swing2 : (isAir ? 15 : 10);
    let armTargetY = -35;
    
    if (this.atk) {
      // Attack animation swing
      const progress = this.ac / (this.wp ? 25 : 20);
      ctx.save();
      ctx.translate(0, NECK);
      ctx.rotate(progress * Math.PI - Math.PI/2);
      ctx.moveTo(0,0);
      ctx.lineTo(25, 0); // Extended arm
      ctx.stroke();
      if (this.wp) this._drawWeapon(25, 0);
      ctx.restore();
    } else {
      // Normal Arms
      // Back Arm
      ctx.moveTo(0, NECK);
      ctx.lineTo(-armTargetX, armTargetY);
      // Front Arm
      ctx.moveTo(0, NECK);
      ctx.lineTo(armTargetX, armTargetY);
      ctx.stroke();

      if (this.wp) {
        ctx.save();
        ctx.translate(armTargetX, armTargetY);
        ctx.rotate(-Math.PI / 4);
        this._drawWeapon(0,0);
        ctx.restore();
      }
    }

    // DRAW HEAD (Perfect round circle, fully connected)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, HEAD_Y, 11, 0, Math.PI * 2);
    ctx.fill();

    // Little eye for direction
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, HEAD_Y - 2, 2, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }

  _drawWeapon(x, y) {
    ctx.save();
    ctx.translate(x, y);
    if (this.wp === 'Buster Sword') {
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-5, -30, 10, 40); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d97706'; ctx.fillRect(-8, 5, 16, 4); // crossguard
    } else if (this.wp === 'Smasher Club') {
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-4, -30); ctx.lineTo(4, -30); ctx.fill();
    }
    ctx.restore();
  }

  _drawRagdoll() {
    ctx.save();
    this.rp.forEach(p => {
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