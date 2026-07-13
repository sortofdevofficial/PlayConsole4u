import * as THREE from 'three';
import { createLinkConnector } from './linkVisuals.js';
import { POWER_LINK_DISTANCE } from './placeables.js';

function showDistanceWarning() {
    const notifyHud = document.getElementById('notification-hud');
    if (notifyHud) {
        notifyHud.textContent = "Object too far to connect!";
        notifyHud.classList.add('show');
        
        clearTimeout(notifyHud.timeoutRef);
        notifyHud.timeoutRef = setTimeout(() => {
            notifyHud.classList.remove('show');
        }, 2500);
    }
}

export function rescanPowerLinks(player) {
    if (!player.powerLinks) player.powerLinks = [];
}

export function createManualPowerLink(player, nodeA, nodeB) {
    if (!player.powerLinks) player.powerLinks = [];

    let panel = null;
    let miner = null;

    if (nodeA.userData.isSolarPanel) panel = nodeA;
    if (nodeA.userData.isAutoMiner) miner = nodeA;
    if (nodeB.userData.isSolarPanel) panel = nodeB;
    if (nodeB.userData.isAutoMiner) miner = nodeB;

    if (!panel || !miner) {
        console.warn("Invalid Link: You must connect a Solar Panel and an Auto Miner.");
        return false;
    }

    const maximumAllowedDistance = POWER_LINK_DISTANCE * 2.0;
    if (panel.position.distanceTo(miner.position) > maximumAllowedDistance) {
        console.warn("Invalid Link: These machines are too far apart to wire.");
        showDistanceWarning(); 
        return false;
    }

    const alreadyLinked = player.powerLinks.some(l => 
        (l.a === panel && l.b === miner) || (l.a === miner && l.b === panel)
    );
    if (alreadyLinked) {
        console.warn("Invalid Link: These nodes are already connected.");
        return false;
    }

    const connector = createLinkConnector(player.scene, 0x3498db, 0.4);
    const pOffset = panel.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const mOffset = miner.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    
    connector.setEndpoints(pOffset, mOffset);
    connector.setVisible(true);

    player.powerLinks.push({ a: panel, b: miner, connector });
    
    tickPowerGrid(player);
    return true;
}

export function tickPowerGrid(player) {
    if (!player.powerLinks) return;

    const children = player.interactables ? player.interactables.children : [];
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.userData && child.userData.isAutoMiner && typeof child.userData.setPowered === 'function') {
            child.userData.setPowered(false);
        }
    }

    let networkSafetyGuard = 0;
    
    for (let i = 0; i < player.powerLinks.length; i++) {
        const link = player.powerLinks[i];
        if (!link || !link.a || !link.b) continue;

        networkSafetyGuard++;
        if (networkSafetyGuard > 1000) break;

        const nodeA = link.a;
        const nodeB = link.b;

        if (nodeA.userData.isSolarPanel && nodeB.userData.isAutoMiner && typeof nodeB.userData.setPowered === 'function') {
            nodeB.userData.setPowered(true);
        }
        if (nodeB.userData.isSolarPanel && nodeA.userData.isAutoMiner && typeof nodeA.userData.setPowered === 'function') {
            nodeA.userData.setPowered(true);
        }
    }
}

export function cleanupPowerLinksForNode(player, node) {
    if (!player.powerLinks) return;
    for (let i = player.powerLinks.length - 1; i >= 0; i--) {
        const link = player.powerLinks[i];
        if (link.a === node || link.b === node) {
            if (link.connector && typeof link.connector.dispose === 'function') {
                link.connector.dispose();
            }
            player.powerLinks.splice(i, 1);
        }
    }
}

export function tickPowerVisuals(player, time) {
    if (!player.powerLinks) return;
    for (let i = 0; i < player.powerLinks.length; i++) {
        const link = player.powerLinks[i];
        if (link.connector && typeof link.connector.tick === 'function') {
            link.connector.tick(time);
        }
    }
}