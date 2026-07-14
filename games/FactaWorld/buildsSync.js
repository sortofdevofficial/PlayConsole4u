import { createWorkbench } from './obj/Workbench.js';
import { createFurnace } from './obj/furnace.js';
import { createAutoMiner } from './obj/autominer.js';
import { createConveyor } from './obj/conveyor.js';
import { createSolarPanel } from './obj/solarpanel.js';
import { rescanAllLinks } from './linkSystem.js';
import { buildTypeToId, buildIdToType } from './itemIds.js';

const CONVEYOR_VARIANT = { 'Conveyor': 'straight', 'Conveyor Left': 'left', 'Conveyor Right': 'right' };

// One Firestore document PER PLACED BUILD, at users/{uid}/G/FW/builds/{docId}.
// This is the scalable shape: placing writes exactly ONE small doc, removing
// deletes exactly ONE small doc. Nothing else is ever read, re-written, or
// re-transmitted -- 1000 builds per player, or 1,000,000 players, doesn't
// change the cost of any single placement/removal, since each is still just
// one tiny independent write. Compare to storing an array on one big doc:
// every single change would have to rewrite the WHOLE array, getting slower
// and riskier (one failed write corrupts everything) as it grows -- and a
// document has a hard 1MiB cap that a big enough factory would eventually hit.
//
// Doc shape (kept minimal -- every byte here is repeated per build, times
// however many exist across every player, so this is worth being terse):
//   t  -- build type ID (see itemIds.js)
//   x,y,z,r  -- position + Y rotation, rounded to 2 decimals
//   s  -- (Auto Miner only) target resource spawnIndex

function docRef(uid, buildId) {
    return firebase.firestore().doc(`users/${uid}/G/FW/builds/${buildId}`);
}
function collRef(uid) {
    return firebase.firestore().collection(`users/${uid}/G/FW/builds`);
}

function buildFromType(type) {
    if (type === 'Workbench') return createWorkbench();
    if (type === 'Furnace') return createFurnace();
    if (type === 'Auto Miner') return createAutoMiner();
    if (type === 'Solar Panel') return createSolarPanel();
    const variant = CONVEYOR_VARIANT[type];
    if (variant) return createConveyor(variant);
    return null;
}

function placeableUserData(type) {
    if (type === 'Furnace') return { isInteractable: true, isStation: true, isFurnace: true, type: 'Furnace', health: 8, maxHealth: 8, dropName: 'Furnace' };
    if (type === 'Workbench') return { isInteractable: true, isStation: true, type: 'Workbench', health: 6, maxHealth: 6, dropName: 'Workbench' };
    return null; // Solar Panel / Auto Miner / Conveyors keep their real factory userData -- never overwritten
}

function round2(n) { return Math.round(n * 100) / 100; }

// Writes exactly one small document for this single build. Called right
// after placement -- never touches any other build's document.
export async function saveOneBuild(player, node) {
    if (!player.uid) return;
    const typeId = buildTypeToId(node.userData.type);
    if (typeId === undefined) return;

    const data = {
        t: typeId,
        x: round2(node.position.x), y: round2(node.position.y), z: round2(node.position.z),
        r: round2(node.rotation.y)
    };
    if (node.userData.isAutoMiner && node.userData.targetSpawnIndex !== undefined) {
        data.s = node.userData.targetSpawnIndex;
    }

    const id = node.userData.buildDocId || collRef(player.uid).doc().id;
    node.userData.buildDocId = id;

    try {
        await docRef(player.uid, id).set(data);
    } catch (e) {
        console.error('[Builds] save failed:', e.message);
    }
}

// Deletes exactly one document -- the build that was just destroyed. This is
// what keeps storage bounded: destroyed builds don't linger as dead entries
// in some ever-growing array, they're actually gone from the database the
// moment they're gone from the game.
export async function deleteOneBuild(player, node) {
    if (!player.uid || !node.userData.buildDocId) return;
    try {
        await docRef(player.uid, node.userData.buildDocId).delete();
    } catch (e) {
        console.error('[Builds] delete failed:', e.message);
    }
}

// Loads every build doc for this player (one query, one round trip) and
// reconstructs them all client-side. Only ever called once, right after
// auth resolves.
export async function loadAllBuilds(player) {
    if (!player.uid) return;
    try {
        const snap = await collRef(player.uid).get();
        const placed = [];

        snap.forEach(doc => {
            const data = doc.data();
            const type = buildIdToType(data.t);
            const built = type ? buildFromType(type) : null;
            if (!built) return;

            built.position.set(data.x, data.y, data.z);
            built.rotation.y = data.r || 0;
            built.userData.buildDocId = doc.id;

            const override = placeableUserData(type);
            if (override) built.userData = { ...override, buildDocId: doc.id };
            else built.userData.isInteractable = true;

            if (type === 'Auto Miner') {
                built.userData.targetSpawnIndex = data.s;
                if (built.userData.bindContext) built.userData.bindContext(player.interactables, player.dropsGroup);
            }

            player.interactables.add(built);
            placed.push(built);
        });

        // Item/conveyor links are purely physical (touching + facing), so
        // re-derive them fresh once everything is placed. Power links are
        // manual (right-click to wire) and intentionally NOT restored --
        // re-wiring on return is fast and avoids saving a second dataset.
        if (placed.length > 0) rescanAllLinks(player);
    } catch (e) {
        console.error('[Builds] load failed:', e.message);
    }
}