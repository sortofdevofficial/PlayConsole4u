import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

// ─── Core ────────────────────────────────────────────────────────────────────
let scene, camera, renderer, menuControls, clock;
let environment, player;
let raycaster, mouse;

const keys = { w:false, a:false, s:false, d:false, ' ':false, Shift:false };
let gameStarted = false;
let activeTool = 'brush', brushColor = '#c0392b', brushRadius = 20;

// Camera
let camYaw = 0, camPitch = 0.38, camZoom = 1;
let orbiting = false, dragMoved = false, lastMx = 0, lastMy = 0;

// Mobile
const mob = { x:0, z:0, sprint:false };
let joyActive=false, joyId=null, joyOrigin={x:0,y:0};

// ─── Auth & Firebase ─────────────────────────────────────────────────────────
let fbUser = null;
let myName = 'Player';
let myWins = 0;
let myKills = 0;
let myLikes = 0;
let roundKills = 0;

// ─── Multiplayer / Lobby ──────────────────────────────────────────────────────
let peer=null, myPeerId=null;
let conns = {};          
let remotePlayers = {};  
let lobbyMembers = {};   // peerId → { name, role, wins, uid }
const PLAYER_COLORS = ['#c8cdd4','#e8a0a0','#a0c8a0','#a0b8e8','#e8d0a0','#c8a0d0','#d0c0a0'];
let myColor = PLAYER_COLORS[Math.floor(Math.random()*PLAYER_COLORS.length)];
let myRole = null; 

// ─── Round System ─────────────────────────────────────────────────────────────
const ROUND_DURATION = 60; 
const TAG_DISTANCE   = 0.6; 
const MIN_PLAYERS    = 2;

let roundState = 'lobby'; 
let roundTimer  = 0;
let roundNumber = 0;
let taggedSeekers = new Set(); 
let amIHost = false; 

init();
animate();

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias:true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.01, 200);
    camera.position.set(0, 4, 8);

    menuControls = new OrbitControls(camera, renderer.domElement);
    menuControls.enableDamping = true; menuControls.dampingFactor = 0.08;
    menuControls.autoRotate = true; menuControls.autoRotateSpeed = 1.2;
    menuControls.enablePan = false; menuControls.enableZoom = false;
    menuControls.maxPolarAngle = Math.PI/2 - 0.05;

    environment = new Environment(scene);
    player = new Player(scene, myColor);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    window.addEventListener('keydown', e => {
        if (!gameStarted) return;
        if (e.code==='Space')  { e.preventDefault(); player.jump(); }
        if (e.code==='KeyF')   { player.toggleFreeze(); updateFreezeUI(); }
        if (e.key in keys)     keys[e.key] = true;
        if (e.code==='ShiftLeft'||e.code==='ShiftRight') keys.Shift=true;
    });
    window.addEventListener('keyup', e => {
        if (e.key in keys) keys[e.key] = false;
        if (e.code==='ShiftLeft'||e.code==='ShiftRight') keys.Shift=false;
    });

    window.addEventListener('pointerdown', e => {
        if (!gameStarted||e.button!==0) return;
        if (e.target.closest('.hud-panel')||e.target.closest('#mobile-controls')||e.target.closest('#round-overlay')) return;
        orbiting=true; dragMoved=false; lastMx=e.clientX; lastMy=e.clientY;
    });
    window.addEventListener('pointermove', e => {
        if (!orbiting||!gameStarted) return;
        const dx=e.clientX-lastMx, dy=e.clientY-lastMy;
        if (Math.abs(dx)+Math.abs(dy)>4) dragMoved=true;
        camYaw   -= dx*0.005;
        camPitch  = Math.max(0.08, Math.min(1.3, camPitch+dy*0.004));
        lastMx=e.clientX; lastMy=e.clientY;
    });
    window.addEventListener('pointerup', e => {
        if (!gameStarted||e.button!==0) return;
        if (!dragMoved && !e.target.closest('.hud-panel') && !e.target.closest('#mobile-controls')) handlePaint(e);
        orbiting=false;
    });
    window.addEventListener('contextmenu', e=>e.preventDefault());
    window.addEventListener('wheel', e=>{ camZoom=Math.max(0.3,Math.min(3,camZoom+e.deltaY*0.001)); });
    window.addEventListener('resize', () => {
        camera.aspect=window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth,window.innerHeight);
    });

    setupUI();
    setupFirebase();
    setupMobile();
}

