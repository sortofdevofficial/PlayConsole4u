import * as THREE from 'three';

export function createTree() {
    const treeGroup = new THREE.Group();

    // Enhanced graphic materials
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.9, flatShading: true });
    const flareMat = new THREE.MeshStandardMaterial({ color: 0x3d261a, roughness: 1.0, flatShading: true });
    const leafMatA = new THREE.MeshStandardMaterial({ color: 0x3a5a40, roughness: 0.8, flatShading: true });
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0x4a6d4f, roughness: 0.8, flatShading: true });

    const trunkHeight = 4 + Math.random() * 1.5;

    // Root flare
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.4, 6), flareMat);
    flare.position.y = 0.2;
    flare.castShadow = true;
    treeGroup.add(flare);

    // Main Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, trunkHeight, 6), trunkMat);
    trunk.position.y = trunkHeight / 2 + 0.15;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Leaves
    const leafLayers = 3 + Math.floor(Math.random() * 2);
    const leavesArray = []; // Store them to animate later

    for (let j = 0; j < leafLayers; j++) {
        const radius = 1.4 - (j * 0.22);
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), j % 2 === 0 ? leafMatA : leafMatB);
        leaves.position.set(
            (Math.random() - 0.5) * 0.2,
            trunkHeight - 0.2 + (j * 0.95),
            (Math.random() - 0.5) * 0.2
        );
        leaves.scale.set(1.1 + Math.random() * 0.15, 0.85 + Math.random() * 0.2, 1.1 + Math.random() * 0.15);
        leaves.rotation.y = Math.random() * Math.PI;
        leaves.castShadow = true;
        
        leavesArray.push({ mesh: leaves, speed: 0.001 + Math.random() * 0.001, offset: Math.random() * Math.PI });
        treeGroup.add(leaves);
    }

    treeGroup.userData = {
        isInteractable: true,
        type: 'Oak',
        health: 3, maxHealth: 3, dropName: 'Oak',
        // WIND ANIMATION LOGIC
        tick: (time) => {
            leavesArray.forEach(leaf => {
                leaf.mesh.rotation.x = Math.sin(time * leaf.speed + leaf.offset) * 0.05;
                leaf.mesh.rotation.z = Math.cos(time * leaf.speed + leaf.offset) * 0.05;
            });
        }
    };

    return treeGroup;
}