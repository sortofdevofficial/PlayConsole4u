import * as THREE from 'three';
import { createWorkbench } from './obj/Workbench.js';
import { createPickaxe } from './obj/Pickaxe.js';
import { createAxe } from './obj/Axe.js';
import { createStick } from './obj/sticks.js';
import { createFurnace } from './obj/furnace.js';
import { createIronOreItem, createIronIngot, createIronPlate, createIronGear } from './obj/iron.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor, advanceOnConveyor } from './obj/conveyor.js';
import { createLinkConnector } from './linkVisuals.js';
import {
    PLACEMENT_OVERLAP_DISTANCE, DEFAULT_OVERLAP_DISTANCE,
    CONVEYOR_CHAIN_SNAP_RADIUS, MACHINE_LINK_RADIUS, MAX_LINK_DISTANCE
} from './placeables.js';

const _groundPoint = new THREE.Vector3();
const _snapExit = new THREE.Vector3();
const _finalPos = new THREE.Vector3();
const _forwardScratch = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _linkScanPoint = new THREE.Vector3();

export function updateHeldModel(player, itemName) {
    if (player.currentHeldItemName === itemName) return;
    player.currentHeldItemName = itemName;
    while (player.heldItemContainer.children.length > 0) {
        player.heldItemContainer.remove(player.heldItemContainer.children[0]);
    }
    if (!itemName) return;

    let mesh;
    if (itemName === 'Stone Pickaxe') mesh = createPickaxe();
    else if (itemName === 'Stone Axe') mesh = createAxe();
    else if (itemName === 'Stick') mesh = createStick();
    else if (itemName === 'Oak') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c41 }));
    else if (itemName === 'Stone') mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0x888c8d }));
    else if (itemName === 'Workbench') { mesh = createWorkbench(); mesh.scale.set(0.3, 0.3, 0.3); }
    else if (itemName === 'Furnace') { mesh = createFurnace(); mesh.scale.set(0.22, 0.22, 0.22); }
    else if (itemName === 'Auto Miner') { mesh = createAutoMiner(); mesh.scale.set(0.2, 0.2, 0.2); }
    else if (itemName === 'Conveyor') { mesh = createConveyor(); mesh.scale.set(0.3, 0.3, 0.3); }
    else if (itemName === 'Iron Ore') mesh = createIronOreItem();
    else if (itemName === 'Iron Ingot') mesh = createIronIngot();
    else if (itemName === 'Iron Plate') mesh = createIronPlate();
    else if (itemName === 'Iron Gear') mesh = createIronGear();

    if (mesh) player.heldItemContainer.add(mesh);
}

// ===== LINK MANAGEMENT =====
// completeLink is the ONLY place a link is ever created — this is what makes the
// distance guard actually reliable: no matter which auto-link heuristic proposed a
// connection, it passes through here and gets rejected if the endpoints somehow end
// up farther apart than MAX_LINK_DISTANCE, or if it would create a 2-node cycle.
function completeLink(player, source, target) {
    const fromPoint = new THREE.Vector3();
    if (source.userData.getOutputPoint) source.userData.getOutputPoint(fromPoint);
    else if (source.userData.getExitPoint) source.userData.getExitPoint(fromPoint);

    const toPoint = new THREE.Vector3();
    target.userData.getEntryPoint(toPoint);

    if (fromPoint.distanceTo(toPoint) > MAX_LINK_DISTANCE) return false;

    const wouldCycle = player.activeLinks.some(l => l.source === target && l.target === source);
    if (wouldCycle) return false;

    removeLinkFrom(player, source);
    source.userData.setOutputConveyor(target);

    const connector = createLinkConnector(player.scene, 0x2ecc71, 0.55);
    connector.setEndpoints(fromPoint, toPoint);
    connector.setVisible(true);

    player.activeLinks.push({ source, target, connector });
    return true;
}

function removeLinkFrom(player, source) {
    for (let i = player.activeLinks.length - 1; i >= 0; i--) {
        if (player.activeLinks[i].source === source) {
            player.activeLinks[i].connector.dispose();
            player.activeLinks.splice(i, 1);
        }
    }
}

