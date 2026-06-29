import * as THREE from 'three';

const S = 0.2; 

export default class Player {
    constructor(scene, color = '#c8cdd4', isRemote = false) {
        this.scene = scene;
        this.isRemote = isRemote;
        this.group = new THREE.Group();
        this.modelGroup = new THREE.Group();
        this.group.add(this.modelGroup);

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.isGrounded = true;
        this.jumpsLeft = 2;
        this.frozen = false;
        this.moveTime = 0;
        this.particles = [];

        this.radius = 0.08;   
        this.height = 0.55;   
        this.baseSkinColor = color;
        this.paintableMeshes = [];
        this.paintLayers = new Map();

        // High fidelity procedural mesh generation configurations
        const headGeo  = new THREE.SphereGeometry(0.52 * S, 24, 24);
        const torsoGeo = new THREE.CapsuleGeometry(0.44 * S, 0.75 * S, 10, 20);
        const limbGeo  = new THREE.CapsuleGeometry(0.16 * S, 0.55 * S, 8, 10); 
        const jointGeo = new THREE.SphereGeometry(0.17 * S, 10, 10);

        const characterMaterial = new THREE.MeshStandardMaterial({ 
            color: this.baseSkinColor, 
            roughness: 0.5, 
            metalness: 0.1 
        });

        this.head = new THREE.Mesh(headGeo, characterMaterial);  
        this.head.position.y = 2.1 * S; 
        this.head.castShadow = true;
        this.modelGroup.add(this.head);
        
        this.torso = new THREE.Mesh(torsoGeo, characterMaterial); 
        this.torso.position.y = 1.3 * S;
        this.torso.castShadow = true;
        this.torso.receiveShadow = true;
        this.modelGroup.add(this.torso);

        // Procedural limbs skeleton bindings
        this.armL = new THREE.Group();
        const bL = new THREE.Mesh(limbGeo, characterMaterial);
        bL.position.y = -0.275 * S;
        this.armL.add(bL);
        this.armL.position.set(-0.52 * S, 1.75 * S, 0);
        this.modelGroup.add(this.armL);

        this.armR = new THREE.Group();
        const bR = new THREE.Mesh(limbGeo, characterMaterial);
        bR.position.y = -0.275 * S;
        this.armR.add(bR);
        this.armR.position.set(0.52 * S, 1.75 * S, 0);
        this.modelGroup.add(this.armR);

        this.legL = new THREE.Group();
        const lL = new THREE.Mesh(limbGeo, characterMaterial);
        lL.position.y = -0.275 * S;
        this.legL.add(lL);
        this.legL.position.set(-0.25 * S, 0.7 * S, 0);
        this.modelGroup.add(this.legL);

        this.legR = new THREE.Group();
        const lR = new THREE.Mesh(limbGeo, characterMaterial);
        lR.position.y = -0.275 * S;
        this.legR.add(lR);
        this.legR.position.set(0.25 * S, 0.7 * S, 0);
        this.modelGroup.add(this.legR);

        this.scene.add(this.group);
    }

    jump() {
        if (this.frozen) return; // Prevent input action if frozen
        if (this.isGrounded || this.jumpsLeft > 0) {
            this.velocity.y = 4.8; 
            this.isGrounded = false;
            this.jumpsLeft--;
        }
    }

    update(input, isSprinting, delta, colliders) {
        // --- TICK PARTICLES UNCONDITIONALLY FOR GRAPHICS VISUAL FLUIDITY ---
        this.updateParticles(delta);

        // If frozen, we skip velocity calculation but preserve the scene rendering cycle context safely!
        if (this.frozen) {
            this.velocity.set(0, Math.max(-15, this.velocity.y - 12 * delta), 0);
            this.group.position.addScaledVector(this.velocity, delta);
            this.resolveEnvironmentCollisions(colliders);
            return;
        }

        const currentMoveSpeed = isSprinting ? 5.5 : 3.2;

        // Process blended keys and continuous mobile digital inputs
        let moveX = 0;
        let moveZ = 0;

        if (input.jx !== undefined && (Math.abs(input.jx) > 0.05 || Math.abs(input.jz) > 0.05)) {
            moveX = input.jx;
            moveZ = input.jz;
        } else {
            if (input.w) moveZ = -1;
            if (input.s) moveZ = 1;
            if (input.a) moveX = -1;
            if (input.d) moveX = 1;
            
            // Normalize digital layout vector values
            const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (len > 0) {
                moveX /= len;
                moveZ /= len;
            }
        }

        this.direction.set(moveX, 0, moveZ);

        if (this.direction.lengthSq() > 0.01) {
            const targetRotation = Math.atan2(moveX, moveZ);
            // Smooth angular interpolations
            let diff = targetRotation - this.modelGroup.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.modelGroup.rotation.y += diff * 0.15;

            this.moveTime += delta * currentMoveSpeed * 2.2;
            this.legL.rotation.x = Math.sin(this.moveTime) * 0.6;
            this.legR.rotation.x = -Math.sin(this.moveTime) * 0.6;
            this.armL.rotation.x = -Math.sin(this.moveTime) * 0.4;
            this.armR.rotation.x = Math.sin(this.moveTime) * 0.4;
        } else {
            // Lerp animations back into rest postures safely
            this.legL.rotation.x *= 0.8;
            this.legR.rotation.x *= 0.8;
            this.armL.rotation.x *= 0.8;
            this.armR.rotation.x *= 0.8;
        }

        // Apply realistic gravity curves
        this.velocity.x = this.direction.x * currentMoveSpeed;
        this.velocity.z = this.direction.z * currentMoveSpeed;
        this.velocity.y = Math.max(-16, this.velocity.y - 14 * delta);

        this.group.position.addScaledVector(this.velocity, delta);
        this.resolveEnvironmentCollisions(colliders);
    }

    resolveEnvironmentCollisions(colliders) {
        if (!colliders) return;
        this.isGrounded = false;
        
        // Solid grounding tracking matching landscape layouts
        if (this.group.position.y <= 0) {
            this.group.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
            this.jumpsLeft = 2;
        }
    }

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.addScaledVector(p.userData.velocity, delta);
            p.userData.age += delta;
            if (p.userData.age > p.userData.maxAge) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }

    executePaintMatrix(hitObject, uv, color, radius, tool) {
        if (!hitObject || !uv) return;
        // Purged bucket specific operations - exclusively implements safe procedural brush changes
        const layer = this.paintLayers?.get(hitObject.uuid);
        if (!layer) return;

        const ctx = layer.context;
        if (!ctx) return;

        const cx = uv.x * layer.width;
        const cy = (1 - uv.y) * layer.height;

        ctx.fillStyle = color || brushColor;
        ctx.beginPath();
        ctx.arc(cx, cy, radius || brushRadius, 0, Math.PI * 2);
        ctx.fill();

        if (layer.texture) layer.texture.needsUpdate = true;
    }
}