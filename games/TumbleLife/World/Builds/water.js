import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Water {
  constructor(scene, x, y, z, width = 600, length = 40) {
    this.time = 0; 
    this.shader = null;
    
    const geo = new THREE.PlaneGeometry(width, length, 120, 24); 
    geo.rotateX(-Math.PI / 2);

    // 🛡️ FIX 1: Material settings tweaked to entirely eliminate blinding sun glare
    const mat = new THREE.MeshStandardMaterial({ 
        color: 0x0077be, 
        transparent: true, 
        opacity: 0.88, 
        roughness: 0.4,   // High roughness scatters the light so it doesn't flash
        metalness: 0.0    // Zero metalness prevents it from acting like a mirror
    });

    mat.onBeforeCompile = (shader) => {
      this.shader = shader; 
      shader.uniforms.uTime = { value: 0.0 };
      
      shader.vertexShader = `uniform float uTime;\nvarying float vElev;\n` + 
      shader.vertexShader.replace('#include <begin_vertex>', `
          vec3 transformed = vec3(position);
          
          float w1 = sin(transformed.x * 0.08 + uTime * 0.55) * 0.28; 
          float w2 = cos(transformed.z * 0.14 - uTime * 0.40) * 0.16;
          float w3 = sin((transformed.x + transformed.z) * 0.20 + uTime * 0.70) * 0.09; 
          float w4 = cos(transformed.x * 0.30 - transformed.z * 0.12 + uTime * 1.10) * 0.04;
          
          transformed.y += w1 + w2 + w3 + w4; 
          vElev = transformed.y;
        `);
        
      shader.fragmentShader = `varying float vElev;\n` + 
      shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          
          float t = clamp((vElev + 0.3) / 0.6, 0.0, 1.0);
          
          vec3 cDeep = vec3(0.01, 0.18, 0.45);    
          vec3 cShallow = vec3(0.02, 0.55, 0.85); 
          vec3 cFoam = vec3(0.85, 0.95, 1.0); // 🛡️ FIX 2: Soft cyan-white instead of blinding pure white
          
          vec3 wCol = mix(cDeep, cShallow, t);
          
          // 🛡️ FIX 3: Push the foam threshold much higher and lower the mix intensity to 45%
          float foamFactor = smoothstep(0.48, 0.60, vElev);
          wCol = mix(wCol, cFoam, foamFactor * 0.45); 
          
          diffuseColor = vec4(wCol, opacity);
        `);
    };

    this.mesh = new THREE.Mesh(geo, mat); 
    this.mesh.position.set(x, y, z); 
    this.mesh.receiveShadow = true; 
    scene.add(this.mesh);
  }

  update() {
    this.time += 0.018;
    if (this.shader) this.shader.uniforms.uTime.value = this.time;
  }
}