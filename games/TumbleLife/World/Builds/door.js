import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Door {
    constructor(scene, x, z) {
        this.doorX = x;
        this.doorZ = z;

        const wood  = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 }); 
        const frame = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 }); 
        const knob  = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 }); 

        const box = (w,h,d,px,py,pz,mat) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
            m.position.set(px,py,pz); 
            m.receiveShadow = true; m.castShadow = true;
            scene.add(m); 
            return m;
        };

        // Frame
        box(0.25, 3.4, 0.4, x - 1.22, 1.7, z, frame);
        box(0.25, 3.4, 0.4, x + 1.22, 1.7, z, frame);
        box(2.7, 0.25, 0.4, x,        3.3, z, frame);

        // Pivot
        this.pivotGroup = new THREE.Group();
        this.pivotGroup.position.set(x - 1.1, 0, z);
        scene.add(this.pivotGroup);

        // Core Panel
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.1, 0.14), wood);
        panel.position.set(1.1, 1.55, 0);
        panel.castShadow = true; panel.receiveShadow = true;
        this.pivotGroup.add(panel);

        // Insets
        const mkInsetPanel = (px, py, pw, ph) => {
            const inset = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.04), wood);
            inset.position.set(px, py, 0.06); 
            inset.castShadow = true;
            this.pivotGroup.add(inset);

            const insetBack = inset.clone();
            insetBack.position.z = -0.06; 
            this.pivotGroup.add(insetBack);
        };

        mkInsetPanel(0.6, 2.2, 0.7, 0.9);
        mkInsetPanel(1.6, 2.2, 0.7, 0.9);
        mkInsetPanel(0.6, 0.9, 0.7, 1.1);
        mkInsetPanel(1.6, 0.9, 0.7, 1.1);

        // Handle
        const knobM = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), knob);
        knobM.position.set(1.95, 1.5, 0.12);
        knobM.castShadow = true;
        this.pivotGroup.add(knobM);
        
        const knobMBack = knobM.clone();
        knobMBack.position.z = -0.12;
        this.pivotGroup.add(knobMBack);
    }
}