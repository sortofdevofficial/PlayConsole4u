import { createWorkbench } from './obj/Workbench.js';
import { createFurnace } from './obj/furnace.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor } from './obj/conveyor.js';
import { createSolarPanel } from './obj/solarpanel.js';
import { rescanAllLinks, completeManualPowerLink } from './linkSystem.js';

// Firestore doc: users/{uid}/G/FW  ->  { i, a, b, l }
//   i, a  -- inventory slots + active slot (owned by inventory.js)
//   b     -- builds: [ [typeCode, x, y, z, ry, extra?], ... ]
//   l     -- power links ONLY: [ [sourceBuildIndex, targetBuildIndex], ... ]
//             (item/conveyor links are physical and get re-derived
//             automatically via rescanAllLinks() after loading — no point
//             saving them, they're purely a function of position)

const TYPE_CODE = {
    'Workbench': 'WB', 'Furnace': 'FN', 'Auto Miner': 'AM',
    'Conveyor': 'CV', 'Conveyor Left': 'CL', 'Conveyor Right': 'CR',
    'Solar Panel': 'SP'
};
const CODE_TYPE = Object.fromEntries(Object.entries(TYPE_CODE).map(([k, v]) => [v, k]));

function placeableUserData(type) {
    if (type === 'Furnace') return { isInteractable: true, isStation: true, isFurnace: true, type: 'Furnace', health: 8, maxHealth: 8, dropName: 'Furnace' };
    if (type === 'Workbench') return { isInteractable: true, isStation: true, type: 'Workbench', health: 6, maxHealth: 6, dropName: 'Workbench' };
    return null; // Solar Panel / Auto Miner / Conveyors keep their real factory userData -- never overwritten
}

function buildFromType(type) {
    if (type === 'Workbench') return createWorkbench();
    if (type === 'Furnace') return createFurnace();
    if (type === 'Auto Miner') return createAutoMiner();
    if (type === 'Conveyor') return createConveyor('straight');
    if (type === 'Conveyor Left') return createConveyor('left');
    if (type === 'Conveyor Right') return createConveyor('right');
    if (type === 'Solar Panel') return createSolarPanel();
    return null;
}

function round2(n) { return Math.round(n * 100) / 100; }

export function serializeBuildings(player) {
    const builds = [];
    const indexOf = new Map();

    for (const child of player.interactables.children) {
        const code = TYPE_CODE[child.userData.type];
        if (!code) continue; // natural resources (Stone/Oak/Iron/Quartz/Sand) are world-generated, never saved as builds

        const rec = [code, round2(child.position.x), round2(child.position.y), round2(child.position.z), round2(child.rotation.y)];
        if (child.userData.isAutoMiner && child.userData.targetSpawnIndex !== undefined) rec.push(child.userData.targetSpawnIndex);

        indexOf.set(child, builds.length);
        builds.push(rec);
    }

    const links = [];
    for (const link of player.activeLinks || []) {
        if (!link.isPowerLink) continue;
        const si = indexOf.get(link.source), ti = indexOf.get(link.target);
        if (si !== undefined && ti !== undefined) links.push([si, ti]);
    }

    return { b: builds, l: links };
}

export function deserializeBuildings(player, data) {
    if (!data || !Array.isArray(data.b)) return;

    const placedNodes = [];
    for (const rec of data.b) {
        const [code, x, y, z, ry, extra] = rec;
        const type = CODE_TYPE[code];
        const built = type ? buildFromType(type) : null;
        if (!built) { placedNodes.push(null); continue; }

        built.position.set(x, y, z);
        built.rotation.y = ry || 0;

        const override = placeableUserData(type);
        if (override) built.userData = override;
        else built.userData.isInteractable = true;

        if (type === 'Auto Miner') {
            built.userData.targetSpawnIndex = extra;
            if (built.userData.bindContext) built.userData.bindContext(player.interactables, player.dropsGroup);
        }

        player.interactables.add(built);
        placedNodes.push(built);
    }

    // Item/conveyor links are purely physical (touching + facing), so
    // re-derive them fresh now that everything is placed rather than trusting
    // any saved link data for them.
    rescanAllLinks(player);

    // Power links are manual, so replay them explicitly from saved data.
    if (Array.isArray(data.l)) {
        for (const [si, ti] of data.l) {
            const source = placedNodes[si], target = placedNodes[ti];
            if (source && target) completeManualPowerLink(player, source, target);
        }
    }
}

export async function saveBuildingsNow(player) {
    if (!player.uid) return;
    try {
        const { b, l } = serializeBuildings(player);
        await firebase.firestore().doc(`users/${player.uid}/G/FW`).set({ b, l }, { merge: true });
    } catch (e) {
        console.error('[Buildings] save failed:', e.message);
    }
}

export async function loadBuildingsOnce(player) {
    if (!player.uid) return;
    try {
        const snap = await firebase.firestore().doc(`users/${player.uid}/G/FW`).get();
        if (snap.exists) deserializeBuildings(player, snap.data());
    } catch (e) {
        console.error('[Buildings] load failed:', e.message);
    }
}

let _saveTimer = null;
// Short-debounce trigger used right after a placement or destruction event.
// Silently no-ops if not yet authenticated — the periodic safety-net autosave
// in main.js (every few seconds) picks up anything from that window once
// auth resolves, so nothing is permanently lost.
export function scheduleBuildingSave(player, delayMs = 800) {
    if (!player.uid) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => saveBuildingsNow(player), delayMs);
}