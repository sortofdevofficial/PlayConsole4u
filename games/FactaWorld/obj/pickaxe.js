import * as THREE from 'three';

export function createPickaxe() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
    const wrapMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f9294, roughness: 0.6, flatShading: true });
    const stoneEdgeMat = new THREE.MeshStandardMaterial({ color: 0xb8bcbe, roughness: 0.4, flatShading: true });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.8, 6), woodMat);
    handle.position.y = 0.3;
    handle.castShadow = true;
    group.add(handle);

    // Leather-style grip wrap near the base
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), wrapMat);
    grip.position.y = 0.05;
    grip.castShadow = true;
    group.add(grip);

    // Angled pickaxe head — two tapered prisms meeting at a point, not a flat bar
    const headL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), stoneMat);
    headL.rotation.z = Math.PI / 2;
    headL.position.set(-0.21, 0.68, 0);
    headL.castShadow = true;
    group.add(headL);

    const headR = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), stoneEdgeMat);
    headR.rotation.z = -Math.PI / 2;
    headR.position.set(0.21, 0.68, 0);
    headR.castShadow = true;
    group.add(headR);

    // Binding where head meets handle
    const binding = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 6), wrapMat);
    binding.position.y = 0.66;
    group.add(binding);

    return group;
}