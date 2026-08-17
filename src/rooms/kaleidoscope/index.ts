/**
 * Room 16: Kaleidoscope (Audio-Reactive Radial Symmetry Shader)
 * Curatorial Category: Audio Reactive
 * Math Model: N-Fold Radial Coordinate Reflection, Hyperbolic Tiling & Spectral FFT Warping
 * Compute Engine: Three.js WebGPURenderer / TSL Fragment Shader (with Robust Canvas2D Fallback)
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D Base)
 * 
 * Features:
 * - Real-time N-fold radial symmetry coordinate folding shader:
 *     Cartesian (x, y) -> Polar (r, θ) -> Folded θ' = |mod(θ + α/2 + rot, α) - α/2|
 * - Multi-layered procedural patterns: domain warping, hyperbolic / Coxeter reflection tiling, and harmonic mandala rosettes
 * - Dynamic audio reactivity via Web Audio API (src/lib/audio.ts):
 *     - Bass Energy: Drives zoom tunnel pulsations, scale expansion, and deep core shockwaves
 *     - Mid Frequencies: Modulates rotation velocity and organic flower petal warping
 *     - Treble Transients: Drives chromatic dispersion separation, facet edge shimmer, and micro-harmonic resonance
 *     - RMS Volume: Modulates overall luminance, starlight core bloom, and contrast
 * - Zero-permission procedural ambient synthesizer active on entry, with optional live microphone capture toggle
 * - 6 Canonical Presets: Crystal Mandala, Cosmic Rosette, Sacred Geometry, Hyper Dimension, Flower of Life, Quantum Lattice
 * - 6 Curatorial Palettes: Spectral Aurora, Solar Plasma, Bioluminescent Cyan, Obsidian Emerald, Cosmic Amethyst, Monochrome Void
 * - Interactive pointer dynamics: drag rotation, dynamic zoom scroll, and click shockwave burst
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
  sin,
  cos,
  uv,
  mix,
  length,
  clamp,
  fract,
  abs,
  max,
  min,
  tslFn,
  dot,
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
import { audioManager, type AudioManager, type AudioSourceType } from '../../lib/audio';

export type KaleidoscopePreset =
  | 'crystal-mandala'
  | 'cosmic-rosette'
  | 'sacred-geometry'
  | 'hyper-dimension'
  | 'flower-of-life'
  | 'quantum-lattice';

export type KaleidoscopePalette =
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'bioluminescent-cyan'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-void';

export interface KaleidoscopeParams {
  seed: string;
  preset: KaleidoscopePreset;
  symmetrySegments: number;
  iterations: number;
  zoom: number;
  zoomSpeed: number;
  rotationSpeed: number;
  warpStrength: number;
  hyperbolicScale: number;
  audioSource: AudioSourceType;
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
  chromaticAberration: number;
  glowIntensity: number;
  reliefScale: number;
  colorPalette: KaleidoscopePalette;
  colorCycleSpeed: number;
}

export const DEFAULT_KALEIDOSCOPE_PARAMS: KaleidoscopeParams = {
  seed: '#FF2A6D',
  preset: 'crystal-mandala',
  symmetrySegments: 12,
  iterations: 5,
  zoom: 1.2,
  zoomSpeed: 0.2,
  rotationSpeed: 0.25,
  warpStrength: 0.8,
  hyperbolicScale: 0.4,
  audioSource: 'synth',
  audioSensitivity: 1.6,
  bassReaction: 1.4,
  midReaction: 1.2,
  trebleReaction: 1.5,
  chromaticAberration: 0.018,
  glowIntensity: 1.4,
  reliefScale: 2.2,
  colorPalette: 'spectral-aurora',
  colorCycleSpeed: 0.4,
};

// 6 Canonical Presets
export const KALEIDOSCOPE_PRESETS: Record<KaleidoscopePreset, Partial<KaleidoscopeParams>> = {
  'crystal-mandala': {
    symmetrySegments: 12,
    iterations: 5,
    zoom: 1.2,
    zoomSpeed: 0.2,
    rotationSpeed: 0.25,
    warpStrength: 0.8,
    hyperbolicScale: 0.4,
    bassReaction: 1.2,
    midReaction: 1.0,
    trebleReaction: 1.8,
    chromaticAberration: 0.018,
    glowIntensity: 1.4,
    reliefScale: 2.5,
    colorPalette: 'spectral-aurora',
    colorCycleSpeed: 0.35,
  },
  'cosmic-rosette': {
    symmetrySegments: 8,
    iterations: 4,
    zoom: 0.9,
    zoomSpeed: 0.4,
    rotationSpeed: 0.45,
    warpStrength: 2.0,
    hyperbolicScale: 0.8,
    bassReaction: 1.8,
    midReaction: 1.5,
    trebleReaction: 1.2,
    chromaticAberration: 0.012,
    glowIntensity: 1.5,
    reliefScale: 1.5,
    colorPalette: 'cosmic-amethyst',
    colorCycleSpeed: 0.5,
  },
  'sacred-geometry': {
    symmetrySegments: 6,
    iterations: 6,
    zoom: 1.4,
    zoomSpeed: 0.15,
    rotationSpeed: 0.2,
    warpStrength: 0.5,
    hyperbolicScale: 1.2,
    bassReaction: 1.0,
    midReaction: 1.2,
    trebleReaction: 1.4,
    chromaticAberration: 0.008,
    glowIntensity: 1.1,
    reliefScale: 2.2,
    colorPalette: 'solar-plasma',
    colorCycleSpeed: 0.25,
  },
  'hyper-dimension': {
    symmetrySegments: 16,
    iterations: 4,
    zoom: 0.8,
    zoomSpeed: 0.6,
    rotationSpeed: 0.7,
    warpStrength: 1.6,
    hyperbolicScale: 1.0,
    bassReaction: 1.6,
    midReaction: 1.8,
    trebleReaction: 2.0,
    chromaticAberration: 0.025,
    glowIntensity: 1.8,
    reliefScale: 1.2,
    colorPalette: 'bioluminescent-cyan',
    colorCycleSpeed: 0.6,
  },
  'flower-of-life': {
    symmetrySegments: 10,
    iterations: 3,
    zoom: 1.1,
    zoomSpeed: 0.25,
    rotationSpeed: 0.3,
    warpStrength: 2.2,
    hyperbolicScale: 0.3,
    bassReaction: 1.4,
    midReaction: 1.6,
    trebleReaction: 1.1,
    chromaticAberration: 0.010,
    glowIntensity: 1.3,
    reliefScale: 1.6,
    colorPalette: 'obsidian-emerald',
    colorCycleSpeed: 0.3,
  },
  'quantum-lattice': {
    symmetrySegments: 6,
    iterations: 5,
    zoom: 1.0,
    zoomSpeed: 0.3,
    rotationSpeed: 0.4,
    warpStrength: 1.0,
    hyperbolicScale: 0.9,
    bassReaction: 1.3,
    midReaction: 1.1,
    trebleReaction: 2.2,
    chromaticAberration: 0.022,
    glowIntensity: 1.6,
    reliefScale: 2.8,
    colorPalette: 'monochrome-void',
    colorCycleSpeed: 0.45,
  },
};

// 6 Curatorial Spectral Palettes (4 Harmonious Layers: Void Obsidian, Primary Flow, Accent Glow, Apex Crest)
export interface PaletteDef {
  name: string;
  colorA: [number, number, number]; // #090A0D Void Base
  colorB: [number, number, number]; // Primary Tone
  colorC: [number, number, number]; // Accent Highlight
  colorD: [number, number, number]; // Apex Crest / Starlight
  rgbVoid: [number, number, number];
  rgbPrimary: [number, number, number];
  rgbAccent: [number, number, number];
  rgbCrest: [number, number, number];
}

export const KALEIDOSCOPE_PALETTES: Record<KaleidoscopePalette, PaletteDef> = {
  'spectral-aurora': {
    name: 'Spectral Aurora',
    colorA: [0.035, 0.039, 0.051], // #090A0D
    colorB: [0.0, 0.94, 1.0],      // Electric Cyan (#00F0FF)
    colorC: [0.66, 0.33, 0.97],    // Royal Violet (#A855F7)
    colorD: [0.98, 1.0, 1.0],      // Starlight White
    rgbVoid: [9, 10, 13],
    rgbPrimary: [0, 240, 255],
    rgbAccent: [168, 85, 247],
    rgbCrest: [250, 255, 255],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    colorA: [0.04, 0.02, 0.01],
    colorB: [1.0, 0.60, 0.0],      // Solar Amber (#FF9900)
    colorC: [1.0, 0.20, 0.05],     // Volcanic Flare (#FF3300)
    colorD: [1.0, 0.95, 0.70],     // Solar Gold Crest
    rgbVoid: [10, 5, 3],
    rgbPrimary: [255, 153, 0],
    rgbAccent: [255, 51, 13],
    rgbCrest: [255, 242, 178],
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    colorA: [0.01, 0.04, 0.06],
    colorB: [0.0, 0.90, 1.0],      // Aqua Cyan (#00E5FF)
    colorC: [0.0, 1.0, 0.62],      // Phosphor Mint (#00FF9D)
    colorD: [0.90, 1.0, 0.95],     // Opal Crest
    rgbVoid: [3, 10, 15],
    rgbPrimary: [0, 229, 255],
    rgbAccent: [0, 255, 157],
    rgbCrest: [230, 255, 242],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    colorA: [0.02, 0.04, 0.03],
    colorB: [0.06, 0.73, 0.51],    // Emerald Green (#10B981)
    colorC: [0.52, 0.80, 0.09],    // Neon Lime (#84CC16)
    colorD: [0.95, 0.99, 0.96],    // Silver Quartz
    rgbVoid: [5, 10, 8],
    rgbPrimary: [16, 185, 129],
    rgbAccent: [132, 204, 22],
    rgbCrest: [242, 252, 245],
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    colorA: [0.03, 0.01, 0.06],
    colorB: [0.58, 0.20, 0.92],    // Royal Amethyst (#9333EA)
    colorC: [0.93, 0.28, 0.60],    // Laser Pink (#EC4899)
    colorD: [0.98, 0.92, 1.0],     // Diamond White
    rgbVoid: [8, 3, 15],
    rgbPrimary: [147, 51, 234],
    rgbAccent: [236, 72, 153],
    rgbCrest: [250, 235, 255],
  },
  'monochrome-void': {
    name: 'Monochrome Void',
    colorA: [0.025, 0.027, 0.035],
    colorB: [0.28, 0.33, 0.41],    // Basalt Slate (#475569)
    colorC: [0.79, 0.83, 0.88],    // Silver Chrome (#CBD5E1)
    colorD: [1.0, 1.0, 1.0],       // Pure White
    rgbVoid: [6, 7, 9],
    rgbPrimary: [71, 85, 105],
    rgbAccent: [203, 213, 225],
    rgbCrest: [255, 255, 255],
  },
};

export class KaleidoscopeRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;

  private backendMode: 'webgpu' | 'canvas2d' = 'webgpu';
  private prng: PRNG = createPRNG('#FF2A6D');
  private audio: AudioManager = audioManager;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;
  private isMounted = false;
  private prefersReducedMotion = false;

  // Active Parameters & Target Parameter Lerp State
  private params: KaleidoscopeParams = { ...DEFAULT_KALEIDOSCOPE_PARAMS };
  private targetParams: KaleidoscopeParams = { ...DEFAULT_KALEIDOSCOPE_PARAMS };

  // Audio Feature Envelopes (Smooth Attack/Decay Followers)
  private bassFollower = 0.0;
  private midFollower = 0.0;
  private trebleFollower = 0.0;
  private volumeFollower = 0.0;

  // Interactive Dynamics
  private rotationAngle = 0.0;
  private dragRotationOffset = 0.0;
  private pointerX = 0.0;
  private pointerY = 0.0;
  private smoothedPointerX = 0.0;
  private smoothedPointerY = 0.0;
  private isPointerDown = false;
  private dragStartX = 0.0;
  private dragStartY = 0.0;
  private pulseBurst = 0.0;
  private dynamicZoom = 1.0;

  // TSL Uniform Nodes
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uTime = uniform(0.0);
  private uSymmetry = uniform(12.0);
  private uIterations = uniform(5.0);
  private uZoom = uniform(1.2);
  private uRotation = uniform(0.0);
  private uWarpStrength = uniform(0.8);
  private uHyperbolicScale = uniform(0.4);
  private uBassEnergy = uniform(0.0);
  private uMidEnergy = uniform(0.0);
  private uTrebleEnergy = uniform(0.0);
  private uVolume = uniform(0.0);
  private uChromaticAberration = uniform(0.018);
  private uGlowIntensity = uniform(1.4);
  private uReliefScale = uniform(2.2);
  private uColorCycle = uniform(0.0);
  private uColorCycleSpeed = uniform(0.4);
  private uCenterOffset = uniform(new THREE.Vector2(0.0, 0.0));
  private uPulseBurst = uniform(0.0);

  private uColorA = uniform(new THREE.Color(0.035, 0.039, 0.051));
  private uColorB = uniform(new THREE.Color(0.0, 0.94, 1.0));
  private uColorC = uniform(new THREE.Color(0.66, 0.33, 0.97));
  private uColorD = uniform(new THREE.Color(0.98, 1.0, 1.0));

  // Wheel listener callback reference for cleanup
  private onWheelBound: ((e: WheelEvent) => void) | null = null;

  /**
   * Mounts the kaleidoscope exhibit to the viewport.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = Math.min(ctx.dpr || 1, 2.0);
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_KALEIDOSCOPE_PARAMS.seed);
    if (ctx.audio) {
      this.audio = ctx.audio;
    }

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Detect GPU Capabilities
    const gpuCaps = await detectGPUCapabilities();
    const canUseGPU = gpuCaps.hasWebGPU || gpuCaps.hasWebGL2;

    if (canUseGPU) {
      try {
        await this.initGPURenderer();
        this.backendMode = 'webgpu';
      } catch (err) {
        console.warn('WebGPU/WebGL2 initialization fallback in Room 16:', err);
        this.initCanvas2DFallback();
        this.backendMode = 'canvas2d';
      }
    } else {
      this.initCanvas2DFallback();
      this.backendMode = 'canvas2d';
    }

    // Attach wheel event for smooth interactive zoom scroll
    this.onWheelBound = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * -0.08;
      this.targetParams.zoom = Math.min(Math.max(this.targetParams.zoom + delta, 0.3), 4.0);
      if (ctx.onParamChange) {
        ctx.onParamChange('zoom', this.targetParams.zoom);
      }
    };
    this.canvas.addEventListener('wheel', this.onWheelBound, { passive: false });

    // Initialize Audio Pipeline (default: procedural synth plays automatically without prompts)
    this.syncAudioSource(this.params.audioSource);

    this.isMounted = true;
    this.lastTime = performance.now();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Initializes WebGPURenderer / TSL fullscreen shader quad.
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

    this.material = this.buildTSLMaterial();
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  /**
   * Initializes Canvas2D fallback rendering context.
   */
  private initCanvas2DFallback(): void {
    if (!this.canvas) return;
    this.ctx2d = this.canvas.getContext('2d');
    if (this.ctx2d) {
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
    }
  }

  /**
   * Constructs the Audio-Reactive Radial Symmetry Kaleidoscope TSL Shader Material.
   */
  private buildTSLMaterial(): THREE.MeshBasicNodeMaterial {
    const TWO_PI = 6.283185307179586;
    const PI_HALF = 1.5707963267948966;
    const PI_CONST = 3.141592653589793;

    // Fast 4th-order Chebyshev polynomial approximation of atan2(y, x)
    const angleAtan2 = (y: any, x: any) => {
      const ax = abs(x);
      const ay = abs(y);
      const c = min(ax, ay).div(max(ax, ay).add(0.00001));
      const s = c.mul(c);
      
      // Horner form: ((-0.04649647 * s + 0.15931422) * s - 0.32762276) * s * c + c
      const poly = s.mul(-0.04649647).add(0.15931422).mul(s).sub(0.32762276).mul(s).mul(c).add(c);
      
      // Quadrant / octant mapping
      // if ay > ax -> PI_HALF - poly
      const octantAngle = mix(poly, float(PI_HALF).sub(poly), clamp(ay.sub(ax).mul(1000.0).add(0.5), 0.0, 1.0));
      
      // if x < 0 -> PI - angle
      const halfPlaneAngle = mix(octantAngle, float(PI_CONST).sub(octantAngle), clamp(float(0.0).sub(x).mul(1000.0).add(0.5), 0.0, 1.0));
      
      // if y < 0 -> -angle (or 2PI - angle)
      const fullAngle = mix(halfPlaneAngle, float(TWO_PI).sub(halfPlaneAngle), clamp(float(0.0).sub(y).mul(1000.0).add(0.5), 0.0, 1.0));
      
      return fullAngle;
    };

    // Mathematical coordinate evaluation node
    const evaluatePattern = (coord: any, timeVal: any, warpVal: any, bassVal: any) => {
      let p = coord;
      let accum = float(0.0);
      let weight = float(1.0);

      // Iterative Coxeter reflection folds
      // Octave 1
      p = abs(p).sub(vec2(0.28, 0.28).mul(warpVal));
      const rot1 = vec2(p.x.mul(0.7071).sub(p.y.mul(0.7071)), p.x.mul(0.7071).add(p.y.mul(0.7071)));
      p = rot1.mul(1.35).sub(vec2(0.12, 0.12));
      accum = accum.add(sin(p.x.mul(3.5).add(timeVal)).mul(cos(p.y.mul(3.5).sub(timeVal))).mul(weight));
      weight = weight.mul(0.65);

      // Octave 2
      p = abs(p).sub(vec2(0.22, 0.22).mul(warpVal));
      const rot2 = vec2(p.x.mul(0.866).sub(p.y.mul(0.5)), p.x.mul(0.5).add(p.y.mul(0.866)));
      p = rot2.mul(1.38).sub(vec2(0.10, 0.10));
      accum = accum.add(sin(p.x.mul(4.8).sub(timeVal.mul(1.2))).mul(cos(p.y.mul(4.8).add(timeVal.mul(1.2)))).mul(weight));
      weight = weight.mul(0.60);

      // Octave 3
      p = abs(p).sub(vec2(0.18, 0.18).mul(warpVal));
      const rot3 = vec2(p.x.mul(0.5).sub(p.y.mul(0.866)), p.x.mul(0.866).add(p.y.mul(0.5)));
      p = rot3.mul(1.42).sub(vec2(0.08, 0.08));
      accum = accum.add(sin(p.x.mul(6.2).add(timeVal.mul(1.5))).mul(cos(p.y.mul(6.2).sub(timeVal.mul(1.5)))).mul(weight));
      weight = weight.mul(0.55);

      // Octave 4
      p = abs(p).sub(vec2(0.14, 0.14).mul(warpVal));
      p = vec2(p.x.mul(0.7071).sub(p.y.mul(0.7071)), p.x.mul(0.7071).add(p.y.mul(0.7071))).mul(1.45);
      accum = accum.add(sin(p.x.mul(8.0).sub(timeVal.mul(2.0))).mul(cos(p.y.mul(8.0).add(timeVal.mul(2.0)))).mul(weight));

      // Concentric resonance harmonic ring
      const rDist = length(p);
      const ringHarmonic = cos(rDist.mul(14.0).sub(timeVal.mul(2.5)).sub(bassVal.mul(5.0)));
      accum = accum.add(ringHarmonic.mul(0.45));

      return accum;
    };

    const kaleidoscopeFragNode = tslFn(() => {
      // Screen UV mapped to aspect-ratio corrected centered coordinates
      const st = uv();
      const aspect = this.uResolution.x.div(this.uResolution.y);
      const rawPos = vec2(st.x.sub(0.5).mul(aspect), st.y.sub(0.5));
      const centered = rawPos.sub(this.uCenterOffset);

      const r = length(centered);

      // Angle from centered position
      const theta = angleAtan2(centered.y, centered.x).add(this.uRotation);

      // Radial symmetry fold:
      // Slice angle alpha = 2pi / N
      const sliceAngle = float(TWO_PI).div(this.uSymmetry);
      const halfSlice = sliceAngle.mul(0.5);

      // Folded angle theta' = |mod(theta + halfSlice, sliceAngle) - halfSlice|
      const modAngle = fract(theta.add(halfSlice).div(sliceAngle)).mul(sliceAngle).sub(halfSlice);
      const foldedTheta = abs(modAngle);

      // Polar back to Folded Cartesian coordinates
      const baseFolded = vec2(cos(foldedTheta), sin(foldedTheta)).mul(r).mul(this.uZoom);

      // Hyperbolic coordinate projection / Poincare disk distortion
      const dotProd = dot(baseFolded, baseFolded);
      const invR = float(1.0).div(dotProd.add(0.25));
      const hypCoord = baseFolded.mul(invR).mul(this.uHyperbolicScale);
      const pFolded = baseFolded.mul(float(1.0).sub(this.uHyperbolicScale.mul(0.5))).add(hypCoord);

      // Audio-Reactive Chromatic Dispersion (Treble transients expand RGB radial separation)
      const dispersion = this.uChromaticAberration.mul(float(1.0).add(this.uTrebleEnergy.mul(3.0)));
      const pR = pFolded.mul(float(1.0).add(dispersion));
      const pG = pFolded;
      const pB = pFolded.mul(float(1.0).sub(dispersion));

      const timeVal = this.uTime.mul(0.4);

      // Multi-channel pattern sampling
      const valR = evaluatePattern(pR, timeVal, this.uWarpStrength, this.uBassEnergy);
      const valG = evaluatePattern(pG, timeVal, this.uWarpStrength, this.uBassEnergy);
      const valB = evaluatePattern(pB, timeVal, this.uWarpStrength, this.uBassEnergy);

      const avgVal = valR.add(valG).add(valB).mul(0.3333);

      // Treble facet edge shimmer & micro-resonance
      const facetEdge = abs(sin(foldedTheta.mul(this.uSymmetry).mul(2.0)))
        .mul(cos(r.mul(30.0).add(this.uTime.mul(4.0))))
        .mul(this.uTrebleEnergy)
        .mul(0.5);

      // 3D Normal & Specular Lighting
      const relief = clamp(avgVal.mul(this.uReliefScale).mul(0.4).add(0.5), 0.0, 1.0);
      const specular = relief.mul(relief).mul(relief).mul(this.uGlowIntensity);

      // Color Palette S-Curve Blending
      const phase = fract(avgVal.mul(0.35).add(this.uColorCycle).add(this.uTime.mul(this.uColorCycleSpeed).mul(0.1)));

      // 4 Harmonious Layers: Void Obsidian (A) -> Primary (B) -> Accent (C) -> Crest (D)
      const mixAB = mix(this.uColorA, this.uColorB, clamp(phase.mul(2.5), 0.0, 1.0));
      const mixBC = mix(mixAB, this.uColorC, clamp(phase.sub(0.4).mul(2.5), 0.0, 1.0));
      const mixCD = mix(mixBC, this.uColorD, clamp(phase.sub(0.75).mul(4.0), 0.0, 1.0));

      // Separate RGB Chromatic dispersion tinting
      const colorOut = vec3(
        mixCD.x.mul(clamp(valR.add(1.0).mul(0.5), 0.2, 1.4)),
        mixCD.y.mul(clamp(valG.add(1.0).mul(0.5), 0.2, 1.4)),
        mixCD.z.mul(clamp(valB.add(1.0).mul(0.5), 0.2, 1.4))
      );

      // Starlight Core Luminescence & Audio Shockwave Pulse
      const coreGlow = clamp(float(1.0).sub(r.mul(1.8)), 0.0, 1.0)
        .mul(this.uGlowIntensity)
        .mul(float(0.8).add(this.uBassEnergy.mul(1.2)));

      const shockwave = clamp(float(1.0).sub(abs(r.sub(this.uPulseBurst.mul(1.2))).mul(8.0)), 0.0, 1.0)
        .mul(this.uPulseBurst)
        .mul(2.0);

      // Vignette framing
      const vignette = clamp(float(1.15).sub(length(rawPos).mul(0.45)), 0.5, 1.0);

      const finalRgb = colorOut
        .add(vec3(specular).mul(0.6))
        .add(vec3(facetEdge).mul(this.uColorD))
        .add(this.uColorC.mul(coreGlow.mul(0.7)))
        .add(this.uColorD.mul(shockwave))
        .mul(vignette);

      return vec4(finalRgb, 1.0);
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = kaleidoscopeFragNode();
    return mat;
  }

  /**
   * Connects or switches the Web Audio API audio source.
   */
  public async syncAudioSource(source: AudioSourceType): Promise<void> {
    this.targetParams.audioSource = source;
    this.params.audioSource = source;

    if (source === 'synth') {
      try {
        await this.audio.startSynth();
      } catch (err) {
        console.warn('Unable to start procedural ambient synth:', err);
      }
    } else if (source === 'mic') {
      try {
        const success = await this.audio.connectMicrophone();
        if (!success) {
          this.targetParams.audioSource = 'synth';
          this.params.audioSource = 'synth';
        }
      } catch (err) {
        console.warn('Unable to connect microphone:', err);
      }
    } else if (source === 'none') {
      this.audio.stop();
    }
  }

  /**
   * Receives parameter updates from Tweakpane or URL hash sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevPreset = this.targetParams.preset;
    const prevPalette = this.targetParams.colorPalette;
    const prevAudioSource = this.targetParams.audioSource;
    const prevSeed = this.targetParams.seed;

    this.applyParams(newParams, false);

    // If preset changed, apply canonical preset parameters smoothly
    if (newParams.preset && newParams.preset !== prevPreset && KALEIDOSCOPE_PRESETS[newParams.preset as KaleidoscopePreset]) {
      const presetConfig = KALEIDOSCOPE_PRESETS[newParams.preset as KaleidoscopePreset];
      Object.assign(this.targetParams, presetConfig);
    }

    // If palette changed, update palette uniforms
    if (newParams.colorPalette && newParams.colorPalette !== prevPalette) {
      this.updatePaletteUniforms(this.targetParams.colorPalette);
    }

    // If audio source changed, synchronize audio engine
    if (newParams.audioSource && newParams.audioSource !== prevAudioSource) {
      this.syncAudioSource(newParams.audioSource);
    }

    // If seed changed, reseed PRNG
    if (newParams.seed && newParams.seed !== prevSeed) {
      this.prng = createPRNG(newParams.seed);
      this.reseedParameters();
    }
  }

  /**
   * Handles viewport resize events.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
    }

    if (this.ctx2d && this.canvas) {
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
    }

    this.uResolution.value.set(this.width, this.height);
  }

  /**
   * Handles pointer events from RoomViewer viewport controller.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.isPointerDown = false;
      this.pointerX = 0;
      this.pointerY = 0;
      return;
    }

    // Convert normalized [0, 1] coords to centered aspect-aware coords [-0.5, 0.5]
    const aspect = this.width / Math.max(this.height, 1);
    const currX = (event.normalizedX - 0.5) * aspect;
    const currY = (1.0 - event.normalizedY - 0.5);

    if (event.type === 'down') {
      this.isPointerDown = true;
      this.dragStartX = currX;
      this.dragStartY = currY;

      // Trigger energy shockwave pulse burst on click/tap
      this.pulseBurst = 1.0;
    } else if (event.type === 'move' && this.isPointerDown) {
      const dx = currX - this.dragStartX;
      const dy = currY - this.dragStartY;
      this.dragRotationOffset += (dx * 1.5 - dy * 1.5);
      this.dragStartX = currX;
      this.dragStartY = currY;
    } else if (event.type === 'up') {
      this.isPointerDown = false;
    }

    this.pointerX = currX;
    this.pointerY = currY;
  }

  /**
   * Reseeds kaleidoscope variations deterministically.
   */
  private reseedParameters(): void {
    this.rotationAngle = this.prng.nextFloat(0, Math.PI * 2);
    this.targetParams.colorCycleSpeed = this.prng.nextFloat(0.2, 0.8);
    this.targetParams.warpStrength = this.prng.nextFloat(0.6, 2.2);
  }

  /**
   * Merges incoming parameter values.
   */
  private applyParams(incoming: Record<string, any>, isInitial: boolean): void {
    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      preset: incoming.preset && KALEIDOSCOPE_PRESETS[incoming.preset as KaleidoscopePreset]
        ? (incoming.preset as KaleidoscopePreset)
        : this.targetParams.preset,
      symmetrySegments: Math.min(Math.max(Math.round(Number(incoming.symmetrySegments ?? this.targetParams.symmetrySegments)), 3), 24),
      iterations: Math.min(Math.max(Math.round(Number(incoming.iterations ?? this.targetParams.iterations)), 1), 8),
      zoom: Math.min(Math.max(Number(incoming.zoom ?? this.targetParams.zoom), 0.2), 4.0),
      zoomSpeed: Math.min(Math.max(Number(incoming.zoomSpeed ?? this.targetParams.zoomSpeed), -1.0), 2.0),
      rotationSpeed: Math.min(Math.max(Number(incoming.rotationSpeed ?? this.targetParams.rotationSpeed), -2.0), 2.0),
      warpStrength: Math.min(Math.max(Number(incoming.warpStrength ?? this.targetParams.warpStrength), 0.0), 3.0),
      hyperbolicScale: Math.min(Math.max(Number(incoming.hyperbolicScale ?? this.targetParams.hyperbolicScale), 0.0), 2.0),
      audioSource: incoming.audioSource === 'mic' || incoming.audioSource === 'none' || incoming.audioSource === 'synth'
        ? incoming.audioSource
        : this.targetParams.audioSource,
      audioSensitivity: Math.min(Math.max(Number(incoming.audioSensitivity ?? this.targetParams.audioSensitivity), 0.0), 5.0),
      bassReaction: Math.min(Math.max(Number(incoming.bassReaction ?? this.targetParams.bassReaction), 0.0), 3.0),
      midReaction: Math.min(Math.max(Number(incoming.midReaction ?? this.targetParams.midReaction), 0.0), 3.0),
      trebleReaction: Math.min(Math.max(Number(incoming.trebleReaction ?? this.targetParams.trebleReaction), 0.0), 3.0),
      chromaticAberration: Math.min(Math.max(Number(incoming.chromaticAberration ?? this.targetParams.chromaticAberration), 0.0), 0.05),
      glowIntensity: Math.min(Math.max(Number(incoming.glowIntensity ?? this.targetParams.glowIntensity), 0.0), 3.0),
      reliefScale: Math.min(Math.max(Number(incoming.reliefScale ?? this.targetParams.reliefScale), 0.0), 4.0),
      colorPalette: incoming.colorPalette && KALEIDOSCOPE_PALETTES[incoming.colorPalette as KaleidoscopePalette]
        ? (incoming.colorPalette as KaleidoscopePalette)
        : this.targetParams.colorPalette,
      colorCycleSpeed: Math.min(Math.max(Number(incoming.colorCycleSpeed ?? this.targetParams.colorCycleSpeed), 0.0), 2.0),
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.updatePaletteUniforms(this.params.colorPalette);
    }
  }

  /**
   * Updates color uniform nodes to match selected palette.
   */
  private updatePaletteUniforms(paletteKey: KaleidoscopePalette): void {
    const pal = KALEIDOSCOPE_PALETTES[paletteKey] || KALEIDOSCOPE_PALETTES['spectral-aurora'];
    this.uColorA.value.setRGB(pal.colorA[0], pal.colorA[1], pal.colorA[2]);
    this.uColorB.value.setRGB(pal.colorB[0], pal.colorB[1], pal.colorB[2]);
    this.uColorC.value.setRGB(pal.colorC[0], pal.colorC[1], pal.colorC[2]);
    this.uColorD.value.setRGB(pal.colorD[0], pal.colorD[1], pal.colorD[2]);
  }

  /**
   * 60 FPS Real-Time Simulation and Shader Evaluation Loop.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smooth parameter damping (400ms exponential decay)
    const lambda = 5.0;
    this.params.symmetrySegments = Math.round(dampParameter(this.params.symmetrySegments, this.targetParams.symmetrySegments, lambda, dt));
    this.params.iterations = Math.round(dampParameter(this.params.iterations, this.targetParams.iterations, lambda, dt));
    this.params.zoom = dampParameter(this.params.zoom, this.targetParams.zoom, lambda, dt);
    this.params.zoomSpeed = dampParameter(this.params.zoomSpeed, this.targetParams.zoomSpeed, lambda, dt);
    this.params.rotationSpeed = dampParameter(this.params.rotationSpeed, this.targetParams.rotationSpeed, lambda, dt);
    this.params.warpStrength = dampParameter(this.params.warpStrength, this.targetParams.warpStrength, lambda, dt);
    this.params.hyperbolicScale = dampParameter(this.params.hyperbolicScale, this.targetParams.hyperbolicScale, lambda, dt);
    this.params.audioSensitivity = dampParameter(this.params.audioSensitivity, this.targetParams.audioSensitivity, lambda, dt);
    this.params.bassReaction = dampParameter(this.params.bassReaction, this.targetParams.bassReaction, lambda, dt);
    this.params.midReaction = dampParameter(this.params.midReaction, this.targetParams.midReaction, lambda, dt);
    this.params.trebleReaction = dampParameter(this.params.trebleReaction, this.targetParams.trebleReaction, lambda, dt);
    this.params.chromaticAberration = dampParameter(this.params.chromaticAberration, this.targetParams.chromaticAberration, lambda, dt);
    this.params.glowIntensity = dampParameter(this.params.glowIntensity, this.targetParams.glowIntensity, lambda, dt);
    this.params.reliefScale = dampParameter(this.params.reliefScale, this.targetParams.reliefScale, lambda, dt);
    this.params.colorCycleSpeed = dampParameter(this.params.colorCycleSpeed, this.targetParams.colorCycleSpeed, lambda, dt);

    if (this.params.colorPalette !== this.targetParams.colorPalette) {
      this.params.colorPalette = this.targetParams.colorPalette;
      this.updatePaletteUniforms(this.params.colorPalette);
    }

    // Extract real-time audio FFT spectral feature bands
    const bands = this.audio.getFrequencyBands();
    const sens = this.params.audioSensitivity;
    const rawBass = bands.bass * sens;
    const rawMid = bands.mid * sens;
    const rawTreble = bands.treble * sens;
    const rawVol = bands.volume * sens;

    // Fast-attack, smooth-decay envelope followers
    this.bassFollower = dampParameter(this.bassFollower, rawBass, 12.0, dt);
    this.midFollower = dampParameter(this.midFollower, rawMid, 10.0, dt);
    this.trebleFollower = dampParameter(this.trebleFollower, rawTreble, 15.0, dt);
    this.volumeFollower = dampParameter(this.volumeFollower, rawVol, 8.0, dt);

    // Audio-modulated rotation and zoom evolution
    const motionScale = this.prefersReducedMotion ? 0.2 : 1.0;
    const rotationVelocity = (this.params.rotationSpeed + this.midFollower * this.params.midReaction * 0.75) * motionScale;
    this.rotationAngle += rotationVelocity * dt;

    // Dynamic zoom pulse from bass energy and click bursts
    this.pulseBurst = Math.max(0.0, this.pulseBurst - dt * 2.2);
    const bassZoomMod = this.bassFollower * this.params.bassReaction * 0.35 + this.pulseBurst * 0.45;
    this.dynamicZoom = this.params.zoom * (1.0 + bassZoomMod);

    // Continuous time accumulator
    this.totalTime += dt * motionScale;

    // Pointer smoothing
    this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 8.0, dt);
    this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 8.0, dt);

    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera) {
      // Sync Uniforms
      this.uTime.value = this.totalTime;
      this.uSymmetry.value = this.params.symmetrySegments;
      this.uIterations.value = this.params.iterations;
      this.uZoom.value = this.dynamicZoom;
      this.uRotation.value = this.rotationAngle + this.dragRotationOffset;
      this.uWarpStrength.value = this.params.warpStrength * (1.0 + this.midFollower * this.params.midReaction * 0.4);
      this.uHyperbolicScale.value = this.params.hyperbolicScale;
      this.uBassEnergy.value = this.bassFollower * this.params.bassReaction;
      this.uMidEnergy.value = this.midFollower * this.params.midReaction;
      this.uTrebleEnergy.value = this.trebleFollower * this.params.trebleReaction;
      this.uVolume.value = this.volumeFollower;
      this.uChromaticAberration.value = this.params.chromaticAberration;
      this.uGlowIntensity.value = this.params.glowIntensity * (1.0 + this.volumeFollower * 0.5);
      this.uReliefScale.value = this.params.reliefScale;
      this.uColorCycle.value = (this.totalTime * this.params.colorCycleSpeed * 0.15) % 1.0;
      this.uColorCycleSpeed.value = this.params.colorCycleSpeed;
      this.uCenterOffset.value.set(this.smoothedPointerX * 0.25, this.smoothedPointerY * 0.25);
      this.uPulseBurst.value = this.pulseBurst;

      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d' && this.ctx2d && this.canvas) {
      this.renderCanvas2DFallback();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * High-Performance Canvas2D Radial Symmetry Fallback Renderer.
   */
  private renderCanvas2DFallback(): void {
    if (!this.ctx2d || !this.canvas) return;

    const ctx = this.ctx2d;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * 0.5 + this.smoothedPointerX * w * 0.15;
    const cy = h * 0.5 - this.smoothedPointerY * h * 0.15;
    const maxRadius = Math.max(w, h) * 0.65 * (1.0 / Math.max(this.dynamicZoom, 0.1));

    const pal = KALEIDOSCOPE_PALETTES[this.params.colorPalette] || KALEIDOSCOPE_PALETTES['spectral-aurora'];
    const n = Math.max(3, Math.min(24, this.params.symmetrySegments));
    const slice = (Math.PI * 2) / n;

    // Dark Obsidian Void Background
    ctx.fillStyle = `rgb(${pal.rgbVoid[0]}, ${pal.rgbVoid[1]}, ${pal.rgbVoid[2]})`;
    ctx.fillRect(0, 0, w, h);

    const rot = this.rotationAngle + this.dragRotationOffset;

    // Draw Radial Symmetrical Wedges
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot + i * slice);
      if (i % 2 === 1) {
        ctx.scale(1, -1);
      }

      // Clip wedge slice to enforce crisp kaleidoscope mirrors
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(maxRadius * Math.cos(0), maxRadius * Math.sin(0));
      ctx.arc(0, 0, maxRadius, 0, slice);
      ctx.closePath();
      ctx.clip();

      // Render concentric procedural mandala rosettes and hyperbolic arcs
      const layers = Math.min(this.params.iterations + 2, 7);
      for (let l = 1; l <= layers; l++) {
        const radFrac = l / layers;
        const rad = maxRadius * radFrac;
        const phase = (this.totalTime * this.params.colorCycleSpeed * 0.2 + l * 0.2) % 1.0;

        // Alternate palette colors
        const [rC, gC, bC] =
          phase < 0.33 ? pal.rgbPrimary : phase < 0.66 ? pal.rgbAccent : pal.rgbCrest;

        ctx.strokeStyle = `rgba(${rC}, ${gC}, ${bC}, ${0.35 + this.bassFollower * 0.3})`;
        ctx.lineWidth = Math.max(1.5, 3.0 * (1.0 + this.trebleFollower * 1.5));

        // Facet geometry
        ctx.beginPath();
        const petals = 3;
        for (let p = 0; p <= petals; p++) {
          const a = (p / petals) * slice;
          const warp = Math.sin(a * 4.0 + this.totalTime + l) * 25.0 * this.params.warpStrength;
          const px = (rad + warp) * Math.cos(a);
          const py = (rad + warp) * Math.sin(a);
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Facet polygon nodes
        ctx.fillStyle = `rgba(${pal.rgbCrest[0]}, ${pal.rgbCrest[1]}, ${pal.rgbCrest[2]}, ${0.4 + this.trebleFollower * 0.5})`;
        ctx.beginPath();
        ctx.arc(rad * 0.7 * Math.cos(slice * 0.5), rad * 0.7 * Math.sin(slice * 0.5), 3.0 + this.pulseBurst * 4.0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Starlight Core Luminescence Glow
    const coreRad = Math.min(w, h) * 0.15 * (1.0 + this.bassFollower * 0.6);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRad * 2.0);
    grad.addColorStop(0, `rgba(${pal.rgbCrest[0]}, ${pal.rgbCrest[1]}, ${pal.rgbCrest[2]}, ${0.8 * this.params.glowIntensity})`);
    grad.addColorStop(0.3, `rgba(${pal.rgbAccent[0]}, ${pal.rgbAccent[1]}, ${pal.rgbAccent[2]}, ${0.4 * this.params.glowIntensity})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRad * 2.0, 0, Math.PI * 2);
    ctx.fill();

    // Shockwave pulse ring
    if (this.pulseBurst > 0.05) {
      ctx.save();
      ctx.strokeStyle = `rgba(${pal.rgbCrest[0]}, ${pal.rgbCrest[1]}, ${pal.rgbCrest[2]}, ${this.pulseBurst * 0.8})`;
      ctx.lineWidth = 4.0;
      ctx.beginPath();
      ctx.arc(cx, cy, this.pulseBurst * Math.min(w, h) * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass.
   * Renders the kaleidoscope shader onto an off-screen canvas at target resolution (e.g. 4K).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;

    try {
      const offRenderer = new THREE.WebGPURenderer({
        canvas: offCanvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });

      await offRenderer.init();

      offRenderer.setSize(width, height, false);
      offRenderer.setPixelRatio(1);

      const offScene = new THREE.Scene();
      const offCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const offMaterial = this.buildTSLMaterial();
      const offMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), offMaterial);
      offScene.add(offMesh);

      // Temporarily sync resolution to off-screen dimensions
      this.uResolution.value.set(width, height);
      offRenderer.render(offScene, offCamera);

      // Restore viewport resolution
      this.uResolution.value.set(this.width, this.height);

      offMaterial.dispose();
      offMesh.geometry.dispose();
      offRenderer.dispose();
    } catch (err) {
      console.warn('Kaleidoscope captureSnapshot fallback:', err);
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        const savedCtx = this.ctx2d;
        const savedCanvas = this.canvas;
        this.ctx2d = offCtx;
        this.canvas = offCanvas;
        this.renderCanvas2DFallback();
        this.ctx2d = savedCtx;
        this.canvas = savedCanvas;
      }
    }

    return offCanvas;
  }

  /**
   * Returns whether the room simulation is currently mounted.
   */
  public isSimulationMounted(): boolean {
    return this.isMounted;
  }

  /**
   * Tears down Three.js scene, disposes shader materials, geometries, and WebGPU renderer context.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.canvas && this.onWheelBound) {
      this.canvas.removeEventListener('wheel', this.onWheelBound);
      this.onWheelBound = null;
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch (err) {
        console.warn('Error disposing WebGPURenderer in KaleidoscopeRoom:', err);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.ctx2d = null;
    this.canvas = null;
  }
}

/**
 * Convenience factory creating a KaleidoscopeRoom instance.
 */
export function createRoom(): KaleidoscopeRoom {
  return new KaleidoscopeRoom();
}

export const room = new KaleidoscopeRoom();
export default room;