// Cleans up any link touching a destroyed machine — critically, if the destroyed
// node was a TARGET (a conveyor being fed into), this also nulls the surviving
// SOURCE's output reference. Without this, a source would keep trying to feed a
// dead, off-scene object forever, and items would vanish into an invisible
// "black hole" conveyor that no longer exists anywhere.
function cleanupLinksForNode(player, node) {
    for (let i = player.activeLinks.length - 1; i >= 0; i--) {
        const link = player.activeLinks[i];
        if (link.source === node || link.target === node) {
            if (link.target === node && link.source.userData.setOutputConveyor) {
                link.source.userData.setOutputConveyor(null);
            }
            link.connector.dispose();
            player.activeLinks.splice(i, 1);
        }
    }
}

// If a Conveyor is destroyed while an item is mid-transit on it, that item's
// userData.onConveyor still points at the (now removed-from-scene) conveyor
// object — its methods still technically work since JS doesn't garbage-collect it
// while referenced, so the item would keep "riding" an invisible belt forever.
// This detaches any such items and lets them fall normally instead.
function detachDropsFromConveyor(player, conveyor) {
    if (!player.dropsGroup) return;
    for (const drop of player.dropsGroup.children) {
        if (drop.userData.onConveyor === conveyor) {
            drop.userData.onConveyor = null;
            drop.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 1.0, 1.0, (Math.random() - 0.5) * 1.0);
        }
    }
}

export function tickLinkVisuals(player, time) {
    for (const link of player.activeLinks) link.connector.tick(time);
    if (player.ghostLinkPreview) player.ghostLinkPreview.tick(time);
}

// ===== AUTO-LINK CANDIDATE SEARCH (scratch-vector, no per-iteration allocation) =====
function findLinkableConveyorForOutput(player, outputPoint, excludeConveyor) {
    let best = null, bestDist = Infinity;
    for (const child of player.interactables.children) {
        if (!child.userData.isConveyor || child === excludeConveyor) continue;
        child.userData.getEntryPoint(_linkScanPoint);
        const d = _linkScanPoint.distanceTo(outputPoint);
        if (d <= MACHINE_LINK_RADIUS && d < bestDist) { bestDist = d; best = child; }
    }
    return best;
}

function findLinkableSourceForEntry(player, entryPoint, excludeSelf) {
    let best = null, bestDist = Infinity;
    for (const child of player.interactables.children) {
        if (child === excludeSelf) continue;
        const isSource = child.userData.isAutoMiner || child.userData.isConveyor;
        if (!isSource) continue;
        if (!child.userData.getOutputPoint && !child.userData.getExitPoint) continue;
        // Never silently steal an already-linked source's output — auto-linking
        // only ever proposes NEW connections, it never overrides an existing one.
        if (player.activeLinks.some(l => l.source === child)) continue;

        if (child.userData.getOutputPoint) child.userData.getOutputPoint(_linkScanPoint);
        else child.userData.getExitPoint(_linkScanPoint);

        const d = _linkScanPoint.distanceTo(entryPoint);
        if (d <= MACHINE_LINK_RADIUS && d < bestDist) { bestDist = d; best = child; }
    }
    return best;
}

// Called right after a Conveyor is placed: links anything nearby feeding INTO it
// (a miner or another conveyor), and separately links it OUT to any existing
// conveyor's entry it now sits in front of (extending a chain forward).
function tryAutoLinkConveyor(player, builtConveyor) {
    const entryPoint = new THREE.Vector3();
    builtConveyor.userData.getEntryPoint(entryPoint);
    const feeder = findLinkableSourceForEntry(player, entryPoint, builtConveyor);
    if (feeder) completeLink(player, feeder, builtConveyor);

    const exitPoint = new THREE.Vector3();
    builtConveyor.userData.getExitPoint(exitPoint);
    const forwardTarget = findLinkableConveyorForOutput(player, exitPoint, builtConveyor);
    if (forwardTarget) completeLink(player, builtConveyor, forwardTarget);
}

