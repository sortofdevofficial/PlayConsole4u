import * as THREE from 'three';
import { createStone } from './obj/Stone.js';
import { createTree } from './obj/oak.js';
import { createIronOre } from './obj/iron.js';
import { createQuartzOre } from './obj/quartz.js';
import { createSandNode } from './obj/sand.js';

// Global elevation function for terrain deformation and physics tracking
export function getElevation(x, z) {
    return (Math.sin(x * 0.05) * Math.cos(z * 0.05) * 4.0) + 
           (Math.sin(x * 0.15 + 2) * Math.sin(z * 0.15) * 1.5);
}

export function buildWorld(scene) {
    const platformWidth = 100;
    const platformLength = 100;

    // Create the high-density vertex grid for smooth hills
    const planeGeo = new THREE.PlaneGeometry(platformWidth, platformLength, 70, 70);
    const pos = planeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i); 
        const elevation = getElevation(vx, -vy);
        pos.setZ(i, elevation);
    }
    planeGeo.computeVertexNormals();

    const grassMat = new THREE.MeshStandardMaterial({ 
        color: 0x4f7743, 
        roughness: 0.9, 
        flatShading: true 
    });
    const grassPlatform = new THREE.Mesh(planeGeo, grassMat);
    grassPlatform.rotation.x = -Math.PI / 2;
    grassPlatform.receiveShadow = true;
    grassPlatform.matrixAutoUpdate = false;
    grassPlatform.updateMatrix();
    scene.add(grassPlatform);

    const interactablesGroup = new THREE.Group();
    scene.add(interactablesGroup);

    const markersGroup = new THREE.Group();
    scene.add(markersGroup);

    const dropsGroup = new THREE.Group();
    scene.add(dropsGroup);

    const activeSpawns = [];

    // Exact, hardcoded coordinates for all resource points across the map
    const exactResourceCoordinates = [
        // --- SAND NODES (Low Valleys) ---
        { type: 'sand', x: -42.0, z: -38.0 },
        { type: 'sand', x: -40.5, z: -35.0 },
        { type: 'sand', x: -38.0, z: -41.0 },
        { type: 'sand', x: -35.0, z: -32.5 },
        { type: 'sand', x: 41.0,  z: 39.0 },
        { type: 'sand', x: 38.5,  z: 43.0 },
        { type: 'sand', x: 44.0,  z: 36.5 },
        { type: 'sand', x: 12.0,  z: 45.0 }, // Exact coordinate example requested
        
        // --- TREES (Plains & Gentle Slopes) ---
        { type: 'tree', x: -15.0, z: -10.0 },
        { type: 'tree', x: -12.5, z: -5.0 },
        { type: 'tree', x: -8.0,  z: -12.0 },
        { type: 'tree', x: -2.0,  z: -18.0 },
        { type: 'tree', x: 5.0,   z: -22.0 },
        { type: 'tree', x: 14.0,  z: -15.0 },
        { type: 'tree', x: 22.0,  z: -8.0 },
        { type: 'tree', x: 1.0,   z: 0.0 },   // Exact coordinate example requested
        { type: 'tree', x: -5.0,  z: 15.0 },
        { type: 'tree', x: -18.0, z: 8.0 },
        { type: 'tree', x: 8.0,   z: 20.0 },
        { type: 'tree', x: 19.0,  z: 12.0 },
        { type: 'tree', x: 25.0,  z: 28.0 },
        { type: 'tree', x: -28.0, z: -25.0 },
        { type: 'tree', x: -32.0, z: -15.0 },
        { type: 'tree', x: 30.0,  z: -20.0 },

        // --- IRON ORE (Mid-level terrain) ---
        { type: 'iron', x: -20.0, z: -2.0 },
        { type: 'iron', x: -22.5, z: 3.0 },
        { type: 'iron', x: 10.0,  z: -5.0 },
        { type: 'iron', x: 13.5,  z: 2.0 },
        { type: 'iron', x: -5.0,  z: -30.0 },
        { type: 'iron', x: 6.0,   z: 32.0 },
        { type: 'iron', x: -12.0, z: 28.0 },

        // --- STONE NODES (Elevated Slopes & Low Ridges) ---
        { type: 'stone', x: -30.0, z: 25.0 },
        { type: 'stone', x: -26.5, z: 31.0 },
        { type: 'stone', x: -34.0, z: 18.0 },
        { type: 'stone', x: 32.0,  z: -32.0 },
        { type: 'stone', x: 28.5,  z: -28.0 },
        { type: 'stone', x: 35.0,  z: -25.0 },
        { type: 'stone', x: -5.0,  z: 42.0 },
        { type: 'stone', x: 5.0,   z: 42.0 },

        // --- QUARTZ ORE (High Mountain Peaks) ---
        { type: 'quartz', x: -35.0, z: 35.0 },
        { type: 'quartz', x: -38.0, z: 32.0 },
        { type: 'quartz', x: 40.0,  z: -40.0 },
        { type: 'quartz', x: 42.5,  z: -37.0 },
        { type: 'quartz', x: 0.0,   z: -45.0 }
    ];

    function createGroundMarker(type, x, y, z, spawnIndex) {
        let color = 0x444444;
        if (type === 'tree') color = 0x3d2817;
        else if (type === 'iron') color = 0x2b221e;
        else if (type === 'quartz') color = 0x5a5560;
        else if (type === 'sand') color = 0xc9a865;

        const markerGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.08, type === 'tree' ? 7 : 5);
        const markerMat = new THREE.MeshStandardMaterial({ color: color, roughness: 1, flatShading: true });
        const marker = new THREE.Mesh(markerGeo, markerMat);

        marker.position.set(x, y + 0.04, z);
        marker.rotation.y = Math.random() * Math.PI;
        marker.scale.set(1 + Math.random() * 0.2, 1, 1 + Math.random() * 0.2);
        marker.receiveShadow = true;
        marker.userData = { isMarker: true, resourceType: type, spawnIndex: spawnIndex };

        marker.matrixAutoUpdate = false;
        marker.updateMatrix();
        markersGroup.add(marker);
    }

    function spawnResource(type, x, y, z, createMarker = true, explicitIndex = null) {
        let instance;
        if (type === 'tree') instance = createTree();
        else if (type === 'stone') instance = createStone();
        else if (type === 'iron') instance = createIronOre();
        else if (type === 'quartz') instance = createQuartzOre();
        else if (type === 'sand') instance = createSandNode();

        if (!instance) return null;

        instance.position.set(x, y, z);
        instance.rotation.y = Math.random() * Math.PI;

        const spawnIndex = explicitIndex !== null ? explicitIndex : activeSpawns.length;
        instance.userData.spawnIndex = spawnIndex;
        instance.userData.basePos = new THREE.Vector3(x, y, z);

        if (explicitIndex === null) {
            activeSpawns.push({ type, x, y, z, isAlive: true, destroyedAt: 0, instanceRef: instance });
        } else {
            activeSpawns[spawnIndex].instanceRef = instance;
            activeSpawns[spawnIndex].isAlive = true;
        }

        if (createMarker) createGroundMarker(type, x, y, z, spawnIndex);

        interactablesGroup.add(instance);
        return instance;
    }

    // Initialize all hardcoded coordinate entities accurately aligned to the terrain height
    exactResourceCoordinates.forEach((coord) => {
        const computedY = getElevation(coord.x, coord.z);
        spawnResource(coord.type, coord.x, computedY, coord.z, true, null);
    });

    function tick(time, respawnDelayMs = 2500) {
        const now = Date.now();
        for (let i = 0; i < activeSpawns.length; i++) {
            const node = activeSpawns[i];
            if (node.isAlive && node.instanceRef && !interactablesGroup.children.includes(node.instanceRef)) {
                node.isAlive = false;
                node.destroyedAt = now;
            }
        }
        for (let i = 0; i < activeSpawns.length; i++) {
            const node = activeSpawns[i];
            if (!node.isAlive && (now - node.destroyedAt >= respawnDelayMs)) {
                spawnResource(node.type, node.x, node.y, node.z, false, i);
            }
        }
        interactablesGroup.children.forEach(child => {
            if (child.userData && child.userData.tick) child.userData.tick(time);
        });
    }

    return { grassPlatform, interactablesGroup, dropsGroup, markersGroup, platformWidth, platformLength, tick };
}