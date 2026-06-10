import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Building {
  constructor(scene, worldMap, x, z, opts = {}) {
    this.x = x;
    this.z = z;
    this.width = opts.width ?? 12;
    this.depth = opts.depth ?? 12;
    this.height = opts.height ?? 28;
    this.radius = Math.max(this.width, this.depth) * 0.6;

    const gy = worldMap.getElevation(x, z);
    const g = new THREE.Group();
    g.position.set(x, gy, z);

    this._build(g);
    scene.add(g);
    this.mesh = g;
  }

  shade(base, amt) {
    const c = new THREE.Color(base);
    c.offsetHSL(0, 0, amt);
    return c.getHex();
  }

  pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  _build(g) {
    const W = this.width, D = this.depth, H = this.height;

    const concrete = new THREE.MeshStandardMaterial({
      color: this.pick([0xa7a196, 0x938b80, 0x81796f]),
      roughness: 0.94,
      metalness: 0.0
    });

    const concreteDark = new THREE.MeshStandardMaterial({
      color: this.pick([0x615b55, 0x4f4a45, 0x726c65]),
      roughness: 0.98,
      metalness: 0.0
    });

    const glass = new THREE.MeshStandardMaterial({
      color: this.pick([0x4d6677, 0x385261, 0x2f4450]),
      roughness: 0.08,
      metalness: 0.35,
      envMapIntensity: 0.9
    });

    const glassDirty = new THREE.MeshStandardMaterial({
      color: this.pick([0x3d5563, 0x314553, 0x2a3d48]),
      roughness: 0.2,
      metalness: 0.25
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: this.pick([0x4d4a47, 0x5d5853, 0x6e665d]),
      roughness: 1.0,
      metalness: 0.0
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: this.pick([0x7b7268, 0x6f665d, 0x8b8176]),
      roughness: 0.85,
      metalness: 0.0
    });

    const acMat = new THREE.MeshStandardMaterial({
      color: this.pick([0x8c8f92, 0x7b8084, 0x6f7378]),
      roughness: 0.92,
      metalness: 0.0
    });

    const darkMet = new THREE.MeshStandardMaterial({
      color: this.pick([0x2a2e33, 0x1f2328, 0x34383d]),
      roughness: 0.7,
      metalness: 0.35
    });

    const mesh = (geo, mat, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };

    mesh(new THREE.BoxGeometry(W, H, D), concrete, 0, H / 2, 0);

    const floorH = 3.5;
    const floors = Math.floor(H / floorH);

    for (let f = 1; f < floors; f++) {
      const bandY = f * floorH;
      mesh(new THREE.BoxGeometry(W + 0.3, 0.18, D + 0.3), trimMat, 0, bandY, 0);
    }

    const cols = Math.max(2, Math.round(W / 2.8));
    const colStep = W / (cols + 1);
    const wW = colStep * 0.62;
    const wH = floorH * 0.52;

    for (let f = 0; f < floors; f++) {
      const wy = f * floorH + floorH * 0.5;
      const mat = Math.random() > 0.18 ? glass : glassDirty;

      for (let c = 1; c <= cols; c++) {
        const wx = -W / 2 + c * colStep;
        mesh(new THREE.BoxGeometry(wW, wH, 0.12), mat, wx, wy, D / 2 + 0.07);
        mesh(new THREE.BoxGeometry(wW, wH, 0.12), mat, wx, wy, -D / 2 - 0.07);
      }

      const sideC = Math.max(2, Math.round(D / 2.8));
      const sideStep = D / (sideC + 1);
      const sWW = sideStep * 0.62;

      for (let c = 1; c <= sideC; c++) {
        const wz = -D / 2 + c * sideStep;
        mesh(new THREE.BoxGeometry(0.12, wH, sWW), mat, W / 2 + 0.07, wy, wz);
        mesh(new THREE.BoxGeometry(0.12, wH, sWW), mat, -W / 2 - 0.07, wy, wz);
      }
    }

    const pW = 0.55;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mesh(new THREE.BoxGeometry(pW, H, pW), concreteDark, sx * (W / 2 - pW / 2 + 0.01), H / 2, sz * (D / 2 - pW / 2 + 0.01));
    }

    mesh(new THREE.BoxGeometry(pW, H, pW), concreteDark, 0, H / 2, D / 2 - pW / 2 + 0.01);
    mesh(new THREE.BoxGeometry(pW, H, pW), concreteDark, 0, H / 2, -D / 2 + pW / 2 - 0.01);

    mesh(new THREE.BoxGeometry(W + 0.1, 1.8, D + 0.1), concreteDark, 0, 0.9, 0);
    mesh(new THREE.BoxGeometry(W * 0.38, 3.2, 0.18), darkMet, 0, 1.6, D / 2 + 0.1);

    mesh(new THREE.BoxGeometry(W + 0.5, 0.55, D + 0.5), roofMat, 0, H + 0.28, 0);
    mesh(new THREE.BoxGeometry(W + 0.5, 0.9, 0.3), trimMat, 0, H + 0.85, D / 2 + 0.1);
    mesh(new THREE.BoxGeometry(W + 0.5, 0.9, 0.3), trimMat, 0, H + 0.85, -D / 2 - 0.1);
    mesh(new THREE.BoxGeometry(0.3, 0.9, D + 0.5), trimMat, W / 2 + 0.1, H + 0.85, 0);
    mesh(new THREE.BoxGeometry(0.3, 0.9, D + 0.5), trimMat, -W / 2 - 0.1, H + 0.85, 0);

    const acCount = Math.max(1, Math.floor(W / 5));
    for (let i = 0; i < acCount; i++) {
      const ax = -W / 2 + 2 + i * (W / acCount);
      mesh(new THREE.BoxGeometry(2.2, 1.1, 1.4), acMat, ax, H + 1.1, -D / 2 + 2);
      mesh(new THREE.BoxGeometry(2.0, 0.6, 0.12), darkMet, ax, H + 0.85, -D / 2 + 1.36);
    }

    if (H > 20) {
      const cyl = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 8);
      const tank = new THREE.Mesh(cyl, acMat);
      tank.position.set(W / 2 - 2, H + 1.65, D / 2 - 2);
      tank.castShadow = true;
      tank.receiveShadow = true;
      g.add(tank);

      for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
        mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), concreteDark, W / 2 - 2 + lx, H + 0.2, D / 2 - 2 + lz);
      }
    }

    mesh(new THREE.BoxGeometry(2.8, 2.5, 2.8), concreteDark, -W / 2 + 2, H + 1.8, D / 2 - 2);
  }

  getBounds() {
    return new THREE.Box3().setFromObject(this.mesh);
  }
}