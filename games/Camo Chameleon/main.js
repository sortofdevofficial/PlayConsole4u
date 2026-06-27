import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

// ── State ────────────────────────────────────────────────────────────────────
let scene, camera, renderer, controls, clock;
let environment, player;
let raycaster, mouse;

const keys = { w: false, a: false, s: false, d: false, ' ': false, Shift: false };
let gameStarted = false;
let activeTool  = 'brush';
let brushColor  = '#38bdf8';
let brushRadius = 32;

// Camera — left-click drag to orbit
let cameraYaw   = 0;
let cameraPitch = 0.35;
let cameraZoom  = 1.0;
let isOrbiting  = false;
let lastMouse   = { x: 0, y: 0 };
let didDrag     = false;  // distinguish drag vs click for paint

// Multiplayer
const LOBBY_ID = 'camo-chameleon-lobby-v1';
let peer = null, myPeerId = null;
let connections = {}, remotePlayers = {};
let myDisplayName = 'Guest';
const COLORS = ['#c8cdd4','#e8a0a0','#a0c8a0','#a0b8e8','#e8d0a0','#c8a0d0','#d0c0a0'];
let myColor = COLORS[Math.floor(Math.random() * COLORS.length)];
let fbUser = null;

// Mobile joystick state
const mobileInput = { x: 0, z: 0, sprint: false };
let joystickActive = false, joystickId = null;
let joystickOrigin = { x: 0, y: 0 };

// ── Init ──────────────────────────────────────────────────────────────────────
init();
animate();

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 7, 12);

    // OrbitControls disabled during game; used only for menu spin
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = true; controls.autoRotateSpeed = 1.5;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 3; controls.maxDistance = 20;

    environment = new Environment(scene);
    player = new Player(scene, myColor);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // ── Input ────────────────────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
        if (!gameStarted) return;
        if (e.key === ' ') { e.preventDefault(); player.jump(); }
        if (e.key === 'f' || e.key === 'F') { player.toggleFreeze(); updateFreezeUI(); }
        if (e.key in keys) keys[e.key] = true;
    });
    window.addEventListener('keyup', e => { if (e.key in keys) keys[e.key] = false; });

    // Left-click: start orbit drag OR paint on release (no drag)
    window.addEventListener('pointerdown', e => {
        if (!gameStarted) return;
        if (e.button !== 0) return; // only left click
        if (e.target.closest('.hud-panel') || e.target.closest('#mobile-controls')) return;
        isOrbiting = true;
        didDrag = false;
        lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', e => {
        if (!isOrbiting || !gameStarted) return;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
        cameraYaw   -= dx * 0.005;
        cameraPitch  = Math.max(0.08, Math.min(1.3, cameraPitch + dy * 0.004));
        lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', e => {
        if (!gameStarted || e.button !== 0) return;
        if (!didDrag && !e.target.closest('.hud-panel') && !e.target.closest('#mobile-controls')) {
            handlePaint(e);
        }
        isOrbiting = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => {
        cameraZoom = Math.max(0.4, Math.min(2.8, cameraZoom + e.deltaY * 0.001));
    });
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    setupUI();
    setupFirebase();
    setupMobile();
}

// ── Firebase ──────────────────────────────────────────────────────────────────
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
            setWins(stats.w);
        } else {
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('btn-signin').style.display = 'block';
        }
    });
    document.getElementById('btn-signin').addEventListener('click', () => FB.signInGoogle());
    document.getElementById('btn-signout').addEventListener('click', () => FB.signOut());
}

function setWins(w) {
    document.getElementById('menu-wins').textContent = w;
    document.getElementById('hud-wins').textContent  = w;
}

function updateFreezeUI() {
    document.getElementById('freeze-indicator').style.display = player.frozen ? 'flex' : 'none';
}

// ── UI ────────────────────────────────────────────────────────────────────────
function setupUI() {
    document.getElementById('btn-play').addEventListener('click', startGame);

    const picker = document.getElementById('html-color-picker');
    const hexLbl = document.getElementById('color-hex-label');
    picker.addEventListener('input', e => { brushColor = e.target.value; hexLbl.textContent = brushColor.toUpperCase(); });

    document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', e => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        activeTool = e.currentTarget.dataset.tool;
    }));
    document.querySelectorAll('.size-btn').forEach(btn => btn.addEventListener('click', e => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        brushRadius = parseInt(e.currentTarget.dataset.radius);
    }));
}

function startGame() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    gameStarted = true;
    controls.enabled = false;
    controls.autoRotate = false;
    clock.getDelta();

    // HUD user
    if (fbUser) {
        document.getElementById('hud-username').textContent = myDisplayName;
        document.getElementById('hud-avatar').src = fbUser.photoURL || '';
    }
    player.setName(myDisplayName);

    // Show mobile controls on touch devices
    if ('ontouchstart' in window) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }

    initMultiplayer();
}

