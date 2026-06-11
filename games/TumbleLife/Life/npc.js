import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class NPC {
  constructor(scene, x, z) {
    this.meshGroup = new THREE.Group();
    this.meshGroup.position.set(x, 0, z);
    scene.add(this.meshGroup);

    this.position = new THREE.Vector3(x, 0, z);
    this.speed = 2.5;
    this.targetWaypoint = null;
    this.waypoints = [];
    this.changeTargetTime = 0;
    this.idleWeight = 0;

    // Random color
    const color = new THREE.Color().setHSL(Math.random() * 0.2 + 0.5, 0.6, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });

    // Body
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.4, 8, 16), mat);
    this.torso.castShadow = true;
    this.torso.position.y = 0.9;
    this.meshGroup.add(this.torso);

    // Head
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), mat);
    this.head.castShadow = true;
    this.head.position.y = 1.55;
    this.meshGroup.add(this.head);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eyeG = new THREE.SphereGeometry(0.06, 6, 6);
    const eye1 = new THREE.Mesh(eyeG, eyeMat);
    const eye2 = new THREE.Mesh(eyeG, eyeMat);
    eye1.position.set(0.12, 0.03, 0.28);
    eye2.position.set(-0.12, 0.03, 0.28);
    this.head.add(eye1);
    this.head.add(eye2);

    // Arms
    this.leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), mat);
    this.rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), mat);
    this.leftArm.position.set(0.4, 1.0, 0);
    this.rightArm.position.set(-0.4, 1.0, 0);
    this.meshGroup.add(this.leftArm);
    this.meshGroup.add(this.rightArm);

    // Legs
    this.leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), mat);
    this.rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), mat);
    this.leftLeg.position.set(0.15, 0.4, 0);
    this.rightLeg.position.set(-0.15, 0.4, 0);
    this.meshGroup.add(this.leftLeg);
    this.meshGroup.add(this.rightLeg);

    this.groundOffset = 0.25;
    this.wobbleTime = 0;
  }

  // Add waypoints for wandering
  setWaypoints(wpArray) {
    this.waypoints = wpArray;
    this.changeTargetWaypoint();
  }

  changeTargetWaypoint() {
    if (!this.waypoints.length) return;
    this.targetWaypoint = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
    this.changeTargetTime = Math.random() * 3 + 2;
  }

  snapToTerrain(worldMap) {
    const y = worldMap?.getElevation?.(this.position.x, this.position.z) ?? 0;
    this.position.y = y + this.groundOffset;
    this.meshGroup.position.copy(this.position);
  }

  update(deltaTime, time, worldMap) {
    this.wobbleTime += deltaTime * 8;

    // Decide if moving or idle
    const distToTarget = this.targetWaypoint ? 
      Math.hypot(this.position.x - this.targetWaypoint.x, this.position.z - this.targetWaypoint.z) : 
      Infinity;

    if (distToTarget < 1.5) {
      // Reached target, wait then pick new
      this.changeTargetTime -= deltaTime;
      if (this.changeTargetTime <= 0) {
        this.changeTargetWaypoint();
      }
      this.idleWeight = 1;
    } else {
      // Move toward target
      const dir = new THREE.Vector3();
      dir.subVectors(this.targetWaypoint, this.position);
      dir.y = 0;
      dir.normalize();

      this.position.addScaledVector(dir, this.speed * deltaTime);
      this.meshGroup.rotation.y = Math.atan2(dir.x, dir.z);
      this.idleWeight = 0;
    }

    this.snapToTerrain(worldMap);

    // Walking animation
    const walkAmount = (1 - this.idleWeight) * 0.5;
    const w = Math.sin(this.wobbleTime) * walkAmount;
    const c = Math.cos(this.wobbleTime) * walkAmount;

    this.torso.position.y = 0.9 + Math.abs(w) * 0.08;
    this.meshGroup.rotation.z = w * 0.05;
    this.head.position.y = 1.55 + c * 0.04;
    this.leftLeg.rotation.x = w * 0.6;
    this.rightLeg.rotation.x = -w * 0.6;
    this.leftArm.rotation.x = -w * 0.4;
    this.rightArm.rotation.x = w * 0.4;
  }

  punch() {
    // Quick punch animation
    this.rightArm.rotation.x = -1.5;
    setTimeout(() => {
      this.rightArm.rotation.x = 0;
    }, 200);
  }

  destroy() {
    scene.remove(this.meshGroup);
  }
}
