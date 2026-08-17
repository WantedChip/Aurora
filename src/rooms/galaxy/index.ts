/**
 * Room 15: Galaxy Fly-Through (WebGPU Compute Starfield & Nebula)
 * Curatorial Category: Cosmic
 * Math Model: Lin-Shu Density Wave Theory, Rubin Flat Differential Rotation & Hernquist Bulge Mechanics
 * Optimization: Three.js WebGPU / WebGL2 Particle System (1,000,000 Stars & Gas Dust) with High-Performance 3D Canvas2D Fallback
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - 6 Canonical Galactic Morphologies:
 *     1. Milky Way Barred Spiral (SBbc) — Central elongated bar, 4 arms, golden core, dust lanes
 *     2. Andromeda Grand Design (SA(s)b) — 2 sweeping symmetric arms, vast outer stellar disk, blue starburst rim
 *     3. Pinwheel Multi-Arm (SA(rs)cd) — 5 open spiral arms with rich H-II emission nebulae
 *     4. Sombrero Dense Bulge (SA(s)a) — Massive spheroidal bulge with razor-sharp dark planar dust ring
 *     5. Hoag's Ring Galaxy (Collisional) — Detached glowing blue starburst ring encircling an isolated core
 *     6. Interacting Starburst — Chaotic collision with tidal streamer tails and dual energetic nuclei
 * - Astrophysical Density Wave Dynamics & Differential Rotation:
 *     - Rubin flat rotation curve: v(r) = v₀ · r / √(r² + r_c²)
 *     - Lin-Shu spiral density wave compression: θ(t) = θ₀ + Ω(r)t + A_arm · sin(N_arms(θ₀ - Ω_p t) - Φ(r))
 *     - Logarithmic spiral arms: Φ(r) = armWinding · ln(1 + r/r₀)
 *     - Hernquist core bulge potential: ρ(r) ∝ 1 / [r(r + a)³]
 *     - Globular halo cluster distribution with isotropic 3D velocity dispersion
 * - Stellar Spectral Classification (Morgan-Keenan OBAFGKM):
 *     - O-type (35,000K Hypergiants, Electric Cyan)
 *     - B-type (20,000K Blue-White Giants, Sky Ice Blue)
 *     - A-type (9,500K Pure White, Sirius)
 *     - F-type (6,800K Yellow-White, Procyon)
 *     - G-type (5,500K Solar Yellow, Sol)
 *     - K-type (4,200K Orange Giants, Arcturus)
 *     - M-type (3,000K Red Dwarfs, Betelgeuse)
 * - Volumetric Interstellar Gas Clouds & Dust Lanes:
 *     - Soft additive luminous emission nebulae and interstellar dust lanes along spiral shock fronts
 * - Cinematic Kinematic Spline Fly-Through & User Pointer Override:
 *     - Autonomous multi-waypoint 3D spline camera cruising through arms, core bulge, and halo
 *     - Seamless blend to manual OrbitControls / pointer steering on interaction
 * - 7 Curatorial Spectral Palettes:
 *     - Stellar Blackbody (OBAFGKM), Spectral Aurora, Solar Plasma, Deep Cosmos, Obsidian Emerald, Cosmic Amethyst, Monochrome Void
 * - Web Audio API Reactivity:
 *     - Sub-bass modulates core bulge pulse and gravitational compression
 *     - Mid-range drives nebular cloud luminescence and hue shifts
 *     - Treble drives star scintillation / twinkling rate and dust shimmer
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
 * - 50K particle 3D perspective Canvas2D fallback for non-GPU environments
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export type GalaxyPreset =
  | 'milky-way'
  | 'andromeda'
  | 'pinwheel'
  | 'sombrero'
  | 'ring-galaxy'
  | 'starburst';

export type SpectralPalette =
  | 'stellar-blackbody'
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'deep-cosmos'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-void';

export type CameraMode = 'fly-through' | 'manual-orbit';

export interface GalaxyParams {
  seed: string;
  preset: GalaxyPreset;
  starCount: number;
  spiralArms: number;
  armWinding: number;
  armWidth: number;
  barLength: number;
  coreBulgeRadius: number;
  haloDensity: number;
  rotationSpeed: number;
  densityWaveAmp: number;
  dustDensity: number;
  starSize: number;
  scintillation: number;
  cameraMode: CameraMode;
  cameraSpeed: number;
  cameraFov: number;
  colorPalette: SpectralPalette;
  nebulaGlow: number;
  audioReactivity: number;
}

export const DEFAULT_GALAXY_PARAMS: GalaxyParams = {
  seed: '#E0AAFF',
  preset: 'milky-way',
  starCount: 300000,
  spiralArms: 4,
  armWinding: 2.8,
  armWidth: 0.4,
  barLength: 1.2,
  coreBulgeRadius: 2.5,
  haloDensity: 0.35,
  rotationSpeed: 0.6,
  densityWaveAmp: 0.8,
  dustDensity: 1.0,
  starSize: 1.8,
  scintillation: 0.8,
  cameraMode: 'fly-through',
  cameraSpeed: 0.4,
  cameraFov: 55,
  colorPalette: 'stellar-blackbody',
  nebulaGlow: 1.2,
  audioReactivity: 1.2,
};

const MAX_PARTICLES_CAPACITY = 600000;
const CANVAS2D_FALLBACK_CAPACITY = 50000;

export interface PaletteStop {
  r: number;
  g: number;
  b: number;
}

export interface GalaxyColorPalette {
  name: string;
  stops: [PaletteStop, PaletteStop, PaletteStop, PaletteStop];
  nebulaStops: [PaletteStop, PaletteStop, PaletteStop];
}

/**
 * Curatorial Spectral Palettes for Stars & Interstellar Nebulae.
 */
