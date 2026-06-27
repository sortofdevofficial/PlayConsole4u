import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

// ─── State ───────────────────────────────────────────────────────────────────
let scene, camera, renderer, controls, clock;
let environment, player;
let raycaster, mouse;

const keys = { w: false, a: false, s: false, d: false, ' ': false, Shift: false };
let gameStarted = false;
let activeTool  = 'brush';
let brushColor  = '#38bdf8';
let brushRadius = 32;

// Third-person camera
const CAM_OFFSET  = new THREE.Vector3(0, 5, 11);
const CAM_TARGET_OFFSET = new THREE.Vector3(0, 1.4, 0);
let cameraYaw   = 0;
let cameraPitch = 0.3;
let cameraZoom  = 1.0;
let isOrbiting  = false;
let lastMouse   = { x: 0, y: 0 };

// Multiplayer
const LOBBY_ID     = 'camo-chameleon-lobby-v1';
let peer           = null;
let myPeerId       = null;
let connections    = {};       // peerId → DataConnection
let remotePlayers  = {};       // peerId → Player
let myDisplayName  = 'Guest';
const COLORS = ['#b0b8c4','#f87171','#4ade80','#60a5fa','#facc15','#e879f9','#fb923c'];
let myColor = COLORS[Math.floor(Math.random() * COLORS.length)];

// Firebase user
let fbUser = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
init();
animate();

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 14);

    // Disable OrbitControls — we handle camera manually for true 3rd person
    // But keep it for menu auto-rotate
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance   = 3.5;
    controls.maxDistance   = 22;
    controls.autoRotate    = true;
    controls.autoRotateSpeed = 1.5;
    controls.enablePan     = false;

    environment = new Environment(scene);
    player      = new Player(scene, myColor);

    raycaster = new THREE.Raycaster();
    mouse     = new THREE.Vector2();

    // Input
    window.addEventListener('keydown', e => {
        if (!gameStarted) return;
        if (e.key === ' ') { e.preventDefault(); player.jump(); }
        if (e.key in keys) keys[e.key] = true;
    });
    window.addEventListener('keyup', e => { if (e.key in keys) keys[e.key] = false; });

    // Camera orbit via right-click drag
    window.addEventListener('pointerdown', e => {
        if (e.button === 2) { isOrbiting = true; lastMouse = { x: e.clientX, y: e.clientY }; }
        else handlePaint(e);
    });
    window.addEventListener('pointermove', e => {
        if (!isOrbiting || !gameStarted) return;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        cameraYaw   -= dx * 0.005;
        cameraPitch  = Math.max(0.1, Math.min(1.2, cameraPitch + dy * 0.004));
        lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup',   e => { if (e.button === 2) isOrbiting = false; });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => {
        cameraZoom = Math.max(0.5, Math.min(2.5, cameraZoom + e.deltaY * 0.001));
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    setupUI();
    setupFirebase();
}

// ─── Firebase Auth ─────────────────────────────────────────────────────────
function setupFirebase() {
    if (typeof FB === 'undefined') return;

    FB.onAuthChange(async user => {
        fbUser = user;
        if (user) {
            myDisplayName = user.displayName || 'Player';
            document.getElementById('user-name').textContent = myDisplayName;
            document.getElementById('user-avatar').src = user.photoURL || '';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('btn-signin').style.display = 'none';

            const stats = await FB.getMatchStats(user.uid);
            setMenuStats(stats.w, stats.l);
        } else {
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('btn-signin').style.display = 'block';
        }
    });

    document.getElementById('btn-signin').addEventListener('click', () => FB.signInGoogle());
    document.getElementById('btn-signout').addEventListener('click', () => FB.signOut());
}

function setMenuStats(w, l) {
    document.getElementById('menu-wins').textContent   = w;
    document.getElementById('menu-losses').textContent = l;
    document.getElementById('hud-wins').textContent    = w;
    document.getElementById('hud-losses').textContent  = l;
}

function updateHudUser() {
    if (fbUser) {
        document.getElementById('hud-username').textContent = myDisplayName;
        document.getElementById('hud-avatar').src = fbUser.photoURL || '';
    }
}

// ─── UI ────────────────────────────────────────────────────────────────────
function setupUI() {
    document.getElementById('btn-play').addEventListener('click', startGame);

    const picker   = document.getElementById('html-color-picker');
    const hexLabel = document.getElementById('color-hex-label');
    picker.addEventListener('input', e => {
        brushColor = e.target.value;
        hexLabel.textContent = brushColor.toUpperCase();
    });

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            activeTool = e.currentTarget.dataset.tool;
        });
    });

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            brushRadius = parseInt(e.currentTarget.dataset.radius);
        });
    });
}

function startGame() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud').style.display       = 'block';
    gameStarted = true;

    // Switch to manual 3rd-person cam
    controls.enabled    = false;
    controls.autoRotate = false;
    clock.getDelta();

    player.setName(myDisplayName);
    updateHudUser();

    initMultiplayer();
}

// ─── Multiplayer (PeerJS single lobby) ────────────────────────────────────
function initMultiplayer() {
    peer = new Peer(undefined, {
        host:   '0.peerjs.com',
        port:   443,
        secure: true,
        config: { iceServers: [{ urls: 'stun:stun.google.com:19302' }] }
    });

    peer.on('open', id => {
        myPeerId = id;
        console.log('[P2P] My ID:', id);
        connectToLobby();
    });

    peer.on('connection', conn => {
        setupConn(conn);
    });

    peer.on('error', err => console.warn('[P2P] Error:', err));
}

