import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Bamborghini {
  constructor(scene, x, z) {
    this.meshGroup = new THREE.Group();
    this.meshGroup.position.set(x, 0, z);
    scene.add(this.meshGroup);

    this.speed = 0;
    this.steer = 0;
    this.angle = 0;
    this.maxSpeed = 16.0;
    this.reverseMaxSpeed = -5.0;
    this.acceleration = 12.0;
    this.braking = 20.0;
    this.friction = 0.96;
    this.steeringSpeed = 2.2;
    this.width = 2.7;
    this.length = 5.4;
    this.radius = 2.5;

    this.groundOffset = 0.38;

    const W = this.width, L = this.length, WR = 0.44;
    const BY = 0.15, BH = 0.65, CY = BY + BH, CH = 0.95;
    const CAB_L = L * 0.55, CAB_W = W - 0.16, CAB_Z = -L * 0.02;

    const red = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.3, metalness: 0.4 });
    const redDk = new THREE.MeshStandardMaterial({ color: 0x9b1c1c, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.6 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x00a8ff, roughness: 0.02, opacity: 0.5, transparent: true });
    const tireM = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 });
    const rimM = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.8 });
    const lightM = new THREE.MeshBasicMaterial({ color: 0xfffee0 });
    const brakeM = new THREE.MeshBasicMaterial({ color: 0xe63946 });

    const add = (geo, mat, px, py, pz) => {
      const o = new THREE.Mesh(geo, mat);
      o.position.set(px, py, pz);
      o.castShadow = true;
      o.receiveShadow = true;
      this.meshGroup.add(o);
      return o;
    };

    add(new THREE.BoxGeometry(W, BH, L), red, 0, BY + BH / 2, 0);

    const nose = add(new THREE.BoxGeometry(W - 0.05, 0.2, L * 0.35), red, 0, BY + BH, L * 0.25);
    nose.rotation.x = -0.15;

    add(new THREE.BoxGeometry(CAB_W, CH, CAB_L), glassM, 0, CY + CH / 2, CAB_Z);
    add(new THREE.BoxGeometry(CAB_W - 0.1, 0.04, CAB_L - 0.1), redDk, 0, CY + CH + 0.01, CAB_Z);

    const wf = add(new THREE.BoxGeometry(CAB_W - 0.02, 1.1, 0.02), glassM, 0, CY + 0.45, CAB_Z + CAB_L / 2 - 0.2);
    wf.rotation.x = 0.75;
    const wr = add(new THREE.BoxGeometry(CAB_W - 0.02, 0.95, 0.02), glassM, 0, CY + 0.4, CAB_Z - CAB_L / 2 + 0.18);
    wr.rotation.x = -0.65;

    add(new THREE.BoxGeometry(W + 0.08, 0.12, 0.4), dark, 0, BY + 0.06, L / 2 + 0.08);
    add(new THREE.BoxGeometry(W + 0.04, 0.06, 0.35), dark, 0, CY + CH + 0.1, -L / 2 + 0.15);

    add(new THREE.BoxGeometry(0.4, 0.06, 0.04), lightM, W / 2 - 0.28, BY + BH - 0.04, L / 2 + 0.01);
    add(new THREE.BoxGeometry(0.4, 0.06, 0.04), lightM, -W / 2 + 0.28, BY + BH - 0.04, L / 2 + 0.01);
    add(new THREE.BoxGeometry(0.5, 0.04, 0.04), brakeM, W / 2 - 0.32, BY + BH - 0.04, -L / 2 - 0.01);
    add(new THREE.BoxGeometry(0.5, 0.04, 0.04), brakeM, -W / 2 + 0.32, BY + BH - 0.04, -L / 2 - 0.01);

    [-1, 1].forEach(s => {
      add(new THREE.BoxGeometry(0.2, 0.04, 0.04), dark, s * (W / 2 + 0.06), CY + 0.3, CAB_Z + CAB_L / 2 - 0.1);
      add(new THREE.BoxGeometry(0.26, 0.16, 0.14), red, s * (W / 2 + 0.2), CY + 0.3, CAB_Z + CAB_L / 2 - 0.1);
    });

    const tireGeo = new THREE.CylinderGeometry(WR, WR, 0.42, 8);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(WR * 0.6, WR * 0.6, 0.44, 8);
    rimGeo.rotateZ(Math.PI / 2);

    this.wheels = [];
    this.wheelSpinPivots = [];
    const WB = L * 0.31;

    [
      { x: W / 2 + 0.02, z: WB, f: true },
      { x: -W / 2 - 0.02, z: WB, f: true },
      { x: W / 2 + 0.02, z: -WB, f: false },
      { x: -W / 2 - 0.02, z: -WB, f: false }
    ].forEach(wp => {
      const asm = new THREE.Group();
      asm.position.set(wp.x, WR, wp.z);
      asm.userData = { isFront: wp.f };
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo, tireM));
      spin.add(new THREE.Mesh(rimGeo, rimM));
      asm.add(spin);
      this.meshGroup.add(asm);
      this.wheels.push(asm);
      this.wheelSpinPivots.push(spin);
    });
  }

  snapToTerrain(worldMap) {
    const y = worldMap?.getElevation?.(this.meshGroup.position.x, this.meshGroup.position.z) ?? 0;
    this.meshGroup.position.y = y + this.groundOffset;
  }

  getGroundContactOffset() {
    return this.groundOffset;
  }
}