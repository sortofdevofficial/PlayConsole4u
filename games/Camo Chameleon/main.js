import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Environment from './Environment.js';
import Player from './Player.js';

let scene, camera, renderer, controls;
let environment, player;
let raycaster, mouse;

const keys = { w: false, a: false, s: false, d: false, ' ': false, Shift: false };

// Game State & Tool Configuration
let gameStarted = false;
let activeTool = 'brush'; 
let brushColor = '#38bdf8';
let brushRadius = 32;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#060911');

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
    
    // Auto-rotate camera slowly during the main menu!
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    environment = new Environment(scene);
    player = new Player(scene);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Input Listeners
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
    // Start Game Button
    document.getElementById('btn-play').addEventListener('click', () => {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        gameStarted = true;
        controls.autoRotate = false; // Stop menu rotation
    });

    // Color UI
    const picker = document.getElementById('html-color-picker');
    const hexLabel = document.getElementById('color-hex-label');

    picker.addEventListener('input', (e) => {
        brushColor = e.target.value;
        hexLabel.textContent = brushColor.toUpperCase();
    });

    // Tool Buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeTool = e.target.dataset.tool;
        });
    });

    // Size Buttons
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
    if (event.target.closest('.hud-panel') || event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersections = raycaster.intersectObjects([...environment.targets, player.torso]);

    if (intersections.length > 0) {
        const hit = intersections[0];
        
        if (hit.object === player.torso && hit.uv) {
            // Apply Drawing Tools ONLY if Brush, Bucket, or Eraser is selected
            if (['brush', 'bucket', 'eraser'].includes(activeTool)) {
                player.executePaintMatrix(hit.uv, brushColor, brushRadius, activeTool);
            }
        } else if (hit.object !== player.torso) {
            // Snatch Color from Environment ONLY if Eyedropper tool is selected
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

    if (gameStarted) {
        const speed = keys.Shift ? 0.22 : 0.12;
        player.update(keys, speed);
        
        // Track player
        controls.target.copy(player.group.position);
        controls.target.y = 1.2; 
    } else {
        // While in menu, just orbit around the center scene
        controls.target.set(0, 1.2, 0);
    }

    controls.update();
    renderer.render(scene, camera);
}