import * as THREE from 'three';

export function createFurnace() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.85, flatShading: true });
    const stoneMatB = new THREE.MeshStandardMaterial({ color: 0x64645f, roughness: 0.9, flatShading: true });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x424242, roughness: 0.9, flatShading: true });
    const emberMat = new THREE.MeshStandardMaterial({ color: 0xff6b1a, emissive: 0xff6b1a, emissiveIntensity: 1.1, roughness: 0.5 });
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 1.0 });
    const sootMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.95 });
    const grateMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.5, metalness: 0.7 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), stoneMat);
    base.position.y = 0.45;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    for (let i = 0; i < 6; i++) {
        const speck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.05), i % 2 === 0 ? stoneMatB : darkStoneMat);
        const side = i % 4;
        const angle = (side / 4) * Math.PI * 2;
        speck.position.set(Math.sin(angle) * 0.66, 0.25 + (i * 0.09), Math.cos(angle) * 0.66);
        speck.rotation.y = angle;
        group.add(speck);
    }

    const mid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), darkStoneMat);
    mid.position.y = 1.25;
    mid.castShadow = true;
    group.add(mid);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.85), stoneMat);
    top.position.y = 1.85;
    top.castShadow = true;
    group.add(top);

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.6, 6), darkStoneMat);
    chimney.position.y = 2.4;
    chimney.castShadow = true;
    group.add(chimney);

    const soot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), sootMat);
    soot.position.y = 2.13;
    group.add(soot);

    // Iron grate frame around the mouth (reads as a "furnace" opening, not just a hole)
    const grateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.06), grateMat);
    grateFrame.position.set(0, 0.5, 0.68);
    grateFrame.castShadow = true;
    group.add(grateFrame);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.15), ashMat);
    mouth.position.set(0, 0.5, 0.66);
    group.add(mouth);

    const embers = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.05), emberMat);
    embers.position.set(0, 0.5, 0.73);
    group.add(embers);

    // A couple of horizontal grate bars over the embers for detail
    for (let i = 0; i < 3; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.05), grateMat);
        bar.position.set(0, 0.42 + i * 0.08, 0.74);
        group.add(bar);
    }

    const emberLight = new THREE.PointLight(0xff7a29, 1.2, 4, 2);
    emberLight.position.set(0, 0.55, 0.7);
    group.add(emberLight);

    group.userData = {
        isInteractable: true, type: 'Furnace',
        health: 8, maxHealth: 8, dropName: 'Furnace',
        isStation: true, isFurnace: true
    };

    return group;
}