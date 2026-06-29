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
        this.currentRole = 'hider'; // default to hider

        // Tightened bounding box for perfect wall sliding
        this.radius = 0.07;   
        this.height = 0.55;   

        this.baseSkinColor = color;
        this.paintableMeshes = [];
        this.paintLayers = new Map();

        // Thicker geometries for a solid, non-generic look
        const headGeo  = new THREE.SphereGeometry(0.52 * S, 24, 24);
        const torsoGeo = new THREE.CapsuleGeometry(0.44 * S, 0.75 * S, 10, 20);
        const limbGeo  = new THREE.CapsuleGeometry(0.16 * S, 0.55 * S, 8, 10); 
        const jointGeo = new THREE.SphereGeometry(0.17 * S, 10, 10);

        this.head  = new THREE.Mesh(headGeo);  
        this.head.position.y  = 2.1 * S; 
        
        this.torso = new THREE.Mesh(torsoGeo); 
        this.torso.position.y = 1.3 * S;

        this.armL = new THREE.Group();
        const sL = new THREE.Mesh(jointGeo);
        const bL = new THREE.Mesh(limbGeo); 
        bL.position.y = -0.275 * S; 
        this.armL.add(sL, bL); 
        this.armL.position.set(-0.52 * S, 1.75 * S, 0);

        this.armR = new THREE.Group();
        const sR = new THREE.Mesh(jointGeo);
        const bR = new THREE.Mesh(limbGeo); 
        bR.position.y = -0.275 * S; 
        this.armR.add(sR, bR); 
        this.armR.position.set(0.52 * S, 1.75 * S, 0);

        this.legL = new THREE.Group();
        const hL = new THREE.Mesh(jointGeo);
        const tL = new THREE.Mesh(limbGeo); 
        tL.position.y = -0.275 * S; 
        this.legL.add(hL, tL); 
        this.legL.position.set(-0.24 * S, 0.75 * S, 0);

        this.legR = new THREE.Group();
        const hR = new THREE.Mesh(jointGeo);
        const tR = new THREE.Mesh(limbGeo); 
        tR.position.y = -0.275 * S; 
        this.legR.add(hR, tR); 
        this.legR.position.set(0.24 * S, 0.75 * S, 0);

        this.playerName = "Player";
        [this.head, this.torso, sL, bL, sR, bR, hL, tL, hR, tR].forEach(p => this.makePaintable(p));
        this.modelGroup.add(this.head, this.torso, this.armL, this.armR, this.legL, this.legR);
        
        // Enable Shadows
        this.modelGroup.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.scene.add(this.group);
        this.nameLabel = null; 
    }

    setName(name) {
        this.playerName = name;
        if (this.nameLabel) this.modelGroup.remove(this.nameLabel);
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'rgba(15,23,42,0.85)'; this._rrect(ctx, 4, 4, 248, 40, 10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(name.slice(0, 16), 128, 24);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
        sp.scale.set(0.7, 0.13, 1);
        sp.position.y = this.height + 0.3;
        this.modelGroup.add(sp); this.nameLabel = sp;
    }

    setNametagVisible(isVisible) {
        if (this.nameLabel) {
            this.nameLabel.visible = isVisible;
        }
    }

    _rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

    setRole(role) {
        this.currentRole = role;
        if (role === 'seeker') {
            this.modelGroup.scale.setScalar(1.1);
            this.radius = 0.08; this.height = 0.6;
        } else {
            this.modelGroup.scale.setScalar(0.8);
            this.radius = 0.06; this.height = 0.45;
        }
    }

    makePaintable(mesh) {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = this.baseSkinColor; ctx.fillRect(0, 0, 256, 256);
        const tex = new THREE.CanvasTexture(cv);
        
        // Upgraded Material for Graphics
        mesh.material = new THREE.MeshStandardMaterial({ 
            map: tex, 
            roughness: 0.7, 
            metalness: 0.1 
        });
        
        this.paintLayers.set(mesh.uuid, { canvas: cv, ctx, texture: tex, mesh: mesh });
        this.paintableMeshes.push(mesh);
    }

    jump() {
        if (this.frozen || this.jumpsLeft <= 0) return;
        this.velocity.y = this.jumpsLeft === 2 ? 5.5 : 4.0; 
        this.jumpsLeft--;
        this.isGrounded = false;
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
                vel.x = 0; // Perfect wall stop
            } else {
                if (pos.z - ex.minZ < ex.maxZ - pos.z) pos.z = box.minZ - r - 0.001;
                else pos.z = box.maxZ + r + 0.001;
                vel.z = 0; // Perfect wall stop
            }
        }
        return grounded;
    }

    update(keys, isSprinting, delta, colliders = []) {
        if (this.isRemote || this.frozen) return;

        const dx = Math.abs(keys.jx) > 0.01 ? keys.jx : (keys.d?1:0)-(keys.a?1:0);
        const dz = Math.abs(keys.jz) > 0.01 ? keys.jz : (keys.s?1:0)-(keys.w?1:0);
        this.direction.set(dx, 0, dz);
        
        const dlen = this.direction.length();
        if (dlen > 1) this.direction.divideScalar(dlen);

        const speed = isSprinting ? 6.0 : 3.5;
        const accel = 60.0;
        const friction = 15.0;

        this.velocity.x += this.direction.x * speed * accel * delta;
        this.velocity.z += this.direction.z * speed * accel * delta;
        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;

        this.velocity.y -= 18 * delta; // Gravity

        const STEPS = 3; const dt = delta / STEPS;
        const pos = this.group.position.clone();

        for (let step = 0; step < STEPS; step++) {
            pos.x += this.velocity.x * dt;
            pos.y += this.velocity.y * dt;
            pos.z += this.velocity.z * dt;

            // Map Floor Bounds
            if (pos.y <= 0 && pos.x >= -35 && pos.x <= 35 && pos.z >= -35 && pos.z <= 35) {
                pos.y = 0;
                if (this.velocity.y < 0) {
                    this.velocity.y = 0; this.isGrounded = true; this.jumpsLeft = 2;
                }
            }
            const hitBox = this.resolveCollisions(pos, this.velocity, colliders);
            if (hitBox) { this.isGrounded = true; this.jumpsLeft = 2; }
            if (pos.y > 0.01 && !hitBox) this.isGrounded = false;
        }

        this.group.position.copy(pos);

        // Animation
        const spd = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (spd > 0.1) {
            const ta = Math.atan2(this.velocity.x, this.velocity.z);
            let diff = ta - this.modelGroup.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.modelGroup.rotation.y += diff * 20 * delta;
            
            this.moveTime += spd * delta * 2.5;
            const w = Math.sin(this.moveTime);

            this.legL.rotation.x = w * 0.8;  
            this.legR.rotation.x = -w * 0.8;
            this.armL.rotation.x = -w * 0.7; 
            this.armR.rotation.x = w * 0.7;
        } else {
            const t = 15 * delta;
            this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0, t);
            this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0, t);
            this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, 0, t);
            this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, 0, t);
        }
    }

    applyRemoteState(s) {
        this.group.position.set(s.x, s.y, s.z);
        this.modelGroup.rotation.y = s.ry;
        this.legL.rotation.x = s.la || 0;
        this.legR.rotation.x = -(s.la || 0);
        this.armL.rotation.x = -(s.la || 0);
        this.armR.rotation.x = s.la || 0;
        if (this.currentRole !== s.role) {
            this.setRole(s.role);
        }
    }

    executePaintMatrix(hitObject, uv, color, radius, tool) {
        const layer = this.paintLayers.get(hitObject.uuid);
        if (!layer) return;

        // Apply Metallic/Matte Material Adjustments
        if (tool === 'metallic') {
            layer.mesh.material.metalness = 0.9;
            layer.mesh.material.roughness = 0.2;
        } else if (tool === 'matte') {
            layer.mesh.material.metalness = 0.0;
            layer.mesh.material.roughness = 0.9;
        }

        const x = uv.x * layer.canvas.width, y = (1 - uv.y) * layer.canvas.height;
        layer.ctx.fillStyle = tool === 'eraser' ? this.baseSkinColor : color;
        layer.ctx.beginPath(); 
        layer.ctx.arc(x, y, radius, 0, Math.PI * 2); 
        layer.ctx.fill(); 
        
        layer.texture.needsUpdate = true;
    }

    destroy() { this.scene.remove(this.group); }
}