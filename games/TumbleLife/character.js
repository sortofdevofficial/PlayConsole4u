import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

class FootDust {
  constructor(scene) {
    this.p = [];
    const geo = new THREE.SphereGeometry(0.055, 4, 4);
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xd4c4a0, transparent: true }));
      m.visible = false; scene.add(m);
      this.p.push({ m, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    this._i = 0;
  }
  emit(x, y, z) {
    for (let i = 0; i < 3; i++) {
      const p = this.p[this._i++ % this.p.length];
      p.m.visible = true;
      p.m.position.set(x + (Math.random()-.5)*.3, y+.05, z + (Math.random()-.5)*.3);
      p.life = 1; p.vx = (Math.random()-.5)*1.6; p.vy = .9+Math.random()*.5; p.vz = (Math.random()-.5)*1.6;
      p.m.scale.setScalar(1);
    }
  }
  update(dt) {
    for (const p of this.p) {
      if (!p.m.visible) continue;
      p.life -= dt * 3.2;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.m.position.x += p.vx*dt; p.m.position.y += p.vy*dt; p.m.position.z += p.vz*dt;
      p.vy -= 5*dt;
      p.m.scale.setScalar(p.life*.9);
      p.m.material.opacity = p.life*.5;
    }
  }
}

// Floating name tag sprite above player
function makeNameTag(scene, label, color='#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.roundRect(4, 16, 248, 40, 10);
  ctx.fill();
  ctx.font = 'bold 26px Segoe UI, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 36);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.2, 0.55, 1);
  scene.add(sprite);
  return sprite;
}

