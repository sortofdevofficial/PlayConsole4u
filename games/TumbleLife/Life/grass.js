import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

function buildBladeGeo() {
  const geo = new THREE.PlaneGeometry(0.22, 0.8, 1, 3);
  geo.translate(0, 0.4, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 0.8;
    pos.setX(i, pos.getX(i) * Math.pow(1 - t, 0.8));
    pos.setZ(i, pos.getZ(i) + Math.pow(t, 2.5) * 0.28);
  }
  geo.computeVertexNormals();

  const cnt = pos.count;
  const colors = new Float32Array(cnt * 3);
  const rootC = new THREE.Color(0x2c5412), midC = new THREE.Color(0x4a7d25), tipC = new THREE.Color(0x9ed44a);
  for (let i = 0; i < cnt; i++) {
    const t = Math.max(0, pos.getY(i)) / 0.8;
    const c = t < 0.5 ? rootC.clone().lerp(midC, t * 2) : midC.clone().lerp(tipC, (t - 0.5) * 2);
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

const _geo = buildBladeGeo();
const _mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

let _instances = [], _mesh = null, _scene = null, _lastTime = -1;

export class Grass {
  static reset(scene) {
    if (_mesh) { scene.remove(_mesh); _mesh = null; }
    _instances = []; _scene = scene; _lastTime = -1;
  }

  static build() {
    if (!_instances.length || !_scene) return;
    _mesh = new THREE.InstancedMesh(_geo, _mat, _instances.length);
    _mesh.castShadow = false; _mesh.receiveShadow = true; _mesh.frustumCulled = false;
    _scene.add(_mesh);
  }

  constructor(scene, x, z, scale = 1) {
    _scene = scene;
    this.x = x; this.z = z;
    this.targetScale  = scale * (0.8 + Math.random() * 0.45);
    this.currentScale = 0;
    this.rotY  = Math.random() * Math.PI * 2;
    this.speed = 1.4 + Math.random() * 0.9;
    this.phase = Math.random() * Math.PI * 2;
    this.bendX = 0; this.bendZ = 0;
    this.index = _instances.length;
    _instances.push(this);
  }

  update(time, playerPos = null) {
    if (!_mesh) Grass.build();
    if (!_mesh) return;

    if (this.currentScale < this.targetScale) {
      this.currentScale += (this.targetScale - this.currentScale) * 0.1;
      if (this.targetScale - this.currentScale < 0.003) this.currentScale = this.targetScale;
    }

    let tX = 0, tZ = 0;
    if (playerPos) {
      const dx = this.x - playerPos.x, dz = this.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 2.56) {
        const d = Math.sqrt(d2) || 0.001, f = (1 - d / 1.6) * 1.1;
        tX = (dz / d) * f; tZ = -(dx / d) * f;
      }
    }
    this.bendX += (tX - this.bendX) * 0.18;
    this.bendZ += (tZ - this.bendZ) * 0.18;

    const w1 = Math.sin(time * this.speed + this.phase + this.x * 0.3) * 0.09;
    const w2 = Math.sin(time * this.speed * 2.2 + this.phase + this.z * 0.4) * 0.03;
    _p.set(this.x, 0, this.z);
    _e.set(w1 + w2 + this.bendX, this.rotY, Math.cos(time * this.speed * 0.75 + this.phase + this.z * 0.25) * 0.05 + this.bendZ);
    _q.setFromEuler(_e);
    const fy = Math.max(0.65, 1 - Math.hypot(this.bendX, this.bendZ) * 0.4);
    _s.set(this.currentScale, this.currentScale * fy, this.currentScale);
    _m.compose(_p, _q, _s);
    _mesh.setMatrixAt(this.index, _m);

    if (_lastTime !== time) { _lastTime = time; _mesh.instanceMatrix.needsUpdate = true; }
  }
}