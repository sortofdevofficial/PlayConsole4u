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

        this.radius = 0.07;   
        this.height = 0.55;   

        this.baseSkinColor = color;
        this.paintableMeshes = [];
        this.paintLayers = new Map();

        const headGeo  = new THREE.SphereGeometry(0.45*S, 20, 20);
        const torsoGeo = new THREE.CapsuleGeometry(0.35*S, 0.8*S, 8, 16);
        const limbGeo  = new THREE.CapsuleGeometry(0.12*S, 0.6*S, 6, 8);
        const jointGeo = new THREE.SphereGeometry(0.12*S, 8, 8);

        this.head  = new THREE.Mesh(headGeo);  this.head.position.y  = 2.4*S;
        this.torso = new THREE.Mesh(torsoGeo); this.torso.position.y = 1.4*S;

        this.armL = new THREE.Group();
        const sL=new THREE.Mesh(jointGeo), bL=new THREE.Mesh(limbGeo); bL.position.y=-0.3*S;
        this.armL.add(sL,bL); this.armL.position.set(-0.45*S,1.9*S,0);

        this.armR = new THREE.Group();
        const sR=new THREE.Mesh(jointGeo), bR=new THREE.Mesh(limbGeo); bR.position.y=-0.3*S;
        this.armR.add(sR,bR); this.armR.position.set(0.45*S,1.9*S,0);

        this.legL = new THREE.Group();
        const hL=new THREE.Mesh(jointGeo), tL=new THREE.Mesh(limbGeo); tL.position.y=-0.3*S;
        this.legL.add(hL,tL); this.legL.position.set(-0.2*S,0.8*S,0);

        this.legR = new THREE.Group();
        const hR=new THREE.Mesh(jointGeo), tR=new THREE.Mesh(limbGeo); tR.position.y=-0.3*S;
        this.legR.add(hR,tR); this.legR.position.set(0.2*S,0.8*S,0);

        [this.head,this.torso,sL,bL,sR,bR,hL,tL,hR,tR].forEach(p=>this.makePaintable(p));
        this.modelGroup.add(this.head,this.torso,this.armL,this.armR,this.legL,this.legR);
        this.scene.add(this.group);
        this.nameLabel=null; this.roleLabel=null;
    }

    setName(name) {
        if (this.nameLabel) this.modelGroup.remove(this.nameLabel);
        const cv=document.createElement('canvas'); cv.width=256; cv.height=48;
        const ctx=cv.getContext('2d');
        ctx.clearRect(0,0,256,48);
        ctx.fillStyle='rgba(0,0,0,0.55)'; this._rrect(ctx,4,4,248,40,8); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='bold 20px Segoe UI';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(name.slice(0,16),128,26);
        const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));
        sp.scale.set(0.7,0.13,1);
        sp.position.y=this.height+0.07;
        this.modelGroup.add(sp); this.nameLabel=sp;
    }

    _rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

    setRole(role) {
        if (this.roleLabel) this.modelGroup.remove(this.roleLabel);
        
        // ── SPECTATOR LOGIC: Invisible if spectator ──
        if (role === 'spectator') {
            this.modelGroup.visible = false;
            this.roleLabel = null;
            return;
        } else {
            this.modelGroup.visible = true;
        }

        if (!role) { this.roleLabel=null; return; }
        const cv=document.createElement('canvas'); cv.width=200; cv.height=40;
        const ctx=cv.getContext('2d');
        ctx.clearRect(0,0,200,40);
        ctx.fillStyle=role==='hunter'?'rgba(180,30,30,0.7)':'rgba(30,100,180,0.7)';
        this._rrect(ctx,2,2,196,36,8); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='bold 16px Segoe UI';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(role==='hunter'?'🔴 HUNTER':'🔵 SEEKER',100,20);
        const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));
        sp.scale.set(0.56,0.11,1);
        sp.position.y=this.height+0.2;
        this.modelGroup.add(sp); this.roleLabel=sp;
    }

    makePaintable(mesh) {
        const cv=document.createElement('canvas'); cv.width=256; cv.height=256;
        const ctx=cv.getContext('2d');
        ctx.fillStyle=this.baseSkinColor; ctx.fillRect(0,0,256,256);
        const tex=new THREE.CanvasTexture(cv);
        mesh.material=new THREE.MeshStandardMaterial({map:tex,roughness:0.75,metalness:0.05});
        mesh.castShadow=true;
        this.paintLayers.set(mesh.uuid,{canvas:cv,ctx,texture:tex});
        this.paintableMeshes.push(mesh);
    }

    jump() {
        if (this.frozen||this.jumpsLeft<=0) return;
        // ── FASTER JUMP ──
        this.velocity.y = this.jumpsLeft===2 ? 7.5 : 5.5; 
        this.jumpsLeft--;
        this.isGrounded=false;
        this._dust();
    }

    toggleFreeze() { this.frozen=!this.frozen; }

    _dust() {
        const mat=new THREE.MeshBasicMaterial({color:'#aab4be',transparent:true,opacity:0.6});
        for(let i=0;i<5;i++){
            const p=new THREE.Mesh(new THREE.SphereGeometry(0.015,5,5),mat.clone());
            p.position.copy(this.group.position); p.position.y+=0.02;
            p.userData={vx:(Math.random()-.5)*0.6,vy:Math.random()*0.4,vz:(Math.random()-.5)*0.6,life:1};
            this.scene.add(p); this.particles.push(p);
        }
    }

    resolveCollisions(pos, vel, colliders) {
        const r=this.radius, h=this.height;
        let grounded=false;
        for (const box of colliders) {
            const ex={ minX:box.minX-r, maxX:box.maxX+r, minY:box.minY, maxY:box.maxY+h, minZ:box.minZ-r, maxZ:box.maxZ+r };
            if (pos.x<=ex.minX||pos.x>=ex.maxX) continue;
            if (pos.y<=ex.minY||pos.y>=ex.maxY) continue;
            if (pos.z<=ex.minZ||pos.z>=ex.maxZ) continue;
            const ox = Math.min(ex.maxX-pos.x, pos.x-ex.minX);
            const oy = Math.min(ex.maxY-pos.y, pos.y-ex.minY);
            const oz = Math.min(ex.maxZ-pos.z, pos.z-ex.minZ);
            if (oy < ox && oy < oz) {
                if (pos.y - ex.minY < ex.maxY - pos.y) { pos.y = box.minY - h - 0.001; if (vel.y > 0) vel.y = 0; }
                else { pos.y = box.maxY + 0.001; if (vel.y < 0) { vel.y = 0; grounded = true; } }
            } else if (ox < oz) {
                if (pos.x - ex.minX < ex.maxX - pos.x) pos.x = box.minX - r - 0.001;
                else pos.x = box.maxX + r + 0.001;
                vel.x *= 0.1;
            } else {
                if (pos.z - ex.minZ < ex.maxZ - pos.z) pos.z = box.minZ - r - 0.001;
                else pos.z = box.maxZ + r + 0.001;
                vel.z *= 0.1;
            }
        }
        return grounded;
    }

    update(keys, isSprinting, delta, colliders=[]) {
        if (this.isRemote || this.frozen) return;

        this.direction.set( (keys.d?1:0)-(keys.a?1:0), 0, (keys.s?1:0)-(keys.w?1:0) );
        if (this.direction.lengthSq()>0) this.direction.normalize();

        // ── FASTER MOVEMENT ──
        const speed    = isSprinting ? 14 : 8.5;   
        const accel    = 70;
        const friction = 20;

        this.velocity.x += this.direction.x * speed * accel * delta * delta;
        this.velocity.z += this.direction.z * speed * accel * delta * delta;
        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;

        const hspd = Math.sqrt(this.velocity.x**2+this.velocity.z**2);
        if (hspd > speed) { const sc = speed/hspd; this.velocity.x *= sc; this.velocity.z *= sc; }

        this.velocity.y -= 25 * delta;

        const STEPS = 2; const dt = delta / STEPS;
        const pos = this.group.position.clone();

        for (let step=0; step<STEPS; step++) {
            pos.x += this.velocity.x * dt;
            pos.y += this.velocity.y * dt;
            pos.z += this.velocity.z * dt;

            // Stop at floor (y=0) ONLY if inside the arena bounds (void check)
            if (pos.y <= 0 && pos.x > -23 && pos.x < 23 && pos.z > -23 && pos.z < 23) {
                pos.y = 0;
                if (this.velocity.y < 0) {
                    if (!this.isGrounded) this._dust();
                    this.velocity.y = 0; this.isGrounded = true; this.jumpsLeft  = 2;
                }
            }

            const hitBox = this.resolveCollisions(pos, this.velocity, colliders);
            if (hitBox) { this.isGrounded=true; this.jumpsLeft=2; }
            if (pos.y > 0.01 && !hitBox) this.isGrounded = false;
        }

        this.group.position.copy(pos);

        // Animations
        const spd=Math.sqrt(this.velocity.x**2+this.velocity.z**2);
        if (spd>0.08) {
            const ta=Math.atan2(this.velocity.x,this.velocity.z);
            let diff=ta-this.modelGroup.rotation.y;
            diff=Math.atan2(Math.sin(diff),Math.cos(diff));
            this.modelGroup.rotation.y+=diff*22*delta;
            if (this.isGrounded) {
                this.moveTime+=spd*delta*28;
                const w=Math.sin(this.moveTime);
                this.legL.rotation.x= w*0.7; this.legR.rotation.x=-w*0.7;
                this.armL.rotation.x=-w*0.6; this.armR.rotation.x= w*0.6;
            }
        } else {
            const t=20*delta;
            this.legL.rotation.x=THREE.MathUtils.lerp(this.legL.rotation.x,0,t);
            this.legR.rotation.x=THREE.MathUtils.lerp(this.legR.rotation.x,0,t);
            this.armL.rotation.x=THREE.MathUtils.lerp(this.armL.rotation.x,0,t);
            this.armR.rotation.x=THREE.MathUtils.lerp(this.armR.rotation.x,0,t);
        }

        // Particles
        for(let i=this.particles.length-1;i>=0;i--){
            const p=this.particles[i];
            p.position.x+=p.userData.vx*delta; p.position.y+=p.userData.vy*delta; p.position.z+=p.userData.vz*delta;
            p.scale.setScalar(Math.max(0,p.userData.life));
            p.userData.life-=3*delta;
            if(p.userData.life<=0){this.scene.remove(p);this.particles.splice(i,1);}
        }
    }

    applyRemoteState(s) {
        this.group.position.set(s.x,s.y,s.z);
        this.modelGroup.rotation.y=s.ry;
        this.legL.rotation.x= s.la||0;
        this.legR.rotation.x=-(s.la||0);
        this.armL.rotation.x=-(s.la||0);
        this.armR.rotation.x= s.la||0;
    }

    getNetState() {
        return {x:this.group.position.x,y:this.group.position.y,z:this.group.position.z,ry:this.modelGroup.rotation.y,la:this.legL.rotation.x};
    }

    executePaintMatrix(hitObject,uv,color,radius,tool) {
        const layer=this.paintLayers.get(hitObject.uuid);
        if(!layer) return;
        const x=uv.x*layer.canvas.width, y=(1-uv.y)*layer.canvas.height;
        if(tool==='bucket'){layer.ctx.fillStyle=color;layer.ctx.fillRect(0,0,layer.canvas.width,layer.canvas.height);}
        else{layer.ctx.fillStyle=tool==='eraser'?this.baseSkinColor:color;layer.ctx.beginPath();layer.ctx.arc(x,y,radius,0,Math.PI*2);layer.ctx.fill();}
        layer.texture.needsUpdate=true;
    }

    destroy(){this.scene.remove(this.group);}
}