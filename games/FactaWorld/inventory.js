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
        // STRICTLY EMPTY: Player gets absolutely NO items at start.
        this.slots = Array(9).fill(null).map(() => ({ name: null, count: 0 }));
        this.activeSlot = 0;
        
        // Setup internal properties for Firebase Sync
        this.uid = null;
        this.saveTimer = null;

        this.init3DSlots();

        // Listen for Auth and LOAD the inventory automatically
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

    // --- FIREBASE SYNC: LOAD ---
    async load() {
        if (!this.uid) return;
        try {
            // Target path: users/{uid}/G/FW
            const docRef = firebase.firestore().doc(`users/${this.uid}/G/FW`);
            const snap = await docRef.get();
            
            if (snap.exists) {
                const data = snap.data();
                
                // Decode shortform inventory ("i" array)
                if (data.i && Array.isArray(data.i)) {
                    this.slots = data.i.map(s => {
                        // If it's a shortform tuple like ["Oak", 5]
                        if (Array.isArray(s) && s.length === 2) {
                            return { name: s[0], count: s[1] };
                        }
                        // Otherwise it's empty (0)
                        return { name: null, count: 0 };
                    });
                    
                    // Pad array to ensure exactly 9 slots exist
                    while (this.slots.length < 9) {
                        this.slots.push({ name: null, count: 0 });
                    }
                }
                
                // Load active slot shortform ("a")
                if (data.a !== undefined) {
                    this.activeSlot = data.a;
                }
                
                // Force UI to display the newly loaded inventory
                this.updateUI(); 
            }
        } catch (e) {
            console.error("Firebase Inventory Load Error:", e);
        }
    }

    // --- FIREBASE SYNC: SAVE (Debounced + Merge + Shortforms) ---
    save() {
        if (!this.uid) return;
        
        // Wait 1.5s after the last inventory change so we don't spam the database
        if (this.saveTimer) clearTimeout(this.saveTimer);
        
        this.saveTimer = setTimeout(async () => {
            try {
                // Create highly compressed shortform array: ["Oak", 5] or 0 for empty slots
                const shortSlots = this.slots.map(s => s.name ? [s.name, s.count] : 0);

                // Merge exactly into users/{uid}/G/FW so we don't overwrite builds/wires
                const docRef = firebase.firestore().doc(`users/${this.uid}/G/FW`);
                await docRef.set({
                    i: shortSlots,
                    a: this.activeSlot
                }, { merge: true });
                
            } catch (e) {
                console.error("Firebase Inventory Save Error:", e);
            }
        }, 1500); 
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
                this.save(); // Trigger Firebase Sync
                return true; 
            }
        }
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i].name === null) { 
                this.slots[i] = { name, count }; 
                this.updateUI(); 
                this.save(); // Trigger Firebase Sync
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
                this.save(); // Trigger Firebase Sync
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
            this.save(); // Trigger Firebase Sync
        }
    }

    dropActiveItem() {
        const slot = this.slots[this.activeSlot];
        if (slot && slot.name) {
            const name = slot.name;
            slot.count--;
            if (slot.count <= 0) { slot.name = null; slot.count = 0; }
            this.updateUI();
            this.save(); // Trigger Firebase Sync
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