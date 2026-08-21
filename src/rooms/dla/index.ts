/**
 * Room 23: Diffusion-Limited Aggregation (DLA Dendritic Brownian Crystal Growth)
 * Curatorial Category: Morphogenesis & Landscape
 * Math Model: Witten-Sander Fractal Aggregation (D ≈ 1.71) & Brownian Walk Lattice
 * Compute Engine: Canvas 2D / Typed Array Aggregator
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D)
 * 
 * Features:
 * - High-speed Witten-Sander Brownian walk aggregation engine simulating 100–500 particle adhesions per frame
 * - O(1) Spatial Occupancy Grid & Bitmask for instant collision detection across tens of thousands of particles
 * - Adaptive leap Brownian motion: large steps through open space, fine micro-steps near fractal boundaries
 * - Multi-seed initial morphologies: single point, bottom frost line, concentric ring, quad colonies, and hexagram
 * - Interactive pointer seed planting: click/tap to nucleate competing crystal colonies that merge organically
 * - Dynamic electrostatic cursor field: attraction and repulsion probes for guiding diffusing walkers
 * - 6 Curatorial Spectral Palettes: Iridescent Obsidian, Frost Crystal, Solar Coral, Spectral Amethyst, Bioluminescent Abyss, Monochrome Lithic
 * - 4 Curatorial Color Mapping Modes: Branch Age, Radial Distance, Hierarchy Depth, and Seed Colony
 * - 4 Visual Rendering Styles: Dendritic Filaments, Glow Nodes, Luminous Spores, and Crystalline Mesh
 * - Pulsating bioluminescent tip beacons highlighting active crystallization fronts
 * - Web Audio API spectral reactivity: Bass aggregation bursts, Mid sticking modulation, and Treble tip glow shimmer
 * - Frame-rate independent exponential parameter damping
 * - Custom high-resolution offline snapshot export (2K/4K/8K stills)
 * - Complete resource disposal lifecycle
 */

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export type DLAPreset =
  | 'classic-dendrite'
  | 'coral-reef'
  | 'frost-spires'
  | 'concentric-nebula'
  | 'quad-colonies'
  | 'anisotropic-snow';

export type DLASeedType = 'point' | 'line' | 'ring' | 'quad' | 'hexagram';

export type DLARenderStyle =
  | 'dendritic-filaments'
  | 'glow-nodes'
  | 'luminous-spores'
  | 'crystalline-mesh';

export type DLAColorPaletteId =
  | 'iridescent-obsidian'
  | 'frost-crystal'
  | 'solar-coral'
  | 'spectral-amethyst'
  | 'bioluminescent-abyss'
  | 'monochrome-lithic';

export type DLAColorMode =
  | 'branch-age'
  | 'distance-radial'
  | 'branch-hierarchy'
  | 'seed-colony';

export type DLAPointerMode = 'plant-seed' | 'attract' | 'repel' | 'none';

export type DLADriftDirection = 'none' | 'up' | 'down' | 'inward' | 'outward' | 'vortex';

export interface DLAParams {
  seed: string;
  preset: DLAPreset;
  seedType: DLASeedType;
  seedRadius: number;
  maxParticles: number;
  particlesPerFrame: number;
  activeWalkers: number;
  stickingProbability: number;
  stepSize: number;
  anisotropy: number; // 0: isotropic, 4: tetragonal, 6: hexagonal snow
  driftDirection: DLADriftDirection;
  driftStrength: number;
  renderStyle: DLARenderStyle;
  branchThickness: number;
  particleRadius: number;
  glowIntensity: number;
  tipGlow: boolean;
  colorPalette: DLAColorPaletteId;
  colorMode: DLAColorMode;
  paletteCycleSpeed: number;
  pointerMode: DLAPointerMode;
  pointerRadius: number;
  pointerStrength: number;
  audioSource: 'synth' | 'mic' | 'none';
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
}

export const DEFAULT_DLA_PARAMS: DLAParams = {
  seed: '#00FF9D',
  preset: 'classic-dendrite',
  seedType: 'point',
  seedRadius: 40,
  maxParticles: 16000,
  particlesPerFrame: 100,
  activeWalkers: 700,
  stickingProbability: 0.9,
  stepSize: 1.5,
  anisotropy: 0,
  driftDirection: 'none',
  driftStrength: 0.0,
  renderStyle: 'dendritic-filaments',
  branchThickness: 1.4,
  particleRadius: 1.5,
  glowIntensity: 1.2,
  tipGlow: true,
  colorPalette: 'iridescent-obsidian',
  colorMode: 'branch-age',
  paletteCycleSpeed: 0.0,
  pointerMode: 'plant-seed',
  pointerRadius: 80,
  pointerStrength: 1.0,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.3,
  midReaction: 1.0,
  trebleReaction: 1.4,
};

