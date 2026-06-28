import * as THREE from 'three';

export default class Tire {
    constructor(scene) {
        this.group = new THREE.Group();
        
        // Tire compound structure mesh
        const tireGeo = new THREE.TorusGeometry(0.5, 0.22, 12, 24);
        const tireMat = new THREE.MeshStandardMaterial({ 
            color: '#1e293b', 
            roughness: 0.9,
            metalness: 0.2 
        });
        
        this.mesh = new THREE.Mesh(tireGeo, tireMat);
        this.mesh.rotation.x = Math.PI / 2; // Flat position layout
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        this.group.add(this.mesh);
        scene.add(this.mesh);
    }
}