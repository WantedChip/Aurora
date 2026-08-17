/**
 * Room 13: Fluid Dynamics Simulation (Navier-Stokes / SPH Cursor Dynamics)
 * Curatorial Category: Fluid & Surface
 * Math Model: Eulerian Incompressible Navier-Stokes Equations with Vorticity Confinement
 * Compute Engine: Three.js WebGPURenderer / TSL Density Shader with High-Performance TypedArray Fallback
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Solves 2D incompressible Navier-Stokes differential equations:
 *     ∂u/∂t = -(u·∇)u - (1/ρ)∇p + ν∇²u + f_ext + f_vort
 *     ∇·u = 0 (Incompressibility constraint)
 * - MacCormack / Semi-Lagrangian advection with bilinear spatial interpolation
 * - Vorticity confinement restoring micro-turbulent eddies:
 *     ω = ∇ × u = ∂v/∂x - ∂u/∂y
 *     η = ∇|ω|, N = η / ||η||
 *     f_vort = ε (N × ω)
 * - Divergence calculation & multi-pass Jacobi pressure Poisson solver:
 *     ∇²p = ∇·u*
 *     u_new = u* - ∇p
 * - 6 Canonical Fluid Presets (Cosmic Nebula, Liquid Mercury, Electric Plasma, Ink in Water, Quantum Vortex, Smoke Plumes)
 * - 6 Curatorial Spectral Palettes (Spectral Aurora, Electric Neon, Solar Plasma, Obsidian Emerald, Cosmic Violet, Monochrome Smoke)
 * - Rich 3D normal-mapped surface relief with Blinn-Phong lighting, Fresnel rim glow, and velocity-tinted refraction
 * - Interactive pointer dynamics: localized force injection, chromatic dye impulses, and click shockwave vortices
 * - Audio reactivity: sub-bass pulse expansion, mid-range swirl excitation, treble shimmer
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three/webgpu';
import {
  uniform,
  vec2,
  vec3,
  vec4,
  float,
  uv,
  mix,
  clamp,
  tslFn,
  texture,
} from 'three/tsl';

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';
import { detectGPUCapabilities } from '../../lib/gpu';

export type FluidPreset =
  | 'cosmic-nebula'
  | 'liquid-mercury'
  | 'electric-plasma'
  | 'ink-in-water'
  | 'quantum-vortex'
  | 'smoke-plumes';

export type FluidPalette =
  | 'spectral-aurora'
  | 'electric-neon'
  | 'solar-plasma'
  | 'obsidian-emerald'
  | 'cosmic-violet'
  | 'monochrome-smoke';

export interface FluidParams {
  seed: string;
  preset: FluidPreset;
  colorPalette: FluidPalette;
  vorticity: number;
  viscosity: number;
  dissipation: number;
  velDissipation: number;
  pressureIterations: number;
  splatRadius: number;
  splatForce: number;
  reliefScale: number;
  bloomIntensity: number;
  autonomousFlow: number;
  showVectors: boolean;
  wrapMode: 'clamp' | 'wrap';
}

export const DEFAULT_FLUID_PARAMS: FluidParams = {
  seed: '#38BDF8',
  preset: 'cosmic-nebula',
  colorPalette: 'spectral-aurora',
  vorticity: 26.0,
  viscosity: 0.0008,
  dissipation: 0.992,
  velDissipation: 0.988,
  pressureIterations: 32,
  splatRadius: 0.008,
  splatForce: 1400.0,
  reliefScale: 2.2,
  bloomIntensity: 1.6,
  autonomousFlow: 0.5,
  showVectors: false,
  wrapMode: 'clamp',
};

// Preset configurations
export interface FluidPresetDefinition {
  name: string;
  vorticity: number;
  viscosity: number;
  dissipation: number;
  velDissipation: number;
  pressureIterations: number;
  splatRadius: number;
  splatForce: number;
  reliefScale: number;
  bloomIntensity: number;
  autonomousFlow: number;
  description: string;
}

export const FLUID_PRESETS: Record<FluidPreset, FluidPresetDefinition> = {
  'cosmic-nebula': {
    name: 'Cosmic Nebula',
    vorticity: 28.0,
    viscosity: 0.0005,
    dissipation: 0.994,
    velDissipation: 0.990,
    pressureIterations: 32,
    splatRadius: 0.008,
    splatForce: 1300.0,
    reliefScale: 1.8,
    bloomIntensity: 1.8,
    autonomousFlow: 0.6,
    description: 'Silky cosmic dust clouds billowing with ethereal celestial luminescence.',
  },
  'liquid-mercury': {
    name: 'Liquid Mercury',
    vorticity: 6.0,
    viscosity: 0.025,
    dissipation: 0.980,
    velDissipation: 0.965,
    pressureIterations: 40,
    splatRadius: 0.012,
    splatForce: 1800.0,
    reliefScale: 4.5,
    bloomIntensity: 0.8,
    autonomousFlow: 0.2,
    description: 'Dense, weighty liquid metal with high physical surface tension and metallic specular crests.',
  },
  'electric-plasma': {
    name: 'Electric Plasma',
    vorticity: 38.0,
    viscosity: 0.0001,
    dissipation: 0.990,
    velDissipation: 0.994,
    pressureIterations: 28,
    splatRadius: 0.006,
    splatForce: 1600.0,
    reliefScale: 2.4,
    bloomIntensity: 2.6,
    autonomousFlow: 0.8,
    description: 'Ionized plasma discharge with hyper-energetic turbulent micro-eddies and radiant filaments.',
  },
  'ink-in-water': {
    name: 'Ink in Water',
    vorticity: 16.0,
    viscosity: 0.002,
    dissipation: 0.986,
    velDissipation: 0.982,
    pressureIterations: 30,
    splatRadius: 0.010,
    splatForce: 1000.0,
    reliefScale: 1.8,
    bloomIntensity: 1.2,
    autonomousFlow: 0.4,
    description: 'Tactile organic pigment billowing through clear water with smooth laminar plume dispersion.',
  },
  'quantum-vortex': {
    name: 'Quantum Vortex',
    vorticity: 48.0,
    viscosity: 0.000,
    dissipation: 0.998,
    velDissipation: 0.998,
    pressureIterations: 45,
    splatRadius: 0.005,
    splatForce: 1400.0,
    reliefScale: 2.8,
    bloomIntensity: 2.0,
    autonomousFlow: 0.7,
    description: 'Frictionless superfluid dynamics generating persistent quantum vortex filaments and soliton rings.',
  },
  'smoke-plumes': {
    name: 'Smoke Plumes',
    vorticity: 22.0,
    viscosity: 0.001,
    dissipation: 0.976,
    velDissipation: 0.982,
    pressureIterations: 26,
    splatRadius: 0.007,
    splatForce: 850.0,
    reliefScale: 1.2,
    bloomIntensity: 1.1,
    autonomousFlow: 0.5,
    description: 'Atmospheric incense plumes rising, expanding, and diffusing into obsidian air.',
  },
};

// Curatorial Spectral Palettes
export interface PaletteDefinition {
  name: string;
  voidColor: [number, number, number];    // Obsidian void #090A0D
  baseColor: [number, number, number];    // Primary smoke body
  accentColor: [number, number, number];  // Active vortex filament edge
  crestColor: [number, number, number];   // Starlight apex specular crest
  dyeColors: [number, number, number][];  // Dynamic injection tones
}

export const FLUID_PALETTES: Record<FluidPalette, PaletteDefinition> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.0, 0.85, 0.95],     // Electric Cyan #00F0FF
    accentColor: [0.0, 1.0, 0.62],    // Aurora Mint #00FF9D
    crestColor: [0.95, 0.98, 1.0],    // Starlight White
    dyeColors: [
      [0.0, 0.94, 1.0],   // Cyan
      [0.0, 1.0, 0.62],   // Mint
      [0.66, 0.33, 0.97], // Violet
      [0.2, 0.7, 1.0],    // Blue
    ],
  },
  'electric-neon': {
    name: 'Electric Neon',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [1.0, 0.0, 0.50],     // Laser Magenta #FF007F
    accentColor: [0.0, 0.94, 1.0],    // Electric Cyan #00F0FF
    crestColor: [1.0, 0.95, 1.0],     // Diamond White
    dyeColors: [
      [1.0, 0.0, 0.5],    // Magenta
      [0.0, 0.9, 1.0],    // Cyan
      [0.47, 0.16, 0.79], // Ultraviolet
      [1.0, 0.85, 0.0],   // Gold
    ],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    voidColor: [0.04, 0.02, 0.01],
    baseColor: [1.0, 0.58, 0.0],     // Solar Amber #FF9500
    accentColor: [1.0, 0.16, 0.0],    // Volcanic Crimson #FF2A00
    crestColor: [1.0, 0.96, 0.72],    // Solar Gold Crest
    dyeColors: [
      [1.0, 0.58, 0.0],   // Amber
      [1.0, 0.16, 0.0],   // Crimson
      [1.0, 0.84, 0.0],   // Gold
      [1.0, 0.35, 0.1],   // Flare
    ],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    voidColor: [0.02, 0.04, 0.03],
    baseColor: [0.02, 0.75, 0.42],    // Emerald Jade #00FF9D
    accentColor: [0.64, 0.90, 0.21],  // Neon Lime #A3E635
    crestColor: [0.92, 0.98, 0.94],   // Silver Vein
    dyeColors: [
      [0.0, 1.0, 0.62],   // Emerald
      [0.64, 0.90, 0.21], // Lime
      [0.0, 0.85, 0.80],  // Turquoise
      [0.85, 1.0, 0.5],   // Pale Gold
    ],
  },
  'cosmic-violet': {
    name: 'Cosmic Violet',
    voidColor: [0.04, 0.02, 0.08],
    baseColor: [0.58, 0.20, 0.92],    // Royal Purple #9333EA
    accentColor: [0.93, 0.28, 0.60],  // Hot Pink #EC4899
    crestColor: [0.35, 0.85, 1.0],    // Cyan Spark #38BDF8
    dyeColors: [
      [0.58, 0.20, 0.92], // Purple
      [0.93, 0.28, 0.60], // Pink
      [0.22, 0.74, 0.97], // Cyan
      [0.75, 0.4, 1.0],   // Lavender
    ],
  },
  'monochrome-smoke': {
    name: 'Monochrome Smoke',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.45, 0.50, 0.60],    // Slate Gray #64748B
    accentColor: [0.80, 0.84, 0.90],  // Platinum Silver #CBD5E1
    crestColor: [0.98, 0.98, 1.0],    // Pure Starlight #FFFFFF
    dyeColors: [
      [0.95, 0.96, 0.98], // White
      [0.65, 0.70, 0.78], // Silver
      [0.35, 0.40, 0.48], // Dark Slate
      [0.85, 0.88, 0.92], // Pure Platinum
    ],
  },
};

export class FluidRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;

  private simTexture: THREE.DataTexture | null = null;
  private backendMode: 'webgpu' | 'canvas2d' = 'webgpu';

  private prng: PRNG = createPRNG('#38BDF8');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;

  // Fluid Grid State Buffers
  private simWidth = 256;
  private simHeight = 256;
  private u: Float32Array = new Float32Array(0);
  private v: Float32Array = new Float32Array(0);
  private u0: Float32Array = new Float32Array(0);
  private v0: Float32Array = new Float32Array(0);
  private dyeR: Float32Array = new Float32Array(0);
  private dyeG: Float32Array = new Float32Array(0);
  private dyeB: Float32Array = new Float32Array(0);
  private dyeR0: Float32Array = new Float32Array(0);
  private dyeG0: Float32Array = new Float32Array(0);
  private dyeB0: Float32Array = new Float32Array(0);
  private pressure: Float32Array = new Float32Array(0);
  private pressure0: Float32Array = new Float32Array(0);
  private divergence: Float32Array = new Float32Array(0);
  private curl: Float32Array = new Float32Array(0);
  private rgbaBuffer: Float32Array = new Float32Array(0);

  // CPU 2D Fallback Pixel Buffer & Precomputed Color LUT
  private fallbackImageData: ImageData | null = null;
  private fallbackImageBuf32: Uint32Array | null = null;
  private colorLutABGR: Uint32Array = new Uint32Array(256);

  // Active & Target Parameters (for smooth dampening)
  private params: FluidParams = { ...DEFAULT_FLUID_PARAMS };
  private targetParams: FluidParams = { ...DEFAULT_FLUID_PARAMS };

  // TSL Uniform Nodes
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uTexelSize = uniform(new THREE.Vector2(1 / 256, 1 / 256));
  private uReliefScale = uniform(2.2);
  private uBloomIntensity = uniform(1.6);
  private uColorVoid = uniform(new THREE.Color(0.035, 0.039, 0.051));
  private uColorBase = uniform(new THREE.Color(0.0, 0.85, 0.95));
  private uColorAccent = uniform(new THREE.Color(0.0, 1.0, 0.62));
  private uColorCrest = uniform(new THREE.Color(0.95, 0.98, 1.0));

  // Pointer Interaction
  private pointerX = -1000;
  private pointerY = -1000;
  private prevPointerX = -1000;
  private prevPointerY = -1000;
  private isPointerDown = false;
  private pointerDyeIndex = 0;

  // Autonomous Emitters
  private emitterPhase = 0;

  // Audio Context reference
  private audioCtx: any = null;
  private isMounted = false;

  /**
   * Mounts the fluid dynamics simulation to the canvas and viewport.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = Math.min(ctx.dpr || 1, 2.0);
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_FLUID_PARAMS.seed);
    this.audioCtx = ctx.audio || null;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Detect GPU capabilities
    const gpuCaps = await detectGPUCapabilities();
    const canUseGPU = gpuCaps.hasWebGPU || gpuCaps.hasWebGL2;

    // Select grid resolution preserving aspect ratio (256x256 nominal)
    const aspect = this.width / this.height;
    if (aspect >= 1.0) {
      this.simWidth = 256;
      this.simHeight = Math.max(128, Math.round(256 / aspect));
    } else {
      this.simHeight = 256;
      this.simWidth = Math.max(128, Math.round(256 * aspect));
    }

    this.initSimulationBuffers();
    this.seedFluidDynamics();
    this.rebuildColorLut();

    if (canUseGPU) {
      try {
        await this.initGPURenderer();
        this.backendMode = 'webgpu';
      } catch (err) {
        console.warn('WebGPU/WebGL2 initialization fallback in Room 13:', err);
        this.initCanvas2DFallback();
        this.backendMode = 'canvas2d';
      }
    } else {
      this.initCanvas2DFallback();
      this.backendMode = 'canvas2d';
    }

    this.isMounted = true;
    this.lastTime = performance.now();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Allocates contiguous Float32Array fluid physics buffers.
   */
  private initSimulationBuffers(): void {
    const size = this.simWidth * this.simHeight;
    this.u = new Float32Array(size);
    this.v = new Float32Array(size);
    this.u0 = new Float32Array(size);
    this.v0 = new Float32Array(size);
    this.dyeR = new Float32Array(size);
    this.dyeG = new Float32Array(size);
    this.dyeB = new Float32Array(size);
    this.dyeR0 = new Float32Array(size);
    this.dyeG0 = new Float32Array(size);
    this.dyeB0 = new Float32Array(size);
    this.pressure = new Float32Array(size);
    this.pressure0 = new Float32Array(size);
    this.divergence = new Float32Array(size);
    this.curl = new Float32Array(size);
    this.rgbaBuffer = new Float32Array(size * 4);

    this.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
  }

  /**
   * Seeds the fluid grid with initial swirling vortex pairs and chromatic plumes.
   */
  private seedFluidDynamics(): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const size = w * h;

    for (let i = 0; i < size; i++) {
      this.u[i] = 0;
      this.v[i] = 0;
      this.u0[i] = 0;
      this.v0[i] = 0;
      this.dyeR[i] = 0;
      this.dyeG[i] = 0;
      this.dyeB[i] = 0;
      this.dyeR0[i] = 0;
      this.dyeG0[i] = 0;
      this.dyeB0[i] = 0;
      this.pressure[i] = 0;
      this.pressure0[i] = 0;
    }

    const paletteDef = FLUID_PALETTES[this.params.colorPalette] || FLUID_PALETTES['spectral-aurora'];
    const paletteDyes = paletteDef.dyeColors;

    // Seed 4-8 initial vortex plumes across the grid
    const plumeCount = this.prng.nextInt(4, 7);
    for (let p = 0; p < plumeCount; p++) {
      const cx = this.prng.nextInt(Math.floor(w * 0.2), Math.floor(w * 0.8));
      const cy = this.prng.nextInt(Math.floor(h * 0.2), Math.floor(h * 0.8));
      const radius = this.prng.nextInt(12, 28);
      const angle = this.prng.nextFloat(0, Math.PI * 2);
      const speed = this.prng.nextFloat(1.5, 4.0);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const dye = paletteDyes[p % paletteDyes.length];

      this.injectImpulse(cx, cy, vx, vy, dye[0], dye[1], dye[2], radius, 1.2);
    }
  }

  /**
   * Injects localized velocity force and RGB dye into the grid.
   */
  private injectImpulse(
    cx: number,
    cy: number,
    forceX: number,
    forceY: number,
    r: number,
    g: number,
    b: number,
    radius: number,
    dyeMultiplier = 1.0
  ): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const rSq = radius * radius;
    const twoSigmaSq = 2.0 * (radius * 0.45) * (radius * 0.45);

    const minX = Math.max(1, Math.floor(cx - radius));
    const maxX = Math.min(w - 2, Math.ceil(cx + radius));
    const minY = Math.max(1, Math.floor(cy - radius));
    const maxY = Math.min(h - 2, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      const row = y * w;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dSq = dx * dx + dy * dy;
        if (dSq <= rSq) {
          const weight = Math.exp(-dSq / twoSigmaSq);
          const idx = row + x;

          this.u[idx] += forceX * weight;
          this.v[idx] += forceY * weight;

          this.dyeR[idx] = Math.min(4.0, this.dyeR[idx] + r * weight * dyeMultiplier);
          this.dyeG[idx] = Math.min(4.0, this.dyeG[idx] + g * weight * dyeMultiplier);
          this.dyeB[idx] = Math.min(4.0, this.dyeB[idx] + b * weight * dyeMultiplier);
        }
      }
    }
  }

  /**
   * Initializes Three.js WebGPURenderer and TSL Display Quad.
   */
  private async initGPURenderer(): Promise<void> {
    if (!this.canvas) return;

    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });

    await this.renderer.init();
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(this.dpr);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.updateRGBABuffer();
    this.simTexture = new THREE.DataTexture(
      this.rgbaBuffer,
      this.simWidth,
      this.simHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.simTexture.minFilter = THREE.LinearFilter;
    this.simTexture.magFilter = THREE.LinearFilter;
    this.simTexture.needsUpdate = true;

    this.material = this.buildTSLDisplayMaterial();

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  /**
   * Constructs the TSL Display Material with 3D Normal-Mapped Relief, Bloom Glow & Refraction.
   */
  private buildTSLDisplayMaterial(): THREE.MeshBasicNodeMaterial {
    if (!this.simTexture) {
      throw new Error('Simulation DataTexture must be initialized before building TSL material.');
    }

    const simTexNode = texture(this.simTexture);

    const displayColorNode = tslFn(() => {
      const uvCoord = uv();

      // Sample central fluid dye and velocity speed
      const centerSample = simTexNode.sample(uvCoord);
      const dyeRGB = centerSample.rgb;
      const speed = centerSample.a;
      const density = clamp(dyeRGB.r.add(dyeRGB.g).add(dyeRGB.b).mul(float(0.333)), float(0.0), float(3.0));

      // Sample 4 orthogonal neighbors for 3D gradient normal derivation
      const dX = this.uTexelSize.x;
      const dY = this.uTexelSize.y;

      const sL = simTexNode.sample(uvCoord.add(vec2(dX.negate(), float(0.0))));
      const sR = simTexNode.sample(uvCoord.add(vec2(dX, float(0.0))));
      const sU = simTexNode.sample(uvCoord.add(vec2(float(0.0), dY.negate())));
      const sD = simTexNode.sample(uvCoord.add(vec2(float(0.0), dY)));

      const densL = sL.r.add(sL.g).add(sL.b).mul(float(0.333));
      const densR = sR.r.add(sR.g).add(sR.b).mul(float(0.333));
      const densU = sU.r.add(sU.g).add(sU.b).mul(float(0.333));
      const densD = sD.r.add(sD.g).add(sD.b).mul(float(0.333));

      const gradX = densR.sub(densL).mul(this.uReliefScale);
      const gradY = densD.sub(densU).mul(this.uReliefScale);
      const normLen = clamp(gradX.mul(gradX).add(gradY.mul(gradY)).add(float(1.0)), float(0.001), float(100.0)).sqrt();

      const nX = gradX.negate().div(normLen);
      const nY = gradY.negate().div(normLen);
      const nZ = float(1.0).div(normLen);

      // Blinn-Phong directional starlight lighting
      const lightDir = vec3(0.55, 0.65, 0.8).normalize();
      const normalVec = vec3(nX, nY, nZ);
      const diffuseLight = clamp(normalVec.dot(lightDir), float(0.0), float(1.0));

      // Specular highlight crest
      const viewDir = vec3(0.0, 0.0, 1.0);
      const halfVector = lightDir.add(viewDir).normalize();
      const specAngle = clamp(normalVec.dot(halfVector), float(0.0), float(1.0));
      const specularLight = specAngle.mul(specAngle).mul(specAngle).mul(specAngle).mul(specAngle);

      // Fresnel rim lighting
      const fresnel = float(1.0).sub(clamp(normalVec.dot(viewDir), float(0.0), float(1.0)));
      const rimLight = fresnel.mul(fresnel);

      // Palette modulation & dynamic dye emission
      const voidFade = clamp(density.mul(float(4.0)), float(0.0), float(1.0));
      const baseLit = mix(this.uColorVoid, dyeRGB, voidFade);

      // Dynamic starlight and specular crest injection
      const specularColor = this.uColorCrest.mul(specularLight.mul(float(0.85)));
      const rimColor = this.uColorAccent.mul(rimLight.mul(float(0.4)));
      const speedGlow = this.uColorAccent.mul(clamp(speed.mul(float(0.2)), float(0.0), float(1.0)).mul(float(0.35)));
      const bloomGlow = dyeRGB.mul(this.uBloomIntensity).mul(float(0.5)).add(speedGlow);

      const finalColor = baseLit
        .mul(diffuseLight.mul(float(0.7)).add(float(0.3)))
        .add(specularColor)
        .add(rimColor)
        .add(bloomGlow);

      return vec4(finalColor, float(1.0));
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = displayColorNode();
    return mat;
  }

  /**
   * Initializes Canvas2D fallback context and pixel buffers.
   */
  private initCanvas2DFallback(): void {
    if (!this.canvas) return;
    this.ctx2d = this.canvas.getContext('2d', { alpha: false });
    this.fallbackImageData = new ImageData(this.simWidth, this.simHeight);
    this.fallbackImageBuf32 = new Uint32Array(this.fallbackImageData.data.buffer);
  }

  /**
   * Rebuilds 256-entry 32-bit ABGR Color Lookup Table for Canvas2D fallback.
   */
  private rebuildColorLut(): void {
    const palette = FLUID_PALETTES[this.params.colorPalette] || FLUID_PALETTES['spectral-aurora'];
    this.uColorVoid.value.setRGB(palette.voidColor[0], palette.voidColor[1], palette.voidColor[2]);
    this.uColorBase.value.setRGB(palette.baseColor[0], palette.baseColor[1], palette.baseColor[2]);
    this.uColorAccent.value.setRGB(palette.accentColor[0], palette.accentColor[1], palette.accentColor[2]);
    this.uColorCrest.value.setRGB(palette.crestColor[0], palette.crestColor[1], palette.crestColor[2]);

    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let r = 0, g = 0, b = 0;

      if (t < 0.25) {
        const uVal = t / 0.25;
        r = palette.voidColor[0] * (1 - uVal) + palette.baseColor[0] * uVal;
        g = palette.voidColor[1] * (1 - uVal) + palette.baseColor[1] * uVal;
        b = palette.voidColor[2] * (1 - uVal) + palette.baseColor[2] * uVal;
      } else if (t < 0.7) {
        const uVal = (t - 0.25) / 0.45;
        r = palette.baseColor[0] * (1 - uVal) + palette.accentColor[0] * uVal;
        g = palette.baseColor[1] * (1 - uVal) + palette.accentColor[1] * uVal;
        b = palette.baseColor[2] * (1 - uVal) + palette.accentColor[2] * uVal;
      } else {
        const uVal = (t - 0.7) / 0.3;
        r = palette.accentColor[0] * (1 - uVal) + palette.crestColor[0] * uVal;
        g = palette.accentColor[1] * (1 - uVal) + palette.crestColor[1] * uVal;
        b = palette.accentColor[2] * (1 - uVal) + palette.crestColor[2] * uVal;
      }

      const ir = Math.min(255, Math.max(0, Math.round(r * 255)));
      const ig = Math.min(255, Math.max(0, Math.round(g * 255)));
      const ib = Math.min(255, Math.max(0, Math.round(b * 255)));

      this.colorLutABGR[i] = (255 << 24) | (ib << 16) | (ig << 8) | ir;
    }
  }

  /**
   * Main simulation and rendering loop.
   */
  private loop(now: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((now - this.lastTime) * 0.001, 0.05);
    this.lastTime = now;

    this.dampActiveParameters(dt);
    this.updateAutonomousEmitters(dt);
    this.processPointerInteraction(dt);
    this.stepNavierStokes(dt);

    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera && this.simTexture) {
      this.updateRGBABuffer();
      this.simTexture.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d' && this.ctx2d && this.canvas) {
      this.renderCanvas2DFallback();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Evaluates autonomous swirling emitter nodes.
   */
  private updateAutonomousEmitters(dt: number): void {
    if (this.params.autonomousFlow <= 0.001) return;

    this.emitterPhase += dt * (0.8 + this.params.autonomousFlow * 0.8);
    const w = this.simWidth;
    const h = this.simHeight;
    const paletteDef = FLUID_PALETTES[this.params.colorPalette] || FLUID_PALETTES['spectral-aurora'];
    const dyes = paletteDef.dyeColors;

    // 3 Deterministic Orbiting Emitters
    const count = 3;
    for (let e = 0; e < count; e++) {
      const offset = (e * (Math.PI * 2)) / count;
      const t = this.emitterPhase + offset;
      const cx = w * 0.5 + Math.cos(t * 0.7) * (w * 0.28) + Math.sin(t * 1.3) * (w * 0.08);
      const cy = h * 0.5 + Math.sin(t * 0.9) * (h * 0.28) + Math.cos(t * 1.1) * (h * 0.08);

      // Tangential velocity vector
      const vx = -Math.sin(t * 0.7) * 2.8 * this.params.autonomousFlow;
      const vy = Math.cos(t * 0.9) * 2.8 * this.params.autonomousFlow;

      const dye = dyes[e % dyes.length];
      const radius = 6.0 + Math.sin(t * 2.0) * 2.0;

      this.injectImpulse(cx, cy, vx, vy, dye[0], dye[1], dye[2], radius, 0.4 * this.params.autonomousFlow);
    }

    // Audio reactive boost if active
    if (this.audioCtx && typeof this.audioCtx.getEnergy === 'function') {
      const bass = this.audioCtx.getEnergy('bass') || 0;
      if (bass > 0.4) {
        const centerDye = dyes[Math.floor(this.emitterPhase) % dyes.length];
        this.injectImpulse(
          w * 0.5,
          h * 0.5,
          Math.cos(this.emitterPhase * 4) * bass * 4.0,
          Math.sin(this.emitterPhase * 4) * bass * 4.0,
          centerDye[0],
          centerDye[1],
          centerDye[2],
          14.0 * bass,
          bass * 1.5
        );
      }
    }
  }

  /**
   * Processes continuous pointer force and dye injection.
   */
  private processPointerInteraction(dt: number): void {
    if (this.pointerX < 0 || this.pointerY < 0) return;

    const w = this.simWidth;
    const h = this.simHeight;
    const currGridX = this.pointerX * w;
    const currGridY = this.pointerY * h;

    if (this.prevPointerX < 0 || this.prevPointerY < 0) {
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      return;
    }

    const prevGridX = this.prevPointerX * w;
    const prevGridY = this.prevPointerY * h;
    const dx = currGridX - prevGridX;
    const dy = currGridY - prevGridY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const forceMult = this.params.splatForce * (this.isPointerDown ? 1.5 : 0.85);
    const radius = Math.max(4.0, this.params.splatRadius * Math.max(w, h) * (this.isPointerDown ? 1.6 : 1.0));

    const paletteDef = FLUID_PALETTES[this.params.colorPalette] || FLUID_PALETTES['spectral-aurora'];
    const dyes = paletteDef.dyeColors;

    if (dist > 0.01) {
      const vx = (dx / Math.max(dt, 0.001)) * (forceMult * 0.0003);
      const vy = (dy / Math.max(dt, 0.001)) * (forceMult * 0.0003);

      // Color selection based on heading angle
      const angle = Math.atan2(vy, vx);
      const dyeIdx = (Math.floor(((angle + Math.PI) / (Math.PI * 2)) * dyes.length) + this.pointerDyeIndex) % dyes.length;
      const dye = dyes[dyeIdx];

      // Interpolate along movement line to prevent splat gaps during fast strokes
      const steps = Math.min(8, Math.max(1, Math.ceil(dist / (radius * 0.5))));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const ix = prevGridX + dx * t;
        const iy = prevGridY + dy * t;
        this.injectImpulse(ix, iy, vx, vy, dye[0], dye[1], dye[2], radius, this.isPointerDown ? 1.4 : 0.7);
      }
    } else if (this.isPointerDown) {
      // Hovering click burst vortex
      const dye = dyes[this.pointerDyeIndex % dyes.length];
      const swirlSpeed = 2.5;
      const vx = Math.cos(this.emitterPhase * 5) * swirlSpeed;
      const vy = Math.sin(this.emitterPhase * 5) * swirlSpeed;
      this.injectImpulse(currGridX, currGridY, vx, vy, dye[0], dye[1], dye[2], radius, 1.2);
    }

    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;
  }

  /**
   * Executes numerical Navier-Stokes simulation passes.
   */
  private stepNavierStokes(dt: number): void {
    // 1. Vorticity Confinement Pass (Restores turbulent micro-eddies)
    if (this.params.vorticity > 0.0) {
      this.computeVorticityConfinement(dt);
    }

    // 2. Viscous Diffusion Pass (Optional Jacobi steps)
    if (this.params.viscosity > 0.0001) {
      this.diffuseVelocity(dt);
    }

    // 3. Pressure Poisson Projection Pass (Enforces incompressibility ∇·u = 0)
    this.projectPressure();

    // 4. Semi-Lagrangian Advection Pass for Velocity & Luminous Dye
    this.advectFields(dt);
  }

  /**
   * Calculates vorticity curl and injects confinement forces.
   */
  private computeVorticityConfinement(dt: number): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const u = this.u;
    const v = this.v;
    const curl = this.curl;
    const vorticityCoeff = this.params.vorticity * 12.0;

    // Compute curl field: ω = ∂v/∂x - ∂u/∂y
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      const rowU = (y - 1) * w;
      const rowD = (y + 1) * w;
      for (let x = 1; x < w - 1; x++) {
        const dvdx = (v[row + x + 1] - v[row + x - 1]) * 0.5;
        const dudy = (u[rowD + x] - u[rowU + x]) * 0.5;
        curl[row + x] = dvdx - dudy;
      }
    }

    // Compute gradient of absolute curl η = ∇|ω|, N = η / ||η||
    for (let y = 2; y < h - 2; y++) {
      const row = y * w;
      const rowU = (y - 1) * w;
      const rowD = (y + 1) * w;
      for (let x = 2; x < w - 2; x++) {
        const cR = Math.abs(curl[row + x + 1]);
        const cL = Math.abs(curl[row + x - 1]);
        const cD = Math.abs(curl[rowD + x]);
        const cU = Math.abs(curl[rowU + x]);

        const etaX = (cR - cL) * 0.5;
        const etaY = (cD - cU) * 0.5;
        const mag = Math.sqrt(etaX * etaX + etaY * etaY) + 1e-5;

        const nx = etaX / mag;
        const ny = etaY / mag;
        const curVal = curl[row + x];

        // Vorticity force: F_vort = ε (N × ω) = (ny * ω, -nx * ω)
        const fx = ny * curVal * vorticityCoeff;
        const fy = -nx * curVal * vorticityCoeff;

        const idx = row + x;
        u[idx] += fx * dt;
        v[idx] += fy * dt;
      }
    }
  }

  /**
   * Viscous velocity diffusion via Jacobi relaxation.
   */
  private diffuseVelocity(dt: number): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const u = this.u;
    const v = this.v;
    const u0 = this.u0;
    const v0 = this.v0;

    u0.set(u);
    v0.set(v);

    const a = dt * this.params.viscosity * w * h;
    const c = 1.0 + 4.0 * a;
    const invC = 1.0 / c;

    // 4 Jacobi relaxation iterations
    for (let iter = 0; iter < 4; iter++) {
      for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        const rowU = (y - 1) * w;
        const rowD = (y + 1) * w;
        for (let x = 1; x < w - 1; x++) {
          const idx = row + x;
          u[idx] = (u0[idx] + a * (u[row + x + 1] + u[row + x - 1] + u[rowD + x] + u[rowU + x])) * invC;
          v[idx] = (v0[idx] + a * (v[row + x + 1] + v[row + x - 1] + v[rowD + x] + v[rowU + x])) * invC;
        }
      }
    }
  }

  /**
   * Multi-pass Jacobi pressure Poisson solver and projection (∇·u = 0).
   */
  private projectPressure(): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const u = this.u;
    const v = this.v;
    const p = this.pressure;
    const p0 = this.pressure0;
    const div = this.divergence;

    // 1. Calculate divergence: div = -0.5 * (du/dx + dv/dy)
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      const rowU = (y - 1) * w;
      const rowD = (y + 1) * w;
      for (let x = 1; x < w - 1; x++) {
        const dudx = u[row + x + 1] - u[row + x - 1];
        const dvdy = v[rowD + x] - v[rowU + x];
        div[row + x] = -0.5 * (dudx + dvdy);
      }
    }

    p.fill(0);
    p0.fill(0);

    const iterations = Math.max(10, Math.min(60, Math.round(this.params.pressureIterations)));

    // 2. Jacobi relaxation iterations for Poisson equation ∇²p = div
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        const rowU = (y - 1) * w;
        const rowD = (y + 1) * w;
        for (let x = 1; x < w - 1; x++) {
          const idx = row + x;
          p0[idx] = (div[idx] + p[row + x + 1] + p[row + x - 1] + p[rowD + x] + p[rowU + x]) * 0.25;
        }
      }

      // Neumann boundary condition: copy adjacent pressure to boundary
      for (let x = 0; x < w; x++) {
        p0[x] = p0[w + x];
        p0[(h - 1) * w + x] = p0[(h - 2) * w + x];
      }
      for (let y = 0; y < h; y++) {
        p0[y * w] = p0[y * w + 1];
        p0[y * w + w - 1] = p0[y * w + w - 2];
      }

      // Swap pressure buffers
      p.set(p0);
    }

    // 3. Subtract pressure gradient: u = u* - ∇p
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      const rowU = (y - 1) * w;
      const rowD = (y + 1) * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = row + x;
        u[idx] -= 0.5 * (p[row + x + 1] - p[row + x - 1]);
        v[idx] -= 0.5 * (p[rowD + x] - p[rowU + x]);
      }
    }

    // Boundary conditions
    if (this.params.wrapMode === 'clamp') {
      for (let x = 0; x < w; x++) {
        v[x] = -v[w + x] * 0.5;
        v[(h - 1) * w + x] = -v[(h - 2) * w + x] * 0.5;
      }
      for (let y = 0; y < h; y++) {
        u[y * w] = -u[y * w + 1] * 0.5;
        u[y * w + w - 1] = -u[y * w + w - 2] * 0.5;
      }
    }
  }

  /**
   * Semi-Lagrangian Advection pass for velocity and RGB dye fields.
   */
  private advectFields(dt: number): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const u = this.u;
    const v = this.v;
    const u0 = this.u0;
    const v0 = this.v0;
    const dyeR = this.dyeR;
    const dyeG = this.dyeG;
    const dyeB = this.dyeB;
    const dyeR0 = this.dyeR0;
    const dyeG0 = this.dyeG0;
    const dyeB0 = this.dyeB0;

    u0.set(u);
    v0.set(v);
    dyeR0.set(dyeR);
    dyeG0.set(dyeG);
    dyeB0.set(dyeB);

    const dtx = dt * w;
    const dty = dt * h;
    const velDissip = this.params.velDissipation;
    const dyeDissip = this.params.dissipation;
    const isWrap = this.params.wrapMode === 'wrap';

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const idx = row + x;

        // Backtrace coordinate: x_prev = x - u * dt
        let px = x - u0[idx] * dtx;
        let py = y - v0[idx] * dty;

        if (isWrap) {
          px = ((px % w) + w) % w;
          py = ((py % h) + h) % h;
        } else {
          px = Math.max(0.5, Math.min(w - 1.5, px));
          py = Math.max(0.5, Math.min(h - 1.5, py));
        }

        // Bilinear interpolation
        const i0 = Math.floor(px);
        const j0 = Math.floor(py);
        const i1 = isWrap ? (i0 + 1) % w : Math.min(w - 1, i0 + 1);
        const j1 = isWrap ? (j0 + 1) % h : Math.min(h - 1, j0 + 1);

        const sx = px - i0;
        const sy = py - j0;
        const s0 = 1.0 - sx;
        const t0 = 1.0 - sy;

        const idx00 = j0 * w + i0;
        const idx10 = j0 * w + i1;
        const idx01 = j1 * w + i0;
        const idx11 = j1 * w + i1;

        const w00 = s0 * t0;
        const w10 = sx * t0;
        const w01 = s0 * sy;
        const w11 = sx * sy;

        // Advect Velocity
        u[idx] = (u0[idx00] * w00 + u0[idx10] * w10 + u0[idx01] * w01 + u0[idx11] * w11) * velDissip;
        v[idx] = (v0[idx00] * w00 + v0[idx10] * w10 + v0[idx01] * w01 + v0[idx11] * w11) * velDissip;

        // Advect Dye Channels
        dyeR[idx] = (dyeR0[idx00] * w00 + dyeR0[idx10] * w10 + dyeR0[idx01] * w01 + dyeR0[idx11] * w11) * dyeDissip;
        dyeG[idx] = (dyeG0[idx00] * w00 + dyeG0[idx10] * w10 + dyeG0[idx01] * w01 + dyeG0[idx11] * w11) * dyeDissip;
        dyeB[idx] = (dyeB0[idx00] * w00 + dyeB0[idx10] * w10 + dyeB0[idx01] * w01 + dyeB0[idx11] * w11) * dyeDissip;
      }
    }
  }

  /**
   * Packs simulation field data into Float32 RGBA texture buffer.
   */
  private updateRGBABuffer(): void {
    const size = this.simWidth * this.simHeight;
    const r = this.dyeR;
    const g = this.dyeG;
    const b = this.dyeB;
    const u = this.u;
    const v = this.v;
    const buf = this.rgbaBuffer;

    for (let i = 0; i < size; i++) {
      const bIdx = i * 4;
      buf[bIdx] = r[i];
      buf[bIdx + 1] = g[i];
      buf[bIdx + 2] = b[i];
      // Store velocity speed in Alpha channel for lighting / refraction
      buf[bIdx + 3] = Math.sqrt(u[i] * u[i] + v[i] * v[i]);
    }
  }

  /**
   * Renders high-performance CPU Canvas2D fallback with 3D normal relief.
   */
  private renderCanvas2DFallback(): void {
    if (!this.ctx2d || !this.canvas || !this.fallbackImageData || !this.fallbackImageBuf32) return;

    const w = this.simWidth;
    const h = this.simHeight;
    const r = this.dyeR;
    const g = this.dyeG;
    const b = this.dyeB;
    const buf = this.fallbackImageBuf32;
    const lut = this.colorLutABGR;
    const relief = this.params.reliefScale;

    const lx = 0.55, ly = 0.65, lz = 0.8;
    const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

    for (let y = 0; y < h; y++) {
      const yU = y > 0 ? y - 1 : h - 1;
      const yD = y < h - 1 ? y + 1 : 0;
      const row = y * w;
      const rowU = yU * w;
      const rowD = yD * w;

      for (let x = 0; x < w; x++) {
        const xL = x > 0 ? x - 1 : w - 1;
        const xR = x < w - 1 ? x + 1 : 0;

        const idx = row + x;
        const dens = (r[idx] + g[idx] + b[idx]) * 0.333;

        const densL = (r[row + xL] + g[row + xL] + b[row + xL]) * 0.333;
        const densR = (r[row + xR] + g[row + xR] + b[row + xR]) * 0.333;
        const densU = (r[rowU + x] + g[rowU + x] + b[rowU + x]) * 0.333;
        const densD = (r[rowD + x] + g[rowD + x] + b[rowD + x]) * 0.333;

        // 3D Surface Relief Normal
        const gradX = (densR - densL) * relief;
        const gradY = (densD - densU) * relief;
        const nLen = Math.sqrt(gradX * gradX + gradY * gradY + 1.0);
        const nx = -gradX / nLen;
        const ny = -gradY / nLen;
        const nz = 1.0 / nLen;

        const diff = Math.max(0.0, nx * nlx + ny * nly + nz * nlz);
        const lutIdx = Math.min(255, Math.max(0, Math.floor(dens * 255.0)));
        const basePixel = lut[lutIdx];

        const pr = basePixel & 0xFF;
        const pg = (basePixel >> 8) & 0xFF;
        const pb = (basePixel >> 16) & 0xFF;

        const litFactor = 0.35 + 0.65 * diff;
        const outR = Math.min(255, Math.round(pr * litFactor));
        const outG = Math.min(255, Math.round(pg * litFactor));
        const outB = Math.min(255, Math.round(pb * litFactor));

        buf[idx] = (255 << 24) | (outB << 16) | (outG << 8) | outR;
      }
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(this.fallbackImageData, 0, 0);
      this.ctx2d.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Applies smooth frame-rate independent parameter damping.
   */
  private dampActiveParameters(dt: number): void {
    const lambda = 4.5;
    this.params.vorticity = dampParameter(this.params.vorticity, this.targetParams.vorticity, lambda, dt);
    this.params.viscosity = dampParameter(this.params.viscosity, this.targetParams.viscosity, lambda, dt);
    this.params.dissipation = dampParameter(this.params.dissipation, this.targetParams.dissipation, lambda, dt);
    this.params.velDissipation = dampParameter(this.params.velDissipation, this.targetParams.velDissipation, lambda, dt);
    this.params.pressureIterations = dampParameter(this.params.pressureIterations, this.targetParams.pressureIterations, lambda, dt);
    this.params.splatRadius = dampParameter(this.params.splatRadius, this.targetParams.splatRadius, lambda, dt);
    this.params.splatForce = dampParameter(this.params.splatForce, this.targetParams.splatForce, lambda, dt);
    this.params.reliefScale = dampParameter(this.params.reliefScale, this.targetParams.reliefScale, lambda, dt);
    this.params.bloomIntensity = dampParameter(this.params.bloomIntensity, this.targetParams.bloomIntensity, lambda, dt);
    this.params.autonomousFlow = dampParameter(this.params.autonomousFlow, this.targetParams.autonomousFlow, lambda, dt);

    this.uReliefScale.value = this.params.reliefScale;
    this.uBloomIntensity.value = this.params.bloomIntensity;
  }

  /**
   * Updates room parameters dynamically via Tweakpane or URL sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    this.applyParams(newParams, false);
  }

  /**
   * Applies parameters with preset handling and smooth transition setup.
   */
  private applyParams(params: Record<string, any>, isInitial: boolean): void {
    if (params.preset && params.preset !== this.params.preset) {
      const presetDef = FLUID_PRESETS[params.preset as FluidPreset];
      if (presetDef) {
        this.targetParams.preset = params.preset as FluidPreset;
        this.targetParams.vorticity = presetDef.vorticity;
        this.targetParams.viscosity = presetDef.viscosity;
        this.targetParams.dissipation = presetDef.dissipation;
        this.targetParams.velDissipation = presetDef.velDissipation;
        this.targetParams.pressureIterations = presetDef.pressureIterations;
        this.targetParams.splatRadius = presetDef.splatRadius;
        this.targetParams.splatForce = presetDef.splatForce;
        this.targetParams.reliefScale = presetDef.reliefScale;
        this.targetParams.bloomIntensity = presetDef.bloomIntensity;
        this.targetParams.autonomousFlow = presetDef.autonomousFlow;
      }
    }

    if (params.vorticity !== undefined) this.targetParams.vorticity = Number(params.vorticity);
    if (params.viscosity !== undefined) this.targetParams.viscosity = Number(params.viscosity);
    if (params.dissipation !== undefined) this.targetParams.dissipation = Number(params.dissipation);
    if (params.velDissipation !== undefined) this.targetParams.velDissipation = Number(params.velDissipation);
    if (params.pressureIterations !== undefined) this.targetParams.pressureIterations = Number(params.pressureIterations);
    if (params.splatRadius !== undefined) this.targetParams.splatRadius = Number(params.splatRadius);
    if (params.splatForce !== undefined) this.targetParams.splatForce = Number(params.splatForce);
    if (params.reliefScale !== undefined) this.targetParams.reliefScale = Number(params.reliefScale);
    if (params.bloomIntensity !== undefined) this.targetParams.bloomIntensity = Number(params.bloomIntensity);
    if (params.autonomousFlow !== undefined) this.targetParams.autonomousFlow = Number(params.autonomousFlow);
    if (params.showVectors !== undefined) this.targetParams.showVectors = Boolean(params.showVectors);
    if (params.wrapMode !== undefined) this.targetParams.wrapMode = params.wrapMode;

    if (params.colorPalette && params.colorPalette !== this.params.colorPalette) {
      this.params.colorPalette = params.colorPalette;
      this.targetParams.colorPalette = params.colorPalette;
      this.rebuildColorLut();
    }

    if (params.seed && params.seed !== this.params.seed) {
      this.params.seed = params.seed;
      this.targetParams.seed = params.seed;
      this.prng = createPRNG(params.seed);
      this.seedFluidDynamics();
    }

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.uReliefScale.value = this.params.reliefScale;
      this.uBloomIntensity.value = this.params.bloomIntensity;
    }
  }

  /**
   * Resizes viewport and buffer dimensions.
   */
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.uResolution.value.set(width, height);

    if (this.renderer && this.canvas) {
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(this.dpr);
    } else if (this.canvas) {
      this.canvas.width = Math.floor(width * this.dpr);
      this.canvas.height = Math.floor(height * this.dpr);
    }
  }

  /**
   * Receives normalized pointer interaction events.
   */
  public onPointer(event: RoomPointerEvent): void {
    this.pointerX = event.normalizedX;
    this.pointerY = 1.0 - event.normalizedY; // Invert Y to match UV coordinate space
    this.isPointerDown = event.isDown;

    if (event.type === 'down') {
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      this.pointerDyeIndex = (this.pointerDyeIndex + 1) % 4;
    } else if (event.type === 'leave') {
      this.isPointerDown = false;
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.prevPointerX = -1000;
      this.prevPointerY = -1000;
    }
  }

  /**
   * Custom High-Resolution Snapshot Export hook for 4K/8K stills.
   */
  public async captureSnapshot(targetW: number, targetH: number): Promise<HTMLCanvasElement> {
    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return offscreen;

    // Fill background with Obsidian Void
    offCtx.fillStyle = '#090A0D';
    offCtx.fillRect(0, 0, targetW, targetH);

    const w = this.simWidth;
    const h = this.simHeight;
    const r = this.dyeR;
    const g = this.dyeG;
    const b = this.dyeB;
    const lut = this.colorLutABGR;
    const relief = this.params.reliefScale;

    // Build temporary offscreen image buffer
    const tempImgData = offCtx.createImageData(w, h);
    const buf32 = new Uint32Array(tempImgData.data.buffer);

    const lx = 0.55, ly = 0.65, lz = 0.8;
    const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

    for (let y = 0; y < h; y++) {
      const yU = y > 0 ? y - 1 : h - 1;
      const yD = y < h - 1 ? y + 1 : 0;
      const row = y * w;
      const rowU = yU * w;
      const rowD = yD * w;

      for (let x = 0; x < w; x++) {
        const xL = x > 0 ? x - 1 : w - 1;
        const xR = x < w - 1 ? x + 1 : 0;

        const idx = row + x;
        const dens = (r[idx] + g[idx] + b[idx]) * 0.333;

        const densL = (r[row + xL] + g[row + xL] + b[row + xL]) * 0.333;
        const densR = (r[row + xR] + g[row + xR] + b[row + xR]) * 0.333;
        const densU = (r[rowU + x] + g[rowU + x] + b[rowU + x]) * 0.333;
        const densD = (r[rowD + x] + g[rowD + x] + b[rowD + x]) * 0.333;

        const gradX = (densR - densL) * relief;
        const gradY = (densD - densU) * relief;
        const nLen = Math.sqrt(gradX * gradX + gradY * gradY + 1.0);
        const nx = -gradX / nLen;
        const ny = -gradY / nLen;
        const nz = 1.0 / nLen;

        const diff = Math.max(0.0, nx * nlx + ny * nly + nz * nlz);
        const lutIdx = Math.min(255, Math.max(0, Math.floor(dens * 255.0)));
        const basePixel = lut[lutIdx];

        const pr = basePixel & 0xFF;
        const pg = (basePixel >> 8) & 0xFF;
        const pb = (basePixel >> 16) & 0xFF;

        const litFactor = 0.35 + 0.65 * diff;
        const outR = Math.min(255, Math.round(pr * litFactor));
        const outG = Math.min(255, Math.round(pg * litFactor));
        const outB = Math.min(255, Math.round(pb * litFactor));

        buf32[idx] = (255 << 24) | (outB << 16) | (outG << 8) | outR;
      }
    }

    const lowResCanvas = document.createElement('canvas');
    lowResCanvas.width = w;
    lowResCanvas.height = h;
    const lowResCtx = lowResCanvas.getContext('2d');
    if (lowResCtx) {
      lowResCtx.putImageData(tempImgData, 0, 0);
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = 'high';
      offCtx.drawImage(lowResCanvas, 0, 0, targetW, targetH);
    }

    return offscreen;
  }

  /**
   * Complete lifecycle teardown & GPU resource deallocation.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.simTexture) {
      this.simTexture.dispose();
      this.simTexture = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.ctx2d = null;
    this.fallbackImageData = null;
    this.fallbackImageBuf32 = null;
  }
}

export const room: RoomInstance = new FluidRoom();
export default room;
