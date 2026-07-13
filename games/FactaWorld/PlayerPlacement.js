import * as THREE from 'three';
import { createWorkbench } from './obj/Workbench.js';
import { createFurnace } from './obj/furnace.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor, advanceOnConveyor, CONVEYOR_HALF_LENGTH } from './obj/conveyor.js';
import { rescanAllLinks, updateGhostLinkPreview } from './linkSystem.js';
import { PLACEMENT_OVERLAP_DISTANCE, DEFAULT_OVERLAP_DISTANCE, CONVEYOR_CHAIN_SNAP_RADIUS } from './placeables.js';
import { isConveyorItem } from './PlayerMining.js';
import { rescanPowerLinks, createManualPowerLink } from './powerSystem.js';
import { createSolarPanel } from './obj/solarpanel.js';
import { getElevation } from './world.js';

const CONVEYOR_ITEM_VARIANTS = { 'Conveyor': 'straight', 'Conveyor Left': 'left', 'Conveyor Right': 'right' };

const _groundPoint = new THREE.Vector3();
const _finalPos = new THREE.Vector3();
const _snapP = new THREE.Vector3();
const _snapD = new THREE.Vector3();
const _forwardScratch = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);

function buildPlaceable(name) {
    if (name === 'Furnace') return createFurnace();
    if (name === 'Solar Panel') return createSolarPanel();
    return createWorkbench();
}

function placeableUserData(name) {
    if (name === 'Furnace') return { isInteractable: true, isStation: true, isFurnace: true, type: 'Furnace', health: 8, maxHealth: 8, dropName: 'Furnace' };
    if (name === 'Solar Panel') return null; 
    return { isInteractable: true, isStation: true, type: 'Workbench', health: 6, maxHealth: 6, dropName: 'Workbench' };
}

function placeAutoMiner(player) {
    if (!player.ghostMesh.visible || !player.ghostValid || !player._pendingAutoMinerTarget) return;
    const targetNode = player._pendingAutoMinerTarget;

    const built = createAutoMiner();
    built.position.copy(targetNode.position);
    built.rotation.y = player.placeRotation;
    built.userData.targetSpawnIndex = targetNode.userData.spawnIndex;
    if (built.userData.bindContext) built.userData.bindContext(player.interactables, player.dropsGroup);

    player.interactables.add(built);
    player.interactables.updateMatrixWorld(true);

    player.inventory.consumeItem('Auto Miner', 1);
    player._pendingAutoMinerTarget = null;

    rescanAllLinks(player);
    rescanPowerLinks(player);
}

function placeConveyor(player, itemName) {
    if (!player.ghostMesh.visible || !player.ghostValid) return;
    const variant = CONVEYOR_ITEM_VARIANTS[itemName];

    const built = createConveyor(variant);
    built.position.copy(player.ghostMesh.position);
    built.rotation.copy(player.ghostMesh.rotation);

    player.interactables.add(built);
    player.interactables.updateMatrixWorld(true);

    player.inventory.consumeItem(itemName, 1);

    rescanAllLinks(player);
}

function placeGenericStructure(player, itemName) {
    if (!player.ghostValid) return;
    const built = buildPlaceable(itemName);
    built.position.copy(player.ghostMesh.position);
    built.rotation.copy(player.ghostMesh.rotation);

    const overrideData = placeableUserData(itemName);
    if (overrideData) built.userData = overrideData;
    else built.userData.isInteractable = true;

    player.interactables.add(built);
    player.interactables.updateMatrixWorld(true);

    player.inventory.consumeItem(itemName, 1);

    if (itemName === 'Solar Panel') rescanPowerLinks(player);
}

export function tryPlaceActiveItem(player) {
    const activeItem = player.inventory.getActiveItem();
    if (!player.ghostValid || !player.ghostMesh.visible) return false;

    if (activeItem.name === 'Auto Miner') { placeAutoMiner(player); return true; }
    if (isConveyorItem(activeItem.name)) { placeConveyor(player, activeItem.name); return true; }
    if (activeItem.name === 'Workbench' || activeItem.name === 'Furnace' || activeItem.name === 'Solar Panel') {
        placeGenericStructure(player, activeItem.name);
        return true;
    }
    return false;
}

