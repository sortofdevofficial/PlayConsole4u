import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Door } from './door.js';

export class House {
    constructor(scene, centerX = 8.0, centerZ = -4.0) {
        this.scene = scene;
        this.x = centerX;
        this.z = centerZ;

        // 1. Core Structural Dimensions
        const wallHeight = 4.0;
        const houseWidth = 10.0;
        const houseDepth = 8.0;
        const wallThick = 0.5;

        // 2. Instantiate Interactive Physical Door
        this.door = new Door(scene, this.x, this.z);

        // 3. Premium Architectural Materials
        const sidingMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 }); // Clean white siding
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });   // Slate gray accents
        const foundationMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 }); // Stone foundation
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6, flatShading: true }); // Crimson tile
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0c4a6e, roughness: 0.1 }); // Reflective blue glass
        const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 }); // Clay brick

        // 4. Collision-Compliant Wall Builder
        const mkWall = (x, z, w, d) => {
            const wallGroup = new THREE.Group();
            
            // Main Siding Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(w, wallHeight - 0.4, d), sidingMat);
            body.position.set(0, (wallHeight - 0.4) / 2 + 0.4, 0);
            body.castShadow = true; body.receiveShadow = true;
            wallGroup.add(body);

            // Foundation Trim Base
            const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.4, d + 0.02), foundationMat);
            base.position.set(0, 0.2, 0);
            base.castShadow = true; base.receiveShadow = true;
            wallGroup.add(base);

            wallGroup.position.set(x, 0, z);
            scene.add(wallGroup);

            // Return original positioning structure so physics calculation array remains unaltered
            return { mesh: wallGroup, x, z, width: w, depth: d };
        };

        const frontZ = this.z, backZ = this.z - houseDepth;
        const midZ   = this.z - houseDepth / 2;
        const lx = this.x - houseWidth / 2, rx = this.x + houseWidth / 2;
        const dLx = this.x - 1.35, dRx = this.x + 1.35;

        // Populate walls array exactly as expected by your physics.js script
        this.walls = [
            mkWall((lx + dLx) / 2, frontZ, dLx - lx,   wallThick),  // front-left
            mkWall((dRx + rx) / 2, frontZ, rx - dRx,    wallThick),  // front-right
            mkWall(this.x,         backZ,  houseWidth,  wallThick),  // back
            mkWall(lx,             midZ,   wallThick,   houseDepth), // left
            mkWall(rx,             midZ,   wallThick,   houseDepth), // right
        ];

        // 5. DECORATIVE EXTRA GEOMETRIES (Non-collision visual enhancements)
        
        // Premium Authentic Gable Roof (Two angled intersecting roof boxes)
        const roofGroup = new THREE.Group();
        const roofThickness = 0.25;
        const roofSlopeLength = 6.2;
        const pitchAngle = 0.58; // Radians angle (~33 degrees)

        // Left Slope
        const leftSlope = new THREE.Mesh(new THREE.BoxGeometry(roofSlopeLength, roofThickness, houseDepth + 0.6), roofMat);
        leftSlope.position.set(-2.5, 1.5, 0);
        leftSlope.rotation.z = pitchAngle;
        leftSlope.castShadow = true; leftSlope.receiveShadow = true;
        roofGroup.add(leftSlope);

        // Right Slope
        const rightSlope = new THREE.Mesh(new THREE.BoxGeometry(roofSlopeLength, roofThickness, houseDepth + 0.6), roofMat);
        rightSlope.position.set(2.5, 1.5, 0);
        rightSlope.rotation.z = -pitchAngle;
        rightSlope.castShadow = true; rightSlope.receiveShadow = true;
        roofGroup.add(rightSlope);
        
        roofGroup.position.set(this.x, wallHeight, midZ);
        scene.add(roofGroup);

        // Triangular Attic Pediment Closures (Fills the open holes beneath the roof slopes)
        const gGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            -houseWidth/2, 0, 0,  houseWidth/2, 0, 0,  0, 2.7, 0
        ]);
        gGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        gGeo.computeVertexNormals();
        
        const frontGable = new THREE.Mesh(gGeo, sidingMat);
        frontGable.position.set(this.x, wallHeight, frontZ + wallThick/2);
        scene.add(frontGable);

        const backGable = new THREE.Mesh(gGeo, sidingMat);
        backGable.position.set(this.x, wallHeight, backZ - wallThick/2);
        backGable.rotation.y = Math.PI;
        scene.add(backGable);

        // Brick Chimney
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.5, 0.9), chimneyMat);
        chimney.position.set(this.x + 3.2, wallHeight + 2.0, midZ - 1.5);
        chimney.castShadow = true;
        scene.add(chimney);

        // 6. STYLIZED WINDOW ASSEMBLY MAKER
        const addWindow = (wx, wy, wz, rotY) => {
            const winGroup = new THREE.Group();
            
            // Glass Panes
            const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.1), glassMat);
            winGroup.add(glass);

            // Outer Architectural Trim Frame
            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.15), trimMat);
            frame.position.z = -0.04;
            winGroup.add(frame);

            // Left Shutter Accent
            const lShutter = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.08), trimMat);
            lShutter.position.set(-0.9, 0, 0);
            winGroup.add(lShutter);

            // Right Shutter Accent
            const rShutter = lShutter.clone();
            rShutter.position.x = 0.9;
            winGroup.add(rShutter);

            winGroup.position.set(wx, wy, wz);
            winGroup.rotation.y = rotY;
            scene.add(winGroup);
        };

        // Inject windows symmetrically into exterior layouts
        addWindow(this.x - 3.2, 2.0, frontZ + 0.28, 0);           // Front Yard Left
        addWindow(this.x + 3.2, 2.0, frontZ + 0.28, 0);           // Front Yard Right
        addWindow(lx - 0.28,    2.2, midZ,          Math.PI / 2); // West Wing profile
        addWindow(rx + 0.28,    2.2, midZ,          -Math.PI / 2); // East Wing profile
    }

    update(playerX = 0, playerZ = 0) {
        if (this.door) this.door.update(playerX, playerZ);
    }
}