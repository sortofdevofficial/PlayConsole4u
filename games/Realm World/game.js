import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Zombie } from './zombie.js';
import {
  world, drops,
  initWorld, addBlock, removeBlock, checkCollision,
  spawnDrop, removeDrop, updateDrops,
  BLOCK_COLORS, SLOT_LABELS
} from './world.js';

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 40, 90);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 500);
camera.position.set(0, 5, 0);

const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Lighting ──────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);
const sun  = new THREE.DirectionalLight(0xfff5cc, 1.1); sun.position.set(50,80,30);  scene.add(sun);
const moon = new THREE.DirectionalLight(0x7788cc, 0.0); moon.position.set(-50,80,-30); scene.add(moon);

// ── Day / Night (20 s cycle) ──────────────────────────────────────────────────
const DAY_DUR  = 20;
const SKY_DAY  = new THREE.Color(0x87CEEB);
const SKY_DUSK = new THREE.Color(0xff7744);
const SKY_NIGHT= new THREE.Color(0x080818);
const _sky     = new THREE.Color();
let dayTime    = 0;
let isDay      = true; // exported to zombie logic

function updateDayNight(dt) {
  dayTime = (dayTime + dt/DAY_DUR) % 1;
  const t = dayTime;
  let si, ai, mi;
  if      (t < 0.25){ const f=t/0.25;        _sky.copy(SKY_DUSK).lerp(SKY_DAY,f);   si=THREE.MathUtils.lerp(0.1,1.1,f);  ai=THREE.MathUtils.lerp(0.25,0.9,f); mi=0; }
  else if (t < 0.50){ const f=(t-0.25)/0.25;  _sky.copy(SKY_DAY).lerp(SKY_DUSK,f);   si=THREE.MathUtils.lerp(1.1,0.1,f);  ai=THREE.MathUtils.lerp(0.9,0.25,f); mi=0; }
  else if (t < 0.75){ const f=(t-0.5)/0.25;   _sky.copy(SKY_DUSK).lerp(SKY_NIGHT,f); si=0; ai=THREE.MathUtils.lerp(0.25,0.06,f); mi=THREE.MathUtils.lerp(0,0.45,f); }
  else              { const f=(t-0.75)/0.25;  _sky.copy(SKY_NIGHT).lerp(SKY_DUSK,f); si=0; ai=THREE.MathUtils.lerp(0.06,0.25,f); mi=THREE.MathUtils.lerp(0.45,0,f); }

  scene.background=_sky; scene.fog.color.copy(_sky);
  ambientLight.intensity=ai; sun.intensity=si; moon.intensity=mi;
  const a=t*Math.PI*2;
  sun.position.set(Math.sin(a)*80,Math.cos(a)*80,20);
  moon.position.set(-Math.sin(a)*80,-Math.cos(a)*80,20);

  // isDay = sun is above horizon (morning–evening)
  isDay = t > 0.05 && t < 0.95;

  const ti = document.getElementById('time-indicator');
  if (ti) ti.textContent = t<0.05||t>0.95?'🌅 Dawn':t<0.45?'☀️ Day':t<0.55?'🌆 Dusk':'🌙 Night';
}

// ── World ─────────────────────────────────────────────────────────────────────
initWorld(scene);

// ── Hand ──────────────────────────────────────────────────────────────────────
const hand = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.25, 0.6),
  new THREE.MeshLambertMaterial({ color: 0xdbac82 })
);
hand.position.set(0.38, -0.38, -0.58);
camera.add(hand);
scene.add(camera);

// ── Inventory ─────────────────────────────────────────────────────────────────
// key→count map (source of truth)
const inventory = {};

// Items that cannot be placed as world blocks
const NON_PLACEABLE = new Set(['stick', 'oak_leaves']);