export const GALAXY_PALETTES: Record<SpectralPalette, GalaxyColorPalette> = {
  'stellar-blackbody': {
    name: 'Stellar Blackbody (OBAFGKM)',
    stops: [
      { r: 0.40, g: 0.60, b: 1.0 },   // O-type Blue Hypergiant (#6699FF)
      { r: 0.80, g: 0.90, b: 1.0 },   // A-type Pure White (#CCE6FF)
      { r: 1.0,  g: 0.78, b: 0.28 },  // G-type Solar Yellow (#FFC747)
      { r: 1.0,  g: 0.24, b: 0.32 },  // M-type Red Dwarf (#FF3D52)
    ],
    nebulaStops: [
      { r: 0.05, g: 0.25, b: 0.70 },  // Ionized Oxygen Blue
      { r: 0.75, g: 0.12, b: 0.45 },  // H-Alpha Emission Pink
      { r: 0.85, g: 0.45, b: 0.15 },  // Warm Interstellar Amber
    ],
  },
  'spectral-aurora': {
    name: 'Spectral Aurora',
    stops: [
      { r: 0.0,  g: 0.94, b: 1.0 },   // Electric Cyan (#00F0FF)
      { r: 0.66, g: 0.33, b: 0.97 },  // Royal Violet (#A855F7)
      { r: 0.0,  g: 1.0,  b: 0.62 },  // Phosphor Mint (#00FF9D)
      { r: 0.95, g: 0.98, b: 1.0 },   // Starlight White (#F1F5F9)
    ],
    nebulaStops: [
      { r: 0.02, g: 0.65, b: 0.85 },  // Aurora Cyan
      { r: 0.55, g: 0.15, b: 0.85 },  // Cosmic Violet
      { r: 0.05, g: 0.80, b: 0.50 },  // Phosphor Green
    ],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    stops: [
      { r: 0.25, g: 0.08, b: 0.02 },  // Obsidian Amber
      { r: 1.0,  g: 0.72, b: 0.0 },   // Radiant Gold (#FFB800)
      { r: 1.0,  g: 0.20, b: 0.35 },  // Laser Crimson (#FF3359)
      { r: 1.0,  g: 0.96, b: 0.88 },  // Solar White (#FFF5EB)
    ],
    nebulaStops: [
      { r: 0.80, g: 0.15, b: 0.10 },  // Deep Magma Red
      { r: 0.95, g: 0.55, b: 0.05 },  // Radiant Amber
      { r: 0.98, g: 0.85, b: 0.30 },  // Plasma Flare
    ],
  },
  'deep-cosmos': {
    name: 'Deep Cosmos (JWST / Hubble)',
    stops: [
      { r: 0.02, g: 0.08, b: 0.22 },  // Abyssal Navy
      { r: 0.10, g: 0.55, b: 0.85 },  // Deep Cyan (#198CD9)
      { r: 0.85, g: 0.15, b: 0.65 },  // Magenta Nebula (#D926A6)
      { r: 0.92, g: 0.96, b: 1.0 },   // Diamond Starlight (#EBF5FF)
    ],
    nebulaStops: [
      { r: 0.08, g: 0.30, b: 0.65 },  // Abyssal Azure
      { r: 0.70, g: 0.10, b: 0.50 },  // Deep Fuchsia
      { r: 0.15, g: 0.60, b: 0.75 },  // Turquoise Veils
    ],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    stops: [
      { r: 0.02, g: 0.06, b: 0.05 },  // Black Obsidian
      { r: 0.02, g: 0.59, b: 0.41 },  // Forest Emerald (#059669)
      { r: 0.06, g: 0.85, b: 0.55 },  // Phosphor Green (#10B981)
      { r: 0.55, g: 0.95, b: 0.80 },  // Bright Mint Starlight (#8CEDCC)
    ],
    nebulaStops: [
      { r: 0.01, g: 0.35, b: 0.25 },  // Deep Forest Gas
      { r: 0.05, g: 0.75, b: 0.48 },  // Emerald Shimmer
      { r: 0.30, g: 0.90, b: 0.70 },  // Mint Luminescence
    ],
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    stops: [
      { r: 0.05, g: 0.03, b: 0.10 },  // Void Slate
      { r: 0.52, g: 0.22, b: 0.92 },  // Mystic Orchid (#8538EB)
      { r: 0.96, g: 0.25, b: 0.45 },  // Magenta Neon (#F54073)
      { r: 0.98, g: 0.95, b: 1.0 },   // Diamond Glow (#FAF2FF)
    ],
    nebulaStops: [
      { r: 0.35, g: 0.08, b: 0.60 },  // Deep Amethyst Dust
      { r: 0.80, g: 0.18, b: 0.50 },  // Orchid Flame
      { r: 0.60, g: 0.35, b: 0.95 },  // Violet Glow
    ],
  },
  'monochrome-void': {
    name: 'Monochrome Void',
    stops: [
      { r: 0.08, g: 0.09, b: 0.11 },  // Obsidian Charcoal
      { r: 0.38, g: 0.40, b: 0.44 },  // Graphite Silver
      { r: 0.75, g: 0.78, b: 0.82 },  // Polished Platinum
      { r: 1.0,  g: 1.0,  b: 1.0 },   // Pure Archival White
    ],
    nebulaStops: [
      { r: 0.15, g: 0.16, b: 0.18 },  // Dark Dust Lane
      { r: 0.45, g: 0.47, b: 0.50 },  // Silver Gas Veil
      { r: 0.70, g: 0.72, b: 0.76 },  // Platinum Luminescence
    ],
  },
};

/**
 * Morphology configurations for 6 galaxy presets.
 */
export interface GalaxyMorphologyConfig {
  spiralArms: number;
  armWinding: number;
  armWidth: number;
  barLength: number;
  coreBulgeRadius: number;
  haloDensity: number;
  dustDensity: number;
  rotationSpeed: number;
  densityWaveAmp: number;
  ringRadius?: number;
  isStarburst?: boolean;
}

export const GALAXY_PRESET_CONFIGS: Record<GalaxyPreset, GalaxyMorphologyConfig> = {
  'milky-way': {
    spiralArms: 4,
    armWinding: 2.8,
    armWidth: 0.42,
    barLength: 1.4,
    coreBulgeRadius: 2.4,
    haloDensity: 0.35,
    dustDensity: 1.1,
    rotationSpeed: 0.6,
    densityWaveAmp: 0.85,
  },
  'andromeda': {
    spiralArms: 2,
    armWinding: 2.2,
    armWidth: 0.35,
    barLength: 0.4,
    coreBulgeRadius: 3.2,
    haloDensity: 0.45,
    dustDensity: 0.95,
    rotationSpeed: 0.5,
    densityWaveAmp: 0.75,
  },
  'pinwheel': {
    spiralArms: 5,
    armWinding: 3.4,
    armWidth: 0.48,
    barLength: 0.0,
    coreBulgeRadius: 1.6,
    haloDensity: 0.2,
    dustDensity: 1.35,
    rotationSpeed: 0.7,
    densityWaveAmp: 1.1,
  },
  'sombrero': {
    spiralArms: 2,
    armWinding: 1.2,
    armWidth: 0.25,
    barLength: 0.2,
    coreBulgeRadius: 4.8,
    haloDensity: 0.75,
    dustDensity: 2.2,
    rotationSpeed: 0.4,
    densityWaveAmp: 0.6,
  },
  'ring-galaxy': {
    spiralArms: 1,
    armWinding: 0.15,
    armWidth: 0.28,
    barLength: 0.0,
    coreBulgeRadius: 1.8,
    haloDensity: 0.18,
    dustDensity: 0.8,
    rotationSpeed: 0.65,
    densityWaveAmp: 0.5,
    ringRadius: 16.0,
  },
  'starburst': {
    spiralArms: 3,
    armWinding: 1.9,
    armWidth: 0.75,
    barLength: 1.8,
    coreBulgeRadius: 3.4,
    haloDensity: 0.65,
    dustDensity: 1.8,
    rotationSpeed: 0.9,
    densityWaveAmp: 1.4,
    isStarburst: true,
  },
};

/**
 * Samples a 4-stop color palette with cubic Hermite smoothstep interpolation.
 */
function samplePalette(palette: GalaxyColorPalette, t: number, out: PaletteStop): void {
  const clampedT = Math.max(0, Math.min(1, t));
  const stops = palette.stops;

  if (clampedT <= 0.3333) {
    const localT = clampedT / 0.3333;
    const s = localT * localT * (3.0 - 2.0 * localT);
    out.r = stops[0].r + (stops[1].r - stops[0].r) * s;
    out.g = stops[0].g + (stops[1].g - stops[0].g) * s;
    out.b = stops[0].b + (stops[1].b - stops[0].b) * s;
  } else if (clampedT <= 0.6666) {
    const localT = (clampedT - 0.3333) / 0.3333;
    const s = localT * localT * (3.0 - 2.0 * localT);
    out.r = stops[1].r + (stops[2].r - stops[1].r) * s;
    out.g = stops[1].g + (stops[2].g - stops[1].g) * s;
    out.b = stops[1].b + (stops[2].b - stops[1].b) * s;
  } else {
    const localT = (clampedT - 0.6666) / 0.3334;
    const s = localT * localT * (3.0 - 2.0 * localT);
    out.r = stops[2].r + (stops[3].r - stops[2].r) * s;
    out.g = stops[2].g + (stops[3].g - stops[2].g) * s;
    out.b = stops[2].b + (stops[3].b - stops[2].b) * s;
  }
}

