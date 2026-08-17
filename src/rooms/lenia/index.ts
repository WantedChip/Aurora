/**
 * Room 07: Lenia (Continuous Neural Cellular Automata)
 * Curatorial Category: Artificial Life
 * Math Model: Continuous Neural Cellular Automata (Bert Wang-Chak Chan)
 * Compute Engine: Three.js WebGPURenderer / TSL False-Color Shading with High-Performance TypedArray Simulation
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Continuous space, continuous time (dt), and continuous state A(x,y) ∈ [0, 1]
 * - Concentric ring convolution kernel generation:
 *     K(r) = exp( - (r - μ_k)² / (2 σ_k²) ), with r = ||(dx,dy)|| / R, normalized to Σ K = 1
 * - Toroidal 2D convolution for neighborhood potential field U = K * A
 * - Unimodal growth mapping function:
 *     G(U) = 2 exp( - (U - m)² / (2 s²) ) - 1
 * - Continuous state integration:
 *     A^(t+Δt) = clamp(A^t + Δt · G(U), 0, 1)
 * - 5 Canonical Organism Presets:
 *     - Orbium (Solitary Glider / Soliton)
 *     - Gyrobium (Chiral Spinning Rotor)
 *     - Tessellatium (Crystalline Lattice Matrix)
 *     - Scutium (Armored Shield Amoeba)
 *     - Pentapetalum (Pulsating 5-Fold Blossom)
 * - 5 Curatorial Spectral Palettes (Bioluminescent Cyan, Obsidian Emerald, Solar Plasma, Spectral Amethyst, Monochrome Lithic)
 * - Dual execution architecture: Three.js WebGPURenderer + TSL false-color shader & 32-bit ABGR LUT Canvas2D fallback
 * - Interactive pointer seeding: continuous density painting & click spawning of localized soliton kernels
 * - Frame-rate independent exponential parameter & preset damping
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

export type LeniaPreset =
  | 'orbium'
  | 'gyrobium'
  | 'tessellatium'
  | 'scutium'
  | 'pentapetalum';

export interface LeniaParams {
  seed: string;
  preset: LeniaPreset;
  mu: number;            // Growth center (m)
  sigma: number;         // Growth bandwidth (s)
  dt: number;            // Continuous time step (Δt)
  kernelRadius: number;  // Kernel radius (R)
  simSpeed: number;      // Substeps per frame
  brushRadius: number;   // Interactive seeding radius
  brushIntensity: number;// Interactive seeding density
  reliefScale: number;   // 3D structural gradient normal relief scale
  colorPalette: 'bioluminescent-cyan' | 'obsidian-emerald' | 'solar-plasma' | 'spectral-amethyst' | 'monochrome-lithic';
}

export const DEFAULT_LENIA_PARAMS: LeniaParams = {
  seed: '#00E5FF',
  preset: 'orbium',
  mu: 0.156,
  sigma: 0.0224,
  dt: 0.10,
  kernelRadius: 13,
  simSpeed: 1,
  brushRadius: 16,
  brushIntensity: 0.85,
  reliefScale: 2.0,
  colorPalette: 'bioluminescent-cyan',
};

// Curated Lenia Organism Preset Definitions
export interface LeniaPresetDefinition {
  name: string;
  mu: number;
  sigma: number;
  dt: number;
  kernelRadius: number;
  kernelMu: number;
  kernelSigma: number;
  ringWeights: number[];
  description: string;
}

export const LENIA_PRESETS: Record<LeniaPreset, LeniaPresetDefinition> = {
  orbium: {
    name: 'Orbium (Solitary Glider)',
    mu: 0.156,
    sigma: 0.0224,
    dt: 0.10,
    kernelRadius: 13,
    kernelMu: 0.50,
    kernelSigma: 0.15,
    ringWeights: [1.0],
    description: 'Autonomous swimming soliton glider maintaining stable velocity and organic internal pulsation.',
  },
  gyrobium: {
    name: 'Gyrobium (Spinning Rotor)',
    mu: 0.175,
    sigma: 0.025,
    dt: 0.10,
    kernelRadius: 15,
    kernelMu: 0.50,
    kernelSigma: 0.13,
    ringWeights: [1.0, 0.67, 0.33],
    description: 'Chiral rotating organism that spins continuously and radiates concentric harmonic wake pulses.',
  },
  tessellatium: {
    name: 'Tessellatium (Crystalline Lattice)',
    mu: 0.140,
    sigma: 0.035,
    dt: 0.12,
    kernelRadius: 14,
    kernelMu: 0.45,
    kernelSigma: 0.18,
    ringWeights: [1.0],
    description: 'Self-replicating bio-matrix that expands into vast periodic crystalline and labyrinthine lattices.',
  },
  scutium: {
    name: 'Scutium (Armored Shield)',
    mu: 0.180,
    sigma: 0.028,
    dt: 0.08,
    kernelRadius: 16,
    kernelMu: 0.55,
    kernelSigma: 0.14,
    ringWeights: [1.0, 0.5],
    description: 'Dense armored amoeboid organism with an undulating protective outer membrane and active organelles.',
  },
  pentapetalum: {
    name: 'Pentapetalum (Pulsating Blossom)',
    mu: 0.135,
    sigma: 0.019,
    dt: 0.09,
    kernelRadius: 17,
    kernelMu: 0.50,
    kernelSigma: 0.12,
    ringWeights: [1.0, 0.8],
    description: 'Harmonic 5-petal pulsating flower organism that breathes rhythmically in a stable limit cycle.',
  },
};

// Curatorial Spectral Palettes for Lenia False-Color Shading
export interface LeniaPalette {
  name: string;
  voidColor: [number, number, number];    // Obsidian void #090A0D (0.035, 0.039, 0.051)
  baseColor: [number, number, number];    // Subterranean organelle vein root tone
  primaryColor: [number, number, number]; // Main organism cellular body
  accentColor: [number, number, number];  // Active membrane reaction boundary
  crestColor: [number, number, number];   // Starlight nucleus apex crest
  rgbVoid: [number, number, number];
  rgbBase: [number, number, number];
  rgbPrimary: [number, number, number];
  rgbAccent: [number, number, number];
  rgbCrest: [number, number, number];
}

export const LENIA_PALETTES: Record<string, LeniaPalette> = {
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.03, 0.10, 0.18],
    primaryColor: [0.0, 0.90, 1.0],
    accentColor: [0.0, 1.0, 0.62],
    crestColor: [0.90, 0.99, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [8, 26, 46],
    rgbPrimary: [0, 229, 255],
    rgbAccent: [0, 255, 157],
    rgbCrest: [230, 252, 255],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.01, 0.12, 0.07],
    primaryColor: [0.0, 1.0, 0.53],
    accentColor: [0.46, 1.0, 0.01],
    crestColor: [0.92, 1.0, 0.96],
    rgbVoid: [9, 10, 13],
    rgbBase: [3, 31, 19],
    rgbPrimary: [0, 255, 136],
    rgbAccent: [118, 255, 3],
    rgbCrest: [235, 255, 244],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.16, 0.03, 0.03],
    primaryColor: [1.0, 0.57, 0.0],
    accentColor: [1.0, 0.84, 0.0],
    crestColor: [1.0, 0.99, 0.90],
    rgbVoid: [9, 10, 13],
    rgbBase: [40, 7, 7],
    rgbPrimary: [255, 145, 0],
    rgbAccent: [255, 215, 0],
    rgbCrest: [255, 253, 230],
  },
  'spectral-amethyst': {
    name: 'Spectral Amethyst',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.08, 0.02, 0.14],
    primaryColor: [0.62, 0.0, 1.0],
    accentColor: [1.0, 0.0, 0.5],
    crestColor: [0.99, 0.90, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [21, 4, 36],
    rgbPrimary: [157, 0, 255],
    rgbAccent: [255, 0, 127],
    rgbCrest: [252, 230, 255],
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.11, 0.12, 0.16],
    primaryColor: [0.48, 0.52, 0.60],
    accentColor: [0.80, 0.83, 0.88],
    crestColor: [1.0, 1.0, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [27, 30, 40],
    rgbPrimary: [122, 133, 153],
    rgbAccent: [205, 212, 224],
    rgbCrest: [255, 255, 255],
  },
};

export class LeniaRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;

  private simTexture: THREE.DataTexture | null = null;
  private backendMode: 'webgpu' | 'canvas2d' = 'webgpu';

  private prng: PRNG = createPRNG('#00E5FF');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;

  // Grid Simulation Buffers
  private simWidth = 256;
  private simHeight = 256;
  private stateA: Float32Array = new Float32Array(0);
  private stateB: Float32Array = new Float32Array(0);
  private potentialField: Float32Array = new Float32Array(0);
  private rgbaBuffer: Float32Array = new Float32Array(0);

  // Precomputed Concentric Ring Kernel Data
  private maxKernelRadius = 24;
  private kernelOffsetsX: Int32Array = new Int32Array(0);
  private kernelOffsetsY: Int32Array = new Int32Array(0);
  private kernelWeights: Float32Array = new Float32Array(0);
  private kernelCount = 0;

  // Precomputed coordinate wrap lookups
  private wrapXLookup: Int32Array = new Int32Array(0);
  private wrapYLookup: Int32Array = new Int32Array(0);

  // CPU 2D Image Buffer & Precomputed 32-bit ABGR Color LUT
  private fallbackImageData: ImageData | null = null;
  private fallbackImageBuf32: Uint32Array | null = null;
  private colorLutABGR: Uint32Array = new Uint32Array(256);

  // Active & Target Parameters
  private params: LeniaParams = { ...DEFAULT_LENIA_PARAMS };
  private targetParams: LeniaParams = { ...DEFAULT_LENIA_PARAMS };

  // TSL Uniform Nodes
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uTexelSize = uniform(new THREE.Vector2(1 / 256, 1 / 256));
  private uReliefScale = uniform(2.0);
  private uColorVoid = uniform(new THREE.Color(0.035, 0.039, 0.051));
  private uColorBase = uniform(new THREE.Color(0.03, 0.10, 0.18));
  private uColorPrimary = uniform(new THREE.Color(0.0, 0.90, 1.0));
  private uColorAccent = uniform(new THREE.Color(0.0, 1.0, 0.62));
  private uColorCrest = uniform(new THREE.Color(0.90, 0.99, 1.0));

  // Pointer Interaction
  private pointerX = -1000;
  private pointerY = -1000;
  private prevPointerX = -1000;
  private prevPointerY = -1000;
  private isPointerDown = false;
  private isMounted = false;

  /**
   * Mounts the Lenia exhibit to the canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = Math.min(ctx.dpr || 1, 2.0);
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_LENIA_PARAMS.seed);

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Detect GPU Capabilities
    const gpuCaps = await detectGPUCapabilities();
    const canUseGPU = gpuCaps.hasWebGPU || gpuCaps.hasWebGL2;

    // Determine simulation grid resolution based on aspect ratio (maintaining ~256 base)
    const aspect = this.width / this.height;
    if (aspect >= 1.0) {
      this.simWidth = 256;
      this.simHeight = Math.max(160, Math.round(256 / aspect));
    } else {
      this.simHeight = 256;
      this.simWidth = Math.max(160, Math.round(256 * aspect));
    }

    this.initSimulationBuffers();
    this.rebuildKernel();
    this.seedOrganismField();
    this.rebuildColorLut();

    if (canUseGPU) {
      try {
        await this.initGPURenderer();
        this.backendMode = 'webgpu';
      } catch (err) {
        console.warn('WebGPU/WebGL2 initialization fallback in Room 07 (Lenia):', err);
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
   * Allocates contiguous Float32Array simulation buffers and lookup tables.
   */
  private initSimulationBuffers(): void {
    const size = this.simWidth * this.simHeight;
    this.stateA = new Float32Array(size);
    this.stateB = new Float32Array(size);
    this.potentialField = new Float32Array(size);
    this.rgbaBuffer = new Float32Array(size * 4);

    const maxK = (2 * this.maxKernelRadius + 1) * (2 * this.maxKernelRadius + 1);
    this.kernelOffsetsX = new Int32Array(maxK);
    this.kernelOffsetsY = new Int32Array(maxK);
    this.kernelWeights = new Float32Array(maxK);

    // Build wrap lookup arrays
    const w = this.simWidth;
    const h = this.simHeight;
    const pad = this.maxKernelRadius * 2;
    this.wrapXLookup = new Int32Array(w + pad * 2);
    this.wrapYLookup = new Int32Array(h + pad * 2);

    for (let i = 0; i < this.wrapXLookup.length; i++) {
      const orig = i - pad;
      this.wrapXLookup[i] = ((orig % w) + w) % w;
    }
    for (let i = 0; i < this.wrapYLookup.length; i++) {
      const orig = i - pad;
      this.wrapYLookup[i] = ((orig % h) + h) % h;
    }

    this.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
  }

  /**
   * Generates concentric ring convolution kernel K(r).
   * K(r) = exp( - (r - μ_k)² / (2 σ_k²) ), with r = ||(dx,dy)|| / R, normalized so Σ K = 1.
   */
  private rebuildKernel(): void {
    const R = Math.round(this.params.kernelRadius);
    const preset = LENIA_PRESETS[this.params.preset] || LENIA_PRESETS.orbium;
    const ringWeights = preset.ringWeights || [1.0];
    const numRings = ringWeights.length;

    let count = 0;
    let sumWeights = 0.0;

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        const r = d / R;

        if (r <= 1.0) {
          let ringVal = 0.0;
          for (let i = 0; i < numRings; i++) {
            const mu_k = numRings === 1 ? preset.kernelMu : (0.2 + (i / numRings) * 0.6);
            const sigma_k = preset.kernelSigma;
            const diff = r - mu_k;
            const term = Math.exp(-(diff * diff) / (2.0 * sigma_k * sigma_k));
            ringVal += ringWeights[i] * term;
          }

          if (ringVal > 1e-6) {
            this.kernelOffsetsX[count] = dx;
            this.kernelOffsetsY[count] = dy;
            this.kernelWeights[count] = ringVal;
            sumWeights += ringVal;
            count++;
          }
        }
      }
    }

    this.kernelCount = count;

    // Normalize so sum of kernel weights = 1.0
    if (sumWeights > 0) {
      const invSum = 1.0 / sumWeights;
      for (let i = 0; i < count; i++) {
        this.kernelWeights[i] *= invSum;
      }
    }
  }

  /**
   * Seeds the continuous state field with deterministic organism solitons and clusters.
   */
  private seedOrganismField(): void {
    const size = this.simWidth * this.simHeight;
    const w = this.simWidth;
    const h = this.simHeight;

    // Clear state buffers
    for (let i = 0; i < size; i++) {
      this.stateA[i] = 0.0;
      this.stateB[i] = 0.0;
      this.potentialField[i] = 0.0;
    }

    const preset = this.params.preset;
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.5);

    if (preset === 'orbium') {
      // Seed a primary swimming Orbium soliton glider with asymmetric tail
      this.spawnOrbiumSoliton(cx, cy, 1.0);

      // Seed 2 additional smaller solitary gliders in off-center quadrants
      const q1x = Math.floor(w * 0.25);
      const q1y = Math.floor(h * 0.35);
      const q2x = Math.floor(w * 0.75);
      const q2y = Math.floor(h * 0.65);
      this.spawnOrbiumSoliton(q1x, q1y, 0.9);
      this.spawnOrbiumSoliton(q2x, q2y, 0.95);
    } else if (preset === 'gyrobium') {
      // Seed a rotating 3-arm pinwheel / chiral rotor
      this.spawnGyrobiumRotor(cx, cy);
    } else if (preset === 'tessellatium') {
      // Seed a crystalline hexagonal lattice pattern
      this.spawnTessellatiumLattice();
    } else if (preset === 'scutium') {
      // Seed an armored shield amoeba with core and outer membrane
      this.spawnScutiumOrganism(cx, cy);
    } else if (preset === 'pentapetalum') {
      // Seed a 5-petal harmonic pulsating blossom
      this.spawnPentapetalumBlossom(cx, cy);
    }

    // Add gentle stochastic bio-dust to induce continuous natural perturbation
    const dustCount = this.prng.nextInt(4, 10);
    for (let d = 0; d < dustCount; d++) {
      const rx = this.prng.nextInt(0, w - 1);
      const ry = this.prng.nextInt(0, h - 1);
      const rad = this.prng.nextInt(3, 7);
      this.injectGaussianDensity(rx, ry, rad, 0.3);
    }
  }

  /**
   * Spawns an Orbium solitary glider with asymmetric crest.
   */
  private spawnOrbiumSoliton(cx: number, cy: number, scale = 1.0): void {
    const R = Math.round(this.params.kernelRadius * scale);
    const w = this.simWidth;
    const h = this.simHeight;

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const r = Math.sqrt(dx * dx + dy * dy) / R;
        if (r <= 1.0) {
          // Asymmetric bump creating directional thrust
          const angle = Math.atan2(dy, dx);
          const asym = 1.0 + 0.35 * Math.cos(angle);
          const density = Math.exp(-((r - 0.35) * (r - 0.35)) / 0.08) * asym;
          const px = ((cx + dx) % w + w) % w;
          const py = ((cy + dy) % h + h) % h;
          const idx = py * w + px;
          this.stateA[idx] = Math.min(1.0, Math.max(this.stateA[idx], density * 0.95));
        }
      }
    }
  }

  /**
   * Spawns a chiral Gyrobium rotating pinwheel.
   */
  private spawnGyrobiumRotor(cx: number, cy: number): void {
    const R = Math.round(this.params.kernelRadius * 1.3);
    const w = this.simWidth;
    const h = this.simHeight;

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = dist / R;
        if (r <= 1.0 && dist > 0.1) {
          const theta = Math.atan2(dy, dx);
          // 3-arm spiral perturbation
          const arm = Math.sin(3.0 * theta + r * 6.0);
          const radial = Math.exp(-((r - 0.45) * (r - 0.45)) / 0.06);
          const val = Math.max(0.0, radial * (0.6 + 0.4 * arm));
          const px = ((cx + dx) % w + w) % w;
          const py = ((cy + dy) % h + h) % h;
          const idx = py * w + px;
          this.stateA[idx] = Math.min(1.0, val);
        }
      }
    }
  }

  /**
   * Spawns periodic lattice seeds for Tessellatium.
   */
  private spawnTessellatiumLattice(): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const spacing = Math.round(this.params.kernelRadius * 2.2);

    for (let y = spacing; y < h - spacing; y += spacing) {
      const offsetX = ((Math.floor(y / spacing) % 2) * spacing) / 2;
      for (let x = spacing; x < w - spacing; x += spacing) {
        const sx = Math.round(x + offsetX);
        if (sx < w) {
          this.injectGaussianDensity(sx, y, Math.round(this.params.kernelRadius * 0.7), 0.85);
        }
      }
    }
  }

  /**
   * Spawns an armored Scutium shield organism.
   */
  private spawnScutiumOrganism(cx: number, cy: number): void {
    const R = Math.round(this.params.kernelRadius * 1.4);
    const w = this.simWidth;
    const h = this.simHeight;

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const r = Math.sqrt(dx * dx + dy * dy) / R;
        if (r <= 1.0) {
          const core = Math.exp(-(r * r) / 0.12);
          const ring = Math.exp(-((r - 0.65) * (r - 0.65)) / 0.04) * 0.75;
          const val = Math.min(1.0, core + ring);
          const px = ((cx + dx) % w + w) % w;
          const py = ((cy + dy) % h + h) % h;
          const idx = py * w + px;
          this.stateA[idx] = val;
        }
      }
    }
  }

  /**
   * Spawns a 5-petal pulsating Pentapetalum blossom.
   */
  private spawnPentapetalumBlossom(cx: number, cy: number): void {
    const R = Math.round(this.params.kernelRadius * 1.5);
    const w = this.simWidth;
    const h = this.simHeight;

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = dist / R;
        if (r <= 1.0) {
          const theta = Math.atan2(dy, dx);
          const petal = 0.5 + 0.5 * Math.cos(5.0 * theta);
          const profile = Math.exp(-((r - 0.4) * (r - 0.4)) / 0.05);
          const val = profile * (0.4 + 0.6 * petal);
          const px = ((cx + dx) % w + w) % w;
          const py = ((cy + dy) % h + h) % h;
          const idx = py * w + px;
          this.stateA[idx] = Math.min(1.0, val);
        }
      }
    }
  }

  /**
   * Injects a continuous Gaussian density bump into stateA.
   */
  private injectGaussianDensity(cx: number, cy: number, radius: number, intensity: number): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const rSq = radius * radius;
    const twoSigmaSq = 2.0 * (radius * 0.5) * (radius * 0.5);

    const minX = -radius;
    const maxX = radius;
    const minY = -radius;
    const maxY = radius;

    for (let dy = minY; dy <= maxY; dy++) {
      for (let dx = minX; dx <= maxX; dx++) {
        const dSq = dx * dx + dy * dy;
        if (dSq <= rSq) {
          const weight = Math.exp(-dSq / twoSigmaSq) * intensity;
          const px = ((cx + dx) % w + w) % w;
          const py = ((cy + dy) % h + h) % h;
          const idx = py * w + px;
          this.stateA[idx] = Math.min(1.0, Math.max(this.stateA[idx], this.stateA[idx] + weight));
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

    // Create DataTexture for simulation field transfer
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
   * Constructs the TSL Display Material with 3D Normal-Mapped Surface Relief and Organism Density Glow.
   */
  private buildTSLDisplayMaterial(): THREE.MeshBasicNodeMaterial {
    if (!this.simTexture) {
      throw new Error('Simulation DataTexture must be initialized before building TSL material.');
    }

    const simTexNode = texture(this.simTexture);

    const displayColorNode = tslFn(() => {
      const uvCoord = uv();

      // Sample central organism density A and potential U
      const centerSample = simTexNode.sample(uvCoord);
      const densityA = centerSample.r;
      const potentialU = centerSample.g;

      // Sample 4 orthogonal neighbors for spatial gradient normal relief
      const dX = this.uTexelSize.x;
      const dY = this.uTexelSize.y;

      const sL = simTexNode.sample(uvCoord.add(vec2(dX.negate(), float(0.0)))).r;
      const sR = simTexNode.sample(uvCoord.add(vec2(dX, float(0.0)))).r;
      const sU = simTexNode.sample(uvCoord.add(vec2(float(0.0), dY.negate()))).r;
      const sD = simTexNode.sample(uvCoord.add(vec2(float(0.0), dY))).r;

      // Compute surface gradient normal
      const gradX = sR.sub(sL).mul(this.uReliefScale);
      const gradY = sD.sub(sU).mul(this.uReliefScale);
      const normLen = clamp(gradX.mul(gradX).add(gradY.mul(gradY)).add(float(1.0)), float(0.001), float(100.0)).sqrt();

      const nX = gradX.negate().div(normLen);
      const nY = gradY.negate().div(normLen);
      const nZ = float(1.0).div(normLen);

      // Blinn-Phong directional starlight
      const lightDir = vec3(0.5, 0.6, 0.8).normalize();
      const normalVec = vec3(nX, nY, nZ);
      const diffuseLight = clamp(normalVec.dot(lightDir), float(0.0), float(1.0));

      // View specular highlight
      const viewDir = vec3(0.0, 0.0, 1.0);
      const halfVector = lightDir.add(viewDir).normalize();
      const specAngle = clamp(normalVec.dot(halfVector), float(0.0), float(1.0));
      const specularLight = specAngle.mul(specAngle).mul(specAngle).mul(specAngle);

      // Multi-layer false-color palette synthesis
      // 1. Void Obsidian #090A0D (A ~ 0.0) -> Subterranean Vein Root (A ~ 0.2)
      const t1 = clamp(densityA.mul(float(5.0)), float(0.0), float(1.0));
      const col1 = mix(this.uColorVoid, this.uColorBase, t1);

      // 2. Subterranean Vein Root -> Primary Cellular Body (A ~ 0.5)
      const t2 = clamp(densityA.sub(float(0.2)).mul(float(3.33)), float(0.0), float(1.0));
      const col2 = mix(col1, this.uColorPrimary, t2);

      // 3. Primary Body -> Active Membrane Reaction Boundary (A ~ 0.75)
      const t3 = clamp(densityA.sub(float(0.5)).mul(float(4.0)), float(0.0), float(1.0));
      const col3 = mix(col2, this.uColorAccent, t3);

      // 4. Active Membrane -> Starlight Apex Nucleus (A ~ 1.0)
      const t4 = clamp(densityA.sub(float(0.75)).mul(float(4.0)), float(0.0), float(1.0));
      const baseBodyColor = mix(col3, this.uColorCrest, t4);

      // Apply diffuse illumination and specular starlight crest
      const illuminatedColor = baseBodyColor.mul(float(0.4).add(diffuseLight.mul(float(0.6))));
      const finalGlow = illuminatedColor.add(this.uColorCrest.mul(specularLight.mul(float(0.45)).mul(densityA)));

      // Add subtle luminescent halo around active potential fields
      const potentialHalo = this.uColorPrimary.mul(potentialU.mul(float(0.12)));
      const finalOutput = finalGlow.add(potentialHalo);

      return vec4(finalOutput, float(1.0));
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = displayColorNode();
    return mat;
  }

  /**
   * Initializes Canvas2D fallback pipeline.
   */
  private initCanvas2DFallback(): void {
    if (!this.canvas) return;

    this.ctx2d = this.canvas.getContext('2d', { alpha: false });
    this.fallbackImageData = new ImageData(this.simWidth, this.simHeight);
    this.fallbackImageBuf32 = new Uint32Array(this.fallbackImageData.data.buffer);
  }

  /**
   * Rebuilds 256-entry 32-bit ABGR color lookup table for fast CPU blitting.
   */
  private rebuildColorLut(): void {
    const palette = LENIA_PALETTES[this.params.colorPalette] || LENIA_PALETTES['bioluminescent-cyan'];
    const pVoid = palette.rgbVoid;
    const pBase = palette.rgbBase;
    const pPrimary = palette.rgbPrimary;
    const pAccent = palette.rgbAccent;
    const pCrest = palette.rgbCrest;

    // Update TSL uniforms
    const vCol = palette.voidColor;
    const bCol = palette.baseColor;
    const prCol = palette.primaryColor;
    const aCol = palette.accentColor;
    const cCol = palette.crestColor;

    this.uColorVoid.value.setRGB(vCol[0], vCol[1], vCol[2]);
    this.uColorBase.value.setRGB(bCol[0], bCol[1], bCol[2]);
    this.uColorPrimary.value.setRGB(prCol[0], prCol[1], prCol[2]);
    this.uColorAccent.value.setRGB(aCol[0], aCol[1], aCol[2]);
    this.uColorCrest.value.setRGB(cCol[0], cCol[1], cCol[2]);

    for (let i = 0; i < 256; i++) {
      const val = i / 255.0;
      let r = 0, g = 0, b = 0;

      if (val < 0.2) {
        const t = val / 0.2;
        r = pVoid[0] + (pBase[0] - pVoid[0]) * t;
        g = pVoid[1] + (pBase[1] - pVoid[1]) * t;
        b = pVoid[2] + (pBase[2] - pVoid[2]) * t;
      } else if (val < 0.5) {
        const t = (val - 0.2) / 0.3;
        r = pBase[0] + (pPrimary[0] - pBase[0]) * t;
        g = pBase[1] + (pPrimary[1] - pBase[1]) * t;
        b = pBase[2] + (pPrimary[2] - pBase[2]) * t;
      } else if (val < 0.75) {
        const t = (val - 0.5) / 0.25;
        r = pPrimary[0] + (pAccent[0] - pPrimary[0]) * t;
        g = pPrimary[1] + (pAccent[1] - pPrimary[1]) * t;
        b = pPrimary[2] + (pAccent[2] - pPrimary[2]) * t;
      } else {
        const t = (val - 0.75) / 0.25;
        r = pAccent[0] + (pCrest[0] - pAccent[0]) * t;
        g = pAccent[1] + (pCrest[1] - pAccent[1]) * t;
        b = pAccent[2] + (pCrest[2] - pAccent[2]) * t;
      }

      const ri = Math.min(255, Math.max(0, Math.round(r)));
      const gi = Math.min(255, Math.max(0, Math.round(g)));
      const bi = Math.min(255, Math.max(0, Math.round(b)));

      // Packed ABGR for Little-Endian Uint32Array Canvas ImageData
      this.colorLutABGR[i] = (255 << 24) | (bi << 16) | (gi << 8) | ri;
    }
  }

  /**
   * Main animation loop.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) * 0.001, 0.1);
    this.lastTime = currentTime;

    this.dampActiveParameters(dt);

    // Apply interactive pointer painting
    this.handlePointerPainting();

    // Execute simulation steps
    const substeps = Math.max(1, Math.min(4, Math.round(this.params.simSpeed)));
    for (let s = 0; s < substeps; s++) {
      this.stepSimulation();
    }

    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera && this.simTexture) {
      this.updateRGBABuffer();
      this.simTexture.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
    } else if (this.ctx2d) {
      this.renderCanvas2DFallback();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Interactive pointer drag painting & click seeding.
   */
  private handlePointerPainting(): void {
    if (this.pointerX < 0 || this.pointerY < 0) return;

    if (this.isPointerDown) {
      const w = this.simWidth;
      const h = this.simHeight;

      const px = Math.floor(this.pointerX * w);
      const py = Math.floor(this.pointerY * h);
      const brushR = Math.max(4, Math.round(this.params.brushRadius));
      const intensity = this.params.brushIntensity;

      if (this.prevPointerX < 0 || this.prevPointerY < 0) {
        this.prevPointerX = this.pointerX;
        this.prevPointerY = this.pointerY;
      }

      const prevX = Math.floor(this.prevPointerX * w);
      const prevY = Math.floor(this.prevPointerY * h);

      // Line interpolation between previous and current pointer coords
      const dist = Math.hypot(px - prevX, py - prevY);
      const steps = Math.max(1, Math.ceil(dist / (brushR * 0.5)));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ix = Math.round(prevX + (px - prevX) * t);
        const iy = Math.round(prevY + (py - prevY) * t);
        this.injectGaussianDensity(ix, iy, brushR, intensity * 0.4);
      }

      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
    } else {
      this.prevPointerX = -1000;
      this.prevPointerY = -1000;
    }
  }

  /**
   * Executes a single continuous Lenia simulation step.
   * 1. 2D toroidal convolution: U = K * A
   * 2. Growth mapping: G(U) = 2 exp(-(U-m)² / (2 s²)) - 1
   * 3. State integration: A^(t+Δt) = clamp(A^t + Δt · G(U), 0, 1)
   */
  private stepSimulation(): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const src = this.stateA;
    const dst = this.stateB;
    const pot = this.potentialField;

    const kCount = this.kernelCount;
    const kOffsetsX = this.kernelOffsetsX;
    const kOffsetsY = this.kernelOffsetsY;
    const kWeights = this.kernelWeights;

    const mu = this.params.mu;
    const sigma = this.params.sigma;
    const dt = this.params.dt;
    const twoSigmaSqInv = 1.0 / (2.0 * sigma * sigma);

    const pad = this.maxKernelRadius * 2;
    const wrapX = this.wrapXLookup;
    const wrapY = this.wrapYLookup;

    for (let y = 0; y < h; y++) {
      const yRow = y * w;
      const yPad = y + pad;

      for (let x = 0; x < w; x++) {
        const xPad = x + pad;
        let u = 0.0;

        for (let k = 0; k < kCount; k++) {
          const nx = wrapX[xPad + kOffsetsX[k]];
          const ny = wrapY[yPad + kOffsetsY[k]];
          u += src[ny * w + nx] * kWeights[k];
        }

        const idx = yRow + x;
        pot[idx] = u;

        // Unimodal Gaussian Growth mapping G(U)
        const diff = u - mu;
        const g = 2.0 * Math.exp(-diff * diff * twoSigmaSqInv) - 1.0;

        // Continuous State Integration with clamp to [0, 1]
        const currentA = src[idx];
        const nextA = currentA + dt * g;
        dst[idx] = nextA > 1.0 ? 1.0 : (nextA < 0.0 ? 0.0 : nextA);
      }
    }

    // Ping-pong buffer swap (dst becomes src for next step)
    this.stateA = dst;
    this.stateB = src;
  }

  /**
   * Packs simulation state A and potential field U into RGBA DataTexture buffer.
   */
  private updateRGBABuffer(): void {
    const size = this.simWidth * this.simHeight;
    const a = this.stateA;
    const u = this.potentialField;
    const buf = this.rgbaBuffer;

    for (let i = 0; i < size; i++) {
      const bIdx = i * 4;
      buf[bIdx] = a[i];       // R: Density state A
      buf[bIdx + 1] = u[i];   // G: Potential field U
      buf[bIdx + 2] = 0.0;   // B: Reserved
      buf[bIdx + 3] = 1.0;   // A: Opacity
    }
  }

  /**
   * Renders fallback frame to Canvas2D with 3D normal-mapped relief and ABGR LUT.
   */
  private renderCanvas2DFallback(): void {
    if (!this.ctx2d || !this.fallbackImageData || !this.fallbackImageBuf32 || !this.canvas) return;

    const w = this.simWidth;
    const h = this.simHeight;
    const a = this.stateA;
    const buf = this.fallbackImageBuf32;
    const lut = this.colorLutABGR;
    const relief = this.params.reliefScale;

    const lightX = 0.5, lightY = 0.6, lightZ = 0.8;
    const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
    const lx = lightX / lightLen, ly = lightY / lightLen, lz = lightZ / lightLen;

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
        const valA = a[idx];

        // 3D Surface Relief Normal
        const dX = (a[row + xR] - a[row + xL]) * relief;
        const dY = (a[rowD + x] - a[rowU + x]) * relief;
        const nLen = Math.sqrt(dX * dX + dY * dY + 1.0);
        const nx = -dX / nLen;
        const ny = -dY / nLen;
        const nz = 1.0 / nLen;

        const diff = Math.max(0.0, nx * lx + ny * ly + nz * lz);
        const lutIdx = Math.min(255, Math.max(0, Math.floor(valA * 255.0)));
        const basePixel = lut[lutIdx];

        // Extract RGBA channels
        const pr = basePixel & 0xFF;
        const pg = (basePixel >> 8) & 0xFF;
        const pb = (basePixel >> 16) & 0xFF;

        const litFactor = 0.4 + 0.6 * diff;
        const r = Math.min(255, Math.round(pr * litFactor));
        const g = Math.min(255, Math.round(pg * litFactor));
        const bl = Math.min(255, Math.round(pb * litFactor));

        buf[idx] = (255 << 24) | (bl << 16) | (g << 8) | r;
      }
    }

    // Scale and draw to canvas
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
   * Applies smooth parameter damping towards target values.
   */
  private dampActiveParameters(dt: number): void {
    const lambda = 4.5;
    this.params.mu = dampParameter(this.params.mu, this.targetParams.mu, lambda, dt);
    this.params.sigma = dampParameter(this.params.sigma, this.targetParams.sigma, lambda, dt);
    this.params.dt = dampParameter(this.params.dt, this.targetParams.dt, lambda, dt);
    this.params.kernelRadius = dampParameter(this.params.kernelRadius, this.targetParams.kernelRadius, lambda, dt);
    this.params.reliefScale = dampParameter(this.params.reliefScale, this.targetParams.reliefScale, lambda, dt);
    this.params.simSpeed = dampParameter(this.params.simSpeed, this.targetParams.simSpeed, lambda, dt);
    this.params.brushRadius = dampParameter(this.params.brushRadius, this.targetParams.brushRadius, lambda, dt);
    this.params.brushIntensity = dampParameter(this.params.brushIntensity, this.targetParams.brushIntensity, lambda, dt);

    this.uReliefScale.value = this.params.reliefScale;
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
      const presetDef = LENIA_PRESETS[params.preset as LeniaPreset];
      if (presetDef) {
        this.targetParams.preset = params.preset as LeniaPreset;
        this.targetParams.mu = presetDef.mu;
        this.targetParams.sigma = presetDef.sigma;
        this.targetParams.dt = presetDef.dt;
        this.targetParams.kernelRadius = presetDef.kernelRadius;
        this.params.preset = params.preset as LeniaPreset;
        this.rebuildKernel();
        if (!isInitial) {
          this.seedOrganismField();
        }
      }
    }

    if (params.mu !== undefined) this.targetParams.mu = Number(params.mu);
    if (params.sigma !== undefined) this.targetParams.sigma = Number(params.sigma);
    if (params.dt !== undefined) this.targetParams.dt = Number(params.dt);
    if (params.kernelRadius !== undefined) {
      const newR = Number(params.kernelRadius);
      this.targetParams.kernelRadius = newR;
      if (Math.round(newR) !== Math.round(this.params.kernelRadius)) {
        this.params.kernelRadius = newR;
        this.rebuildKernel();
      }
    }
    if (params.simSpeed !== undefined) this.targetParams.simSpeed = Number(params.simSpeed);
    if (params.reliefScale !== undefined) this.targetParams.reliefScale = Number(params.reliefScale);
    if (params.brushRadius !== undefined) this.targetParams.brushRadius = Number(params.brushRadius);
    if (params.brushIntensity !== undefined) this.targetParams.brushIntensity = Number(params.brushIntensity);

    if (params.colorPalette && params.colorPalette !== this.params.colorPalette) {
      this.params.colorPalette = params.colorPalette;
      this.targetParams.colorPalette = params.colorPalette;
      this.rebuildColorLut();
    }

    if (params.seed && params.seed !== this.params.seed) {
      this.params.seed = params.seed;
      this.targetParams.seed = params.seed;
      this.prng = createPRNG(params.seed);
      this.seedOrganismField();
    }

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.uReliefScale.value = this.params.reliefScale;
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

      // Spawn localized soliton kernel bump on direct pointer click
      const w = this.simWidth;
      const h = this.simHeight;
      const cx = Math.floor(this.pointerX * w);
      const cy = Math.floor(this.pointerY * h);
      this.spawnOrbiumSoliton(cx, cy, 0.9);
    } else if (event.type === 'leave') {
      this.isPointerDown = false;
      this.pointerX = -1000;
      this.pointerY = -1000;
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
    const a = this.stateA;
    const lut = this.colorLutABGR;
    const relief = this.params.reliefScale;

    // Build temporary offscreen image buffer
    const tempImgData = offCtx.createImageData(w, h);
    const buf32 = new Uint32Array(tempImgData.data.buffer);

    const lightX = 0.5, lightY = 0.6, lightZ = 0.8;
    const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
    const lx = lightX / lightLen, ly = lightY / lightLen, lz = lightZ / lightLen;

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
        const valA = a[idx];

        const dX = (a[row + xR] - a[row + xL]) * relief;
        const dY = (a[rowD + x] - a[rowU + x]) * relief;
        const nLen = Math.sqrt(dX * dX + dY * dY + 1.0);
        const nx = -dX / nLen;
        const ny = -dY / nLen;
        const nz = 1.0 / nLen;

        const diff = Math.max(0.0, nx * lx + ny * ly + nz * lz);
        const lutIdx = Math.min(255, Math.max(0, Math.floor(valA * 255.0)));
        const basePixel = lut[lutIdx];

        const pr = basePixel & 0xFF;
        const pg = (basePixel >> 8) & 0xFF;
        const pb = (basePixel >> 16) & 0xFF;

        const litFactor = 0.4 + 0.6 * diff;
        const r = Math.min(255, Math.round(pr * litFactor));
        const g = Math.min(255, Math.round(pg * litFactor));
        const bl = Math.min(255, Math.round(pb * litFactor));

        buf32[idx] = (255 << 24) | (bl << 16) | (g << 8) | r;
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

export const room: RoomInstance = new LeniaRoom();
export default room;
