import * as THREE from 'three';
import { Player } from './player.js';
import { buildWorld } from './world.js';
import { initCraftPreviews } from './inventory.js';
import { tickPowerVisuals, createManualPowerLink } from './powerSystem.js';
import { rescanAllLinks } from './linkSystem.js';

// Core structural instantiation object mappings
import { createWorkbench } from './obj/Workbench.js';
import { createFurnace } from './obj/furnace.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor } from './obj/conveyor.js';
import { createSolarPanel } from './obj/solarpanel.js';

const scene = new THREE.Scene();

const skyColor = 0x74b9ff;
scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.FogExp2(skyColor, 0.012);

const mainCanvas = document.getElementById('main-canvas');
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ canvas: mainCanvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
const d = 50;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 150;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

const { grassPlatform, interactablesGroup, dropsGroup, markersGroup, platformWidth, platformLength, tick } = buildWorld(scene);
const player = new Player(scene, camera, renderer.domElement);

// Global operational variables managing throttled server interactions
let activeUserUid = null;
let saveDebounceTimer = null;
let lastDatabaseSaveTime = 0;

const GAME_ITEM_DIRECTORY = [
    'Oak', 'Stick', 'Workbench', 'Stone', 'Stone Pickaxe', 'Stone Axe', 
    'Furnace', 'Iron Ore', 'Iron Ingot', 'Iron Plate', 'Iron Gear', 
    'Auto Miner', 'Conveyor', 'Conveyor Left', 'Conveyor Right', 
    'Solar Panel', 'Quartz', 'Silicon', 'Sand', 'Glass'
];

function serializeInventory() {
    const dataObj = {};
    GAME_ITEM_DIRECTORY.forEach(itemName => {
        const amt = player.inventory.getCount(itemName);
        if (amt > 0) dataObj[itemName] = amt;
    });
    return dataObj;
}

function deserializeInventory(savedInv) {
    if (!savedInv) return;
    GAME_ITEM_DIRECTORY.forEach(itemName => {
        const activeAmt = player.inventory.getCount(itemName);
        if (activeAmt > 0) player.inventory.consumeItem(itemName, activeAmt);
        if (savedInv[itemName]) player.inventory.addItem(itemName, savedInv[itemName]);
    });
}

function triggerThrottledSave() {
    if (!activeUserUid) return;
    const timeDelta = Date.now() - lastDatabaseSaveTime;
    
    if (timeDelta < 20000) {
        if (!saveDebounceTimer) {
            saveDebounceTimer = setTimeout(() => {
                saveDebounceTimer = null;
                executeDatabaseWrite();
            }, 20000 - timeDelta);
        }
        return;
    }
    executeDatabaseWrite();
}

async function executeDatabaseWrite() {
    if (!activeUserUid) return;
    lastDatabaseSaveTime = Date.now();

    const structuredBuilds = [];
    player.interactables.children.forEach(meshNode => {
        let nodeType = meshNode.userData.type || 'Structure';
        if (meshNode.userData.isConveyor) {
            nodeType = 'Conveyor';
            if (meshNode.userData.variant === 'left' || (meshNode.name && meshNode.name.includes('Left'))) nodeType = 'Conveyor Left';
            if (meshNode.userData.variant === 'right' || (meshNode.name && meshNode.name.includes('Right'))) nodeType = 'Conveyor Right';
        }

        const serializedUserData = {};
        for (const attributeKey in meshNode.userData) {
            if (typeof meshNode.userData[attributeKey] !== 'object' && typeof meshNode.userData[attributeKey] !== 'function') {
                serializedUserData[attributeKey] = meshNode.userData[attributeKey];
            }
        }

        structuredBuilds.push({
            t: nodeType,
            p: [meshNode.position.x, meshNode.position.y, meshNode.position.z],
            r: meshNode.rotation.y,
            u: serializedUserData
        });
    });

    const structuredPowerWires = [];
    if (player.powerLinks) {
        player.powerLinks.forEach(wire => {
            if (wire.a && wire.b) {
                structuredPowerWires.push({
                    a: [wire.a.position.x, wire.a.position.y, wire.a.position.z],
                    b: [wire.b.position.x, wire.b.position.y, wire.b.position.z]
                });
            }
        });
    }

    const compiledSaveData = {
        i: serializeInventory(),
        b: structuredBuilds,
        l: structuredPowerWires,
        t: Date.now()
    };

    await window.FB.saveFWData(activeUserUid, compiledSaveData);
}

