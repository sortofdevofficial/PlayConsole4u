import * as THREE from 'three';
import { createPickaxe } from './obj/Pickaxe.js';
import { createAxe } from './obj/Axe.js';
import { createStick } from './obj/sticks.js';
import { createWorkbench } from './obj/Workbench.js';
import { createFurnace } from './obj/furnace.js';
import { createIronOreItem, createIronIngot, createIronPlate, createIronGear } from './obj/iron.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor } from './obj/conveyor.js';

function createOakLogModel() {
    return new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.85, flatShading: true }));
}
function createStoneChunkModel() {
    return new THREE.Mesh(new THREE.DodecahedronGeometry(0.32), new THREE.MeshStandardMaterial({ color: 0x888c8d, roughness: 0.8, flatShading: true }));
}

// Every item name the game knows about maps to its own real model here — used for
// hotbar icons AND craft button previews, so a button always shows what it actually
// produces (a Stick button shows a stick, a Pickaxe button shows a pickaxe), not just
// a generic chunk of whatever raw material it costs.
function buildItemModel(name) {
    if (name === 'Stone Pickaxe') return createPickaxe();
    if (name === 'Stone Axe') return createAxe();
    if (name === 'Stick') return createStick();
    if (name === 'Oak') return createOakLogModel();
    if (name === 'Stone') return createStoneChunkModel();
    if (name === 'Workbench') { const m = createWorkbench(); m.scale.set(0.4, 0.4, 0.4); return m; }
    if (name === 'Furnace') { const m = createFurnace(); m.scale.set(0.28, 0.28, 0.28); return m; }
    if (name === 'Auto Miner') { const m = createAutoMiner(); m.scale.set(0.28, 0.28, 0.28); return m; }
    if (name === 'Conveyor') { const m = createConveyor(); m.scale.set(0.4, 0.4, 0.4); return m; }
    if (name === 'Iron Ore') return createIronOreItem();
    if (name === 'Iron Ingot') return createIronIngot();
    if (name === 'Iron Plate') return createIronPlate();
    if (name === 'Iron Gear') return createIronGear();
    return null;
}

// One shared offscreen renderer for EVERY snapshot in the game (hotbar icons AND craft
// button previews). Keeping this as a single reusable context — rather than one live
// WebGL context per slot/button — is what avoids "too many WebGL contexts" crashes.
let sharedRenderer = null;
let sharedScene = null;
let sharedCamera = null;

function getSharedRenderContext() {
    if (sharedRenderer) return { renderer: sharedRenderer, scene: sharedScene, camera: sharedCamera };

    sharedRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    sharedRenderer.setSize(96, 96);
    sharedRenderer.setPixelRatio(1);

    sharedScene = new THREE.Scene();
    sharedCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    sharedCamera.position.set(0, 0, 2.2);

    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(1, 2, 1);
    sharedScene.add(light);
    sharedScene.add(new THREE.AmbientLight(0xffffff, 0.7));

    return { renderer: sharedRenderer, scene: sharedScene, camera: sharedCamera };
}

function renderMeshToImage(mesh) {
    const { renderer, scene, camera } = getSharedRenderContext();

    while (scene.children.length > 2) scene.remove(scene.children[2]);

    mesh.rotation.x = 0.25;
    mesh.rotation.y = 0.6;
    scene.add(mesh);

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL();

    mesh.traverse(c => {
        if (c.isMesh) {
            c.geometry.dispose();
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
            else c.material.dispose();
        }
    });
    scene.remove(mesh);

    return dataUrl;
}

export class Inventory {
    constructor() {
        this.slots = Array(9).fill(null).map(() => ({ name: null, count: 0 }));
        this.activeSlot = 0;
        this.init3DSlots();
    }

    init3DSlots() {
        for (let i = 0; i < 9; i++) {
            const slotEl = document.getElementById(`slot-${i}`);
            if (!slotEl) continue;
            const img = document.createElement('img');
            img.className = 'slot-icon';
            slotEl.appendChild(img);
        }
    }

    addItem(name, count) {
        for (let slot of this.slots) {
            if (slot.name === name) { slot.count += count; this.updateUI(); return true; }
        }
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i].name === null) { this.slots[i] = { name, count }; this.updateUI(); return true; }
        }
        return false;
    }

    consumeItem(name, count) {
        for (let slot of this.slots) {
            if (slot.name === name) {
                slot.count -= count;
                if (slot.count <= 0) { slot.name = null; slot.count = 0; }
                this.updateUI();
                return true;
            }
        }
        return false;
    }

    getItemCount(name) {
        const slot = this.slots.find(s => s.name === name);
        return slot ? slot.count : 0;
    }

    getCount(name) { return this.getItemCount(name); }

    getActiveItem() {
        return this.slots[this.activeSlot] && this.slots[this.activeSlot].name
            ? this.slots[this.activeSlot]
            : { name: null, count: 0 };
    }

    setActiveSlot(index) {
        if (index >= 0 && index < 9) {
            document.getElementById(`slot-${this.activeSlot}`).classList.remove('active');
            this.activeSlot = index;
            document.getElementById(`slot-${this.activeSlot}`).classList.add('active');
            this.updateUI();
        }
    }

    dropActiveItem() {
        const slot = this.slots[this.activeSlot];
        if (slot && slot.name) {
            const name = slot.name;
            slot.count--;
            if (slot.count <= 0) { slot.name = null; slot.count = 0; }
            this.updateUI();
            return name;
        }
        return null;
    }

    updateUI() {
        for (let i = 0; i < 9; i++) {
            const slot = this.slots[i];
            const countEl = document.getElementById(`count-${i}`);
            if (countEl) countEl.innerText = slot.count > 1 ? slot.count : '';

            const slotEl = document.getElementById(`slot-${i}`);
            if (!slotEl) continue;
            const img = slotEl.querySelector('.slot-icon');
            if (!img) continue;

            if (!slot.name) {
                img.style.display = 'none';
                img.dataset.item = '';
                continue;
            }

            if (img.dataset.item !== slot.name) {
                img.dataset.item = slot.name;
                const mesh = buildItemModel(slot.name);
                if (mesh) {
                    img.src = renderMeshToImage(mesh);
                    img.style.display = 'block';
                } else {
                    img.style.display = 'none';
                }
            }
        }

        const activeTitle = document.getElementById('active-item-title');
        if (activeTitle) {
            const item = this.getActiveItem();
            activeTitle.innerText = item.name ? item.name : '';
        }
    }

    render3DSlots() {} // no-op, kept for backward compatibility with main.js's animate loop
}

// Injects a static 3D-rendered preview of the ACTUAL CRAFTED ITEM into a crafting button —
// e.g. the Stick button shows a stick, the Pickaxe button shows a pickaxe, not the raw
// material it costs. Pass the output item's name (same names used everywhere else in
// the inventory system), not a material name.
export function initCraftPreviews(buttonConfigs) {
    buttonConfigs.forEach(({ buttonId, itemName }) => {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        const mesh = buildItemModel(itemName);
        if (!mesh) return;

        const dataUrl = renderMeshToImage(mesh);
        const img = document.createElement('img');
        img.className = 'craft-preview';
        img.src = dataUrl;
        btn.prepend(img);
    });
}