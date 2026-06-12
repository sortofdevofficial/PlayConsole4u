import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WobblyCharacter } from './character.js';
import { WorldMap } from './map.js';
import { Bamborghini } from './Life/bamborghini.js';
import { NPC } from './Life/npc.js';
import { updateVehicle, updateVehicleCollision, updateCharacterPosition } from './physics.js';

const NPC_WAYPOINTS = [
  {x:-20,z:-10},{x:10,z:-20},{x:30,z:0},{x:-15,z:25},{x:25,z:30},
  {x:-40,z:15},{x:5,z:40},{x:-30,z:-35},{x:45,z:-15},{x:0,z:50}
];

const PEER_LABELS = ['Player 2','Player 3','Player 4','Player 5'];
const PEER_COLORS = ['#ff6b6b','#6bffb8','#6b9fff','#ff6bef'];

export function startGame({ peer=null, connection=null, isMobile=false, isMultiplayer=false, isHost=true }={}) {

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias:!isMobile, powerPreference:'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile?1:1.5));
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.appendChild(renderer.domElement);

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfdfff);
  scene.fog = new THREE.Fog(0xbfdfff, isMobile?60:85, isMobile?200:320);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x97b36a, 1.35));
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.7);
  sun.position.set(60,90,30); sun.castShadow=!isMobile;
  if (!isMobile) {
    sun.shadow.mapSize.set(512,512);
    Object.assign(sun.shadow.camera,{left:-120,right:120,top:120,bottom:-120,near:1,far:220});
    sun.shadow.bias=-0.00015; sun.shadow.normalBias=0.02;
  }
  scene.add(sun);

  // ── Camera ────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.5, isMobile?1000:2000);
  const camPos=new THREE.Vector3(), camTarget=new THREE.Vector3();
  const desiredPos=new THREE.Vector3(), desiredTarget=new THREE.Vector3();
  const moveDir=new THREE.Vector3();
  const UP=new THREE.Vector3(0,1,0), X_AXIS=new THREE.Vector3(1,0,0);

  // ── World ─────────────────────────────────────────────────────────────────
  const worldMap = new WorldMap(scene, { cityRadius:130, treeDensity:2 });
  // Local player — label "You", yellow tag
  const character = new WobblyCharacter(scene, 'You', '#faff6e');
  const car = new Bamborghini(scene, 0, -6);
  character.position.set(0, worldMap.getElevation(0,0)+character.groundOffset, 0);
  character.bodyGroup.position.copy(character.position);
  car.meshGroup.position.y = worldMap.getElevation(0,-6)+car.groundOffset;

  // ── NPCs ──────────────────────────────────────────────────────────────────
  const npcs = [];
  const npcSpots = [{x:-25,z:5},{x:15,z:-15},{x:35,z:20},{x:-10,z:35},{x:20,z:10}];
  for (let i=0; i<npcSpots.length; i++) {
    const sp=npcSpots[i];
    const npc=new NPC(scene, sp.x, sp.z, i);
    npc.setWaypoints(NPC_WAYPOINTS);
    npc.position.y=worldMap.getElevation(sp.x,sp.z)+npc.groundOffset;
    npcs.push(npc);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const keys={};
  let isDriving=false, orbitY=Math.PI, orbitX=0.08;
  let lastX=0, lastY=0, dragging=false;
  const joy={active:false,id:-1,startX:0,startY:0,dx:0,dy:0};
  const camDrag={active:false,id:-1,startX:0,startY:0};

  window.addEventListener('mousedown',e=>{
    if(e.button!==0) return; dragging=true; lastX=e.clientX; lastY=e.clientY;
    if(!document.pointerLockElement) document.body.requestPointerLock();
  });
  window.addEventListener('mousemove',e=>{
    if(!dragging&&!document.pointerLockElement) return;
    const dx=document.pointerLockElement?e.movementX:e.clientX-lastX;
    const dy=document.pointerLockElement?e.movementY:e.clientY-lastY;
    orbitY-=dx*.0025; orbitX=THREE.MathUtils.clamp(orbitX-dy*.0025,-Math.PI/8,Math.PI/3.5);
    lastX=e.clientX; lastY=e.clientY;
  });
  window.addEventListener('mouseup',()=>dragging=false);
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase(); keys[k]=true;
    if(k==='f'||k==='enter') tryEnterExit();
    if(k==='p'||k===' ') doPunch();
  });
  window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    const joyZone=document.getElementById('joy-zone');
    const camZone=document.getElementById('cam-zone');
    document.getElementById('btn-enter')?.addEventListener('touchstart',e=>{e.preventDefault();tryEnterExit();},{passive:false});
    document.getElementById('btn-punch')?.addEventListener('touchstart',e=>{e.preventDefault();doPunch();},{passive:false});

    joyZone?.addEventListener('touchstart',e=>{
      e.preventDefault(); const t=e.changedTouches[0];
      joy.active=true;joy.id=t.identifier;joy.startX=t.clientX;joy.startY=t.clientY;joy.dx=0;joy.dy=0;
    },{passive:false});
    window.addEventListener('touchmove',e=>{
      for(const t of e.changedTouches){
        if(t.identifier===joy.id){
          const rdx=t.clientX-joy.startX,rdy=t.clientY-joy.startY;
          const dist=Math.hypot(rdx,rdy)||1,r=Math.min(dist,40)/40;
          joy.dx=(rdx/dist)*r; joy.dy=(rdy/dist)*r;
          const k=document.getElementById('joy-knob');
          if(k) k.style.transform=`translate(calc(-50% + ${joy.dx*40}px),calc(-50% + ${joy.dy*40}px))`;
        }
        if(t.identifier===camDrag.id){
          orbitY-=(t.clientX-camDrag.startX)*.008;
          orbitX=THREE.MathUtils.clamp(orbitX-(t.clientY-camDrag.startY)*.006,-Math.PI/8,Math.PI/3.5);
          camDrag.startX=t.clientX; camDrag.startY=t.clientY;
        }
      }
    },{passive:true});
    window.addEventListener('touchend',e=>{
      for(const t of e.changedTouches){
        if(t.identifier===joy.id){joy.active=false;joy.dx=0;joy.dy=0;const k=document.getElementById('joy-knob');if(k)k.style.transform='translate(-50%,-50%)';}
        if(t.identifier===camDrag.id) camDrag.active=false;
      }
    });
    camZone?.addEventListener('touchstart',e=>{
      e.preventDefault();const t=e.changedTouches[0];
      camDrag.active=true;camDrag.id=t.identifier;camDrag.startX=t.clientX;camDrag.startY=t.clientY;
    },{passive:false});
  }

  // ── Punch ─────────────────────────────────────────────────────────────────
  const _punchDir=new THREE.Vector3();
  function doPunch() {
    if (isDriving) return;
    character.punch();
    const RANGE=2.2;
    for (const npc of npcs) {
      const dx=npc.position.x-character.position.x, dz=npc.position.z-character.position.z;
      if (Math.hypot(dx,dz)<RANGE) {
        _punchDir.set(dx,0,dz).normalize();
        npc.applyKnockback(_punchDir, 9);
      }
    }
    for (const id in peers) {
      const p=peers[id]; if(!p?.char) continue;
      const dx=p.char.position.x-character.position.x, dz=p.char.position.z-character.position.z;
      if (Math.hypot(dx,dz)<RANGE) {
        for(const c of conns) if(c.peer===id&&c.open) try{c.send({type:'punch',dx,dz});}catch{}
      }
    }
  }

  // ── Multiplayer ───────────────────────────────────────────────────────────
  const peers={}, conns=[];
  const _zeroDir=new THREE.Vector3(), _rcp=new THREE.Vector3();
  let _peerIdx=0;

  function makeRemoteChar() {
    const idx=_peerIdx++%PEER_LABELS.length;
    const rc=new WobblyCharacter(scene, PEER_LABELS[idx], PEER_COLORS[idx]);
    const c=new THREE.Color(PEER_COLORS[idx]);
    rc.mat.color.copy(c);
    rc.torsoMesh.material=rc.mat; rc.head.material=rc.mat;
    return rc;
  }

  function setupConn(conn) {
    if(conns.includes(conn)) return;
    conns.push(conn);
    const onOpen=()=>{ if(!peers[conn.peer]) peers[conn.peer]={char:makeRemoteChar(),driving:false,rx:0,rs:0}; };
    if(conn.open) onOpen(); else conn.on('open',onOpen);

    conn.on('data',d=>{
      if(!d) return;
      if(!peers[conn.peer]) peers[conn.peer]={char:makeRemoteChar(),driving:false,rx:0,rs:0};
      const p=peers[conn.peer];
      if(d.type==='state'){
        p.driving=!!d.drv;
        if(d.drv){
          if(!isDriving){
            car.meshGroup.position.set(d.carX,d.carY,d.carZ);
            car.angle=d.carAngle??0;car.speed=d.carSpeed??0;car.steer=d.carSteer??0;
            car.meshGroup.rotation.set(0,car.angle,0);
            for(let i=0;i<car.wheels.length;i++) if(car.wheels[i].userData.isFront) car.wheels[i].rotation.y=car.steer*.32;
          }
          p.rx=d.carAngle??0;p.rs=d.carSteer??0;
          _rcp.set(d.carX,d.carY,d.carZ);
          p.char.setDrivingState(true,_rcp,p.rx,p.rs,0,null,1);
        } else {
          p.char.position.set(d.x,d.y,d.z);
          p.char.bodyGroup.position.set(d.x,d.y,d.z);
          p.char.bodyGroup.rotation.y=d.ry??0;
          p.char.walkWeight=d.ww??0;
          p.char.setDrivingState(false);
        }
      } else if(d.type==='punch'){
        const dir=new THREE.Vector3(d.dx,0,d.dz).normalize();
        character.position.x+=dir.x*2.5; character.position.z+=dir.z*2.5;
        character._sq=0.6;
      }
    });

    conn.on('close',()=>{
      const p=peers[conn.peer];
      if(p?.char?.bodyGroup) scene.remove(p.char.bodyGroup);
      if(p?.char?.nameTag) scene.remove(p.char.nameTag);
      delete peers[conn.peer];
      const i=conns.indexOf(conn); if(i!==-1) conns.splice(i,1);
    });
  }

  if(peer&&isMultiplayer){
    if(connection) setupConn(connection);
    if(isHost) peer.on('connection',conn=>setupConn(conn));
  }

  let _bcastTimer=0;
  function broadcast(){
    if(!conns.length) return;
    const d={type:'state',
      x:character.position.x,y:character.position.y,z:character.position.z,
      ry:character.bodyGroup.rotation.y,ww:character.walkWeight,drv:isDriving,
      carX:car.meshGroup.position.x,carY:car.meshGroup.position.y,carZ:car.meshGroup.position.z,
      carAngle:car.angle,carSpeed:car.speed,carSteer:car.steer
    };
    for(const c of conns) if(c.open) try{c.send(d);}catch{}
  }

  // ── Enter/exit ────────────────────────────────────────────────────────────
  function tryEnterExit(){
    if(isDriving){
      isDriving=false;
      character.position.copy(car.meshGroup.position);
      character.position.x+=Math.sin(car.angle-Math.PI/2)*2.5;
      character.position.z+=Math.cos(car.angle-Math.PI/2)*2.5;
      character.snapToTerrain(worldMap);
      character.setDrivingState(false);
      document.getElementById('speedometer').style.display='none';
    } else if(character.position.distanceToSquared(car.meshGroup.position)<25){
      isDriving=true;
      updateCam(car.meshGroup.position,4.5,14,car.angle,true);
      camPos.copy(desiredPos); camTarget.copy(desiredTarget);
      document.getElementById('speedometer').style.display='block';
    }
  }

  function updateCam(targetPos,h,dist,angle,lookLow=false){
    const off=new THREE.Vector3(0,h,dist).applyAxisAngle(UP,angle+orbitY).applyAxisAngle(X_AXIS,orbitX);
    desiredPos.copy(targetPos).add(off);
    if(desiredPos.y<targetPos.y+1.5) desiredPos.y=targetPos.y+1.5;
    desiredTarget.copy(targetPos);
    desiredTarget.y+=lookLow?.3:h*.15;
  }

  // ── Loop ──────────────────────────────────────────────────────────────────
  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.033);
    const time=clock.elapsedTime;
    const jx=joy.active?joy.dx:0, jz=joy.active?joy.dy:0;

    if(isDriving){
      if(isMobile){keys._w=jz<-.2;keys._s=jz>.2;keys._a=jx<-.2;keys._d=jx>.2;}
      const dk=isMobile?{w:keys._w,s:keys._s,a:keys._a,d:keys._d}:keys;
      updateVehicle(car,dk,dt,worldMap);
      updateVehicleCollision(car,worldMap.getNearbyObstacles(car.meshGroup.position.x,car.meshGroup.position.z),worldMap);
      character.setDrivingState(true,car.meshGroup.position,car.angle,car.steer,time,null,-1);
      updateCam(car.meshGroup.position,4.5,14,car.angle,true);
      document.getElementById('speedometer').textContent=`${Math.round(Math.abs(car.speed)*8)} KM/H`;
      camera.fov=THREE.MathUtils.lerp(camera.fov,60+Math.abs(car.speed)*.8,.08);
    } else {
      moveDir.set(
        (keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+jx,0,
        (keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+jz
      );
      if(moveDir.lengthSq()>0){
        moveDir.normalize().applyAxisAngle(UP,orbitY);
        character.speed=keys.shift?9.5:5.0;
        updateCharacterPosition(character.position,moveDir,character.speed,dt,
          worldMap.getNearbyObstacles(character.position.x,character.position.z),.45,worldMap);
      }
      character.snapToTerrain(worldMap);
      character.update(dt,time,moveDir,worldMap);
      updateCam(character.position,5,11,0,false);
      camera.fov=THREE.MathUtils.lerp(camera.fov,60,.08);
    }

    // Update name tag for local player (hidden when driving)
    character.nameTag.visible = !isDriving;
    character.nameTag.position.set(
      character.bodyGroup.position.x,
      character.bodyGroup.position.y + 2.6,
      character.bodyGroup.position.z
    );

    // Remote peers
    for(const id in peers){
      const p=peers[id]; if(!p?.char) continue;
      if(!p.driving) p.char.update(dt,time,_zeroDir,worldMap);
      // Update remote name tag
      p.char.nameTag.position.set(p.char.bodyGroup.position.x, p.char.bodyGroup.position.y+2.6, p.char.bodyGroup.position.z);
    }

    // NPCs
    for(const npc of npcs){
      const d2=Math.hypot(npc.position.x-character.position.x,npc.position.z-character.position.z);
      if(d2<70) npc.update(dt,time,worldMap);
    }

    camera.updateProjectionMatrix();
    _bcastTimer+=dt;
    if(_bcastTimer>=.05){broadcast();_bcastTimer=0;}

    const lT=isDriving?1-Math.pow(.002,dt):1-Math.pow(.001,dt);
    camPos.lerp(desiredPos,lT); camTarget.lerp(desiredTarget,lT);
    camera.position.copy(camPos); camera.lookAt(camTarget);

    const focus=isDriving?car.meshGroup.position:character.position;
    sun.target.position.copy(focus); sun.target.updateMatrixWorld();
    worldMap.update(time,focus);
    renderer.render(scene,camera);
  }
  animate();
}