import * as THREE from 'three';

const FLOW_DOT_COUNT = 3;
const FLOW_SPEED = 0.5;

// A glowing line + flowing dots between two points. Used for both CONFIRMED links
// (green) and a live PREVIEW while placing (amber) so the player can see what will
// connect before they even commit to placing it.
export function createLinkConnector(scene, color = 0x2ecc71, opacity = 0.55) {
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, lineMat);
    line.visible = false;
    scene.add(line);

    const dotGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const dotMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, roughness: 0.4 });
    const dots = [];
    for (let i = 0; i < FLOW_DOT_COUNT; i++) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.visible = false;
        scene.add(dot);
        dots.push(dot);
    }

    const fromP = new THREE.Vector3();
    const toP = new THREE.Vector3();
    let visible = false;

    return {
        setEndpoints(from, to) {
            fromP.copy(from);
            toP.copy(to);
            const posAttr = lineGeo.attributes.position;
            posAttr.setXYZ(0, fromP.x, fromP.y, fromP.z);
            posAttr.setXYZ(1, toP.x, toP.y, toP.z);
            posAttr.needsUpdate = true;
        },
        setVisible(v) {
            visible = v;
            line.visible = v;
            dots.forEach(d => d.visible = v);
        },
        tick(time) {
            if (!visible) return;
            dots.forEach((dot, i) => {
                const t = ((time * FLOW_SPEED) + i / FLOW_DOT_COUNT) % 1;
                dot.position.lerpVectors(fromP, toP, t);
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