function addToInventory(type, n=1) {
  inventory[type] = (inventory[type]||0) + n;
  rebuildHotbar();
  if (inventoryOpen) renderInvScreen();
}
function removeFromInventory(type, n=1) {
  if (!inventory[type]) return false;
  inventory[type] -= n;
  if (inventory[type] <= 0) delete inventory[type];
  rebuildHotbar();
  if (inventoryOpen) renderInvScreen();
  return true;
}
function getCount(type) { return inventory[type]||0; }

// ── Hotbar — always 9 slots, filled from inventory ───────────────────────────
// Slot 1-9: mapped to 9 unique types you own (or empty)
let selectedType = null;

function getHotbarTypes() {
  return Object.keys(inventory).filter(t=>inventory[t]>0).slice(0,9);
}

function rebuildHotbar() {
  const el = document.getElementById('hotbar');
  if (!el) return;
  const types = getHotbarTypes();

  if (selectedType && !types.includes(selectedType)) selectedType = types[0]||null;
  if (!selectedType && types.length > 0) selectedType = types[0];

  el.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const type = types[i] || null;
    const div  = document.createElement('div');
    div.className = 'slot' + (type && type===selectedType ? ' selected' : '') + (!type ? ' empty-slot' : '');
    div.innerHTML = `<span class="slot-num">${i+1}</span>`;
    if (type) {
      div.dataset.type = type;
      div.innerHTML += `
        <div class="block-icon" style="background:${BLOCK_COLORS[type]||'#888'}"></div>
        <div class="slot-name">${SLOT_LABELS[type]||type}</div>
        <div class="slot-count">${inventory[type]}</div>`;
      div.addEventListener('click', () => { selectedType = type; rebuildHotbar(); });
    }
    el.appendChild(div);
  }
}

function selectSlotByIndex(i) {
  const types = getHotbarTypes();
  if (types[i]) { selectedType = types[i]; rebuildHotbar(); }
}

rebuildHotbar();

// ── Crafting recipes ──────────────────────────────────────────────────────────
// Each recipe: { match(slots)=>bool, consume:{type:n,...}, output:{type,count} }
// Slots = flat array of types (or null). Shape-matching: find bounding box, compare.

function _boundingBox(slots, cols) {
  let r1=99,r2=-1,c1=99,c2=-1;
  const rows = Math.ceil(slots.length/cols);
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if(slots[r*cols+c]){r1=Math.min(r1,r);r2=Math.max(r2,r);c1=Math.min(c1,c);c2=Math.max(c2,c);}
  }
  if(r2<0) return null;
  const shape=[];
  for(let r=r1;r<=r2;r++){const row=[];for(let c=c1;c<=c2;c++)row.push(slots[r*cols+c]||null);shape.push(row);}
  return shape;
}

function _shapeMatch(shape, pattern) {
  if(shape.length!==pattern.length) return false;
  for(let r=0;r<shape.length;r++){
    if(shape[r].length!==pattern[r].length) return false;
    for(let c=0;c<shape[r].length;c++) if((shape[r][c]||null)!==(pattern[r][c]||null)) return false;
  }
  return true;
}

const RECIPES_2x2 = [
  // Oak Log → Oak Plank ×4
  { pattern:[['oak_log']], consume:{oak_log:1}, output:{type:'oak_plank',count:4} },
  // 2 Planks stacked → Stick ×4
  { pattern:[['oak_plank'],['oak_plank']], consume:{oak_plank:2}, output:{type:'stick',count:4} },
  // 2×2 Planks → Crafting Table
  { pattern:[['oak_plank','oak_plank'],['oak_plank','oak_plank']], consume:{oak_plank:4}, output:{type:'crafting_table',count:1} },
];

const RECIPES_3x3 = [
  { pattern:[['oak_log']], consume:{oak_log:1}, output:{type:'oak_plank',count:4} },
  { pattern:[['oak_plank'],['oak_plank']], consume:{oak_plank:2}, output:{type:'stick',count:4} },
  { pattern:[['oak_plank','oak_plank'],['oak_plank','oak_plank']], consume:{oak_plank:4}, output:{type:'crafting_table',count:1} },
];

