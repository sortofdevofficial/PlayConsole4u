import * as THREE from 'three';

const MINE_INTERVAL_MS = 3000;
const MINE_DAMAGE = 3;
const DRILL_BOB_SPEED = 3.2;
const DRILL_BOB_RANGE = 0.09;

function createDropMesh(type) {
    if (type === 'Stone') return new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0x888c8d }));
    if (type === 'Iron Ore') return new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0x7d7466 }));
    return null;
}

export function createAutoMiner() {
    const group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.55, metalness: 0.45, flatShading: true });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x5a6268, roughness: 0.5, metalness: 0.5, flatShading: true });
    const drillMat = new THREE.MeshStandardMaterial({ color: 0xc7c2b8, roughness: 0.25, metalness: 0.85, flatShading: true });
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.4, metalness: 0.7 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x3ddc84, emissiveIntensity: 1.2, roughness: 0.4 });
    const holeRimMat = new THREE.MeshStandardMaterial({ color: 0xd4a24c, roughness: 0.35, metalness: 0.55 });
    const holeVoidMat = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 1.0, metalness: 0.0 });
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.5, metalness: 0.6, emissive: 0x2ecc71, emissiveIntensity: 0 });

    // Four angled legs straddling the resource node — center stays open so the
    // drill bit visibly plunges down toward whatever it's placed on top of.
    const legGeo = new THREE.CylinderGeometry(0.06, 0.09, 1.0, 6);
    const legPositions = [
        [0.55, 0.5, 0.55], [-0.55, 0.5, 0.55], [0.55, 0.5, -0.55], [-0.55, 0.5, -0.55]
    ];
    legPositions.forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legGeo, frameMat);
        leg.position.set(x, y, z);
        leg.rotation.z = x > 0 ? 0.3 : -0.3;
        leg.rotation.x = z > 0 ? -0.3 : 0.3;
        leg.castShadow = true;
        group.add(leg);
    });

    const braceGeo = new THREE.BoxGeometry(1.3, 0.05, 0.05);
    const braceA = new THREE.Mesh(braceGeo, frameMat);
    braceA.position.set(0, 0.55, 0);
    braceA.rotation.y = Math.PI / 4;
    group.add(braceA);
    const braceB = braceA.clone();
    braceB.rotation.y = -Math.PI / 4;
    group.add(braceB);

    // Top deck the drill mechanism sits on
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 8), panelMat);
    deck.position.y = 1.05;
    deck.castShadow = true;
    group.add(deck);

    // Control housing + status light
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.34), panelMat);
    housing.position.set(0.5, 1.05, 0);
    housing.castShadow = true;
    group.add(housing);
    const statusLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.03), lightMat);
    statusLight.position.set(0.5, 1.14, 0.18);
    group.add(statusLight);

    // ===== Vertical drill assembly — spins and bobs to sell "actively drilling
    // downward into the node beneath it" =====
    const drillRig = new THREE.Group();
    drillRig.position.set(0, 1.12, 0);
    group.add(drillRig);

    const drillShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.85, 8), shaftMat);
    drillShaft.position.y = -0.4;
    drillShaft.castShadow = true;
    drillRig.add(drillShaft);

    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.16), drillMat);
        fin.position.set(0, -0.42, 0);
        fin.rotation.y = (i / 3) * Math.PI * 2;
        fin.rotation.z = 0.5;
        drillRig.add(fin);
    }

    const drillBit = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 8), drillMat);
    drillBit.position.y = -0.95;
    drillBit.castShadow = true;
    drillRig.add(drillBit);

    // ===== VISIBLE DROP-HOLE — the actual output port. Same height a Conveyor's
    // belt sits at, on the +X face, so lining a conveyor up against this side makes
    // the hole and the belt visually meet. Faked via a dark disc + rim ring (no CSG
    // boolean cut needed) but reads clearly as an opening. =====
    const holeHeight = 0.32;
    const holeX = 0.62;

    const holeVoid = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), holeVoidMat);
    holeVoid.rotation.z = Math.PI / 2;
    holeVoid.position.set(holeX, holeHeight, 0);
    group.add(holeVoid);

    const holeRim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 14), holeRimMat);
    holeRim.rotation.y = Math.PI / 2;
    holeRim.position.set(holeX, holeHeight, 0);
    holeRim.castShadow = true;
    group.add(holeRim);

    // Small lip beneath the hole so dropped material visibly slides toward a
    // conveyor rather than the hole looking purely decorative.
    const chute = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.24), chuteMat);
    chute.rotation.x = -0.25;
    chute.position.set(holeX + 0.14, holeHeight - 0.08, 0);
    chute.castShadow = true;
    group.add(chute);

    const light = new THREE.PointLight(0x3ddc84, 0.6, 3, 2);
    light.position.set(0.5, 1.2, 0);
    group.add(light);

    const state = {
        lastMineTime: 0,
        bobTime: 0,
        spin: 0,
        pulseTime: 0,
        interactablesGroup: null,
        dropsGroup: null,
        linkedConveyor: null
    };

    group.userData = {
        isInteractable: true,
        isStation: false,
        isAutoMiner: true,
        type: 'Auto Miner',
        health: 10,
        maxHealth: 10,
        dropName: 'Auto Miner',
        // targetSpawnIndex is set directly at placement time (PlayerCombat.js),
        // since placement now requires aiming at an actual resource node.

        bindContext(interactablesGroup, dropsGroup) {
            state.interactablesGroup = interactablesGroup;
            state.dropsGroup = dropsGroup;
        },
        setOutputConveyor(conveyor) { state.linkedConveyor = conveyor; },
        getOutputConveyor() { return state.linkedConveyor; },
        // World-space position of the drop-hole/chute — link lines and tossed
        // drops both originate here, matching the visible geometry.
        getOutputPoint(target) { chute.getWorldPosition(target); },

        tick(time) {
            state.spin += 0.18;
            drillRig.rotation.y = state.spin;

            state.bobTime += 0.016 * DRILL_BOB_SPEED;
            drillRig.position.y = 1.12 - (Math.sin(state.bobTime) * 0.5 + 0.5) * DRILL_BOB_RANGE;

            state.pulseTime += 0.05;
            lightMat.emissiveIntensity = 0.8 + (0.5 + Math.sin(state.pulseTime) * 0.3) * 0.6;
            chuteMat.emissiveIntensity = state.linkedConveyor ? (0.35 + Math.sin(state.pulseTime * 2) * 0.2) : 0;

            if (!state.interactablesGroup || !state.dropsGroup) return;
            const targetIdx = group.userData.targetSpawnIndex;
            if (targetIdx === undefined) return;
            if (time - state.lastMineTime < MINE_INTERVAL_MS) return;

            let target = null;
            for (const child of state.interactablesGroup.children) {
                if (child.userData && child.userData.spawnIndex === targetIdx) { target = child; break; }
            }
            if (!target) return;

            state.lastMineTime = time;
            target.userData.health -= MINE_DAMAGE;

            if (!target.userData.basePos) target.userData.basePos = target.position.clone();
            const shakeX = (Math.random() - 0.5) * 0.1;
            const shakeZ = (Math.random() - 0.5) * 0.1;
            target.position.set(target.userData.basePos.x + shakeX, target.userData.basePos.y, target.userData.basePos.z + shakeZ);
            clearTimeout(target.userData._autoMinerHitTimeout);
            target.userData._autoMinerHitTimeout = setTimeout(() => {
                if (target && target.parent) target.position.copy(target.userData.basePos);
            }, 100);

            if (target.userData.health <= 0) {
                const dropType = target.userData.type;
                const dropName = target.userData.dropName;
                target.parent.remove(target);

                const holeWorldPos = new THREE.Vector3();
                chute.getWorldPosition(holeWorldPos);

                const dropCount = dropType === 'Stone' ? Math.floor(Math.random() * 3) + 1 : 1;
                for (let i = 0; i < dropCount; i++) {
                    const mesh = createDropMesh(dropType);
                    if (!mesh) continue;
                    const dropGroup = new THREE.Group();
                    mesh.castShadow = true;
                    dropGroup.add(mesh);

                    let outVel = new THREE.Vector3();
                    let onConveyor = null;
                    if (state.linkedConveyor) {
                        state.linkedConveyor.userData.getEntryPoint(dropGroup.position);
                        dropGroup.position.y += 0.3;
                        onConveyor = state.linkedConveyor;
                    } else {
                        dropGroup.position.copy(holeWorldPos);
                        outVel.set(0.6 + Math.random() * 0.4, 1.5, (Math.random() - 0.5) * 0.6);
                    }

                    dropGroup.userData = { name: dropName, seed: Math.random() * 50, velocity: outVel, cooldown: 0.6, onConveyor };
                    state.dropsGroup.add(dropGroup);
                }
            }
        }
    };

    return group;
}