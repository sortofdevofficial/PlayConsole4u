import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

let scene, camera, renderer, controls, clock;
let environment, player;
let raycaster, mouse;
let lastPlayerPos = new THREE.Vector3(); // Used for smart camera tracking

const keys = { w: false, a: false, s: false, d: false, ' ': false, Shift: false };

let gameStarted = false;
let activeTool = 'brush'; 
let brushColor = '#38bdf8';
let brushRadius = 32;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#060911');
    
    clock = new THREE.Clock(); 

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 12);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 3.5;
    controls.maxDistance = 20;
    
    // RESTORED: Right-click to pan is back!
    controls.enablePan = true; 
    
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    environment = new Environment(scene);
    player = new Player(scene);
    
    // Set initial camera anchor
    lastPlayerPos.copy(player.group.position);
    lastPlayerPos.y += 1.2;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    window.addEventListener('keydown', (e) => { 
        if(!gameStarted) return;
        if(e.key === ' ') e.preventDefault();
        if(e.key === ' ') player.jump();
        if(e.key in keys) keys[e.key] = true; 
    });
    window.addEventListener('keyup', (e) => { if(e.key in keys) keys[e.key] = false; });
    window.addEventListener('pointerdown', handleInteraction);
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    setupUI();
}

function setupUI() {
    document.getElementById('btn-play').addEventListener('click', () => {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        gameStarted = true;
        controls.autoRotate = false; 
        clock.getDelta(); 
        
        // Snap anchor when game starts
        lastPlayerPos.copy(player.group.position);
        lastPlayerPos.y += 1.2;
    });

    const picker = document.getElementById('html-color-picker');
    const hexLabel = document.getElementById('color-hex-label');

    picker.addEventListener('input', (e) => {
        brushColor = e.target.value;
        hexLabel.textContent = brushColor.toUpperCase();
    });

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeTool = e.target.dataset.tool;
        });
    });

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            brushRadius = parseInt(e.target.dataset.radius);
        });
    });
}

function handleInteraction(event) {
    if (!gameStarted) return;
    
    // Right click is for panning, don't try to paint!
    if (event.button === 2) return; 
    
    if (event.target.closest('.hud-panel') || event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersections = raycaster.intersectObjects([...environment.targets, ...player.paintableMeshes]);

    if (intersections.length > 0) {
        const hit = intersections[0];
        
        if (player.paintableMeshes.includes(hit.object) && hit.uv) {
            if (['brush', 'bucket', 'eraser'].includes(activeTool)) {
                player.executePaintMatrix(hit.object, hit.uv, brushColor, brushRadius, activeTool);
            }
        } else if (!player.paintableMeshes.includes(hit.object)) {
            if (activeTool === 'picker') {
                brushColor = "#" + hit.object.material.color.getHexString();
                document.getElementById('html-color-picker').value = brushColor;
                document.getElementById('color-hex-label').textContent = brushColor.toUpperCase();
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = Math.min(clock.getDelta(), 0.1);

    if (gameStarted) {
        player.update(keys, keys.Shift, delta);
        
        // SMART CAMERA: Calculates how much the player moved this frame
        // and moves the camera by the exact same amount, preserving your pans!
        const currentPlayerTarget = player.group.position.clone();
        currentPlayerTarget.y += 1.2;
        
        const movementDelta = currentPlayerTarget.clone().sub(lastPlayerPos);
        
        controls.target.add(movementDelta);
        camera.position.add(movementDelta);
        
        lastPlayerPos.copy(currentPlayerTarget);
    }

    controls.update();
    renderer.render(scene, camera);
}