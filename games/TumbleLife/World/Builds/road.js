import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Road {
  constructor(scene, x, z, width = 6, length = 100, y = 0, rotationY = 0) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.z = z;
    this.width = width;
    this.length = length;

    this.roadGroup = new THREE.Group();
    this.roadGroup.position.set(x, y, z);
    this.roadGroup.rotation.y = rotationY;
    scene.add(this.roadGroup);

    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.95,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 0,
      polygonOffsetUnits: 0,
    });
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const whiteLineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const yellowLineMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const roadGeo = new THREE.PlaneGeometry(width, length);
    const asphalt = new THREE.Mesh(roadGeo, asphaltMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.y = 0.01;
    asphalt.receiveShadow = true;
    this.roadGroup.add(asphalt);

    const shoulderWidth = 0.4;
    const shoulderGeo = new THREE.PlaneGeometry(shoulderWidth, length);

    const leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    leftShoulder.rotation.x = -Math.PI / 2;
    leftShoulder.position.set(-(width / 2) - shoulderWidth / 2, 0.005, 0);
    leftShoulder.receiveShadow = true;
    this.roadGroup.add(leftShoulder);

    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.x = (width / 2) + shoulderWidth / 2;
    this.roadGroup.add(rightShoulder);

    const lineThickness = 0.12;
    const sideLineGeo = new THREE.PlaneGeometry(lineThickness, length);
    const edgeOffset = 0.25;

    const leftLine = new THREE.Mesh(sideLineGeo, whiteLineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-(width / 2) + edgeOffset, 0.015, 0);
    this.roadGroup.add(leftLine);

    const rightLine = leftLine.clone();
    rightLine.position.x = (width / 2) - edgeOffset;
    this.roadGroup.add(rightLine);

    const dashWidth = 0.15;
    const dashLength = 2.0;
    const dashInterval = 4.0;
    const segments = Math.floor(length / dashInterval);
    const dashGeo = new THREE.PlaneGeometry(dashWidth, dashLength);

    this.centerDashes = new THREE.InstancedMesh(dashGeo, yellowLineMat, segments);
    const dummy = new THREE.Object3D();
    dummy.rotation.x = -Math.PI / 2;

    for (let i = 0; i < segments; i++) {
      const offsetZ = (i * dashInterval) - (length / 2) + (dashInterval / 2);
      dummy.position.set(0, 0.02, offsetZ);
      dummy.updateMatrix();
      this.centerDashes.setMatrixAt(i, dummy.matrix);
    }

    this.centerDashes.instanceMatrix.needsUpdate = true;
    this.roadGroup.add(this.centerDashes);
  }
}