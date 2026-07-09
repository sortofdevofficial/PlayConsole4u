import * as THREE from 'three';
import { PLACEABLE_ITEMS } from './placeables.js';

export function initInputs(player) {
    const { domElement } = player;

    document.getElementById('close-qc').addEventListener('click', () => {
        player.quickMenu.classList.remove('show');
        domElement.requestPointerLock();
    });
    document.getElementById('close-wb').addEventListener('click', () => {
        player.workbenchMenu.classList.remove('show');
        domElement.requestPointerLock();
    });
    document.getElementById('close-fn').addEventListener('click', () => {
        player.furnaceMenu.classList.remove('show');
        domElement.requestPointerLock();
    });

    domElement.addEventListener('mousedown', (e) => {
        const isMenuOpen = player.workbenchMenu.classList.contains('show') || player.quickMenu.classList.contains('show') || player.furnaceMenu.classList.contains('show');
        if (document.pointerLockElement !== domElement && !isMenuOpen) {
            domElement.requestPointerLock();
        } else if (document.pointerLockElement === domElement) {
            if (e.button === 0) player.handlePrimaryAction();
            if (e.button === 2) player.handleSecondaryAction();
        }
    });

    domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    domElement.addEventListener('wheel', (e) => {
        const activeName = player.inventory.getActiveItem().name;
        if (PLACEABLE_ITEMS.includes(activeName)) {
            player.placeRotation += (e.deltaY > 0 ? 1 : -1) * (Math.PI / 12);
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
        player.crosshair.style.display = (document.pointerLockElement === domElement) ? 'block' : 'none';
        if (document.pointerLockElement === domElement) {
            player.quickMenu.classList.remove('show');
            player.workbenchMenu.classList.remove('show');
            player.furnaceMenu.classList.remove('show');
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === domElement) {
            player.yaw -= e.movementX * 0.0022;
            player.pitch -= e.movementY * 0.0022;
            player.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, player.pitch));
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9') player.inventory.setActiveSlot(parseInt(e.key) - 1);
        if (e.code === 'KeyW') player.keys.forward = true;
        if (e.code === 'KeyS') player.keys.backward = true;
        if (e.code === 'KeyA') player.keys.left = true;
        if (e.code === 'KeyD') player.keys.right = true;
        if (e.code === 'Space') player.keys.jump = true;
        if (e.code === 'KeyC' || e.code === 'ControlLeft') player.keys.crouch = true;
        if (e.code === 'KeyV') player.viewMode = player.viewMode === 0 ? 1 : 0;

        const activeName = player.inventory.getActiveItem().name;
        if (e.code === 'KeyR' && PLACEABLE_ITEMS.includes(activeName)) {
            player.placeRotation += Math.PI / 4;
        }

        if (e.code === 'KeyE') {
            if (document.pointerLockElement === domElement) {
                document.exitPointerLock();
                player.updateCraftingButtons();
                player.quickMenu.classList.add('show');
            } else {
                player.quickMenu.classList.remove('show');
                player.workbenchMenu.classList.remove('show');
                player.furnaceMenu.classList.remove('show');
                domElement.requestPointerLock();
            }
        }

        if (e.code === 'KeyQ') {
            const droppedName = player.inventory.dropActiveItem();
            if (droppedName) {
                const throwDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
                player.spawnDrop(droppedName, player.camera.position.clone().add(throwDir), throwDir.multiplyScalar(8).add(new THREE.Vector3(0, 4, 0)));
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') player.keys.forward = false;
        if (e.code === 'KeyS') player.keys.backward = false;
        if (e.code === 'KeyA') player.keys.left = false;
        if (e.code === 'KeyD') player.keys.right = false;
        if (e.code === 'Space') player.keys.jump = false;
        if (e.code === 'KeyC' || e.code === 'ControlLeft') player.keys.crouch = false;
    });
}