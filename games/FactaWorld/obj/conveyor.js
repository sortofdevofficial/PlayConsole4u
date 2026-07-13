import * as THREE from 'three';

const CONVEYOR_LENGTH = 1.0;
export const CONVEYOR_HALF_LENGTH = CONVEYOR_LENGTH / 2;
const CURVE_RADIUS = 0.5; 
const CURVE_SEGMENTS = 12; 
const CONVEYOR_SPEED = 1.4;
export const BELT_RIDE_HEIGHT = 0.35;

function createBeltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0c0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#222529';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, canvas.height);
        ctx.lineTo(x + canvas.height, 0);
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(2, 1);
    return texture;
}

function buildPath(type) {
    const h = BELT_RIDE_HEIGHT;
    const halfLen = CONVEYOR_HALF_LENGTH;
    const isCurve = (type === 'left' || type === 'right');

    if (!isCurve) {
        return {
            points: [
                { p: new THREE.Vector3(-halfLen, h, 0), dir: new THREE.Vector3(1, 0, 0) },
                { p: new THREE.Vector3(halfLen, h, 0), dir: new THREE.Vector3(1, 0, 0) }
            ],
            cum: [0, CONVEYOR_LENGTH],
            totalLength: CONVEYOR_LENGTH
        };
    }

    const sign = type === 'left' ? -1 : 1;
    const points = [];
    const cum = [];
    
    for (let i = 0; i <= CURVE_SEGMENTS; i++) {
        const t = i / CURVE_SEGMENTS;
        const theta = t * (Math.PI / 2);
        
        const x = -halfLen + CURVE_RADIUS * Math.sin(theta);
        const z = sign * halfLen - sign * CURVE_RADIUS * Math.cos(theta);
        
        const dx = Math.cos(theta);
        const dz = sign * Math.sin(theta);
        
        points.push({ p: new THREE.Vector3(x, h, z), dir: new THREE.Vector3(dx, 0, dz).normalize() });
        cum.push(CURVE_RADIUS * theta);
    }
    
    return { points, cum, totalLength: CURVE_RADIUS * (Math.PI / 2) };
}