export function handleRightClick(player) {
    player.camera.getWorldDirection(player.raycaster.ray.direction);
    player.raycaster.ray.origin.copy(player.camera.position);

    const hits = player.raycaster.intersectObjects(player.interactables.children, true);

    if (hits.length > 0 && hits[0].point.distanceTo(player.position) < 7.0) {
        let obj = hits[0].object;
        
        while (obj.parent && obj.parent !== player.interactables && !obj.userData.isInteractable) {
            obj = obj.parent;
        }
        if (obj.parent && obj.parent !== player.interactables && obj.userData.isInteractable === undefined) {
            while (obj.parent && obj.parent !== player.interactables) {
                obj = obj.parent;
            }
        }

        if (obj) {
            let isPanel = false;
            let isMiner = false;

            obj.traverse((child) => {
                if (child.userData) {
                    if (child.userData.isSolarPanel || child.userData.type === 'Solar Panel' || (child.name && child.name.toLowerCase().includes('solar'))) {
                        isPanel = true;
                    }
                    if (child.userData.isAutoMiner || child.userData.type === 'Auto Miner' || (child.name && child.name.toLowerCase().includes('miner'))) {
                        isMiner = true;
                    }
                }
            });

            if (isPanel || isMiner) {
                if (!player.powerLinkingSource) {
                    player.powerLinkingSource = obj;
                    console.log("[Power System] Anchor Selected.");
                } else {
                    if (player.powerLinkingSource === obj) {
                        player.powerLinkingSource = null;
                        return;
                    }
                    
                    createManualPowerLink(player, player.powerLinkingSource, obj);
                    player.powerLinkingSource = null;
                }
                return;
            }
        }
    }

    if (player.powerLinkingSource) {
        player.powerLinkingSource = null;
    }
}

export function tickConveyorDrops(player, deltaTime) {
    if (!player.dropsGroup || !player.interactables) return;

    const activeBelts = [];
    player.interactables.traverse((child) => {
        if (child.userData && child.userData.isConveyor) {
            activeBelts.push(child);
        }
    });

    for (const drop of player.dropsGroup.children) {
        if (drop.userData.conveyorCooldown && drop.userData.conveyorCooldown > 0) {
            drop.userData.conveyorCooldown -= deltaTime;
        }

        if (drop.userData.onConveyor) {
            advanceOnConveyor(drop, deltaTime);
        } else {
            if (!drop.userData.velocity) {
                drop.userData.velocity = new THREE.Vector3(0, 0, 0);
            }

            drop.userData.velocity.y -= 9.8 * deltaTime; 
            drop.position.addScaledVector(drop.userData.velocity, deltaTime);
            
            const currentFloor = getElevation(drop.position.x, drop.position.z);
            if (drop.position.y < currentFloor + 0.1) {
                drop.position.y = currentFloor + 0.1;
                drop.userData.velocity.set(0, 0, 0);
            }

            if (drop.userData.conveyorCooldown && drop.userData.conveyorCooldown > 0) continue;

            for (const belt of activeBelts) {
                const horizontalDistance = drop.position.distanceTo(belt.position);
                if (horizontalDistance < 2.5) { 
                    let nearestTargetDistance = -1;
                    let lowestHorizontalDistance = Infinity;
                    const traceResolution = 10; 
                    const sampleCoordinateVector = new THREE.Vector3();

                    for (let i = 0; i <= traceResolution; i++) {
                        const distanceAlongTrack = (i / traceResolution) * belt.userData.length;
                        belt.userData.getPointAtDistance(distanceAlongTrack, sampleCoordinateVector, null);
                        
                        const deltaX = drop.position.x - sampleCoordinateVector.x;
                        const deltaZ = drop.position.z - sampleCoordinateVector.z;
                        const computedDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
                        
                        if (computedDistance < lowestHorizontalDistance) {
                            lowestHorizontalDistance = computedDistance;
                            nearestTargetDistance = distanceAlongTrack;
                        }
                    }

                    if (lowestHorizontalDistance < 0.65 && Math.abs(drop.position.y - belt.position.y) < 0.8) {
                        drop.userData.onConveyor = belt;
                        drop.userData.beltDistance = nearestTargetDistance;
                        drop.userData.velocity.set(0, 0, 0);
                        break; 
                    }
                }
            }
        }
    }
}

function computeGroundPoint(player, groundMesh, target) {
    if (groundMesh) {
        const hits = player.raycaster.intersectObject(groundMesh);
        if (hits.length > 0 && hits[0].point.distanceTo(player.position) < 12.0) {
            target.copy(hits[0].point);
            target.y = getElevation(target.x, target.z);
            return true;
        }
    }
    return false;
}

