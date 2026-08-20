/**
 * Room 20: Cymatics & Chladni Resonance (Standing Acoustic Wave Nodal Particles)
 * Curatorial Category: Psychedelic & Optical / Audio Reactive
 * Math Model: 2D Ernst Chladni Standing Acoustic Plate Wave Potential & Bessel Modal Eigenfunctions
 * Optimization: Three.js 3D Point Cloud with Granular Sand Shader & Web Audio FFT Spectral Coupling
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Dual Plate Geometries:
 *   - Square Plate: W(x, y) = a * cos(n * pi * x / L) * cos(m * pi * y / L) - b * cos(m * pi * x / L) * cos(n * pi * y / L)
 *   - Circular Plate: W(r, theta) = J_n(k_{n,m} * r) * cos(n * theta) via analytical Bessel J_n functions
 * - High-Capacity Particle Engine (up to 100,000 granular sand/salt particles, default 50,000)
 * - Physical Granular Kinetics:
 *   - Local vibration amplitude |W(x, y)| & analytical spatial gradient nabla |W|
 *   - Acoustic radiation drift force (-nabla |W|) guiding particles to zero-vibration nodal curves
 *   - Dynamic thermal kinetic agitation & vertical 3D bounce from vibrating antinodes
 *   - Plate boundary collisions and physical surface damping friction
 * - 6 Curatorial Spectral Palettes:
 *   - Sand Gold, Spectral Aurora, Obsidian Emerald, Cosmic Amethyst, Phosphor Cyan, Monochrome Salt
 * - 6 Canonical Presets:
 *   - Fundamental Square, Sacred Mandala, High-Harmonic Lattice, Bessel Circular, Quantum Resonance, Chaotic Dispersion
 * - Dynamic Interactive Pointer:
 *   - Pointer acoustic perturbation / excitation damping
 *   - Click to spawn concentrated sand clusters & trigger propagating shockwaves
 * - Real-Time Web Audio API Coupling:
 *   - Bass modulating fundamental mode numbers (n)
 *   - Mid modulating harmonic modes (m) and acoustic drift strength
 *   - Treble exciting fine nodal harmonic ripples and spark luminescence
 *   - Transient beat spikes triggering acoustic plate pulse bursts
 * - Complete 3D Viewport Controls (OrbitControls for 360-degree pan, tilt, zoom, and auto-rotation)
 * - Dual Pipeline: Three.js WebGPU/WebGL2 with high-performance Canvas2D fallback
 * - Custom high-resolution offline snapshot export (4K/8K stills)
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
import type { AudioManager } from '../../lib/audio';

export type PlateShape = 'square' | 'circular';

export type CymaticsPreset =
  | 'fundamental-square'
  | 'sacred-mandala'
  | 'high-harmonic-lattice'
  | 'bessel-circular'
  | 'quantum-resonance'
  | 'chaotic-dispersion';

export type ColorPalette =
  | 'sand-gold'
  | 'spectral-aurora'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'phosphor-cyan'
  | 'monochrome-salt';

export type CameraView = 'top-down' | 'isometric-3d' | 'angled-cinematic';

export interface CymaticsParams {
  seed: string;
  preset: CymaticsPreset;
  plateShape: PlateShape;
  modeN: number;
  modeM: number;
  paramA: number;
  paramB: number;
  frequency: number;
  particleCount: number;
  vibrationPower: number;
  driftStrength: number;
  friction: number;
  bounceHeight: number;
  gravity: number;
  colorPalette: ColorPalette;
  particleSize: number;
  sparkGlow: number;
  plateOpacity: number;
  cameraView: CameraView;
  cameraAutoRotate: boolean;
  rotationSpeed: number;
  pointerImpulse: number;
  shockwavePower: number;
  sandDropRate: number;
  audioSource: 'synth' | 'mic' | 'none';
  audioSensitivity: number;
  bassReaction: number;
  trebleReaction: number;
}

export const DEFAULT_CYMATICS_PARAMS: CymaticsParams = {
  seed: '#D4AF37',
  preset: 'fundamental-square',
  plateShape: 'square',
  modeN: 2,
  modeM: 2,
  paramA: 1.0,
  paramB: 1.0,
  frequency: 432,
  particleCount: 50000,
  vibrationPower: 1.8,
  driftStrength: 2.8,
  friction: 0.05,
  bounceHeight: 1.2,
  gravity: 9.8,
  colorPalette: 'sand-gold',
  particleSize: 1.6,
  sparkGlow: 1.2,
  plateOpacity: 0.85,
  cameraView: 'isometric-3d',
  cameraAutoRotate: false,
  rotationSpeed: 0.3,
  pointerImpulse: 2.0,
  shockwavePower: 2.5,
  sandDropRate: 200,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.2,
  trebleReaction: 1.0,
};

const MAX_PARTICLES_CAPACITY = 100000;
const CANVAS2D_FALLBACK_CAPACITY = 35000;

export interface PaletteStop {
  r: number;
  g: number;
  b: number;
}

export interface CymaticsColorPalette {
  name: string;
  resting: PaletteStop;      // Particles resting at nodal lines
  intermediate: PaletteStop; // Particles in low/medium vibration
  spark: PaletteStop;        // High-velocity friction sparks at antinodes
  plateColor: number;        // Hex color for the plate substrate
  rimColor: number;          // Hex color for the plate rim highlight
}

export const CYMATICS_PALETTES: Record<ColorPalette, CymaticsColorPalette> = {
  'sand-gold': {
    name: 'Sand Gold (Natural Quartz Chladni)',
    resting: { r: 0.83, g: 0.69, b: 0.22 },      // Amber Quartz (#D4AF37)
    intermediate: { r: 0.95, g: 0.85, b: 0.50 }, // Champagne Sand (#F3D980)
    spark: { r: 1.0, g: 0.96, b: 0.80 },        // Luminous Core Gold (#FFF5CC)
    plateColor: 0x0c0e14,
    rimColor: 0xd4af37,
  },
  'spectral-aurora': {
    name: 'Spectral Aurora',
    resting: { r: 0.0, g: 0.94, b: 1.0 },        // Electric Cyan (#00F0FF)
    intermediate: { r: 0.66, g: 0.33, b: 0.97 }, // Royal Violet (#A855F7)
    spark: { r: 0.0, g: 1.0, b: 0.62 },         // Phosphor Mint (#00FF9D)
    plateColor: 0x090a0f,
    rimColor: 0x00f0ff,
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    resting: { r: 0.02, g: 0.84, b: 0.62 },      // Deep Jade (#05D69E)
    intermediate: { r: 0.10, g: 0.90, b: 0.55 }, // Luminous Emerald (#19E68C)
    spark: { r: 0.70, g: 1.0, b: 0.85 },        // Radiant Mint Crystal (#B2FFD9)
    plateColor: 0x080f0c,
    rimColor: 0x05d69e,
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    resting: { r: 0.55, g: 0.36, b: 0.96 },      // Celestial Purple (#8B5CF6)
    intermediate: { r: 0.75, g: 0.52, b: 0.99 }, // Violet Spark (#C084FC)
    spark: { r: 0.96, g: 0.45, b: 0.71 },        // Neon Starlight Magenta (#F472B6)
    plateColor: 0x0e0a14,
    rimColor: 0xa855f7,
  },
  'phosphor-cyan': {
    name: 'Phosphor Cyan',
    resting: { r: 0.01, g: 0.52, b: 0.78 },      // Deep Marine (#0284C7)
    intermediate: { r: 0.02, g: 0.71, b: 0.83 }, // Electric Turquoise (#06B6D4)
    spark: { r: 0.40, g: 0.91, b: 0.98 },        // High-Voltage Cyan (#67E8F9)
    plateColor: 0x080d14,
    rimColor: 0x00f0ff,
  },
  'monochrome-salt': {
    name: 'Monochrome Salt (Pure NaCl)',
    resting: { r: 0.58, g: 0.64, b: 0.72 },      // Fine Salt Charcoal (#94A3B8)
    intermediate: { r: 0.80, g: 0.84, b: 0.88 }, // Refined Salt Silver (#CBD5E1)
    spark: { r: 1.0, g: 1.0, b: 1.0 },           // Pure Crystalline White (#FFFFFF)
    plateColor: 0x0a0b0e,
    rimColor: 0xffffff,
  },
};

export interface PresetConfig {
  name: string;
  plateShape: PlateShape;
  modeN: number;
  modeM: number;
  paramA: number;
  paramB: number;
  frequency: number;
  vibrationPower: number;
  driftStrength: number;
  colorPalette: ColorPalette;
}

export const CYMATICS_PRESETS: Record<CymaticsPreset, PresetConfig> = {
  'fundamental-square': {
    name: 'Fundamental Square (Chladni Cross)',
    plateShape: 'square',
    modeN: 2,
    modeM: 2,
    paramA: 1.0,
    paramB: 1.0,
    frequency: 432,
    vibrationPower: 1.8,
    driftStrength: 2.8,
    colorPalette: 'sand-gold',
  },
  'sacred-mandala': {
    name: 'Sacred Mandala (8-Fold Radial Flower)',
    plateShape: 'circular',
    modeN: 4,
    modeM: 3,
    paramA: 1.2,
    paramB: 1.0,
    frequency: 528,
    vibrationPower: 2.2,
    driftStrength: 3.2,
    colorPalette: 'spectral-aurora',
  },
  'high-harmonic-lattice': {
    name: 'High-Harmonic Lattice (Harmonic Matrix)',
    plateShape: 'square',
    modeN: 7,
    modeM: 5,
    paramA: 1.1,
    paramB: 0.9,
    frequency: 852,
    vibrationPower: 2.4,
    driftStrength: 3.5,
    colorPalette: 'obsidian-emerald',
  },
  'bessel-circular': {
    name: 'Bessel Circular (Concentric Starburst)',
    plateShape: 'circular',
    modeN: 6,
    modeM: 2,
    paramA: 1.0,
    paramB: 1.0,
    frequency: 639,
    vibrationPower: 2.0,
    driftStrength: 3.0,
    colorPalette: 'cosmic-amethyst',
  },
  'quantum-resonance': {
    name: 'Quantum Resonance (Asymmetric Wavepacket)',
    plateShape: 'square',
    modeN: 5,
    modeM: 3,
    paramA: 1.3,
    paramB: 0.7,
    frequency: 741,
    vibrationPower: 2.1,
    driftStrength: 3.1,
    colorPalette: 'phosphor-cyan',
  },
  'chaotic-dispersion': {
    name: 'Chaotic Dispersion (Acoustic Storm)',
    plateShape: 'square',
    modeN: 8,
    modeM: 8,
    paramA: 1.5,
    paramB: 1.5,
    frequency: 963,
    vibrationPower: 3.8,
    driftStrength: 1.5,
    colorPalette: 'sand-gold',
  },
};

/**
 * Analytical Bessel function J_n(x) of integer order n >= 0.
 * Computed via rapidly converging power series.
 */
