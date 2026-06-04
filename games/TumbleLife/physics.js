import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export const PHYS_CONST = {
  MOVE_SPEED: 0.13,
  GRAVITY: -0.018,
  JUMP_VEL: 0.30,
  P_RADIUS: 0.45,
  WATER_LEVEL: 2.2,
  SWIM_SPEED_MULT: 0.6,
  HANG_DIST: 1.2,
  DOOR_THICKNESS: 0.18,
  DOOR_WIDTH: 2.2,
  DOOR_MAX_ROT: Math.PI / 1.5,
  DOOR_EASE: 0.08,
  CAR_PUSH_FACTOR: 0.44
};

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();

function updateDoorPhysics(playerState, doorObj, playerRadius = PHYS_CONST.P_RADIUS) {
  let { x: px, z: pz, moveX, moveZ } = playerState;
  if (!doorObj || !doorObj.pivotGroup) return { moveX, moveZ };

  const pivot = doorObj.pivotGroup;
  const nextX = px + moveX;
  const nextZ = pz + moveZ;

  const local = pivot.worldToLocal(_v3a.set(nextX, 0, nextZ));
  const halfW = PHYS_CONST.DOOR_WIDTH;
  const halfT = PHYS_CONST.DOOR_THICKNESS;

  const inDoorZone =
    local.x >= -playerRadius &&
    local.x <= halfW + playerRadius &&
    local.z >= -halfT - playerRadius &&
    local.z <= halfT + playerRadius;

  if (inDoorZone) {
    const push = local.z >= 0 ? 1 : -1;
    const depth = Math.max(0, (halfT + playerRadius) - Math.abs(local.z));
    const targetRot = THREE.MathUtils.clamp(
      pivot.rotation.y + push * depth * 0.45,
      -PHYS_CONST.DOOR_MAX_ROT,
      PHYS_CONST.DOOR_MAX_ROT
    );
    pivot.rotation.y += (targetRot - pivot.rotation.y) * 0.35;

    const local2 = pivot.worldToLocal(_v3b.set(nextX, 0, nextZ));
    if (
      local2.x >= -playerRadius &&
      local2.x <= halfW + playerRadius &&
      local2.z >= -halfT - playerRadius &&
      local2.z <= halfT + playerRadius
    ) {
      local2.z = local2.z >= 0 ? halfT + playerRadius : -halfT - playerRadius;
      const world = pivot.localToWorld(local2);
      moveX = world.x - px;
      moveZ = world.z - pz;
    }
  }

  pivot.rotation.y += (0 - pivot.rotation.y) * PHYS_CONST.DOOR_EASE;
  return { moveX, moveZ };
}

function updateWallCollisions(px, pz, moveX, moveZ, walls, r = PHYS_CONST.P_RADIUS) {
  let nx = px + moveX;
  let nz = pz + moveZ;
  if (!walls || walls.length === 0) return { moveX, moveZ };

  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const minX = w.x - w.width * 0.5 - r;
    const maxX = w.x + w.width * 0.5 + r;
    const minZ = w.z - w.depth * 0.5 - r;
    const maxZ = w.z + w.depth * 0.5 + r;

    if (nx > minX && nx < maxX && nz > minZ && nz < maxZ) {
      const ox = Math.min(maxX - nx, nx - minX);
      const oz = Math.min(maxZ - nz, nz - minZ);
      if (ox < oz) nx = nx > w.x ? maxX : minX;
      else nz = nz > w.z ? maxZ : minZ;
    }
  }

  return { moveX: nx - px, moveZ: nz - pz };
}

function updateCarCollisions(cx, cz, speed, angle, walls, cw, cl) {
  let nx = cx + Math.sin(angle) * speed;
  let nz = cz + Math.cos(angle) * speed;
  const r = Math.max(cw, cl) * PHYS_CONST.CAR_PUSH_FACTOR;
  if (!walls || walls.length === 0) return { nextX: nx, nextZ: nz, currentSpeed: speed };

  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (
      nx > w.x - w.width * 0.5 - r &&
      nx < w.x + w.width * 0.5 + r &&
      nz > w.z - w.depth * 0.5 - r &&
      nz < w.z + w.depth * 0.5 + r
    ) {
      speed = -speed * 0.25;
      nx = cx;
      nz = cz;
      break;
    }
  }

  return { nextX: nx, nextZ: nz, currentSpeed: speed };
}

