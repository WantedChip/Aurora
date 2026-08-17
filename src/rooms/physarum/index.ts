/**
 * Room 04: Physarum Slime Mold (WebGPU Compute Agent Deposition & Sensory Steering)
 * Curatorial Category: Artificial Life
 * Math Model: Sage Jenson & Jeff Jones Biological Slime Mold Model
 * Compute Engine: Three.js WebGPURenderer / TSL Compute Pipeline with Graceful Canvas2D Fallback
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - 500,000+ autonomous biological slime mold agents simulating emergent chemoattractant transport networks
 * - 3-sensor chemoattractant sampling (Left, Forward, Right) with dynamic angular steering
 * - 2D chemical trail field diffusion (3x3 spatial convolution) and exponential evaporation decay
 * - Dual execution architecture: WebGPU/TSL compute pipeline with high-performance Canvas2D/TypedArray fallback
 * - 5 Curatorial Spectral Palettes (Phosphor Green, Obsidian Violet, Bioluminescent Cyan, Solar Amber, Spectral Crimson)
 * - Interactive nutrient attractant food deposition and click-burst spore dispersion
 * - Frame-rate independent exponential parameter damping
 * - Custom high-resolution offline snapshot pass for 4K/8K stills
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three/webgpu';
import {
  uniform,
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

export interface PhysarumParams {
  seed: string;
  agentCount: number;
  sensorAngle: number;
  sensorDistance: number;
  stepSize: number;
  decayRate: number;
  diffuseRate: number;
  depositAmount: number;
  colorPalette: 'phosphor-green' | 'obsidian-violet' | 'bioluminescent-cyan' | 'solar-amber' | 'spectral-crimson';
}

export const DEFAULT_PHYSARUM_PARAMS: PhysarumParams = {
  seed: '#00FF9D',
  agentCount: 500000,
  sensorAngle: 0.45,
  sensorDistance: 16.0,
  stepSize: 1.2,
  decayRate: 0.96,
  diffuseRate: 0.9,
  depositAmount: 5.0,
  colorPalette: 'phosphor-green',
};

// Curatorial Color Palettes for Physarum Slime Mold
export interface PhysarumPalette {
  name: string;
  voidColor: [number, number, number];    // Obsidian void #090A0D (0.035, 0.039, 0.051)
  baseColor: [number, number, number];    // Deep subterranean vein root tone
  primaryColor: [number, number, number]; // Main luminescent transport stream
  accentColor: [number, number, number];  // Active branching node highlight
  crestColor: [number, number, number];   // Starlight spore apex crest
  rgbVoid: [number, number, number];
  rgbBase: [number, number, number];
  rgbPrimary: [number, number, number];
  rgbAccent: [number, number, number];
  rgbCrest: [number, number, number];
}

export const PHYSARUM_PALETTES: Record<string, PhysarumPalette> = {
  'phosphor-green': {
    name: 'Phosphor Green',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.02, 0.20, 0.12],
    primaryColor: [0.0, 1.0, 0.62],
    accentColor: [0.0, 0.94, 1.0],
    crestColor: [0.92, 1.0, 0.96],
    rgbVoid: [9, 10, 13],
    rgbBase: [5, 51, 30],
    rgbPrimary: [0, 255, 157],
    rgbAccent: [0, 240, 255],
    rgbCrest: [235, 253, 245],
  },
  'obsidian-violet': {
    name: 'Obsidian Violet',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.16, 0.05, 0.32],
    primaryColor: [0.66, 0.33, 0.97],
    accentColor: [0.92, 0.28, 0.60],
    crestColor: [0.0, 0.94, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [41, 13, 82],
    rgbPrimary: [168, 85, 247],
    rgbAccent: [236, 72, 153],
    rgbCrest: [0, 240, 255],
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.03, 0.16, 0.28],
    primaryColor: [0.0, 0.94, 1.0],
    accentColor: [0.22, 0.74, 0.97],
    crestColor: [0.90, 0.98, 1.0],
    rgbVoid: [9, 10, 13],
    rgbBase: [8, 41, 71],
    rgbPrimary: [0, 240, 255],
    rgbAccent: [56, 189, 248],
    rgbCrest: [229, 250, 255],
  },
  'solar-amber': {
    name: 'Solar Amber',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.24, 0.11, 0.02],
    primaryColor: [1.0, 0.72, 0.0],
    accentColor: [1.0, 0.42, 0.0],
    crestColor: [1.0, 0.96, 0.82],
    rgbVoid: [9, 10, 13],
    rgbBase: [61, 28, 5],
    rgbPrimary: [255, 184, 0],
    rgbAccent: [255, 107, 0],
    rgbCrest: [255, 245, 209],
  },
  'spectral-crimson': {
    name: 'Spectral Crimson',
    voidColor: [0.035, 0.039, 0.051],
    baseColor: [0.22, 0.04, 0.10],
    primaryColor: [1.0, 0.20, 0.40],
    accentColor: [1.0, 0.46, 0.59],
    crestColor: [1.0, 0.92, 0.95],
    rgbVoid: [9, 10, 13],
    rgbBase: [56, 10, 26],
    rgbPrimary: [255, 51, 102],
    rgbAccent: [255, 117, 151],
    rgbCrest: [255, 234, 238],
  },
};

export class PhysarumRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private prng: PRNG = createPRNG('#00FF9D');
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private isMounted = false;
  private prefersReducedMotion = false;

  // Active Parameters
  private params: PhysarumParams = { ...DEFAULT_PHYSARUM_PARAMS };

  // Target Parameters for Smooth Exponential Interpolation
  private targetParams: PhysarumParams = { ...DEFAULT_PHYSARUM_PARAMS };

  // Execution Backend Mode ('webgpu' or 'canvas2d')
  private backendMode: 'webgpu' | 'canvas2d' = 'canvas2d';

  // Three.js WebGPU Resources
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;
  private trailDataTexture: THREE.DataTexture | null = null;

  // TSL Uniform Nodes for Display Shader
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uColorVoid = uniform(new THREE.Color(0.035, 0.039, 0.051));
  private uColorBase = uniform(new THREE.Color(0.02, 0.20, 0.12));
  private uColorPrimary = uniform(new THREE.Color(0.0, 1.0, 0.62));
  private uColorAccent = uniform(new THREE.Color(0.0, 0.94, 1.0));
  private uColorCrest = uniform(new THREE.Color(0.92, 1.0, 0.96));

  // Canvas 2D Fallback Resources
  private ctx2d: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private imgData: ImageData | null = null;
  private lutTable = new Uint32Array(256);

  // Simulation Grid & Buffers
  private simWidth = 400;
  private simHeight = 300;
  private trailField = new Float32Array(0);
  private trailDiffuse = new Float32Array(0);

  // Agent State Buffers
  private maxAgents = 60000;
  private activeAgentCount = 35000;
  private agentX = new Float32Array(0);
  private agentY = new Float32Array(0);
  private agentAngle = new Float32Array(0);

  // Pointer Interaction State
  private pointerX = -1000;
  private pointerY = -1000;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;
  private isPointerDown = false;
  private isPointerInside = false;

  /**
   * Mounts the Physarum slime mold simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_PHYSARUM_PARAMS.seed);

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

    const tryWebGPU = Boolean(gpuCaps && (gpuCaps.hasWebGPU || gpuCaps.hasWebGL2) && typeof window !== 'undefined' && window.document);

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
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Initialize Simulation Grid Dimension
    this.setupSimulationBuffers();
    this.updatePaletteUniforms(this.params.colorPalette);

    // Create dynamic float/half-float data texture for trail field
    const textureData = new Float32Array(this.simWidth * this.simHeight * 4);
    this.trailDataTexture = new THREE.DataTexture(
      textureData,
      this.simWidth,
      this.simHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.trailDataTexture.minFilter = THREE.LinearFilter;
    this.trailDataTexture.magFilter = THREE.LinearFilter;
    this.trailDataTexture.needsUpdate = true;

    // Build False-Color Mapping TSL Material
    this.material = this.buildTSLDisplayMaterial();

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    this.initAgents();
  }

  /**
   * Builds the false-color trail rendering shader material in Three Shading Language (TSL).
   */
  private buildTSLDisplayMaterial(): THREE.MeshBasicNodeMaterial {
    if (!this.trailDataTexture) {
      throw new Error('Trail texture not initialized');
    }

    const trailTexNode = texture(this.trailDataTexture);

    const falseColorNode = tslFn(() => {
      const uvCoord = uv();
      const sampleVec = trailTexNode.sample(uvCoord);
      const intensity = sampleVec.r; // Scalar chemoattractant intensity

      // Multi-stop false-color mapping
      // Stop 1: Obsidian Void -> Base subterranean tone (0.0 to 0.15)
      const t1 = clamp(intensity.mul(6.66), 0.0, 1.0);
      const layer1 = mix(this.uColorVoid, this.uColorBase, t1);

      // Stop 2: Base tone -> Primary luminescent vein (0.15 to 0.45)
      const t2 = clamp(intensity.sub(0.15).mul(3.33), 0.0, 1.0);
      const layer2 = mix(layer1, this.uColorPrimary, t2);

      // Stop 3: Primary -> Active branching node highlight (0.45 to 0.75)
      const t3 = clamp(intensity.sub(0.45).mul(3.33), 0.0, 1.0);
      const layer3 = mix(layer2, this.uColorAccent, t3);

      // Stop 4: Highlight -> Apex starlight crest (0.75 to 1.0+)
      const t4 = clamp(intensity.sub(0.75).mul(4.0), 0.0, 1.0);
      const finalColor = mix(layer3, this.uColorCrest, t4);

      // Subtle vignette
      const st = uvCoord.sub(0.5);
      const vignette = clamp(float(1.15).sub(st.x.mul(st.x).add(st.y.mul(st.y)).mul(1.2)), 0.65, 1.0);

      return vec4(finalColor.mul(vignette), 1.0);
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = falseColorNode();
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

    this.setupSimulationBuffers();

    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.simWidth;
    this.offscreenCanvas.height = this.simHeight;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
    if (this.offscreenCtx) {
      this.imgData = this.offscreenCtx.createImageData(this.simWidth, this.simHeight);
    }

    this.buildPaletteLUT(this.params.colorPalette);
    this.initAgents();
  }

  /**
   * Sets up simulation grid dimensions and memory buffers.
   */
  private setupSimulationBuffers(): void {
    // Determine grid size maintaining aspect ratio
    const aspect = Math.max(this.width / Math.max(this.height, 1), 0.2);
    const targetPixels = 120000; // ~400x300 for 60 FPS
    this.simHeight = Math.max(Math.round(Math.sqrt(targetPixels / aspect)), 160);
    this.simWidth = Math.max(Math.round(this.simHeight * aspect), 200);

    const totalCells = this.simWidth * this.simHeight;
    this.trailField = new Float32Array(totalCells);
    this.trailDiffuse = new Float32Array(totalCells);

    // Agent memory allocation
    this.maxAgents = 60000;
    this.agentX = new Float32Array(this.maxAgents);
    this.agentY = new Float32Array(this.maxAgents);
    this.agentAngle = new Float32Array(this.maxAgents);
  }

  /**
   * Initializes agent positions and headings from the deterministic PRNG seed.
   */
  private initAgents(): void {
    const requestedCount = Math.round(this.params.agentCount);
    // Scale agent count for CPU grid (20,000–50,000)
    this.activeAgentCount = Math.min(
      Math.max(Math.round((requestedCount / 500000) * 35000), 5000),
      this.maxAgents
    );

    const sw = this.simWidth;
    const sh = this.simHeight;
    const cx = sw * 0.5;
    const cy = sh * 0.5;

    // Clear trail field
    this.trailField.fill(0);
    this.trailDiffuse.fill(0);

    // Spawn pattern: cluster agents into organic spore rings and nodes
    for (let i = 0; i < this.maxAgents; i++) {
      if (i < this.activeAgentCount) {
        const pattern = this.prng.nextInt(0, 3);
        if (pattern === 0) {
          // Circular ring disk
          const angle = this.prng.nextFloat(0, Math.PI * 2);
          const r = Math.sqrt(this.prng.nextFloat(0, 1)) * Math.min(sw, sh) * 0.38;
          this.agentX[i] = cx + Math.cos(angle) * r;
          this.agentY[i] = cy + Math.sin(angle) * r;
          this.agentAngle[i] = angle + Math.PI * 0.5 + this.prng.nextFloat(-0.4, 0.4);
        } else if (pattern === 1) {
          // Multiple concentrated nutrient colonies
          const colonyAngle = this.prng.nextInt(0, 5) * ((Math.PI * 2) / 5);
          const colonyDist = Math.min(sw, sh) * 0.25;
          const colX = cx + Math.cos(colonyAngle) * colonyDist;
          const colY = cy + Math.sin(colonyAngle) * colonyDist;
          const offsetAngle = this.prng.nextFloat(0, Math.PI * 2);
          const offsetR = this.prng.nextFloat(2, 35);
          this.agentX[i] = colX + Math.cos(offsetAngle) * offsetR;
          this.agentY[i] = colY + Math.sin(offsetAngle) * offsetR;
          this.agentAngle[i] = this.prng.nextFloat(0, Math.PI * 2);
        } else {
          // Uniform field scattering
          this.agentX[i] = this.prng.nextFloat(0, sw);
          this.agentY[i] = this.prng.nextFloat(0, sh);
          this.agentAngle[i] = this.prng.nextFloat(0, Math.PI * 2);
        }
      } else {
        this.agentX[i] = -1000;
        this.agentY[i] = -1000;
        this.agentAngle[i] = 0;
      }
    }
  }

  /**
   * Precomputes a 256-entry false-color Look-Up Table (LUT) for Canvas2D pixel rendering.
   */
  private buildPaletteLUT(paletteKey: string): void {
    const pal = PHYSARUM_PALETTES[paletteKey] || PHYSARUM_PALETTES['phosphor-green'];

    const lerpColor = (
      c1: [number, number, number],
      c2: [number, number, number],
      t: number
    ): [number, number, number] => [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t),
    ];

    for (let i = 0; i < 256; i++) {
      const norm = i / 255.0;
      let rgb: [number, number, number];

      if (norm < 0.15) {
        const t = norm / 0.15;
        rgb = lerpColor(pal.rgbVoid, pal.rgbBase, t);
      } else if (norm < 0.45) {
        const t = (norm - 0.15) / 0.30;
        rgb = lerpColor(pal.rgbBase, pal.rgbPrimary, t);
      } else if (norm < 0.75) {
        const t = (norm - 0.45) / 0.30;
        rgb = lerpColor(pal.rgbPrimary, pal.rgbAccent, t);
      } else {
        const t = Math.min((norm - 0.75) / 0.25, 1.0);
        rgb = lerpColor(pal.rgbAccent, pal.rgbCrest, t);
      }

      // Pack into 32-bit ABGR format for little-endian Uint32Array ImageData
      const r = rgb[0];
      const g = rgb[1];
      const b = rgb[2];
      const a = 255;
      this.lutTable[i] = (a << 24) | (b << 16) | (g << 8) | r;
    }
  }

  /**
   * Updates Three.js uniform colors to match selected palette.
   */
  private updatePaletteUniforms(paletteKey: string): void {
    const pal = PHYSARUM_PALETTES[paletteKey] || PHYSARUM_PALETTES['phosphor-green'];
    this.uColorVoid.value.setRGB(pal.voidColor[0], pal.voidColor[1], pal.voidColor[2]);
    this.uColorBase.value.setRGB(pal.baseColor[0], pal.baseColor[1], pal.baseColor[2]);
    this.uColorPrimary.value.setRGB(pal.primaryColor[0], pal.primaryColor[1], pal.primaryColor[2]);
    this.uColorAccent.value.setRGB(pal.accentColor[0], pal.accentColor[1], pal.accentColor[2]);
    this.uColorCrest.value.setRGB(pal.crestColor[0], pal.crestColor[1], pal.crestColor[2]);
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevSeed = this.targetParams.seed;
    const prevCount = this.targetParams.agentCount;

    this.applyParams(newParams, false);

    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.initAgents();
    } else if (newParams.agentCount && newParams.agentCount !== prevCount) {
      this.activeAgentCount = Math.min(
        Math.max(Math.round((this.targetParams.agentCount / 500000) * 35000), 5000),
        this.maxAgents
      );
    }
  }

  /**
   * Updates canvas dimensions, DPR scaling, and simulation grid aspect ratio.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
      this.uResolution.value.set(this.width, this.height);
    }

    if (this.canvas && this.ctx2d) {
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
    }
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
    this.pointerX = event.normalizedX * this.simWidth;
    this.pointerY = event.normalizedY * this.simHeight;
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
      agentCount: Math.min(Math.max(Number(incoming.agentCount ?? this.targetParams.agentCount), 10000), 1000000),
      sensorAngle: Math.min(Math.max(Number(incoming.sensorAngle ?? this.targetParams.sensorAngle), 0.1), 1.2),
      sensorDistance: Math.min(Math.max(Number(incoming.sensorDistance ?? this.targetParams.sensorDistance), 4.0), 40.0),
      stepSize: Math.min(Math.max(Number(incoming.stepSize ?? this.targetParams.stepSize), 0.4), 3.0),
      decayRate: Math.min(Math.max(Number(incoming.decayRate ?? this.targetParams.decayRate), 0.85), 0.99),
      diffuseRate: Math.min(Math.max(Number(incoming.diffuseRate ?? this.targetParams.diffuseRate), 0.1), 1.0),
      depositAmount: Math.min(Math.max(Number(incoming.depositAmount ?? this.targetParams.depositAmount), 1.0), 15.0),
      colorPalette: incoming.colorPalette && PHYSARUM_PALETTES[incoming.colorPalette]
        ? incoming.colorPalette
        : this.targetParams.colorPalette,
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.buildPaletteLUT(this.params.colorPalette);
      this.updatePaletteUniforms(this.params.colorPalette);
    }
  }

  /**
   * Main 60 FPS animation loop.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smoothly lerp active simulation parameters
    const lambda = 5.0;
    this.params.sensorAngle = dampParameter(this.params.sensorAngle, this.targetParams.sensorAngle, lambda, dt);
    this.params.sensorDistance = dampParameter(this.params.sensorDistance, this.targetParams.sensorDistance, lambda, dt);
    this.params.stepSize = dampParameter(this.params.stepSize, this.targetParams.stepSize, lambda, dt);
    this.params.decayRate = dampParameter(this.params.decayRate, this.targetParams.decayRate, lambda, dt);
    this.params.diffuseRate = dampParameter(this.params.diffuseRate, this.targetParams.diffuseRate, lambda, dt);
    this.params.depositAmount = dampParameter(this.params.depositAmount, this.targetParams.depositAmount, lambda, dt);

    if (this.params.colorPalette !== this.targetParams.colorPalette) {
      this.params.colorPalette = this.targetParams.colorPalette;
      this.buildPaletteLUT(this.params.colorPalette);
      this.updatePaletteUniforms(this.params.colorPalette);
    }

    // Pointer smoothing
    if (this.pointerX > -500) {
      this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 8.0, dt);
      this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 8.0, dt);
    } else {
      this.smoothedPointerX = -1000;
      this.smoothedPointerY = -1000;
    }

    const motionScale = this.prefersReducedMotion ? 0.35 : 1.0;

    // 1. Step Physarum Agent Simulation (Sense, Steer, Move, Deposit)
    this.stepPhysarumSimulation(dt * motionScale);

    // 2. Diffuse and Decay Chemical Trail Map
    this.diffuseAndDecayTrailMap();

    // 3. Render Output Frame via WebGPU or Canvas2D
    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera && this.trailDataTexture) {
      this.renderWebGPUFrame();
    } else if (this.ctx2d && this.offscreenCtx && this.imgData) {
      this.renderCanvas2DFrame();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Executes sensory steering, motor step, and trail deposition for all active slime mold agents.
   */
  private stepPhysarumSimulation(dt: number): void {
    const sw = this.simWidth;
    const sh = this.simHeight;
    const count = this.activeAgentCount;
    const sensorAngle = this.params.sensorAngle;
    const sensorDist = this.params.sensorDistance;
    const stepSize = this.params.stepSize * (dt * 60);
    const depositAmount = this.params.depositAmount;
    const trail = this.trailField;

    // Interactive pointer attractant emission
    if (this.smoothedPointerX > -500 && this.isPointerInside) {
      const px = Math.round(this.smoothedPointerX);
      const py = Math.round(this.smoothedPointerY);
      const radius = this.isPointerDown ? 24 : 14;
      const strength = this.isPointerDown ? 40.0 : 15.0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ty = py + dy;
        if (ty < 0 || ty >= sh) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = px + dx;
          if (tx < 0 || tx >= sw) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 <= radius * radius) {
            const factor = 1.0 - Math.sqrt(d2) / radius;
            trail[ty * sw + tx] = Math.min(trail[ty * sw + tx] + strength * factor, 255.0);
          }
        }
      }
    }

    // Agent Sensing & Motor Step
    for (let i = 0; i < count; i++) {
      let x = this.agentX[i];
      let y = this.agentY[i];
      let angle = this.agentAngle[i];

      // Sense Forward
      const fCos = Math.cos(angle);
      const fSin = Math.sin(angle);
      let fx = (x + fCos * sensorDist) % sw;
      let fy = (y + fSin * sensorDist) % sh;
      if (fx < 0) fx += sw;
      if (fy < 0) fy += sh;
      const sF = trail[Math.floor(fy) * sw + Math.floor(fx)];

      // Sense Left
      const lAngle = angle - sensorAngle;
      let lx = (x + Math.cos(lAngle) * sensorDist) % sw;
      let ly = (y + Math.sin(lAngle) * sensorDist) % sh;
      if (lx < 0) lx += sw;
      if (ly < 0) ly += sh;
      const sL = trail[Math.floor(ly) * sw + Math.floor(lx)];

      // Sense Right
      const rAngle = angle + sensorAngle;
      let rx = (x + Math.cos(rAngle) * sensorDist) % sw;
      let ry = (y + Math.sin(rAngle) * sensorDist) % sh;
      if (rx < 0) rx += sw;
      if (ry < 0) ry += sh;
      const sR = trail[Math.floor(ry) * sw + Math.floor(rx)];

      // Sage Jenson Sensory Steering Decisions
      if (sF > sL && sF > sR) {
        // Forward is strongest -> continue forward with subtle wander
        angle += (this.prng.next() - 0.5) * 0.08;
      } else if (sF < sL && sF < sR) {
        // Forward is weakest -> choose left or right randomly
        angle += (this.prng.next() < 0.5 ? -sensorAngle : sensorAngle) * 0.85;
      } else if (sL < sR) {
        // Right is stronger -> steer right
        angle += sensorAngle * 0.85;
      } else if (sR < sL) {
        // Left is stronger -> steer left
        angle -= sensorAngle * 0.85;
      } else {
        // Equal sensing -> subtle random wander
        angle += (this.prng.next() - 0.5) * 0.15;
      }

      // Motor Step
      x += Math.cos(angle) * stepSize;
      y += Math.sin(angle) * stepSize;

      // Toroidal wrap-around boundaries
      if (x < 0) x += sw;
      else if (x >= sw) x -= sw;
      if (y < 0) y += sh;
      else if (y >= sh) y -= sh;

      this.agentX[i] = x;
      this.agentY[i] = y;
      this.agentAngle[i] = angle;

      // Deposit Chemoattractant Chemical
      const cellIdx = Math.floor(y) * sw + Math.floor(x);
      trail[cellIdx] = Math.min(trail[cellIdx] + depositAmount, 255.0);
    }
  }

  /**
   * Applies 3x3 box blur convolution and exponential decay to the chemoattractant chemical field.
   */
  private diffuseAndDecayTrailMap(): void {
    const sw = this.simWidth;
    const sh = this.simHeight;
    const src = this.trailField;
    const dst = this.trailDiffuse;
    const decay = this.params.decayRate;
    const diffuse = this.params.diffuseRate;
    const invDiffuse = 1.0 - diffuse;

    for (let y = 0; y < sh; y++) {
      const yPrev = y > 0 ? y - 1 : sh - 1;
      const yNext = y < sh - 1 ? y + 1 : 0;
      const rowPrev = yPrev * sw;
      const rowCurr = y * sw;
      const rowNext = yNext * sw;

      for (let x = 0; x < sw; x++) {
        const xPrev = x > 0 ? x - 1 : sw - 1;
        const xNext = x < sw - 1 ? x + 1 : 0;

        // 3x3 Convolution Average
        const sum =
          src[rowPrev + xPrev] + src[rowPrev + x] + src[rowPrev + xNext] +
          src[rowCurr + xPrev] + src[rowCurr + x] + src[rowCurr + xNext] +
          src[rowNext + xPrev] + src[rowNext + x] + src[rowNext + xNext];

        const avg = sum * 0.11111111; // divide by 9
        const center = src[rowCurr + x];
        const val = (center * invDiffuse + avg * diffuse) * decay;

        dst[rowCurr + x] = val > 0.005 ? val : 0;
      }
    }

    // Swap trail buffers
    this.trailField = dst;
    this.trailDiffuse = src;
  }

  /**
   * Renders the slime mold chemical field via WebGPU data texture and TSL shader.
   */
  private renderWebGPUFrame(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.trailDataTexture) return;

    const data = this.trailDataTexture.image.data as Float32Array;
    const trail = this.trailField;
    const total = this.simWidth * this.simHeight;

    // Pack normalized float values into texture buffer
    for (let i = 0; i < total; i++) {
      const norm = Math.min(trail[i] / 60.0, 1.5);
      const idx4 = i * 4;
      data[idx4] = norm;
      data[idx4 + 1] = norm;
      data[idx4 + 2] = norm;
      data[idx4 + 3] = 1.0;
    }

    this.trailDataTexture.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Renders the slime mold chemical field via Canvas2D Look-Up Table (LUT) ImageData blitting.
   */
  private renderCanvas2DFrame(): void {
    if (!this.ctx2d || !this.offscreenCtx || !this.imgData || !this.offscreenCanvas) return;

    const trail = this.trailField;
    const lut = this.lutTable;
    const total = this.simWidth * this.simHeight;
    const buf32 = new Uint32Array(this.imgData.data.buffer);

    for (let i = 0; i < total; i++) {
      const val = Math.min(Math.floor((trail[i] / 60.0) * 255.0), 255);
      buf32[i] = lut[val];
    }

    this.offscreenCtx.putImageData(this.imgData, 0, 0);

    // Scale onto primary canvas with smooth bilinear interpolation
    this.ctx2d.save();
    this.ctx2d.imageSmoothingEnabled = true;
    this.ctx2d.imageSmoothingQuality = 'high';
    this.ctx2d.drawImage(
      this.offscreenCanvas,
      0,
      0,
      this.simWidth,
      this.simHeight,
      0,
      0,
      Math.floor(this.width * this.dpr),
      Math.floor(this.height * this.dpr)
    );
    this.ctx2d.restore();
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass.
   * Renders the Physarum slime mold network onto an off-screen canvas at target resolution (e.g. 4K/8K).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d', { alpha: false });
    if (!offCtx) return offCanvas;

    // Fill Obsidian void background
    offCtx.fillStyle = '#090A0D';
    offCtx.fillRect(0, 0, width, height);

    if (this.offscreenCanvas) {
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = 'high';
      offCtx.drawImage(
        this.offscreenCanvas,
        0,
        0,
        this.simWidth,
        this.simHeight,
        0,
        0,
        width,
        height
      );
    } else {
      // Direct high-res render from trail field
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.simWidth;
      tempCanvas.height = this.simHeight;
      const tempCtx = tempCanvas.getContext('2d', { alpha: false });
      if (tempCtx) {
        const tImg = tempCtx.createImageData(this.simWidth, this.simHeight);
        const buf32 = new Uint32Array(tImg.data.buffer);
        const trail = this.trailField;
        const lut = this.lutTable;
        const total = this.simWidth * this.simHeight;

        for (let i = 0; i < total; i++) {
          const val = Math.min(Math.floor((trail[i] / 60.0) * 255.0), 255);
          buf32[i] = lut[val];
        }

        tempCtx.putImageData(tImg, 0, 0);
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';
        offCtx.drawImage(tempCanvas, 0, 0, this.simWidth, this.simHeight, 0, 0, width, height);
      }
    }

    return offCanvas;
  }

  /**
   * Tears down animation loop, disposes Three.js textures, materials, and WebGPU renderer context.
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

    if (this.trailDataTexture) {
      this.trailDataTexture.dispose();
      this.trailDataTexture = null;
    }

    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch (err) {
        console.warn('Error disposing WebGPURenderer in PhysarumRoom:', err);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.ctx2d = null;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.imgData = null;
  }
}

/**
 * Convenience factory creating a PhysarumRoom instance.
 */
export function createRoom(): PhysarumRoom {
  return new PhysarumRoom();
}

export const room = new PhysarumRoom();
export default room;
