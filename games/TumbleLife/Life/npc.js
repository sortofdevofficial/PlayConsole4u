import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class NPC {
  constructor(scene, x = 0, z = 0) {
    this.position = new THREE.Vector3(x, 0, z);
    this.targetRotationY = 0;
    this.walkWeight = 1;
    this.speed = 2.8;
    this.groundOffset = 0.08;

    this.waypoints = [];
    this.currentWaypointIndex = 0;

    // Yellow like your character (0xfacc15)
    const mat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6, metalness: 0.1 });
    this.mat = mat;
    this.bodyGroup = new THREE.Group();
    scene.add(this.bodyGroup);

    this.torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.45, 12, 24), mat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.position.y = 1.1;
    this.bodyGroup.add(this.torsoMesh);

    this.leftArmPivot  = this.makeLimb(mat, [ 0.42, 1.35, 0]);
    this.rightArmPivot = this.makeLimb(mat, [-0.42, 1.35, 0]);
    this.leftLegPivot  = this.makeLimb(mat, [ 0.22, 0.65, 0]);
    this.rightLegPivot = this.makeLimb(mat, [-0.22, 0.65, 0]);

    const legGeo = new THREE.CapsuleGeometry(0.16, 0.45, 6, 12);
    this.addMesh(this.leftLegPivot,  legGeo, mat, 0, -0.22);
    this.addMesh(this.rightLegPivot, legGeo, mat, 0, -0.22);
    
    const armGeo = new THREE.CapsuleGeometry(0.18, 0.68, 6, 12);
    this.addMesh(this.leftArmPivot,  armGeo, mat, 0, -0.34);
    this.addMesh(this.rightArmPivot, armGeo, mat, 0, -0.34);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 24), mat);
    this.head.castShadow = true;
    this.head.position.y = 1.9;
    this.bodyGroup.add(this.head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eyeG   = new THREE.SphereGeometry(0.1, 8, 8);
    this.addMesh(this.head, eyeG, eyeMat,  0.22, 0.05, 0.7);
    this.addMesh(this.head, eyeG, eyeMat, -0.22, 0.05, 0.7);
    
    this.nameTag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(document.createElement('canvas')),
      depthTest: false,
      transparent: true
    }));
    this.nameTag.scale.set(2.2, 0.55, 1);
    this.nameTag.position.y = 2.6;
    this.bodyGroup.add(this.nameTag);
    this.setLabel('NPC');

    this.knockbackDir = new THREE.Vector3();
    this.knockbackTimer = 0;
  }

  makeLimb(mat, pos) {
    const g = new THREE.Group();
    g.position.set(...pos);
    this.bodyGroup.add(g);
    return g;
  }

  addMesh(parent, geo, mat, x, y, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  setWaypoints(waypoints) {
    this.waypoints = waypoints;
  }

  setLabel(label) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(4, 16, 248, 40, 10);
    ctx.fill();
    ctx.font = 'bold 26px Segoe UI, sans-serif';
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 36);
    this.nameTag.material.map = new THREE.CanvasTexture(canvas);
    this.nameTag.material.needsUpdate = true;
  }

  applyKnockback(dir, force) {
    this.knockbackDir.set(dir.x, 0, dir.z).normalize().multiplyScalar(force);
    this.knockbackTimer = 0.35;
  }

  update(deltaTime, time, worldMap) {
    if (this.waypoints.length > 0) {
      const target = this.waypoints[this.currentWaypointIndex];
      const distSq = (this.position.x - target.x) ** 2 + (this.position.z - target.z) ** 2;

      if (distSq < 16) {
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      }

      const angle = Math.atan2(target.x - this.position.x, target.z - this.position.z);
      const moveX = Math.sin(angle) * this.speed * deltaTime;
      const moveZ = Math.cos(angle) * this.speed * deltaTime;

      this.position.x += moveX;
      this.position.z += moveZ;
      this.targetRotationY = angle;
    }

    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= deltaTime;
      this.position.x += this.knockbackDir.x * deltaTime;
      this.position.z += this.knockbackDir.z * deltaTime;
    }

    const y = worldMap?.getElevation?.(this.position.x, this.position.z);
    if (Number.isFinite(y)) this.position.y = y + this.groundOffset;

    const diff = Math.atan2(
      Math.sin(this.targetRotationY - this.bodyGroup.rotation.y),
      Math.cos(this.targetRotationY - this.bodyGroup.rotation.y)
    );
    this.bodyGroup.rotation.y += diff * 6 * deltaTime;
    this.bodyGroup.position.copy(this.position);

    const w = Math.sin(time * 12), c = Math.cos(time * 12);
    this.torsoMesh.position.y = 1.1 + Math.abs(w) * 0.08;
    this.bodyGroup.rotation.z = w * 0.04;
    
    this.head.position.set(0, 1.9 + c * 0.04 + Math.sin(time * 2) * 0.01, 0);
    this.head.rotation.set(0, this.bodyGroup.rotation.y, -(w * 0.02));
    
    this.leftLegPivot.rotation.x  =  w * 0.4;
    this.rightLegPivot.rotation.x = -w * 0.4;
    this.leftLegPivot.position.y  = 0.65 + (w > 0 ?  w * 0.1 : 0);
    this.rightLegPivot.position.y = 0.65 + (w < 0 ? -w * 0.1 : 0);
    
    this.leftArmPivot.rotation.x  = -w * 0.3;
    this.rightArmPivot.rotation.x =  w * 0.3;
    this.leftArmPivot.rotation.z  =  0.15 + Math.abs(w) * 0.2;
    this.rightArmPivot.rotation.z = -0.15 - Math.abs(w) * 0.2;
  }
}