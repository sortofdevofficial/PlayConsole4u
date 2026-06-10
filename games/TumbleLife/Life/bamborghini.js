import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Bamborghini {
  constructor(scene, x, z) {
    this.meshGroup = new THREE.Group();
    this.meshGroup.position.set(x, 0, z);
    scene.add(this.meshGroup);

    this.speed = 0; this.steer = 0; this.angle = 0;
    this.maxSpeed = 16.0; this.reverseMaxSpeed = -5.0;
    this.acceleration = 12.0; this.braking = 20.0;
    this.friction = 0.96; this.steeringSpeed = 2.2;
    this.width = 2.7; this.length = 5.4; this.radius = 2.5;
    this.groundOffset = 0.38;

    // Passenger seat offset (right side, slightly back)
    this.passengerOffset = new THREE.Vector3(0.9, 0.55, 0.1);

    const W = this.width, L = this.length, WR = 0.44;
    const BY = 0.15, BH = 0.65, CY = BY + BH, CH = 0.95;
    const CAB_L = L * 0.55, CAB_W = W - 0.16, CAB_Z = -L * 0.02;

    const red   = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.3, metalness: 0.4 });
    const redDk = new THREE.MeshStandardMaterial({ color: 0x9b1c1c, roughness: 0.4 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x00a8ff, roughness: 0.02, opacity: 0.35, transparent: true });
    const tireM = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 });
    const rimM  = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.8 });
    const lightM  = new THREE.MeshBasicMaterial({ color: 0xfffee0 });
    const brakeM  = new THREE.MeshBasicMaterial({ color: 0xe63946 });

    const add = (geo, mat, px, py, pz, rx=0) => {
      const o = new THREE.Mesh(geo, mat);
      o.position.set(px, py, pz); o.rotation.x = rx;
      o.castShadow = true; o.receiveShadow = true;
      this.meshGroup.add(o); return o;
    };

    // Body
    add(new THREE.BoxGeometry(W, BH, L), red, 0, BY+BH/2, 0);
    add(new THREE.BoxGeometry(W-.05, 0.2, L*.35), red, 0, BY+BH, L*.25, -0.15);
    // Cab
    add(new THREE.BoxGeometry(CAB_W, CH, CAB_L), glass, 0, CY+CH/2, CAB_Z);
    add(new THREE.BoxGeometry(CAB_W-.1, 0.04, CAB_L-.1), redDk, 0, CY+CH+.01, CAB_Z);
    // Windscreens
    add(new THREE.BoxGeometry(CAB_W-.02, 1.1, 0.02), glass, 0, CY+.45, CAB_Z+CAB_L/2-.2, 0.75);
    add(new THREE.BoxGeometry(CAB_W-.02, .95, 0.02), glass, 0, CY+.4,  CAB_Z-CAB_L/2+.18, -0.65);
    // Bumpers
    add(new THREE.BoxGeometry(W+.08, .12, .4), dark, 0, BY+.06, L/2+.08);
    add(new THREE.BoxGeometry(W+.04, .06, .35), dark, 0, CY+CH+.1, -L/2+.15);
    // Lights
    add(new THREE.BoxGeometry(.4, .06, .04), lightM, W/2-.28, BY+BH-.04, L/2+.01);
    add(new THREE.BoxGeometry(.4, .06, .04), lightM, -W/2+.28, BY+BH-.04, L/2+.01);
    add(new THREE.BoxGeometry(.5, .04, .04), brakeM, W/2-.32, BY+BH-.04, -L/2-.01);
    add(new THREE.BoxGeometry(.5, .04, .04), brakeM, -W/2+.32, BY+BH-.04, -L/2-.01);
    // Mirrors
    [-1,1].forEach(s => {
      add(new THREE.BoxGeometry(.2,.04,.04), dark, s*(W/2+.06), CY+.3, CAB_Z+CAB_L/2-.1);
      add(new THREE.BoxGeometry(.26,.16,.14), red, s*(W/2+.2), CY+.3, CAB_Z+CAB_L/2-.1);
    });

    // Wheels
    const tireGeo = new THREE.CylinderGeometry(WR,WR,.42,8); tireGeo.rotateZ(Math.PI/2);
    const rimGeo  = new THREE.CylinderGeometry(WR*.6,WR*.6,.44,8); rimGeo.rotateZ(Math.PI/2);
    this.wheels = []; this.wheelSpinPivots = [];
    const WB = L*.31;
    [{x:W/2+.02,z:WB,f:true},{x:-W/2-.02,z:WB,f:true},{x:W/2+.02,z:-WB,f:false},{x:-W/2-.02,z:-WB,f:false}]
    .forEach(wp => {
      const asm = new THREE.Group(); asm.position.set(wp.x,WR,wp.z); asm.userData={isFront:wp.f};
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo,tireM)); spin.add(new THREE.Mesh(rimGeo,rimM));
      asm.add(spin); this.meshGroup.add(asm);
      this.wheels.push(asm); this.wheelSpinPivots.push(spin);
    });
  }

  // Get world-space position for a seat: 'driver' or 'passenger'
  getSeatPosition(seat='driver') {
    const p = this.meshGroup.position.clone();
    const offset = seat === 'passenger' ? this.passengerOffset : new THREE.Vector3(-0.9, 0.55, 0.1);
    // Rotate offset by car angle
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    p.x += offset.x * cos - offset.z * sin;
    p.y += offset.y;
    p.z += offset.x * sin + offset.z * cos;
    return p;
  }

  snapToTerrain(worldMap) {
    const y = worldMap?.getElevation?.(this.meshGroup.position.x, this.meshGroup.position.z) ?? 0;
    this.meshGroup.position.y = y + this.groundOffset;
  }
}
