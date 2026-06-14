import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3(), direction = new THREE.Vector3();
let prevTime = performance.now();

let raycaster;
const mouse = new THREE.Vector2(); 
let isPainting = false;
let paintPoints = []; 
let paintMesh = null;
let startNode, endNode;

let doorPivot;
let puzzlePanel;
let isDoorOpen = false;

let grassMaterialShader = null;

// Block Right-Click Menu natively
window.addEventListener('contextmenu', e => e.preventDefault());

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x88bbcc, 0.015);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.body.appendChild(renderer.domElement);

    createGradientSky();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x446688, 0.6);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff5e6, 1.5);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const groundGeo = new THREE.PlaneGeometry(200, 200);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x243b1c, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    createHighEndGrass();

    // --- THE DOOR SETUP ---
    doorPivot = new THREE.Group();
    doorPivot.position.set(-1.5, 1.5, -4);
    scene.add(doorPivot);

    const doorGroup = new THREE.Group();
    doorGroup.position.set(1.5, 0, 0); 
    
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 1.0, flatShading: true });
    const lightWood = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 1.0, flatShading: true });
    
    // Wood Planks
    for(let i=0; i<5; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.58, 3, 0.15), i % 2 === 0 ? darkWood : lightWood);
        plank.position.set(-1.2 + (i * 0.6), 0, 0);
        plank.castShadow = true;
        plank.receiveShadow = true;
        doorGroup.add(plank);
    }

    // Crossbeams
    const beamGeo = new THREE.BoxGeometry(2.8, 0.2, 0.2);
    const topBeam = new THREE.Mesh(beamGeo, darkWood);
    topBeam.position.set(0, 1.2, 0.05);
    topBeam.castShadow = true;
    doorGroup.add(topBeam);

    const bottomBeam = new THREE.Mesh(beamGeo, darkWood);
    bottomBeam.position.set(0, -1.2, 0.05);
    bottomBeam.castShadow = true;
    doorGroup.add(bottomBeam);

    // Hardware: Doorknob
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), metalMat);
    knob.position.set(1.1, 0, 0.15);
    knob.castShadow = true;
    doorGroup.add(knob);

    // Hardware: Iron Hinges
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.5 });
    const hingeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
    
    const hinge1 = new THREE.Mesh(hingeGeo, ironMat);
    hinge1.position.set(-1.45, 1, 0.1);
    doorGroup.add(hinge1);
    
    const hinge2 = new THREE.Mesh(hingeGeo, ironMat);
    hinge2.position.set(-1.45, -1, 0.1);
    doorGroup.add(hinge2);

    doorPivot.add(doorGroup);

    // --- PUZZLE BOARD ---
    puzzlePanel = new THREE.Group();
    puzzlePanel.position.set(1.5, 0, 0.12); 
    doorPivot.add(puzzlePanel);

    const boardGeo = new THREE.BoxGeometry(2.4, 2.4, 0.1);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.5 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.receiveShadow = true;
    board.castShadow = true;
    puzzlePanel.add(board);

    const frameGeo = new THREE.BoxGeometry(2.5, 2.5, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.02;
    puzzlePanel.add(frame);

    startNode = createTextNode("START");
    startNode.position.set(-0.8, -0.8, 0.05);
    startNode.userData = { type: 'start' };
    puzzlePanel.add(startNode);

    endNode = createTextNode("END");
    endNode.position.set(0.8, 0.8, 0.05);
    endNode.userData = { type: 'end' };
    puzzlePanel.add(endNode);

    // Controls
    controls = new PointerLockControls(camera, document.body);
    raycaster = new THREE.Raycaster();

    controls.addEventListener('lock', () => document.body.classList.add('locked'));
    controls.addEventListener('unlock', () => document.body.classList.remove('locked'));
    scene.add(controls.getObject());

    document.addEventListener('keydown', (e) => handleKey(e.code, true));
    document.addEventListener('keyup', (e) => handleKey(e.code, false));
    
    document.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    setupInteractionLogic();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function createGradientSky() {
    const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `;
    const fragmentShader = `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
            float h = normalize( vWorldPosition + offset ).y;
            gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
        }
    `;
    const uniforms = {
        topColor: { value: new THREE.Color(0x1a4a82) }, 
        bottomColor: { value: new THREE.Color(0x88bbcc) }, 
        offset: { value: 33 },
        exponent: { value: 0.6 }
    };
    const skyGeo = new THREE.SphereGeometry( 500, 32, 15 );
    const skyMat = new THREE.ShaderMaterial({
        uniforms: uniforms, vertexShader: vertexShader, fragmentShader: fragmentShader, side: THREE.BackSide
    });
    scene.add( new THREE.Mesh( skyGeo, skyMat ) );
}

function createTextNode(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = 'bold 110px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 15;
    ctx.fillText(text, 256, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    
    const mat = new THREE.MeshStandardMaterial({ 
        map: texture, transparent: true, emissive: 0xffffff,
        emissiveMap: texture, emissiveIntensity: 0.8, depthWrite: false
    });
    
    return new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.03), mat);
}

function createHighEndGrass() {
    const grassGeo = new THREE.PlaneGeometry(0.04, 0.5, 1, 4);
    grassGeo.translate(0, 0.25, 0); 
    const pos = grassGeo.attributes.position;
    const colors = [];
    
    for(let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        pos.setZ(i, pos.getZ(i) + (y * y * 0.2)); 
        const mix = y / 0.5;
        colors.push(0.05 + mix * 0.2, 0.25 + mix * 0.5, 0.05 + mix * 0.1);
    }
    grassGeo.computeVertexNormals();
    grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 });
    grassMat.onBeforeCompile = (shader) => {
        shader.uniforms.time = { value: 0 };
        grassMaterialShader = shader;
        shader.vertexShader = `uniform float time;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `
            #include <begin_vertex>
            float windForce = sin(time * 2.0 + instanceMatrix[3][0] * 0.5 + instanceMatrix[3][2] * 0.5) * 0.15;
            transformed.x += windForce * position.y;
            transformed.z += windForce * position.y;
            `
        );
    };

    const grassCount = 40000; 
    const instancedGrass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    instancedGrass.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < grassCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 3.5 + Math.random() * 40; 
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius - 4; 
        dummy.position.set(x, 0, z);
        dummy.rotation.y = Math.random() * Math.PI; 
        dummy.scale.setScalar(0.7 + Math.random() * 0.6); 
        dummy.updateMatrix();
        instancedGrass.setMatrixAt(i, dummy.matrix);
    }
    scene.add(instancedGrass);
}

