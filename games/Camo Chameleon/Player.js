import * as THREE from 'three';

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
        this.jumpsLeft = 2; // double jump
        this.frozen = false;
        this.moveTime = 0;
        this.particles = [];

        this.radius = 0.35;
        this.height = 2.8;

        this.baseSkinColor = color;
        this.paintableMeshes = [];
        this.paintLayers = new Map();

        const headGeo  = new THREE.SphereGeometry(0.45, 32, 32);
        const torsoGeo = new THREE.CapsuleGeometry(0.35, 0.8, 16, 32);
        const limbGeo  = new THREE.CapsuleGeometry(0.12, 0.6, 16, 16);
        const jointGeo = new THREE.SphereGeometry(0.12, 16, 16);

        this.head  = new THREE.Mesh(headGeo);  this.head.position.y  = 2.4;
        this.torso = new THREE.Mesh(torsoGeo); this.torso.position.y = 1.4;

        this.armL = new THREE.Group();
        const shoulderL = new THREE.Mesh(jointGeo);
        const boneL = new THREE.Mesh(limbGeo); boneL.position.y = -0.3;
        this.armL.add(shoulderL, boneL); this.armL.position.set(-0.45, 1.9, 0);

        this.armR = new THREE.Group();
        const shoulderR = new THREE.Mesh(jointGeo);
        const boneR = new THREE.Mesh(limbGeo); boneR.position.y = -0.3;
        this.armR.add(shoulderR, boneR); this.armR.position.set(0.45, 1.9, 0);

        this.legL = new THREE.Group();
        const hipL = new THREE.Mesh(jointGeo);
        const thighL = new THREE.Mesh(limbGeo); thighL.position.y = -0.3;
        this.legL.add(hipL, thighL); this.legL.position.set(-0.2, 0.8, 0);

        this.legR = new THREE.Group();
        const hipR = new THREE.Mesh(jointGeo);
        const thighR = new THREE.Mesh(limbGeo); thighR.position.y = -0.3;
        this.legR.add(hipR, thighR); this.legR.position.set(0.2, 0.8, 0);

        const bodyParts = [this.head, this.torso, shoulderL, boneL, shoulderR, boneR, hipL, thighL, hipR, thighR];
        bodyParts.forEach(p => this.makePaintable(p));

        this.modelGroup.add(this.head, this.torso, this.armL, this.armR, this.legL, this.legR);
        this.scene.add(this.group);
        this.nameLabel = null;
    }

    setName(name) {
        if (this.nameLabel) this.modelGroup.remove(this.nameLabel);
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0,0,256,64);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.slice(0,16), 128, 32);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.y = 3.2;
        this.modelGroup.add(sprite);
        this.nameLabel = sprite;
    }

    makePaintable(mesh) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = this.baseSkinColor;
        ctx.fillRect(0, 0, 512, 512);
        const texture = new THREE.CanvasTexture(canvas);
        mesh.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75, metalness: 0.05 });
        mesh.castShadow = true;
        this.paintLayers.set(mesh.uuid, { canvas, ctx, texture });
        this.paintableMeshes.push(mesh);
    }

    jump() {
        if (this.frozen) return;
        if (this.jumpsLeft <= 0) return;
        this.velocity.y = this.jumpsLeft === 2 ? 20 : 16; // second jump slightly lower
        this.jumpsLeft--;
        this.isGrounded = false;
        this.createDustEffect();
    }

    toggleFreeze() {
        this.frozen = !this.frozen;
    }

    createDustEffect() {
        const mat = new THREE.MeshBasicMaterial({ color: '#aab4be', transparent: true, opacity: 0.7 });
        for (let i = 0; i < 7; i++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), mat.clone());
            p.position.copy(this.group.position); p.position.y += 0.1;
            p.userData = { vx: (Math.random()-0.5)*4, vy: Math.random()*3, vz: (Math.random()-0.5)*4, life: 1 };
            this.scene.add(p);
            this.particles.push(p);
        }
    }

    resolveCollisions(pos, colliders) {
        const r = this.radius, h = this.height;
        let grounded = false;
        for (const box of colliders) {
            const ex = { minX: box.minX-r, maxX: box.maxX+r, minY: box.minY, maxY: box.maxY+h, minZ: box.minZ-r, maxZ: box.maxZ+r };
            if (pos.x < ex.minX || pos.x > ex.maxX) continue;
            if (pos.y < ex.minY || pos.y > ex.maxY) continue;
            if (pos.z < ex.minZ || pos.z > ex.maxZ) continue;
            const dx1 = ex.maxX-pos.x, dx2 = pos.x-ex.minX;
            const dy1 = ex.maxY-pos.y, dy2 = pos.y-ex.minY;
            const dz1 = ex.maxZ-pos.z, dz2 = pos.z-ex.minZ;
            const mx = Math.min(dx1,dx2), my = Math.min(dy1,dy2), mz = Math.min(dz1,dz2);
            if (my <= mx && my <= mz) {
                if (dy2 < dy1) { pos.y = box.maxY+0.001; if (this.velocity.y < 0) { this.velocity.y = 0; grounded = true; } }
                else { pos.y = box.minY-h-0.001; if (this.velocity.y > 0) this.velocity.y = 0; }
            } else if (mx <= mz) {
                if (dx2 < dx1) pos.x = box.minX-r-0.001; else pos.x = box.maxX+r+0.001;
                this.velocity.x = 0;
            } else {
                if (dz2 < dz1) pos.z = box.minZ-r-0.001; else pos.z = box.maxZ+r+0.001;
                this.velocity.z = 0;
            }
        }
        return grounded;
    }

    update(keys, isSprinting, delta, colliders = []) {
        if (this.isRemote) return;
        if (this.frozen) return;

        this.direction.set(0, 0, 0);
        if (keys.w) this.direction.z -= 1;
        if (keys.s) this.direction.z += 1;
        if (keys.a) this.direction.x -= 1;
        if (keys.d) this.direction.x += 1;
        this.direction.normalize();

        const speed = isSprinting ? 110 : 65;
        const friction = 14;

        if (this.direction.length() > 0) {
            this.velocity.x += this.direction.x * speed * delta;
            this.velocity.z += this.direction.z * speed * delta;
        }
        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;
        this.velocity.y -= 58 * delta;

        const pos = this.group.position.clone();
        pos.x += this.velocity.x * delta;
        pos.y += this.velocity.y * delta;
        pos.z += this.velocity.z * delta;

        if (pos.y <= 0) {
            pos.y = 0;
            if (this.velocity.y < 0) {
                if (!this.isGrounded) this.createDustEffect();
                this.velocity.y = 0;
                this.isGrounded = true;
                this.jumpsLeft = 2;
            }
        }

        const landedOnBox = this.resolveCollisions(pos, colliders);
        if (landedOnBox) { this.isGrounded = true; this.jumpsLeft = 2; }
        if (pos.y > 0.01 && !landedOnBox) this.isGrounded = false;

        const bound = 22;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));
        this.group.position.copy(pos);

        const spd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
        if (spd > 0.5) {
            const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
            let diff = targetAngle - this.modelGroup.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.modelGroup.rotation.y += diff * 20 * delta;
            if (this.isGrounded) {
                this.moveTime += spd * delta * 0.6;
                const wave = Math.sin(this.moveTime * 14);
                this.legL.rotation.x =  wave * 0.75;
                this.legR.rotation.x = -wave * 0.75;
                this.armL.rotation.x = -wave * 0.65;
                this.armR.rotation.x =  wave * 0.65;
                this.head.rotation.y = Math.sin(this.moveTime * 5) * 0.1;
            }
        } else {
            const t = 18 * delta;
            this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0, t);
            this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0, t);
            this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, 0, t);
            this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, 0, t);
            this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, 0, t);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.x += p.userData.vx * delta;
            p.position.y += p.userData.vy * delta;
            p.position.z += p.userData.vz * delta;
            p.scale.setScalar(Math.max(0, p.userData.life));
            p.userData.life -= 3 * delta;
            if (p.userData.life <= 0) { this.scene.remove(p); this.particles.splice(i, 1); }
        }
    }

    applyRemoteState(state) {
        this.group.position.set(state.x, state.y, state.z);
        this.modelGroup.rotation.y = state.ry;
        this.legL.rotation.x =  state.la || 0;
        this.legR.rotation.x = -state.la || 0;
        this.armL.rotation.x = -state.la || 0;
        this.armR.rotation.x =  state.la || 0;
    }

    getNetState() {
        return { x: this.group.position.x, y: this.group.position.y, z: this.group.position.z, ry: this.modelGroup.rotation.y, la: this.legL.rotation.x };
    }

    executePaintMatrix(hitObject, uv, selectedColor, radius, currentTool) {
        const layer = this.paintLayers.get(hitObject.uuid);
        if (!layer) return;
        const xCoord = uv.x * layer.canvas.width;
        const yCoord = (1 - uv.y) * layer.canvas.height;
        if (currentTool === 'bucket') {
            layer.ctx.fillStyle = selectedColor;
            layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
        } else {
            layer.ctx.fillStyle = (currentTool === 'eraser') ? this.baseSkinColor : selectedColor;
            layer.ctx.beginPath();
            layer.ctx.arc(xCoord, yCoord, radius, 0, Math.PI * 2);
            layer.ctx.fill();
        }
        layer.texture.needsUpdate = true;
    }

    destroy() { this.scene.remove(this.group); }
}