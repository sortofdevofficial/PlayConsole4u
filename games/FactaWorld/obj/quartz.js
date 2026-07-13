import * as THREE from 'three';

export function createQuartzOre() {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8f8a85, roughness: 0.7, flatShading: true });
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xe8e4f0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });

    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), rockMat);
    base.scale.set(1, 0.6, 0.9);
    base.position.y = 0.22;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Jutting translucent crystal spikes — the visual signature that reads as
    // "quartz" versus the duller Stone/Iron Ore silhouettes.
    for (let i = 0; i < 5; i++) {
        const height = 0.25 + Math.random() * 0.2;
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.07, height, 5), crystalMat);
        const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 0.15 + Math.random() * 0.1;
        crystal.position.set(Math.cos(angle) * dist, 0.3 + height / 2, Math.sin(angle) * dist);
        crystal.rotation.z = (Math.random() - 0.5) * 0.5;
        crystal.rotation.x = (Math.random() - 0.5) * 0.5;
        crystal.castShadow = true;
        group.add(crystal);
    }

    group.userData = {
        isInteractable: true, type: 'Quartz',
        health: 6, maxHealth: 6,
        dropName: 'Quartz'
    };

    return group;
}

export function createQuartzItem() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8e4f0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
    return new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mat);
}

export function createSiliconItem() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.25, metalness: 0.6 });
    return new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8), mat);
}