export const DLA_PRESETS: Record<DLAPreset, Partial<DLAParams>> = {
  'classic-dendrite': {
    seedType: 'point',
    stickingProbability: 0.92,
    anisotropy: 0,
    driftDirection: 'none',
    driftStrength: 0.0,
    renderStyle: 'dendritic-filaments',
    colorPalette: 'iridescent-obsidian',
    colorMode: 'branch-age',
    branchThickness: 1.4,
    particleRadius: 1.5,
    glowIntensity: 1.2,
  },
  'coral-reef': {
    seedType: 'point',
    stickingProbability: 0.14,
    anisotropy: 0,
    driftDirection: 'none',
    driftStrength: 0.0,
    renderStyle: 'glow-nodes',
    colorPalette: 'solar-coral',
    colorMode: 'branch-hierarchy',
    branchThickness: 2.2,
    particleRadius: 2.5,
    glowIntensity: 1.4,
  },
  'frost-spires': {
    seedType: 'line',
    stickingProbability: 0.85,
    anisotropy: 0,
    driftDirection: 'up',
    driftStrength: 0.45,
    renderStyle: 'dendritic-filaments',
    colorPalette: 'frost-crystal',
    colorMode: 'branch-age',
    branchThickness: 1.3,
    particleRadius: 1.4,
    glowIntensity: 1.5,
  },
  'concentric-nebula': {
    seedType: 'ring',
    seedRadius: 90,
    stickingProbability: 0.88,
    anisotropy: 0,
    driftDirection: 'none',
    driftStrength: 0.0,
    renderStyle: 'luminous-spores',
    colorPalette: 'spectral-amethyst',
    colorMode: 'distance-radial',
    branchThickness: 1.2,
    particleRadius: 1.8,
    glowIntensity: 1.6,
  },
  'quad-colonies': {
    seedType: 'quad',
    seedRadius: 130,
    stickingProbability: 0.85,
    anisotropy: 0,
    driftDirection: 'none',
    driftStrength: 0.0,
    renderStyle: 'crystalline-mesh',
    colorPalette: 'bioluminescent-abyss',
    colorMode: 'seed-colony',
    branchThickness: 1.5,
    particleRadius: 1.6,
    glowIntensity: 1.3,
  },
  'anisotropic-snow': {
    seedType: 'point',
    stickingProbability: 0.98,
    anisotropy: 6,
    driftDirection: 'none',
    driftStrength: 0.0,
    renderStyle: 'dendritic-filaments',
    colorPalette: 'monochrome-lithic',
    colorMode: 'branch-age',
    branchThickness: 1.5,
    particleRadius: 1.5,
    glowIntensity: 1.4,
  },
};

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export const DLA_PALETTES: Record<DLAColorPaletteId, RGBColor[]> = {
  'iridescent-obsidian': [
    { r: 30, g: 41, b: 59 },    // Deep Slate #1E293B
    { r: 0, g: 180, b: 216 },   // Ocean Cyan #00B4D8
    { r: 0, g: 240, b: 255 },   // Electric Cyan #00F0FF
    { r: 0, g: 255, b: 157 },   // Phosphor Mint #00FF9D
    { r: 244, g: 246, b: 251 }, // Starlight White #F4F6FB
  ],
  'frost-crystal': [
    { r: 30, g: 27, b: 75 },    // Abyssal Indigo #1E1B4B
    { r: 29, g: 78, b: 216 },   // Royal Blue #1D4ED8
    { r: 56, g: 189, b: 248 },  // Glacial Cyan #38BDF8
    { r: 186, g: 230, b: 253 }, // Pale Ice #BAE6FD
    { r: 255, g: 255, b: 255 }, // Pure White #FFFFFF
  ],
  'solar-coral': [
    { r: 24, g: 24, b: 27 },    // Basalt #18181B
    { r: 245, g: 158, b: 11 },  // Molten Amber #F59E0B
    { r: 255, g: 184, b: 0 },   // Solar Gold #FFB800
    { r: 255, g: 51, b: 102 },  // Laser Crimson #FF3366
    { r: 254, g: 240, b: 138 }, // Pale Flare #FEF08A
  ],
  'spectral-amethyst': [
    { r: 46, g: 16, b: 101 },   // Deep Plum #2E1065
    { r: 168, g: 85, b: 247 },  // Vivid Violet #A855F7
    { r: 236, g: 72, b: 153 },  // Neon Orchid #EC4899
    { r: 192, g: 132, b: 252 }, // Soft Lavender #C084FC
    { r: 243, g: 232, b: 255 }, // Starlight Lavender #F3E8FF
  ],
  'bioluminescent-abyss': [
    { r: 3, g: 32, b: 48 },     // Oceanic Abyss #032030
    { r: 0, g: 140, b: 110 },   // Deep Emerald #008C6E
    { r: 0, g: 230, b: 118 },   // Algae Green #00E676
    { r: 0, g: 240, b: 255 },   // Electric Cyan #00F0FF
    { r: 167, g: 243, b: 208 }, // Pale Seafoam #A7F3D0
  ],
  'monochrome-lithic': [
    { r: 30, g: 41, b: 59 },    // Obsidian Slate #1E293B
    { r: 100, g: 116, b: 139 }, // Steel Grey #64748B
    { r: 148, g: 163, b: 184 }, // Polished Slate #94A3B8
    { r: 203, g: 213, b: 225 }, // Sterling Silver #CBD5E1
    { r: 255, g: 255, b: 255 }, // Pure White #FFFFFF
  ],
};

/**
 * Samples an RGB color from a palette given a normalized parameter t in [0, 1].
 */
