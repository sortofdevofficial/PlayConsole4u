import * as THREE from 'three';

export const CHUNK_SIZE = 16;

export const BLOCK_COLORS = {
  grass:          '#559944',
  dirt:           '#6b4226',
  stone:          '#888888',
  oak_log:        '#6b4f2a',
  oak_leaves:     '#2d7a1f',
  oak_plank:      '#c8a45a',
  crafting_table: '#8B5E3C',
  stick:          '#a07040',
};

const COLOR_HEX = {
  grass:          0x559944,
  dirt:           0x6b4226,
  stone:          0x888888,
  oak_log:        0x6b4f2a,
  oak_leaves:     0x2d7a1f,
  oak_plank:      0xc8a45a,
  crafting_table: 0x8B5E3C,
  stick:          0xa07040,
};

export const SLOT_LABELS = {
  grass:'Grass', dirt:'Dirt', stone:'Stone',
  oak_log:'Oak Log', oak_leaves:'Leaves',
  oak_plank:'Oak Plank', crafting_table:'Craft Tbl',
  stick:'Stick'
};

const BLOCK_GEO = new THREE.BoxGeometry(1, 1, 1);
const DROP_GEO  = new THREE.BoxGeometry(0.32, 0.32, 0.32);
const _mats = {};
function getMat(type) {
  if (!_mats[type]) _mats[type] = new THREE.MeshLambertMaterial({ color: COLOR_HEX[type] ?? 0xffffff });
  return _mats[type];
}

export const world = {};
export const drops = [];
let _scene;

export function initWorld(scene) {
  _scene = scene;
  for (let cx = -2; cx < 2; cx++)
    for (let cz = -2; cz < 2; cz++)
      _genChunk(cx, cz);
}

function _genChunk(cx, cz) {
  const bx = cx * CHUNK_SIZE, bz = cz * CHUNK_SIZE;
  for (let lx = 0; lx < CHUNK_SIZE; lx++)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      _place(bx+lx, 0, bz+lz, 'grass');
      _place(bx+lx,-1, bz+lz, 'dirt');
    }
  for (let i = 0; i < 3; i++) {
    const ox = bx + 2 + Math.floor(Math.random()*(CHUNK_SIZE-4));
    const oz = bz + 2 + Math.floor(Math.random()*(CHUNK_SIZE-4));
    if (Math.abs(ox) > 4 || Math.abs(oz) > 4) { _place(ox,1,oz,'stone'); _place(ox,2,oz,'stone'); }
  }
  if (Math.random() < 0.85) {
    const tx = bx + 3 + Math.floor(Math.random()*(CHUNK_SIZE-6));
    const tz = bz + 3 + Math.floor(Math.random()*(CHUNK_SIZE-6));
    if (Math.abs(tx) > 5 || Math.abs(tz) > 5) _tree(tx, 1, tz);
  }
}

function _tree(x, by, z) {
  const h = 4 + Math.floor(Math.random()*2);
  for (let y = by; y < by+h; y++) _place(x, y, z, 'oak_log');
  const top = by+h;
  _place(x, top+1, z, 'oak_leaves');
  for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++) _place(x+dx,top,z+dz,'oak_leaves');
  for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) {
    if (Math.abs(dx)===2&&Math.abs(dz)===2) continue;
    _place(x+dx,top-1,z+dz,'oak_leaves');
  }
  for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++) {
    if (dx===0&&dz===0) continue;
    _place(x+dx,top-2,z+dz,'oak_leaves');
  }
}

function _place(x, y, z, type) {
  const rx=Math.round(x), ry=Math.round(y), rz=Math.round(z);
  const key=`${rx},${ry},${rz}`;
  if (world[key]) return;
  const mesh = new THREE.Mesh(BLOCK_GEO, getMat(type));
  mesh.position.set(rx, ry, rz);
  mesh.userData.blockType = type;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  _scene.add(mesh);
  world[key] = mesh;
}

export function addBlock(x, y, z, type) { _place(x,y,z,type); }

export function removeBlock(x, y, z) {
  const key=`${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
  const mesh = world[key];
  if (!mesh) return null;
  _scene.remove(mesh);
  delete world[key];
  return mesh;
}

export function checkCollision(x, y, z) {
  return !!world[`${Math.round(x)},${Math.round(y)},${Math.round(z)}`];
}

export function spawnDrop(pos, type) {
  const mesh = new THREE.Mesh(DROP_GEO, getMat(type).clone());
  mesh.position.set(pos.x, pos.y+0.3, pos.z);
  mesh.userData.blockType = type;
  mesh.userData.vy = 2.5;
  mesh.userData.onGround = false;
  _scene.add(mesh);
  drops.push(mesh);
}

export function removeDrop(mesh) {
  const i = drops.indexOf(mesh);
  if (i > -1) drops.splice(i, 1);
  _scene.remove(mesh);
}

export function updateDrops(dt) {
  for (const d of drops) {
    d.rotation.y += (d.userData.onGround ? 1.2 : 2.5)*dt;
    if (d.userData.onGround) continue;
    d.userData.vy -= 20*dt;
    const ny = d.position.y + d.userData.vy*dt;
    const fy = Math.round(ny-0.15);
    if (checkCollision(d.position.x, fy, d.position.z)) {
      d.userData.vy=0; d.userData.onGround=true;
      d.position.y = fy+0.65;
    } else { d.position.y=ny; }
  }
}