// Called right after an Auto Miner is placed: links its output to any nearby
// Conveyor's entry.
function tryAutoLinkAutoMiner(player, builtMiner) {
    const outPoint = new THREE.Vector3();
    builtMiner.userData.getOutputPoint(outPoint);
    const target = findLinkableConveyorForOutput(player, outPoint, null);
    if (target) completeLink(player, builtMiner, target);
}

// Right-click is back to just being "interact" (open Furnace/Workbench menus) —
// the manual link-selection mode is gone entirely. Linking is 100% automatic now.
export function handleSecondaryAction(player) {
    if (!player.hoverTarget) return;
    const obj = player.hoverTarget;

    if (obj.userData.isFurnace) {
        document.exitPointerLock();
        player.craftState.furnaceRef = obj;
        player.updateFurnaceButtons();
        player.furnaceMenu.classList.add('show');
        return;
    }
    if (obj.userData.isStation) {
        document.exitPointerLock();
        player.updateCraftingButtons();
        player.workbenchMenu.classList.add('show');
    }
}

function buildPlaceable(name) {
    if (name === 'Furnace') return createFurnace();
    return createWorkbench();
}
function placeableUserData(name) {
    if (name === 'Furnace') return { isInteractable: true, isStation: true, isFurnace: true, type: 'Furnace', health: 8, maxHealth: 8, dropName: 'Furnace' };
    return { isInteractable: true, isStation: true, type: 'Workbench', health: 6, maxHealth: 6, dropName: 'Workbench' };
}

function placeAutoMiner(player) {
    if (!player.ghostMesh.visible || !player.ghostValid || !player._pendingAutoMinerTarget) return;
    const targetNode = player._pendingAutoMinerTarget;

    const built = createAutoMiner();
    built.position.copy(targetNode.position);
    built.rotation.y = player.placeRotation;
    built.userData.isInteractable = true;
    built.userData.targetSpawnIndex = targetNode.userData.spawnIndex;
    if (built.userData.bindContext) built.userData.bindContext(player.interactables, player.dropsGroup);

    player.interactables.add(built);
    player.inventory.consumeItem('Auto Miner', 1);
    player._pendingAutoMinerTarget = null;

    tryAutoLinkAutoMiner(player, built);
}

function placeConveyor(player) {
    if (!player.ghostMesh.visible || !player.ghostValid) return;

    const built = createConveyor();
    built.position.copy(player.ghostMesh.position);
    built.rotation.copy(player.ghostMesh.rotation);
    built.userData.isInteractable = true;

    player.interactables.add(built);
    player.inventory.consumeItem('Conveyor', 1);

    tryAutoLinkConveyor(player, built);
}

function placeGenericStructure(player, itemName) {
    if (!player.ghostValid) return;
    const built = buildPlaceable(itemName);
    built.position.copy(player.ghostMesh.position);
    built.rotation.copy(player.ghostMesh.rotation);
    built.userData = placeableUserData(itemName);

    player.interactables.add(built);
    player.inventory.consumeItem(itemName, 1);
}