export function createConveyor(type = 'straight') {
    const group = new THREE.Group();
    const isCurve = (type === 'left' || type === 'right');
    const path = buildPath(type);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2c3035, roughness: 0.6, metalness: 0.5 });
    const beltTexture = createBeltTexture();
    const beltMat = new THREE.MeshStandardMaterial({ map: beltTexture, color: 0x1a1c1e, roughness: 0.9, metalness: 0.1 });
    const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x0e0f10, roughness: 0.5, emissive: 0x2ecc71, emissiveIntensity: 0 });
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.35, metalness: 0.6 });

    const rollers = [];

    for (let i = 0; i < path.points.length - 1; i++) {
        const a = path.points[i].p, b = path.points[i + 1].p;
        const dx = b.x - a.x, dz = b.z - a.z;
        const segLen = Math.sqrt(dx * dx + dz * dz);
        if (segLen < 0.0001) continue;
        const midX = (a.x + b.x) / 2, midZ = (a.z + b.z) / 2;
        const rotY = Math.atan2(-dz, dx);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.02, 0.15, 0.5), metalMat);
        frame.position.set(midX, 0.2, midZ);
        frame.rotation.y = rotY;
        frame.castShadow = true;
        group.add(frame);

        const belt = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.02, 0.05, 0.4), beltMat);
        belt.position.set(midX, 0.28, midZ);
        belt.rotation.y = rotY;
        belt.receiveShadow = true;
        group.add(belt);
    }

    if (!isCurve) {
        const rollerGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.42, 8);
        const rL = new THREE.Mesh(rollerGeo, rollerMat);
        rL.rotation.z = Math.PI / 2;
        rL.position.set(-CONVEYOR_HALF_LENGTH, 0.28, 0);
        group.add(rL);
        rollers.push(rL);
        const rR = rL.clone();
        rR.position.x = CONVEYOR_HALF_LENGTH;
        group.add(rR);
        rollers.push(rR);
    }

    const lastPt = path.points[path.points.length - 1].p;
    const lastDir = path.points[path.points.length - 1].dir;
    const outInd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.3), indicatorMat);
    outInd.position.set(lastPt.x - lastDir.x * 0.1, 0.34, lastPt.z - lastDir.z * 0.1);
    outInd.rotation.y = Math.atan2(-lastDir.z, lastDir.x);
    group.add(outInd);

    const state = { outputConveyors: [], currentOutputIndex: 0, rollerSpin: 0 };
    const _ptOut = new THREE.Vector3();
    const _dirOut = new THREE.Vector3();
    const _scratchPos = new THREE.Vector3();
    const _scratchDir = new THREE.Vector3();

    function getPointAtDistance(distance, outPos, outDir) {
        const d = Math.max(0, Math.min(path.totalLength, distance));
        const pts = path.points, cum = path.cum;
        let idx = cum.length - 2;
        for (let i = 0; i < cum.length - 1; i++) {
            if (d <= cum[i + 1]) { idx = i; break; }
        }
        const segLen = cum[idx + 1] - cum[idx];
        const t = segLen > 0 ? (d - cum[idx]) / segLen : 0;

        _ptOut.lerpVectors(pts[idx].p, pts[idx + 1].p, t);
        if (outPos) outPos.copy(_ptOut).applyMatrix4(group.matrixWorld);

        _dirOut.copy(pts[idx].dir).lerp(pts[idx + 1].dir, t);
        if (_dirOut.lengthSq() > 0.0001) _dirOut.normalize();
        if (outDir) outDir.copy(_dirOut).applyQuaternion(group.quaternion);
    }

    const typeName = isCurve ? (type === 'left' ? 'Conveyor Left' : 'Conveyor Right') : 'Conveyor';

    group.userData = {
        isInteractable: true,
        isStation: false,
        isConveyor: true,
        type: typeName,
        health: 5,
        maxHealth: 5,
        dropName: typeName,
        length: path.totalLength,
        speed: CONVEYOR_SPEED,
        variant: type,

        getPointAtDistance,
        getEntryPoint(target) { getPointAtDistance(0, target, _scratchDir); },
        getExitPoint(target) { getPointAtDistance(path.totalLength, target, _scratchDir); },
        getEntryDirection(target) { getPointAtDistance(0, _scratchPos, target); },
        getExitDirection(target) { getPointAtDistance(path.totalLength, _scratchPos, target); },

        setOutputConveyor(c) {
            if (!c) { state.outputConveyors = []; return; }
            if (!state.outputConveyors.includes(c)) state.outputConveyors.push(c);
        },
        clearOutputConveyors() {
            state.outputConveyors = [];
        },
        getOutputConveyors() { return state.outputConveyors; },
        getOutputConveyor() {
            if (state.outputConveyors.length === 0) return null;
            state.outputConveyors = state.outputConveyors.filter(c => c.parent !== null);
            if (state.outputConveyors.length === 0) return null;

            const next = state.outputConveyors[state.currentOutputIndex % state.outputConveyors.length];
            state.currentOutputIndex++;
            return next;
        },

        tick(time) {
            state.rollerSpin += 0.15;
            rollers.forEach(r => { r.rotation.x = state.rollerSpin; });
            beltTexture.offset.x = (time * 0.0004 * CONVEYOR_SPEED) % 1;
            indicatorMat.emissiveIntensity = state.outputConveyors.length > 0 ? (0.5 + Math.sin(time * 0.003) * 0.3) : 0;
        }
    };

    return group;
}

const _advPos = new THREE.Vector3();
const _advDir = new THREE.Vector3();