function matchRecipe(slots, cols, recipes) {
  const shape = _boundingBox(slots, cols);
  if (!shape) return null;
  for (const r of recipes) {
    if (_shapeMatch(shape, r.pattern)) {
      // Check we have enough in inventory + craft grid combined
      const gridCounts = {};
      slots.forEach(t => { if(t) gridCounts[t]=(gridCounts[t]||0)+1; });
      let ok = true;
      for (const [t,n] of Object.entries(r.consume)) {
        if ((gridCounts[t]||0) < n) { ok=false; break; }
      }
      if (ok) return r;
    }
  }
  return null;
}

// ── Inventory / Crafting UI ───────────────────────────────────────────────────
let inventoryOpen  = false;
let craftTableMode = false;
const invScreen    = document.getElementById('inventory-screen');

// 2×2 craft grid (indices 0-3) and 3×3 (indices 0-8)
const craftSlots2 = new Array(4).fill(null);
const craftSlots3 = new Array(9).fill(null);

// Which craft cell the player last clicked (for placing items)
let selectedCraftCell = -1;

function openInventory(tableMode=false) {
  inventoryOpen = true; craftTableMode = tableMode;
  invScreen.style.display='flex';
  controls.unlock();
  renderInvScreen();
}

function closeInventory() {
  // Return all craft items to inventory
  const slots = craftTableMode ? craftSlots3 : craftSlots2;
  slots.forEach((t,i)=>{ if(t){ addToInventory(t); slots[i]=null; } });
  inventoryOpen = craftTableMode = false;
  invScreen.style.display='none';
  selectedCraftCell = -1;
}

