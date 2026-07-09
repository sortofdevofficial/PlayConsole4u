import * as THREE from 'three';

// Height at which items actually ride along the belt. THIS constant existing as
// a single source of truth, used by BOTH the path math below AND the Auto
// Miner's drop-hole placement, is what fixes the teleport bug: previously
// entry/exit points were computed at ground level while items rode higher up,
// so the "reached the exit" check could never fire correctly.
export const BELT_RIDE_HEIGHT = 0.42;

const CONVEYOR_LENGTH = 2.4;   // straight belt length
const CURVE_RADIUS = 1.6;      // curve arc radius
const CURVE_SEGMENTS = 6;      // sample/tile count for curves (math AND visuals)
const CONVEYOR_SPEED = 1.4;    // shared travel speed, all variants

const _advDir = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const ITEM_ROLL_RADIUS = 0.18;

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

// Builds the local-space travel path for a variant: sample points from entry
// (index 0) to exit (last index), each with a unit tangent direction, plus the
// cumulative arc-length at each sample. This ONE array is the single source of
// truth for BOTH the linking system's entry/exit points/directions AND the
// smooth per-frame item movement below — there's no second copy of "where the
// belt goes" that could drift out of sync with "where items actually travel."
function buildPath(variant) {
    const h = BELT_RIDE_HEIGHT;

    if (variant === 'left' || variant === 'right') {
        // sign = +1 curves toward +Z ("left"), -1 curves toward -Z ("right").
        const sign = variant === 'left' ? 1 : -1;
        const points = [];
        const cumLength = [];
        for (let i = 0; i <= CURVE_SEGMENTS; i++) {
            const theta = (i / CURVE_SEGMENTS) * (Math.PI / 2);
            const x = CURVE_RADIUS * Math.sin(theta);
            const z = sign * CURVE_RADIUS * (1 - Math.cos(theta));
            const dx = Math.cos(theta);
            const dz = sign * Math.sin(theta);
            points.push({ p: new THREE.Vector3(x, h, z), dir: new THREE.Vector3(dx, 0, dz).normalize() });
            cumLength.push(CURVE_RADIUS * theta);
        }
        return { points, cumLength, totalLength: CURVE_RADIUS * (Math.PI / 2) };
    }

    return {
        points: [
            { p: new THREE.Vector3(0, h, 0), dir: new THREE.Vector3(1, 0, 0) },
            { p: new THREE.Vector3(CONVEYOR_LENGTH, h, 0), dir: new THREE.Vector3(1, 0, 0) }
        ],
        cumLength: [0, CONVEYOR_LENGTH],
        totalLength: CONVEYOR_LENGTH
    };
}

