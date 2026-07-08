import * as THREE from 'three';

const FLOW_DOT_COUNT = 3;
const FLOW_SPEED = 0.5; // loops per second

// A thin glowing line + a few small dots that travel from source to target — this is
// what makes a link's existence AND direction visible from anywhere, instead of only
// being obvious if you happen to be standing right next to the machines.
export function createLinkConnector(scene) {
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.55 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);

    const dotGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x2ecc71, emissiveIntensity: 1.3, roughness: 0.4 });
    const dots = [];
    for (let i = 0; i < FLOW_DOT_COUNT; i++) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        scene.add(dot);
        dots.push(dot);
    }

    const fromP = new THREE.Vector3();
    const toP = new THREE.Vector3();

    return {
        setEndpoints(from, to) {
            fromP.copy(from);
            toP.copy(to);
            const posAttr = lineGeo.attributes.position;
            posAttr.setXYZ(0, fromP.x, fromP.y + 0.08, fromP.z);
            posAttr.setXYZ(1, toP.x, toP.y + 0.08, toP.z);
            posAttr.needsUpdate = true;
        },
        tick(time) {
            dots.forEach((dot, i) => {
                const t = ((time * FLOW_SPEED) + i / FLOW_DOT_COUNT) % 1;
                dot.position.lerpVectors(fromP, toP, t);
                dot.position.y += 0.08;
            });
        },
        dispose() {
            scene.remove(line);
            lineGeo.dispose();
            lineMat.dispose();
            dots.forEach(d => scene.remove(d));
            dotGeo.dispose();
            dotMat.dispose();
        }
    };
}