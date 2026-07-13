import * as THREE from 'three';
import { createLinkConnector } from './linkVisuals.js';
import { PORT_MATCH_DISTANCE, PORT_MATCH_MIN_DOT, POWER_LINK_DISTANCE } from './placeables.js';

// ===== ITEM-FLOW LINKS (conveyor <-> conveyor, auto-miner output -> conveyor
// entry) — fully automatic. Placing a belt physically touching another belt's
// exit (or an Auto Miner's chute) connects them immediately.

const _srcP = new THREE.Vector3();
const _srcD = new THREE.Vector3();
const _tgtP = new THREE.Vector3();
const _tgtD = new THREE.Vector3();

function tryItemLink(source, target) {
    if (source.userData.getOutputPoint) source.userData.getOutputPoint(_srcP);
    else if (source.userData.getExitPoint) source.userData.getExitPoint(_srcP);
    else return false;

    if (source.userData.getOutputDirection) source.userData.getOutputDirection(_srcD);
    else if (source.userData.getExitDirection) source.userData.getExitDirection(_srcD);
    else return false;

    if (!target.userData.isConveyor) return false;
    target.userData.getEntryPoint(_tgtP);
    target.userData.getEntryDirection(_tgtD);

    if (_srcP.distanceTo(_tgtP) > PORT_MATCH_DISTANCE) return false;
    if (_srcD.dot(_tgtD) < PORT_MATCH_MIN_DOT) return false;
    return true; // _srcP/_tgtP hold the matched points after a true return
}

function completeItemLink(player, source, target) {
    const wouldCycle = player.activeLinks.some(l => !l.isPowerLink && l.source === target && l.target === source);
    if (wouldCycle) return false;

    removeItemLinkFrom(player, source);
    if (source.userData.setOutputConveyor) source.userData.setOutputConveyor(target);

    const connector = createLinkConnector(player.scene, 0x2ecc71, 0.55);
    connector.setEndpoints(_srcP.clone(), _tgtP.clone());
    connector.setVisible(true);

    player.activeLinks.push({ source, target, connector, isPowerLink: false });
    return true;
}

function removeItemLinkFrom(player, source) {
    for (let i = player.activeLinks.length - 1; i >= 0; i--) {
        const l = player.activeLinks[i];
        if (!l.isPowerLink && l.source === source) {
            l.connector.dispose();
            player.activeLinks.splice(i, 1);
        }
    }
}

// Checks every placed Auto Miner / Conveyor for a touching partner and links
// them. One generic pass, so dropping a belt between two already-standing
// unconnected pieces bridges both ends automatically.
export function rescanAllLinks(player) {
    for (const child of player.interactables.children) {
        const isSource = child.userData.isAutoMiner || child.userData.isConveyor;
        if (!isSource) continue;
        if (player.activeLinks.some(l => !l.isPowerLink && l.source === child)) continue;

        for (const other of player.interactables.children) {
            if (other === child) continue;
            if (tryItemLink(child, other)) {
                completeItemLink(player, child, other);
                break;
            }
        }
    }
}

// ===== POWER LINKS (Solar Panel <-> Auto Miner) — MANUAL ONLY, right-click
// one then the other. Auto Miners sit wherever their target resource happens
// to be (not grid-aligned), so automatic proximity linking here was too
// unpredictable. Distance-only match, no facing requirement.

function tryPowerLink(a, b) {
    let panel = null, miner = null;
    if (a.userData.isSolarPanel && b.userData.isAutoMiner) { panel = a; miner = b; }
    else if (b.userData.isSolarPanel && a.userData.isAutoMiner) { panel = b; miner = a; }
    else return null;

    if (!panel.userData.getPowerPort || !miner.userData.getPowerPort) return null;
    panel.userData.getPowerPort(_srcP, _srcD);
    miner.userData.getPowerPort(_tgtP, _tgtD);

    if (_srcP.distanceTo(_tgtP) > POWER_LINK_DISTANCE) return null;
    return { panel, miner }; // _srcP/_tgtP hold the matched points
}

// Works regardless of which node was right-clicked first — panel-then-miner
// or miner-then-panel both succeed, since both roles are checked internally.
export function completeManualPowerLink(player, nodeA, nodeB) {
    const pair = tryPowerLink(nodeA, nodeB);
    if (!pair) return false;

    const { panel, miner } = pair;
    const alreadyLinked = player.activeLinks.some(l => l.isPowerLink && l.source === panel && l.target === miner);
    if (alreadyLinked) return false;

    const connector = createLinkConnector(player.scene, 0xf1c40f, 0.65);
    connector.setEndpoints(_srcP.clone(), _tgtP.clone());
    connector.setVisible(true);

    player.activeLinks.push({ source: panel, target: miner, connector, isPowerLink: true });
    return true;
}

// ===== SHARED CLEANUP / VISUALS =====

export function cleanupLinksForNode(player, node) {
    for (let i = player.activeLinks.length - 1; i >= 0; i--) {
        const link = player.activeLinks[i];
        if (link.source === node || link.target === node) {
            if (!link.isPowerLink && link.source === node && node.userData.setOutputConveyor) {
                node.userData.setOutputConveyor(null);
            }
            link.connector.dispose();
            player.activeLinks.splice(i, 1);
        }
    }
}

export function detachDropsFromConveyor(player, conveyor) {
    if (!player.dropsGroup) return;
    for (const drop of player.dropsGroup.children) {
        if (drop.userData.onConveyor === conveyor) {
            drop.userData.onConveyor = null;
            drop.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2, (Math.random() - 0.5) * 1.2);
        }
    }
}

export function tickLinkVisuals(player, time) {
    for (const link of player.activeLinks) link.connector.tick(time);
    if (player.ghostLinkPreviewIn) player.ghostLinkPreviewIn.tick(time);
    if (player.ghostLinkPreviewOut) player.ghostLinkPreviewOut.tick(time);
}

// Placement-time preview of what a not-yet-placed Conveyor/Auto-Miner ghost
// would connect to (item-flow only — power links are manual). Reuses
// tryItemLink so it can never disagree with real placement.
export function updateGhostLinkPreview(player, ghostNode, isConveyorGhost) {
    let inShown = false, outShown = false;

    if (isConveyorGhost && ghostNode.userData.getEntryPoint) {
        for (const child of player.interactables.children) {
            const isSrc = child.userData.isAutoMiner || child.userData.isConveyor;
            if (!isSrc) continue;
            if (!tryItemLink(child, ghostNode)) continue;
            player.ghostLinkPreviewIn.setEndpoints(_srcP.clone(), _tgtP.clone());
            player.ghostLinkPreviewIn.setVisible(true);
            inShown = true;
            break;
        }
    }

    if (ghostNode.userData.getOutputPoint || ghostNode.userData.getExitPoint) {
        for (const child of player.interactables.children) {
            if (child === ghostNode || !child.userData.isConveyor) continue;
            if (!tryItemLink(ghostNode, child)) continue;
            player.ghostLinkPreviewOut.setEndpoints(_srcP.clone(), _tgtP.clone());
            player.ghostLinkPreviewOut.setVisible(true);
            outShown = true;
            break;
        }
    }

    if (!inShown && player.ghostLinkPreviewIn) player.ghostLinkPreviewIn.setVisible(false);
    if (!outShown && player.ghostLinkPreviewOut) player.ghostLinkPreviewOut.setVisible(false);
}