import * as THREE from 'three';
import { buildCharacter } from './CharacterBuilder.js';
import { createWorkbench } from './obj/Workbench.js';
import { Inventory } from './inventory.js';
import { initInputs } from './PlayerInput.js';
import { updateMovement, updateAnimationAndCamera } from './PlayerMovement.js';
import * as Combat from './PlayerCombat.js';
import { createLinkConnector } from './linkVisuals.js';
import { tickPowerGrid, tickPowerVisuals } from './powerSystem.js';

export class Player {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.baseFov = camera.fov;
        this.inventory = new Inventory();

        this.inventory.addItem('Auto Miner', 10);
        this.inventory.addItem('Conveyor', 20);
        this.inventory.addItem('Conveyor Left', 10);
        this.inventory.addItem('Conveyor Right', 10);
        this.inventory.addItem('Solar Panel', 10);
        this.inventory.addItem('Stone Pickaxe', 1);

        this.position = new THREE.Vector3(0, 2, 0);
        this.velocity = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = -0.1;

        this.walkSpeed = 10.0;
        this.crouchSpeed = 4.0;
        this.acceleration = 60.0;
        this.deceleration = 60.0;
        this.airControl = 0.3;
        this.gravity = 32.0;
        this.jumpForce = 12.0;

        this.isCrouching = false;
        this.crouchAmount = 0;
        this.fallSpeed = 0;
        this.landingSquash = 0;
        this.isGrounded = true;
        this.coyoteTime = 0.15;
        this.coyoteTimer = 0;
        this.jumpBuffer = 0.15;
        this.jumpBufferTimer = 0;

        this.currentSpeedFactor = 0;
        this.bobTime = 0;
        this.animTime = 0;
        this.viewMode = 0;

        this.input = { forward: false, backward: false, left: false, right: false, jump: false, crouch: false, shift: false };
        this.keys = this.input;

        this.raycaster = new THREE.Raycaster();
        this.punchTimer = 0;
        this.punchCooldown = 0.42;

        this.placeRotation = 0;
        this.ghostValid = true;
        this.currentGhostType = 'Workbench';
        this.craftState = { active: false, timer: 0, duration: 0 };

        this.activeLinks = [];
        this.powerLinks = [];
        this.linkAnimTime = 0;
        this.powerTickAccum = 0;

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
        this.quickMenu = document.getElementById('quick-menu');
        this.workbenchMenu = document.getElementById('workbench-menu');
        this.furnaceMenu = document.getElementById('furnace-menu');

        // FIX: this was never created at all previously -- updateHoverUI runs
        // every single frame and touches player.ghostMesh.visible unconditionally,
        // so its absence crashed the render loop before the very first frame.
        this.ghostMesh = createWorkbench();
        this.ghostMesh.traverse(c => {
            if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.castShadow = false; }
        });
        this.ghostMesh.visible = false;
        this.scene.add(this.ghostMesh);

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
        const glassCount = this.inventory.getCount('Glass');
        const siliconCount = this.inventory.getCount('Silicon');

        const set = (id, disabled) => { const el = document.getElementById(id); if (el) el.disabled = disabled; };

        set('qc-stick', oakCount < 2);
        set('qc-bench', oakCount < 5);
        set('wb-stick', oakCount < 2);
        set('wb-bench', oakCount < 5);
        set('wb-pickaxe', stoneCount < 3 || stickCount < 2);
        set('wb-axe', stoneCount < 3 || stickCount < 2);
        set('wb-furnace', stoneCount < 8);
        set('wb-autominer', plateCount < 4 || gearCount < 2 || stickCount < 3);
        set('wb-conveyor', plateCount < 2 || stickCount < 2);
        set('wb-conveyor-left', plateCount < 2 || gearCount < 1 || stickCount < 2);
        set('wb-conveyor-right', plateCount < 2 || gearCount < 1 || stickCount < 2);
        set('wb-solarpanel', glassCount < 2 || plateCount < 4 || gearCount < 2 || siliconCount < 1);

        this.inventory.updateUI();
    }

    updateFurnaceButtons() {
        const busy = this.craftState.active;
        const hasOre = this.inventory.getCount('Iron Ore') >= 1;
        const hasFuel = this.inventory.getCount('Stick') >= 1 || this.inventory.getCount('Oak') >= 1;
        const hasIngot = this.inventory.getCount('Iron Ingot') >= 1;
        const hasQuartz = this.inventory.getCount('Quartz') >= 1;
        const hasSand = this.inventory.getCount('Sand') >= 1;

        const set = (id, disabled) => { const el = document.getElementById(id); if (el) el.disabled = disabled; };

        set('fn-smelt', busy || !(hasOre && hasFuel));
        set('fn-plate', busy || !hasIngot);
        set('fn-gear', busy || !hasIngot);
        set('fn-silicon', busy || !hasQuartz);
        set('fn-glass', busy || !hasSand);
    }

    applySwingPose(rArm, isFP) { Combat.applySwingPose(this, rArm, isFP); }
    handleSecondaryAction() { Combat.handleSecondaryAction(this); }
    handlePrimaryAction() { Combat.handlePrimaryAction(this); }
    spawnDrop(name, pos, vel) { Combat.spawnDrop(this, name, pos, vel); }

    smeltIron() { return Combat.smeltIron(this); }
    craftIronPlate() { return Combat.craftIronPlate(this); }
    craftIronGear() { return Combat.craftIronGear(this); }
    smeltQuartz() { return Combat.smeltQuartz(this); }
    smeltSand() { return Combat.smeltSand(this); }
    craftSolarPanel() { return Combat.craftSolarPanel(this); }

    update(deltaTime, groundMesh, interactables, dropsGroup, markersGroup, platformWidth = 60, platformLength = 60) {
        if (deltaTime > 0.1) deltaTime = 0.1;
        this.interactables = interactables;
        this.dropsGroup = dropsGroup;
        this.markersGroup = markersGroup;

        Combat.updateHeldModel(this, this.inventory.getActiveItem().name);
        Combat.updateHoverUI(this, groundMesh);
        Combat.tickConveyorDrops(this, deltaTime);
        Combat.tickCraftProcess(this, deltaTime);

        this.linkAnimTime += deltaTime;
        Combat.tickLinkVisuals(this, this.linkAnimTime);

        this.powerTickAccum += deltaTime;
        if (this.powerTickAccum >= 0.25) {
            this.powerTickAccum = 0;
            tickPowerGrid(this);
        }
        tickPowerVisuals(this, this.linkAnimTime);

        if (this.dropsGroup) {
            const drops = this.dropsGroup.children;
            for (let i = drops.length - 1; i >= 0; i--) {
                const drop = drops[i];
                if (drop.userData.onConveyor) continue;

                if (drop.userData.velocity && (drop.userData.velocity.lengthSq() > 0.1 || drop.position.y > 0.3)) {
                    drop.position.addScaledVector(drop.userData.velocity, deltaTime);
                    drop.userData.velocity.y -= this.gravity * deltaTime;
                    if (drop.position.y <= 0.3) {
                        drop.position.y = 0.3;
                        drop.userData.velocity.y *= -0.3;
                        drop.userData.velocity.x *= 0.5;
                        drop.userData.velocity.z *= 0.5;
                    }
                } else {
                    drop.rotation.y += deltaTime * 1.2;
                }

                if (drop.userData.cooldown > 0) {
                    drop.userData.cooldown -= deltaTime;
                } else if (this.position.distanceToSquared(drop.position) < 4.0) {
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