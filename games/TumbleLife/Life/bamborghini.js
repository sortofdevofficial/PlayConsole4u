import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Shared geometries — created once, never recreated
const _tireGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.42, 14); _tireGeo.rotateZ(Math.PI/2);
const _rimGeo  = new THREE.CylinderGeometry(0.28, 0.28, 0.44, 14); _rimGeo.rotateZ(Math.PI/2);
const _hubGeo  = new THREE.CylinderGeometry(0.10, 0.10, 0.46, 8);  _hubGeo.rotateZ(Math.PI/2);

export class Bamborghini {
  constructor(scene, x, z) {
    this.meshGroup = new THREE.Group();
    this.meshGroup.position.set(x, 0, z);
    scene.add(this.meshGroup);

    // ── Physics params ────────────────────────────────────────────────────
    this.speed           = 0;
    this.steer           = 0;
    this.angle           = 0;
    this._smoothGroundY  = 0;
    this.velocityY       = 0;
    this.isAirborne      = false;
    this.headlightsOn    = false;

    this.maxSpeed        = 18.0;
    this.reverseMaxSpeed = -5.0;
    this.acceleration    = 14.0;
    this.braking         = 22.0;
    this.friction        = 0.965;
    this.steeringSpeed   = 2.4;
    this.width           = 2.6;
    this.length          = 5.2;
    this.radius          = 2.4;
    this.groundOffset    = 0.44;   // WR = 0.44

    this.passengerOffset = new THREE.Vector3(0.88, 0.55, 0.1);

    // ── Materials ─────────────────────────────────────────────────────────
    const body    = new THREE.MeshStandardMaterial({ color:0xe63946, roughness:0.22, metalness:0.55 });
    const bodyDk  = new THREE.MeshStandardMaterial({ color:0x9b1c1c, roughness:0.40, metalness:0.25 });
    const bodyHi  = new THREE.MeshStandardMaterial({ color:0xff5c6d, roughness:0.12, metalness:0.65 });
    const dark    = new THREE.MeshStandardMaterial({ color:0x0d111a, roughness:0.50, metalness:0.30 });
    const glass   = new THREE.MeshStandardMaterial({ color:0x4ab8ff, roughness:0.02, metalness:0.85, opacity:0.28, transparent:true });
    const chrome  = new THREE.MeshStandardMaterial({ color:0xeeeeee, roughness:0.04, metalness:1.0 });
    const tireM   = new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.95 });
    const rimM    = new THREE.MeshStandardMaterial({ color:0xd8d8d8, roughness:0.12, metalness:0.92 });
    const hubM    = new THREE.MeshStandardMaterial({ color:0xe63946, roughness:0.30, metalness:0.40 });
    const rubber  = new THREE.MeshStandardMaterial({ color:0x1a1a1a, roughness:0.90 });

    this.lightGlowMat  = new THREE.MeshBasicMaterial({ color:0x555566 });
    this.brakeLightMat = new THREE.MeshStandardMaterial({ color:0xcc0000, roughness:0.2, emissive:0x330000, emissiveIntensity:0.6 });

    const W = this.width, L = this.length, WR = 0.44;
    const BY=0.18, BH=0.60, CY=BY+BH, CH=0.90;
    const CAB_L=L*0.52, CAB_W=W-0.14, CAB_Z=-L*0.02;

    const add = (geo, mat, px, py, pz, rx=0, ry=0, rz=0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz); m.rotation.set(rx, ry, rz);
      m.castShadow = true; m.receiveShadow = true;
      this.meshGroup.add(m); return m;
    };

    // ── BODY ─────────────────────────────────────────────────────────────
    // Chassis (main lower block)
    add(new THREE.BoxGeometry(W, BH, L), body, 0, BY+BH/2, 0);
    // Hood slope
    add(new THREE.BoxGeometry(W-0.1, 0.05, L*0.30), bodyHi, 0, BY+BH+0.025, L*0.17);
    // Deck / trunk
    add(new THREE.BoxGeometry(W-0.12, 0.05, L*0.24), bodyDk, 0, BY+BH+0.025, -L*0.20);
    // Roof
    add(new THREE.BoxGeometry(CAB_W-0.1, 0.05, CAB_L-0.1), bodyHi, 0, CY+CH+0.025, CAB_Z);

    // ── CABIN ────────────────────────────────────────────────────────────
    // Cabin walls (glass)
    add(new THREE.BoxGeometry(CAB_W, CH, CAB_L), glass, 0, CY+CH/2, CAB_Z);
    // A-pillar front
    add(new THREE.BoxGeometry(CAB_W, 0.96, 0.06), glass, 0, CY+0.48, CAB_Z+CAB_L/2-0.20, 0.60);
    // C-pillar rear
    add(new THREE.BoxGeometry(CAB_W, 0.86, 0.06), glass, 0, CY+0.43, CAB_Z-CAB_L/2+0.18, -0.50);
    // Side glass
    for (const s of [-1,1]) {
      add(new THREE.BoxGeometry(0.04, 0.68, CAB_L*0.42), glass, s*(CAB_W/2-0.06), CY+0.38, CAB_Z);
    }

    // ── BUMPERS ──────────────────────────────────────────────────────────
    add(new THREE.BoxGeometry(W+0.08, 0.16, 0.32), dark, 0, BY+0.08, L/2+0.06);
    add(new THREE.BoxGeometry(W+0.02, 0.04, 0.22), chrome, 0, BY+0.02, L/2+0.08);
    add(new THREE.BoxGeometry(W+0.06, 0.10, 0.30), dark, 0, BY+0.06, -L/2-0.04);
    add(new THREE.BoxGeometry(W,      0.04, 0.22), chrome, 0, BY+0.02, -L/2-0.06);

    // ── LIGHTS ───────────────────────────────────────────────────────────
    // Headlights
    this.hLightL = add(new THREE.BoxGeometry(0.38,0.08,0.06), this.lightGlowMat,  W/2-0.26, BY+BH-0.02, L/2+0.02);
    this.hLightR = add(new THREE.BoxGeometry(0.38,0.08,0.06), this.lightGlowMat, -W/2+0.26, BY+BH-0.02, L/2+0.02);
    add(new THREE.BoxGeometry(0.40,0.10,0.07), dark,  W/2-0.26, BY+BH+0.01, L/2+0.025);
    add(new THREE.BoxGeometry(0.40,0.10,0.07), dark, -W/2+0.26, BY+BH+0.01, L/2+0.025);
    // Tail lights
    this.tLightL = add(new THREE.BoxGeometry(0.48,0.06,0.05), this.brakeLightMat,  W/2-0.30, BY+BH-0.02, -L/2-0.02);
    this.tLightR = add(new THREE.BoxGeometry(0.48,0.06,0.05), this.brakeLightMat, -W/2+0.30, BY+BH-0.02, -L/2-0.02);

    // ── SPOILER ──────────────────────────────────────────────────────────
    add(new THREE.BoxGeometry(W-0.22,0.05,0.14), bodyDk, 0, BY+BH+0.14, -L/2);
    for (const s of [-1,1]) {
      add(new THREE.BoxGeometry(0.05,0.14,0.12), bodyDk, s*(W/2-0.28), BY+BH+0.07, -L/2);
    }

    // ── MIRRORS ──────────────────────────────────────────────────────────
    for (const s of [-1,1]) {
      add(new THREE.BoxGeometry(0.18,0.03,0.04), chrome, s*(W/2+0.06), CY+0.28, CAB_Z+CAB_L/2-0.10);
      add(new THREE.BoxGeometry(0.13,0.14,0.10), bodyDk, s*(W/2+0.15), CY+0.32, CAB_Z+CAB_L/2-0.10);
    }

    // ── UNDERCARRIAGE ────────────────────────────────────────────────────
    add(new THREE.BoxGeometry(W-0.20,0.02,L-0.20), rubber, 0, BY+0.01, 0);

    // ── EXHAUST PIPES ────────────────────────────────────────────────────
    for (const ox of [-0.4, 0.4]) {
      const exGeo = new THREE.CylinderGeometry(0.06,0.07,0.18,8); exGeo.rotateX(Math.PI/2);
      add(exGeo, chrome, ox, BY+0.06, -L/2-0.06);
    }

    // ── SPOTLIGHT BEAMS ──────────────────────────────────────────────────
    this.leftBeam  = new THREE.SpotLight(0xfffee0, 16, 26, Math.PI/6.5, 0.38, 1.1);
    this.rightBeam = new THREE.SpotLight(0xfffee0, 16, 26, Math.PI/6.5, 0.38, 1.1);
    this.leftBeam.position.set(  W/2-0.26, BY+BH-0.02, L/2+0.1);
    this.rightBeam.position.set(-W/2+0.26, BY+BH-0.02, L/2+0.1);
    this.leftBeam.visible = this.rightBeam.visible = false;
    this.meshGroup.add(this.leftBeam, this.leftBeam.target, this.rightBeam, this.rightBeam.target);

    // ── WHEELS ───────────────────────────────────────────────────────────
    this.wheels = []; this.wheelSpinPivots = [];
    const WB = L * 0.32;
    [{x:W/2+0.02,z:WB,f:true},{x:-W/2-0.02,z:WB,f:true},
     {x:W/2+0.02,z:-WB,f:false},{x:-W/2-0.02,z:-WB,f:false}].forEach(wp => {
      const asm  = new THREE.Group(); asm.position.set(wp.x, WR, wp.z);
      asm.userData = { isFront:wp.f, homeY:WR };
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(_tireGeo, tireM));
      spin.add(new THREE.Mesh(_rimGeo,  rimM));
      spin.add(new THREE.Mesh(_hubGeo,  hubM));
      // 5-spoke rim
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.06, WR*1.15), rimM
        );
        spoke.rotation.z = (i / 5) * Math.PI * 2;
        spin.add(spoke);
      }
      asm.add(spin);
      this.meshGroup.add(asm);
      this.wheels.push(asm);
      this.wheelSpinPivots.push(spin);
    });

    // ── STEERING WHEEL ───────────────────────────────────────────────────
    this.steeringWheelGroup = new THREE.Group();
    this.steeringWheelGroup.position.set(0.28, CY+0.36, CAB_Z+CAB_L/2-0.60);
    this.steeringWheelGroup.rotation.x = -0.52;
    this.meshGroup.add(this.steeringWheelGroup);
    this.steeringWheelGroup.add(
      new THREE.Mesh(new THREE.TorusGeometry(0.17,0.025,8,18), dark)
    );
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.022,0.30,0.022), dark);
      sp.rotation.z = (Math.PI*2/3)*i; this.steeringWheelGroup.add(sp);
    }
  }

  getSeatPosition(seat = 'driver') {
    const p = this.meshGroup.position.clone();
    const off = seat === 'passenger' ? this.passengerOffset : new THREE.Vector3(-0.88, 0.55, 0.1);
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    p.x += off.x*cos - off.z*sin; p.y += off.y;
    p.z += off.x*sin + off.z*cos;
    return p;
  }

  snapToTerrain(worldMap) {
    const y = worldMap?.getElevation?.(this.meshGroup.position.x, this.meshGroup.position.z) ?? 0;
    this.meshGroup.position.y = y + this.groundOffset;
  }
}