export function sampleDLAColor(paletteId: DLAColorPaletteId, t: number): RGBColor {
  const stops = DLA_PALETTES[paletteId] || DLA_PALETTES['iridescent-obsidian'];
  const n = stops.length;
  if (n === 0) return { r: 255, g: 255, b: 255 };
  if (n === 1) return stops[0];

  const clampedT = Math.max(0, Math.min(1, t));
  const scaled = clampedT * (n - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  if (idx >= n - 1) {
    return stops[n - 1];
  }

  const c0 = stops[idx];
  const c1 = stops[idx + 1];

  return {
    r: Math.round(c0.r + (c1.r - c0.r) * frac),
    g: Math.round(c0.g + (c1.g - c0.g) * frac),
    b: Math.round(c0.b + (c1.b - c0.b) * frac),
  };
}

/**
 * Evaluates DLA Color with optional cyclic offset and alpha channel.
 */
export function getDLAPaletteColor(
  paletteId: DLAColorPaletteId,
  t: number,
  cycleOffset = 0,
  alpha = 1.0
): string {
  const effectiveT = (t + cycleOffset) % 1.0;
  const c = sampleDLAColor(paletteId, effectiveT < 0 ? effectiveT + 1.0 : effectiveT);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha.toFixed(3)})`;
}

interface SeedPoint {
  x: number;
  y: number;
  id: number;
  rMax: number;
}

const MAX_PARTICLE_CAPACITY = 64000;
const MAX_WALKER_COUNT = 2000;

export class DLARoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private prng: PRNG = createPRNG('#00FF9D');
  private rafId: number | null = null;
  private audioContext: any = null;

  public params: DLAParams = { ...DEFAULT_DLA_PARAMS };
  private smoothedParams: DLAParams = { ...DEFAULT_DLA_PARAMS };

  // Viewport & Grid Dimensions
  private width = 800;
  private height = 800;
  private gridWidth = 800;
  private gridHeight = 800;

  // Spatial Occupancy Grid: 0 = empty, > 0 = particleIndex + 1
  private occupancyGrid: Int32Array = new Int32Array(0);

  // Cluster Particles Typed Storage
  public clusterX = new Float32Array(MAX_PARTICLE_CAPACITY);
  public clusterY = new Float32Array(MAX_PARTICLE_CAPACITY);
  public clusterParent = new Int32Array(MAX_PARTICLE_CAPACITY);
  public clusterSeedId = new Int32Array(MAX_PARTICLE_CAPACITY);
  public clusterDepth = new Int32Array(MAX_PARTICLE_CAPACITY);
  public clusterAge = new Float32Array(MAX_PARTICLE_CAPACITY);
  public clusterDist = new Float32Array(MAX_PARTICLE_CAPACITY);
  public clusterCount = 0;

  // Active Brownian Walkers Typed Storage
  private walkerX = new Float32Array(MAX_WALKER_COUNT);
  private walkerY = new Float32Array(MAX_WALKER_COUNT);
  private walkerLife = new Int32Array(MAX_WALKER_COUNT);

  // Nucleation Seeds
  private seeds: SeedPoint[] = [];
  private globalRMax = 10;
  private maxObservedDepth = 1;
  private maxObservedDist = 1;

  // Interaction State
  private pointerX = -1000;
  private pointerY = -1000;
  private isPointerDown = false;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;

  // Animation Timing & Cycles
  private lastTime = 0;
  private timeSeconds = 0;
  private paletteCycle = 0;

  public mount(ctx: RoomContext): RoomCleanupFn {
    this.canvas = ctx.canvas;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_DLA_PARAMS.seed);
    this.audioContext = ctx.audio;

    if (ctx.params) {
      this.applyParams(ctx.params);
    }

    this.resize(this.canvas.width || 800, this.canvas.height || 800);
    this.resetSimulation();

    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => this.teardown();
  }

  public updateParams(newParams: Record<string, any>): void {
    const oldSeed = this.params.seed;
    const oldPreset = this.params.preset;
    const oldSeedType = this.params.seedType;
    const oldSeedRadius = this.params.seedRadius;

    this.applyParams(newParams);

    // Rebuild simulation if structural morphology parameters change
    if (
      (newParams.seed !== undefined && newParams.seed !== oldSeed) ||
      (newParams.preset !== undefined && newParams.preset !== oldPreset) ||
      (newParams.seedType !== undefined && newParams.seedType !== oldSeedType) ||
      (newParams.seedRadius !== undefined && Math.abs(newParams.seedRadius - oldSeedRadius) > 5)
    ) {
      this.prng = createPRNG(this.params.seed);
      this.resetSimulation();
    }
  }

  private applyParams(newParams: Record<string, any>): void {
    if (newParams.preset && newParams.preset !== this.params.preset) {
      const presetOverrides = DLA_PRESETS[newParams.preset as DLAPreset];
      if (presetOverrides) {
        Object.assign(this.params, presetOverrides);
      }
    }
    Object.assign(this.params, newParams);
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    // Grid sizing: 1:1 pixel coordinate space clamped to high-resolution bounds
    this.gridWidth = Math.floor(this.width);
    this.gridHeight = Math.floor(this.height);

    const totalCells = this.gridWidth * this.gridHeight;
    if (this.occupancyGrid.length !== totalCells) {
      this.occupancyGrid = new Int32Array(totalCells);
      this.resetSimulation();
    }
  }

  public onPointer(event: RoomPointerEvent): void {
    const rectX = event.x;
    const rectY = event.y;

    this.pointerX = rectX;
    this.pointerY = rectY;
    this.isPointerDown = event.isDown;

    if (event.type === 'down') {
      if (this.params.pointerMode === 'plant-seed') {
        this.plantSeedAt(rectX, rectY);
      }
    } else if (event.type === 'move' && this.isPointerDown) {
      if (this.params.pointerMode === 'plant-seed') {
        // Allow planting continuous seed ribbons if dragging far enough from last seed
        const lastSeed = this.seeds[this.seeds.length - 1];
        if (!lastSeed || Math.hypot(rectX - lastSeed.x, rectY - lastSeed.y) > 35) {
          this.plantSeedAt(rectX, rectY);
        }
      }
    } else if (event.type === 'leave') {
      this.pointerX = -1000;
      this.pointerY = -1000;
      this.isPointerDown = false;
    }
  }

  /**
   * Dynamically plants a new nucleation crystal seed at arbitrary screen coordinates.
   */
  public plantSeedAt(x: number, y: number): boolean {
    const gx = Math.floor(x);
    const gy = Math.floor(y);

    if (gx < 2 || gx >= this.gridWidth - 2 || gy < 2 || gy >= this.gridHeight - 2) {
      return false;
    }

    if (this.clusterCount >= this.params.maxParticles || this.clusterCount >= MAX_PARTICLE_CAPACITY) {
      return false;
    }

    const gridIdx = gy * this.gridWidth + gx;
    if (this.occupancyGrid[gridIdx] > 0) {
      return false;
    }

    const seedId = this.seeds.length;
    this.seeds.push({
      x: gx,
      y: gy,
      id: seedId,
      rMax: 6,
    });

    const idx = this.clusterCount;
    this.clusterX[idx] = gx;
    this.clusterY[idx] = gy;
    this.clusterParent[idx] = -1; // Seed has no parent
    this.clusterSeedId[idx] = seedId;
    this.clusterDepth[idx] = 0;
    this.clusterAge[idx] = idx;
    this.clusterDist[idx] = 0;

    this.occupancyGrid[gridIdx] = idx + 1;
    this.clusterCount++;

    return true;
  }

  /**
   * Resets the spatial grid, cluster particles, and seeds according to selected seedType.
   */
  public resetSimulation(): void {
    this.occupancyGrid.fill(0);
    this.clusterCount = 0;
    this.seeds = [];
    this.globalRMax = 10;
    this.maxObservedDepth = 1;
    this.maxObservedDist = 1;

    const cx = Math.floor(this.gridWidth * 0.5);
    const cy = Math.floor(this.gridHeight * 0.5);
    const r = Math.min(this.params.seedRadius, Math.min(cx, cy) * 0.7);

    switch (this.params.seedType) {
      case 'point': {
        this.plantSeedAt(cx, cy);
        break;
      }

      case 'line': {
        // Horizontal frost baseline across lower portion of grid
        const yLine = Math.floor(this.gridHeight * 0.88);
        const step = 8;
        for (let x = 20; x < this.gridWidth - 20; x += step) {
          this.plantSeedAt(x, yLine);
        }
        break;
      }

      case 'ring': {
        // Circumferential seed ring
        const count = Math.max(12, Math.floor((2 * Math.PI * r) / 18));
        for (let i = 0; i < count; i++) {
          const theta = (i / count) * Math.PI * 2;
          const sx = cx + Math.cos(theta) * r;
          const sy = cy + Math.sin(theta) * r;
          this.plantSeedAt(sx, sy);
        }
        break;
      }

      case 'quad': {
        // 4 symmetric cardinal colonies
        this.plantSeedAt(cx - r, cy);
        this.plantSeedAt(cx + r, cy);
        this.plantSeedAt(cx, cy - r);
        this.plantSeedAt(cx, cy + r);
        break;
      }

      case 'hexagram': {
        // 6 hexagonal snowflake nucleation seeds + central nucleus
        this.plantSeedAt(cx, cy);
        for (let i = 0; i < 6; i++) {
          const theta = (i / 6) * Math.PI * 2;
          const sx = cx + Math.cos(theta) * r;
          const sy = cy + Math.sin(theta) * r;
          this.plantSeedAt(sx, sy);
        }
        break;
      }
    }

    // Initialize Active Walkers
    const walkerCount = Math.min(this.params.activeWalkers, MAX_WALKER_COUNT);
    for (let i = 0; i < walkerCount; i++) {
      this.respawnWalker(i);
    }
  }

  /**
   * Respawns a Brownian walker onto a bounding circle around an active seed cluster.
   */
  private respawnWalker(i: number): void {
    if (this.seeds.length === 0) {
      this.walkerX[i] = this.gridWidth * 0.5;
      this.walkerY[i] = this.gridHeight * 0.5;
      this.walkerLife[i] = 1000;
      return;
    }

    // Pick a random seed colony to spawn near
    const seed = this.seeds[Math.floor(this.prng.next() * this.seeds.length)];
    const spawnRadius = Math.max(seed.rMax + 14, 20);

    const angle = this.prng.next() * Math.PI * 2;
    const wx = seed.x + Math.cos(angle) * spawnRadius;
    const wy = seed.y + Math.sin(angle) * spawnRadius;

    this.walkerX[i] = Math.max(2, Math.min(this.gridWidth - 3, wx));
    this.walkerY[i] = Math.max(2, Math.min(this.gridHeight - 3, wy));
    this.walkerLife[i] = 1200;
  }

  /**
   * Executes multi-step Brownian random walk aggregation.
   */
  public stepSimulation(targetAggregations: number, _dt: number): number {
    if (this.clusterCount >= this.params.maxParticles || this.clusterCount >= MAX_PARTICLE_CAPACITY) {
      return 0;
    }

    const gw = this.gridWidth;
    const gh = this.gridHeight;
    const grid = this.occupancyGrid;
    const walkerCount = Math.min(this.params.activeWalkers, MAX_WALKER_COUNT);
    const stickingProb = this.smoothedParams.stickingProbability;
    const baseStep = this.smoothedParams.stepSize;
    const anisotropy = this.smoothedParams.anisotropy;
    const driftDir = this.smoothedParams.driftDirection;
    const driftStr = this.smoothedParams.driftStrength;

    // Pointer dynamics
    const ptrMode = this.smoothedParams.pointerMode;
    const ptrRadius = this.smoothedParams.pointerRadius;
    const ptrRadiusSq = ptrRadius * ptrRadius;
    const ptrStrength = this.smoothedParams.pointerStrength;
    const hasPointer = this.smoothedPointerX > -500;

    let aggregatedThisFrame = 0;
    const maxStepsPerFrame = Math.min(targetAggregations * 35, 12000);

    for (let step = 0; step < maxStepsPerFrame; step++) {
      if (aggregatedThisFrame >= targetAggregations || this.clusterCount >= this.params.maxParticles) {
        break;
      }

      // Pick a walker
      const wIdx = step % walkerCount;
      let wx = this.walkerX[wIdx];
      let wy = this.walkerY[wIdx];

      this.walkerLife[wIdx]--;
      if (this.walkerLife[wIdx] <= 0) {
        this.respawnWalker(wIdx);
        continue;
      }

      // Find nearest seed for adaptive leap distance computation
      let minDistToSeed = Infinity;
      let nearestSeed = this.seeds[0];
      for (let s = 0; s < this.seeds.length; s++) {
        const sd = this.seeds[s];
        const dist = Math.hypot(wx - sd.x, wy - sd.y);
        if (dist < minDistToSeed) {
          minDistToSeed = dist;
          nearestSeed = sd;
        }
      }

      const distToClusterBoundary = minDistToSeed - nearestSeed.rMax;

      // 1. Adaptive Step Size: take large jumps when far from crystal cluster
      let currentStep = baseStep;
      if (distToClusterBoundary > 8) {
        // Fast adaptive Brownian jump
        currentStep = Math.min(distToClusterBoundary - 4, 22.0);
      }

      // 2. Brownian Direction & Anisotropy
      let angle = this.prng.next() * Math.PI * 2;

      if (anisotropy === 6) {
        // Hexagonal 6-fold crystal symmetry bias
        const axisAngle = Math.round(angle / (Math.PI / 3)) * (Math.PI / 3);
        angle = angle + (axisAngle - angle) * 0.6;
      } else if (anisotropy === 4) {
        // Tetragonal 4-fold crystal symmetry bias
        const axisAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
        angle = angle + (axisAngle - angle) * 0.6;
      }

      let dx = Math.cos(angle) * currentStep;
      let dy = Math.sin(angle) * currentStep;

      // 3. Directional Drift Bias
      if (driftStr > 0) {
        if (driftDir === 'up') {
          dy -= driftStr * currentStep * 0.8;
        } else if (driftDir === 'down') {
          dy += driftStr * currentStep * 0.8;
        } else if (driftDir === 'inward') {
          const ndx = (nearestSeed.x - wx) / (minDistToSeed || 1);
          const ndy = (nearestSeed.y - wy) / (minDistToSeed || 1);
          dx += ndx * driftStr * currentStep * 0.8;
          dy += ndy * driftStr * currentStep * 0.8;
        } else if (driftDir === 'outward') {
          const ndx = (wx - nearestSeed.x) / (minDistToSeed || 1);
          const ndy = (wy - nearestSeed.y) / (minDistToSeed || 1);
          dx += ndx * driftStr * currentStep * 0.8;
          dy += ndy * driftStr * currentStep * 0.8;
        } else if (driftDir === 'vortex') {
          const ndx = (wx - nearestSeed.x) / (minDistToSeed || 1);
          const ndy = (wy - nearestSeed.y) / (minDistToSeed || 1);
          dx += -ndy * driftStr * currentStep * 0.9;
          dy += ndx * driftStr * currentStep * 0.9;
        }
      }

      // 4. Cursor Electrostatic Field (Attract / Repel)
      if (hasPointer && (ptrMode === 'attract' || ptrMode === 'repel')) {
        const pdx = wx - this.smoothedPointerX;
        const pdy = wy - this.smoothedPointerY;
        const pDistSq = pdx * pdx + pdy * pdy;

        if (pDistSq < ptrRadiusSq && pDistSq > 1) {
          const pDist = Math.sqrt(pDistSq);
          const force = (1 - pDist / ptrRadius) * ptrStrength * currentStep * 1.5;
          const nx = pdx / pDist;
          const ny = pdy / pDist;

          if (ptrMode === 'repel') {
            dx += nx * force;
            dy += ny * force;
          } else {
            dx -= nx * force;
            dy -= ny * force;
          }
        }
      }

      wx += dx;
      wy += dy;

      // 5. Bounds & Kill Radius Check
      const killRadius = Math.max(nearestSeed.rMax * 2.3 + 30, 80);
      if (
        wx < 2 ||
        wx >= gw - 2 ||
        wy < 2 ||
        wy >= gh - 2 ||
        minDistToSeed > killRadius
      ) {
        this.respawnWalker(wIdx);
        continue;
      }

      this.walkerX[wIdx] = wx;
      this.walkerY[wIdx] = wy;

      // 6. Check 8-Neighborhood for Occupied Crystal Nodes
      const gx = Math.floor(wx);
      const gy = Math.floor(wy);

      let contactedParentIdx = -1;

      // 8-Connected Moore neighborhood lookup
      for (let oy = -1; oy <= 1; oy++) {
        const cy = gy + oy;
        const rowOffset = cy * gw;
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const cx = gx + ox;
          const occ = grid[rowOffset + cx];
          if (occ > 0) {
            contactedParentIdx = occ - 1;
            break;
          }
        }
        if (contactedParentIdx >= 0) break;
      }

      if (contactedParentIdx >= 0) {
        // Sticking Probability Test (Witten-Sander vs Eden Model)
        if (this.prng.next() <= stickingProb) {
          const newIdx = this.clusterCount;
          const seedId = this.clusterSeedId[contactedParentIdx];

          this.clusterX[newIdx] = gx;
          this.clusterY[newIdx] = gy;
          this.clusterParent[newIdx] = contactedParentIdx;
          this.clusterSeedId[newIdx] = seedId;
          this.clusterAge[newIdx] = newIdx;

          const depth = this.clusterDepth[contactedParentIdx] + 1;
          this.clusterDepth[newIdx] = depth;
          if (depth > this.maxObservedDepth) {
            this.maxObservedDepth = depth;
          }

          // Distance from nucleation seed
          const seed = this.seeds[seedId] || nearestSeed;
          const distToSeed = Math.hypot(gx - seed.x, gy - seed.y);
          this.clusterDist[newIdx] = distToSeed;
          if (distToSeed > this.maxObservedDist) {
            this.maxObservedDist = distToSeed;
          }

          // Update cluster radius bounds
          if (distToSeed + 2 > seed.rMax) {
            seed.rMax = distToSeed + 2;
          }
          if (distToSeed + 2 > this.globalRMax) {
            this.globalRMax = distToSeed + 2;
          }

          grid[gy * gw + gx] = newIdx + 1;
          this.clusterCount++;
          aggregatedThisFrame++;

          this.respawnWalker(wIdx);
        }
      }
    }

    return aggregatedThisFrame;
  }

  /**
   * Main animation and render frame loop.
   */
  private loop(currentTime: number): void {
    if (!this.ctx || !this.canvas) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;
    this.timeSeconds += dt;

    // Smooth parameter damping
    this.dampAllParams(dt);

    // Audio reactivity integration
    let audioBass = 0;
    let audioTreble = 0;

    if (this.audioContext && this.params.audioSource !== 'none') {
      try {
        const spectralData = this.audioContext.getSpectralData?.() || { bass: 0, mid: 0, treble: 0 };
        const sensitivity = this.params.audioSensitivity;
        audioBass = (spectralData.bass || 0) * sensitivity;
        audioTreble = (spectralData.treble || 0) * sensitivity;
      } catch {
        // Audio fallback
      }
    }

    // Pointer smoothing
    if (this.pointerX >= 0 && this.pointerY >= 0) {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 18.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 18.0, dt);
    } else {
      this.smoothedPointerX = -1000;
      this.smoothedPointerY = -1000;
    }

    // Palette cycling
    if (this.params.paletteCycleSpeed > 0) {
      this.paletteCycle = (this.paletteCycle + dt * this.params.paletteCycleSpeed * 0.25) % 1.0;
    }

    // Particle Aggregation Burst Step
    const effectiveAggregationRate = Math.floor(
      this.smoothedParams.particlesPerFrame * (1.0 + audioBass * this.smoothedParams.bassReaction * 1.5)
    );

    this.stepSimulation(effectiveAggregationRate, dt);

    // Render Canvas
    this.renderCanvas(this.ctx, this.width, this.height, audioTreble);

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Smoothly damps real-time parameters for fluid UX.
   */
  private dampAllParams(dt: number): void {
    const p = this.params;
    const sp = this.smoothedParams;

    sp.stickingProbability = dampParameter(sp.stickingProbability, p.stickingProbability, 8.0, dt);
    sp.particlesPerFrame = dampParameter(sp.particlesPerFrame, p.particlesPerFrame, 6.0, dt);
    sp.activeWalkers = dampParameter(sp.activeWalkers, p.activeWalkers, 6.0, dt);
    sp.stepSize = dampParameter(sp.stepSize, p.stepSize, 8.0, dt);
    sp.branchThickness = dampParameter(sp.branchThickness, p.branchThickness, 8.0, dt);
    sp.particleRadius = dampParameter(sp.particleRadius, p.particleRadius, 8.0, dt);
    sp.glowIntensity = dampParameter(sp.glowIntensity, p.glowIntensity, 8.0, dt);
    sp.pointerRadius = dampParameter(sp.pointerRadius, p.pointerRadius, 8.0, dt);
    sp.pointerStrength = dampParameter(sp.pointerStrength, p.pointerStrength, 8.0, dt);
    sp.driftStrength = dampParameter(sp.driftStrength, p.driftStrength, 6.0, dt);

    sp.renderStyle = p.renderStyle;
    sp.colorPalette = p.colorPalette;
    sp.colorMode = p.colorMode;
    sp.seedType = p.seedType;
    sp.anisotropy = p.anisotropy;
    sp.driftDirection = p.driftDirection;
    sp.pointerMode = p.pointerMode;
    sp.tipGlow = p.tipGlow;
  }

  /**
   * Renders the complete DLA crystal aggregation onto the target 2D context.
   */
  public renderCanvas(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    trebleBoost = 0
  ): void {
    // 1. Obsidian Archival Void Background
    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, w, h);

    const count = this.clusterCount;
    if (count === 0) return;

    const palette = this.smoothedParams.colorPalette;
    const mode = this.smoothedParams.colorMode;
    const style = this.smoothedParams.renderStyle;
    const thickness = this.smoothedParams.branchThickness;
    const particleRadius = this.smoothedParams.particleRadius;
    const glow = this.smoothedParams.glowIntensity * (1.0 + trebleBoost * this.smoothedParams.trebleReaction * 0.8);
    const cycle = this.paletteCycle;

    const maxAge = Math.max(count - 1, 1);
    const maxDepth = Math.max(this.maxObservedDepth, 1);
    const maxDist = Math.max(this.maxObservedDist, 1);

    // 2. Render Active Brownian Dust Vapour (Faint Atmospheric Walkers)
    const walkerCount = Math.min(this.params.activeWalkers, MAX_WALKER_COUNT);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
    for (let i = 0; i < walkerCount; i += 2) {
      const wx = this.walkerX[i];
      const wy = this.walkerY[i];
      ctx.fillRect(wx - 0.5, wy - 0.5, 1.2, 1.2);
    }

    // 3. Render Aggregate Crystal Structures
    if (style === 'dendritic-filaments' || style === 'crystalline-mesh') {
      // Group path segments by color buckets for batch rendering
      const NUM_BUCKETS = 16;
      const bucketPaths: Path2D[] = Array.from({ length: NUM_BUCKETS }, () => new Path2D());
      const meshPaths: Path2D = new Path2D();

      for (let i = 1; i < count; i++) {
        const px = this.clusterX[i];
        const py = this.clusterY[i];
        const parentIdx = this.clusterParent[i];
        if (parentIdx < 0) continue;

        const parentX = this.clusterX[parentIdx];
        const parentY = this.clusterY[parentIdx];

        // Color coordinate t in [0, 1]
        let t = 0;
        if (mode === 'branch-age') {
          t = i / maxAge;
        } else if (mode === 'branch-hierarchy') {
          t = this.clusterDepth[i] / maxDepth;
        } else if (mode === 'distance-radial') {
          t = this.clusterDist[i] / maxDist;
        } else if (mode === 'seed-colony') {
          t = ((this.clusterSeedId[i] * 0.23) % 1.0) + (i / maxAge) * 0.2;
        }

        const bucketIdx = Math.floor(((t + cycle) % 1.0 + 1.0) % 1.0 * NUM_BUCKETS) % NUM_BUCKETS;
        const path = bucketPaths[bucketIdx];

        path.moveTo(parentX, parentY);
        path.lineTo(px, py);

        // Crystalline cross-connections for mesh style
        if (style === 'crystalline-mesh' && i % 4 === 0) {
          meshPaths.moveTo(parentX, parentY);
          meshPaths.lineTo(px + (px - parentX) * 0.5, py + (py - parentY) * 0.5);
        }
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Glow Underlay Pass
      if (glow > 0.3) {
        ctx.lineWidth = thickness * 2.4;
        for (let b = 0; b < NUM_BUCKETS; b++) {
          const t = b / NUM_BUCKETS;
          ctx.strokeStyle = getDLAPaletteColor(palette, t, cycle, 0.22 * glow);
          ctx.stroke(bucketPaths[b]);
        }
      }

      // Crisp Core Filament Pass
      ctx.lineWidth = thickness;
      for (let b = 0; b < NUM_BUCKETS; b++) {
        const t = b / NUM_BUCKETS;
        ctx.strokeStyle = getDLAPaletteColor(palette, t, cycle, 0.88);
        ctx.stroke(bucketPaths[b]);
      }

      // Mesh Cross Links
      if (style === 'crystalline-mesh') {
        ctx.lineWidth = Math.max(0.6, thickness * 0.5);
        ctx.strokeStyle = getDLAPaletteColor(palette, 0.8, cycle, 0.45);
        ctx.stroke(meshPaths);
      }
    } else if (style === 'glow-nodes' || style === 'luminous-spores') {
      const isLuminous = style === 'luminous-spores';
      if (isLuminous) {
        ctx.globalCompositeOperation = 'lighter';
      }

      const NUM_BUCKETS = 16;
      const bucketPoints: { x: number; y: number; r: number }[][] = Array.from(
        { length: NUM_BUCKETS },
        () => []
      );

      for (let i = 0; i < count; i++) {
        const px = this.clusterX[i];
        const py = this.clusterY[i];

        let t = 0;
        if (mode === 'branch-age') {
          t = i / maxAge;
        } else if (mode === 'branch-hierarchy') {
          t = this.clusterDepth[i] / maxDepth;
        } else if (mode === 'distance-radial') {
          t = this.clusterDist[i] / maxDist;
        } else if (mode === 'seed-colony') {
          t = ((this.clusterSeedId[i] * 0.23) % 1.0) + (i / maxAge) * 0.2;
        }

        const bucketIdx = Math.floor(((t + cycle) % 1.0 + 1.0) % 1.0 * NUM_BUCKETS) % NUM_BUCKETS;
        const rad = Math.max(0.8, particleRadius * (1.2 - 0.4 * (i / maxAge)));

        bucketPoints[bucketIdx].push({ x: px, y: py, r: rad });
      }

      for (let b = 0; b < NUM_BUCKETS; b++) {
        const pts = bucketPoints[b];
        if (pts.length === 0) continue;

        const t = b / NUM_BUCKETS;
        ctx.fillStyle = getDLAPaletteColor(palette, t, cycle, isLuminous ? 0.65 : 0.85);

        ctx.beginPath();
        for (let j = 0; j < pts.length; j++) {
          const pt = pts[j];
          ctx.moveTo(pt.x + pt.r, pt.y);
          ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      if (isLuminous) {
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // 4. Radiant Growing Tip Beacons & Pulsing Crystals
    if (this.smoothedParams.tipGlow && count > 20) {
      const tipCount = Math.min(Math.floor(count * 0.04) + 10, 200);
      const startIdx = Math.max(0, count - tipCount);
      const pulse = 1.0 + Math.sin(this.timeSeconds * 5.5) * 0.25 + trebleBoost * 0.8;

      ctx.fillStyle = getDLAPaletteColor(palette, 0.95, cycle, 0.85);
      ctx.beginPath();
      for (let i = startIdx; i < count; i++) {
        const px = this.clusterX[i];
        const py = this.clusterY[i];
        const rad = Math.max(1.5, particleRadius * 1.5) * pulse;
        ctx.moveTo(px + rad, py);
        ctx.arc(px, py, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // 5. Nucleation Seed Cores Highlight
    for (let s = 0; s < this.seeds.length; s++) {
      const seed = this.seeds[s];
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(seed.x, seed.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Interactive Cursor Probe Overlay
    if (this.smoothedPointerX > -500 && (this.smoothedParams.pointerMode === 'attract' || this.smoothedParams.pointerMode === 'repel')) {
      const px = this.smoothedPointerX;
      const py = this.smoothedPointerY;
      const pr = this.smoothedParams.pointerRadius;

      ctx.strokeStyle = this.smoothedParams.pointerMode === 'attract'
        ? 'rgba(0, 240, 255, 0.45)'
        : 'rgba(255, 51, 102, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = this.smoothedParams.pointerMode === 'attract'
        ? 'rgba(0, 240, 255, 0.8)'
        : 'rgba(255, 51, 102, 0.8)';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture.
   * Runs an offline simulated DLA crystal onto an offscreen canvas at museum 4K/8K resolution.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;

    const offCtx = offCanvas.getContext('2d', { alpha: false });
    if (!offCtx) {
      throw new Error('Failed to create offscreen context for DLA snapshot.');
    }

    const scale = width / this.width;

    // Fill background
    offCtx.fillStyle = '#090A0D';
    offCtx.fillRect(0, 0, width, height);

    // Render scaled crystal branches
    const count = this.clusterCount;
    const palette = this.params.colorPalette;
    const mode = this.params.colorMode;
    const thickness = this.params.branchThickness * scale;
    const maxAge = Math.max(count - 1, 1);
    const maxDepth = Math.max(this.maxObservedDepth, 1);
    const maxDist = Math.max(this.maxObservedDist, 1);

    const NUM_BUCKETS = 24;
    const bucketPaths: Path2D[] = Array.from({ length: NUM_BUCKETS }, () => new Path2D());

    for (let i = 1; i < count; i++) {
      const px = this.clusterX[i] * scale;
      const py = this.clusterY[i] * scale;
      const parentIdx = this.clusterParent[i];
      if (parentIdx < 0) continue;

      const parentX = this.clusterX[parentIdx] * scale;
      const parentY = this.clusterY[parentIdx] * scale;

      let t = 0;
      if (mode === 'branch-age') {
        t = i / maxAge;
      } else if (mode === 'branch-hierarchy') {
        t = this.clusterDepth[i] / maxDepth;
      } else if (mode === 'distance-radial') {
        t = this.clusterDist[i] / maxDist;
      } else if (mode === 'seed-colony') {
        t = ((this.clusterSeedId[i] * 0.23) % 1.0) + (i / maxAge) * 0.2;
      }

      const bucketIdx = Math.floor(((t + this.paletteCycle) % 1.0 + 1.0) % 1.0 * NUM_BUCKETS) % NUM_BUCKETS;
      const path = bucketPaths[bucketIdx];
      path.moveTo(parentX, parentY);
      path.lineTo(px, py);
    }

    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';

    // Glow underlay
    offCtx.lineWidth = thickness * 2.5;
    for (let b = 0; b < NUM_BUCKETS; b++) {
      const t = b / NUM_BUCKETS;
      offCtx.strokeStyle = getDLAPaletteColor(palette, t, this.paletteCycle, 0.25);
      offCtx.stroke(bucketPaths[b]);
    }

    // Crisp core filaments
    offCtx.lineWidth = thickness;
    for (let b = 0; b < NUM_BUCKETS; b++) {
      const t = b / NUM_BUCKETS;
      offCtx.strokeStyle = getDLAPaletteColor(palette, t, this.paletteCycle, 0.92);
      offCtx.stroke(bucketPaths[b]);
    }

    return offCanvas;
  }

  /**
   * Releases animation frame and DOM resources.
   */
  private teardown(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}

/**
 * Factory creating a fresh DLARoom instance.
 */
export function createRoom(): DLARoom {
  return new DLARoom();
}

export const room = new DLARoom();
export default room;
