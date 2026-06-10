import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WobblyCharacter } from './character.js';
import { WorldMap } from './map.js';
import { Bamborghini } from './Life/bamborghini.js';
import { updateVehicle, updateVehicleCollision, updateCharacterPosition } from './physics.js';

export function startGame({ peer = null, joinCode = null, isMobile = false } = {}) {

  // ── Renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.body.appendChild(renderer.domElement);

  // ── Scene ────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfdfff);
  scene.fog = new THREE.Fog(0xbfdfff, 85, 320);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x97b36a, 1.35));
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.7);
  sun.position.set(60, 90, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left:-120,right:120,top:120,bottom:-120,near:1,far:220 });
  sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // ── Camera ───────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 2000);
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const desiredPos = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  const UP = new THREE.Vector3(0,1,0), X_AXIS = new THREE.Vector3(1,0,0);

  // ── World ────────────────────────────────────────────────────────────────
  const worldMap = new WorldMap(scene, { cityRadius: 130, treeDensity: 2 });
  const character = new WobblyCharacter(scene);
  const car = new Bamborghini(scene, 0, -6);
  character.position.set(0, worldMap.getElevation(0,0) + character.groundOffset, 0);
  character.bodyGroup.position.copy(character.position);
  car.meshGroup.position.y = worldMap.getElevation(0,-6) + car.groundOffset;

  // ── Input ────────────────────────────────────────────────────────────────
  const keys = {};
  let isDriving = false, orbitY = Math.PI, orbitX = 0.08;
  let lastX = 0, lastY = 0, dragging = false;
  const joy = { active:false, id:-1, startX:0, startZ:0, dx:0, dy:0 };
  const camDrag = { active:false, id:-1, startX:0, startY:0 };

  window.addEventListener('mousedown', e => {
    if (e.button !== 0) return; dragging = true; lastX = e.clientX; lastY = e.clientY;
    if (!document.pointerLockElement) document.body.requestPointerLock();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging && !document.pointerLockElement) return;
    const dx = document.pointerLockElement ? e.movementX : e.clientX - lastX;
    const dy = document.pointerLockElement ? e.movementY : e.clientY - lastY;
    orbitY -= dx * 0.0025;
    orbitX = THREE.MathUtils.clamp(orbitX - dy * 0.0025, -Math.PI/8, Math.PI/3.5);
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => dragging = false);
  window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); keys[k] = true; if (k==='f'||k==='enter') toggleDrive(); });
  window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize',  () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

  // Mobile controls
  if (isMobile) {
    const joyZone = document.getElementById('joy-zone');
    const camZone = document.getElementById('cam-zone');
    document.getElementById('btn-enter')?.addEventListener('touchstart', e => { e.preventDefault(); toggleDrive(); });
    document.getElementById('btn-sprint')?.addEventListener('touchstart', e => { e.preventDefault(); keys.shift = true; });
    document.getElementById('btn-sprint')?.addEventListener('touchend',   e => { e.preventDefault(); keys.shift = false; });

    joyZone?.addEventListener('touchstart', e => {
      e.preventDefault(); const t = e.changedTouches[0];
      joy.active=true; joy.id=t.identifier; joy.startX=t.clientX; joy.startZ=t.clientY; joy.dx=0; joy.dy=0;
    }, { passive:false });

    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          const rdx = t.clientX-joy.startX, rdy = t.clientY-joy.startZ;
          const dist = Math.hypot(rdx,rdy)||1, r = Math.min(dist,40)/40;
          joy.dx = (rdx/dist)*r; joy.dy = (rdy/dist)*r;
          const knob = document.getElementById('joy-knob');
          if (knob) knob.style.transform = `translate(calc(-50% + ${joy.dx*40}px),calc(-50% + ${joy.dy*40}px))`;
        }
        if (t.identifier === camDrag.id) {
          orbitY -= (t.clientX-camDrag.startX)*.008;
          orbitX = THREE.MathUtils.clamp(orbitX-(t.clientY-camDrag.startY)*.006, -Math.PI/8, Math.PI/3.5);
          camDrag.startX=t.clientX; camDrag.startY=t.clientY;
        }
      }
    }, { passive:true });

    window.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier===joy.id) { joy.active=false; joy.dx=0; joy.dy=0; const k=document.getElementById('joy-knob'); if(k) k.style.transform='translate(-50%,-50%)'; }
        if (t.identifier===camDrag.id) camDrag.active=false;
      }
    });

    camZone?.addEventListener('touchstart', e => {
      e.preventDefault(); const t=e.changedTouches[0];
      camDrag.active=true; camDrag.id=t.identifier; camDrag.startX=t.clientX; camDrag.startY=t.clientY;
    }, { passive:false });
  }

  // ── Multiplayer ──────────────────────────────────────────────────────────
  const peers = {};
  const connections = [];
  const COLORS = [0xff6b6b, 0x6bffb8, 0x6b9fff, 0xff6bef];

  function setupConn(conn) {
    connections.push(conn);
    conn.on('open', () => {
      const rc = new WobblyCharacter(scene);
      rc.mat.color.setHex(COLORS[connections.length % 4]);
      peers[conn.peer] = rc;
    });
    conn.on('data', d => {
      const rc = peers[conn.peer]; if (!rc) return;
      rc.position.set(d.x,d.y,d.z);
      rc.bodyGroup.position.set(d.x,d.y,d.z);
      rc.bodyGroup.rotation.y = d.ry;
      rc.walkWeight = d.ww;
    });
    conn.on('close', () => { const rc=peers[conn.peer]; if(rc) scene.remove(rc.bodyGroup); delete peers[conn.peer]; });
  }

  if (peer) {
    peer.on('connection', setupConn);
    if (joinCode) {
      const conn = peer.connect(joinCode.toLowerCase(), { reliable:false });
      setupConn(conn);
    }
  }

  function broadcast() {
    if (!connections.length) return;
    const d = { x:character.position.x, y:character.position.y, z:character.position.z, ry:character.bodyGroup.rotation.y, ww:character.walkWeight };
    for (const c of connections) if (c.open) c.send(d);
  }

  // ── Cam / Drive ──────────────────────────────────────────────────────────
  function updateCam(targetPos, h, dist, angle, lookLow=false) {
    const off = new THREE.Vector3(0,h,dist).applyAxisAngle(UP,angle+orbitY).applyAxisAngle(X_AXIS,orbitX);
    desiredPos.copy(targetPos).add(off);
    if (desiredPos.y < targetPos.y+1.5) desiredPos.y = targetPos.y+1.5;
    desiredTarget.copy(targetPos);
    desiredTarget.y += lookLow ? 0.3 : h*.15;
  }

  function toggleDrive() {
    if (isDriving) {
      isDriving = false;
      character.position.copy(car.meshGroup.position);
      character.position.x += Math.sin(car.angle - Math.PI/2)*2.2;
      character.position.z += Math.cos(car.angle - Math.PI/2)*2.2;
      character.snapToTerrain(worldMap);
      character.setDrivingState(false);
      document.getElementById('speedometer').style.display = 'none';
    } else if (character.position.distanceToSquared(car.meshGroup.position) < 20) {
      isDriving = true;
      updateCam(car.meshGroup.position, 4.5, 14, car.angle, true);
      camPos.copy(desiredPos); camTarget.copy(desiredTarget);
      document.getElementById('speedometer').style.display = 'block';
    }
  }

  // ── Loop ─────────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.033);
    const time = clock.elapsedTime;

    const jx = joy.active ? joy.dx : 0, jz = joy.active ? joy.dy : 0;

    if (isDriving) {
      updateVehicle(car, keys, dt, worldMap);
      updateVehicleCollision(car, worldMap.getNearbyObstacles(car.meshGroup.position.x, car.meshGroup.position.z), worldMap);
      character.setDrivingState(true, car.meshGroup.position, car.angle, car.steer, time);
      updateCam(car.meshGroup.position, 4.5, 14, car.angle, true);
      document.getElementById('speedometer').textContent = `${Math.round(Math.abs(car.speed)*8)} KM/H`;
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60+Math.abs(car.speed)*.8, .08);
    } else {
      moveDir.set(
        (keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+jx, 0,
        (keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+jz
      );
      if (moveDir.lengthSq() > 0) {
        moveDir.normalize().applyAxisAngle(UP, orbitY);
        character.speed = keys.shift ? 9.5 : 5.0;
        updateCharacterPosition(character.position, moveDir, character.speed, dt,
          worldMap.getNearbyObstacles(character.position.x, character.position.z), 0.45, worldMap);
      }
      character.snapToTerrain(worldMap);
      character.update(dt, time, moveDir, worldMap);
      updateCam(character.position, 5, 11, 0, false);
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60, .08);
    }
    camera.updateProjectionMatrix();
    broadcast();

    const lT = isDriving ? 1-Math.pow(.002,dt) : 1-Math.pow(.001,dt);
    camPos.lerp(desiredPos,lT); camTarget.lerp(desiredTarget,lT);
    camera.position.copy(camPos); camera.lookAt(camTarget);

    const focus = isDriving ? car.meshGroup.position : character.position;
    sun.target.position.copy(focus); sun.target.updateMatrixWorld();
    worldMap.update(time, focus);
    renderer.render(scene, camera);
  }
  animate();
}
