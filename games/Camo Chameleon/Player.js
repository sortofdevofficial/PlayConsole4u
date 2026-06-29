import * as THREE from 'three';

const S = 0.2;

export default class Player {
    constructor(scene, color = '#38bdf8', isRemote = false) {
        this.scene = scene;
        this.isRemote = isRemote;
        this.group = new THREE.Group();
        this.modelGroup = new THREE.Group();
        this.group.add(this.modelGroup);

        this.velocity = new THREE.Vector3();
        this.isGrounded = true;
        this.jumpsLeft = 2;
        this.frozen = false;
        this.moveTime = 0;
        this.particles = [];

        // Tight capsule for collision
        this.radius = 0.07;
        this.height  = 0.52;

        this.baseSkinColor = color;
        this.paintableMeshes = [];
        this.paintLayers = new Map();

        // ── Shared material (one per player, reused across all parts)
        this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });

        // ── Geometry — thick, overlapping so no gaps show
        const hG  = new THREE.SphereGeometry(0.50*S, 20, 20);
        const tG  = new THREE.CapsuleGeometry(0.42*S, 0.72*S, 8, 16);
        const lG  = new THREE.CapsuleGeometry(0.16*S, 0.52*S, 6, 10);
        const jG  = new THREE.SphereGeometry(0.20*S, 10, 10); // big joints = no gap

        const m = () => this.mat; // shorthand

        // Head — sits snugly on top of torso
        this.head = this._mesh(hG);
        this.head.position.y = 1.98*S;

        // Torso
        this.torso = this._mesh(tG);
        this.torso.position.y = 1.22*S;

        // Neck sphere — fills head/torso gap
        this.neck = this._mesh(new THREE.SphereGeometry(0.22*S, 10, 10));
        this.neck.position.y = 1.60*S;

        // Arms — pivot from shoulder joint
        this.armL = new THREE.Group(); this.armL.position.set(-0.54*S, 1.68*S, 0);
        this.shoulderL = this._mesh(jG); // shoulder joint fills gap
        const upperArmL = this._mesh(lG); upperArmL.position.y = -0.28*S;
        this.armL.add(this.shoulderL, upperArmL);

        this.armR = new THREE.Group(); this.armR.position.set(0.54*S, 1.68*S, 0);
        this.shoulderR = this._mesh(jG);
        const upperArmR = this._mesh(lG); upperArmR.position.y = -0.28*S;
        this.armR.add(this.shoulderR, upperArmR);

        // Legs — pivot from hip joint
        this.legL = new THREE.Group(); this.legL.position.set(-0.24*S, 0.82*S, 0);
        this.hipL = this._mesh(jG); // hip joint fills gap
        const thighL = this._mesh(lG); thighL.position.y = -0.28*S;
        this.legL.add(this.hipL, thighL);

        this.legR = new THREE.Group(); this.legR.position.set(0.24*S, 0.82*S, 0);
        this.hipR = this._mesh(jG);
        const thighR = this._mesh(lG); thighR.position.y = -0.28*S;
        this.legR.add(this.hipR, thighR);

        // Pelvis sphere — fills torso/leg gap
        this.pelvis = this._mesh(new THREE.SphereGeometry(0.28*S, 10, 10));
        this.pelvis.position.y = 0.88*S;

        this.modelGroup.add(
            this.head, this.neck, this.torso, this.pelvis,
            this.armL, this.armR, this.legL, this.legR
        );

        // All meshes paintable (shared canvas per mesh)
        [this.head, this.neck, this.torso, this.pelvis,
         this.shoulderL, upperArmL, this.shoulderR, upperArmR,
         this.hipL, thighL, this.hipR, thighR
        ].forEach(p => this._makePaintable(p));

        this.scene.add(this.group);
        this.nameSprite = null;
        this.roleSprite = null;
    }

    _mesh(geo) {
        const m = new THREE.Mesh(geo, this.mat.clone());
        m.castShadow = true;
        return m;
    }

    _makePaintable(mesh) {
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 256;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = this.baseSkinColor;
        ctx.fillRect(0, 0, 256, 256);
        const tex = new THREE.CanvasTexture(cv);
        mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
        mesh.castShadow = true;
        this.paintLayers.set(mesh.uuid, { canvas: cv, ctx, texture: tex });
        this.paintableMeshes.push(mesh);
    }

    setName(name) {
        if (this.nameSprite) this.modelGroup.remove(this.nameSprite);
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 52;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 256, 52);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.roundRect(3,3,250,46,10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(name.slice(0,16), 128, 27);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
        sp.scale.set(0.72, 0.14, 1);
        sp.position.y = this.height + 0.08;
        this.modelGroup.add(sp); this.nameSprite = sp;
    }

    setRole(role) {
        if (this.roleSprite) this.modelGroup.remove(this.roleSprite);
        if (!role) { this.roleSprite = null; return; }
        const cv = document.createElement('canvas'); cv.width = 220; cv.height = 44;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 220, 44);
        ctx.fillStyle = role === 'hunter' ? 'rgba(239,68,68,0.8)' : 'rgba(59,130,246,0.8)';
        ctx.beginPath(); ctx.roundRect(2,2,216,40,9); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(role === 'hunter' ? '🔴 HUNTER' : '🔵 SEEKER', 110, 22);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
        sp.scale.set(0.62, 0.12, 1);
        sp.position.y = this.height + 0.22;
        this.modelGroup.add(sp); this.roleSprite = sp;
    }

    jump() {
        if (this.frozen || this.jumpsLeft <= 0) return;
        this.velocity.y = this.jumpsLeft === 2 ? 5.2 : 3.6;
        this.jumpsLeft--;
        this.isGrounded = false;
        this._dust();
    }

    toggleFreeze() { this.frozen = !this.frozen; }

    _dust() {
        const mat = new THREE.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.7 });
        for (let i = 0; i < 6; i++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), mat.clone());
            p.position.copy(this.group.position);
            p.userData = { vx:(Math.random()-.5)*.5, vy:Math.random()*.4+.1, vz:(Math.random()-.5)*.5, life:1 };
            this.scene.add(p); this.particles.push(p);
        }
    }

    resolveCollisions(pos, vel, colliders) {
        const r = this.radius, h = this.height;
        let grounded = false;
        for (const box of colliders) {
            const ex = { minX:box.minX-r,maxX:box.maxX+r, minY:box.minY,maxY:box.maxY+h, minZ:box.minZ-r,maxZ:box.maxZ+r };
            if (pos.x<=ex.minX||pos.x>=ex.maxX||pos.y<=ex.minY||pos.y>=ex.maxY||pos.z<=ex.minZ||pos.z>=ex.maxZ) continue;
            const ox=Math.min(ex.maxX-pos.x,pos.x-ex.minX);
            const oy=Math.min(ex.maxY-pos.y,pos.y-ex.minY);
            const oz=Math.min(ex.maxZ-pos.z,pos.z-ex.minZ);
            if (oy<=ox&&oy<=oz) {
                if (pos.y-ex.minY < ex.maxY-pos.y) { pos.y=box.minY-h-0.001; if(vel.y>0)vel.y=0; }
                else { pos.y=box.maxY+0.001; if(vel.y<0){vel.y=0;grounded=true;} }
            } else if (ox<=oz) {
                pos.x = pos.x-ex.minX<ex.maxX-pos.x ? box.minX-r-0.001 : box.maxX+r+0.001;
                vel.x*=0.05;
            } else {
                pos.z = pos.z-ex.minZ<ex.maxZ-pos.z ? box.minZ-r-0.001 : box.maxZ+r+0.001;
                vel.z*=0.05;
            }
        }
        return grounded;
    }

    update(input, isSprinting, delta, colliders = []) {
        // Particles always tick
        for (let i=this.particles.length-1;i>=0;i--) {
            const p=this.particles[i];
            p.position.x+=p.userData.vx*delta; p.position.y+=p.userData.vy*delta; p.position.z+=p.userData.vz*delta;
            p.scale.setScalar(Math.max(0,p.userData.life));
            p.userData.life-=3*delta;
            if(p.userData.life<=0){this.scene.remove(p);this.particles.splice(i,1);}
        }

        if (this.isRemote) return;

        // While frozen, still apply gravity so they don't float
        if (this.frozen) {
            this.velocity.y -= 18*delta;
            const fp = this.group.position.clone();
            fp.y += this.velocity.y*delta;
            if(fp.y<=0){fp.y=0;this.velocity.y=0;this.isGrounded=true;}
            this.resolveCollisions(fp, this.velocity, colliders);
            this.group.position.copy(fp);
            return;
        }

        // Movement direction
        let mx = 0, mz = 0;
        if (Math.abs(input.jx||0)>0.08 || Math.abs(input.jz||0)>0.08) {
            mx = input.jx; mz = input.jz;
        } else {
            if(input.w) mz=-1; if(input.s) mz=1;
            if(input.a) mx=-1; if(input.d) mx=1;
            const len=Math.sqrt(mx*mx+mz*mz); if(len>1){mx/=len;mz/=len;}
        }

        const speed = isSprinting ? 6.5 : 3.8;
        const friction = 10;

        this.velocity.x += mx*speed*delta*60*0.016;
        this.velocity.z += mz*speed*delta*60*0.016;
        this.velocity.x -= this.velocity.x*friction*delta;
        this.velocity.z -= this.velocity.z*friction*delta;
        // Cap speed
        const hspd=Math.sqrt(this.velocity.x**2+this.velocity.z**2);
        if(hspd>speed){this.velocity.x*=speed/hspd;this.velocity.z*=speed/hspd;}
        this.velocity.y -= 20*delta;

        // Sub-step (2x) prevents tunnelling at high speed
        for(let step=0;step<2;step++){
            const dt=delta/2;
            const pos=this.group.position.clone();
            pos.x+=this.velocity.x*dt; pos.y+=this.velocity.y*dt; pos.z+=this.velocity.z*dt;
            if(pos.y<=0){pos.y=0;if(this.velocity.y<0){if(!this.isGrounded)this._dust();this.velocity.y=0;this.isGrounded=true;this.jumpsLeft=2;}}
            const hit=this.resolveCollisions(pos,this.velocity,colliders);
            if(hit){this.isGrounded=true;this.jumpsLeft=2;}
            else if(pos.y>0.01) this.isGrounded=false;
            const B=23; pos.x=Math.max(-B,Math.min(B,pos.x)); pos.z=Math.max(-B,Math.min(B,pos.z));
            this.group.position.copy(pos);
        }

        // ── Animation
        const spd=Math.sqrt(this.velocity.x**2+this.velocity.z**2);
        if(spd>0.06){
            const ta=Math.atan2(this.velocity.x,this.velocity.z);
            let diff=ta-this.modelGroup.rotation.y;
            diff=Math.atan2(Math.sin(diff),Math.cos(diff));
            this.modelGroup.rotation.y+=diff*20*delta;
            this.moveTime+=spd*delta*25;
            const w=Math.sin(this.moveTime);
            this.legL.rotation.x=w*0.65; this.legR.rotation.x=-w*0.65;
            this.armL.rotation.x=-w*0.55; this.armR.rotation.x=w*0.55;
            this.head.rotation.y=Math.sin(this.moveTime*0.5)*0.08;
        } else {
            const t=16*delta;
            this.legL.rotation.x*=(1-t); this.legR.rotation.x*=(1-t);
            this.armL.rotation.x*=(1-t); this.armR.rotation.x*=(1-t);
            this.head.rotation.y*=(1-t);
        }
    }

    applyRemoteState(s) {
        this.group.position.set(s.x,s.y,s.z);
        this.modelGroup.rotation.y=s.ry;
        this.legL.rotation.x=s.la||0; this.legR.rotation.x=-(s.la||0);
        this.armL.rotation.x=-(s.la||0); this.armR.rotation.x=s.la||0;
    }

    getNetState() {
        return { x:this.group.position.x,y:this.group.position.y,z:this.group.position.z,ry:this.modelGroup.rotation.y,la:this.legL.rotation.x };
    }

    executePaintMatrix(hitObject, uv, color, radius, tool) {
        const layer = this.paintLayers.get(hitObject.uuid);
        if (!layer) return;
        const x=uv.x*layer.canvas.width, y=(1-uv.y)*layer.canvas.height;
        if(tool==='bucket'){ layer.ctx.fillStyle=color; layer.ctx.fillRect(0,0,layer.canvas.width,layer.canvas.height); }
        else { layer.ctx.fillStyle=color; layer.ctx.beginPath(); layer.ctx.arc(x,y,radius,0,Math.PI*2); layer.ctx.fill(); }
        layer.texture.needsUpdate=true;
    }

    destroy() { this.scene.remove(this.group); }
}