import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WobblyCharacter } from './character.js';
import { WorldMap } from './map.js';
import { Bamborghini } from './Life/bamborghini.js';
import { updateVehicle, updateVehicleCollision, updateCharacterPosition } from './physics.js';

export function startGame({ peer = null, connection = null, isMobile = false, isMultiplayer = false, isHost = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1 : 1.5));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfdfff);
  scene.fog = new THREE.Fog(0xbfdfff, isMobile ? 60 : 85, isMobile ? 200 : 320);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x97b36a, 1.35));
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.7);
  sun.position.set(60, 90, 30);
  sun.castShadow = !isMobile;
  if (!isMobile) {
    sun.shadow.mapSize.set(512, 512);
    Object.assign(sun.shadow.camera, { left:-120,right:120,top:120,bottom:-120,near:1,far:220 });
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, isMobile ? 1000 : 2000);
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const desiredPos = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0);

  const worldMap = new WorldMap(scene, { cityRadius: 130, treeDensity: 2 });
  const character = new WobblyCharacter(scene);
  const car = new Bamborghini(scene, 0, -6);
  character.position.set(0, worldMap.getElevation(0, 0) + character.groundOffset, 0);
  character.bodyGroup.position.copy(character.position);
  car.meshGroup.position.y = worldMap.getElevation(0, -6) + car.groundOffset;

  const keys = {};
  let isDriving = false;
  let orbitY = Math.PI, orbitX = 0.08;
  let lastX = 0, lastY = 0, dragging = false;
  const joy = { active:false, id:-1, startX:0, startY:0, dx:0, dy:0 };
  const camDrag = { active:false, id:-1, startX:0, startY:0 };

  // Reusable vector so we don't allocate in the data handler
  const _remoteCarPos = new THREE.Vector3();
  const _zeroDir = new THREE.Vector3();

  window.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!document.pointerLockElement) document.body.requestPointerLock();
  });

  window.addEventListener('mousemove', e => {
    if (!dragging && !document.pointerLockElement) return;
    const dx = document.pointerLockElement ? e.movementX : e.clientX - lastX;
    const dy = document.pointerLockElement ? e.movementY : e.clientY - lastY;
    orbitY -= dx * .0025;
    orbitX = THREE.MathUtils.clamp(orbitX - dy * .0025, -Math.PI / 8, Math.PI / 3.5);
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener('mouseup', () => dragging = false);

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === 'f' || k === 'enter') tryEnterExit();
  });

  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  if (isMobile) {
    const joyZone = document.getElementById('joy-zone');
    const camZone = document.getElementById('cam-zone');
    document.getElementById('btn-enter')?.addEventListener('touchstart', e => {
      e.preventDefault();
      tryEnterExit();
    }, { passive:false });

    joyZone?.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joy.active = true;
      joy.id = t.identifier;
      joy.startX = t.clientX;
      joy.startY = t.clientY;
    }, { passive:false });

    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          const rdx = t.clientX - joy.startX, rdy = t.clientY - joy.startY;
          const dist = Math.hypot(rdx, rdy) || 1, r = Math.min(dist, 40) / 40;
          joy.dx = (rdx / dist) * r;
          joy.dy = (rdy / dist) * r;
          const knob = document.getElementById('joy-knob');
          if (knob) knob.style.transform = `translate(calc(-50% + ${joy.dx * 40}px),calc(-50% + ${joy.dy * 40}px))`;
        }
        if (t.identifier === camDrag.id) {
          orbitY -= (t.clientX - camDrag.startX) * .008;
          orbitX = THREE.MathUtils.clamp(orbitX - (t.clientY - camDrag.startY) * .006, -Math.PI / 8, Math.PI / 3.5);
          camDrag.startX = t.clientX;
          camDrag.startY = t.clientY;
        }
      }
    }, { passive:true });

    window.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          joy.active = false;
          joy.dx = 0;
          joy.dy = 0;
          const k = document.getElementById('joy-knob');
          if (k) k.style.transform = 'translate(-50%,-50%)';
        }
        if (t.identifier === camDrag.id) camDrag.active = false;
      }
    });

    camZone?.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      camDrag.active = true;
      camDrag.id = t.identifier;
      camDrag.startX = t.clientX;
      camDrag.startY = t.clientY;
    }, { passive:false });
  }

  // ── Multiplayer ──────────────────────────────────────────────
  // peers map: connId -> { char: WobblyCharacter, driving: bool, rx: carAngle, rs: carSteer }
  const peers = {};
  const conns = [];

  function makeRemoteChar() {
    const rc = new WobblyCharacter(scene);
    const c = new THREE.Color().setHSL(Math.random(), 0.35, 0.55);
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
    rc.torsoMesh.material = mat;
    rc.head.material     = mat;
    return rc;
  }

  function setupConn(conn) {
    if (conns.includes(conn)) return;
    conns.push(conn);

    const onOpen = () => {
      if (!peers[conn.peer]) {
        peers[conn.peer] = {
          char:    makeRemoteChar(),
          driving: false,
          rx:      0,   // remote car angle
          rs:      0,   // remote car steer
        };
      }
    };

    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', d => {
      if (!d) return;

      // Lazily create peer entry if missed
      if (!peers[conn.peer]) {
        peers[conn.peer] = { char: makeRemoteChar(), driving: false, rx: 0, rs: 0 };
      }
      const p = peers[conn.peer];

      if (d.type === 'state') {
        p.driving = !!d.drv;

        if (d.drv) {
          // ── Remote peer is driving the car ──────────────────
          // Only move the shared car when WE are not driving
          // (the driver always has authority over car position)
          if (!isDriving) {
            car.meshGroup.position.set(d.carX, d.carY, d.carZ);
            car.angle = d.carAngle ?? 0;
            car.speed = d.carSpeed ?? 0;
            car.steer = d.carSteer ?? 0;
            car.meshGroup.rotation.set(0, car.angle, 0);

            // Sync wheel steering visually
            for (let i = 0; i < car.wheels.length; i++) {
              if (car.wheels[i].userData.isFront) {
                car.wheels[i].rotation.y = car.steer * 0.32;
              }
            }
          }

          // Store remote car state for per-frame animation
          p.rx = d.carAngle ?? 0;
          p.rs = d.carSteer ?? 0;

          // Snap remote character into the driving pose immediately
          // (per-frame refresh happens in animate())
          _remoteCarPos.set(d.carX, d.carY, d.carZ);
          p.char.setDrivingState(true, _remoteCarPos, p.rx, p.rs, 0);

        } else {
          // ── Remote peer is on foot ───────────────────────────
          p.char.position.set(d.x, d.y, d.z);
          p.char.bodyGroup.position.set(d.x, d.y, d.z);
          p.char.bodyGroup.rotation.y = d.ry ?? 0;
          p.char.walkWeight = d.ww ?? 0;
          // Make sure driving pose is cleared
          p.char.setDrivingState(false);
        }
      }
    });

    conn.on('close', () => {
      const p = peers[conn.peer];
      if (p?.char?.bodyGroup) scene.remove(p.char.bodyGroup);
      delete peers[conn.peer];
      const idx = conns.indexOf(conn);
      if (idx !== -1) conns.splice(idx, 1);
    });

    conn.on('error', err => console.warn('conn error', err));
  }

  if (peer && isMultiplayer) {
    if (connection) setupConn(connection);
    if (isHost) peer.on('connection', conn => setupConn(conn));
  }

  function broadcast() {
    if (!conns.length) return;
    const d = {
      type:     'state',
      x:        character.position.x,
      y:        character.position.y,
      z:        character.position.z,
      ry:       character.bodyGroup.rotation.y,
      ww:       character.walkWeight,
      drv:      isDriving,
      carX:     car.meshGroup.position.x,
      carY:     car.meshGroup.position.y,
      carZ:     car.meshGroup.position.z,
      carAngle: car.angle,
      carSpeed: car.speed,
      carSteer: car.steer,   // ← added so receiver can animate steering wheel & char
    };
    for (const c of conns) {
      if (c.open) try { c.send(d); } catch {}
    }
  }

  // ── Game logic ───────────────────────────────────────────────
  function tryEnterExit() {
    if (isDriving) {
      isDriving = false;
      character.position.copy(car.meshGroup.position);
      character.position.x += Math.sin(car.angle - Math.PI / 2) * 2.5;
      character.position.z += Math.cos(car.angle - Math.PI / 2) * 2.5;
      character.snapToTerrain(worldMap);
      character.setDrivingState(false);
      document.getElementById('speedometer').style.display = 'none';
      updateHint('');
    } else {
      const distSq = character.position.distanceToSquared(car.meshGroup.position);
      if (distSq < 25) {
        isDriving = true;
        updateCam(car.meshGroup.position, 4.5, 14, car.angle, true);
        camPos.copy(desiredPos);
        camTarget.copy(desiredTarget);
        document.getElementById('speedometer').style.display = 'block';
        updateHint('F to exit car');
      }
    }
  }

  function updateCam(targetPos, h, dist, angle, lookLow = false) {
    const off = new THREE.Vector3(0, h, dist).applyAxisAngle(UP, angle + orbitY).applyAxisAngle(X_AXIS, orbitX);
    desiredPos.copy(targetPos).add(off);
    if (desiredPos.y < targetPos.y + 1.5) desiredPos.y = targetPos.y + 1.5;
    desiredTarget.copy(targetPos);
    desiredTarget.y += lookLow ? 0.3 : h * .15;
  }

  function updateHint(txt) {
    const h = document.getElementById('hint');
    if (h) h.textContent = txt || 'WASD move · F enter car · Drag camera';
  }

  const clock = new THREE.Clock();
  let _broadcastTimer = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt   = Math.min(clock.getDelta(), 0.033);
    const time = clock.elapsedTime;
    const jx   = joy.active ? joy.dx : 0;
    const jz   = joy.active ? joy.dy : 0;

    // ── Local player ─────────────────────────────────────────
    if (isDriving) {
      if (isMobile) {
        keys._w = jz < -0.2; keys._s = jz > 0.2;
        keys._a = jx < -0.2; keys._d = jx > 0.2;
      }
      const dk = isMobile
        ? { w: keys._w, s: keys._s, a: keys._a, d: keys._d, arrowup:false, arrowdown:false, arrowleft:false, arrowright:false }
        : keys;
      updateVehicle(car, dk, dt, worldMap);
      updateVehicleCollision(car, worldMap.getNearbyObstacles(car.meshGroup.position.x, car.meshGroup.position.z), worldMap);
      character.setDrivingState(true, car.meshGroup.position, car.angle, car.steer, time);
      updateCam(car.meshGroup.position, 4.5, 14, car.angle, true);
      document.getElementById('speedometer').textContent = `${Math.round(Math.abs(car.speed) * 8)} KM/H`;
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60 + Math.abs(car.speed) * .8, .08);
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

    // ── Remote peers — tick animations every frame ───────────
    for (const id in peers) {
      const p = peers[id];
      if (!p?.char) continue;

      if (p.driving) {
        // Refresh driving pose each frame so the wobble/steer anim plays
        // Use the shared car position (already synced via data handler)
        p.char.setDrivingState(true, car.meshGroup.position, p.rx, p.rs, time);
      } else {
        // Tick walk / idle animation for the remote character
        // Pass _zeroDir so position doesn't move (network owns position)
        p.char.update(dt, time, _zeroDir, worldMap);
      }
    }

    camera.updateProjectionMatrix();
    _broadcastTimer += dt;
    if (_broadcastTimer >= 0.05) { broadcast(); _broadcastTimer = 0; }

    const lT = isDriving ? 1 - Math.pow(.002, dt) : 1 - Math.pow(.001, dt);
    camPos.lerp(desiredPos, lT);
    camTarget.lerp(desiredTarget, lT);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    const focus = isDriving ? car.meshGroup.position : character.position;
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();
    worldMap.update(time, focus);
    renderer.render(scene, camera);
  }

  animate();
}
