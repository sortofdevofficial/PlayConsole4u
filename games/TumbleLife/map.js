import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Tree } from './Life/tree.js';
import { Grass } from './Life/grass.js';
import { Road } from './Life/road.js';
import { Building } from './Life/building.js';

// Patch Grass to sit on terrain Y after each update
const _origGrassUpdate = Grass.prototype.update;
Grass.prototype.update = function(time, targetPos=null) {
  _origGrassUpdate.call(this, time, targetPos);
  if (Grass.imGrass && Number.isFinite(this.x) && Number.isFinite(this.z) && Number.isFinite(this.index)) {
    const idx = this.index * 16;
    const y   = WorldMap.getElevation(this.x, this.z);
    const arr = Grass.imGrass.instanceMatrix?.array;
    if (Number.isFinite(y) && arr && idx+13 < arr.length) {
      arr[idx+13] = y;
      Grass.imGrass.instanceMatrix.needsUpdate = true;
    }
  }
};

export class WorldMap {
  constructor(scene, opts={}) {
    const { treeDensity=2, cityRadius=150 } = opts;
    this.scene      = scene;
    this.trees      = [];
    this.grassTufts = [];
    this.buildings  = [];
    this.grid       = {};
    this.cellSize   = 10;

    Tree.reset();
    Grass.reset(scene);

    this._buildTerrain(scene, cityRadius);
    this._buildRoad(scene);
    this._buildBuildings(scene);
    this._buildTrees(scene, treeDensity);
    this._buildGrass(scene);

    Grass.build();
  }

  // ── SINGLE SOURCE OF TRUTH for height ──────────────────────────────────
  static getElevation(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const bell = (dx, dz, radius, peak) => {
      const d = Math.sqrt(dx*dx + dz*dz);
      if (d >= radius) return 0;
      return peak * 0.5 * (1 + Math.cos((d / radius) * Math.PI));
    };
    let h = 0;
    h += bell(x-45,  z-40,  58, 14);
    h += bell(x+52,  z+38,  48,  9);
    h += bell(x-18,  z+82,  40,  7);
    h += bell(x+10,  z-90,  35,  8);
    h += bell(x-80,  z+10,  30,  6);
    h += bell(x+70,  z-20,  28,  5);
    return Math.max(0, Number.isFinite(h) ? h : 0);
  }

  getElevation(x, z) { return WorldMap.getElevation(x, z); }

