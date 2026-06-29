import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

let scene, camera, renderer, menuControls, clock;
let environment, player;
let raycaster, mouse;

const keys = { w:false, a:false, s:false, d:false, Shift:false };
let gameStarted = false;
let activeTool = 'brush', brushColor = '#ef4444', brushRadius = 20;
let isPainting = false; // drag-to-paint state

let camYaw = 0, camPitch = 0.38, camZoom = 1;
let isPointerDown = false, dragMoved = false, lastMx = 0, lastMy = 0;

const mob = { x:0, z:0, sprint:false };
let joyActive=false, joyId=null, joyOrigin={x:0,y:0};

let fbUser = null, myName = 'Player', myWins = 0, myLikes = 0, roundKills = 0;

let peer=null, myPeerId=null;
let conns={}, remotePlayers={}, lobbyMembers={};
const PLAYER_COLORS = ['#38bdf8','#ef4444','#22c55e','#a855f7','#f59e0b','#ec4899','#e2e8f0'];
let myColor = PLAYER_COLORS[Math.floor(Math.random()*PLAYER_COLORS.length)];
let myRole = null;

const ROUND_DURATION=60, TAG_DISTANCE=0.95, MIN_PLAYERS=2;
let roundState='lobby', roundTimer=0, roundNumber=0;
let taggedSeekers=new Set(), amIHost=false;

let rtdbPresRef = null; // RTDB presence ref

init();
animate();

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    renderer = new THREE.WebGLRenderer({ canvas:document.getElementById('canvas3d'), antialias:true, powerPreference:'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 300);
    camera.position.set(0, 5, 10);

    menuControls = new OrbitControls(camera, renderer.domElement);
    menuControls.enableDamping=true; menuControls.dampingFactor=0.05;
    menuControls.autoRotate=true; menuControls.autoRotateSpeed=0.8;
    menuControls.enablePan=false; menuControls.enableZoom=false;

    environment = new Environment(scene);
    player = new Player(scene, myColor);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // ── Keys — robust cross-device (code + key fallback)
    const setKey = (e, val) => {
        const c = e.code, k = e.key?.toLowerCase();
        if (c==='KeyW'||k==='w'||c==='ArrowUp')    keys.w=val;
        if (c==='KeyA'||k==='a'||c==='ArrowLeft')  keys.a=val;
        if (c==='KeyS'||k==='s'||c==='ArrowDown')  keys.s=val;
        if (c==='KeyD'||k==='d'||c==='ArrowRight') keys.d=val;
        if (c==='ShiftLeft'||c==='ShiftRight'||k==='shift') keys.Shift=val;
    };
    window.addEventListener('keydown', e => {
        if (!gameStarted) return;
        if (e.code==='Space') { e.preventDefault(); player.jump(); return; }
        if (e.code==='KeyF')  { player.toggleFreeze(); updateFreezeUI(); return; }
        setKey(e, true);
    });
    window.addEventListener('keyup', e => { setKey(e, false); });
    // Release all keys when window loses focus (prevents stuck keys)
    window.addEventListener('blur', () => { keys.w=keys.a=keys.s=keys.d=keys.Shift=false; });

    // ── Pointer: left drag = paint, right drag = orbit
    window.addEventListener('pointerdown', e => {
        if (!gameStarted) return;
        if (e.target.closest('.hud-panel')||e.target.closest('#mobile-controls')||e.target.closest('#round-overlay')||e.target.closest('#honor-screen')||e.target.closest('#mob-paint-toggle')) return;
        isPointerDown=true; dragMoved=false; lastMx=e.clientX; lastMy=e.clientY;
        // Left click starts painting immediately
        if (e.button===0) { isPainting=true; tryPaint(e); }
    });

    window.addEventListener('pointermove', e => {
        if (!gameStarted||!isPointerDown) return;
        const dx=e.clientX-lastMx, dy=e.clientY-lastMy;
        if (Math.abs(dx)+Math.abs(dy)>3) dragMoved=true;
        lastMx=e.clientX; lastMy=e.clientY;

        if (e.buttons===1 && isPainting) {
            // Left drag = continuous paint
            tryPaint(e);
        } else if (e.buttons===2 || (e.buttons===1 && !isPainting)) {
            // Right drag = orbit camera
            camYaw  -= dx*0.005;
            camPitch = Math.max(0.05, Math.min(1.4, camPitch+dy*0.004));
        }
    });

    window.addEventListener('pointerup', e => {
        if (e.button===0) isPainting=false;
        isPointerDown=false;
    });

    // Right click drag for orbit (no context menu)
    window.addEventListener('contextmenu', e=>e.preventDefault());
    renderer.domElement.addEventListener('pointerdown', e => {
        if (e.button===2) { isPointerDown=true; lastMx=e.clientX; lastMy=e.clientY; }
    });

    window.addEventListener('wheel', e=>{ camZoom=Math.max(0.4,Math.min(2.5,camZoom+e.deltaY*0.0008)); },{passive:true});
    window.addEventListener('resize', ()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); });

    setupUI();
    setupFirebase();
    setupMobile();
}

