import * as THREE from 'three';
import { createLinkConnector } from './linkVisuals.js';
import { PORT_MATCH_DISTANCE, PORT_MATCH_MIN_DOT } from './placeables.js';

// ===== PORT-BASED CONNECTION SYSTEM =====
// Every machine exposes "ports": a world-space point + facing direction for
// where items enter/exit. A link exists ONLY when a source's output port and
// a target's input port are essentially the same point in space, facing the
// same way — i.e. physically touching, not just nearby. This one idea is what
// makes the whole system predictable: no ambiguity about which of several
// "somewhat close" candidates gets picked, because only true adjacency ever
// qualifies at all.

const _srcP = new THREE.Vector3();
const _srcD = new THREE.Vector3();
const _tgtP = new THREE.Vector3();
const _tgtD = new THREE.Vector3();

function getOutputPort(node, outP, outD) {
    if (node.userData.getOutputPoint) node.userData.getOutputPoint(outP);
    else if (node.userData.getExitPoint) node.userData.getExitPoint(outP);
    else return false;

    if (node.userData.getOutputDirection) node.userData.getOutputDirection(outD);
    else if (node.userData.getExitDirection) node.userData.getExitDirection(outD);
    else return false;

    return true;
}

function getInputPort(node, outP, outD) {
    if (!node.userData.isConveyor) return false; // only belts have an entry to feed into
    node.userData.getEntryPoint(outP);
    node.userData.getEntryDirection(outD);
    return true;
}

function portsMatch(srcP, srcD, tgtP, tgtD) {
    if (srcP.distanceTo(tgtP) > PORT_MATCH_DISTANCE) return false;
    if (srcD.dot(tgtD) < PORT_MATCH_MIN_DOT) return false;
    return true;
}

// Is there a real, placed Conveyor whose ENTRY port is touching this source's
// OUTPUT port and facing into it? Returns that conveyor, or null. This is the
// literal "what's actually in front of it" check.
export function findTouchingTarget(player, sourceNode) {
    if (!getOutputPort(sourceNode, _srcP, _srcD)) return null;

    for (const child of player.interactables.children) {
        if (child === sourceNode || !child.userData.isConveyor) continue;
        if (!getInputPort(child, _tgtP, _tgtD)) continue;
        if (portsMatch(_srcP, _srcD, _tgtP, _tgtD)) return child;
    }
    return null;
}

// Is there a real, placed machine whose OUTPUT port is touching this target's
// ENTRY port and facing into it, and which isn't already feeding somewhere
// else? Returns that machine, or null.
export function findTouchingSource(player, targetNode) {
    if (!getInputPort(targetNode, _tgtP, _tgtD)) return null;

    for (const child of player.interactables.children) {
        if (child === targetNode) continue;
        const isPotentialSource = child.userData.isAutoMiner || child.userData.isConveyor;
        if (!isPotentialSource) continue;
        if (player.activeLinks.some(l => l.source === child)) continue; // never steal an existing output
        if (!getOutputPort(child, _srcP, _srcD)) continue;
        if (portsMatch(_srcP, _srcD, _tgtP, _tgtD)) return child;
    }
    return null;
}

function completeLink(player, source, target) {
    if (!getOutputPort(source, _srcP, _srcD)) return false;
    if (!getInputPort(target, _tgtP, _tgtD)) return false;
    if (!portsMatch(_srcP, _srcD, _tgtP, _tgtD)) return false; // authoritative final check

    const wouldCycle = player.activeLinks.some(l => l.source === target && l.target === source);
    if (wouldCycle) return false;

    removeLinkFrom(player, source);
    source.userData.setOutputConveyor(target);

    const connector = createLinkConnector(player.scene, 0x2ecc71, 0.55);
    connector.setEndpoints(_srcP.clone(), _tgtP.clone());
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

// Full network rescan: checks EVERY placed Auto Miner / Conveyor for a
// touching partner and forms links accordingly. Called after any placement —
// this is what lets placing a belt BETWEEN two existing unconnected pieces
// automatically bridge them, and is what makes the whole network self-
// consistent without special-cased "auto miner placement" vs "conveyor
// placement" logic — it's one generic check applied everywhere.
export function rescanAllLinks(player) {
    for (const child of player.interactables.children) {
        const isSource = child.userData.isAutoMiner || child.userData.isConveyor;
        if (!isSource) continue;
        if (player.activeLinks.some(l => l.source === child)) continue;

        const target = findTouchingTarget(player, child);
        if (target) completeLink(player, child, target);
    }
}

export function cleanupLinksForNode(player, node) {
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

export function detachDropsFromConveyor(player, conveyor) {
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
    if (player.ghostLinkPreviewIn) player.ghostLinkPreviewIn.tick(time);
    if (player.ghostLinkPreviewOut) player.ghostLinkPreviewOut.tick(time);
}

// Live preview, BEFORE placement, of what the ghost would actually connect to
// if placed right now — reuses the EXACT same port-matching functions as real
// placement, so preview and outcome can never disagree. Shows an "in" line
// (something feeding into the ghost) and an "out" line (the ghost feeding
// something ahead) simultaneously, so placing a bridge piece between two
// existing machines shows BOTH connections forming before you commit.
export function updateGhostLinkPreview(player, ghostNode, isConveyor) {
    let inShown = false, outShown = false;

    if (isConveyor) {
        const feeder = findTouchingSource(player, ghostNode);
        if (feeder && getOutputPort(feeder, _srcP, _srcD) && getInputPort(ghostNode, _tgtP, _tgtD)) {
            player.ghostLinkPreviewIn.setEndpoints(_srcP, _tgtP);
            player.ghostLinkPreviewIn.setVisible(true);
            inShown = true;
        }
    }

    const target = findTouchingTarget(player, ghostNode);
    if (target && getOutputPort(ghostNode, _srcP, _srcD) && getInputPort(target, _tgtP, _tgtD)) {
        player.ghostLinkPreviewOut.setEndpoints(_srcP, _tgtP);
        player.ghostLinkPreviewOut.setVisible(true);
        outShown = true;
    }

    if (!inShown && player.ghostLinkPreviewIn) player.ghostLinkPreviewIn.setVisible(false);
    if (!outShown && player.ghostLinkPreviewOut) player.ghostLinkPreviewOut.setVisible(false);
}