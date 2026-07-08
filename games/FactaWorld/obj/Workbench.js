import * as THREE from 'three';

export function createWorkbench() {
    const benchGroup = new THREE.Group();
    
    // Premium contrasting low-poly wood materials
    const lightWoodMat = new THREE.MeshStandardMaterial({ color: 0x8a6e59, roughness: 0.8, flatShading: true });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.85, flatShading: true });
    const accentWoodMat = new THREE.MeshStandardMaterial({ color: 0x513e32, roughness: 0.9, flatShading: true }); // Deep shadow tone

    // 1. Table Top Planks (Alternating timber colors)
    const plankCount = 5;
    const plankWidth = 2.2 / plankCount;
    for (let i = 0; i < plankCount; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(plankWidth - 0.02, 0.12, 1.4), i % 2 === 0 ? lightWoodMat : darkWoodMat);
        plank.position.set(-1.1 + plankWidth * i + plankWidth / 2, 1.1, 0);
        plank.castShadow = true;
        plank.receiveShadow = true;
        benchGroup.add(plank);
    }

    // 2. High-Level Backboard (Stops items falling behind, elevates the model height)
    const backboard = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.35, 0.06), darkWoodMat);
    backboard.position.set(0, 1.3, -0.67);
    backboard.castShadow = true;
    benchGroup.add(backboard);

    const backboardCap = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.04, 0.1), accentWoodMat);
    backboardCap.position.set(0, 1.48, -0.67);
    benchGroup.add(backboardCap);

    // 3. Structural Edge Guards (Front and Sides)
    const edgeFront = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.08, 0.06), darkWoodMat);
    edgeFront.position.set(0, 1.18, 0.7);
    edgeFront.castShadow = true;
    benchGroup.add(edgeFront);

    // 4. Heavy Duty Support Legs
    const legGeo = new THREE.BoxGeometry(0.18, 1.0, 0.18);
    const legPositions = [[-0.95, 0.5, -0.55], [0.95, 0.5, -0.55], [-0.95, 0.5, 0.55], [0.95, 0.5, 0.55]];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, accentWoodMat);
        leg.position.set(...pos);
        leg.castShadow = true;
        benchGroup.add(leg);
    });

    // 5. Lower Framework Braces
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

    // 6. Bottom Storage Slats (A dynamic slatted lower shelf)
    const slatCount = 6;
    const slatWidth = 1.7 / slatCount;
    for (let i = 0; i < slatCount; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(slatWidth - 0.04, 0.04, 1.0), lightWoodMat);
        slat.position.set(-0.8 + (slatWidth * i) + slatWidth / 2, 0.22, 0);
        slat.castShadow = true;
        slat.receiveShadow = true;
        benchGroup.add(slat);
    }

    // 7. Advanced Asymmetric Dual Drawers
    // Left Unit (Wide drawer)
    const leftDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 1.1), darkWoodMat);
    leftDrawer.position.set(-0.35, 0.85, 0);
    leftDrawer.castShadow = true;
    benchGroup.add(leftDrawer);

    const leftHandle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.06), lightWoodMat);
    leftHandle.position.set(-0.35, 0.85, 0.56);
    benchGroup.add(leftHandle);

    // Right Unit (Narrow deep drawer box)
    const rightDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 1.1), accentWoodMat);
    rightDrawer.position.set(0.3, 0.85, 0);
    rightDrawer.castShadow = true;
    benchGroup.add(rightDrawer);

    const rightHandle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.06), lightWoodMat);
    rightHandle.position.set(0.3, 0.85, 0.56);
    benchGroup.add(rightHandle);

    // Metadata for game architecture
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