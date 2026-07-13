import * as THREE from 'three';
import { createWorkbench } from './obj/Workbench.js';
import { createFurnace } from './obj/furnace.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor, advanceOnConveyor } from './obj/conveyor.js';
import { createSolarPanel } from './obj/solarpanel.js';
import { rescanAllLinks, updateGhostLinkPreview, completeManualPowerLink } from './linkSystem.js';
import { scheduleBuildingSave } from './buildingsSync.js';
import { PLACEMENT_OVERLAP_DISTANCE, DEFAULT_OVERLAP_DISTANCE, CONVEYOR_CHAIN_SNAP_RADIUS } from './placeables.js';
import { isConveyorItem } from './PlayerMining.js';
import { getElevation } from './world.js';

const CONVEYOR_ITEM_VARIANTS = { 'Conveyor': 'straight', 'Conveyor Left': 'left', 'Conveyor Right': 'right' };

const _groundPoint = new THREE.Vector3();
const _finalPos = new THREE.Vector3();
const _snapP = new THREE.Vector3();
const _snapD = new THREE.Vector3();

function buildPlaceable(name) {
    if (name === 'Furnace') return createFurnace();
    if (name === 'Solar Panel') return createSolarPanel();
    return createWorkbench();
}

function placeableUserData(name) {
    if (name === 'Furnace') return { isInteractable: true, isStation: true, isFurnace: true, type: 'Furnace', health: 8, maxHealth: 8, dropName: 'Furnace' };
    if (name === 'Solar Panel') return null; // keeps its real factory userData (power methods) -- never overwritten
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
    player.inventory.consumeItem('Auto Miner', 1);
    player._pendingAutoMinerTarget = null;

    rescanAllLinks(player);
    scheduleBuildingSave(player);
}

function placeConveyor(player, itemName) {
    if (!player.ghostMesh.visible || !player.ghostValid) return;
    const variant = CONVEYOR_ITEM_VARIANTS[itemName];

    const built = createConveyor(variant);
    built.position.copy(player.ghostMesh.position);
    built.rotation.copy(player.ghostMesh.rotation);

    player.interactables.add(built);
    player.inventory.consumeItem(itemName, 1);

    rescanAllLinks(player);
    scheduleBuildingSave(player);
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
    player.inventory.consumeItem(itemName, 1);

    scheduleBuildingSave(player);
}

export function tryPlaceActiveItem(player) {
    const activeItem = player.inventory.getActiveItem();

    if (activeItem.name === 'Auto Miner') { placeAutoMiner(player); return true; }
    if (isConveyorItem(activeItem.name)) { placeConveyor(player, activeItem.name); return true; }
    if ((activeItem.name === 'Workbench' || activeItem.name === 'Furnace' || activeItem.name === 'Solar Panel') && player.ghostMesh.visible) {
        placeGenericStructure(player, activeItem.name);
        return true;
    }
    return false;
}

export function tickConveyorDrops(player, deltaTime) {
    if (!player.dropsGroup) return;
    for (const drop of player.dropsGroup.children) {
        if (drop.userData.onConveyor) advanceOnConveyor(drop, deltaTime);
    }
}

function computeGroundPoint(player, groundMesh, target) {
    if (groundMesh) {
        const hits = player.raycaster.intersectObject(groundMesh);
        if (hits.length > 0 && hits[0].point.distanceTo(player.position) < 12.0) {
            target.copy(hits[0].point);
            return target;
        }
    }
    // Fallback (looking at the sky etc): project along the view ray, using
    // real terrain elevation rather than a flat guess.
    const dir = player.raycaster.ray.direction;
    const origin = player.raycaster.ray.origin;
    let dist = 4;
    if (Math.abs(dir.y) > 0.05) {
        const approxGroundY = getElevation(origin.x, origin.z);
        const planeDist = (approxGroundY - origin.y) / dir.y;
        if (planeDist > 0.5 && planeDist < 12) dist = planeDist;
    }
    target.copy(origin).addScaledVector(dir, dist);
    target.y = getElevation(target.x, target.z);
    return target;
}

