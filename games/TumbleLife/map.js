import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Tree } from './Life/tree.js';
import { Grass } from './Life/grass.js';
import { Road } from './Life/road.js';
import { Building } from './Life/building.js';

// ── Materials (created once, shared) ──────────────────────────────────────
const _grassMat = new THREE.MeshStandardMaterial({ color:0x5fa845, roughness:1, flatShading:true });
const _rockMat  = new THREE.MeshStandardMaterial({ color:0x8a7f72, roughness:0.95, flatShading:true });
const _sandMat  = new THREE.MeshStandardMaterial({ color:0xd4b97a, roughness:1, flatShading:true });

// Patch Grass instances to sit on terrain Y after each update
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
    this._buildWater(scene);
    this._buildRoad(scene);
    this._buildBuildings(scene);
    this._buildTrees(scene, treeDensity);
    this._buildGrass(scene);

    Grass.build();
  }

  // ── SINGLE SOURCE OF TRUTH ──────────────────────────────────────────────
  // All terrain height queries go through here — mesh vertices use this too.
  // Uses cosine-bell hills so edges blend smoothly to 0 (no cliffs at border).
  static getElevation(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;

    // Cosine bell: smooth bump, zero at edge, zero derivative at peak
    const bell = (dx, dz, radius, peak) => {
      const d = Math.sqrt(dx*dx + dz*dz);
      if (d >= radius) return 0;
      return peak * 0.5 * (1 + Math.cos((d / radius) * Math.PI));
    };

    let h = 0;
    h += bell(x-45,  z-40,  58, 14);   // main hill (NE)
    h += bell(x+52,  z+38,  48,  9);   // west hill (SW)
    h += bell(x-18,  z+82,  40,  7);   // far south hill
    h += bell(x+10,  z-90,  35,  8);   // far north hill
    h += bell(x-80,  z+10,  30,  6);   // far west hill
    h += bell(x+70,  z-20,  28,  5);   // far east bump

    // Clamp so terrain never goes negative (no underwater ground)
    return Math.max(0, Number.isFinite(h) ? h : 0);
  }

  getElevation(x, z) { return WorldMap.getElevation(x, z); }

  // ── TERRAIN MESH ─────────────────────────────────────────────────────────
  _buildTerrain(scene, cityRadius) {
    const SIZE = Math.max(cityRadius * 3, 500);
    const SEGS = 120; // enough for smooth hills without excess triangles

    // Build geometry in world space directly — avoids ALL rotation/offset confusion.
    // We create a flat grid of vertices at the right world XZ, set Y to elevation.
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

    // Build index buffer (two triangles per quad)
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

    // Vertex colors: tint by height for visual richness
    const colors = new Float32Array(vCount * 3);
    vi = 0;
    for (let i = 0; i < vCount; i++) {
      const wy = positions[i*3+1];
      let r, g, b;
      if (wy < 0.5) {
        // flat ground — bright grass green
        r=0.38; g=0.67; b=0.27;
      } else if (wy < 5) {
        // mid slope — darker green
        const t = wy/5;
        r=THREE.MathUtils.lerp(0.38,0.30,t);
        g=THREE.MathUtils.lerp(0.67,0.55,t);
        b=THREE.MathUtils.lerp(0.27,0.22,t);
      } else if (wy < 10) {
        // upper slope — olive/rock
        const t = (wy-5)/5;
        r=THREE.MathUtils.lerp(0.30,0.52,t);
        g=THREE.MathUtils.lerp(0.55,0.50,t);
        b=THREE.MathUtils.lerp(0.22,0.42,t);
      } else {
        // peak — light rock/snow tint
        const t = Math.min((wy-10)/6, 1);
        r=THREE.MathUtils.lerp(0.52,0.80,t);
        g=THREE.MathUtils.lerp(0.50,0.78,t);
        b=THREE.MathUtils.lerp(0.42,0.76,t);
      }
      colors[vi++]=r; colors[vi++]=g; colors[vi++]=b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Use vertex colors for beautiful height-based shading with zero extra draw calls
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
      // polygonOffset pushes terrain back in depth buffer — prevents z-fighting with road
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits:  2,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow    = false; // terrain doesn't need to cast (just receive)
    // NO position or rotation offset — vertices are already in world space
    scene.add(mesh);
    this.terrainMesh = mesh;
  }

  // ── WATER PLANE ──────────────────────────────────────────────────────────
  _buildWater(scene) {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2389da,
      roughness: 0.05,
      metalness: 0.35,
      transparent: true,
      opacity: 0.78,
      // polygonOffset pulls water in FRONT of terrain so no z-fight
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits:  -1,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), waterMat);
    water.rotation.x = -Math.PI/2;
    water.position.y = 0.18; // just above sea level
    water.receiveShadow = true;
    scene.add(water);
    this.waterMesh = water;
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
      [-15,15,120,1.8],[22,-18,100,1.6],[-30,-10,90,1.5],[10,28,110,1.7],
      [-48,-5,80,1.4],[38,30,95,1.6],[5,-35,85,1.5],[-20,45,70,1.3],
      [50,-12,100,1.7],[-55,35,80,1.4],
    ];
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
    // Gentle water shimmer
    if (this.waterMesh) this.waterMesh.position.y = 0.18 + Math.sin(time*0.8)*0.04;
    for (const t of this.trees)      t.update(time);
    for (const g of this.grassTufts) g.update(time, playerPos);
  }
}