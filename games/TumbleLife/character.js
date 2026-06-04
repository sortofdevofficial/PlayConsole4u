import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class WobblyCharacter {
  constructor(scene) {
    this.targetRotationY = 0;
    this.walkWeight = 0;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.6,
      metalness: 0.1
    });

    this.bodyGroup = new THREE.Group();
    scene.add(this.bodyGroup);

    const torsoGeom = new THREE.CapsuleGeometry(0.52, 0.45, 10, 20);
    this.torsoMesh = new THREE.Mesh(torsoGeom, mat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.position.y = 0.5;
    this.bodyGroup.add(this.torsoMesh);

    const armGeom = new THREE.CapsuleGeometry(0.18, 0.68, 6, 12);
    const legGeom = new THREE.CapsuleGeometry(0.16, 0.45, 6, 12);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(0.42, 0.75, 0);
    this.bodyGroup.add(this.leftArmPivot);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(-0.42, 0.75, 0);
    this.bodyGroup.add(this.rightArmPivot);

    const lArm = new THREE.Mesh(armGeom, mat);
    lArm.position.y = -0.34;
    lArm.castShadow = true;
    this.leftArmPivot.add(lArm);

    const rArm = new THREE.Mesh(armGeom, mat);
    rArm.position.y = -0.34;
    rArm.castShadow = true;
    this.rightArmPivot.add(rArm);

    this.leftLeg = new THREE.Mesh(legGeom, mat);
    this.leftLeg.position.set(0.22, -0.1, 0);
    this.leftLeg.castShadow = true;
    this.bodyGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, mat);
    this.rightLeg.position.set(-0.22, -0.1, 0);
    this.rightLeg.castShadow = true;
    this.bodyGroup.add(this.rightLeg);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 20), mat);
    this.head.castShadow = true;
    scene.add(this.head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eyeG = new THREE.SphereGeometry(0.1, 10, 10);

    const lEye = new THREE.Mesh(eyeG, eyeMat);
    lEye.position.set(0.22, 0.05, 0.7);
    this.head.add(lEye);

    const rEye = new THREE.Mesh(eyeG, eyeMat);
    rEye.position.set(-0.22, 0.05, 0.7);
    this.head.add(rEye);
  }
}