// ── Firebase / Auth ──────────────────────────────────────────────────────────
function setupFirebase() {
    if (typeof FB==='undefined') return;
    FB.onAuthChange(async user => {
        fbUser=user;
        if (user) {
            document.getElementById('auth-msg').textContent='Verifying Lite access…';
            try {
                // Check Lite subscription
                const sub = await FB.getSubscription(user.uid);
                if (!sub.active) {
                    document.getElementById('auth-msg').textContent='❌ No active Lite subscription. Purchase in Discord.';
                    document.getElementById('btn-play').disabled=true;
                    document.getElementById('btn-play').textContent='Lite Required';
                    // Still show user info
                    document.getElementById('user-name').textContent=user.displayName||'Player';
                    document.getElementById('user-avatar').src=user.photoURL||'';
                    document.getElementById('user-info').style.display='flex';
                    document.getElementById('auth-gate').style.display='none';
                    return;
                }
                const stats = await FB.getStats(user.uid);
                myWins=stats.w||0; myLikes=stats.likes||0;
                myName=user.displayName||'Player';
                document.getElementById('user-name').textContent=myName;
                document.getElementById('user-avatar').src=user.photoURL||'';
                document.getElementById('user-info').style.display='flex';
                document.getElementById('auth-gate').style.display='none';
                document.getElementById('menu-wins').textContent=myWins;
                document.getElementById('menu-likes').textContent=myLikes;
                document.getElementById('auth-msg').textContent='';
                document.getElementById('btn-play').disabled=false;
                document.getElementById('btn-play').textContent='JOIN LOBBY';
                updateLobbyStatus();
            } catch(err) { document.getElementById('auth-msg').textContent='Error verifying access.'; }
        } else {
            document.getElementById('user-info').style.display='none';
            document.getElementById('auth-gate').style.display='block';
            document.getElementById('btn-play').disabled=true;
        }
    });
    document.getElementById('btn-signin').addEventListener('click', ()=>FB.signInGoogle());
    document.getElementById('btn-signout').addEventListener('click', ()=>FB.signOut());
}

