import * as THREE from 'three';

export function createStone() {
    const stoneGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888c8d, roughness: 0.85, flatShading: true });

    // Main central low-poly boulder base
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), stoneMat);
    rock.scale.set(1, 0.6, 0.9);
    rock.position.y = 0.3;
    rock.castShadow = true;
    rock.receiveShadow = true;
    stoneGroup.add(rock);

    // Secondary smaller cluster accent chunk to add an organic silhouette
    const secondaryChunk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), stoneMat);
    secondaryChunk.position.set(0.4, 0.15, 0.3);
    secondaryChunk.rotation.set(0.2, 0.5, -0.1); // Dynamic asymmetrical angle
    secondaryChunk.castShadow = true;
    secondaryChunk.receiveShadow = true;
    stoneGroup.add(secondaryChunk);

    // Exact original data configuration
    stoneGroup.userData = {
        isInteractable: true,
        type: 'Stone',
        health: 5,
        maxHealth: 5,
        dropName: 'Stone'
    };

    return stoneGroup;
}