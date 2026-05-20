/**
 * FloppySticks 2D — game.js  v1.1
 * Fixes: viewport clamping, lag (object pooling + particle cap + offscreen culling),
 *        delta-time based physics, mobile touch improvements.
 */

(function () {
    'use strict';

    // ── Canvas ────────────────────────────────────────────────────────────────
    const canvas = document.getElementById('gameCanvas');
    const ctx    = canvas.getContext('2d', { alpha: false }); // alpha:false = faster compositing
    let W = 0, H = 0;
    let isMobile = false;

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        isMobile = W < 1024 || 'ontouchstart' in window;
        if (gameState === 'BOT_MODE' || gameState === 'MATCH_OVER') {
            document.getElementById('mobile-controls').style.display = isMobile ? 'flex' : 'none';
        }
        // Reposition stickmen to match new ground
        if (player) { player.groundY = H - 100; if (player.y > player.groundY) player.y = player.groundY; }
        if (bot)    { bot.groundY    = H - 100; if (bot.y > bot.groundY)    bot.y    = bot.groundY;    }
    }
    window.addEventListener('resize', resize);

    // ── Constants ─────────────────────────────────────────────────────────────
    const GRAVITY      = 0.55;
    const MAX_PARTICLES = 30;   // hard cap — prevents lag spikes
    const WEAPONS      = ['Buster Sword', 'Assault Rifle', 'Smasher Club'];
    const MAX_POINTS   = 3;

    // ── State ─────────────────────────────────────────────────────────────────
    let gameState = 'MENU';
    let playerScore = 0, botScore = 0;
    let screenShake = 0;
    let spawnerTicks = 0;

    const keys = { a: false, d: false };

    // Pools
    const activePickups   = [];
    const activeBullets   = [];
    const activeParticles = [];

    // ── Clouds (generated lazily after first resize) ───────────────────────
    const clouds = [];
    function initClouds() {
        clouds.length = 0;
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x:     Math.random() * W,
                y:     Math.random() * (H * 0.25) + 30,
                speed: Math.random() * 0.12 + 0.05,
                size:  Math.random() * 30 + 20,
            });
        }
    }

    // ── Particle (lean object) ─────────────────────────────────────────────
    function makeParticle(x, y, vx, vy, color, size, life) {
        return { x, y, vx, vy, color, size, life, maxLife: life };
    }

    function spawnImpactFX(x, y, color, count = 5) {
        // Only spawn if under cap
        const room = MAX_PARTICLES - activeParticles.length;
        const n    = Math.min(count, room);
        for (let i = 0; i < n; i++) {
            activeParticles.push(makeParticle(
                x, y,
                (Math.random() - 0.5) * 4,
                (Math.random() - 1)   * 3,
                color,
                Math.random() * 2 + 1,
                Math.random() * 15 + 10
            ));
        }
    }

    function resetSpawnerCooldown() {
        spawnerTicks = Math.floor((Math.random() * 14 + 1) * 60);
    }

    // ── Stickman ───────────────────────────────────────────────────────────
    class Stickman {
        constructor(x, color, isBot = false) {
            this.startX  = x;
            this.color   = color;
            this.isBot   = isBot;
            this.groundY = H - 100;
            this._init();
        }

        _init() {
            this.x = this.startX;
            this.y = this.groundY;
            this.vx = 0; this.vy = 0;
            this.hp = 100;
            this.isGrounded  = false;
            this.animTime    = 0;
            this.facingLeft  = this.isBot;
            this.equippedWeapon = null;
            this.jumpCount   = 0;
            this.flipAngle   = 0;
            this.isFlipping  = false;
            this.squashY     = 1;
            this.attackCD    = 0;
            this.attackSwing = 0;
            this.isAttacking = false;
            this.flashFrames = 0;
            this.isRagdoll   = false;
            this.ragdollParts = [];
        }

        respawn() {
            if (gameState === 'MATCH_OVER') return;
            this._init();
            this.startX = this.isBot ? W - 200 : 200;
            this.x      = this.startX;
            if (!this.isBot) {
                document.getElementById('player-hp').style.width = '100%';
                document.getElementById('player-weapon-text').textContent = 'NONE';
            } else {
                document.getElementById('bot-hp').style.width = '100%';
            }
        }

        takeDamage(amount, kbDir) {
            if (this.isRagdoll || gameState === 'MATCH_OVER') return;
            this.hp = Math.max(0, this.hp - amount);
            this.flashFrames = 6;
            this.vx += kbDir * 5.5;
            this.vy -= 2;
            screenShake = 7;
            spawnImpactFX(this.x, this.y - 40, '#ffffff', 4);
            spawnImpactFX(this.x, this.y - 40, '#f1c40f', 2);

            if (!this.isBot) {
                document.getElementById('player-hp').style.width = this.hp + '%';
            } else {
                document.getElementById('bot-hp').style.width = this.hp + '%';
            }

            if (this.hp <= 0) this._triggerRagdoll(kbDir);
        }

        _triggerRagdoll(force) {
            this.isRagdoll = true;
            if (this.isBot) {
                playerScore++;
                document.getElementById('player-score-tag').textContent = playerScore + ' Wins';
            } else {
                botScore++;
                document.getElementById('bot-score-tag').textContent = botScore + ' Wins';
            }

            const parts = [
                { rx: 0,  ry: -65, size: 11, shape: 'circle' },
                { rx: 0,  ry: -42, h: 24,    shape: 'line'   },
                { rx:-8,  ry: -48, h: 18,    shape: 'line'   },
                { rx: 8,  ry: -48, h: 18,    shape: 'line'   },
                { rx:-6,  ry: -18, h: 20,    shape: 'line'   },
                { rx: 6,  ry: -18, h: 20,    shape: 'line'   },
            ];
            parts.forEach(p => {
                this.ragdollParts.push({
                    x: this.x + p.rx, y: this.y + p.ry,
                    vx: force * 5 + (Math.random() - 0.5) * 4,
                    vy: -3 + (Math.random() - 1.5) * 2,
                    angle: Math.random() * Math.PI,
                    vAngle: (Math.random() - 0.5) * 0.2,
                    cfg: p,
                });
            });

            if (playerScore >= MAX_POINTS || botScore >= MAX_POINTS) {
                gameState = 'MATCH_OVER';
            } else {
                setTimeout(() => this.respawn(), 1800);
            }
        }

        executeAttack() {
            if (this.attackCD > 0 || !this.equippedWeapon || this.isRagdoll || gameState !== 'BOT_MODE') return;
            this.isAttacking = true;
            this.attackCD    = this.equippedWeapon === 'Assault Rifle' ? 14 : 22;
            const dir = this.facingLeft ? -1 : 1;

            if (this.equippedWeapon === 'Assault Rifle') {
                activeBullets.push({
                    x: this.x + 25 * dir, y: this.y - 45,
                    vx: dir * 15, firedByBot: this.isBot,
                });
                spawnImpactFX(this.x + 26 * dir, this.y - 45, '#e67e22', 2);
            } else {
                this.attackSwing = -Math.PI / 2.5;
                const foe = this.isBot ? player : bot;
                if (!foe.isRagdoll) {
                    const sep    = Math.abs(this.x - foe.x);
                    const facing = (this.facingLeft && foe.x < this.x) || (!this.facingLeft && foe.x > this.x);
                    if (sep < 125 && facing && Math.abs(this.y - foe.y) < 70) {
                        const dmg = this.equippedWeapon === 'Buster Sword' ? 24 : 35;
                        foe.takeDamage(dmg, dir);
                    }
                }
            }
        }

        update() {
            this.groundY = H - 100; // adapt to resized viewport

            if (this.isRagdoll) {
                const fy = this.groundY;
                this.ragdollParts.forEach(p => {
                    p.vx *= 0.98; p.vy += GRAVITY;
                    p.x += p.vx; p.y += p.vy;
                    p.angle += p.vAngle;
                    if (p.y >= fy) { p.y = fy; p.vy = -p.vy * 0.25; p.vAngle *= 0.5; }
                });
                return;
            }

            if (gameState === 'MATCH_OVER') { this.vx *= 0.8; return; }

            if (this.attackCD > 0) this.attackCD--;
            if (this.isAttacking) {
                this.attackSwing += 0.28;
                if (this.attackSwing >= Math.PI / 2) { this.isAttacking = false; this.attackSwing = 0; }
            }
            if (this.isFlipping) {
                this.flipAngle += this.facingLeft ? -0.22 : 0.22;
                if (Math.abs(this.flipAngle) >= Math.PI * 2) { this.isFlipping = false; this.flipAngle = 0; }
            }

            this.squashY += (1 - this.squashY) * 0.14;

            // ── Bot AI ──
            if (this.isBot) {
                const dist = Math.abs(this.x - player.x);
                this.facingLeft = player.x < this.x;

                if (!player.isRagdoll) {
                    // dodge bullets
                    for (const b of activeBullets) {
                        if (!b.firedByBot && Math.abs(this.x - b.x) < 140 && this.isGrounded) {
                            this.vy = -12; this.isGrounded = false; this.jumpCount = 1;
                            break;
                        }
                    }

                    // seek nearest crate if unarmed
                    let target = player.x;
                    if (!this.equippedWeapon && activePickups.length) {
                        let best = Infinity;
                        for (const p of activePickups) {
                            const d = Math.abs(this.x - p.x);
                            if (d < best) { best = d; target = p.x; }
                        }
                    }

                    if (this.x < target - 45)      this.vx = 3.6;
                    else if (this.x > target + 45)  this.vx = -3.6;
                    else                            this.vx *= 0.5;

                    if (dist < 75 || (this.equippedWeapon === 'Assault Rifle' && dist < 350)) {
                        this.executeAttack();
                    }
                }

            // ── Player ──
            } else {
                if (keys.a)      { this.vx = -5.5; this.facingLeft = true;  }
                else if (keys.d) { this.vx =  5.5; this.facingLeft = false; }
                else             { this.vx *= 0.76; }
            }

            this.vy += GRAVITY;
            this.x  += this.vx;
            this.y  += this.vy;

            const gy = this.groundY;
            if (this.y >= gy) {
                if (!this.isGrounded) {
                    this.squashY = 0.78;
                    spawnImpactFX(this.x, gy, '#6a824e', 2);
                }
                this.y = gy; this.vy = 0; this.isGrounded = true; this.jumpCount = 0;
            } else {
                this.isGrounded = false;
            }

            this.x = Math.max(25, Math.min(W - 25, this.x));

            if (Math.abs(this.vx) > 0.5 && this.isGrounded) this.animTime += 0.28;
            else if (!this.isGrounded)                       this.animTime  = 1.1;
            else                                             this.animTime *= 0.7;
        }

        draw() {
            if (this.isRagdoll) {
                ctx.lineWidth = 4; ctx.lineCap = 'round';
                ctx.strokeStyle = this.color; ctx.fillStyle = this.color;
                for (const p of this.ragdollParts) {
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
                    ctx.beginPath();
                    if (p.cfg.shape === 'circle') {
                        ctx.arc(0, 0, p.cfg.size, 0, Math.PI * 2); ctx.fill();
                    } else {
                        ctx.moveTo(0, -p.cfg.h / 2); ctx.lineTo(0, p.cfg.h / 2);
                    }
                    ctx.stroke(); ctx.restore();
                }
                return;
            }

            ctx.save();
            ctx.translate(this.x, this.y); ctx.scale(1, this.squashY); ctx.translate(-this.x, -this.y);

            ctx.lineWidth = 4; ctx.lineCap = 'round';
            let drawColor = this.color;
            if (this.flashFrames > 0) {
                this.flashFrames--;
                if (this.flashFrames % 2 === 0) drawColor = '#ffffff';
            }
            ctx.strokeStyle = drawColor; ctx.fillStyle = drawColor;

            ctx.save();
            ctx.translate(this.x, this.y - 30);
            if (this.isGrounded && Math.abs(this.vx) > 0.5) ctx.rotate(this.vx * 0.025);
            if (this.isFlipping) ctx.rotate(this.flipAngle);
            ctx.translate(-this.x, -(this.y - 30));

            const bob  = (this.isGrounded && Math.abs(this.vx) <= 0.5) ? Math.sin(Date.now() * 0.005) * 1.5 : 0;
            const neckY = this.y - 55 + bob;
            const hipY  = this.y - 25;
            const headY = neckY - 12;

            ctx.beginPath(); ctx.arc(this.x, headY, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(this.x, neckY); ctx.lineTo(this.x, hipY); ctx.stroke();

            const swing = Math.sin(this.animTime) * 16;
            const flip  = this.facingLeft ? -1 : 1;

            ctx.beginPath(); ctx.moveTo(this.x, hipY); ctx.lineTo(this.x + swing * flip, this.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(this.x, hipY); ctx.lineTo(this.x - swing * flip, this.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(this.x, neckY + 4); ctx.lineTo(this.x - 14 * flip - swing * 0.1 * flip, neckY + 14 + swing); ctx.stroke();

            let handX = this.x + 18 * flip;
            let handY = neckY + 12 - swing;
            if (this.isAttacking && this.equippedWeapon !== 'Assault Rifle') {
                handX = this.x + 24 * flip; handY = neckY + 4;
            }
            ctx.beginPath(); ctx.moveTo(this.x, neckY + 4); ctx.lineTo(handX, handY); ctx.stroke();
            ctx.restore();

            if (this.equippedWeapon) {
                ctx.save(); ctx.translate(handX, handY);
                if (this.facingLeft) ctx.scale(-1, 1);
                if (this.isAttacking) ctx.rotate(this.attackSwing);

                switch (this.equippedWeapon) {
                    case 'Buster Sword':
                        ctx.strokeStyle = '#7f8c8d'; ctx.fillStyle = '#bdc3c7'; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.rect(0, -7, 46, 14); ctx.fill(); ctx.stroke();
                        ctx.strokeStyle = '#7a4a2a';
                        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, 0); ctx.stroke();
                        break;
                    case 'Assault Rifle':
                        ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, -5, 32, 10);
                        ctx.fillStyle = '#34495e'; ctx.fillRect(10, 2, 6, 7);
                        break;
                    case 'Smasher Club':
                        ctx.strokeStyle = '#d35400'; ctx.lineWidth = 6;
                        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(38, -3); ctx.stroke();
                        break;
                }
                ctx.restore();
            }
            ctx.restore();
        }
    }

    // ── Entities ───────────────────────────────────────────────────────────
    let player, bot;
    function initEntities() {
        player = new Stickman(200, '#2c3e50', false);
        bot    = new Stickman(W - 200, '#962d22', true);
    }

    // ── Pickups ────────────────────────────────────────────────────────────
    function spawnPickup() {
        if (gameState !== 'BOT_MODE' || activePickups.length >= 3) return;
        activePickups.push({
            type:     WEAPONS[Math.floor(Math.random() * WEAPONS.length)],
            x:        Math.random() * (W - 260) + 130,
            y:        H - 115,
            bobTimer: Math.random() * 100,
        });
    }

    // ── Game start ─────────────────────────────────────────────────────────
    function startBotMode() {
        playerScore = 0; botScore = 0;
        activeBullets.length   = 0;
        activePickups.length   = 0;
        activeParticles.length = 0;
        document.getElementById('player-score-tag').textContent = '0 Wins';
        document.getElementById('bot-score-tag').textContent   = '0 Wins';

        gameState = 'BOT_MODE';
        const menu = document.getElementById('menu-container');
        menu.style.opacity = '0';
        setTimeout(() => {
            menu.style.display = 'none';
            document.getElementById('hud-container').style.display = 'flex';
            if (isMobile) document.getElementById('mobile-controls').style.display = 'flex';
        }, 400);

        resetSpawnerCooldown();
        player.startX = 200;      player.respawn();
        bot.startX    = W - 200;  bot.respawn();
        spawnPickup();
    }

    // ── Jump helper ────────────────────────────────────────────────────────
    function handleJump() {
        if (player.isRagdoll || gameState !== 'BOT_MODE') return;
        if (player.isGrounded) {
            player.vy = -13; player.isGrounded = false;
            player.jumpCount = 1; player.squashY = 1.25;
            spawnImpactFX(player.x, H - 100, '#95a5a6', 3);
        } else if (player.jumpCount === 1) {
            player.vy = -9.8; player.jumpCount = 2;
            player.isFlipping = true; player.flipAngle = 0;
            spawnImpactFX(player.x, player.y - 30, '#ecf0f1', 3);
        }
    }

    // ── Input ──────────────────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if (k === 'a' || k === 'arrowleft')                         keys.a = true;
        if (k === 'd' || k === 'arrowright')                        keys.d = true;
        if (k === 'w' || k === ' ' || k === 'arrowup')             handleJump();
        if (k === 'enter' && gameState === 'MATCH_OVER')           returnToMenu();
    });
    window.addEventListener('keyup', e => {
        const k = e.key.toLowerCase();
        if (k === 'a' || k === 'arrowleft')  keys.a = false;
        if (k === 'd' || k === 'arrowright') keys.d = false;
    });
    window.addEventListener('mousedown', () => {
        if (gameState === 'BOT_MODE' && !player.isRagdoll && !isMobile) player.executeAttack();
    });
    window.addEventListener('touchstart', () => {
        if (gameState === 'MATCH_OVER') returnToMenu();
    });

    function attachTouch(id, down, up) {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', e => { e.preventDefault(); down && down(); }, { passive: false });
        el.addEventListener('touchend',   e => { e.preventDefault(); up   && up();   }, { passive: false });
        el.addEventListener('touchcancel',e => { e.preventDefault(); up   && up();   }, { passive: false });
    }
    attachTouch('btn-left',   () => keys.a = true,  () => keys.a = false);
    attachTouch('btn-right',  () => keys.d = true,  () => keys.d = false);
    attachTouch('btn-jump',   () => handleJump(),    null);
    attachTouch('btn-attack', () => { if (gameState === 'BOT_MODE' && !player.isRagdoll) player.executeAttack(); }, null);

    // Start button
    document.getElementById('start-btn').addEventListener('click', startBotMode);
    document.getElementById('start-btn').addEventListener('touchstart', e => { e.preventDefault(); startBotMode(); }, { passive: false });

    function returnToMenu() {
        gameState = 'MENU';
        keys.a = false; keys.d = false;
        activeBullets.length = 0;
        activePickups.length = 0;
        activeParticles.length = 0;
        document.getElementById('hud-container').style.display = 'none';
        document.getElementById('mobile-controls').style.display = 'none';
        const menu = document.getElementById('menu-container');
        menu.style.display = 'flex';
        menu.style.opacity = '1';
    }

    // ── Pre-render background (cache the hill paths) ───────────────────────
    // We'll redraw hills each frame but skip re-creating gradient objects
    // by caching them; hills use simple fill so they're cheap.

    // ── Main render loop ───────────────────────────────────────────────────
    let lastTime = 0;

    function gameLoop(ts) {
        requestAnimationFrame(gameLoop);

        // Cap delta so a background tab resuming doesn't explode physics
        const dt = Math.min((ts - lastTime) / 16.67, 3);
        lastTime = ts;

        // Screen shake
        ctx.save();
        if (screenShake > 0) {
            ctx.translate(
                (Math.random() - 0.5) * screenShake,
                (Math.random() - 0.5) * screenShake
            );
            screenShake *= 0.88;
            if (screenShake < 0.5) screenShake = 0;
        }

        // ── Sky ──
        // Use fillRect with a fixed sky colour instead of a gradient on every frame
        ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, W, H);
        // Simple fade at bottom
        const skyFade = ctx.createLinearGradient(0, H * 0.5, 0, H - 100);
        skyFade.addColorStop(0, 'rgba(224,244,255,0)');
        skyFade.addColorStop(1, 'rgba(224,244,255,0.6)');
        ctx.fillStyle = skyFade; ctx.fillRect(0, H * 0.5, W, H - H * 0.5);

        // ── Clouds ──
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (const c of clouds) {
            c.x += c.speed;
            if (c.x - c.size > W) c.x = -c.size;
            ctx.beginPath();
            ctx.arc(c.x,                  c.y,                  c.size,        0, Math.PI * 2);
            ctx.arc(c.x + c.size * 0.6,   c.y - c.size * 0.2,   c.size * 0.75, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── Hills ──
        ctx.fillStyle = '#9dc183';
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, (H - 220) + Math.sin(x * 0.003) * 35);
        ctx.lineTo(W, H); ctx.fill();

        ctx.fillStyle = '#7da061';
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 35) ctx.lineTo(x, (H - 160) + Math.cos(x * 0.005) * 20);
        ctx.lineTo(W, H); ctx.fill();

        // ── Ground ──
        const floorY = H - 100;
        ctx.fillStyle = '#27ae60'; ctx.fillRect(0, floorY, W, 14);
        ctx.fillStyle = '#795548'; ctx.fillRect(0, floorY + 14, W, 86);

        // ── Gameplay ──
        if (gameState === 'BOT_MODE' || gameState === 'MATCH_OVER') {

            if (gameState === 'BOT_MODE') {
                spawnerTicks--;
                const sec = Math.max(0, spawnerTicks / 60).toFixed(1);
                document.getElementById('spawner-timer-panel').textContent = `NEXT DROP: ${sec}s`;
                if (spawnerTicks <= 0) { spawnPickup(); resetSpawnerCooldown(); }
            }

            player.update(); bot.update();

            // ── Particles ──
            for (let i = activeParticles.length - 1; i >= 0; i--) {
                const p = activeParticles[i];
                p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
                if (p.life <= 0) { activeParticles.splice(i, 1); continue; }
                // Cull offscreen particles
                if (p.x < -10 || p.x > W + 10 || p.y > H + 10) { activeParticles.splice(i, 1); continue; }
                ctx.globalAlpha = p.life / p.maxLife;
                ctx.fillStyle   = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;

            // ── Bullets ──
            for (let i = activeBullets.length - 1; i >= 0; i--) {
                const b = activeBullets[i];
                b.x += b.vx;
                if (b.x < -20 || b.x > W + 20) { activeBullets.splice(i, 1); continue; }

                ctx.fillStyle = '#e67e22';
                ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();

                const target = b.firedByBot ? player : bot;
                if (!target.isRagdoll) {
                    const hx = b.firedByBot ? 30 : 15;
                    const ty = b.firedByBot ? target.y : target.y - 14;
                    const by = b.firedByBot ? target.y - 65 : target.y - 72;
                    if (b.x > target.x - hx && b.x < target.x + hx && b.y < ty && b.y > by) {
                        target.takeDamage(12, b.vx > 0 ? 1 : -1);
                        activeBullets.splice(i, 1);
                    }
                }
            }

            // ── Pickups ──
            for (let i = activePickups.length - 1; i >= 0; i--) {
                const p = activePickups[i];
                p.bobTimer += 0.06;
                const bobY = p.y + Math.sin(p.bobTimer) * 5;

                // Shadow
                ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 14, 3, 0, 0, Math.PI * 2); ctx.stroke();

                // Label
                ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(p.type.toUpperCase(), p.x, bobY - 14);

                // Pickup collision
                let picked = false;
                for (const ent of [player, bot]) {
                    if (!ent.isRagdoll && Math.hypot(ent.x - p.x, (ent.y - 30) - p.y) < 38) {
                        ent.equippedWeapon = p.type;
                        if (!ent.isBot) document.getElementById('player-weapon-text').textContent = p.type.toUpperCase();
                        activePickups.splice(i, 1);
                        picked = true;
                        break;
                    }
                }
                if (picked) continue;
            }

            player.draw(); bot.draw();
        }

        // ── Match Over overlay ──
        if (gameState === 'MATCH_OVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
            ctx.textAlign = 'center';

            ctx.font = `bold ${Math.min(54, W / 8)}px sans-serif`;
            if (playerScore >= MAX_POINTS) {
                ctx.fillStyle = '#2ecc71'; ctx.fillText('YOU WIN! 🎉', W / 2, H / 2 - 20);
            } else {
                ctx.fillStyle = '#e74c3c'; ctx.fillText('YOU LOSE!', W / 2, H / 2 - 20);
            }
            ctx.fillStyle = '#fff'; ctx.font = `${Math.min(16, W / 28)}px sans-serif`;
            ctx.fillText(
                isMobile ? 'Tap to return to Menu' : 'Press [ENTER] to return to Menu',
                W / 2, H / 2 + 40
            );
        }

        ctx.restore();
    }

    // ── Boot ───────────────────────────────────────────────────────────────
    resize();
    initClouds();
    initEntities();
    requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(gameLoop); });

})();