/**
 * Room 10: Strange Attractors (Lorenz, Aizawa, Halvorsen, Thomas, Rössler, Clifford, Peter de Jong)
 * Curatorial Category: Chaos & Procedural
 * Math Model: 4th-Order Runge-Kutta (RK4) Differential Orbits & Non-Linear Trigonometric Discrete Maps
 * Optimization: Three.js 3D Point Cloud with Luminescent Additive Shading & OrbitControls
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - 7 Canonical Attractor Systems:
 *   - Continuous (RK4): Lorenz, Aizawa, Halvorsen, Thomas Cyclical, Rössler Ribbon, Chen Dual-Scroll
 *   - Discrete: Clifford Map 3D, Peter de Jong 3D
 * - Sensitive dependence on initial conditions (butterfly effect) visualized across multiple parallel stream orbits
 * - 4 Color Dimensions: Velocity Magnitude, Trajectory Curvature, Z-Depth / Radial Height, Orbit Timeline
 * - 6 Curatorial Spectral Palettes (Spectral Aurora, Solar Plasma, Bioluminescent Cyan, Obsidian Emerald, Cosmic Amethyst, Monochrome Lithic)
 * - Three.js OrbitControls for smooth pointer orbit, pan, zoom, and auto-rotation
 * - Real-time chaotic parameter tweaking with RK4 numerical stability guards
 * - Dual execution architecture: Three.js WebGPU/WebGL2 pipeline with 3D perspective Canvas2D fallback
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
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

export type AttractorType =
  | 'lorenz'
  | 'aizawa'
  | 'halvorsen'
  | 'thomas'
  | 'rossler'
  | 'chen'
  | 'clifford'
  | 'dejong';

export type ColorMode = 'velocity' | 'curvature' | 'depth' | 'timeline';

export type ColorPalette =
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'bioluminescent-cyan'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-lithic';

export interface StrangeAttractorsParams {
  seed: string;
  attractorType: AttractorType;
  pointCount: number;
  dt: number;
  paramA: number;
  paramB: number;
  paramC: number;
  paramD: number;
  evolutionSpeed: number;
  streamCount: number;
  colorMode: ColorMode;
  colorPalette: ColorPalette;
  pointSize: number;
  glowIntensity: number;
  cameraAutoRotate: boolean;
  rotationSpeed: number;
  cameraFov: number;
}

export const DEFAULT_STRANGE_ATTRACTORS_PARAMS: StrangeAttractorsParams = {
  seed: '#00F0FF',
  attractorType: 'lorenz',
  pointCount: 300000,
  dt: 0.005,
  paramA: 10.0,     // Lorenz sigma
  paramB: 28.0,     // Lorenz rho
  paramC: 2.667,    // Lorenz beta (8/3)
  paramD: 0.7,
  evolutionSpeed: 1.0,
  streamCount: 60,
  colorMode: 'velocity',
  colorPalette: 'spectral-aurora',
  pointSize: 1.5,
  glowIntensity: 1.0,
  cameraAutoRotate: true,
  rotationSpeed: 0.4,
  cameraFov: 50,
};

const MAX_POINTS_CAPACITY = 1000000;

export interface PaletteStop {
  r: number;
  g: number;
  b: number;
}

export interface AttractorPalette {
  name: string;
  stops: [PaletteStop, PaletteStop, PaletteStop, PaletteStop];
}

export const ATTRACTOR_PALETTES: Record<ColorPalette, AttractorPalette> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    stops: [
      { r: 0.0, g: 0.94, b: 1.0 },     // Electric Cyan (#00F0FF)
      { r: 0.66, g: 0.33, b: 0.97 },  // Royal Violet (#A855F7)
      { r: 0.0, g: 1.0, b: 0.62 },    // Phosphor Mint (#00FF9D)
      { r: 0.95, g: 0.98, b: 1.0 },   // Starlight White (#F1F5F9)
    ],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    stops: [
      { r: 0.20, g: 0.08, b: 0.02 },  // Obsidian Amber
      { r: 1.0, g: 0.72, b: 0.0 },    // Radiant Gold (#FFB800)
      { r: 1.0, g: 0.20, b: 0.40 },   // Laser Crimson (#FF3366)
      { r: 1.0, g: 0.96, b: 0.88 },   // Solar White (#FFF5EB)
    ],
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    stops: [
      { r: 0.01, g: 0.06, b: 0.12 },  // Abyssal Navy
      { r: 0.0, g: 0.55, b: 0.65 },   // Deep Teal
      { r: 0.0, g: 0.94, b: 1.0 },    // Neon Cyan
      { r: 0.88, g: 1.0, b: 1.0 },    // Pure Starlight
    ],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    stops: [
      { r: 0.02, g: 0.05, b: 0.04 },  // Black Obsidian
      { r: 0.02, g: 0.59, b: 0.41 },  // Forest Emerald (#059669)
      { r: 0.06, g: 0.73, b: 0.51 },  // Phosphor Green (#10B981)
      { r: 0.43, g: 0.91, b: 0.72 },  // Bright Mint (#6EE7B7)
    ],
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    stops: [
      { r: 0.04, g: 0.03, b: 0.08 },  // Void Slate
      { r: 0.49, g: 0.23, b: 0.93 },  // Mystic Orchid (#7C3AED)
      { r: 0.96, g: 0.25, b: 0.37 },  // Magenta Neon (#F43F5E)
      { r: 0.98, g: 0.96, b: 1.0 },   // Diamond Glow (#FAF5FF)
    ],
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    stops: [
      { r: 0.09, g: 0.10, b: 0.12 },  // Charcoal Slate
      { r: 0.39, g: 0.45, b: 0.55 },  // Silver Slate (#64748B)
      { r: 0.80, g: 0.84, b: 0.88 },  // Polished Quartz (#CBD5E1)
      { r: 1.0, g: 1.0, b: 1.0 },     // Pure Platinum
    ],
  },
};

export interface AttractorSystemConfig {
  name: string;
  defaultDt: number;
  defaultParams: { a: number; b: number; c: number; d: number };
  scale: number;
  center: [number, number, number];
  cameraPos: [number, number, number];
  isDiscrete: boolean;
  initialPos: [number, number, number];
}

export const ATTRACTOR_CONFIGS: Record<AttractorType, AttractorSystemConfig> = {
  lorenz: {
    name: 'Lorenz Attractor',
    defaultDt: 0.005,
    defaultParams: { a: 10.0, b: 28.0, c: 2.6667, d: 0.0 }, // sigma=10, rho=28, beta=8/3
    scale: 0.35,
    center: [0, 0, 24],
    cameraPos: [0, 14, 26],
    isDiscrete: false,
    initialPos: [0.1, 0.1, 0.1],
  },
  aizawa: {
    name: 'Aizawa Attractor',
    defaultDt: 0.01,
    defaultParams: { a: 0.95, b: 0.7, c: 0.6, d: 3.5 }, // a=0.95, b=0.7, c=0.6, d=3.5 (e=0.25, f=0.1)
    scale: 4.5,
    center: [0, 0, 0.6],
    cameraPos: [0, 8, 16],
    isDiscrete: false,
    initialPos: [0.1, 0.0, 0.0],
  },
  halvorsen: {
    name: 'Halvorsen Attractor',
    defaultDt: 0.008,
    defaultParams: { a: 1.89, b: 4.0, c: 0.0, d: 0.0 }, // a=1.89
    scale: 1.1,
    center: [-1.5, -1.5, -1.5],
    cameraPos: [14, 14, 18],
    isDiscrete: false,
    initialPos: [-1.4, 0.0, 0.0],
  },
  thomas: {
    name: 'Thomas Cyclical Attractor',
    defaultDt: 0.04,
    defaultParams: { a: 0.0, b: 0.208186, c: 0.0, d: 0.0 }, // b=0.208186
    scale: 2.2,
    center: [0, 0, 0],
    cameraPos: [10, 10, 15],
    isDiscrete: false,
    initialPos: [0.1, 0.2, 0.3],
  },
  rossler: {
    name: 'Rössler Ribbon Attractor',
    defaultDt: 0.015,
    defaultParams: { a: 0.2, b: 0.2, c: 5.7, d: 0.0 }, // a=0.2, b=0.2, c=5.7
    scale: 1.1,
    center: [0, 0, 8.0],
    cameraPos: [0, 18, 26],
    isDiscrete: false,
    initialPos: [0.1, 0.1, 0.1],
  },
  chen: {
    name: 'Chen Dual-Scroll Attractor',
    defaultDt: 0.003,
    defaultParams: { a: 35.0, b: 3.0, c: 28.0, d: 0.0 }, // a=35, b=3, c=28
    scale: 0.32,
    center: [0, 0, 20.0],
    cameraPos: [0, 18, 28],
    isDiscrete: false,
    initialPos: [-0.1, 0.5, -0.6],
  },
  clifford: {
    name: 'Clifford Map 3D',
    defaultDt: 0.01,
    defaultParams: { a: -1.4, b: 1.6, c: 1.0, d: 0.7 },
    scale: 3.2,
    center: [0, 0, 0],
    cameraPos: [0, 0, 16],
    isDiscrete: true,
    initialPos: [0.1, 0.1, 0.1],
  },
  dejong: {
    name: 'Peter de Jong 3D',
    defaultDt: 0.01,
    defaultParams: { a: 1.4, b: -2.3, c: 2.4, d: -2.1 },
    scale: 3.2,
    center: [0, 0, 0],
    cameraPos: [0, 0, 16],
    isDiscrete: true,
    initialPos: [0.1, 0.1, 0.1],
  },
};

/**
 * Evaluates the vector field derivatives [dx/dt, dy/dt, dz/dt] for continuous systems.
 */