// ── STANDALONE VEHICLE PHYSICS (import in physics.js or use directly) ────────
// Call this instead of updateVehicle for the Bamborghini specifically.
// Realistic feel: speed-sensitive steering, weight transfer tilt, drift momentum.

const _fwd  = new THREE.Vector3();
const _tiltQ = new THREE.Quaternion();
const _tiltM = new THREE.Matrix4();
const _fn   = new THREE.Vector3(), _fs = new THREE.Vector3(), _fr = new THREE.Vector3();

export function driveVehicle(car, keys, dt, worldMap) {
  const MAX  = car.maxSpeed, REV = car.reverseMaxSpeed;
  const ACCEL = car.acceleration, BRAKE = car.braking;

  // ── 1. Throttle / Brake ───────────────────────────────────────────────
  if (keys.w) {
    car.speed = Math.min(car.speed + ACCEL * dt, MAX);
    car.brakeLightMat.emissiveIntensity = 0.2;
  } else if (keys.s) {
    car.speed = Math.max(car.speed - BRAKE * dt, REV);
    car.brakeLightMat.emissiveIntensity = 1.8;  // bright brakes
  } else {
    // Coast friction — more drag at low speed, less at high (like real tyres)
    const drag = car.speed > 0.5 ? 0.97 : 0.88;
    car.speed *= Math.pow(drag, dt * 60);
    if (Math.abs(car.speed) < 0.02) car.speed = 0;
    car.brakeLightMat.emissiveIntensity = 0.6;
  }

  // ── 2. Steering (speed-sensitive — tight at low speed, wide at high) ──
  const absSpd   = Math.abs(car.speed);
  const steerMax = car.steeringSpeed * Math.max(0.22, 1 - absSpd / (MAX * 1.4));
  const dir      = car.speed >= 0 ? 1 : -1;

  let steerInput = 0;
  if (keys.a) steerInput =  1;
  if (keys.d) steerInput = -1;

  // Smooth steering lag (feel of weight)
  car.steer += (steerInput * steerMax - car.steer) * Math.min(1, dt * 9);
  car.angle  += car.steer * dir * dt;

  // ── 3. Move ───────────────────────────────────────────────────────────
  const p = car.meshGroup.position;
  p.x += Math.sin(car.angle) * car.speed * dt;
  p.z += Math.cos(car.angle) * car.speed * dt;

  // ── 4. Terrain Y + smooth suspension ─────────────────────────────────
  const rawH = worldMap?.getElevation?.(p.x, p.z) ?? 0;
  // Smooth the ground so the car doesn't snap on bumps
  if (rawH < car._smoothGroundY) {
    car._smoothGroundY = rawH;                        // drop instantly
  } else {
    car._smoothGroundY += (rawH - car._smoothGroundY) * Math.min(1, dt * 14);
  }
  const targetY = car._smoothGroundY + car.groundOffset;

  if (p.y > targetY + 0.25) {
    car.velocityY -= 18 * dt;                         // gravity when airborne
    p.y += car.velocityY * dt;
    car.isAirborne = true;
  } else {
    car.velocityY = 0;
    p.y += (targetY - p.y) * Math.min(1, dt * 22);   // spring into ground
    car.isAirborne = false;
  }

  // ── 5. Body tilt (pitch forward on accel/brake, roll on turn) ─────────
  const dX = Math.sin(car.angle), dZ = Math.cos(car.angle);
  const lo = 1.7, wo = 1.0;
  const hF = worldMap?.getElevation?.(p.x+dX*lo, p.z+dZ*lo) ?? rawH;
  const hB = worldMap?.getElevation?.(p.x-dX*lo, p.z-dZ*lo) ?? rawH;
  const hR = worldMap?.getElevation?.(p.x-dZ*wo, p.z+dX*wo) ?? rawH;
  const hL = worldMap?.getElevation?.(p.x+dZ*wo, p.z-dX*wo) ?? rawH;

  _fn.set(dX*(lo*2), hF-hB, dZ*(lo*2)).normalize();
  _fs.set(-dZ*(wo*2), hR-hL, dX*(wo*2)).normalize();
  _fr.crossVectors(_fs, _fn).normalize();

  // Add dynamic weight-transfer on top of terrain tilt
  const pitchOffset = -(car.speed > 0 ? (keys.w?0.028:-0.018) : 0);
  const rollOffset  = -car.steer * 0.022 * (absSpd / MAX);

  _tiltM.makeBasis(_fr, _fn.clone().cross(_fr).negate(), _fn);
  _tiltQ.setFromRotationMatrix(_tiltM);

  // Extra pitch/roll quaternion
  const extra = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitchOffset, 0, rollOffset)
  );
  _tiltQ.multiply(extra);

  car.meshGroup.quaternion.slerp(_tiltQ, Math.min(1, dt * 8));

  // ── 6. Wheel spin + steer ─────────────────────────────────────────────
  const spin = car.speed / MAX;
  for (let i = 0; i < car.wheels.length; i++) {
    car.wheelSpinPivots[i].rotation.x += spin * dt * 60 * 0.55;
    if (car.wheels[i].userData.isFront) {
      car.wheels[i].rotation.y += (car.steer * 0.55 - car.wheels[i].rotation.y) * Math.min(1, dt*12);
    }
    // Suspension travel
    const corners = [hF,hF,hB,hB];
    const tY = (corners[i] - p.y) + car.wheels[i].userData.homeY;
    const cY = THREE.MathUtils.clamp(tY, car.wheels[i].userData.homeY-0.22, car.wheels[i].userData.homeY+0.22);
    car.wheels[i].position.y += (cY - car.wheels[i].position.y) * Math.min(1, dt*28);
  }

  // ── 7. Steering wheel ────────────────────────────────────────────────
  car.steeringWheelGroup.rotation.z += (car.steer * 2.4 - car.steeringWheelGroup.rotation.z) * Math.min(1, dt*10);

  // ── 8. Headlights ─────────────────────────────────────────────────────
  car.leftBeam.visible = car.rightBeam.visible = car.headlightsOn;
  car.lightGlowMat.color.setHex(car.headlightsOn ? 0xfde68a : 0x555566);
  car.leftBeam.target.position.set( car.width/2-0.3, 0.3, 5);
  car.rightBeam.target.position.set(-car.width/2+0.3, 0.3, 5);
}