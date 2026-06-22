// --- IP ENDPOINT SETTING ---
const SERVER_IP = "sortofdev.ddnsfree.com";

// --- GRAPHICS CORE HANDLERS ---
let scene, camera, renderer, controls;
let bee, leftWing, rightWing;
let clouds = [];
let particles;

function initMinecraftSkyWorld() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x6da4ff);
    scene.fog = new THREE.FogExp2(0x6da4ff, 0.03); // Softer, more realistic distance fading

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 8); // Pulled camera slightly back for better field of view

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Add Interactive Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth drag inertia
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.maxDistance = 15; // Prevent user from zooming out too far into nothing
    controls.minDistance = 3;
    controls.maxPolarAngle = Math.PI / 2 + 0.2; // Stop camera from going completely upside down

    // Global Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    
    const directional = new THREE.DirectionalLight(0xffffee, 0.6);
    directional.position.set(-5, 10, 5);
    scene.add(directional);

    // Build World
    buildBoxySun();
    generateProceduralClouds();
    buildMinecraftBee();
    buildParticleSystem();

    window.addEventListener('resize', onWindowResize);
}

function buildBoxySun() {
    const sunGeo = new THREE.BoxGeometry(3, 3, 0.1);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(-10, 8, -20);
    sun.rotation.set(0.1, 0.3, 0);
    scene.add(sun);
}

function generateProceduralClouds() {
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });

    for(let i=0; i<15; i++) {
        const w = 3 + Math.random() * 5;
        const l = 4 + Math.random() * 8;
        const cloudGeo = new THREE.BoxGeometry(w, 0.4, l);
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        
        cloudMesh.position.set(
            (Math.random() - 0.5) * 40,
            5 + Math.random() * 3,
            (Math.random() - 0.5) * 40
        );
        cloudMesh.userData = { speed: 0.003 + Math.random() * 0.008 };
        scene.add(cloudMesh);
        clouds.push(cloudMesh);
    }
}

function buildParticleSystem() {
    // Adds floating "spores" or "dust" in the air for ambiance
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 20;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Flat square blocks for particles to match Minecraft style
    const material = new THREE.PointsMaterial({
        color: 0xffe270,
        size: 0.15,
        transparent: true,
        opacity: 0.6
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function buildMinecraftBee() {
    bee = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcd3c, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), bodyMat);
    bee.add(body);

    // Stripes
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.5 });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.82), stripeMat);
    s1.position.x = 0.1;
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.82), stripeMat);
    s2.position.x = -0.3;
    bee.add(s1, s2);

    // Wings
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });

    leftWing = new THREE.Group();
    const lwMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.6), wingMat);
    lwMesh.position.z = 0.3;
    leftWing.add(lwMesh);
    leftWing.position.set(0, 0.4, 0);
    
    rightWing = new THREE.Group();
    const rwMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.6), wingMat);
    rwMesh.position.z = -0.3;
    rightWing.add(rwMesh);
    rightWing.position.set(0, 0.4, 0);
    
    bee.add(leftWing, rightWing);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const re = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), eyeMat);
    re.position.set(0.6, 0.05, 0.22);
    const le = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), eyeMat);
    le.position.set(0.6, 0.05, -0.22);
    bee.add(re, le);

    scene.add(bee);
}

// Rendering Animation Clock Loop
function renderTick(time) {
    requestAnimationFrame(renderTick);
    const seconds = time * 0.001;

    controls.update(); // Required for smooth orbit damping

    // Animate Clouds
    clouds.forEach(cloud => {
        cloud.position.x += cloud.userData.speed;
        if(cloud.position.x > 25) cloud.position.x = -25;
    });

    // Animate Particles (Slow drifting up and rotating)
    if (particles) {
        particles.rotation.y = seconds * 0.05;
        particles.position.y = Math.sin(seconds * 0.2) * 0.5;
    }

    // Advanced Bee Flight AI (Figure-8 pattern with banking)
    if (bee) {
        // Core positioning math
        const xPath = Math.sin(seconds * 0.8) * 2;
        const zPath = Math.sin(seconds * 1.6) * 1.5; // Figure-8 motion
        
        bee.position.x = xPath;
        bee.position.z = zPath;
        bee.position.y = 1.0 + Math.sin(seconds * 2.5) * 0.3; // Hover bobbing
        
        // Banking: Calculate velocity vectors to make the bee tilt into turns
        const dx = Math.cos(seconds * 0.8) * 2 * 0.8;
        const dz = Math.cos(seconds * 1.6) * 1.5 * 1.6;
        
        bee.rotation.y = Math.atan2(-dz, dx); // Look in the direction of travel
        bee.rotation.z = dx * 0.15; // Bank (roll) into the turn
        bee.rotation.x = -dz * 0.1; // Pitch slightly up/down based on z-movement

        // Wing flutter
        leftWing.rotation.x = Math.sin(seconds * 70) * 0.6;
        rightWing.rotation.x = -Math.sin(seconds * 70) * 0.6;
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- NETWORK API ASYNC CALLS ---
async function fetchNetworkDiagnostics() {
    const statusText = document.getElementById('statusText');
    const playerCount = document.getElementById('playerCount');
    const serverVersion = document.getElementById('serverVersion');
    const serverMotd = document.getElementById('serverMotd');
    const pulseDot = document.querySelector('.pulse-dot');

    try {
        const res = await fetch(`https://api.mcsrvstat.us/2/${SERVER_IP}`);
        const data = await res.json();

        if (data.online) {
            statusText.innerText = "ONLINE";
            statusText.className = "status-badge online";
            if(pulseDot) pulseDot.className = "pulse-dot online";

            playerCount.innerText = `${data.players.online} / ${data.players.max}`;
            serverVersion.innerText = data.version ? data.version.split(' ')[0] : "Hybrid Core";
            
            if (data.motd && data.motd.clean) {
                serverMotd.innerText = data.motd.clean.join(' ').trim();
            } else {
                serverMotd.innerText = "Network proxy socket online.";
            }
        } else {
            setInterfaceOffline(statusText, playerCount, serverVersion, serverMotd, pulseDot);
        }
    } catch (err) {
        console.error("Diagnostic engine dropped data read packet handles:", err);
    }
}

function setInterfaceOffline(statusText, playerCount, serverVersion, serverMotd, pulseDot) {
    statusText.innerText = "OFFLINE";
    statusText.className = "status-badge";
    if(pulseDot) pulseDot.className = "pulse-dot";
    playerCount.innerText = "0 / 0";
    serverVersion.innerText = "DOWN";
    serverMotd.innerText = "Network cluster failed to respond.";
}

function copyIpAddress() {
    navigator.clipboard.writeText(SERVER_IP);
    const domainEl = document.getElementById('serverIp');
    const orig = domainEl.innerText;
    domainEl.innerText = "COPIED TO CLIPBOARD!";
    domainEl.style.color = "#34d399";
    setTimeout(() => { 
        domainEl.innerText = orig; 
        domainEl.style.color = ""; // Reset
    }, 2000);
}

window.onload = () => {
    initMinecraftSkyWorld();
    requestAnimationFrame(renderTick);
    fetchNetworkDiagnostics();
    setInterval(fetchNetworkDiagnostics, 30000); 
};