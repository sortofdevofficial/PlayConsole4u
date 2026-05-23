/**
 * FloppySticks — stickman.js v1.5
 * Stickman physics, AI, combat, and rendering.
 * Depends on globals set by game.js:
 * W, H, GV, MXP, ptl, bul, pku, gs, P, B, keys, shk, ps, bs, MX, WPS
 * fx(), _save(), g()
 * Depends on globals set by network.js:
 * send(), isHost, conn
 */

class S {
  constructor(x, c, bot = false) {
    this.sx = x;
    this.c  = c;
    this.bot = bot;
    this.gy = H - 100;
    this.nx = null;
    this.ny = null;
    this._i();
  }

  _i() {
    this.x   = this.sx;  this.y  = this.gy;
    this.vx  = 0;        this.vy = 0;
    this.hp  = 100;
    this.gr  = false;    this.at = 0;
    this.fl  = this.bot; this.wp = null;
    this.jc  = 0;        this.fa = 0;
    this.flp = false;    this.sq = 1;
    this.ac  = 0;        this.asw = 0;
    this.atk = false;    this.ff  = 0;
    this.rd  = false;    this.rp  = [];
    this.nx  = null;     this.ny  = null;
  }

  respawn() {
    if (gs === 'MATCH_OVER') return;
    this._i();
    this.sx = this.bot ? W - 200 : 200;
    this.x  = this.sx;
    this._hud();
  }

  _hud() {
    if (!this.bot) {
      g('p-hp').style.width     = this.hp + '%';
      g('p-weapon').textContent = this.wp || 'NONE';
    } else {
      g('b-hp').style.width     = this.hp + '%';
      g('b-weapon').textContent = this.wp || 'NONE';
    }
  }

  hit(a, kb) {
    if (this.rd || gs === 'MATCH_OVER') return;
    this.hp   = Math.max(0, this.hp - a);
    this.ff   = 6;
    this.vx  += kb * 5.5;
    this.vy  -= 2;
    shk       = 7;
    fx(this.x, this.y - 40, '#fff',    4);
    fx(this.x, this.y - 40, '#f1c40f', 2);
    this._hud();
    if (this.hp <= 0) this._rag(kb);
  }

  _rag(f) {
    this.rd = true;

    if (this.bot) { ps++; g('p-score').textContent = ps + ' pts'; }
    else          { bs++; g('o-score').textContent = bs + ' pts'; }

    [
      [0, -65, 11, 'c'], [0, -42, 24, 'l'],
      [-8, -48, 18, 'l'], [8, -48, 18, 'l'],
      [-6, -18, 20, 'l'], [6, -18, 20, 'l']
    ].forEach(([rx, ry, s, t]) => this.rp.push({
      x: this.x + rx, y: this.y + ry,
      vx: f * 5 + (Math.random() - .5) * 4,
      vy: -3 + (Math.random() - 1.5) * 2,
      ang: Math.random() * Math.PI,
      va:  (Math.random() - .5) * .2,
      t, s
    }));

    if (gs === 'ONLINE_MODE' && conn?.open)
      send({ type: 'score', hs: isHost ? ps : bs, gs: isHost ? bs : ps });

    if (ps >= MX || bs >= MX) {
      gs = 'MATCH_OVER';
      send({ type: 'over' });
      _save();
    } else {
      setTimeout(() => {
        this.respawn();
        if (gs === 'ONLINE_MODE') send({ type: 'ropp' });
      }, 1800);
    }
  }

  attack() {
    if (this.ac > 0 || !this.wp || this.rd) return;
    if (gs !== 'BOT_MODE' && gs !== 'ONLINE_MODE') return;

    this.atk = true;
    this.ac  = this.wp === 'Assault Rifle' ? 14 : 22;
    const d  = this.fl ? -1 : 1;

    if (this.wp === 'Assault Rifle') {
      const bx = this.x + 25 * d, by = this.y - 45;
      bul.push({ x: bx, y: by, vx: d * 15, bot: this.bot });
      fx(bx, by, '#e67e22', 2);
      if (gs === 'ONLINE_MODE' && !this.bot)
        send({ type: 'bullet', x: bx, y: by, vx: d * 15 });
    } else {
      this.asw = -Math.PI / 2.5;
      const foe = this.bot ? P : B;
      if (!foe.rd) {
        const sep = Math.abs(this.x - foe.x);
        const fwd = (this.fl && foe.x < this.x) || (!this.fl && foe.x > this.x);
        if (sep < 125 && fwd && Math.abs(this.y - foe.y) < 70) {
          const dmg = this.wp === 'Buster Sword' ? 24 : 35;
          if (gs === 'ONLINE_MODE' && !this.bot) send({ type: 'hit', amt: dmg, kb: d });
          else foe.hit(dmg, d);
        }
      }
    }
  }