function setupUI() {
    document.getElementById('btn-play').addEventListener('click', ()=>{ if(fbUser) enterGame(); });
    const picker=document.getElementById('html-color-picker');
    const hexLbl=document.getElementById('color-hex-label');
    picker.addEventListener('input', e=>{ brushColor=e.target.value; hexLbl.textContent=brushColor.toUpperCase(); });
    document.querySelectorAll('.swatch').forEach(s=>{
        s.addEventListener('click', e=>{ brushColor=e.target.dataset.c; picker.value=brushColor; hexLbl.textContent=brushColor.toUpperCase(); });
    });
    document.querySelectorAll('.tool-btn').forEach(b=>b.addEventListener('click',e=>{
        document.querySelectorAll('.tool-btn').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active'); activeTool=e.currentTarget.dataset.tool;
    }));
    document.querySelectorAll('.size-btn').forEach(b=>b.addEventListener('click',e=>{
        document.querySelectorAll('.size-btn').forEach(x=>x.classList.remove('active'));
        e.currentTarget.classList.add('active'); brushRadius=parseInt(e.currentTarget.dataset.r);
    }));

    // Mobile paint panel toggle
    const tog=document.getElementById('mob-paint-toggle');
    if(tog) tog.addEventListener('click',()=>{
        const st=document.getElementById('sidebar-tools');
        if(st) st.style.display=st.style.display==='none'?'flex':'none';
    });
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
    if ('ontouchstart' in window||navigator.maxTouchPoints>0) {
        document.getElementById('mobile-controls').style.display='flex';
        document.getElementById('mob-paint-toggle').style.display='block';
    }
    initMultiplayer();
}

function updateFreezeUI() {
    document.getElementById('freeze-indicator').style.display=player.frozen?'block':'none';
}

function rebuildPlayersList() {
    const list=document.getElementById('players-list'); if(!list) return;
    list.innerHTML='';
    const me=document.createElement('div'); me.className='player-entry me';
    const ri=myRole==='hunter'?'🔴':myRole==='seeker'?'🔵':'⚪';
    me.innerHTML=`<span class="p-dot" style="background:${myColor}"></span><span class="p-name">${myName}</span><span class="p-role">${ri}</span><span class="p-wins">🏆${myWins}</span>`;
    list.appendChild(me);
    Object.entries(lobbyMembers).forEach(([pid,m])=>{
        const el=document.createElement('div'); el.className='player-entry'; el.id='ple-'+pid;
        const ri2=m.role==='hunter'?'🔴':m.role==='seeker'?'🔵':'⚪';
        const clr=remotePlayers[pid]?remotePlayers[pid].baseSkinColor:'#64748b';
        el.innerHTML=`<span class="p-dot" style="background:${clr}"></span><span class="p-name">${m.name||'?'}</span><span class="p-role">${ri2}</span><span class="p-wins">🏆${m.wins||0}</span>`;
        list.appendChild(el);
    });
}

function updateLobbyStatus() {
    const total=1+Object.keys(lobbyMembers).length;
    const need=Math.max(0,MIN_PLAYERS-total);
    const el=document.getElementById('lobby-status');
    if(el) el.textContent=need>0?`Need ${need} more player${need>1?'s':''}`:`${total} players — starting soon`;
}

function electHost() {
    const allIds=[myPeerId,...Object.keys(conns)].sort();
    amIHost=allIds[0]===myPeerId;
}

// ── Round ────────────────────────────────────────────────────────────────────
function tryStartRound() {
    if (!amIHost||roundState!=='lobby') return;
    if (1+Object.keys(conns).length<MIN_PLAYERS) return;
    broadcastAll({type:'round_start',round:++roundNumber});
    beginRound(roundNumber);
}

function beginRound(num) {
    roundState='countdown'; roundNumber=num; taggedSeekers.clear(); roundKills=0;
    showOverlay(`Round ${num}`,'Prepare!',2000);
    setTimeout(()=>{
        const allIds=[myPeerId,...Object.keys(conns)];
        const hunterPid=allIds[Math.floor(Math.random()*allIds.length)];
        const roles={}; allIds.forEach(pid=>{ roles[pid]=pid===hunterPid?'hunter':'seeker'; });
        if(amIHost) broadcastAll({type:'roles',roles,round:roundNumber});
        applyRoles(roles);
        roundState='playing'; roundTimer=ROUND_DURATION; updateRoundUI();
    },2000);
}

function applyRoles(roles) {
    myRole=roles[myPeerId]; player.setRole(myRole); updateRoleBadge();
    Object.entries(roles).forEach(([pid,role])=>{
        if(remotePlayers[pid]) remotePlayers[pid].setRole(role);
        if(lobbyMembers[pid]) lobbyMembers[pid].role=role;
    });
    rebuildPlayersList();
}

