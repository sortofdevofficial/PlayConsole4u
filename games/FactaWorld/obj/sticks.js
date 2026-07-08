import * as THREE from 'three';

export function createStick() {
    const group = new THREE.Group();

    // Weathered gray-brown color, distinct from Oak's rich brown trunk
    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x9c8567,
        roughness: 0.95,
        metalness: 0.0,
        flatShading: true
    });
    const darkNodeMat = new THREE.MeshStandardMaterial({
        color: 0x6b5a44,
        roughness: 1.0,
        flatShading: true
    });

    // Main stick: thin, slightly bent (not a straight uniform cylinder like a trunk) —
    // built from two angled segments to read as a snapped branch, not a tiny log.
    const segA = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.34, 5), woodMat);
    segA.position.set(0, 0.17, 0);
    segA.rotation.z = 0.08;
    segA.castShadow = true;
    group.add(segA);

    const segB = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.3, 5), woodMat);
    segB.position.set(0.03, 0.42, 0.01);
    segB.rotation.z = -0.15;
    segB.castShadow = true;
    group.add(segB);

    // Bark node rings at irregular intervals — breaks up the smooth silhouette
    const nodePositions = [0.1, 0.28, 0.48];
    nodePositions.forEach((y, i) => {
        const node = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.025, 5), darkNodeMat);
        node.position.set(Math.sin(i) * 0.01, y, 0);
        node.castShadow = true;
        group.add(node);
    });

    // Small snapped-off twig stub jutting at an angle — the classic "gathered stick" silhouette
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.14, 4), woodMat);
    twig.position.set(0.06, 0.24, 0.02);
    twig.rotation.z = 1.1;
    twig.rotation.y = 0.4;
    twig.castShadow = true;
    group.add(twig);

    // A second thinner stick crossed slightly behind, so it reads as a bundle rather than one log
    const crossStick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.5, 5), darkNodeMat);
    crossStick.position.set(-0.05, 0.25, -0.03);
    crossStick.rotation.z = 0.25;
    crossStick.rotation.y = 0.3;
    crossStick.castShadow = true;
    group.add(crossStick);

    return group;
}