  update() {
    this.gy = H - 100;

    // ── Ragdoll physics ──────────────────────────────────────────────────
    if (this.rd) {
      this.rp.forEach(p => {
        p.vx *= .98; p.vy += GV;
        p.x  += p.vx; p.y  += p.vy;
        p.ang += p.va;
        if (p.y >= this.gy) {
          p.y   = this.gy;
          p.vy  = -p.vy * .25;
          p.va *= .5;
        }
      });
      return;
    }

    if (gs === 'MATCH_OVER') { this.vx *= .8; return; }

    // Cooldowns / swing animation
    if (this.ac > 0) this.ac--;
    if (this.atk) {
      this.asw += .28;
      if (this.asw >= Math.PI / 2) { this.atk = false; this.asw = 0; }
    }
    if (this.flp) {
      this.fa += this.fl ? -.22 : .22;
      if (Math.abs(this.fa) >= Math.PI * 2) { this.flp = false; this.fa = 0; }
    }
    this.sq += (1 - this.sq) * .14;

    // ── Bot AI ────────────────────────────────────────────────────────────
    if (this.bot && gs === 'BOT_MODE') {
      const dist = Math.abs(this.x - P.x);
      this.fl = P.x < this.x;

      if (!P.rd) {
        // Dodge bullets
        for (const b of bul)
          if (!b.bot && Math.abs(this.x - b.x) < 140 && this.gr) {
            this.vy = -12; this.gr = false; this.jc = 1; break;
          }

        if (this.hp < 35 && dist < 200) {
          this.vx = P.x < this.x ? 4 : -4;
        } else {
          let tx = P.x;
          if (!this.wp && pku.length) {
            let best = Infinity;
            for (const p of pku) {
              const dd = Math.abs(this.x - p.x);
              if (dd < best) { best = dd; tx = p.x; }
            }
          }
          if      (this.x < tx - 45) this.vx =  3.8;
          else if (this.x > tx + 45) this.vx = -3.8;
          else                        this.vx *= .5;

          if (this.gr && this.jc === 0 && dist < 180 && Math.random() < .015) {
            this.vy = -12; this.gr = false; this.jc = 1;
          }
        }
        if (dist < 85 || (this.wp === 'Assault Rifle' && dist < 340)) this.attack();
      }
    }

    // ── Player input ──────────────────────────────────────────────────────
    if (!this.bot) {
      if      (keys.a) { this.vx = -5.5; this.fl = true;  }
      else if (keys.d) { this.vx =  5.5; this.fl = false; }
      else              this.vx *= .76;
    }

    // ── Physics ───────────────────────────────────────────────────────────
    this.vy += GV;
    this.x  += this.vx;
    this.y  += this.vy;

    if (this.y >= this.gy) {
      if (!this.gr) { this.sq = .78; fx(this.x, this.gy, '#6a824e', 2); }
      this.y  = this.gy;
      this.vy = 0;
      this.gr = true;
      this.jc = 0;
    } else {
      this.gr = false;
    }

    this.x = Math.max(25, Math.min(W - 25, this.x));

    if (Math.abs(this.vx) > .5 && this.gr) this.at += .28;
    else if (!this.gr)                       this.at  = 1.1;
    else                                     this.at *= .7;
  }