function updateRoleBadge() {
    const panel=document.getElementById('role-panel'), badge=document.getElementById('role-badge');
    if(!myRole){panel.style.display='none';return;}
    panel.style.display='block';
    badge.textContent=myRole==='hunter'?'🔴 HUNTER':'🔵 SEEKER';
    badge.className=myRole==='hunter'?'role-hunter':'role-seeker';
}

function updateRoundUI() {
    const lbl=document.getElementById('round-label'), tmr=document.getElementById('round-timer');
    if(roundState==='playing'){lbl.textContent=`Round ${roundNumber}`;tmr.textContent=`${Math.ceil(roundTimer)}s`;}
    else{lbl.textContent=roundState.toUpperCase();tmr.textContent='';}
}

function tickRound(delta) {
    if(roundState!=='playing') return;
    roundTimer-=delta; updateRoundUI();
    if(!amIHost) return;

    // Tag detection
    if(myRole==='hunter') {
        Object.entries(remotePlayers).forEach(([pid,rp])=>{
            if(taggedSeekers.has(pid)||lobbyMembers[pid]?.role!=='seeker') return;
            if(player.group.position.distanceTo(rp.group.position)<TAG_DISTANCE) {
                taggedSeekers.add(pid); roundKills++;
                broadcastAll({type:'tagged',pid,round:roundNumber}); handleTagged(pid);
            }
        });
    } else if(myRole==='seeker') {
        Object.entries(remotePlayers).forEach(([pid,rp])=>{
            if(lobbyMembers[pid]?.role!=='hunter') return;
            if(player.group.position.distanceTo(rp.group.position)<TAG_DISTANCE&&!taggedSeekers.has(myPeerId)) {
                taggedSeekers.add(myPeerId);
                broadcastAll({type:'tagged',pid:myPeerId,round:roundNumber}); handleTagged(myPeerId);
            }
        });
    }

    const seekerIds=[myPeerId,...Object.keys(conns)].filter(pid=>(pid===myPeerId?myRole:lobbyMembers[pid]?.role)==='seeker');
    const allTagged=seekerIds.length>0&&seekerIds.every(pid=>taggedSeekers.has(pid));
    if(allTagged||roundTimer<=0) {
        broadcastAll({type:'round_end',hunterWon:allTagged,round:roundNumber}); endRound(allTagged);
    }
}

function handleTagged(pid) {
    taggedSeekers.add(pid);
    if(pid===myPeerId&&myRole==='seeker'){showOverlay('TAGGED!','You\'re spectating…',1500);player.frozen=true;updateFreezeUI();}
    rebuildPlayersList();
}

async function endRound(hunterWon) {
    roundState='ended'; updateRoundUI();
    const iWon=(myRole==='hunter'&&hunterWon)||(myRole==='seeker'&&!hunterWon);
    showOverlay(hunterWon?'HUNTER WINS':'SEEKERS ESCAPE',iWon?'🎉 You win!':'😔 You lose',2500);

    // Save stats to users/{uid}/G/CC
    if(fbUser&&myRole) {
        if(iWon) { myWins++; document.getElementById('hud-wins').textContent=myWins; }
        if(FB.recordRound) await FB.recordRound(fbUser.uid,{won:iWon,kills:roundKills,role:myRole});
    }

    setTimeout(()=>showHonorScreen(),2600);

    player.setRole(null); myRole=null;
    Object.values(remotePlayers).forEach(rp=>rp.setRole(null));
    Object.values(lobbyMembers).forEach(m=>m.role=null);
    player.frozen=false; updateFreezeUI();

    if(amIHost) setTimeout(()=>{
        roundState='lobby'; updateRoundUI(); rebuildPlayersList();
        broadcastAll({type:'lobby_reset'}); setTimeout(tryStartRound,2000);
    },9000);
}

