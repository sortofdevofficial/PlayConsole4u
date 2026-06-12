import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const NPC_NAMES = ['Bob','Mia','Zack','Luna','Rex','Coco','Finn','Ivy','Duke','Penny'];
const NPC_COLORS = [0xff6b6b,0x6bffb8,0x6b9fff,0xff6bef,0xffb86b,0x6bffff,0xb86bff,0xff6bb8,0xb8ff6b,0x6bb8ff];

function makeNameTag(scene, label, hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,256,64);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.roundRect(4,16,248,40,10); ctx.fill();
  const c = new THREE.Color(hexColor);
  ctx.font = 'bold 24px Segoe UI, sans-serif';
  ctx.fillStyle = `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 36);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map:tex, depthTest:false, transparent:true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 0.5, 1);
  scene.add(sprite);
  return sprite;
}

export class NPC {
  constructor(scene, x, z, nameIdx = -1) {
    this.position     = new THREE.Vector3(x, 0, z);
    this.groundOffset = 0.08;
    this.speed        = 1.8 + Math.random()*1.2;
    this.waypoints    = [];
    this.radius       = 0.7;
    this._wpIdx       = 0;
    this._walkWeight  = 0;
    this._targetRY    = 0;
    this._sq          = 1;
    this._prevW       = 0;
    this._waitTimer   = 0;
    this._waiting     = false;
    this.knockbackVel = new THREE.Vector3();
    this.isKnockedBack = false;
    this._knockTimer  = 0;

    const idx = nameIdx >= 0 ? nameIdx % NPC_NAMES.length : Math.floor(Math.random()*NPC_NAMES.length);
    const col = NPC_COLORS[idx % NPC_COLORS.length];
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.05 });
    this.mat = mat;

    this.bodyGroup = new THREE.Group();
    scene.add(this.bodyGroup);

    // ── Same shape as player ──
    this.torso = new THREE.Mesh(new THREE.SphereGeometry(0.64, 14, 12), mat);
    this.torso.castShadow = true;
    this.torso.position.y = 0.78;
    this.bodyGroup.add(this.torso);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 12), mat);
    this.head.scale.set(1, 0.9, 1);
    this.head.castShadow = true;
    this.head.position.y = 1.66;
    this.bodyGroup.add(this.head);

    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeG = new THREE.SphereGeometry(0.082, 7, 7);
    for (const sx of [.19, -.19]) {
      const e = new THREE.Mesh(eyeG, eyeM);
      e.position.set(sx, 0.07, 0.41);
      this.head.add(e);
    }

    this.lArm = this._limb([ .74, 1.0, 0]);
    this.rArm = this._limb([-.74, 1.0, 0]);
    const armGeo = new THREE.CapsuleGeometry(0.13, 0.5, 5, 7);
    this._mesh(this.lArm, armGeo, mat, 0, -.25);
    this._mesh(this.rArm, armGeo, mat, 0, -.25);
    this.lArm.rotation.set(-.15, 0,  1.05);
    this.rArm.rotation.set(-.15, 0, -1.05);

    this.lLeg = this._limb([ .27, .28, 0]);
    this.rLeg = this._limb([-.27, .28, 0]);
    const legGeo = new THREE.CapsuleGeometry(0.155, 0.28, 5, 7);
    this._mesh(this.lLeg, legGeo, mat, 0, -.14);
    this._mesh(this.rLeg, legGeo, mat, 0, -.14);

    // Name tag with NPC name
    this.nameTag = makeNameTag(scene, NPC_NAMES[idx], col);
  }

  _limb(pos) {
    const g = new THREE.Group(); g.position.set(...pos); this.bodyGroup.add(g); return g;
  }
  _mesh(parent, geo, mat, x, y, z=0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow=true; parent.add(m); return m;
  }

  setWaypoints(wps) {
    this.waypoints = wps.map(w => new THREE.Vector3(w.x, 0, w.z));
    for (let i = this.waypoints.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [this.waypoints[i],this.waypoints[j]] = [this.waypoints[j],this.waypoints[i]];
    }
    this._wpIdx = Math.floor(Math.random()*this.waypoints.length);
  }

  applyKnockback(dir, force=9) {
    this.knockbackVel.copy(dir).normalize().multiplyScalar(force);
    this.knockbackVel.y = 5;
    this.isKnockedBack  = true;
    this._knockTimer    = 0;
    this._sq = 0.6;
  }

  update(dt, time, worldMap) {
    const gy = worldMap?.getElevation?.(this.position.x, this.position.z) ?? 0;

    // Update name tag
    this.nameTag.position.set(this.position.x, this.position.y + 2.6, this.position.z);

    if (this.isKnockedBack) {
      this._knockTimer += dt;
      this.position.x += this.knockbackVel.x*dt;
      this.position.z += this.knockbackVel.z*dt;
      this.knockbackVel.x *= Math.pow(0.82, dt*60);
      this.knockbackVel.z *= Math.pow(0.82, dt*60);
      this.knockbackVel.y -= 14*dt;
      const gnd = gy+this.groundOffset;
      this.position.y = Math.max(gnd, this.position.y+this.knockbackVel.y*dt);
      if (this.position.y<=gnd && this._knockTimer>.3) {
        this.position.y=gnd; this.isKnockedBack=false; this.knockbackVel.set(0,0,0);
      }
      this._sq += (1-this._sq)*12*dt;
      this._anim(time, 0, dt);
      return;
    }

    this.position.y = gy+this.groundOffset;

    if (this._waiting) {
      this._waitTimer -= dt;
      if (this._waitTimer<=0) this._waiting=false;
      this._walkWeight += (0-this._walkWeight)*8*dt;
      this._anim(time, 0, dt);
      return;
    }

    if (!this.waypoints.length) { this._anim(time,0,dt); return; }

    const target = this.waypoints[this._wpIdx];
    const dx=target.x-this.position.x, dz=target.z-this.position.z;
    const dist=Math.hypot(dx,dz);
    if (dist<1.5) {
      this._wpIdx=(this._wpIdx+1)%this.waypoints.length;
      if (Math.random()<.4){ this._waiting=true; this._waitTimer=1+Math.random()*3; }
      return;
    }
    const nx=dx/dist, nz=dz/dist;
    this.position.x+=nx*this.speed*dt;
    this.position.z+=nz*this.speed*dt;
    this._targetRY=Math.atan2(nx,nz);
    this._walkWeight+=(1-this._walkWeight)*10*dt;
    this._anim(time, this._walkWeight, dt);
  }

  _anim(time, ww, dt) {
    const w=Math.sin(time*15);
    if (ww>.4 && w>.55 && this._prevW<=.55) this._sq=0.82;
    this._prevW=w;
    this._sq+=(1-this._sq)*15*dt;
    const inv=1/Math.max(this._sq,.65);

    const diff=Math.atan2(Math.sin(this._targetRY-this.bodyGroup.rotation.y),Math.cos(this._targetRY-this.bodyGroup.rotation.y));
    this.bodyGroup.rotation.y+=diff*10*dt;
    this.bodyGroup.rotation.z=w*.05*ww;
    this.bodyGroup.rotation.x=ww*.1;
    this.bodyGroup.position.copy(this.position);
    this.bodyGroup.scale.set(inv*(1+ww*.025), this._sq, inv);

    this.torso.position.y=.78+Math.abs(w)*.08*ww;
    this.head.position.y=1.66+Math.abs(w)*.065*ww;
    this.head.rotation.set(w*.04*ww, this.bodyGroup.rotation.y, -w*.04*ww);

    this.lLeg.rotation.x= w*.55*ww;
    this.rLeg.rotation.x=-w*.55*ww;
    this.lLeg.position.y=.28+(w>0? w*.11*ww:0);
    this.rLeg.position.y=.28+(w<0?-w*.11*ww:0);
    this.lArm.rotation.set(-.15-w*.38*ww, 0,  1.05+Math.abs(w)*.1*ww);
    this.rArm.rotation.set(-.15+w*.38*ww, 0, -1.05-Math.abs(w)*.1*ww);
  }
}