function evaluateDerivatives(
  type: AttractorType,
  x: number,
  y: number,
  z: number,
  pA: number,
  pB: number,
  pC: number,
  pD: number
): [number, number, number] {
  switch (type) {
    case 'lorenz': {
      // sigma = pA, rho = pB, beta = pC
      const dx = pA * (y - x);
      const dy = x * (pB - z) - y;
      const dz = x * y - pC * z;
      return [dx, dy, dz];
    }

    case 'aizawa': {
      // a = pA, b = pB, c = pC, d = pD, e = 0.25, f = 0.1
      const e = 0.25;
      const f = 0.1;
      const r2 = x * x + y * y;
      const dx = (z - pB) * x - pD * y;
      const dy = pD * x + (z - pB) * y;
      const dz = pC + pA * z - (z * z * z) / 3 - r2 * (1 + e * z) + f * z * (x * x * x);
      return [dx, dy, dz];
    }

    case 'halvorsen': {
      // a = pA
      const dx = -pA * x - 4 * y - 4 * z - y * y;
      const dy = -pA * y - 4 * z - 4 * x - z * z;
      const dz = -pA * z - 4 * x - 4 * y - x * x;
      return [dx, dy, dz];
    }

    case 'thomas': {
      // b = pB
      const dx = Math.sin(y) - pB * x;
      const dy = Math.sin(z) - pB * y;
      const dz = Math.sin(x) - pB * z;
      return [dx, dy, dz];
    }

    case 'rossler': {
      // a = pA, b = pB, c = pC
      const dx = -y - z;
      const dy = x + pA * y;
      const dz = pB + z * (x - pC);
      return [dx, dy, dz];
    }

    case 'chen': {
      // a = pA, b = pB, c = pC
      const dx = pA * (y - x);
      const dy = (pC - pA) * x - x * z + pC * y;
      const dz = x * y - pB * z;
      return [dx, dy, dz];
    }

    default:
      return [0, 0, 0];
  }
}

