import * as THREE from 'three';
import Player from './Player.js';

// --- GAME STATE ---
let gameState = 'lobby'; // 'lobby' or 'playing'
let localRole = 'hider';

// --- SETUP SCENE & GRAPHICS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#87CEEB'); // Beautiful Blue Sky
scene.fog = new THREE.Fog('#87CEEB', 15, 60);  // Depth fading

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // SHADOWS ENABLED
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
scene.add(dirLight);

const colliders = [];

// --- MAP GENERATION WITH HOLLOW HIDING SPOTS ---
function createSolidBox(w, h, d, x, y, z, color) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 })
    );
    mesh.position.set(x, y + h/2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({
        minX: x - w/2, maxX: x + w/2,
        minY: y, maxY: y + h,
        minZ: z - d/2, maxZ: z + d/2
    });
}

function createHollowBunker(w, h, d, x, y, z, thickness, color) {
    // Left Wall
    createSolidBox(thickness, h, d, x - w/2 + thickness/2, y, z, color);
    // Right Wall
    createSolidBox(thickness, h, d, x + w/2 - thickness/2, y, z, color);
    // Back Wall
    createSolidBox(w, h, thickness, x, y, z - d/2 + thickness/2, color);
    // Roof
    createSolidBox(w, thickness, d, x, y + h - thickness, z, color);
    // Note: The front is left totally open so you can walk INSIDE and hide perfectly.
}

// Map Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: '#556b2f', roughness: 1.0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Populate Game Map
createSolidBox(4, 3, 4, 10, 0, 10, '#8B4513'); // Solid block
createSolidBox(2, 4, 8, -15, 0, 5, '#708090'); // Solid wall
createHollowBunker(6, 4, 6, -10, 0, -15, 0.5, '#4682B4'); // YOU CAN HIDE INSIDE THIS!
createHollowBunker(5, 3, 5, 15, 0, -10, 0.4, '#B22222'); // YOU CAN HIDE INSIDE THIS!

// Create Lobby Area (Floating Glass Platform)
const lobbyFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })
);
lobbyFloor.rotation.x = -Math.PI / 2;
lobbyFloor.position.y = 30; // High in the sky
lobbyFloor.receiveShadow = true;
scene.add(lobbyFloor);
colliders.push({
    minX: -10, maxX: 10,
    minY: 29.9, maxY: 30,
    minZ: -10, maxZ: 10
});

// --- UI INJECTION ---
const uiContainer = document.createElement('div');
document.body.appendChild(uiContainer);

// 1. Top HUD (Seekers vs Hiders)
const topHud = document.createElement('div');
topHud.style.cssText = 'position:absolute; top:15px; width:100%; text-align:center; color:white; font-family:sans-serif; font-size:28px; font-weight:bold; text-shadow: 2px 2px 4px #000; display:none; pointer-events:none; z-index:10;';
topHud.innerHTML = '<span style="color:#ef4444">Seekers: 0</span> &nbsp;|&nbsp; <span style="color:#3b82f6">Hiders: 0</span>';
uiContainer.appendChild(topHud);

// 2. Player Sidebar
const sidebar = document.createElement('div');
sidebar.style.cssText = 'position:absolute; right:15px; top:80px; width:180px; background:rgba(15,23,42,0.8); border: 1px solid #334155; color:white; font-family:sans-serif; padding:15px; border-radius:8px; display:none; pointer-events:none; z-index:10;';
sidebar.innerHTML = '<h3 style="margin:0 0 10px 0; font-size:16px; border-bottom:1px solid #475569; padding-bottom:5px;">Players</h3><ul id="player-list" style="list-style:none; padding:0; margin:0; font-size:14px; line-height:1.6;"></ul>';
uiContainer.appendChild(sidebar);

