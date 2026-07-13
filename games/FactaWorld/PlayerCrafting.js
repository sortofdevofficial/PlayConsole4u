import * as THREE from 'three';

export function smeltIron(player) {
    if (player.craftState.active) return false;
    const hasOre = player.inventory.getCount('Iron Ore') >= 1;
    const hasFuel = player.inventory.getCount('Stick') >= 1 || player.inventory.getCount('Oak') >= 1;
    if (!hasOre || !hasFuel) return false;

    player.inventory.consumeItem('Iron Ore', 1);
    if (player.inventory.getCount('Stick') >= 1) player.inventory.consumeItem('Stick', 1);
    else player.inventory.consumeItem('Oak', 1);

    startCraftProcess(player, { resultName: 'Iron Ingot', resultCount: 1, duration: 2.0, label: 'Smelting Iron Ingot...', sparkColor: 0xff7a29 });
    return true;
}

export function craftIronPlate(player) {
    if (player.craftState.active) return false;
    if (player.inventory.getCount('Iron Ingot') < 1) return false;
    player.inventory.consumeItem('Iron Ingot', 1);
    startCraftProcess(player, { resultName: 'Iron Plate', resultCount: 1, duration: 1.6, label: 'Forging Iron Plate...', sparkColor: 0xffaa55 });
    return true;
}

export function craftIronGear(player) {
    if (player.craftState.active) return false;
    if (player.inventory.getCount('Iron Ingot') < 1) return false;
    player.inventory.consumeItem('Iron Ingot', 1);
    startCraftProcess(player, { resultName: 'Iron Gear', resultCount: 2, duration: 2.4, label: 'Cutting Iron Gears...', sparkColor: 0xdfefff });
    return true;
}

// New: Quartz -> Silicon, 10 second smelt, no fuel needed (represents a
// electric-furnace-style refinement rather than combustion smelting).
export function smeltQuartz(player) {
    if (player.craftState.active) return false;
    if (player.inventory.getCount('Quartz') < 1) return false;

    player.inventory.consumeItem('Quartz', 1);
    startCraftProcess(player, { resultName: 'Silicon', resultCount: 1, duration: 10.0, label: 'Refining Silicon...', sparkColor: 0x9fa8ff });
    return true;
}

// New: Sand -> Glass, 10 second smelt.
export function smeltSand(player) {
    if (player.craftState.active) return false;
    if (player.inventory.getCount('Sand') < 1) return false;

    player.inventory.consumeItem('Sand', 1);
    startCraftProcess(player, { resultName: 'Glass', resultCount: 1, duration: 10.0, label: 'Melting Glass...', sparkColor: 0x8fdcff });
    return true;
}

// Solar Panel assembled at the Workbench (not the furnace) since it's a final
// assembly step combining multiple refined materials, same pattern as Auto
// Miner/Conveyor.
export function craftSolarPanel(player) {
    const hasGlass = player.inventory.getCount('Glass') >= 2;
    const hasPlate = player.inventory.getCount('Iron Plate') >= 4;
    const hasGear = player.inventory.getCount('Iron Gear') >= 2;
    const hasSilicon = player.inventory.getCount('Silicon') >= 1;
    if (!hasGlass || !hasPlate || !hasGear || !hasSilicon) return false;

    player.inventory.consumeItem('Glass', 2);
    player.inventory.consumeItem('Iron Plate', 4);
    player.inventory.consumeItem('Iron Gear', 2);
    player.inventory.consumeItem('Silicon', 1);
    player.inventory.addItem('Solar Panel', 1);
    return true;
}

function startCraftProcess(player, { resultName, resultCount, duration, label, sparkColor }) {
    player.craftState.active = true;
    player.craftState.timer = 0;
    player.craftState.duration = duration;
    player.craftState.resultName = resultName;
    player.craftState.resultCount = resultCount;

    const progressLabel = document.getElementById('fn-progress-label');
    const progressBar = document.getElementById('fn-progress-bg');
    const progressFill = document.getElementById('fn-progress-fill');
    if (progressLabel) progressLabel.innerText = label;
    if (progressBar) progressBar.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';

    player.updateFurnaceButtons();
    spawnCraftSparks(player, sparkColor);
}