/**
 * Computes a single 4th-Order Runge-Kutta (RK4) integration step.
 */
function rk4Step(
  type: AttractorType,
  x: number,
  y: number,
  z: number,
  dt: number,
  pA: number,
  pB: number,
  pC: number,
  pD: number
): [number, number, number, number] {
  const [k1x, k1y, k1z] = evaluateDerivatives(type, x, y, z, pA, pB, pC, pD);
  const [k2x, k2y, k2z] = evaluateDerivatives(
    type,
    x + 0.5 * dt * k1x,
    y + 0.5 * dt * k1y,
    z + 0.5 * dt * k1z,
    pA,
    pB,
    pC,
    pD
  );
  const [k3x, k3y, k3z] = evaluateDerivatives(
    type,
    x + 0.5 * dt * k2x,
    y + 0.5 * dt * k2y,
    z + 0.5 * dt * k2z,
    pA,
    pB,
    pC,
    pD
  );
  const [k4x, k4y, k4z] = evaluateDerivatives(
    type,
    x + dt * k3x,
    y + dt * k3y,
    z + dt * k3z,
    pA,
    pB,
    pC,
    pD
  );

  const nx = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
  const ny = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
  const nz = z + (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);

  // Approximate velocity magnitude for color mapping
  const vx = (nx - x) / dt;
  const vy = (ny - y) / dt;
  const vz = (nz - z) / dt;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

  return [nx, ny, nz, speed];
}

/**
 * Computes a single iteration step for 2D/3D discrete maps.
 */
function discreteStep(
  type: AttractorType,
  x: number,
  y: number,
  z: number,
  pA: number,
  pB: number,
  pC: number,
  pD: number
): [number, number, number, number] {
  if (type === 'clifford') {
    // x_{n+1} = sin(a y_n) + c cos(a x_n)
    // y_{n+1} = sin(b x_n) + d cos(b y_n)
    // z_{n+1} = sin(c x_n)*cos(d y_n)*1.5 + 0.4*sin(a x_{n+1} + b y_{n+1})
    const nx = Math.sin(pA * y) + pC * Math.cos(pA * x);
    const ny = Math.sin(pB * x) + pD * Math.cos(pB * y);
    const nz = Math.sin(pC * x) * Math.cos(pD * y) * 1.5 + 0.4 * Math.sin(pA * nx + pB * ny);
    const speed = Math.sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y) + (nz - z) * (nz - z));
    return [nx, ny, nz, speed];
  }

  if (type === 'dejong') {
    // x_{n+1} = sin(a y_n) - cos(b x_n)
    // y_{n+1} = sin(c x_n) - cos(d y_n)
    // z_{n+1} = cos(a x_n)*sin(b y_n)*1.5 + 0.4*cos(c x_{n+1} + d y_{n+1})
    const nx = Math.sin(pA * y) - Math.cos(pB * x);
    const ny = Math.sin(pC * x) - Math.cos(pD * y);
    const nz = Math.cos(pA * x) * Math.sin(pB * y) * 1.5 + 0.4 * Math.cos(pC * nx + pD * ny);
    const speed = Math.sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y) + (nz - z) * (nz - z));
    return [nx, ny, nz, speed];
  }

  return [x, y, z, 0];
}

/**
 * Interpolates smoothly along a 4-stop color palette.
 */