// ── Mobile Controls ───────────────────────────────────────────────────────────
function setupMobile() {
    const zone  = document.getElementById('joystick-zone');
    const knob  = document.getElementById('joystick-knob');
    const base  = document.getElementById('joystick-base');

    zone.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        joystickActive = true;
        joystickId = t.identifier;
        joystickOrigin = { x: t.clientX, y: t.clientY };
        knob.style.transform = 'translate(-50%,-50%)';
    }, { passive: false });

    window.addEventListener('touchmove', e => {
        if (!joystickActive) return;
        for (const t of e.changedTouches) {
            if (t.identifier !== joystickId) continue;
            const dx = t.clientX - joystickOrigin.x;
            const dy = t.clientY - joystickOrigin.y;
            const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 40);
            const angle = Math.atan2(dy, dx);
            const nx = Math.cos(angle) * dist;
            const ny = Math.sin(angle) * dist;
            knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
            mobileInput.x =  (dx / 40) * Math.min(1, dist / 40);
            mobileInput.z =  (dy / 40) * Math.min(1, dist / 40);
        }
    }, { passive: true });

    const endJoy = () => {
        joystickActive = false;
        mobileInput.x = 0; mobileInput.z = 0;
        knob.style.transform = 'translate(-50%,-50%)';
    };
    window.addEventListener('touchend',    endJoy);
    window.addEventListener('touchcancel', endJoy);

    // Action buttons
    document.getElementById('mob-jump').addEventListener('touchstart',   e => { e.preventDefault(); player.jump(); }, { passive: false });
    document.getElementById('mob-freeze').addEventListener('touchstart',  e => { e.preventDefault(); player.toggleFreeze(); updateFreezeUI(); }, { passive: false });
    const sprintBtn = document.getElementById('mob-sprint');
    sprintBtn.addEventListener('touchstart',  e => { e.preventDefault(); mobileInput.sprint = true;  }, { passive: false });
    sprintBtn.addEventListener('touchend',    () => mobileInput.sprint = false);
    sprintBtn.addEventListener('touchcancel', () => mobileInput.sprint = false);
}

// ── Paint ──────────────────────────────────────────────────────────────────────
function handlePaint(event) {
    if (!gameStarted) return;
    mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...environment.targets, ...player.paintableMeshes]);
    if (!hits.length) return;
    const hit = hits[0];
    if (player.paintableMeshes.includes(hit.object) && hit.uv) {
        if (['brush','bucket','eraser'].includes(activeTool))
            player.executePaintMatrix(hit.object, hit.uv, brushColor, brushRadius, activeTool);
    } else if (!player.paintableMeshes.includes(hit.object)) {
        if (activeTool === 'picker') {
            brushColor = '#' + hit.object.material.color.getHexString();
            document.getElementById('html-color-picker').value = brushColor;
            document.getElementById('color-hex-label').textContent = brushColor.toUpperCase();
        }
    }
}

// ── Third-person Camera ────────────────────────────────────────────────────────
function updateCamera() {
    const target = player.group.position.clone();
    target.y += 1.4;
    const dist = 10 * cameraZoom;
    const x = target.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * dist;
    const y = target.y + Math.sin(cameraPitch) * dist;
    const z = target.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * dist;
    camera.position.lerp(new THREE.Vector3(x, y, z), 0.13);
    camera.lookAt(target);
}

// ── Multiplayer ───────────────────────────────────────────────────────────────
function initMultiplayer() {
    peer = new Peer(undefined, {
        host: '0.peerjs.com', port: 443, secure: true,
        config: { iceServers: [{ urls: 'stun:stun.google.com:19302' }] }
    });
    peer.on('open', id => { myPeerId = id; hostAnnounce(); });
    peer.on('connection', conn => setupConn(conn));
    peer.on('error', err => console.warn('[P2P]', err));
}

async function hostAnnounce() {
    if (typeof firebase === 'undefined') return;
    try {
        await firebase.firestore().collection('lobby').doc('main')
            .set({ peers: firebase.firestore.FieldValue.arrayUnion(myPeerId) }, { merge: true });
        firebase.firestore().collection('lobby').doc('main').onSnapshot(snap => {
            const peers = snap.data()?.peers || [];
            peers.forEach(pid => {
                if (pid !== myPeerId && !connections[pid]) {
                    const c = peer.connect(pid, { reliable: false, serialization: 'json' });
                    c.on('open', () => setupConn(c));
                }
            });
        });
    } catch(e) { console.warn('[P2P] announce failed:', e.message); }
}

function setupConn(conn) {
    const pid = conn.peer;
    connections[pid] = conn;
    conn.on('data', data => {
        if (data.type === 'state') {
            if (!remotePlayers[pid]) {
                const color = COLORS[Object.keys(remotePlayers).length % COLORS.length];
                const rp = new Player(scene, color, true);
                rp.setName(data.name || 'Player');
                remotePlayers[pid] = rp;
                addOnlineEntry(pid, data.name);
            }
            remotePlayers[pid].applyRemoteState(data);
        }
    });
    conn.on('close', () => {
        if (remotePlayers[pid]) { remotePlayers[pid].destroy(); delete remotePlayers[pid]; }
        delete connections[pid];
        const el = document.getElementById('op-'+pid); if (el) el.remove();
    });
}

function addOnlineEntry(pid, name) {
    if (document.getElementById('op-'+pid)) return;
    const el = document.createElement('div');
    el.id = 'op-'+pid; el.className = 'online-entry';
    el.textContent = '🟢 ' + (name || 'Player');
    document.getElementById('online-list').appendChild(el);
}

// ── Animate ───────────────────────────────────────────────────────────────────
let netTimer = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (gameStarted) {
        // Merge mobile joystick into keys
        const mergedKeys = {
            w: keys.w || mobileInput.z < -0.2,
            s: keys.s || mobileInput.z >  0.2,
            a: keys.a || mobileInput.x < -0.2,
            d: keys.d || mobileInput.x >  0.2,
        };
        const sprinting = keys.Shift || mobileInput.sprint;
        player.update(mergedKeys, sprinting, delta, environment.colliders);
        updateCamera();

        netTimer += delta;
        if (netTimer > 0.05) {
            netTimer = 0;
            const state = { ...player.getNetState(), type: 'state', name: myDisplayName };
            Object.values(connections).forEach(c => { try { c.send(state); } catch(e){} });
        }
    } else {
        controls.update();
    }

    renderer.render(scene, camera);
}