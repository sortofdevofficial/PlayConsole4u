import * as THREE from 'three';

export function buildCharacter() {
    const group = new THREE.Group();
    const parts = {};

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe3ad78, roughness: 0.6, metalness: 0.0 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2f6d5e, roughness: 0.5, metalness: 0.05 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x26584c, roughness: 0.5, metalness: 0.05 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x28323f, roughness: 0.7, metalness: 0.0 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.6, metalness: 0.1 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.8, metalness: 0.0 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3f2b1c, roughness: 0.8, metalness: 0.0 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.6, metalness: 0.0 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xd4a24c, roughness: 0.35, metalness: 0.4 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c1a1a, roughness: 0.3, metalness: 0.0 });

    function box(w, h, d, seg) {
        if (seg === undefined) seg = 2;
        return new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    }

    function makeSegment(w, h, d, mat, pivotAtTop) {
        if (pivotAtTop === undefined) pivotAtTop = true;
        const geo = box(w, h, d, 2);
        geo.translate(0, pivotAtTop ? -h / 2 : h / 2, 0);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        const pivot = new THREE.Group();
        pivot.add(mesh);
        return { pivot: pivot, mesh: mesh };
    }

    const hips = new THREE.Group();
    hips.position.y = 0.95;
    group.add(hips);
    parts.hips = hips;

    const pelvis = new THREE.Mesh(box(0.6, 0.26, 0.36), pantsMat);
    pelvis.castShadow = true;
    hips.add(pelvis);

    const spineSeg = makeSegment(0.56, 0.62, 0.34, shirtMat, false);
    spineSeg.pivot.position.y = 0.16;
    hips.add(spineSeg.pivot);
    parts.spine = spineSeg.pivot;

    const belt = new THREE.Mesh(box(0.66, 0.08, 0.4), beltMat);
    belt.position.y = 0.15;
    hips.add(belt);
    const buckle = new THREE.Mesh(box(0.1, 0.08, 0.03), accentMat);
    buckle.position.set(0, 0.15, 0.2);
    hips.add(buckle);

    const neckSeg = makeSegment(0.18, 0.14, 0.18, skinMat, false);
    neckSeg.pivot.position.y = 0.62;
    spineSeg.mesh.add(neckSeg.pivot);
    parts.neck = neckSeg.pivot;

    const head = new THREE.Mesh(box(0.48, 0.48, 0.48, 2), skinMat);
    head.position.y = 0.14 + 0.24;
    head.castShadow = true;
    neckSeg.mesh.add(head);
    parts.head = head;

    const hair = new THREE.Mesh(box(0.52, 0.2, 0.52), hairMat);
    hair.position.y = 0.2;
    head.add(hair);

    const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.03);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.11, 0.02, 0.245);
    head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.11, 0.02, 0.245);
    head.add(eyeR);

    const headband = new THREE.Mesh(box(0.5, 0.06, 0.5), accentMat);
    headband.position.y = 0.1;
    head.add(headband);

    const armsRoot = new THREE.Group();
    armsRoot.position.y = 0.95 + 0.16;
    group.add(armsRoot);
    parts.armsRoot = armsRoot;

    function buildArm(side) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.34, 0.5, 0);
        armsRoot.add(shoulder);

        const shoulderCap = new THREE.Mesh(box(0.2, 0.16, 0.2), sleeveMat);
        shoulderCap.castShadow = true;
        shoulder.add(shoulderCap);

        const upperArmSeg = makeSegment(0.18, 0.36, 0.18, sleeveMat, true);
        upperArmSeg.pivot.position.y = -0.05;
        shoulder.add(upperArmSeg.pivot);

        const lowerArmSeg = makeSegment(0.15, 0.34, 0.15, skinMat, true);
        lowerArmSeg.pivot.position.y = -0.36;
        upperArmSeg.mesh.add(lowerArmSeg.pivot);

        const hand = new THREE.Mesh(box(0.15, 0.16, 0.15), skinMat);
        hand.position.y = -0.34 - 0.08;
        hand.castShadow = true;
        lowerArmSeg.mesh.add(hand);

        return {
            shoulder: shoulder,
            upperArm: upperArmSeg.pivot,
            lowerArm: lowerArmSeg.pivot,
            hand: hand,
            shoulderCap: shoulderCap,
            upperArmMesh: upperArmSeg.mesh,
            lowerArmMesh: lowerArmSeg.mesh
        };
    }
    parts.leftArm = buildArm(-1);
    parts.rightArm = buildArm(1);

    function buildLeg(side) {
        const hipJoint = new THREE.Group();
        hipJoint.position.set(side * 0.18, -0.14, 0);
        hips.add(hipJoint);

        const upperLegSeg = makeSegment(0.22, 0.42, 0.22, pantsMat, true);
        hipJoint.add(upperLegSeg.pivot);

        const lowerLegSeg = makeSegment(0.19, 0.4, 0.19, pantsMat, true);
        lowerLegSeg.pivot.position.y = -0.42;
        upperLegSeg.mesh.add(lowerLegSeg.pivot);

        const foot = new THREE.Group();
        foot.position.y = -0.4 - 0.02;
        lowerLegSeg.mesh.add(foot);

        const shoeBody = new THREE.Mesh(box(0.22, 0.14, 0.32), shoeMat);
        shoeBody.position.set(0, -0.02, 0.06);
        shoeBody.castShadow = true;
        foot.add(shoeBody);

        const sole = new THREE.Mesh(box(0.23, 0.04, 0.34), soleMat);
        sole.position.set(0, -0.09, 0.06);
        sole.castShadow = true;
        foot.add(sole);

        return { hipJoint: hipJoint, upperLeg: upperLegSeg.pivot, lowerLeg: lowerLegSeg.pivot, foot: foot };
    }
    parts.leftLeg = buildLeg(-1);
    parts.rightLeg = buildLeg(1);

    group.traverse(function(child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = false;
        }
    });

    return { group: group, parts: parts };
}