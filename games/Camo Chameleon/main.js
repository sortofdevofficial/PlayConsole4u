import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

// --- GAME CORE STATE CONFIG ---
let scene, camera, renderer, clock;
let environment, player;
let raycaster, mouse;

const keys = { w: false, a: false, s: false, d: false, Shift: false };
let gameStarted = false;
let activeTool = 'brush'; // Bucket reference completely expunged
let brushColor = '#ef4444';
let brushRadius = 20;
let isPainting = false;

// Camera configuration
let camYaw = 0, camPitch = 0.38, camZoom = 1;
let isPointerDown = false, lastMx = 0, lastMy = 0;

// Proportional Mobile Joystick Data State
const mob = { x: 0, z: 0, sprint: false };
let joyActive = false;
let joyId = null;
const joyOrigin = { x: 0, y: 0 };
const joyMaxRadius = 45; // Max movement radius match for css bounds

// Firebase & User Structs
let fbUser = null;
let myName = 'Player';
let myWins = 0, myLikes = 0;

// Initialization Hook
function initEngine() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    
    // Premium Atmospheric Setup
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.FogExp2('#1e293b', 0.025);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('canvas3d'), powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Dynamic capping protects rendering speeds
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    environment = new Environment(scene);
    player = new Player(scene, '#38bdf8', false);
    player.group.position.set(0, 6, 0); // Clear drop spawn

    setupInputListeners();
    setupMobileControls();
    hookAuthFlow();

    window.addEventListener('resize', onWindowResize);
    requestAnimationFrame(renderLoop);
}

// --- SECURE DATA GATEWAY ---
function hookAuthFlow() {
    const btnPlay = document.getElementById('btn-play');
    if (!window.FB) {
        // Safe offline runtime switch if database link is non-existent
        btnPlay.innerText = "PLAY LOCALMODE";
        btnPlay.disabled = false;
        return;
    }

    window.FB.onAuthChange(async (user) => {
        if (user) {
            fbUser = user;
            document.getElementById('auth-gate').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            
            // Safe parsing eliminates variable-access crashes entirely
            let profileData = {};
            let statsData = {};
            try { profileData = (await window.FB.getProfile(user.uid)) || {}; } catch(e) { console.warn("Profile fetch timeout fallbacked."); }
            try { statsData = (await window.FB.getStats(user.uid)) || {}; } catch(e) { console.warn("Stats fetch timeout fallbacked."); }

            myName = profileData.n || 'Player Chameleon';
            myWins = statsData.w || 0;
            myLikes = statsData.likes || 0;

            document.getElementById('user-name').innerText = myName;
            document.getElementById('user-avatar').src = profileData.ph || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(myName);
            document.getElementById('menu-wins').innerText = myWins;
            document.getElementById('menu-likes').innerText = myLikes;

            player.setName?.(myName);
            btnPlay.innerText = "START CHAMPIONSHIP";
            btnPlay.disabled = false;
        } else {
            fbUser = null;
            document.getElementById('auth-gate').style.display = 'block';
            document.getElementById('user-info').style.display = 'none';
            btnPlay.innerText = "Authenticating Context...";
            btnPlay.disabled = true;
        }
    });

    document.getElementById('btn-signin').addEventListener('click', () => window.FB?.signInGoogle());
    btnPlay.addEventListener('click', launchGameSession);
}

function launchGameSession() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    
    // Auto-detect mobile devices or high touch layouts
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }
    
    gameStarted = true;
    clock.getDelta(); // Clear time accumulator buffer before tracking loop
}

// --- STABLE TOGGLE STATE (FIXES FROZEN UI) ---
function triggerFreezeToggle() {
    if (!gameStarted) return;
    player.frozen = !player.frozen;
    
    const uiIndicator = document.getElementById('freeze-indicator');
    if (uiIndicator) {
        uiIndicator.style.display = player.frozen ? 'block' : 'none';
    }
    
    // Stop drift velocity completely while frozen, but graphics render engine loop handles updates fine!
    if (player.frozen && player.velocity) {
        player.velocity.set(0, 0, 0);
    }
}

