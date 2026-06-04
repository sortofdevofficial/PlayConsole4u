import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class BasculeBridge {
  constructor(scene, x, y, z, width = 12.0, length = 26.0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.width = width;
    this.length = length;
    this.pierLength = 12.0;

    this.meshGroup = new THREE.Group();
    this.meshGroup.position.set(x, y, z);
    scene.add(this.meshGroup);

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.85,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.5,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.4,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const pierH = 12.0;
    const leafLen = length / 2;

    const addPier = localZ => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, pierH, this.pierLength), concreteMat);
      p.position.set(0, -pierH / 2, localZ);
      p.castShadow = true;
      p.receiveShadow = true;
      this.meshGroup.add(p);
    };
    addPier(-length / 2 - this.pierLength / 2);
    addPier(length / 2 + this.pierLength / 2);

    this.northLeafPivot = new THREE.Group();
    this.northLeafPivot.position.set(0, 0, -length / 2);
    this.meshGroup.add(this.northLeafPivot);

    const northDeck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, leafLen), roadMat);
    northDeck.position.set(0, -0.25, leafLen / 2);
    northDeck.castShadow = true;
    northDeck.receiveShadow = true;
    this.northLeafPivot.add(northDeck);

    const railGeo = new THREE.BoxGeometry(0.15, 0.9, leafLen);
    const nRL = new THREE.Mesh(railGeo, railMat);
    nRL.position.set(width / 2 - 0.08, 0.45, leafLen / 2);
    this.northLeafPivot.add(nRL);

    const nRR = new THREE.Mesh(railGeo, railMat);
    nRR.position.set(-width / 2 + 0.08, 0.45, leafLen / 2);
    this.northLeafPivot.add(nRR);

    const nRamp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 1.2), rampMat);
    nRamp.position.set(0, -0.21, leafLen);
    this.northLeafPivot.add(nRamp);

    this.southLeafPivot = new THREE.Group();
    this.southLeafPivot.position.set(0, 0, length / 2);
    this.meshGroup.add(this.southLeafPivot);

    const southDeck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, leafLen), roadMat);
    southDeck.position.set(0, -0.25, -leafLen / 2);
    southDeck.castShadow = true;
    southDeck.receiveShadow = true;
    this.southLeafPivot.add(southDeck);

    const sRL = new THREE.Mesh(railGeo, railMat);
    sRL.position.set(width / 2 - 0.08, 0.45, -leafLen / 2);
    this.southLeafPivot.add(sRL);

    const sRR = new THREE.Mesh(railGeo, railMat);
    sRR.position.set(-width / 2 + 0.08, 0.45, -leafLen / 2);
    this.southLeafPivot.add(sRR);

    const sRamp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 1.2), rampMat);
    sRamp.position.set(0, -0.21, -leafLen);
    this.southLeafPivot.add(sRamp);

    const lipGeo = new THREE.BoxGeometry(width, 0.52, 0.22);
    const nLip = new THREE.Mesh(lipGeo, yellowMat);
    nLip.position.set(0, -0.01, leafLen);
    this.northLeafPivot.add(nLip);

    const sLip = new THREE.Mesh(lipGeo, yellowMat);
    sLip.position.set(0, -0.01, -leafLen);
    this.southLeafPivot.add(sLip);

    const gapFill = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.35), rampMat);
    gapFill.position.set(0, -0.22, 0);
    this.meshGroup.add(gapFill);

    this.time = 0;
    this.angle = 0;
    this.maxAngle = Math.PI / 4.0;
  }

  isSafe() {
    return this.angle < 0.05;
  }
}