function updateAutoMinerGhost(player, hits) {
    if (hits.length === 0) { player.ghostValid = false; player.ghostMesh.visible = false; return; }
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.isInteractable) obj = obj.parent;
    if (!obj) { player.ghostValid = false; player.ghostMesh.visible = false; return; }

    const isResource = obj.userData.type === 'Stone' || obj.userData.type === 'Iron Ore' || obj.userData.type === 'Quartz' || obj.userData.type === 'Sand';
    if (!isResource || hits[0].point.distanceTo(player.position) > 8.0) {
        player.ghostValid = false;
        player.ghostMesh.visible = false;
        return;
    }

    let alreadyClaimed = false;
    for (const child of player.interactables.children) {
        if (child.userData.isAutoMiner && child.userData.targetSpawnIndex === obj.userData.spawnIndex) {
            alreadyClaimed = true; break;
        }
    }

    if (player.currentGhostType !== 'Auto Miner') {
        player.currentGhostType = 'Auto Miner';
        player.scene.remove(player.ghostMesh);
        player.ghostMesh = createAutoMiner();
        player.ghostMesh.traverse(c => {
            if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.castShadow = false; }
        });
        player.scene.add(player.ghostMesh);
    }

    player.ghostMesh.visible = true;
    player.ghostMesh.position.copy(obj.position);
    player.ghostMesh.rotation.y = player.placeRotation;
    player.ghostValid = !alreadyClaimed;
    if (player.ghostValid) player._pendingAutoMinerTarget = obj;

    const tint = player.ghostValid ? 0x7CFC9A : 0xff6b6b;
    player.ghostMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(tint); });

    if (player.ghostValid) updateGhostLinkPreview(player, player.ghostMesh, false);
}

function updateConveyorGhost(player, groundMesh, itemName) {
    const hasGround = computeGroundPoint(player, groundMesh, _groundPoint);
    if (!hasGround) {
        player.ghostValid = false;
        player.ghostMesh.visible = false;
        return;
    }

    const variant = CONVEYOR_ITEM_VARIANTS[itemName];
    let snapSource = null;
    for (const child of player.interactables.children) {
        const isConv = child.userData.isConveyor;
        const isMiner = child.userData.isAutoMiner;
        if (!isConv && !isMiner) continue;

        if (isConv) { child.userData.getExitPoint(_snapP); child.userData.getExitDirection(_snapD); }
        else { child.userData.getOutputPoint(_snapP); child.userData.getOutputDirection(_snapD); }

        if (_snapP.distanceTo(_groundPoint) < CONVEYOR_CHAIN_SNAP_RADIUS) { snapSource = child; break; }
    }

    let finalRotY;
    if (snapSource) {
        finalRotY = Math.atan2(-_snapD.z, _snapD.x);
        _forwardScratch.set(1, 0, 0).applyAxisAngle(_yAxis, finalRotY);
        _finalPos.copy(_snapP).addScaledVector(_forwardScratch, CONVEYOR_HALF_LENGTH);
        _finalPos.y = getElevation(_finalPos.x, _finalPos.z);
    } else {
        _finalPos.copy(_groundPoint);
        _finalPos.x = Math.round(_finalPos.x / 0.5) * 0.5;
        _finalPos.z = Math.round(_finalPos.z / 0.5) * 0.5;
        _finalPos.y = getElevation(_finalPos.x, _finalPos.z);
        finalRotY = player.placeRotation;
    }

    if (player.currentGhostType !== itemName) {
        player.currentGhostType = itemName;
        player.scene.remove(player.ghostMesh);
        player.ghostMesh = createConveyor(variant);
        player.ghostMesh.traverse(c => {
            if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.castShadow = false; }
        });
        player.scene.add(player.ghostMesh);
    }

    player.ghostMesh.visible = true;
    player.ghostMesh.position.copy(_finalPos);
    player.ghostMesh.rotation.y = finalRotY;

    const overlapDist = PLACEMENT_OVERLAP_DISTANCE[itemName] || DEFAULT_OVERLAP_DISTANCE;
    let overlapping = false;

    if (_finalPos.y < -11.5) {
        overlapping = true;
    } else {
        for (const child of player.interactables.children) {
            if (child === snapSource) continue;
            const horizDist = Math.sqrt(Math.pow(child.position.x - _finalPos.x, 2) + Math.pow(child.position.z - _finalPos.z, 2));
            const vertDist = Math.abs(child.position.y - _finalPos.y);
            
            if (horizDist < overlapDist && vertDist < 2.0) { 
                overlapping = true; 
                break; 
            }
        }
    }
    
    player.ghostValid = !overlapping;
    const tint = player.ghostValid ? 0x7CFC9A : 0xff6b6b;
    player.ghostMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(tint); });

    if (player.ghostValid) updateGhostLinkPreview(player, player.ghostMesh, true);
}