function connectToLobby() {
    // Try to connect to the fixed lobby host
    const hostConn = peer.connect(LOBBY_ID, { reliable: false, serialization: 'json' });
    hostConn.on('open', () => {
        console.log('[P2P] Connected to lobby host');
        setupConn(hostConn);
    });
    hostConn.on('error', () => {
        // We ARE the host — claim the lobby ID by reconnecting as the host
        // (PeerJS: we already have our own random ID; just act as host)
        console.log('[P2P] Becoming lobby host');
        // Nothing extra needed — peers will connect to us via LOBBY_ID
        // But since we have a random ID, we need a rendezvous mechanism.
        // Simple approach: ALL peers also try every other connected peer's ID
        // stored in a Firebase doc as a peer list.
        hostAnnounce();
    });
}

// Store our peer ID in Firestore so others can find us
async function hostAnnounce() {
    if (typeof FB === 'undefined') return;
    try {
        // Write our peerId to lobby doc
        await firebase.firestore()
            .collection('lobby').doc('main')
            .set({ peers: firebase.firestore.FieldValue.arrayUnion(myPeerId) }, { merge: true });

        // Listen for new peers joining
        firebase.firestore()
            .collection('lobby').doc('main')
            .onSnapshot(snap => {
                const peers = (snap.data()?.peers) || [];
                peers.forEach(pid => {
                    if (pid !== myPeerId && !connections[pid]) {
                        const c = peer.connect(pid, { reliable: false, serialization: 'json' });
                        c.on('open', () => setupConn(c));
                    }
                });
            });
    } catch (e) {
        console.warn('[P2P] Firebase announce failed, LAN only:', e.message);
    }
}

function setupConn(conn) {
    const pid = conn.peer;
    connections[pid] = conn;
    console.log('[P2P] Connected to peer:', pid);
    addOnlinePlayer(pid);

    // Also announce ourselves to Firestore so they hear us
    hostAnnounce();

    conn.on('data', data => handlePeerData(pid, data));
    conn.on('close', () => {
        removeRemotePlayer(pid);
        delete connections[pid];
        removeOnlinePlayer(pid);
    });
}

function handlePeerData(pid, data) {
    if (data.type === 'state') {
        if (!remotePlayers[pid]) {
            const color = COLORS[Object.keys(remotePlayers).length % COLORS.length];
            const rp = new Player(scene, color, true);
            rp.setName(data.name || 'Player');
            remotePlayers[pid] = rp;
            addOnlinePlayer(pid, data.name);
        }
        remotePlayers[pid].applyRemoteState(data);
    }
}

function broadcastState() {
    const state = player.getNetState();
    state.type = 'state';
    state.name = myDisplayName;
    Object.values(connections).forEach(conn => {
        try { conn.send(state); } catch(e){}
    });
}

function removeRemotePlayer(pid) {
    if (remotePlayers[pid]) {
        remotePlayers[pid].destroy();
        delete remotePlayers[pid];
    }
}

function addOnlinePlayer(pid, name) {
    const list = document.getElementById('online-list');
    const existing = document.getElementById('op-' + pid);
    if (!existing) {
        const el = document.createElement('div');
        el.id = 'op-' + pid;
        el.className = 'online-entry';
        el.textContent = '🟢 ' + (name || 'Player');
        list.appendChild(el);
    }
}

function removeOnlinePlayer(pid) {
    const el = document.getElementById('op-' + pid);
    if (el) el.remove();
}

// ─── Paint ─────────────────────────────────────────────────────────────────
function handlePaint(event) {
    if (!gameStarted) return;
    if (event.button === 2) return;
    if (event.target.closest('.hud-panel') || event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return;

    mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...environment.targets, ...player.paintableMeshes]);

    if (hits.length > 0) {
        const hit = hits[0];
        if (player.paintableMeshes.includes(hit.object) && hit.uv) {
            if (['brush', 'bucket', 'eraser'].includes(activeTool)) {
                player.executePaintMatrix(hit.object, hit.uv, brushColor, brushRadius, activeTool);
            }
        } else if (!player.paintableMeshes.includes(hit.object)) {
            if (activeTool === 'picker') {
                brushColor = '#' + hit.object.material.color.getHexString();
                document.getElementById('html-color-picker').value = brushColor;
                document.getElementById('color-hex-label').textContent = brushColor.toUpperCase();
            }
        }
    }
}

// ─── Third-Person Camera ───────────────────────────────────────────────────
function updateThirdPersonCamera() {
    const target = player.group.position.clone().add(CAM_TARGET_OFFSET);

    const dist = 11 * cameraZoom;
    const x = target.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * dist;
    const y = target.y + Math.sin(cameraPitch) * dist;
    const z = target.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * dist;

    camera.position.lerp(new THREE.Vector3(x, y, z), 0.12);
    camera.lookAt(target);
}

// ─── Animate ──────────────────────────────────────────────────────────────
let netTimer = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (gameStarted) {
        player.update(keys, keys.Shift, delta, environment.colliders);
        updateThirdPersonCamera();

        // Broadcast position ~20Hz
        netTimer += delta;
        if (netTimer > 0.05) {
            netTimer = 0;
            broadcastState();
        }
    } else {
        controls.update();
    }

    renderer.render(scene, camera);
}