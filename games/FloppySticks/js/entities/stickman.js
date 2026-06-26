/**
 * FloppySticks — stickman.js v3.0 (COMPLETE & FIXED)
 * Calibrated movement vectors to eliminate speed variations on higher refresh rate screens.
 */

class S {
  constructor(x, c, bot = false) {
    this.sx  = x;
    this.c   = c;
    this.bot = bot;
    this.gy  = H - 100;
    this.nx  = null;
    this.ny  = null;
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
    if (this.rd || gs === 'MATCH_OVER') return;
    if (this.gr) {
      this.vy = -14.5;
      this.gr = false;
      this.sq = 1.4;
      this.jc = 1;
      fx(this.x, this.gy, '#6a824e', 4);
    } else if (this.jc < 2) {
      this.vy = -12.5;
      this.jc = 2;
      this.sq = 1.3;
      fx(this.x, this.y, '#e2e8f0', 5, { glow: true });
    }
  }

  attack() {
    if (this.rd || gs === 'MATCH_OVER' || this.ac > 0) return;
    if (!this.wp) return;

    if (this.wp === 'Buster Sword' || this.wp === 'Smasher Club') {
      this.atk = true;
      this.asw = -0.5;
      this.ac = this.wp === 'Buster Sword' ? 24 : 35;
      
      const op = this.bot ? P : B;
      if (op && !op.rd) {
        const range = this.wp === 'Buster Sword' ? 75 : 60;
        const damage = this.wp === 'Buster Sword' ? 22 : 30;
        const dir = this.fl ? -1 : 1;
        const reached = dir > 0 ? (op.x > this.x && op.x < this.x + range) : (op.x < this.x && op.x > this.x - range);
        
        if (reached && Math.abs(op.y - this.y) < 45) {
          op.hit(damage, dir);
          if (gs === 'ONLINE_MODE' && !this.bot) {
            send({ type: 'hit', amt: damage, kb: dir });
          }
        }
      }
    } else if (this.wp === 'Assault Rifle') {
      this.ac = 8;
      this.atk = true;
      const fX = this.x + (this.fl ? -30 : 30);
      const fY = this.y - 36;
      const bVx = this.fl ? -750 : 750;
      
      bul.push({ x: fX, y: fY, vx: bVx, bot: this.bot });
      if (gs === 'ONLINE_MODE' && !this.bot) {
        send({ type: 'bullet', x: fX, y: fY, vx: bVx });
      }
    }
  }

  hit(amt, kbDir) {
    if (this.rd || gs === 'MATCH_OVER') return;
    this.hp = Math.max(0, this.hp - amt);
    this.ff = 6;
    this.vx += kbDir * 350;
    this.vy -= 4.5;
    shk = 12;
    
    fx(this.x, this.y - 35, '#ffffff', 6);
    fx(this.x, this.y - 35, this.c, 12);
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
    const pts = [
      { n: 'hd', o: [0, -54],  r: 9 },
      { n: 'bd', o: [0, -32],  r: 12 },
      { n: 'lh', o: [-14, -32], r: 6 },
      { n: 'rh', o: [14, -32], r: 6 },
      { n: 'lf', o: [-10, -6],  r: 7 },
      { n: 'rf', o: [10, -6],  r: 7 }
    ];
    pts.forEach(p => {
      this.rp.push({
        x:   this.x + p.o[0],
        y:   this.y + p.o[1],
        vx:  this.vx * 0.4 + (Math.random() - 0.5) * 4 + dir * 3,
        vy:  this.vy * 0.4 - Math.random() * 5 - 2,
        r:   p.r,
        ang: Math.random() * Math.PI,
        va:  (Math.random() - 0.5) * 0.2
      });
    });

    if (gs === 'ONLINE_MODE' && window.isHost) {
      setTimeout(() => this._scoreRule(), 1200);
    } else if (gs === 'BOT_MODE') {
      setTimeout(() => this._scoreRule(), 1200);
    }
  }

  _scoreRule() {
    if (gs === 'MATCH_OVER') return;
    if (this.bot) ps++; else bs++;
    
    const psUi = g('p-score');
    const osUi = g('o-score');
    if (psUi) psUi.textContent = ps + ' pts';
    if (osUi) osUi.textContent = bs + ' pts';

    if (gs === 'ONLINE_MODE' && window.isHost) {
      send({ type: 'score', hs: ps, gs: bs });
    }

    if (ps >= MX || bs >= MX) {
      gs = 'MATCH_OVER';
      if (gs === 'ONLINE_MODE' && window.isHost) send({ type: 'over' });
      _save();
    } else {
      if (gs === 'ONLINE_MODE' && window.isHost) {
        this.respawn();
        send({ type: 'ropp' });
      } else if (gs === 'BOT_MODE') {
        P.respawn();
        B.respawn();
      }
    }
  }

