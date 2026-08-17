/**
 * Room 09: Cyclic Cellular Automata (Color-Cycling Wave Fronts)
 * Curatorial Category: Artificial Life
 * Math Model: David Griffeath Multi-State Cyclic Cellular Automata (1988)
 * Compute Engine: Three.js WebGPURenderer / TSL False-Color Shading with High-Performance TypedArray Simulation
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Multi-state discrete cellular automata with cyclic state advancement:
 *     S^(t+1)(x,y) = (S(x,y) + 1) mod N, if count({neighbors with state (S+1) mod N}) >= T
 *     else S^(t+1)(x,y) = S(x,y)
 * - Configurable Moore (Chebyshev metric) & von Neumann (Manhattan metric) neighborhoods
 * - Radius range R ∈ [1, 4], Threshold T ∈ [1, 8], State count N ∈ [4, 32]
 * - 6 Canonical Rule Presets:
 *     - Spiral Crystals (14-State Moore Classic)
 *     - Amoeba Waves (8-State Rapid Undulations)
 *     - Turbulence (16-State R3 Chaotic Annihilations)
 *     - Perfect Spirals (16-State Archimedean Wavefronts)
 *     - 31-State Chaos (Dense Fine-Grained Lattice)
 *     - Lava Plumes (12-State Viscous Heavy Drag)
 * - 6 Curatorial Spectral Palettes (Spectral Aurora, Solar Flare, Cyber Neon, Bioluminescent Emerald, Obsidian Amethyst, Monochrome Matrix)
 * - Dynamic 3D normal-mapped surface relief with Blinn-Phong lighting and starlight specular crests
 * - Interactive pointer disturbance & nucleation painting (Disrupt chaotic seed, Archimedean pinwheel vortex, cycle advance)
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
  fract,
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

export type CyclicPreset =
  | 'spiral-crystals'
  | 'amoeba-waves'
  | 'turbulence'
  | 'perfect-spirals'
  | 'chaos-31'
  | 'lava';

export type NeighborhoodType = 'moore' | 'von-neumann';

export type BrushMode = 'disrupt' | 'vortex' | 'advance';

export type PaletteName =
  | 'spectral-aurora'
  | 'solar-flare'
  | 'cyber-neon'
  | 'bioluminescent-emerald'
  | 'obsidian-amethyst'
  | 'monochrome-matrix';

export interface CyclicAutomataParams {
  seed: string;
  preset: CyclicPreset;
  stateCount: number;         // N: Number of cyclic discrete states (4 to 32)
  threshold: number;          // T / K: Advance threshold neighbor count (1 to 8)
  neighborhoodRange: number;  // R: Neighborhood radius (1 to 4)
  neighborhoodType: NeighborhoodType;
  simSpeed: number;           // Substeps per frame (1 to 10)
  reliefScale: number;        // 3D structural normal relief scale (0.0 to 4.0)
  brushRadius: number;        // Interactive pointer brush radius (5 to 60)
  brushMode: BrushMode;       // Interaction mode
  colorPalette: PaletteName;  // Curatorial color palette
}

export const DEFAULT_CYCLIC_PARAMS: CyclicAutomataParams = {
  seed: '#FF0055',
  preset: 'spiral-crystals',
  stateCount: 14,
  threshold: 3,
  neighborhoodRange: 2,
  neighborhoodType: 'moore',
  simSpeed: 3,
  reliefScale: 1.8,
  brushRadius: 20,
  brushMode: 'disrupt',
  colorPalette: 'spectral-aurora',
};

// Curated Cyclic Automata Rule Presets
export interface CyclicPresetDefinition {
  name: string;
  stateCount: number;
  threshold: number;
  neighborhoodRange: number;
  neighborhoodType: NeighborhoodType;
  simSpeed: number;
  reliefScale: number;
  colorPalette: PaletteName;
  description: string;
}

export const CYCLIC_PRESETS: Record<CyclicPreset, CyclicPresetDefinition> = {
  'spiral-crystals': {
    name: 'Spiral Crystals (14-State Moore)',
    stateCount: 14,
    threshold: 3,
    neighborhoodRange: 2,
    neighborhoodType: 'moore',
    simSpeed: 3,
    reliefScale: 1.8,
    colorPalette: 'spectral-aurora',
    description: 'Balanced classic Griffeath rotating spiral wave crystals.',
  },
  'amoeba-waves': {
    name: 'Amoeba Waves (8-State Rapid)',
    stateCount: 8,
    threshold: 2,
    neighborhoodRange: 1,
    neighborhoodType: 'moore',
    simSpeed: 2,
    reliefScale: 1.2,
    colorPalette: 'bioluminescent-emerald',
    description: 'Rapid undulating organic amoeboid ripples with tight wavefronts.',
  },
  'turbulence': {
    name: 'Turbulence (16-State R3)',
    stateCount: 16,
    threshold: 2,
    neighborhoodRange: 3,
    neighborhoodType: 'von-neumann',
    simSpeed: 4,
    reliefScale: 2.2,
    colorPalette: 'solar-flare',
    description: 'Highly energetic turbulent vortex collisions with chaotic annihilations.',
  },
  'perfect-spirals': {
    name: 'Perfect Spirals (16-State Classic)',
    stateCount: 16,
    threshold: 3,
    neighborhoodRange: 2,
    neighborhoodType: 'moore',
    simSpeed: 3,
    reliefScale: 2.0,
    colorPalette: 'cyber-neon',
    description: 'Clean mathematical Archimedean spiral wavefront arms.',
  },
  'chaos-31': {
    name: '31-State Chaos (Dense Lattice)',
    stateCount: 31,
    threshold: 3,
    neighborhoodRange: 2,
    neighborhoodType: 'moore',
    simSpeed: 4,
    reliefScale: 1.5,
    colorPalette: 'obsidian-amethyst',
    description: 'High-density multi-colored fine-grained chromatic spiral lattice.',
  },
  'lava': {
    name: 'Lava Plumes (12-State Viscous)',
    stateCount: 12,
    threshold: 4,
    neighborhoodRange: 3,
    neighborhoodType: 'moore',
    simSpeed: 2,
    reliefScale: 2.5,
    colorPalette: 'solar-flare',
    description: 'Viscous oozing magma plumes with heavy threshold drag.',
  },
};

// Curatorial Color Palettes
export interface CyclicPalette {
  name: string;
  voidColor: [number, number, number];
  deepColor: [number, number, number];
  primaryColor: [number, number, number];
  accentColor: [number, number, number];
  crestColor: [number, number, number];
  rgbVoid: [number, number, number];
  rgbDeep: [number, number, number];
  rgbPrimary: [number, number, number];
  rgbAccent: [number, number, number];
  rgbCrest: [number, number, number];
}

export const CYCLIC_PALETTES: Record<PaletteName, CyclicPalette> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    voidColor: [0.035, 0.039, 0.051],
    deepColor: [0.08, 0.12, 0.35],
    primaryColor: [0.0, 0.94, 0.85],
    accentColor: [0.65, 0.22, 0.95],
    crestColor: [0.98, 0.92, 1.0],
    rgbVoid: [9, 10, 13],
    rgbDeep: [20, 31, 89],
    rgbPrimary: [0, 240, 217],
    rgbAccent: [166, 56, 242],
    rgbCrest: [250, 235, 255],
  },
  'solar-flare': {
    name: 'Solar Flare',
    voidColor: [0.035, 0.039, 0.051],
    deepColor: [0.28, 0.06, 0.02],
    primaryColor: [1.0, 0.45, 0.0],
    accentColor: [1.0, 0.82, 0.15],
    crestColor: [1.0, 0.96, 0.80],
    rgbVoid: [9, 10, 13],
    rgbDeep: [71, 15, 5],
    rgbPrimary: [255, 115, 0],
    rgbAccent: [255, 209, 38],
    rgbCrest: [255, 245, 204],
  },
  'cyber-neon': {
    name: 'Cyber Neon',
    voidColor: [0.035, 0.039, 0.051],
    deepColor: [0.20, 0.02, 0.38],
    primaryColor: [0.0, 0.92, 1.0],
    accentColor: [1.0, 0.15, 0.65],
    crestColor: [0.40, 1.0, 0.40],
    rgbVoid: [9, 10, 13],
    rgbDeep: [51, 5, 97],
    rgbPrimary: [0, 235, 255],
    rgbAccent: [255, 38, 166],
    rgbCrest: [102, 255, 102],
  },
  'bioluminescent-emerald': {
    name: 'Bioluminescent Emerald',
    voidColor: [0.035, 0.039, 0.051],
    deepColor: [0.02, 0.18, 0.15],
    primaryColor: [0.0, 1.0, 0.62],
    accentColor: [0.0, 0.85, 0.95],
    crestColor: [0.92, 1.0, 0.96],
    rgbVoid: [9, 10, 13],
    rgbDeep: [5, 46, 38],
    rgbPrimary: [0, 255, 158],
    rgbAccent: [0, 217, 242],
    rgbCrest: [235, 255, 245],
  },
  'obsidian-amethyst': {
    name: 'Obsidian Amethyst',
    voidColor: [0.035, 0.039, 0.051],
    deepColor: [0.15, 0.06, 0.32],
    primaryColor: [0.55, 0.25, 0.85],
    accentColor: [0.88, 0.45, 0.92],
    crestColor: [0.95, 0.92, 1.0],
    rgbVoid: [9, 10, 13],
    rgbDeep: [38, 15, 82],
    rgbPrimary: [140, 64, 217],
    rgbAccent: [224, 115, 235],
    rgbCrest: [242, 235, 255],
  },
  'monochrome-matrix': {
    name: 'Monochrome Matrix',
    voidColor: [0.035, 0.039, 0.051],
    deepColor: [0.18, 0.20, 0.24],
    primaryColor: [0.48, 0.52, 0.58],
    accentColor: [0.80, 0.84, 0.90],
    crestColor: [0.98, 0.98, 1.0],
    rgbVoid: [9, 10, 13],
    rgbDeep: [46, 51, 61],
    rgbPrimary: [122, 133, 148],
    rgbAccent: [204, 214, 230],
    rgbCrest: [250, 250, 255],
  },
};

export class CyclicAutomataRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;

  private simTexture: THREE.DataTexture | null = null;
  private backendMode: 'webgpu' | 'canvas2d' = 'webgpu';

  private prng: PRNG = createPRNG('#FF0055');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;

  // Grid Simulation Buffers
  private simWidth = 384;
  private simHeight = 384;
  private grid: Uint8Array = new Uint8Array(0);
  private nextGrid: Uint8Array = new Uint8Array(0);
  private rgbaBuffer: Float32Array = new Float32Array(0);

  // Precomputed Neighbor Offsets
  private neighborOffsets: Int32Array = new Int32Array(0); // [dx0, dy0, dx1, dy1, ...]
  private neighborCount = 0;

  // CPU 2D Image Buffer & Precomputed 32-bit ABGR Color LUT
  private fallbackImageData: ImageData | null = null;
  private fallbackImageBuf32: Uint32Array | null = null;
  private colorLutABGR: Uint32Array = new Uint32Array(256);

  // Active & Target Parameters
  private params: CyclicAutomataParams = { ...DEFAULT_CYCLIC_PARAMS };
  private targetParams: CyclicAutomataParams = { ...DEFAULT_CYCLIC_PARAMS };
  private stepAccumulator = 0.0;

  // TSL Uniform Nodes
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uTexelSize = uniform(new THREE.Vector2(1 / 384, 1 / 384));
  private uReliefScale = uniform(1.8);
  private uStateCount = uniform(14);
  private uColorVoid = uniform(new THREE.Color(0.035, 0.039, 0.051));
  private uColorDeep = uniform(new THREE.Color(0.08, 0.12, 0.35));
  private uColorPrimary = uniform(new THREE.Color(0.0, 0.94, 0.85));
  private uColorAccent = uniform(new THREE.Color(0.65, 0.22, 0.95));
  private uColorCrest = uniform(new THREE.Color(0.98, 0.92, 1.0));

  // Pointer Interaction
  private pointerX = -1000;
  private pointerY = -1000;
  private prevPointerX = -1000;
  private prevPointerY = -1000;
  private isPointerDown = false;
  private isMounted = false;

  /**
   * Mounts the cyclic automata exhibit to the canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = Math.min(ctx.dpr || 1, 2.0);
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_CYCLIC_PARAMS.seed);

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Detect GPU Capabilities
    const gpuCaps = await detectGPUCapabilities();
    const canUseGPU = gpuCaps.hasWebGPU || gpuCaps.hasWebGL2;

    // Configure simulation grid resolution
    const aspect = this.width / this.height;
    if (aspect >= 1.0) {
      this.simWidth = 384;
      this.simHeight = Math.max(192, Math.round(384 / aspect));
    } else {
      this.simHeight = 384;
      this.simWidth = Math.max(192, Math.round(384 * aspect));
    }

    this.initSimulationBuffers();
    this.rebuildNeighborOffsets();
    this.seedGrid();
    this.rebuildColorLut();

    if (canUseGPU) {
      try {
        await this.initGPURenderer();
        this.backendMode = 'webgpu';
      } catch (err) {
        console.warn('WebGPU/WebGL2 initialization fallback in Room 09:', err);
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
   * Allocates contiguous Uint8Array and Float32Array simulation buffers.
   */
  private initSimulationBuffers(): void {
    const size = this.simWidth * this.simHeight;
    this.grid = new Uint8Array(size);
    this.nextGrid = new Uint8Array(size);
    this.rgbaBuffer = new Float32Array(size * 4);

    this.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.uResolution.value.set(this.width, this.height);
    this.uStateCount.value = this.params.stateCount;
  }

  /**
   * Precomputes neighbor offsets (dx, dy) for the active radius and neighborhood topology.
   */
  private rebuildNeighborOffsets(): void {
    const R = Math.max(1, Math.min(4, Math.round(this.params.neighborhoodRange)));
    const type = this.params.neighborhoodType;
    const offsets: number[] = [];

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx === 0 && dy === 0) continue;

        if (type === 'moore') {
          // Chebyshev distance max(|dx|, |dy|) <= R
          if (Math.max(Math.abs(dx), Math.abs(dy)) <= R) {
            offsets.push(dx, dy);
          }
        } else {
          // von Neumann Manhattan distance |dx| + |dy| <= R
          if (Math.abs(dx) + Math.abs(dy) <= R) {
            offsets.push(dx, dy);
          }
        }
      }
    }

    this.neighborOffsets = new Int32Array(offsets);
    this.neighborCount = offsets.length / 2;
  }

  /**
   * Seeds the cyclic cellular automata grid deterministically using Mulberry32 PRNG.
   */
  private seedGrid(): void {
    const size = this.simWidth * this.simHeight;
    const N = Math.max(4, Math.min(32, Math.round(this.params.stateCount)));
    const w = this.simWidth;
    const h = this.simHeight;

    // Fill grid with uniform random state soup
    for (let i = 0; i < size; i++) {
      this.grid[i] = this.prng.nextInt(0, N - 1);
      this.nextGrid[i] = this.grid[i];
    }

    // Seed several concentrated vortex nucleations across the field
    const seedClusters = this.prng.nextInt(4, 8);
    for (let c = 0; c < seedClusters; c++) {
      const cx = this.prng.nextInt(Math.floor(w * 0.15), Math.floor(w * 0.85));
      const cy = this.prng.nextInt(Math.floor(h * 0.15), Math.floor(h * 0.85));
      const radius = this.prng.nextInt(10, 24);
      const rSq = radius * radius;

      const minX = Math.max(0, cx - radius);
      const maxX = Math.min(w - 1, cx + radius);
      const minY = Math.max(0, cy - radius);
      const maxY = Math.min(h - 1, cy + radius);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= rSq) {
            const angle = Math.atan2(dy, dx) + Math.PI; // [0, 2PI]
            const state = Math.floor((angle / (Math.PI * 2)) * N) % N;
            this.grid[y * w + x] = state;
          }
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
   * Constructs the TSL Display Material with 3D Normal-Mapped Surface Relief & Cyclic Palette Ramp.
   */
  private buildTSLDisplayMaterial(): THREE.MeshBasicNodeMaterial {
    if (!this.simTexture) {
      throw new Error('Simulation DataTexture must be initialized before building TSL material.');
    }

    const simTexNode = texture(this.simTexture);

    const displayColorNode = tslFn(() => {
      const uvCoord = uv();

      // Sample central phase
      const centerSample = simTexNode.sample(uvCoord);
      const phaseCenter = centerSample.r; // Normalized state S/N in [0, 1)

      // Sample 4 orthogonal neighbors for spatial gradient normal extraction
      const rightSample = simTexNode.sample(uvCoord.add(vec2(this.uTexelSize.x, 0.0)));
      const leftSample = simTexNode.sample(uvCoord.sub(vec2(this.uTexelSize.x, 0.0)));
      const upSample = simTexNode.sample(uvCoord.add(vec2(0.0, this.uTexelSize.y)));
      const downSample = simTexNode.sample(uvCoord.sub(vec2(0.0, this.uTexelSize.y)));

      // Cyclic shortest phase difference helper: fract(delta + 0.5) - 0.5
      const dXPhase = fract(rightSample.r.sub(leftSample.r).add(0.5)).sub(0.5);
      const dYPhase = fract(upSample.r.sub(downSample.r).add(0.5)).sub(0.5);

      // 3D Surface Relief Normal Vector
      const dX = dXPhase.mul(this.uReliefScale).mul(3.5);
      const dY = dYPhase.mul(this.uReliefScale).mul(3.5);
      const normal = vec3(dX.negate(), dY.negate(), 1.0).normalize();

      // Lighting Vectors (Directional key light + View vector)
      const lightDir = vec3(0.5, 0.6, 0.8).normalize();
      const viewDir = vec3(0.0, 0.0, 1.0);
      const halfVec = lightDir.add(viewDir).normalize();

      // Blinn-Phong Shading Components
      const diffuse = clamp(normal.dot(lightDir), 0.0, 1.0);
      const specular = clamp(normal.dot(halfVec), 0.0, 1.0).pow(24.0).mul(0.45);

      // Smooth Cyclic 5-Tone Spectral Palette Ramp
      // Periodic phase mapping: t in [0, 1)
      const t = fract(phaseCenter);

      // Multi-segment smooth cyclic blending
      const t0 = clamp(t.mul(4.0), 0.0, 1.0);
      const t1 = clamp(t.sub(0.25).mul(4.0), 0.0, 1.0);
      const t2 = clamp(t.sub(0.50).mul(4.0), 0.0, 1.0);
      const t3 = clamp(t.sub(0.75).mul(4.0), 0.0, 1.0);

      const col0 = mix(this.uColorVoid, this.uColorDeep, t0);
      const col1 = mix(col0, this.uColorPrimary, t1);
      const col2 = mix(col1, this.uColorAccent, t2);
      const col3 = mix(col2, this.uColorCrest, t3);

      // Cyclic wrap back from crest to void
      const wrapFactor = clamp(t.sub(0.90).mul(10.0), 0.0, 1.0);
      const finalPalette = mix(col3, this.uColorVoid, wrapFactor);

      // Subtle step enhancement along wavefront boundaries
      const edgeIntensity = clamp(dX.abs().add(dY.abs()).mul(0.4), 0.0, 0.6);

      // Modulate with ambient (0.35) + diffuse (0.65) + starlight specular crest + wavefront bevel
      const litSurface = finalPalette
        .mul(float(0.35).add(diffuse.mul(0.65)))
        .add(this.uColorCrest.mul(specular))
        .add(this.uColorAccent.mul(edgeIntensity));

      return vec4(litSurface, 1.0);
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
    this.ctx2d = this.canvas.getContext('2d');
    if (!this.ctx2d) return;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.fallbackImageData = this.ctx2d.createImageData(this.simWidth, this.simHeight);
    this.fallbackImageBuf32 = new Uint32Array(this.fallbackImageData.data.buffer);
  }

  /**
   * Rebuilds 256-entry 32-bit ABGR palette lookup table for fast CPU blitting.
   */
  private rebuildColorLut(): void {
    const palette = CYCLIC_PALETTES[this.params.colorPalette] || CYCLIC_PALETTES['spectral-aurora'];

    // Update TSL uniforms
    this.uColorVoid.value.setRGB(...palette.voidColor);
    this.uColorDeep.value.setRGB(...palette.deepColor);
    this.uColorPrimary.value.setRGB(...palette.primaryColor);
    this.uColorAccent.value.setRGB(...palette.accentColor);
    this.uColorCrest.value.setRGB(...palette.crestColor);

    const vR = palette.rgbVoid[0], vG = palette.rgbVoid[1], vB = palette.rgbVoid[2];
    const dR = palette.rgbDeep[0], dG = palette.rgbDeep[1], dB = palette.rgbDeep[2];
    const pR = palette.rgbPrimary[0], pG = palette.rgbPrimary[1], pB = palette.rgbPrimary[2];
    const aR = palette.rgbAccent[0], aG = palette.rgbAccent[1], aB = palette.rgbAccent[2];
    const cR = palette.rgbCrest[0], cG = palette.rgbCrest[1], cB = palette.rgbCrest[2];

    for (let i = 0; i < 256; i++) {
      const t = i / 255.0;
      let r: number, g: number, b: number;

      if (t < 0.25) {
        const u = t / 0.25;
        r = vR + (dR - vR) * u;
        g = vG + (dG - vG) * u;
        b = vB + (dB - vB) * u;
      } else if (t < 0.50) {
        const u = (t - 0.25) / 0.25;
        r = dR + (pR - dR) * u;
        g = dG + (pG - dG) * u;
        b = dB + (pB - dB) * u;
      } else if (t < 0.75) {
        const u = (t - 0.50) / 0.25;
        r = pR + (aR - pR) * u;
        g = pG + (aG - pG) * u;
        b = pB + (aB - pB) * u;
      } else if (t < 0.92) {
        const u = (t - 0.75) / 0.17;
        r = aR + (cR - aR) * u;
        g = aG + (cG - aG) * u;
        b = aB + (cB - aB) * u;
      } else {
        // Wrap back to void for seamless cyclic continuity
        const u = (t - 0.92) / 0.08;
        r = cR + (vR - cR) * u;
        g = cG + (vG - cG) * u;
        b = cB + (vB - cB) * u;
      }

      const cr = Math.min(255, Math.max(0, Math.round(r)));
      const cg = Math.min(255, Math.max(0, Math.round(g)));
      const cb = Math.min(255, Math.max(0, Math.round(b)));

      // Little-endian ABGR: (A << 24) | (B << 16) | (G << 8) | R
      this.colorLutABGR[i] = (255 << 24) | (cb << 16) | (cg << 8) | cr;
    }
  }

  /**
   * Synchronizes simulation discrete states into flat Float32Array RGBA buffer.
   */
  private updateRGBABuffer(): void {
    const size = this.simWidth * this.simHeight;
    const N = Math.max(4, Math.min(32, Math.round(this.params.stateCount)));
    const invN = 1.0 / N;
    const grid = this.grid;
    const rgba = this.rgbaBuffer;

    for (let i = 0; i < size; i++) {
      const state = grid[i];
      const offset = i * 4;
      rgba[offset] = state * invN;               // Red: Normalized state phase [0, 1)
      rgba[offset + 1] = ((state + 1) % N) * invN; // Green: Next state phase
      rgba[offset + 2] = 0.0;
      rgba[offset + 3] = 1.0;
    }
  }

  /**
   * Main render and simulation loop.
   */
  private loop(now: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Smooth Parameter Damping
    this.dampActiveParameters(dt);

    // Apply interactive pointer disturbance
    this.applyPointerInteraction();

    // Execute Cyclic Cellular Automata substeps with accumulator for strict frame-rate independence
    this.stepAccumulator += dt * this.params.simSpeed * 60.0;
    const substeps = Math.min(10, Math.floor(this.stepAccumulator));
    this.stepAccumulator -= substeps;
    for (let s = 0; s < substeps; s++) {
      this.stepSimulation();
    }

    // Render output
    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera && this.simTexture) {
      this.updateRGBABuffer();
      this.simTexture.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderCanvas2D();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Executes one discrete cellular automata step of Griffeath's Cyclic Rule.
   */
  private stepSimulation(): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const N = Math.max(4, Math.min(32, Math.round(this.params.stateCount)));
    const T = Math.max(1, Math.min(8, Math.round(this.params.threshold)));
    const offsets = this.neighborOffsets;
    const offsetPairs = this.neighborCount;

    const src = this.grid;
    const dst = this.nextGrid;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;

      for (let x = 0; x < w; x++) {
        const idx = rowOffset + x;
        const state = src[idx];
        const targetState = (state + 1) % N;

        let count = 0;

        // Iterate over precomputed neighbor offsets with fast toroidal boundary wrap
        for (let k = 0; k < offsetPairs; k++) {
          const dx = offsets[k * 2];
          const dy = offsets[k * 2 + 1];

          let nx = x + dx;
          if (nx < 0) nx += w;
          else if (nx >= w) nx -= w;

          let ny = y + dy;
          if (ny < 0) ny += h;
          else if (ny >= h) ny -= h;

          if (src[ny * w + nx] === targetState) {
            count++;
            // Early exit optimization
            if (count >= T) {
              break;
            }
          }
        }

        dst[idx] = count >= T ? targetState : state;
      }
    }

    // Swap buffers
    const temp = this.grid;
    this.grid = this.nextGrid;
    this.nextGrid = temp;
  }

  /**
   * Applies interactive pointer disturbance / nucleation painting.
   */
  private applyPointerInteraction(): void {
    if (!this.isPointerDown || this.pointerX < 0 || this.pointerY < 0) {
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      return;
    }

    const w = this.simWidth;
    const h = this.simHeight;
    const N = Math.max(4, Math.min(32, Math.round(this.params.stateCount)));

    const currX = this.pointerX * w;
    const currY = this.pointerY * h;
    const prevX = (this.prevPointerX >= 0 ? this.prevPointerX : this.pointerX) * w;
    const prevY = (this.prevPointerY >= 0 ? this.prevPointerY : this.pointerY) * h;

    const dist = Math.hypot(currX - prevX, currY - prevY);
    const steps = Math.max(1, Math.ceil(dist / 3.0));

    const radius = Math.max(4, Math.round(this.params.brushRadius * (w / 800)));
    const rSq = radius * radius;
    const mode = this.params.brushMode;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sx = prevX + (currX - prevX) * t;
      const sy = prevY + (currY - prevY) * t;

      const minX = Math.max(0, Math.floor(sx - radius));
      const maxX = Math.min(w - 1, Math.ceil(sx + radius));
      const minY = Math.max(0, Math.floor(sy - radius));
      const maxY = Math.min(h - 1, Math.ceil(sy + radius));

      for (let y = minY; y <= maxY; y++) {
        const row = y * w;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - sx;
          const dy = y - sy;
          const dSq = dx * dx + dy * dy;
          if (dSq <= rSq) {
            const idx = row + x;
            if (mode === 'disrupt') {
              // Chaotic random nucleation seed
              if (Math.random() < 0.65) {
                this.grid[idx] = Math.floor(Math.random() * N);
              }
            } else if (mode === 'vortex') {
              // Archimedean pinwheel spiral gradient
              const angle = Math.atan2(dy, dx) + Math.PI;
              this.grid[idx] = Math.floor((angle / (Math.PI * 2)) * N) % N;
            } else if (mode === 'advance') {
              // Advance state cycle
              this.grid[idx] = (this.grid[idx] + 1) % N;
            }
          }
        }
      }
    }

    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;
  }

  /**
   * Renders the Canvas2D fallback with 3D normal relief and 32-bit ABGR LUT blitting.
   */
  private renderCanvas2D(): void {
    if (!this.ctx2d || !this.fallbackImageBuf32 || !this.fallbackImageData || !this.canvas) return;

    const w = this.simWidth;
    const h = this.simHeight;
    const grid = this.grid;
    const lut = this.colorLutABGR;
    const buf = this.fallbackImageBuf32;
    const N = Math.max(4, Math.min(32, Math.round(this.params.stateCount)));
    const invN = 1.0 / N;
    const relief = this.params.reliefScale;

    const lightX = 0.5, lightY = 0.6, lightZ = 0.8;
    const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
    const lx = lightX / lightLen, ly = lightY / lightLen, lz = lightZ / lightLen;

    for (let y = 0; y < h; y++) {
      const yUp = y > 0 ? y - 1 : h - 1;
      const yDown = y < h - 1 ? y + 1 : 0;
      const rowC = y * w;
      const rowU = yUp * w;
      const rowD = yDown * w;

      for (let x = 0; x < w; x++) {
        const xL = x > 0 ? x - 1 : w - 1;
        const xR = x < w - 1 ? x + 1 : 0;

        const idx = rowC + x;
        const state = grid[idx];
        const phase = state * invN;

        // Base color from 256-entry LUT
        const lutIdx = Math.min(255, Math.floor(phase * 255));
        const baseColor = lut[lutIdx];

        if (relief > 0.01) {
          // Calculate cyclic phase difference
          const pR = grid[rowC + xR] * invN;
          const pL = grid[rowC + xL] * invN;
          const pU = grid[rowU + x] * invN;
          const pD = grid[rowD + x] * invN;

          let dxP = (pR - pL + 1.5) % 1.0 - 0.5;
          let dyP = (pU - pD + 1.5) % 1.0 - 0.5;

          const nx = -dxP * relief * 3.5;
          const ny = -dyP * relief * 3.5;
          const nz = 1.0;
          const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const normX = nx / nLen, normY = ny / nLen, normZ = nz / nLen;

          const dot = normX * lx + normY * ly + normZ * lz;
          const diff = Math.max(0.0, Math.min(1.0, dot));
          const lightFactor = 0.4 + 0.6 * diff;

          const r = baseColor & 0xFF;
          const g = (baseColor >> 8) & 0xFF;
          const b = (baseColor >> 16) & 0xFF;

          const lr = Math.min(255, Math.round(r * lightFactor));
          const lg = Math.min(255, Math.round(g * lightFactor));
          const lb = Math.min(255, Math.round(b * lightFactor));

          buf[idx] = (255 << 24) | (lb << 16) | (lg << 8) | lr;
        } else {
          buf[idx] = baseColor;
        }
      }
    }

    // Blit to offscreen Canvas2D
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(this.fallbackImageData, 0, 0);
      this.ctx2d.imageSmoothingEnabled = true;
      this.ctx2d.drawImage(offscreen, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Applies smooth frame-rate independent exponential parameter damping.
   */
  private dampActiveParameters(dt: number): void {
    const lambda = 8.0;

    this.params.reliefScale = dampParameter(this.params.reliefScale, this.targetParams.reliefScale, lambda, dt);
    this.params.simSpeed = dampParameter(this.params.simSpeed, this.targetParams.simSpeed, lambda, dt);

    this.uReliefScale.value = this.params.reliefScale;
  }

  /**
   * Handles incoming parameter changes from Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevPreset = this.params.preset;
    const prevPalette = this.params.colorPalette;
    const prevN = this.params.stateCount;
    const prevR = this.params.neighborhoodRange;
    const prevType = this.params.neighborhoodType;
    const prevSeed = this.params.seed;

    this.applyParams(newParams, false);

    // Preset Switching
    if (newParams.preset && newParams.preset !== prevPreset && CYCLIC_PRESETS[newParams.preset as CyclicPreset]) {
      const presetDef = CYCLIC_PRESETS[newParams.preset as CyclicPreset];
      this.targetParams.stateCount = presetDef.stateCount;
      this.targetParams.threshold = presetDef.threshold;
      this.targetParams.neighborhoodRange = presetDef.neighborhoodRange;
      this.targetParams.neighborhoodType = presetDef.neighborhoodType;
      this.targetParams.simSpeed = presetDef.simSpeed;
      this.targetParams.reliefScale = presetDef.reliefScale;
      this.targetParams.colorPalette = presetDef.colorPalette;

      this.params.stateCount = presetDef.stateCount;
      this.params.threshold = presetDef.threshold;
      this.params.neighborhoodRange = presetDef.neighborhoodRange;
      this.params.neighborhoodType = presetDef.neighborhoodType;
      this.params.colorPalette = presetDef.colorPalette;

      this.uStateCount.value = this.params.stateCount;
      this.rebuildNeighborOffsets();
      this.rebuildColorLut();
      this.seedGrid();
    }

    // Seed Randomization
    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.seedGrid();
    }

    // Structural Rules Updates
    if (
      this.params.stateCount !== prevN ||
      this.params.neighborhoodRange !== prevR ||
      this.params.neighborhoodType !== prevType
    ) {
      this.uStateCount.value = this.params.stateCount;
      this.rebuildNeighborOffsets();
    }

    // Palette Updates
    if (this.params.colorPalette !== prevPalette) {
      this.rebuildColorLut();
    }
  }

  /**
   * Applies and sanitizes parameter values.
   */
  private applyParams(rawParams: Record<string, any>, immediate: boolean): void {
    if (!rawParams) return;

    if (rawParams.preset && CYCLIC_PRESETS[rawParams.preset as CyclicPreset]) {
      this.targetParams.preset = rawParams.preset as CyclicPreset;
    }
    if (typeof rawParams.stateCount === 'number') {
      this.targetParams.stateCount = Math.max(4, Math.min(32, Math.round(rawParams.stateCount)));
    }
    if (typeof rawParams.threshold === 'number') {
      this.targetParams.threshold = Math.max(1, Math.min(8, Math.round(rawParams.threshold)));
    }
    if (typeof rawParams.neighborhoodRange === 'number') {
      this.targetParams.neighborhoodRange = Math.max(1, Math.min(4, Math.round(rawParams.neighborhoodRange)));
    }
    if (rawParams.neighborhoodType === 'moore' || rawParams.neighborhoodType === 'von-neumann') {
      this.targetParams.neighborhoodType = rawParams.neighborhoodType;
    }
    if (typeof rawParams.simSpeed === 'number') {
      this.targetParams.simSpeed = Math.max(1, Math.min(10, rawParams.simSpeed));
    }
    if (typeof rawParams.reliefScale === 'number') {
      this.targetParams.reliefScale = Math.max(0.0, Math.min(4.0, rawParams.reliefScale));
    }
    if (typeof rawParams.brushRadius === 'number') {
      this.targetParams.brushRadius = Math.max(5, Math.min(60, rawParams.brushRadius));
    }
    if (rawParams.brushMode === 'disrupt' || rawParams.brushMode === 'vortex' || rawParams.brushMode === 'advance') {
      this.targetParams.brushMode = rawParams.brushMode;
    }
    if (rawParams.colorPalette && CYCLIC_PALETTES[rawParams.colorPalette as PaletteName]) {
      this.targetParams.colorPalette = rawParams.colorPalette as PaletteName;
    }
    if (typeof rawParams.seed === 'string') {
      this.targetParams.seed = rawParams.seed;
    }

    if (immediate) {
      this.params = { ...this.targetParams };
      this.uReliefScale.value = this.params.reliefScale;
      this.uStateCount.value = this.params.stateCount;
    }
  }

  /**
   * Resizes viewport and updates renderer projection.
   */
  public resize(w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    this.width = w;
    this.height = h;

    if (this.renderer && this.material) {
      this.renderer.setSize(w, h, false);
      this.uResolution.value.set(w, h);
    }

    if (this.ctx2d && this.canvas) {
      this.canvas.width = Math.floor(w * this.dpr);
      this.canvas.height = Math.floor(h * this.dpr);
    }
  }

  /**
   * Receives normalized interactive pointer coordinates.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.isPointerDown = false;
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.prevPointerX = -1000;
      this.prevPointerY = -1000;
      return;
    }

    this.pointerX = event.normalizedX;
    this.pointerY = event.normalizedY;
    this.isPointerDown = event.isDown || event.type === 'down';

    if (event.type === 'down') {
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      this.applyPointerInteraction();
    }
  }

  /**
   * Generates high-resolution offline snapshot canvas for 4K/8K export.
   */
  public async captureSnapshot(snapWidth: number, snapHeight: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = snapWidth;
    snapCanvas.height = snapHeight;
    const snapCtx = snapCanvas.getContext('2d');
    if (!snapCtx) return snapCanvas;

    // Fill obsidian void
    snapCtx.fillStyle = '#090A0D';
    snapCtx.fillRect(0, 0, snapWidth, snapHeight);

    // Create high-res grid projection
    const w = this.simWidth;
    const h = this.simHeight;
    const grid = this.grid;
    const lut = this.colorLutABGR;
    const N = Math.max(4, Math.min(32, Math.round(this.params.stateCount)));
    const invN = 1.0 / N;
    const relief = this.params.reliefScale;

    const imgData = snapCtx.createImageData(w, h);
    const buf32 = new Uint32Array(imgData.data.buffer);

    const lightX = 0.5, lightY = 0.6, lightZ = 0.8;
    const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
    const lx = lightX / lightLen, ly = lightY / lightLen, lz = lightZ / lightLen;

    for (let y = 0; y < h; y++) {
      const yUp = y > 0 ? y - 1 : h - 1;
      const yDown = y < h - 1 ? y + 1 : 0;
      const rowC = y * w;
      const rowU = yUp * w;
      const rowD = yDown * w;

      for (let x = 0; x < w; x++) {
        const xL = x > 0 ? x - 1 : w - 1;
        const xR = x < w - 1 ? x + 1 : 0;

        const idx = rowC + x;
        const state = grid[idx];
        const phase = state * invN;
        const lutIdx = Math.min(255, Math.floor(phase * 255));
        const baseColor = lut[lutIdx];

        if (relief > 0.01) {
          const pR = grid[rowC + xR] * invN;
          const pL = grid[rowC + xL] * invN;
          const pU = grid[rowU + x] * invN;
          const pD = grid[rowD + x] * invN;

          let dxP = (pR - pL + 1.5) % 1.0 - 0.5;
          let dyP = (pU - pD + 1.5) % 1.0 - 0.5;

          const nx = -dxP * relief * 3.5;
          const ny = -dyP * relief * 3.5;
          const nz = 1.0;
          const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const normX = nx / nLen, normY = ny / nLen, normZ = nz / nLen;

          const dot = normX * lx + normY * ly + normZ * lz;
          const diff = Math.max(0.0, Math.min(1.0, dot));
          const lightFactor = 0.4 + 0.6 * diff;

          const r = baseColor & 0xFF;
          const g = (baseColor >> 8) & 0xFF;
          const b = (baseColor >> 16) & 0xFF;

          const lr = Math.min(255, Math.round(r * lightFactor));
          const lg = Math.min(255, Math.round(g * lightFactor));
          const lb = Math.min(255, Math.round(b * lightFactor));

          buf32[idx] = (255 << 24) | (lb << 16) | (lg << 8) | lr;
        } else {
          buf32[idx] = baseColor;
        }
      }
    }

    const simCanvas = document.createElement('canvas');
    simCanvas.width = w;
    simCanvas.height = h;
    const simCtx = simCanvas.getContext('2d');
    if (simCtx) {
      simCtx.putImageData(imgData, 0, 0);
      snapCtx.imageSmoothingEnabled = true;
      snapCtx.drawImage(simCanvas, 0, 0, snapWidth, snapHeight);
    }

    return snapCanvas;
  }

  /**
   * Cleans up GPU buffers, cancels RAF timers, and disposes Three.js objects.
   */
  public teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.simTexture) {
      this.simTexture.dispose();
      this.simTexture = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      this.mesh = null;
    }

    if (this.scene) {
      this.scene.clear();
      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.grid = new Uint8Array(0);
    this.nextGrid = new Uint8Array(0);
    this.rgbaBuffer = new Float32Array(0);
    this.fallbackImageData = null;
    this.fallbackImageBuf32 = null;
    this.canvas = null;
    this.ctx2d = null;
  }
}

export function createRoom(): RoomInstance {
  return new CyclicAutomataRoom();
}

export const room: RoomInstance = new CyclicAutomataRoom();
export default room;