function setupFirebase() {
    if (typeof FB==='undefined') return;
    FB.onAuthChange(async user => {
        fbUser = user;
        if (user) {
            myName = user.displayName||'Player';
            document.getElementById('user-name').textContent = myName;
            document.getElementById('user-avatar').src = user.photoURL||'';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('auth-gate').style.display = 'none';
            
            const stats = await FB.getStats ? await FB.getStats(user.uid) : await FB.getMatchStats(user.uid);
            myWins = stats.w||0; myKills = stats.k||0; myLikes = stats.likes||0;
            
            document.getElementById('menu-wins').textContent = myWins;
            document.getElementById('menu-likes').textContent = myLikes;
            
            document.getElementById('btn-play').disabled = false;
            document.getElementById('btn-play').textContent = 'JOIN LOBBY';
            updateLobbyStatus();
        } else {
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('auth-gate').style.display = 'block';
            document.getElementById('btn-play').disabled = true;
            document.getElementById('btn-play').textContent = 'Sign in to play';
        }
    });
    document.getElementById('btn-signin').addEventListener('click', ()=>FB.signInGoogle());
    document.getElementById('btn-signout').addEventListener('click', ()=>FB.signOut());
}

function setupUI() {
    document.getElementById('btn-play').addEventListener('click', () => {
        if (!fbUser) return;
        enterGame();
    });

    const picker=document.getElementById('html-color-picker');
    const hexLbl=document.getElementById('color-hex-label');
    picker.addEventListener('input', e=>{ brushColor=e.target.value; hexLbl.textContent=brushColor.toUpperCase(); });

    document.querySelectorAll('.tool-btn').forEach(b=>b.addEventListener('click',e=>{
        document.querySelectorAll('.tool-btn').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active');
        activeTool=e.currentTarget.dataset.tool;
    }));
    document.querySelectorAll('.size-btn').forEach(b=>b.addEventListener('click',e=>{
        document.querySelectorAll('.size-btn').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active');
        brushRadius=parseInt(e.currentTarget.dataset.radius);
    }));

    // Like Button Event Delegation
    document.getElementById('players-list').addEventListener('click', e => {
        const btn = e.target.closest('.p-like-btn');
        if (btn && window.FB) {
            const targetUid = btn.dataset.uid;
            if (targetUid) {
                // Instantly feedback in UI
                btn.classList.add('liked');
                btn.disabled = true;
                FB.likePlayer(targetUid);
            }
        }
    });
}

function enterGame() {
    document.getElementById('main-menu').style.display='none';
    document.getElementById('hud').style.display='block';
    gameStarted=true;
    menuControls.enabled=false;
    clock.getDelta();

    document.getElementById('hud-username').textContent=myName;
    document.getElementById('hud-avatar').src=fbUser?.photoURL||'';
    document.getElementById('hud-wins').textContent=myWins;
    document.getElementById('hud-likes').textContent=myLikes;

    player.setName(myName);
    player.group.position.set((Math.random()-0.5)*4, 0, (Math.random()-0.5)*4);

    if ('ontouchstart' in window) document.getElementById('mobile-controls').style.display='flex';

    initMultiplayer();
}

function updateFreezeUI() {
    document.getElementById('freeze-indicator').style.display = player.frozen ? 'block' : 'none';
}

