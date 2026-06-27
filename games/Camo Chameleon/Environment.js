import * as THREE from 'three';

export default class Environment {
    constructor(scene) {
        this.targets = [];
        this.colliders = []; // AABB boxes: {minX,maxX,minY,maxY,minZ,maxZ}

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(30, 50, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.top = 40;
        sun.shadow.camera.bottom = -40;
        sun.shadow.camera.left = -40;
        sun.shadow.camera.right = 40;
        scene.add(sun);

        // Sky color
        scene.background = new THREE.Color('#0d1b2a');
        scene.fog = new THREE.FogExp2('#0d1b2a', 0.018);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(80, 80);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#1a2744', roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        this.targets.push(floor);

        // Floor collider (infinite-ish flat surface handled in Player)

        // Arena boundary walls (invisible)
        this._addBoundary(scene, 40, 0, 80, 10); // +Z
        this._addBoundary(scene, -40, 0, 80, 10); // -Z
        this._addBoundary(scene, 0, 40, 10, 80); // +X (rotated)
        this._addBoundary(scene, 0, -40, 10, 80); // -X

        // Colored paint walls (targets)
        const walls = [
            { x: -25, z: -18, color: '#ef4444', w: 10, h: 7, d: 1.5 },
            { x: -10, z: -20, color: '#22c55e', w: 10, h: 5, d: 1.5 },
            { x:   5, z: -19, color: '#3b82f6', w: 10, h: 8, d: 1.5 },
            { x:  20, z: -18, color: '#eab308', w: 10, h: 6, d: 1.5 },
            { x: -18, z:  15, color: '#d946ef', w: 1.5, h: 7, d: 10 },
            { x:  18, z:  15, color: '#f97316', w: 1.5, h: 7, d: 10 },
        ];

        walls.forEach(w => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w.w, w.h, w.d),
                new THREE.MeshStandardMaterial({ color: w.color })
            );
            mesh.position.set(w.x, w.h / 2, w.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            this.targets.push(mesh);
            this.colliders.push(this._boxCollider(w.x, w.h / 2, w.z, w.w, w.h, w.d));
        });

        // Platforms
        const platforms = [
            { x: 0,   y: 2.5, z: 0,   w: 8, h: 0.6, d: 8,  color: '#1e3a5f' },
            { x: -12, y: 4,   z: 5,   w: 6, h: 0.6, d: 6,  color: '#1e3a5f' },
            { x:  12, y: 3,   z: 5,   w: 6, h: 0.6, d: 6,  color: '#1e3a5f' },
            { x:  0,  y: 6,   z: -5,  w: 5, h: 0.6, d: 5,  color: '#1e3a5f' },
        ];

        platforms.forEach(p => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(p.w, p.h, p.d),
                new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.8 })
            );
            mesh.position.set(p.x, p.y, p.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            this.targets.push(mesh);
            this.colliders.push(this._boxCollider(p.x, p.y, p.z, p.w, p.h, p.d));
        });

        // Corner pillars
        const pillars = [
            [-15, 0, -15], [15, 0, -15], [-15, 0, 15], [15, 0, 15]
        ];
        pillars.forEach(([x,y,z]) => {
            const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.8, 0.8, 8, 12),
                new THREE.MeshStandardMaterial({ color: '#334155' })
            );
            mesh.position.set(x, 4, z);
            mesh.castShadow = true;
            scene.add(mesh);
            this.colliders.push(this._boxCollider(x, 4, z, 1.6, 8, 1.6));
        });

        // Decorative glow lights
        const glowColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xeab308];
        glowColors.forEach((c, i) => {
            const light = new THREE.PointLight(c, 0.8, 18);
            light.position.set(-18 + i * 12, 3, -15);
            scene.add(light);
        });
    }

    _boxCollider(cx, cy, cz, w, h, d) {
        return {
            minX: cx - w / 2, maxX: cx + w / 2,
            minY: cy - h / 2, maxY: cy + h / 2,
            minZ: cz - d / 2, maxZ: cz + d / 2,
        };
    }

    _addBoundary(scene, x, z, w, d) {
        // Invisible boundary — just a collider
        this.colliders.push(this._boxCollider(x, 5, z, w, 10, d));
    }
}