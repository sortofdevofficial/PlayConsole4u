import * as THREE from 'three';

// PlayerMovement's two functions run unconditionally every single frame regardless
// of player state — the hottest path in the game. The old version allocated 8-12
// new Vector3/Euler objects per frame here alone (hundreds/sec), which is a classic
// source of GC-driven frame hitches. Everything reusable is now a module-level
// scratch object, reset with .set()/.copy() instead of `new` every call.
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _inputDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _rightVec = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _offsetDir = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _targetCamPosition = new THREE.Vector3();
const _euler = new THREE.Euler();
const _furnacePos = new THREE.Vector3();
const _dollyPos = new THREE.Vector3();
const _finalCamPos = new THREE.Vector3();

export function updateMovement(player, deltaTime, platformWidth = 80, platformLength = 80) {
    player.isCrouching = player.keys.crouch && player.isGrounded;
    player.crouchAmount += ((player.isCrouching ? 1 : 0) - player.crouchAmount) * Math.min(1, 12 * deltaTime);
    const currentMaxSpeed = player.isCrouching ? player.crouchSpeed : player.walkSpeed;

    _fwd.set(0, 0, -1).applyAxisAngle(_upAxis, player.yaw);
    _right.set(1, 0, 0).applyAxisAngle(_upAxis, player.yaw);

    _inputDir.set(0, 0, 0);
    if (player.keys.forward) _inputDir.add(_fwd);
    if (player.keys.backward) _inputDir.addScaledVector(_fwd, -1);
    if (player.keys.left) _inputDir.addScaledVector(_right, -1);
    if (player.keys.right) _inputDir.add(_right);
    const isMoving = _inputDir.lengthSq() > 0;
    if (isMoving) _inputDir.normalize();

    const control = player.isGrounded ? 1.0 : player.airControl;
    const rate = (isMoving ? player.acceleration : player.deceleration) * control;
    const targetVX = _inputDir.x * currentMaxSpeed;
    const targetVZ = _inputDir.z * currentMaxSpeed;
    player.velocity.x += (targetVX - player.velocity.x) * Math.min(1, rate * deltaTime);
    player.velocity.z += (targetVZ - player.velocity.z) * Math.min(1, rate * deltaTime);

    if (player.velocity.y < 0) player.fallSpeed = player.velocity.y;
    player.velocity.y -= player.gravity * deltaTime;

    player.mesh.position.copy(player.position);
    player.position.addScaledVector(player.velocity, deltaTime);

    const halfW = platformWidth / 2;
    const halfL = platformLength / 2;
    const overPlatform = (player.position.x >= -halfW && player.position.x <= halfW &&
                           player.position.z >= -halfL && player.position.z <= halfL);

    const wasGrounded = player.isGrounded;
    if (overPlatform && player.position.y <= 0) {
        if (!wasGrounded) player.landingSquash = Math.min(1, Math.abs(player.fallSpeed) / 20);
        player.position.y = 0; player.velocity.y = 0; player.isGrounded = true;
    } else {
        player.isGrounded = false;
    }

    if (wasGrounded && !player.isGrounded) player.coyoteTimer = player.coyoteTime;
    else if (player.coyoteTimer > 0) player.coyoteTimer -= deltaTime;

    if (player.keys.jump) player.jumpBufferTimer = player.jumpBuffer;
    if (player.jumpBufferTimer > 0) player.jumpBufferTimer -= deltaTime;

    const canJump = (player.isGrounded || player.coyoteTimer > 0) && !player.isCrouching;
    if (player.jumpBufferTimer > 0 && canJump) {
        player.velocity.y = player.jumpForce;
        player.isGrounded = false;
        player.coyoteTimer = 0;
        player.jumpBufferTimer = 0;
    }

    player.landingSquash += (0 - player.landingSquash) * Math.min(1, 14 * deltaTime);

    if (player.position.y < -15) {
        player.position.set(0, 2, 0);
        player.velocity.set(0, 0, 0);
    }

    // Returns the shared scratch object — safe because updateAnimationAndCamera runs
    // synchronously right after, within the same frame, before anything can mutate it.
    return _inputDir;
}

