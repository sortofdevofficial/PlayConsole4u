import * as THREE from 'three';
import { Player } from './player.js';
import { buildWorld } from './world.js';
import { initCraftPreviews } from './inventory.js';

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

document.getElementById('fn-smelt').addEventListener('click', () => { player.smeltIron(); });
document.getElementById('fn-plate').addEventListener('click', () => { player.craftIronPlate(); });
document.getElementById('fn-gear').addEventListener('click', () => { player.craftIronGear(); });

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
    { buttonId: 'fn-smelt', itemName: 'Iron Ingot' },
    { buttonId: 'fn-plate', itemName: 'Iron Plate' },
    { buttonId: 'fn-gear', itemName: 'Iron Gear' }
]);

let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (tick) tick(time, 6000);

    player.update(dt, grassPlatform, interactablesGroup, dropsGroup, markersGroup, platformWidth, platformLength);

    renderer.render(scene, camera);
    player.inventory.render3DSlots();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();