function updateAutoMinerGhost(player, hits) {
    if (hits.length === 0) return;
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.isInteractable) obj = obj.parent;
    if (!obj) return;

    const isResource = obj.userData.type === 'Stone' || obj.userData.type === 'Iron Ore' || obj.userData.type === 'Quartz' || obj.userData.type === 'Sand';
    if (!isResource) return;
    if (hits[0].point.distanceTo(player.position) > 8.0) return;

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
    computeGroundPoint(player, groundMesh, _groundPoint);
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
        _finalPos.copy(_snapP);
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
    for (const child of player.interactables.children) {
        if (child === snapSource) continue;
        if (child.position.distanceTo(_finalPos) < overlapDist) { overlapping = true; break; }
    }
    player.ghostValid = !overlapping;

    const tint = player.ghostValid ? 0x7CFC9A : 0xff6b6b;
    player.ghostMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(tint); });

    if (player.ghostValid) updateGhostLinkPreview(player, player.ghostMesh, true);
}

function updateGenericGhost(player, groundMesh, itemName) {
    computeGroundPoint(player, groundMesh, _finalPos);
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
    for (const child of player.interactables.children) {
        if (child.position.distanceTo(_finalPos) < overlapDist) { overlapping = true; break; }
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
        while (obj.parent && !obj.userData.isInteractable) obj = obj.parent;
        if (obj && obj.userData.isInteractable) {
            player.hoverTarget = obj;
            player.targetUi.classList.add('show');

            let label = obj.userData.type;
            if (player.linkSelection === obj) {
                label += ' — SELECTED (right-click again to cancel)';
            } else if (player.linkSelection && (obj.userData.isSolarPanel || obj.userData.isAutoMiner)) {
                label += ' (right-click to link)';
            } else if (obj.userData.isAutoMiner || obj.userData.isConveyor) {
                const hasOutput = player.activeLinks.some(l => !l.isPowerLink && l.source === obj);
                if (hasOutput) label += ' (linked)';
            } else if (obj.userData.isSolarPanel) {
                const poweredCount = player.activeLinks.filter(l => l.isPowerLink && l.source === obj).length;
                if (poweredCount > 0) label += ` (powering ${poweredCount})`;
            }
            player.targetName.innerText = label;
            player.healthFill.style.width = `${(Math.max(0, obj.userData.health) / obj.userData.maxHealth) * 100}%`;
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

// ===== MANUAL POWER LINKING (right-click tool) =====
// First right-click on a Solar Panel or Auto Miner selects it as the pending
// link source. Second right-click on the complementary node completes the
// connection — order doesn't matter, select the panel first or the miner
// first, both work. Right-clicking the same node again cancels. Right-
// clicking a Furnace/Workbench always opens its menu and clears any pending
// selection, regardless of link-mode state.
export function handleRightClick(player) {
    const obj = player.hoverTarget;

    if (obj && obj.userData.isFurnace) {
        player.linkSelection = null;
        document.exitPointerLock();
        player.craftState.furnaceRef = obj;
        player.updateFurnaceButtons();
        player.furnaceMenu.classList.add('show');
        return;
    }
    if (obj && obj.userData.isStation) {
        player.linkSelection = null;
        document.exitPointerLock();
        player.updateCraftingButtons();
        player.workbenchMenu.classList.add('show');
        return;
    }

    const isLinkable = obj && (obj.userData.isSolarPanel || obj.userData.isAutoMiner);
    if (!isLinkable) {
        player.linkSelection = null;
        return;
    }

    if (!player.linkSelection) {
        player.linkSelection = obj;
        return;
    }

    if (player.linkSelection === obj) {
        player.linkSelection = null;
        return;
    }

    const success = completeManualPowerLink(player, player.linkSelection, obj);
    if (success) scheduleBuildingSave(player);
    else showTooFarNotification();
    player.linkSelection = null;
}

function showTooFarNotification() {
    const el = document.getElementById('notification-hud');
    if (!el) return;
    el.textContent = 'Cannot connect — too far or incompatible.';
    el.classList.add('show');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.classList.remove('show'), 2200);
}