  draw() {
    // ── Ragdoll draw ──────────────────────────────────────────────────────
    if (this.rd) {
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.strokeStyle = this.c; ctx.fillStyle = this.c;
      this.rp.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.beginPath();
        if (p.t === 'c') { ctx.arc(0, 0, p.s, 0, Math.PI * 2); ctx.fill(); }
        else              { ctx.moveTo(0, -p.s / 2); ctx.lineTo(0, p.s / 2); }
        ctx.stroke();
        ctx.restore();
      });
      return;
    }

    // ── Active Live Stickman Rendering ───────────────────────────────────
    ctx.save();
    
    // Apply Global Squash / Stretch scale matrix relative to ground landing points
    ctx.translate(this.x, this.y);
    ctx.scale(1, this.sq);
    ctx.translate(-this.x, -this.y);
    ctx.lineWidth = 4; ctx.lineCap = 'round';

    // Flash character model on damage registration
    let dc = this.c;
    if (this.ff > 0) { this.ff--; if (this.ff % 2 === 0) dc = '#fff'; }
    ctx.strokeStyle = dc; ctx.fillStyle = dc;

    // Isolate torso coordinate space for directional tilt & jump-flips
    ctx.save();
    ctx.translate(this.x, this.y - 30);
    if (this.gr && Math.abs(this.vx) > .5)  ctx.rotate(this.vx * .025);
    if (this.flp)                           ctx.rotate(this.fa);
    ctx.translate(-this.x, -(this.y - 30));

    // Dynamic procedural idle breathing loop
    const bob = (this.gr && Math.abs(this.vx) <= .5) ? Math.sin(Date.now() * 0.005) * 1.5 : 0;
    const ny  = this.y - 55 + bob;
    const hy  = this.y - 25;
    const hy2 = ny - 12;

    // Draw Head & Spine
    ctx.beginPath(); ctx.arc(this.x, hy2, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x, ny); ctx.lineTo(this.x, hy); ctx.stroke();

    const sw = Math.sin(this.at) * 16;
    const fl = this.fl ? -1 : 1;

    // Draw Legs (Running swing configurations)
    ctx.beginPath(); ctx.moveTo(this.x, hy); ctx.lineTo(this.x + sw * fl, this.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x, hy); ctx.lineTo(this.x - sw * fl, this.y); ctx.stroke();

    // Draw Left Arm
    ctx.beginPath(); ctx.moveTo(this.x, ny + 4); ctx.lineTo(this.x - 14 * fl - sw * .1 * fl, ny + 14 + sw); ctx.stroke();

    // Calculate Right Arm / Hand weapon attachment anchor points dynamically inside the matrix
    let hx  = this.x + 18 * fl;
    let hy3 = ny + 12 - sw;
    
    // Modify hand grip extensions if engaging in close combat melee frames
    if (this.atk && this.wp !== 'Assault Rifle') { 
      hx = this.x + 24 * fl; 
      hy3 = ny + 4; 
    }
    
    // Draw Right Arm
    ctx.beginPath(); ctx.moveTo(this.x, ny + 4); ctx.lineTo(hx, hy3); ctx.stroke();

    // ── Weapon draw (Nested inside the translation matrix so it tracks flips perfectly) ──
    if (this.wp) {
      ctx.save();
      ctx.translate(hx, hy3); // Translate relative to weapon hand location
      if (this.fl) ctx.scale(-1, 1); // Face active alignment direction
      
      // Handle Melee / ranged weapon animation rotations smoothly
      if (this.atk) {
        if (this.wp === 'Assault Rifle') {
          // Subtle firearm firing recoil animation
          ctx.translate(-Math.random() * 3, (Math.random() - 0.5) * 1.5);
        } else {
          // Full rotational swinging arc for heavy melee swords and clubs
          ctx.rotate(this.asw);
        }
      } else {
        // Subtle weapon idle breathing animation sway
        ctx.rotate(Math.sin(Date.now() * 0.003) * 0.04);
      }

      // Render graphics primitives scaled to alignment orientation
      if (this.wp === 'Buster Sword') {
        ctx.strokeStyle = '#7f8c8d'; ctx.fillStyle = '#bdc3c7'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.rect(0, -7, 46, 14); ctx.fill(); ctx.stroke();
        
        // Handle grip extension back
        ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, 0); ctx.stroke();
        
        // Crossguard highlight detail
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(-1, -9, 3, 18);
      } else if (this.wp === 'Assault Rifle') {
        // Rifle body and framing elements
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, -5, 32, 10);
        ctx.fillStyle = '#34495e'; ctx.fillRect(10, 2, 6, 7); // Grip handle
        ctx.fillStyle = '#7f8c8d'; ctx.fillRect(32, -2, 6, 3);  // Barrel nozzle
      } else {
        // Smasher Club primitives
        ctx.strokeStyle = '#d35400'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(38, -3); ctx.stroke();
        
        // Spike highlights for higher visual fidelity
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(26, -6, 3, 3);
        ctx.fillRect(34, -3, 3, 3);
      }
      ctx.restore();
    }

    ctx.restore(); // Exit localized rotation matrices securely
    ctx.restore(); // Close parent layout configuration loop safely
  }
}