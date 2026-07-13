import * as THREE from 'three';
import { createPickaxe } from './obj/pickaxe.js';
import { createAxe } from './obj/axe.js';
import { createStick } from './obj/sticks.js';
import { createWorkbench } from './obj/Workbench.js';
import { createFurnace } from './obj/furnace.js';
import { createIronOreItem, createIronIngot, createIronPlate, createIronGear } from './obj/iron.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor } from './obj/conveyor.js';
import { createQuartzItem, createSiliconItem } from './obj/quartz.js';
import { createSandItem, createGlassItem } from './obj/sand.js';
import { createSolarPanel } from './obj/solarpanel.js';
import { nameToId, idToName } from './itemIds.js';

function createOakLogModel() {
    return new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 6), new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.85, flatShading: true }));
}
function createStoneChunkModel() {
    return new THREE.Mesh(new THREE.DodecahedronGeometry(0.32), new THREE.MeshStandardMaterial({ color: 0x888c8d, roughness: 0.8, flatShading: true }));
}

function buildItemModel(name) {
    if (name === 'Stone Pickaxe') return createPickaxe();
    if (name === 'Stone Axe') return createAxe();
    if (name === 'Stick') return createStick();
    if (name === 'Oak') return createOakLogModel();
    if (name === 'Stone') return createStoneChunkModel();
    if (name === 'Workbench') { const m = createWorkbench(); m.scale.set(0.4, 0.4, 0.4); return m; }
    if (name === 'Furnace') { const m = createFurnace(); m.scale.set(0.28, 0.28, 0.28); return m; }
    if (name === 'Auto Miner') { const m = createAutoMiner(); m.scale.set(0.28, 0.28, 0.28); return m; }
    if (name === 'Conveyor') { const m = createConveyor('straight'); m.scale.set(0.4, 0.4, 0.4); return m; }
    if (name === 'Conveyor Left') { const m = createConveyor('left'); m.scale.set(0.35, 0.35, 0.35); return m; }
    if (name === 'Conveyor Right') { const m = createConveyor('right'); m.scale.set(0.35, 0.35, 0.35); return m; }
    if (name === 'Iron Ore') return createIronOreItem();
    if (name === 'Iron Ingot') return createIronIngot();
    if (name === 'Iron Plate') return createIronPlate();
    if (name === 'Iron Gear') return createIronGear();
    if (name === 'Quartz') return createQuartzItem();
    if (name === 'Silicon') return createSiliconItem();
    if (name === 'Sand') return createSandItem();
    if (name === 'Glass') return createGlassItem();
    if (name === 'Solar Panel') { const m = createSolarPanel(); m.scale.set(0.3, 0.3, 0.3); return m; }
    return null;
}

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
        // Genuinely empty at first load -- no starter items.
        this.slots = Array(9).fill(null).map(() => ({ name: null, count: 0 }));
        this.activeSlot = 0;

        this.uid = null;
        this.saveTimer = null;

        this.init3DSlots();

        if (typeof firebase !== 'undefined') {
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    this.uid = user.uid;
                    this.load();
                } else {
                    this.uid = null;
                }
            });
        }
    }

    async load() {
        if (!this.uid) return;
        try {
            const docRef = firebase.firestore().doc(`users/${this.uid}/G/FW`);
            const snap = await docRef.get();

            if (snap.exists) {
                const data = snap.data();

                // "i" is now a flat { "<itemId>": count } map, e.g. {"1": 9}
                // meaning 9x Oak (id 1). Each key becomes one hotbar slot, in
                // whatever order Object.entries returns them (insertion order
                // for string-numeric keys in a plain object, which is stable
                // enough here since slot ORDER isn't meaningfully game-facing
                // -- only which item is in the currently active slot matters,
                // and that's restored separately via "a").
                if (data.i && typeof data.i === 'object') {
                    const restored = [];
                    for (const [idStr, count] of Object.entries(data.i)) {
                        const name = idToName(Number(idStr));
                        if (name && count > 0) restored.push({ name, count });
                    }
                    while (restored.length < 9) restored.push({ name: null, count: 0 });
                    this.slots = restored.slice(0, 9);
                }

                if (data.a !== undefined) this.activeSlot = Math.min(data.a, this.slots.length - 1);

                this.updateUI();
            }
        } catch (e) {
            console.error("Firebase Inventory Load Error:", e);
        }
    }

    // Debounced save -- fires 500ms after the last change.
    save() {
        if (!this.uid) return;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this._flush(), 500);
    }

    // Immediate, bypasses the debounce -- used on page unload.
    saveNow() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this._flush();
    }

    async _flush() {
        if (!this.uid) return;
        try {
            // Build the compact { "<itemId>": count } map. Items with no
            // registered ID (shouldn't happen for anything craftable/minable,
            // but guards against a future item added to the game without
            // being added to itemIds.js) are simply skipped rather than
            // corrupting the save.
            const idMap = {};
            for (const slot of this.slots) {
                if (!slot.name) continue;
                const id = nameToId(slot.name);
                if (id === undefined) continue;
                idMap[id] = slot.count;
            }

            const docRef = firebase.firestore().doc(`users/${this.uid}/G/FW`);
            await docRef.set({ i: idMap, a: this.activeSlot }, { merge: true });
        } catch (e) {
            console.error("Firebase Inventory Save Error:", e);
        }
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
            if (slot.name === name) {
                slot.count += count;
                this.updateUI();
                this.save();
                return true;
            }
        }
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i].name === null) {
                this.slots[i] = { name, count };
                this.updateUI();
                this.save();
                return true;
            }
        }
        return false;
    }

    consumeItem(name, count) {
        for (let slot of this.slots) {
            if (slot.name === name) {
                slot.count -= count;
                if (slot.count <= 0) { slot.name = null; slot.count = 0; }
                this.updateUI();
                this.save();
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
            this.save();
        }
    }

    dropActiveItem() {
        const slot = this.slots[this.activeSlot];
        if (slot && slot.name) {
            const name = slot.name;
            slot.count--;
            if (slot.count <= 0) { slot.name = null; slot.count = 0; }
            this.updateUI();
            this.save();
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

    render3DSlots() {}
}

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