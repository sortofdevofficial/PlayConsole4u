import * as THREE from 'three';

const GENERATION_RATE = 20; // energy/second

export function createSolarPanel() {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8f9294, roughness: 0.4, metalness: 0.7 });
    const cellMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.2, metalness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe6f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 });
    const gearMat = new THREE.MeshStandardMaterial({ color: 0xb5b0a8, roughness: 0.35, metalness: 0.8 });
    const powerLightMat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffe066, emissiveIntensity: 1.0, roughness: 0.4 });

    const legMat = frameMat;
    const legGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6);
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.y = 0.25;
    leg.castShadow = true;
    group.add(leg);

    const pivot = new THREE.Group();
    pivot.position.y = 0.5;
    pivot.rotation.x = -0.5;
    group.add(pivot);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.7), frameMat);
    frame.castShadow = true;
    pivot.add(frame);

    const cellCols = 3, cellRows = 2;
    for (let c = 0; c < cellCols; c++) {
        for (let r = 0; r < cellRows; r++) {
            const cell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.3), cellMat);
            cell.position.set(-0.35 + c * 0.35, 0.035, -0.16 + r * 0.32);
            pivot.add(cell);
        }
    }

    const glassPane = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.015, 0.68), glassMat);
    glassPane.position.y = 0.045;
    pivot.add(glassPane);

    // Iron Gear power connector — this is now also the visible power PORT
    // location, at the base of the panel, facing outward horizontally.
    const connector = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), gearMat);
    connector.position.set(0.15, 0.02, 0);
    group.add(connector);
    for (let i = 0; i < 6; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.025), gearMat);
        const angle = (i / 6) * Math.PI * 2;
        tooth.position.set(0.15 + Math.cos(angle) * 0.09, 0.02, Math.sin(angle) * 0.09);
        group.add(tooth);
    }
    const powerLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), powerLightMat);
    powerLight.position.set(0.24, 0.02, 0);
    group.add(powerLight);

    const _portDir = new THREE.Vector3();

    group.userData = {
        isInteractable: true, type: 'Solar Panel',
        health: 6, maxHealth: 6, dropName: 'Solar Panel',
        isStation: false,
        isSolarPanel: true,

        getGenerationRate() { return GENERATION_RATE; },

        // World-space power port: position at the connector, facing local +X.
        getPowerPort(outP, outD) {
            powerLight.getWorldPosition(outP);
            _portDir.set(1, 0, 0).applyQuaternion(group.quaternion);
            outD.copy(_portDir);
        },

        tick(time) {
            powerLightMat.emissiveIntensity = 0.7 + Math.sin(time * 0.003) * 0.3;
        }
    };

    return group;
}