function renderInvScreen() {
  const slots   = craftTableMode ? craftSlots3 : craftSlots2;
  const cols    = craftTableMode ? 3 : 2;
  const total   = cols*cols;
  const recipes = craftTableMode ? RECIPES_3x3 : RECIPES_2x2;

  const titleEl = document.getElementById('inv-title');
  if (titleEl) titleEl.textContent = craftTableMode ? 'Crafting Table (3×3)' : 'Crafting (2×2)';

  // ── 20-slot inventory grid ────────────────────────────────────────────
  const igEl = document.getElementById('inv-grid');
  if (igEl) {
    igEl.innerHTML = '';
    // Always render 20 cells
    const types = Object.keys(inventory).filter(t=>inventory[t]>0);
    for (let i = 0; i < 20; i++) {
      const type = types[i] || null;
      const cnt  = type ? inventory[type] : 0;
      const cell = document.createElement('div');
      cell.className = 'inv-cell' + (type ? '' : ' inv-empty');
      if (type) {
        cell.innerHTML = `
          <div class="inv-icon-wrap" style="background:${BLOCK_COLORS[type]||'#888'}"></div>
          <div class="inv-label">${SLOT_LABELS[type]||type}</div>
          <div class="inv-count">${cnt}</div>`;
        // Click: place into selected craft cell, or first empty cell
        cell.addEventListener('click', () => {
          if (!type || cnt <= 0) return;
          let idx = selectedCraftCell >= 0 && !slots[selectedCraftCell]
            ? selectedCraftCell
            : slots.indexOf(null);
          if (idx === -1) return;
          if (!removeFromInventory(type, 1)) return;
          slots[idx] = type;
          selectedCraftCell = -1;
          renderInvScreen();
        });
      }
      igEl.appendChild(cell);
    }
  }

  // ── Craft grid ────────────────────────────────────────────────────────
  const cgEl = document.getElementById('craft-grid-inner');
  if (cgEl) {
    cgEl.style.gridTemplateColumns = `repeat(${cols}, 48px)`;
    cgEl.style.gridTemplateRows    = `repeat(${cols}, 48px)`;
    cgEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const type = slots[i];
      const cell = document.createElement('div');
      cell.className = 'craft-cell';
      if (i === selectedCraftCell) cell.style.outline = '2px solid #ffd700';

      if (type) {
        cell.innerHTML = `
          <div style="width:32px;height:32px;background:${BLOCK_COLORS[type]||'#888'};border-radius:2px;border:1px solid rgba(0,0,0,0.3)"></div>
          <div class="inv-count">${''}</div>`;
        // Click occupied cell → return to inventory
        cell.addEventListener('click', () => {
          addToInventory(slots[i]);
          slots[i] = null;
          selectedCraftCell = -1;
          renderInvScreen();
        });
      } else {
        // Click empty cell → mark as target for next inventory click
        cell.addEventListener('click', () => {
          // If we have a selected type, place it here directly
          if (selectedType && getCount(selectedType) > 0) {
            if (!removeFromInventory(selectedType, 1)) return;
            slots[i] = selectedType;
            selectedCraftCell = -1;
          } else {
            selectedCraftCell = (selectedCraftCell === i) ? -1 : i;
          }
          renderInvScreen();
        });
      }
      cgEl.appendChild(cell);
    }
  }

  // ── Result ────────────────────────────────────────────────────────────
  const resEl = document.getElementById('craft-result');
  if (resEl) {
    const rec = matchRecipe(slots, cols, recipes);
    if (rec) {
      resEl.innerHTML = `
        <div style="width:32px;height:32px;background:${BLOCK_COLORS[rec.output.type]||'#888'};border-radius:2px;border:1px solid rgba(0,0,0,0.3)"></div>
        <div class="inv-count">×${rec.output.count}</div>`;
      resEl.classList.add('active');
      resEl.onclick = () => {
        // Consume from craft grid
        const consume = {...rec.consume};
        for (let i=0; i<slots.length; i++) {
          const t = slots[i];
          if (t && consume[t] > 0) { slots[i]=null; consume[t]--; }
        }
        addToInventory(rec.output.type, rec.output.count);
        renderInvScreen();
      };
    } else {
      resEl.innerHTML=''; resEl.classList.remove('active'); resEl.onclick=null;
    }
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
const controls = new PointerLockControls(camera, document.body);
renderer.domElement.addEventListener('click', () => { if (!inventoryOpen) controls.lock(); });

const move     = { fwd:false, bwd:false, lft:false, rgt:false };
let velocity   = new THREE.Vector3();
let onGround   = false;
let isPunching = false;
let lastHit    = 0;
let attackTime = 0;
const ATTACK_CD= 0.5;
const knockback= new THREE.Vector3();

window.addEventListener('keydown', e => {
  if (inventoryOpen) { if(e.code==='KeyE'||e.code==='Escape') closeInventory(); return; }
  if (e.code==='KeyE')   { openInventory(false); return; }
  if (e.code==='Escape') { controls.unlock(); return; }
  if (e.code==='KeyW') move.fwd=true;
  if (e.code==='KeyS') move.bwd=true;
  if (e.code==='KeyA') move.lft=true;
  if (e.code==='KeyD') move.rgt=true;
  if (e.code==='Space'&&onGround) { velocity.y=9; onGround=false; }
  const n=parseInt(e.key);
  if (n>=1&&n<=9) selectSlotByIndex(n-1);
});
window.addEventListener('keyup', e => {
  if (e.code==='KeyW') move.fwd=false;
  if (e.code==='KeyS') move.bwd=false;
  if (e.code==='KeyA') move.lft=false;
  if (e.code==='KeyD') move.rgt=false;
});

const _ray=new THREE.Raycaster(), _center=new THREE.Vector2(0,0);

function doBreak() {
  _ray.setFromCamera(_center, camera);
  const hits=_ray.intersectObjects([...Object.values(world),...zombies.map(z=>z.group)],true);
  if (!hits.length||hits[0].distance>5) return;
  const {object:obj}=hits[0];
  let root=obj;
  while(root.parent&&!root.userData.zombieInstance) root=root.parent;
  if (root.userData.zombieInstance) {
    root.userData.zombieInstance.takeDamage();
  } else {
    const type=obj.userData.blockType||'grass';
    const removed=removeBlock(obj.position.x,obj.position.y,obj.position.z);
    if (removed) spawnDrop(obj.position, type);
  }
}

function doPlace() {
  _ray.setFromCamera(_center, camera);
  const hits=_ray.intersectObjects(Object.values(world),true);
  if (!hits.length||hits[0].distance>5) return;
  const {object:obj,face}=hits[0];

  if (obj.userData.blockType==='crafting_table') { openInventory(true); return; }

  if (!selectedType||getCount(selectedType)<=0) return;
  if (NON_PLACEABLE.has(selectedType)) return;

  const p=obj.position.clone().add(face.normal);
  const px=Math.round(p.x),py=Math.round(p.y),pz=Math.round(p.z);
  const cx=Math.round(camera.position.x),cz=Math.round(camera.position.z),cy=Math.round(camera.position.y);
  if (px===cx&&pz===cz&&(py===cy||py===cy-1)) return;

  addBlock(p.x,p.y,p.z,selectedType);
  removeFromInventory(selectedType,1);
}

document.addEventListener('mousedown', e => {
  if (!controls.isLocked||inventoryOpen) return;
  if (e.button===0) {
    isPunching=true; setTimeout(()=>isPunching=false,150);
    const now=performance.now()/1000;
    if (now-attackTime>=ATTACK_CD) { attackTime=now; doBreak(); }
  }
  if (e.button===2) doPlace();
});

// ── Cooldown bar ──────────────────────────────────────────────────────────────
function updateCooldownBar(time) {
  const bar=document.getElementById('cooldown-fill');
  if (!bar) return;
  const pct=Math.min((time-attackTime)/ATTACK_CD,1)*100;
  bar.style.width=pct+'%';
  bar.style.background=pct>=100?'#ffffff':'#8888ff';
}

// ── HP / Hearts ───────────────────────────────────────────────────────────────
let playerHP=100;

function setHP(hp) {
  const prev=playerHP;
  playerHP=Math.max(0,Math.min(100,hp));
  const el=document.getElementById('hearts');
  if (el) {
    const filled=Math.ceil((playerHP/100)*10);
    const prevF =Math.ceil((prev/100)*10);
    let html='';
    for(let i=0;i<10;i++){
      const full=i<filled,lost=!full&&i<prevF;
      html+=`<span class="heart ${full?'full':'empty'}${lost?' lost':''}">${full?'❤':'🖤'}</span>`;
    }
    el.innerHTML=html;
    if(prev!==playerHP) setTimeout(()=>el.querySelectorAll('.heart.lost').forEach(h=>h.classList.remove('lost')),400);
  }
  if (playerHP<=0) setTimeout(()=>location.reload(),600);
}
setHP(100);

// ── Zombies ───────────────────────────────────────────────────────────────────
const zombies=[];
let _nightSpawnTimer=0;
const MAX_ZOMBIES=18;

function spawnZombie() {
  if (zombies.filter(z=>z.alive).length >= MAX_ZOMBIES) return;
  let x,z;
  do { x=Math.random()*40-20; z=Math.random()*40-20; } while(x*x+z*z<64);
  zombies.push(new Zombie(scene, new THREE.Vector3(x,0.5,z)));
}
for(let i=0;i<6;i++) spawnZombie();

// ── Game loop ─────────────────────────────────────────────────────────────────
const clock=new THREE.Clock();
const _dir=new THREE.Vector3(), _side=new THREE.Vector3(), _mv=new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt  =Math.min(clock.getDelta(),0.05);
  const time=performance.now()*0.001;

  updateDayNight(dt);
  updateCooldownBar(time);

  // Night zombie spawns — one every 8 s while night
  if (!isDay) {
    _nightSpawnTimer += dt;
    if (_nightSpawnTimer >= 8) { _nightSpawnTimer=0; spawnZombie(); }
  } else {
    _nightSpawnTimer = 0;
  }

  const locked=controls.isLocked&&!inventoryOpen;

  if (locked) {
    // Hand
    if (isPunching) {
      hand.position.z=THREE.MathUtils.lerp(hand.position.z,-1.1,0.4);
      hand.rotation.x=THREE.MathUtils.lerp(hand.rotation.x,-0.5,0.4);
    } else {
      hand.position.z=THREE.MathUtils.lerp(hand.position.z,-0.58+Math.sin(time*3)*0.025,0.12);
      hand.position.y=THREE.MathUtils.lerp(hand.position.y,-0.38+Math.cos(time*2)*0.01,0.12);
      hand.rotation.x=THREE.MathUtils.lerp(hand.rotation.x,0,0.12);
    }

    // Gravity
    velocity.y-=28*dt;
    const nextY=camera.position.y+velocity.y*dt;
    const groundY=nextY-1.65;
    if (velocity.y<=0&&checkCollision(camera.position.x,Math.round(groundY),camera.position.z)) {
      velocity.y=0; onGround=true;
      camera.position.y=Math.round(groundY)+1.65+0.5;
    } else {
      camera.position.y=nextY; onGround=false;
    }
    if (velocity.y>0&&checkCollision(camera.position.x,Math.round(camera.position.y+0.1),camera.position.z)) velocity.y=0;
    if (camera.position.y<-10) { camera.position.set(0,10,0); velocity.y=0; }

    // Movement
    camera.getWorldDirection(_dir); _dir.y=0; _dir.normalize();
    _side.crossVectors(camera.up,_dir).normalize();
    _mv.set(0,0,0);
    if(move.fwd) _mv.add(_dir);
    if(move.bwd) _mv.sub(_dir);
    if(move.rgt) _mv.sub(_side);
    if(move.lft) _mv.add(_side);
    if(_mv.length()>0){
      _mv.normalize().multiplyScalar(6*dt);
      if(!checkCollision(camera.position.x+_mv.x,Math.round(camera.position.y-1),camera.position.z)) camera.position.x+=_mv.x;
      if(!checkCollision(camera.position.x,Math.round(camera.position.y-1),camera.position.z+_mv.z)) camera.position.z+=_mv.z;
    }

    // Knockback
    if(knockback.length()>0.01){
      const kb=knockback.clone().multiplyScalar(dt*7);
      if(!checkCollision(camera.position.x+kb.x,Math.round(camera.position.y-1),camera.position.z)) camera.position.x+=kb.x;
      if(!checkCollision(camera.position.x,Math.round(camera.position.y-1),camera.position.z+kb.z)) camera.position.z+=kb.z;
      knockback.multiplyScalar(0.70);
      if(knockback.length()<0.01) knockback.set(0,0,0);
    }

    // Drops
    updateDrops(dt);
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i];
      if(d.position.distanceTo(camera.position)<1.6){
        const type=d.userData.blockType;
        removeDrop(d);
        if(type) addToInventory(type,1);
      }
    }
  }

  // Zombie AI — NEW signature: update(time, dt, target, onHit, isDay, col, all)
  const now=performance.now();
  for(const z of zombies){
    z.update(
      time, dt,
      camera.position,
      () => {
        if(now-lastHit<650) return;
        lastHit=now;
        setHP(playerHP-10);
        const push=new THREE.Vector3().subVectors(camera.position,z.group.position).normalize();
        push.y=0; knockback.add(push.multiplyScalar(3.5));
      },
      isDay,
      checkCollision,
      zombies
    );
  }

  renderer.render(scene,camera);
}
animate();