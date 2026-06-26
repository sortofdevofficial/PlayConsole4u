'use strict';

class S {
  constructor(x, c, bot = false) {
    this.sx = x;
    this.c = c; // Expecting hex string like '#00f0ff' for player to match image_f224a4.png
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
    this.ac = 0; 
    this.atk = false;
    this.ff = 0; 
    this.rd = false; 
    this.rp = [];
    this.walkCycle = 0;
    this.sq = 1; 
    this.lean = 0;
    this.slashArc = 0; // Animation tracker for weapon trail
  }

  respawn() {
    this._i();
    const id = this.bot ? 'b-hp' : 'p-hp';
    if (document.getElementById(id)) document.getElementById(id).style.width = '100%';
  }

  jump() {
    if (this.rd || gs === 'MATCH_OVER' || window.cutsceneActive) return;
    if (this.gr) {
      this.vy = -16;
      this.gr = false;
      this.sq = 1.5; 
      this.jc = 1;
      fx(this.x, this.gy, '#ffffff', 8, { spread: 3 });
    } else if (this.jc < 2) {
      this.vy = -13;
      this.jc = 2;
      this.sq = 1.3;
      fx(this.x, this.y, this.c, 6);
    }
  }

  attack() {
    if (this.rd || gs === 'MATCH_OVER' || this.ac > 0 || window.cutsceneActive) return;
    this.atk = true;
    this.slashArc = 1.0; // Trigger visual slash effect
    
    this.ac = this.wp ? 22 : 15; 
    const range = this.wp === 'Buster Sword' ? 95 : (this.wp === 'Smasher Club' ? 80 : 45);
    const damage = this.wp === 'Buster Sword' ? 25 : (this.wp === 'Smasher Club' ? 35 : 12);
    const dir = this.fl ? -1 : 1;

    setTimeout(() => {
      const op = this.bot ? P : B;
      if (!op || op.rd) return;
      const reached = dir > 0
        ? (op.x > this.x && op.x < this.x + range)
        : (op.x < this.x && op.x > this.x - range);
        
      if (reached && Math.abs(op.y - this.y) < 70) {
        op.hit(damage, dir);
      }
    }, 80);
  }

  hit(amt, kbDir) {
    if (this.rd || gs === 'MATCH_OVER') return;
    this.hp = Math.max(0, this.hp - amt);
    this.ff = 8;
    this.vx = kbDir * 450;
    this.vy = -6;
    window.shk = 14; 

    addFloatingText(this.x, this.y - 90, `-${amt}`, '#ef4444');
    fx(this.x, this.y - 45, '#ff2222', 12, { spread: 5 });

    const hpUi = document.getElementById(this.bot ? 'b-hp' : 'p-hp');
    if (hpUi) hpUi.style.width = this.hp + '%';

    if (this.hp <= 0) this._rag(kbDir);
  }

  _rag(dir) {
    this.rd = true;
    this.rp = [];
    window.shk = 25;
    
    const parts = [
      { o: [0, -75], r: 13 },  // Head
      { o: [0, -52], r: 5 },   // Chest
      { o: [0, -30], r: 5 },   // Hips
      { o: [-12, -15], r: 4 }, // Leg L
      { o: [12, -15], r: 4 },  // Leg R
      { o: [-18, -45], r: 3.5 },// Arm L
      { o: [18, -45], r: 3.5 } // Arm R
    ];

    parts.forEach(p => {
      this.rp.push({
        x: this.x + p.o[0],
        y: this.y + p.o[1],
        vx: this.vx * 0.4 + (Math.random() - 0.5) * 200 + dir * 250,
        vy: this.vy - 120 - Math.random() * 250,
        r: p.r,
        ang: Math.random() * Math.PI * 2,
        va: (Math.random() - 0.5) * 15
      });
    });

    setTimeout(() => this._scoreRule(), 1200);
  }

  _scoreRule() {
    if (gs === 'MATCH_OVER') return;
    if (this.bot) window.ps++; else window.bs++;
    
    if (document.getElementById('p-score')) document.getElementById('p-score').textContent = window.ps + ' pts';
    if (document.getElementById('o-score')) document.getElementById('o-score').textContent = window.bs + ' pts';

    if (window.ps >= window.MX || window.bs >= window.MX) {
      window.gs = 'MATCH_OVER';
    } else {
      if (P) P.respawn();
      if (B) B.respawn();
    }
  }

