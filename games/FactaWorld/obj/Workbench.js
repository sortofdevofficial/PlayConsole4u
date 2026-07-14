import * as THREE from 'three';

export function createWorkbench() {
    const benchGroup = new THREE.Group();

    const lightWoodMat = new THREE.MeshStandardMaterial({ color: 0x8a6e59, roughness: 0.75, flatShading: true });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.82, flatShading: true });
    const accentWoodMat = new THREE.MeshStandardMaterial({ color: 0x513e32, roughness: 0.88, flatShading: true });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.4, metalness: 0.75 });

    const plankCount = 5;
    const plankWidth = 2.2 / plankCount;
    for (let i = 0; i < plankCount; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(plankWidth - 0.02, 0.12, 1.4), i % 2 === 0 ? lightWoodMat : darkWoodMat);
        plank.position.set(-1.1 + plankWidth * i + plankWidth / 2, 1.1, 0);
        plank.castShadow = true;
        plank.receiveShadow = true;
        benchGroup.add(plank);

        // Metal corner brackets on the outer planks -- a small detail that
        // sells "worked, load-bearing surface" rather than plain painted wood.
        if (i === 0 || i === plankCount - 1) {
            const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.2), metalMat);
            bracket.position.set(plank.position.x + (i === 0 ? -0.02 : 0.02), 1.17, 0.55);
            benchGroup.add(bracket);
        }
    }

    const backboard = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.35, 0.06), darkWoodMat);
    backboard.position.set(0, 1.3, -0.67);
    backboard.castShadow = true;
    benchGroup.add(backboard);

    const backboardCap = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.04, 0.1), accentWoodMat);
    backboardCap.position.set(0, 1.48, -0.67);
    benchGroup.add(backboardCap);

    // Tool pegs hanging off the backboard -- reads as a working station, not
    // just a table shape.
    const pegMat = darkWoodMat;
    [[-0.75, 1.28], [-0.35, 1.28], [0.35, 1.28], [0.75, 1.28]].forEach(([x, y]) => {
        const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 5), pegMat);
        peg.rotation.z = Math.PI / 2;
        peg.position.set(x, y, -0.6);
        peg.castShadow = true;
        benchGroup.add(peg);
    });

    const edgeFront = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.08, 0.06), darkWoodMat);
    edgeFront.position.set(0, 1.18, 0.7);
    edgeFront.castShadow = true;
    benchGroup.add(edgeFront);

    const legGeo = new THREE.BoxGeometry(0.18, 1.0, 0.18);
    const legPositions = [[-0.95, 0.5, -0.55], [0.95, 0.5, -0.55], [-0.95, 0.5, 0.55], [0.95, 0.5, 0.55]];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, accentWoodMat);
        leg.position.set(...pos);
        leg.castShadow = true;
        benchGroup.add(leg);

        // Worn metal foot cap at the base of each leg
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), metalMat);
        foot.position.set(pos[0], 0.015, pos[2]);
        benchGroup.add(foot);
    });

    const sideBraceGeo = new THREE.BoxGeometry(0.08, 0.08, 1.1);
    const leftBrace = new THREE.Mesh(sideBraceGeo, darkWoodMat);
    leftBrace.position.set(-0.95, 0.2, 0);
    benchGroup.add(leftBrace);

    const rightBrace = leftBrace.clone();
    rightBrace.position.x = 0.95;
    benchGroup.add(rightBrace);

    const mainBraceGeo = new THREE.BoxGeometry(1.9, 0.08, 0.08);
    const backBrace = new THREE.Mesh(mainBraceGeo, darkWoodMat);
    backBrace.position.set(0, 0.2, -0.55);
    benchGroup.add(backBrace);

    const slatCount = 6;
    const slatWidth = 1.7 / slatCount;
    for (let i = 0; i < slatCount; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(slatWidth - 0.04, 0.04, 1.0), lightWoodMat);
        slat.position.set(-0.8 + (slatWidth * i) + slatWidth / 2, 0.22, 0);
        slat.castShadow = true;
        slat.receiveShadow = true;
        benchGroup.add(slat);
    }

    const leftDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 1.1), darkWoodMat);
    leftDrawer.position.set(-0.35, 0.85, 0);
    leftDrawer.castShadow = true;
    benchGroup.add(leftDrawer);

    const leftHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), metalMat);
    leftHandle.rotation.z = Math.PI / 2;
    leftHandle.position.set(-0.35, 0.85, 0.56);
    benchGroup.add(leftHandle);

    const rightDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 1.1), accentWoodMat);
    rightDrawer.position.set(0.3, 0.85, 0);
    rightDrawer.castShadow = true;
    benchGroup.add(rightDrawer);

    const rightHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), metalMat);
    rightHandle.rotation.z = Math.PI / 2;
    rightHandle.position.set(0.3, 0.85, 0.56);
    benchGroup.add(rightHandle);

    benchGroup.userData = {
        isInteractable: true,
        type: 'Workbench',
        health: 6,
        maxHealth: 6,
        dropName: 'Workbench',
        isStation: true
    };

    return benchGroup;
}