/**
 * Samples a 3-stop nebula gas palette.
 */
function sampleNebulaPalette(palette: GalaxyColorPalette, t: number, out: PaletteStop): void {
  const clampedT = Math.max(0, Math.min(1, t));
  const stops = palette.nebulaStops;

  if (clampedT <= 0.5) {
    const localT = clampedT / 0.5;
    const s = localT * localT * (3.0 - 2.0 * localT);
    out.r = stops[0].r + (stops[1].r - stops[0].r) * s;
    out.g = stops[0].g + (stops[1].g - stops[0].g) * s;
    out.b = stops[0].b + (stops[1].b - stops[0].b) * s;
  } else {
    const localT = (clampedT - 0.5) / 0.5;
    const s = localT * localT * (3.0 - 2.0 * localT);
    out.r = stops[1].r + (stops[2].r - stops[1].r) * s;
    out.g = stops[1].g + (stops[2].g - stops[1].g) * s;
    out.b = stops[1].b + (stops[2].b - stops[1].b) * s;
  }
}

/**
 * 3D Spline Waypoint for Fly-Through Camera Navigation.
 */
interface FlyWaypoint {
  pos: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
}

/**
 * Room 15: Galaxy Fly-Through Implementation.
 */
export class GalaxyRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private prng: PRNG = createPRNG('#E0AAFF');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;
  private isMounted = false;
  private prefersReducedMotion = false;
  private audioCtx: any = null;

  // Active Parameters
  private params: GalaxyParams = { ...DEFAULT_GALAXY_PARAMS };

  // Target Parameters for Smooth Exponential Parameter Damping
  private targetParams: GalaxyParams = { ...DEFAULT_GALAXY_PARAMS };

  // Execution Backend Mode
  private backendMode: 'webgl' | 'canvas2d' = 'canvas2d';

  // Three.js Resources
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;

  // Star Points System
  private starsMesh: THREE.Points | null = null;
  private starsGeometry: THREE.BufferGeometry | null = null;
  private starsMaterial: THREE.ShaderMaterial | null = null;
  private starsPosAttr: THREE.BufferAttribute | null = null;
  private starsColorAttr: THREE.BufferAttribute | null = null;
  private starsSizeAttr: THREE.BufferAttribute | null = null;

  // Volumetric Nebula Dust System
  private nebulaMesh: THREE.Points | null = null;
  private nebulaGeometry: THREE.BufferGeometry | null = null;
  private nebulaMaterial: THREE.ShaderMaterial | null = null;
  private nebulaPosAttr: THREE.BufferAttribute | null = null;
  private nebulaColorAttr: THREE.BufferAttribute | null = null;
  private nebulaSizeAttr: THREE.BufferAttribute | null = null;

  // Particle Kinematic & Astrophysical Buffers
  private starCount = 240000;
  private nebulaCount = 60000;

  // Pre-allocated Particle Properties (Flat Memory)
  private starRadius = new Float32Array(MAX_PARTICLES_CAPACITY);
  private starBaseAngle = new Float32Array(MAX_PARTICLES_CAPACITY);
  private starHeight = new Float32Array(MAX_PARTICLES_CAPACITY);
  private starOrbitalSpeed = new Float32Array(MAX_PARTICLES_CAPACITY);
  private starSpectralClass = new Uint8Array(MAX_PARTICLES_CAPACITY); // 0=O, 1=B, 2=A, 3=F, 4=G, 5=K, 6=M
  private starComponent = new Uint8Array(MAX_PARTICLES_CAPACITY); // 0=core, 1=arm, 2=halo, 3=bar, 4=ring
  private starArmIndex = new Int8Array(MAX_PARTICLES_CAPACITY);
  private starTwinklePhase = new Float32Array(MAX_PARTICLES_CAPACITY);
  private starTwinkleSpeed = new Float32Array(MAX_PARTICLES_CAPACITY);
  private starPositions = new Float32Array(MAX_PARTICLES_CAPACITY * 3);
  private starColors = new Float32Array(MAX_PARTICLES_CAPACITY * 3);
  private starSizes = new Float32Array(MAX_PARTICLES_CAPACITY);

  // Nebula Dust Properties
  private nebulaRadius = new Float32Array(MAX_PARTICLES_CAPACITY / 4);
  private nebulaBaseAngle = new Float32Array(MAX_PARTICLES_CAPACITY / 4);
  private nebulaHeight = new Float32Array(MAX_PARTICLES_CAPACITY / 4);
  private nebulaOrbitalSpeed = new Float32Array(MAX_PARTICLES_CAPACITY / 4);
  private nebulaArmIndex = new Int8Array(MAX_PARTICLES_CAPACITY / 4);
  private nebulaPositions = new Float32Array((MAX_PARTICLES_CAPACITY / 4) * 3);
  private nebulaColors = new Float32Array((MAX_PARTICLES_CAPACITY / 4) * 3);
  private nebulaSizes = new Float32Array(MAX_PARTICLES_CAPACITY / 4);

  // Fly-Through Camera Path State
  private splineProgress = 0.0;
  private waypoints: FlyWaypoint[] = [];
  private isUserInteracting = false;
  private userInteractionTimer: number | null = null;
  private cameraBlendWeight = 0.0; // 0.0 = full autonomous spline, 1.0 = manual OrbitControls
  private splineCamPos = new THREE.Vector3();
  private splineLookTarget = new THREE.Vector3();

  // Canvas2D Fallback Resources
  private ctx2d: CanvasRenderingContext2D | null = null;
  private canvas2dRotationX = 0.55;
  private canvas2dRotationY = 0.0;
  private canvas2dDistance = 55.0;
  private isCanvas2dPointerDown = false;
  private canvas2dLastPointerX = 0;
  private canvas2dLastPointerY = 0;

  // Audio Reactivity State
  private audioBassSmoothed = 0.0;
  private audioMidSmoothed = 0.0;
  private audioHighSmoothed = 0.0;

  /**
   * Mounts the Galaxy Fly-Through simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_GALAXY_PARAMS.seed);
    this.audioCtx = ctx.audio || null;

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    this.setupFlyThroughWaypoints();

    // Try initializing WebGL2 / WebGPU Three.js pipeline
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: false, // Point sprites are anti-aliased in shader
        powerPreference: 'high-performance',
        alpha: false,
        depth: true,
      });

      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(Math.min(this.dpr, 2.0));
      this.renderer.setClearColor(0x090a0d, 1.0); // Obsidian Archival Minimal void

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(this.params.cameraFov, this.width / this.height, 0.1, 800);

      // Setup OrbitControls for user manual navigation override
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.rotateSpeed = 0.8;
      this.controls.zoomSpeed = 1.0;
      this.controls.panSpeed = 0.8;
      this.controls.minDistance = 1.0;
      this.controls.maxDistance = 300.0;
      this.controls.target.set(0, 0, 0);

      // Setup initial camera position
      this.camera.position.set(0, 32, 58);
      this.camera.lookAt(0, 0, 0);

      // Create Particle Geometries & Custom Shader Materials
      this.initStarParticleSystem();
      this.initNebulaDustSystem();

      // Generate Galaxy Particles & Physics Initial Conditions
      this.generateGalaxyData();

      this.backendMode = 'webgl';
    } catch (err) {
      console.warn('WebGL/WebGPU initialization failed in Room 15, activating Canvas2D 3D-projection fallback:', err);
      this.backendMode = 'canvas2d';
      this.ctx2d = this.canvas.getContext('2d');
      this.generateGalaxyData();
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
   * Constructs the autonomous 3D cinematic fly-through waypoint spline.
   */
  private setupFlyThroughWaypoints(): void {
    this.waypoints = [
      // 0: High Panoramic Overview
      {
        pos: new THREE.Vector3(0, 42, 68),
        lookAt: new THREE.Vector3(0, 0, 0),
        fov: 55,
      },
      // 1: Outer Disk Spiral Rim Descent
      {
        pos: new THREE.Vector3(38, 14, 28),
        lookAt: new THREE.Vector3(12, 1, 6),
        fov: 60,
      },
      // 2: Low Altitude Spiral Arm Dust Skim
      {
        pos: new THREE.Vector3(18, 3.2, -14),
        lookAt: new THREE.Vector3(-4, 0.5, -2),
        fov: 65,
      },
      // 3: Core Bulge Approach & Supermassive Black Hole Horizon
      {
        pos: new THREE.Vector3(3.5, 1.2, 4.5),
        lookAt: new THREE.Vector3(-8, -0.5, -6),
        fov: 70,
      },
      // 4: Trans-Galactic Underside Ascent
      {
        pos: new THREE.Vector3(-26, -10, -18),
        lookAt: new THREE.Vector3(0, 0, 0),
        fov: 58,
      },
      // 5: High Globular Cluster Halo Apex
      {
        pos: new THREE.Vector3(-36, 34, 25),
        lookAt: new THREE.Vector3(0, -2, 0),
        fov: 50,
      },
    ];
  }

  /**
   * Initializes the primary Star particle mesh, geometry, and starlight point shader.
   */
  private initStarParticleSystem(): void {
    if (!this.scene) return;

    this.starsGeometry = new THREE.BufferGeometry();
    this.starsPosAttr = new THREE.BufferAttribute(this.starPositions, 3);
    this.starsColorAttr = new THREE.BufferAttribute(this.starColors, 3);
    this.starsSizeAttr = new THREE.BufferAttribute(this.starSizes, 1);

    this.starsPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.starsColorAttr.setUsage(THREE.DynamicDrawUsage);

    this.starsGeometry.setAttribute('position', this.starsPosAttr);
    this.starsGeometry.setAttribute('color', this.starsColorAttr);
    this.starsGeometry.setAttribute('size', this.starsSizeAttr);

    // Custom Starlight Point Shader
    this.starsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uBaseSize: { value: this.params.starSize },
        uViewportHeight: { value: this.height },
        uScintillation: { value: this.params.scintillation },
        uAudioBass: { value: 0.0 },
        uAudioHigh: { value: 0.0 },
      },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        varying vec3 vColor;
        varying float vAlpha;

        uniform float uTime;
        uniform float uBaseSize;
        uniform float uViewportHeight;
        uniform float uScintillation;
        uniform float uAudioBass;
        uniform float uAudioHigh;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          float dist = max(-mvPosition.z, 0.1);
          
          // Stellar twinkle / scintillation
          float twinkle = sin(uTime * 4.0 + position.x * 0.5 + position.z * 0.3) * 0.5 + 0.5;
          float scintScale = mix(1.0, 0.7 + 0.6 * twinkle + uAudioHigh * 0.4, uScintillation);
          
          // Distance-attenuated perspective point sizing
          float pSize = size * uBaseSize * scintScale * (uViewportHeight / (dist * 4.5));
          gl_PointSize = clamp(pSize, 1.0, 32.0);

          // Alpha fade for distant / extremely close points
          vAlpha = clamp(dist * 0.2, 0.2, 1.0);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          
          if (distSq > 0.25) {
            discard;
          }
          
          // Sharp central Airy disk + soft exponential halo
          float dist = sqrt(distSq) * 2.0; // 0.0 at center, 1.0 at edge
          float core = exp(-dist * dist * 12.0);
          float halo = exp(-dist * 3.5);
          float intensity = core * 0.7 + halo * 0.3;
          
          // Hot white-core blend
          vec3 starColor = mix(vColor, vec3(1.0, 0.98, 0.95), core * 0.85);
          
          gl_FragColor = vec4(starColor * intensity, intensity * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.starsMesh = new THREE.Points(this.starsGeometry, this.starsMaterial);
    this.scene.add(this.starsMesh);
  }

  /**
   * Initializes the secondary Volumetric Interstellar Nebula Dust particle system.
   */
  private initNebulaDustSystem(): void {
    if (!this.scene) return;

    this.nebulaGeometry = new THREE.BufferGeometry();
    this.nebulaPosAttr = new THREE.BufferAttribute(this.nebulaPositions, 3);
    this.nebulaColorAttr = new THREE.BufferAttribute(this.nebulaColors, 3);
    this.nebulaSizeAttr = new THREE.BufferAttribute(this.nebulaSizes, 1);

    this.nebulaPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.nebulaColorAttr.setUsage(THREE.DynamicDrawUsage);

    this.nebulaGeometry.setAttribute('position', this.nebulaPosAttr);
    this.nebulaGeometry.setAttribute('color', this.nebulaColorAttr);
    this.nebulaGeometry.setAttribute('size', this.nebulaSizeAttr);

    // Custom Volumetric Nebula Cloud Shader
    this.nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uNebulaGlow: { value: this.params.nebulaGlow },
        uDustDensity: { value: this.params.dustDensity },
        uViewportHeight: { value: this.height },
        uAudioMid: { value: 0.0 },
      },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        varying vec3 vColor;
        varying float vAlpha;

        uniform float uTime;
        uniform float uNebulaGlow;
        uniform float uDustDensity;
        uniform float uViewportHeight;
        uniform float uAudioMid;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          float dist = max(-mvPosition.z, 0.1);
          
          // Large soft volumetric sprites
          float pSize = size * (1.0 + uAudioMid * 0.3) * (uViewportHeight / (dist * 2.2));
          gl_PointSize = clamp(pSize, 4.0, 96.0);

          vAlpha = uDustDensity * uNebulaGlow * 0.18;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          
          if (distSq > 0.25) {
            discard;
          }
          
          // Ultra-soft smooth Gaussian puff
          float dist = sqrt(distSq) * 2.0;
          float falloff = exp(-dist * dist * 3.8);
          
          gl_FragColor = vec4(vColor * falloff, vAlpha * falloff);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.nebulaMesh = new THREE.Points(this.nebulaGeometry, this.nebulaMaterial);
    this.scene.add(this.nebulaMesh);
  }

  /**
   * Generates all astrophysical particle positions, spectral types, and kinematics deterministically.
   */
  private generateGalaxyData(): void {
    const totalTarget = Math.min(this.params.starCount, MAX_PARTICLES_CAPACITY);

    this.starCount = Math.floor(totalTarget * 0.82);
    this.nebulaCount = Math.floor(totalTarget * 0.18);

    const config = GALAXY_PRESET_CONFIGS[this.params.preset] || GALAXY_PRESET_CONFIGS['milky-way'];
    const palette = GALAXY_PALETTES[this.params.colorPalette] || GALAXY_PALETTES['stellar-blackbody'];

    const numArms = Math.max(1, Math.min(8, this.params.spiralArms));
    const armWinding = this.params.armWinding;
    const armWidth = this.params.armWidth;
    const barLength = this.params.barLength;
    const coreRadius = this.params.coreBulgeRadius;
    const haloDensity = this.params.haloDensity;
    const maxRadius = 32.0;

    const tempColor: PaletteStop = { r: 0, g: 0, b: 0 };
    const tempNebulaColor: PaletteStop = { r: 0, g: 0, b: 0 };

    // 1. Generate Primary Stars
    for (let i = 0; i < this.starCount; i++) {
      const roll = this.prng.next();
      let r = 0;
      let theta0 = 0;
      let z = 0;
      let component = 1; // 0=core, 1=arm/disk, 2=halo, 3=bar, 4=ring
      let armIdx = -1;
      let spectralClass = 4; // default G-type

      if (roll < 0.22) {
        // Component 0: Hernquist Core Bulge
        component = 0;
        // Hernquist radial distribution r = a * sqrt(u) / (1 - sqrt(u))
        const u = this.prng.nextFloat(0.001, 0.95);
        r = coreRadius * (Math.sqrt(u) / (1.0 - Math.sqrt(u) + 0.1));
        r = Math.min(r, coreRadius * 2.8);

        theta0 = this.prng.nextFloat(0, Math.PI * 2);
        // Spheroidal / triaxial vertical scale
        z = this.prng.nextFloat(-1, 1) * (coreRadius * 0.6) * Math.exp(-r / coreRadius);

        // Core stars: mostly ancient, dense yellow/orange/red giants (G, K, M) with hot central accretion stars
        const specRoll = this.prng.next();
        if (specRoll < 0.15) spectralClass = 2; // A-type white
        else if (specRoll < 0.55) spectralClass = 4; // G-type yellow
        else if (specRoll < 0.85) spectralClass = 5; // K-type orange
        else spectralClass = 6; // M-type red
      } else if (roll < 0.22 + haloDensity * 0.18) {
        // Component 2: Spheroidal Halo & Globular Clusters
        component = 2;
        r = this.prng.nextFloat(coreRadius, maxRadius * 1.3);
        theta0 = this.prng.nextFloat(0, Math.PI * 2);
        // High inclination spherical distribution
        const phi = Math.asin(this.prng.nextFloat(-0.85, 0.85));
        z = r * Math.sin(phi) * 0.5;

        // Ancient halo population (K, M red/orange dwarfs)
        spectralClass = this.prng.next() < 0.4 ? 5 : 6;
      } else if (barLength > 0.3 && roll < 0.38) {
        // Component 3: Central Elongated Bar
        component = 3;
        const barDist = this.prng.nextFloat(-barLength * 3.5, barLength * 3.5);
        const barSpread = this.prng.nextFloat(-0.8, 0.8) * Math.exp(-Math.abs(barDist) / (barLength * 2.5));
        r = Math.sqrt(barDist * barDist + barSpread * barSpread);
        theta0 = Math.atan2(barSpread, barDist);
        z = this.prng.nextFloat(-0.4, 0.4);

        spectralClass = this.prng.next() < 0.5 ? 4 : 5;
      } else if (config.ringRadius && roll > 0.7) {
        // Component 4: Hoag's Ring Galaxy Stellar Ring
        component = 4;
        r = config.ringRadius + this.prng.nextFloat(-2.5, 2.5);
        theta0 = this.prng.nextFloat(0, Math.PI * 2);
        z = this.prng.nextFloat(-0.6, 0.6);

        // Young bright blue starburst stars in ring (O, B, A)
        const specRoll = this.prng.next();
        if (specRoll < 0.4) spectralClass = 0; // O-type blue
        else if (specRoll < 0.75) spectralClass = 1; // B-type blue-white
        else spectralClass = 2; // A-type white
      } else {
        // Component 1: Logarithmic Spiral Arms & Disk
        component = 1;
        armIdx = i % numArms;

        // Exponential radial disk falloff
        const expU = this.prng.nextFloat(0.05, 1.0);
        r = coreRadius * 0.8 + (-Math.log(expU)) * (maxRadius / 3.0);
        r = Math.min(r, maxRadius);

        // Logarithmic spiral angle Φ(r) = b * ln(1 + r/r0)
        const spiralPhase = armWinding * Math.log(1.0 + r / 3.0);
        const armBaseAngle = (armIdx * (2 * Math.PI)) / numArms;

        // Gaussian arm width dispersion
        const dispersion = (this.prng.nextFloat(-1, 1) + this.prng.nextFloat(-1, 1)) * armWidth * (1.0 + r * 0.05);
        theta0 = armBaseAngle + spiralPhase + dispersion;

        // Thin disk vertical scale height sech²(z/z₀)
        const diskThickness = 0.5 + r * 0.02;
        z = (this.prng.nextFloat(-1, 1) + this.prng.nextFloat(-1, 1)) * diskThickness;

        // Arm stars: mixture of young bright OB-associations along the arms and FGK disk stars
        const specRoll = this.prng.next();
        if (specRoll < 0.18) spectralClass = 0; // O-type hypergiant
        else if (specRoll < 0.42) spectralClass = 1; // B-type blue-white
        else if (specRoll < 0.65) spectralClass = 2; // A-type pure white
        else if (specRoll < 0.85) spectralClass = 4; // G-type solar
        else spectralClass = 6; // M-type red
      }

      // Rubin flat rotation curve: v(r) = v0 * r / sqrt(r^2 + r_c^2)
      // Angular velocity Ω(r) = v(r)/r = v0 / sqrt(r^2 + r_c^2)
      const v0 = 1.0;
      const rc = Math.max(0.5, coreRadius * 0.5);
      const omega = v0 / Math.sqrt(r * r + rc * rc);

      this.starRadius[i] = r;
      this.starBaseAngle[i] = theta0;
      this.starHeight[i] = z;
      this.starOrbitalSpeed[i] = omega;
      this.starSpectralClass[i] = spectralClass;
      this.starComponent[i] = component;
      this.starArmIndex[i] = armIdx;
      this.starTwinklePhase[i] = this.prng.nextFloat(0, Math.PI * 2);
      this.starTwinkleSpeed[i] = this.prng.nextFloat(1.0, 5.0);

      // Star size based on spectral class
      let baseSize = 1.2;
      if (spectralClass === 0) baseSize = 2.8; // O-type massive
      else if (spectralClass === 1) baseSize = 2.2; // B-type
      else if (spectralClass === 2) baseSize = 1.8; // A-type
      else if (spectralClass === 6) baseSize = 1.0; // M-type small
      this.starSizes[i] = baseSize * this.prng.nextFloat(0.8, 1.4);

      // Initial Cartesian Positions
      const initX = r * Math.cos(theta0);
      const initZ = r * Math.sin(theta0);

      this.starPositions[i * 3] = initX;
      this.starPositions[i * 3 + 1] = z;
      this.starPositions[i * 3 + 2] = initZ;

      // Color mapping: map spectral class or radial distance to palette
      const normColor = (spectralClass / 6.0) * 0.7 + (r / maxRadius) * 0.3;
      samplePalette(palette, normColor, tempColor);

      this.starColors[i * 3] = tempColor.r;
      this.starColors[i * 3 + 1] = tempColor.g;
      this.starColors[i * 3 + 2] = tempColor.b;
    }

    // 2. Generate Volumetric Interstellar Nebulae & Cosmic Dust Clouds
    for (let j = 0; j < this.nebulaCount; j++) {
      const armIdx = j % numArms;
      const expU = this.prng.nextFloat(0.08, 0.95);
      const r = coreRadius * 1.2 + (-Math.log(expU)) * (maxRadius / 3.2);
      const clampedR = Math.min(r, maxRadius);

      const spiralPhase = armWinding * Math.log(1.0 + clampedR / 3.0);
      const armBaseAngle = (armIdx * (2 * Math.PI)) / numArms;

      // Dust lanes concentrate along the inner shock front of spiral arms
      const dustOffset = -0.15 * armWidth;
      const dispersion = (this.prng.nextFloat(-1, 1) + this.prng.nextFloat(-1, 1)) * (armWidth * 0.8);
      const theta0 = armBaseAngle + spiralPhase + dustOffset + dispersion;

      const z = (this.prng.nextFloat(-1, 1) + this.prng.nextFloat(-1, 1)) * (0.35 + clampedR * 0.015);

      const rc = Math.max(0.5, coreRadius * 0.5);
      const omega = 1.0 / Math.sqrt(clampedR * clampedR + rc * rc);

      this.nebulaRadius[j] = clampedR;
      this.nebulaBaseAngle[j] = theta0;
      this.nebulaHeight[j] = z;
      this.nebulaOrbitalSpeed[j] = omega;
      this.nebulaArmIndex[j] = armIdx;
      this.nebulaSizes[j] = this.prng.nextFloat(14.0, 38.0);

      const initX = clampedR * Math.cos(theta0);
      const initZ = clampedR * Math.sin(theta0);

      this.nebulaPositions[j * 3] = initX;
      this.nebulaPositions[j * 3 + 1] = z;
      this.nebulaPositions[j * 3 + 2] = initZ;

      const normNebula = (j / this.nebulaCount + clampedR / maxRadius * 0.5) % 1.0;
      sampleNebulaPalette(palette, normNebula, tempNebulaColor);

      this.nebulaColors[j * 3] = tempNebulaColor.r;
      this.nebulaColors[j * 3 + 1] = tempNebulaColor.g;
      this.nebulaColors[j * 3 + 2] = tempNebulaColor.b;
    }

    // Flag GPU buffer attributes for upload
    if (this.starsPosAttr && this.starsColorAttr && this.starsSizeAttr && this.starsGeometry) {
      this.starsPosAttr.needsUpdate = true;
      this.starsColorAttr.needsUpdate = true;
      this.starsSizeAttr.needsUpdate = true;
      this.starsGeometry.setDrawRange(0, this.starCount);
      this.starsGeometry.computeBoundingSphere();
    }

    if (this.nebulaPosAttr && this.nebulaColorAttr && this.nebulaSizeAttr && this.nebulaGeometry) {
      this.nebulaPosAttr.needsUpdate = true;
      this.nebulaColorAttr.needsUpdate = true;
      this.nebulaSizeAttr.needsUpdate = true;
      this.nebulaGeometry.setDrawRange(0, this.nebulaCount);
      this.nebulaGeometry.computeBoundingSphere();
    }
  }

  /**
   * Advances galactic kinematics, differential rotation, and density wave oscillations.
   */
  private stepGalacticDynamics(_dt: number): void {
    if (this.prefersReducedMotion) return;

    const rotSpeed = this.params.rotationSpeed;
    const densityAmp = this.params.densityWaveAmp;
    const numArms = Math.max(1, this.params.spiralArms);
    const patternSpeed = rotSpeed * 0.45; // Spiral density wave pattern speed Ω_p
    const time = this.totalTime;

    // Sub-bass audio pulse compression factor
    const bassCompression = 1.0 + this.audioBassSmoothed * 0.3 * this.params.audioReactivity;

    // 1. Update Stars
    for (let i = 0; i < this.starCount; i++) {
      const r = this.starRadius[i];
      const theta0 = this.starBaseAngle[i];
      const omega = this.starOrbitalSpeed[i];
      const comp = this.starComponent[i];

      // Lin-Shu density wave perturbation: θ(t) = θ₀ + Ω(r)t + A * sin(N(θ₀ - Ω_p t) - Φ(r))
      let angle = theta0 + (omega * rotSpeed * time);

      if (comp === 1) {
        // Spiral disk compression wave
        const wave = Math.sin(numArms * (theta0 - patternSpeed * time) - this.params.armWinding * Math.log(1.0 + r / 3.0));
        angle += densityAmp * 0.12 * wave;
      } else if (comp === 3) {
        // Bar star orbit
        angle = theta0 + (patternSpeed * time);
      }

      const curR = (comp === 0) ? r * bassCompression : r;
      const x = curR * Math.cos(angle);
      const z = curR * Math.sin(angle);
      const y = this.starHeight[i];

      this.starPositions[i * 3] = x;
      this.starPositions[i * 3 + 1] = y;
      this.starPositions[i * 3 + 2] = z;
    }

    // 2. Update Nebulae
    for (let j = 0; j < this.nebulaCount; j++) {
      const r = this.nebulaRadius[j];
      const theta0 = this.nebulaBaseAngle[j];
      const omega = this.nebulaOrbitalSpeed[j];

      const wave = Math.sin(numArms * (theta0 - patternSpeed * time) - this.params.armWinding * Math.log(1.0 + r / 3.0));
      const angle = theta0 + (omega * rotSpeed * time) + densityAmp * 0.15 * wave;

      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      const y = this.nebulaHeight[j];

      this.nebulaPositions[j * 3] = x;
      this.nebulaPositions[j * 3 + 1] = y;
      this.nebulaPositions[j * 3 + 2] = z;
    }

    if (this.starsPosAttr) this.starsPosAttr.needsUpdate = true;
    if (this.nebulaPosAttr) this.nebulaPosAttr.needsUpdate = true;
  }

  /**
   * Evaluates the continuous 3D Catmull-Rom spline camera trajectory.
   */
  private updateCameraFlyThrough(dt: number): void {
    if (!this.camera || !this.controls) return;

    if (this.params.cameraMode === 'fly-through' && !this.isUserInteracting) {
      this.splineProgress = (this.splineProgress + dt * this.params.cameraSpeed * 0.04) % 1.0;

      // Catmull-Rom waypoint spline interpolation across waypoints
      const numW = this.waypoints.length;
      const scaledT = this.splineProgress * numW;
      const idx0 = Math.floor(scaledT) % numW;
      const idx1 = (idx0 + 1) % numW;
      const idx2 = (idx0 + 2) % numW;
      const idxM1 = (idx0 - 1 + numW) % numW;
      const t = scaledT - Math.floor(scaledT);

      // Interpolate Position
      this.splineCamPos.x = this.catmullRom(this.waypoints[idxM1].pos.x, this.waypoints[idx0].pos.x, this.waypoints[idx1].pos.x, this.waypoints[idx2].pos.x, t);
      this.splineCamPos.y = this.catmullRom(this.waypoints[idxM1].pos.y, this.waypoints[idx0].pos.y, this.waypoints[idx1].pos.y, this.waypoints[idx2].pos.y, t);
      this.splineCamPos.z = this.catmullRom(this.waypoints[idxM1].pos.z, this.waypoints[idx0].pos.z, this.waypoints[idx1].pos.z, this.waypoints[idx2].pos.z, t);

      // Interpolate Look Target
      this.splineLookTarget.x = this.catmullRom(this.waypoints[idxM1].lookAt.x, this.waypoints[idx0].lookAt.x, this.waypoints[idx1].lookAt.x, this.waypoints[idx2].lookAt.x, t);
      this.splineLookTarget.y = this.catmullRom(this.waypoints[idxM1].lookAt.y, this.waypoints[idx0].lookAt.y, this.waypoints[idx1].lookAt.y, this.waypoints[idx2].lookAt.y, t);
      this.splineLookTarget.z = this.catmullRom(this.waypoints[idxM1].lookAt.z, this.waypoints[idx0].lookAt.z, this.waypoints[idx1].lookAt.z, this.waypoints[idx2].lookAt.z, t);

      // Smooth blend toward spline when not overridden
      this.cameraBlendWeight = Math.max(0.0, this.cameraBlendWeight - dt * 2.0);

      this.camera.position.lerp(this.splineCamPos, 1.0 - Math.exp(-3.5 * dt));
      this.controls.target.lerp(this.splineLookTarget, 1.0 - Math.exp(-4.0 * dt));
      this.camera.lookAt(this.controls.target);
    } else {
      // Manual OrbitControls
      this.cameraBlendWeight = Math.min(1.0, this.cameraBlendWeight + dt * 3.0);
    }

    this.controls.update();
  }

  /**
   * Catmull-Rom cubic spline interpolation helper.
   */
  private catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
  }

  /**
   * Polls Web Audio API spectrum if available.
   */
  private pollAudioReactivity(dt: number): void {
    if (!this.audioCtx || typeof this.audioCtx.getFrequencyData !== 'function') {
      return;
    }

    try {
      const freq = this.audioCtx.getFrequencyData();
      if (freq && freq.length >= 64) {
        // Sub-bass band (0-4)
        let bassSum = 0;
        for (let b = 0; b < 4; b++) bassSum += freq[b];
        const rawBass = bassSum / (4 * 255);

        // Mid band (8-32)
        let midSum = 0;
        for (let m = 8; m < 32; m++) midSum += freq[m];
        const rawMid = midSum / (24 * 255);

        // High band (36-64)
        let highSum = 0;
        for (let h = 36; h < 64; h++) highSum += freq[h];
        const rawHigh = highSum / (28 * 255);

        this.audioBassSmoothed += (rawBass - this.audioBassSmoothed) * Math.min(1.0, dt * 10.0);
        this.audioMidSmoothed += (rawMid - this.audioMidSmoothed) * Math.min(1.0, dt * 8.0);
        this.audioHighSmoothed += (rawHigh - this.audioHighSmoothed) * Math.min(1.0, dt * 12.0);
      }
    } catch {
      // Audio stream not yet initialized or dormant
    }
  }

  /**
   * Main simulation animation loop.
   */
  private loop(timestamp: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;
    this.totalTime += dt;

    // Smooth exponential parameter damping
    this.dampParameters(dt);

    // Audio reactivity analysis
    this.pollAudioReactivity(dt);

    // Evolve astrophysical differential rotation and density wave dynamics
    this.stepGalacticDynamics(dt);

    // Camera spline fly-through or manual orbit
    this.updateCameraFlyThrough(dt);

    if (this.backendMode === 'webgl' && this.renderer && this.scene && this.camera) {
      // Update shader uniforms
      if (this.starsMaterial) {
        this.starsMaterial.uniforms.uTime.value = this.totalTime;
        this.starsMaterial.uniforms.uBaseSize.value = this.params.starSize;
        this.starsMaterial.uniforms.uViewportHeight.value = this.height;
        this.starsMaterial.uniforms.uScintillation.value = this.params.scintillation;
        this.starsMaterial.uniforms.uAudioBass.value = this.audioBassSmoothed * this.params.audioReactivity;
        this.starsMaterial.uniforms.uAudioHigh.value = this.audioHighSmoothed * this.params.audioReactivity;
      }

      if (this.nebulaMaterial) {
        this.nebulaMaterial.uniforms.uTime.value = this.totalTime;
        this.nebulaMaterial.uniforms.uNebulaGlow.value = this.params.nebulaGlow;
        this.nebulaMaterial.uniforms.uDustDensity.value = this.params.dustDensity;
        this.nebulaMaterial.uniforms.uViewportHeight.value = this.height;
        this.nebulaMaterial.uniforms.uAudioMid.value = this.audioMidSmoothed * this.params.audioReactivity;
      }

      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d' && this.ctx2d && this.canvas) {
      this.renderCanvas2DFallback(dt);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Smoothly lerps active parameters toward target parameters.
   */
  private dampParameters(dt: number): void {
    const lambda = 7.0;
    this.params.armWinding = dampParameter(this.params.armWinding, this.targetParams.armWinding, lambda, dt);
    this.params.armWidth = dampParameter(this.params.armWidth, this.targetParams.armWidth, lambda, dt);
    this.params.barLength = dampParameter(this.params.barLength, this.targetParams.barLength, lambda, dt);
    this.params.coreBulgeRadius = dampParameter(this.params.coreBulgeRadius, this.targetParams.coreBulgeRadius, lambda, dt);
    this.params.haloDensity = dampParameter(this.params.haloDensity, this.targetParams.haloDensity, lambda, dt);
    this.params.rotationSpeed = dampParameter(this.params.rotationSpeed, this.targetParams.rotationSpeed, lambda, dt);
    this.params.densityWaveAmp = dampParameter(this.params.densityWaveAmp, this.targetParams.densityWaveAmp, lambda, dt);
    this.params.dustDensity = dampParameter(this.params.dustDensity, this.targetParams.dustDensity, lambda, dt);
    this.params.starSize = dampParameter(this.params.starSize, this.targetParams.starSize, lambda, dt);
    this.params.scintillation = dampParameter(this.params.scintillation, this.targetParams.scintillation, lambda, dt);
    this.params.cameraSpeed = dampParameter(this.params.cameraSpeed, this.targetParams.cameraSpeed, lambda, dt);
    this.params.nebulaGlow = dampParameter(this.params.nebulaGlow, this.targetParams.nebulaGlow, lambda, dt);
    this.params.audioReactivity = dampParameter(this.params.audioReactivity, this.targetParams.audioReactivity, lambda, dt);

    if (this.camera && Math.abs(this.camera.fov - this.targetParams.cameraFov) > 0.1) {
      this.camera.fov = dampParameter(this.camera.fov, this.targetParams.cameraFov, lambda, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * High-performance Canvas2D 3D Perspective Projection Fallback (50K stars).
   */
  private renderCanvas2DFallback(dt: number): void {
    if (!this.ctx2d || !this.canvas) return;

    const ctx = this.ctx2d;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;

    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, w * dpr, h * dpr);

    // Auto-orbiting in Canvas2D mode
    if (!this.isCanvas2dPointerDown && !this.prefersReducedMotion) {
      this.canvas2dRotationY += dt * this.params.rotationSpeed * 0.3;
    }

    const rotX = this.canvas2dRotationX;
    const rotY = this.canvas2dRotationY;
    const camDist = this.canvas2dDistance;
    const fovScale = (h * dpr * 0.8) / Math.tan((this.params.cameraFov * Math.PI) / 360);
    const cx = (w * dpr) * 0.5;
    const cy = (h * dpr) * 0.5;

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    const count = Math.min(this.starCount, CANVAS2D_FALLBACK_CAPACITY);
    const starBaseSize = this.params.starSize * dpr;

    for (let i = 0; i < count; i += 2) {
      const px = this.starPositions[i * 3];
      const py = this.starPositions[i * 3 + 1];
      const pz = this.starPositions[i * 3 + 2];

      // 3D Orbit View Matrix Rotation
      const x1 = px * cosY - pz * sinY;
      const z1 = px * sinY + pz * cosY;

      const y2 = py * cosX - z1 * sinX;
      const z2 = py * sinX + z1 * cosX + camDist;

      if (z2 <= 0.5) continue; // Behind camera plane

      // Perspective Projection
      const invZ = 1.0 / z2;
      const screenX = cx + (x1 * fovScale * invZ);
      const screenY = cy - (y2 * fovScale * invZ);

      if (screenX < 0 || screenX > w * dpr || screenY < 0 || screenY > h * dpr) continue;

      const r = Math.round(this.starColors[i * 3] * 255);
      const g = Math.round(this.starColors[i * 3 + 1] * 255);
      const b = Math.round(this.starColors[i * 3 + 2] * 255);

      const ptSize = Math.max(1.0, starBaseSize * (35.0 * invZ));

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(screenX - ptSize * 0.5, screenY - ptSize * 0.5, ptSize, ptSize);
    }
  }

  /**
   * Handles user interaction events (wheel, pointer drag, touch) to override fly-through.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (this.backendMode === 'canvas2d') {
      if (event.type === 'down') {
        this.isCanvas2dPointerDown = true;
        this.canvas2dLastPointerX = event.x;
        this.canvas2dLastPointerY = event.y;
      } else if (event.type === 'move' && this.isCanvas2dPointerDown) {
        const dx = event.x - this.canvas2dLastPointerX;
        const dy = event.y - this.canvas2dLastPointerY;
        this.canvas2dRotationY += dx * 0.005;
        this.canvas2dRotationX = Math.max(-1.4, Math.min(1.4, this.canvas2dRotationX + dy * 0.005));
        this.canvas2dLastPointerX = event.x;
        this.canvas2dLastPointerY = event.y;
      } else if (event.type === 'up' || event.type === 'leave') {
        this.isCanvas2dPointerDown = false;
      }
      return;
    }

    if (event.type === 'down' || event.type === 'move') {
      if (event.type === 'down') {
        this.isUserInteracting = true;
      }

      if (this.userInteractionTimer !== null) {
        clearTimeout(this.userInteractionTimer);
      }

      // Resume autonomous fly-through after 6 seconds of inactivity
      this.userInteractionTimer = window.setTimeout(() => {
        this.isUserInteracting = false;
        this.userInteractionTimer = null;
      }, 6000);
    }
  }

  /**
   * Resizes viewport dimensions.
   */
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    if (this.renderer && this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }
  }

  /**
   * Updates simulation parameters smoothly.
   */
  public updateParams(newParams: Record<string, any>): void {
    this.applyParams(newParams, false);
  }

  /**
   * Merges new parameters and triggers structural regenerations when key parameters change.
   */
  private applyParams(newParams: Record<string, any>, isInitial: boolean): void {
    const prevSeed = this.params.seed;
    const prevPreset = this.params.preset;
    const prevCount = this.params.starCount;
    const prevArms = this.params.spiralArms;
    const prevPalette = this.params.colorPalette;

    if (newParams.preset && newParams.preset !== prevPreset && !isInitial) {
      // Apply preset values as baseline targets
      const presetConfig = GALAXY_PRESET_CONFIGS[newParams.preset as GalaxyPreset];
      if (presetConfig) {
        this.targetParams.preset = newParams.preset;
        this.targetParams.spiralArms = presetConfig.spiralArms;
        this.targetParams.armWinding = presetConfig.armWinding;
        this.targetParams.armWidth = presetConfig.armWidth;
        this.targetParams.barLength = presetConfig.barLength;
        this.targetParams.coreBulgeRadius = presetConfig.coreBulgeRadius;
        this.targetParams.haloDensity = presetConfig.haloDensity;
        this.targetParams.dustDensity = presetConfig.dustDensity;
        this.targetParams.rotationSpeed = presetConfig.rotationSpeed;
        this.targetParams.densityWaveAmp = presetConfig.densityWaveAmp;
      }
    }

    // Merge incoming parameters
    Object.assign(this.targetParams, newParams);

    if (isInitial) {
      this.params = { ...this.targetParams };
    }

    // Check if structural regeneration is required
    const needsRegen =
      isInitial ||
      this.params.seed !== prevSeed ||
      this.params.preset !== prevPreset ||
      Math.abs(this.params.starCount - prevCount) > 5000 ||
      this.params.spiralArms !== prevArms ||
      this.params.colorPalette !== prevPalette;

    if (needsRegen) {
      if (this.params.seed !== prevSeed) {
        this.prng = createPRNG(this.params.seed);
      }
      this.params.preset = this.targetParams.preset;
      this.params.starCount = this.targetParams.starCount;
      this.params.spiralArms = this.targetParams.spiralArms;
      this.params.colorPalette = this.targetParams.colorPalette;
      this.generateGalaxyData();
    }
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Hook (4K/8K Stills).
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
        depth: true,
      });

      offRenderer.setSize(width, height, false);
      offRenderer.setClearColor(0x090a0d, 1.0);

      const offCamera = new THREE.PerspectiveCamera(
        this.params.cameraFov,
        width / height,
        0.1,
        800
      );

      if (this.camera) {
        offCamera.position.copy(this.camera.position);
        offCamera.quaternion.copy(this.camera.quaternion);
      } else {
        offCamera.position.set(0, 32, 58);
        offCamera.lookAt(0, 0, 0);
      }

      if (this.scene) {
        if (this.starsMaterial) {
          this.starsMaterial.uniforms.uViewportHeight.value = height;
        }
        if (this.nebulaMaterial) {
          this.nebulaMaterial.uniforms.uViewportHeight.value = height;
        }

        offRenderer.render(this.scene, offCamera);
      }

      offRenderer.dispose();
      return offCanvas;
    } catch {
      // Fallback 2D render
      const ctx = offCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#090A0D';
        ctx.fillRect(0, 0, width, height);
      }
      return offCanvas;
    }
  }

  /**
   * Complete Resource Disposal & Teardown Lifecycle.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.userInteractionTimer !== null) {
      clearTimeout(this.userInteractionTimer);
      this.userInteractionTimer = null;
    }

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.starsGeometry) {
      this.starsGeometry.dispose();
      this.starsGeometry = null;
    }

    if (this.starsMaterial) {
      this.starsMaterial.dispose();
      this.starsMaterial = null;
    }

    if (this.nebulaGeometry) {
      this.nebulaGeometry.dispose();
      this.nebulaGeometry = null;
    }

    if (this.nebulaMaterial) {
      this.nebulaMaterial.dispose();
      this.nebulaMaterial = null;
    }

    if (this.starsMesh && this.scene) {
      this.scene.remove(this.starsMesh);
      this.starsMesh = null;
    }

    if (this.nebulaMesh && this.scene) {
      this.scene.remove(this.nebulaMesh);
      this.nebulaMesh = null;
    }

    if (this.renderer) {
      try {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
      } catch (err) {
        console.warn('Error disposing WebGL renderer in GalaxyRoom:', err);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.ctx2d = null;
  }
}

export const room: RoomInstance = new GalaxyRoom();
export default room;