function rebuildPlayersList() {
    const list = document.getElementById('players-list');
    list.innerHTML='';

    // Me
    const me = document.createElement('div');
    me.className='player-entry me';
    const roleIcon = myRole==='hunter'?'🔴':myRole==='seeker'?'🔵':'⚪';
    me.innerHTML=`<span class="p-dot" style="background:${myColor}"></span><span class="p-name">${myName}</span><span class="p-role">${roleIcon}</span><span class="p-wins">🏆${myWins}</span>`;
    list.appendChild(me);

    // Others
    Object.entries(lobbyMembers).forEach(([pid,m])=>{
        const el=document.createElement('div');
        el.className='player-entry';
        el.id='ple-'+pid;
        const ri=m.role==='hunter'?'🔴':m.role==='seeker'?'🔵':'⚪';
        const clr=remotePlayers[pid]?remotePlayers[pid].baseSkinColor:'#888';
        
        // Only show like button if we have their Firebase UID
        const likeHtml = m.uid ? `<button class="p-like-btn" data-uid="${m.uid}">❤️</button>` : '';
        
        el.innerHTML=`<span class="p-dot" style="background:${clr}"></span><span class="p-name">${m.name||'Player'}</span><span class="p-role">${ri}</span><span class="p-wins">🏆${m.wins||0}</span>${likeHtml}`;
        list.appendChild(el);
    });
}

function updateLobbyStatus() {
    const total=1+Object.keys(lobbyMembers).length;
    const need=Math.max(0,MIN_PLAYERS-total);
    const el=document.getElementById('lobby-status');
    if (el) el.textContent = need>0 ? `Need ${need} more player${need>1?'s':''} to start` : `${total} players in lobby`;
}

function electHost() {
    const allIds=[myPeerId,...Object.keys(conns)].sort();
    amIHost = allIds[0]===myPeerId;
}

function tryStartRound() {
    if (!amIHost) return;
    const total=1+Object.keys(conns).length;
    if (total<MIN_PLAYERS||roundState!=='lobby') return;
    broadcastAll({ type:'round_start', round: ++roundNumber });
    beginRound(roundNumber);
}

function beginRound(num) {
    roundState='countdown';
    roundNumber=num;
    taggedSeekers.clear();
    roundKills = 0;
    showOverlay(`Round ${num}`, 'Get ready…', 2500);

    setTimeout(()=>{
        const allIds=[myPeerId,...Object.keys(conns)];
        const hunterIdx=Math.floor(Math.random()*allIds.length);
        const hunterPid=allIds[hunterIdx];
        const roles={};
        allIds.forEach(pid=>{ roles[pid]=pid===hunterPid?'hunter':'seeker'; });

        if (amIHost) broadcastAll({ type:'roles', roles, round:roundNumber });
        applyRoles(roles);

        roundState='playing';
        roundTimer=ROUND_DURATION;
        updateRoundUI();
    }, 2500);
}

function applyRoles(roles) {
    myRole = roles[myPeerId];
    player.setRole(myRole);
    updateRoleBadge();

    Object.entries(roles).forEach(([pid,role])=>{
        if (remotePlayers[pid]) remotePlayers[pid].setRole(role);
        if (lobbyMembers[pid])  lobbyMembers[pid].role=role;
    });
    rebuildPlayersList();
}

function updateRoleBadge() {
    const panel=document.getElementById('role-panel');
    const badge=document.getElementById('role-badge');
    if (!myRole) { panel.style.display='none'; return; }
    panel.style.display='block';
    if (myRole==='hunter') {
        badge.textContent='🔴 YOU ARE THE HUNTER';
        badge.className='role-hunter';
    } else {
        badge.textContent='🔵 YOU ARE A SEEKER — HIDE!';
        badge.className='role-seeker';
    }
}

function updateRoundUI() {
    const lbl=document.getElementById('round-label');
    const tmr=document.getElementById('round-timer');
    if (roundState==='playing') {
        lbl.textContent=`Round ${roundNumber}`;
        tmr.textContent=`${Math.ceil(roundTimer)}s`;
    } else if (roundState==='lobby') {
        lbl.textContent='Lobby'; tmr.textContent='';
    } else if (roundState==='ended') {
        lbl.textContent='Round Over'; tmr.textContent='';
    }
}

