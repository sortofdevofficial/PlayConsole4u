import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Per-face color: ONE base green per layer, tiny brightness variation between faces
function paintCone(geo, baseColor) {
  const base   = new THREE.Color(baseColor);
  const pos    = geo.attributes.position;
  const count  = pos.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 3) {
    // Nudge brightness ±6% only — subtle, not random loud color jumps
    const nudge = 0.94 + Math.random() * 0.12;
    for (let j = 0; j < 3; j++) {
      colors[(i+j)*3]     = base.r * nudge;
      colors[(i+j)*3 + 1] = base.g * nudge;
      colors[(i+j)*3 + 2] = base.b * nudge;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

const trunkGeo = new THREE.CylinderGeometry(0.45, 0.72, 3.8, 6, 1);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2008, roughness: 1.0, flatShading: true });

// Each layer has one carefully chosen dark-to-mid green — faces vary WITHIN that shade
const layerDefs = [
  { geo: paintCone(new THREE.ConeGeometry(7.5, 4.5, 7).toNonIndexed(), 0x1a5220), y: 5.0  },
  { geo: paintCone(new THREE.ConeGeometry(6.8, 4.2, 7).toNonIndexed(), 0x1c5a22), y: 7.8  },
  { geo: paintCone(new THREE.ConeGeometry(6.0, 4.0, 7).toNonIndexed(), 0x1e6224), y: 10.2 },
  { geo: paintCone(new THREE.ConeGeometry(5.0, 3.8, 7).toNonIndexed(), 0x226826), y: 12.4 },
  { geo: paintCone(new THREE.ConeGeometry(4.0, 3.5, 7).toNonIndexed(), 0x256e28), y: 14.2 },
  { geo: paintCone(new THREE.ConeGeometry(3.0, 3.2, 7).toNonIndexed(), 0x28742a), y: 15.8 },
  { geo: paintCone(new THREE.ConeGeometry(1.8, 2.8, 7).toNonIndexed(), 0x2c7a2e), y: 17.0 },
];
layerDefs.forEach(l => l.geo.computeVertexNormals());

const foliageMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  flatShading: true,
});

const _m  = new THREE.Matrix4(), _lm = new THREE.Matrix4(), _cm = new THREE.Matrix4();
const _p  = new THREE.Vector3(), _q  = new THREE.Quaternion(), _s  = new THREE.Vector3(), _e  = new THREE.Euler();
const _pl = new THREE.Vector3(), _ql = new THREE.Quaternion(), _sl = new THREE.Vector3(), _el = new THREE.Euler();

export class Tree {
  static instances   = [];
  static initialized = false;
  static imTrunk     = null;
  static imLayers    = [];
  static lastFrame   = -1;

  static reset() {
    Tree.instances = []; Tree.initialized = false;
    Tree.imTrunk = null; Tree.imLayers = []; Tree.lastFrame = -1;
  }

  constructor(scene, x, z, scale = 1) {
    this.scene        = scene;
    this.x            = x;
    this.z            = z;
    this.targetScale  = scale;
    this.currentScale = 0;
    this.radius       = 0.5;
    this.rotY         = Math.random() * Math.PI * 2;
    this.trunkPhase   = Math.random() * Math.PI * 2;
    this.trunkSpeed   = 0.45 + Math.random() * 0.2;
    this.layerPhase   = layerDefs.map((_, i) => Math.random() * Math.PI * 2 + i * 0.9);
    this.index        = Tree.instances.length;
    Tree.instances.push(this);
  }

  static initVisuals(scene) {
    const n = Tree.instances.length;
    if (!n) return;
    Tree.imTrunk  = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    Tree.imLayers = layerDefs.map(d => new THREE.InstancedMesh(d.geo, foliageMat, n));
    Tree.imTrunk.castShadow = Tree.imTrunk.receiveShadow = true;
    Tree.imLayers.forEach(im => { im.castShadow = im.receiveShadow = true; scene.add(im); });
    scene.add(Tree.imTrunk);
    Tree.initialized = true;
  }

  update(time) {
    if (!Tree.initialized) Tree.initVisuals(this.scene);

    if (this.currentScale < this.targetScale) {
      this.currentScale += (this.targetScale - this.currentScale) * 8 * 0.016;
      if (this.targetScale - this.currentScale < 0.005) this.currentScale = this.targetScale;
    }

    const idx = this.index;
    const tsx = Math.sin(time * this.trunkSpeed + this.trunkPhase) * 0.007;
    const tsz = Math.cos(time * this.trunkSpeed * 0.8 + this.trunkPhase) * 0.005;
    _p.set(this.x, 0, this.z);
    _q.setFromEuler(_e.set(tsx, this.rotY, tsz));
    _s.setScalar(this.currentScale);
    _m.compose(_p, _q, _s);

    _lm.makeTranslation(0, 1.9, 0);
    Tree.imTrunk.setMatrixAt(idx, _cm.multiplyMatrices(_m, _lm));

    for (let i = 0; i < layerDefs.length; i++) {
      const ph     = this.layerPhase[i];
      const swingX = Math.sin(time * 0.85 + ph) * (0.005 + i * 0.001);
      const swingZ = Math.cos(time * 0.7  + ph + 0.8) * (0.004 + i * 0.0008);
      _pl.set(0, layerDefs[i].y, 0);
      _ql.setFromEuler(_el.set(swingX, this.rotY, swingZ));
      _sl.set(1, 1, 1);
      _lm.compose(_pl, _ql, _sl);
      Tree.imLayers[i].setMatrixAt(idx, _cm.multiplyMatrices(_m, _lm));
    }

    if (Tree.lastFrame !== time) {
      Tree.lastFrame = time;
      Tree.imTrunk.instanceMatrix.needsUpdate = true;
      Tree.imLayers.forEach(im => { im.instanceMatrix.needsUpdate = true; });
    }
  }
}