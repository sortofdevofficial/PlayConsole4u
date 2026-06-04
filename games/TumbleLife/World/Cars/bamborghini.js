import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { WindowAssembly } from '../Builds/window.js';

export class Bamborghini {
  constructor(scene, x, z) {
    this.meshGroup = new THREE.Group();
    this.meshGroup.position.set(x, 0, z);
    scene.add(this.meshGroup);

    this.speed = 0; this.steer = 0; this.angle = 0;
    this.maxSpeed = 0.82; this.reverseMaxSpeed = -0.24;
    this.acceleration = 0.026; this.braking = 0.034; this.friction = 0.976;
    this.steeringSpeed = 0.046;
    this.width = 2.4; this.length = 4.8;
    this.headlightsOn = false; this.velocityY = 0;
    this.isAirborne = false; this._smoothGroundY = 0; this._mirrorIdx = 0;

    const W = this.width, L = this.length, WR = 0.42;
    const BY = WR+0.05, BH = 0.55, CY = BY+BH, CH = 0.90, CT = CY+CH;
    const CAB_L = L*0.52, CAB_W = W-0.12, CAB_Z = -L*0.06;
    const wsH = CH*0.68, wsY = CY+CH*0.22, mirY = CY+CH*0.55, mirZ = CAB_Z+CAB_L/2-0.28;

    const red = new THREE.MeshStandardMaterial({color:0xe63946, roughness:0.45, metalness:0.2, flatShading:true});
    const redDk = new THREE.MeshStandardMaterial({color:0xb91c1c, roughness:0.45, metalness:0.2, flatShading:true});
    const dark = new THREE.MeshStandardMaterial({color:0x1e293b, roughness:0.7, flatShading:true});
    const tireM = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.95, flatShading:true});
    const rimM = new THREE.MeshStandardMaterial({color:0xe2e8f0, roughness:0.1, metalness:0.8, flatShading:true});
    const mirMat = new THREE.MeshStandardMaterial({color:0x1f2937, roughness:0.8, flatShading:true});
    
    this.lightGlowMat = new THREE.MeshBasicMaterial({color:0x4b5563});
    this.brakeLightMat = new THREE.MeshBasicMaterial({color:0x7f1d1d});
    this.win = new WindowAssembly();

    const add = (g,m,px,py,pz) => {
      const o = new THREE.Mesh(g,m); o.position.set(px,py,pz);
      o.castShadow = o.receiveShadow = true; this.meshGroup.add(o); return o;
    };

    add(new THREE.BoxGeometry(W,BH,L), red, 0, BY+BH/2, 0);
    add(new THREE.BoxGeometry(CAB_W,CH,CAB_L), red, 0, CY+CH/2, CAB_Z);
    add(new THREE.BoxGeometry(CAB_W-0.08,0.08,CAB_L-0.08), redDk, 0, CT+0.04, CAB_Z);

    const fWin = this.win.createFrontWindshield(CAB_W-0.12, wsH); fWin.position.set(0, wsY+wsH/2, CAB_Z+CAB_L/2-0.18); this.meshGroup.add(fWin);
    const rWin = this.win.createRearWindshield(CAB_W-0.12, wsH*0.85); rWin.position.set(0, wsY+wsH*0.42, CAB_Z-CAB_L/2+0.18); this.meshGroup.add(rWin);
    [-1,1].forEach(s=>add(new THREE.BoxGeometry(0.06,wsH*0.9,CAB_L*0.65),this.win.glassMat,s*CAB_W/2,wsY+wsH*0.45,CAB_Z));
    add(new THREE.BoxGeometry(W-0.1,0.06,L*0.36), redDk, 0, BY+BH+0.03, L/2-L*0.18);
    add(new THREE.BoxGeometry(W+0.1,0.22,0.18), dark, 0, BY+0.11, L/2+0.09);
    add(new THREE.BoxGeometry(W+0.1,0.22,0.18), dark, 0, BY+0.11, -L/2-0.09);

    this.leftLightMesh = add(new THREE.BoxGeometry(0.36,0.14,0.08),this.lightGlowMat, W/2-0.24,BY+BH*0.72, L/2+0.02);
    this.rightLightMesh = add(new THREE.BoxGeometry(0.36,0.14,0.08),this.lightGlowMat,-W/2+0.24,BY+BH*0.72, L/2+0.02);
    this.leftBrakeMesh = add(new THREE.BoxGeometry(0.42,0.12,0.06),this.brakeLightMat, W/2-0.28,BY+BH*0.72,-L/2-0.02);
    this.rightBrakeMesh = add(new THREE.BoxGeometry(0.42,0.12,0.06),this.brakeLightMat,-W/2+0.28,BY+BH*0.72,-L/2-0.02);

    this.leftBeam = new THREE.SpotLight(0xfffee0,16,26,Math.PI/6,0.4,1.2); this.leftBeam.position.set( W/2-0.24,BY+BH*0.72,L/2+0.1);
    this.rightBeam = new THREE.SpotLight(0xfffee0,16,26,Math.PI/6,0.4,1.2); this.rightBeam.position.set(-W/2+0.24,BY+BH*0.72,L/2+0.1);
    this.leftBeam.visible = this.rightBeam.visible = false;
    this.meshGroup.add(this.leftBeam,this.leftBeam.target,this.rightBeam,this.rightBeam.target);

    [-1,1].forEach(s=>{ add(new THREE.BoxGeometry(0.18,0.06,0.06),mirMat,s*(W/2+0.09),mirY,mirZ); add(new THREE.BoxGeometry(0.22,0.14,0.18),mirMat,s*(W/2+0.22),mirY,mirZ); });

    this.steeringWheelGroup = new THREE.Group(); this.steeringWheelGroup.position.set(0.28,CY+0.38,CAB_Z+CAB_L/2-0.62); this.steeringWheelGroup.rotation.x = -0.5;
    this.meshGroup.add(this.steeringWheelGroup);
    this.steeringWheelGroup.add(new THREE.Mesh(new THREE.TorusGeometry(0.16,0.026,8,18),dark));
    for(let i=0;i<3;i++){ const sp=new THREE.Mesh(new THREE.BoxGeometry(0.022,0.28,0.022),dark); sp.rotation.z=(Math.PI*2/3)*i; this.steeringWheelGroup.add(sp); }

    this.rvRT=new THREE.WebGLRenderTarget(256,64); this.rvRT.texture.colorSpace=THREE.SRGBColorSpace;
    this.rvCam=new THREE.PerspectiveCamera(75,4,0.1,100); this.rvCam.position.set(0,CT-0.03,CAB_Z+CAB_L/2-0.08); this.rvCam.rotation.y=Math.PI; this.meshGroup.add(this.rvCam);
    this.rvScreen=new THREE.Mesh(new THREE.PlaneGeometry(0.82,0.16),new THREE.MeshBasicMaterial({map:this.rvRT.texture,toneMapped:false})); this.rvScreen.position.set(0,CT-0.02,CAB_Z+CAB_L/2-0.03); this.rvScreen.rotation.y=Math.PI; this.meshGroup.add(this.rvScreen);
    
    this.lmRT=new THREE.WebGLRenderTarget(128,80); this.lmRT.texture.colorSpace=THREE.SRGBColorSpace;
    this.lmCam=new THREE.PerspectiveCamera(65,1.6,0.1,80); this.lmCam.position.set(W/2+0.34,mirY,mirZ); this.lmCam.rotation.y=Math.PI+0.22; this.meshGroup.add(this.lmCam);
    this.lmScreen=new THREE.Mesh(new THREE.PlaneGeometry(0.18,0.11),new THREE.MeshBasicMaterial({map:this.lmRT.texture,toneMapped:false})); this.lmScreen.position.set(W/2+0.265,mirY,mirZ); this.lmScreen.rotation.y=Math.PI/2; this.meshGroup.add(this.lmScreen);

    this.rmRT=new THREE.WebGLRenderTarget(128,80); this.rmRT.texture.colorSpace=THREE.SRGBColorSpace;
    this.rmCam=new THREE.PerspectiveCamera(65,1.6,0.1,80); this.rmCam.position.set(-W/2-0.34,mirY,mirZ); this.rmCam.rotation.y=Math.PI-0.22; this.meshGroup.add(this.rmCam);
    this.rmScreen=new THREE.Mesh(new THREE.PlaneGeometry(0.18,0.11),new THREE.MeshBasicMaterial({map:this.rmRT.texture,toneMapped:false})); this.rmScreen.position.set(-W/2-0.265,mirY,mirZ); this.rmScreen.rotation.y=-Math.PI/2; this.meshGroup.add(this.rmScreen);

    const tireGeo=new THREE.CylinderGeometry(WR,WR,0.32,12); tireGeo.rotateZ(Math.PI/2);
    const rimGeo =new THREE.CylinderGeometry(WR*0.6,WR*0.6,0.34,12); rimGeo.rotateZ(Math.PI/2);
    this.wheels=[]; this.wheelSpinPivots=[]; const WB=L*0.34;
    [{x:W/2+0.02,z:WB,f:true},{x:-W/2-0.02,z:WB,f:true},{x:W/2+0.02,z:-WB,f:false},{x:-W/2-0.02,z:-WB,f:false}].forEach(wp=>{
        const asm=new THREE.Group(); asm.position.set(wp.x,WR,wp.z); asm.userData={isFront:wp.f,homeX:wp.x,homeZ:wp.z,homeY:WR};
        const spin=new THREE.Group(); spin.add(new THREE.Mesh(tireGeo,tireM)); spin.add(new THREE.Mesh(rimGeo,rimM));
        asm.add(spin); this.meshGroup.add(asm); this.wheels.push(asm); this.wheelSpinPivots.push(spin);
    });
  }

  renderMirrors(renderer, scene) {
    if (!this.isDriving) return;
    this._mirrorIdx = (this._mirrorIdx + 1) % 3;
    const [[rt,cam]] = [[this.rvRT, this.rvCam], [this.lmRT, this.lmCam], [this.rmRT, this.rmCam]].slice(this._mirrorIdx, this._mirrorIdx + 1);
    const prev = renderer.getRenderTarget();
    this.meshGroup.visible = false;
    renderer.setRenderTarget(rt); renderer.render(scene, cam);
    renderer.setRenderTarget(prev);
    this.meshGroup.visible = true;
  }
}