function tickRound(delta) {
    if (roundState!=='playing') return;
    roundTimer-=delta;
    updateRoundUI();

    if (amIHost) {
        if (myRole==='hunter') {
            Object.entries(remotePlayers).forEach(([pid,rp])=>{
                if (taggedSeekers.has(pid)) return;
                if (lobbyMembers[pid]?.role!=='seeker') return;
                const dist=player.group.position.distanceTo(rp.group.position);
                if (dist<TAG_DISTANCE) {
                    taggedSeekers.add(pid);
                    roundKills++;
                    broadcastAll({ type:'tagged', pid, round:roundNumber });
                    handleTagged(pid);
                }
            });
        } else {
            Object.entries(remotePlayers).forEach(([pid,rp])=>{
                if (lobbyMembers[pid]?.role!=='hunter') return;
                const dist=player.group.position.distanceTo(rp.group.position);
                if (dist<TAG_DISTANCE && !taggedSeekers.has(myPeerId)) {
                    taggedSeekers.add(myPeerId);
                    broadcastAll({ type:'tagged', pid:myPeerId, round:roundNumber });
                    handleTagged(myPeerId);
                }
            });
        }

        const seekerIds=[myPeerId,...Object.keys(conns)].filter(pid=>{
            const role=pid===myPeerId?myRole:lobbyMembers[pid]?.role;
            return role==='seeker';
        });
        const allTagged=seekerIds.every(pid=>taggedSeekers.has(pid));

        if (allTagged||roundTimer<=0) {
            const hunterWon=allTagged;
            broadcastAll({ type:'round_end', hunterWon, round:roundNumber });
            endRound(hunterWon);
        }
    }
}

function handleTagged(pid) {
    taggedSeekers.add(pid);
    if (pid===myPeerId) {
        showOverlay('Tagged!','You were caught 😱', 2000);
        if (myRole==='seeker') { player.frozen=true; updateFreezeUI(); }
    }
    const el=document.getElementById('ple-'+pid);
    if (el) el.classList.add('tagged');
    rebuildPlayersList();
}

async function endRound(hunterWon) {
    roundState='ended';
    updateRoundUI();

    const iHunter=myRole==='hunter';
    const iWon=(iHunter&&hunterWon)||(!iHunter&&!hunterWon);

    let msg=hunterWon?'Hunter wins! All seekers tagged!':'Seekers escape! Time ran out!';
    let sub=iWon?'🎉 You win!':'😔 You lose';
    showOverlay(msg,sub,4000);

    if (fbUser) {
        if (iWon) {
            myWins++;
            document.getElementById('hud-wins').textContent=myWins;
            document.getElementById('menu-wins').textContent=myWins;
        }
        myKills += roundKills;
        const recordFn = FB.recordRound || FB.recordMatch;
        if (FB.recordRound) {
            await FB.recordRound(fbUser.uid, { won: iWon, kills: roundKills, role: myRole });
        } else {
            await FB.recordMatch(fbUser.uid, iWon);
        }
    }

    player.setRole(null); myRole=null;
    Object.values(remotePlayers).forEach(rp=>rp.setRole(null));
    Object.values(lobbyMembers).forEach(m=>m.role=null);
    player.frozen=false; updateFreezeUI();

    if (amIHost) {
        setTimeout(()=>{
            roundState='lobby';
            updateRoundUI();
            rebuildPlayersList();
            broadcastAll({ type:'lobby_reset' });
            setTimeout(tryStartRound,3000);
        }, 4500);
    }
}

function showOverlay(title,sub,duration) {
    const ov=document.getElementById('round-overlay');
    document.getElementById('overlay-title').textContent=title;
    document.getElementById('overlay-sub').textContent=sub;
    ov.style.display='flex';
    setTimeout(()=>{ ov.style.display='none'; },duration);
}

// ─── Multiplayer ──────────────────────────────────────────────────────────────
function initMultiplayer() {
    peer=new Peer(undefined,{
        host:'0.peerjs.com',port:443,secure:true,
        config:{iceServers:[{urls:'stun:stun.google.com:19302'}]}
    });
    peer.on('open', id=>{ myPeerId=id; firestoreAnnounce(); });
    peer.on('connection', conn=>onIncomingConn(conn));
    peer.on('error', err=>console.warn('[P2P]',err.type,err));
}

