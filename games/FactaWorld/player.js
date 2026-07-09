import * as THREE from 'three';
import { buildCharacter } from './CharacterBuilder.js';
import { createWorkbench } from './obj/Workbench.js';
import { Inventory } from './inventory.js';
import { initInputs } from './PlayerInput.js';
import { updateMovement, updateAnimationAndCamera } from './PlayerMovement.js';
import * as Combat from './PlayerCombat.js';
import { createLinkConnector } from './linkVisuals.js';

export class Player {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.baseFov = camera.fov;
        this.inventory = new Inventory();

        // Test items
        this.inventory.addItem('Auto Miner', 10);
        this.inventory.addItem('Conveyor', 10);
        this.inventory.addItem('Conveyor Left', 5);
        this.inventory.addItem('Conveyor Right', 5);
        this.inventory.addItem('Stone Pickaxe', 1);

        this.position = new THREE.Vector3(0, 2, 0);
        this.velocity = new THREE.Vector3();
        this.walkSpeed = 10.0;
        this.crouchSpeed = 4.5;
        this.gravity = 32.0;
        this.jumpForce = 12.0;
        this.acceleration = 40.0;
        this.deceleration = 45.0;
        this.airControl = 0.45;

        this.viewMode = 0;
        this.yaw = 0;
        this.pitch = -0.1;
        this.isGrounded = false;
        this.coyoteTime = 0.12;
        this.coyoteTimer = 0;
        this.jumpBuffer = 0.12;
        this.jumpBufferTimer = 0;
        this.fallSpeed = 0;
        this.landingSquash = 0;

        this.isCrouching = false;
        this.crouchAmount = 0;
        this.animTime = 0;
        this.bobTime = 0;
        this.currentSpeedFactor = 0;

        this.input = { forward: false, backward: false, left: false, right: false, jump: false, crouch: false, shift: false };
        this.keys = this.input;

        this.raycaster = new THREE.Raycaster();
        this.punchTimer = 0;
        this.punchCooldown = 0.42;

        this.placeRotation = 0;
        this.ghostValid = true;
        this.currentGhostType = 'Workbench';

        this.craftState = { active: false, timer: 0, duration: 0, resultName: '', resultCount: 0, furnaceRef: null, sparks: null };

        // Link-system state
        this.activeLinks = [];
        this.linkAnimTime = 0;
        this._pendingAutoMinerTarget = null;

        const { group, parts } = buildCharacter();
        this.mesh = group;
        this.parts = parts;
        this.scene.add(this.mesh);

        this.heldItemContainer = new THREE.Group();
        this.heldItemContainer.position.set(0, -0.35, 0.1);
        this.heldItemContainer.rotation.set(Math.PI / 2, 0, 0);
        this.parts.rightArm.lowerArm.add(this.heldItemContainer);
        this.currentHeldItemName = null;

        this.targetUi = document.getElementById('target-ui');
        this.targetName = document.getElementById('target-name');
        this.healthFill = document.getElementById('health-bar-fill');
        this.crosshair = document.getElementById('crosshair');
        this.workbenchMenu = document.getElementById('workbench-menu');
        this.quickMenu = document.getElementById('quick-menu');
        this.furnaceMenu = document.getElementById('furnace-menu');