// 3. Paint Menu (No bucket, added Metallic/Matte)
const paintUI = document.createElement('div');
paintUI.style.cssText = 'position:absolute; bottom:20px; left:20px; background:rgba(15,23,42,0.9); padding:15px; border-radius:8px; display:flex; gap:10px; z-index:10;';
paintUI.innerHTML = `
    <input type="color" id="paint-color" value="#ff0000" style="cursor:pointer; width:40px; height:40px; border:none; border-radius:4px;">
    <select id="paint-tool" style="background:#1e293b; color:white; border:1px solid #334155; border-radius:4px; padding:5px; cursor:pointer;">
        <option value="brush">Standard Brush</option>
        <option value="metallic">Metallic Paint</option>
        <option value="matte">Matte Paint</option>
        <option value="eraser">Eraser</option>
    </select>
    <button id="start-btn" style="background:#10b981; color:white; border:none; padding:10px 20px; font-weight:bold; border-radius:4px; cursor:pointer;">START GAME</button>
`;
uiContainer.appendChild(paintUI);

// --- PLAYER INIT ---
const player = new Player(scene, '#c8cdd4');
player.setName("Host");
// Spawn in lobby initially
player.group.position.set(0, 31, 0); 
const bots = []; // For testing sidebar/UI

const keys = { w: false, a: false, s: false, d: false, jx: 0, jz: 0 };
let isSprinting = false;

window.addEventListener('keydown', e => {
    if(e.code === 'KeyW') keys.w = true;
    if(e.code === 'KeyS') keys.s = true;
    if(e.code === 'KeyA') keys.a = true;
    if(e.code === 'KeyD') keys.d = true;
    if(e.code === 'Space') player.jump();
    if(e.code === 'ShiftLeft') isSprinting = true;
});
window.addEventListener('keyup', e => {
    if(e.code === 'KeyW') keys.w = false;
    if(e.code === 'KeyS') keys.s = false;
    if(e.code === 'KeyA') keys.a = false;
    if(e.code === 'KeyD') keys.d = false;
    if(e.code === 'ShiftLeft') isSprinting = false;
});

// --- GAME LOGIC CONTROLLERS ---
function updateUI() {
    // Only show HUD in-game
    if (gameState === 'playing') {
        topHud.style.display = 'block';
        sidebar.style.display = 'block';
        // Mocking Counts for Demonstration
        let seekers = localRole === 'seeker' ? 1 : 0;
        let hiders = localRole === 'hider' ? 1 : 0;
        topHud.innerHTML = `<span style="color:#ef4444">Seekers: ${seekers}</span> &nbsp;|&nbsp; <span style="color:#3b82f6">Hiders: ${hiders}</span>`;
        
        const list = document.getElementById('player-list');
        list.innerHTML = `<li style="color:#10b981;">• ${player.playerName} (You)</li>`;
        // Add remote players here in a real network loop
    } else {
        topHud.style.display = 'none';
        sidebar.style.display = 'none';
    }
}

// Start Game Event
document.getElementById('start-btn').addEventListener('click', () => {
    if (gameState === 'lobby') {
        gameState = 'playing';
        document.getElementById('start-btn').innerText = "END ROUND";
        document.getElementById('start-btn').style.background = "#ef4444";
        
        // Teleport to map floor
        player.group.position.set((Math.random() - 0.5)*20, 1, (Math.random() - 0.5)*20);
        player.velocity.set(0,0,0);
        
        // Hide Nametag so you can hide!
        player.setNametagVisible(false);
    } else {
        gameState = 'lobby';
        document.getElementById('start-btn').innerText = "START GAME";
        document.getElementById('start-btn').style.background = "#10b981";
        
        // Teleport back to sky lobby
        player.group.position.set(0, 31, 0);
        player.velocity.set(0,0,0);
        
        // Show Nametag again
        player.setNametagVisible(true);
    }
    updateUI();
});

// --- PAINTING LOGIC ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const tool = document.getElementById('paint-tool').value;
    const color = document.getElementById('paint-color').value;

    const intersects = raycaster.intersectObjects(player.paintableMeshes);
    if (intersects.length > 0) {
        player.executePaintMatrix(intersects[0].object, intersects[0].uv, color, 12, tool);
    }
});

// --- MAIN LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    player.update(keys, isSprinting, delta, colliders);

    // Third-person camera follow
    const idealOffset = new THREE.Vector3(0, 1.5, 4);
    idealOffset.applyQuaternion(player.modelGroup.quaternion);
    idealOffset.add(player.group.position);
    
    camera.position.lerp(idealOffset, 0.1);
    camera.lookAt(player.group.position.x, player.group.position.y + 1.0, player.group.position.z);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
updateUI();