async function firestoreAnnounce() {
    if (typeof firebase==='undefined') return;
    const db=firebase.firestore();
    const lobbyDoc=db.collection('cc_lobby').doc('main');

    // Share our Firebase UID so others can like us!
    await lobbyDoc.set({
        [myPeerId]: { name:myName, wins:myWins, uid: fbUser?.uid, ts:Date.now() }
    },{ merge:true });

    window.addEventListener('beforeunload', ()=>{
        db.collection('cc_lobby').doc('main').update({
            [myPeerId]: firebase.firestore.FieldValue.delete()
        }).catch(()=>{});
    });

    lobbyDoc.onSnapshot(snap=>{
        const data=snap.data()||{};
        Object.entries(data).forEach(([pid,info])=>{
            if (pid===myPeerId) return;
            if (Date.now()-info.ts>30000) return; 
            if (!conns[pid]) {
                const c=peer.connect(pid,{
                    reliable:false,serialization:'json',
                    metadata:{name:myName,wins:myWins,uid:fbUser?.uid}
                });
                c.on('open',()=>onConnectionReady(c,pid,info.name,info.wins,info.uid));
            }
        });

        Object.keys(lobbyMembers).forEach(pid=>{
            if (!data[pid]) removePeer(pid);
        });

        updateLobbyStatus();
        electHost();

        lobbyDoc.update({ [myPeerId+'.ts']: Date.now() }).catch(()=>{});
    });

    setInterval(()=>{
        lobbyDoc.update({ [myPeerId+'.ts']: Date.now() }).catch(()=>{});
    },10000);
}

function onIncomingConn(conn) {
    conn.on('open',()=>{
        const pid=conn.peer;
        const meta=conn.metadata||{};
        onConnectionReady(conn,pid,meta.name,meta.wins,meta.uid);
    });
}

function onConnectionReady(conn,pid,name,wins,uid) {
    conns[pid]=conn;
    lobbyMembers[pid]={ name, wins:wins||0, role:null, uid:uid };

    const idx=Object.keys(remotePlayers).length%PLAYER_COLORS.length;
    const rp=new Player(scene,PLAYER_COLORS[idx],true);
    rp.setName(name||'Player');
    remotePlayers[pid]=rp;

    rebuildPlayersList();
    updateLobbyStatus();
    electHost();

    conn.on('data',data=>handlePeerData(pid,data));
    conn.on('close',()=>removePeer(pid));
    conn.on('error',()=>removePeer(pid));

    setTimeout(tryStartRound,1000);
}

function removePeer(pid) {
    if (remotePlayers[pid]) { remotePlayers[pid].destroy(); delete remotePlayers[pid]; }
    delete conns[pid];
    delete lobbyMembers[pid];
    const el=document.getElementById('ple-'+pid); if(el) el.remove();
    electHost();
    updateLobbyStatus();
    rebuildPlayersList();
}

function handlePeerData(pid,data) {
    if (!data||!data.type) return;
    switch(data.type) {
        case 'state':
            if (remotePlayers[pid]) remotePlayers[pid].applyRemoteState(data);
            break;
        case 'round_start':
            roundNumber=data.round;
            beginRound(roundNumber);
            break;
        case 'roles':
            applyRoles(data.roles);
            roundState='playing'; roundTimer=ROUND_DURATION; updateRoundUI();
            break;
        case 'tagged':
            handleTagged(data.pid);
            break;
        case 'round_end':
            if (roundState==='playing') endRound(data.hunterWon);
            break;
        case 'lobby_reset':
            roundState='lobby'; updateRoundUI();
            Object.values(remotePlayers).forEach(rp=>rp.setRole(null));
            player.setRole(null); myRole=null;
            rebuildPlayersList();
            break;
    }
}

function broadcastAll(data) {
    Object.values(conns).forEach(c=>{ try{c.send(data);}catch(e){} });
}

