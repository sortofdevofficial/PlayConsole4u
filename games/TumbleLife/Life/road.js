import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Road {
  constructor(scene, worldMap, points = []) {
    this.scene = scene;
    this.worldMap = worldMap;
    this.points = points.length ? points : [
      new THREE.Vector3(-80, 0, -50),
      new THREE.Vector3(-45, 0, -35),
      new THREE.Vector3(-10, 0, -18),
      new THREE.Vector3(18, 0, 2),
      new THREE.Vector3(48, 0, 24),
      new THREE.Vector3(82, 0, 52),
    ];
    this.width = 5.2;
    this.lift = 0.18;
    this.samples = 90;
    this.flattenRadius = this.width * 0.6;
    this.flattenFalloff = this.width * 1.9;
    this.mesh = this.build();
    scene.add(this.mesh);
  }

  samplePath() {
    const pts = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      for (let s = 0; s < this.samples; s++) {
        const t = s / this.samples;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        p.y = this.worldMap.getElevation(p.x, p.z);
        pts.push(p);
      }
    }
    const last = this.points[this.points.length - 1].clone();
    last.y = this.worldMap.getElevation(last.x, last.z);
    pts.push(last);
    return pts;
  }

  build() {
    const center = this.samplePath();
    const half = this.width * 0.5;
    const up = new THREE.Vector3(0, 1, 0);

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < center.length; i++) {
      const prev = center[Math.max(i - 1, 0)];
      const curr = center[i];
      const next = center[Math.min(i + 1, center.length - 1)];

      const dir = new THREE.Vector3().subVectors(next, prev);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();

      const side = new THREE.Vector3().crossVectors(up, dir).normalize();

      const left = curr.clone().addScaledVector(side, -half);
      const right = curr.clone().addScaledVector(side, half);

      positions.push(left.x, left.y + this.lift, left.z);
      positions.push(right.x, right.y + this.lift, right.z);

      normals.push(0, 1, 0, 0, 1, 0);

      const v = i / Math.max(center.length - 1, 1);
      uvs.push(0, v * 10, 1, v * 10);
    }

    for (let i = 0; i < center.length - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2b2b2b,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  flattenTerrain() {
    const pos = this.worldMap.groundGeo?.attributes?.position;
    if (!pos) return;

    const center = this.samplePath();
    const inner = this.flattenRadius;
    const outer = this.flattenFalloff;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = -pos.getY(i);

      let bestD = Infinity;
      let bestY = 0;

      for (let j = 0; j < center.length - 1; j++) {
        const a = center[j];
        const b = center[j + 1];
        const vx = b.x - a.x;
        const vz = b.z - a.z;
        const len2 = vx * vx + vz * vz || 1;

        let t = ((x - a.x) * vx + (z - a.z) * vz) / len2;
        t = THREE.MathUtils.clamp(t, 0, 1);

        const px = a.x + vx * t;
        const pz = a.z + vz * t;
        const py = a.y + (b.y - a.y) * t;
        const d = Math.hypot(x - px, z - pz);

        if (d < bestD) {
          bestD = d;
          bestY = py;
        }
      }

      if (bestD < outer) {
        const t = THREE.MathUtils.clamp((bestD - inner) / (outer - inner), 0, 1);
        const w = 1 - t * t * (3 - 2 * t);
        const base = this.worldMap.constructor.getElevation(x, z);
        const target = bestY - 0.06;
        pos.setZ(i, base + (target - base) * w);
      }
    }

    pos.needsUpdate = true;
    this.worldMap.groundGeo.computeVertexNormals();
  }
}