// --- DESKTOP KEYBOARD ENGINE ---
function setupInputListeners() {
    window.addEventListener('keydown', (e) => {
        if (!gameStarted) return;
        const c = e.code;
        if (c === 'KeyW' || c === 'ArrowUp') keys.w = true;
        if (c === 'KeyS' || c === 'ArrowDown') keys.s = true;
        if (c === 'KeyA' || c === 'ArrowLeft') keys.a = true;
        if (c === 'KeyD' || c === 'ArrowRight') keys.d = true;
        if (c === 'ShiftLeft' || c === 'ShiftRight') keys.Shift = true;
        if (c === 'Space') player.jump();
        if (c === 'KeyF') triggerFreezeToggle();
    });

    window.addEventListener('keyup', (e) => {
        const c = e.code;
        if (c === 'KeyW' || c === 'ArrowUp') keys.w = false;
        if (c === 'KeyS' || c === 'ArrowDown') keys.s = false;
        if (c === 'KeyA' || c === 'ArrowLeft') keys.a = false;
        if (c === 'KeyD' || c === 'ArrowRight') keys.d = false;
        if (c === 'ShiftLeft' || c === 'ShiftRight') keys.Shift = false;
    });

    // Pointer Drag Tracking for smooth view adjustments
    window.addEventListener('pointerdown', (e) => {
        if (!gameStarted || e.target.closest('#hud') || e.target.closest('#mobile-controls')) return;
        isPointerDown = true;
        lastMx = e.clientX;
        lastMy = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
        if (isPointerDown) {
            const dx = e.clientX - lastMx;
            const dy = e.clientY - lastMy;
            camYaw -= dx * 0.005;
            camPitch = Math.max(-0.6, Math.min(0.8, camPitch + dy * 0.005));
            lastMx = e.clientX;
            lastMy = e.clientY;
        }
    });

    window.addEventListener('pointerup', () => { isPointerDown = false; });
}

// --- COMPREHENSIVE MOBILE TOUCH ENGINE ---
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
        joyOrigin.y = rect.top + rect.height / 2;
        joyActive = true;
        joyId = touch.identifier;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!joyActive) return;
        
        let activeTouch = null;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === joyId) {
                activeTouch = e.touches[i];
                break;
            }
        }
        
        if (!activeTouch) return;

        const dx = activeTouch.clientX - joyOrigin.x;
        const dy = activeTouch.clientY - joyOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let angle = Math.atan2(dy, dx);
        let moveDist = Math.min(dist, joyMaxRadius);

        const kx = Math.cos(angle) * moveDist;
        const ky = Math.sin(angle) * moveDist;
        
        // Displace DOM elements smoothly
        knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

        // Pass normalized values straight to proportional input vector calculations
        mob.x = kx / joyMaxRadius;
        mob.z = ky / joyMaxRadius;
    }, { passive: false });

    const clearJoystick = (e) => {
        if (!joyActive) return;
        joyActive = false;
        joyId = null;
        mob.x = 0;
        mob.z = 0;
        knob.style.transform = 'translate(-50%, -50%)';
    };

    window.addEventListener('touchend', clearJoystick);
    window.addEventListener('touchcancel', clearJoystick);

    // Fast Touch Actions for performance tracking
    document.getElementById('mob-btn-jump').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameStarted) player.jump();
    });

    document.getElementById('mob-btn-freeze').addEventListener('touchstart', (e) => {
        e.preventDefault();
        triggerFreezeToggle();
    });
}

function updateCameraPosition() {
    const targetOffset = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch) * 5,
        Math.sin(camPitch) * 5 + 1.2,
        Math.cos(camYaw) * Math.cos(camPitch) * 5
    );
    
    const combinedCamPosition = player.group.position.clone().add(targetOffset);
    camera.position.lerp(combinedCamPosition, 0.12);
    camera.lookAt(player.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
}

// --- UNIFIED HIGH-FRAME ENGINE LOOP ---
function renderLoop() {
    requestAnimationFrame(renderLoop);
    const delta = Math.min(clock.getDelta(), 0.04); // Ensure long frame lag steps are tightly capped

    if (gameStarted) {
        // Read active mixed map configuration inputs dynamically
        const mixedMovementVector = {
            w: keys.w || mob.z < -0.2,
            s: keys.s || mob.z > 0.2,
            a: keys.a || mob.x < -0.2,
            d: keys.d || mob.x > 0.2,
            jx: mob.x, 
            jz: mob.z
        };

        // Player instance functions securely updates internally whether frozen or free!
        player.update(mixedMovementVector, keys.Shift || mob.sprint, delta, environment.colliders);
        updateCameraPosition();
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Fire up deployment code execution cleanly
window.addEventListener('DOMContentLoaded', initEngine);