export function updateAnimationAndCamera(player, deltaTime, inputDir) {
    const lLeg = player.parts.leftLeg, rLeg = player.parts.rightLeg;
    const lArm = player.parts.leftArm, rArm = player.parts.rightArm;
    const hipBase = player.crouchAmount * 0.6;
    const armBase = player.crouchAmount * 0.2;
    const ease = Math.min(1, 12 * deltaTime);
    const isMoving = inputDir.lengthSq() > 0;

    // Was `new THREE.Vector2(...).length()` — a fresh Vector2 every frame for a
    // 2D magnitude that's just as cheap via Math.sqrt directly.
    const vx = player.velocity.x, vz = player.velocity.z;
    const speedRatio = Math.sqrt(vx * vx + vz * vz) / player.walkSpeed;
    player.currentSpeedFactor += (Math.min(speedRatio, 1) - player.currentSpeedFactor) * ease;

    const squashY = 1 - player.landingSquash * 0.15;
    const squashXZ = 1 + player.landingSquash * 0.1;
    player.mesh.scale.set(squashXZ, squashY, squashXZ);

    player.parts.hips.visible = true; player.parts.spine.visible = true;
    lLeg.hipJoint.visible = true; rLeg.hipJoint.visible = true;
    lArm.shoulder.rotation.set(0, 0, 0); rArm.shoulder.rotation.set(0, 0, 0);
    lArm.lowerArm.rotation.set(0, 0, 0); rArm.lowerArm.rotation.set(0, 0, 0);
    lLeg.hipJoint.rotation.set(0, 0, 0); rLeg.hipJoint.rotation.set(0, 0, 0);
    player.parts.spine.rotation.x = 0;
    lArm.shoulder.position.set(-0.34, 0.5, 0); rArm.shoulder.position.set(0.34, 0.5, 0);

    lArm.shoulderCap.visible = true; rArm.shoulderCap.visible = true;
    lArm.upperArmMesh.visible = true; rArm.upperArmMesh.visible = true;
    lArm.lowerArmMesh.visible = true; rArm.lowerArmMesh.visible = true;
    lArm.hand.visible = true; rArm.hand.visible = true;

    if (player.viewMode === 0) {
        player.parts.hips.visible = false; player.parts.spine.visible = false;
        lLeg.hipJoint.visible = false; rLeg.hipJoint.visible = false;

        lArm.shoulderCap.visible = false; rArm.shoulderCap.visible = false;
        lArm.upperArmMesh.visible = false; rArm.upperArmMesh.visible = false;
        lArm.lowerArmMesh.visible = false; rArm.lowerArmMesh.visible = false;
        lArm.hand.visible = false; rArm.hand.visible = false;

        lArm.shoulder.position.set(-0.22, 0.32, -0.28);
        rArm.shoulder.position.set(0.24, 0.3, -0.25);
        lArm.shoulder.rotation.set(0.65, 0.25, 0);
        rArm.shoulder.rotation.set(0.5, -0.15, 0);
        rArm.lowerArm.rotation.set(0.35, 0, 0);

        player.applySwingPose(rArm, true);

        player.mesh.rotation.y = player.yaw;

        let bobY = 0, bobX = 0;
        if (isMoving && player.isGrounded) {
            player.bobTime += deltaTime * (player.isCrouching ? 6 : 9) * Math.max(0.3, player.currentSpeedFactor);
            bobY = Math.abs(Math.sin(player.bobTime)) * 0.05 * player.currentSpeedFactor;
            bobX = Math.sin(player.bobTime * 0.5) * 0.035 * player.currentSpeedFactor;
        } else {
            player.bobTime = 0;
        }
        _rightVec.set(1, 0, 0).applyAxisAngle(_upAxis, player.yaw);

        _targetCamPosition.copy(player.position);
        _targetCamPosition.y += 1.65 - (player.crouchAmount * 0.6) + bobY;
        _targetCamPosition.addScaledVector(_rightVec, bobX);
        player.camera.position.lerp(_targetCamPosition, 0.45);

        const targetFov = player.baseFov + player.landingSquash * 4;
        player.camera.fov += (targetFov - player.camera.fov) * Math.min(1, 10 * deltaTime);
        player.camera.updateProjectionMatrix();

        _euler.set(player.pitch, player.yaw, 0, 'YXZ');
        _lookDir.set(0, 0, -1).applyEuler(_euler);
        _lookDir.add(player.camera.position);
        player.camera.lookAt(_lookDir);
    } else {
        if (isMoving) {
            const targetRot = Math.atan2(inputDir.x, inputDir.z);
            let diff = targetRot - player.mesh.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            player.mesh.rotation.y += diff * 10 * deltaTime;
        }

        if (player.currentSpeedFactor > 0.05 && player.isGrounded) {
            player.animTime += deltaTime * 12;
            const t = player.animTime;
            lLeg.hipJoint.rotation.x = hipBase + Math.sin(t) * 0.5;
            rLeg.hipJoint.rotation.x = hipBase - Math.sin(t) * 0.5;
            lArm.shoulder.rotation.x = armBase - Math.sin(t) * 0.5;
            rArm.shoulder.rotation.x = armBase + Math.sin(t) * 0.5;
        } else if (!player.isGrounded) {
            const tuck = 0.4;
            lLeg.hipJoint.rotation.x += (tuck - lLeg.hipJoint.rotation.x) * ease;
            rLeg.hipJoint.rotation.x += (tuck - rLeg.hipJoint.rotation.x) * ease;
        }

        player.applySwingPose(rArm, false);

        _euler.set(player.pitch, player.yaw, 0, 'YXZ');
        _offsetDir.set(0, 0, 1).applyEuler(_euler);
        _camPos.copy(player.position).addScaledVector(_offsetDir, 5.5);
        _camPos.y += 1.6;
        player.camera.position.lerp(_camPos, 0.4);

        _lookDir.copy(player.position);
        _lookDir.y += 1.0;
        player.camera.lookAt(_lookDir);
    }

    // Cutscene dolly during timed crafting. (Also removed a redundant double
    // camera.lookAt() call the old version had — the first call's result was
    // immediately discarded by the second, pure wasted work.)
    const cs = player.craftState;
    if (cs.active && cs.furnaceRef) {
        const t = Math.min(1, cs.timer / cs.duration);
        let cutIn;
        if (t < 0.25) cutIn = t / 0.25;
        else if (t < 0.75) cutIn = 1;
        else cutIn = 1 - (t - 0.75) / 0.25;

        _furnacePos.copy(cs.furnaceRef.position);
        _furnacePos.y += 0.9;
        _dollyPos.copy(cs.furnaceRef.position);
        _dollyPos.y += 1.3;
        _dollyPos.z += 2.4;

        _finalCamPos.copy(player.camera.position).lerp(_dollyPos, cutIn * 0.85);
        player.camera.position.copy(_finalCamPos);
        player.camera.lookAt(_furnacePos);
    }
}