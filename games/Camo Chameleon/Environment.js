import * as THREE from 'three';
import Tire from './stuff/tire.js';

export default class Environment {
    constructor(scene) {
        this.targets = [];
        this.colliders = [];

        // Sky atmosphere + foggy horizon styling
        scene.background = new THREE.Color('#0f172a');
        scene.fog = new THREE.Fog('#1e293b', 30, 90);

        // Responsive Lighting Engine
        const ambient = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1.4);
        sun.position.set(30, 50, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.top = sun.shadow.camera.right = 30;
        sun.shadow.camera.bottom = sun.shadow.camera.left = -30;
        sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 100;
        scene.add(sun);

        scene.add(new THREE.HemisphereLight(0x38bdf8, 0x1e3a1e, 0.45));

        // 🟩 Floating Grass Platform (Everything else is the void!)
        const platformGeo = new THREE.BoxGeometry(50, 4, 50);
        
        // Green Grass top, dark brown earthen soil profile matching side segments
        const materials = [
            new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.9 }), // sides
            new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.9 }), // sides
            new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.85 }), // TOP (Vibrant Grass)
            new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 1.0 }), // bottom
            new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.9 }), // sides
            new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.9 })  // sides
        ];

        const islandMesh = new THREE.Mesh(platformGeo, materials);
        islandMesh.position.set(0, -2, 0); // Surfaces sit perfectly at y=0
        islandMesh.receiveShadow = true;
        scene.add(islandMesh);
        this.targets.push(islandMesh);

        // Invisible Arena Guard rails around the edge of the floating platform
        [
            [0, 2, 25, 50, 4, 0.5],
            [0, 2, -25, 50, 4, 0.5],
            [25, 2, 0, 0.5, 4, 50],
            [-25, 2, 0, 0.5, 4, 50]
        ].forEach(([x,y,z,w,h,d]) => this._addCollider(x, y, z, w, h, d));

        // High-fidelity architectural canvas paint walls
        const structuralWalls = [
            { x: -12, z: -10, rotY: 0.2, color: '#ef4444', w: 6, h: 4, d: 0.5 },
            { x: 12,  z: 10,  rotY: -0.4, color: '#3b82f6', w: 6, h: 4, d: 0.5 },
            { x: -8,  z: 12,  rotY: 1.1,  color: '#eab308', w: 5, h: 3.5, d: 0.5 },
            { x: 10,  z: -12, rotY: -0.8, color: '#10b981', w: 7, h: 5, d: 0.5 },
            { x: 0,   z: 0,   rotY: 0.0,  color: '#a855f7', w: 8, h: 4.5, d: 0.6 }
        ];

        structuralWalls.forEach(w => {
            const wallMesh = new THREE.Mesh(
                new THREE.BoxGeometry(w.w, w.h, w.d),
                new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.4, metalness: 0.1 })
            );
            wallMesh.position.set(w.x, w.h / 2, w.z);
            wallMesh.rotation.y = w.rotY;
            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;
            scene.add(wallMesh);
            this.targets.push(wallMesh);
            
            // Perfect Axis-Aligned Cover Bounds
            this._addCollider(w.x, w.h / 2, w.z, w.w + 0.4, w.h, w.d + 0.4);
        });

        // 📁 Internal Asset Folder Instantiations (stuff/)
        this.tireProp = new Tire(scene);
        this.tireProp.mesh.position.set(-4, 0.5, -6);
        this.targets.push(this.tireProp.mesh);
        this._addCollider(-4, 0.5, -6, 1.2, 1.0, 1.2);
    }

    _addCollider(cx, cy, cz, w, h, d) {
        this.colliders.push({
            minX: cx - w/2, maxX: cx + w/2,
            minY: cy - h/2, maxY: cy + h/2,
            minZ: cz - d/2, maxZ: cz + d/2,
        });
    }
}