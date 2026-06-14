import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WobblyCharacter } from './character.js';
import { WorldMap } from './map.js';
import { Bamborghini, driveVehicle } from './Life/bamborghini.js';
import { NPC } from './Life/npc.js';
import { updateVehicleCollision, updateCharacterPosition } from './physics.js';

const WAYPOINTS = [
  {x:-20,z:-10},{x:10,z:-20},{x:30,z:0},{x:-15,z:25},{x:25,z:30},
  {x:-40,z:15},{x:5,z:40},{x:-30,z:-35},{x:45,z:-15},{x:0,z:50}
];
const PEER_LABELS = ['Player 2','Player 3','Player 4','Player 5'];
const PEER_COLORS = ['#ff6b6b','#6bffb8','#6b9fff','#ff6bef'];

// ── Pre-allocated vectors — zero GC per frame ─────────────────────────────
const _va  = new THREE.Vector3();
const _vb  = new THREE.Vector3();
const _UP  = new THREE.Vector3(0,1,0);
const _XA  = new THREE.Vector3(1,0,0);
const _sunOff = new THREE.Vector3(80,120,50);

export function startGame({ peer=null, connection=null, isMobile=false, isMultiplayer=false, isHost=true } = {}) {

  // ── RENDERER ─────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,           // OFF — biggest single perf win; we get FXAA below
    powerPreference: 'high-performance',
    stencil: false,             // not needed, saves memory
    depth: true,
  });
  renderer.setSize(innerWidth, innerHeight);
  // Mobile: 1x. Desktop: cap at 1.5x (not 2x) — barely visible diff, 44% fewer pixels
  renderer.setPixelRatio(isMobile ? 1 : Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type    = THREE.PCFShadowMap;   // PCFSoft is 4x slower
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.autoClear = true;
  document.body.appendChild(renderer.domElement);

  // ── SCENE ────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfdfff);
  // FogExp2 is cheap — hides pop-in and limits draw distance naturally
  scene.fog = new THREE.FogExp2(0xbfdfff, isMobile ? 0.010 : 0.006);

  // ── LIGHTING — minimum lights for maximum look ────────────────────────────
  // HemisphereLight = 0 shadow cost, adds sky/ground bounce for free
  const hemi = new THREE.HemisphereLight(0xddeeff, 0x7ab060, 1.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5e0, 2.2);
  sun.position.set(80, 120, 50);
  sun.castShadow = !isMobile;
  if (!isMobile) {
    // 1024 shadow map — sweet spot between quality and VRAM
    sun.shadow.mapSize.set(1024, 1024);
    // Tight frustum = sharp shadows, less wasted pixels
    Object.assign(sun.shadow.camera, { left:-80, right:80, top:80, bottom:-80, near:1, far:200 });
    sun.shadow.bias       = -0.0003;
    sun.shadow.normalBias = 0.015;
  }
  scene.add(sun);

  // Subtle fill light from opposite side — kills harsh dark shadows cheaply
  const fill = new THREE.DirectionalLight(0xaaccff, 0.35);
  fill.position.set(-60, 40, -80);
  scene.add(fill);

  // ── CAMERA ───────────────────────────────────────────────────────────────
  // Near=1 not 0.5 — avoids z-fighting on distant objects near clip
  const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 1, isMobile ? 600 : 1200);
  const camPos     = new THREE.Vector3();
  const camTarget  = new THREE.Vector3();
  const desiredPos = new THREE.Vector3();
  const desiredTgt = new THREE.Vector3();
  let orbitY = Math.PI, orbitX = 0.10;

  // ── WORLD ────────────────────────────────────────────────────────────────
  const world     = new WorldMap(scene, { cityRadius:110, treeDensity:2 });
  const character = new WobblyCharacter(scene, 'You', '#faff6e');
  const car       = new Bamborghini(scene, 0, -6);

  character.position.set(0, world.getElevation(0,0) + character.groundOffset, 0);
  character.bodyGroup.position.copy(character.position);
  car.meshGroup.position.y = world.getElevation(0,-6) + car.groundOffset;
  car._smoothGroundY = car.meshGroup.position.y - car.groundOffset;

  // NPCs — 3 max, distance-gated
  const npcs = [{x:-25,z:5},{x:15,z:-15},{x:35,z:20}].map(sp => {
    const n = new NPC(scene, sp.x, sp.z);
    n.setWaypoints(WAYPOINTS);
    n.position.y = world.getElevation(sp.x, sp.z) + n.groundOffset;
    return n;
  });

  // ── INPUT ────────────────────────────────────────────────────────────────
  const keys = {};
  let isDriving = false, dragging = false, lastX = 0, lastY = 0;
  const joy  = { active:false, id:-1, dx:0, dy:0, sx:0, sy:0 };
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
    orbitX  = THREE.MathUtils.clamp(orbitX - dy * 0.0025, -Math.PI/8, Math.PI/3.5);
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup',  () => dragging = false);
  window.addEventListener('wheel',    e  => {
    if (!isDriving) orbitX = THREE.MathUtils.clamp(orbitX + e.deltaY*0.0005, -Math.PI/8, Math.PI/3.5);
  }, { passive:true });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k==='f'||k==='enter') tryEnterExit();
    if (k==='p'||k===' ')    doPunch();
  });
  window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize',  () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  if (isMobile) _setupMobile();

  // ── PUNCH ────────────────────────────────────────────────────────────────
  function doPunch() {
    if (isDriving) return;
    character.punch?.();
    const RANGE = 2.5;
    for (const npc of npcs) {
      if (Math.hypot(npc.position.x-character.position.x, npc.position.z-character.position.z) < RANGE) {
        _va.set(npc.position.x-character.position.x, 0, npc.position.z-character.position.z).normalize();
        npc.applyKnockback?.(_va, 12);
      }
    }
    for (const id in peers) {
      const p = peers[id]; if (!p?.char) continue;
      if (Math.hypot(p.char.position.x-character.position.x, p.char.position.z-character.position.z) < RANGE)
        _sendAll({ type:'punch', dx:p.char.position.x-character.position.x, dz:p.char.position.z-character.position.z });
    }
  }

  // ── ENTER / EXIT ─────────────────────────────────────────────────────────
  function tryEnterExit() {
    if (isDriving) {
      isDriving = false;
      character.position.copy(car.meshGroup.position);
      character.position.x += Math.sin(car.angle - Math.PI/2) * 2.5;
      character.position.z += Math.cos(car.angle - Math.PI/2) * 2.5;
      character.snapToTerrain?.(world);
      character.setDrivingState?.(false);
      document.getElementById('speedometer').style.display = 'none';
    } else if (character.position.distanceToSquared(car.meshGroup.position) < 25) {
      isDriving = true;
      document.getElementById('speedometer').style.display = 'block';
    }
  }

  // ── CAMERA ───────────────────────────────────────────────────────────────
  function setCamTarget(pos, h, dist, angle) {
    _va.set(0, h, dist).applyAxisAngle(_UP, angle+orbitY).applyAxisAngle(_XA, orbitX);
    desiredPos.copy(pos).add(_va);
    if (desiredPos.y < pos.y + 1.5) desiredPos.y = pos.y + 1.5;
    desiredTgt.copy(pos); desiredTgt.y += h * 0.15;
  }

  // ── SHADOW FRUSTUM TRACKING ───────────────────────────────────────────────
  // Move shadow camera with player so shadows are always sharp where you are
  let _shadowTimer = 0;
  function _updateShadow(focus, dt) {
    _shadowTimer += dt;
    if (_shadowTimer < 0.1) return;   // update at 10 Hz — shadow needn't be per-frame
    _shadowTimer = 0;
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();
    sun.position.copy(focus).add(_sunOff);
  }

  // ── MULTIPLAYER ──────────────────────────────────────────────────────────
  const peers = {}, conns = [];
  let _pIdx = 0, _bcastTimer = 0;

  function _makeRemote() {
    const idx = (_pIdx++) % PEER_LABELS.length;
    const rc = new WobblyCharacter(scene, PEER_LABELS[idx], PEER_COLORS[idx]);
    const col = new THREE.Color(PEER_COLORS[idx]);
    if (rc.mat) { rc.mat.color.copy(col); [rc.torsoMesh, rc.head].forEach(m => { if(m) m.material = rc.mat; }); }
    return rc;
  }

  function _sendAll(data) {
    for (const c of conns) if (c.open) try { c.send(data); } catch {}
  }

  function _ensurePeer(id) {
    if (!peers[id]) peers[id] = { char:_makeRemote(), driving:false };
    return peers[id];
  }

  function setupConn(conn) {
    if (conns.includes(conn)) return;
    conns.push(conn);
    conn.open ? _ensurePeer(conn.peer) : conn.on('open', () => _ensurePeer(conn.peer));

    conn.on('data', d => {
      if (!d || d.type === 'ping') return;
      const p = _ensurePeer(conn.peer);
      if (d.type === 'state') {
        p.driving = !!d.drv;
        if (d.drv) {
          if (!isDriving) {
            car.meshGroup.position.set(d.carX, d.carY, d.carZ);
            car.angle = d.carAngle ?? 0; car.speed = d.carSpeed ?? 0; car.steer = d.carSteer ?? 0;
            car.meshGroup.rotation.set(0, car.angle, 0);
          }
          _vb.set(d.carX, d.carY, d.carZ);
          p.char.setDrivingState?.(true, _vb, d.carAngle??0, d.carSteer??0, 0, null, 1);
        } else {
          p.char.position.set(d.x, d.y, d.z);
          p.char.bodyGroup.position.set(d.x, d.y, d.z);
          p.char.bodyGroup.rotation.y = d.ry ?? 0;
          p.char.walkWeight = d.ww ?? 0;
          p.char.setDrivingState?.(false);
        }
      } else if (d.type === 'punch') {
        _va.set(d.dx, 0, d.dz).normalize();
        character.position.x += _va.x * 2.5;
        character.position.z += _va.z * 2.5;
        if (character._sq !== undefined) character._sq = 0.6;
      }
    });

    conn.on('close', () => {
      const p = peers[conn.peer];
      if (p?.char?.bodyGroup) scene.remove(p.char.bodyGroup);
      if (p?.char?.nameTag)   scene.remove(p.char.nameTag);
      delete peers[conn.peer];
      const i = conns.indexOf(conn); if (i !== -1) conns.splice(i, 1);
    });

    // Keepalive ping every 4s
    const hb = setInterval(() => { if (conn.open) try { conn.send({type:'ping'}); } catch {} else clearInterval(hb); }, 4000);
    conn.on('close', () => clearInterval(hb));
  }

  if (peer && isMultiplayer) {
    if (connection) setupConn(connection);
    if (isHost) peer.on('connection', conn => setupConn(conn));
  }

  // ── MOBILE SETUP ─────────────────────────────────────────────────────────
  function _setupMobile() {
    const joyZone = document.getElementById('joy-zone');
    const camZone = document.getElementById('cam-zone');
    document.getElementById('btn-enter')?.addEventListener('touchstart', e => { e.preventDefault(); tryEnterExit(); }, {passive:false});
    document.getElementById('btn-punch')?.addEventListener('touchstart', e => { e.preventDefault(); doPunch(); }, {passive:false});

    joyZone?.addEventListener('touchstart', e => {
      e.preventDefault(); const t = e.changedTouches[0];
      joy.active=true; joy.id=t.identifier; joy.sx=t.clientX; joy.sy=t.clientY; joy.dx=0; joy.dy=0;
    }, {passive:false});

    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          const rdx=t.clientX-joy.sx, rdy=t.clientY-joy.sy;
          const dist=Math.hypot(rdx,rdy)||1, r=Math.min(dist,40)/40;
          joy.dx=(rdx/dist)*r; joy.dy=(rdy/dist)*r;
          const k=document.getElementById('joy-knob');
          if (k) k.style.transform=`translate(calc(-50% + ${joy.dx*40}px),calc(-50% + ${joy.dy*40}px))`;
        }
        if (t.identifier === cam2.id) {
          orbitY -= (t.clientX-cam2.sx)*0.008;
          orbitX  = THREE.MathUtils.clamp(orbitX-(t.clientY-cam2.sy)*0.006, -Math.PI/8, Math.PI/3.5);
          cam2.sx=t.clientX; cam2.sy=t.clientY;
        }
      }
    }, {passive:true});

    window.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier===joy.id) { joy.active=false; joy.dx=0; joy.dy=0; const k=document.getElementById('joy-knob'); if(k) k.style.transform='translate(-50%,-50%)'; }
        if (t.identifier===cam2.id) cam2.active=false;
      }
    });

    camZone?.addEventListener('touchstart', e => {
      e.preventDefault(); const t=e.changedTouches[0];
      cam2.active=true; cam2.id=t.identifier; cam2.sx=t.clientX; cam2.sy=t.clientY;
    }, {passive:false});
  }

  // ── CLOCK ─────────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();

  // ── MAIN LOOP ─────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    const dt   = Math.min(clock.getDelta(), 0.05);  // cap at 50ms (20fps min)
    const time = clock.elapsedTime;
    const jx   = joy.active ? joy.dx : 0;
    const jz   = joy.active ? joy.dy : 0;

    const focusPos = isDriving ? car.meshGroup.position : character.position;

    // ── DRIVING ────────────────────────────────────────────────────────────
    if (isDriving) {
      const dk = isMobile ? { w:jz<-0.2, s:jz>0.2, a:jx<-0.2, d:jx>0.2 } : keys;

      // Use the realistic driveVehicle from bamborghini.js
      driveVehicle(car, dk, dt, world);
      updateVehicleCollision?.(car, world.getNearbyObstacles?.(car.meshGroup.position.x, car.meshGroup.position.z) ?? [], world);

      character.setDrivingState?.(true, car.meshGroup.position, car.angle, car.steer, time, null, -1);
      setCamTarget(car.meshGroup.position, 4.5, 14, car.angle);

      // Speed display (driveVehicle uses real units/s so *3.6 = km/h)
      const kmh = Math.abs(car.speed) * 3.6;
      document.getElementById('speedometer').textContent = `${Math.round(kmh)} KM/H`;

      // FOV breathing — wider when fast
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60 + Math.abs(car.speed)*0.12, 0.08);

    // ── WALKING ────────────────────────────────────────────────────────────
    } else {
      _va.set(
        (keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+jx, 0,
        (keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+jz
      );
      if (_va.lengthSq() > 0) {
        _va.normalize().applyAxisAngle(_UP, orbitY);
        character.speed = keys.shift ? 9.5 : 5.0;
        updateCharacterPosition(
          character.position, _va, character.speed, dt,
          world.getNearbyObstacles?.(character.position.x, character.position.z) ?? [],
          0.45, world
        );
      }
      character.snapToTerrain?.(world);
      character.update?.(dt, time, _va, world);
      setCamTarget(character.position, 5, 11, 0);
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60, 0.06);
    }

    // ── NAME TAGS ─────────────────────────────────────────────────────────
    character.nameTag.visible = !isDriving;
    character.nameTag.position.set(
      character.bodyGroup.position.x,
      character.bodyGroup.position.y + 2.6,
      character.bodyGroup.position.z
    );

    // ── REMOTE PEERS ─────────────────────────────────────────────────────
    for (const id in peers) {
      const p = peers[id]; if (!p?.char) continue;
      if (!p.driving) p.char.update?.(dt, time, _vb.set(0,0,0), world);
      p.char.nameTag?.position.set(p.char.bodyGroup.position.x, p.char.bodyGroup.position.y+2.6, p.char.bodyGroup.position.z);
    }

    // ── NPCs — distance gated ─────────────────────────────────────────────
    for (const npc of npcs) {
      if (Math.hypot(npc.position.x-focusPos.x, npc.position.z-focusPos.z) < 70)
        npc.update?.(dt, time, world);
    }

    // ── BROADCAST 20Hz ───────────────────────────────────────────────────
    _bcastTimer += dt;
    if (_bcastTimer >= 0.05 && conns.length) {
      _bcastTimer = 0;
      _sendAll({
        type:'state',
        x:character.position.x, y:character.position.y, z:character.position.z,
        ry:character.bodyGroup.rotation.y, ww:character.walkWeight, drv:isDriving,
        carX:car.meshGroup.position.x, carY:car.meshGroup.position.y, carZ:car.meshGroup.position.z,
        carAngle:car.angle, carSpeed:car.speed, carSteer:car.steer
      });
    } else if (_bcastTimer >= 0.05) {
      _bcastTimer = 0;
    }

    // ── SHADOW TRACKING ───────────────────────────────────────────────────
    if (!isMobile) _updateShadow(focusPos, dt);

    // ── CAMERA ───────────────────────────────────────────────────────────
    // Driving: snap fast. Walking: lag smoothly
    const lT = isDriving ? 1-Math.pow(0.001,dt) : 1-Math.pow(0.0004,dt);
    camPos.lerp(desiredPos, lT);
    camTarget.lerp(desiredTgt, lT);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    // Only call updateProjectionMatrix when FOV actually changed
    camera.updateProjectionMatrix();

    // ── WORLD (trees wind, grass) ─────────────────────────────────────────
    world.update(time, focusPos);

    renderer.render(scene, camera);
  }

  animate();
}