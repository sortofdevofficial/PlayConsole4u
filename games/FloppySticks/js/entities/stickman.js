/**
 * FloppySticks — stickman.js v2.0
 * Stickman physics, AI, combat, rendering.
 * Globals from game.js: W,H,GV,MXP,ptl,bul,pku,gs,P,B,keys,shk,ps,bs,MX,WPS,fx,_save,g
 * Globals from network.js: send,isHost,conn
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
    this.trl = [];       // motion trail
    this.stmp = 0;       // stomp frame
    this.airT = 0;       // air time
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
    this.hp  = Math.max(0, this.hp - a);
    this.ff  = 8;
    this.vx += kb * 6;
    this.vy -= 2.5;
    shk      = 9;
    fx(this.x, this.y - 40, '#ffffff', 5);
    fx(this.x, this.y - 40, '#fbbf24', 3);
    fx(this.x, this.y - 40, this.c,    3);
    this._hud();
    // flash the screen overlay
    const ov = g('dmg-overlay');
    if (ov && !this.bot) {
      ov.classList.add('flash');
      setTimeout(() => ov.classList.remove('flash'), 120);
    }
    if (this.hp <= 0) this._rag(kb);
  }

  _rag(f) {
    this.rd = true;

    if (this.bot) { ps++; g('p-score').textContent = ps + ' pts'; }
    else          { bs++; g('o-score').textContent = bs + ' pts'; }

    // Burst of death particles
    fx(this.x, this.y - 40, '#fbbf24', 12);
    fx(this.x, this.y - 40, '#ef4444', 8);
    fx(this.x, this.y - 40, '#fff',    6);

    [
      [0,  -65, 11, 'c'],
      [0,  -42, 24, 'l'],
      [-8, -48, 18, 'l'],
      [8,  -48, 18, 'l'],
      [-6, -18, 20, 'l'],
      [6,  -18, 20, 'l']
    ].forEach(([rx, ry, s, t]) => this.rp.push({
      x:   this.x + rx, y:   this.y + ry,
      vx:  f * 5.5 + (Math.random() - .5) * 5,
      vy:  -4 + (Math.random() - 1.5) * 3,
      ang: Math.random() * Math.PI,
      va:  (Math.random() - .5) * .25,
      t, s
    }));

    if (gs === 'ONLINE_MODE' && conn?.open)
      send({ type: 'score', hs: isHost ? ps : bs, gs: isHost ? bs : ps });

    if (ps >= MX || bs >= MX) {
      gs = 'MATCH_OVER';
      if (gs === 'ONLINE_MODE') send({ type: 'over' });
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
    this.ac  = this.wp === 'Assault Rifle' ? 12 : 22;
    const d  = this.fl ? -1 : 1;

    if (this.wp === 'Assault Rifle') {
      const bx = this.x + 28 * d, by = this.y - 46;
      bul.push({ x: bx, y: by, vx: d * 16, bot: this.bot });
      fx(bx, by, '#fb923c', 3);
      shk = 3;
      if (gs === 'ONLINE_MODE' && !this.bot)
        send({ type: 'bullet', x: bx, y: by, vx: d * 16 });
    } else {
      this.asw = -Math.PI / 2.2;
      const foe = this.bot ? P : B;
      if (!foe.rd) {
        const sep = Math.abs(this.x - foe.x);
        const fwd = (this.fl && foe.x < this.x) || (!this.fl && foe.x > this.x);
        if (sep < 130 && fwd && Math.abs(this.y - foe.y) < 75) {
          const dmg = this.wp === 'Buster Sword' ? 26 : 38;
          shk = 12;
          if (gs === 'ONLINE_MODE' && !this.bot) send({ type: 'hit', amt: dmg, kb: d });
          else foe.hit(dmg, d);
        }
      }
    }
  }

  update() {
    this.gy = H - 100;

    // Ragdoll physics
    if (this.rd) {
      this.rp.forEach(p => {
        p.vx *= .97; p.vy += GV * 1.1;
        p.x  += p.vx; p.y  += p.vy;
        p.ang += p.va;
        if (p.y >= this.gy) {
          p.y  = this.gy;
          p.vy = -p.vy * .22;
          p.va *= .45;
          p.vx *= .82;
        }
      });
      return;
    }

    if (gs === 'MATCH_OVER') { this.vx *= .82; return; }

    // Cooldowns / swing
    if (this.ac > 0) this.ac--;
    if (this.atk) {
      this.asw += .3;
      if (this.asw >= Math.PI / 2) { this.atk = false; this.asw = 0; }
    }
    if (this.flp) {
      this.fa += this.fl ? -.24 : .24;
      if (Math.abs(this.fa) >= Math.PI * 2) { this.flp = false; this.fa = 0; }
    }
    this.sq += (1 - this.sq) * .16;

    // Trail update
    if (!this.rd) {
      this.trl.unshift({ x: this.x, y: this.y });
      if (this.trl.length > 6) this.trl.pop();
    }

    // Bot AI
    if (this.bot && gs === 'BOT_MODE') {
      const dist = Math.abs(this.x - P.x);
      this.fl = P.x < this.x;

      if (!P.rd) {
        // Dodge bullets
        for (const b of bul)
          if (!b.bot && Math.abs(this.x - b.x) < 150 && this.gr) {
            this.vy = -13; this.gr = false; this.jc = 1; break;
          }

        if (this.hp < 35 && dist < 220) {
          this.vx = P.x < this.x ? 4.2 : -4.2;
        } else {
          let tx = P.x;
          if (!this.wp && pku.length) {
            let best = Infinity;
            for (const p of pku) {
              const dd = Math.abs(this.x - p.x);
              if (dd < best) { best = dd; tx = p.x; }
            }
          }
          if      (this.x < tx - 50) this.vx =  4;
          else if (this.x > tx + 50) this.vx = -4;
          else                        this.vx *= .5;

          if (this.gr && this.jc === 0 && dist < 200 && Math.random() < .014) {
            this.vy = -13; this.gr = false; this.jc = 1;
          }
        }
        if (dist < 90 || (this.wp === 'Assault Rifle' && dist < 360)) this.attack();
      }
    }

    // Player input
    if (!this.bot) {
      if      (keys.a) { this.vx = -5.8; this.fl = true;  }
      else if (keys.d) { this.vx =  5.8; this.fl = false; }
      else              this.vx *= .78;
    }

    // Physics
    this.vy += GV;
    this.x  += this.vx;
    this.y  += this.vy;

    if (!this.gr) this.airT++;
    else          this.airT = 0;

    if (this.y >= this.gy) {
      if (!this.gr) {
        this.sq  = .72;
        this.stmp = 6;
        fx(this.x, this.gy, '#64748b', Math.min(4, Math.floor(this.airT / 10) + 2));
      }
      this.y  = this.gy;
      this.vy = 0;
      this.gr = true;
      this.jc = 0;
    } else {
      this.gr = false;
    }

    if (this.stmp > 0) this.stmp--;

    this.x = Math.max(28, Math.min(W - 28, this.x));

    if (Math.abs(this.vx) > .5 && this.gr) this.at += .3;
    else if (!this.gr)                       this.at  = 1.1;
    else                                     this.at  *= .72;
  }

  draw() {
    // Ragdoll draw
    if (this.rd) {
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.strokeStyle = this.c; ctx.fillStyle = this.c;
      this.rp.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.globalAlpha = Math.max(.2, 1 - p.y / (H + 100));
        ctx.beginPath();
        if (p.t === 'c') { ctx.arc(0, 0, p.s, 0, Math.PI * 2); ctx.fill(); }
        else              { ctx.moveTo(0, -p.s / 2); ctx.lineTo(0, p.s / 2); }
        ctx.stroke();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      return;
    }

    ctx.save();

    // Motion trail (only when moving fast)
    const spd = Math.abs(this.vx);
    if (spd > 2 && !this.rd) {
      for (let ti = 1; ti < this.trl.length; ti++) {
        const t = this.trl[ti];
        ctx.globalAlpha = (1 - ti / this.trl.length) * .12;
        ctx.strokeStyle = this.c;
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y - 55, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Squash/stretch scale
    ctx.translate(this.x, this.y);
    ctx.scale(1, this.sq);
    ctx.translate(-this.x, -this.y);
    ctx.lineWidth = 4; ctx.lineCap = 'round';

    // Damage flash — white outline on flash
    let dc = this.c;
    let glowAlpha = 0;
    if (this.ff > 0) {
      this.ff--;
      if (this.ff % 2 === 0) { dc = '#fff'; glowAlpha = .5; }
    }
    ctx.strokeStyle = dc; ctx.fillStyle = dc;

    // Torso tilt matrix
    ctx.save();
    ctx.translate(this.x, this.y - 30);
    if (this.gr && Math.abs(this.vx) > .5) ctx.rotate(this.vx * .022);
    if (this.flp) ctx.rotate(this.fa);
    ctx.translate(-this.x, -(this.y - 30));

    // Idle breathing
    const bob = (this.gr && Math.abs(this.vx) <= .5) ? Math.sin(Date.now() * .005) * 1.5 : 0;
    const ny  = this.y - 55 + bob;
    const hy  = this.y - 25;
    const hy2 = ny - 12;

    // Head glow on damage
    if (glowAlpha > 0) {
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur  = 18;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath(); ctx.arc(this.x, hy2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Head
    ctx.beginPath(); ctx.arc(this.x, hy2, 11, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Spine
    ctx.beginPath(); ctx.moveTo(this.x, ny); ctx.lineTo(this.x, hy); ctx.stroke();

    const sw = Math.sin(this.at) * 17;
    const fl = this.fl ? -1 : 1;

    // Legs
    ctx.beginPath(); ctx.moveTo(this.x, hy); ctx.lineTo(this.x + sw * fl, this.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x, hy); ctx.lineTo(this.x - sw * fl, this.y); ctx.stroke();

    // Left arm
    ctx.beginPath();
    ctx.moveTo(this.x, ny + 4);
    ctx.lineTo(this.x - 14 * fl - sw * .1 * fl, ny + 14 + sw);
    ctx.stroke();

    // Right arm & weapon hand
    let hx  = this.x + 18 * fl;
    let hy3 = ny + 12 - sw;
    if (this.atk && this.wp !== 'Assault Rifle') { hx = this.x + 26 * fl; hy3 = ny + 4; }

    ctx.beginPath(); ctx.moveTo(this.x, ny + 4); ctx.lineTo(hx, hy3); ctx.stroke();

    // Weapon
    if (this.wp) {
      ctx.save();
      ctx.translate(hx, hy3);
      if (this.fl) ctx.scale(-1, 1);
      if (this.atk) {
        if (this.wp === 'Assault Rifle') {
          ctx.translate(-(Math.random() * 2), (Math.random() - .5) * 1.2);
        } else {
          ctx.rotate(this.asw);
        }
      } else {
        ctx.rotate(Math.sin(Date.now() * .003) * .04);
      }

      if (this.wp === 'Buster Sword') {
        // Blade with edge highlight
        ctx.strokeStyle = '#64748b'; ctx.fillStyle = '#94a3b8'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.rect(0, -7, 48, 14); ctx.fill(); ctx.stroke();
        // Edge glint
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillRect(4, -6, 40, 3);
        // Handle
        ctx.strokeStyle = '#92400e'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, 0); ctx.stroke();
        // Guard
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-1, -9, 3, 18);
      } else if (this.wp === 'Assault Rifle') {
        // Body
        ctx.fillStyle = '#1e293b'; ctx.fillRect(0, -5, 34, 10);
        // Grip
        ctx.fillStyle = '#334155'; ctx.fillRect(10, 3, 6, 8);
        // Barrel
        ctx.fillStyle = '#475569'; ctx.fillRect(34, -2, 8, 4);
        // Sight
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(14, -7, 8, 3);
        // Muzzle flash on fire
        if (this.atk) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(42, 0, 5 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Smasher Club
        ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40, -3); ctx.stroke();
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#ea580c';
        ctx.beginPath(); ctx.moveTo(34, -4); ctx.lineTo(40, -2); ctx.stroke();
        // Spikes
        ctx.fillStyle = '#e2e8f0';
        [[26,-7],[32,-5],[38,-3]].forEach(([sx,sy]) => ctx.fillRect(sx,sy,3,3));
      }
      ctx.restore();
    }

    // Stomp dust ring
    if (this.stmp > 0) {
      const r = (6 - this.stmp) * 6;
      ctx.save();
      ctx.globalAlpha = this.stmp / 6 * .35;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, r, r * .3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // torso tilt
    ctx.restore(); // squash matrix
  }
}