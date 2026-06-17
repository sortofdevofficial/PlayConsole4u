import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Tree } from './Life/tree.js';
import { Grass } from './Life/grass.js';
import { Road } from './Life/road.js';
import { Building } from './Life/building.js';

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

  // ── SINGLE SOURCE OF TRUTH FOR ELEVATION ──────────────────────────────────
  // Replaced the blocky/cone math with a beautiful, smooth rolling-hills profile.
  static getElevation(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    
    // Smooth multi-layered mathematical noise approximation
    const d1 = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 12;
    const d2 = Math.sin(x * 0.04 + 2.0) * Math.sin(z * 0.035) * 4;
    const d3 = Math.cos(x * 0.005) * Math.sin(z * 0.007) * 8;
    
    let baseElevation = d1 + d2 + d3;

    // Smooth blending flat-zone for the spawn city/roads hub center point
    const centerDist = Math.hypot(x, z);
    const flatRadius = 60;
    const falloffRadius = 160;

    if (centerDist < flatRadius) {
      return 0; // Perfectly flat urban center
    } else if (centerDist < falloffRadius) {
      // Eased transitional slope from the city out into the rolling hills
      const t = (centerDist - flatRadius) / (falloffRadius - flatRadius);
      const smoothFactor = t * t * (3 - 2 * t); // Smoothstep curve
      return baseElevation * smoothFactor;
    }

    return baseElevation;
  }

  getElevation(x, z) { return WorldMap.getElevation(x, z); }

  // ── TERRAIN MESH ─────────────────────────────────────────────────────────
  _buildTerrain(scene, cityRadius) {
    const SIZE = Math.max(cityRadius * 4, 800); // Increased bounds to prevent horizon clipping
    const SEGS = 160; // Bumped resolution density for ultra-smooth hill contours

    const geo    = new THREE.BufferGeometry();
    const vCount = (SEGS+1) * (SEGS+1);
    const positions = new Float32Array(vCount * 3);
    const uvs       = new Float32Array(vCount * 2);

    const half = SIZE / 2;
    const step = SIZE / SEGS;
    let vi = 0, ui = 0;

    // Generate Vertex Structural Maps
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

    // Generate Face Indices (CRITICAL FIX: Changed winding layout from CW to CCW)
    const idxCount = SEGS * SEGS * 6;
    const indices  = new Uint32Array(idxCount);
    let ii = 0;
    
    for (let row = 0; row < SEGS; row++) {
      for (let col = 0; col < SEGS; col++) {
        const a = row * (SEGS + 1) + col;
        const b = a + 1;
        const c = a + (SEGS + 1);
        const d = c + 1;
        
        // Triangle 1 (Counter-Clockwise)
        indices[ii++] = a;
        indices[ii++] = b;
        indices[ii++] = c;
        
        // Triangle 2 (Counter-Clockwise)
        indices[ii++] = b;
        indices[ii++] = d;
        indices[ii++] = c;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals(); 

    // Procedural Vertex Height-Color Interpolation
    const colors = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i++) {
      const wy = positions[i*3+1];
      let r, g, b;
      
      if (wy <= 0.5) {
        // Lush lowland green
        r = 0.32; g = 0.62; b = 0.28;
      } else {
        // Organic transition gradient scaling up to rocky mountain heights
        const t = THREE.MathUtils.clamp(wy / 22, 0, 1);
        r = THREE.MathUtils.lerp(0.32, 0.48, t);
        g = THREE.MathUtils.lerp(0.62, 0.44, t);
        b = THREE.MathUtils.lerp(0.28, 0.32, t);
      }
      
      colors[i*3] = r; 
      colors[i*3+1] = g; 
      colors[i*3+2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material definitions setup with DoubleSide configuration for safety
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: false,
      side: THREE.DoubleSide, // Guarantees surface visibility from any camera vector
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits:  1,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow    = false;
    scene.add(mesh);
    
    this.terrainMesh = mesh;
    this.groundGeo = geo;
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

  // ── FLAT SPOT FINDER ──────────────────────────────────────────────────────
  _findFlatSpot(sx=-70, sz=60, radius=120, step=6) {
    let best=null, bestScore=Infinity;
    for (let r=0; r<=radius; r+=step) {
      for (let ang=0; ang<Math.PI*2; ang+=Math.PI/6) {
        const x=sx+Math.cos(ang)*r, z=sz+Math.sin(ang)*r;
        if (!this._isFlatArea(x,z,7,0.4) || this._nearRoad(x,z,18)) continue;
        const s=Math.abs(x)+Math.abs(z);
        if (s<bestScore){bestScore=s; best={x,z};}
      }
    }
    return best||{x:-85,z:75};
  }

  _isFlatArea(x, z, r=6, maxDelta=0.4) {
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