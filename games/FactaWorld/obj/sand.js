import * as THREE from 'three';

export function createSandNode() {
    const group = new THREE.Group();
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xe3c98f, roughness: 0.95, flatShading: true });

    // A low, wide mound rather than a chunky rock — sand is a surface deposit,
    // not a boulder, so the silhouette should read differently from Stone.
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), sandMat);
    mound.scale.set(1.3, 0.35, 1.3);
    mound.position.y = 0.1;
    mound.castShadow = true;
    mound.receiveShadow = true;
    group.add(mound);

    // A couple of smaller secondary mounds for a natural, uneven pile look
    const mound2 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), sandMat);
    mound2.scale.set(1.1, 0.3, 1.1);
    mound2.position.set(0.28, 0.08, 0.15);
    mound2.castShadow = true;
    group.add(mound2);

    const mound3 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), sandMat);
    mound3.scale.set(1.0, 0.28, 1.0);
    mound3.position.set(-0.22, 0.07, -0.2);
    mound3.castShadow = true;
    group.add(mound3);

    group.userData = {
        isInteractable: true, type: 'Sand',
        health: 4, maxHealth: 4,
        dropName: 'Sand'
    };

    return group;
}

export function createSandItem() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xe3c98f, roughness: 0.9, flatShading: true });
    return new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat);
}

export function createGlassItem() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfe6f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 });
    return new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.03), mat);
}