import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

let scene, camera, renderer, menuControls, clock;
let environment, player;
let raycaster, mouse;

const keys = { w:false, a:false, s:false, d:false, ' ':false, Shift:false };
let gameStarted = false;
let activeTool = 'brush', brushColor = '#ef4444', brushRadius = 20;

let camYaw = 0, camPitch = 0.38, camZoom = 1;
let orbiting = false, dragMoved = false, lastMx = 0, lastMy = 0;

const mob = { x:0, z:0, sprint:false };
let joyActive=false, joyId=null, joyOrigin={x:0,y:0};

let fbUser = null;
let myName = 'Player';
let myWins = 0, myLikes = 0;
let roundKills = 0; 

let peer=null, myPeerId=null;
let conns = {};          
let remotePlayers = {};  
let lobbyMembers = {};   
const PLAYER_COLORS = ['#38bdf8','#ef4444','#22c55e','#a855f7','#f59e0b','#ec4899','#e2e8f0'];
let myColor = PLAYER_COLORS[Math.floor(Math.random()*PLAYER_COLORS.length)];
let myRole = null; 

const ROUND_DURATION = 60; 
const TAG_DISTANCE   = 0.75; 
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

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias:true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 300);
    camera.position.set(0, 5, 10);

    menuControls = new OrbitControls(camera, renderer.domElement);
    menuControls.enableDamping = true; menuControls.dampingFactor = 0.05;
    menuControls.autoRotate = true; menuControls.autoRotateSpeed = 0.8;
    menuControls.enablePan = false; menuControls.enableZoom = false;

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
    
    // Cross-Device input pointer logic fixes
    const startProp = e => {
        if (!gameStarted||(e.pointerType==='mouse' && e.button!==0)) return;
        if (e.target.closest('.hud-panel')||e.target.closest('#mobile-controls')||e.target.closest('#round-overlay')||e.target.closest('#honor-screen')||e.target.closest('#mob-paint-toggle')) return;
        orbiting=true; dragMoved=false; lastMx=e.clientX; lastMy=e.clientY;
    };
    window.addEventListener('pointerdown', startProp);
    
    window.addEventListener('pointermove', e => {
        if (!orbiting||!gameStarted) return;
        const dx=e.clientX-lastMx, dy=e.clientY-lastMy;
        if (Math.abs(dx)+Math.abs(dy)>4) dragMoved=true;
        camYaw   -= dx*0.005;
        camPitch  = Math.max(0.05, Math.min(1.4, camPitch+dy*0.004));
        lastMx=e.clientX; lastMy=e.clientY;
    });
    
    window.addEventListener('pointerup', e => {
        if (!gameStarted) return;
        if (!dragMoved && !e.target.closest('.hud-panel') && !e.target.closest('#mobile-controls') && !e.target.closest('#honor-screen')) handlePaint(e);
        orbiting=false;
    });
    
    window.addEventListener('wheel', e=>{ camZoom=Math.max(0.4,Math.min(2.5,camZoom+e.deltaY*0.0008)); }, {passive:true});
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
            const authMsgEl = document.getElementById('auth-msg');
            const btnPlayEl = document.getElementById('btn-play');
            authMsgEl.textContent = "Verifying Access Session...";
            try {
                const stats = FB.getStats ? await FB.getStats(user.uid) : {w:0, likes:0};
                myWins = stats.w||0; myLikes = stats.likes||0;

                authMsgEl.textContent = ""; 
                myName = user.displayName||'Player';
                
                document.getElementById('user-name').textContent = myName;
                document.getElementById('user-avatar').src = user.photoURL||'';
                document.getElementById('user-info').style.display = 'flex';
                document.getElementById('auth-gate').style.display = 'none';
                document.getElementById('menu-wins').textContent = myWins;
                document.getElementById('menu-likes').textContent = myLikes;
                
                btnPlayEl.disabled = false;
                btnPlayEl.textContent = 'READY TO CONNECT';
                updateLobbyStatus();
            } catch (error) { authMsgEl.textContent = "Session Access Denied."; }
        } else {
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('auth-gate').style.display = 'block';
            document.getElementById('btn-play').disabled = true;
        }
    });
    document.getElementById('btn-signin').addEventListener('click', ()=>FB.signInGoogle());
    document.getElementById('btn-signout').addEventListener('click', ()=>FB.signOut());
}

