/**
 * Room 05: Particle Life (Multi-Species Attraction Matrix)
 * Curatorial Category: Artificial Life
 * Math Model: Asymmetric Multi-Species Interaction Matrix & Toroidal Continuous Physics
 * Optimization: Three.js WebGPU / TSL Point Rendering with High-Performance Canvas2D Spatial Grid Fallback
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - 4 to 8 distinct biological particle species interacting via continuous asymmetric force curves
 * - 6 Curated Matrix Presets: Symbiosis, Predators, Mitosis, Swarm, Chaos, and PRNG-Random
 * - Continuous force curve with universal short-range repulsion core (β) and species-specific mid-range attraction/repulsion
 * - Smooth frame-rate independent parameter & matrix interpolation
 * - Interactive pointer gravity well, swirling vortex, and velocity shockwaves
 * - Dual execution architecture: Three.js WebGPU/TSL pipeline with high-performance Canvas2D / O(N) spatial grid fallback
 * - 5 Curatorial Spectral Palettes (Spectral Aurora, Cyber Neon, Solar Flame, Deep Abyss, Obsidian Mono)
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three/webgpu';
import {
  vec4,
  float,
  uv,
  length,
  clamp,
  tslFn,
  attribute,
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

export type ParticleLifePreset =
  | 'symbiosis'
  | 'predators'
  | 'mitosis'
  | 'swarm'
  | 'chaos'
  | 'random';

export interface ParticleLifeParams {
  seed: string;
  preset: ParticleLifePreset;
  particleCount: number;
  speciesCount: number;
  interactionRadius: number;
  friction: number;
  forceMultiplier: number;
  repulsionZone: number;
  trailDecay: number;
  colorPalette: 'spectral-aurora' | 'cyber-neon' | 'solar-flame' | 'deep-abyss' | 'obsidian-mono';
}

export const DEFAULT_PARTICLE_LIFE_PARAMS: ParticleLifeParams = {
  seed: '#FFB800',
  preset: 'symbiosis',
  particleCount: 50000,
  speciesCount: 6,
  interactionRadius: 80.0,
  friction: 0.05,
  forceMultiplier: 1.0,
  repulsionZone: 0.3,
  trailDecay: 0.15,
  colorPalette: 'spectral-aurora',
};

const MAX_PARTICLES_CAPACITY = 100000;

export interface SpeciesColor {
  hex: string;
  rgb: [number, number, number]; // 0.0 - 1.0
  rgb255: [number, number, number]; // 0 - 255
}

export interface ParticleLifePalette {
  name: string;
  colors: SpeciesColor[];
}

export const PARTICLE_LIFE_PALETTES: Record<string, ParticleLifePalette> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    colors: [
      { hex: '#00F0FF', rgb: [0.0, 0.94, 1.0], rgb255: [0, 240, 255] },     // Cyan
      { hex: '#FFB800', rgb: [1.0, 0.72, 0.0], rgb255: [255, 184, 0] },     // Solar Amber
      { hex: '#00FF9D', rgb: [0.0, 1.0, 0.62], rgb255: [0, 255, 157] },     // Phosphor Mint
      { hex: '#A855F7', rgb: [0.66, 0.33, 0.97], rgb255: [168, 85, 247] },  // Royal Violet
      { hex: '#FF3366', rgb: [1.0, 0.20, 0.40], rgb255: [255, 51, 102] },   // Laser Crimson
      { hex: '#38BDF8', rgb: [0.22, 0.74, 0.97], rgb255: [56, 189, 248] },  // Sky Blue
      { hex: '#F1F5F9', rgb: [0.94, 0.96, 0.98], rgb255: [241, 245, 249] },  // Starlight Pearl
      { hex: '#FF7A00', rgb: [1.0, 0.48, 0.0], rgb255: [255, 122, 0] },     // Radiant Flame
    ],
  },
  'cyber-neon': {
    name: 'Cyber Neon',
    colors: [
      { hex: '#00F5D4', rgb: [0.0, 0.96, 0.83], rgb255: [0, 245, 212] },    // Electric Teal
      { hex: '#F72585', rgb: [0.97, 0.15, 0.52], rgb255: [247, 37, 133] },   // Neon Pink
      { hex: '#7209B7', rgb: [0.45, 0.04, 0.72], rgb255: [114, 9, 183] },   // Vivid Grape
      { hex: '#3A0CA3', rgb: [0.23, 0.05, 0.64], rgb255: [58, 12, 163] },   // Cobalt
      { hex: '#4CC9F0', rgb: [0.30, 0.79, 0.94], rgb255: [76, 201, 240] },  // Electric Blue
      { hex: '#70E000', rgb: [0.44, 0.88, 0.0], rgb255: [112, 224, 0] },    // Lime Burst
      { hex: '#FFDD00', rgb: [1.0, 0.87, 0.0], rgb255: [255, 221, 0] },     // Lemon Glow
      { hex: '#FFFFFF', rgb: [1.0, 1.0, 1.0], rgb255: [255, 255, 255] },    // Pure White
    ],
  },
  'solar-flame': {
    name: 'Solar Flame',
    colors: [
      { hex: '#FFF9E6', rgb: [1.0, 0.98, 0.90], rgb255: [255, 249, 230] },  // Solar White
      { hex: '#FFD000', rgb: [1.0, 0.82, 0.0], rgb255: [255, 208, 0] },     // Gold Flame
      { hex: '#FF9100', rgb: [1.0, 0.57, 0.0], rgb255: [255, 145, 0] },     // Amber Torch
      { hex: '#FF3D00', rgb: [1.0, 0.24, 0.0], rgb255: [255, 61, 0] },      // Magma Flare
      { hex: '#D50000', rgb: [0.84, 0.0, 0.0], rgb255: [213, 0, 0] },       // Ruby Ember
      { hex: '#FF6E40', rgb: [1.0, 0.43, 0.25], rgb255: [255, 110, 64] },   // Radiant Coral
      { hex: '#FFFF00', rgb: [1.0, 1.0, 0.0], rgb255: [255, 255, 0] },      // Corona Yellow
      { hex: '#94A3B8', rgb: [0.58, 0.64, 0.72], rgb255: [148, 163, 184] },  // Obsidian Ash
    ],
  },
  'deep-abyss': {
    name: 'Deep Abyss',
    colors: [
      { hex: '#00F5D4', rgb: [0.0, 0.96, 0.83], rgb255: [0, 245, 212] },    // Seafoam Aqua
      { hex: '#00BBF9', rgb: [0.0, 0.73, 0.98], rgb255: [0, 187, 249] },    // Deep Cyan
      { hex: '#4361EE', rgb: [0.26, 0.38, 0.93], rgb255: [67, 97, 238] },   // Abyssal Indigo
      { hex: '#B5179E', rgb: [0.71, 0.09, 0.62], rgb255: [181, 23, 158] },  // Luminescent Violet
      { hex: '#00E676', rgb: [0.0, 0.90, 0.46], rgb255: [0, 230, 118] },    // Phosphor Emerald
      { hex: '#FF5722', rgb: [1.0, 0.34, 0.13], rgb255: [255, 87, 34] },    // Coral Reef
      { hex: '#1D4ED8', rgb: [0.11, 0.31, 0.85], rgb255: [29, 78, 216] },   // Marine Cobalt
      { hex: '#E0F2FE', rgb: [0.88, 0.95, 1.0], rgb255: [224, 242, 254] },  // Ghost White
    ],
  },
  'obsidian-mono': {
    name: 'Obsidian Mono',
    colors: [
      { hex: '#FFFFFF', rgb: [1.0, 1.0, 1.0], rgb255: [255, 255, 255] },    // Starlight Crest
      { hex: '#E2E8F0', rgb: [0.89, 0.91, 0.94], rgb255: [226, 232, 240] },  // Silver Platinum
      { hex: '#CBD5E1', rgb: [0.80, 0.84, 0.88], rgb255: [203, 213, 225] },  // Cool Grey
      { hex: '#94A3B8', rgb: [0.58, 0.64, 0.72], rgb255: [148, 163, 184] },  // Slate Grey
      { hex: '#64748B', rgb: [0.39, 0.45, 0.55], rgb255: [100, 116, 139] },  // Charcoal Accent
      { hex: '#475569', rgb: [0.28, 0.33, 0.41], rgb255: [71, 85, 105] },   // Deep Steel
      { hex: '#38BDF8', rgb: [0.22, 0.74, 0.97], rgb255: [56, 189, 248] },  // Cyan Tint
      { hex: '#00F0FF', rgb: [0.0, 0.94, 1.0], rgb255: [0, 240, 255] },     // Cyan Beacon
    ],
  },
};

/**
 * Generates an 8x8 flattened interaction rule matrix for a given preset and species count.
 */
