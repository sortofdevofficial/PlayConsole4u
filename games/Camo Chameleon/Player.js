import * as THREE from 'three';

const SCALE = 0.2; // 5x smaller than original

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

        // Capsule dims scaled
        this.radius = 0.35 * SCALE;
        this.height = 2.8  * SCALE;

        this.baseSkinColor = color;
        this.paintableMeshes = [];
        this.paintLayers = new Map();

        const s = SCALE;
        const headGeo  = new THREE.SphereGeometry(0.45*s, 24, 24);
        const torsoGeo = new THREE.CapsuleGeometry(0.35*s, 0.8*s, 12, 24);
        const limbGeo  = new THREE.CapsuleGeometry(0.12*s, 0.6*s, 8, 12);
        const jointGeo = new THREE.SphereGeometry(0.12*s, 10, 10);

        this.head  = new THREE.Mesh(headGeo);  this.head.position.y  = 2.4*s;
        this.torso = new THREE.Mesh(torsoGeo); this.torso.position.y = 1.4*s;

        this.armL = new THREE.Group();
        const sL = new THREE.Mesh(jointGeo), bL = new THREE.Mesh(limbGeo);
        bL.position.y = -0.3*s;
        this.armL.add(sL, bL); this.armL.position.set(-0.45*s, 1.9*s, 0);

        this.armR = new THREE.Group();
        const sR = new THREE.Mesh(jointGeo), bR = new THREE.Mesh(limbGeo);
        bR.position.y = -0.3*s;
        this.armR.add(sR, bR); this.armR.position.set(0.45*s, 1.9*s, 0);

        this.legL = new THREE.Group();
        const hL = new THREE.Mesh(jointGeo), tL = new THREE.Mesh(limbGeo);
        tL.position.y = -0.3*s;
        this.legL.add(hL, tL); this.legL.position.set(-0.2*s, 0.8*s, 0);

        this.legR = new THREE.Group();
        const hR = new THREE.Mesh(jointGeo), tR = new THREE.Mesh(limbGeo);
        tR.position.y = -0.3*s;
        this.legR.add(hR, tR); this.legR.position.set(0.2*s, 0.8*s, 0);

        [this.head, this.torso, sL, bL, sR, bR, hL, tL, hR, tR].forEach(p => this.makePaintable(p));
        this.modelGroup.add(this.head, this.torso, this.armL, this.armR, this.legL, this.legR);
        this.scene.add(this.group);
        this.nameLabel = null;
        this.roleLabel = null;
    }

    setName(name) {
        if (this.nameLabel) this.modelGroup.remove(this.nameLabel);
        const cv = document.createElement('canvas'); cv.width=256; cv.height=52;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0,0,256,52);
        ctx.fillStyle='#fff'; ctx.font='bold 22px Segoe UI';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(name.slice(0,16), 128, 26);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
        sp.scale.set(0.8, 0.16, 1);
        sp.position.y = 2.8 * SCALE + 0.05;
        this.modelGroup.add(sp);
        this.nameLabel = sp;
    }

    setRole(role) {
        // role: 'hunter' | 'seeker' | null
        if (this.roleLabel) this.modelGroup.remove(this.roleLabel);
        if (!role) { this.roleLabel = null; return; }
        const cv = document.createElement('canvas'); cv.width=200; cv.height=44;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0,0,200,44);
        ctx.fillStyle = role === 'hunter' ? '#e53e3e' : '#3182ce';
        ctx.font = 'bold 18px Segoe UI'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(role === 'hunter' ? '🔴 HUNTER' : '🔵 SEEKER', 100, 22);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
        sp.scale.set(0.65, 0.14, 1);
        sp.position.y = 2.8 * SCALE + 0.13;
        this.modelGroup.add(sp);
        this.roleLabel = sp;
    }

    makePaintable(mesh) {
        const cv = document.createElement('canvas'); cv.width=256; cv.height=256;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = this.baseSkinColor; ctx.fillRect(0,0,256,256);
        const tex = new THREE.CanvasTexture(cv);
        mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.05 });
        mesh.castShadow = true;
        this.paintLayers.set(mesh.uuid, { canvas: cv, ctx, texture: tex });
        this.paintableMeshes.push(mesh);
    }

    jump() {
        if (this.frozen || this.jumpsLeft <= 0) return;
        this.velocity.y = this.jumpsLeft === 2 ? 4.5 : 3.2;
        this.jumpsLeft--;
        this.isGrounded = false;
        this._dust();
    }

    toggleFreeze() { this.frozen = !this.frozen; }

    _dust() {
        const mat = new THREE.MeshBasicMaterial({ color:'#aab4be', transparent:true, opacity:0.6 });
        for (let i=0;i<5;i++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.02,5,5), mat.clone());
            p.position.copy(this.group.position); p.position.y += 0.02;
            p.userData = { vx:(Math.random()-.5)*0.8, vy:Math.random()*0.6, vz:(Math.random()-.5)*0.8, life:1 };
            this.scene.add(p); this.particles.push(p);
        }
    }

    resolveCollisions(pos, colliders) {
        const r = this.radius, h = this.height;
        let grounded = false;
        for (const box of colliders) {
            const ex = { minX:box.minX-r, maxX:box.maxX+r, minY:box.minY, maxY:box.maxY+h, minZ:box.minZ-r, maxZ:box.maxZ+r };
            if (pos.x<ex.minX||pos.x>ex.maxX||pos.y<ex.minY||pos.y>ex.maxY||pos.z<ex.minZ||pos.z>ex.maxZ) continue;
            const dx1=ex.maxX-pos.x, dx2=pos.x-ex.minX;
            const dy1=ex.maxY-pos.y, dy2=pos.y-ex.minY;
            const dz1=ex.maxZ-pos.z, dz2=pos.z-ex.minZ;
            const mx=Math.min(dx1,dx2), my=Math.min(dy1,dy2), mz=Math.min(dz1,dz2);
            if (my<=mx&&my<=mz) {
                if (dy2<dy1) { pos.y=box.maxY+0.001; if(this.velocity.y<0){this.velocity.y=0;grounded=true;} }
                else { pos.y=box.minY-h-0.001; if(this.velocity.y>0) this.velocity.y=0; }
            } else if (mx<=mz) {
                pos.x = dx2<dx1 ? box.minX-r-0.001 : box.maxX+r+0.001; this.velocity.x=0;
            } else {
                pos.z = dz2<dz1 ? box.minZ-r-0.001 : box.maxZ+r+0.001; this.velocity.z=0;
            }
        }
        return grounded;
    }

    update(keys, isSprinting, delta, colliders=[]) {
        if (this.isRemote || this.frozen) return;

        this.direction.set(
            (keys.d?1:0)-(keys.a?1:0),
            0,
            (keys.s?1:0)-(keys.w?1:0)
        ).normalize();

        const speed = isSprinting ? 5 : 3;
        const fric  = 14;

        this.velocity.x += this.direction.x * speed * delta * 60 * 0.016;
        this.velocity.z += this.direction.z * speed * delta * 60 * 0.016;
        this.velocity.x -= this.velocity.x * fric * delta;
        this.velocity.z -= this.velocity.z * fric * delta;
        this.velocity.y -= 14 * delta;

        const pos = this.group.position.clone();
        pos.x += this.velocity.x * delta;
        pos.y += this.velocity.y * delta;
        pos.z += this.velocity.z * delta;

        if (pos.y <= 0) {
            pos.y = 0;
            if (this.velocity.y < 0) {
                if (!this.isGrounded) this._dust();
                this.velocity.y = 0; this.isGrounded = true; this.jumpsLeft = 2;
            }
        }

        const hitBox = this.resolveCollisions(pos, colliders);
        if (hitBox) { this.isGrounded = true; this.jumpsLeft = 2; }
        if (pos.y > 0.01 && !hitBox) this.isGrounded = false;

        const b = 23;
        pos.x = Math.max(-b, Math.min(b, pos.x));
        pos.z = Math.max(-b, Math.min(b, pos.z));
        this.group.position.copy(pos);

        const spd = Math.sqrt(this.velocity.x**2+this.velocity.z**2);
        const s = SCALE;
        if (spd > 0.05) {
            const ta = Math.atan2(this.velocity.x, this.velocity.z);
            let diff = ta - this.modelGroup.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            this.modelGroup.rotation.y += diff * 18 * delta;
            if (this.isGrounded) {
                this.moveTime += spd * delta * 30;
                const wave = Math.sin(this.moveTime);
                this.legL.rotation.x =  wave * 0.7;
                this.legR.rotation.x = -wave * 0.7;
                this.armL.rotation.x = -wave * 0.6;
                this.armR.rotation.x =  wave * 0.6;
            }
        } else {
            const t = 16*delta;
            this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x,0,t);
            this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x,0,t);
            this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x,0,t);
            this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x,0,t);
        }

        for (let i=this.particles.length-1;i>=0;i--) {
            const p=this.particles[i];
            p.position.x+=p.userData.vx*delta; p.position.y+=p.userData.vy*delta; p.position.z+=p.userData.vz*delta;
            p.scale.setScalar(Math.max(0,p.userData.life));
            p.userData.life-=3*delta;
            if(p.userData.life<=0){this.scene.remove(p);this.particles.splice(i,1);}
        }
    }

    applyRemoteState(state) {
        this.group.position.set(state.x, state.y, state.z);
        this.modelGroup.rotation.y = state.ry;
        this.legL.rotation.x =  state.la||0;
        this.legR.rotation.x = -(state.la||0);
        this.armL.rotation.x = -(state.la||0);
        this.armR.rotation.x =  state.la||0;
    }

    getNetState() {
        return { x:this.group.position.x, y:this.group.position.y, z:this.group.position.z, ry:this.modelGroup.rotation.y, la:this.legL.rotation.x };
    }

    executePaintMatrix(hitObject, uv, color, radius, tool) {
        const layer = this.paintLayers.get(hitObject.uuid);
        if (!layer) return;
        const x = uv.x * layer.canvas.width;
        const y = (1-uv.y) * layer.canvas.height;
        if (tool==='bucket') { layer.ctx.fillStyle=color; layer.ctx.fillRect(0,0,layer.canvas.width,layer.canvas.height); }
        else { layer.ctx.fillStyle = tool==='eraser' ? this.baseSkinColor : color; layer.ctx.beginPath(); layer.ctx.arc(x,y,radius,0,Math.PI*2); layer.ctx.fill(); }
        layer.texture.needsUpdate = true;
    }

    destroy() { this.scene.remove(this.group); }
}