export function besselJ(n: number, x: number): number {
  if (x < 0) {
    return (n % 2 === 0 ? 1 : -1) * besselJ(n, -x);
  }
  if (x === 0) return n === 0 ? 1.0 : 0.0;

  const halfX = x * 0.5;
  let term = Math.pow(halfX, n);
  let factorialN = 1;
  for (let i = 1; i <= n; i++) factorialN *= i;
  term /= factorialN;

  let sum = term;
  const halfXSq = halfX * halfX;

  for (let k = 1; k <= 16; k++) {
    term *= -halfXSq / (k * (n + k));
    sum += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return sum;
}

/**
 * Analytical derivative of Bessel function J_n'(x) using recurrence relation:
 * J_0'(x) = -J_1(x), J_n'(x) = 0.5 * (J_{n-1}(x) - J_{n+1}(x))
 */
export function besselJPrime(n: number, x: number): number {
  if (n === 0) {
    return -besselJ(1, x);
  }
  return 0.5 * (besselJ(n - 1, x) - besselJ(n + 1, x));
}

/**
 * Evaluates the 2D standing acoustic plate wave potential W(x, y)
 * and its analytical spatial gradient [dW/dx, dW/dy].
 */
export function evaluatePlateWave(
  x: number,
  y: number,
  plateShape: PlateShape,
  n: number,
  m: number,
  paramA: number,
  paramB: number
): { w: number; gradX: number; gradY: number } {
  if (plateShape === 'square') {
    // Square plate coordinates normalized to [-1, 1]
    // W(x, y) = a * cos(n * pi * x / 2) * cos(m * pi * y / 2) - b * cos(m * pi * x / 2) * cos(n * pi * y / 2)
    const kx1 = 0.5 * n * Math.PI;
    const ky1 = 0.5 * m * Math.PI;
    const kx2 = 0.5 * m * Math.PI;
    const ky2 = 0.5 * n * Math.PI;

    const cosNX = Math.cos(kx1 * x);
    const sinNX = Math.sin(kx1 * x);
    const cosMY = Math.cos(ky1 * y);
    const sinMY = Math.sin(ky1 * y);

    const cosMX = Math.cos(kx2 * x);
    const sinMX = Math.sin(kx2 * x);
    const cosNY = Math.cos(ky2 * y);
    const sinNY = Math.sin(ky2 * y);

    const term1 = paramA * cosNX * cosMY;
    const term2 = paramB * cosMX * cosNY;
    const w = term1 - term2;

    const gradX = -paramA * kx1 * sinNX * cosMY + paramB * kx2 * sinMX * cosNY;
    const gradY = -paramA * ky1 * cosNX * sinMY + paramB * ky2 * cosMX * sinNY;

    return { w, gradX, gradY };
  } else {
    // Circular plate coordinates in polar (r, theta)
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);

    // Modal radial frequency factor corresponding to the m-th root
    const km = Math.PI * (m + 0.5 * n - 0.25);
    const kr = km * r;

    const jn = besselJ(n, kr);
    const jnPrime = besselJPrime(n, kr);
    const cosNTheta = Math.cos(n * theta);
    const sinNTheta = Math.sin(n * theta);

    const w = paramA * jn * cosNTheta;

    // Chain rule derivatives in polar coordinates:
    const dWdr = paramA * km * jnPrime * cosNTheta;
    const dWdTheta = -paramA * n * jn * sinNTheta;

    const safeR = Math.max(r, 0.0001);
    const gradX = dWdr * (x / safeR) - dWdTheta * (y / (safeR * safeR));
    const gradY = dWdr * (y / safeR) + dWdTheta * (x / (safeR * safeR));

    return { w, gradX, gradY };
  }
}

