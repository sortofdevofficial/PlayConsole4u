import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WobblyCharacter } from './character.js';
import { MapManager } from './World/map.js';
import { PHYS_CONST, stepCarPhysics, stepCharacterPhysics } from './physics.js';
import { animateCharacterLocomotion, animateCarVisuals, animateBridge, animateWater, animateCharacterDriving, resetCharacterPose } from './animation.js';

document.addEventListener('contextmenu', e => e.preventDefault());

// ── RENDERER & SCENE ─────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
scene.background = new THREE.Color(0xbfe8ff);
scene.fog        = new THREE.Fog(0xbfe8ff, 70, 240);

const camera   = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputColorSpace  = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ── LIGHTING ─────────────────────────────────────────────────────────────────
const sun = new THREE.DirectionalLight(0xfff6d5, 1.75);
sun.position.set(30, 45, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -70;
sun.shadow.camera.right = sun.shadow.camera.top   =  70;
sun.shadow.camera.near  = 0.5;
sun.shadow.camera.far   = 140;
sun.shadow.bias         = -0.0006;
sun.shadow.normalBias   =  0.02;
scene.add(sun, new THREE.HemisphereLight(0xbfe8ff, 0x7fb069, 0.95));

// ── WORLD ────────────────────────────────────────────────────────────────────
const worldMap  = new MapManager(scene);
const sportsCar = worldMap.sportsCar;
const player    = new WobblyCharacter(scene);

// Spawn player on flat ground, clear of car
const charState = {
  x: 0, z: 6,
  y: worldMap.getTerrainHeight(0, 6),   // exact terrain Y — no offsets
  vy: 0, airH: 0, moveX: 0, moveZ: 0,
  isGrounded: true, isHanging: false,
  isSwimming: false, isDriving: false, isMoving: false
};

// ── UI ───────────────────────────────────────────────────────────────────────
const speedUI  = document.getElementById('speedometer');
const speedVal = document.getElementById('speed-val');
const needle   = document.getElementById('needle');

// ── CAMERA ───────────────────────────────────────────────────────────────────
let camTh = 0, camPh = Math.PI / 4.8, camRad = 11;
let isRMD = false, isLMD = false, pMX = 0, pMY = 0;
const mNDC  = new THREE.Vector2();
const rcstr = new THREE.Raycaster();
const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const mWorld= new THREE.Vector3();

// ── INPUT ────────────────────────────────────────────────────────────────────
const keys = { w: false, a: false, s: false, d: false };
window.isGrabbing = false;

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;

  if (k === ' ' && !charState.isDriving) {
    if (charState.isSwimming)                          charState.vy = PHYS_CONST.JUMP_VEL * 0.45;
    else if (charState.isGrounded && !charState.isHanging) { charState.vy = PHYS_CONST.JUMP_VEL; charState.isGrounded = false; }
  }
  if (k === 'f' && sportsCar) sportsCar.headlightsOn = !sportsCar.headlightsOn;
  if (k === 'e') {
    if (charState.isDriving) {
      charState.isDriving = false;
      resetCharacterPose(player);
      charState.x = sportsCar.meshGroup.position.x - 2.5 * Math.sin(sportsCar.angle);
      charState.z = sportsCar.meshGroup.position.z - 2.5 * Math.cos(sportsCar.angle);
      charState.y = worldMap.getTerrainHeight(charState.x, charState.z, sportsCar.meshGroup.position.y);
      charState.vy = 0; charState.isGrounded = true;
    } else if (Math.hypot(charState.x - sportsCar.meshGroup.position.x,
                          charState.z - sportsCar.meshGroup.position.z) < 3.5) {
      charState.isDriving = true; charState.isHanging = false;
    }
  }
});
window.addEventListener('keyup',   e => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = false; });
window.addEventListener('mousedown', e => { if (e.button===0){isLMD=true; window.isGrabbing=true;} if(e.button===2)isRMD=true; });
window.addEventListener('mouseup',   e => { if (e.button===0){isLMD=false; window.isGrabbing=false; charState.isHanging=false;} if(e.button===2)isRMD=false; });
window.addEventListener('wheel',     e => { camRad = Math.max(3, Math.min(25, camRad + e.deltaY * 0.015)); }, { passive: true });
window.addEventListener('mousemove', e => {
  mNDC.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
  if (isRMD) {
    camTh -= (e.clientX - pMX) * 0.007;
    camPh  = Math.max(0.1, Math.min(Math.PI / 1.65, camPh + (e.clientY - pMY) * 0.005));
  }
  pMX = e.clientX; pMY = e.clientY;
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
function engineUpdate() {
  requestAnimationFrame(engineUpdate);
  const time = Date.now() * 0.014;

  // Car physics
  stepCarPhysics(sportsCar, keys, charState.isDriving, worldMap.walls);

  if (charState.isDriving) {
    // Sync player position to car
    charState.x = sportsCar.meshGroup.position.x;
    charState.y = sportsCar.meshGroup.position.y;
    charState.z = sportsCar.meshGroup.position.z;
  } else {
    // Full character physics — terrain snap happens inside here
    stepCharacterPhysics(charState, keys, camTh, isLMD, worldMap, sportsCar);
  }

  // Car visuals & terrain tilt
  animateCarVisuals(sportsCar, worldMap.getTerrainHeight.bind(worldMap), charState.isDriving);

  // Character animation
  if (charState.isDriving) {
    animateCharacterDriving(player, sportsCar.meshGroup, sportsCar.angle, sportsCar.steeringWheelGroup);
    speedUI?.classList.add('active');
    const kmh = Math.abs(sportsCar.speed) * 216;
    if (speedVal) speedVal.textContent = Math.floor(kmh);
    if (needle)   needle.style.transform = `rotate(${-90 + kmh * 1.5}deg)`;
  } else {
    speedUI?.classList.remove('active');
    rcstr.setFromCamera(mNDC, camera);
    floor.constant = -charState.y;
    rcstr.ray.intersectPlane(floor, mWorld);
    animateCharacterLocomotion(player, charState, mWorld, time, window.isGrabbing);
  }

  // World animations
  if (worldMap.drawBridge) animateBridge(worldMap.drawBridge);
  if (worldMap.riverWater) animateWater(worldMap.riverWater);

  // Camera
  const camFocusY = charState.isDriving ? charState.y + 1.2 : charState.y + 1.95;
  camera.position.set(
    charState.x + camRad * Math.sin(camTh) * Math.cos(camPh),
    camFocusY   + camRad * Math.sin(camPh),
    charState.z + camRad * Math.cos(camTh) * Math.cos(camPh)
  );
  camera.lookAt(charState.x, camFocusY, charState.z);

  if (sportsCar.renderMirrors) sportsCar.renderMirrors(renderer, scene);
  renderer.render(scene, camera);
}

engineUpdate();