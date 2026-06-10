import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

function getY(worldMap, x, z) {
  return worldMap?.getElevation ? worldMap.getElevation(x, z) : 0;
}

const _boxA = new THREE.Box3();
const _boxB = new THREE.Box3();
const _sphereA = new THREE.Sphere();
const _sphereB = new THREE.Sphere();
const _v = new THREE.Vector3();

export function collision(a, b, type = 'box') {
  if (!a || !b) return false;

  if (type === 'sphere') {
    const sa = a.isSphere ? a : _sphereA.setFromObject(a);
    const sb = b.isSphere ? b : _sphereB.setFromObject(b);
    return sa.intersectsSphere(sb);
  }

  const ba = a.isBox3 ? a : _boxA.setFromObject(a);
  const bb = b.isBox3 ? b : _boxB.setFromObject(b);
  return ba.intersectsBox(bb);
}

function getRadius(obj, fallback = 1) {
  if (obj?.radius) return obj.radius;
  const root = obj?.meshGroup || obj?.mesh || obj?.bodyGroup || obj;
  if (!root) return fallback;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(_v);
  return Math.max(size.x, size.z) * 0.5 || fallback;
}

export function updateVehicle(car, keys, dt, worldMap) {
  const w = keys['w'] || keys['arrowup'];
  const s = keys['s'] || keys['arrowdown'];
  const a = keys['a'] || keys['arrowleft'];
  const d = keys['d'] || keys['arrowright'];

  if (w) car.speed += car.acceleration * dt;
  else if (s) car.speed -= car.braking * dt;
  else car.speed *= Math.pow(car.friction, dt * 60);

  car.speed = THREE.MathUtils.clamp(car.speed, car.reverseMaxSpeed, car.maxSpeed);

  let st = 0;
  if (a) st = car.steeringSpeed;
  if (d) st = -car.steeringSpeed;
  car.steer += (st - car.steer) * 10 * dt;

  if (Math.abs(car.speed) > 0.05) {
    car.angle += car.steer * (car.speed > 0 ? 1 : -1) * (car.speed / car.maxSpeed) * dt;
  }

  const p = car.meshGroup.position;
  p.x += Math.sin(car.angle) * car.speed * dt;
  p.z += Math.cos(car.angle) * car.speed * dt;
  p.y = getY(worldMap, p.x, p.z) + car.groundOffset;

  car.meshGroup.rotation.set(0, car.angle, 0);

  const spin = (car.speed / (Math.PI * 0.88)) * dt * 60;
  for (let i = 0; i < car.wheels.length; i++) {
    if (car.wheels[i].userData.isFront) car.wheels[i].rotation.y = car.steer * 0.32;
    car.wheelSpinPivots[i].rotation.x += spin;
  }
}

export function updateVehicleCollision(car, obstacles = [], worldMap = null) {
  const p = car.meshGroup.position;
  const rrCar = car.radius || 1.4;

  for (const o of obstacles) {
    const ox = o.x ?? o.meshGroup?.position?.x ?? o.mesh?.position?.x ?? 0;
    const oz = o.z ?? o.meshGroup?.position?.z ?? o.mesh?.position?.z ?? 0;
    const rrObj = getRadius(o, 1);

    const dx = p.x - ox;
    const dz = p.z - oz;
    const rr = rrCar + rrObj;
    const d2 = dx * dx + dz * dz;

    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.0001;
      p.x = ox + (dx / d) * rr;
      p.z = oz + (dz / d) * rr;
      p.y = getY(worldMap, p.x, p.z) + car.groundOffset;
      car.speed *= -0.25;
      break;
    }
  }
}

export function updateCharacterPosition(pos, dir, speed, dt, obstacles = [], radius = 0.45, worldMap = null) {
  let nx = pos.x + dir.x * speed * dt;
  let nz = pos.z + dir.z * speed * dt;

  for (const o of obstacles) {
    const ox = o.x ?? o.meshGroup?.position?.x ?? o.mesh?.position?.x ?? 0;
    const oz = o.z ?? o.meshGroup?.position?.z ?? o.mesh?.position?.z ?? 0;
    const rrObj = getRadius(o, 1);

    const dx = nx - ox;
    const dz = nz - oz;
    const rr = radius + rrObj;
    const d2 = dx * dx + dz * dz;

    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.0001;
      nx = ox + (dx / d) * rr;
      nz = oz + (dz / d) * rr;
      break;
    }
  }

  pos.x = nx;
  pos.z = nz;
  pos.y = getY(worldMap, nx, nz);
}
