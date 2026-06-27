import * as THREE from 'three';

export default class Player {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.velocity = { y: 0 };
        this.isGrounded = true;
        this.moveTime = 0;
        this.particles = [];

        this.baseSkinColor = '#b0b8c4'; // Light clay grey matching the reference image

        // --- Core Paint Canvas Engine Layer ---
        this.paintCanvas = document.createElement('canvas');
        this.paintCanvas.width = 512; this.paintCanvas.height = 512;
        this.pCtx = this.paintCanvas.getContext('2d');
        this.clearCanvasToDefault();
        this.dynamicTexture = new THREE.CanvasTexture(this.paintCanvas);

        // --- Smooth Capsule-Based Clay Geometry ---
        // Using Capsules ensures the rounded, seamless look from the image
        const structureMat = new THREE.MeshStandardMaterial({ color: this.baseSkinColor, roughness: 0.7, metalness: 0.1 });
        const canvasPaintMat = new THREE.MeshStandardMaterial({ map: this.dynamicTexture, roughness: 0.7, metalness: 0.1 });

        // Featureless Round Head
        this.head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 32), structureMat);
        this.head.position.y = 2.4;
        this.head.castShadow = true;

        // Pill-shaped Torso (The Paintable Canvas)
        this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 16, 32), canvasPaintMat);
        this.torso.position.y = 1.4;
        this.torso.castShadow = true;

        // Limbs: Rounded capsules instead of sharp cylinders
        const limbGeo = new THREE.CapsuleGeometry(0.12, 0.6, 16, 16);

        // Arms
        this.armL = new THREE.Group();
        const boneL = new THREE.Mesh(limbGeo, structureMat); boneL.position.y = -0.3; boneL.castShadow = true;
        this.armL.add(boneL); this.armL.position.set(-0.55, 1.9, 0);

        this.armR = new THREE.Group();
        const boneR = new THREE.Mesh(limbGeo, structureMat); boneR.position.y = -0.3; boneR.castShadow = true;
        this.armR.add(boneR); this.armR.position.set(0.55, 1.9, 0);

        // Legs
        this.legL = new THREE.Group();
        const thighL = new THREE.Mesh(limbGeo, structureMat); thighL.position.y = -0.3; thighL.castShadow = true;
        this.legL.add(thighL); this.legL.position.set(-0.2, 0.8, 0);

        this.legR = new THREE.Group();
        const thighR = new THREE.Mesh(limbGeo, structureMat); thighR.position.y = -0.3; thighR.castShadow = true;
        this.legR.add(thighR); this.legR.position.set(0.2, 0.8, 0);

        // Assemble Character
        this.group.add(this.head, this.torso, this.armL, this.armR, this.legL, this.legR);
        this.scene.add(this.group);
    }

    clearCanvasToDefault() {
        this.pCtx.fillStyle = this.baseSkinColor;
        this.pCtx.fillRect(0, 0, 512, 512);
        if(this.dynamicTexture) this.dynamicTexture.needsUpdate = true;
    }

    jump() {
        if (!this.isGrounded) return;
        this.velocity.y = 0.35;
        this.isGrounded = false;
        this.createDustEffect();
    }

    createDustEffect() {
        const dustMat = new THREE.MeshBasicMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.8 });
        for(let i=0; i<8; i++) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), dustMat);
            p.position.copy(this.group.position);
            p.position.y = 0.1;
            p.userData = { vx: (Math.random() - 0.5) * 0.2, vy: Math.random() * 0.15, vz: (Math.random() - 0.5) * 0.2, life: 1.0 };
            this.scene.add(p);
            this.particles.push(p);
        }
    }

    update(keys, speed) {
        let isMoving = false;
        
        if (keys.w || keys.ArrowUp) { this.group.position.z -= speed; isMoving = true; }
        if (keys.s || keys.ArrowDown) { this.group.position.z += speed; isMoving = true; }
        if (keys.a || keys.ArrowLeft) { this.group.position.x -= speed; isMoving = true; }
        if (keys.d || keys.ArrowRight) { this.group.position.x += speed; isMoving = true; }

        // Gravity
        this.velocity.y -= 0.018; 
        this.group.position.y += this.velocity.y;

        if (this.group.position.y <= 0) {
            this.group.position.y = 0;
            this.velocity.y = 0;
            if(!this.isGrounded) this.createDustEffect();
            this.isGrounded = true;
        }

        // Smooth Walking Animation
        if (isMoving && this.isGrounded) {
            this.moveTime += speed * 2.5;
            const wave = Math.sin(this.moveTime * 10);
            this.legL.rotation.x = wave * 0.7;
            this.legR.rotation.x = -wave * 0.7;
            this.armL.rotation.x = -wave * 0.6;
            this.armR.rotation.x = wave * 0.6;
            this.head.rotation.y = Math.sin(this.moveTime * 3) * 0.2; // Slight head bob
        } else {
            this.legL.rotation.x = 0; this.legR.rotation.x = 0;
            this.armL.rotation.x = 0; this.armR.rotation.x = 0;
            this.head.rotation.y = 0;
        }

        // Particles
        for(let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.x += p.userData.vx; p.position.y += p.userData.vy; p.position.z += p.userData.vz;
            p.scale.setScalar(p.userData.life);
            p.userData.life -= 0.05;
            if (p.userData.life <= 0) { this.scene.remove(p); this.particles.splice(i, 1); }
        }
    }

    executePaintMatrix(uv, selectedColor, radius, currentTool) {
        const xCoord = uv.x * this.paintCanvas.width;
        const yCoord = (1 - uv.y) * this.paintCanvas.height;

        if (currentTool === 'bucket') {
            this.pCtx.fillStyle = selectedColor;
            this.pCtx.fillRect(0, 0, 512, 512);
        } else if (currentTool === 'eraser') {
            this.pCtx.fillStyle = this.baseSkinColor;
            this.pCtx.beginPath();
            this.pCtx.arc(xCoord, yCoord, radius, 0, Math.PI * 2);
            this.pCtx.fill();
        } else if (currentTool === 'brush') {
            this.pCtx.fillStyle = selectedColor;
            this.pCtx.beginPath();
            this.pCtx.arc(xCoord, yCoord, radius, 0, Math.PI * 2);
            this.pCtx.fill();
        }

        this.dynamicTexture.needsUpdate = true;
    }
}