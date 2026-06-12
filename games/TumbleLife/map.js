import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Tree } from './Life/tree.js';
import { Grass } from './Life/grass.js';
import { Road } from './Life/road.js';
import { Building } from './Life/building.js';

// ── Shared grass material ──────────────────────────────────────────────────
const grassMat = new THREE.MeshStandardMaterial({ color:0x6aaa48, roughness:1, flatShading:true });

// Patch Grass so instances sit on terrain after each update
const _origGrassUpdate = Grass.prototype.update;
Grass.prototype.update = function(time, targetPos=null) {
  _origGrassUpdate.call(this, time, targetPos);
  if (Grass.imGrass && Number.isFinite(this.x) && Number.isFinite(this.z) && Number.isFinite(this.index)) {
    const idx = this.index * 16;
    const y = WorldMap.getElevation(this.x, this.z);
    if (Number.isFinite(y) && Grass.imGrass.instanceMatrix?.array && idx+13 < Grass.imGrass.instanceMatrix.array.length) {
      Grass.imGrass.instanceMatrix.array[idx+13] = y;
      Grass.imGrass.instanceMatrix.needsUpdate = true;
    }
  }
};

export class WorldMap {
  constructor(scene, opts={}) {
    const { treeDensity=2, cityRadius=150 } = opts;
    this.trees = []; this.grassTufts = []; this.buildings = [];
    this.grid = {}; this.cellSize = 10;

    Tree.reset();
    Grass.reset(scene);

    // ── TERRAIN MESH ──────────────────────────────────────────────────────
    // PlaneGeometry lies in XY before rotation. After rotateX(-PI/2):
    //   vertex.x stays world X
    //   vertex.y (plane) → world Z (NOT negated — THREE handles it)
    // Height is stored in vertex.z BEFORE rotation, which becomes world Y after.
    const SIZE = Math.max(cityRadius * 3, 450);
    this.groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, 96, 96);
    const pos = this.groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getY(i);   // pre-rotation Y = world Z after rotateX
      const h  = WorldMap.getElevation(vx, vz);
      pos.setZ(i, Number.isFinite(h) ? h : 0);
    }
    this.groundGeo.computeVertexNormals();

    this.groundMesh = new THREE.Mesh(this.groundGeo, grassMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    // Sit -0.04 below zero so road surface (lift=0.18) never z-fights terrain
    this.groundMesh.position.y = -0.04;
    this.groundMesh.receiveShadow = true;
    this.groundMesh.castShadow    = false;
    scene.add(this.groundMesh);

    // ── ROAD ─────────────────────────────────────────────────────────────
    this.road = new Road(scene, this);
    this.roadPoints = (this.road.points || []).map(p => new THREE.Vector3(p.x, p.y??0, p.z));
    this.road.flattenTerrain();

    // ── BUILDINGS ────────────────────────────────────────────────────────
    this._addBuildings(scene);

    // ── TREES ────────────────────────────────────────────────────────────
    const spots = [[-42,18,1.0],[36,-24,1.15]];
    for (let i = 0; i < Math.min(treeDensity, spots.length); i++) {
      const [x, z, s] = spots[i];
      const tree = new Tree(scene, x, z, s);
      const ty = WorldMap.getElevation(x, z);
      if (tree.meshGroup && Number.isFinite(ty)) tree.meshGroup.position.y = ty;
      this.trees.push(tree);
      (this.grid[`${Math.floor(x/this.cellSize)},${Math.floor(z/this.cellSize)}`] ||= []).push(tree);
    }

    // ── GRASS CLUSTERS ───────────────────────────────────────────────────
    const clusters = [
      [-15,15,150,1.8],[22,-18,120,1.6],[-30,-10,100,1.5],[10,28,130,1.7],
      [-48,-5,90,1.4],[38,30,110,1.6],[5,-35,100,1.5],[-20,45,80,1.3],
      [50,-12,120,1.7],[-55,35,90,1.4],
    ];
    for (const [cx,cz,count,radius] of clusters) {
      for (let b = 0; b < count; b++) {
        const a = Math.random()*Math.PI*2, d = Math.pow(Math.random(),2)*radius;
        const gx = cx+Math.cos(a)*d, gz = cz+Math.sin(a)*d;
        if (Number.isFinite(gx) && Number.isFinite(gz))
          this.grassTufts.push(new Grass(scene, gx, gz, 0.6+Math.random()*0.7));
      }
    }
    Grass.build();
  }

  // ── ELEVATION — single source of truth ──────────────────────────────────
  static getElevation(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    let h = 0;
    // Hill 1
    const d1 = Math.hypot(x-45, z-40);
    if (d1 < 55) h += 14 * 0.5 * (1 + Math.cos((d1/55)*Math.PI));
    // Hill 2
    const d2 = Math.hypot(x+50, z+35);
    if (d2 < 45) h += 9  * 0.5 * (1 + Math.cos((d2/45)*Math.PI));
    // Hill 3 — new, far side
    const d3 = Math.hypot(x-20, z+80);
    if (d3 < 38) h += 7  * 0.5 * (1 + Math.cos((d3/38)*Math.PI));
    return Number.isFinite(h) ? h : 0;
  }

  getElevation(x, z) { return WorldMap.getElevation(x, z); }

  // ── FLAT-SPOT FINDER ────────────────────────────────────────────────────
  isFlatArea(x, z, r=6, maxDelta=0.55) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const c = this.getElevation(x, z);
    for (const ox of [-r,0,r]) for (const oz of [-r,0,r]) {
      const h = this.getElevation(x+ox, z+oz);
      if (!Number.isFinite(h) || Math.abs(h-c) > maxDelta) return false;
    }
    return true;
  }

  nearRoad(x, z, minDist=16) {
    const pts = this.roadPoints || [];
    for (let i = 0; i < pts.length-1; i++) {
      const a=pts[i], b=pts[i+1];
      const vx=b.x-a.x, vz=b.z-a.z, len2=(vx*vx+vz*vz)||1;
      const t = THREE.MathUtils.clamp(((x-a.x)*vx+(z-a.z)*vz)/len2, 0, 1);
      if (Math.hypot(x-(a.x+vx*t), z-(a.z+vz*t)) < minDist) return true;
    }
    return false;
  }

  findFlatSpot(sx=-70, sz=60, radius=120, step=6) {
    let best=null, bestScore=Infinity;
    for (let r=0; r<=radius; r+=step) {
      for (let ang=0; ang<Math.PI*2; ang+=Math.PI/6) {
        const x=sx+Math.cos(ang)*r, z=sz+Math.sin(ang)*r;
        if (!this.isFlatArea(x,z,7,0.45)||this.nearRoad(x,z,18)) continue;
        const s=Math.abs(x)+Math.abs(z);
        if (s<bestScore){bestScore=s;best={x,z};}
      }
    }
    return best || {x:-85,z:75};
  }

  _addBuildings(scene) {
    const sp = this.findFlatSpot(-78, 68, 140, 6);
    this.buildings.push(new Building(scene, this, sp.x, sp.z, { width:14, depth:12, height:32 }));
  }

  getNearbyTrees(px, pz) {
    const cx=Math.floor(px/this.cellSize), cz=Math.floor(pz/this.cellSize);
    const out=[];
    for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++) {
      const arr=this.grid[`${cx+dx},${cz+dz}`]; if(arr) out.push(...arr);
    }
    return out;
  }

  getNearbyObstacles(px, pz) {
    return [...this.getNearbyTrees(px,pz), ...this.buildings];
  }

  update(time, playerPos=null) {
    for (const t of this.trees)     t.update(time);
    for (const g of this.grassTufts) g.update(time, playerPos);
  }
}