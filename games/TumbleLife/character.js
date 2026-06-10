import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class WobblyCharacter {
  constructor(scene) {
    this.targetRotationY = 0;
    this.walkWeight = 0;
    this.position = new THREE.Vector3();
    this.speed = 6;
    this.isDriving = false;
    this.groundOffset = 0.08;

    const mat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6, metalness: 0.1 });
    this.bodyGroup = new THREE.Group();
    scene.add(this.bodyGroup);

    this.torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.45, 12, 24), mat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.position.y = 1.1;
    this.bodyGroup.add(this.torsoMesh);

    this.leftArmPivot = this.makeLimb(mat, [0.42, 1.35, 0]);
    this.rightArmPivot = this.makeLimb(mat, [-0.42, 1.35, 0]);
    this.leftLegPivot = this.makeLimb(mat, [0.22, 0.65, 0]);
    this.rightLegPivot = this.makeLimb(mat, [-0.22, 0.65, 0]);

    const legGeo = new THREE.CapsuleGeometry(0.16, 0.45, 6, 12);
    this.addMesh(this.leftLegPivot, legGeo, mat, 0, -0.22);
    this.addMesh(this.rightLegPivot, legGeo, mat, 0, -0.22);
    const armGeo = new THREE.CapsuleGeometry(0.18, 0.68, 6, 12);
    this.addMesh(this.leftArmPivot, armGeo, mat, 0, -0.34);
    this.addMesh(this.rightArmPivot, armGeo, mat, 0, -0.34);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 24), mat);
    this.head.castShadow = true;
    this.head.position.y = 1.9;
    this.bodyGroup.add(this.head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eyeG = new THREE.SphereGeometry(0.1, 8, 8);
    this.addMesh(this.head, eyeG, eyeMat, 0.22, 0.05, 0.7);
    this.addMesh(this.head, eyeG, eyeMat, -0.22, 0.05, 0.7);
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

  snapToTerrain(worldMap) {
    const y = worldMap?.getElevation?.(this.position.x, this.position.z) ?? 0;
    this.position.y = y + this.groundOffset;
    this.bodyGroup.position.copy(this.position);
  }

  setDrivingState(isDriving, carPos = null, carAngle = 0, steerVal = 0, time = 0, worldMap = null) {
    this.isDriving = isDriving;

    if (!isDriving) {
      this.torsoMesh.position.y = 1.1;
      this.leftLegPivot.position.set(0.22, 0.65, 0);
      this.rightLegPivot.position.set(-0.22, 0.65, 0);
      this.head.position.set(0, 1.9, 0);
      return;
    }

    if (!carPos) return;

    const wobble = Math.sin(time * 22) * 0.008;
    this.position.copy(carPos);
    this.position.x -= Math.sin(carAngle) * 0.38;
    this.position.z -= Math.cos(carAngle) * 0.38;
    this.position.y = carPos.y + 0.55 + wobble;

    this.bodyGroup.position.copy(this.position);
    this.bodyGroup.rotation.set(0.02, carAngle, -steerVal * 0.06);

    this.torsoMesh.position.y = 0.5;
    this.leftArmPivot.rotation.set(-1.15, 0.1, 0.22 - steerVal * 0.55);
    this.rightArmPivot.rotation.set(-1.15, -0.1, -0.22 - steerVal * 0.55);
    this.leftLegPivot.rotation.set(-1.35, 0.15, 0);
    this.rightLegPivot.rotation.set(-1.35, -0.15, 0);
    this.leftLegPivot.position.y = this.rightLegPivot.position.y = 0.55;
    this.head.position.set(0, 0.92, 0.12);
    this.head.rotation.set(0.02, carAngle + steerVal * 0.2, -steerVal * 0.05);
  }

  update(deltaTime, time, moveDirection, worldMap = null) {
    if (this.isDriving) return;

    const moving = moveDirection.lengthSq() > 0;
    this.walkWeight += ((moving ? 1 : 0) - this.walkWeight) * 10 * deltaTime;

    if (moving) {
      this.position.addScaledVector(moveDirection, this.speed * deltaTime);
      this.targetRotationY = Math.atan2(moveDirection.x, moveDirection.z);
    }

    const y = worldMap?.getElevation?.(this.position.x, this.position.z);
    if (Number.isFinite(y)) this.position.y = y + this.groundOffset;

    const diff = Math.atan2(
      Math.sin(this.targetRotationY - this.bodyGroup.rotation.y),
      Math.cos(this.targetRotationY - this.bodyGroup.rotation.y)
    );
    this.bodyGroup.rotation.y += diff * 14 * deltaTime;
    this.bodyGroup.position.copy(this.position);

    const w = Math.sin(time * 16), c = Math.cos(time * 16);
    this.torsoMesh.position.y = 1.1 + Math.abs(w) * 0.12 * this.walkWeight;
    this.bodyGroup.rotation.z = w * 0.06 * this.walkWeight;
    this.head.position.set(0, 1.9 + c * 0.06 * this.walkWeight + Math.sin(time * 2) * 0.015, 0);
    this.head.rotation.set(0, this.bodyGroup.rotation.y, -(w * 0.04 * this.walkWeight));
    this.leftLegPivot.rotation.x = w * 0.5 * this.walkWeight;
    this.rightLegPivot.rotation.x = -w * 0.5 * this.walkWeight;
    this.leftLegPivot.position.y = 0.65 + (w > 0 ? w * 0.12 * this.walkWeight : 0);
    this.rightLegPivot.position.y = 0.65 + (w < 0 ? -w * 0.12 * this.walkWeight : 0);
    this.leftArmPivot.rotation.x = -w * 0.4 * this.walkWeight;
    this.rightArmPivot.rotation.x = w * 0.4 * this.walkWeight;
    this.leftArmPivot.rotation.z = 0.15 + Math.abs(w) * 0.25 * this.walkWeight;
    this.rightArmPivot.rotation.z = -0.15 - Math.abs(w) * 0.25 * this.walkWeight;
  }
}
