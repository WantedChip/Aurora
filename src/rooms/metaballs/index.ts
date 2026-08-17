/**
 * Room 14: Metaballs & Marching Cubes
 * Curatorial Category: Fluid & Surface
 * Math Model: GPU Marching Cubes 3D Scalar Potential Isosurface
 * Compute Engine: Three.js MarchingCubes with Physical Metallic/Glass Material & OrbitControls
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - 3D scalar density field potential: Φ(x) = ∑ (r_i² / ||x - p_i||²) across 3D voxel grid
 * - Real-time polygonal isosurface extraction via Marching Cubes with smooth surface normals
 * - 6 Canonical Swarm Presets (Liquid Mercury, Orbital Cluster, Chaotic Swarm, Pulsing Core, Repulsion Drift, Quantum Lattice)
 * - 6 Curatorial Spectral Palettes (Spectral Aurora, Mercury Chrome, Solar Plasma, Obsidian Emerald, Cosmic Amethyst, Monochrome Void)
 * - 6 Curatorial Material Modes (Liquid Mercury Chrome, Obsidian Glass, Gold Specular, Iridescent Pearl, Bioluminescent Plasma, Monochrome Lithic)
 * - Procedural HDR Studio Environment Map for realistic metallic mirror reflections and glass refractions
 * - Dynamic lighting rig (Key, Fill, Rim, and Orbiting Point Light)
 * - 360-degree OrbitControls with damping, auto-rotation, and zoom limits
 * - Interactive pointer dynamics: 3D raycast pointer metaball merging into liquid and shockwave burst dispersal
 * - Real-time Web Audio API reactivity modulating surface tension, blob breathing, and specular shimmer
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
 * - High-performance 3D perspective Canvas2D fallback
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export type MetaballsPreset =
  | 'liquid-mercury'
  | 'orbital-cluster'
  | 'chaotic-swarm'
  | 'pulsing-core'
  | 'repulsion-drift'
  | 'quantum-lattice';

export type MaterialMode =
  | 'liquid-mercury'
  | 'obsidian-glass'
  | 'gold-specular'
  | 'iridescent-pearl'
  | 'bioluminescent-plasma'
  | 'monochrome-lithic';

export type MetaballsPalette =
  | 'spectral-aurora'
  | 'mercury-chrome'
  | 'solar-plasma'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-void';

export interface MetaballsParams {
  seed: string;
  preset: MetaballsPreset;
  materialMode: MaterialMode;
  colorPalette: MetaballsPalette;
  ballCount: number;
  isolationThreshold: number;
  meshResolution: number;
  clusterSpeed: number;
  blobScale: number;
  roughness: number;
  metalness: number;
  transmission: number;
  iridescence: number;
  wireframe: boolean;
  cameraAutoRotate: boolean;
  rotationSpeed: number;
  gravityStrength: number;
  audioReactivity: number;
}

export const DEFAULT_METABALLS_PARAMS: MetaballsParams = {
  seed: '#F59E0B',
  preset: 'liquid-mercury',
  materialMode: 'liquid-mercury',
  colorPalette: 'mercury-chrome',
  ballCount: 20,
  isolationThreshold: 68.0,
  meshResolution: 36,
  clusterSpeed: 0.8,
  blobScale: 1.0,
  roughness: 0.08,
  metalness: 0.94,
  transmission: 0.0,
  iridescence: 0.4,
  wireframe: false,
  cameraAutoRotate: true,
  rotationSpeed: 0.5,
  gravityStrength: 1.0,
  audioReactivity: 1.0,
};

export interface PaletteStop {
  r: number;
  g: number;
  b: number;
}

export interface PaletteDef {
  name: string;
  stops: PaletteStop[];
}

export const METABALLS_PALETTES: Record<MetaballsPalette, PaletteDef> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    stops: [
      { r: 0.0, g: 0.94, b: 1.0 },     // Electric Cyan (#00F0FF)
      { r: 0.23, g: 0.51, b: 0.96 },   // Cobalt Blue (#3B82F6)
      { r: 0.66, g: 0.33, b: 0.97 },   // Royal Violet (#A855F7)
      { r: 0.93, g: 0.28, b: 0.60 },   // Neon Rose (#EC4899)
      { r: 0.97, g: 0.98, b: 1.0 },    // Starlight White
    ],
  },
  'mercury-chrome': {
    name: 'Mercury Chrome',
    stops: [
      { r: 0.95, g: 0.97, b: 1.0 },    // Pure Platinum (#F1F5F9)
      { r: 0.82, g: 0.86, b: 0.92 },   // Liquid Silver (#CBD5E1)
      { r: 0.58, g: 0.64, b: 0.72 },   // Chrome Steel (#94A3B8)
      { r: 0.22, g: 0.74, b: 0.97 },   // Ice Blue (#38BDF8)
      { r: 0.12, g: 0.16, b: 0.24 },   // Obsidian Steel (#1E293B)
    ],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    stops: [
      { r: 0.96, g: 0.62, b: 0.04 },   // Solar Amber (#F59E0B)
      { r: 0.94, g: 0.27, b: 0.27 },   // Magma Red (#EF4444)
      { r: 0.99, g: 0.88, b: 0.28 },   // Neon Gold (#FDE047)
      { r: 0.98, g: 0.45, b: 0.09 },   // Plasma Orange (#F97316)
      { r: 1.0, g: 0.98, b: 0.92 },    // Core Starlight
    ],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    stops: [
      { r: 0.06, g: 0.73, b: 0.51 },   // Bioluminescent Emerald (#10B981)
      { r: 0.43, g: 0.91, b: 0.72 },   // Mint Glint (#6EE7B7)
      { r: 0.02, g: 0.59, b: 0.41 },   // Deep Jade (#059669)
      { r: 0.02, g: 0.31, b: 0.23 },   // Obsidian Pine (#064E3B)
      { r: 0.20, g: 0.83, b: 0.60 },   // Seafoam Spark (#34D399)
    ],
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    stops: [
      { r: 0.55, g: 0.36, b: 0.96 },   // Celestial Amethyst (#8B5CF6)
      { r: 0.93, g: 0.28, b: 0.60 },   // Nebula Rose (#EC4899)
      { r: 0.39, g: 0.40, b: 0.95 },   // Deep Indigo (#6366F1)
      { r: 0.75, g: 0.52, b: 0.99 },   // Cosmic Lilac (#C084FC)
      { r: 0.93, g: 0.91, b: 1.0 },    // Diamond Lavender (#EDE9FE)
    ],
  },
  'monochrome-void': {
    name: 'Monochrome Void',
    stops: [
      { r: 0.12, g: 0.16, b: 0.24 },   // Graphite Slate (#1E293B)
      { r: 0.28, g: 0.33, b: 0.41 },   // Dark Iron (#475569)
      { r: 0.58, g: 0.64, b: 0.72 },   // Archival Silver (#94A3B8)
      { r: 0.80, g: 0.84, b: 0.88 },   // Polished Quartz (#CBD5E1)
      { r: 1.0, g: 1.0, b: 1.0 },      // Pure Starlight
    ],
  },
};

export interface PresetConfig {
  name: string;
  materialMode: MaterialMode;
  colorPalette: MetaballsPalette;
  ballCount: number;
  isolationThreshold: number;
  clusterSpeed: number;
  blobScale: number;
  roughness: number;
  metalness: number;
  transmission: number;
  iridescence: number;
  gravityStrength: number;
}

export const PRESET_CONFIGS: Record<MetaballsPreset, PresetConfig> = {
  'liquid-mercury': {
    name: 'Liquid Mercury',
    materialMode: 'liquid-mercury',
    colorPalette: 'mercury-chrome',
    ballCount: 18,
    isolationThreshold: 65.0,
    clusterSpeed: 0.75,
    blobScale: 1.1,
    roughness: 0.06,
    metalness: 0.96,
    transmission: 0.0,
    iridescence: 0.3,
    gravityStrength: 1.2,
  },
  'orbital-cluster': {
    name: 'Orbital Cluster',
    materialMode: 'gold-specular',
    colorPalette: 'solar-plasma',
    ballCount: 24,
    isolationThreshold: 74.0,
    clusterSpeed: 1.0,
    blobScale: 0.92,
    roughness: 0.12,
    metalness: 0.90,
    transmission: 0.0,
    iridescence: 0.2,
    gravityStrength: 1.5,
  },
  'chaotic-swarm': {
    name: 'Chaotic Swarm',
    materialMode: 'bioluminescent-plasma',
    colorPalette: 'spectral-aurora',
    ballCount: 32,
    isolationThreshold: 62.0,
    clusterSpeed: 1.35,
    blobScale: 0.85,
    roughness: 0.18,
    metalness: 0.45,
    transmission: 0.0,
    iridescence: 0.5,
    gravityStrength: 0.8,
  },
  'pulsing-core': {
    name: 'Pulsing Core',
    materialMode: 'obsidian-glass',
    colorPalette: 'obsidian-emerald',
    ballCount: 16,
    isolationThreshold: 68.0,
    clusterSpeed: 0.65,
    blobScale: 1.25,
    roughness: 0.10,
    metalness: 0.15,
    transmission: 0.85,
    iridescence: 0.7,
    gravityStrength: 1.8,
  },
  'repulsion-drift': {
    name: 'Repulsion Drift',
    materialMode: 'iridescent-pearl',
    colorPalette: 'cosmic-amethyst',
    ballCount: 22,
    isolationThreshold: 78.0,
    clusterSpeed: 0.90,
    blobScale: 0.95,
    roughness: 0.08,
    metalness: 0.25,
    transmission: 0.0,
    iridescence: 0.95,
    gravityStrength: 0.5,
  },
  'quantum-lattice': {
    name: 'Quantum Lattice',
    materialMode: 'monochrome-lithic',
    colorPalette: 'monochrome-void',
    ballCount: 28,
    isolationThreshold: 70.0,
    clusterSpeed: 0.50,
    blobScale: 1.0,
    roughness: 0.72,
    metalness: 0.20,
    transmission: 0.0,
    iridescence: 0.1,
    gravityStrength: 1.0,
  },
};

const MAX_PARTICLES_CAPACITY = 64;

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  acc: THREE.Vector3;
  basePos: THREE.Vector3;
  mass: number;
  baseRadius: number;
  currentStrength: number;
  subtract: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;
  freqX: number;
  freqY: number;
  freqZ: number;
  orbitRadius: number;
  orbitSpeed: number;
  color: THREE.Color;
}

export class MetaballsRoom implements RoomInstance {
  private canvas!: HTMLCanvasElement;
  private container!: HTMLElement;
  private prng!: PRNG;
  private audio?: RoomContext['audio'];
  private dpr = 1;
  private isMounted = false;
  private rafId = 0;
  private lastTime = 0;

  // Active Parameters
  private params: MetaballsParams = { ...DEFAULT_METABALLS_PARAMS };

  // Damped Internal Parameters
  private currentParams: MetaballsParams = { ...DEFAULT_METABALLS_PARAMS };

  // Three.js Render Infrastructure
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private marchingCubes!: MarchingCubes;
  private material!: THREE.Material;
  private envTexture: THREE.Texture | null = null;

  // Lighting Rig
  private ambientLight!: THREE.AmbientLight;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private pointLight!: THREE.PointLight;

  // Particle Simulation Memory
  private particles: Particle[] = [];
  private width = 800;
  private height = 600;

  // Interactive Pointer State
  private pointerPos = new THREE.Vector2(-999, -999);
  private pointerWorld = new THREE.Vector3(0.5, 0.5, 0.5);
  private isPointerActive = false;
  private isPointerDown = false;
  private raycaster = new THREE.Raycaster();
  private interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private cursorStrength = 0.04;
  private cursorColor = new THREE.Color('#00F0FF');
  private shockwaveTimer = 0.0;
  private shockwaveOrigin = new THREE.Vector3(0.5, 0.5, 0.5);

  // Backend Mode
  private backendMode: 'webgl' | 'canvas2d' = 'webgl';
  private ctx2d: CanvasRenderingContext2D | null = null;

  /**
   * Mounts the room simulation to the provided canvas and container.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.container = ctx.container;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_METABALLS_PARAMS.seed);
    this.audio = ctx.audio;
    this.dpr = ctx.dpr || (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    this.params = {
      ...DEFAULT_METABALLS_PARAMS,
      ...ctx.params,
    };
    this.currentParams = { ...this.params };

    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(rect.width || this.canvas.width || 800));
    this.height = Math.max(1, Math.floor(rect.height || this.canvas.height || 600));

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Initialize Particle Swarm
    this.initParticles();

    // Try initializing WebGL / Three.js Pipeline
    try {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x090a0d); // Obsidian Archival Void

      this.camera = new THREE.PerspectiveCamera(
        45,
        this.width / Math.max(1, this.height),
        0.1,
        100.0
      );
      this.camera.position.set(0, 1.2, 3.4);
      this.camera.lookAt(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        preserveDrawingBuffer: true,
      });
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;

      // OrbitControls for 360-degree inspection
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.rotateSpeed = 0.8;
      this.controls.zoomSpeed = 1.0;
      this.controls.panSpeed = 0.8;
      this.controls.minDistance = 1.4;
      this.controls.maxDistance = 10.0;
      this.controls.autoRotate = this.params.cameraAutoRotate;
      this.controls.autoRotateSpeed = this.params.rotationSpeed * 1.5;
      this.controls.target.set(0, 0, 0);

      // Generate Procedural Studio Environment Map
      this.envTexture = this.generateStudioEnvironmentTexture();
      this.scene.environment = this.envTexture;

      // Setup Dynamic Lighting Rig
      this.setupLighting();

      // Create Material
      this.material = this.createMetaballsMaterial();

      // Create MarchingCubes Mesh
      this.marchingCubes = new MarchingCubes(
        this.params.meshResolution,
        this.material,
        true, // enableUvs
        true, // enableColors
        200000 // maxPolyCount
      );
      this.marchingCubes.position.set(0, 0, 0);
      this.marchingCubes.scale.set(1.4, 1.4, 1.4);
      this.marchingCubes.isolation = this.params.isolationThreshold;
      this.scene.add(this.marchingCubes);

      this.backendMode = 'webgl';
    } catch (err) {
      console.warn('WebGL initialization failed in Room 14, activating Canvas2D 3D fallback:', err);
      this.backendMode = 'canvas2d';
      this.ctx2d = this.canvas.getContext('2d');
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
   * Initializes the particle swarm memory.
   */
  private initParticles(): void {
    const prng = this.prng;
    this.particles = [];

    const count = Math.min(MAX_PARTICLES_CAPACITY, Math.max(6, this.params.ballCount));
    const palette = METABALLS_PALETTES[this.params.colorPalette] || METABALLS_PALETTES['spectral-aurora'];
    const stops = palette.stops;

    for (let i = 0; i < count; i++) {
      const isCore = i === 0;
      const angle = (i / count) * Math.PI * 2 + prng.nextFloat(0, 0.4);
      const elev = prng.nextFloat(-Math.PI * 0.35, Math.PI * 0.35);
      const rad = isCore ? 0.05 : prng.nextFloat(0.12, 0.32);

      const x = 0.5 + Math.cos(angle) * Math.cos(elev) * rad;
      const y = 0.5 + Math.sin(elev) * rad;
      const z = 0.5 + Math.sin(angle) * Math.cos(elev) * rad;

      const stopIdx = i % stops.length;
      const nextStop = stops[(stopIdx + 1) % stops.length];
      const lerpFactor = prng.nextFloat(0, 1);

      const r = stops[stopIdx].r + (nextStop.r - stops[stopIdx].r) * lerpFactor;
      const g = stops[stopIdx].g + (nextStop.g - stops[stopIdx].g) * lerpFactor;
      const b = stops[stopIdx].b + (nextStop.b - stops[stopIdx].b) * lerpFactor;

      this.particles.push({
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(
          prng.nextFloat(-0.02, 0.02),
          prng.nextFloat(-0.02, 0.02),
          prng.nextFloat(-0.02, 0.02)
        ),
        acc: new THREE.Vector3(0, 0, 0),
        basePos: new THREE.Vector3(x, y, z),
        mass: isCore ? 3.0 : prng.nextFloat(0.6, 1.6),
        baseRadius: isCore ? 0.075 : prng.nextFloat(0.035, 0.055),
        currentStrength: isCore ? 0.075 : prng.nextFloat(0.035, 0.055),
        subtract: 12.0,
        phaseX: prng.nextFloat(0, Math.PI * 2),
        phaseY: prng.nextFloat(0, Math.PI * 2),
        phaseZ: prng.nextFloat(0, Math.PI * 2),
        freqX: prng.nextFloat(0.4, 1.6),
        freqY: prng.nextFloat(0.4, 1.6),
        freqZ: prng.nextFloat(0.4, 1.6),
        orbitRadius: rad,
        orbitSpeed: prng.nextFloat(0.5, 1.8),
        color: new THREE.Color(r, g, b),
      });
    }
  }

  /**
   * Sets up directional key, fill, rim lights and dynamic point light.
   */
  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0x090a0d, 1.0);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    this.keyLight.position.set(4, 5, 5);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    this.fillLight.position.set(-4, -2, -3);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xc084fc, 2.5);
    this.rimLight.position.set(0, 6, -5);
    this.scene.add(this.rimLight);

    this.pointLight = new THREE.PointLight(0x00f0ff, 4.0, 8.0, 1.2);
    this.pointLight.position.set(0, 0, 0);
    this.scene.add(this.pointLight);
  }

  /**
   * Generates a procedural HDR-style studio environment texture for metallic mirror reflections.
   */
  private generateStudioEnvironmentTexture(): THREE.Texture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Obsidian gradient backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#090A0D');
      bgGrad.addColorStop(0.5, '#121620');
      bgGrad.addColorStop(1, '#060709');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Top White Softbox Strip
      const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.4);
      topGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      topGrad.addColorStop(0.6, 'rgba(220, 240, 255, 0.4)');
      topGrad.addColorStop(1, 'rgba(18, 22, 32, 0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(width * 0.2, 0, width * 0.6, height * 0.4);

      // Left Accent Softbox (Violet/Blue)
      const leftGrad = ctx.createRadialGradient(
        width * 0.2, height * 0.5, 5,
        width * 0.2, height * 0.5, 90
      );
      leftGrad.addColorStop(0, 'rgba(168, 85, 247, 0.85)');
      leftGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.35)');
      leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, height * 0.1, width * 0.4, height * 0.8);

      // Right Key Softbox (Bright Cyan/White)
      const rightGrad = ctx.createRadialGradient(
        width * 0.8, height * 0.45, 5,
        width * 0.8, height * 0.45, 110
      );
      rightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      rightGrad.addColorStop(0.4, 'rgba(0, 240, 255, 0.5)');
      rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(width * 0.6, 0, width * 0.4, height * 0.9);

      // Subtle Warm Rim Bounce at Horizon
      const bounceGrad = ctx.createLinearGradient(0, height * 0.65, 0, height);
      bounceGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
      bounceGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.25)');
      bounceGrad.addColorStop(1, 'rgba(9, 10, 13, 0)');
      ctx.fillStyle = bounceGrad;
      ctx.fillRect(0, height * 0.65, width, height * 0.35);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Constructs the active Three.js physical material according to materialMode & params.
   */
  private createMetaballsMaterial(): THREE.Material {
    const mode = this.params.materialMode;
    const wireframe = this.params.wireframe;

    switch (mode) {
      case 'obsidian-glass': {
        return new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0x090a0d),
          roughness: this.params.roughness,
          metalness: this.params.metalness,
          transmission: Math.max(0.6, this.params.transmission || 0.85),
          ior: 1.54,
          thickness: 1.6,
          iridescence: this.params.iridescence,
          iridescenceIOR: 1.33,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          vertexColors: true,
          wireframe,
          envMapIntensity: 1.8,
        });
      }

      case 'gold-specular': {
        return new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0xf59e0b),
          roughness: this.params.roughness,
          metalness: Math.max(0.85, this.params.metalness),
          clearcoat: 0.8,
          clearcoatRoughness: 0.1,
          vertexColors: true,
          wireframe,
          envMapIntensity: 2.0,
        });
      }

      case 'iridescent-pearl': {
        return new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0xf8fafc),
          roughness: this.params.roughness,
          metalness: 0.2,
          iridescence: 1.0,
          iridescenceIOR: 1.35,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          vertexColors: true,
          wireframe,
          envMapIntensity: 1.7,
        });
      }

      case 'bioluminescent-plasma': {
        return new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0x00f0ff),
          emissive: new THREE.Color(0xa855f7),
          emissiveIntensity: 0.35,
          roughness: this.params.roughness,
          metalness: this.params.metalness,
          clearcoat: 0.7,
          vertexColors: true,
          wireframe,
          envMapIntensity: 1.6,
        });
      }

      case 'monochrome-lithic': {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x475569),
          roughness: Math.max(0.65, this.params.roughness),
          metalness: Math.min(0.3, this.params.metalness),
          vertexColors: true,
          wireframe,
          envMapIntensity: 0.8,
        });
      }

      case 'liquid-mercury':
      default: {
        return new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0xe2e8f0),
          roughness: this.params.roughness,
          metalness: Math.max(0.9, this.params.metalness),
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          vertexColors: true,
          wireframe,
          envMapIntensity: 2.2,
        });
      }
    }
  }

  /**
   * Updates materials when parameter or preset changes.
   */
  private updateMaterialProperties(): void {
    if (!this.marchingCubes) return;

    // If material type needs to change, rebuild material
    const currentMat = this.material as any;
    const targetMode = this.params.materialMode;
    const isPhysical = currentMat instanceof THREE.MeshPhysicalMaterial;

    if (
      (targetMode === 'monochrome-lithic' && isPhysical) ||
      (targetMode !== 'monochrome-lithic' && !isPhysical)
    ) {
      if (this.material) this.material.dispose();
      this.material = this.createMetaballsMaterial();
      this.marchingCubes.material = this.material;
      return;
    }

    // Otherwise smoothly update uniform properties
    currentMat.roughness = this.currentParams.roughness;
    currentMat.metalness = this.currentParams.metalness;
    currentMat.wireframe = this.params.wireframe;

    if (isPhysical) {
      currentMat.transmission = this.currentParams.transmission;
      currentMat.iridescence = this.currentParams.iridescence;
    }
  }

  /**
   * Main simulation animation loop.
   */
  private loop(timestamp: number): void {
    if (!this.isMounted) return;

    const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    // Smooth parameter damping
    this.dampAllParameters(dt);

    // Extract audio reactivity if available
    let audioMid = 0;
    if (this.audio) {
      const bands = this.audio.getFrequencyBands();
      const gain = this.currentParams.audioReactivity;
      audioMid = (bands.mid || 0) * gain;
    }

    // Update physical particle simulation
    this.updatePhysics(timestamp * 0.001, dt, audioMid);

    if (this.backendMode === 'webgl' && this.marchingCubes) {
      // Audio Reactivity Modulation
      let audioBass = 0;
      let audioTreble = 0;

      if (this.audio) {
        const bands = this.audio.getFrequencyBands();
        const gain = this.currentParams.audioReactivity;
        audioBass = (bands.bass || 0) * gain;
        audioTreble = (bands.treble || 0) * gain;
      }

      // Reset MarchingCubes scalar field & palette buffer
      this.marchingCubes.reset();

      // Dynamic surface tension / isolation threshold modulated by audio bass
      const effectiveIsolation = Math.max(
        15.0,
        this.currentParams.isolationThreshold - audioBass * 18.0
      );
      this.marchingCubes.isolation = effectiveIsolation;

      // Add Active Particles into Density Field
      const activeCount = Math.min(this.particles.length, Math.floor(this.currentParams.ballCount));
      const blobScale = this.currentParams.blobScale * (1.0 + audioBass * 0.25);

      for (let i = 0; i < activeCount; i++) {
        const p = this.particles[i];
        const strength = p.currentStrength * blobScale * (i === 0 ? 1.4 : 1.0);
        this.marchingCubes.addBall(
          p.pos.x,
          p.pos.y,
          p.pos.z,
          strength,
          p.subtract,
          p.color
        );
      }

      // Add Interactive Pointer Metaball if within viewport
      if (this.isPointerActive && this.pointerWorld) {
        const cursorX = THREE.MathUtils.clamp(this.pointerWorld.x, 0.1, 0.9);
        const cursorY = THREE.MathUtils.clamp(this.pointerWorld.y, 0.1, 0.9);
        const cursorZ = THREE.MathUtils.clamp(this.pointerWorld.z, 0.1, 0.9);

        const strength = this.cursorStrength * blobScale * (this.isPointerDown ? 1.8 : 1.0);
        this.marchingCubes.addBall(
          cursorX,
          cursorY,
          cursorZ,
          strength,
          12.0,
          this.cursorColor
        );
      }

      // Extract Polygonized Surface Mesh with Normal Derivations
      this.marchingCubes.update();

      // Update Dynamic Lighting Highlights
      if (this.pointLight && this.particles.length > 0) {
        const core = this.particles[0].pos;
        this.pointLight.position.set(
          (core.x - 0.5) * 2.8,
          (core.y - 0.5) * 2.8,
          (core.z - 0.5) * 2.8
        );
        this.pointLight.intensity = 3.5 + audioTreble * 4.0;
      }

      // OrbitControls update
      if (this.controls) {
        this.controls.autoRotate = this.params.cameraAutoRotate;
        this.controls.autoRotateSpeed = this.currentParams.rotationSpeed * 1.5;
        this.controls.update();
      }

      // Render Three.js Scene
      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d' && this.ctx2d) {
      this.renderCanvas2DFallback(timestamp * 0.001);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Updates physical particle motion based on active preset dynamics.
   */
  private updatePhysics(time: number, dt: number, audioMid = 0): void {
    const preset = this.params.preset;
    const speed = this.currentParams.clusterSpeed * (1.0 + audioMid * 0.8);
    const gravity = this.currentParams.gravityStrength;
    const activeCount = Math.min(this.particles.length, Math.floor(this.currentParams.ballCount));

    const center = new THREE.Vector3(0.5, 0.5, 0.5);

    // Shockwave decay
    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer = Math.max(0, this.shockwaveTimer - dt * 2.5);
    }

    for (let i = 0; i < activeCount; i++) {
      const p = this.particles[i];
      p.acc.set(0, 0, 0);

      // Preset specific acceleration & orbit dynamics
      switch (preset) {
        case 'orbital-cluster': {
          if (i === 0) {
            // Core breathing oscillation
            p.pos.x = 0.5 + Math.sin(time * 0.6 * speed) * 0.04;
            p.pos.y = 0.5 + Math.cos(time * 0.5 * speed) * 0.04;
            p.pos.z = 0.5 + Math.sin(time * 0.7 * speed) * 0.04;
          } else {
            const orbSpeed = p.orbitSpeed * speed * (0.8 + 0.4 / Math.max(0.1, p.orbitRadius));
            const angle = time * orbSpeed + p.phaseX;
            const tilt = p.phaseY;

            const targetX = 0.5 + Math.cos(angle) * p.orbitRadius * Math.cos(tilt);
            const targetY = 0.5 + Math.sin(angle) * p.orbitRadius;
            const targetZ = 0.5 + Math.cos(angle) * p.orbitRadius * Math.sin(tilt);

            // Gravitational spring toward orbit target
            p.acc.x += (targetX - p.pos.x) * 12.0 * gravity;
            p.acc.y += (targetY - p.pos.y) * 12.0 * gravity;
            p.acc.z += (targetZ - p.pos.z) * 12.0 * gravity;
          }
          break;
        }

        case 'chaotic-swarm': {
          // Lorenz-coupled turbulent wandering
          const sigma = 10.0;
          const rho = 28.0;
          const beta = 2.6667;

          const lx = (p.pos.x - 0.5) * 40.0;
          const ly = (p.pos.y - 0.5) * 40.0;
          const lz = (p.pos.z - 0.5) * 40.0 + 20.0;

          const ldx = sigma * (ly - lx) * 0.0006 * speed;
          const ldy = (lx * (rho - lz) - ly) * 0.0006 * speed;
          const ldz = (lx * ly - beta * lz) * 0.0006 * speed;

          p.acc.x += ldx * 18.0;
          p.acc.y += ldy * 18.0;
          p.acc.z += ldz * 18.0;

          // Pull to center
          p.acc.x += (0.5 - p.pos.x) * 4.0 * gravity;
          p.acc.y += (0.5 - p.pos.y) * 4.0 * gravity;
          p.acc.z += (0.5 - p.pos.z) * 4.0 * gravity;
          break;
        }

        case 'pulsing-core': {
          if (i === 0) {
            // Big pulsating central blob
            p.pos.set(0.5, 0.5, 0.5);
            p.currentStrength = p.baseRadius * (1.0 + Math.sin(time * 2.2 * speed) * 0.35);
          } else {
            // Satellite droplets breathing in and out radially
            const pulse = (Math.sin(time * 1.8 * speed + p.phaseX) + 1.0) * 0.5;
            const r = p.orbitRadius * (0.4 + pulse * 1.2);
            const theta = time * p.orbitSpeed * 0.6 + p.phaseY;
            const phi = p.phaseZ + time * 0.3;

            const targetX = 0.5 + Math.sin(phi) * Math.cos(theta) * r;
            const targetY = 0.5 + Math.cos(phi) * r;
            const targetZ = 0.5 + Math.sin(phi) * Math.sin(theta) * r;

            p.acc.x += (targetX - p.pos.x) * 14.0 * gravity;
            p.acc.y += (targetY - p.pos.y) * 14.0 * gravity;
            p.acc.z += (targetZ - p.pos.z) * 14.0 * gravity;
          }
          break;
        }

        case 'repulsion-drift': {
          // Bouncing elastic spheres within envelope
          p.acc.x += Math.sin(time * p.freqX + p.phaseX) * 0.05 * speed;
          p.acc.y += Math.cos(time * p.freqY + p.phaseY) * 0.05 * speed;
          p.acc.z += Math.sin(time * p.freqZ + p.phaseZ) * 0.05 * speed;

          // Soft spherical envelope boundary
          const distToCenter = p.pos.distanceTo(center);
          if (distToCenter > 0.34) {
            const push = (distToCenter - 0.34) * 20.0;
            p.acc.x += (center.x - p.pos.x) * push;
            p.acc.y += (center.y - p.pos.y) * push;
            p.acc.z += (center.z - p.pos.z) * push;
          }
          break;
        }

        case 'quantum-lattice': {
          // Harmonic standing wave interference lattice
          const targetX = 0.5 + Math.sin(time * p.freqX * speed + p.phaseX) * 0.28;
          const targetY = 0.5 + Math.sin(time * p.freqY * speed + p.phaseY) * 0.28;
          const targetZ = 0.5 + Math.cos(time * p.freqZ * speed + p.phaseZ) * 0.28;

          p.acc.x += (targetX - p.pos.x) * 16.0 * gravity;
          p.acc.y += (targetY - p.pos.y) * 16.0 * gravity;
          p.acc.z += (targetZ - p.pos.z) * 16.0 * gravity;
          break;
        }

        case 'liquid-mercury':
        default: {
          // Harmonic Lissajous central attraction
          const targetX = 0.5 + Math.sin(time * p.freqX * speed + p.phaseX) * p.orbitRadius;
          const targetY = 0.5 + Math.cos(time * p.freqY * speed + p.phaseY) * p.orbitRadius;
          const targetZ = 0.5 + Math.sin(time * p.freqZ * speed + p.phaseZ) * p.orbitRadius;

          p.acc.x += (targetX - p.pos.x) * 10.0 * gravity;
          p.acc.y += (targetY - p.pos.y) * 10.0 * gravity;
          p.acc.z += (targetZ - p.pos.z) * 10.0 * gravity;

          // Pairwise soft attraction & hard repulsion
          for (let j = 0; j < activeCount; j++) {
            if (i === j) continue;
            const pj = this.particles[j];
            const dx = pj.pos.x - p.pos.x;
            const dy = pj.pos.y - p.pos.y;
            const dz = pj.pos.z - p.pos.z;
            const d2 = dx * dx + dy * dy + dz * dz + 0.0004;
            const d = Math.sqrt(d2);

            if (d < 0.08) {
              // Strong repulsion preventing collapse
              const rep = (0.08 - d) * 12.0;
              p.acc.x -= (dx / d) * rep;
              p.acc.y -= (dy / d) * rep;
              p.acc.z -= (dz / d) * rep;
            } else if (d < 0.25) {
              // Surface tension coalescence
              const att = (d - 0.08) * 2.5 * gravity;
              p.acc.x += (dx / d) * att;
              p.acc.y += (dy / d) * att;
              p.acc.z += (dz / d) * att;
            }
          }
          break;
        }
      }

      // Pointer force interaction
      if (this.isPointerActive && this.pointerWorld) {
        const dx = this.pointerWorld.x - p.pos.x;
        const dy = this.pointerWorld.y - p.pos.y;
        const dz = this.pointerWorld.z - p.pos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;

        if (d < 0.4) {
          const force = this.isPointerDown ? 15.0 : -6.0; // Click attracts, hover pushes
          p.acc.x += (dx / d) * force * (0.4 - d);
          p.acc.y += (dy / d) * force * (0.4 - d);
          p.acc.z += (dz / d) * force * (0.4 - d);
        }
      }

      // Shockwave impulse from clicks
      if (this.shockwaveTimer > 0) {
        const dx = p.pos.x - this.shockwaveOrigin.x;
        const dy = p.pos.y - this.shockwaveOrigin.y;
        const dz = p.pos.z - this.shockwaveOrigin.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
        const shock = (this.shockwaveTimer * 8.0) / (d * d + 0.05);

        p.acc.x += (dx / d) * shock;
        p.acc.y += (dy / d) * shock;
        p.acc.z += (dz / d) * shock;
      }

      // Integrate Acceleration -> Velocity -> Position
      p.vel.addScaledVector(p.acc, dt);
      p.vel.multiplyScalar(Math.pow(0.88, dt * 60.0)); // Fluid damping
      p.pos.addScaledVector(p.vel, dt);

      // Boundary soft clamping
      p.pos.x = THREE.MathUtils.clamp(p.pos.x, 0.15, 0.85);
      p.pos.y = THREE.MathUtils.clamp(p.pos.y, 0.15, 0.85);
      p.pos.z = THREE.MathUtils.clamp(p.pos.z, 0.15, 0.85);
    }
  }

  /**
   * Smooth exponential parameter damping across updates.
   */
  private dampAllParameters(dt: number): void {
    const lambda = 8.0;

    this.currentParams.isolationThreshold = dampParameter(
      this.currentParams.isolationThreshold,
      this.params.isolationThreshold,
      lambda,
      dt
    );
    this.currentParams.clusterSpeed = dampParameter(
      this.currentParams.clusterSpeed,
      this.params.clusterSpeed,
      lambda,
      dt
    );
    this.currentParams.blobScale = dampParameter(
      this.currentParams.blobScale,
      this.params.blobScale,
      lambda,
      dt
    );
    this.currentParams.roughness = dampParameter(
      this.currentParams.roughness,
      this.params.roughness,
      lambda,
      dt
    );
    this.currentParams.metalness = dampParameter(
      this.currentParams.metalness,
      this.params.metalness,
      lambda,
      dt
    );
    this.currentParams.transmission = dampParameter(
      this.currentParams.transmission,
      this.params.transmission,
      lambda,
      dt
    );
    this.currentParams.iridescence = dampParameter(
      this.currentParams.iridescence,
      this.params.iridescence,
      lambda,
      dt
    );
    this.currentParams.rotationSpeed = dampParameter(
      this.currentParams.rotationSpeed,
      this.params.rotationSpeed,
      lambda,
      dt
    );
    this.currentParams.gravityStrength = dampParameter(
      this.currentParams.gravityStrength,
      this.params.gravityStrength,
      lambda,
      dt
    );
    this.currentParams.ballCount = dampParameter(
      this.currentParams.ballCount,
      this.params.ballCount,
      lambda,
      dt
    );
    this.currentParams.audioReactivity = dampParameter(
      this.currentParams.audioReactivity,
      this.params.audioReactivity,
      lambda,
      dt
    );

    this.updateMaterialProperties();
  }

  /**
   * High-performance Canvas2D 3D-projected fallback for headless / non-WebGL environments.
   */
  private renderCanvas2DFallback(time: number): void {
    const ctx = this.ctx2d;
    if (!ctx) return;

    const w = this.width * this.dpr;
    const h = this.height * this.dpr;

    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, w, h);

    const activeCount = Math.min(this.particles.length, Math.floor(this.currentParams.ballCount));
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = Math.min(w, h) * 0.8;

    // Depth sort particles
    const sorted = [...this.particles.slice(0, activeCount)].sort((a, b) => b.pos.z - a.pos.z);

    for (const p of sorted) {
      const px = cx + (p.pos.x - 0.5) * scale;
      const py = cy + (p.pos.y - 0.5) * scale;
      const pulse = Math.sin(time * 2.0 + p.phaseX) * 0.08;
      const r = Math.max(12, p.currentStrength * scale * 1.8 * this.currentParams.blobScale * (1.0 + pulse));

      const hex = `#${p.color.getHexString()}`;
      const grad = ctx.createRadialGradient(
        px - r * 0.3, py - r * 0.3, r * 0.1,
        px, py, r
      );
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, hex);
      grad.addColorStop(0.85, 'rgba(18, 22, 32, 0.8)');
      grad.addColorStop(1, 'rgba(9, 10, 13, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL state sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevPreset = this.params.preset;
    const prevPalette = this.params.colorPalette;
    const prevResolution = this.params.meshResolution;
    const prevMaterial = this.params.materialMode;

    // Handle preset preset changes
    if (newParams.preset && newParams.preset !== prevPreset && PRESET_CONFIGS[newParams.preset as MetaballsPreset]) {
      const presetCfg = PRESET_CONFIGS[newParams.preset as MetaballsPreset];
      Object.assign(this.params, {
        preset: newParams.preset,
        materialMode: presetCfg.materialMode,
        colorPalette: presetCfg.colorPalette,
        ballCount: presetCfg.ballCount,
        isolationThreshold: presetCfg.isolationThreshold,
        clusterSpeed: presetCfg.clusterSpeed,
        blobScale: presetCfg.blobScale,
        roughness: presetCfg.roughness,
        metalness: presetCfg.metalness,
        transmission: presetCfg.transmission,
        iridescence: presetCfg.iridescence,
        gravityStrength: presetCfg.gravityStrength,
      });
    }

    Object.assign(this.params, newParams);

    // Re-initialize particles if palette or seed changes
    if (newParams.colorPalette !== prevPalette || newParams.seed || newParams.ballCount !== this.particles.length) {
      this.initParticles();
    }

    // Dynamic resolution adjustment
    if (newParams.meshResolution && newParams.meshResolution !== prevResolution && this.marchingCubes) {
      this.rebuildMarchingCubes(this.params.meshResolution);
    }

    // Material mode change
    if (newParams.materialMode !== prevMaterial || newParams.wireframe !== undefined) {
      this.updateMaterialProperties();
    }
  }

  /**
   * Safely rebuilds the MarchingCubes instance when resolution changes.
   */
  private rebuildMarchingCubes(resolution: number): void {
    if (!this.scene) return;

    if (this.marchingCubes) {
      this.scene.remove(this.marchingCubes);
      if (this.marchingCubes.geometry) this.marchingCubes.geometry.dispose();
    }

    this.marchingCubes = new MarchingCubes(
      resolution,
      this.material,
      true, // enableUvs
      true, // enableColors
      250000 // maxPolyCount
    );
    this.marchingCubes.position.set(0, 0, 0);
    this.marchingCubes.scale.set(1.4, 1.4, 1.4);
    this.marchingCubes.isolation = this.currentParams.isolationThreshold;
    this.scene.add(this.marchingCubes);
  }

  /**
   * Called when viewport dimensions change.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    if (this.renderer && this.camera) {
      this.camera.aspect = this.width / Math.max(1, this.height);
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
    }
  }

  /**
   * Handles pointer input events.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.isPointerActive = false;
      this.isPointerDown = false;
      return;
    }

    this.isPointerActive = true;
    this.isPointerDown = event.isDown;

    if (this.camera) {
      // Map normalized 0..1 coordinates to NDC -1..1
      this.pointerPos.x = event.normalizedX * 2.0 - 1.0;
      this.pointerPos.y = -(event.normalizedY * 2.0 - 1.0);

      this.raycaster.setFromCamera(this.pointerPos, this.camera);
      const intersectionPoint = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.interactionPlane, intersectionPoint);

      // Convert Three.js world space [-1.4, 1.4] to MarchingCubes normalized [0, 1]
      const mcScale = 1.4;
      this.pointerWorld.set(
        (intersectionPoint.x / mcScale) * 0.5 + 0.5,
        (intersectionPoint.y / mcScale) * 0.5 + 0.5,
        (intersectionPoint.z / mcScale) * 0.5 + 0.5
      );
    }

    if (event.type === 'down') {
      // Click disturbance shockwave
      this.shockwaveTimer = 1.0;
      this.shockwaveOrigin.copy(this.pointerWorld);
    }
  }

  /**
   * Custom high-resolution offline snapshot export hook.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement | Blob> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;

    if (this.backendMode === 'webgl' && this.renderer && this.scene && this.camera) {
      const origWidth = this.width;
      const origHeight = this.height;
      const origAspect = this.camera.aspect;

      // Adjust camera and renderer to snapshot aspect
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
      this.renderer.render(this.scene, this.camera);

      const snapCtx = snapCanvas.getContext('2d');
      if (snapCtx) {
        snapCtx.drawImage(this.renderer.domElement, 0, 0, width, height);
      }

      // Restore original dimensions
      this.camera.aspect = origAspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(origWidth, origHeight, false);
      this.renderer.setPixelRatio(this.dpr);

      return snapCanvas;
    }

    // Fallback Canvas2D snapshot
    const snapCtx = snapCanvas.getContext('2d');
    if (snapCtx) {
      snapCtx.fillStyle = '#090A0D';
      snapCtx.fillRect(0, 0, width, height);

      const activeCount = Math.min(this.particles.length, Math.floor(this.currentParams.ballCount));
      const cx = width * 0.5;
      const cy = height * 0.5;
      const scale = Math.min(width, height) * 0.8;
      const sorted = [...this.particles.slice(0, activeCount)].sort((a, b) => b.pos.z - a.pos.z);

      for (const p of sorted) {
        const px = cx + (p.pos.x - 0.5) * scale;
        const py = cy + (p.pos.y - 0.5) * scale;
        const r = Math.max(16, p.currentStrength * scale * 1.8 * this.currentParams.blobScale);

        const hex = `#${p.color.getHexString()}`;
        const grad = snapCtx.createRadialGradient(
          px - r * 0.3, py - r * 0.3, r * 0.1,
          px, py, r
        );
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.3, hex);
        grad.addColorStop(0.85, 'rgba(18, 22, 32, 0.8)');
        grad.addColorStop(1, 'rgba(9, 10, 13, 0)');

        snapCtx.fillStyle = grad;
        snapCtx.beginPath();
        snapCtx.arc(px, py, r, 0, Math.PI * 2);
        snapCtx.fill();
      }
    }

    return snapCanvas;
  }

  /**
   * Complete resource teardown and memory disposal.
   */
  private teardown(): void {
    this.isMounted = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.marchingCubes) {
      if (this.marchingCubes.geometry) this.marchingCubes.geometry.dispose();
      this.scene?.remove(this.marchingCubes);
    }

    if (this.material) {
      this.material.dispose();
    }

    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    this.particles = [];
  }
}

export const room = new MetaballsRoom();
export default room;
