import * as THREE from 'three';

export function createAxe() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
    const wrapMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f9294, roughness: 0.6, flatShading: true });
    const stoneEdgeMat = new THREE.MeshStandardMaterial({ color: 0xc4c8ca, roughness: 0.35, flatShading: true });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.8, 6), woodMat);
    handle.position.y = 0.3;
    handle.castShadow = true;
    group.add(handle);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), wrapMat);
    grip.position.y = 0.05;
    grip.castShadow = true;
    group.add(grip);

    // Wedge-shaped blade instead of a flat box — reads as a real axe head
    const bladeBack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.08), stoneMat);
    bladeBack.position.set(0.08, 0.62, 0);
    bladeBack.castShadow = true;
    group.add(bladeBack);

    const bladeEdge = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 4), stoneEdgeMat);
    bladeEdge.rotation.z = -Math.PI / 2;
    bladeEdge.position.set(0.24, 0.62, 0);
    bladeEdge.castShadow = true;
    group.add(bladeEdge);

    const binding = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 6), wrapMat);
    binding.position.y = 0.6;
    group.add(binding);

    return group;
}