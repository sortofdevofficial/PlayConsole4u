import * as THREE from 'three';

export default class Environment {
    constructor(scene) {
        this.targets = [];
        this.colliders = [];

        scene.background = new THREE.Color('#2c3e50');
        scene.fog = new THREE.FogExp2('#2c3e50', 0.04);

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(15, 25, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024; sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
        sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
        scene.add(sun);

        // Floor — small arena
        const floorGeo = new THREE.PlaneGeometry(30, 30);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#4a5568', roughness: 0.95 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        this.targets.push(floor);

        // Invisible arena boundary walls
        this._boundary(scene, 15, 5, 0,  30, 10, 1);   // +Z wall
        this._boundary(scene, -15, 5, 0, 30, 10, 1);   // -Z wall  
        this._boundary(scene, 0, 5, 15,  1, 10, 30);   // +X wall
        this._boundary(scene, 0, 5, -15, 1, 10, 30);   // -X wall

        // 5 color walls — evenly spaced across the arena, all paintable + collidable
        const walls = [
            { x: -10, z: -8,  rot: 0,   color: '#c0392b', w: 6, h: 5, d: 1 }, // red
            { x:  -4, z:  5,  rot: 0.4, color: '#27ae60', w: 5, h: 4, d: 1 }, // green
            { x:   4, z: -5,  rot: -0.3,color: '#2980b9', w: 6, h: 6, d: 1 }, // blue
            { x:  10, z:  6,  rot: 0,   color: '#e67e22', w: 5, h: 5, d: 1 }, // orange
            { x:   0, z:  0,  rot: 0.8, color: '#8e44ad', w: 4, h: 5, d: 1 }, // purple
        ];

        walls.forEach(w => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w.w, w.h, w.d),
                new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.8 })
            );
            mesh.position.set(w.x, w.h / 2, w.z);
            mesh.rotation.y = w.rot;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            this.targets.push(mesh);

            // Collider — axis-aligned approximation (good enough for small walls)
            const hw = w.w / 2 + 0.1, hh = w.h / 2, hd = w.d / 2 + 0.1;
            this.colliders.push({
                minX: w.x - hw, maxX: w.x + hw,
                minY: 0,        maxY: w.h,
                minZ: w.z - hd, maxZ: w.z + hd,
            });
        });

        // One small platform in the center
        const platMesh = new THREE.Mesh(
            new THREE.BoxGeometry(5, 0.5, 5),
            new THREE.MeshStandardMaterial({ color: '#5d6d7e', roughness: 0.9 })
        );
        platMesh.position.set(0, 2.5, -10);
        platMesh.castShadow = true; platMesh.receiveShadow = true;
        scene.add(platMesh);
        this.targets.push(platMesh);
        this.colliders.push({ minX:-2.5, maxX:2.5, minY:2.25, maxY:2.75, minZ:-12.5, maxZ:-7.5 });
    }

    _boundary(scene, x, y, z, w, h, d) {
        this.colliders.push({ minX: x-w/2, maxX: x+w/2, minY: 0, maxY: h, minZ: z-d/2, maxZ: z+d/2 });
    }
}