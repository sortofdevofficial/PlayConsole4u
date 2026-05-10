import * as THREE from 'three';

// ── Shared statics ────────────────────────────────────────────────────────────
const ZOMBIE_RADIUS = 0.5;
const WALK_SPEED    = 0.075;   // faster
const GRAVITY       = 22;
const JUMP_VEL      = 7.5;
const BURN_TICK     = 1.2;     // seconds between burn damage ticks

const _diff = new THREE.Vector3();
const _move = new THREE.Vector3();
const _flat = new THREE.Vector3();

// Shared base materials (cloned per instance)
const M = {
  skin:   new THREE.MeshLambertMaterial({ color: 0x799c65 }),
  dark:   new THREE.MeshLambertMaterial({ color: 0x4a6e3a }),
  shirt:  new THREE.MeshLambertMaterial({ color: 0x3c6eb4 }),
  pants:  new THREE.MeshLambertMaterial({ color: 0x253a60 }),
  eye:    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  pupil:  new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  mouth:  new THREE.MeshLambertMaterial({ color: 0x2a1a0a }),
  shoe:   new THREE.MeshLambertMaterial({ color: 0x1a1008 }),
};

export class Zombie {
  constructor(scene, position) {
    this.scene  = scene;
    this.hp     = 3;
    this.alive  = true;
    this.group  = new THREE.Group();
    this._phase = Math.random() * Math.PI * 2;

    // Physics state
    this._vy           = 0;
    this._onGround     = true;
    this._jumpCooldown = 0;
    this._burnTimer    = 0;

    // ── Skeleton layout ───────────────────────────────────────────────────
    // group.position.y = 0.5  (origin = top of floor block = y=0 local)
    //
    //   Shoes:    y =  0.00 .. 0.17
    //   Legs:     y =  0.00 .. 0.75   leg pivot (hip) at y=0.75
    //   Torso:    y =  0.75 .. 1.53   center y=1.14
    //   Neck:     y =  1.53 .. 1.68   center y=1.60
    //   Head:     y =  1.68 .. 2.22   center y=1.95
    //   Shoulders: y = 1.53           arm pivots here

    // ── Leg pivots ────────────────────────────────────────────────────────
    this.lLegPivot = new THREE.Group();
    this.rLegPivot = new THREE.Group();
    this.lLegPivot.position.set( 0.155, 0.75, 0);
    this.rLegPivot.position.set(-0.155, 0.75, 0);

    // Leg mesh: centre at y=-0.375 (top at pivot=0, bottom=floor) ✓
    const lLM = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.75, 0.27), M.pants);
    const rLM = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.75, 0.27), M.pants);
    lLM.position.set(0, -0.375, 0);
    rLM.position.set(0, -0.375, 0);

    // Shoe: bottom flush with floor → centre at y = -0.75+0.085 = -0.665 from pivot
    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.17, 0.36), M.shoe);
    const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.17, 0.36), M.shoe);
    lShoe.position.set(0, -0.665, 0.045);
    rShoe.position.set(0, -0.665, 0.045);

    this.lLegPivot.add(lLM, lShoe);
    this.rLegPivot.add(rLM, rShoe);

    // ── Torso ─────────────────────────────────────────────────────────────
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.78, 0.30), M.shirt);
    torso.position.set(0, 1.14, 0);

    // ── Neck ──────────────────────────────────────────────────────────────
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), M.dark);
    neck.position.set(0, 1.61, 0);

    // ── Head ──────────────────────────────────────────────────────────────
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), M.skin);
    head.position.set(0, 1.95, 0);

    // Eyes (white sclera + dark pupil)
    const lEW = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.10, 0.04), M.eye);
    const rEW = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.10, 0.04), M.eye);
    lEW.position.set( 0.13, 1.98, 0.28);
    rEW.position.set(-0.13, 1.98, 0.28);
    const lPu = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), M.pupil);
    const rPu = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), M.pupil);
    lPu.position.set( 0.14, 1.98, 0.295);
    rPu.position.set(-0.14, 1.98, 0.295);

    // Mouth
    const mth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.03), M.mouth);
    mth.position.set(0, 1.80, 0.285);

    // ── Arm pivots at shoulder (y=1.53) ───────────────────────────────────
    this.lArmPivot = new THREE.Group();
    this.rArmPivot = new THREE.Group();
    this.lArmPivot.position.set( 0.42, 1.53, 0);
    this.rArmPivot.position.set(-0.42, 1.53, 0);

    const lAM = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.72, 0.27), M.skin);
    const rAM = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.72, 0.27), M.skin);
    lAM.position.set(0, -0.36, 0);
    rAM.position.set(0, -0.36, 0);
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.20, 0.25), M.dark);
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.20, 0.25), M.dark);
    lHand.position.set(0, -0.78, 0);
    rHand.position.set(0, -0.78, 0);

    this.lArmPivot.add(lAM, lHand);
    this.rArmPivot.add(rAM, rHand);

    // ── Assemble ──────────────────────────────────────────────────────────
    this.group.add(
      this.lLegPivot, this.rLegPivot,
      torso, neck, head,
      lEW, rEW, lPu, rPu, mth,
      this.lArmPivot, this.rArmPivot
    );

    this.group.position.copy(position);
    this.group.userData.zombieInstance = this;
    scene.add(this.group);

    // Clone materials per zombie → independent hit flash
    this._meshes = [];
    this.group.traverse(c => {
      if (c.isMesh) { c.material = c.material.clone(); this._meshes.push(c); }
    });

    // Default pose: arms forward (zombie)
    this.lArmPivot.rotation.x = -Math.PI / 2;
    this.rArmPivot.rotation.x = -Math.PI / 2;
  }

  takeDamage(amount = 1) {
    if (!this.alive) return;
    this.hp -= amount;
    this._meshes.forEach(c => c.material.emissive?.set(0xaa0000));
    setTimeout(() => {
      if (this.alive) this._meshes.forEach(c => c.material.emissive?.set(0x000000));
    }, 130);
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.group.rotation.x = Math.PI / 2;
    setTimeout(() => this.scene.remove(this.group), 900);
  }

  /**
   * @param {number}        time    performance.now()*0.001
   * @param {number}        dt      delta seconds
   * @param {THREE.Vector3} target  camera.position
   * @param {Function}      onHit
   * @param {boolean}       isDay   burn if true
   * @param {Function}      col     checkCollision(x,y,z)=>bool
   * @param {Zombie[]}      all
   */
  update(time, dt, target, onHit, isDay, col, all) {
    if (!this.alive) return;

    const pos = this.group.position;

    // ── Daytime burning ────────────────────────────────────────────────────
    if (isDay) {
      this._burnTimer += dt;
      const pulse = Math.sin(time * 14) * 0.5 + 0.5;
      this._meshes.forEach(c => c.material.emissive?.setRGB(0.55 * pulse, 0.10 * pulse, 0));
      if (this._burnTimer >= BURN_TICK) {
        this._burnTimer = 0;
        this.takeDamage(0.5);
      }
    } else {
      this._burnTimer = 0;
    }

    // ── Vertical physics ───────────────────────────────────────────────────
    if (!this._onGround) this._vy -= GRAVITY * dt;

    const nextY      = pos.y + this._vy * dt;
    const groundBlk  = Math.round(nextY - 0.5);

    if (this._vy <= 0 && col(pos.x, groundBlk, pos.z)) {
      this._vy      = 0;
      this._onGround = true;
      pos.y          = groundBlk + 0.5;
    } else {
      pos.y = nextY;
      if (pos.y < 0.5) { pos.y = 0.5; this._vy = 0; this._onGround = true; }
      else this._onGround = false;
    }

    // ── Zombie–zombie separation ───────────────────────────────────────────
    for (const other of all) {
      if (other === this || !other.alive) continue;
      _diff.subVectors(pos, other.group.position); _diff.y = 0;
      const d = _diff.length();
      if (d < ZOMBIE_RADIUS * 2 && d > 0.001) {
        _diff.normalize().multiplyScalar((ZOMBIE_RADIUS * 2 - d) * 0.5);
        pos.x += _diff.x; pos.z += _diff.z;
        other.group.position.x -= _diff.x; other.group.position.z -= _diff.z;
      }
    }

    // ── Horizontal targeting ───────────────────────────────────────────────
    _flat.set(target.x, pos.y, target.z);
    const dist  = pos.distanceTo(_flat);
    const yDiff = Math.abs(target.y - (pos.y + 1.0));

    if (this._jumpCooldown > 0) this._jumpCooldown -= dt;

    if (dist > 1.4) {
      _move.subVectors(_flat, pos).normalize().multiplyScalar(WALK_SPEED);
      const wallY = Math.round(pos.y + 0.5); // torso height, avoids detecting floor

      let bX = col(pos.x + _move.x, wallY, pos.z);
      let bZ = col(pos.x, wallY, pos.z + _move.z);

      // Jump: over wall obstacle OR player is above us on a block
      if (this._onGround && this._jumpCooldown <= 0) {
        const wallJump   = (bX && !col(pos.x + _move.x, wallY + 1, pos.z)) ||
                           (bZ && !col(pos.x, wallY + 1, pos.z + _move.z));
        const playerAbove = target.y > pos.y + 1.4;
        if (wallJump || playerAbove) {
          this._vy           = JUMP_VEL;
          this._onGround     = false;
          this._jumpCooldown = 1.4;
          bX = bZ = false;
        }
      }

      if (!bX) pos.x += _move.x;
      if (!bZ) pos.z += _move.z;

      // ── Walk animation ────────────────────────────────────────────────
      const ph = time * 10 + this._phase;
      this.lLegPivot.rotation.x =  Math.sin(ph) * 0.72;
      this.rLegPivot.rotation.x = -Math.sin(ph) * 0.72;

      const swing = this._onGround ? Math.sin(ph + Math.PI) * 0.18 : 0;
      this.lArmPivot.rotation.x = -Math.PI / 2 + swing;
      this.rArmPivot.rotation.x = -Math.PI / 2 - swing;
      this.lArmPivot.rotation.z =  0.06;
      this.rArmPivot.rotation.z = -0.06;

      if (this._onGround) pos.y = 0.5 + Math.abs(Math.sin(ph)) * 0.03;

    } else if (yDiff < 2.5) {
      // ── Attack animation ──────────────────────────────────────────────
      const ph = time * 10;
      this.lArmPivot.rotation.x = -Math.PI / 2 + Math.sin(ph) * 1.15;
      this.rArmPivot.rotation.x = -Math.PI / 2 + Math.sin(ph + Math.PI) * 1.15;
      this.lArmPivot.rotation.z =  0.06;
      this.rArmPivot.rotation.z = -0.06;
      this.lLegPivot.rotation.x = 0;
      this.rLegPivot.rotation.x = 0;
      if (this._onGround) pos.y = 0.5;
      onHit();
    }

    this.group.lookAt(_flat);
  }
}