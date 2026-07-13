import * as THREE from 'three';
import { BELT_RIDE_HEIGHT } from './conveyor.js';

const MINE_INTERVAL_MS = 3000;
const MINE_DAMAGE = 3;
const CONSUMPTION_RATE = 5;

function createDropMesh(type) {
    if (type === 'Stone') return new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0x888c8d }));
    if (type === 'Iron Ore') return new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), new THREE.MeshStandardMaterial({ color: 0x7d7466 }));
    if (type === 'Quartz') return new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xe8e4f0, transparent: true, opacity: 0.85 }));
    if (type === 'Sand') return new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe3c98f }));
    return null;
}

export function createAutoMiner() {
    const group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.8, metalness: 0.6, flatShading: true }); 
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.3, metalness: 0.2, flatShading: true }); 
    const drillMat = new THREE.MeshStandardMaterial({ color: 0xd2dae2, roughness: 0.2, metalness: 0.9, flatShading: true });   
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x485460, roughness: 0.5, metalness: 0.8, flatShading: true });   
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.6, metalness: 0.5, flatShading: true });    
    const statusLightMat = new THREE.MeshStandardMaterial({ color: 0x221111, emissive: 0x221111, emissiveIntensity: 0.1 });
    const powerPortMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.4, emissive: 0x3c6382, emissiveIntensity: 0.4 });

    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.2, 8), frameMat);
    basePlate.position.y = 0.1;
    basePlate.castShadow = true;
    basePlate.receiveShadow = true;
    group.add(basePlate);

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, 0.35), frameMat);
    pillarL.position.set(-0.7, 1.1, 0);
    pillarL.castShadow = true;
    group.add(pillarL);

    const pillarR = pillarL.clone();
    pillarR.position.x = 0.7;
    group.add(pillarR);

    const topBrace = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.3, 0.45), frameMat);
    topBrace.position.set(0, 2.0, 0);
    topBrace.castShadow = true;
    group.add(topBrace);

    const motorChassis = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 6), chassisMat);
    motorChassis.position.y = 1.5;
    motorChassis.rotation.y = Math.PI / 6; 
    motorChassis.castShadow = true;
    group.add(motorChassis);

    const statusLight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.08), statusLightMat);
    statusLight.position.set(0, 1.7, 0.48);
    group.add(statusLight);

    const drillRig = new THREE.Group();
    drillRig.position.set(0, 1.3, 0); 
    group.add(drillRig);

    const driveRing = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 6), frameMat);
    driveRing.position.y = 0.1;
    driveRing.castShadow = true;
    drillRig.add(driveRing);

    const drillShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), shaftMat);
    drillShaft.position.y = -0.6;
    drillShaft.castShadow = true;
    drillRig.add(drillShaft);

    const bitTier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.35, 6), drillMat);
    bitTier1.position.y = -1.2;
    bitTier1.castShadow = true;
    drillRig.add(bitTier1);

    const bitTier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 0.3, 6), drillMat);
    bitTier2.position.y = -1.5;
    bitTier2.castShadow = true;
    drillRig.add(bitTier2);

    const bitTip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 6), drillMat);
    bitTip.position.y = -1.8;
    bitTip.castShadow = true;
    drillRig.add(bitTip);

    const dropperGroup = new THREE.Group();
    dropperGroup.position.set(0, 1.4, 0); 
    group.add(dropperGroup);

    const horizontalArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6), pipeMat);
    horizontalArm.position.set(0.5, 0, 0); 
    horizontalArm.rotation.z = Math.PI / 2;
    horizontalArm.castShadow = true;
    dropperGroup.add(horizontalArm);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), pipeMat);
    elbow.position.set(1.0, 0, 0);
    dropperGroup.add(elbow);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.35, 6), pipeMat);
    nozzle.position.set(1.0, -0.175, 0); 
    nozzle.castShadow = true;
    dropperGroup.add(nozzle);

    const powerPort = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 5), powerPortMat);
    powerPort.position.set(-0.75, 1.5, 0);
    powerPort.rotation.z = Math.PI / 2;
    group.add(powerPort);

    const state = {
        lastMineTime: 0, 
        spin: 0, 
        currentPlungeY: 1.3,
        interactablesGroup: null, 
        dropsGroup: null,
        outputConveyors: [], 
        currentOutputIndex: 0,
        isPowered: false
    };

    const _outDir = new THREE.Vector3();
    const _powerDir = new THREE.Vector3();

    group.userData = {
        isInteractable: true,
        isStation: false,
        isAutoMiner: true,
        type: 'Auto Miner',
        health: 10,
        maxHealth: 10,
        dropName: 'Auto Miner',

        bindContext(interactablesGroup, dropsGroup) {
            state.interactablesGroup = interactablesGroup;
            state.dropsGroup = dropsGroup;
        },

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
            // Filter out any dead/removed conveyors on the fly
            state.outputConveyors = state.outputConveyors.filter(c => c.parent !== null);
            if (state.outputConveyors.length === 0) return null;
            
            const next = state.outputConveyors[state.currentOutputIndex % state.outputConveyors.length];
            state.currentOutputIndex++;
            return next;
        },

        getOutputPoint(target) { 
            nozzle.getWorldPosition(target); 
            target.y = group.position.y + BELT_RIDE_HEIGHT; 
        }, 
        
        getOutputDirection(target) { 
            _outDir.set(1, 0, 0).applyQuaternion(group.quaternion); 
            target.copy(_outDir); 
        },

        getConsumptionRate() { return CONSUMPTION_RATE; },
        getPowerPort(outP, outD) {
            powerPort.getWorldPosition(outP);
            _powerDir.set(-1, 0, 0).applyQuaternion(group.quaternion);
            outD.copy(_powerDir);
        },
        setPowered(powered) {
            state.isPowered = powered;
            powerPortMat.emissive.setHex(powered ? 0x00f5ff : 0xff3b3b); 
            powerPortMat.emissiveIntensity = powered ? 1.6 : 0.4;
        },
        isPowered() { return state.isPowered; },

        tick(time) {
            let targetNode = null;
            const targetIdx = group.userData.targetSpawnIndex;
            
            if (state.interactablesGroup && targetIdx !== undefined) {
                for (const child of state.interactablesGroup.children) {
                    if (child.userData && child.userData.spawnIndex === targetIdx) { 
                        targetNode = child; 
                        break; 
                    }
                }
            }

            if (!state.isPowered) {
                statusLightMat.color.setHex(0x221111);
                statusLightMat.emissive.setHex(0x221111);
                statusLightMat.emissiveIntensity = 0.1;
                state.currentPlungeY = THREE.MathUtils.lerp(state.currentPlungeY, 1.3, 0.05);
                drillRig.position.y = state.currentPlungeY;
                return;
            }

            if (state.isPowered && !targetNode) {
                statusLightMat.color.setHex(0xffa801); 
                statusLightMat.emissive.setHex(0xffa801);
                statusLightMat.emissiveIntensity = 0.5 + Math.sin(time * 0.003) * 0.2;
                state.spin += 0.04; 
                drillRig.rotation.y = state.spin;
                state.currentPlungeY = THREE.MathUtils.lerp(state.currentPlungeY, 1.3, 0.08);
                drillRig.position.y = state.currentPlungeY;
                return;
            }

            statusLightMat.color.setHex(0x05c46b); 
            statusLightMat.emissive.setHex(0x05c46b);
            statusLightMat.emissiveIntensity = 0.9 + Math.sin(time * 0.018) * 0.4;

            state.spin += 0.55; 
            drillRig.rotation.y = state.spin;

            const targetedDepth = 0.92; 
            const hammerPistonStroke = Math.abs(Math.sin(time * 0.028)) * 0.18; 
            state.currentPlungeY = THREE.MathUtils.lerp(state.currentPlungeY, targetedDepth - hammerPistonStroke, 0.15);
            drillRig.position.y = state.currentPlungeY;

            if (time - state.lastMineTime < MINE_INTERVAL_MS) return;
            state.lastMineTime = time;

            targetNode.userData.health -= MINE_DAMAGE;

            if (!targetNode.userData.basePos) targetNode.userData.basePos = targetNode.position.clone();
            const shakeX = (Math.random() - 0.5) * 0.16;
            const shakeZ = (Math.random() - 0.5) * 0.16;
            targetNode.position.set(targetNode.userData.basePos.x + shakeX, targetNode.userData.basePos.y, targetNode.userData.basePos.z + shakeZ);
            
            clearTimeout(targetNode.userData._autoMinerHitTimeout);
            targetNode.userData._autoMinerHitTimeout = setTimeout(() => {
                if (targetNode && targetNode.parent) targetNode.position.copy(targetNode.userData.basePos);
            }, 140);

            if (targetNode.userData.health <= 0) {
                const dropType = targetNode.userData.type;
                const dropName = targetNode.userData.dropName;
                targetNode.parent.remove(targetNode);

                const dropCount = dropType === 'Stone' ? Math.floor(Math.random() * 3) + 1 : 1;
                for (let i = 0; i < dropCount; i++) {
                    const mesh = createDropMesh(dropType);
                    if (!mesh) continue;
                    const dropGroup = new THREE.Group();
                    mesh.castShadow = true;
                    dropGroup.add(mesh);

                    const nextConv = group.userData.getOutputConveyor();

                    if (nextConv && nextConv.userData.isConveyor) {
                        nextConv.userData.getEntryPoint(dropGroup.position);
                        dropGroup.position.y += 0.05; 
                        
                        dropGroup.userData = {
                            name: dropName,
                            seed: Math.random() * 50,
                            velocity: new THREE.Vector3(0, 0, 0),
                            cooldown: 0,
                            onConveyor: nextConv, 
                            beltDistance: 0
                        };
                    } else {
                        nozzle.getWorldPosition(dropGroup.position); 
                        dropGroup.position.y -= 0.15; 
                        
                        dropGroup.userData = { 
                            name: dropName, 
                            seed: Math.random() * 50, 
                            velocity: new THREE.Vector3(0, -1.0, 0), 
                            cooldown: 0, 
                            onConveyor: null, 
                            beltDistance: 0 
                        };
                    }
                    
                    state.dropsGroup.add(dropGroup);
                }
            }
        }
    };

    group.userData.setPowered(false);
    return group;
}