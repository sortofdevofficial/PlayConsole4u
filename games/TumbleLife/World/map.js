import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { House } from './Builds/house.js';
import { Bamborghini } from './Cars/bamborghini.js';
import { BasculeBridge } from './Builds/bridge.js';
import { Water } from './Builds/water.js';
import { Road } from './Builds/road.js';

export class MapManager {
  constructor(scene) {
    this.scene = scene;
    this.walls = [];
    this.door = null;
    this.sideLotHouse = null;
    this.sportsCar = null;
    this.drawBridge = null;
    this.riverWater = null;
    this.roads = [];

    this.hillCenter = { x: 55, z: -105 };
    this.hillRadius = 120;
    this.hillPeak = 16;

    this.bridgeHillCenter = { x: -30, z: -65 };
    this.bridgeHillRadius = 160;
    this.bridgeHillFlatRadius = 75;
    this.bridgeHillPeak = 9.0;

    this.houseBase = { x: -15, z: -95 };
    this.houseRaise = 12.0;

    this.waterY = 1.0;
    this.bridgeDeckY = this.bridgeHillPeak + 0.02;

    this.buildWorld();
  }

  getTerrainHeight(x, z, refY = null) {
    const mainD = Math.hypot(x - this.hillCenter.x, z - this.hillCenter.z);
    let mainH = 0;
    if (mainD < this.hillRadius) {
      const t = 1 - mainD / this.hillRadius;
      mainH = this.hillPeak * t * t;
      mainH += 2.4 * Math.exp(-((x - 42) ** 2 + (z + 92) ** 2) / 1100);
      mainH += 1.8 * Math.exp(-((x - 62) ** 2 + (z + 118) ** 2) / 900);
    }

    const bridgeD = Math.hypot(x - this.bridgeHillCenter.x, z - this.bridgeHillCenter.z);
    let bridgeH = 0;
    if (bridgeD < this.bridgeHillFlatRadius) {
      bridgeH = this.bridgeHillPeak;
    } else if (bridgeD < this.bridgeHillRadius) {
      const t = (bridgeD - this.bridgeHillFlatRadius) / (this.bridgeHillRadius - this.bridgeHillFlatRadius);
      bridgeH = this.bridgeHillPeak * (1 - t * t * (3 - 2 * t));
    }

    let H = Math.max(mainH, bridgeH);

    const houseD = Math.hypot(x - this.houseBase.x, z - this.houseBase.z);
    if (houseD < 30) {
      const b = Math.max(0, (houseD - 15) / 15);
      const blend = b * b * (3 - 2 * b);
      H = THREE.MathUtils.lerp(this.houseRaise, H, blend);
    }

    const riverD = Math.abs(z - this.bridgeHillCenter.z);
    if (riverD < 13) {
      H = this.waterY;
    } else if (riverD < 28) {
      H = THREE.MathUtils.lerp(this.waterY, H, (riverD - 13) / 15);
    }

    const bridgeX = Math.abs(x - this.bridgeHillCenter.x);
    if (bridgeX <= 6.4) {
      const relZ = Math.abs(z - this.bridgeHillCenter.z);
      let deck = null;

      if (relZ >= 13 && relZ <= 25) {
        deck = this.bridgeDeckY;
      } else if (relZ < 13 && this.drawBridge) {
        const ang = this.drawBridge.angle;
        const dist = 13 - relZ;
        if (dist <= 13 * Math.cos(ang)) deck = this.bridgeDeckY + dist * Math.tan(ang);
      }

      if (deck !== null) {
        if (refY === null || deck - refY <= 3.0) return deck;
      }
    }

    return H;
  }

  _fixDepth(obj, factor = -1, units = -1, depthWrite = true) {
    if (!obj || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = factor;
      m.polygonOffsetUnits = units;
      m.depthWrite = depthWrite;
      m.depthTest = true;
    }
  }

  buildWorld() {
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x56b85c,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const terrainGeo = new THREE.PlaneGeometry(560, 560, 220, 220);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + this.hillCenter.x;
      const wz = pos.getZ(i) + this.hillCenter.z;
      pos.setX(i, wx);
      pos.setZ(i, wz);
      pos.setY(i, this.getTerrainHeight(wx, wz));
    }
    pos.needsUpdate = true;
    terrainGeo.computeVertexNormals();

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    terrain.renderOrder = 1;
    this.scene.add(terrain);

    const roadY = this.getTerrainHeight(this.bridgeHillCenter.x, this.bridgeHillCenter.z) + 0.02;
    const road1 = new Road(this.scene, 0, -65, 6, 170, roadY, 0);
    const road2 = new Road(this.scene, -30, -20, 12, 80, this.bridgeDeckY, 0);
    this.roads.push(road1, road2);

    for (const r of this.roads) {
      if (r?.roadGroup) {
        r.roadGroup.traverse(obj => {
          if (obj.isMesh && obj.material) {
            this._fixDepth(obj, -1, -1, true);
            obj.renderOrder = 5;
          }
        });
      }
    }

    const houseBaseY = this.getTerrainHeight(this.houseBase.x, this.houseBase.z);
    const before = this.scene.children.length;
    this.sideLotHouse = new House(this.scene, this.houseBase.x, this.houseBase.z);

    for (let i = before; i < this.scene.children.length; i++) {
      const obj = this.scene.children[i];
      if (obj && obj.position) obj.position.y += houseBaseY;
      if (obj && obj.traverse) obj.traverse(m => this._fixDepth(m, -1, -1, true));
    }

    this.sportsCar = new Bamborghini(this.scene, -30.0, -85.0);
    this.drawBridge = new BasculeBridge(this.scene, -30.0, this.bridgeHillPeak, -65.0, 12.0, 26.0);

    if (this.drawBridge?.meshGroup) {
      this.drawBridge.meshGroup.traverse(obj => {
        if (obj.isMesh && obj.material) {
          this._fixDepth(obj, -2, -2, true);
          obj.renderOrder = 6;
        }
      });
    }

    this.riverWater = new Water(this.scene, 0, this.waterY, -65.0, 900, 26.0);
    if (this.riverWater?.mesh) {
      this.riverWater.mesh.material.transparent = true;
      this.riverWater.mesh.material.opacity = 0.72;
      this.riverWater.mesh.material.depthWrite = false;
      this.riverWater.mesh.material.depthTest = true;
      this.riverWater.mesh.material.polygonOffset = true;
      this.riverWater.mesh.material.polygonOffsetFactor = -6;
      this.riverWater.mesh.material.polygonOffsetUnits = -6;
      this.riverWater.mesh.renderOrder = 20;
    }

    this.walls = [...(this.sideLotHouse?.walls || [])];
    this.door = this.sideLotHouse?.door || null;
  }

  getCharacterGroundHeight(x, z) {
    return this.getTerrainHeight(x, z);
  }
}