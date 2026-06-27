import * as THREE from 'three';

export default class Environment {
    constructor(scene) {
        this.targets = []; 

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(20, 30, 10);
        sun.castShadow = true;
        sun.shadow.camera.top = 20;
        sun.shadow.camera.bottom = -20;
        sun.shadow.camera.left = -20;
        sun.shadow.camera.right = 20;
        scene.add(sun);

        const floorGeo = new THREE.PlaneGeometry(60, 60);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        this.targets.push(floor);

        const colors = ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#d946ef'];
        for (let i = 0; i < 5; i++) {
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(8, 6, 1),
                new THREE.MeshStandardMaterial({ color: colors[i] })
            );
            wall.position.set(-20 + (i * 10), 3, -10);
            wall.castShadow = true;
            wall.receiveShadow = true;
            scene.add(wall);
            this.targets.push(wall);
        }
    }
}