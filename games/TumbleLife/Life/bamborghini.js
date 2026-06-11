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

    this.passengerOffset = new THREE.Vector3(0.9, 0.55, 0.1);

    const W = this.width, L = this.length, WR = 0.44;
    const BY = 0.15, BH = 0.65, CY = BY + BH, CH = 0.95;
    const CAB_L = L * 0.55, CAB_W = W - 0.16, CAB_Z = -L * 0.02;

    const red   = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.25, metalness: 0.5 });
    const redDk = new THREE.MeshStandardMaterial({ color: 0x9b1c1c, roughness: 0.45, metalness: 0.2 });
    const redSh = new THREE.MeshStandardMaterial({ color: 0xff5c6d, roughness: 0.15, metalness: 0.6 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.55, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x00a8ff, roughness: 0.02, metalness: 0.95, opacity: 0.3, transparent: true });
    const glassDark = new THREE.MeshStandardMaterial({ color: 0x003366, roughness: 0.05, metalness: 0.9, opacity: 0.5, transparent: true });
    const tireM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const rimM  = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.15, metalness: 0.9 });
    const rimCenterM = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.3, metalness: 0.4 });
    const lightM  = new THREE.MeshStandardMaterial({ color: 0xfffee0, roughness: 0.1, emissive: 0xfffee0, emissiveIntensity: 0.3 });
    const brakeM  = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.2, emissive: 0x440000, emissiveIntensity: 0.5 });
    const chrome  = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.05, metalness: 1.0 });
    const rubber  = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85 });

    const add = (geo, mat, px, py, pz, rx=0, ry=0, rz=0) => {
      const o = new THREE.Mesh(geo, mat);
      o.position.set(px, py, pz);
      o.rotation.set(rx, ry, rz);
      o.castShadow = true; o.receiveShadow = true;
      this.meshGroup.add(o); return o;
    };

    // Main body (lower chassis) - slightly rounded
    add(new THREE.BoxGeometry(W, BH, L), red, 0, BY+BH/2, 0);
    // Add subtle hood curve
    add(new THREE.BoxGeometry(W-.08, 0.08, L*.25), redSh, 0, BY+BH+.02, L*.15, -0.08);
    // Rear trunk bump
    add(new THREE.BoxGeometry(W-.1, 0.1, L*.2), redDk, 0, BY+BH+.05, -L*.2, 0.12);

    // Roof pillar (B-pillar)
    add(new THREE.BoxGeometry(W-.12, 0.06, CAB_L*.25), redDk, 0, CY+CH+.03, CAB_Z, 0);

    // Cab (windshield + roof window)
    add(new THREE.BoxGeometry(CAB_W, CH, CAB_L), glass, 0, CY+CH/2, CAB_Z);
    // Roof top line
    add(new THREE.BoxGeometry(CAB_W-.12, 0.05, CAB_L-.12), redSh, 0, CY+CH+.025, CAB_Z);

    // Front windscreen (angled)
    add(new THREE.BoxGeometry(CAB_W-.04, 1.0, 0.03), glass, 0, CY+.48, CAB_Z+CAB_L/2-.22, 0.72);
    // Rear windscreen (more angled)
    add(new THREE.BoxGeometry(CAB_W-.04, .9, 0.03), glass, 0, CY+.42,  CAB_Z-CAB_L/2+.2, -0.58);

    // Side windows
    add(new THREE.BoxGeometry(0.03, .72, CAB_L*.42), glassDark, CAB_W/2-.08, CY+.4, CAB_Z, 0, 0, 0.02);
    add(new THREE.BoxGeometry(0.03, .72, CAB_L*.42), glassDark, -CAB_W/2+.08, CY+.4, CAB_Z, 0, 0, -0.02);

    // Front bumper
    add(new THREE.BoxGeometry(W+.06, .14, .35), dark, 0, BY+.08, L/2+.06);
    add(new THREE.BoxGeometry(W+.02, .04, .25), chrome, 0, BY+.03, L/2+.08);
    // Rear bumper
    add(new THREE.BoxGeometry(W+.04, .08, .3), dark, 0, CY+CH+.08, -L/2+.12);
    add(new THREE.BoxGeometry(W, .03, .25), chrome, 0, CY+CH+.04, -L/2+.14);

    // Headlights (more detailed)
    add(new THREE.BoxGeometry(.35, .06, .04), lightM, W/2-.25, BY+BH-.03, L/2+.01);
    add(new THREE.BoxGeometry(.35, .06, .04), lightM, -W/2+.25, BY+BH-.03, L/2+.01);
    // Headlight housing
    add(new THREE.BoxGeometry(.38, .08, .05), dark, W/2-.25, BY+BH-.01, L/2+.015);
    add(new THREE.BoxGeometry(.38, .08, .05), dark, -W/2+.25, BY+BH-.01, L/2+.015);

    // Tail lights
    add(new THREE.BoxGeometry(.45, .04, .04), brakeM, W/2-.3, BY+BH-.03, -L/2-.01);
    add(new THREE.BoxGeometry(.45, .04, .04), brakeM, -W/2+.3, BY+BH-.03, -L/2-.01);

    // Side markers
    add(new THREE.BoxGeometry(.04, .04, .08), lightM, W/2-.08, BY+BH*.45, 0);
    add(new THREE.BoxGeometry(.04, .04, .08), lightM, -W/2+.08, BY+BH*.45, 0);

    // Mirrors (better shape)
    [-1,1].forEach(s => {
      const mirrorArm = add(new THREE.BoxGeometry(.18,.03,.03), chrome, s*(W/2+.05), CY+.28, CAB_Z+CAB_L/2-.08);
      const mirrorGlass = add(new THREE.BoxGeometry(.12,.12,.08), glass, s*(W/2+.14), CY+.32, CAB_Z+CAB_L/2-.08);
      const mirrorBody = add(new THREE.BoxGeometry(.14,.16,.12), redDk, s*(W/2+.14), CY+.32, CAB_Z+CAB_L/2-.08);
    });

    // Door lines
    add(new THREE.BoxGeometry(.02, .45, CAB_L*.48), redDk, CAB_W/2-.06, CY+.25, CAB_Z);
    add(new THREE.BoxGeometry(.02, .45, CAB_L*.48), redDk, -CAB_W/2+.06, CY+.25, CAB_Z);

    // Hood line
    add(new THREE.BoxGeometry(W-.1, .02, L*.3), redDk, 0, BY+BH+.01, L*.1);

    // Wheels - more detailed
    const tireGeo = new THREE.CylinderGeometry(WR,WR,.44,12); tireGeo.rotateZ(Math.PI/2);
    const rimGeo  = new THREE.CylinderGeometry(WR*.62,WR*.62,.46,12); rimGeo.rotateZ(Math.PI/2);
    const rimSpokeGeo = new THREE.BoxGeometry(WR*.08, WR*.08, WR*1.2);
    const rimCenterGeo = new THREE.CylinderGeometry(WR*.25,WR*.25,.48,12); rimCenterGeo.rotateZ(Math.PI/2);
    
    this.wheels = []; this.wheelSpinPivots = [];
    const WB = L*.31;
    [{x:W/2+.02,z:WB,f:true},{x:-W/2-.02,z:WB,f:true},{x:W/2+.02,z:-WB,f:false},{x:-W/2-.02,z:-WB,f:false}]
    .forEach(wp => {
      const asm = new THREE.Group(); asm.position.set(wp.x,WR,wp.z); asm.userData={isFront:wp.f};
      const spin = new THREE.Group();
      
      // Tire
      spin.add(new THREE.Mesh(tireGeo,tireM));
      // Rim
      spin.add(new THREE.Mesh(rimGeo,rimM));
      // Rim center cap
      spin.add(new THREE.Mesh(rimCenterGeo,rimCenterM));
      // Rim spokes (4)
      for(let i=0;i<4;i++) {
        const spoke = new THREE.Mesh(rimSpokeGeo,rimM);
        spoke.rotation.z = i*Math.PI/2;
        spin.add(spoke);
      }
      
      asm.add(spin); this.meshGroup.add(asm);
      this.wheels.push(asm); this.wheelSpinPivots.push(spin);
    });

    // Add subtle undercarriage shadow
    add(new THREE.BoxGeometry(W-.2, 0.02, L-.2), rubber, 0, BY+.01, 0);
  }

  getSeatPosition(seat='driver') {
    const p = this.meshGroup.position.clone();
    const offset = seat === 'passenger' ? this.passengerOffset : new THREE.Vector3(-0.9, 0.55, 0.1);
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
