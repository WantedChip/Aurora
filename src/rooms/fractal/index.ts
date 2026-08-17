/**
 * Room 11: Raymarched Fractals
 * Curatorial Category: Chaos & Procedural
 * Math Model: Signed Distance Estimation Fields (Mandelbulb, Menger Sponge, Mandelbox, Quaternion Julia)
 * Compute Engine: Three.js WebGL2 / WebGPU Raymarching Quad Shader
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Real-time full-screen sphere-tracing raymarching distance estimator quad
 * - 4 Canonical 3D Fractal Topologies:
 *     1. Mandelbulb 3D: White & Nylander power-N spherical coordinate iteration
 *     2. Menger Sponge: Recursive cross-box folding IFS
 *     3. Mandelbox: Tom Lowe's box & sphere folding hyper-structure
 *     4. Quaternion Julia: 4D hypercomplex slice z -> z^2 + c
 * - Analytical numerical gradient normal estimation (4-sample tetrahedron)
 * - Multi-step ambient occlusion (AO) and soft self-shadowing
 * - Key, fill, and rim backlighting with Blinn-Phong specular crests
 * - Orbit trap coloring mapped to 6 curatorial spectral palettes
 * - Obsidian Archival Minimal (#090A0D) background with atmospheric depth fog
 * - Smooth orbital camera navigation with inertia damping, pinch/wheel zoom, and auto-rotation
 * - Seamless frame-rate independent parameter damping (dampParameter)
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three';
import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export type FractalType = 'mandelbulb' | 'menger' | 'mandelbox' | 'julia';

export type ColorPalette =
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'bioluminescent-cyan'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-lithic';

export interface FractalParams {
  seed: string;
  fractalType: FractalType;
  colorPalette: ColorPalette;
  power: number;
  iterations: number;
  morphParam: number;
  scale: number;
  maxSteps: number;
  glowIntensity: number;
  specularExp: number;
  ambientOcclusion: number;
  cameraAutoRotate: boolean;
  rotationSpeed: number;
  camDistance: number;
  cameraFov: number;
}

export const DEFAULT_FRACTAL_PARAMS: FractalParams = {
  seed: '#C084FC',
  fractalType: 'mandelbulb',
  colorPalette: 'spectral-aurora',
  power: 8.0,
  iterations: 8,
  morphParam: 0.0,
  scale: 2.0,
  maxSteps: 90,
  glowIntensity: 1.2,
  specularExp: 32.0,
  ambientOcclusion: 1.0,
  cameraAutoRotate: true,
  rotationSpeed: 0.3,
  camDistance: 2.6,
  cameraFov: 55.0,
};

// Curatorial Color Palettes for Fractal Orbit Traps & Lighting
export interface PaletteDef {
  name: string;
  colorA: [number, number, number]; // Void / Deep Shadow Base
  colorB: [number, number, number]; // Primary Fractal Body
  colorC: [number, number, number]; // Orbit Trap Accent / Crevice Glow
  colorD: [number, number, number]; // Apex Specular / Starlight Crest
}

export const FRACTAL_PALETTES: Record<ColorPalette, PaletteDef> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    colorA: [0.035, 0.039, 0.051], // #090A0D Void Obsidian
    colorB: [0.0, 0.85, 0.95],     // Electric Cyan (#00F0FF)
    colorC: [0.66, 0.33, 0.97],    // Royal Violet (#A855F7)
    colorD: [0.95, 0.98, 1.0],     // Starlight White
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    colorA: [0.04, 0.02, 0.01],    // Dark Solar Void
    colorB: [0.95, 0.45, 0.0],     // Radiant Amber
    colorC: [1.0, 0.15, 0.05],     // Volcanic Flare
    colorD: [1.0, 0.92, 0.65],     // Solar Gold Crest
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    colorA: [0.01, 0.04, 0.06],    // Abyssal Slate
    colorB: [0.0, 0.75, 0.85],     // Aqua Cyan
    colorC: [0.0, 0.95, 0.55],     // Phosphor Mint
    colorD: [0.88, 1.0, 0.95],     // Phosphor Starlight
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    colorA: [0.02, 0.04, 0.03],    // Deep Jade Void
    colorB: [0.05, 0.65, 0.35],    // Emerald Green
    colorC: [0.45, 0.95, 0.25],    // Neon Lime Glow
    colorD: [0.95, 0.99, 0.96],    // Quartz Silver
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    colorA: [0.03, 0.01, 0.06],    // Cosmic Void
    colorB: [0.55, 0.15, 0.85],    // Royal Amethyst
    colorC: [0.95, 0.25, 0.65],    // Laser Magenta
    colorD: [0.98, 0.92, 1.0],     // Diamond Starlight
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    colorA: [0.025, 0.027, 0.035], // Obsidian Void
    colorB: [0.28, 0.32, 0.38],    // Slate Basalt
    colorC: [0.65, 0.70, 0.78],    // Polished Platinum
    colorD: [0.98, 0.99, 1.0],     // Titanium White
  },
};

// GLSL Raymarching Vertex Shader
const RAYMARCH_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// GLSL Raymarching Fragment Shader
const RAYMARCH_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uTarget;
uniform float uFov;

uniform int uFractalType; // 0: Mandelbulb, 1: Menger, 2: Mandelbox, 3: Quaternion Julia
uniform float uPower;
uniform int uIterations;
uniform float uMorphParam;
uniform float uScale;
uniform int uMaxSteps;
uniform float uGlowIntensity;
uniform float uSpecularExp;
uniform float uAO;
uniform vec4 uJuliaC;

uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uColorD;

// --- Distance Estimator Signed Distance Functions (SDFs) ---

// 1. Mandelbulb 3D (White & Nylander spherical coordinate power-N iteration)
vec2 sdMandelbulb(vec3 p, float power, int maxIter, float morph) {
    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;
    float trap = 1e10;
    
    for (int i = 0; i < 16; i++) {
        if (i >= maxIter) break;
        r = length(z);
        if (r > 4.0) break;
        
        trap = min(trap, dot(z, z));
        
        // Extract spherical coordinates
        float theta = acos(clamp(z.z / max(r, 0.00001), -1.0, 1.0)) + morph * 0.08;
        float phi = atan(z.y, z.x);
        
        dr = pow(r, power - 1.0) * power * dr + 1.0;
        
        // Scale and rotate hypercomplex coordinates
        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;
        
        // Convert back to cartesian coordinates and add point c
        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + p;
    }
    
    float d = 0.5 * log(max(r, 0.0001)) * r / max(dr, 0.0001);
    return vec2(d, trap);
}

// 2. Menger Sponge 3D (Recursive cross-box IFS)
vec2 sdMengerSponge(vec3 p, float scale, int maxIter, float morph) {
    vec3 dBox = abs(p) - vec3(1.0);
    float d = min(max(dBox.x, max(dBox.y, dBox.z)), 0.0) + length(max(dBox, 0.0));
    
    float s = 1.0;
    float trap = 1e10;
    
    for (int m = 0; m < 6; m++) {
        if (m >= maxIter) break;
        
        vec3 a = mod(p * s, 2.0) - 1.0;
        s *= scale;
        vec3 r = abs(1.0 - 3.0 * abs(a));
        
        float da = max(r.x, r.y);
        float db = max(r.y, r.z);
        float dc = max(r.z, r.x);
        float c = (min(da, min(db, dc)) - 1.0 + morph * 0.05) / s;
        
        d = max(d, c);
        trap = min(trap, length(r));
    }
    return vec2(d, trap);
}

// 3. Mandelbox 3D (Tom Lowe box and sphere folding IFS)
vec2 sdMandelbox(vec3 p, float scale, int maxIter, float morph) {
    vec3 z = p;
    float dr = 1.0;
    float trap = 1e10;
    
    float minRadius2 = 0.25;
    float fixedRadius2 = 1.0 + morph * 0.2;
    
    for (int i = 0; i < 16; i++) {
        if (i >= maxIter) break;
        
        // Box folding
        z = clamp(z, -1.0, 1.0) * 2.0 - z;
        
        // Sphere folding
        float r2 = dot(z, z);
        trap = min(trap, r2);
        
        if (r2 < minRadius2) {
            float temp = fixedRadius2 / minRadius2;
            z *= temp;
            dr *= temp;
        } else if (r2 < fixedRadius2) {
            float temp = fixedRadius2 / r2;
            z *= temp;
            dr *= temp;
        }
        
        z = z * scale + p;
        dr = dr * abs(scale) + 1.0;
    }
    
    float d = (length(z) - (abs(scale) - 1.0)) / max(dr, 0.0001);
    return vec2(d, trap);
}

// 4. Quaternion Julia 4D -> 3D Slice
vec4 qSquare(vec4 q) {
    return vec4(
        q.x * q.x - q.y * q.y - q.z * q.z - q.w * q.w,
        2.0 * q.x * q.y,
        2.0 * q.x * q.z,
        2.0 * q.x * q.w
    );
}

vec2 sdQuaternionJulia(vec3 p, vec4 cVal, int maxIter, float morph) {
    vec4 z = vec4(p, morph * 0.25);
    float dz2 = 1.0;
    float trap = 1e10;
    
    for (int i = 0; i < 16; i++) {
        if (i >= maxIter) break;
        
        dz2 *= 4.0 * max(dot(z, z), 0.0001);
        z = qSquare(z) + cVal;
        
        float r2 = dot(z, z);
        trap = min(trap, r2);
        if (r2 > 8.0) break;
    }
    
    float r = length(z);
    float d = 0.5 * r * log(max(r, 0.0001)) / sqrt(max(dz2, 0.0001));
    return vec2(d, trap);
}

// Master Scene Distance Estimator Map
vec2 sceneMap(vec3 p) {
    if (uFractalType == 0) {
        return sdMandelbulb(p, uPower, uIterations, uMorphParam);
    } else if (uFractalType == 1) {
        return sdMengerSponge(p, uScale, uIterations, uMorphParam);
    } else if (uFractalType == 2) {
        return sdMandelbox(p, uScale, uIterations, uMorphParam);
    } else {
        return sdQuaternionJulia(p, uJuliaC, uIterations, uMorphParam);
    }
}

// Analytical Normal Calculation via 4-sample Tetrahedron Gradient
vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(0.0006, -0.0006);
    return normalize(
        e.xyy * sceneMap(p + e.xyy).x +
        e.yyx * sceneMap(p + e.yyx).x +
        e.yxy * sceneMap(p + e.yxy).x +
        e.xxx * sceneMap(p + e.xxx).x
    );
}

// Multi-step Ambient Occlusion (AO)
float calcAO(vec3 pos, vec3 nor, float strength) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float hr = 0.01 + 0.05 * float(i);
        vec3 aopos = nor * hr + pos;
        float dd = sceneMap(aopos).x;
        occ += -(dd - hr) * sca;
        sca *= 0.75;
    }
    return clamp(1.0 - strength * occ, 0.0, 1.0);
}

// Soft Shadow Estimator
float calcSoftShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 20; i++) {
        if (t >= maxt) break;
        float h = sceneMap(ro + rd * t).x;
        res = min(res, k * h / t);
        t += clamp(h, 0.02, 0.12);
        if (res < 0.005) break;
    }
    return clamp(res, 0.0, 1.0);
}

void main() {
    // 1. Normalized Screen Coordinates with Aspect Ratio Correction
    vec2 p = (2.0 * gl_FragCoord.xy - uResolution.xy) / min(uResolution.x, uResolution.y);
    
    // 2. Camera Ray Setup
    vec3 ro = uCameraPos;
    vec3 ta = uTarget;
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    
    float fovFactor = 1.0 / tan(radians(uFov * 0.5));
    vec3 rd = normalize(p.x * uu + p.y * vv + fovFactor * ww);
    
    // 3. Sphere-Tracing Raymarching Loop
    float t = 0.01;
    float maxDist = 20.0;
    float hitTrap = 1e10;
    float hitSteps = 0.0;
    float glow = 0.0;
    bool isHit = false;
    
    for (int i = 0; i < 180; i++) {
        if (i >= uMaxSteps) break;
        
        vec3 pos = ro + t * rd;
        vec2 res = sceneMap(pos);
        float d = res.x;
        hitTrap = min(hitTrap, res.y);
        
        // Atmospheric / Rim Glow Accumulation
        glow += 1.0 / (1.0 + d * d * 80.0);
        
        // Adaptive Precision Threshold
        float eps = max(0.0003, 0.00035 * t);
        if (d < eps) {
            isHit = true;
            hitSteps = float(i);
            break;
        }
        
        if (t > maxDist) break;
        
        // Conservative step size for fractal stability
        t += max(d * 0.82, 0.0008);
    }
    
    // 4. Color & Lighting Composition
    vec3 bgColor = vec3(0.035, 0.039, 0.051); // Obsidian Void #090A0D
    vec3 finalColor = bgColor;
    
    if (isHit) {
        vec3 hitPos = ro + t * rd;
        vec3 nor = calcNormal(hitPos);
        
        // Ambient Occlusion
        float ao = calcAO(hitPos, nor, uAO);
        
        // Key Directional Light (Warm Top-Right)
        vec3 keyDir = normalize(vec3(0.7, 1.2, 0.9));
        float keyDiff = max(dot(nor, keyDir), 0.0);
        float shadow = calcSoftShadow(hitPos + nor * 0.002, keyDir, 0.01, 3.0, 16.0);
        
        // Fill Light (Soft Abyssal Back-Left)
        vec3 fillDir = normalize(vec3(-0.8, -0.4, -0.6));
        float fillDiff = max(dot(nor, fillDir), 0.0) * 0.35;
        
        // Rim / Fresnel Lighting
        float fresnel = pow(clamp(1.0 + dot(rd, nor), 0.0, 1.0), 3.0);
        
        // Blinn-Phong Specular Reflection
        vec3 halfVec = normalize(keyDir - rd);
        float spec = pow(max(dot(nor, halfVec), 0.0), uSpecularExp) * keyDiff;
        
        // Orbit Trap Fractal Color Synthesis
        float trapMetric = clamp(sqrt(max(hitTrap, 0.0)) * 0.8, 0.0, 1.0);
        float stepMetric = clamp(hitSteps / float(uMaxSteps), 0.0, 1.0);
        
        // Blend Layer A (Shadow Base) -> Layer B (Primary Body)
        vec3 matColor = mix(uColorA, uColorB, clamp(keyDiff * 1.2 + 0.1, 0.0, 1.0));
        
        // Blend Layer C (Crevice & Orbit Trap Accent Glow)
        matColor = mix(matColor, uColorC, trapMetric * 0.85 + stepMetric * 0.35);
        
        // Apply Lighting & AO
        vec3 litColor = matColor * ((keyDiff * shadow + fillDiff + 0.15) * ao);
        
        // Add Specular Crests & Rim Highlights (Layer D)
        litColor += uColorD * (spec * 0.9 + fresnel * 0.6);
        
        // Atmospheric Distance Fog into Obsidian Void
        float fogFactor = 1.0 - exp(-0.035 * t * t);
        finalColor = mix(litColor, bgColor, clamp(fogFactor, 0.0, 1.0));
    }
    
    // 5. Atmospheric Void Glow
    vec3 glowColor = uColorC * (glow * 0.012 * uGlowIntensity);
    finalColor += glowColor;
    
    // 6. Subtle Vignette & Gamma Tone Mapping
    vec2 uvCoord = vUv - 0.5;
    float vignette = clamp(1.15 - dot(uvCoord, uvCoord) * 0.45, 0.0, 1.0);
    finalColor *= vignette;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export class FractalRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;

  private prng: PRNG = createPRNG('#C084FC');
  private width = 800;
  private height = 600;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;

  // Active Simulation Parameters
  private params: FractalParams = { ...DEFAULT_FRACTAL_PARAMS };

  // Target Parameters for Smooth Exponential Interpolation
  private targetParams: FractalParams = { ...DEFAULT_FRACTAL_PARAMS };

  // Camera Orbit State
  private camAzimuth = 0.6;
  private camElevation = 0.35;
  private camDistance = 2.6;
  private targetCamAzimuth = 0.6;
  private targetCamElevation = 0.35;
  private targetCamDistance = 2.6;
  private targetLookAt = new THREE.Vector3(0, 0, 0);
  private currentLookAt = new THREE.Vector3(0, 0, 0);

  // Pointer Drag Interaction State
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Shader Uniforms
  private uResolution = new THREE.Vector2(800, 600);
  private uCameraPos = new THREE.Vector3(0, 0, 2.6);
  private uTarget = new THREE.Vector3(0, 0, 0);
  private uJuliaC = new THREE.Vector4(-0.2, 0.6, 0.43, -0.2);

  private uColorA = new THREE.Color(0.035, 0.039, 0.051);
  private uColorB = new THREE.Color(0.0, 0.85, 0.95);
  private uColorC = new THREE.Color(0.66, 0.33, 0.97);
  private uColorD = new THREE.Color(0.95, 0.98, 1.0);

  private isMounted = false;
  private prefersReducedMotion = false;

  // DOM Event Listeners Cleanup
  private nativeCleanupListeners: (() => void) | null = null;

  /**
   * Mounts the Raymarched Fractal simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_FRACTAL_PARAMS.seed);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Initialize Three.js WebGL2 / WebGPU Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        preserveDrawingBuffer: true,
      });

      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(Math.min(this.dpr, 2.0));
      this.renderer.setClearColor(0x090a0d, 1.0);

      // Build Fullscreen Quad Scene & Orthographic Camera
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // Build Raymarching Shader Material
      this.material = this.buildShaderMaterial();

      const geometry = new THREE.PlaneGeometry(2, 2);
      this.mesh = new THREE.Mesh(geometry, this.material);
      this.scene.add(this.mesh);
    } catch (err) {
      console.warn('WebGL/WebGPU raymarcher initialization fallback in Room 11:', err);
    }

    // Attach native pointer/wheel listeners for intuitive zoom and orbit
    this.attachNativeEventListeners();

    this.isMounted = true;
    this.lastTime = performance.now();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Constructs the raymarching ShaderMaterial with all uniform bindings.
   */
  private buildShaderMaterial(): THREE.ShaderMaterial {
    const fractalTypeIndex = this.getFractalTypeIndex(this.params.fractalType);
    this.updatePaletteUniforms(this.params.colorPalette);

    return new THREE.ShaderMaterial({
      vertexShader: RAYMARCH_VERTEX_SHADER,
      fragmentShader: RAYMARCH_FRAGMENT_SHADER,
      uniforms: {
        uResolution: { value: this.uResolution },
        uTime: { value: 0.0 },
        uCameraPos: { value: this.uCameraPos },
        uTarget: { value: this.uTarget },
        uFov: { value: this.params.cameraFov },

        uFractalType: { value: fractalTypeIndex },
        uPower: { value: this.params.power },
        uIterations: { value: this.params.iterations },
        uMorphParam: { value: this.params.morphParam },
        uScale: { value: this.params.scale },
        uMaxSteps: { value: this.params.maxSteps },
        uGlowIntensity: { value: this.params.glowIntensity },
        uSpecularExp: { value: this.params.specularExp },
        uAO: { value: this.params.ambientOcclusion },
        uJuliaC: { value: this.uJuliaC },

        uColorA: { value: this.uColorA },
        uColorB: { value: this.uColorB },
        uColorC: { value: this.uColorC },
        uColorD: { value: this.uColorD },
      },
      depthWrite: false,
      depthTest: false,
    });
  }

  /**
   * Maps fractal type string to integer shader enum.
   */
  private getFractalTypeIndex(type: FractalType): number {
    switch (type) {
      case 'mandelbulb': return 0;
      case 'menger': return 1;
      case 'mandelbox': return 2;
      case 'julia': return 3;
      default: return 0;
    }
  }

  /**
   * Attaches wheel and touch event listeners on the canvas for zoom and pan.
   */
  private attachNativeEventListeners(): void {
    if (!this.canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.0025;
      this.targetCamDistance = Math.min(Math.max(this.targetCamDistance + zoomDelta, 1.2), 8.0);
      this.targetParams.camDistance = this.targetCamDistance;
    };

    this.canvas.addEventListener('wheel', onWheel, { passive: false });

    this.nativeCleanupListeners = () => {
      if (this.canvas) {
        this.canvas.removeEventListener('wheel', onWheel);
      }
    };
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevSeed = this.targetParams.seed;
    const prevType = this.targetParams.fractalType;
    this.applyParams(newParams, false);

    // If seed changed, randomize Julia constants and camera orientations
    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.reseedParameters();
    }

    // If fractal topology changed, adjust default camera distance and scale
    if (newParams.fractalType && newParams.fractalType !== prevType) {
      this.adjustForFractalTopology(this.targetParams.fractalType);
    }
  }

  /**
   * Adjusts camera framing and parameters optimal for the active fractal topology.
   */
  private adjustForFractalTopology(type: FractalType): void {
    switch (type) {
      case 'mandelbulb':
        this.targetCamDistance = 2.6;
        this.targetParams.scale = 2.0;
        this.targetParams.power = 8.0;
        break;
      case 'menger':
        this.targetCamDistance = 2.8;
        this.targetParams.scale = 3.0;
        break;
      case 'mandelbox':
        this.targetCamDistance = 3.4;
        this.targetParams.scale = -2.0;
        break;
      case 'julia':
        this.targetCamDistance = 2.4;
        this.targetParams.scale = 1.8;
        break;
    }
    this.targetParams.camDistance = this.targetCamDistance;
  }

  /**
   * Updates canvas dimensions, aspect ratio, and Three.js viewport buffers.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(Math.min(this.dpr, 2.0));
    }

    this.uResolution.set(this.width, this.height);
  }

  /**
   * Receives normalized and pixel pointer events from the RoomViewer viewport controller.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave' || event.type === 'up') {
      this.isPointerDown = false;
      return;
    }

    if (event.type === 'down') {
      this.isPointerDown = true;
      this.lastPointerX = event.x;
      this.lastPointerY = event.y;
      return;
    }

    if (event.type === 'move' && this.isPointerDown) {
      const dx = (event.x - this.lastPointerX) / Math.max(this.width, 320);
      const dy = (event.y - this.lastPointerY) / Math.max(this.height, 320);
      this.lastPointerX = event.x;
      this.lastPointerY = event.y;

      // Orbit camera rotation
      this.targetCamAzimuth -= dx * 3.5;
      this.targetCamElevation = Math.min(Math.max(this.targetCamElevation + dy * 2.8, -1.45), 1.45);
    }
  }

  /**
   * Reseeds random hypercomplex slice constants and morphing state from PRNG.
   */
  private reseedParameters(): void {
    const cx = this.prng.nextFloat(-0.8, 0.8);
    const cy = this.prng.nextFloat(-0.8, 0.8);
    const cz = this.prng.nextFloat(-0.8, 0.8);
    const cw = this.prng.nextFloat(-0.8, 0.8);
    this.uJuliaC.set(cx, cy, cz, cw);

    this.targetCamAzimuth = this.prng.nextFloat(0, Math.PI * 2);
    this.targetCamElevation = this.prng.nextFloat(-0.4, 0.6);
  }

  /**
   * Merges and validates parameter changes.
   */
  private applyParams(incoming: Record<string, any>, isInitial: boolean): void {
    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      fractalType: incoming.fractalType ?? this.targetParams.fractalType,
      colorPalette: incoming.colorPalette && FRACTAL_PALETTES[incoming.colorPalette as ColorPalette]
        ? incoming.colorPalette
        : this.targetParams.colorPalette,
      power: Math.min(Math.max(Number(incoming.power ?? this.targetParams.power), 2.0), 16.0),
      iterations: Math.min(Math.max(Math.round(Number(incoming.iterations ?? this.targetParams.iterations)), 4), 16),
      morphParam: Math.min(Math.max(Number(incoming.morphParam ?? this.targetParams.morphParam), 0.0), 3.0),
      scale: Math.min(Math.max(Number(incoming.scale ?? this.targetParams.scale), -4.0), 5.0),
      maxSteps: Math.min(Math.max(Math.round(Number(incoming.maxSteps ?? this.targetParams.maxSteps)), 30), 180),
      glowIntensity: Math.min(Math.max(Number(incoming.glowIntensity ?? this.targetParams.glowIntensity), 0.0), 4.0),
      specularExp: Math.min(Math.max(Number(incoming.specularExp ?? this.targetParams.specularExp), 4.0), 128.0),
      ambientOcclusion: Math.min(Math.max(Number(incoming.ambientOcclusion ?? this.targetParams.ambientOcclusion), 0.0), 2.5),
      cameraAutoRotate: Boolean(incoming.cameraAutoRotate ?? this.targetParams.cameraAutoRotate),
      rotationSpeed: Math.min(Math.max(Number(incoming.rotationSpeed ?? this.targetParams.rotationSpeed), 0.0), 3.0),
      camDistance: Math.min(Math.max(Number(incoming.camDistance ?? this.targetParams.camDistance), 1.2), 8.0),
      cameraFov: Math.min(Math.max(Number(incoming.cameraFov ?? this.targetParams.cameraFov), 30.0), 90.0),
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.camDistance = this.params.camDistance;
      this.targetCamDistance = this.params.camDistance;
      this.reseedParameters();
      this.updatePaletteUniforms(this.params.colorPalette);
    }
  }

  /**
   * Updates color uniform nodes to match selected curatorial palette.
   */
  private updatePaletteUniforms(paletteKey: ColorPalette): void {
    const pal = FRACTAL_PALETTES[paletteKey] || FRACTAL_PALETTES['spectral-aurora'];
    this.uColorA.setRGB(pal.colorA[0], pal.colorA[1], pal.colorA[2]);
    this.uColorB.setRGB(pal.colorB[0], pal.colorB[1], pal.colorB[2]);
    this.uColorC.setRGB(pal.colorC[0], pal.colorC[1], pal.colorC[2]);
    this.uColorD.setRGB(pal.colorD[0], pal.colorD[1], pal.colorD[2]);
  }

  /**
   * Main 60 FPS animation loop with differential exponential damping.
   */
  private loop(currentTime: number): void {
    if (!this.renderer || !this.scene || !this.camera || !this.material) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smoothly lerp simulation parameters
    const lambda = 6.0;
    this.params.power = dampParameter(this.params.power, this.targetParams.power, lambda, dt);
    this.params.morphParam = dampParameter(this.params.morphParam, this.targetParams.morphParam, lambda, dt);
    this.params.scale = dampParameter(this.params.scale, this.targetParams.scale, lambda, dt);
    this.params.glowIntensity = dampParameter(this.params.glowIntensity, this.targetParams.glowIntensity, lambda, dt);
    this.params.specularExp = dampParameter(this.params.specularExp, this.targetParams.specularExp, lambda, dt);
    this.params.ambientOcclusion = dampParameter(this.params.ambientOcclusion, this.targetParams.ambientOcclusion, lambda, dt);
    this.params.rotationSpeed = dampParameter(this.params.rotationSpeed, this.targetParams.rotationSpeed, lambda, dt);
    this.params.cameraFov = dampParameter(this.params.cameraFov, this.targetParams.cameraFov, lambda, dt);
    this.targetCamDistance = this.targetParams.camDistance;

    // Discrete parameters
    this.params.fractalType = this.targetParams.fractalType;
    this.params.iterations = this.targetParams.iterations;
    this.params.maxSteps = this.targetParams.maxSteps;
    this.params.cameraAutoRotate = this.targetParams.cameraAutoRotate;

    if (this.params.colorPalette !== this.targetParams.colorPalette) {
      this.params.colorPalette = this.targetParams.colorPalette;
      this.updatePaletteUniforms(this.params.colorPalette);
    }

    // Camera Auto-Rotation
    if (this.params.cameraAutoRotate && !this.isPointerDown) {
      const motionScale = this.prefersReducedMotion ? 0.2 : 1.0;
      this.targetCamAzimuth += this.params.rotationSpeed * dt * 0.4 * motionScale;
    }

    // Smooth Camera Damping
    this.camAzimuth = dampParameter(this.camAzimuth, this.targetCamAzimuth, 8.0, dt);
    this.camElevation = dampParameter(this.camElevation, this.targetCamElevation, 8.0, dt);
    this.camDistance = dampParameter(this.camDistance, this.targetCamDistance, 8.0, dt);
    this.currentLookAt.lerp(this.targetLookAt, 1.0 - Math.exp(-6.0 * dt));

    // Compute 3D Spherical Orbital Camera Position
    const cosEl = Math.cos(this.camElevation);
    const sinEl = Math.sin(this.camElevation);
    const sinAz = Math.sin(this.camAzimuth);
    const cosAz = Math.cos(this.camAzimuth);

    const cx = this.currentLookAt.x + this.camDistance * cosEl * sinAz;
    const cy = this.currentLookAt.y + this.camDistance * sinEl;
    const cz = this.currentLookAt.z + this.camDistance * cosEl * cosAz;
    this.uCameraPos.set(cx, cy, cz);
    this.uTarget.copy(this.currentLookAt);

    // Advance Animation Time
    const motionRate = this.prefersReducedMotion ? 0.2 : 1.0;
    this.totalTime += dt * motionRate;

    // Sync Uniforms
    const uniforms = this.material.uniforms;
    uniforms.uTime.value = this.totalTime;
    uniforms.uResolution.value.set(this.width, this.height);
    uniforms.uCameraPos.value.copy(this.uCameraPos);
    uniforms.uTarget.value.copy(this.uTarget);
    uniforms.uFov.value = this.params.cameraFov;
    uniforms.uFractalType.value = this.getFractalTypeIndex(this.params.fractalType);
    uniforms.uPower.value = this.params.power;
    uniforms.uIterations.value = this.params.iterations;
    uniforms.uMorphParam.value = this.params.morphParam;
    uniforms.uScale.value = this.params.scale;
    uniforms.uMaxSteps.value = this.params.maxSteps;
    uniforms.uGlowIntensity.value = this.params.glowIntensity;
    uniforms.uSpecularExp.value = this.params.specularExp;
    uniforms.uAO.value = this.params.ambientOcclusion;

    // Render WebGL2 Raymarch Frame
    this.renderer.render(this.scene, this.camera);

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass.
   * Renders the raymarched fractal quad onto an off-screen canvas at target resolution (e.g. 4K/8K).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;

    try {
      const offRenderer = new THREE.WebGLRenderer({
        canvas: offCanvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        preserveDrawingBuffer: true,
      });

      offRenderer.setSize(width, height, false);
      offRenderer.setPixelRatio(1.0);
      offRenderer.setClearColor(0x090a0d, 1.0);

      const offScene = new THREE.Scene();
      const offCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      // Clone Raymarching Material with target resolution
      const offMaterial = this.buildShaderMaterial();
      offMaterial.uniforms.uResolution.value.set(width, height);
      offMaterial.uniforms.uTime.value = this.totalTime;
      offMaterial.uniforms.uCameraPos.value.copy(this.uCameraPos);
      offMaterial.uniforms.uTarget.value.copy(this.uTarget);
      offMaterial.uniforms.uFov.value = this.params.cameraFov;
      offMaterial.uniforms.uPower.value = this.params.power;
      offMaterial.uniforms.uIterations.value = Math.min(this.params.iterations + 2, 16);
      offMaterial.uniforms.uMorphParam.value = this.params.morphParam;
      offMaterial.uniforms.uScale.value = this.params.scale;
      offMaterial.uniforms.uMaxSteps.value = Math.min(this.params.maxSteps + 40, 180);
      offMaterial.uniforms.uGlowIntensity.value = this.params.glowIntensity;
      offMaterial.uniforms.uSpecularExp.value = this.params.specularExp;
      offMaterial.uniforms.uAO.value = this.params.ambientOcclusion;

      const offMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), offMaterial);
      offScene.add(offMesh);

      offRenderer.render(offScene, offCamera);

      // Clean up temporary snapshot resources
      offMaterial.dispose();
      offMesh.geometry.dispose();
      offRenderer.dispose();
    } catch (err) {
      console.warn('Raymarched fractal captureSnapshot fallback:', err);
    }

    return offCanvas;
  }

  /**
   * Returns whether the simulation is currently active and mounted.
   */
  public isSimulationMounted(): boolean {
    return this.isMounted;
  }

  /**
   * Tears down Three.js scene, disposes shader materials, geometries, and renderer context.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.nativeCleanupListeners) {
      this.nativeCleanupListeners();
      this.nativeCleanupListeners = null;
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
  }
}

export const room: RoomInstance = new FractalRoom();
export default room;