function showOverlay(title,sub,dur) {
    const ov=document.getElementById('round-overlay');
    document.getElementById('overlay-title').textContent=title;
    document.getElementById('overlay-sub').textContent=sub;
    ov.style.display='flex'; setTimeout(()=>ov.style.display='none',dur);
}

function showHonorScreen() {
    const scr=document.getElementById('honor-screen'), list=document.getElementById('honor-list');
    if(!list) return;
    list.innerHTML='<p class="honor-sub">Give a like to players you enjoyed playing with:</p>';
    Object.entries(lobbyMembers).forEach(([pid,m])=>{
        if(!m.uid||m.uid===fbUser?.uid) return;
        const row=document.createElement('div'); row.className='honor-player-row';
        row.innerHTML=`<span style="color:#f1f5f9;font-size:.85rem">${m.name||'Player'}</span><button class="honor-btn" data-uid="${m.uid}">❤️ Like</button>`;
        list.appendChild(row);
    });
    list.querySelectorAll('.honor-btn').forEach(btn=>{
        btn.addEventListener('click',async e=>{
            e.currentTarget.disabled=true; e.currentTarget.classList.add('liked');
            if(FB.likePlayer) await FB.likePlayer(e.currentTarget.dataset.uid);
        });
    });
    scr.style.display='flex';
    setTimeout(()=>scr.style.display='none',6000);
}

// ── Multiplayer — RTDB presence (onDisconnect auto-removes on crash/close) ───
function initMultiplayer() {
    peer=new Peer(undefined,{host:'0.peerjs.com',port:443,secure:true,config:{iceServers:[{urls:'stun:stun.google.com:19302'}]}});
    peer.on('open', id=>{ myPeerId=id; setupPresence(); });
    peer.on('connection', conn=>{ conn.on('open',()=>onConnectionReady(conn,conn.peer,conn.metadata?.name,conn.metadata?.wins,conn.metadata?.uid)); });
    peer.on('error', err=>console.warn('[P2P]',err.type));
}

function setupPresence() {
    if(typeof firebase==='undefined'||typeof firebase.database==='undefined') {
        console.warn('[P2P] RTDB not available'); return;
    }
    const db = firebase.database();
    // /cc_presence/{myPeerId} — ephemeral, never persisted to Firestore
    rtdbPresRef = db.ref('cc_presence/' + myPeerId);

    const presData = { peerId:myPeerId, name:myName, wins:myWins, uid:fbUser.uid, t:Date.now() };

    // onDisconnect fires on the SERVER when connection drops (crash, kill, network loss)
    // This is the ONLY reliable way to clean up presence — Firestore has no equivalent
    rtdbPresRef.onDisconnect().remove();
    rtdbPresRef.set(presData);

    // Watch /cc_presence for all players — O(players), fires only on join/leave
    db.ref('cc_presence').on('value', snap => {
        const live = new Set();
        snap.forEach(child => {
            const d = child.val();
            const pid = d.peerId;
            if (!pid || pid === myPeerId) return;
            live.add(pid);
            if (!conns[pid]) {
                const c = peer.connect(pid,{reliable:false,serialization:'json',metadata:{name:myName,wins:myWins,uid:fbUser.uid}});
                c.on('open',()=>onConnectionReady(c,pid,d.name,d.wins,d.uid));
            }
        });
        // Remove peers who left
        Object.keys(conns).forEach(pid=>{ if(!live.has(pid)) removePeer(pid); });
    });

    // Clean up on tab close/crash — RTDB onDisconnect handles server side,
    // but we also do client-side cleanup so peers disconnect faster
    const cleanupAll = () => {
        // Remove RTDB presence node immediately (server onDisconnect is the fallback)
        try { rtdbPresRef.remove(); } catch(e){}
        // Close all PeerJS connections so remote peers get 'close' event instantly
        Object.values(conns).forEach(c=>{ try{c.close();}catch(e){} });
        try { peer.destroy(); } catch(e){}
    };
    window.addEventListener('beforeunload', cleanupAll);
    window.addEventListener('pagehide',     cleanupAll); // iOS Safari
    window.addEventListener('visibilitychange', ()=>{
        if (document.visibilityState==='hidden') {
            // On mobile, hidden often means killed — run cleanup defensively
            try { rtdbPresRef.remove(); } catch(e){}
        }
    });
}