export function handlePrimaryAction(player) {
    if (player.punchTimer > 0) return;
    player.punchTimer = player.punchCooldown;

    const activeItem = player.inventory.getActiveItem();

    if (activeItem.name === 'Auto Miner') { placeAutoMiner(player); return; }
    if (activeItem.name === 'Conveyor') { placeConveyor(player); return; }
    if ((activeItem.name === 'Workbench' || activeItem.name === 'Furnace') && player.ghostMesh.visible) {
        placeGenericStructure(player, activeItem.name);
        return;
    }

    if (!player.hoverTarget) return;
    let obj = player.hoverTarget;

    let damage = 1;
    if (activeItem.name === 'Stone Pickaxe' && (obj.userData.type === 'Stone' || obj.userData.type === 'Iron Ore')) damage = 3;
    if (activeItem.name === 'Stone Axe' && obj.userData.type === 'Oak') damage = 3;
    if (activeItem.name === 'Stone Axe' && obj.userData.type === 'Workbench') damage = 4;
    if (activeItem.name === 'Stone Pickaxe' && obj.userData.type === 'Furnace') damage = 4;

    obj.userData.health -= damage;

    if (!obj.userData.baseScale) obj.userData.baseScale = obj.scale.clone();
    if (!obj.userData.basePos) obj.userData.basePos = obj.position.clone();
    obj.scale.setScalar(obj.userData.baseScale.x * 1.08);
    const shakeOffset = new THREE.Vector3((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08);
    obj.position.copy(obj.userData.basePos).add(shakeOffset);
    clearTimeout(obj.userData._hitTimeout);
    obj.userData._hitTimeout = setTimeout(() => {
        if (obj && obj.parent) {
            obj.position.copy(obj.userData.basePos);
            obj.scale.copy(obj.userData.baseScale);
        }
    }, 80);

    if (obj.userData.health <= 0) {
        const dropPos = obj.userData.basePos.clone().add(new THREE.Vector3(0, 1, 0));
        if (obj.userData.isAutoMiner || obj.userData.isConveyor) cleanupLinksForNode(player, obj);
        if (obj.userData.isConveyor) detachDropsFromConveyor(player, obj);
        obj.parent.remove(obj);
        player.hoverTarget = null;

        const isNaturalResource = obj.userData.dropName === 'Oak' || obj.userData.dropName === 'Stone';
        const dropCount = isNaturalResource ? Math.floor(Math.random() * 3) + 1 : 1;

        for (let i = 0; i < dropCount; i++) {
            player.spawnDrop(obj.userData.dropName, dropPos, new THREE.Vector3((Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 3));
        }
    }
}

export function spawnDrop(player, name, position, velocity = new THREE.Vector3()) {
    if (!player.dropsGroup) return;
    const drop = new THREE.Group();
    let mesh;
    if (name === 'Stick') mesh = createStick();
    else if (name === 'Oak') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c41 }));
    else if (name === 'Stone') mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0x888c8d }));
    else if (name === 'Iron Ore') mesh = createIronOreItem();
    else if (name === 'Iron Ingot') mesh = createIronIngot();
    else if (name === 'Iron Plate') mesh = createIronPlate();
    else if (name === 'Iron Gear') mesh = createIronGear();
    else if (name === 'Workbench') mesh = createWorkbench();
    else if (name === 'Furnace') { mesh = createFurnace(); mesh.scale.set(0.5, 0.5, 0.5); }
    else if (name === 'Auto Miner') { mesh = createAutoMiner(); mesh.scale.set(0.5, 0.5, 0.5); }
    else if (name === 'Conveyor') { mesh = createConveyor(); mesh.scale.set(0.5, 0.5, 0.5); }
    else if (name === 'Stone Pickaxe') mesh = createPickaxe();
    else if (name === 'Stone Axe') mesh = createAxe();

    if (mesh) {
        mesh.castShadow = true;
        drop.add(mesh);
        drop.position.copy(position);
        drop.userData = { name, seed: Math.random() * 50, velocity, cooldown: 0.6 };
        player.dropsGroup.add(drop);
    }
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
    const dir = player.raycaster.ray.direction;
    const origin = player.raycaster.ray.origin;
    let dist = 4;
    if (dir.y < -0.05) {
        const planeDist = -origin.y / dir.y;
        if (planeDist > 0.5 && planeDist < 12) dist = planeDist;
    }
    target.copy(origin).addScaledVector(dir, dist);
    target.y = 0;
    return target;
}

function updateAutoMinerGhost(player, hits) {
    if (hits.length === 0) return;
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.isInteractable) obj = obj.parent;
    if (!obj) return;

    const isResource = obj.userData.type === 'Stone' || obj.userData.type === 'Iron Ore';
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

    updateGhostLinkPreview(player, 'Auto Miner');
}

