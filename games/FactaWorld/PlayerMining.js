import * as THREE from 'three';
import { createWorkbench } from './obj/Workbench.js';
import { createPickaxe } from './obj/Pickaxe.js';
import { createAxe } from './obj/Axe.js';
import { createStick } from './obj/sticks.js';
import { createFurnace } from './obj/furnace.js';
import { createIronOreItem, createIronIngot, createIronPlate, createIronGear } from './obj/iron.js';
import { createQuartzItem, createSiliconItem } from './obj/quartz.js';
import { createSandItem, createGlassItem } from './obj/sand.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor } from './obj/conveyor.js';
import { createSolarPanel } from './obj/solarpanel.js';
import { cleanupLinksForNode, detachDropsFromConveyor } from './linkSystem.js';
import { cleanupPowerLinksForNode } from './powerSystem.js';

const CONVEYOR_ITEM_VARIANTS = { 'Conveyor': 'straight', 'Conveyor Left': 'left', 'Conveyor Right': 'right' };
export function isConveyorItem(name) { return !!CONVEYOR_ITEM_VARIANTS[name]; }

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
    else if (isConveyorItem(itemName)) { mesh = createConveyor(CONVEYOR_ITEM_VARIANTS[itemName]); mesh.scale.set(0.3, 0.3, 0.3); }
    else if (itemName === 'Iron Ore') mesh = createIronOreItem();
    else if (itemName === 'Iron Ingot') mesh = createIronIngot();
    else if (itemName === 'Iron Plate') mesh = createIronPlate();
    else if (itemName === 'Iron Gear') mesh = createIronGear();
    else if (itemName === 'Quartz') mesh = createQuartzItem();
    else if (itemName === 'Silicon') mesh = createSiliconItem();
    else if (itemName === 'Sand') mesh = createSandItem();
    else if (itemName === 'Glass') mesh = createGlassItem();
    else if (itemName === 'Solar Panel') { mesh = createSolarPanel(); mesh.scale.set(0.35, 0.35, 0.35); }

    if (mesh) player.heldItemContainer.add(mesh);
}

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

export function mineOrHitTarget(player) {
    const activeItem = player.inventory.getActiveItem();
    if (!player.hoverTarget) return;
    let obj = player.hoverTarget;

    let damage = 1;
    if (activeItem.name === 'Stone Pickaxe' && (obj.userData.type === 'Stone' || obj.userData.type === 'Iron Ore' || obj.userData.type === 'Quartz')) damage = 3;
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
        if (obj.userData.isAutoMiner || obj.userData.isSolarPanel) cleanupPowerLinksForNode(player, obj);
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
    else if (name === 'Quartz') mesh = createQuartzItem();
    else if (name === 'Silicon') mesh = createSiliconItem();
    else if (name === 'Sand') mesh = createSandItem();
    else if (name === 'Glass') mesh = createGlassItem();
    else if (name === 'Solar Panel') { mesh = createSolarPanel(); mesh.scale.set(0.5, 0.5, 0.5); }
    else if (name === 'Workbench') mesh = createWorkbench();
    else if (name === 'Furnace') { mesh = createFurnace(); mesh.scale.set(0.5, 0.5, 0.5); }
    else if (name === 'Auto Miner') { mesh = createAutoMiner(); mesh.scale.set(0.5, 0.5, 0.5); }
    else if (isConveyorItem(name)) { mesh = createConveyor(CONVEYOR_ITEM_VARIANTS[name]); mesh.scale.set(0.5, 0.5, 0.5); }
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