import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const _lt = new THREE.Vector3();
const _lq = new THREE.Quaternion();
const _rq = new THREE.Quaternion();
const _up = new THREE.Vector3(0, -1, 0);
const _hangLeftQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.25, 1, 0).normalize());
const _hangRightQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-0.25, 1, 0).normalize());
const _fwdV = new THREE.Vector3();
const _sideV = new THREE.Vector3();
const _normV = new THREE.Vector3();
const _rgtV = new THREE.Vector3();
const _tiltM = new THREE.Matrix4();
const _tiltQ = new THREE.Quaternion();
const _tmpQ = new THREE.Quaternion();
const _tmpE = new THREE.Euler();

function damp(current, target, speed, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * dt));
}

function dampAngle(current, target, speed, dt) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-speed * dt));
}

export function animateCharacterLocomotion(player, state, activeTargetPoint, delta, elapsed, isGrabbing) {
  const dt = Math.min(delta || 0.016, 0.033);
  const t = elapsed || performance.now() * 0.001;

  player.bodyGroup.position.set(state.x, state.y + 0.6, state.z);

  if (state.isMoving && !state.isHanging) {
    player.targetRotationY = Math.atan2(state.moveX, state.moveZ);
  }
  player.bodyGroup.rotation.y = dampAngle(player.bodyGroup.rotation.y, player.targetRotationY, 10.0, dt);
  player.walkWeight = damp(player.walkWeight, state.isMoving ? 1 : 0, 6.0, dt);

  const isAirborne = state.airH > 0.05 && !state.isSwimming;

  let targetPitch = 0;
  let targetRoll = 0;
  let targetTorsoY = 0.5;

  if (state.isSwimming) {
    const swimT = t * 1.9;
    if (state.isMoving) {
      targetPitch = -0.85;
      targetRoll = Math.sin(swimT * 0.5) * 0.08;
      targetTorsoY = 0.36 + Math.sin(swimT) * 0.04;
      player.leftArmPivot.rotation.set(Math.sin(swimT) * 0.7, 0, 0.22 + Math.cos(swimT) * 0.28);
      player.rightArmPivot.rotation.set(Math.sin(swimT) * 0.7, 0, -0.22 - Math.cos(swimT) * 0.28);
      player.leftLeg.rotation.set(Math.sin(swimT + Math.PI) * 0.28, 0, 0.06);
      player.rightLeg.rotation.set(Math.sin(swimT + Math.PI) * 0.28, 0, -0.06);
    } else {
      targetPitch = -0.08;
      targetRoll = Math.sin(swimT * 0.5) * 0.03;
      targetTorsoY = 0.40 + Math.sin(swimT) * 0.03;
      player.leftArmPivot.rotation.set(-0.08 + Math.sin(swimT) * 0.09, 0, 0.16 + Math.cos(swimT) * 0.10);
      player.rightArmPivot.rotation.set(-0.08 + Math.sin(swimT) * 0.09, 0, -0.16 - Math.cos(swimT) * 0.10);
      player.leftLeg.rotation.set(Math.sin(swimT * 1.2) * 0.16, 0, 0.03);
      player.rightLeg.rotation.set(-Math.sin(swimT * 1.2) * 0.16, 0, -0.03);
    }

    player.leftArmPivot.position.set(0.42, 0.75, 0);
    player.rightArmPivot.position.set(-0.42, 0.75, 0);
    player.torsoMesh.scale.set(1, 1, 1);
  } else if (state.isHanging) {
    targetPitch = 0.06 + Math.cos(t * 0.8) * 0.012;
    targetRoll = Math.sin(t * 1.1) * 0.035;
    targetTorsoY = -0.08;

    player.leftArmPivot.position.set(0.62, 0.68, 0);
    player.rightArmPivot.position.set(-0.62, 0.68, 0);
    player.torsoMesh.scale.set(0.93, 1.08, 0.93);

    player.leftLeg.rotation.set(-(0.55 + Math.sin(t * 0.9) * 0.04), 0, 0.10);
    player.rightLeg.rotation.set(0.22 + Math.cos(t * 0.9) * 0.03, 0, -0.06);

    player.leftArmPivot.quaternion.slerp(_hangLeftQ, 1 - Math.exp(-10 * dt));
    player.rightArmPivot.quaternion.slerp(_hangRightQ, 1 - Math.exp(-10 * dt));
  } else {
    player.leftArmPivot.position.set(0.42, 0.75, 0);
    player.rightArmPivot.position.set(-0.42, 0.75, 0);

    const walkT = t * 4.0 * (0.35 + player.walkWeight * 0.65);
    const walkSwing = Math.sin(walkT) * 0.30 * player.walkWeight;

    if (isAirborne) {
      player.leftLeg.rotation.set(0.25, 0, 0);
      player.rightLeg.rotation.set(0.1, 0, 0);
      player.torsoMesh.scale.set(1 - Math.abs(state.vy) * 0.12, 1 + state.vy * 0.18, 1 - Math.abs(state.vy) * 0.12);
    } else {
      player.leftLeg.rotation.set(walkSwing, 0, 0);
      player.rightLeg.rotation.set(-walkSwing, 0, 0);
      player.torsoMesh.scale.set(1, 1, 1);
      targetTorsoY = 0.5 + Math.abs(Math.sin(walkT)) * 0.016 * player.walkWeight + Math.sin(t * 1.4) * 0.008;
    }

    if (activeTargetPoint) {
      _lt.copy(activeTargetPoint);
      player.bodyGroup.worldToLocal(_lt);

      const lDir = _lt.clone().sub(new THREE.Vector3(0.42, 0.75, 0)).normalize();
      const rDir = _lt.clone().sub(new THREE.Vector3(-0.42, 0.75, 0)).normalize();

      let lSpeed = isGrabbing ? 0.28 : 0.06;
      let rSpeed = isGrabbing ? 0.28 : 0.06;

      if (!isGrabbing) {
        if (_lt.x > 0) {
          rSpeed = 0.08;
          lSpeed = 0.03;
          lDir.y -= 0.22;
        } else {
          lSpeed = 0.08;
          rSpeed = 0.03;
          rDir.y -= 0.22;
        }

        lDir.x = Math.max(lDir.x, 0.30);
        rDir.x = Math.min(rDir.x, -0.30);
        lDir.normalize();
        rDir.normalize();

        if (isAirborne) {
          if (state.vy > 0) {
            _lq.setFromEuler(_tmpE.set(0, 0, 0.85));
            _rq.setFromEuler(_tmpE.set(0, 0, -0.85));
          } else {
            _lq.setFromEuler(_tmpE.set(-0.15, 0, 0.42));
            _rq.setFromEuler(_tmpE.set(-0.15, 0, -0.42));
          }
          lSpeed = rSpeed = 0.08;
        } else {
          const armSwing = Math.sin(walkT) * 0.18 * player.walkWeight;
          _lq.setFromUnitVectors(_up, lDir).multiply(_tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -armSwing));
          _rq.setFromUnitVectors(_up, rDir).multiply(_tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), armSwing));
        }
      } else {
        _lq.setFromUnitVectors(_up, lDir);
        _rq.setFromUnitVectors(_up, rDir);
      }

      player.leftArmPivot.quaternion.slerp(_lq, lSpeed);
      player.rightArmPivot.quaternion.slerp(_rq, rSpeed);
    }
  }

  player.head.position.set(player.bodyGroup.position.x, player.bodyGroup.position.y + 1.15, player.bodyGroup.position.z);
  const headTarget = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(player.bodyGroup.rotation.x, player.bodyGroup.rotation.y, player.bodyGroup.rotation.z)
  );
  player.head.quaternion.slerp(headTarget, 1 - Math.exp(-8.0 * dt));

  player.bodyGroup.rotation.x = damp(player.bodyGroup.rotation.x, targetPitch, 8.0, dt);
  player.bodyGroup.rotation.z = damp(player.bodyGroup.rotation.z, targetRoll, 8.0, dt);
  player.torsoMesh.position.y = damp(player.torsoMesh.position.y, targetTorsoY, 8.0, dt);
}