function setupUI() {
    document.getElementById('btn-play').addEventListener('click', () => { if (fbUser) enterGame(); });
    const picker=document.getElementById('html-color-picker');
    const hexLbl=document.getElementById('color-hex-label');
    picker.addEventListener('input', e=>{ brushColor=e.target.value; hexLbl.textContent=brushColor.toUpperCase(); });
    document.querySelectorAll('.swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            brushColor = e.target.dataset.c; picker.value = brushColor;
            hexLbl.textContent = brushColor.toUpperCase();
        });
    });
    document.querySelectorAll('.tool-btn').forEach(b=>b.addEventListener('click',e=>{
        document.querySelectorAll('.tool-btn').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active'); activeTool=e.currentTarget.dataset.tool;
    }));
    document.querySelectorAll('.size-btn').forEach(b=>b.addEventListener('click',e=>{
        document.querySelectorAll('.size-btn').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active'); brushRadius=parseInt(e.currentTarget.dataset.r);
    }));
}

function enterGame() {
    document.getElementById('main-menu').style.display='none';
    document.getElementById('hud').style.display='block';
    gameStarted=true; menuControls.enabled=false;
    clock.getDelta();

    document.getElementById('hud-username').textContent=myName;
    document.getElementById('hud-avatar').src=fbUser?.photoURL||'';
    document.getElementById('hud-wins').textContent=myWins;

    player.setName(myName);
    player.group.position.set((Math.random()-0.5)*6, 1, (Math.random()-0.5)*6);

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('mobile-controls').style.display='flex';
    }
    initMultiplayer();
}

function updateFreezeUI() {
    document.getElementById('freeze-indicator').style.display = player.frozen ? 'block' : 'none';
}

function rebuildPlayersList() {
    const list = document.getElementById('players-list'); if(!list) return;
    list.innerHTML='';
    const me = document.createElement('div'); me.className='player-entry me';
    const roleIcon = myRole==='hunter'?'🔴':myRole==='spectator'?'👻':myRole==='seeker'?'🔵':'⚪';
    me.innerHTML=`<span class="p-dot" style="background:${myColor}"></span><span class="p-name">${myName}</span><span class="p-role">${roleIcon}</span><span class="p-wins">🏆${myWins}</span>`;
    list.appendChild(me);

    Object.entries(lobbyMembers).forEach(([pid,m])=>{
        const el=document.createElement('div'); el.className='player-entry';
        if (m.role === 'spectator') el.classList.add('spec');
        el.id='ple-'+pid;
        const ri=m.role==='hunter'?'🔴':m.role==='spectator'?'👻':m.role==='seeker'?'🔵':'⚪';
        const clr=remotePlayers[pid]?remotePlayers[pid].baseSkinColor:'#64748b';
        el.innerHTML=`<span class="p-dot" style="background:${clr}"></span><span class="p-name">${m.name||'Player'}</span><span class="p-role">${ri}</span><span class="p-wins">🏆${m.wins||0}</span>`;
        list.appendChild(el);
    });
}

function updateLobbyStatus() {
    const total=1+Object.keys(lobbyMembers).length;
    const need=Math.max(0,MIN_PLAYERS-total);
    const el=document.getElementById('lobby-status');
    if (el) el.textContent = need>0 ? `Awaiting incoming connections (${total}/${MIN_PLAYERS})` : `Lobby full (${total} players)`;
}

function electHost() {
    const allIds=[myPeerId,...Object.keys(conns)].sort();
    amIHost = allIds[0]===myPeerId;
}

function tryStartRound() {
    if (!amIHost || roundState!=='lobby') return;
    const total=1+Object.keys(conns).length;
    if (total<MIN_PLAYERS) return;
    broadcastAll({ type:'round_start', round: ++roundNumber });
    beginRound(roundNumber);
}

function beginRound(num) {
    roundState='countdown'; roundNumber=num; taggedSeekers.clear(); roundKills = 0;
    showOverlay(`Round ${num}`, 'Prepare to run fast!', 2000);
    setTimeout(()=>{
        const allIds=[myPeerId,...Object.keys(conns)];
        const hunterPid=allIds[Math.floor(Math.random()*allIds.length)];
        const roles={};
        allIds.forEach(pid=>{ roles[pid]=pid===hunterPid?'hunter':'seeker'; });
        if (amIHost) broadcastAll({ type:'roles', roles, round:roundNumber });
        applyRoles(roles);
        roundState='playing'; roundTimer=ROUND_DURATION; updateRoundUI();
    }, 2000);
}

