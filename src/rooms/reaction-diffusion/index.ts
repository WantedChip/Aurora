/**
 * Room 06: Reaction-Diffusion (Gray-Scott Ping-Pong Simulation & Normal-Mapped Relief)
 * Curatorial Category: Artificial Life
 * Math Model: Gray-Scott Reaction-Diffusion Kinetics (Pearson Classification)
 * Compute Engine: Three.js WebGPURenderer / TSL Normal Shading with High-Performance TypedArray Fallback
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Solves 2D coupled Gray-Scott PDEs:
 *     ∂A/∂t = D_A ∇²A - A·B² + F(1 - A)
 *     ∂B/∂t = D_B ∇²B + A·B² - (F + k)B
 * - 8 to 24 substeps per frame for instantaneous emergent morphogenesis
 * - 8 Canonical Gray-Scott Presets: Solitons, Mitosis, Coral, Worms, Spirals, Chaos, Spots, Holes
 * - 5 Curatorial Spectral Palettes (Obsidian Coral, Bioluminescent Emerald, Solar Magma, Spectral Abyss, Monochrome Lithic)
 * - Dynamic 3D normal-mapped surface relief with Blinn-Phong lighting and starlight specular crests
 * - Interactive pointer chemical injection painting with continuous interpolation across sweeps
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

export type ReactionDiffusionPreset =
  | 'solitons'
  | 'mitosis'
  | 'coral'
  | 'worms'
  | 'spirals'
  | 'chaos'
  | 'spots'
  | 'holes';

export interface ReactionDiffusionParams {
  seed: string;
  preset: ReactionDiffusionPreset;
  feedRate: number;
  killRate: number;
  diffuseU: number;
  diffuseV: number;
  simSpeed: number;
  reliefScale: number;
  brushRadius: number;
  brushIntensity: number;
  colorPalette: 'obsidian-coral' | 'bioluminescent-emerald' | 'solar-magma' | 'spectral-abyss' | 'monochrome-lithic';
}

export const DEFAULT_REACTION_DIFFUSION_PARAMS: ReactionDiffusionParams = {
  seed: '#9B51E0',
  preset: 'coral',
  feedRate: 0.0545,
  killRate: 0.062,
  diffuseU: 1.0,
  diffuseV: 0.5,
  simSpeed: 12,
  reliefScale: 2.2,
  brushRadius: 25,
  brushIntensity: 0.8,
  colorPalette: 'obsidian-coral',
};

// Curated Pearson Classification Gray-Scott Presets
export interface PresetDefinition {
  name: string;
  feedRate: number;
  killRate: number;
  diffuseU: number;
  diffuseV: number;
  description: string;
}

export const GRAY_SCOTT_PRESETS: Record<ReactionDiffusionPreset, PresetDefinition> = {
  solitons: {
    name: 'Solitons (Pulsing Waves)',
    feedRate: 0.030,
    killRate: 0.062,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Solitary pulsing wave packets that maintain stability through spatial movement.',
  },
  mitosis: {
    name: 'Mitosis (Cell Division)',
    feedRate: 0.0367,
    killRate: 0.0649,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Autonomous spot growth, elongation, and division mimicking cellular mitosis.',
  },
  coral: {
    name: 'Coral (Branched Reef)',
    feedRate: 0.0545,
    killRate: 0.062,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Dense dendritic growth forming mineralized organic coral structures.',
  },
  worms: {
    name: 'Worms (Labyrinthine Mazes)',
    feedRate: 0.078,
    killRate: 0.061,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Meandering continuous ribbons and undulating topological corridors.',
  },
  spirals: {
    name: 'Spirals (Rotating Waves)',
    feedRate: 0.018,
    killRate: 0.051,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Chiral rotating spiral wave fronts and traveling chemical excitations.',
  },
  chaos: {
    name: 'Chaos (Turbulent Swirls)',
    feedRate: 0.026,
    killRate: 0.055,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Highly dynamic non-equilibrium turbulence with continuous spot annihilation.',
  },
  spots: {
    name: 'Spots (Leopard Epidermis)',
    feedRate: 0.038,
    killRate: 0.061,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Stable hexagonal lattice of isolated spots matching animal skin pigmentation.',
  },
  holes: {
    name: 'Holes (Inverted Honeycomb)',
    feedRate: 0.039,
    killRate: 0.058,
    diffuseU: 1.0,
    diffuseV: 0.5,
    description: 'Continuous chemical substrate perforated by negative circular cavities.',
  },
};

// Curatorial Color Palettes for Reaction-Diffusion 3D Relief
export interface RDPalette {
  name: string;
  voidColor: [number, number, number];    // Obsidian void #090A0D (0.035, 0.039, 0.051)
  baseColor: [number, number, number];    // Subterranean vein root tone
  primaryColor: [number, number, number]; // Main chemical membrane body
  accentColor: [number, number, number];  // Active reaction boundary edge
  crestColor: [number, number, number];   // Starlight apex specular crest
  rgbVoid: [number, number, number];
  rgbBase: [number, number, number];
  rgbPrimary: [number, number, number];
  rgbAccent: [number, number, number];
  rgbCrest: [number, number, number];
}

export const RD_PALETTES: Record<string, RDPalette> = {
  'obsidian-coral': {
    name: 'Obsidian Coral',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.20, 0.08, 0.35],
    primaryColor: [0.61, 0.32, 0.88],
    accentColor: [0.96, 0.25, 0.58],
    crestColor: [0.95, 0.98, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [51, 20, 89],
    rgbPrimary: [155, 81, 224],
    rgbAccent: [244, 63, 148],
    rgbCrest: [242, 250, 255],
  },
  'bioluminescent-emerald': {
    name: 'Bioluminescent Emerald',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.02, 0.20, 0.15],
    primaryColor: [0.0, 1.0, 0.62],
    accentColor: [0.0, 0.94, 1.0],
    crestColor: [0.92, 1.0, 0.96],
    rgbVoid: [9, 10, 13],
    rgbBase: [5, 51, 38],
    rgbPrimary: [0, 255, 157],
    rgbAccent: [0, 240, 255],
    rgbCrest: [235, 255, 245],
  },
  'solar-magma': {
    name: 'Solar Magma',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.25, 0.08, 0.02],
    primaryColor: [1.0, 0.55, 0.0],
    accentColor: [1.0, 0.18, 0.10],
    crestColor: [1.0, 0.95, 0.70],
    rgbVoid: [9, 10, 13],
    rgbBase: [64, 20, 5],
    rgbPrimary: [255, 140, 0],
    rgbAccent: [255, 46, 26],
    rgbCrest: [255, 242, 178],
  },
  'spectral-abyss': {
    name: 'Spectral Abyss',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.08, 0.05, 0.25],
    primaryColor: [0.48, 0.23, 0.93],
    accentColor: [1.0, 0.20, 0.40],
    crestColor: [0.20, 0.85, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [20, 13, 64],
    rgbPrimary: [124, 58, 237],
    rgbAccent: [255, 51, 102],
    rgbCrest: [51, 217, 255],
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.15, 0.17, 0.22],
    primaryColor: [0.45, 0.48, 0.55],
    accentColor: [0.75, 0.78, 0.85],
    crestColor: [0.98, 0.98, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [38, 43, 56],
    rgbPrimary: [115, 122, 140],
    rgbAccent: [191, 199, 217],
    rgbCrest: [250, 250, 255],
  },
};

export class ReactionDiffusionRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;

  private simTexture: THREE.DataTexture | null = null;
  private backendMode: 'webgpu' | 'canvas2d' = 'webgpu';

  private prng: PRNG = createPRNG('#9B51E0');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;

  // Grid Simulation Buffers
  private simWidth = 384;
  private simHeight = 384;
  private gridA: Float32Array = new Float32Array(0);
  private gridB: Float32Array = new Float32Array(0);
  private nextA: Float32Array = new Float32Array(0);
  private nextB: Float32Array = new Float32Array(0);
  private rgbaBuffer: Float32Array = new Float32Array(0);

  // CPU 2D Image Buffer & Precomputed 32-bit ABGR Color LUT
  private fallbackImageData: ImageData | null = null;
  private fallbackImageBuf32: Uint32Array | null = null;
  private colorLutABGR: Uint32Array = new Uint32Array(256);

  // Active & Target Parameters
  private params: ReactionDiffusionParams = { ...DEFAULT_REACTION_DIFFUSION_PARAMS };
  private targetParams: ReactionDiffusionParams = { ...DEFAULT_REACTION_DIFFUSION_PARAMS };
  private stepAccumulator = 0.0;

  // TSL Uniform Nodes
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uTexelSize = uniform(new THREE.Vector2(1 / 384, 1 / 384));
  private uReliefScale = uniform(2.2);
  private uColorVoid = uniform(new THREE.Color(0.035, 0.039, 0.051));
  private uColorBase = uniform(new THREE.Color(0.20, 0.08, 0.35));
  private uColorPrimary = uniform(new THREE.Color(0.61, 0.32, 0.88));
  private uColorAccent = uniform(new THREE.Color(0.96, 0.25, 0.58));
  private uColorCrest = uniform(new THREE.Color(0.95, 0.98, 1.0));

  // Pointer Interaction
  private pointerX = -1000;
  private pointerY = -1000;
  private prevPointerX = -1000;
  private prevPointerY = -1000;
  private isPointerDown = false;
  private isMounted = false;

  /**
   * Mounts the reaction-diffusion exhibit to the canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = Math.min(ctx.dpr || 1, 2.0);
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_REACTION_DIFFUSION_PARAMS.seed);

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Detect GPU Capabilities
    const gpuCaps = await detectGPUCapabilities();
    const canUseGPU = gpuCaps.hasWebGPU || gpuCaps.hasWebGL2;

    // Determine simulation grid resolution based on aspect ratio
    const aspect = this.width / this.height;
    if (aspect >= 1.0) {
      this.simWidth = 384;
      this.simHeight = Math.max(192, Math.round(384 / aspect));
    } else {
      this.simHeight = 384;
      this.simWidth = Math.max(192, Math.round(384 * aspect));
    }

    this.initSimulationBuffers();
    this.seedChemicalField();
    this.rebuildColorLut();

    if (canUseGPU) {
      try {
        await this.initGPURenderer();
        this.backendMode = 'webgpu';
      } catch (err) {
        console.warn('WebGPU/WebGL2 initialization fallback in Room 06:', err);
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
   * Allocates contiguous Float32Array simulation buffers.
   */
  private initSimulationBuffers(): void {
    const size = this.simWidth * this.simHeight;
    this.gridA = new Float32Array(size);
    this.gridB = new Float32Array(size);
    this.nextA = new Float32Array(size);
    this.nextB = new Float32Array(size);
    this.rgbaBuffer = new Float32Array(size * 4);

    this.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
  }

  /**
   * Seeds the chemical concentrations deterministically using Mulberry32 PRNG.
   */
  private seedChemicalField(): void {
    const size = this.simWidth * this.simHeight;
    const w = this.simWidth;
    const h = this.simHeight;

    // Fill grid with baseline substrate: A = 1.0, B = 0.0
    for (let i = 0; i < size; i++) {
      this.gridA[i] = 1.0;
      this.gridB[i] = 0.0;
      this.nextA[i] = 1.0;
      this.nextB[i] = 0.0;
    }

    // Number of seeding clusters
    const clusterCount = this.prng.nextInt(6, 16);

    for (let c = 0; c < clusterCount; c++) {
      const cx = this.prng.nextInt(Math.floor(w * 0.15), Math.floor(w * 0.85));
      const cy = this.prng.nextInt(Math.floor(h * 0.15), Math.floor(h * 0.85));
      const radius = this.prng.nextInt(4, 14);
      const rSq = radius * radius;

      const minX = Math.max(0, cx - radius);
      const maxX = Math.min(w - 1, cx + radius);
      const minY = Math.max(0, cy - radius);
      const maxY = Math.min(h - 1, cy + radius);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dSq = dx * dx + dy * dy;
          if (dSq <= rSq) {
            const idx = y * w + x;
            const factor = Math.cos((Math.sqrt(dSq) / radius) * (Math.PI * 0.5));
            this.gridA[idx] = Math.max(0.0, 1.0 - factor * 0.9);
            this.gridB[idx] = Math.min(1.0, factor * 0.85);
          }
        }
      }
    }

    // Central disturbance ring
    const centerX = Math.floor(w * 0.5);
    const centerY = Math.floor(h * 0.5);
    const ringRadius = Math.floor(Math.min(w, h) * 0.12);
    const ringThickness = 3;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - ringRadius) < ringThickness) {
          const idx = y * w + x;
          this.gridA[idx] = 0.3;
          this.gridB[idx] = 0.7;
        }
      }
    }

    // Add slight stochastic salt noise to initiate immediate symmetry breaking
    for (let i = 0; i < size; i++) {
      const noise = this.prng.nextFloat(0.0, 0.02);
      this.gridB[i] = Math.min(1.0, this.gridB[i] + noise);
      this.gridA[i] = Math.max(0.0, this.gridA[i] - noise);
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
   * Constructs the TSL Display Material with 3D Normal-Mapped Surface Relief.
   */
  private buildTSLDisplayMaterial(): THREE.MeshBasicNodeMaterial {
    if (!this.simTexture) {
      throw new Error('Simulation DataTexture must be initialized before building TSL material.');
    }

    const simTexNode = texture(this.simTexture);

    const displayColorNode = tslFn(() => {
      const uvCoord = uv();

      // Sample central chemical concentrations
      const centerSample = simTexNode.sample(uvCoord);
      const bCenter = centerSample.g;

      // Sample 4 orthogonal neighbors for spatial gradient normal extraction
      const rightSample = simTexNode.sample(uvCoord.add(vec2(this.uTexelSize.x, 0.0)));
      const leftSample = simTexNode.sample(uvCoord.sub(vec2(this.uTexelSize.x, 0.0)));
      const upSample = simTexNode.sample(uvCoord.add(vec2(0.0, this.uTexelSize.y)));
      const downSample = simTexNode.sample(uvCoord.sub(vec2(0.0, this.uTexelSize.y)));

      // 3D Surface Relief Normal Vector
      const dX = rightSample.g.sub(leftSample.g).mul(this.uReliefScale);
      const dY = upSample.g.sub(downSample.g).mul(this.uReliefScale);
      const normal = vec3(dX.negate(), dY.negate(), 1.0).normalize();

      // Lighting Vectors (Directional key light + View vector)
      const lightDir = vec3(0.5, 0.6, 0.8).normalize();
      const viewDir = vec3(0.0, 0.0, 1.0);
      const halfVec = lightDir.add(viewDir).normalize();

      // Blinn-Phong Shading Components
      const diffuse = clamp(normal.dot(lightDir), 0.0, 1.0);
      const specular = clamp(normal.dot(halfVec), 0.0, 1.0).pow(28.0).mul(0.65);

      // Curatorial 4-Tone Color Palette Ramp Mapping
      const t0 = clamp(bCenter.mul(3.5), 0.0, 1.0);
      const t1 = clamp(bCenter.sub(0.18).mul(3.5), 0.0, 1.0);
      const t2 = clamp(bCenter.sub(0.45).mul(3.5), 0.0, 1.0);
      const t3 = clamp(bCenter.sub(0.70).mul(4.0), 0.0, 1.0);

      const col0 = mix(this.uColorVoid, this.uColorBase, t0);
      const col1 = mix(col0, this.uColorPrimary, t1);
      const col2 = mix(col1, this.uColorAccent, t2);
      const col3 = mix(col2, this.uColorCrest, t3);

      // Modulate with ambient (0.28) + diffuse (0.72) + starlight specular crest
      const litSurface = col3.mul(float(0.28).add(diffuse.mul(0.72))).add(this.uColorCrest.mul(specular));

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
    const palette = RD_PALETTES[this.params.colorPalette] || RD_PALETTES['obsidian-coral'];

    // Update TSL uniforms
    this.uColorVoid.value.setRGB(...palette.voidColor);
    this.uColorBase.value.setRGB(...palette.baseColor);
    this.uColorPrimary.value.setRGB(...palette.primaryColor);
    this.uColorAccent.value.setRGB(...palette.accentColor);
    this.uColorCrest.value.setRGB(...palette.crestColor);

    const vR = palette.rgbVoid[0], vG = palette.rgbVoid[1], vB = palette.rgbVoid[2];
    const bR = palette.rgbBase[0], bG = palette.rgbBase[1], bB = palette.rgbBase[2];
    const pR = palette.rgbPrimary[0], pG = palette.rgbPrimary[1], pB = palette.rgbPrimary[2];
    const aR = palette.rgbAccent[0], aG = palette.rgbAccent[1], aB = palette.rgbAccent[2];
    const cR = palette.rgbCrest[0], cG = palette.rgbCrest[1], cB = palette.rgbCrest[2];

    for (let i = 0; i < 256; i++) {
      const t = i / 255.0;
      let r: number, g: number, b: number;

      if (t < 0.20) {
        const u = t / 0.20;
        r = vR + (bR - vR) * u;
        g = vG + (bG - vG) * u;
        b = vB + (bB - vB) * u;
      } else if (t < 0.50) {
        const u = (t - 0.20) / 0.30;
        r = bR + (pR - bR) * u;
        g = bG + (pG - bG) * u;
        b = bB + (pB - bB) * u;
      } else if (t < 0.78) {
        const u = (t - 0.50) / 0.28;
        r = pR + (aR - pR) * u;
        g = pG + (aG - pG) * u;
        b = pB + (aB - pB) * u;
      } else {
        const u = (t - 0.78) / 0.22;
        r = aR + (cR - aR) * u;
        g = aG + (cG - aG) * u;
        b = aB + (cB - aB) * u;
      }

      const cr = Math.min(255, Math.max(0, Math.round(r)));
      const cg = Math.min(255, Math.max(0, Math.round(g)));
      const cb = Math.min(255, Math.max(0, Math.round(b)));

      // Little-endian ABGR: (A << 24) | (B << 16) | (G << 8) | R
      this.colorLutABGR[i] = (255 << 24) | (cb << 16) | (cg << 8) | cr;
    }
  }

  /**
   * Synchronizes simulation concentrations into flat Float32Array RGBA buffer.
   */
  private updateRGBABuffer(): void {
    const size = this.simWidth * this.simHeight;
    for (let i = 0; i < size; i++) {
      const offset = i * 4;
      this.rgbaBuffer[offset] = this.gridA[i];
      this.rgbaBuffer[offset + 1] = this.gridB[i];
      this.rgbaBuffer[offset + 2] = 0.0;
      this.rgbaBuffer[offset + 3] = 1.0;
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

    // Apply chemical injection from cursor interaction
    this.applyPointerInteraction();

    // Execute Gray-Scott reaction-diffusion substeps with accumulator for strict frame-rate independence
    this.stepAccumulator += dt * this.params.simSpeed * 60.0;
    const substeps = Math.min(24, Math.floor(this.stepAccumulator));
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
   * Performs one numerical integration substep of the Gray-Scott equations.
   */
  private stepSimulation(): void {
    const w = this.simWidth;
    const h = this.simHeight;
    const F = this.params.feedRate;
    const k = this.params.killRate;
    const Du = this.params.diffuseU;
    const Dv = this.params.diffuseV;
    const dt = 1.0;

    const a = this.gridA;
    const b = this.gridB;
    const nA = this.nextA;
    const nB = this.nextB;

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
        const valA = a[idx];
        const valB = b[idx];

        // 9-Point Isotropic Laplacian Stencil
        // Center weight: -1.0, Orthogonal weights: 0.2, Diagonal weights: 0.05
        const lapA =
          0.2 * (a[rowC + xL] + a[rowC + xR] + a[rowU + x] + a[rowD + x]) +
          0.05 * (a[rowU + xL] + a[rowU + xR] + a[rowD + xL] + a[rowD + xR]) -
          valA;

        const lapB =
          0.2 * (b[rowC + xL] + b[rowC + xR] + b[rowU + x] + b[rowD + x]) +
          0.05 * (b[rowU + xL] + b[rowU + xR] + b[rowD + xL] + b[rowD + xR]) -
          valB;

        // Gray-Scott Kinetics
        const reaction = valA * valB * valB;
        const deltaA = Du * lapA - reaction + F * (1.0 - valA);
        const deltaB = Dv * lapB + reaction - (F + k) * valB;

        // Clamped forward integration
        let newA = valA + deltaA * dt;
        let newB = valB + deltaB * dt;

        if (newA < 0.0) newA = 0.0;
        else if (newA > 1.0) newA = 1.0;

        if (newB < 0.0) newB = 0.0;
        else if (newB > 1.0) newB = 1.0;

        nA[idx] = newA;
        nB[idx] = newB;
      }
    }

    // Ping-pong buffer swap
    this.gridA = nA;
    this.gridB = nB;
    this.nextA = a;
    this.nextB = b;
  }

  /**
   * Applies interactive chemical injection painting on cursor interaction.
   */
  private applyPointerInteraction(): void {
    if (!this.isPointerDown || this.pointerX < 0 || this.pointerY < 0) {
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      return;
    }

    const w = this.simWidth;
    const h = this.simHeight;

    const currX = this.pointerX * w;
    const currY = this.pointerY * h;
    const prevX = (this.prevPointerX >= 0 ? this.prevPointerX : this.pointerX) * w;
    const prevY = (this.prevPointerY >= 0 ? this.prevPointerY : this.pointerY) * h;

    const dist = Math.hypot(currX - prevX, currY - prevY);
    const steps = Math.max(1, Math.ceil(dist / 3.0));

    const radius = Math.max(4, Math.round(this.params.brushRadius * (w / 800)));
    const rSq = radius * radius;
    const strength = this.params.brushIntensity;

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
            const factor = (1.0 - Math.sqrt(dSq) / radius) * strength;
            const idx = row + x;
            this.gridB[idx] = Math.min(1.0, this.gridB[idx] + factor);
            this.gridA[idx] = Math.max(0.0, this.gridA[idx] - factor * 0.7);
          }
        }
      }
    }

    this.prevPointerX = this.pointerX;
    this.prevPointerY = this.pointerY;
  }

  /**
   * Renders the Canvas2D fallback with normal-mapped 3D surface relief.
   */
  private renderCanvas2D(): void {
    if (!this.ctx2d || !this.fallbackImageBuf32 || !this.fallbackImageData || !this.canvas) return;

    const w = this.simWidth;
    const h = this.simHeight;
    const b = this.gridB;
    const lut = this.colorLutABGR;
    const buf = this.fallbackImageBuf32;
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
        const valB = b[idx];

        // 3D Surface Relief Normal
        const dX = (b[row + xR] - b[row + xL]) * relief;
        const dY = (b[rowD + x] - b[rowU + x]) * relief;
        const nLen = Math.sqrt(dX * dX + dY * dY + 1.0);
        const nx = -dX / nLen;
        const ny = -dY / nLen;
        const nz = 1.0 / nLen;

        const diff = Math.max(0.0, nx * lx + ny * ly + nz * lz);
        const lutIdx = Math.min(255, Math.max(0, Math.floor(valB * 255.0)));
        const basePixel = lut[lutIdx];

        // Extract RGBA channels
        const pr = basePixel & 0xFF;
        const pg = (basePixel >> 8) & 0xFF;
        const pb = (basePixel >> 16) & 0xFF;

        const litFactor = 0.35 + 0.65 * diff;
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
    this.params.feedRate = dampParameter(this.params.feedRate, this.targetParams.feedRate, lambda, dt);
    this.params.killRate = dampParameter(this.params.killRate, this.targetParams.killRate, lambda, dt);
    this.params.diffuseU = dampParameter(this.params.diffuseU, this.targetParams.diffuseU, lambda, dt);
    this.params.diffuseV = dampParameter(this.params.diffuseV, this.targetParams.diffuseV, lambda, dt);
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
      const presetDef = GRAY_SCOTT_PRESETS[params.preset as ReactionDiffusionPreset];
      if (presetDef) {
        this.targetParams.preset = params.preset as ReactionDiffusionPreset;
        this.targetParams.feedRate = presetDef.feedRate;
        this.targetParams.killRate = presetDef.killRate;
        this.targetParams.diffuseU = presetDef.diffuseU;
        this.targetParams.diffuseV = presetDef.diffuseV;
      }
    }

    if (params.feedRate !== undefined) this.targetParams.feedRate = Number(params.feedRate);
    if (params.killRate !== undefined) this.targetParams.killRate = Number(params.killRate);
    if (params.diffuseU !== undefined) this.targetParams.diffuseU = Number(params.diffuseU);
    if (params.diffuseV !== undefined) this.targetParams.diffuseV = Number(params.diffuseV);
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
      this.seedChemicalField();
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
    const b = this.gridB;
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
        const valB = b[idx];

        const dX = (b[row + xR] - b[row + xL]) * relief;
        const dY = (b[rowD + x] - b[rowU + x]) * relief;
        const nLen = Math.sqrt(dX * dX + dY * dY + 1.0);
        const nx = -dX / nLen;
        const ny = -dY / nLen;
        const nz = 1.0 / nLen;

        const diff = Math.max(0.0, nx * lx + ny * ly + nz * lz);
        const lutIdx = Math.min(255, Math.max(0, Math.floor(valB * 255.0)));
        const basePixel = lut[lutIdx];

        const pr = basePixel & 0xFF;
        const pg = (basePixel >> 8) & 0xFF;
        const pb = (basePixel >> 16) & 0xFF;

        const litFactor = 0.35 + 0.65 * diff;
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

export const room: RoomInstance = new ReactionDiffusionRoom();
export default room;