function updateGenericGhost(player, groundMesh, itemName) {
    const hasGround = computeGroundPoint(player, groundMesh, _finalPos);
    if (!hasGround) {
        player.ghostValid = false;
        player.ghostMesh.visible = false;
        return;
    }

    _finalPos.x = Math.round(_finalPos.x / 0.5) * 0.5;
    _finalPos.z = Math.round(_finalPos.z / 0.5) * 0.5;
    _finalPos.y = getElevation(_finalPos.x, _finalPos.z);

    if (player.currentGhostType !== itemName) {
        player.currentGhostType = itemName;
        player.scene.remove(player.ghostMesh);
        player.ghostMesh = buildPlaceable(itemName);
        player.ghostMesh.traverse(c => {
            if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.castShadow = false; }
        });
        player.scene.add(player.ghostMesh);
    }

    player.ghostMesh.visible = true;
    player.ghostMesh.position.copy(_finalPos);
    player.ghostMesh.rotation.y = player.placeRotation;

    const overlapDist = PLACEMENT_OVERLAP_DISTANCE[itemName] || DEFAULT_OVERLAP_DISTANCE;
    let overlapping = false;

    if (_finalPos.y < -11.5) {
        overlapping = true;
    } else {
        for (const child of player.interactables.children) {
            const horizDist = Math.sqrt(Math.pow(child.position.x - _finalPos.x, 2) + Math.pow(child.position.z - _finalPos.z, 2));
            const vertDist = Math.abs(child.position.y - _finalPos.y);

            if (horizDist < overlapDist && vertDist < 2.5) { 
                overlapping = true; 
                break; 
            }
        }
    }

    player.ghostValid = !overlapping;
    const tint = player.ghostValid ? 0x7CFC9A : 0xff6b6b;
    player.ghostMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(tint); });
}

export function updateHoverUI(player, groundMesh) {
    player.camera.getWorldDirection(player.raycaster.ray.direction);
    player.raycaster.ray.origin.copy(player.camera.position);
    player.hoverTarget = null;
    player.ghostMesh.visible = false;
    if (player.ghostLinkPreviewIn) player.ghostLinkPreviewIn.setVisible(false);
    if (player.ghostLinkPreviewOut) player.ghostLinkPreviewOut.setVisible(false);
    player._pendingAutoMinerTarget = null;

    const hits = player.raycaster.intersectObjects(player.interactables.children, true);

    if (hits.length > 0 && hits[0].point.distanceTo(player.position) < 7.0) {
        let obj = hits[0].object;
        while (obj.parent && obj.parent !== player.interactables && !obj.userData.isInteractable) obj = obj.parent;
        
        if (obj) {
            player.hoverTarget = obj;
            player.targetUi.classList.add('show');

            let isPanel = false;
            let isMiner = false;
            
            obj.traverse((c) => {
                if (c.userData) {
                    if (c.userData.isSolarPanel || c.userData.type === 'Solar Panel' || (c.name && c.name.toLowerCase().includes('solar'))) isPanel = true;
                    if (c.userData.isAutoMiner || c.userData.type === 'Auto Miner' || (c.name && c.name.toLowerCase().includes('miner'))) isMiner = true;
                }
            });

            let label = obj.userData.type || (isPanel ? 'Solar Panel' : (isMiner ? 'Auto Miner' : 'Structure'));
            if (isMiner || obj.userData.isConveyor) {
                const hasOutput = player.activeLinks.some(l => l.source === obj);
                if (hasOutput) label += ' (Linked)';
            }

            if (player.powerLinkingSource) {
                if (player.powerLinkingSource === obj) {
                    label += ' [LINK SOURCE]';
                } else {
                    let srcPanel = false;
                    let srcMiner = false;
                    
                    player.powerLinkingSource.traverse((c) => {
                        if (c.userData) {
                            if (c.userData.isSolarPanel || c.userData.type === 'Solar Panel' || (c.name && c.name.toLowerCase().includes('solar'))) srcPanel = true;
                            if (c.userData.isAutoMiner || c.userData.type === 'Auto Miner' || (c.name && c.name.toLowerCase().includes('miner'))) srcMiner = true;
                        }
                    });
                    
                    if ((srcPanel && isMiner) || (srcMiner && isPanel)) {
                        label += ' [CLICK TO WIRE]';
                    }
                }
            }

            player.targetName.innerText = label;
            const hp = obj.userData.health !== undefined ? obj.userData.health : 10;
            const maxHp = obj.userData.maxHealth || 10;
            player.healthFill.style.width = `${(Math.max(0, hp) / maxHp) * 100}%`;
        }
    } else {
        player.targetUi.classList.remove('show');
    }

    const activeItem = player.inventory.getActiveItem();
    if (activeItem.name === 'Auto Miner') { updateAutoMinerGhost(player, hits); return; }
    if (isConveyorItem(activeItem.name)) { updateConveyorGhost(player, groundMesh, activeItem.name); return; }
    if (activeItem.name === 'Workbench' || activeItem.name === 'Furnace' || activeItem.name === 'Solar Panel') {
        updateGenericGhost(player, groundMesh, activeItem.name);
    }
}