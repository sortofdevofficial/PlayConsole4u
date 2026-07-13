import * as THREE from 'three';
import { createLinkConnector } from './linkVisuals_2.js';
import { PORT_MATCH_DISTANCE, PORT_MATCH_MIN_DOT } from './placeables.js';

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

function getInputPort(node, outP, outD, sourceNode) {
    const isPowerSource = sourceNode && (sourceNode.userData.isSolarPanel || sourceNode.userData.type === 'Solar Panel');
    if (isPowerSource) {
        if (node.userData.getPowerPort) {
            node.userData.getPowerPort(outP, outD);
            return true;
        }
        return false;
    }

    if (!node.userData.isConveyor) return false;
    node.userData.getEntryPoint(outP);
    node.userData.getEntryDirection(outD);
    return true;
}

function portsMatch(srcP, srcD, tgtP, tgtD) {
    const allowedDistance = 0.85; 
    const effectiveDot = 0.20; 
    
    if (srcP.distanceTo(tgtP) > allowedDistance) return false;
    if (srcD.dot(tgtD) < effectiveDot) return false;
    return true;
}

export function findTouchingTargets(player, sourceNode) {
    const validTargets = [];
    if (!getOutputPort(sourceNode, _srcP, _srcD)) return validTargets;

    for (const child of player.interactables.children) {
        if (child === sourceNode) continue;
        if (!getInputPort(child, _tgtP, _tgtD, sourceNode)) continue;
        if (portsMatch(_srcP, _srcD, _tgtP, _tgtD)) {
            validTargets.push(child);
        }
    }
    return validTargets;
}

function completeLink(player, source, target) {
    if (!getOutputPort(source, _srcP, _srcD)) return false;
    if (!getInputPort(target, _tgtP, _tgtD, source)) return false;
    if (!portsMatch(_srcP, _srcD, _tgtP, _tgtD)) return false;

    const linkExists = player.activeLinks.some(l => l.source === source && l.target === target);
    if (linkExists) return false;

    const wouldCycle = player.activeLinks.some(l => l.source === target && l.target === source);
    if (wouldCycle) return false;

    const isPowerLink = (source.userData.isSolarPanel || source.userData.type === 'Solar Panel') && target.userData.isAutoMiner;

    if (isPowerLink) {
        if (target.userData.setPowered) {
            target.userData.setPowered(true);
        }
    } else {
        if (source.userData.setOutputConveyor) {
            source.userData.setOutputConveyor(target);
        }
    }

    const colorHex = isPowerLink ? 0xf1c40f : 0x2ecc71;
    const connector = createLinkConnector(player.scene, colorHex, 0.65);
    connector.setEndpoints(_srcP.clone(), _tgtP.clone());
    connector.setVisible(true);

    player.activeLinks.push({ source, target, connector, isPowerLink });
    return true;
}

export function rescanAllLinks(player) {
    if (player.interactables) {
        player.interactables.updateMatrixWorld(true);
    }

    for (const child of player.interactables.children) {
        const isSource = child.userData.isAutoMiner || child.userData.isConveyor || child.userData.isSolarPanel || child.userData.type === 'Solar Panel';
        if (!isSource) continue;

        const targets = findTouchingTargets(player, child);
        for (const target of targets) {
            completeLink(player, child, target);
        }
    }
}

export function cleanupLinksForNode(player, node) {
    for (let i = player.activeLinks.length - 1; i >= 0; i--) {
        const link = player.activeLinks[i];
        if (link.source === node || link.target === node) {
            if (link.isPowerLink) {
                if (link.target.userData.setPowered) {
                    link.target.userData.setPowered(false);
                }
            } else {
                if (link.source === node) {
                    if (node.userData.setOutputConveyor) node.userData.setOutputConveyor(null);
                }
                if (link.target === node) {
                    if (link.source.removeOutputConveyor) {
                        link.source.removeOutputConveyor(node);
                    }
                }
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

export function updateGhostLinkPreview(player, ghostNode, isConveyorGhost) {
    let inShown = false, outShown = false;
    const isPowerGhost = ghostNode.userData.isSolarPanel || ghostNode.userData.type === 'Solar Panel';

    if (!isPowerGhost && getInputPort(ghostNode, _tgtP, _tgtD, null)) {
        for (const child of player.interactables.children) {
            const isSrc = child.userData.isAutoMiner || child.userData.isConveyor;
            if (!isSrc) continue;
            if (!getOutputPort(child, _srcP, _srcD)) continue;
            if (portsMatch(_srcP, _srcD, _tgtP, _tgtD)) {
                player.ghostLinkPreviewIn.setEndpoints(_srcP.clone(), _tgtP.clone());
                player.ghostLinkPreviewIn.setVisible(true);
                inShown = true;
                break;
            }
        }
    }

    if (getOutputPort(ghostNode, _srcP, _srcD)) {
        for (const child of player.interactables.children) {
            if (child === ghostNode) continue;
            if (!getInputPort(child, _tgtP, _tgtD, ghostNode)) continue;
            if (portsMatch(_srcP, _srcD, _tgtP, _tgtD)) {
                player.ghostLinkPreviewOut.setEndpoints(_srcP.clone(), _tgtP.clone());
                player.ghostLinkPreviewOut.setVisible(true);
                outShown = true;
                break;
            }
        }
    }

    if (!inShown && player.ghostLinkPreviewIn) player.ghostLinkPreviewIn.setVisible(false);
    if (!outShown && player.ghostLinkPreviewOut) player.ghostLinkPreviewOut.setVisible(false);
}