function updateConveyorGhost(player, groundMesh) {
    computeGroundPoint(player, groundMesh, _groundPoint);

    let snapConveyor = null;
    for (const child of player.interactables.children) {
        if (!child.userData.isConveyor) continue;
        child.userData.getExitPoint(_snapExit);
        if (_snapExit.distanceTo(_groundPoint) < CONVEYOR_CHAIN_SNAP_RADIUS) { snapConveyor = child; break; }
    }

    let finalRotY;
    if (snapConveyor) {
        finalRotY = snapConveyor.rotation.y;
        _forwardScratch.set(1, 0, 0).applyAxisAngle(_yAxis, finalRotY);
        _finalPos.copy(_snapExit).addScaledVector(_forwardScratch, snapConveyor.userData.length / 2);
        _finalPos.y = 0;
    } else {
        _finalPos.copy(_groundPoint);
        _finalPos.x = Math.round(_finalPos.x / 0.5) * 0.5;
        _finalPos.z = Math.round(_finalPos.z / 0.5) * 0.5;
        finalRotY = player.placeRotation;
    }

    if (player.currentGhostType !== 'Conveyor') {
        player.currentGhostType = 'Conveyor';
        player.scene.remove(player.ghostMesh);
        player.ghostMesh = createConveyor();
        player.ghostMesh.traverse(c => {
            if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.castShadow = false; }
        });
        player.scene.add(player.ghostMesh);
    }

    player.ghostMesh.visible = true;
    player.ghostMesh.position.copy(_finalPos);
    player.ghostMesh.rotation.y = finalRotY;

    const overlapDist = PLACEMENT_OVERLAP_DISTANCE['Conveyor'] || DEFAULT_OVERLAP_DISTANCE;
    let overlapping = false;
    for (const child of player.interactables.children) {
        if (child === snapConveyor) continue;
        if (child.position.distanceTo(_finalPos) < overlapDist) { overlapping = true; break; }
    }
    player.ghostValid = !overlapping;

    const tint = player.ghostValid ? 0x7CFC9A : 0xff6b6b;
    player.ghostMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(tint); });

    updateGhostLinkPreview(player, 'Conveyor');
}