        this.ghostMesh = createWorkbench();
        this.ghostMesh.traverse(c => {
            if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.castShadow = false; }
        });
        this.ghostMesh.visible = false;
        this.scene.add(this.ghostMesh);

        // Live amber preview lines shown while holding a placeable — "in" for
        // something feeding into the ghost, "out" for the ghost feeding
        // something ahead. Both can show at once when bridging a gap.
        this.ghostLinkPreviewIn = createLinkConnector(this.scene, 0xffd166, 0.6);
        this.ghostLinkPreviewOut = createLinkConnector(this.scene, 0xffd166, 0.6);

        initInputs(this);
        this.inventory.updateUI();
    }

    updateCraftingButtons() {
        const oakCount = this.inventory.getCount('Oak');
        const stoneCount = this.inventory.getCount('Stone');
        const stickCount = this.inventory.getCount('Stick');
        const plateCount = this.inventory.getCount('Iron Plate');
        const gearCount = this.inventory.getCount('Iron Gear');

        document.getElementById('qc-stick').disabled = (oakCount < 2);
        document.getElementById('qc-bench').disabled = (oakCount < 5);
        document.getElementById('wb-stick').disabled = (oakCount < 2);
        document.getElementById('wb-bench').disabled = (oakCount < 5);
        document.getElementById('wb-pickaxe').disabled = (stoneCount < 3 || stickCount < 2);
        document.getElementById('wb-axe').disabled = (stoneCount < 3 || stickCount < 2);
        document.getElementById('wb-furnace').disabled = (stoneCount < 8);

        const autoMinerBtn = document.getElementById('wb-autominer');
        if (autoMinerBtn) autoMinerBtn.disabled = (plateCount < 4 || gearCount < 2 || stickCount < 3);

        const conveyorBtn = document.getElementById('wb-conveyor');
        if (conveyorBtn) conveyorBtn.disabled = (plateCount < 2 || stickCount < 2);

        const conveyorLeftBtn = document.getElementById('wb-conveyor-left');
        if (conveyorLeftBtn) conveyorLeftBtn.disabled = (plateCount < 2 || gearCount < 1 || stickCount < 2);
        const conveyorRightBtn = document.getElementById('wb-conveyor-right');
        if (conveyorRightBtn) conveyorRightBtn.disabled = (plateCount < 2 || gearCount < 1 || stickCount < 2);
    }

    updateFurnaceButtons() {
        const busy = this.craftState.active;
        const hasOre = this.inventory.getCount('Iron Ore') >= 1;
        const hasFuel = this.inventory.getCount('Stick') >= 1 || this.inventory.getCount('Oak') >= 1;
        const hasIngot = this.inventory.getCount('Iron Ingot') >= 1;

        document.getElementById('fn-smelt').disabled = busy || !(hasOre && hasFuel);
        document.getElementById('fn-plate').disabled = busy || !hasIngot;
        document.getElementById('fn-gear').disabled = busy || !hasIngot;
    }

    updateHeldModel(name) { Combat.updateHeldModel(this, name); }
    handleSecondaryAction() { Combat.handleSecondaryAction(this); }
    handlePrimaryAction() { Combat.handlePrimaryAction(this); }
    spawnDrop(name, pos, vel) { Combat.spawnDrop(this, name, pos, vel); }
    applySwingPose(rArm, isFP) { Combat.applySwingPose(this, rArm, isFP); }
    smeltIron() { return Combat.smeltIron(this); }
    craftIronPlate() { return Combat.craftIronPlate(this); }
    craftIronGear() { return Combat.craftIronGear(this); }

    update(deltaTime, groundMesh, interactables, dropsGroup, markersGroup, platformWidth = 60, platformLength = 60) {
        if (deltaTime > 0.1) deltaTime = 0.1;
        this.interactables = interactables;
        this.dropsGroup = dropsGroup;
        this.markersGroup = markersGroup;

        this.updateHeldModel(this.inventory.getActiveItem().name);
        Combat.updateHoverUI(this, groundMesh);
        Combat.tickCraftProcess(this, deltaTime);
        Combat.tickConveyorDrops(this, deltaTime);

        this.linkAnimTime += deltaTime;
        Combat.tickLinkVisuals(this, this.linkAnimTime);

        if (this.dropsGroup) {
            for (let i = this.dropsGroup.children.length - 1; i >= 0; i--) {
                const drop = this.dropsGroup.children[i];
                if (drop.userData.onConveyor) continue;

                if (drop.userData.velocity.lengthSq() > 0.1 || drop.position.y > 0.3) {
                    drop.position.addScaledVector(drop.userData.velocity, deltaTime);
                    drop.userData.velocity.y -= this.gravity * deltaTime;
                    if (drop.position.y <= 0.3) {
                        drop.position.y = 0.3;
                        drop.userData.velocity.y *= -0.3; drop.userData.velocity.x *= 0.5; drop.userData.velocity.z *= 0.5;
                    }
                } else {
                    drop.rotation.y += deltaTime * 1.2;
                    drop.position.y = 0.3 + Math.sin(Date.now() * 0.003 + drop.userData.seed) * 0.08;
                }
                if (drop.userData.cooldown > 0) drop.userData.cooldown -= deltaTime;
                else if (this.position.distanceTo(drop.position) < 2.0) {
                    this.inventory.addItem(drop.userData.name, 1);
                    drop.parent.remove(drop);
                }
            }
        }

        const inputDir = updateMovement(this, deltaTime, platformWidth, platformLength);
        updateAnimationAndCamera(this, deltaTime, inputDir);

        if (this.punchTimer > 0) this.punchTimer -= deltaTime;
    }
}