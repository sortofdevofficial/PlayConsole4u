import * as THREE from 'three';
import Environment from './Environment.js';
import Player from './Player.js';

// --- GAME CORE STATE ---
let scene, camera, renderer, clock;
let environment, player;
let raycaster, mouse;

const keys = { w: false, a: false, s: false, d: false, Shift: false };
let gameStarted = false;

// Camera
let camYaw = 0, camPitch = 0.38;
let isPointerDown = false, lastMx = 0, lastMy = 0;

// Mobile joystick
const mob = { x: 0, z: 0, sprint: false };
let joyActive = false, joyId = null;
const joyOrigin = { x: 0, y: 0 };
const joyMaxRadius = 45;

// User
let fbUser = null;
let myName = 'Player';
let myWins = 0, myLikes = 0;

// --- ENGINE INIT ---
function initEngine() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.FogExp2('#1e293b', 0.025);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: document.getElementById('canvas3d'),
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    environment = new Environment(scene);
    player = new Player(scene, '#38bdf8', false);
    player.group.position.set(0, 6, 0);

    setupInputListeners();
    setupMobileControls();
    hookAuthFlow();

    window.addEventListener('resize', onWindowResize);
    requestAnimationFrame(renderLoop);
}

// --- AUTH FLOW (Firebase required, no fallback) ---
function hookAuthFlow() {
    const btnPlay = document.getElementById('btn-play');

    window.FB.onAuthChange(async (user) => {
        if (user) {
            fbUser = user;
            document.getElementById('auth-gate').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';

            let profileData = {}, statsData = {};
            try { profileData = (await window.FB.getProfile(user.uid)) || {}; } catch (e) { console.warn('Profile fetch failed:', e); }
            try { statsData  = (await window.FB.getStats(user.uid))   || {}; } catch (e) { console.warn('Stats fetch failed:', e); }

            myName  = profileData.n   || 'Player Chameleon';
            myWins  = statsData.w     || 0;
            myLikes = statsData.likes || 0;

            document.getElementById('user-name').innerText  = myName;
            document.getElementById('user-avatar').src      = profileData.ph || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(myName);
            document.getElementById('menu-wins').innerText  = myWins;
            document.getElementById('menu-likes').innerText = myLikes;

            player.setName?.(myName);
            btnPlay.innerText = 'START CHAMPIONSHIP';
            btnPlay.disabled  = false;
        } else {
            fbUser = null;
            document.getElementById('auth-gate').style.display = 'block';
            document.getElementById('user-info').style.display = 'none';
            btnPlay.innerText = 'Sign in to Play';
            btnPlay.disabled  = true;
        }
    });

    document.getElementById('btn-signin').addEventListener('click', () => window.FB.signInGoogle());
    btnPlay.addEventListener('click', launchGameSession);
}

function launchGameSession() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }

    gameStarted = true;
    clock.getDelta();
}

// --- FREEZE ---
function triggerFreezeToggle() {
    if (!gameStarted) return;
    player.frozen = !player.frozen;
    const ui = document.getElementById('freeze-indicator');
    if (ui) ui.style.display = player.frozen ? 'block' : 'none';
    if (player.frozen && player.velocity) player.velocity.set(0, 0, 0);
}

// --- KEYBOARD ---
function setupInputListeners() {
    window.addEventListener('keydown', (e) => {
        if (!gameStarted) return;
        const c = e.code;
        if (c === 'KeyW'    || c === 'ArrowUp')    keys.w = true;
        if (c === 'KeyS'    || c === 'ArrowDown')   keys.s = true;
        if (c === 'KeyA'    || c === 'ArrowLeft')   keys.a = true;
        if (c === 'KeyD'    || c === 'ArrowRight')  keys.d = true;
        if (c === 'ShiftLeft' || c === 'ShiftRight') keys.Shift = true;
        if (c === 'Space') player.jump();
        if (c === 'KeyF')  triggerFreezeToggle();
    });

    window.addEventListener('keyup', (e) => {
        const c = e.code;
        if (c === 'KeyW'    || c === 'ArrowUp')    keys.w = false;
        if (c === 'KeyS'    || c === 'ArrowDown')   keys.s = false;
        if (c === 'KeyA'    || c === 'ArrowLeft')   keys.a = false;
        if (c === 'KeyD'    || c === 'ArrowRight')  keys.d = false;
        if (c === 'ShiftLeft' || c === 'ShiftRight') keys.Shift = false;
    });

    window.addEventListener('pointerdown', (e) => {
        if (!gameStarted || e.target.closest('#hud') || e.target.closest('#mobile-controls')) return;
        isPointerDown = true;
        lastMx = e.clientX; lastMy = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
        if (!isPointerDown) return;
        camYaw  -= (e.clientX - lastMx) * 0.005;
        camPitch = Math.max(-0.6, Math.min(0.8, camPitch + (e.clientY - lastMy) * 0.005));
        lastMx = e.clientX; lastMy = e.clientY;
    });

    window.addEventListener('pointerup', () => { isPointerDown = false; });
}

// --- MOBILE ---
function setupMobileControls() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const base = document.getElementById('joystick-base');
    if (!zone || !knob) return;

    zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.targetTouches[0];
        const rect = base.getBoundingClientRect();
        joyOrigin.x = rect.left + rect.width / 2;
        joyOrigin.y = rect.top  + rect.height / 2;
        joyActive = true;
        joyId = touch.identifier;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!joyActive) return;
        let t = null;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === joyId) { t = e.touches[i]; break; }
        }
        if (!t) return;
        const dx = t.clientX - joyOrigin.x;
        const dy = t.clientY - joyOrigin.y;
        const dist  = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const move  = Math.min(dist, joyMaxRadius);
        const kx = Math.cos(angle) * move;
        const ky = Math.sin(angle) * move;
        knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
        mob.x = kx / joyMaxRadius;
        mob.z = ky / joyMaxRadius;
    }, { passive: false });

    const clearJoy = () => {
        if (!joyActive) return;
        joyActive = false; joyId = null;
        mob.x = 0; mob.z = 0;
        knob.style.transform = 'translate(-50%, -50%)';
    };
    window.addEventListener('touchend', clearJoy);
    window.addEventListener('touchcancel', clearJoy);

    document.getElementById('mob-btn-jump').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameStarted) player.jump();
    });
    document.getElementById('mob-btn-freeze').addEventListener('touchstart', (e) => {
        e.preventDefault();
        triggerFreezeToggle();
    });
}

// --- CAMERA ---
function updateCameraPosition() {
    const offset = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch) * 5,
        Math.sin(camPitch) * 5 + 1.2,
        Math.cos(camYaw) * Math.cos(camPitch) * 5
    );
    camera.position.lerp(player.group.position.clone().add(offset), 0.12);
    camera.lookAt(player.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
}

// --- RENDER LOOP ---
function renderLoop() {
    requestAnimationFrame(renderLoop);
    const delta = Math.min(clock.getDelta(), 0.04);

    if (gameStarted) {
        const input = {
            w: keys.w || mob.z < -0.2, s: keys.s || mob.z > 0.2,
            a: keys.a || mob.x < -0.2, d: keys.d || mob.x > 0.2,
            jx: mob.x, jz: mob.z
        };
        player.update(input, keys.Shift || mob.sprint, delta, environment.colliders);
        updateCameraPosition();
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('DOMContentLoaded', initEngine);