export function createConveyor(variant = 'straight') {
    const group = new THREE.Group();
    const path = buildPath(variant);

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.55, metalness: 0.35 });
    const beltTexture = createBeltTexture();
    const beltMat = new THREE.MeshStandardMaterial({ map: beltTexture, color: 0x1a1c1e, roughness: 0.8, metalness: 0.1 });
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x0e0f10, roughness: 0.5, emissive: 0x2ecc71, emissiveIntensity: 0 });

    let rollerL = null, rollerR = null;

    if (variant === 'straight') {
        const L = CONVEYOR_LENGTH;

        const railGeo = new THREE.BoxGeometry(L, 0.14, 0.05);
        const railFront = new THREE.Mesh(railGeo, blackMat);
        railFront.position.set(L / 2, 0.4, 0.3);
        railFront.castShadow = true;
        group.add(railFront);
        const railBack = railFront.clone();
        railBack.position.z = -0.3;
        group.add(railBack);

        const belt = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.5), beltMat);
        belt.position.set(L / 2, 0.32, 0);
        belt.receiveShadow = true;
        group.add(belt);

        // Small raised curb lips at both ends — items read as "on" the belt
        // rather than floating over a bare plank. New detail this pass.
        const lipGeo = new THREE.BoxGeometry(0.04, 0.04, 0.5);
        const lipEntry = new THREE.Mesh(lipGeo, blackMat);
        lipEntry.position.set(0.02, 0.36, 0);
        group.add(lipEntry);
        const lipExit = lipEntry.clone();
        lipExit.position.x = L - 0.02;
        group.add(lipExit);

        rollerL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.46, 10), blackMat);
        rollerL.rotation.z = Math.PI / 2;
        rollerL.position.set(0, 0.32, 0);
        rollerL.castShadow = true;
        group.add(rollerL);
        rollerR = rollerL.clone();
        rollerR.position.x = L;
        group.add(rollerR);

        const outputIndicator = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.26), indicatorMat);
        outputIndicator.position.set(L - 0.15, 0.5, 0);
        group.add(outputIndicator);

        const legGeo = new THREE.BoxGeometry(0.1, 0.32, 0.1);
        [[0.18, 0.16, 0.2], [0.18, 0.16, -0.2], [L - 0.18, 0.16, 0.2], [L - 0.18, 0.16, -0.2]].forEach(pos => {
            const leg = new THREE.Mesh(legGeo, blackMat);
            leg.position.set(...pos);
            leg.castShadow = true;
            group.add(leg);
        });
    } else {
        // Curved: a run of short black belt tiles + paired rails following the
        // arc, plus legs at alternating sample points. Deliberately uses only
        // simple Y-axis rotation math (no quaternion alignment tricks) so the
        // geometry can't end up subtly twisted.
        const pts = path.points;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i].p, b = pts[i + 1].p;
            const dx = b.x - a.x, dz = b.z - a.z;
            const segLen = Math.sqrt(dx * dx + dz * dz);
            const midX = (a.x + b.x) / 2, midZ = (a.z + b.z) / 2;
            const rotY = Math.atan2(-dz, dx);

            const tile = new THREE.Mesh(new THREE.BoxGeometry(segLen * 1.05, 0.05, 0.5), beltMat);
            tile.position.set(midX, 0.32, midZ);
            tile.rotation.y = rotY;
            tile.receiveShadow = true;
            group.add(tile);

            const ndx = dx / segLen, ndz = dz / segLen;
            const perpX = -ndz, perpZ = ndx;

            const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen * 1.05, 0.14, 0.05), blackMat);
            rail.position.set(midX + perpX * 0.3, 0.4, midZ + perpZ * 0.3);
            rail.rotation.y = rotY;
            rail.castShadow = true;
            group.add(rail);
            const railOther = rail.clone();
            railOther.position.set(midX - perpX * 0.3, 0.4, midZ - perpZ * 0.3);
            group.add(railOther);

            if (i % 2 === 0) {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), blackMat);
                leg.position.set(a.x, 0.16, a.z);
                leg.castShadow = true;
                group.add(leg);
            }
        }

        const lastPt = pts[pts.length - 1].p;
        const finalLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), blackMat);
        finalLeg.position.set(lastPt.x, 0.16, lastPt.z);
        finalLeg.castShadow = true;
        group.add(finalLeg);

        const exitDir = pts[pts.length - 1].dir;
        const outputIndicator = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.26), indicatorMat);
        outputIndicator.position.set(lastPt.x - exitDir.x * 0.15, 0.5, lastPt.z - exitDir.z * 0.15);
        outputIndicator.rotation.y = Math.atan2(-exitDir.z, exitDir.x);
        group.add(outputIndicator);
    }

    const state = { rollerSpin: 0, outputConveyor: null };
    const _ptOut = new THREE.Vector3();

    // The single shared movement function: given a distance traveled along the
    // path (0 = entry, totalLength = exit), returns world-space position AND
    // direction. Both the linking system's getEntryPoint/getExitPoint AND the
    // per-frame item-movement code below call this — one function, one path,
    // no way for the two to disagree.
    function getPointAtDistance(distance, outPos, outDir) {
        const d = Math.max(0, Math.min(path.totalLength, distance));
        const pts = path.points, cum = path.cumLength;

        let idx = cum.length - 2;
        for (let i = 0; i < cum.length - 1; i++) {
            if (d <= cum[i + 1]) { idx = i; break; }
        }
        const segLen = cum[idx + 1] - cum[idx];
        const t = segLen > 0 ? (d - cum[idx]) / segLen : 0;

        _ptOut.lerpVectors(pts[idx].p, pts[idx + 1].p, t);
        outPos.copy(_ptOut).applyQuaternion(group.quaternion).add(group.position);

        outDir.copy(pts[idx].dir).lerp(pts[idx + 1].dir, t);
        if (outDir.lengthSq() > 0.0001) outDir.normalize();
        outDir.applyQuaternion(group.quaternion);
    }

    const typeName = variant === 'straight' ? 'Conveyor' : (variant === 'left' ? 'Conveyor Left' : 'Conveyor Right');

    group.userData = {
        isInteractable: true,
        isStation: false,
        isConveyor: true,
        type: typeName,
        health: 5,
        maxHealth: 5,
        dropName: typeName,
        length: path.totalLength,
        pathLength: path.totalLength,
        speed: CONVEYOR_SPEED,
        variant,

        getPointAtDistance,
        getEntryPoint(target) { getPointAtDistance(0, target, _tmpDir); },
        getExitPoint(target) { getPointAtDistance(path.totalLength, target, _tmpDir); },
        getEntryDirection(target) { getPointAtDistance(0, _tmpPos, target); },
        getExitDirection(target) { getPointAtDistance(path.totalLength, _tmpPos, target); },

        setOutputConveyor(c) { state.outputConveyor = c; },
        getOutputConveyor() { return state.outputConveyor; },

        tick(time) {
            if (rollerL) {
                state.rollerSpin += 0.15;
                rollerL.rotation.x = state.rollerSpin;
                rollerR.rotation.x = state.rollerSpin;
            }
            beltTexture.offset.x = (time * 0.0004 * CONVEYOR_SPEED) % 1;
            indicatorMat.emissiveIntensity = state.outputConveyor ? (0.4 + Math.sin(time * 0.002) * 0.2) : 0;
        }
    };

    return group;
}