  _ai(dt) {
    if (!this.bot || this.rd || gs !== 'BOT_MODE' || !P) return;
    const dist = P.x - this.x;
    this.fl = dist < 0;

    if (Math.abs(dist) > (this.wp ? 50 : 120)) {
      this.vx = dist > 0 ? 170 : -170;
    } else {
      this.vx *= Math.pow(0.2, dt * 60);
    }

    if (P.y < this.y - 60 && Math.random() < 0.03) this.jump();

    if (this.wp && Math.abs(dist) < (this.wp === 'Assault Rifle' ? 320 : 70) && Math.random() < 0.07) {
      this.attack();
    }
  }

  update(dt) {
    this.gy = H - 100;

    if (this.rd) {
      this.rp.forEach(p => {
        p.vx *= Math.pow(0.96, dt * 60);
        p.vy += GV * dt;
        p.x  += p.vx * 60 * dt;
        p.y  += p.vy * 60 * dt;
        p.ang += p.va * 60 * dt;
        if (p.y >= this.gy - p.r) {
          p.y = this.gy - p.r;
          p.vy = -p.vy * 0.2;
          p.vx *= 0.8;
          p.va *= 0.5;
        }
      });
      return;
    }

    if (gs === 'MATCH_OVER') {
      this.vx *= Math.pow(0.7, dt * 60);
      this.vy += GV * dt;
      this.y += this.vy * 60 * dt;
      if (this.y >= this.gy) { this.y = this.gy; this.vy = 0; }
      return;
    }

    if (this.ac > 0) this.ac -= 60 * dt;
    if (this.ff > 0) this.ff -= 60 * dt;
    
    if (this.atk) {
      this.asw += 7.5 * dt;
      if (this.asw >= 0.9) { this.atk = false; this.asw = 0; }
    }

    if (this.bot) {
      this._ai(dt);
    } else {
      if (keys.a) { this.vx = -220; this.fl = true; }
      else if (keys.d) { this.vx = 220; this.fl = false; }
      else { this.vx *= Math.pow(0.18, dt * 60); }
    }

    this.vy += GV * dt;
    this.x  += this.vx * dt;
    this.y  += this.vy * 60 * dt;

    this.x = Math.max(22, Math.min(W - 22, this.x));

    if (this.y >= this.gy) {
      if (!this.gr) { this.sq = 0.65; fx(this.x, this.gy, '#6a824e', 4); }
      this.y = this.gy;
      this.vy = 0;
      this.gr = true;
      this.jc = 0;
    } else {
      this.gr = false;
    }

    this.sq += (1 - this.sq) * 10 * dt;
    this.fa += 0.15 * (this.vx / 15 - this.fa);
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.rd) {
      ctx.restore();
      ctx.save();
      this.rp.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.fillStyle = this.ff > 0 ? '#ffffff' : this.c;
        ctx.beginPath();
        if (p.r === 9) ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        else ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();
      return;
    }

    ctx.scale(this.fl ? -1 : 1, 1);
    ctx.scale(2 - this.sq, this.sq);

    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = this.ff > 0 ? '#ffffff' : this.c;

    const hY = -54, bY = -32, fY = 0;
    const walk = Math.sin(Date.now() * 0.0095) * (Math.abs(this.vx) > 20 ? 1 : 0);

    ctx.beginPath();
    ctx.moveTo(0, bY);
    ctx.lineTo(0, -14);
    ctx.stroke();

    ctx.fillStyle = this.ff > 0 ? '#ffffff' : this.c;
    ctx.beginPath();
    ctx.arc(0, hY, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-8 + walk * 6, fY);
    ctx.moveTo(0, -14);
    ctx.lineTo(8 - walk * 6, fY);
    ctx.stroke();

    ctx.save();
    ctx.translate(5, bY + 4);
    if (this.wp && !this.bot) this.flp = false;
    
    if (this.atk) ctx.rotate(this.asw);
    else ctx.rotate(walk * 0.12);

    if (this.wp === 'Buster Sword') {
      ctx.strokeStyle = '#78909c'; ctx.fillStyle = '#b0bec5'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.rect(0, -7, 44, 14); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, 0); ctx.stroke();
      ctx.fillStyle = '#d97706'; ctx.fillRect(-1, -9, 3, 18);
    } else if (this.wp === 'Assault Rifle') {
      ctx.fillStyle = '#3d2b1f'; ctx.fillRect(0, -5, 34, 10);
      ctx.fillStyle = '#57342a'; ctx.fillRect(10, 3, 6, 8);
      ctx.fillStyle = '#6b5a50'; ctx.fillRect(34, -2, 8, 4);
      ctx.fillStyle = '#b45309'; ctx.fillRect(14, -7, 8, 3);
    } else if (this.wp === 'Smasher Club') {
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(38, -3); ctx.stroke();
      ctx.lineWidth = 10; ctx.strokeStyle = '#b45309';
      ctx.beginPath(); ctx.moveTo(32, -4); ctx.lineTo(38, -3); ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    if (this.wp) {
      ctx.moveTo(0, bY + 2);
      ctx.lineTo(14, bY + 6);
    } else {
      ctx.moveTo(0, bY + 2);
      ctx.lineTo(-6 - walk * 3, -18);
      ctx.moveTo(0, bY + 2);
      ctx.lineTo(6 + walk * 3, -18);
    }
    ctx.stroke();

    ctx.restore();
  }
}