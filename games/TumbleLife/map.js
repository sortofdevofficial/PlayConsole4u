import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Tree } from './Life/tree.js';
import { Grass } from './Life/grass.js';
import { Road } from './Life/road.js';
import { Building } from './Life/building.js';

const grassMat = new THREE.MeshStandardMaterial({
  color: 0x6c9b4a,
  roughness: 1,
  flatShading: true
});

const originalGrassUpdate = Grass.prototype.update;
Grass.prototype.update = function(time, targetPos = null) {
  originalGrassUpdate.call(this, time, targetPos);

  if (Grass.imGrass && Number.isFinite(this.x) && Number.isFinite(this.z) && Number.isFinite(this.index)) {
    const idx = this.index * 16;
    const y = WorldMap.getElevation(this.x, this.z);
    if (Number.isFinite(y) && Grass.imGrass.instanceMatrix?.array && idx + 13 < Grass.imGrass.instanceMatrix.array.length) {
      Grass.imGrass.instanceMatrix.array[idx + 13] = y;
      Grass.imGrass.instanceMatrix.needsUpdate = true;
    }
  }
};

export class WorldMap {
  constructor(scene, opts = {}) {
    const { treeDensity = 2, cityRadius = 150 } = opts;
    this.trees = [];
    this.grassTufts = [];
    this.buildings = [];
    this.grid = {};
    this.cellSize = 10;

    Tree.reset();
    Grass.reset(scene);

    const size = Number.isFinite(cityRadius) ? cityRadius * 3 : 450;
    this.groundGeo = new THREE.PlaneGeometry(size, size, 80, 80);
    const posAttr = this.groundGeo.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = -posAttr.getY(i);
      const h = WorldMap.getElevation(x, z);
      posAttr.setZ(i, Number.isFinite(h) ? h : 0);
    }

    this.groundGeo.computeVertexNormals();

    const ground = new THREE.Mesh(this.groundGeo, grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    this.road = new Road(scene, this);
    this.road.points = this.road.points || [];
    this.roadPoints = this.road.points.map(p => new THREE.Vector3(p.x, p.y ?? 0, p.z));

    this.road.flattenTerrain();

    this.addBuildings(scene);

    const spots = [[-42, 18, 1.0], [36, -24, 1.15]];
    for (let i = 0; i < Math.min(treeDensity, 2); i++) {
      const [x, z, s] = spots[i];
      const tree = new Tree(scene, x, z, s);
      const ty = WorldMap.getElevation(x, z);
      if (tree.meshGroup && Number.isFinite(ty)) tree.meshGroup.position.y = ty;
      this.trees.push(tree);
      (this.grid[`${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`] ||= []).push(tree);
    }

    const clusterDefs = [
      [-15, 15, 150, 1.8], [22, -18, 120, 1.6], [-30, -10, 100, 1.5],
      [10, 28, 130, 1.7], [-48, -5, 90, 1.4], [38, 30, 110, 1.6],
      [5, -35, 100, 1.5], [-20, 45, 80, 1.3], [50, -12, 120, 1.7], [-55, 35, 90, 1.4],
    ];

    for (const [cx, cz, count, radius] of clusterDefs) {
      for (let b = 0; b < count; b++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.pow(Math.random(), 2.0) * radius;
        const gx = cx + Math.cos(a) * d;
        const gz = cz + Math.sin(a) * d;

        if (Number.isFinite(gx) && Number.isFinite(gz)) {
          this.grassTufts.push(new Grass(scene, gx, gz, 0.6 + Math.random() * 0.7));
        }
      }
    }

    Grass.build();
  }

  static getElevation(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;

    let h = 0;
    const d1 = Math.hypot(x - 45, z - 40);
    if (Number.isFinite(d1) && d1 < 55) h += 14 * 0.5 * (1 + Math.cos((d1 / 55) * Math.PI));

    const d2 = Math.hypot(x + 50, z + 35);
    if (Number.isFinite(d2) && d2 < 45) h += 9 * 0.5 * (1 + Math.cos((d2 / 45) * Math.PI));

    return Number.isFinite(h) ? h : 0;
  }

  getElevation(x, z) {
    return WorldMap.getElevation(x, z);
  }

  isFlatArea(x, z, radius = 6, maxDelta = 0.6) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const center = this.getElevation(x, z);
    if (!Number.isFinite(center)) return false;

    for (const ox of [-radius, 0, radius]) {
      for (const oz of [-radius, 0, radius]) {
        const h = this.getElevation(x + ox, z + oz);
        if (!Number.isFinite(h) || Math.abs(h - center) > maxDelta) return false;
      }
    }
    return true;
  }

  nearRoad(x, z, minDist = 16) {
    const pts = this.roadPoints || this.road?.points || [];
    if (!pts.length) return false;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const len2 = vx * vx + vz * vz || 1;

      let t = ((x - a.x) * vx + (z - a.z) * vz) / len2;
      t = THREE.MathUtils.clamp(t, 0, 1);

      const px = a.x + vx * t;
      const pz = a.z + vz * t;
      const d = Math.hypot(x - px, z - pz);

      if (Number.isFinite(d) && d < minDist) return true;
    }

    return false;
  }

  findFlatSpot(startX = -70, startZ = 60, searchRadius = 120, step = 6) {
    let best = null;
    let bestScore = Infinity;

    for (let r = 0; r <= searchRadius; r += step) {
      for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 6) {
        const x = startX + Math.cos(ang) * r;
        const z = startZ + Math.sin(ang) * r;

        if (!this.isFlatArea(x, z, 7, 0.45)) continue;
        if (this.nearRoad(x, z, 18)) continue;

        const score = Math.abs(x) + Math.abs(z);
        if (score < bestScore) {
          bestScore = score;
          best = { x, z };
        }
      }
    }

    return best || { x: -85, z: 75 };
  }

  addBuildings(scene) {
    const spot = this.findFlatSpot(-78, 68, 140, 6);
    const b = new Building(scene, this, spot.x, spot.z, {
      width: 14,
      depth: 12,
      height: 32
    });
    this.buildings.push(b);
  }

  getNearbyTrees(px, pz) {
    const cx = Math.floor(px / this.cellSize);
    const cz = Math.floor(pz / this.cellSize);
    const near = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const arr = this.grid[`${cx + dx},${cz + dz}`];
        if (arr) near.push(...arr);
      }
    }
    return near;
  }

  getNearbyObstacles(px, pz) {
    return [...this.getNearbyTrees(px, pz), ...this.buildings];
  }

  update(time, playerPos = null) {
    for (const t of this.trees) t.update(time);
    for (const g of this.grassTufts) g.update(time, playerPos);
  }
}