  _ai(dt) {
    if (!this.bot || this.rd || window.gs !== 'BOT_MODE' || !P || window.cutsceneActive) return;

    let targetX = P.x;
    let isChasingCrate = false;
    let attackRange = this.wp === 'Buster Sword' ? 80 : (this.wp === 'Smasher Club' ? 70 : 40);

    // 1. CRATE PRIORITIZATION LOGIC
    if (window.pku.length > 0) {
      const targetCrate = window.pku[0];
      targetX = targetCrate.x;
      isChasingCrate = true;

      // SPECIFIC RULE: If player is standing still and crate is next to player, execute tactical jump-dive
      const playerIsStill = Math.abs(P.vx) < 15;
      const crateNearPlayer = Math.abs(targetCrate.x - P.x) < 160;
      if (playerIsStill && crateNearPlayer && Math.abs(this.x - targetCrate.x) > 100) {
        if (this.gr && Math.random() < 0.15) {
          this.jump();
          this.vx = (targetCrate.x > this.x ? 450 : -450); // Aggressive dive speed boost
        }
      }
    }

    const distToTarget = targetX - this.x;
    this.fl = (window.pku.length > 0) ? (distToTarget < 0) : (P.x < this.x);
    const absDist = Math.abs(distToTarget);

    // 2. SPEED CONTROLLER (Ultra fast crate snatching)
    const runSpeed = isChasingCrate ? 340 : 220;

    if (isChasingCrate) {
      this.vx = this.fl ? -runSpeed : runSpeed;
    } else {
      // Aggressive Player Combat Engagement Loop
      if (absDist > attackRange) {
        this.vx = this.fl ? -runSpeed : runSpeed;
      } else {
        this.vx *= Math.pow(0.05, dt * 60); // Break smoothly inside strike zone
      }
    }

    // 3. COMBAT EXECUTION LOGIC (No more hitting with hands if holding weapon!)
    if (!isChasingCrate && Math.abs(P.x - this.x) <= attackRange + 15 && Math.abs(P.y - this.y) < 60) {
      if (this.ac <= 0 && Math.random() < 0.22) {
        this.attack();
      }
    }

    // Dynamic obstacle jumping
    if (isChasingCrate && this.gr && Math.random() < 0.02 && Math.abs(this.x - targetX) > 200) {
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
          p.vy = -p.vy * 0.3;
          p.vx *= 0.75;
          p.va *= 0.75;
        }
      });
      return;
    }

    if (this.ac > 0) this.ac -= 60 * dt;
    if (this.ff > 0) this.ff -= 60 * dt;
    if (this.slashArc > 0) this.slashArc -= 4 * dt;
    if (this.ac <= 0) this.atk = false;

    if (this.bot) {
      this._ai(dt);
    } else if (!window.cutsceneActive) {
      if (keys.a) { this.vx = -260; this.fl = true; }
      else if (keys.d) { this.vx = 260; this.fl = false; }
      else { this.vx *= Math.pow(0.05, dt * 60); }
    }

    this.vy += window.GV * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt * 60;

    this.x = Math.max(40, Math.min(W - 40, this.x));

    if (this.y >= this.gy) {
      if (!this.gr) {
        this.sq = 0.55; 
        fx(this.x, this.gy, '#22c55e', 6); 
      }
      this.y = this.gy;
      this.vy = 0;
      this.gr = true;
      this.jc = 0;
    }

    if (Math.abs(this.vx) > 15 && this.gr) {
      this.walkCycle += dt * 18;
    } else {
      this.walkCycle = 0;
    }

    // Dynamic Animation Interpolations
    this.lean += ((this.vx * 0.0015) - this.lean) * 12 * dt;
    this.sq += (1 - this.sq) * 12 * dt;
  }

  draw() {
    if (this.rd) {
      this._drawRagdoll();
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.fl ? -1 : 1, 1);
    
    // Kinetic Scale Transform
    ctx.scale(2 - this.sq, this.sq);

    const isMoving = Math.abs(this.vx) > 15 && this.gr;
    const color = this.ff > 0 ? '#ffffff' : this.c;

    // HIGH-END NEON GLOW ENGINE MATCHING image_f224a4.png
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;

    // RIG CONNECTORS
    const HIPS = -28;
    const NECK = -56;
    const HEAD_Y = -70;

    let legW1 = 0, legW2 = 0;
    if (isMoving) {
      legW1 = Math.sin(this.walkCycle) * 18;
      legW2 = Math.cos(this.walkCycle) * 18;
    } else if (!this.gr) {
      legW1 = -12; legW2 = 12;
    }

    // 1. DRAW ARMS & WEAPON SWING ARC TRAILS
    if (this.atk && this.slashArc > 0) {
      ctx.save();
      ctx.shadowBlur = 25;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.globalAlpha = this.slashArc;
      ctx.beginPath();
      ctx.arc(0, NECK, 70, -Math.PI / 3, Math.PI / 1.5);
      ctx.stroke();
      ctx.restore();
    }

    // 2. DRAW CONNECTED LEGS (Smooth knee bends)
    // Front Leg
    ctx.beginPath();
    ctx.moveTo(0, HIPS);
    let kx1 = legW1 * 0.6 + (isMoving ? 8 : 0);
    let ky1 = -14 + (isMoving ? Math.sin(this.walkCycle * 2) * 3 : 0);
    ctx.lineTo(kx1, ky1);
    ctx.lineTo(legW1 * 1.3, 0);
    ctx.stroke();

    // Back Leg
    ctx.beginPath();
    ctx.moveTo(0, HIPS);
    let kx2 = legW2 * 0.6 - (isMoving ? 4 : 0);
    let ky2 = -14 + (isMoving ? Math.cos(this.walkCycle * 2) * 3 : 0);
    ctx.lineTo(kx2, ky2);
    ctx.lineTo(legW2 * 1.3, 0);
    ctx.stroke();

    // 3. DRAW SPINE & LEAN BODY MATRIX
    ctx.save();
    ctx.rotate(this.lean);
    
    ctx.beginPath();
    ctx.moveTo(0, HIPS);
    ctx.lineTo(0, NECK);
    ctx.stroke();

    // Connected Arms Axis
    ctx.beginPath();
    let armX = isMoving ? legW2 * 0.5 : 12;
    if (this.atk) {
      const prog = this.ac / (this.wp ? 22 : 15);
      ctx.save();
      ctx.translate(0, NECK);
      ctx.rotate(prog * Math.PI - Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(28, 0);
      ctx.stroke();
      if (this.wp) this._drawWeapon(28, 0);
      ctx.restore();
    } else {
      // Normal dynamic body arm poses
      ctx.moveTo(0, NECK);
      ctx.lineTo(armX, -38);
      ctx.moveTo(0, NECK);
      ctx.lineTo(-armX, -38);
      ctx.stroke();

      if (this.wp) {
        ctx.save();
        ctx.translate(armX, -38);
        ctx.rotate(-Math.PI / 3.5 + (this.vy * 0.02));
        this._drawWeapon(0, 0);
        ctx.restore();
      }
    }

    // 4. PERFECTLY MOUNTED GLOWING HEAD
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, HEAD_Y - NECK, 11.5, 0, Math.PI * 2);
    ctx.fill();

    // Intense cyber glowing eyes matching the image asset
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, HEAD_Y - NECK - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Pop lean context
    ctx.restore(); // Pop core identity matrix
  }

  _drawWeapon(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.wp === 'Buster Sword' ? '#00f0ff' : '#f59e0b';
    
    if (this.wp === 'Buster Sword') {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.lineTo(-4, -45);
      ctx.lineTo(6, -40);
      ctx.lineTo(4, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Guard
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-8, 8, 16, 5);
    } else if (this.wp === 'Smasher Club') {
      ctx.fillStyle = '#ea580c';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3, 10);
      ctx.lineTo(-7, -35);
      ctx.lineTo(7, -35);
      ctx.lineTo(3, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawRagdoll() {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.c;
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