function handleKey(code, isDown) {
    if(code==='KeyW'||code==='ArrowUp') moveForward = isDown;
    if(code==='KeyA'||code==='ArrowLeft') moveLeft = isDown;
    if(code==='KeyS'||code==='ArrowDown') moveBackward = isDown;
    if(code==='KeyD'||code==='ArrowRight') moveRight = isDown;
}

function setupInteractionLogic() {
    document.addEventListener('mousedown', (e) => {
        if (isDoorOpen || e.button !== 0) return;

        if (!controls.isLocked) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(puzzlePanel, true);

            if (intersects.length > 0) {
                const hitObj = intersects[0].object;
                
                if (hitObj === startNode || hitObj.userData.type === 'start') {
                    isPainting = true;
                    if (paintMesh) {
                        puzzlePanel.remove(paintMesh);
                        paintMesh.geometry.dispose();
                        paintMesh = null;
                    }
                    const localHit = puzzlePanel.worldToLocal(intersects[0].point);
                    localHit.z = 0.08; 
                    paintPoints = [localHit];
                }
            } else {
                controls.lock(); // Click background to walk
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (!isPainting || e.button !== 0) return;
        isPainting = false;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(endNode, true);

        if (intersects.length > 0 && (intersects[0].object === endNode || intersects[0].object.userData.type === 'end')) {
            isDoorOpen = true; 
        } else {
            if (paintMesh) {
                puzzlePanel.remove(paintMesh);
                paintMesh.geometry.dispose();
                paintMesh = null;
                paintPoints = [];
            }
        }
    });
}

function updatePaintLine(newPoint) {
    const lastPt = paintPoints[paintPoints.length - 1];
    if (lastPt.distanceTo(newPoint) < 0.02) return; 

    paintPoints.push(newPoint);
    if (paintPoints.length < 2) return;

    const pathCurve = new THREE.CatmullRomCurve3(paintPoints);
    const tubeGeo = new THREE.TubeGeometry(pathCurve, paintPoints.length * 2, 0.04, 12, false);

    if (!paintMesh) {
        const paintMat = new THREE.MeshStandardMaterial({ 
            color: 0xff0000, emissive: 0xaa0000, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.3 
        });
        paintMesh = new THREE.Mesh(tubeGeo, paintMat);
        paintMesh.castShadow = true;
        puzzlePanel.add(paintMesh);
    } else {
        paintMesh.geometry.dispose(); 
        paintMesh.geometry = tubeGeo; 
    }
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();

    if (grassMaterialShader) grassMaterialShader.uniforms.time.value = time * 0.001;

    if (isDoorOpen && doorPivot.rotation.y > -Math.PI / 1.5) {
        doorPivot.rotation.y = THREE.MathUtils.lerp(doorPivot.rotation.y, -Math.PI / 1.5, 0.03);
    }

    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        
        if (moveForward || moveBackward) velocity.z -= direction.z * 60.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 60.0 * delta;
        
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
    }

    if (isPainting && !controls.isLocked) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(puzzlePanel, true);
        
        if (intersects.length > 0) {
            const localHit = puzzlePanel.worldToLocal(intersects[0].point);
            localHit.z = 0.08; 
            updatePaintLine(localHit);
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}