function updateGenericGhost(player, groundMesh, itemName) {
    computeGroundPoint(player, groundMesh, _finalPos);
    _finalPos.x = Math.round(_finalPos.x / 0.5) * 0.5;
    _finalPos.z = Math.round(_finalPos.z / 0.5) * 0.5;

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

// Shows a live amber preview line, BEFORE placement, of what the ghost would
// auto-link to if placed right now — reuses the ghost's own real getEntryPoint/
// getExitPoint/getOutputPoint methods (it's a real Conveyor/AutoMiner instance,
// just tinted transparent), so the preview is always exactly consistent with what
// actually happens on placement.
function updateGhostLinkPreview(player, itemType) {
    if (!player.ghostValid) { player.ghostLinkPreview.setVisible(false); return; }
    const ghost = player.ghostMesh;
    let shown = false;

    if (itemType === 'Conveyor' && ghost.userData.getEntryPoint) {
        const entryPoint = new THREE.Vector3();
        ghost.userData.getEntryPoint(entryPoint);
        const feeder = findLinkableSourceForEntry(player, entryPoint, null);
        if (feeder) {
            const fromP = new THREE.Vector3();
            if (feeder.userData.getOutputPoint) feeder.userData.getOutputPoint(fromP);
            else feeder.userData.getExitPoint(fromP);
            player.ghostLinkPreview.setEndpoints(fromP, entryPoint);
            player.ghostLinkPreview.setVisible(true);
            shown = true;
        }
        if (!shown) {
            const exitPoint = new THREE.Vector3();
            ghost.userData.getExitPoint(exitPoint);
            const target = findLinkableConveyorForOutput(player, exitPoint, null);
            if (target) {
                const toP = new THREE.Vector3();
                target.userData.getEntryPoint(toP);
                player.ghostLinkPreview.setEndpoints(exitPoint, toP);
                player.ghostLinkPreview.setVisible(true);
                shown = true;
            }
        }
    } else if (itemType === 'Auto Miner' && ghost.userData.getOutputPoint) {
        const outputPoint = new THREE.Vector3();
        ghost.userData.getOutputPoint(outputPoint);
        const target = findLinkableConveyorForOutput(player, outputPoint, null);
        if (target) {
            const toP = new THREE.Vector3();
            target.userData.getEntryPoint(toP);
            player.ghostLinkPreview.setEndpoints(outputPoint, toP);
            player.ghostLinkPreview.setVisible(true);
            shown = true;
        }
    }

    if (!shown) player.ghostLinkPreview.setVisible(false);
}

export function updateHoverUI(player, groundMesh) {
    player.camera.getWorldDirection(player.raycaster.ray.direction);
    player.raycaster.ray.origin.copy(player.camera.position);
    player.hoverTarget = null;
    player.ghostMesh.visible = false;
    player.ghostLinkPreview.setVisible(false);
    player._pendingAutoMinerTarget = null;

    const hits = player.raycaster.intersectObjects(player.interactables.children, true);

    if (hits.length > 0 && hits[0].point.distanceTo(player.position) < 7.0) {
        let obj = hits[0].object;
        while (obj.parent && !obj.userData.isInteractable) obj = obj.parent;
        if (obj && obj.userData.isInteractable) {
            player.hoverTarget = obj;
            player.targetUi.classList.add('show');

            let label = obj.userData.type;
            if (obj.userData.isAutoMiner || obj.userData.isConveyor) {
                const hasOutput = player.activeLinks.some(l => l.source === obj);
                if (hasOutput) label += ' (Linked)';
            }
            player.targetName.innerText = label;
            player.healthFill.style.width = `${(Math.max(0, obj.userData.health) / obj.userData.maxHealth) * 100}%`;
        }
    } else {
        player.targetUi.classList.remove('show');
    }

    const activeItem = player.inventory.getActiveItem();
    if (activeItem.name === 'Auto Miner') { updateAutoMinerGhost(player, hits); return; }
    if (activeItem.name === 'Conveyor') { updateConveyorGhost(player, groundMesh); return; }
    if (activeItem.name === 'Workbench' || activeItem.name === 'Furnace') { updateGenericGhost(player, groundMesh, activeItem.name); }
}

export function smeltIron(player) {
    if (player.craftState.active) return false;
    const hasOre = player.inventory.getCount('Iron Ore') >= 1;
    const hasFuel = player.inventory.getCount('Stick') >= 1 || player.inventory.getCount('Oak') >= 1;
    if (!hasOre || !hasFuel) return false;

    player.inventory.consumeItem('Iron Ore', 1);
    if (player.inventory.getCount('Stick') >= 1) player.inventory.consumeItem('Stick', 1);
    else player.inventory.consumeItem('Oak', 1);

    startCraftProcess(player, { resultName: 'Iron Ingot', resultCount: 1, duration: 2.0, label: 'Smelting Iron Ingot...', sparkColor: 0xff7a29 });
    return true;
}

export function craftIronPlate(player) {
    if (player.craftState.active) return false;
    if (player.inventory.getCount('Iron Ingot') < 1) return false;
    player.inventory.consumeItem('Iron Ingot', 1);
    startCraftProcess(player, { resultName: 'Iron Plate', resultCount: 1, duration: 1.6, label: 'Forging Iron Plate...', sparkColor: 0xffaa55 });
    return true;
}

export function craftIronGear(player) {
    if (player.craftState.active) return false;
    if (player.inventory.getCount('Iron Ingot') < 1) return false;
    player.inventory.consumeItem('Iron Ingot', 1);
    startCraftProcess(player, { resultName: 'Iron Gear', resultCount: 2, duration: 2.4, label: 'Cutting Iron Gears...', sparkColor: 0xdfefff });
    return true;
}

function startCraftProcess(player, { resultName, resultCount, duration, label, sparkColor }) {
    player.craftState.active = true;
    player.craftState.timer = 0;
    player.craftState.duration = duration;
    player.craftState.resultName = resultName;
    player.craftState.resultCount = resultCount;

    const progressLabel = document.getElementById('fn-progress-label');
    const progressBar = document.getElementById('fn-progress-bg');
    const progressFill = document.getElementById('fn-progress-fill');
    if (progressLabel) progressLabel.innerText = label;
    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';

    player.updateFurnaceButtons();
    spawnCraftSparks(player, sparkColor);
}

function spawnCraftSparks(player, color) {
    const furnace = player.craftState.furnaceRef;
    if (!furnace) return;

    const count = 24;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        velocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.06, transparent: true, opacity: 1, sizeAttenuation: true });
    const points = new THREE.Points(geo, mat);
    points.position.copy(furnace.position).add(new THREE.Vector3(0, 0.55, 0.75));
    player.scene.add(points);

    player.craftState.sparks = { points, velocities, age: 0 };
}