export function animateCarVisuals(car, getTerrainHeight, isDriving, delta = 0.016) {
  const dt = Math.min(delta || 0.016, 0.033);

  car.leftBeam.visible = car.rightBeam.visible = car.headlightsOn;
  car.lightGlowMat.color.setHex(car.headlightsOn ? 0xfde68a : 0x4b5563);
  if (!isDriving && !car.isAirborne) car.brakeLightMat.color.setHex(0x7f1d1d);

  const spinRate = car.speed / Math.max(0.001, car.maxSpeed);
  for (let i = 0; i < car.wheels.length; i++) {
    car.wheelSpinPivots[i].rotation.x += spinRate * 0.22 * (dt * 60);
    if (car.wheels[i].userData.isFront) car.wheels[i].rotation.y = dampAngle(car.wheels[i].rotation.y, car.steer, 10.0, dt);
  }
  car.steeringWheelGroup.rotation.z = damp(car.steeringWheelGroup.rotation.z, car.steer * 2.2, 10.0, dt);

  const p = car.meshGroup.position;
  const rawGround = getTerrainHeight(p.x, p.z, p.y);
  car._smoothGroundY = car._smoothGroundY === undefined ? rawGround : Math.min(rawGround, car._smoothGroundY + 0.18);
  const rideH = car._smoothGroundY + 0.55;

  if (p.y > rideH + 0.16) {
    car.velocityY -= 0.013 * (dt * 60);
    p.y += car.velocityY;
    car.isAirborne = true;
  } else {
    p.y += (rideH - p.y) * 0.18;
    if (car.isAirborne) car.velocityY = 0;
    car.isAirborne = false;
  }

  const dX = Math.sin(car.angle);
  const dZ = Math.cos(car.angle);

  if (!car.isAirborne) {
    const lo = 1.5;
    const wo = 0.85;

    const hF = getTerrainHeight(p.x + dX * lo, p.z + dZ * lo, p.y);
    const hB = getTerrainHeight(p.x - dX * lo, p.z - dZ * lo, p.y);
    const hR = getTerrainHeight(p.x - dZ * wo, p.z + dX * wo, p.y);
    const hL = getTerrainHeight(p.x + dZ * wo, p.z - dX * wo, p.y);

    _fwdV.set(dX * (lo * 2), hF - hB, dZ * (lo * 2)).normalize();
    _sideV.set(-dZ * (wo * 2), hR - hL, dX * (wo * 2)).normalize();
    _normV.crossVectors(_sideV, _fwdV).normalize();
    _rgtV.crossVectors(_normV, _fwdV).normalize();
    _tiltM.makeBasis(_rgtV, _normV, _fwdV);
    _tiltQ.setFromRotationMatrix(_tiltM);

    car.meshGroup.quaternion.slerp(_tiltQ, 1 - Math.exp(-6.0 * dt));

    const cornerH = [hF, hF, hB, hB];
    for (let i = 0; i < car.wheels.length; i++) {
      const w = car.wheels[i];
      const tY = (cornerH[i] - p.y) + w.userData.homeY;
      const cY = THREE.MathUtils.clamp(tY, w.userData.homeY - 0.18, w.userData.homeY + 0.18);
      w.position.y = damp(w.position.y, cY, 16.0, dt);
    }
  } else {
    car.meshGroup.rotateX(-0.003);
    for (let i = 0; i < car.wheels.length; i++) {
      const w = car.wheels[i];
      w.position.y = damp(w.position.y, w.userData.homeY - 0.18, 16.0, dt);
    }
  }

  car.leftBeam.target.position.set(car.width / 2 - 0.3, 0.3, 5);
  car.rightBeam.target.position.set(-car.width / 2 + 0.3, 0.3, 5);
}

