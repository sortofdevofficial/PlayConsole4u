import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WobblyCharacter } from './character.js';
import { WorldMap } from './map.js';
import { Bamborghini } from './Life/bamborghini.js';
import { NPC } from './Life/npc.js';
import { updateVehicle, updateVehicleCollision, updateCharacterPosition } from './physics.js';

const WAYPOINTS = [
  {x:-20,z:-10},{x:10,z:-20},{x:30,z:0},{x:-15,z:25},{x:25,z:30},
  {x:-40,z:15},{x:5,z:40},{x:-30,z:-35},{x:45,z:-15},{x:0,z:50}
];
const PEER_LABELS = ['Player 2','Player 3','Player 4','Player 5'];
const PEER_COLORS = ['#ff6b6b','#6bffb8','#6b9fff','#ff6bef'];

// Pre-allocated reusables — zero GC per frame
const _v3a = new THREE.Vector3(), _v3b = new THREE.Vector3();
const _UP  = new THREE.Vector3(0,1,0), _XA = new THREE.Vector3(1,0,0);

export function startGame({ peer=null, connection=null, isMobile=false, isMultiplayer=false, isHost=true } = {}) {

  // ── RENDERER ─────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference:'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1 : 2));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  // Optimisation: skip clear — skybox covers everything
  renderer.autoClear = true;
  document.body.appendChild(renderer.domElement);

  // ── SCENE ────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfdfff);
  scene.fog = new THREE.FogExp2(0xbfdfff, isMobile ? 0.009 : 0.005);

  // Lighting — single hemi + single directional (cheapest that still looks good)
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x728c4c, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3db, 2.0);
  sun.position.set(80, 120, 50);
  sun.castShadow = !isMobile;
  if (!isMobile) {
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {left:-120,right:120,top:120,bottom:-120,near:1,far:260});
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.01;
  }
  scene.add(sun);

  // ── CAMERA ───────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.5, isMobile ? 800 : 1500);
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const desiredPos = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
  let orbitY = Math.PI, orbitX = 0.08;

  // ── WORLD ────────────────────────────────────────────────────────────────
  const world = new WorldMap(scene, { cityRadius:130, treeDensity:2 });
  const character = new WobblyCharacter(scene, 'You', '#faff6e');
  const car = new Bamborghini(scene, 0, -6);
  character.position.set(0, world.getElevation(0,0) + character.groundOffset, 0);
  character.bodyGroup.position.copy(character.position);
  car.meshGroup.position.y = world.getElevation(0,-6) + car.groundOffset;

  // NPCs — capped at 3, only update within 70 units
  const npcs = [{x:-25,z:5},{x:15,z:-15},{x:35,z:20}].map(sp => {
    const n = new NPC(scene, sp.x, sp.z);
    n.setWaypoints(WAYPOINTS);
    n.position.y = world.getElevation(sp.x, sp.z) + n.groundOffset;
    return n;
  });

  // ── INPUT ────────────────────────────────────────────────────────────────
  const keys = {};
  let isDriving = false, dragging = false, lastX = 0, lastY = 0;
  const joy = { active:false, id:-1, dx:0, dy:0, sx:0, sy:0 };
  const cam2 = { active:false, id:-1, sx:0, sy:0 };

  window.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    if (!isMobile && !isDriving && document.pointerLockElement) doPunch();
    if (!isMobile && !document.pointerLockElement) document.body.requestPointerLock();
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
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k==='f'||k==='enter') tryEnterExit();
    if (k==='p'||k===' ') doPunch();
  });
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  window.addEventListener('wheel', e => {
    // zoom
    const delta = e.deltaY * 0.01;
    if (isDriving) return;
    orbitX = THREE.MathUtils.clamp(orbitX + delta * 0.05, -Math.PI/8, Math.PI/3.5);
  }, { passive: true });

  // Mobile touch
  if (isMobile) {
    const joyZone = document.getElementById('joy-zone');
    const camZone = document.getElementById('cam-zone');
    document.getElementById('btn-enter')?.addEventListener('touchstart', e => { e.preventDefault(); tryEnterExit(); }, { passive:false });
    document.getElementById('btn-punch')?.addEventListener('touchstart', e => { e.preventDefault(); doPunch(); }, { passive:false });

    joyZone?.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joy.active=true; joy.id=t.identifier; joy.sx=t.clientX; joy.sy=t.clientY; joy.dx=0; joy.dy=0;
    }, { passive:false });

    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          const rdx = t.clientX-joy.sx, rdy = t.clientY-joy.sy;
          const dist = Math.hypot(rdx,rdy)||1, r = Math.min(dist,40)/40;
          joy.dx = (rdx/dist)*r; joy.dy = (rdy/dist)*r;
          const k = document.getElementById('joy-knob');
          if (k) k.style.transform = `translate(calc(-50% + ${joy.dx*40}px),calc(-50% + ${joy.dy*40}px))`;
        }
        if (t.identifier === cam2.id) {
          orbitY -= (t.clientX - cam2.sx) * 0.008;
          orbitX = THREE.MathUtils.clamp(orbitX - (t.clientY - cam2.sy) * 0.006, -Math.PI/8, Math.PI/3.5);
          cam2.sx = t.clientX; cam2.sy = t.clientY;
        }
      }
    }, { passive:true });

    window.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          joy.active=false; joy.dx=0; joy.dy=0;
          const k = document.getElementById('joy-knob');
          if (k) k.style.transform = 'translate(-50%,-50%)';
        }
        if (t.identifier === cam2.id) cam2.active = false;
      }
    });

    camZone?.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      cam2.active=true; cam2.id=t.identifier; cam2.sx=t.clientX; cam2.sy=t.clientY;
    }, { passive:false });
  }

  // ── PUNCH ────────────────────────────────────────────────────────────────
  function doPunch() {
    if (isDriving) return;
    character.punch();
    const RANGE = 2.5;
    for (const npc of npcs) {
      if (Math.hypot(npc.position.x - character.position.x, npc.position.z - character.position.z) < RANGE) {
        _v3a.set(npc.position.x - character.position.x, 0, npc.position.z - character.position.z).normalize();
        npc.applyKnockback(_v3a, 12);
      }
    }
    // Notify peers
    for (const id in peers) {
      const p = peers[id]; if (!p?.char) continue;
      const dx = p.char.position.x - character.position.x;
      const dz = p.char.position.z - character.position.z;
      if (Math.hypot(dx, dz) < RANGE) {
        _sendAll({ type:'punch', dx, dz });
      }
    }
  }

  // ── ENTER / EXIT CAR ─────────────────────────────────────────────────────
  function tryEnterExit() {
    if (isDriving) {
      isDriving = false;
      character.position.copy(car.meshGroup.position);
      character.position.x += Math.sin(car.angle - Math.PI/2) * 2.5;
      character.position.z += Math.cos(car.angle - Math.PI/2) * 2.5;
      character.snapToTerrain(world);
      character.setDrivingState(false);
      document.getElementById('speedometer').style.display = 'none';
    } else if (character.position.distanceToSquared(car.meshGroup.position) < 25) {
      isDriving = true;
      document.getElementById('speedometer').style.display = 'block';
    }
  }

  // ── CAMERA ───────────────────────────────────────────────────────────────
  function setCamTarget(pos, h, dist, angle) {
    _v3a.set(0, h, dist).applyAxisAngle(_UP, angle + orbitY).applyAxisAngle(_XA, orbitX);
    desiredPos.copy(pos).add(_v3a);
    if (desiredPos.y < pos.y + 1.5) desiredPos.y = pos.y + 1.5;
    desiredTarget.copy(pos);
    desiredTarget.y += h * 0.15;
  }

  // ── MULTIPLAYER ──────────────────────────────────────────────────────────
  const peers = {}, conns = [];
  let _pIdx = 0, _bcastTimer = 0;

  function _makeRemote() {
    const idx = (_pIdx++) % PEER_LABELS.length;
    const rc = new WobblyCharacter(scene, PEER_LABELS[idx], PEER_COLORS[idx]);
    const c = new THREE.Color(PEER_COLORS[idx]);
    rc.mat.color.copy(c);
    [rc.torsoMesh, rc.head].forEach(m => m.material = rc.mat);
    return rc;
  }

  function _sendAll(data) {
    for (const c of conns) if (c.open) { try { c.send(data); } catch {} }
  }

  function _ensurePeer(id) {
    if (!peers[id]) peers[id] = { char: _makeRemote(), driving: false };
    return peers[id];
  }

  function setupConn(conn) {
    if (conns.includes(conn)) return;
    conns.push(conn);

    const onOpen = () => _ensurePeer(conn.peer);
    conn.open ? onOpen() : conn.on('open', onOpen);

    conn.on('data', d => {
      if (!d) return;
      const p = _ensurePeer(conn.peer);
      if (d.type === 'state') {
        p.driving = !!d.drv;
        if (d.drv) {
          // Only sync car from remote if local isn't driving
          if (!isDriving) {
            car.meshGroup.position.set(d.carX, d.carY, d.carZ);
            car.angle = d.carAngle ?? 0;
            car.speed = d.carSpeed ?? 0;
            car.steer = d.carSteer ?? 0;
            car.meshGroup.rotation.set(0, car.angle, 0);
          }
          _v3b.set(d.carX, d.carY, d.carZ);
          p.char.setDrivingState(true, _v3b, d.carAngle??0, d.carSteer??0, 0, null, 1);
        } else {
          p.char.position.set(d.x, d.y, d.z);
          p.char.bodyGroup.position.set(d.x, d.y, d.z);
          p.char.bodyGroup.rotation.y = d.ry ?? 0;
          p.char.walkWeight = d.ww ?? 0;
          p.char.setDrivingState(false);
        }
      } else if (d.type === 'punch') {
        _v3a.set(d.dx, 0, d.dz).normalize();
        character.position.x += _v3a.x * 2.5;
        character.position.z += _v3a.z * 2.5;
        character._sq = 0.6;
      }
    });

    conn.on('close', () => {
      const p = peers[conn.peer];
      if (p?.char?.bodyGroup) scene.remove(p.char.bodyGroup);
      if (p?.char?.nameTag)   scene.remove(p.char.nameTag);
      delete peers[conn.peer];
      conns.splice(conns.indexOf(conn), 1);
    });

    // Heartbeat — keeps WebRTC alive through NAT
    conn._hb = setInterval(() => { if (conn.open) try { conn.send({type:'ping'}); } catch {} }, 5000);
    conn.on('close', () => clearInterval(conn._hb));
  }

  if (peer && isMultiplayer) {
    if (connection) setupConn(connection);
    if (isHost) peer.on('connection', conn => setupConn(conn));
  }

  // ── CLOCK ────────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();

  // ── MAIN LOOP ─────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    const dt   = Math.min(clock.getDelta(), 0.033);   // cap at 30ms = no spiral of death
    const time = clock.elapsedTime;
    const jx = joy.active ? joy.dx : 0;
    const jz = joy.active ? joy.dy : 0;

    if (isDriving) {
      const dk = isMobile
        ? { w: jz < -0.2, s: jz > 0.2, a: jx < -0.2, d: jx > 0.2 }
        : keys;
      updateVehicle(car, dk, dt, world);
      updateVehicleCollision(car, world.getNearbyObstacles?.(car.meshGroup.position.x, car.meshGroup.position.z) ?? [], world);
      character.setDrivingState(true, car.meshGroup.position, car.angle, car.steer, time, null, -1);
      setCamTarget(car.meshGroup.position, 4.5, 14, car.angle);
      document.getElementById('speedometer').textContent = `${Math.round(Math.abs(car.speed) * 8)} KM/H`;
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60 + Math.abs(car.speed) * 0.8, 0.08);
    } else {
      _v3a.set(
        (keys.d||keys.arrowright ? 1:0) - (keys.a||keys.arrowleft ? 1:0) + jx, 0,
        (keys.s||keys.arrowdown  ? 1:0) - (keys.w||keys.arrowup   ? 1:0) + jz
      );
      if (_v3a.lengthSq() > 0) {
        _v3a.normalize().applyAxisAngle(_UP, orbitY);
        character.speed = keys.shift ? 9.5 : 5.0;
        updateCharacterPosition(
          character.position, _v3a, character.speed, dt,
          world.getNearbyObstacles?.(character.position.x, character.position.z) ?? [],
          0.45, world
        );
      }
      character.snapToTerrain(world);
      character.update(dt, time, _v3a, world);
      setCamTarget(character.position, 5, 11, 0);
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60, 0.08);
    }

    // Name tag
    character.nameTag.visible = !isDriving;
    character.nameTag.position.set(
      character.bodyGroup.position.x,
      character.bodyGroup.position.y + 2.6,
      character.bodyGroup.position.z
    );

    // Remote peers
    for (const id in peers) {
      const p = peers[id]; if (!p?.char) continue;
      if (!p.driving) p.char.update(dt, time, _v3b.set(0,0,0), world);
      p.char.nameTag.position.set(
        p.char.bodyGroup.position.x,
        p.char.bodyGroup.position.y + 2.6,
        p.char.bodyGroup.position.z
      );
    }

    // NPCs — frustum-culled by distance
    for (const npc of npcs) {
      if (Math.hypot(npc.position.x - character.position.x, npc.position.z - character.position.z) < 70)
        npc.update(dt, time, world);
    }

    // Broadcast at 20 Hz (not every frame)
    _bcastTimer += dt;
    if (_bcastTimer >= 0.05) {
      _bcastTimer = 0;
      if (conns.length) _sendAll({
        type:'state',
        x: character.position.x, y: character.position.y, z: character.position.z,
        ry: character.bodyGroup.rotation.y, ww: character.walkWeight, drv: isDriving,
        carX: car.meshGroup.position.x, carY: car.meshGroup.position.y, carZ: car.meshGroup.position.z,
        carAngle: car.angle, carSpeed: car.speed, carSteer: car.steer
      });
    }

    // Camera smooth follow
    const lT = isDriving ? 1 - Math.pow(0.002, dt) : 1 - Math.pow(0.001, dt);
    camPos.lerp(desiredPos, lT);
    camTarget.lerp(desiredTarget, lT);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();

    // Move shadow map with player
    sun.target.position.copy(isDriving ? car.meshGroup.position : character.position);
    sun.target.updateMatrixWorld();
    sun.position.copy(sun.target.position).add(_v3a.set(80, 120, 50));

    world.update(time, isDriving ? car.meshGroup.position : character.position);
    renderer.render(scene, camera);
  }

  animate();
}