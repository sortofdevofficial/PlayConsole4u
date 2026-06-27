import * as THREE from 'three';

export default class Environment {
    constructor(scene) {
        this.targets = [];
        this.colliders = [];

        // Sky gradient via background color + fog
        scene.background = new THREE.Color('#87ceeb');
        scene.fog = new THREE.Fog('#c9e8f5', 40, 80);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
        sun.position.set(20, 40, 15);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.top = sun.shadow.camera.right = 20;
        sun.shadow.camera.bottom = sun.shadow.camera.left = -20;
        sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
        scene.add(sun);

        // Hemisphere sky light
        scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.4));

        // Sun disc in sky
        const sunDisc = new THREE.Mesh(
            new THREE.CircleGeometry(2, 32),
            new THREE.MeshBasicMaterial({ color: '#fff5c0', side: THREE.DoubleSide })
        );
        sunDisc.position.set(30, 35, -30);
        sunDisc.lookAt(0, 0, 0);
        scene.add(sunDisc);

        // Clouds (flat planes)
        const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        [[  8, 18, -20, 5, 1.5], [-10, 20, -15, 4, 1.2], [15, 22, -10, 3, 1], [-5, 16, 10, 4, 1.3]].forEach(([x,y,z,w,h]) => {
            const c = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
            c.position.set(x, y, z); c.rotation.x = -0.1;
            scene.add(c);
        });

        // Floor — grass
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshStandardMaterial({ color: '#5a8a3c', roughness: 0.95 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        this.targets.push(floor);

        // Invisible arena walls
        [
            [0, 0, 25, 50, 6, 1],
            [0, 0,-25, 50, 6, 1],
            [25, 0, 0,  1, 6, 50],
            [-25,0, 0,  1, 6, 50],
        ].forEach(([x,y,z,w,h,d]) => this._addCollider(x, y, z, w, h, d));

        // 5 colored paint walls — varied positions and sizes
        const wallDefs = [
            { x:-10, z:-8,  rotY: 0,    color:'#b83232', w:3.5, h:2.5, d:0.4 },
            { x: -3, z: 6,  rotY: 0.5,  color:'#2e8b57', w:3, h:2, d:0.4 },
            { x:  5, z:-4,  rotY:-0.3,  color:'#2060a0', w:3.5, h:3, d:0.4 },
            { x: 10, z: 5,  rotY: 0,    color:'#c07820', w:3, h:2.2, d:0.4 },
            { x:  0, z: 0,  rotY: 0.8,  color:'#7040a0', w:2.5, h:2.5, d:0.4 },
        ];

        wallDefs.forEach(w => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w.w, w.h, w.d),
                new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.8 })
            );
            mesh.position.set(w.x, w.h / 2, w.z);
            mesh.rotation.y = w.rotY;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            this.targets.push(mesh);
            // AABB collider (axis-aligned, ignores rotation — close enough for small walls)
            this._addCollider(w.x, w.h / 2, w.z, w.w + 0.3, w.h, w.d + 0.3);
        });

        // Platform
        const plat = new THREE.Mesh(
            new THREE.BoxGeometry(4, 0.3, 4),
            new THREE.MeshStandardMaterial({ color: '#8b6914', roughness: 0.9 })
        );
        plat.position.set(0, 1.5, -10);
        plat.castShadow = true; plat.receiveShadow = true;
        scene.add(plat);
        this.targets.push(plat);
        this._addCollider(0, 1.5, -10, 4, 0.3, 4);

        // Some trees for visual dressing
        this._addTree(scene, -18, 0, -8);
        this._addTree(scene,  16, 0, -12);
        this._addTree(scene, -14, 0, 14);
        this._addTree(scene,  18, 0, 10);
    }

    _addCollider(cx, cy, cz, w, h, d) {
        this.colliders.push({
            minX: cx - w/2, maxX: cx + w/2,
            minY: cy - h/2, maxY: cy + h/2,
            minZ: cz - d/2, maxZ: cz + d/2,
        });
    }

    _addTree(scene, x, y, z) {
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.14, 0.9, 8),
            new THREE.MeshStandardMaterial({ color: '#6b4226' })
        );
        trunk.position.set(x, 0.45, z);
        trunk.castShadow = true;
        scene.add(trunk);

        const leaves = new THREE.Mesh(
            new THREE.SphereGeometry(0.7, 8, 8),
            new THREE.MeshStandardMaterial({ color: '#3a7d44' })
        );
        leaves.position.set(x, 1.5, z);
        leaves.castShadow = true;
        scene.add(leaves);
    }
}