import * as THREE from 'three';

export function createIronOre() {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7466, roughness: 0.9, flatShading: true });
    const veinMat = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.5, metalness: 0.3 });

    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), rockMat);
    rock.scale.set(1, 0.7, 0.9);
    rock.position.y = 0.28;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);

    for (let i = 0; i < 4; i++) {
        const fleck = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), veinMat);
        const angle = Math.random() * Math.PI * 2;
        fleck.position.set(Math.cos(angle) * 0.35, 0.28 + (Math.random() - 0.5) * 0.3, Math.sin(angle) * 0.35);
        fleck.castShadow = true;
        group.add(fleck);
    }

    group.userData = {
        isInteractable: true, type: 'Iron Ore',
        health: 8, maxHealth: 8,
        dropName: 'Iron Ore'
    };

    return group;
}

export function createIronIngot() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.35, metalness: 0.75 });
    const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.14), mat);
    ingot.castShadow = true;
    return ingot;
}

export function createIronOreItem() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x7d7466, roughness: 0.8 });
    return new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), mat);
}

// Flat, thin square plate with slightly beveled-looking edges (via a subtle second layer)
export function createIronPlate() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9c9c9, roughness: 0.3, metalness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xa8a8a8, roughness: 0.4, metalness: 0.8 });

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.32), mat);
    plate.castShadow = true;
    group.add(plate);

    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.34), rimMat);
    rim.position.y = -0.02;
    rim.castShadow = true;
    group.add(rim);

    // Rivets at the corners for a "worked metal" look
    const rivetGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6);
    const corners = [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]];
    corners.forEach(([x, z]) => {
        const rivet = new THREE.Mesh(rivetGeo, rimMat);
        rivet.position.set(x, 0.02, z);
        rivet.castShadow = true;
        group.add(rivet);
    });

    return group;
}

// Toothed gear: a central hub ring with small tooth nubs around the rim
export function createIronGear() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xb5b0a8, roughness: 0.35, metalness: 0.8 });

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), mat);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    group.add(ring);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 8), mat);
    hub.rotation.x = Math.PI / 2;
    hub.castShadow = true;
    group.add(hub);

    // Teeth
    const toothCount = 8;
    for (let i = 0; i < toothCount; i++) {
        const angle = (i / toothCount) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), mat);
        tooth.position.set(Math.cos(angle) * 0.19, 0, Math.sin(angle) * 0.19);
        tooth.rotation.y = angle;
        tooth.castShadow = true;
        group.add(tooth);
    }

    return group;
}