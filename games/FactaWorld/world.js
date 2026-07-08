import * as THREE from 'three';
import { createStone } from './obj/Stone.js';
import { createTree } from './obj/oak.js';
import { createIronOre } from './obj/iron.js';

export function buildWorld(scene) {
    const platformWidth = 60, platformLength = 60, platformY = 0;

    const planeGeo = new THREE.PlaneGeometry(platformWidth, platformLength, 30, 30);
    const pos = planeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const distFromCenter = Math.sqrt(Math.pow(pos.getX(i), 2) + Math.pow(pos.getY(i), 2));
        if (distFromCenter > 10) pos.setZ(i, (Math.random() - 0.5) * 0.5);
    }
    planeGeo.computeVertexNormals();

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7743, roughness: 0.9, flatShading: true });
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

    const mapConfig = {
        forestZone: { minX: -24, maxX: -5, minZ: -24, maxZ: -5, count: 18 },
        stoneQuarry: { minX: 5, maxX: 24, minZ: -24, maxZ: -5, count: 12 },
        ironDeposit: { minX: -15, maxX: 15, minZ: 12, maxZ: 24, count: 6 }
    };

    const activeSpawns = [];

    // Tag markers with spawnIndex so Auto Miner knows exactly what to lock onto
    function createGroundMarker(type, x, z, spawnIndex) {
        let color = 0x444444;
        if (type === 'tree') color = 0x3d2817;
        else if (type === 'iron') color = 0x2b221e;

        const markerGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.08, type === 'tree' ? 7 : 5);
        const markerMat = new THREE.MeshStandardMaterial({ color: color, roughness: 1, flatShading: true });
        const marker = new THREE.Mesh(markerGeo, markerMat);

        marker.position.set(x, 0.04, z);
        marker.rotation.y = Math.random() * Math.PI;
        marker.scale.set(1 + Math.random() * 0.4, 1, 1 + Math.random() * 0.4);
        marker.receiveShadow = true;

        marker.userData = { isMarker: true, resourceType: type, spawnIndex: spawnIndex };

        marker.matrixAutoUpdate = false;
        marker.updateMatrix();
        markersGroup.add(marker);
    }

    // Accepts explicitIndex to prevent array duplication on respawn!
    function spawnResource(type, x, y, z, createMarker = true, explicitIndex = null) {
        let instance;
        if (type === 'tree') instance = createTree();
        else if (type === 'stone') instance = createStone();
        else if (type === 'iron') instance = createIronOre();

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

        if (createMarker) createGroundMarker(type, x, z, spawnIndex);

        interactablesGroup.add(instance);
        return instance;
    }

    // Initial Spawns
    for (let i = 0; i < mapConfig.forestZone.count; i++) {
        spawnResource('tree', THREE.MathUtils.lerp(mapConfig.forestZone.minX, mapConfig.forestZone.maxX, Math.random()), 0.1, THREE.MathUtils.lerp(mapConfig.forestZone.minZ, mapConfig.forestZone.maxZ, Math.random()));
    }
    for (let i = 0; i < mapConfig.stoneQuarry.count; i++) {
        spawnResource('stone', THREE.MathUtils.lerp(mapConfig.stoneQuarry.minX, mapConfig.stoneQuarry.maxX, Math.random()), 0.1, THREE.MathUtils.lerp(mapConfig.stoneQuarry.minZ, mapConfig.stoneQuarry.maxZ, Math.random()));
    }
    for (let i = 0; i < mapConfig.ironDeposit.count; i++) {
        spawnResource('iron', THREE.MathUtils.lerp(mapConfig.ironDeposit.minX, mapConfig.ironDeposit.maxX, Math.random()), 0.1, THREE.MathUtils.lerp(mapConfig.ironDeposit.minZ, mapConfig.ironDeposit.maxZ, Math.random()));
    }

    function tick(time, respawnDelayMs = 6000) {
        const now = Date.now();

        // Check if nodes were destroyed by player or miner
        for (let i = 0; i < activeSpawns.length; i++) {
            const node = activeSpawns[i];
            if (node.isAlive && node.instanceRef && !interactablesGroup.children.includes(node.instanceRef)) {
                node.isAlive = false;
                node.destroyedAt = now;
            }
        }

        // Handle Respawns using explicit indices
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