export function generatePresetMatrix(
  preset: ParticleLifePreset,
  speciesCount: number,
  prng: PRNG
): Float32Array {
  const m = new Float32Array(64); // 8x8 matrix flattened
  const K = Math.max(Math.min(speciesCount, 8), 3);

  switch (preset) {
    case 'symbiosis':
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i >= K || j >= K) {
            m[i * 8 + j] = 0;
            continue;
          }
          if (i === j) {
            m[i * 8 + j] = 0.45; // Like species form coherent bodies
          } else if ((i + 1) % K === j) {
            m[i * 8 + j] = 0.85; // Forward chase
          } else if ((j + 1) % K === i) {
            m[i * 8 + j] = 0.35; // Mutual backward cohesion
          } else if ((i + Math.floor(K / 2)) % K === j) {
            m[i * 8 + j] = -0.65; // Opposite species repulsion
          } else {
            m[i * 8 + j] = -0.15;
          }
        }
      }
      break;

    case 'predators':
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i >= K || j >= K) {
            m[i * 8 + j] = 0;
            continue;
          }
          if (i === j) {
            m[i * 8 + j] = 0.15;
          } else if ((i + 1) % K === j) {
            m[i * 8 + j] = 0.95; // Species i hunts species i+1
          } else if ((j + 1) % K === i) {
            m[i * 8 + j] = -0.90; // Species j flees from species i
          } else if ((i + 2) % K === j) {
            m[i * 8 + j] = 0.30;
          } else if ((j + 2) % K === i) {
            m[i * 8 + j] = -0.35;
          } else {
            m[i * 8 + j] = -0.20;
          }
        }
      }
      break;

    case 'mitosis':
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i >= K || j >= K) {
            m[i * 8 + j] = 0;
            continue;
          }
          if (i === j) {
            m[i * 8 + j] = 0.85; // High intra-species self-cohesion
          } else if ((i + 1) % K === j) {
            m[i * 8 + j] = 0.30; // Subtle catalyst
          } else if ((j + 1) % K === i) {
            m[i * 8 + j] = -0.20;
          } else {
            m[i * 8 + j] = -0.60; // Strong inter-species repulsion -> distinct dividing cell boundaries
          }
        }
      }
      break;

    case 'swarm':
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i >= K || j >= K) {
            m[i * 8 + j] = 0;
            continue;
          }
          if (i === j) {
            m[i * 8 + j] = 0.70;
          } else if ((i + 1) % K === j || (i - 1 + K) % K === j) {
            m[i * 8 + j] = 0.50; // Neighboring species cohesion
          } else {
            m[i * 8 + j] = -0.70; // Outer species repulsion
          }
        }
      }
      break;

    case 'chaos':
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i >= K || j >= K) {
            m[i * 8 + j] = 0;
            continue;
          }
          const sign = (i * 3 + j * 7 + 1) % 2 === 0 ? 1 : -1;
          const mag = 0.3 + ((i * 11 + j * 13) % 7) * 0.1;
          m[i * 8 + j] = sign * Math.min(mag, 0.95);
        }
      }
      break;

    case 'random':
    default:
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (i >= K || j >= K) {
            m[i * 8 + j] = 0;
          } else {
            m[i * 8 + j] = prng.nextFloat(-1.0, 1.0);
          }
        }
      }
      break;
  }

  return m;
}