// FIXED movement: entry/exit points now sit at the height items actually ride
// at (via BELT_RIDE_HEIGHT), so "reached the exit" reliably fires. When it
// does, if there's a next conveyor, the item's LEFTOVER travel distance for
// this frame carries straight over onto it — no snap-to-entry-point regardless
// of overshoot. That carryover is the actual teleport fix: motion stays
// continuous and at a constant rate straight through the seam.
export function advanceOnConveyor(drop, deltaTime) {
    const conveyor = drop.userData.onConveyor;
    if (!conveyor) return false;

    if (drop.userData.beltDistance === undefined) drop.userData.beltDistance = 0;
    drop.userData.beltDistance += conveyor.userData.speed * deltaTime;

    const pathLen = conveyor.userData.pathLength;
    if (drop.userData.beltDistance >= pathLen) {
        const overflow = drop.userData.beltDistance - pathLen;
        const next = conveyor.userData.getOutputConveyor ? conveyor.userData.getOutputConveyor() : null;

        if (next && next.userData.isConveyor) {
            drop.userData.onConveyor = next;
            drop.userData.beltDistance = overflow;
        } else {
            conveyor.userData.getPointAtDistance(pathLen, _tmpPos, _tmpDir);
            drop.position.copy(_tmpPos);
            drop.userData.onConveyor = null;
            drop.userData.beltDistance = 0;
            drop.userData.velocity = new THREE.Vector3(_tmpDir.x * 1.2, 1.0, _tmpDir.z * 1.2);
            return true;
        }
    }

    const active = drop.userData.onConveyor;
    active.userData.getPointAtDistance(drop.userData.beltDistance, _tmpPos, _tmpDir);
    drop.position.copy(_tmpPos);

    // "Roll" instead of slide: spin the item around the axis perpendicular to
    // its current travel direction, at a rate proportional to distance moved.
    _rollAxis.crossVectors(_up, _tmpDir);
    if (_rollAxis.lengthSq() > 0.0001) {
        _rollAxis.normalize();
        const angle = drop.userData.beltDistance / ITEM_ROLL_RADIUS;
        drop.quaternion.setFromAxisAngle(_rollAxis, angle);
    }

    return true;
}