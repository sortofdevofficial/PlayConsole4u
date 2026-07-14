import * as THREE from 'three';
import { Player } from './player.js';
import { buildWorld } from './world.js';
import { initCraftPreviews } from './inventory.js';
import { isTouchDevice, initTouchControls } from './touchControls.js';

const scene = new THREE.Scene();

const skyColor = 0x74b9ff;
scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.FogExp2(skyColor, 0.01);

const mainCanvas = document.getElementById('main-canvas');
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ canvas: mainCanvas, antialias: true, powerPreference: 'high-performance' });

// Scale quality down for weaker devices (touch/mobile, or low core count) so
// the game stays smooth everywhere instead of assuming desktop-class GPU.
const lowPower = isTouchDevice() || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445544, 0.4);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfff5d6, 1.8);
dirLight.position.set(40, 60, -30);
dirLight.castShadow = true;
const shadowSize = lowPower ? 768 : 1024;
dirLight.shadow.mapSize.width = shadowSize;
dirLight.shadow.mapSize.height = shadowSize;
const d = 60;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 180;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

const { grassPlatform, interactablesGroup, dropsGroup, markersGroup, platformWidth, platformLength, tick } = buildWorld(scene);
const player = new Player(scene, camera, renderer.domElement);

player.interactables = interactablesGroup;
player.dropsGroup = dropsGroup;
player.markersGroup = markersGroup;

document.getElementById('qc-stick').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 2)) { player.inventory.addItem('Stick', 4); player.updateCraftingButtons(); }
});
document.getElementById('qc-bench').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 5)) { player.inventory.addItem('Workbench', 1); player.updateCraftingButtons(); }
});
document.getElementById('wb-stick').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 2)) { player.inventory.addItem('Stick', 4); player.updateCraftingButtons(); }
});
document.getElementById('wb-bench').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 5)) { player.inventory.addItem('Workbench', 1); player.updateCraftingButtons(); }
});
document.getElementById('wb-pickaxe').addEventListener('click', () => {
    if (player.inventory.getCount('Stone') >= 3 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Stone', 3); player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Stone Pickaxe', 1); player.updateCraftingButtons();
    }
});
document.getElementById('wb-axe').addEventListener('click', () => {
    if (player.inventory.getCount('Stone') >= 3 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Stone', 3); player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Stone Axe', 1); player.updateCraftingButtons();
    }
});
document.getElementById('wb-furnace').addEventListener('click', () => {
    if (player.inventory.getCount('Stone') >= 8) {
        player.inventory.consumeItem('Stone', 8);
        player.inventory.addItem('Furnace', 1); player.updateCraftingButtons();
    }
});
document.getElementById('wb-autominer').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 4 && player.inventory.getCount('Iron Gear') >= 2 && player.inventory.getCount('Stick') >= 3) {
        player.inventory.consumeItem('Iron Plate', 4);
        player.inventory.consumeItem('Iron Gear', 2);
        player.inventory.consumeItem('Stick', 3);
        player.inventory.addItem('Auto Miner', 1);
        player.updateCraftingButtons();
    }
});
document.getElementById('wb-conveyor').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 2 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Iron Plate', 2);
        player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Conveyor', 1);
        player.updateCraftingButtons();
    }
});
document.getElementById('wb-conveyor-left').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 2 && player.inventory.getCount('Iron Gear') >= 1 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Iron Plate', 2);
        player.inventory.consumeItem('Iron Gear', 1);
        player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Conveyor Left', 1);
        player.updateCraftingButtons();
    }
});
document.getElementById('wb-conveyor-right').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 2 && player.inventory.getCount('Iron Gear') >= 1 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Iron Plate', 2);
        player.inventory.consumeItem('Iron Gear', 1);
        player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Conveyor Right', 1);
        player.updateCraftingButtons();
    }
});
document.getElementById('wb-solarpanel').addEventListener('click', () => {
    if (player.craftSolarPanel()) player.updateCraftingButtons();
});

document.getElementById('fn-smelt').addEventListener('click', () => { player.smeltIron(); });
document.getElementById('fn-plate').addEventListener('click', () => { player.craftIronPlate(); });
document.getElementById('fn-gear').addEventListener('click', () => { player.craftIronGear(); });
document.getElementById('fn-silicon').addEventListener('click', () => { player.smeltQuartz(); });
document.getElementById('fn-glass').addEventListener('click', () => { player.smeltSand(); });