export function animateBridge(bridge, delta = 0.016) {
  const dt = Math.min(delta || 0.016, 0.033);
  bridge.time += dt * 0.9;
  const wave = (Math.sin(bridge.time) + 1) * 0.5;
  bridge.angle = wave * bridge.maxAngle;
  bridge.northLeafPivot.rotation.x = -bridge.angle;
  bridge.southLeafPivot.rotation.x = bridge.angle;
}

export function animateWater(water, delta = 0.016) {
  const dt = Math.min(delta || 0.016, 0.033);
  water.time += dt * 1.1;
  if (water.shader) water.shader.uniforms.uTime.value = water.time;
}

export function animateCharacterDriving(player, carMeshGroup, carAngle, steeringWheelGroup) {
  player.bodyGroup.position.copy(carMeshGroup.position);
  player.bodyGroup.position.y += 0.96;
  player.bodyGroup.rotation.y = carAngle;
  player.torsoMesh.scale.set(1.0, 0.72, 1.0);
  player.torsoMesh.position.y = 0.28;
  const steer = steeringWheelGroup.rotation.z;
  player.leftArmPivot.rotation.set(-1.05, 0, 0.3 + steer * 0.5);
  player.rightArmPivot.rotation.set(-1.05, 0, -0.3 + steer * 0.5);
  player.leftLeg.rotation.set(-Math.PI / 1.7, 0, 0.1);
  player.rightLeg.rotation.set(-Math.PI / 1.7, 0, -0.1);
  player.head.position.set(player.bodyGroup.position.x, player.bodyGroup.position.y + 0.76, player.bodyGroup.position.z);
  player.head.rotation.set(0, carAngle, 0);
}

export function resetCharacterPose(player) {
  player.torsoMesh.scale.set(1, 1, 1);
  player.torsoMesh.position.set(0, 0.5, 0);
  player.leftArmPivot.rotation.set(0, 0, 0);
  player.rightArmPivot.rotation.set(0, 0, 0);
  player.leftLeg.rotation.set(0, 0, 0);
  player.rightLeg.rotation.set(0, 0, 0);
  player.bodyGroup.scale.set(1, 1, 1);
  player.head.rotation.set(0, 0, 0);
  player.bodyGroup.updateMatrixWorld(true);
}