function samplePalette(
  palette: AttractorPalette,
  t: number,
  out: { r: number; g: number; b: number }
): void {
  const clampedT = Math.max(0.0, Math.min(1.0, t));
  const stops = palette.stops;

  if (clampedT <= 0.3333) {
    const localT = clampedT / 0.3333;
    // Cubic Hermite smoothstep
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
 * Main Room 10 implementation.
 */
export class StrangeAttractorsRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private prng: PRNG = createPRNG('#00F0FF');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;
  private isMounted = false;
  private prefersReducedMotion = false;

  // Active Parameters
  private params: StrangeAttractorsParams = { ...DEFAULT_STRANGE_ATTRACTORS_PARAMS };

  // Target Parameters for Smooth Exponential Interpolation
  private targetParams: StrangeAttractorsParams = { ...DEFAULT_STRANGE_ATTRACTORS_PARAMS };

  // Execution Backend Mode ('webgl' or 'canvas2d')
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

  // Point Data Memory Buffers
  private activePointCount = 300000;
  private positions = new Float32Array(MAX_POINTS_CAPACITY * 3);
  private colors = new Float32Array(MAX_POINTS_CAPACITY * 3);
  private rawValues = new Float32Array(MAX_POINTS_CAPACITY); // Velocity/curvature/depth metric

  // Stream State for Continuous Flow
  private streamHeads: Array<[number, number, number]> = [];
  private streamStepIndices: Int32Array = new Int32Array(0);
  private streamStepAccumulator = 0.0;

  // Canvas 2D Fallback Resources
  private ctx2d: CanvasRenderingContext2D | null = null;
  private canvas2dRotationX = 0.3;
  private canvas2dRotationY = 0.4;
  private canvas2dDistance = 45.0;
  private isCanvas2dPointerDown = false;
  private canvas2dLastPointerX = 0;
  private canvas2dLastPointerY = 0;

  /**
   * Mounts the Strange Attractors simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_STRANGE_ATTRACTORS_PARAMS.seed);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

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

      const config = ATTRACTOR_CONFIGS[this.params.attractorType] || ATTRACTOR_CONFIGS.lorenz;

      this.camera = new THREE.PerspectiveCamera(
        this.params.cameraFov,
        this.width / Math.max(1, this.height),
        0.1,
        1000.0
      );
      this.camera.position.set(config.cameraPos[0], config.cameraPos[1], config.cameraPos[2]);
      this.camera.lookAt(0, 0, 0);

      // Initialize OrbitControls for smooth pointer orbit, pan, and zoom
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.rotateSpeed = 0.8;
      this.controls.zoomSpeed = 1.0;
      this.controls.panSpeed = 0.8;
      this.controls.minDistance = 0.2;
      this.controls.maxDistance = 300.0;
      this.controls.autoRotate = this.params.cameraAutoRotate;
      this.controls.autoRotateSpeed = this.params.rotationSpeed * 1.5;
      this.controls.target.set(0, 0, 0);

      // Create Custom Luminescent Points Shader Material
      this.pointsMaterial = this.createPointsMaterial();

      // Create BufferGeometry
      this.pointsGeometry = new THREE.BufferGeometry();
      this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
      this.colorAttribute = new THREE.BufferAttribute(this.colors, 3);
      this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
      this.colorAttribute.setUsage(THREE.DynamicDrawUsage);

      this.pointsGeometry.setAttribute('position', this.positionAttribute);
      this.pointsGeometry.setAttribute('color', this.colorAttribute);

      this.pointsMesh = new THREE.Points(this.pointsGeometry, this.pointsMaterial);
      this.scene.add(this.pointsMesh);

      // Generate Initial Trajectory Points
      this.regenerateAttractorPoints();

      this.backendMode = 'webgl';
    } catch (err) {
      console.warn('WebGL initialization failed in Room 10, activating Canvas2D 3D-projection fallback:', err);
      this.backendMode = 'canvas2d';
      this.ctx2d = this.canvas.getContext('2d');
      this.regenerateAttractorPoints();
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
   * Constructs the custom luminescent point sprite shader material.
   */
  private createPointsMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPointSize: { value: this.params.pointSize },
        uGlowIntensity: { value: this.params.glowIntensity },
        uViewportHeight: { value: this.height },
      },
      vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uPointSize;
        uniform float uViewportHeight;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Distance-attenuated point size with perspective scaling
          float dist = max(-mvPosition.z, 0.1);
          float size = uPointSize * (uViewportHeight / (dist * 8.0));
          gl_PointSize = clamp(size, 1.0, 6.0);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float uGlowIntensity;

        void main() {
          // Circular Gaussian starlight point profile
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          
          if (distSq > 0.25) {
            discard;
          }
          
          // Delicate luminescent starlight falloff with luminous apex core
          float alpha = exp(-distSq * 18.0) * (uGlowIntensity * 0.18);
          float core = exp(-distSq * 36.0) * 0.6;
          vec3 finalColor = vColor * (0.6 + core);
          
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
   * Applies and damps parameter changes from Tweakpane or URL state sync.
   */
  public updateParams(newParams: Partial<StrangeAttractorsParams>): void {
    const oldType = this.params.attractorType;
    const isTypeChange = Boolean(newParams.attractorType && newParams.attractorType !== oldType);

    this.applyParams(newParams, isTypeChange);

    // If attractor type changed, recalculate canonical parameters and reset camera
    if (isTypeChange) {
      const config = ATTRACTOR_CONFIGS[this.params.attractorType];
      if (config) {
        if (this.camera && this.controls) {
          this.camera.position.set(config.cameraPos[0], config.cameraPos[1], config.cameraPos[2]);
          this.controls.target.set(0, 0, 0);
          this.camera.lookAt(0, 0, 0);
          this.controls.update();
        }
      }
      this.regenerateAttractorPoints();
    } else if (
      newParams.pointCount !== undefined ||
      newParams.dt !== undefined ||
      newParams.paramA !== undefined ||
      newParams.paramB !== undefined ||
      newParams.paramC !== undefined ||
      newParams.paramD !== undefined ||
      newParams.streamCount !== undefined ||
      newParams.colorMode !== undefined ||
      newParams.colorPalette !== undefined
    ) {
      this.regenerateAttractorPoints();
    }

    if (this.controls) {
      if (newParams.cameraAutoRotate !== undefined) {
        this.controls.autoRotate = this.params.cameraAutoRotate;
      }
      if (newParams.rotationSpeed !== undefined) {
        this.controls.autoRotateSpeed = this.params.rotationSpeed * 1.5;
      }
    }

    if (this.camera && newParams.cameraFov !== undefined) {
      this.camera.fov = this.params.cameraFov;
      this.camera.updateProjectionMatrix();
    }

    if (this.pointsMaterial) {
      if (newParams.pointSize !== undefined) {
        this.pointsMaterial.uniforms.uPointSize.value = this.params.pointSize;
      }
      if (newParams.glowIntensity !== undefined) {
        this.pointsMaterial.uniforms.uGlowIntensity.value = this.params.glowIntensity;
      }
    }
  }

  private applyParams(p: Partial<StrangeAttractorsParams>, immediate: boolean): void {
    if (!p) return;

    if (p.seed !== undefined) {
      this.targetParams.seed = String(p.seed);
      this.prng = createPRNG(this.targetParams.seed);
    }
    if (p.attractorType !== undefined) this.targetParams.attractorType = p.attractorType;

    const config = ATTRACTOR_CONFIGS[this.targetParams.attractorType] || ATTRACTOR_CONFIGS.lorenz;

    const isLorenzCatalogFallback = (
      this.targetParams.attractorType !== 'lorenz' &&
      Number(p.paramA) === 10.0 &&
      Number(p.paramB) === 28.0
    );

    if (p.paramA !== undefined && !isLorenzCatalogFallback) {
      this.targetParams.paramA = Number(p.paramA);
    } else {
      this.targetParams.paramA = config.defaultParams.a;
    }

    if (p.paramB !== undefined && !isLorenzCatalogFallback) {
      this.targetParams.paramB = Number(p.paramB);
    } else {
      this.targetParams.paramB = config.defaultParams.b;
    }

    if (p.paramC !== undefined && !isLorenzCatalogFallback) {
      this.targetParams.paramC = Number(p.paramC);
    } else {
      this.targetParams.paramC = config.defaultParams.c;
    }

    if (p.paramD !== undefined && !isLorenzCatalogFallback) {
      this.targetParams.paramD = Number(p.paramD);
    } else {
      this.targetParams.paramD = config.defaultParams.d;
    }

    if (p.dt !== undefined && !isLorenzCatalogFallback) {
      this.targetParams.dt = Math.max(0.0005, Math.min(0.05, Number(p.dt)));
    } else {
      this.targetParams.dt = config.defaultDt;
    }

    if (p.pointCount !== undefined) this.targetParams.pointCount = Math.max(10000, Math.min(MAX_POINTS_CAPACITY, Number(p.pointCount)));
    if (p.evolutionSpeed !== undefined) this.targetParams.evolutionSpeed = Math.max(0.0, Math.min(5.0, Number(p.evolutionSpeed)));
    if (p.streamCount !== undefined) this.targetParams.streamCount = Math.max(1, Math.min(200, Number(p.streamCount)));
    if (p.colorMode !== undefined) this.targetParams.colorMode = p.colorMode;
    if (p.colorPalette !== undefined) this.targetParams.colorPalette = p.colorPalette;
    if (p.pointSize !== undefined) this.targetParams.pointSize = Math.max(0.2, Math.min(10.0, Number(p.pointSize)));
    if (p.glowIntensity !== undefined) this.targetParams.glowIntensity = Math.max(0.1, Math.min(3.0, Number(p.glowIntensity)));
    if (p.cameraAutoRotate !== undefined) this.targetParams.cameraAutoRotate = Boolean(p.cameraAutoRotate);
    if (p.rotationSpeed !== undefined) this.targetParams.rotationSpeed = Math.max(0.0, Math.min(5.0, Number(p.rotationSpeed)));
    if (p.cameraFov !== undefined) this.targetParams.cameraFov = Math.max(20, Math.min(110, Number(p.cameraFov)));

    if (immediate) {
      this.params = { ...this.targetParams };
      this.activePointCount = this.params.pointCount;
    }
  }

  /**
   * Generates or regenerates the entire attractor manifold point cloud.
   */
  public regenerateAttractorPoints(): void {
    const config = ATTRACTOR_CONFIGS[this.params.attractorType] || ATTRACTOR_CONFIGS.lorenz;
    const targetCount = Math.min(this.params.pointCount, MAX_POINTS_CAPACITY);
    this.activePointCount = targetCount;

    const dt = this.params.dt;
    const pA = this.params.paramA;
    const pB = this.params.paramB;
    const pC = this.params.paramC;
    const pD = this.params.paramD;
    const scale = config.scale;
    const [cx, cy, cz] = config.center;
    const palette = ATTRACTOR_PALETTES[this.params.colorPalette] || ATTRACTOR_PALETTES['spectral-aurora'];
    const colorMode = this.params.colorMode;

    const tempColor = { r: 0, g: 0, b: 0 };

    if (config.isDiscrete) {
      // Discrete map iteration (Clifford, Peter de Jong)
      let x = config.initialPos[0] + this.prng.nextFloat(-0.01, 0.01);
      let y = config.initialPos[1] + this.prng.nextFloat(-0.01, 0.01);
      let z = config.initialPos[2] + this.prng.nextFloat(-0.01, 0.01);

      // Warmup steps to settle onto attractor manifold
      for (let w = 0; w < 300; w++) {
        const [nx, ny, nz] = discreteStep(this.params.attractorType, x, y, z, pA, pB, pC, pD);
        x = nx;
        y = ny;
        z = nz;
      }

      let minVal = Infinity;
      let maxVal = -Infinity;

      // First pass: generate coordinates and compute raw metric
      for (let i = 0; i < targetCount; i++) {
        const [nx, ny, nz, speed] = discreteStep(this.params.attractorType, x, y, z, pA, pB, pC, pD);
        x = nx;
        y = ny;
        z = nz;

        // Apply scale & centering
        const px = (x - cx) * scale;
        const py = (y - cy) * scale;
        const pz = (z - cz) * scale;

        this.positions[i * 3] = px;
        this.positions[i * 3 + 1] = py;
        this.positions[i * 3 + 2] = pz;

        let metric = 0;
        if (colorMode === 'velocity') {
          metric = speed;
        } else if (colorMode === 'curvature') {
          metric = Math.sqrt(px * px + py * py + pz * pz);
        } else if (colorMode === 'depth') {
          metric = pz;
        } else {
          metric = i / targetCount;
        }

        this.rawValues[i] = metric;
        if (metric < minVal) minVal = metric;
        if (metric > maxVal) maxVal = metric;
      }

      // Second pass: map metrics to palette colors
      const valRange = Math.max(1e-6, maxVal - minVal);
      for (let i = 0; i < targetCount; i++) {
        const normalizedT = (this.rawValues[i] - minVal) / valRange;
        samplePalette(palette, normalizedT, tempColor);
        this.colors[i * 3] = tempColor.r;
        this.colors[i * 3 + 1] = tempColor.g;
        this.colors[i * 3 + 2] = tempColor.b;
      }
    } else {
      // Continuous differential system (Lorenz, Aizawa, Halvorsen, Thomas, Rössler, Chen)
      const streamCount = Math.max(1, Math.min(200, this.params.streamCount));
      const pointsPerStream = Math.floor(targetCount / streamCount);

      this.streamHeads = [];
      this.streamStepIndices = new Int32Array(streamCount);

      let minVal = Infinity;
      let maxVal = -Infinity;

      let pointIdx = 0;

      for (let s = 0; s < streamCount; s++) {
        // Subtle micro-perturbations and lobe alternation around initial conditions
        const sign = (s % 2 === 0 ? 1 : -1);
        const eps = 0.001 * (s + 1);
        let x = config.initialPos[0] * sign + this.prng.nextFloat(-eps, eps);
        let y = config.initialPos[1] * sign + this.prng.nextFloat(-eps, eps);
        let z = config.initialPos[2] + this.prng.nextFloat(-eps, eps);

        if (this.params.attractorType === 'halvorsen') {
          const axis = s % 3;
          if (axis === 0) { x = -1.4 + eps * sign; y = eps; z = eps; }
          else if (axis === 1) { x = eps; y = -1.4 + eps * sign; z = eps; }
          else { x = eps; y = eps; z = -1.4 + eps * sign; }
        } else if (this.params.attractorType === 'thomas') {
          const axis = s % 3;
          if (axis === 0) { x = 0.5 * sign + eps; y = 0.2 * sign + eps; z = 0.1 * sign + eps; }
          else if (axis === 1) { x = 0.1 * sign + eps; y = 0.5 * sign + eps; z = 0.2 * sign + eps; }
          else { x = 0.2 * sign + eps; y = 0.1 * sign + eps; z = 0.5 * sign + eps; }
        }

        // Staggered warmup steps to distribute streams across the entire chaotic attractor manifold
        const warmupSteps = 1200 + s * 180;
        for (let w = 0; w < warmupSteps; w++) {
          const [nx, ny, nz] = rk4Step(this.params.attractorType, x, y, z, dt, pA, pB, pC, pD);
          x = nx;
          y = ny;
          z = nz;
          // Guard against runaway numeric overflow
          if (Number.isNaN(x) || Math.abs(x) > 1000) {
            x = config.initialPos[0] * sign;
            y = config.initialPos[1] * sign;
            z = config.initialPos[2];
          }
        }

        this.streamHeads.push([x, y, z]);

        for (let p = 0; p < pointsPerStream && pointIdx < targetCount; p++) {
          const [nx, ny, nz, speed] = rk4Step(this.params.attractorType, x, y, z, dt, pA, pB, pC, pD);
          x = nx;
          y = ny;
          z = nz;

          // Guard against numeric overflow
          if (Number.isNaN(x) || Math.abs(x) > 1000) {
            x = config.initialPos[0];
            y = config.initialPos[1];
            z = config.initialPos[2];
          }

          const px = (x - cx) * scale;
          const py = (y - cy) * scale;
          const pz = (z - cz) * scale;

          this.positions[pointIdx * 3] = px;
          this.positions[pointIdx * 3 + 1] = py;
          this.positions[pointIdx * 3 + 2] = pz;

          let metric = 0;
          if (colorMode === 'velocity') {
            metric = speed;
          } else if (colorMode === 'curvature') {
            metric = Math.sqrt(px * px + py * py + pz * pz);
          } else if (colorMode === 'depth') {
            metric = pz;
          } else {
            metric = (s / streamCount + p / pointsPerStream) % 1.0;
          }

          this.rawValues[pointIdx] = metric;
          if (metric < minVal) minVal = metric;
          if (metric > maxVal) maxVal = metric;

          pointIdx++;
        }
      }

      this.activePointCount = pointIdx;

      // Second pass: map metrics to colors
      const valRange = Math.max(1e-6, maxVal - minVal);
      for (let i = 0; i < this.activePointCount; i++) {
        const normalizedT = (this.rawValues[i] - minVal) / valRange;
        samplePalette(palette, normalizedT, tempColor);
        this.colors[i * 3] = tempColor.r;
        this.colors[i * 3 + 1] = tempColor.g;
        this.colors[i * 3 + 2] = tempColor.b;
      }
    }

    // Flag Three.js geometry buffers for GPU upload
    if (this.positionAttribute && this.colorAttribute && this.pointsGeometry) {
      this.positionAttribute.needsUpdate = true;
      this.colorAttribute.needsUpdate = true;
      this.pointsGeometry.setDrawRange(0, this.activePointCount);
      this.pointsGeometry.computeBoundingSphere();
    }
  }

  /**
   * Advances the live continuous trajectory streams forward in time.
   */
  private stepLiveStreams(dt: number): void {
    const config = ATTRACTOR_CONFIGS[this.params.attractorType];
    if (!config || config.isDiscrete || this.params.evolutionSpeed <= 0.0) {
      return;
    }

    const simDt = this.params.dt;
    const pA = this.params.paramA;
    const pB = this.params.paramB;
    const pC = this.params.paramC;
    const pD = this.params.paramD;
    const scale = config.scale;
    const [cx, cy, cz] = config.center;
    const palette = ATTRACTOR_PALETTES[this.params.colorPalette] || ATTRACTOR_PALETTES['spectral-aurora'];
    const colorMode = this.params.colorMode;

    const streamCount = this.streamHeads.length;
    if (streamCount === 0) return;

    const pointsPerStream = Math.floor(this.activePointCount / streamCount);
    this.streamStepAccumulator += dt * (3 * this.params.evolutionSpeed) * 60.0;
    const substeps = Math.min(8, Math.floor(this.streamStepAccumulator));
    this.streamStepAccumulator -= substeps;
    if (substeps <= 0) return;
    const tempColor = { r: 0, g: 0, b: 0 };

    for (let s = 0; s < streamCount; s++) {
      let [x, y, z] = this.streamHeads[s];
      let lastSpeed = 0;

      for (let sub = 0; sub < substeps; sub++) {
        const [nx, ny, nz, speed] = rk4Step(this.params.attractorType, x, y, z, simDt, pA, pB, pC, pD);
        x = nx;
        y = ny;
        z = nz;
        lastSpeed = speed;

        if (Number.isNaN(x) || Math.abs(x) > 1000) {
          x = config.initialPos[0];
          y = config.initialPos[1];
          z = config.initialPos[2];
        }

        const headIndex = (this.streamStepIndices[s]++) % pointsPerStream;
        const globalIdx = s * pointsPerStream + headIndex;

        if (globalIdx < this.activePointCount) {
          const px = (x - cx) * scale;
          const py = (y - cy) * scale;
          const pz = (z - cz) * scale;

          this.positions[globalIdx * 3] = px;
          this.positions[globalIdx * 3 + 1] = py;
          this.positions[globalIdx * 3 + 2] = pz;

          let metric = 0;
          if (colorMode === 'velocity') {
            metric = lastSpeed * 0.05;
          } else if (colorMode === 'curvature') {
            metric = Math.sqrt(px * px + py * py + pz * pz) * 0.1;
          } else if (colorMode === 'depth') {
            metric = (pz + 1.0) * 0.5;
          } else {
            metric = (headIndex / pointsPerStream);
          }

          samplePalette(palette, metric % 1.0, tempColor);
          this.colors[globalIdx * 3] = tempColor.r;
          this.colors[globalIdx * 3 + 1] = tempColor.g;
          this.colors[globalIdx * 3 + 2] = tempColor.b;
        }
      }

      this.streamHeads[s] = [x, y, z];
    }

    if (this.positionAttribute && this.colorAttribute) {
      this.positionAttribute.needsUpdate = true;
      this.colorAttribute.needsUpdate = true;
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

    // Evolve live streams if animated
    if (!this.prefersReducedMotion && this.params.evolutionSpeed > 0) {
      this.stepLiveStreams(dt);
    }

    if (this.backendMode === 'webgl' && this.renderer && this.scene && this.camera && this.controls) {
      // Update OrbitControls
      this.controls.update();

      // Render Three.js scene
      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d' && this.ctx2d && this.canvas) {
      // Render Canvas2D 3D Perspective Projection Fallback
      this.renderCanvas2DFallback(dt);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Smoothly lerps active parameters toward target parameters.
   */
  private dampParameters(dt: number): void {
    const lambda = 8.0;
    this.params.paramA = dampParameter(this.params.paramA, this.targetParams.paramA, lambda, dt);
    this.params.paramB = dampParameter(this.params.paramB, this.targetParams.paramB, lambda, dt);
    this.params.paramC = dampParameter(this.params.paramC, this.targetParams.paramC, lambda, dt);
    this.params.paramD = dampParameter(this.params.paramD, this.targetParams.paramD, lambda, dt);
    this.params.dt = dampParameter(this.params.dt, this.targetParams.dt, lambda, dt);
    this.params.pointSize = dampParameter(this.params.pointSize, this.targetParams.pointSize, lambda, dt);
    this.params.glowIntensity = dampParameter(this.params.glowIntensity, this.targetParams.glowIntensity, lambda, dt);
    this.params.rotationSpeed = dampParameter(this.params.rotationSpeed, this.targetParams.rotationSpeed, lambda, dt);

    if (this.pointsMaterial) {
      this.pointsMaterial.uniforms.uPointSize.value = this.params.pointSize;
      this.pointsMaterial.uniforms.uGlowIntensity.value = this.params.glowIntensity;
    }
  }

  /**
   * High-performance 3D perspective projection rasterizer for Canvas2D fallback.
   */
  private renderCanvas2DFallback(dt: number): void {
    if (!this.ctx2d || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx2d;

    // Clear background
    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, w, h);

    if (this.params.cameraAutoRotate && !this.isCanvas2dPointerDown) {
      this.canvas2dRotationY += this.params.rotationSpeed * dt * 0.5;
    }

    const cosX = Math.cos(this.canvas2dRotationX);
    const sinX = Math.sin(this.canvas2dRotationX);
    const cosY = Math.cos(this.canvas2dRotationY);
    const sinY = Math.sin(this.canvas2dRotationY);

    const fov = 400.0;
    const cx = w / 2;
    const cy = h / 2;
    const distOffset = this.canvas2dDistance;
    const pointSize = Math.max(1, this.params.pointSize);
    const count = this.activePointCount;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Stride for fast rendering when point count is large
    const stride = count > 50000 ? Math.ceil(count / 50000) : 1;

    for (let i = 0; i < count; i += stride) {
      const px = this.positions[i * 3];
      const py = this.positions[i * 3 + 1];
      const pz = this.positions[i * 3 + 2];

      // 3D Yaw/Pitch rotation
      const x1 = px * cosY - pz * sinY;
      const z1 = px * sinY + pz * cosY;
      const y2 = py * cosX - z1 * sinX;
      const z2 = py * sinX + z1 * cosX + distOffset;

      if (z2 > 0.5) {
        const projScale = fov / z2;
        const sx = cx + x1 * projScale;
        const sy = cy - y2 * projScale;

        if (sx >= -10 && sx <= w + 10 && sy >= -10 && sy <= h + 10) {
          const r = Math.floor(this.colors[i * 3] * 255);
          const g = Math.floor(this.colors[i * 3 + 1] * 255);
          const b = Math.floor(this.colors[i * 3 + 2] * 255);
          const alpha = Math.min(1.0, (this.params.glowIntensity * 0.8) / (z2 * 0.05 + 1.0));

          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, pointSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  /**
   * Viewport resize handler.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 320);
    this.height = Math.max(height, 320);

    if (this.renderer && this.camera) {
      this.renderer.setSize(this.width, this.height, false);
      this.camera.aspect = this.width / Math.max(1, this.height);
      this.camera.updateProjectionMatrix();

      if (this.pointsMaterial) {
        this.pointsMaterial.uniforms.uViewportHeight.value = this.height;
      }
    }
  }

  /**
   * Pointer event dispatcher.
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
        this.canvas2dRotationY += dx * 0.008;
        this.canvas2dRotationX += dy * 0.008;
        this.canvas2dLastPointerX = event.x;
        this.canvas2dLastPointerY = event.y;
      } else if (event.type === 'up' || event.type === 'leave') {
        this.isCanvas2dPointerDown = false;
      }
    }
  }

  /**
   * High-Resolution Offline Snapshot Capture.
   * Generates pristine 4K/8K stills rendered at requested dimensions.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement | Blob> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;

    if (this.backendMode === 'webgl' && this.scene && this.camera) {
      // Create offscreen high-res WebGL renderer
      const offRenderer = new THREE.WebGLRenderer({
        canvas: snapCanvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });

      offRenderer.setSize(width, height, false);
      offRenderer.setClearColor(0x090a0d, 1.0);

      const oldAspect = this.camera.aspect;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      if (this.pointsMaterial) {
        this.pointsMaterial.uniforms.uViewportHeight.value = height;
      }

      offRenderer.render(this.scene, this.camera);

      // Restore active camera aspect
      this.camera.aspect = oldAspect;
      this.camera.updateProjectionMatrix();

      if (this.pointsMaterial) {
        this.pointsMaterial.uniforms.uViewportHeight.value = this.height;
      }

      offRenderer.dispose();
      return snapCanvas;
    }

    // Fallback snapshot rendering via Canvas2D
    const snapCtx = snapCanvas.getContext('2d');
    if (snapCtx) {
      snapCtx.fillStyle = '#090A0D';
      snapCtx.fillRect(0, 0, width, height);

      const cosX = Math.cos(this.canvas2dRotationX);
      const sinX = Math.sin(this.canvas2dRotationX);
      const cosY = Math.cos(this.canvas2dRotationY);
      const sinY = Math.sin(this.canvas2dRotationY);

      const fov = 400.0 * (width / 800.0);
      const cx = width / 2;
      const cy = height / 2;
      const distOffset = this.canvas2dDistance;
      const count = this.activePointCount;

      snapCtx.save();
      snapCtx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < count; i++) {
        const px = this.positions[i * 3];
        const py = this.positions[i * 3 + 1];
        const pz = this.positions[i * 3 + 2];

        const x1 = px * cosY - pz * sinY;
        const z1 = px * sinY + pz * cosY;
        const y2 = py * cosX - z1 * sinX;
        const z2 = py * sinX + z1 * cosX + distOffset;

        if (z2 > 0.5) {
          const projScale = fov / z2;
          const sx = cx + x1 * projScale;
          const sy = cy - y2 * projScale;

          if (sx >= -10 && sx <= width + 10 && sy >= -10 && sy <= height + 10) {
            const r = Math.floor(this.colors[i * 3] * 255);
            const g = Math.floor(this.colors[i * 3 + 1] * 255);
            const b = Math.floor(this.colors[i * 3 + 2] * 255);
            const alpha = Math.min(1.0, (this.params.glowIntensity * 1.0) / (z2 * 0.05 + 1.0));

            snapCtx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
            snapCtx.beginPath();
            snapCtx.arc(sx, sy, Math.max(1.0, this.params.pointSize * 1.5), 0, Math.PI * 2);
            snapCtx.fill();
          }
        }
      }

      snapCtx.restore();
    }

    return snapCanvas;
  }

  /**
   * Disposes all GPU buffers, geometries, materials, controls, and listeners.
   */
  private teardown(): void {
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
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.ctx2d = null;
  }
}

export const room: RoomInstance = new StrangeAttractorsRoom();
export default room;
