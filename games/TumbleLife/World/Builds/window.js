import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class WindowAssembly {
  constructor() {
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.03,
      metalness: 0.02,
      transparent: true,
      opacity: 0.45,
      flatShading: true
    });
    this.trimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.08,
      flatShading: true
    });
  }

  createPanel(w, h, d = 0.06) {
    const g = new THREE.Group();

    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, d + 0.03), this.trimMat);
    trim.position.z = -0.02;
    trim.castShadow = true;
    trim.receiveShadow = true;
    g.add(trim);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.glassMat);
    glass.position.z = 0.02;
    glass.castShadow = true;
    glass.receiveShadow = true;
    g.add(glass);

    return g;
  }

  createFrontWindshield(w, h) {
    const g = this.createPanel(w, h, 0.05);
    g.rotation.x = -0.32;
    return g;
  }

  createRearWindshield(w, h) {
    const g = this.createPanel(w, h, 0.05);
    g.rotation.x = 0.32;
    return g;
  }
}