function onConnectionReady(conn,pid,name,wins,uid) {
    if(conns[pid]) return;
    conns[pid]=conn;
    lobbyMembers[pid]={name,wins:wins||0,role:null,uid};
    const rp=new Player(scene,PLAYER_COLORS[Object.keys(remotePlayers).length%PLAYER_COLORS.length],true);
    rp.setName(name||'Player'); remotePlayers[pid]=rp;

    conn.on('data',data=>handlePeerData(pid,data));
    conn.on('close',()=>removePeer(pid));
    conn.on('error',()=>removePeer(pid));

    if(amIHost&&roundState==='playing') {
        const syncRoles={};
        Object.keys(lobbyMembers).forEach(id=>syncRoles[id]=lobbyMembers[id].role);
        syncRoles[pid]='spectator';
        conn.send({type:'sync_state',roles:syncRoles,round:roundNumber,rTime:roundTimer});
        applyRoles(syncRoles);
    }
    rebuildPlayersList(); updateLobbyStatus(); electHost();
    setTimeout(tryStartRound,1000);
}

function removePeer(pid) {
    if(remotePlayers[pid]){remotePlayers[pid].destroy();delete remotePlayers[pid];}
    if(conns[pid]){try{conns[pid].close();}catch(e){}delete conns[pid];}
    delete lobbyMembers[pid];
    electHost(); updateLobbyStatus(); rebuildPlayersList();
}

function handlePeerData(pid,data) {
    if(!data||!data.type) return;
    switch(data.type){
        case 'state': if(remotePlayers[pid]) remotePlayers[pid].applyRemoteState(data); break;
        case 'round_start': roundNumber=data.round; beginRound(roundNumber); break;
        case 'roles': applyRoles(data.roles); roundState='playing'; roundTimer=ROUND_DURATION; updateRoundUI(); break;
        case 'sync_state': roundNumber=data.round; roundTimer=data.rTime; applyRoles(data.roles); roundState='playing'; updateRoundUI(); break;
        case 'tagged': handleTagged(data.pid); break;
        case 'round_end': if(roundState==='playing') endRound(data.hunterWon); break;
        case 'lobby_reset': roundState='lobby'; updateRoundUI(); Object.values(remotePlayers).forEach(rp=>rp.setRole(null)); player.setRole(null); myRole=null; rebuildPlayersList(); break;
    }
}

function broadcastAll(data) { Object.values(conns).forEach(c=>{try{c.send(data);}catch(e){}}); }