async function loadUserCloudSave(uid) {
    activeUserUid = uid;
    const cloudSave = await window.FB.getFWData(uid);
    if (!cloudSave) return;

    if (player.powerLinks) {
        while (player.powerLinks.length > 0) {
            const currentWire = player.powerLinks[0];
            if (currentWire.connector && typeof currentWire.connector.dispose === 'function') currentWire.connector.dispose();
            player.powerLinks.shift();
        }
    }
    if (player.activeLinks) {
        while (player.activeLinks.length > 0) {
            const currentLink = player.activeLinks[0];
            if (currentLink.connector && typeof currentLink.connector.dispose === 'function') currentLink.connector.dispose();
            player.activeLinks.shift();
        }
    }

    const nativeChildren = [...player.interactables.children];
    nativeChildren.forEach(mesh => player.interactables.remove(mesh));

    if (cloudSave.i) deserializeInventory(cloudSave.i);

    if (cloudSave.b && Array.isArray(cloudSave.b)) {
        cloudSave.b.forEach(buildData => {
            let instanceMesh = null;
            const savedType = buildData.t;

            if (savedType === 'Furnace') instanceMesh = createFurnace();
            else if (savedType === 'Solar Panel') instanceMesh = createSolarPanel();
            else if (savedType === 'Workbench') instanceMesh = createWorkbench();
            else if (savedType === 'Auto Miner') instanceMesh = createAutoMiner();
            else if (savedType && savedType.startsWith('Conveyor')) {
                let structuralVariant = 'straight';
                if (savedType === 'Conveyor Left') structuralVariant = 'left';
                if (savedType === 'Conveyor Right') structuralVariant = 'right';
                instanceMesh = createConveyor(structuralVariant);
            }

            if (instanceMesh) {
                instanceMesh.position.set(buildData.p[0], buildData.p[1], buildData.p[2]);
                instanceMesh.rotation.y = buildData.r;
                if (buildData.u) instanceMesh.userData = { ...instanceMesh.userData, ...buildData.u };
                if (savedType === 'Auto Miner' && instanceMesh.userData.bindContext) {
                    instanceMesh.userData.bindContext(player.interactables, player.dropsGroup);
                }
                player.interactables.add(instanceMesh);
            }
        });
        player.interactables.updateMatrixWorld(true);
    }

    rescanAllLinks(player);

    if (cloudSave.l && Array.isArray(cloudSave.l)) {
        cloudSave.l.forEach(wireData => {
            let itemA = null; let itemB = null;
            player.interactables.children.forEach(targetMesh => {
                if (targetMesh.position.distanceTo(new THREE.Vector3(wireData.a[0], wireData.a[1], wireData.a[2])) < 0.05) itemA = targetMesh;
                if (targetMesh.position.distanceTo(new THREE.Vector3(wireData.b[0], wireData.b[1], wireData.b[2])) < 0.05) itemB = targetMesh;
            });
            if (itemA && itemB) createManualPowerLink(player, itemA, itemB);
        });
    }
    player.updateCraftingButtons();
}

// Authentication status change interceptor
if (window.FB && typeof window.FB.onAuthChange === 'function') {
    window.FB.onAuthChange((authenticatedUser) => {
        if (authenticatedUser) {
            loadUserCloudSave(authenticatedUser.uid);
        } else {
            activeUserUid = null;
        }
    });
}

// Global automated backup loop executing background saves every 20 seconds
setInterval(triggerThrottledSave, 20000);
window.addEventListener('beforeunload', () => { if (activeUserUid) executeDatabaseWrite(); });