function applyRoles(roles) {
    myRole = roles[myPeerId]; player.setRole(myRole); updateRoleBadge();
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
    if (myRole==='hunter') { badge.textContent='🔴 HUNTER TARGET THEM'; badge.className='role-hunter'; } 
    else if (myRole==='spectator') { badge.textContent='👻 SPECTATING VOID'; badge.className='role-seeker'; }
    else { badge.textContent='🔵 SEEKER — DASH OUT!'; badge.className='role-seeker'; }
}

function updateRoundUI() {
    const lbl=document.getElementById('round-label');
    const tmr=document.getElementById('round-timer');
    if (roundState==='playing') { lbl.textContent=`Round ${roundNumber}`; tmr.textContent=`${Math.ceil(roundTimer)}s`; } 
    else { lbl.textContent=roundState.toUpperCase(); tmr.textContent=''; }
}

function tickRound(delta) {
    if (roundState!=='playing') return;
    roundTimer-=delta; updateRoundUI();
    if (amIHost) {
        if (myRole==='hunter') {
            Object.entries(remotePlayers).forEach(([pid,rp])=>{
                if (taggedSeekers.has(pid) || lobbyMembers[pid]?.role!=='seeker') return;
                if (player.group.position.distanceTo(rp.group.position)<TAG_DISTANCE) {
                    taggedSeekers.add(pid); roundKills++;
                    broadcastAll({ type:'tagged', pid, round:roundNumber }); handleTagged(pid);
                }
            });
        } else if (myRole==='seeker') {
            Object.entries(remotePlayers).forEach(([pid,rp])=>{
                if (lobbyMembers[pid]?.role!=='hunter') return;
                if (player.group.position.distanceTo(rp.group.position)<TAG_DISTANCE && !taggedSeekers.has(myPeerId)) {
                    taggedSeekers.add(myPeerId);
                    broadcastAll({ type:'tagged', pid:myPeerId, round:roundNumber }); handleTagged(myPeerId);
                }
            });
        }
        const seekerIds=[myPeerId,...Object.keys(conns)].filter(pid=>(pid===myPeerId?myRole:lobbyMembers[pid]?.role)==='seeker');
        const allTagged = seekerIds.length > 0 && seekerIds.every(pid=>taggedSeekers.has(pid));
        if (allTagged||roundTimer<=0) {
            broadcastAll({ type:'round_end', hunterWon:allTagged, round:roundNumber }); endRound(allTagged);
        }
    }
}

function handleTagged(pid) {
    taggedSeekers.add(pid);
    if (pid===myPeerId && myRole==='seeker') {
        showOverlay('TAGGED!','Entering ghost profile...', 1500);
        player.frozen=true; updateFreezeUI(); 
    }
    rebuildPlayersList();
}

async function endRound(hunterWon) {
    roundState='ended'; updateRoundUI();
    const iWon=(myRole==='hunter'&&hunterWon)||(myRole==='seeker'&&!hunterWon);
    showOverlay(hunterWon?'HUNTER CAUGHT EVERYONE':'SEEKERS ESCAPED OUT', iWon?'🎉 DEFEAT ELUDED':'😔 OUTMATCHED', 2500);

    if (fbUser && myRole !== 'spectator' && iWon) {
        myWins++; document.getElementById('hud-wins').textContent=myWins;
        if (FB.recordRound) await FB.recordRound(fbUser.uid, { won: true, kills: roundKills, role: myRole });
    }
    setTimeout(() => { showHonorScreen(); }, 2500);

    player.setRole(null); myRole=null;
    Object.values(remotePlayers).forEach(rp=>rp.setRole(null));
    Object.values(lobbyMembers).forEach(m=>m.role=null);
    player.frozen=false; updateFreezeUI();

    if (amIHost) {
        setTimeout(()=>{
            roundState='lobby'; updateRoundUI(); rebuildPlayersList();
            broadcastAll({ type:'lobby_reset' }); setTimeout(tryStartRound,2000);
        }, 8500);
    }
}

function showOverlay(title,sub,duration) {
    const ov=document.getElementById('round-overlay');
    document.getElementById('overlay-title').textContent=title;
    document.getElementById('overlay-sub').textContent=sub;
    ov.style.display='flex'; setTimeout(()=>{ ov.style.display='none'; },duration);
}

