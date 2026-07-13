// Power state is derived entirely from player.activeLinks (see linkSystem.js),
// filtered to isPowerLink === true entries — there's no separate power-link
// list anymore. This file just does cluster generation-vs-consumption math on
// a slow tick, plus a couple of no-op exports kept so nothing else needs to
// change its imports.

export function rescanPowerLinks(player) {
    if (!player.activeLinks) player.activeLinks = [];
}

// Groups power-connected nodes into clusters via the power links, sums each
// cluster's generation vs consumption, powers every miner in a cluster only
// if a panel is present AND generation covers consumption. Ticked every 0.25s
// from player.js, not every frame.
export function tickPowerGrid(player) {
    if (!player.interactables) return;
    const nodes = player.interactables.children.filter(n => n.userData.isSolarPanel || n.userData.isAutoMiner);
    if (nodes.length === 0) return;

    const links = (player.activeLinks || []).filter(l => l.isPowerLink);
    const visited = new Set();

    for (const start of nodes) {
        if (visited.has(start)) continue;

        const cluster = [];
        const stack = [start];
        visited.add(start);
        while (stack.length) {
            const cur = stack.pop();
            cluster.push(cur);
            for (const link of links) {
                const other = link.source === cur ? link.target : (link.target === cur ? link.source : null);
                if (other && !visited.has(other)) { visited.add(other); stack.push(other); }
            }
        }

        let generation = 0, consumption = 0;
        for (const n of cluster) {
            if (n.userData.isSolarPanel && n.userData.getGenerationRate) generation += n.userData.getGenerationRate();
            if (n.userData.isAutoMiner && n.userData.getConsumptionRate) consumption += n.userData.getConsumptionRate();
        }

        const hasSolar = cluster.some(c => c.userData.isSolarPanel);
        const powered = hasSolar && generation >= consumption;

        for (const n of cluster) {
            if (n.userData.isAutoMiner && n.userData.setPowered) n.userData.setPowered(powered);
        }
    }
}

// No-op: link cleanup for power links is handled centrally by linkSystem.js's
// cleanupLinksForNode now. Kept exported so existing call sites don't break.
export function cleanupPowerLinksForNode() {}

// No-op: visuals for all links (power and item alike) are ticked uniformly
// by linkSystem.js's tickLinkVisuals now.
export function tickPowerVisuals() {}