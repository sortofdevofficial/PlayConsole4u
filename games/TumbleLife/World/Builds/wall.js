import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Wall {
    constructor(scene, x, z, width = 5, height = 3.2, depth = 0.3) {
        this.x = x;
        this.z = z;
        this.width = width;
        this.depth = depth;

        const wallGroup = new THREE.Group();

        // Plaster structural core material
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf1f5f9, 
            roughness: 0.8 
        });

        // Dark modern trim framing cap accents
        const trimMaterial = new THREE.MeshStandardMaterial({
            color: 0x475569,
            roughness: 0.6
        });

        // Main Wall Block
        const wallGeo = new THREE.BoxGeometry(width, height - 0.2, depth);
        const mainMesh = new THREE.Mesh(wallGeo, wallMaterial);
        mainMesh.position.set(0, (height - 0.2) / 2 + 0.2, 0);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        wallGroup.add(mainMesh);

        // Concrete Baseboard Foundation Accent Trim
        const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.2, depth + 0.04), trimMaterial);
        baseTrim.position.set(0, 0.1, 0);
        baseTrim.castShadow = true;
        baseTrim.receiveShadow = true;
        wallGroup.add(baseTrim);

        wallGroup.position.set(x, 0, z);
        this.mesh = wallGroup;
        
        scene.add(this.mesh);
    }
}