initCraftPreviews([
    { buttonId: 'qc-stick', itemName: 'Stick' },
    { buttonId: 'qc-bench', itemName: 'Workbench' },
    { buttonId: 'wb-stick', itemName: 'Stick' },
    { buttonId: 'wb-bench', itemName: 'Workbench' },
    { buttonId: 'wb-pickaxe', itemName: 'Stone Pickaxe' },
    { buttonId: 'wb-axe', itemName: 'Stone Axe' },
    { buttonId: 'wb-furnace', itemName: 'Furnace' },
    { buttonId: 'wb-autominer', itemName: 'Auto Miner' },
    { buttonId: 'wb-conveyor', itemName: 'Conveyor' },
    { buttonId: 'wb-conveyor-left', itemName: 'Conveyor Left' },
    { buttonId: 'wb-conveyor-right', itemName: 'Conveyor Right' },
    { buttonId: 'wb-solarpanel', itemName: 'Solar Panel' },
    { buttonId: 'fn-smelt', itemName: 'Iron Ingot' },
    { buttonId: 'fn-plate', itemName: 'Iron Plate' },
    { buttonId: 'fn-gear', itemName: 'Iron Gear' },
    { buttonId: 'fn-silicon', itemName: 'Silicon' },
    { buttonId: 'fn-glass', itemName: 'Glass' }
]);

// ===== START SCREEN =====
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-journey-btn');
const signinBtn = document.getElementById('signin-btn');
const startStatus = document.getElementById('start-status');

let readyForStart = false;
const startScreenBeginTime = performance.now();
const MIN_START_SCREEN_MS = 900;

function markReady(text) {
    if (startStatus) startStatus.textContent = text;
    const remaining = Math.max(0, MIN_START_SCREEN_MS - (performance.now() - startScreenBeginTime));
    setTimeout(() => {
        readyForStart = true;
        if (startBtn) startBtn.disabled = false;
        if (startScreen) startScreen.classList.add('is-ready');
    }, remaining);
}

if (typeof firebase !== 'undefined') {
    let resolved = false;
    firebase.auth().onAuthStateChanged(user => {
        if (resolved) {
            if (user && signinBtn) {
                signinBtn.textContent = 'Signed in ✓';
                signinBtn.disabled = true;
            }
            return;
        }
        resolved = true;
        markReady(user ? 'Welcome back.' : 'Your world awaits.');
    });
    setTimeout(() => { if (!readyForStart) markReady('Ready to play.'); }, 3000);
} else {
    markReady('Ready to play.');
}

if (signinBtn) {
    signinBtn.addEventListener('click', () => {
        if (typeof window.FB === 'undefined') return;
        signinBtn.disabled = true;
        signinBtn.textContent = 'Connecting…';
        window.FB.signInGoogle().catch(() => {
            signinBtn.disabled = false;
            signinBtn.textContent = 'Sign in to save progress';
        });
    });
}

let touchControlsReady = false;
if (startBtn) {
    startBtn.addEventListener('click', () => {
        if (!readyForStart) return;
        startScreen.classList.add('is-leaving');
        setTimeout(() => { startScreen.style.display = 'none'; }, 700);

        if (isTouchDevice()) {
            if (!touchControlsReady) { initTouchControls(player); touchControlsReady = true; }
        } else {
            renderer.domElement.requestPointerLock();
        }
    });
}

// ===== COORDS HUD =====
const coordXEl = document.getElementById('coord-x');
const coordYEl = document.getElementById('coord-y');
const coordZEl = document.getElementById('coord-z');
let lastCX = null, lastCY = null, lastCZ = null;

function updateCoordsHud() {
    const cx = Math.round(player.position.x * 10) / 10;
    const cy = Math.round(player.position.y * 10) / 10;
    const cz = Math.round(player.position.z * 10) / 10;
    if (cx !== lastCX) { coordXEl.textContent = `X: ${cx.toFixed(1)}`; lastCX = cx; }
    if (cy !== lastCY) { coordYEl.textContent = `Y: ${cy.toFixed(1)}`; lastCY = cy; }
    if (cz !== lastCZ) { coordZEl.textContent = `Z: ${cz.toFixed(1)}`; lastCZ = cz; }
}

// ===== MAIN LOOP =====
let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    try {
        if (tick) tick(time, 2500);
        player.update(dt, grassPlatform, interactablesGroup, dropsGroup, markersGroup, platformWidth, platformLength);
        updateCoordsHud();
    } catch (err) {
        // A single bad frame must never freeze the whole game. rAF above
        // already re-schedules regardless of what happens here, but without
        // this guard the SAME error would recur every frame forever -- which
        // looks identical to a full crash even though the engine is still
        // technically running. Logging + continuing lets the game recover.
        console.error('[Factaworld] frame update error (recovered):', err);
    }

    renderer.render(scene, camera);
    player.inventory.render3DSlots();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', () => {
    player.inventory.saveNow();
});

animate();