export function stepCharacterPhysics(state, keys, camTheta, isLMB, worldMap, car) {
  const waterBand = Math.abs(state.z - (-65)) < 18;
  state.isSwimming = state.y < PHYS_CONST.WATER_LEVEL && waterBand;

  if (isLMB && !state.isSwimming) {
    state.isHanging = worldMap.walls.some(w =>
      Math.abs(state.x - w.x) < w.width * 0.5 + PHYS_CONST.HANG_DIST &&
      Math.abs(state.z - w.z) < w.depth * 0.5 + PHYS_CONST.HANG_DIST
    );
  } else if (!isLMB) {
    state.isHanging = false;
  }

  const fX = -Math.sin(camTheta);
  const fZ = -Math.cos(camTheta);
  const speedMul = state.isSwimming ? PHYS_CONST.SWIM_SPEED_MULT : 1.0;

  let mx = 0;
  let mz = 0;
  if (keys.w) { mx += fX * PHYS_CONST.MOVE_SPEED * speedMul; mz += fZ * PHYS_CONST.MOVE_SPEED * speedMul; }
  if (keys.s) { mx -= fX * PHYS_CONST.MOVE_SPEED * speedMul; mz -= fZ * PHYS_CONST.MOVE_SPEED * speedMul; }
  if (keys.a) { mx += fZ * PHYS_CONST.MOVE_SPEED * speedMul; mz -= fX * PHYS_CONST.MOVE_SPEED * speedMul; }
  if (keys.d) { mx -= fZ * PHYS_CONST.MOVE_SPEED * speedMul; mz += fX * PHYS_CONST.MOVE_SPEED * speedMul; }

  state.moveX = mx;
  state.moveZ = mz;
  state.isMoving = !!(keys.w || keys.s || keys.a || keys.d);

  const dp = updateDoorPhysics({ x: state.x, z: state.z, moveX: mx, moveZ: mz }, worldMap.door, PHYS_CONST.P_RADIUS);
  const wp = updateWallCollisions(state.x, state.z, dp.moveX, dp.moveZ, worldMap.walls, PHYS_CONST.P_RADIUS);
  state.x += wp.moveX;
  state.z += wp.moveZ;

  const groundH = worldMap.getTerrainHeight(state.x, state.z, state.y);

  if (state.isSwimming) {
    state.vy += (PHYS_CONST.WATER_LEVEL - 0.4 - state.y) * 0.022;
    state.vy *= 0.84;
    state.y += state.vy;
    state.isGrounded = false;
    if (state.y < groundH) {
      state.y = groundH;
      state.vy = 0;
      state.isGrounded = true;
    }
  } else if (state.isHanging) {
    state.vy = 0;
    state.isGrounded = false;
  } else {
    state.vy += PHYS_CONST.GRAVITY;
    state.y += state.vy;
    if (state.y <= groundH) {
      state.y = groundH;
      state.vy = 0;
      state.isGrounded = true;
    } else {
      state.isGrounded = false;
    }
  }

  if (car && car.meshGroup) {
    const lv = car.meshGroup.worldToLocal(_v3a.set(state.x, state.y, state.z));
    const hw = car.width * 0.5 + PHYS_CONST.P_RADIUS;
    const hl = car.length * 0.5 + PHYS_CONST.P_RADIUS;

    if (Math.abs(lv.x) < hw && Math.abs(lv.z) < hl) {
      const ox = hw - Math.abs(lv.x);
      const oz = hl - Math.abs(lv.z);
      if (ox < oz) lv.x += lv.x > 0 ? ox : -ox;
      else lv.z += lv.z > 0 ? oz : -oz;

      const wv = car.meshGroup.localToWorld(lv);
      state.x = wv.x;
      state.z = wv.z;

      const gh2 = worldMap.getTerrainHeight(state.x, state.z, state.y);
      if (state.y < gh2) {
        state.y = gh2;
        state.vy = 0;
        state.isGrounded = true;
      }
    }
  }

  state.airH = Math.max(0, state.y - groundH);
  return state;
}

export function stepCarPhysics(car, keys, isDriving, walls) {
  if (isDriving) {
    if (keys.w) car.speed += car.acceleration;
    else if (keys.s) car.speed -= car.braking;
    else car.speed *= car.friction;

    car.speed = Math.max(car.reverseMaxSpeed, Math.min(car.maxSpeed, car.speed));

    if (Math.abs(car.speed) > 0.008) {
      const d = car.speed > 0 ? 1 : -1;
      if (keys.a) { car.angle += car.steeringSpeed * d; car.steer = 0.42; }
      else if (keys.d) { car.angle -= car.steeringSpeed * d; car.steer = -0.42; }
      else car.steer = 0;
    } else {
      car.steer = 0;
    }
  } else {
    car.speed *= 0.92;
  }

  const cc = updateCarCollisions(
    car.meshGroup.position.x,
    car.meshGroup.position.z,
    car.speed,
    car.angle,
    walls,
    car.width,
    car.length
  );

  car.meshGroup.position.x = cc.nextX;
  car.meshGroup.position.z = cc.nextZ;
  car.speed = cc.currentSpeed;
}

export { updateDoorPhysics, updateWallCollisions, updateCarCollisions };