export class ParticleLifeRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private prng: PRNG = createPRNG('#FFB800');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private isMounted = false;
  private prefersReducedMotion = false;

  // Active Parameters
  private params: ParticleLifeParams = { ...DEFAULT_PARTICLE_LIFE_PARAMS };

  // Target Parameters for Smooth Exponential Interpolation
  private targetParams: ParticleLifeParams = { ...DEFAULT_PARTICLE_LIFE_PARAMS };

  // 8x8 Interaction Matrices (Current & Target for Smooth Interpolation)
  private currentMatrix = new Float32Array(64);
  private targetMatrix = new Float32Array(64);

  // Execution Backend Mode ('webgpu' or 'canvas2d')
  private backendMode: 'webgpu' | 'canvas2d' = 'canvas2d';

  // Three.js WebGPU Resources
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private pointsMesh: THREE.Points | null = null;
  private pointsGeometry: THREE.BufferGeometry | null = null;
  private pointsMaterial: THREE.PointsNodeMaterial | null = null;
  private positionAttribute: THREE.BufferAttribute | null = null;
  private colorAttribute: THREE.BufferAttribute | null = null;
  private gpuPositions = new Float32Array(0);
  private gpuColors = new Float32Array(0);

  // Canvas 2D Fallback Resources
  private ctx2d: CanvasRenderingContext2D | null = null;

  // Particle Kinematic Buffers
  private activeParticleCount = 40000;
  private posX = new Float32Array(MAX_PARTICLES_CAPACITY);
  private posY = new Float32Array(MAX_PARTICLES_CAPACITY);
  private vx = new Float32Array(MAX_PARTICLES_CAPACITY);
  private vy = new Float32Array(MAX_PARTICLES_CAPACITY);
  private species = new Uint8Array(MAX_PARTICLES_CAPACITY);

  // Spatial Hashing Grid (Flat Linked List)
  private cellSize = 80;
  private gridCols = 0;
  private gridRows = 0;
  private gridHead = new Int32Array(0);
  private gridNext = new Int32Array(MAX_PARTICLES_CAPACITY);

  // Interactive Pointer State
  private pointerX = -1000;
  private pointerY = -1000;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;
  private isPointerDown = false;
  private isPointerInside = false;

  /**
   * Mounts the Particle Life simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_PARTICLE_LIFE_PARAMS.seed);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Detect GPU capabilities and select execution backend
    let gpuCaps = null;
    try {
      gpuCaps = await detectGPUCapabilities();
    } catch {
      gpuCaps = null;
    }

    const tryWebGPU = Boolean(
      gpuCaps &&
      (gpuCaps.hasWebGPU || gpuCaps.hasWebGL2) &&
      typeof window !== 'undefined' &&
      window.document
    );

    if (tryWebGPU) {
      try {
        await this.initWebGPUPipeline();
        this.backendMode = 'webgpu';
      } catch (err) {
        console.warn('WebGPU pipeline initialization fallback to Canvas2D:', err);
        this.initCanvas2DPipeline();
        this.backendMode = 'canvas2d';
      }
    } else {
      this.initCanvas2DPipeline();
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
   * Initializes the Three.js WebGPU / TSL render pipeline.
   */
  private async initWebGPUPipeline(): Promise<void> {
    if (!this.canvas) throw new Error('Canvas not found');

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
    this.camera = new THREE.OrthographicCamera(0, this.width, 0, this.height, -10, 10);

    this.updateGridDimensions();
    this.initParticles();

    // Allocate GPU Buffer Attributes
    this.gpuPositions = new Float32Array(MAX_PARTICLES_CAPACITY * 3);
    this.gpuColors = new Float32Array(MAX_PARTICLES_CAPACITY * 3);

    this.pointsGeometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(this.gpuPositions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.colorAttribute = new THREE.BufferAttribute(this.gpuColors, 3);
    this.colorAttribute.setUsage(THREE.DynamicDrawUsage);

    this.pointsGeometry.setAttribute('position', this.positionAttribute);
    this.pointsGeometry.setAttribute('color', this.colorAttribute);

    // Build TSL Glowing Starlight Point Shader
    this.pointsMaterial = this.buildTSLPointMaterial();

    this.pointsMesh = new THREE.Points(this.pointsGeometry, this.pointsMaterial);
    this.scene.add(this.pointsMesh);

    this.syncGPUColorBuffer();
  }

  /**
   * Builds the glowing starlight point shader in Three Shading Language (TSL).
   */
  private buildTSLPointMaterial(): THREE.PointsNodeMaterial {
    const pointColorNode = tslFn(() => {
      const colAttr = attribute('color');
      const pointUV = uv().sub(0.5);
      const dist = length(pointUV);

      // Soft circular Gaussian starlight falloff
      const alpha = clamp(float(1.0).sub(dist.mul(2.0)), 0.0, 1.0);
      const glow = alpha.mul(alpha);

      return vec4(colAttr, glow);
    });

    const mat = new THREE.PointsNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    (mat as any).size = 4.5;

    mat.colorNode = pointColorNode();
    return mat;
  }

  /**
   * Initializes the Canvas 2D fallback pipeline.
   */
  private initCanvas2DPipeline(): void {
    if (!this.canvas) return;

    this.ctx2d = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.updateGridDimensions();
    this.initParticles();
    this.clearCanvasVoid();
  }

  /**
   * Clears the entire canvas to solid Obsidian void (#090A0D).
   */
  private clearCanvasVoid(): void {
    if (!this.ctx2d) return;
    this.ctx2d.save();
    this.ctx2d.fillStyle = '#090A0D';
    this.ctx2d.fillRect(0, 0, this.width, this.height);
    this.ctx2d.restore();
  }

  /**
   * Sets up or updates the spatial hash grid dimensions based on interaction radius.
   */
  private updateGridDimensions(): void {
    this.cellSize = Math.max(this.params.interactionRadius, 40);
    this.gridCols = Math.max(Math.ceil(this.width / this.cellSize), 1);
    this.gridRows = Math.max(Math.ceil(this.height / this.cellSize), 1);
    const totalCells = this.gridCols * this.gridRows;

    if (this.gridHead.length !== totalCells) {
      this.gridHead = new Int32Array(totalCells);
    }
  }

  /**
   * Initializes particle positions, velocities, and species from PRNG seed.
   */
  private initParticles(): void {
    const requestedCount = Math.round(this.params.particleCount);
    // Scale count for CPU if in Canvas2D mode (e.g. 5,000–30,000) vs WebGPU (20,000–100,000)
    const maxDeviceCount = this.backendMode === 'canvas2d' ? 25000 : MAX_PARTICLES_CAPACITY;
    this.activeParticleCount = Math.min(Math.max(requestedCount, 1000), maxDeviceCount);

    const K = Math.max(Math.min(Math.round(this.params.speciesCount), 8), 3);
    const w = Math.max(this.width, 100);
    const h = Math.max(this.height, 100);
    const cx = w * 0.5;
    const cy = h * 0.5;

    for (let i = 0; i < MAX_PARTICLES_CAPACITY; i++) {
      if (i < this.activeParticleCount) {
        // Assign species uniformly or in clustered rings
        this.species[i] = i % K;

        const pattern = this.prng.nextInt(0, 3);
        if (pattern === 0) {
          // Circular concentric rings
          const angle = this.prng.nextFloat(0, Math.PI * 2);
          const r = Math.sqrt(this.prng.nextFloat(0, 1)) * Math.min(w, h) * 0.42;
          this.posX[i] = cx + Math.cos(angle) * r;
          this.posY[i] = cy + Math.sin(angle) * r;
        } else if (pattern === 1) {
          // Multi-spore colonies
          const colAngle = (this.species[i] / K) * Math.PI * 2;
          const colDist = Math.min(w, h) * 0.28;
          const colX = cx + Math.cos(colAngle) * colDist;
          const colY = cy + Math.sin(colAngle) * colDist;
          const offsetAngle = this.prng.nextFloat(0, Math.PI * 2);
          const offsetR = this.prng.nextFloat(2, 45);
          this.posX[i] = (colX + Math.cos(offsetAngle) * offsetR + w) % w;
          this.posY[i] = (colY + Math.sin(offsetAngle) * offsetR + h) % h;
        } else {
          // Uniform field scattering
          this.posX[i] = this.prng.nextFloat(0, w);
          this.posY[i] = this.prng.nextFloat(0, h);
        }

        this.vx[i] = this.prng.nextFloat(-0.5, 0.5);
        this.vy[i] = this.prng.nextFloat(-0.5, 0.5);
      } else {
        this.posX[i] = -1000;
        this.posY[i] = -1000;
        this.vx[i] = 0;
        this.vy[i] = 0;
        this.species[i] = 0;
      }
    }

    // Initialize Target Matrix
    this.targetMatrix.set(generatePresetMatrix(this.params.preset, this.params.speciesCount, this.prng));
    this.currentMatrix.set(this.targetMatrix);
  }

  /**
   * Synchronizes particle colors with current palette into the GPU vertex attribute buffer.
   */
  private syncGPUColorBuffer(): void {
    if (!this.colorAttribute || this.gpuColors.length === 0) return;

    const pal = PARTICLE_LIFE_PALETTES[this.params.colorPalette] || PARTICLE_LIFE_PALETTES['spectral-aurora'];
    const colors = pal.colors;
    const count = this.activeParticleCount;

    for (let i = 0; i < count; i++) {
      const sp = this.species[i] % 8;
      const rgb = colors[sp].rgb;
      const idx = i * 3;
      this.gpuColors[idx] = rgb[0];
      this.gpuColors[idx + 1] = rgb[1];
      this.gpuColors[idx + 2] = rgb[2];
    }

    this.colorAttribute.needsUpdate = true;
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevSeed = this.targetParams.seed;
    const prevPreset = this.targetParams.preset;
    const prevSpecies = this.targetParams.speciesCount;
    const prevPalette = this.targetParams.colorPalette;

    this.applyParams(newParams, false);

    let recomputeMatrix = false;

    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.initParticles();
      recomputeMatrix = true;
    }

    if (
      (newParams.preset && newParams.preset !== prevPreset) ||
      (newParams.speciesCount && newParams.speciesCount !== prevSpecies)
    ) {
      recomputeMatrix = true;
    }

    if (recomputeMatrix) {
      this.targetMatrix.set(
        generatePresetMatrix(
          this.targetParams.preset,
          this.targetParams.speciesCount,
          this.prng
        )
      );
    }

    if (newParams.colorPalette && newParams.colorPalette !== prevPalette) {
      this.syncGPUColorBuffer();
    }
  }

  /**
   * Updates canvas dimensions, DPR scaling, and spatial grid bounds.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.renderer && this.camera) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
      this.camera.right = this.width;
      this.camera.bottom = this.height;
      this.camera.updateProjectionMatrix();
    }

    if (this.canvas && this.ctx2d) {
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
    }

    this.updateGridDimensions();
  }

  /**
   * Receives normalized and pixel pointer events from the RoomViewer viewport controller.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.isPointerInside = false;
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.isPointerDown = false;
      return;
    }

    this.isPointerInside = true;
    this.pointerX = event.x;
    this.pointerY = event.y;
    this.isPointerDown = event.isDown;

    if (this.smoothedPointerX < -500) {
      this.smoothedPointerX = this.pointerX;
      this.smoothedPointerY = this.pointerY;
    }
  }

  /**
   * Returns whether the simulation is currently active and mounted.
   */
  public isSimulationMounted(): boolean {
    return this.isMounted;
  }

  /**
   * Merges and validates parameter changes.
   */
  private applyParams(incoming: Record<string, any>, isInitial: boolean): void {
    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      preset:
        incoming.preset && ['symbiosis', 'predators', 'mitosis', 'swarm', 'chaos', 'random'].includes(incoming.preset)
          ? incoming.preset
          : this.targetParams.preset,
      particleCount: Math.min(
        Math.max(Number(incoming.particleCount ?? this.targetParams.particleCount), 1000),
        MAX_PARTICLES_CAPACITY
      ),
      speciesCount: Math.min(Math.max(Math.round(Number(incoming.speciesCount ?? this.targetParams.speciesCount)), 3), 8),
      interactionRadius: Math.min(
        Math.max(Number(incoming.interactionRadius ?? this.targetParams.interactionRadius), 30.0),
        180.0
      ),
      friction: Math.min(Math.max(Number(incoming.friction ?? this.targetParams.friction), 0.01), 0.20),
      forceMultiplier: Math.min(Math.max(Number(incoming.forceMultiplier ?? this.targetParams.forceMultiplier), 0.2), 3.0),
      repulsionZone: Math.min(Math.max(Number(incoming.repulsionZone ?? this.targetParams.repulsionZone), 0.1), 0.6),
      trailDecay: Math.min(Math.max(Number(incoming.trailDecay ?? this.targetParams.trailDecay), 0.02), 0.40),
      colorPalette:
        incoming.colorPalette && PARTICLE_LIFE_PALETTES[incoming.colorPalette]
          ? incoming.colorPalette
          : this.targetParams.colorPalette,
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.targetMatrix.set(generatePresetMatrix(this.params.preset, this.params.speciesCount, this.prng));
      this.currentMatrix.set(this.targetMatrix);
    }
  }

  /**
   * Main 60 FPS animation loop with spatial grid neighbor physics.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smoothly lerp active simulation parameters
    const lambda = 5.0;
    this.params.particleCount = dampParameter(this.params.particleCount, this.targetParams.particleCount, lambda, dt);
    this.params.speciesCount = this.targetParams.speciesCount;
    this.params.interactionRadius = dampParameter(this.params.interactionRadius, this.targetParams.interactionRadius, lambda, dt);
    this.params.friction = dampParameter(this.params.friction, this.targetParams.friction, lambda, dt);
    this.params.forceMultiplier = dampParameter(this.params.forceMultiplier, this.targetParams.forceMultiplier, lambda, dt);
    this.params.repulsionZone = dampParameter(this.params.repulsionZone, this.targetParams.repulsionZone, lambda, dt);
    this.params.trailDecay = dampParameter(this.params.trailDecay, this.targetParams.trailDecay, lambda, dt);
    this.params.preset = this.targetParams.preset;
    this.params.colorPalette = this.targetParams.colorPalette;

    // Smoothly interpolate 8x8 interaction matrix
    const matrixLerpRate = 4.0;
    for (let i = 0; i < 64; i++) {
      this.currentMatrix[i] = dampParameter(this.currentMatrix[i], this.targetMatrix[i], matrixLerpRate, dt);
    }

    // Pointer coordinates smoothing
    if (this.pointerX > -500) {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 8.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 8.0, dt);
    } else {
      this.smoothedPointerX = -1000;
      this.smoothedPointerY = -1000;
    }

    const motionScale = this.prefersReducedMotion ? 0.35 : 1.0;
    const count = Math.min(Math.round(this.params.particleCount), this.activeParticleCount);

    // 1. Update Spatial Grid & Step Particle Physics
    this.updateParticlePhysics(count, dt * motionScale);

    // 2. Render Output Frame via WebGPU or Canvas2D
    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera && this.positionAttribute) {
      this.renderWebGPUFrame(count);
    } else if (this.ctx2d) {
      this.renderCanvas2DFrame(count);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Populates the spatial hash grid and executes inter-particle attraction/repulsion forces.
   */
  private updateParticlePhysics(count: number, dt: number): void {
    const w = this.width;
    const h = this.height;
    const halfW = w * 0.5;
    const halfH = h * 0.5;

    const rMax = this.params.interactionRadius;
    const rMaxSq = rMax * rMax;
    const invRMax = 1.0 / rMax;
    const beta = this.params.repulsionZone;
    const invOneMinusBeta = 1.0 / Math.max(1.0 - beta, 0.001);

    const forceMult = this.params.forceMultiplier;
    const friction = Math.min(Math.max(this.params.friction, 0.001), 0.5);
    const maxSpeed = 12.0;
    const maxSpeedSq = maxSpeed * maxSpeed;

    const matrix = this.currentMatrix;
    const dtScale = Math.min(dt * 60.0, 2.0);

    // Interactive pointer forces
    const px = this.smoothedPointerX;
    const py = this.smoothedPointerY;
    const hasPointer = px > -500 && py > -500 && this.isPointerInside;
    const pointerRadius = this.isPointerDown ? 260 : 160;
    const pointerRadiusSq = pointerRadius * pointerRadius;

    // 1. Clear spatial hash grid
    this.gridHead.fill(-1);

    // 2. Insert active particles into spatial grid
    const cSize = this.cellSize;
    const cols = this.gridCols;
    const rows = this.gridRows;

    for (let i = 0; i < count; i++) {
      let gx = Math.floor(this.posX[i] / cSize);
      let gy = Math.floor(this.posY[i] / cSize);

      if (gx < 0) gx = 0;
      else if (gx >= cols) gx = cols - 1;
      if (gy < 0) gy = 0;
      else if (gy >= rows) gy = rows - 1;

      const cellIdx = gy * cols + gx;
      this.gridNext[i] = this.gridHead[cellIdx];
      this.gridHead[cellIdx] = i;
    }

    // 3. Evaluate inter-particle forces for all particles
    for (let i = 0; i < count; i++) {
      const xi = this.posX[i];
      const yi = this.posY[i];
      const si = this.species[i];
      const sRow = (si % 8) * 8;

      let fx = 0;
      let fy = 0;

      const gx = Math.floor(xi / cSize);
      const gy = Math.floor(yi / cSize);

      // Traverse 3x3 neighboring cells with toroidal wrap
      for (let dy = -1; dy <= 1; dy++) {
        let ny = gy + dy;
        if (ny < 0) ny += rows;
        else if (ny >= rows) ny -= rows;

        const rowOffset = ny * cols;

        for (let dx = -1; dx <= 1; dx++) {
          let nx = gx + dx;
          if (nx < 0) nx += cols;
          else if (nx >= cols) nx -= cols;

          const cellIdx = rowOffset + nx;
          let j = this.gridHead[cellIdx];

          while (j !== -1) {
            if (j !== i) {
              let dX = this.posX[j] - xi;
              let dY = this.posY[j] - yi;

              // Toroidal periodic boundary shortest distance wrap
              if (dX > halfW) dX -= w;
              else if (dX < -halfW) dX += w;
              if (dY > halfH) dY -= h;
              else if (dY < -halfH) dY += h;

              const d2 = dX * dX + dY * dY;

              if (d2 < rMaxSq && d2 > 0.0001) {
                const d = Math.sqrt(d2);
                const r = d * invRMax; // Normalized distance in (0, 1)

                let force = 0;

                if (r < beta) {
                  // Universal short-range repulsive core to prevent particle collapse
                  force = (r / beta - 1.0) * 1.5;
                } else {
                  // Species-specific mid-range attraction/repulsion
                  const sj = this.species[j] % 8;
                  const M = matrix[sRow + sj];
                  const c = 1.0 - Math.abs(2.0 * r - 1.0 - beta) * invOneMinusBeta;
                  force = M * Math.max(c, 0.0);
                }

                const fOverD = force / d;
                fx += dX * fOverD;
                fy += dY * fOverD;
              }
            }
            j = this.gridNext[j];
          }
        }
      }

      // 4. Interactive pointer attractor / vortex dynamics
      if (hasPointer) {
        let pdx = px - xi;
        let pdy = py - yi;

        if (pdx > halfW) pdx -= w;
        else if (pdx < -halfW) pdx += w;
        if (pdy > halfH) pdy -= h;
        else if (pdy < -halfH) pdy += h;

        const pDistSq = pdx * pdx + pdy * pdy;

        if (pDistSq < pointerRadiusSq && pDistSq > 1.0) {
          const pDist = Math.sqrt(pDistSq);
          const factor = 1.0 - pDist / pointerRadius;

          if (this.isPointerDown) {
            // Click & Hold: High-gravity swirling vortex
            const pull = factor * 3.5;
            const tangentX = -pdy / pDist;
            const tangentY = pdx / pDist;
            fx += ((pdx / pDist) * 0.8 + tangentX * 1.1) * pull;
            fy += ((pdy / pDist) * 0.8 + tangentY * 1.1) * pull;
          } else {
            // Roaming Cursor: Gentle orbital attractor
            const pull = factor * 1.2;
            fx += (pdx / pDist) * pull;
            fy += (pdy / pDist) * pull;
          }
        }
      }

      // 5. Integrate velocity with friction damping
      const forceScale = forceMult * 18.0;
      let nvx = (this.vx[i] + fx * forceScale * dtScale * 0.016) * (1.0 - friction);
      let nvy = (this.vy[i] + fy * forceScale * dtScale * 0.016) * (1.0 - friction);

      // Clamp max velocity
      const speedSq = nvx * nvx + nvy * nvy;
      if (speedSq > maxSpeedSq) {
        const spd = Math.sqrt(speedSq);
        nvx = (nvx / spd) * maxSpeed;
        nvy = (nvy / spd) * maxSpeed;
      }

      this.vx[i] = nvx;
      this.vy[i] = nvy;

      // 6. Integrate position with toroidal boundary wrap
      let nx = xi + nvx * dtScale;
      let ny = yi + nvy * dtScale;

      if (nx < 0) nx += w;
      else if (nx >= w) nx -= w;
      if (ny < 0) ny += h;
      else if (ny >= h) ny -= h;

      this.posX[i] = nx;
      this.posY[i] = ny;
    }
  }

  /**
   * Renders the particle life universe via Three.js WebGPU / TSL points pipeline.
   */
  private renderWebGPUFrame(count: number): void {
    if (!this.renderer || !this.scene || !this.camera || !this.positionAttribute) return;

    const posData = this.gpuPositions;
    for (let i = 0; i < count; i++) {
      const idx3 = i * 3;
      posData[idx3] = this.posX[i];
      posData[idx3 + 1] = this.posY[i];
      posData[idx3 + 2] = 0;
    }

    this.positionAttribute.needsUpdate = true;
    if (this.pointsGeometry) {
      this.pointsGeometry.setDrawRange(0, count);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Renders the particle life universe via Canvas 2D batched species passes.
   */
  private renderCanvas2DFrame(count: number): void {
    if (!this.ctx2d) return;

    const ctx = this.ctx2d;
    const dpr = this.dpr;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Decaying luminous motion trails over Obsidian void (#090A0D)
    const trailDecay = Math.max(Math.min(this.params.trailDecay, 0.4), 0.02);
    ctx.fillStyle = `rgba(9, 10, 13, ${trailDecay})`;
    ctx.fillRect(0, 0, w, h);

    // 2. Batched rendering grouped by species
    const pal = PARTICLE_LIFE_PALETTES[this.params.colorPalette] || PARTICLE_LIFE_PALETTES['spectral-aurora'];
    const colors = pal.colors;
    const K = Math.max(Math.min(Math.round(this.params.speciesCount), 8), 3);

    for (let s = 0; s < K; s++) {
      const speciesColor = colors[s % 8];
      ctx.fillStyle = speciesColor.hex;
      ctx.beginPath();

      for (let i = 0; i < count; i++) {
        if (this.species[i] === s) {
          const px = this.posX[i];
          const py = this.posY[i];
          ctx.moveTo(px + 1.8, py);
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        }
      }

      ctx.fill();
    }

    // 3. Interactive Cursor Force Ring Indicator
    if (this.smoothedPointerX > -500 && this.isPointerInside) {
      const px = this.smoothedPointerX;
      const py = this.smoothedPointerY;
      const ringRadius = this.isPointerDown ? 28 : 18;
      const accentHex = colors[0].hex;

      ctx.beginPath();
      ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = this.isPointerDown ? '#00F0FF' : accentHex;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.isPointerDown ? '#00F0FF' : accentHex;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass.
   * Renders the particle life universe onto an off-screen canvas at target resolution (e.g. 4K/8K).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d', { alpha: false });
    if (!offCtx) return offCanvas;

    const scaleX = width / Math.max(this.width, 1);
    const scaleY = height / Math.max(this.height, 1);
    const count = Math.min(Math.round(this.params.particleCount), this.activeParticleCount);
    const pal = PARTICLE_LIFE_PALETTES[this.params.colorPalette] || PARTICLE_LIFE_PALETTES['spectral-aurora'];
    const colors = pal.colors;
    const K = Math.max(Math.min(Math.round(this.params.speciesCount), 8), 3);

    // Fill Obsidian void background
    offCtx.fillStyle = '#090A0D';
    offCtx.fillRect(0, 0, width, height);

    offCtx.save();
    offCtx.scale(scaleX, scaleY);

    // Render each species with subtle starlight glow
    for (let s = 0; s < K; s++) {
      const speciesColor = colors[s % 8];
      offCtx.fillStyle = speciesColor.hex;
      offCtx.shadowColor = speciesColor.hex;
      offCtx.shadowBlur = 4;
      offCtx.beginPath();

      for (let i = 0; i < count; i++) {
        if (this.species[i] === s) {
          const px = this.posX[i];
          const py = this.posY[i];
          offCtx.moveTo(px + 2.2, py);
          offCtx.arc(px, py, 2.2, 0, Math.PI * 2);
        }
      }

      offCtx.fill();
    }

    offCtx.restore();
    return offCanvas;
  }

  /**
   * Tears down animation loop, disposes Three.js geometry, materials, and WebGPU renderer context.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.pointsMesh) {
      this.pointsMesh.geometry.dispose();
      this.pointsMesh = null;
    }

    if (this.pointsGeometry) {
      this.pointsGeometry.dispose();
      this.pointsGeometry = null;
    }

    if (this.pointsMaterial) {
      this.pointsMaterial.dispose();
      this.pointsMaterial = null;
    }

    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch (err) {
        console.warn('Error disposing WebGPURenderer in ParticleLifeRoom:', err);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.ctx2d = null;
    this.positionAttribute = null;
    this.colorAttribute = null;
  }
}

/**
 * Convenience factory creating a ParticleLifeRoom instance.
 */
export function createRoom(): ParticleLifeRoom {
  return new ParticleLifeRoom();
}

export const room = new ParticleLifeRoom();
export default room;