  // ── TERRAIN MESH (optimized: fewer segments, no water, opaque mat) ──────
  _buildTerrain(scene, cityRadius) {
    const SIZE = Math.max(cityRadius * 3, 500);
    const SEGS = 64; // down from 120 — ~4x fewer triangles, smooth hills still fine at this scale

    const geo    = new THREE.BufferGeometry();
    const vCount = (SEGS+1) * (SEGS+1);
    const positions = new Float32Array(vCount * 3);
    const uvs       = new Float32Array(vCount * 2);

    const half = SIZE / 2;
    const step = SIZE / SEGS;
    let vi = 0, ui = 0;

    for (let row = 0; row <= SEGS; row++) {
      for (let col = 0; col <= SEGS; col++) {
        const wx = -half + col * step;
        const wz = -half + row * step;
        const wy = this.getElevation(wx, wz);
        positions[vi++] = wx;
        positions[vi++] = wy;
        positions[vi++] = wz;
        uvs[ui++] = col / SEGS;
        uvs[ui++] = row / SEGS;
      }
    }

    const idxCount = SEGS * SEGS * 6;
    const indices  = new Uint32Array(idxCount);
    let ii = 0;
    for (let row = 0; row < SEGS; row++) {
      for (let col = 0; col < SEGS; col++) {
        const a = row*(SEGS+1)+col, b = a+1, c = a+(SEGS+1), d = c+1;
        indices[ii++]=a; indices[ii++]=c; indices[ii++]=b;
        indices[ii++]=b; indices[ii++]=c; indices[ii++]=d;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();

    // Vertex colors by height — cheap (per-vertex, not per-pixel shader work)
    const colors = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i++) {
      const wy = positions[i*3+1];
      let r, g, b;
      if (wy < 0.5) { r=0.38; g=0.67; b=0.27; }
      else if (wy < 5) {
        const t = wy/5;
        r=THREE.MathUtils.lerp(0.38,0.30,t); g=THREE.MathUtils.lerp(0.67,0.55,t); b=THREE.MathUtils.lerp(0.27,0.22,t);
      } else if (wy < 10) {
        const t = (wy-5)/5;
        r=THREE.MathUtils.lerp(0.30,0.52,t); g=THREE.MathUtils.lerp(0.55,0.50,t); b=THREE.MathUtils.lerp(0.22,0.42,t);
      } else {
        const t = Math.min((wy-10)/6, 1);
        r=THREE.MathUtils.lerp(0.52,0.80,t); g=THREE.MathUtils.lerp(0.50,0.78,t); b=THREE.MathUtils.lerp(0.42,0.76,t);
      }
      colors[i*3]=r; colors[i*3+1]=g; colors[i*3+2]=b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits:  2,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow    = false;
    scene.add(mesh);
    this.terrainMesh = mesh;
    this.groundGeo = geo; // road.js flattenTerrain expects this
  }

  // ── ROAD ─────────────────────────────────────────────────────────────────
  _buildRoad(scene) {
    this.road       = new Road(scene, this);
    this.roadPoints = (this.road.points||[]).map(p => new THREE.Vector3(p.x, p.y??0, p.z));
    this.road.flattenTerrain();
  }

  // ── BUILDINGS ─────────────────────────────────────────────────────────────
  _buildBuildings(scene) {
    const sp = this._findFlatSpot(-78, 68, 140, 6);
    this.buildings.push(new Building(scene, this, sp.x, sp.z, { width:14, depth:12, height:32 }));
  }

  // ── TREES ─────────────────────────────────────────────────────────────────
  _buildTrees(scene, treeDensity) {
    const spots = [[-42,18,1.0],[36,-24,1.15]];
    for (let i=0; i<Math.min(treeDensity, spots.length); i++) {
      const [x,z,s] = spots[i];
      const tree = new Tree(scene, x, z, s);
      const ty   = this.getElevation(x, z);
      if (tree.meshGroup && Number.isFinite(ty)) tree.meshGroup.position.y = ty;
      this.trees.push(tree);
      (this.grid[`${Math.floor(x/this.cellSize)},${Math.floor(z/this.cellSize)}`]||=[]).push(tree);
    }
  }

  // ── GRASS ─────────────────────────────────────────────────────────────────
  _buildGrass(scene) {
    const clusters = [
      [-15,15,90,1.8],[22,-18,75,1.6],[-30,-10,70,1.5],[10,28,85,1.7],
      [-48,-5,60,1.4],[38,30,70,1.6],[5,-35,65,1.5],[-20,45,55,1.3],
      [50,-12,75,1.7],[-55,35,60,1.4],
    ]; // reduced counts ~30% — grass is the single biggest instance count in the scene
    for (const [cx,cz,count,radius] of clusters) {
      for (let b=0; b<count; b++) {
        const a  = Math.random()*Math.PI*2;
        const d  = Math.pow(Math.random(),2)*radius;
        const gx = cx+Math.cos(a)*d, gz = cz+Math.sin(a)*d;
        if (Number.isFinite(gx) && Number.isFinite(gz))
          this.grassTufts.push(new Grass(scene, gx, gz, 0.6+Math.random()*0.7));
      }
    }
  }

  // ── FLAT SPOT FINDER (for buildings) ─────────────────────────────────────
  _findFlatSpot(sx=-70, sz=60, radius=120, step=6) {
    let best=null, bestScore=Infinity;
    for (let r=0; r<=radius; r+=step) {
      for (let ang=0; ang<Math.PI*2; ang+=Math.PI/6) {
        const x=sx+Math.cos(ang)*r, z=sz+Math.sin(ang)*r;
        if (!this._isFlatArea(x,z,7,0.45) || this._nearRoad(x,z,18)) continue;
        const s=Math.abs(x)+Math.abs(z);
        if (s<bestScore){bestScore=s; best={x,z};}
      }
    }
    return best||{x:-85,z:75};
  }

  _isFlatArea(x, z, r=6, maxDelta=0.55) {
    if (!Number.isFinite(x)||!Number.isFinite(z)) return false;
    const c = this.getElevation(x,z);
    for (const ox of [-r,0,r]) for (const oz of [-r,0,r]) {
      const h=this.getElevation(x+ox, z+oz);
      if (!Number.isFinite(h)||Math.abs(h-c)>maxDelta) return false;
    }
    return true;
  }

  _nearRoad(x, z, minDist=16) {
    const pts = this.roadPoints||[];
    for (let i=0; i<pts.length-1; i++) {
      const a=pts[i], b=pts[i+1];
      const vx=b.x-a.x, vz=b.z-a.z, len2=(vx*vx+vz*vz)||1;
      const t=THREE.MathUtils.clamp(((x-a.x)*vx+(z-a.z)*vz)/len2, 0, 1);
      if (Math.hypot(x-(a.x+vx*t), z-(a.z+vz*t))<minDist) return true;
    }
    return false;
  }

  // ── PUBLIC QUERY METHODS ──────────────────────────────────────────────────
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

  // ── FRAME UPDATE ─────────────────────────────────────────────────────────
  update(time, playerPos=null) {
    for (const t of this.trees)      t.update(time);
    for (const g of this.grassTufts) g.update(time, playerPos);
  }
}