export class WobblyCharacter {
  constructor(scene, label = 'You', tagColor = '#faff6e') {
    this.position     = new THREE.Vector3();
    this.speed        = 6;
    this.isDriving    = false;
    this.groundOffset = 0.08;
    this.walkWeight   = 0;
    this.targetRotationY = 0;
    this._sq    = 1;
    this._lean  = 0;
    this._prevW = 0;
    this.isPunching = false;
    this.punchTime  = 0;

    const mat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.05 });
    this.mat = mat;
    this.bodyGroup = new THREE.Group();
    scene.add(this.bodyGroup);

    // ── Big round blob body ──
    this.torsoMesh = new THREE.Mesh(new THREE.SphereGeometry(0.64, 20, 16), mat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.position.y = 0.78;
    this.bodyGroup.add(this.torsoMesh);

    // ── Smaller flattened head ──
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14), mat);
    this.head.scale.set(1, 0.9, 1);
    this.head.castShadow = true;
    this.head.position.y = 1.66;
    this.bodyGroup.add(this.head);

    // ── Dot eyes only ──
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeG = new THREE.SphereGeometry(0.082, 8, 8);
    for (const sx of [.19, -.19]) {
      const e = new THREE.Mesh(eyeG, eyeM);
      e.position.set(sx, 0.07, 0.41);
      this.head.add(e);
    }

    // ── Arms raised wide like image ──
    this.leftArmPivot  = this._limb([ .74, 1.0, 0]);
    this.rightArmPivot = this._limb([-.74, 1.0, 0]);
    const armGeo = new THREE.CapsuleGeometry(0.13, 0.5, 6, 8);
    this._mesh(this.leftArmPivot,  armGeo, mat, 0, -.25);
    this._mesh(this.rightArmPivot, armGeo, mat, 0, -.25);
    this.leftArmPivot.rotation.set(-.15, 0,  1.05);
    this.rightArmPivot.rotation.set(-.15, 0, -1.05);

    // ── Stubby legs ──
    this.leftLegPivot  = this._limb([ .27, .28, 0]);
    this.rightLegPivot = this._limb([-.27, .28, 0]);
    const legGeo = new THREE.CapsuleGeometry(0.155, 0.28, 6, 8);
    this._mesh(this.leftLegPivot,  legGeo, mat, 0, -.14);
    this._mesh(this.rightLegPivot, legGeo, mat, 0, -.14);

    // ── Name tag ──
    this.nameTag = makeNameTag(scene, label, tagColor);

    this.dust = new FootDust(scene);
  }

  _limb(pos) {
    const g = new THREE.Group(); g.position.set(...pos); this.bodyGroup.add(g); return g;
  }
  _mesh(parent, geo, mat, x, y, z=0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow=true; parent.add(m); return m;
  }
  // legacy compat
  makeLimb(mat, pos) { return this._limb(pos); }
  addMesh(parent, geo, mat, x, y, z=0) { return this._mesh(parent, geo, mat, x, y, z); }

  snapToTerrain(worldMap) {
    const y = worldMap?.getElevation?.(this.position.x, this.position.z) ?? 0;
    this.position.y = y + this.groundOffset;
    this.bodyGroup.position.copy(this.position);
  }

  punch() {
    if (this.isPunching) return;
    this.isPunching = true;
    this.punchTime  = 0;
  }

  setDrivingState(isDriving, carPos=null, carAngle=0, steerVal=0, time=0, worldMap=null, seatSide=-1) {
    this.isDriving = isDriving;
    if (!isDriving) {
      this.bodyGroup.scale.set(1,1,1);
      this.bodyGroup.rotation.x = 0;
      this.torsoMesh.position.y = 0.78;
      this.head.position.y = 1.66;
      this.leftArmPivot.rotation.set(-.15,0, 1.05);
      this.rightArmPivot.rotation.set(-.15,0,-1.05);
      this.leftLegPivot.position.y = this.rightLegPivot.position.y = .28;
      this.leftLegPivot.rotation.set(0,0,0); this.rightLegPivot.rotation.set(0,0,0);
      return;
    }
    if (!carPos) return;
    const wb = Math.sin(time*22)*.007;
    this.position.x = carPos.x + Math.cos(carAngle)*0.85*seatSide - Math.sin(carAngle)*.38;
    this.position.z = carPos.z - Math.sin(carAngle)*0.85*seatSide - Math.cos(carAngle)*.38;
    this.position.y = carPos.y + 0.5 + wb;
    this.bodyGroup.position.copy(this.position);
    this.bodyGroup.rotation.set(.02, carAngle, -steerVal*.06);
    this.bodyGroup.scale.set(1,1,1);
    this.torsoMesh.position.y = 0.3;
    this.head.position.y = 0.98;
    this.leftArmPivot.rotation.set(-1.1, .1,  .2-steerVal*.5);
    this.rightArmPivot.rotation.set(-1.1,-.1, -.2-steerVal*.5);
    this.leftLegPivot.rotation.set(-1.3,.12,0); this.rightLegPivot.rotation.set(-1.3,-.12,0);
    this.leftLegPivot.position.y = this.rightLegPivot.position.y = .16;
    this.head.rotation.set(.02, steerVal*.18, -steerVal*.05);
  }

  update(deltaTime, time, moveDirection, worldMap=null) {
    // Always update name tag position
    this.nameTag.position.set(
      this.bodyGroup.position.x,
      this.bodyGroup.position.y + 2.6,
      this.bodyGroup.position.z
    );

    if (this.isDriving) { this.dust.update(deltaTime); return; }

    const moving = moveDirection.lengthSq() > 0;
    this.walkWeight += ((moving?1:0)-this.walkWeight)*11*deltaTime;
    if (moving) this.targetRotationY = Math.atan2(moveDirection.x, moveDirection.z);

    const y = worldMap?.getElevation?.(this.position.x, this.position.z);
    if (Number.isFinite(y)) this.position.y = y + this.groundOffset;

    const w = Math.sin(time*15);
    const ww = this.walkWeight;

    // Footstrike squash + dust
    if (moving && ww>.4 && w>.55 && this._prevW<=.55) {
      this._sq = 0.78;
      this.dust.emit(this.bodyGroup.position.x, this.position.y, this.bodyGroup.position.z);
    }
    this._prevW = w;
    this._sq += (1-this._sq)*15*deltaTime;
    const inv = 1/Math.max(this._sq,.65);

    this._lean += ((moving?.16:0)-this._lean)*8*deltaTime;

    const diff = Math.atan2(Math.sin(this.targetRotationY-this.bodyGroup.rotation.y), Math.cos(this.targetRotationY-this.bodyGroup.rotation.y));
    this.bodyGroup.rotation.y += diff*14*deltaTime;
    this.bodyGroup.rotation.x = this._lean;
    this.bodyGroup.rotation.z = w*.05*ww;
    this.bodyGroup.position.copy(this.position);
    this.bodyGroup.scale.set(inv*(1+ww*.025), this._sq, inv);

    this.torsoMesh.position.y = .78+Math.abs(w)*.08*ww;
    this.head.position.y      = 1.66+Math.abs(w)*.065*ww;
    this.head.rotation.set(w*.04*ww, this.bodyGroup.rotation.y, -w*.04*ww);

    this.leftLegPivot.rotation.x  =  w*.55*ww;
    this.rightLegPivot.rotation.x = -w*.55*ww;
    this.leftLegPivot.position.y  = .28+(w>0? w*.11*ww:0);
    this.rightLegPivot.position.y = .28+(w<0?-w*.11*ww:0);

    // Punch anim overrides right arm
    if (this.isPunching) {
      this.punchTime += deltaTime*14;
      const pt = this.punchTime;
      if (pt < 0.35) {
        const t = pt/0.35;
        this.rightArmPivot.rotation.set(-.15+t*.5, 0, -1.05+t*.3);
      } else if (pt < 0.65) {
        const t = (pt-.35)/.3;
        this.rightArmPivot.rotation.set(-.15+.5-t*2.2, 0, -.75-t*.8);
        if (t>.5) this._sq = 0.82;
      } else if (pt < 1.1) {
        const t = (pt-.65)/.45;
        this.rightArmPivot.rotation.set(-1.85+t*1.7, 0, -1.55+t*.5);
      } else {
        this.isPunching = false;
        this.rightArmPivot.rotation.set(-.15,0,-1.05);
      }
    } else {
      this.leftArmPivot.rotation.set(-.15-w*.38*ww, 0,  1.05+Math.abs(w)*.1*ww);
      this.rightArmPivot.rotation.set(-.15+w*.38*ww, 0, -1.05-Math.abs(w)*.1*ww);
    }

    this.dust.update(deltaTime);
  }
}