// ─── Paint ────────────────────────────────────────────────────────────────────
function handlePaint(e) {
    mouse.x=(e.clientX/window.innerWidth)*2-1;
    mouse.y=-(e.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects([...environment.targets,...player.paintableMeshes]);
    if (!hits.length) return;
    const hit=hits[0];
    if (player.paintableMeshes.includes(hit.object)&&hit.uv) {
        if (['brush','bucket','eraser'].includes(activeTool))
            player.executePaintMatrix(hit.object,hit.uv,brushColor,brushRadius,activeTool);
    } else if (activeTool==='picker') {
        brushColor='#'+hit.object.material.color.getHexString();
        document.getElementById('html-color-picker').value=brushColor;
        document.getElementById('color-hex-label').textContent=brushColor.toUpperCase();
    }
}

// ─── Camera ───────────────────────────────────────────────────────────────────
function updateCamera() {
    const target=player.group.position.clone(); target.y+=0.3;
    const dist=2*camZoom;
    camera.position.lerp(new THREE.Vector3(
        target.x+Math.sin(camYaw)*Math.cos(camPitch)*dist,
        target.y+Math.sin(camPitch)*dist,
        target.z+Math.cos(camYaw)*Math.cos(camPitch)*dist
    ),0.13);
    camera.lookAt(target);
}

// ─── Mobile ───────────────────────────────────────────────────────────────────
function setupMobile() {
    const zone=document.getElementById('joystick-zone');
    const knob=document.getElementById('joystick-knob');
    if(!zone) return; // simple guard
    zone.addEventListener('touchstart',e=>{
        e.preventDefault();
        const t=e.changedTouches[0];
        joyActive=true; joyId=t.identifier; joyOrigin={x:t.clientX,y:t.clientY};
    },{passive:false});
    window.addEventListener('touchmove',e=>{
        if (!joyActive) return;
        for (const t of e.changedTouches) {
            if (t.identifier!==joyId) continue;
            const dx=t.clientX-joyOrigin.x, dy=t.clientY-joyOrigin.y;
            const dist=Math.sqrt(dx*dx+dy*dy), max=40;
            const cx=Math.cos(Math.atan2(dy,dx))*Math.min(dist,max);
            const cy=Math.sin(Math.atan2(dy,dx))*Math.min(dist,max);
            knob.style.transform=`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px))`;
            mob.x=dx/max; mob.z=dy/max;
        }
    },{passive:true});
    const endJ=()=>{ joyActive=false; mob.x=0; mob.z=0; knob.style.transform='translate(-50%,-50%)'; };
    window.addEventListener('touchend',endJ);
    window.addEventListener('touchcancel',endJ);
    document.getElementById('mob-jump').addEventListener('touchstart',e=>{e.preventDefault();player.jump();},{passive:false});
    document.getElementById('mob-freeze').addEventListener('touchstart',e=>{e.preventDefault();player.toggleFreeze();updateFreezeUI();},{passive:false});
    const sb=document.getElementById('mob-sprint');
    sb.addEventListener('touchstart',e=>{e.preventDefault();mob.sprint=true;},{passive:false});
    sb.addEventListener('touchend',()=>mob.sprint=false);
}

// ─── Animate ──────────────────────────────────────────────────────────────────
let netT=0;
function animate() {
    requestAnimationFrame(animate);
    const delta=Math.min(clock.getDelta(),0.1);

    if (!gameStarted) { menuControls.update(); renderer.render(scene,camera); return; }

    const mk={
        w: keys.w||mob.z<-0.25,
        s: keys.s||mob.z>0.25,
        a: keys.a||mob.x<-0.25,
        d: keys.d||mob.x>0.25,
    };
    const sprinting=keys.Shift||mob.sprint;

    player.update(mk,sprinting,delta,environment.colliders);
    updateCamera();
    tickRound(delta);

    netT+=delta;
    if (netT>0.05) {
        netT=0;
        broadcastAll({ type:'state', ...player.getNetState(), name:myName });
    }

    renderer.render(scene,camera);
}