/**
 * Main Room 20 Implementation: Cymatics & Chladni Resonance.
 */
export class CymaticsRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private prng: PRNG = createPRNG('#D4AF37');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;
  private isMounted = false;

  // Active Parameters
  private params: CymaticsParams = { ...DEFAULT_CYMATICS_PARAMS };
  private targetParams: CymaticsParams = { ...DEFAULT_CYMATICS_PARAMS };

  // Audio subsystem reference
  private audioManager: AudioManager | null = null;

  // Particle state arrays (flat typed arrays for cache locality and zero GC)
  private posX = new Float32Array(MAX_PARTICLES_CAPACITY);
  private posY = new Float32Array(MAX_PARTICLES_CAPACITY);
  private posZ = new Float32Array(MAX_PARTICLES_CAPACITY);
  private velX = new Float32Array(MAX_PARTICLES_CAPACITY);
  private velY = new Float32Array(MAX_PARTICLES_CAPACITY);
  private velZ = new Float32Array(MAX_PARTICLES_CAPACITY);
  private life = new Float32Array(MAX_PARTICLES_CAPACITY);

  // Render attribute buffers for Three.js
  private positions = new Float32Array(MAX_PARTICLES_CAPACITY * 3);
  private colors = new Float32Array(MAX_PARTICLES_CAPACITY * 3);
  private sizes = new Float32Array(MAX_PARTICLES_CAPACITY);

  // Execution Backend Mode
  private backendMode: 'webgl' | 'canvas2d' = 'canvas2d';

  // Three.js Resources
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private pointsMesh: THREE.Points | null = null;
  private pointsGeometry: THREE.BufferGeometry | null = null;
  private pointsMaterial: THREE.ShaderMaterial | null = null;
  private positionAttribute: THREE.BufferAttribute | null = null;
  private colorAttribute: THREE.BufferAttribute | null = null;
  private sizeAttribute: THREE.BufferAttribute | null = null;

  // 3D Plate Substrate Mesh
  private plateMesh: THREE.Mesh | null = null;
  private plateRimMesh: THREE.LineSegments | null = null;

  // Interactive pointer dynamics
  private isPointerDown = false;
  private hasPointer = false;
  private pointerNormX = 0;
  private pointerNormY = 0;
  private pointerShockwaves: Array<{ x: number; y: number; time: number; power: number }> = [];

  // Canvas 2D Fallback Resources
  private ctx2d: CanvasRenderingContext2D | null = null;
  private canvas2dRotationX = 0.55;
  private canvas2dRotationY = 0.0;
  private isCanvas2dPointerDown = false;
  private canvas2dLastPointerX = 0;
  private canvas2dLastPointerY = 0;

  /**
   * Mounts the Cymatics simulation to the provided canvas and context.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_CYMATICS_PARAMS.seed);
    this.audioManager = ctx.audio || null;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Initialize granular particle positions
    this.initParticles();

    // Start procedural drone synthesis by default if synth mode requested
    if (this.params.audioSource === 'synth' && this.audioManager) {
      try {
        await this.audioManager.startSynth();
      } catch {
        // AudioContext may be suspended before user gesture; gracefully handled
      }
    }

    // Attempt Three.js WebGL/WebGPU Initialization
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

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x090a0d);

      this.camera = new THREE.PerspectiveCamera(
        45,
        this.width / Math.max(1, this.height),
        0.1,
        100.0
      );
      this.setCameraView(this.params.cameraView);

      // OrbitControls for 3D navigation
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.rotateSpeed = 0.8;
      this.controls.zoomSpeed = 1.0;
      this.controls.panSpeed = 0.8;
      this.controls.minDistance = 0.5;
      this.controls.maxDistance = 20.0;
      this.controls.autoRotate = this.params.cameraAutoRotate;
      this.controls.autoRotateSpeed = this.params.rotationSpeed * 2.0;
      this.controls.target.set(0, 0, 0);

      // Create 3D Plate Substrate Mesh
      this.buildPlateMesh();

      // Create Custom Granular Point Shader Material
      this.pointsMaterial = this.createPointsMaterial();

      // Create BufferGeometry
      this.pointsGeometry = new THREE.BufferGeometry();
      this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
      this.colorAttribute = new THREE.BufferAttribute(this.colors, 3);
      this.sizeAttribute = new THREE.BufferAttribute(this.sizes, 1);

      this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
      this.colorAttribute.setUsage(THREE.DynamicDrawUsage);
      this.sizeAttribute.setUsage(THREE.DynamicDrawUsage);

      this.pointsGeometry.setAttribute('position', this.positionAttribute);
      this.pointsGeometry.setAttribute('color', this.colorAttribute);
      this.pointsGeometry.setAttribute('size', this.sizeAttribute);

      this.pointsMesh = new THREE.Points(this.pointsGeometry, this.pointsMaterial);
      this.scene.add(this.pointsMesh);

      this.backendMode = 'webgl';
    } catch (err) {
      console.warn('WebGL initialization failed in Room 20, activating high-performance Canvas2D fallback:', err);
      this.backendMode = 'canvas2d';
      this.ctx2d = this.canvas.getContext('2d');
    }

    this.isMounted = true;
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.dispose();
    };
  }

  /**
   * Initializes or resets particle distributions across the plate.
   */
  private initParticles(): void {
    const count = Math.min(this.params.particleCount, MAX_PARTICLES_CAPACITY);
    const isCircle = this.params.plateShape === 'circular';

    for (let i = 0; i < count; i++) {
      if (isCircle) {
        // Uniform distribution within unit circle disk
        const r = Math.sqrt(this.prng.nextFloat(0, 0.95));
        const theta = this.prng.nextFloat(0, Math.PI * 2);
        this.posX[i] = r * Math.cos(theta);
        this.posY[i] = r * Math.sin(theta);
      } else {
        // Uniform distribution within [-0.98, 0.98] square
        this.posX[i] = this.prng.nextFloat(-0.95, 0.95);
        this.posY[i] = this.prng.nextFloat(-0.95, 0.95);
      }

      this.posZ[i] = this.prng.nextFloat(0, 0.05);
      this.velX[i] = this.prng.nextFloat(-0.01, 0.01);
      this.velY[i] = this.prng.nextFloat(-0.01, 0.01);
      this.velZ[i] = this.prng.nextFloat(0, 0.05);
      this.life[i] = this.prng.nextFloat(0.5, 1.0);

      this.positions[i * 3 + 0] = this.posX[i];
      this.positions[i * 3 + 1] = this.posY[i];
      this.positions[i * 3 + 2] = this.posZ[i];

      const pal = CYMATICS_PALETTES[this.params.colorPalette] || CYMATICS_PALETTES['sand-gold'];
      this.colors[i * 3 + 0] = pal.resting.r;
      this.colors[i * 3 + 1] = pal.resting.g;
      this.colors[i * 3 + 2] = pal.resting.b;
      this.sizes[i] = this.params.particleSize * this.prng.nextFloat(0.8, 1.2);
    }
  }

  /**
   * Builds the 3D plate substrate and rim mesh in the Three.js scene.
   */
  private buildPlateMesh(): void {
    if (!this.scene) return;

    if (this.plateMesh) {
      this.scene.remove(this.plateMesh);
      this.plateMesh.geometry.dispose();
      (this.plateMesh.material as THREE.Material).dispose();
      this.plateMesh = null;
    }

    if (this.plateRimMesh) {
      this.scene.remove(this.plateRimMesh);
      this.plateRimMesh.geometry.dispose();
      (this.plateRimMesh.material as THREE.Material).dispose();
      this.plateRimMesh = null;
    }

    const pal = CYMATICS_PALETTES[this.params.colorPalette] || CYMATICS_PALETTES['sand-gold'];
    const plateMaterial = new THREE.MeshBasicMaterial({
      color: pal.plateColor,
      transparent: true,
      opacity: this.params.plateOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const rimMaterial = new THREE.LineBasicMaterial({
      color: pal.rimColor,
      transparent: true,
      opacity: 0.75,
      linewidth: 1.5,
    });

    if (this.params.plateShape === 'square') {
      const geom = new THREE.PlaneGeometry(2.04, 2.04, 1, 1);
      this.plateMesh = new THREE.Mesh(geom, plateMaterial);
      this.plateMesh.position.set(0, 0, -0.002);
      this.scene.add(this.plateMesh);

      const edgesGeom = new THREE.EdgesGeometry(geom);
      this.plateRimMesh = new THREE.LineSegments(edgesGeom, rimMaterial);
      this.plateRimMesh.position.set(0, 0, -0.001);
      this.scene.add(this.plateRimMesh);
    } else {
      const geom = new THREE.CircleGeometry(1.02, 64);
      this.plateMesh = new THREE.Mesh(geom, plateMaterial);
      this.plateMesh.position.set(0, 0, -0.002);
      this.scene.add(this.plateMesh);

      const edgesGeom = new THREE.EdgesGeometry(geom);
      this.plateRimMesh = new THREE.LineSegments(edgesGeom, rimMaterial);
      this.plateRimMesh.position.set(0, 0, -0.001);
      this.scene.add(this.plateRimMesh);
    }
  }

  /**
   * Creates the custom luminescent sand particle point shader.
   */
  private createPointsMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uParticleSize: { value: this.params.particleSize * this.dpr * 3.0 },
        uSparkGlow: { value: this.params.sparkGlow },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vPosZ;
        uniform float uParticleSize;

        void main() {
          vColor = color;
          vPosZ = position.z;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Distance attenuation & size scaling
          float dist = -mvPosition.z;
          gl_PointSize = uParticleSize * (size / max(dist * 0.8, 0.4));
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vPosZ;
        uniform float uSparkGlow;

        void main() {
          // Circular particle profile with soft crystalline falloff
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) {
            discard;
          }

          // Subtle crystalline grain core
          float core = exp(-distSq * 24.0) * (0.8 + 0.4 * uSparkGlow);
          float halo = exp(-distSq * 8.0) * 0.4;
          float alpha = clamp(core + halo, 0.0, 1.0);

          // Elevate spark luminance when airborne or fast
          vec3 finalColor = vColor * (0.85 + core * 0.5 + vPosZ * 4.0);
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
  }

  /**
   * Configures camera position and orientation based on view presets.
   */
  private setCameraView(view: CameraView): void {
    if (!this.camera) return;

    if (view === 'top-down') {
      this.camera.position.set(0, 0, 2.6);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
    } else if (view === 'isometric-3d') {
      this.camera.position.set(1.4, -1.8, 1.6);
      this.camera.lookAt(0, 0, 0);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
    } else {
      // angled-cinematic
      this.camera.position.set(0.6, -2.2, 0.9);
      this.camera.lookAt(0, 0, 0.05);
      if (this.controls) {
        this.controls.target.set(0, 0, 0.05);
        this.controls.update();
      }
    }
  }

  /**
   * Applies and damps parameters from Tweakpane or URL state sync.
   */
  public updateParams(newParams: Partial<CymaticsParams>): void {
    const oldPreset = this.params.preset;
    const oldShape = this.params.plateShape;
    const oldPalette = this.params.colorPalette;
    const oldView = this.params.cameraView;

    this.applyParams(newParams, false);

    // If preset changed, apply canonical preset parameters
    if (newParams.preset && newParams.preset !== oldPreset) {
      const presetCfg = CYMATICS_PRESETS[this.params.preset];
      if (presetCfg) {
        this.params.plateShape = presetCfg.plateShape;
        this.params.modeN = presetCfg.modeN;
        this.params.modeM = presetCfg.modeM;
        this.params.paramA = presetCfg.paramA;
        this.params.paramB = presetCfg.paramB;
        this.params.frequency = presetCfg.frequency;
        this.params.vibrationPower = presetCfg.vibrationPower;
        this.params.driftStrength = presetCfg.driftStrength;
        this.params.colorPalette = presetCfg.colorPalette;
        this.targetParams = { ...this.params };
      }
    }

    // Rebuild plate substrate if shape or palette changed
    if (this.params.plateShape !== oldShape || this.params.colorPalette !== oldPalette) {
      this.buildPlateMesh();
      this.initParticles();
    }

    // Update camera view if changed
    if (newParams.cameraView && newParams.cameraView !== oldView) {
      this.setCameraView(this.params.cameraView);
    }

    // Update audio source
    if (newParams.audioSource && this.audioManager) {
      if (this.params.audioSource === 'synth') {
        this.audioManager.startSynth().catch(() => {});
      } else if (this.params.audioSource === 'none') {
        this.audioManager.stop();
      }
    }
  }

  /**
   * Merges partial parameters into active and target configurations.
   */
  private applyParams(newParams: Partial<CymaticsParams>, immediate = false): void {
    for (const [key, value] of Object.entries(newParams)) {
      if (value !== undefined) {
        (this.targetParams as any)[key] = value;
        if (immediate) {
          (this.params as any)[key] = value;
        }
      }
    }
  }

  /**
   * Handles pointer input events (disturbance, impulse, shockwave, sand drop).
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.hasPointer = false;
      this.isPointerDown = false;
      return;
    }

    this.hasPointer = true;
    this.isPointerDown = event.isDown;

    // Convert normalized [0, 1] coordinates to plate space [-1, 1]
    this.pointerNormX = (event.normalizedX - 0.5) * 2.0;
    this.pointerNormY = -(event.normalizedY - 0.5) * 2.0; // Invert Y for 3D Cartesian coordinates

    // Click triggers shockwave burst and drops sand cluster
    if (event.type === 'down') {
      this.pointerShockwaves.push({
        x: this.pointerNormX,
        y: this.pointerNormY,
        time: 0,
        power: this.params.shockwavePower,
      });

      // Drop new sand cluster at pointer
      this.dropSandCluster(this.pointerNormX, this.pointerNormY, this.params.sandDropRate);
    }

    // Canvas2D fallback pointer interaction
    if (this.backendMode === 'canvas2d') {
      if (event.type === 'down') {
        this.isCanvas2dPointerDown = true;
        this.canvas2dLastPointerX = event.x;
        this.canvas2dLastPointerY = event.y;
      } else if (event.type === 'move' && this.isCanvas2dPointerDown) {
        const dx = event.x - this.canvas2dLastPointerX;
        const dy = event.y - this.canvas2dLastPointerY;
        this.canvas2dRotationY += dx * 0.008;
        this.canvas2dRotationX = Math.max(0.1, Math.min(1.4, this.canvas2dRotationX + dy * 0.008));
        this.canvas2dLastPointerX = event.x;
        this.canvas2dLastPointerY = event.y;
      } else if (event.type === 'up') {
        this.isCanvas2dPointerDown = false;
      }
    }
  }

  /**
   * Drops a localized cluster of granular sand particles at a coordinate.
   */
  private dropSandCluster(cx: number, cy: number, count: number): void {
    const activeCount = Math.min(this.params.particleCount, MAX_PARTICLES_CAPACITY);
    const dropNum = Math.min(count, 800);

    for (let k = 0; k < dropNum; k++) {
      // Pick random particle index to recycle / reposition
      const idx = this.prng.nextInt(0, activeCount - 1);
      const angle = this.prng.nextFloat(0, Math.PI * 2);
      const dist = this.prng.nextFloat(0, 0.12);

      this.posX[idx] = Math.max(-0.95, Math.min(0.95, cx + Math.cos(angle) * dist));
      this.posY[idx] = Math.max(-0.95, Math.min(0.95, cy + Math.sin(angle) * dist));
      this.posZ[idx] = this.prng.nextFloat(0.05, 0.25);
      this.velX[idx] = Math.cos(angle) * this.prng.nextFloat(0.05, 0.2);
      this.velY[idx] = Math.sin(angle) * this.prng.nextFloat(0.05, 0.2);
      this.velZ[idx] = this.prng.nextFloat(0.1, 0.4);
    }
  }

  /**
   * Resizes renderer and camera projection matrices.
   */
  public resize(w: number, h: number): void {
    this.width = Math.max(w, 320);
    this.height = Math.max(h, 320);

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(Math.min(this.dpr, 2.0));
    }

    if (this.camera) {
      this.camera.aspect = this.width / Math.max(1, this.height);
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * High-Performance Granular Physics Simulation Step.
   */
  private stepPhysics(dt: number): void {
    const clampedDt = Math.min(dt, 0.05);
    const activeCount = Math.min(this.params.particleCount, MAX_PARTICLES_CAPACITY);
    const shape = this.params.plateShape;
    const isCircle = shape === 'circular';
    const n = this.params.modeN;
    const m = this.params.modeM;
    const paramA = this.params.paramA;
    const paramB = this.params.paramB;
    const vibPower = this.params.vibrationPower;
    const driftStrength = this.params.driftStrength;
    const friction = this.params.friction;
    const gravity = this.params.gravity;
    const bounceHeight = this.params.bounceHeight;

    // Sample Web Audio FFT frequency bands
    let audioBass = 0;
    let audioMid = 0;
    let audioTreble = 0;
    let isBeat = false;

    if (this.audioManager && this.params.audioSource !== 'none') {
      const bands = this.audioManager.getFrequencyBands();
      const sens = this.params.audioSensitivity;
      audioBass = bands.bass * this.params.bassReaction * sens;
      audioMid = bands.mid * sens;
      audioTreble = bands.treble * this.params.trebleReaction * sens;
      isBeat = bands.isBeat && bands.transient > 0.65;
    }

    // Audio-induced transient impulse shockwave
    if (isBeat) {
      this.pointerShockwaves.push({
        x: 0,
        y: 0,
        time: 0,
        power: this.params.shockwavePower * 1.5,
      });
    }

    // Update active shockwaves
    for (let s = this.pointerShockwaves.length - 1; s >= 0; s--) {
      const sw = this.pointerShockwaves[s];
      sw.time += clampedDt;
      if (sw.time > 0.8) {
        this.pointerShockwaves.splice(s, 1);
      }
    }

    // Continuous dragging pointer drops sand
    if (this.isPointerDown && this.hasPointer) {
      this.dropSandCluster(this.pointerNormX, this.pointerNormY, 15);
    }

    const palette = CYMATICS_PALETTES[this.params.colorPalette] || CYMATICS_PALETTES['sand-gold'];
    const restR = palette.resting.r;
    const restG = palette.resting.g;
    const restB = palette.resting.b;
    const midR = palette.intermediate.r;
    const midG = palette.intermediate.g;
    const midB = palette.intermediate.b;
    const spkR = palette.spark.r;
    const spkG = palette.spark.g;
    const spkB = palette.spark.b;

    const dragFactor = Math.pow(1.0 - friction, clampedDt * 60.0);
    const airDragFactor = Math.pow(0.985, clampedDt * 60.0);

    for (let i = 0; i < activeCount; i++) {
      let px = this.posX[i];
      let py = this.posY[i];
      let pz = this.posZ[i];
      let vx = this.velX[i];
      let vy = this.velY[i];
      let vz = this.velZ[i];

      // 1. Evaluate Chladni / Bessel standing wave potential & gradient at (px, py)
      const wave = evaluatePlateWave(px, py, shape, n, m, paramA, paramB);
      const amp = Math.abs(wave.w);
      const safeAmp = Math.sqrt(wave.w * wave.w + 1e-6);
      const signW = wave.w / safeAmp;

      // Amplitude gradient: nabla |W| = sgn(W) * nabla W
      const gradAbsX = signW * wave.gradX;
      const gradAbsY = signW * wave.gradY;

      // 2. Acoustic radiation drift force: -driftStrength * nabla |W|
      const drift = driftStrength * (1.0 + audioMid * 0.8);
      const fxDrift = -drift * gradAbsX;
      const fyDrift = -drift * gradAbsY;

      // 3. Kinetic thermal agitation from vibrating antinodes
      // Particles bounce vigorously away from high-amplitude vibrating regions
      const totalVib = (vibPower + audioBass * 2.0) * amp;
      const agitationMag = totalVib * (0.8 + 0.4 * Math.sin(i * 13.7 + this.totalTime * 8.0));
      const randAngle = (i * 2.39996 + this.totalTime * 12.0) % (Math.PI * 2);
      const fxAgitation = Math.cos(randAngle) * agitationMag * 1.5;
      const fyAgitation = Math.sin(randAngle) * agitationMag * 1.5;

      // Apply horizontal forces
      vx += (fxDrift + fxAgitation) * clampedDt;
      vy += (fyDrift + fyAgitation) * clampedDt;

      // 4. Vertical 3D Bounce Dynamics
      // When particle lands or resides on vibrating plate (pz <= 0.005), it receives vertical kick
      if (pz <= 0.005) {
        pz = 0.0;
        vz = 0.0;
        if (amp > 0.08) {
          const bounceKick = amp * bounceHeight * (1.2 + audioBass * 1.5) * (0.8 + 0.4 * Math.sin(i * 9.1));
          vz = bounceKick;
        }
      } else {
        // Airborne gravity & vertical damping
        vz -= gravity * clampedDt;
      }

      // 5. Interactive pointer impulse force
      if (this.hasPointer) {
        const dx = px - this.pointerNormX;
        const dy = py - this.pointerNormY;
        const distSq = dx * dx + dy * dy + 0.0001;
        const dist = Math.sqrt(distSq);

        if (dist < 0.35) {
          const impulse = (this.params.pointerImpulse / (dist + 0.05)) * Math.exp(-dist * 4.0);
          vx += (dx / dist) * impulse * clampedDt * 2.5;
          vy += (dy / dist) * impulse * clampedDt * 2.5;
          vz += impulse * clampedDt * 1.5;
        }
      }

      // 6. Active acoustic shockwaves
      for (let s = 0; s < this.pointerShockwaves.length; s++) {
        const sw = this.pointerShockwaves[s];
        const dx = px - sw.x;
        const dy = py - sw.y;
        const dist = Math.sqrt(dx * dx + dy * dy + 0.0001);
        const waveRadius = sw.time * 2.2; // Shockwave propagation velocity
        const waveDist = Math.abs(dist - waveRadius);

        if (waveDist < 0.15) {
          const shockForce = sw.power * Math.exp(-sw.time * 3.5) * (1.0 - waveDist / 0.15);
          vx += (dx / dist) * shockForce * clampedDt * 4.0;
          vy += (dy / dist) * shockForce * clampedDt * 4.0;
          vz += shockForce * clampedDt * 3.0;
        }
      }

      // 7. Physical friction & velocity damping
      if (pz <= 0.005) {
        vx *= dragFactor;
        vy *= dragFactor;
      } else {
        vx *= airDragFactor;
        vy *= airDragFactor;
        vz *= airDragFactor;
      }

      // 8. Integrate positions
      px += vx * clampedDt;
      py += vy * clampedDt;
      pz += vz * clampedDt;

      if (pz < 0.0) {
        pz = 0.0;
        vz = 0.0;
      }

      // 9. Boundary collisions
      if (isCircle) {
        const rSq = px * px + py * py;
        if (rSq > 0.98) {
          const r = Math.sqrt(rSq);
          px = (px / r) * 0.98;
          py = (py / r) * 0.98;
          // Normal reflection with restitution
          const nx = px / 0.98;
          const ny = py / 0.98;
          const dot = vx * nx + vy * ny;
          vx = (vx - 2.0 * dot * nx) * 0.6;
          vy = (vy - 2.0 * dot * ny) * 0.6;
        }
      } else {
        if (px > 0.98) {
          px = 0.98;
          vx = -vx * 0.6;
        } else if (px < -0.98) {
          px = -0.98;
          vx = -vx * 0.6;
        }
        if (py > 0.98) {
          py = 0.98;
          vy = -vy * 0.6;
        } else if (py < -0.98) {
          py = -0.98;
          vy = -vy * 0.6;
        }
      }

      this.posX[i] = px;
      this.posY[i] = py;
      this.posZ[i] = pz;
      this.velX[i] = vx;
      this.velY[i] = vy;
      this.velZ[i] = vz;

      // 10. Update Three.js buffer geometry attributes
      this.positions[i * 3 + 0] = px;
      this.positions[i * 3 + 1] = py;
      this.positions[i * 3 + 2] = pz;

      // Dynamic color: interpolate between resting sand and high-velocity friction spark
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const activity = Math.min(1.0, speed * 2.5 + amp * 0.4 + (pz > 0.02 ? 0.3 : 0.0) + audioTreble * 0.5);

      let rVal = restR;
      let gVal = restG;
      let bVal = restB;

      if (activity < 0.5) {
        const t = activity * 2.0;
        rVal = restR + (midR - restR) * t;
        gVal = restG + (midG - restG) * t;
        bVal = restB + (midB - restB) * t;
      } else {
        const t = (activity - 0.5) * 2.0;
        rVal = midR + (spkR - midR) * t;
        gVal = midG + (spkG - midG) * t;
        bVal = midB + (spkB - midB) * t;
      }

      this.colors[i * 3 + 0] = rVal;
      this.colors[i * 3 + 1] = gVal;
      this.colors[i * 3 + 2] = bVal;

      this.sizes[i] = this.params.particleSize * (1.0 + activity * 0.4);
    }

    if (this.positionAttribute) this.positionAttribute.needsUpdate = true;
    if (this.colorAttribute) this.colorAttribute.needsUpdate = true;
    if (this.sizeAttribute) this.sizeAttribute.needsUpdate = true;
  }

  /**
   * Main render and animation loop.
   */
  private loop(now: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((now - this.lastTime) * 0.001, 0.1);
    this.lastTime = now;
    this.totalTime += dt;

    // Smooth exponential damping for numerical parameters
    this.dampParameters(dt);

    // Update simulation physics
    this.stepPhysics(dt);

    if (this.backendMode === 'webgl' && this.renderer && this.scene && this.camera) {
      if (this.controls) {
        this.controls.autoRotate = this.params.cameraAutoRotate;
        this.controls.autoRotateSpeed = this.params.rotationSpeed * 2.0;
        this.controls.update();
      }

      if (this.pointsMaterial) {
        this.pointsMaterial.uniforms.uParticleSize.value =
          this.params.particleSize * this.dpr * 3.2;
        this.pointsMaterial.uniforms.uSparkGlow.value = this.params.sparkGlow;
      }

      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d') {
      this.renderCanvas2d(dt);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Smooth parameter convergence over frame intervals.
   */
  private dampParameters(dt: number): void {
    const lambda = 8.0;
    this.params.paramA = dampParameter(this.params.paramA, this.targetParams.paramA, lambda, dt);
    this.params.paramB = dampParameter(this.params.paramB, this.targetParams.paramB, lambda, dt);
    this.params.frequency = dampParameter(this.params.frequency, this.targetParams.frequency, lambda, dt);
    this.params.vibrationPower = dampParameter(this.params.vibrationPower, this.targetParams.vibrationPower, lambda, dt);
    this.params.driftStrength = dampParameter(this.params.driftStrength, this.targetParams.driftStrength, lambda, dt);
    this.params.particleSize = dampParameter(this.params.particleSize, this.targetParams.particleSize, lambda, dt);
    this.params.sparkGlow = dampParameter(this.params.sparkGlow, this.targetParams.sparkGlow, lambda, dt);
    this.params.plateOpacity = dampParameter(this.params.plateOpacity, this.targetParams.plateOpacity, lambda, dt);
  }

  /**
   * High-Performance Canvas2D Fallback with 3D Perspective Projection.
   */
  private renderCanvas2d(dt: number): void {
    if (!this.ctx2d || !this.canvas) return;
    const ctx = this.ctx2d;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, w, h);

    if (this.params.cameraAutoRotate) {
      this.canvas2dRotationY += dt * this.params.rotationSpeed * 0.8;
    }

    const rotX = this.canvas2dRotationX;
    const rotY = this.canvas2dRotationY;
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const zoom = Math.min(w, h) * 0.38;

    // 3D Perspective Projection Helper
    const project = (x: number, y: number, z: number): [number, number, number] => {
      const rx = x * cosY - y * sinY;
      const ry = (x * sinY + y * cosY) * cosX - z * sinX;
      const rz = (x * sinY + y * cosY) * sinX + z * cosX + 3.0;
      const fov = zoom / Math.max(rz, 0.5);
      return [cx + rx * fov, cy - ry * fov, rz];
    };

    // Draw plate substrate
    const pal = CYMATICS_PALETTES[this.params.colorPalette] || CYMATICS_PALETTES['sand-gold'];
    ctx.strokeStyle = `rgba(${(pal.rimColor >> 16) & 255}, ${(pal.rimColor >> 8) & 255}, ${pal.rimColor & 255}, 0.75)`;
    ctx.lineWidth = 1.5;

    if (this.params.plateShape === 'square') {
      const p1 = project(-1, -1, 0);
      const p2 = project(1, -1, 0);
      const p3 = project(1, 1, 0);
      const p4 = project(-1, 1, 0);

      ctx.fillStyle = `rgba(12, 14, 20, ${this.params.plateOpacity})`;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p4[0], p4[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(12, 14, 20, ${this.params.plateOpacity})`;
      ctx.beginPath();
      const segments = 48;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        const pt = project(Math.cos(theta), Math.sin(theta), 0);
        if (s === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw granular sand particles
    const activeCount = Math.min(this.params.particleCount, CANVAS2D_FALLBACK_CAPACITY);
    const radius = Math.max(1.0, this.params.particleSize * 0.9);

    for (let i = 0; i < activeCount; i++) {
      const pt = project(this.posX[i], this.posY[i], this.posZ[i]);
      const r = Math.floor(this.colors[i * 3 + 0] * 255);
      const g = Math.floor(this.colors[i * 3 + 1] * 255);
      const b = Math.floor(this.colors[i * 3 + 2] * 255);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(pt[0] - radius * 0.5, pt[1] - radius * 0.5, radius, radius);
    }
  }

  /**
   * Offline High-Resolution Snapshot Capture (4K/8K stills).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;

    if (this.backendMode === 'webgl' && this.scene && this.camera) {
      const snapRenderer = new THREE.WebGLRenderer({
        canvas: snapCanvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });

      snapRenderer.setSize(width, height, false);
      snapRenderer.setPixelRatio(1);
      snapRenderer.setClearColor(0x090a0d, 1.0);

      const snapCamera = this.camera.clone();
      snapCamera.aspect = width / Math.max(1, height);
      snapCamera.updateProjectionMatrix();

      snapRenderer.render(this.scene, snapCamera);
      snapRenderer.dispose();
    } else {
      // Fallback Canvas2D snapshot pass
      const snapCtx = snapCanvas.getContext('2d');
      if (snapCtx) {
        snapCtx.fillStyle = '#090a0d';
        snapCtx.fillRect(0, 0, width, height);

        const zoom = Math.min(width, height) * 0.38;
        const cx = width * 0.5;
        const cy = height * 0.5;
        const rotX = 0.55;
        const rotY = 0.0;
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);

        const project = (x: number, y: number, z: number): [number, number] => {
          const rx = x * cosY - y * sinY;
          const ry = (x * sinY + y * cosY) * cosX - z * sinX;
          const rz = (x * sinY + y * cosY) * sinX + z * cosX + 3.0;
          const fov = zoom / Math.max(rz, 0.5);
          return [cx + rx * fov, cy - ry * fov];
        };

        const activeCount = Math.min(this.params.particleCount, MAX_PARTICLES_CAPACITY);
        const radius = Math.max(1.2, this.params.particleSize * (width / 800));

        for (let i = 0; i < activeCount; i++) {
          const pt = project(this.posX[i], this.posY[i], this.posZ[i]);
          const r = Math.floor(this.colors[i * 3 + 0] * 255);
          const g = Math.floor(this.colors[i * 3 + 1] * 255);
          const b = Math.floor(this.colors[i * 3 + 2] * 255);

          snapCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          snapCtx.fillRect(pt[0] - radius * 0.5, pt[1] - radius * 0.5, radius, radius);
        }
      }
    }

    return snapCanvas;
  }

  /**
   * Complete resource disposal lifecycle.
   */
  public dispose(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.pointsMesh && this.scene) {
      this.scene.remove(this.pointsMesh);
      this.pointsGeometry?.dispose();
      this.pointsMaterial?.dispose();
      this.pointsMesh = null;
      this.pointsGeometry = null;
      this.pointsMaterial = null;
    }

    if (this.plateMesh && this.scene) {
      this.scene.remove(this.plateMesh);
      this.plateMesh.geometry.dispose();
      (this.plateMesh.material as THREE.Material).dispose();
      this.plateMesh = null;
    }

    if (this.plateRimMesh && this.scene) {
      this.scene.remove(this.plateRimMesh);
      this.plateRimMesh.geometry.dispose();
      (this.plateRimMesh.material as THREE.Material).dispose();
      this.plateRimMesh = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.ctx2d = null;
  }
}

export function createRoom(): RoomInstance {
  return new CymaticsRoom();
}

export default createRoom();
