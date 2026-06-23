const SERVER_IP = "sortofdev.ddnsfree.com";

let scene, camera, renderer, controls;
let bee, leftWing, rightWing;
let clouds = [];
let particles;

function initMinecraftSkyWorld() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d); // Darker tech background
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.02); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 8);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.maxDistance = 15; 
    controls.minDistance = 3;
    controls.maxPolarAngle = Math.PI / 2 + 0.2; 

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0x6da4ff, 1.2); // Blue tinted light
    directional.position.set(-5, 10, 5);
    scene.add(directional);

    generateProceduralClouds();
    buildMinecraftBee();
    buildParticleSystem();
    window.addEventListener('resize', onWindowResize);
}

function generateProceduralClouds() {
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 });
    for(let i=0; i<15; i++) {
        const w = 3 + Math.random() * 5;
        const l = 4 + Math.random() * 8;
        const cloudGeo = new THREE.BoxGeometry(w, 0.4, l);
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        cloudMesh.position.set((Math.random() - 0.5) * 40, 5 + Math.random() * 3, (Math.random() - 0.5) * 40);
        cloudMesh.userData = { speed: 0.003 + Math.random() * 0.008 };
        scene.add(cloudMesh);
        clouds.push(cloudMesh);
    }
}

function buildParticleSystem() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) positions[i] = (Math.random() - 0.5) * 20;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.15, transparent: true, opacity: 0.8 });
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function buildMinecraftBee() {
    bee = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcd3c, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), bodyMat);
    bee.add(body);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.5 });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.82), stripeMat); s1.position.x = 0.1;
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.82), stripeMat); s2.position.x = -0.3;
    bee.add(s1, s2);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    leftWing = new THREE.Group(); const lwMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.6), wingMat); lwMesh.position.z = 0.3; leftWing.add(lwMesh); leftWing.position.set(0, 0.4, 0);
    rightWing = new THREE.Group(); const rwMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.6), wingMat); rwMesh.position.z = -0.3; rightWing.add(rwMesh); rightWing.position.set(0, 0.4, 0);
    bee.add(leftWing, rightWing);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // Cyber glowing eyes
    const re = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), eyeMat); re.position.set(0.6, 0.05, 0.22);
    const le = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), eyeMat); le.position.set(0.6, 0.05, -0.22);
    bee.add(re, le);
    scene.add(bee);
}

function renderTick(time) {
    requestAnimationFrame(renderTick);
    const seconds = time * 0.001;
    controls.update();
    clouds.forEach(cloud => { cloud.position.x += cloud.userData.speed; if(cloud.position.x > 25) cloud.position.x = -25; });
    if (particles) { particles.rotation.y = seconds * 0.05; particles.position.y = Math.sin(seconds * 0.2) * 0.5; }
    if (bee) {
        const dx = Math.cos(seconds * 0.8) * 2 * 0.8;
        const dz = Math.cos(seconds * 1.6) * 1.5 * 1.6;
        bee.position.set(Math.sin(seconds * 0.8) * 2, 1.0 + Math.sin(seconds * 2.5) * 0.3, Math.sin(seconds * 1.6) * 1.5);
        bee.rotation.set(-dz * 0.1, Math.atan2(-dz, dx), dx * 0.15);
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

async function fetchNetworkDiagnostics() {
    const statusText = document.getElementById('statusText');
    const playerCount = document.getElementById('playerCount');
    const serverVersion = document.getElementById('serverVersion');
    const serverMotd = document.getElementById('serverMotd');
    const pulseDot = document.querySelector('.pulse-dot');
    const playerList = document.getElementById('playerList');

    try {
        const res = await fetch(`https://api.mcsrvstat.us/2/${SERVER_IP}`);
        const data = await res.json();

        if (data.online) {
            statusText.innerText = "ONLINE"; statusText.className = "status-badge online";
            if(pulseDot) pulseDot.className = "pulse-dot online";
            playerCount.innerText = `${data.players.online} / ${data.players.max}`;
            serverVersion.innerText = data.version ? data.version.split(' ')[0] : "Hybrid Core";
            serverMotd.innerText = data.motd && data.motd.clean ? data.motd.clean.join(' ').trim() : "Packet stream active.";

            // --- RENDER LIVE PLAYER LIST ---
            if (data.players.list && data.players.list.length > 0) {
                // If players are online, map them into HTML cards
                playerList.innerHTML = data.players.list.map(name => `
                    <div class="player-card">
                        <img src="https://minotar.net/helm/${name}/32.png" alt="${name}">
                        <span>${name}</span>
                    </div>
                `).join('');
            } else {
                playerList.innerHTML = `<div class="empty-roster">No players currently in the matrix.</div>`;
            }

        } else {
            statusText.innerText = "OFFLINE"; statusText.className = "status-badge";
            if(pulseDot) pulseDot.className = "pulse-dot";
            playerCount.innerText = "0 / 0"; serverVersion.innerText = "DOWN";
            serverMotd.innerText = "Network cluster failed to respond.";
            playerList.innerHTML = `<div class="empty-roster">Server unreachable.</div>`;
        }
    } catch (err) {
        console.error("Diagnostic engine dropped data read packet handles:", err);
    }
}

function copyIpAddress() {
    navigator.clipboard.writeText(SERVER_IP);
    const domainEl = document.getElementById('serverIp');
    const orig = domainEl.innerText;
    domainEl.innerText = "COPIED TO CLIPBOARD!"; domainEl.style.color = "#34d399";
    setTimeout(() => { domainEl.innerText = orig; domainEl.style.color = ""; }, 2000);
}

window.onload = () => {
    initMinecraftSkyWorld();
    requestAnimationFrame(renderTick);
    fetchNetworkDiagnostics();
    setInterval(fetchNetworkDiagnostics, 30000); 
};