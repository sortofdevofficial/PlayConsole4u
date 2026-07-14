import * as THREE from 'three';
import { getElevation } from './world.js';

const GRAVITY = 28.0;
const BOUNCE_RESTITUTION = 0.35;
const GROUND_FRICTION = 0.6;
const AIR_DRAG = 0.02;
const SLEEP_VELOCITY_THRESHOLD = 0.05;
const ITEM_RADIUS = 0.18;

const _tmpVel = new THREE.Vector3();

// Explicit initializer -- called by spawnDrop() for the common case. Not
// strictly required (see the defensive self-init below), but keeps intent
// clear at the one place drops are normally created.
export function initDropPhysics(drop, velocity) {
    drop.userData.velocity = velocity || new THREE.Vector3();
    drop.userData.angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6
    );
    drop.userData.isSettled = false;
    drop.userData.bobPhase = Math.random() * Math.PI * 2;
}

// Real physics for a single dropped item: gravity, terrain collision against
// the actual hilly heightmap (getElevation), bounce with restitution, rolling
// friction, and a sleep state so settled items stop being simulated (cheap
// once there are many drops lying around).
//
// Defensively self-initializes missing fields, so it works correctly even on
// drop objects created elsewhere (e.g. Auto Miner's internal ejection code,
// which builds its own userData directly rather than going through
// spawnDrop/initDropPhysics) -- there's no dependency requiring every spawn
// site in the codebase to remember to call initDropPhysics first.
export function stepDropPhysics(drop, deltaTime) {
    if (!drop.userData.velocity) drop.userData.velocity = new THREE.Vector3();
    if (!drop.userData.angularVelocity) {
        drop.userData.angularVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6
        );
    }

    if (drop.userData.isSettled) {
        // Gentle idle bob + spin so a settled item still reads as "alive"
        // without doing any collision math every frame.
        drop.userData.bobPhase = (drop.userData.bobPhase || 0) + deltaTime * 2.2;
        drop.position.y = drop.userData.restY + Math.sin(drop.userData.bobPhase) * 0.03;
        drop.rotation.y += deltaTime * 0.6;
        return;
    }

    const vel = drop.userData.velocity;
    const angVel = drop.userData.angularVelocity;

    vel.y -= GRAVITY * deltaTime;
    vel.x *= (1 - AIR_DRAG);
    vel.z *= (1 - AIR_DRAG);

    drop.position.addScaledVector(vel, deltaTime);
    drop.rotation.x += angVel.x * deltaTime;
    drop.rotation.y += angVel.y * deltaTime;
    drop.rotation.z += angVel.z * deltaTime;

    const groundY = getElevation(drop.position.x, drop.position.z) + ITEM_RADIUS;

    if (drop.position.y <= groundY) {
        drop.position.y = groundY;

        if (Math.abs(vel.y) > 0.4) {
            // Real bounce: invert vertical velocity, keep a fraction of the
            // energy (restitution), bleed off horizontal speed (friction) so
            // each successive bounce loses momentum overall.
            vel.y = -vel.y * BOUNCE_RESTITUTION;
            vel.x *= GROUND_FRICTION;
            vel.z *= GROUND_FRICTION;
            angVel.multiplyScalar(0.6);
        } else {
            vel.y = 0;
            vel.x *= 0.85;
            vel.z *= 0.85;
            angVel.multiplyScalar(0.85);
        }

        _tmpVel.set(vel.x, 0, vel.z);
        if (_tmpVel.lengthSq() < SLEEP_VELOCITY_THRESHOLD * SLEEP_VELOCITY_THRESHOLD &&
            Math.abs(vel.y) < SLEEP_VELOCITY_THRESHOLD) {
            drop.userData.isSettled = true;
            drop.userData.restY = groundY;
            drop.userData.bobPhase = drop.userData.bobPhase || 0;
            vel.set(0, 0, 0);
            angVel.set(0, 0, 0);
        }
    }
}