function spawnCraftSparks(player, color) {
    const furnace = player.craftState.furnaceRef;
    if (!furnace) return;

    const count = 24;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        velocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.06, transparent: true, opacity: 1, sizeAttenuation: true });
    const points = new THREE.Points(geo, mat);
    points.position.copy(furnace.position).add(new THREE.Vector3(0, 0.55, 0.75));
    player.scene.add(points);

    player.craftState.sparks = { points, velocities, age: 0 };
}

export function tickCraftProcess(player, deltaTime) {
    const state = player.craftState;
    if (!state.active) return;

    state.timer += deltaTime;
    const progress = Math.min(1, state.timer / state.duration);

    const progressFill = document.getElementById('fn-progress-fill');
    if (progressFill) progressFill.style.width = `${progress * 100}%`;

    if (state.sparks) {
        state.sparks.age += deltaTime;
        const posAttr = state.sparks.points.geometry.attributes.position;
        for (let i = 0; i < state.sparks.velocities.length; i++) {
            const v = state.sparks.velocities[i];
            posAttr.array[i * 3] += v.x * deltaTime;
            posAttr.array[i * 3 + 1] += v.y * deltaTime;
            posAttr.array[i * 3 + 2] += v.z * deltaTime;
            v.y -= 2.0 * deltaTime;
        }
        posAttr.needsUpdate = true;
        state.sparks.points.material.opacity = Math.max(0, 1 - state.sparks.age / state.duration);
    }

    if (progress >= 1) {
        player.inventory.addItem(state.resultName, state.resultCount);
        if (state.sparks) {
            player.scene.remove(state.sparks.points);
            state.sparks.points.geometry.dispose();
            state.sparks.points.material.dispose();
            state.sparks = null;
        }
        state.active = false;
        const progressBar = document.getElementById('fn-progress-bg');
        if (progressBar) progressBar.style.display = 'none';
        player.updateFurnaceButtons();
    }
}

function swingCurve(progress) {
    if (progress < 0.3) { const p = progress / 0.3; return -p * 0.7; }
    if (progress < 0.5) { const p = (progress - 0.3) / 0.2; return -0.7 + p * 2.3; }
    if (progress < 0.65) return 1.6;
    const p = (progress - 0.65) / 0.35;
    return 1.6 * (1 - p);
}

export function applySwingPose(player, rArm, isFirstPerson) {
    if (player.punchTimer <= 0) return;
    const progress = 1 - (player.punchTimer / player.punchCooldown);
    const swingArc = swingCurve(progress);
    const tool = player.inventory.getActiveItem().name;

    const leanAmount = Math.max(0, swingArc) * 0.12;
    player.parts.spine.rotation.x = leanAmount;

    if (isFirstPerson) {
        if (tool === 'Stone Pickaxe') {
            rArm.shoulder.rotation.x += swingArc * 1.9;
            rArm.shoulder.rotation.z -= swingArc * 0.3;
            rArm.lowerArm.rotation.x += Math.max(0, swingArc) * 0.7;
        } else if (tool === 'Stone Axe') {
            rArm.shoulder.rotation.x += swingArc * 1.1;
            rArm.shoulder.rotation.y -= swingArc * 1.1;
            rArm.lowerArm.rotation.x += Math.max(0, swingArc) * 0.45;
        } else {
            rArm.shoulder.rotation.x += swingArc * 1.5;
            rArm.shoulder.rotation.y -= swingArc * 0.35;
            rArm.lowerArm.rotation.x += Math.max(0, swingArc) * 0.75;
            const lunge = Math.max(0, swingArc) * 0.22;
            rArm.shoulder.position.z -= lunge;
            rArm.shoulder.position.x += lunge * 0.4;
        }
    } else {
        if (tool === 'Stone Pickaxe') {
            rArm.shoulder.rotation.x = -1.6 + swingArc * -1.3;
            rArm.shoulder.rotation.z = swingArc * 0.3;
        } else if (tool === 'Stone Axe') {
            rArm.shoulder.rotation.x = -0.6 + swingArc * -0.85;
            rArm.shoulder.rotation.y = -1.2 + swingArc * -1.15;
        } else {
            rArm.shoulder.rotation.x = -1.2 + swingArc * -1.5;
            rArm.shoulder.rotation.z = swingArc * -0.4;
        }
    }
}