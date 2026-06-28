import * as THREE from 'three';
const S = 0.2; 

export default class Player {
    constructor(scene, color = '#c8cdd4', isRemote = false) {
        this.scene = scene;
        this.isRemote = isRemote;
        this.group = new THREE.Group();
        this.modelGroup = new THREE.Group();
        this.group.add(this.modelGroup);

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.isGrounded = true;
        this.jumpsLeft = 2;
        this.frozen = false;
        this.moveTime = 0;
        this.particles = [];
        this.currentRole = null;

        // Bounding box capsule metrics
        this.radius = 0.08;   
        this.height = 0.55;   

        this.baseSkinColor = color;
        this.paintableMeshes = [];
        this.paintLayers = new Map();

        // 📐 Thicker geometries to eliminate raw shape look
        const headGeo  = new THREE.SphereGeometry(0.52 * S, 24, 24);
        const torsoGeo = new THREE.CapsuleGeometry(0.44 * S, 0.75 * S, 10, 20); // Much thicker torso profile
        const limbGeo  = new THREE.CapsuleGeometry(0.16 * S, 0.55 * S, 8, 10);  // Connected thicker limbs
        const jointGeo = new THREE.SphereGeometry(0.17 * S, 10, 10);

        this.head  = new THREE.Mesh(headGeo);  
        this.head.position.y  = 2.1 * S; // Moved closer down to seamlessly intersect torso
        
        this.torso = new THREE.Mesh(torsoGeo); 
        this.torso.position.y = 1.3 * S;

        // Perfectly attached Left Arm System
        this.armL = new THREE.Group();
        const sL = new THREE.Mesh(jointGeo);
        const bL = new THREE.Mesh(limbGeo); 
        bL.position.y = -0.25 * S;
        this.armL.add(sL, bL); 
        this.armL.position.set(-0.52 * S, 1.75 * S, 0);

        // Perfectly attached Right Arm System
        this.armR = new THREE.Group();
        const sR = new THREE.Mesh(jointGeo);
        const bR = new THREE.Mesh(limbGeo); 
        bR.position.y = -0.25 * S;
        this.armR.add(sR, bR); 
        this.armR.position.set(0.52 * S, 1.75 * S, 0);

        // Left Leg System
        this.legL = new THREE.Group();
        const hL = new THREE.Mesh(jointGeo);
        const tL = new THREE.Mesh(limbGeo); 
        tL.position.y = -0.25 * S;
        this.legL.add(hL, tL); 
        this.legL.position.set(-0.24 * S, 0.75 * S, 0);

        // Right Leg System
        this.legR = new THREE.Group();
        const hR = new THREE.Mesh(jointGeo);
        const tR = new THREE.Mesh(limbGeo); 
        tR.position.y = -0.25 * S;
        this.legR.add(hR, tR); 
        this.legR.position.set(0.24 * S, 0.75 * S, 0);

        // Construct Blaster Gun attachment assembly for Hunters
        this.gunGroup = new THREE.Group();
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06 * S, 0.06 * S, 0.5 * S, 8),
            new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5, metalness: 0.8 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, -0.5 * S, 0.25 * S);
        const receiver = new THREE.Mesh(
            new THREE.BoxGeometry(0.14 * S, 0.2 * S, 0.3 * S),
            new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 })
        );
        receiver.position.set(0, -0.5 * S, 0);
        this.gunGroup.add(barrel, receiver);
        this.gunGroup.visible = false;
        this.armR.add(this.gunGroup);

        [this.head, this.torso, sL, bL, sR, bR, hL, tL, hR, tR].forEach(p => this.makePaintable(p));
        this.modelGroup.add(this.head, this.torso, this.armL, this.armR, this.legL, this.legR);
        this.scene.add(this.group);
        this.nameLabel = null; 
        this.roleLabel = null;
    }

    setName(name) {
        if (this.nameLabel) this.modelGroup.remove(this.nameLabel);
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 256, 48);
        ctx.fillStyle = 'rgba(15,23,42,0.85)'; this._rrect(ctx, 4, 4, 248, 40, 10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(name.slice(0, 16), 128, 24);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
        sp.scale.set(0.7, 0.13, 1);
        sp.position.y = this.height + 0.3;
        this.modelGroup.add(sp); this.nameLabel = sp;
    }

    _rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

    setRole(role) {
        this.currentRole = role;
        if (this.roleLabel) this.modelGroup.remove(this.roleLabel);
        
        if (role === 'spectator') { 
            this.modelGroup.visible = false; 
            this.roleLabel = null; 
            return; 
        } else { 
            this.modelGroup.visible = true; 
        }

        // 📏 Dynamic Sizing Scalers & Weapon Loadouts per Role
        if (role === 'hunter') {
            this.modelGroup.scale.setScalar(1.5); // Bulkier, huge Hunter
            this.gunGroup.visible = true;         // Arm with Gun
            this.radius = 0.12;
            this.height = 0.85;
        } else if (role === 'seeker') {
            this.modelGroup.scale.setScalar(0.75); // Tiny, nimble Seeker
            this.gunGroup.visible = false;
            this.radius = 0.06;
            this.height = 0.42;
        } else {
            this.modelGroup.scale.setScalar(1.0);  // Base default state
            this.gunGroup.visible = false;
            this.radius = 0.08;
            this.height = 0.55;
        }

        if (!role) { this.roleLabel = null; return; }
        const cv = document.createElement('canvas'); cv.width = 200; cv.height = 40;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 200, 40);
        ctx.fillStyle = role === 'hunter' ? 'rgba(239,68,68,0.9)' : 'rgba(59,130,246,0.9)';
        this._rrect(ctx, 2, 2, 196, 36, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(role === 'hunter' ? '🔴 HUNTER' : '🔵 SEEKER', 100, 20);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
        sp.scale.set(0.56, 0.11, 1);
        sp.position.y = this.height + 0.5;
        this.modelGroup.add(sp); this.roleLabel = sp;
    }

    makePaintable(mesh) {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = this.baseSkinColor; ctx.fillRect(0, 0, 256, 256);
        const tex = new THREE.CanvasTexture(cv);
        mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.paintLayers.set(mesh.uuid, { canvas: cv, ctx, texture: tex });
        this.paintableMeshes.push(mesh);
    }

    jump() {
        if (this.frozen || this.jumpsLeft <= 0) return;
        this.velocity.y = this.jumpsLeft === 2 ? 8.5 : 7.0; 
        this.jumpsLeft--;
        this.isGrounded = false;
        this._dust();
    }

    toggleFreeze() { this.frozen = !this.frozen; }

    _dust() {
        const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 });
        for (let i = 0; i < 5; i++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), mat.clone());
            p.position.copy(this.group.position); p.position.y += 0.02;
            p.userData = { vx: (Math.random() - .5) * 1.0, vy: Math.random() * 0.6, vz: (Math.random() - .5) * 1.0, life: 1.0 };
            this.scene.add(p); this.particles.push(p);
        }
    }

    resolveCollisions(pos, vel, colliders) {
        const r = this.radius, h = this.height;
        let grounded = false;
        for (const box of colliders) {
            const ex = { minX: box.minX - r, maxX: box.maxX + r, minY: box.minY, maxY: box.maxY + h, minZ: box.minZ - r, maxZ: box.maxZ + r };
            if (pos.x <= ex.minX || pos.x >= ex.maxX) continue;
            if (pos.y <= ex.minY || pos.y >= ex.maxY) continue;
            if (pos.z <= ex.minZ || pos.z >= ex.maxZ) continue;
            const ox = Math.min(ex.maxX - pos.x, pos.x - ex.minX);
            const oy = Math.min(ex.maxY - pos.y, pos.y - ex.minY);
            const oz = Math.min(ex.maxZ - pos.z, pos.z - ex.minZ);
            if (oy < ox && oy < oz) {
                if (pos.y - ex.minY < ex.maxY - pos.y) { pos.y = box.minY - h - 0.001; if (vel.y > 0) vel.y = 0; }
                else { pos.y = box.maxY + 0.001; if (vel.y < 0) { vel.y = 0; grounded = true; } }
            } else if (ox < oz) {
                if (pos.x - ex.minX < ex.maxX - pos.x) pos.x = box.minX - r - 0.001;
                else pos.x = box.maxX + r + 0.001;
                vel.x *= 0.01;
            } else {
                if (pos.z - ex.minZ < ex.maxZ - pos.z) pos.z = box.minZ - r - 0.001;
                else pos.z = box.maxZ + r + 0.001;
                vel.z *= 0.01;
            }
        }
        return grounded;
    }

    update(keys, isSprinting, delta, colliders = []) {
        if (this.isRemote || this.frozen) return;

        this.direction.set((keys.d ? 1 : 0) - (keys.a ? 1 : 0), 0, (keys.s ? 1 : 0) - (keys.w ? 1 : 0));
        if (this.direction.lengthSq() > 0) this.direction.normalize();

        // 🏎️ Smoothed Velocity Curve Parameters (Slowed down a little bit as requested)
        const speed = isSprinting ? 20.0 : 13.0;   
        const accel = 120.0;
        const friction = 25.0;

        this.velocity.x += this.direction.x * speed * accel * delta;
        this.velocity.z += this.direction.z * speed * accel * delta;
        
        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;

        const hspd = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (hspd > speed) { const sc = speed / hspd; this.velocity.x *= sc; this.velocity.z *= sc; }

        this.velocity.y -= 28 * delta;

        const STEPS = 3; const dt = delta / STEPS;
        const pos = this.group.position.clone();

        for (let step = 0; step < STEPS; step++) {
            pos.x += this.velocity.x * dt;
            pos.y += this.velocity.y * dt;
            pos.z += this.velocity.z * dt;

            if (pos.y <= 0 && pos.x >= -25 && pos.x <= 25 && pos.z >= -25 && pos.z <= 25) {
                pos.y = 0;
                if (this.velocity.y < 0) {
                    if (!this.isGrounded) this._dust();
                    this.velocity.y = 0; this.isGrounded = true; this.jumpsLeft = 2;
                }
            }

            const hitBox = this.resolveCollisions(pos, this.velocity, colliders);
            if (hitBox) { this.isGrounded = true; this.jumpsLeft = 2; }
            if (pos.y > 0.01 && !hitBox) this.isGrounded = false;
        }

        this.group.position.copy(pos);

        // 🤸 Dynamic Walk Animation Cycles
        const spd = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (spd > 0.08) {
            const ta = Math.atan2(this.velocity.x, this.velocity.z);
            let diff = ta - this.modelGroup.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.modelGroup.rotation.y += diff * 25 * delta;
            
            this.moveTime += spd * delta * 2.2;
            const w = Math.sin(this.moveTime);

            if (this.currentRole === 'seeker') {
                // 🏃 Funny Hands Stretching Backwards Walk Animation
                this.armL.rotation.x = 1.5 + Math.sin(this.moveTime * 2) * 0.12; 
                this.armR.rotation.x = 1.5 + Math.cos(this.moveTime * 2) * 0.12;
                this.armL.rotation.z = -0.2;
                this.armR.rotation.z = 0.2;
                
                this.legL.rotation.x = w * 0.7;  
                this.legR.rotation.x = -w * 0.7;
            } else {
                // Hunter or Base Normal Running Animation
                this.legL.rotation.x = w * 0.8;  
                this.legR.rotation.x = -w * 0.8;
                if (this.currentRole === 'hunter') {
                    this.armR.rotation.x = -0.5; // Aim weapon forward
                    this.armL.rotation.x = -w * 0.6;
                } else {
                    this.armL.rotation.x = -w * 0.7; 
                    this.armR.rotation.x = w * 0.7;
                }
                this.armL.rotation.z = 0; this.armR.rotation.z = 0;
            }
        } else {
            const t = 20 * delta;
            this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0, t);
            this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0, t);
            this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, 0, t);
            this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, 0, t);
            this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, 0, t);
            
            if (this.currentRole === 'hunter') {
                this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, -0.4, t);
            } else {
                this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, 0, t);
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.x += p.userData.vx * delta; p.position.y += p.userData.vy * delta; p.position.z += p.userData.vz * delta;
            p.scale.setScalar(Math.max(0, p.userData.life));
            p.userData.life -= 4 * delta;
            if (p.userData.life <= 0) { this.scene.remove(p); this.particles.splice(i, 1); }
        }
    }

    applyRemoteState(s) {
        this.group.position.set(s.x, s.y, s.z);
        this.modelGroup.rotation.y = s.ry;
        this.legL.rotation.x = s.la || 0;
        this.legR.rotation.x = -(s.la || 0);
        
        if (s.role === 'seeker') {
            this.armL.rotation.x = 1.5;
            this.armR.rotation.x = 1.5;
        } else if (s.role === 'hunter') {
            this.armR.rotation.x = -0.5;
            this.armL.rotation.x = -(s.la || 0);
        } else {
            this.armL.rotation.x = -(s.la || 0);
            this.armR.rotation.x = s.la || 0;
        }
        if (this.currentRole !== s.role) {
            this.setRole(s.role);
        }
    }

    getNetState() {
        return {
            x: this.group.position.x,
            y: this.group.position.y,
            z: this.group.position.z,
            ry: this.modelGroup.rotation.y,
            la: this.legL.rotation.x,
            role: this.currentRole
        };
    }

    executePaintMatrix(hitObject, uv, color, radius, tool) {
        const layer = this.paintLayers.get(hitObject.uuid);
        if (!layer) return;
        const x = uv.x * layer.canvas.width, y = (1 - uv.y) * layer.canvas.height;
        if (tool === 'bucket') { layer.ctx.fillStyle = color; layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height); }
        else { layer.ctx.fillStyle = tool === 'eraser' ? this.baseSkinColor : color; layer.ctx.beginPath(); layer.ctx.arc(x, y, radius, 0, Math.PI * 2); layer.ctx.fill(); }
        layer.texture.needsUpdate = true;
    }

    destroy() { this.scene.remove(this.group); }
}