function showHonorScreen() {
    const scr = document.getElementById('honor-screen');
    const list = document.getElementById('honor-list'); if(!list) return;
    list.innerHTML = '';
    Object.entries(lobbyMembers).forEach(([pid, m]) => {
        if (!m.uid || m.uid === fbUser.uid) return;
        const row = document.createElement('div'); row.className = 'honor-player-row';
        row.innerHTML = `<span class="honor-player-name">${m.name}</span><button class="honor-btn" data-uid="${m.uid}">❤️</button>`;
        list.appendChild(row);
    });
    list.querySelectorAll('.honor-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.currentTarget.classList.add('liked');
            if (FB.likePlayer) await FB.likePlayer(e.currentTarget.dataset.uid);
        });
    });
    scr.style.display = 'flex'; setTimeout(() => { scr.style.display = 'none'; }, 5500);
}

// ─── Direct P2P Mesh Handshakes (NO cc_lobby writes loops!) ───
function initMultiplayer() {
    peer=new Peer(undefined,{host:'0.peerjs.com',port:443,secure:true});
    peer.on('open', id=>{ myPeerId=id; connectToGlobalLobby(); });
    peer.on('connection', conn=>onIncomingConn(conn));
}

function connectToGlobalLobby() {
    // Write once on connection setup to announce peer location
    if (typeof firebase==='undefined') return;
    const presRef = firebase.firestore().collection('cc_lobby').doc(myPeerId);
    presRef.set({ name:myName, wins:myWins, uid:fbUser.uid, active:true });
    
    // Auto clear trace entries on close
    window.addEventListener('beforeunload', () => presRef.delete().catch(()=>{}));

    // Listen only to find newly arrived active peer signatures
    firebase.firestore().collection('cc_lobby').where('active','==',true).get().then(snap => {
        snap.forEach(doc => {
            const pid = doc.id;
            if (pid === myPeerId || conns[pid]) return;
            const info = doc.data();
            const c = peer.connect(pid,{reliable:false, metadata:{name:myName,wins:myWins,uid:fbUser.uid}});
            c.on('open',()=>onConnectionReady(c,pid,info.name,info.wins,info.uid));
        });
    });
}

function onIncomingConn(conn) {
    conn.on('open',()=>onConnectionReady(conn,conn.peer,conn.metadata.name,conn.metadata.wins,conn.metadata.uid));
}

function onConnectionReady(conn,pid,name,wins,uid) {
    if(conns[pid]) return;
    conns[pid]=conn; lobbyMembers[pid]={ name, wins:wins||0, role:null, uid };
    const rp=new Player(scene,PLAYER_COLORS[Object.keys(remotePlayers).length%PLAYER_COLORS.length],true);
    rp.setName(name||'Player'); remotePlayers[pid]=rp;

    if (amIHost && roundState === 'playing') {
        const syncRoles = {}; Object.keys(lobbyMembers).forEach(id => syncRoles[id] = lobbyMembers[id].role);
        syncRoles[pid] = 'spectator'; 
        broadcastAll({ type:'sync_state', roles:syncRoles, round:roundNumber, rTime:roundTimer }); applyRoles(syncRoles);
    }
    rebuildPlayersList(); updateLobbyStatus(); electHost();
    conn.on('data',data=>handlePeerData(pid,data));
    conn.on('close',()=>removePeer(pid)); conn.on('error',()=>removePeer(pid));
    setTimeout(tryStartRound,1000);
}

function removePeer(pid) {
    if (remotePlayers[pid]) { remotePlayers[pid].destroy(); delete remotePlayers[pid]; }
    delete conns[pid]; delete lobbyMembers[pid];
    electHost(); updateLobbyStatus(); rebuildPlayersList();
}

function handlePeerData(pid,data) {
    if (!data||!data.type) return;
    switch(data.type) {
        case 'state': if (remotePlayers[pid]) remotePlayers[pid].applyRemoteState(data); break;
        case 'round_start': roundNumber=data.round; beginRound(roundNumber); break;
        case 'roles': applyRoles(data.roles); roundState='playing'; roundTimer=ROUND_DURATION; updateRoundUI(); break;
        case 'sync_state': roundNumber=data.round; roundTimer=data.rTime; applyRoles(data.roles); roundState='playing'; updateRoundUI(); break;
        case 'tagged': handleTagged(data.pid); break;
        case 'round_end': if (roundState==='playing') endRound(data.hunterWon); break;
        case 'lobby_reset': roundState='lobby'; updateRoundUI(); Object.values(remotePlayers).forEach(rp=>rp.setRole(null)); player.setRole(null); myRole=null; rebuildPlayersList(); break;
    }
}