export function tickCraftProcess(player, deltaTime) {
    const state = player.craftState;
    if (!state.active) return;

    state.timer += deltaTime;
    const progress = Math.min(1, state.timer / state.duration);

    const progressFill = document.getElementById('fn-progress-fill');
    if (progressFill) progressFill.style.width = `${progress * 100}%`;

    if (state.sparks) {
        state.sparks.age += deltaTime;
        const posAttr = state.sparks.points.geometry.attributes.position;
        for (let i = 0; i < state.sparks.velocities.length; i++) {
            const v = state.sparks.velocities[i];
            posAttr.array[i * 3] += v.x * deltaTime;
            posAttr.array[i * 3 + 1] += v.y * deltaTime;
            posAttr.array[i * 3 + 2] += v.z * deltaTime;
            v.y -= 2.0 * deltaTime;
        }
        posAttr.needsUpdate = true;
        state.sparks.points.material.opacity = Math.max(0, 1 - state.sparks.age / state.duration);
    }

    if (progress >= 1) {
        player.inventory.addItem(state.resultName, state.resultCount);
        if (state.sparks) {
            player.scene.remove(state.sparks.points);
            state.sparks.points.geometry.dispose();
            state.sparks.points.material.dispose();
            state.sparks = null;
        }
        state.active = false;
        const progressBar = document.getElementById('fn-progress-bg');
        if (progressBar) progressBar.style.display = 'none';
        player.updateFurnaceButtons();
    }
}

function swingCurve(progress) {
    if (progress < 0.3) { const p = progress / 0.3; return -p * 0.7; }
    if (progress < 0.5) { const p = (progress - 0.3) / 0.2; return -0.7 + p * 2.3; }
    if (progress < 0.65) return 1.6;
    const p = (progress - 0.65) / 0.35;
    return 1.6 * (1 - p);
}

export function applySwingPose(player, rArm, isFirstPerson) {
    if (player.punchTimer <= 0) return;
    const progress = 1 - (player.punchTimer / player.punchCooldown);
    const swingArc = swingCurve(progress);
    const tool = player.inventory.getActiveItem().name;

    const leanAmount = Math.max(0, swingArc) * 0.12;
    player.parts.spine.rotation.x = leanAmount;

    if (isFirstPerson) {
        if (tool === 'Stone Pickaxe') {
            rArm.shoulder.rotation.x += swingArc * 1.9;
            rArm.shoulder.rotation.z -= swingArc * 0.3;
            rArm.lowerArm.rotation.x += Math.max(0, swingArc) * 0.7;
        } else if (tool === 'Stone Axe') {
            rArm.shoulder.rotation.x += swingArc * 1.1;
            rArm.shoulder.rotation.y -= swingArc * 1.1;
            rArm.lowerArm.rotation.x += Math.max(0, swingArc) * 0.45;
        } else {
            rArm.shoulder.rotation.x += swingArc * 1.5;
            rArm.shoulder.rotation.y -= swingArc * 0.35;
            rArm.lowerArm.rotation.x += Math.max(0, swingArc) * 0.75;
            const lunge = Math.max(0, swingArc) * 0.22;
            rArm.shoulder.position.z -= lunge;
            rArm.shoulder.position.x += lunge * 0.4;
        }
    } else {
        if (tool === 'Stone Pickaxe') {
            rArm.shoulder.rotation.x = -1.6 + swingArc * -1.3;
            rArm.shoulder.rotation.z = swingArc * 0.3;
        } else if (tool === 'Stone Axe') {
            rArm.shoulder.rotation.x = -0.6 + swingArc * -0.85;
            rArm.shoulder.rotation.y = -1.2 + swingArc * -1.15;
        } else {
            rArm.shoulder.rotation.x = -1.2 + swingArc * -1.5;
            rArm.shoulder.rotation.z = swingArc * -0.4;
        }
    }
}