// User Input Element Interaction Binding Wrappers
document.getElementById('qc-stick').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 2)) { player.inventory.addItem('Stick', 4); player.updateCraftingButtons(); triggerThrottledSave(); }
});
document.getElementById('qc-bench').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 5)) { player.inventory.addItem('Workbench', 1); player.updateCraftingButtons(); triggerThrottledSave(); }
});
document.getElementById('wb-stick').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 2)) { player.inventory.addItem('Stick', 4); player.updateCraftingButtons(); triggerThrottledSave(); }
});
document.getElementById('wb-bench').addEventListener('click', () => {
    if (player.inventory.consumeItem('Oak', 5)) { player.inventory.addItem('Workbench', 1); player.updateCraftingButtons(); triggerThrottledSave(); }
});
document.getElementById('wb-pickaxe').addEventListener('click', () => {
    if (player.inventory.getCount('Stone') >= 3 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Stone', 3); player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Stone Pickaxe', 1); player.updateCraftingButtons(); triggerThrottledSave();
    }
});
document.getElementById('wb-axe').addEventListener('click', () => {
    if (player.inventory.getCount('Stone') >= 3 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Stone', 3); player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Stone Axe', 1); player.updateCraftingButtons(); triggerThrottledSave();
    }
});
document.getElementById('wb-furnace').addEventListener('click', () => {
    if (player.inventory.getCount('Stone') >= 8) {
        player.inventory.consumeItem('Stone', 8);
        player.inventory.addItem('Furnace', 1); player.updateCraftingButtons(); triggerThrottledSave();
    }
});
document.getElementById('wb-autominer').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 4 && player.inventory.getCount('Iron Gear') >= 2 && player.inventory.getCount('Stick') >= 3) {
        player.inventory.consumeItem('Iron Plate', 4);
        player.inventory.consumeItem('Iron Gear', 2);
        player.inventory.consumeItem('Stick', 3);
        player.inventory.addItem('Auto Miner', 1);
        player.updateCraftingButtons(); triggerThrottledSave();
    }
});
document.getElementById('wb-conveyor').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 2 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Iron Plate', 2);
        player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Conveyor', 1);
        player.updateCraftingButtons(); triggerThrottledSave();
    }
});
document.getElementById('wb-conveyor-left').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 2 && player.inventory.getCount('Iron Gear') >= 1 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Iron Plate', 2);
        player.inventory.consumeItem('Iron Gear', 1);
        player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Conveyor Left', 1);
        player.updateCraftingButtons(); triggerThrottledSave();
    }
});
document.getElementById('wb-conveyor-right').addEventListener('click', () => {
    if (player.inventory.getCount('Iron Plate') >= 2 && player.inventory.getCount('Iron Gear') >= 1 && player.inventory.getCount('Stick') >= 2) {
        player.inventory.consumeItem('Iron Plate', 2);
        player.inventory.consumeItem('Iron Gear', 1);
        player.inventory.consumeItem('Stick', 2);
        player.inventory.addItem('Conveyor Right', 1);
        player.updateCraftingButtons(); triggerThrottledSave();
    }
});
document.getElementById('wb-solarpanel').addEventListener('click', () => {
    if (player.craftSolarPanel()) { player.updateCraftingButtons(); triggerThrottledSave(); }
});

document.getElementById('fn-smelt').addEventListener('click', () => { player.smeltIron(); triggerThrottledSave(); });
document.getElementById('fn-plate').addEventListener('click', () => { player.craftIronPlate(); triggerThrottledSave(); });
document.getElementById('fn-gear').addEventListener('click', () => { player.craftIronGear(); triggerThrottledSave(); });
document.getElementById('fn-silicon').addEventListener('click', () => { player.smeltQuartz(); triggerThrottledSave(); });
document.getElementById('fn-glass').addEventListener('click', () => { player.smeltSand(); triggerThrottledSave(); });

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

let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (tick) tick(time, 2500);

    // Track state modifications from structural layout placements to flag saves
    const previousInteractableCount = player.interactables ? player.interactables.children.length : 0;
    
    player.update(dt, grassPlatform, interactablesGroup, dropsGroup, markersGroup, platformWidth, platformLength);
    tickPowerVisuals(player, time);
    updateCoordsHud();

    const postInteractableCount = player.interactables ? player.interactables.children.length : 0;
    if (previousInteractableCount !== postInteractableCount) {
        triggerThrottledSave();
    }

    renderer.render(scene, camera);
    player.inventory.render3DSlots();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();