function broadcastAll(data) { Object.values(conns).forEach(c=>{ try{c.send(data);}catch(e){} }); }

function handlePaint(e) {
    mouse.x=(e.clientX/window.innerWidth)*2-1; mouse.y=-(e.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects([...environment.targets,...player.paintableMeshes]);
    if (!hits.length) return; const hit=hits[0];
    if (player.paintableMeshes.includes(hit.object)&&hit.uv) {
        if (['brush','bucket','eraser'].includes(activeTool)) player.executePaintMatrix(hit.object,hit.uv,brushColor,brushRadius,activeTool);
    } else if (activeTool==='picker') {
        brushColor='#'+hit.object.material.color.getHexString();
        document.getElementById('html-color-picker').value=brushColor;
        document.getElementById('color-hex-label').textContent=brushColor.toUpperCase();
    }
}

function updateCamera() {
    const target=player.group.position.clone(); target.y+=0.3; const dist=2.2*camZoom;
    camera.position.lerp(new THREE.Vector3(
        target.x+Math.sin(camYaw)*Math.cos(camPitch)*dist,
        target.y+Math.sin(camPitch)*dist,
        target.z+Math.cos(camYaw)*Math.cos(camPitch)*dist
    ),0.2);
    camera.lookAt(target);
}

function setupMobile() {
    const zone=document.getElementById('joystick-zone');
    const knob=document.getElementById('joystick-knob');
    if(!zone || !knob) return;
    zone.addEventListener('touchstart',e=>{
        e.preventDefault(); const t=e.changedTouches[0];
        joyActive=true; joyId=t.identifier; joyOrigin={x:t.clientX,y:t.clientY};
    },{passive:false});
    window.addEventListener('touchmove',e=>{
        if (!joyActive) return;
        for (const t of e.changedTouches) {
            if (t.identifier!==joyId) continue;
            const dx=t.clientX-joyOrigin.x, dy=t.clientY-joyOrigin.y;
            const dist=Math.sqrt(dx*dx+dy*dy), max=45;
            const cx=Math.cos(Math.atan2(dy,dx))*Math.min(dist,max);
            const cy=Math.sin(Math.atan2(dy,dx))*Math.min(dist,max);
            knob.style.transform=`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px))`;
            mob.x=dx/max; mob.z=dy/max;
        }
    },{passive:true});
    const endJ=()=>{ joyActive=false; mob.x=0; mob.z=0; knob.style.transform='translate(-50%,-50%)'; };
    window.addEventListener('touchend',endJ); window.addEventListener('touchcancel',endJ);
    document.getElementById('mob-jump').addEventListener('touchstart',e=>{e.preventDefault();player.jump();},{passive:false});
    document.getElementById('mob-freeze').addEventListener('touchstart',e=>{e.preventDefault();player.toggleFreeze();updateFreezeUI();},{passive:false});
    const sb=document.getElementById('mob-sprint');
    sb.addEventListener('touchstart',e=>{e.preventDefault();mob.sprint=true;},{passive:false});
    sb.addEventListener('touchend',()=>mob.sprint=false);
}

let netT=0;
function animate() {
    requestAnimationFrame(animate); const delta=Math.min(clock.getDelta(),0.05);
    if (!gameStarted) { menuControls.update(); renderer.render(scene,camera); return; }

    const mk={ w: keys.w||mob.z<-0.2, s: keys.s||mob.z>0.2, a: keys.a||mob.x<-0.2, d: keys.d||mob.x>0.2 };
    player.update(mk,keys.Shift||mob.sprint,delta,environment.colliders);
    updateCamera(); tickRound(delta);

    // 🕳️ VOID DEATH CHECK (Fell off the platform island!)
    if (player.group.position.y < -4.5) {
        if (roundState === 'playing') {
            if (myRole === 'seeker' && !taggedSeekers.has(myPeerId)) {
                taggedSeekers.add(myPeerId); broadcastAll({ type:'tagged', pid:myPeerId, round:roundNumber }); handleTagged(myPeerId);
            } else if (myRole === 'hunter' && amIHost) {
                broadcastAll({ type:'round_end', hunterWon: false, round:roundNumber }); endRound(false);
            }
        } else {
            player.group.position.set((Math.random()-0.5)*4, 4, (Math.random()-0.5)*4); player.velocity.set(0,0,0);
        }
    }
    netT+=delta;
    if (netT>0.045) { netT=0; broadcastAll({ type:'state', ...player.getNetState(), name:myName }); }
    renderer.render(scene,camera);
}