import * as THREE from 'three';
import { PLACEABLE_ITEMS } from './placeables.js';
import { handleRightClick } from './PlayerPlacement.js';

export function initInputs(player) {
    const { domElement } = player;

    // Explicitly strip out the old secondary breaking mechanics to prevent duplicate execution
    player.handleSecondaryAction = null;

    // Consolidated unified pointer input system
    domElement.addEventListener('pointerdown', (e) => {
        if (document.pointerLockElement !== domElement) {
            domElement.requestPointerLock();
            return;
        }

        if (e.button === 0) {
            // Left Click: Handled strictly for primary mining, attacking, and structure placement
            if (player.handlePrimaryAction) {
                player.handlePrimaryAction();
            }
        } else if (e.button === 2) {
            // Right Click: Trapped and isolated exclusively for Power Grid cable linking
            e.preventDefault();
            e.stopPropagation();
            handleRightClick(player);
        }
    });

    // Hard-suppress standard browser context popups from breaking canvas focus
    domElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    // Station UI closer logic
    const closeQc = document.getElementById('close-qc');
    if (closeQc) closeQc.addEventListener('click', () => {
        player.quickMenu.classList.remove('show');
        domElement.requestPointerLock();
    });
    const closeWb = document.getElementById('close-wb');
    if (closeWb) closeWb.addEventListener('click', () => {
        player.workbenchMenu.classList.remove('show');
        domElement.requestPointerLock();
    });
    const closeFn = document.getElementById('close-fn');
    if (closeFn) closeFn.addEventListener('click', () => {
        player.furnaceMenu.classList.remove('show');
        domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (player.crosshair) player.crosshair.style.display = (document.pointerLockElement === domElement) ? 'block' : 'none';
        if (document.pointerLockElement === domElement) {
            if (player.quickMenu) player.quickMenu.classList.remove('show');
            if (player.workbenchMenu) player.workbenchMenu.classList.remove('show');
            if (player.furnaceMenu) player.furnaceMenu.classList.remove('show');
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === domElement) {
            const sensitivity = 0.002;
            player.yaw -= e.movementX * sensitivity;
            player.pitch -= e.movementY * sensitivity;
            const maxPitch = Math.PI / 2 - 0.01;
            player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch));
        }
    });

    document.addEventListener('wheel', (e) => {
        if (document.pointerLockElement !== domElement) return;
        const activeName = player.inventory.getActiveItem().name;
        if (!PLACEABLE_ITEMS.includes(activeName)) return;
        player.placeRotation += (e.deltaY > 0 ? -1 : 1) * (Math.PI / 12);
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'KeyW': player.keys.forward = true; break;
            case 'KeyS': player.keys.backward = true; break;
            case 'KeyA': player.keys.left = true; break;
            case 'KeyD': player.keys.right = true; break;
            case 'Space': player.keys.jump = true; break;
            case 'KeyC':
            case 'ControlLeft': player.keys.crouch = true; break;
            case 'ShiftLeft': player.keys.shift = true; break;

            case 'KeyV':
                player.viewMode = player.viewMode === 0 ? 1 : 0;
                break;

            case 'KeyR': {
                const activeName = player.inventory.getActiveItem().name;
                if (PLACEABLE_ITEMS.includes(activeName)) player.placeRotation += Math.PI / 4;
                break;
            }

            case 'KeyE':
                if (document.pointerLockElement === domElement) {
                    document.exitPointerLock();
                    if (player.updateCraftingButtons) player.updateCraftingButtons();
                    if (player.quickMenu) player.quickMenu.classList.add('show');
                } else if (player.quickMenu && player.quickMenu.classList.contains('show')) {
                    player.quickMenu.classList.remove('show');
                    domElement.requestPointerLock();
                }
                break;

            case 'KeyQ': {
                const droppedName = player.inventory.dropActiveItem();
                if (droppedName) {
                    const throwDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
                    player.spawnDrop(droppedName, player.camera.position.clone().add(throwDir), throwDir.clone().multiplyScalar(8).add(new THREE.Vector3(0, 4, 0)));
                }
                break;
            }

            case 'Digit1': case 'Digit2': case 'Digit3':
            case 'Digit4': case 'Digit5': case 'Digit6':
            case 'Digit7': case 'Digit8': case 'Digit9': {
                const slotIndex = parseInt(e.key, 10) - 1;
                if (player.inventory && player.inventory.setActiveSlot) player.inventory.setActiveSlot(slotIndex);
                break;
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': player.keys.forward = false; break;
            case 'KeyS': player.keys.backward = false; break;
            case 'KeyA': player.keys.left = false; break;
            case 'KeyD': player.keys.right = false; break;
            case 'Space': player.keys.jump = false; break;
            case 'KeyC':
            case 'ControlLeft': player.keys.crouch = false; break;
            case 'ShiftLeft': player.keys.shift = false; break;
        }
    });
}