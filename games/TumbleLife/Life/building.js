import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Shared materials across ALL buildings — avoids creating new materials per
// instance (big GPU state-change cost). Opaque glass (no transparent:true)
// is dramatically cheaper to render than blended transparency.
const _concrete     = new THREE.MeshStandardMaterial({ color: 0x938b80, roughness: 0.94 });
const _concreteDark = new THREE.MeshStandardMaterial({ color: 0x4f4a45, roughness: 0.98 });
const _glass        = new THREE.MeshStandardMaterial({ color: 0x3d5563, roughness: 0.15, metalness: 0.3 });
const _roofMat      = new THREE.MeshStandardMaterial({ color: 0x5d5853, roughness: 1.0 });
const _trimMat      = new THREE.MeshStandardMaterial({ color: 0x6f665d, roughness: 0.85 });
const _acMat        = new THREE.MeshStandardMaterial({ color: 0x7b8084, roughness: 0.92 });
const _darkMet       = new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.7, metalness: 0.35 });

export class Building {
  constructor(scene, worldMap, x, z, opts = {}) {
    this.x = x;
    this.z = z;
    this.width  = opts.width  ?? 12;
    this.depth  = opts.depth  ?? 12;
    this.height = opts.height ?? 28;
    this.radius = Math.max(this.width, this.depth) * 0.6;

    const gy = worldMap.getElevation(x, z);
    const g = new THREE.Group();
    g.position.set(x, gy, z);

    this._build(g);
    scene.add(g);
    this.mesh = g;
  }

  _build(g) {
    const W = this.width, D = this.depth, H = this.height;

    const mesh = (geo, mat, px=0, py=0, pz=0, rx=0, ry=0, rz=0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // Main body
    mesh(new THREE.BoxGeometry(W, H, D), _concrete, 0, H/2, 0);

    // Floor bands — capped at 12 so very tall buildings don't explode triangle count
    const floorH = 3.5;
    const floors = Math.min(Math.floor(H/floorH), 12);
    for (let f=1; f<floors; f++) mesh(new THREE.BoxGeometry(W+0.3, 0.18, D+0.3), _trimMat, 0, f*floorH, 0);

    // Windows — single shared glass geometry, merged into ONE BufferGeometry
    // per building via merge instead of dozens of separate Mesh objects.
    const cols = Math.max(2, Math.round(W/2.8));
    const colStep = W/(cols+1);
    const wW = colStep*0.62, wH = floorH*0.52;
    const sideC = Math.max(2, Math.round(D/2.8));
    const sideStep = D/(sideC+1);
    const sWW = sideStep*0.62;

    const winGeoFront = new THREE.BoxGeometry(wW, wH, 0.12);
    const winGeoSide  = new THREE.BoxGeometry(0.12, wH, sWW);
    const frontMatrices = [];
    const sideMatrices  = [];
    const _m = new THREE.Matrix4();

    for (let f=0; f<floors; f++) {
      const wy = f*floorH + floorH*0.5;
      for (let c=1; c<=cols; c++) {
        const wx = -W/2 + c*colStep;
        frontMatrices.push(_m.clone().makeTranslation(wx, wy, D/2+0.07));
        frontMatrices.push(_m.clone().makeTranslation(wx, wy, -D/2-0.07));
      }
      for (let c=1; c<=sideC; c++) {
        const wz = -D/2 + c*sideStep;
        sideMatrices.push(_m.clone().makeTranslation(W/2+0.07, wy, wz));
        sideMatrices.push(_m.clone().makeTranslation(-W/2-0.07, wy, wz));
      }
    }

    // InstancedMesh for windows = 2 draw calls total instead of 1 per window
    if (frontMatrices.length) {
      const im = new THREE.InstancedMesh(winGeoFront, _glass, frontMatrices.length);
      frontMatrices.forEach((m,i) => im.setMatrixAt(i, m));
      im.castShadow = false; im.receiveShadow = true;
      g.add(im);
    }
    if (sideMatrices.length) {
      const im = new THREE.InstancedMesh(winGeoSide, _glass, sideMatrices.length);
      sideMatrices.forEach((m,i) => im.setMatrixAt(i, m));
      im.castShadow = false; im.receiveShadow = true;
      g.add(im);
    }

    // Corner pillars
    const pW = 0.55;
    for (const sx of [-1,1]) for (const sz of [-1,1]) {
      mesh(new THREE.BoxGeometry(pW,H,pW), _concreteDark, sx*(W/2-pW/2+0.01), H/2, sz*(D/2-pW/2+0.01));
    }
    mesh(new THREE.BoxGeometry(pW,H,pW), _concreteDark, 0, H/2,  D/2-pW/2+0.01);
    mesh(new THREE.BoxGeometry(pW,H,pW), _concreteDark, 0, H/2, -D/2+pW/2-0.01);

    // Base + entrance
    mesh(new THREE.BoxGeometry(W+0.1, 1.8, D+0.1), _concreteDark, 0, 0.9, 0);
    mesh(new THREE.BoxGeometry(W*0.38, 3.2, 0.18), _darkMet, 0, 1.6, D/2+0.1);

    // Roof + parapet
    mesh(new THREE.BoxGeometry(W+0.5, 0.55, D+0.5), _roofMat, 0, H+0.28, 0);
    mesh(new THREE.BoxGeometry(W+0.5, 0.9, 0.3), _trimMat, 0, H+0.85,  D/2+0.1);
    mesh(new THREE.BoxGeometry(W+0.5, 0.9, 0.3), _trimMat, 0, H+0.85, -D/2-0.1);
    mesh(new THREE.BoxGeometry(0.3, 0.9, D+0.5), _trimMat,  W/2+0.1, H+0.85, 0);
    mesh(new THREE.BoxGeometry(0.3, 0.9, D+0.5), _trimMat, -W/2-0.1, H+0.85, 0);

    // AC units (capped count)
    const acCount = Math.min(Math.max(1, Math.floor(W/5)), 4);
    for (let i=0; i<acCount; i++) {
      const ax = -W/2 + 2 + i*(W/acCount);
      mesh(new THREE.BoxGeometry(2.2,1.1,1.4), _acMat, ax, H+1.1, -D/2+2);
      mesh(new THREE.BoxGeometry(2.0,0.6,0.12), _darkMet, ax, H+0.85, -D/2+1.36);
    }

    if (H > 20) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.2,8), _acMat);
      tank.position.set(W/2-2, H+1.65, D/2-2);
      tank.castShadow = true; tank.receiveShadow = true;
      g.add(tank);
      for (const [lx,lz] of [[-0.7,-0.7],[0.7,-0.7],[-0.7,0.7],[0.7,0.7]])
        mesh(new THREE.BoxGeometry(0.12,0.9,0.12), _concreteDark, W/2-2+lx, H+0.2, D/2-2+lz);
    }

    mesh(new THREE.BoxGeometry(2.8,2.5,2.8), _concreteDark, -W/2+2, H+1.8, D/2-2);
  }

  getBounds() { return new THREE.Box3().setFromObject(this.mesh); }
}