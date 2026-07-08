import * as THREE from 'three';

const CONVEYOR_LENGTH = 2.4;
const CONVEYOR_SPEED = 1.4;

// Height at which items actually ride along the belt — a bit above the physical
// belt mesh's top surface. THIS constant is the fix for the broken movement:
// getEntryPoint/getExitPoint previously returned points at y=0 (the conveyor's
// ground-level placement origin) while items actually rode at y≈0.3+, so the
// "have I reached the exit" distance check could never pass — items sailed
// straight through the end of every belt forever, never popping off or chaining.
export const BELT_RIDE_HEIGHT = 0.42;

const _advDir = new THREE.Vector3();
const _advExit = new THREE.Vector3();
const _advEntry = new THREE.Vector3();

function createBeltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0b0c0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1c1e20';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, canvas.height);
        ctx.lineTo(x + canvas.height, 0);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(3, 1);
    return texture;
}

export function createConveyor() {
    const group = new THREE.Group();

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.55, metalness: 0.35 });
    const beltTexture = createBeltTexture();
    const beltMat = new THREE.MeshStandardMaterial({ map: beltTexture, color: 0x1a1c1e, roughness: 0.8, metalness: 0.1 });
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x0e0f10, roughness: 0.5, emissive: 0x2ecc71, emissiveIntensity: 0 });

    const railGeo = new THREE.BoxGeometry(CONVEYOR_LENGTH, 0.14, 0.05);
    const railL = new THREE.Mesh(railGeo, blackMat);
    railL.position.set(0, 0.4, 0.3);
    railL.castShadow = true;
    group.add(railL);
    const railR = railL.clone();
    railR.position.z = -0.3;
    group.add(railR);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(CONVEYOR_LENGTH, 0.05, 0.5), beltMat);
    belt.position.y = 0.32;
    belt.receiveShadow = true;
    group.add(belt);

    const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.46, 10);
    const rollerL = new THREE.Mesh(rollerGeo, blackMat);
    rollerL.rotation.z = Math.PI / 2;
    rollerL.position.set(-CONVEYOR_LENGTH / 2, 0.32, 0);
    rollerL.castShadow = true;
    group.add(rollerL);
    const rollerR = rollerL.clone();
    rollerR.position.x = CONVEYOR_LENGTH / 2;
    group.add(rollerR);

    const outputIndicator = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.26), indicatorMat);
    outputIndicator.position.set(CONVEYOR_LENGTH / 2 - 0.15, 0.5, 0);
    group.add(outputIndicator);

    const legGeo = new THREE.BoxGeometry(0.1, 0.32, 0.1);
    [[-CONVEYOR_LENGTH / 2 + 0.18, 0.16, 0.2], [-CONVEYOR_LENGTH / 2 + 0.18, 0.16, -0.2],
     [CONVEYOR_LENGTH / 2 - 0.18, 0.16, 0.2], [CONVEYOR_LENGTH / 2 - 0.18, 0.16, -0.2]].forEach(pos => {
        const leg = new THREE.Mesh(legGeo, blackMat);
        leg.position.set(...pos);
        leg.castShadow = true;
        group.add(leg);
    });

    const state = { rollerSpin: 0, outputConveyor: null };
    const _ptOffset = new THREE.Vector3();

    group.userData = {
        isInteractable: true,
        isStation: false,
        isConveyor: true,
        type: 'Conveyor',
        health: 5,
        maxHealth: 5,
        dropName: 'Conveyor',
        length: CONVEYOR_LENGTH,
        speed: CONVEYOR_SPEED,

        // FIX: now returns the point at BELT_RIDE_HEIGHT (where items actually
        // travel), not the conveyor's ground-level placement origin.
        getEntryPoint(target) {
            _ptOffset.set(-CONVEYOR_LENGTH / 2, BELT_RIDE_HEIGHT, 0).applyQuaternion(group.quaternion);
            target.copy(group.position).add(_ptOffset);
        },
        getExitPoint(target) {
            _ptOffset.set(CONVEYOR_LENGTH / 2, BELT_RIDE_HEIGHT, 0).applyQuaternion(group.quaternion);
            target.copy(group.position).add(_ptOffset);
        },
        setOutputConveyor(c) { state.outputConveyor = c; },
        getOutputConveyor() { return state.outputConveyor; },

        tick(time) {
            state.rollerSpin += 0.15;
            rollerL.rotation.x = state.rollerSpin;
            rollerR.rotation.x = state.rollerSpin;
            beltTexture.offset.x = (time * 0.0004 * CONVEYOR_SPEED) % 1;
            indicatorMat.emissiveIntensity = state.outputConveyor ? (0.4 + Math.sin(time * 0.002) * 0.2) : 0;
        }
    };

    return group;
}

// FIXED: entry/exit points are now at the height items actually ride at, so the
// "reached the exit" check reliably fires, chaining hands off at consistent ride
// height (no more snapping to ground on transfer), and items tossed off an
// unlinked end now fly in the belt's actual facing direction, not a fixed +Z.
export function advanceOnConveyor(drop, deltaTime) {
    const conveyor = drop.userData.onConveyor;
    if (!conveyor) return false;

    _advDir.set(1, 0, 0).applyQuaternion(conveyor.quaternion);
    drop.position.addScaledVector(_advDir, conveyor.userData.speed * deltaTime);

    conveyor.userData.getExitPoint(_advExit);
    if (drop.position.distanceTo(_advExit) < 0.15) {
        const next = conveyor.userData.getOutputConveyor ? conveyor.userData.getOutputConveyor() : null;
        if (next && next.userData.isConveyor) {
            next.userData.getEntryPoint(_advEntry);
            drop.position.copy(_advEntry);
            drop.userData.onConveyor = next;
        } else {
            drop.userData.onConveyor = null;
            drop.userData.velocity = new THREE.Vector3(_advDir.x * 1.2, 1.1, _advDir.z * 1.2);
        }
    }
    return true;
}