export function advanceOnConveyor(drop, deltaTime) {
    const conveyor = drop.userData.onConveyor;
    if (!conveyor || !conveyor.parent) {
        drop.userData.onConveyor = null;
        return false;
    }

    if (drop.userData.beltDistance === undefined) drop.userData.beltDistance = 0;
    
    const targetDistance = drop.userData.beltDistance + conveyor.userData.speed * deltaTime;
    const pathLen = conveyor.userData.length;

    if (targetDistance >= pathLen) {
        const next = conveyor.userData.getOutputConveyor();
        
        if (next && next.userData.isConveyor && next.parent) {
            const overflow = targetDistance - pathLen;
            drop.userData.onConveyor = next;
            drop.userData.beltDistance = overflow;
        } else {
            // FIX: Momentum Physics! Fling the resource forward off the belt[cite: 12]
            drop.userData.onConveyor = null;
            drop.userData.beltDistance = undefined;

            const exitDir = new THREE.Vector3();
            if (conveyor.userData.getExitDirection) {
                conveyor.userData.getExitDirection(exitDir);
            } else {
                exitDir.set(1, 0, 0).applyQuaternion(conveyor.quaternion);
            }

            const pushSpeed = conveyor.userData.speed || 1.4;
            drop.userData.velocity = new THREE.Vector3()
                .copy(exitDir)
                .multiplyScalar(pushSpeed)
                .add(new THREE.Vector3(0, 1.8, 0)); // Arc slightly upwards

            // Cooldown so it doesn't instantly stick back to the same belt
            drop.userData.conveyorCooldown = 0.4;
            return false;
        }
    } else {
        drop.userData.beltDistance = targetDistance;
    }

    const active = drop.userData.onConveyor;
    if (active) {
        active.userData.getPointAtDistance(drop.userData.beltDistance, _advPos, _advDir);
        drop.position.copy(_advPos);
        
        if (drop.userData.beltDistance < pathLen) {
            drop.rotation.y += deltaTime * 2;
        }
    }

    return true;
}

const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();

export function rebuildFactoryConnections(interactablesGroup) {
    if (!interactablesGroup) return;

    interactablesGroup.updateMatrixWorld(true);

    const allObjects = [];
    interactablesGroup.traverse((child) => {
        if (child.userData && (child.userData.isConveyor || child.userData.isAutoMiner)) {
            allObjects.push(child);
        }
    });

    for (const obj of allObjects) {
        if (obj.userData.clearOutputConveyors) {
            obj.userData.clearOutputConveyors();
        }
    }

    const MAX_SNAP_RANGE = 2.0; 

    for (const sourceObj of allObjects) {
        if (sourceObj.userData.isAutoMiner && sourceObj.userData.getOutputPoint) {
            sourceObj.userData.getOutputPoint(_pA);

            let bestDest = null;
            let minDistance = MAX_SNAP_RANGE;

            for (const destObj of allObjects) {
                if (!destObj.userData.isConveyor || !destObj.userData.getEntryPoint) continue;
                destObj.userData.getEntryPoint(_pB);

                const dist = _pA.distanceTo(_pB);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestDest = destObj;
                }
            }

            if (bestDest && sourceObj.userData.setOutputConveyor) {
                sourceObj.userData.setOutputConveyor(bestDest);
            }
        }

        if (sourceObj.userData.isConveyor && sourceObj.userData.getExitPoint) {
            sourceObj.userData.getExitPoint(_pA);

            let bestDest = null;
            let minDistance = MAX_SNAP_RANGE;

            for (const destObj of allObjects) {
                if (sourceObj === destObj || !destObj.userData.isConveyor || !destObj.userData.getEntryPoint) continue;
                destObj.userData.getEntryPoint(_pB);

                const dist = _pA.distanceTo(_pB);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestDest = destObj;
                }
            }

            if (bestDest && sourceObj.userData.setOutputConveyor) {
                sourceObj.userData.setOutputConveyor(bestDest);
            }
        }
    }
}