// ── Paint — continuous drag brush ────────────────────────────────────────────
function tryPaint(e) {
    mouse.x=(e.clientX/window.innerWidth)*2-1;
    mouse.y=-(e.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects([...environment.targets,...player.paintableMeshes]);
    if(!hits.length) return; const hit=hits[0];
    if(player.paintableMeshes.includes(hit.object)&&hit.uv) {
        if(['brush','bucket'].includes(activeTool)) player.executePaintMatrix(hit.object,hit.uv,brushColor,brushRadius,activeTool);
    } else if(activeTool==='picker') {
        brushColor='#'+hit.object.material.color.getHexString();
        document.getElementById('html-color-picker').value=brushColor;
        document.getElementById('color-hex-label').textContent=brushColor.toUpperCase();
    }
}

// ── Camera ───────────────────────────────────────────────────────────────────
function updateCamera() {
    const target=player.group.position.clone(); target.y+=0.3;
    const dist=2.2*camZoom;
    camera.position.lerp(new THREE.Vector3(
        target.x+Math.sin(camYaw)*Math.cos(camPitch)*dist,
        target.y+Math.sin(camPitch)*dist,
        target.z+Math.cos(camYaw)*Math.cos(camPitch)*dist
    ),0.18);
    camera.lookAt(target);
}

// ── Mobile ───────────────────────────────────────────────────────────────────
function setupMobile() {
    const zone=document.getElementById('joystick-zone'), knob=document.getElementById('joystick-knob');
    if(!zone||!knob) return;

    zone.addEventListener('touchstart',e=>{
        e.preventDefault(); const t=e.changedTouches[0];
        joyActive=true; joyId=t.identifier; joyOrigin={x:t.clientX,y:t.clientY};
    },{passive:false});

    window.addEventListener('touchmove',e=>{
        if(!joyActive) return;
        for(const t of e.changedTouches){
            if(t.identifier!==joyId) continue;
            const dx=t.clientX-joyOrigin.x, dy=t.clientY-joyOrigin.y;
            const dist=Math.sqrt(dx*dx+dy*dy), max=45;
            const ang=Math.atan2(dy,dx);
            knob.style.transform=`translate(calc(-50% + ${Math.cos(ang)*Math.min(dist,max)}px),calc(-50% + ${Math.sin(ang)*Math.min(dist,max)}px))`;
            // Normalize with dead-zone so tiny joystick wobble doesn't move
            const rawX=dx/max, rawZ=dy/max;
            const DEAD=0.15;
            mob.x = Math.abs(rawX)>DEAD ? rawX : 0;
            mob.z = Math.abs(rawZ)>DEAD ? rawZ : 0;
        }
    },{passive:true});

    const endJ=()=>{ joyActive=false; mob.x=0; mob.z=0; knob.style.transform='translate(-50%,-50%)'; };
    window.addEventListener('touchend',endJ); window.addEventListener('touchcancel',endJ);

    document.getElementById('mob-jump').addEventListener('touchstart',e=>{e.preventDefault();player.jump();},{passive:false});
    document.getElementById('mob-freeze').addEventListener('touchstart',e=>{e.preventDefault();player.toggleFreeze();updateFreezeUI();},{passive:false});
    const sb=document.getElementById('mob-sprint');
    sb.addEventListener('touchstart',e=>{e.preventDefault();mob.sprint=true;},{passive:false});
    sb.addEventListener('touchend',()=>mob.sprint=false);
    sb.addEventListener('touchcancel',()=>mob.sprint=false);
}

// ── Loop ─────────────────────────────────────────────────────────────────────
let netT=0;
function animate() {
    requestAnimationFrame(animate);
    const delta=Math.min(clock.getDelta(),0.05);
    if(!gameStarted){menuControls.update();renderer.render(scene,camera);return;}

    // Merge keyboard + joystick — joystick gives analog input via mob.x/z
    const mk={
        w: keys.w || mob.z < -0.15,
        s: keys.s || mob.z >  0.15,
        a: keys.a || mob.x < -0.15,
        d: keys.d || mob.x >  0.15,
        jx: mob.x, // pass analog values for proportional speed
        jz: mob.z,
    };
    player.update(mk,keys.Shift||mob.sprint,delta,environment.colliders);
    updateCamera();
    tickRound(delta);

    // Fall off platform reset
    if(player.group.position.y<-4.5){
        if(roundState==='playing'){
            if(myRole==='seeker'&&!taggedSeekers.has(myPeerId)){
                taggedSeekers.add(myPeerId); broadcastAll({type:'tagged',pid:myPeerId,round:roundNumber}); handleTagged(myPeerId);
            } else if(myRole==='hunter'&&amIHost){
                broadcastAll({type:'round_end',hunterWon:false,round:roundNumber}); endRound(false);
            }
        } else {
            player.group.position.set((Math.random()-0.5)*4,4,(Math.random()-0.5)*4); player.velocity.set(0,0,0);
        }
    }

    netT+=delta;
    if(netT>0.045){ netT=0; broadcastAll({type:'state',...player.getNetState(),name:myName}); }
    renderer.render(scene,camera);
}