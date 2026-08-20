/**
 * Room 19: Plasma Field (Multi-Wave Trigonometric Interference & Palette Cycling)
 * Curatorial Category: Psychedelic & Optical
 * Math Model: Composite Multi-Wave Trigonometric Interference with Inigo Quilez Cosine Gradient Palette Cycling
 * Compute Engine: Three.js WebGPURenderer / TSL Fragment Shader (WebGPU WGSL / WebGL2 Fallback) & Canvas2D Fallback
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D Base)
 * 
 * Features:
 * - Real-time composite trigonometric plasma potential function in pure TSL:
 *     P(x, y, t) = sin(k1·x + ω1·t) + sin(k2·y + ω2·t) + sin(k3·(x·cos θ + y·sin θ) + ω3·t)
 *                + sin(||(x, y) - c(t)||·k4 + ω4·t) + W_pointer(x, y, t)
 * - Non-linear coordinate domain warping & phase distortion:
 *     x' = x + warpStrength · sin(warpFreq · y + t)
 *     y' = y + warpStrength · cos(warpFreq · x + t)
 * - Inigo Quilez Cosine Gradient Color Mapping:
 *     C(P) = a + b · cos(2π · (c · P + d))
 *   Seamless, bandless color cycling across 7 curated palettes.
 * - Dynamic interactive cursor wave emitter: mouse position generates expanding concentric ripples and refractive phase shifts.
 * - Real-time Web Audio API frequency analysis modulating wave frequencies, domain warping, and chromatic phase cycles.
 * - 7 Curated Canonical Presets: Classic Demoscene, Liquid Neon, Obsidian Gold, Acid Vortex, Quantum Ripples, Cosmic Aurora, Monochrome Lithic.
 * - 7 Curatorial Spectral Palettes: Rainbow Demoscene, Neon Cyan/Magenta, Obsidian Gold, Acid Green, Spectral Aurora, Cosmic Amethyst, Monochrome Lithic.
 * - Custom high-resolution offline snapshot pass (captureSnapshot) for 4K/8K stills.
 * - Complete resource disposal lifecycle.
 */

import * as THREE from 'three/webgpu';
import {
  uniform,
  vec3,
  vec4,
  float,
  sin,
  cos,
  uv,
  mix,
  clamp,
  tslFn,
  exp,
  sqrt,
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

export type PlasmaPreset =
  | 'classic-demoscene'
  | 'liquid-neon'
  | 'obsidian-gold'
  | 'acid-vortex'
  | 'quantum-ripples'
  | 'cosmic-aurora'
  | 'monochrome-lithic';

export type PlasmaPalette =
  | 'rainbow-demoscene'
  | 'neon-cyan-magenta'
  | 'obsidian-gold'
  | 'acid-green'
  | 'spectral-aurora'
  | 'cosmic-amethyst'
  | 'monochrome-lithic';

export interface PlasmaParams {
  seed: string;
  preset: PlasmaPreset;
  k1: number;                 // Wave 1 horizontal frequency (0.5..15.0)
  k2: number;                 // Wave 2 vertical frequency (0.5..15.0)
  k3: number;                 // Wave 3 diagonal frequency (0.5..15.0)
  k4: number;                 // Wave 4 radial frequency (0.5..25.0)
  waveAngle: number;          // Slant angle for diagonal wave (rad, 0.0..3.14)
  warpStrength: number;       // Non-linear domain warp amplitude (0.0..3.0)
  warpFrequency: number;      // Domain warp frequency (0.5..10.0)
  animSpeed: number;          // Evolution & oscillation speed (0.0..3.0)
  colorCycleSpeed: number;    // Continuous palette cycling rate (0.0..3.0)
  colorCycles: number;        // Cosine gradient frequency multiplier (0.5..5.0)
  contrast: number;           // Plasma field contrast / sharpness (0.5..3.0)
  brightness: number;         // Exposure / DC bias (-0.5..0.5)
  colorPalette: PlasmaPalette;
  rippleStrength: number;     // Interactive cursor wave emitter power (0.0..3.0)
  rippleFrequency: number;    // Cursor concentric ripple frequency (2.0..30.0)
  audioSource: AudioSourceType;
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
}

export const DEFAULT_PLASMA_PARAMS: PlasmaParams = {
  seed: '#00F0FF',
  preset: 'classic-demoscene',
  k1: 3.0,
  k2: 3.0,
  k3: 4.0,
  k4: 5.0,
  waveAngle: 0.785,
  warpStrength: 0.35,
  warpFrequency: 2.0,
  animSpeed: 0.9,
  colorCycleSpeed: 0.6,
  colorCycles: 1.0,
  contrast: 1.25,
  brightness: 0.0,
  colorPalette: 'rainbow-demoscene',
  rippleStrength: 1.2,
  rippleFrequency: 14.0,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.2,
  midReaction: 1.0,
  trebleReaction: 1.4,
};

// 7 Curated Canonical Presets
export const PLASMA_PRESETS: Record<PlasmaPreset, Partial<PlasmaParams>> = {
  'classic-demoscene': {
    k1: 3.0,
    k2: 3.0,
    k3: 4.0,
    k4: 5.0,
    waveAngle: 0.785,
    warpStrength: 0.35,
    warpFrequency: 2.0,
    animSpeed: 0.9,
    colorCycleSpeed: 0.6,
    colorCycles: 1.0,
    contrast: 1.25,
    brightness: 0.0,
    rippleStrength: 1.2,
    rippleFrequency: 14.0,
    colorPalette: 'rainbow-demoscene',
  },
  'liquid-neon': {
    k1: 2.5,
    k2: 4.0,
    k3: 3.5,
    k4: 6.0,
    waveAngle: 1.2,
    warpStrength: 0.85,
    warpFrequency: 3.0,
    animSpeed: 0.75,
    colorCycleSpeed: 0.85,
    colorCycles: 1.4,
    contrast: 1.5,
    brightness: 0.04,
    rippleStrength: 1.5,
    rippleFrequency: 16.0,
    colorPalette: 'neon-cyan-magenta',
  },
  'obsidian-gold': {
    k1: 4.0,
    k2: 2.2,
    k3: 5.0,
    k4: 4.5,
    waveAngle: 0.52,
    warpStrength: 0.5,
    warpFrequency: 2.4,
    animSpeed: 0.55,
    colorCycleSpeed: 0.45,
    colorCycles: 1.2,
    contrast: 1.65,
    brightness: -0.08,
    rippleStrength: 1.2,
    rippleFrequency: 13.0,
    colorPalette: 'obsidian-gold',
  },
  'acid-vortex': {
    k1: 6.0,
    k2: 6.0,
    k3: 8.0,
    k4: 10.0,
    waveAngle: 1.57,
    warpStrength: 1.2,
    warpFrequency: 4.2,
    animSpeed: 1.3,
    colorCycleSpeed: 1.1,
    colorCycles: 2.0,
    contrast: 1.8,
    brightness: 0.08,
    rippleStrength: 1.8,
    rippleFrequency: 20.0,
    colorPalette: 'acid-green',
  },
  'quantum-ripples': {
    k1: 8.0,
    k2: 5.0,
    k3: 6.0,
    k4: 12.0,
    waveAngle: 2.35,
    warpStrength: 0.25,
    warpFrequency: 1.6,
    animSpeed: 1.1,
    colorCycleSpeed: 0.7,
    colorCycles: 2.4,
    contrast: 1.4,
    brightness: 0.0,
    rippleStrength: 2.2,
    rippleFrequency: 24.0,
    colorPalette: 'spectral-aurora',
  },
  'cosmic-aurora': {
    k1: 2.2,
    k2: 3.2,
    k3: 3.0,
    k4: 4.2,
    waveAngle: 0.95,
    warpStrength: 0.65,
    warpFrequency: 2.1,
    animSpeed: 0.5,
    colorCycleSpeed: 0.4,
    colorCycles: 1.1,
    contrast: 1.3,
    brightness: -0.04,
    rippleStrength: 1.1,
    rippleFrequency: 11.0,
    colorPalette: 'cosmic-amethyst',
  },
  'monochrome-lithic': {
    k1: 4.0,
    k2: 4.0,
    k3: 5.2,
    k4: 7.0,
    waveAngle: 1.15,
    warpStrength: 0.45,
    warpFrequency: 3.2,
    animSpeed: 0.65,
    colorCycleSpeed: 0.35,
    colorCycles: 1.8,
    contrast: 1.75,
    brightness: -0.06,
    rippleStrength: 1.3,
    rippleFrequency: 15.0,
    colorPalette: 'monochrome-lithic',
  },
};

// Inigo Quilez Cosine Gradient Parameter Defs: C(t) = a + b * cos(2pi * (c * t + d))
export interface CosinePaletteDef {
  name: string;
  a: [number, number, number]; // DC bias / offset
  b: [number, number, number]; // Amplitude
  c: [number, number, number]; // Frequency / cycles
  d: [number, number, number]; // Phase shift
}

export const PLASMA_PALETTES: Record<PlasmaPalette, CosinePaletteDef> = {
  'rainbow-demoscene': {
    name: 'Rainbow Demoscene',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.333, 0.667],
  },
  'neon-cyan-magenta': {
    name: 'Neon Cyan / Magenta',
    a: [0.5, 0.2, 0.5],
    b: [0.5, 0.4, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.5, 0.2, 0.25],
  },
  'obsidian-gold': {
    name: 'Obsidian Gold',
    a: [0.5, 0.4, 0.2],
    b: [0.5, 0.4, 0.2],
    c: [2.0, 1.0, 0.5],
    d: [0.0, 0.15, 0.2],
  },
  'acid-green': {
    name: 'Acid Green',
    a: [0.2, 0.5, 0.2],
    b: [0.2, 0.5, 0.3],
    c: [1.0, 2.0, 1.0],
    d: [0.1, 0.35, 0.15],
  },
  'spectral-aurora': {
    name: 'Spectral Aurora',
    a: [0.3, 0.5, 0.6],
    b: [0.4, 0.5, 0.4],
    c: [1.0, 1.0, 1.0],
    d: [0.2, 0.4, 0.6],
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    a: [0.5, 0.2, 0.6],
    b: [0.5, 0.3, 0.4],
    c: [1.0, 1.5, 1.0],
    d: [0.3, 0.1, 0.5],
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.0, 0.0],
  },
};

export class PlasmaRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private renderer: THREE.WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicNodeMaterial | null = null;

  public prng: PRNG = createPRNG('#00F0FF');
  private audio: AudioManager = audioManager;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private totalTime = 0;
  private colorPhase = 0;
  private isMounted = false;
  private prefersReducedMotion = false;
  private backendMode: 'webgpu' | 'canvas2d' = 'webgpu';

  // Active Parameters
  private params: PlasmaParams = { ...DEFAULT_PLASMA_PARAMS };
  private targetParams: PlasmaParams = { ...DEFAULT_PLASMA_PARAMS };

  // Audio envelope followers
  private bassFollower = 0;
  private midFollower = 0;
  private trebleFollower = 0;
  private volumeFollower = 0;

  // Pointer dynamics
  private pointerX = -1000;
  private pointerY = -1000;
  private smoothedPointerX = -1000;
  private smoothedPointerY = -1000;
  private pointerActive = 0.0;
  private pulseBurst = 0.0;

  // TSL Uniform Nodes
  private uTime = uniform(0.0);
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uK1 = uniform(3.0);
  private uK2 = uniform(3.0);
  private uK3 = uniform(4.0);
  private uK4 = uniform(5.0);
  private uWaveAngle = uniform(0.785);
  private uWarpStrength = uniform(0.35);
  private uWarpFrequency = uniform(2.0);
  private uAnimSpeed = uniform(0.9);
  private uColorPhase = uniform(0.0);
  private uColorCycles = uniform(1.0);
  private uContrast = uniform(1.25);
  private uBrightness = uniform(0.0);
  private uRippleStrength = uniform(1.2);
  private uRippleFrequency = uniform(14.0);
  private uPointer = uniform(new THREE.Vector2(-1000.0, -1000.0));
  private uPointerActive = uniform(0.0);
  private uBassEnergy = uniform(0.0);
  private uMidEnergy = uniform(0.0);
  private uTrebleEnergy = uniform(0.0);
  private uPulseBurst = uniform(0.0);

  // Inigo Quilez Cosine Gradient Uniforms (vec3)
  private uColorA = uniform(new THREE.Vector3(0.5, 0.5, 0.5));
  private uColorB = uniform(new THREE.Vector3(0.5, 0.5, 0.5));
  private uColorC = uniform(new THREE.Vector3(1.0, 1.0, 1.0));
  private uColorD = uniform(new THREE.Vector3(0.0, 0.333, 0.667));

  /**
   * Mounts the WebGPU / TSL simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.audio = ctx.audio || audioManager;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_PLASMA_PARAMS.seed);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyParams(ctx.params, true);

    const initialW = Math.max(ctx.canvas.clientWidth || ctx.canvas.width || 800, 320);
    const initialH = Math.max(ctx.canvas.clientHeight || ctx.canvas.height || 600, 320);
    this.width = initialW;
    this.height = initialH;

    // Detect GPU capabilities
    const caps = await detectGPUCapabilities();
    const canUseThree = typeof THREE !== 'undefined' && typeof THREE.WebGPURenderer === 'function';

    if (canUseThree && (caps.hasWebGPU || caps.hasWebGL2)) {
      try {
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

        this.backendMode = 'webgpu';
      } catch (err) {
        console.warn('WebGPU/WebGL2 initialization fallback in Room 19 (Plasma Field):', err);
        this.initCanvas2DFallback();
      }
    } else {
      this.initCanvas2DFallback();
    }

    // Set up audio source
    await this.syncAudioSource(this.params.audioSource);

    this.isMounted = true;
    this.lastTime = performance.now();

    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    return () => {
      this.teardown();
    };
  }

  /**
   * Initializes high-performance 2D canvas fallback.
   */
  private initCanvas2DFallback(): void {
    if (!this.canvas) return;
    this.backendMode = 'canvas2d';
    this.ctx2d = this.canvas.getContext('2d', { alpha: false });
  }

  /**
   * Constructs the full-screen trigonometric plasma and Inigo Quilez cosine gradient shader in TSL.
   */
  private buildTSLMaterial(): THREE.MeshBasicNodeMaterial {
    const plasmaColorNode = tslFn(() => {
      const st = uv();
      const aspect = this.uResolution.x.div(this.uResolution.y);

      // Centered coordinate space with aspect correction
      const x = st.x.sub(0.5).mul(aspect);
      const y = st.y.sub(0.5);

      const t = this.uTime.mul(this.uAnimSpeed);

      // Non-linear domain warping & phase distortion
      const dynamicWarp = this.uWarpStrength.add(this.uMidEnergy.mul(0.35));
      const wx = x.add(dynamicWarp.mul(sin(y.mul(this.uWarpFrequency).add(t.mul(0.6)))));
      const wy = y.add(dynamicWarp.mul(cos(x.mul(this.uWarpFrequency).add(t.mul(0.7)))));

      // 1. Horizontal wave: W1 = sin(k1 * wx + t * 0.9)
      const w1 = sin(wx.mul(this.uK1).add(t.mul(0.9)));

      // 2. Vertical wave: W2 = sin(k2 * wy + t * 1.1)
      const w2 = sin(wy.mul(this.uK2).add(t.mul(1.1)));

      // 3. Diagonal wave slanted by waveAngle θ: W3 = sin(k3 * (wx * cos θ + wy * sin θ) + t * 1.3)
      const cosA = cos(this.uWaveAngle);
      const sinA = sin(this.uWaveAngle);
      const diagCoord = wx.mul(cosA).add(wy.mul(sinA));
      const w3 = sin(diagCoord.mul(this.uK3).add(t.mul(1.3)));

      // 4. Concentric circular wave from orbiting center (cx, cy): W4 = sin(r * k4 - t * 1.5)
      const cx = sin(t.mul(0.35)).mul(0.32);
      const cy = cos(t.mul(0.45)).mul(0.26);
      const dx4 = wx.sub(cx);
      const dy4 = wy.sub(cy);
      const r4 = sqrt(dx4.mul(dx4).add(dy4.mul(dy4)).add(0.0001));
      const dynamicK4 = this.uK4.add(this.uBassEnergy.mul(2.5));
      const w4 = sin(r4.mul(dynamicK4).sub(t.mul(1.5)));

      // 5. Dynamic cursor emitter ripple wave: W5
      const ptrX = this.uPointer.x.sub(0.5).mul(aspect);
      const ptrY = this.uPointer.y.sub(0.5);
      const dxP = wx.sub(ptrX);
      const dyP = wy.sub(ptrY);
      const distP = sqrt(dxP.mul(dxP).add(dyP.mul(dyP)).add(0.0001));
      const rippleDecay = exp(distP.mul(-2.8));
      const rippleWave = sin(distP.mul(this.uRippleFrequency).sub(t.mul(3.5))).mul(rippleDecay);
      const w5 = rippleWave.mul(this.uRippleStrength).mul(this.uPointerActive.add(this.uPulseBurst));

      // Composite plasma potential: P = (W1 + W2 + W3 + W4 + W5) / 4.0
      const compositeP = w1.add(w2).add(w3).add(w4).add(w5).mul(0.25);

      // Contrast & DC bias tone shaping
      const shapedP = compositeP.mul(this.uContrast).add(this.uBrightness);

      // Continuous palette cycling parameter
      const colorVal = shapedP.mul(this.uColorCycles).add(this.uColorPhase);

      // Inigo Quilez Cosine Gradient Mapping: C(P) = a + b * cos(2pi * (c * P + d))
      const twoPi = float(Math.PI * 2.0);
      const cTerm = this.uColorC.mul(colorVal).add(this.uColorD);
      const cosTerm = cos(twoPi.mul(cTerm));
      const rawColor = clamp(this.uColorA.add(this.uColorB.mul(cosTerm)), float(0.0), float(1.0));

      // Subtle Obsidian Void base blending (#090A0D) & radial vignette
      const distCenter = sqrt(x.mul(x).add(y.mul(y)).add(0.0001));
      const vignette = clamp(float(1.0).sub(distCenter.mul(0.35)), float(0.1), float(1.0));
      const voidBase = vec3(0.035, 0.039, 0.051); // #090A0D
      const finalRgb = mix(voidBase, rawColor, vignette);

      return vec4(finalRgb, 1.0);
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = plasmaColorNode();
    return mat;
  }

  /**
   * Applies incoming configuration parameters with clamping.
   */
  private applyParams(incoming: Record<string, any>, isInitial = false): void {
    if (incoming.preset && incoming.preset !== this.targetParams.preset && PLASMA_PRESETS[incoming.preset as PlasmaPreset]) {
      const presetValues = PLASMA_PRESETS[incoming.preset as PlasmaPreset];
      Object.assign(this.targetParams, presetValues);
      this.targetParams.preset = incoming.preset as PlasmaPreset;
    }

    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      preset: incoming.preset && PLASMA_PRESETS[incoming.preset as PlasmaPreset]
        ? (incoming.preset as PlasmaPreset)
        : this.targetParams.preset,
      k1: Math.min(Math.max(Number(incoming.k1 ?? this.targetParams.k1), 0.5), 15.0),
      k2: Math.min(Math.max(Number(incoming.k2 ?? this.targetParams.k2), 0.5), 15.0),
      k3: Math.min(Math.max(Number(incoming.k3 ?? this.targetParams.k3), 0.5), 15.0),
      k4: Math.min(Math.max(Number(incoming.k4 ?? this.targetParams.k4), 0.5), 25.0),
      waveAngle: Math.min(Math.max(Number(incoming.waveAngle ?? this.targetParams.waveAngle), 0.0), 3.14),
      warpStrength: Math.min(Math.max(Number(incoming.warpStrength ?? this.targetParams.warpStrength), 0.0), 3.0),
      warpFrequency: Math.min(Math.max(Number(incoming.warpFrequency ?? this.targetParams.warpFrequency), 0.5), 10.0),
      animSpeed: Math.min(Math.max(Number(incoming.animSpeed ?? this.targetParams.animSpeed), 0.0), 3.0),
      colorCycleSpeed: Math.min(Math.max(Number(incoming.colorCycleSpeed ?? this.targetParams.colorCycleSpeed), 0.0), 3.0),
      colorCycles: Math.min(Math.max(Number(incoming.colorCycles ?? this.targetParams.colorCycles), 0.5), 5.0),
      contrast: Math.min(Math.max(Number(incoming.contrast ?? this.targetParams.contrast), 0.5), 3.0),
      brightness: Math.min(Math.max(Number(incoming.brightness ?? this.targetParams.brightness), -0.5), 0.5),
      colorPalette: incoming.colorPalette && PLASMA_PALETTES[incoming.colorPalette as PlasmaPalette]
        ? (incoming.colorPalette as PlasmaPalette)
        : this.targetParams.colorPalette,
      rippleStrength: Math.min(Math.max(Number(incoming.rippleStrength ?? this.targetParams.rippleStrength), 0.0), 3.0),
      rippleFrequency: Math.min(Math.max(Number(incoming.rippleFrequency ?? this.targetParams.rippleFrequency), 2.0), 30.0),
      audioSource: (incoming.audioSource as AudioSourceType) ?? this.targetParams.audioSource,
      audioSensitivity: Math.min(Math.max(Number(incoming.audioSensitivity ?? this.targetParams.audioSensitivity), 0.0), 3.0),
      bassReaction: Math.min(Math.max(Number(incoming.bassReaction ?? this.targetParams.bassReaction), 0.0), 3.0),
      midReaction: Math.min(Math.max(Number(incoming.midReaction ?? this.targetParams.midReaction), 0.0), 3.0),
      trebleReaction: Math.min(Math.max(Number(incoming.trebleReaction ?? this.targetParams.trebleReaction), 0.0), 3.0),
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.updatePaletteUniforms(this.params.colorPalette);
    }
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
   * Updates Inigo Quilez cosine gradient uniforms to match selected palette.
   */
  private updatePaletteUniforms(paletteKey: PlasmaPalette): void {
    const pal = PLASMA_PALETTES[paletteKey] || PLASMA_PALETTES['rainbow-demoscene'];
    this.uColorA.value.set(pal.a[0], pal.a[1], pal.a[2]);
    this.uColorB.value.set(pal.b[0], pal.b[1], pal.b[2]);
    this.uColorC.value.set(pal.c[0], pal.c[1], pal.c[2]);
    this.uColorD.value.set(pal.d[0], pal.d[1], pal.d[2]);
  }

  /**
   * Updates room parameters dynamically via Tweakpane or URL state sync.
   */
  public updateParams(newParams: Record<string, any>): void {
    const prevAudioSource = this.params.audioSource;
    this.applyParams(newParams, false);

    if (newParams.audioSource && newParams.audioSource !== prevAudioSource) {
      this.syncAudioSource(newParams.audioSource);
    }
  }

  /**
   * Handles viewport resize events.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 320);
    this.height = Math.max(height, 320);

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
    }

    this.uResolution.value.set(this.width, this.height);
  }

  /**
   * Handles pointer input for interactive wave emitter & ripple bursts.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.pointerActive = 0.0;
      this.pointerX = -1000;
      this.pointerY = -1000;
      return;
    }

    this.pointerX = event.normalizedX;
    this.pointerY = 1.0 - event.normalizedY; // Invert for shader UV coords (0 at bottom, 1 at top)
    this.pointerActive = 1.0;

    if (event.type === 'down') {
      this.pulseBurst = 1.0;
    }
  }

  /**
   * 60 FPS Real-Time Simulation and Shader Evaluation Loop.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // Smooth parameter damping (exponential decay)
    const lambda = 5.0;
    this.params.k1 = dampParameter(this.params.k1, this.targetParams.k1, lambda, dt);
    this.params.k2 = dampParameter(this.params.k2, this.targetParams.k2, lambda, dt);
    this.params.k3 = dampParameter(this.params.k3, this.targetParams.k3, lambda, dt);
    this.params.k4 = dampParameter(this.params.k4, this.targetParams.k4, lambda, dt);
    this.params.waveAngle = dampParameter(this.params.waveAngle, this.targetParams.waveAngle, lambda, dt);
    this.params.warpStrength = dampParameter(this.params.warpStrength, this.targetParams.warpStrength, lambda, dt);
    this.params.warpFrequency = dampParameter(this.params.warpFrequency, this.targetParams.warpFrequency, lambda, dt);
    this.params.animSpeed = dampParameter(this.params.animSpeed, this.targetParams.animSpeed, lambda, dt);
    this.params.colorCycleSpeed = dampParameter(this.params.colorCycleSpeed, this.targetParams.colorCycleSpeed, lambda, dt);
    this.params.colorCycles = dampParameter(this.params.colorCycles, this.targetParams.colorCycles, lambda, dt);
    this.params.contrast = dampParameter(this.params.contrast, this.targetParams.contrast, lambda, dt);
    this.params.brightness = dampParameter(this.params.brightness, this.targetParams.brightness, lambda, dt);
    this.params.rippleStrength = dampParameter(this.params.rippleStrength, this.targetParams.rippleStrength, lambda, dt);
    this.params.rippleFrequency = dampParameter(this.params.rippleFrequency, this.targetParams.rippleFrequency, lambda, dt);
    this.params.audioSensitivity = dampParameter(this.params.audioSensitivity, this.targetParams.audioSensitivity, lambda, dt);
    this.params.bassReaction = dampParameter(this.params.bassReaction, this.targetParams.bassReaction, lambda, dt);
    this.params.midReaction = dampParameter(this.params.midReaction, this.targetParams.midReaction, lambda, dt);
    this.params.trebleReaction = dampParameter(this.params.trebleReaction, this.targetParams.trebleReaction, lambda, dt);

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

    // Continuous time and color phase evolution
    const motionScale = this.prefersReducedMotion ? 0.2 : 1.0;
    this.totalTime += dt * motionScale;

    // Treble transient modulation on color cycling speed
    const dynamicCycleRate = (this.params.colorCycleSpeed + this.trebleFollower * this.params.trebleReaction * 0.5) * motionScale;
    this.colorPhase = (this.colorPhase + dynamicCycleRate * dt * 0.2) % 1000.0;

    // Pointer smoothing
    this.smoothedPointerX = dampParameter(this.smoothedPointerX, this.pointerX, 10.0, dt);
    this.smoothedPointerY = dampParameter(this.smoothedPointerY, this.pointerY, 10.0, dt);
    this.pulseBurst = Math.max(0.0, this.pulseBurst - dt * 2.0);

    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera) {
      // Sync Uniforms
      this.uTime.value = this.totalTime;
      this.uK1.value = this.params.k1;
      this.uK2.value = this.params.k2;
      this.uK3.value = this.params.k3;
      this.uK4.value = this.params.k4;
      this.uWaveAngle.value = this.params.waveAngle;
      this.uWarpStrength.value = this.params.warpStrength;
      this.uWarpFrequency.value = this.params.warpFrequency;
      this.uAnimSpeed.value = this.params.animSpeed;
      this.uColorPhase.value = this.colorPhase;
      this.uColorCycles.value = this.params.colorCycles;
      this.uContrast.value = this.params.contrast;
      this.uBrightness.value = this.params.brightness;
      this.uRippleStrength.value = this.params.rippleStrength;
      this.uRippleFrequency.value = this.params.rippleFrequency;
      this.uPointer.value.set(this.smoothedPointerX, this.smoothedPointerY);
      this.uPointerActive.value = this.pointerActive;
      this.uBassEnergy.value = this.bassFollower * this.params.bassReaction;
      this.uMidEnergy.value = this.midFollower * this.params.midReaction;
      this.uTrebleEnergy.value = this.trebleFollower * this.params.trebleReaction;
      this.uPulseBurst.value = this.pulseBurst;

      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d' && this.ctx2d && this.canvas) {
      this.renderCanvas2DFallback();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * High-Performance Canvas2D Fallback Renderer with analytical Inigo Quilez Cosine Gradient evaluation.
   */
  private renderCanvas2DFallback(): void {
    if (!this.ctx2d || !this.canvas) return;

    const ctx = this.ctx2d;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w <= 0 || h <= 0) return;

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const pal = PLASMA_PALETTES[this.params.colorPalette] || PLASMA_PALETTES['rainbow-demoscene'];
    const aspect = w / h;
    const t = this.totalTime * this.params.animSpeed;
    const warpStr = this.params.warpStrength + this.midFollower * this.params.midReaction * 0.35;
    const warpFreq = this.params.warpFrequency;
    const cosAngle = Math.cos(this.params.waveAngle);
    const sinAngle = Math.sin(this.params.waveAngle);

    const cx = Math.sin(t * 0.35) * 0.32;
    const cy = Math.cos(t * 0.45) * 0.26;
    const k4Dynamic = this.params.k4 + this.bassFollower * 2.5;

    const ptrActive = this.pointerActive > 0.1 || this.pulseBurst > 0.05;
    const ptrX = (this.smoothedPointerX - 0.5) * aspect;
    const ptrY = this.smoothedPointerY - 0.5;

    const colorCycles = this.params.colorCycles;
    const colorPhase = this.colorPhase;
    const contrast = this.params.contrast;
    const brightness = this.params.brightness;

    const twoPi = Math.PI * 2.0;

    // Sub-sample step size for 60 FPS Canvas2D performance (step = 2 or 3)
    const step = w > 600 ? 3 : 2;

    for (let y = 0; y < h; y += step) {
      const v = (1.0 - y / h) - 0.5;

      for (let x = 0; x < w; x += step) {
        const u = (x / w - 0.5) * aspect;

        // Domain warping
        const wx = u + warpStr * Math.sin(v * warpFreq + t * 0.6);
        const wy = v + warpStr * Math.cos(u * warpFreq + t * 0.7);

        // Waves
        const w1 = Math.sin(wx * this.params.k1 + t * 0.9);
        const w2 = Math.sin(wy * this.params.k2 + t * 1.1);
        const w3 = Math.sin((wx * cosAngle + wy * sinAngle) * this.params.k3 + t * 1.3);

        const dx4 = wx - cx;
        const dy4 = wy - cy;
        const r4 = Math.sqrt(dx4 * dx4 + dy4 * dy4 + 0.0001);
        const w4 = Math.sin(r4 * k4Dynamic - t * 1.5);

        let w5 = 0;
        if (ptrActive) {
          const dxP = wx - ptrX;
          const dyP = wy - ptrY;
          const distP = Math.sqrt(dxP * dxP + dyP * dyP + 0.0001);
          const ripDecay = Math.exp(-2.8 * distP);
          w5 = Math.sin(distP * this.params.rippleFrequency - t * 3.5) * ripDecay * this.params.rippleStrength * (this.pointerActive + this.pulseBurst);
        }

        const P = (w1 + w2 + w3 + w4 + w5) * 0.25;
        const shapedP = P * contrast + brightness;
        const colorVal = shapedP * colorCycles + colorPhase;

        // Inigo Quilez Cosine Gradient: a + b * cos(2pi * (c * val + d))
        const cr = Math.min(Math.max(pal.a[0] + pal.b[0] * Math.cos(twoPi * (pal.c[0] * colorVal + pal.d[0])), 0), 1);
        const cg = Math.min(Math.max(pal.a[1] + pal.b[1] * Math.cos(twoPi * (pal.c[1] * colorVal + pal.d[1])), 0), 1);
        const cb = Math.min(Math.max(pal.a[2] + pal.b[2] * Math.cos(twoPi * (pal.c[2] * colorVal + pal.d[2])), 0), 1);

        // Vignette
        const distCenter = Math.sqrt(u * u + v * v + 0.0001);
        const vig = Math.min(Math.max(1.0 - distCenter * 0.35, 0.1), 1.0);

        // Void base (#090A0D) blend
        const rByte = Math.floor((cr * vig * 0.965 + 0.035) * 255);
        const gByte = Math.floor((cg * vig * 0.961 + 0.039) * 255);
        const bByte = Math.floor((cb * vig * 0.949 + 0.051) * 255);

        for (let dy = 0; dy < step && y + dy < h; dy++) {
          for (let dx = 0; dx < step && x + dx < w; dx++) {
            const idx = ((y + dy) * w + (x + dx)) * 4;
            data[idx] = rByte;
            data[idx + 1] = gByte;
            data[idx + 2] = bByte;
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Offline high-resolution snapshot export hook for still rendering (up to 4K/8K).
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to obtain 2D snapshot context.');

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const pal = PLASMA_PALETTES[this.params.colorPalette] || PLASMA_PALETTES['rainbow-demoscene'];
    const aspect = width / height;
    const t = this.totalTime * this.params.animSpeed;
    const warpStr = this.params.warpStrength;
    const warpFreq = this.params.warpFrequency;
    const cosAngle = Math.cos(this.params.waveAngle);
    const sinAngle = Math.sin(this.params.waveAngle);

    const cx = Math.sin(t * 0.35) * 0.32;
    const cy = Math.cos(t * 0.45) * 0.26;
    const k4Dynamic = this.params.k4;

    const colorCycles = this.params.colorCycles;
    const colorPhase = this.colorPhase;
    const contrast = this.params.contrast;
    const brightness = this.params.brightness;
    const twoPi = Math.PI * 2.0;

    for (let y = 0; y < height; y++) {
      const v = (1.0 - y / height) - 0.5;

      for (let x = 0; x < width; x++) {
        const u = (x / width - 0.5) * aspect;

        const wx = u + warpStr * Math.sin(v * warpFreq + t * 0.6);
        const wy = v + warpStr * Math.cos(u * warpFreq + t * 0.7);

        const w1 = Math.sin(wx * this.params.k1 + t * 0.9);
        const w2 = Math.sin(wy * this.params.k2 + t * 1.1);
        const w3 = Math.sin((wx * cosAngle + wy * sinAngle) * this.params.k3 + t * 1.3);

        const dx4 = wx - cx;
        const dy4 = wy - cy;
        const r4 = Math.sqrt(dx4 * dx4 + dy4 * dy4 + 0.0001);
        const w4 = Math.sin(r4 * k4Dynamic - t * 1.5);

        const P = (w1 + w2 + w3 + w4) * 0.25;
        const shapedP = P * contrast + brightness;
        const colorVal = shapedP * colorCycles + colorPhase;

        const cr = Math.min(Math.max(pal.a[0] + pal.b[0] * Math.cos(twoPi * (pal.c[0] * colorVal + pal.d[0])), 0), 1);
        const cg = Math.min(Math.max(pal.a[1] + pal.b[1] * Math.cos(twoPi * (pal.c[1] * colorVal + pal.d[1])), 0), 1);
        const cb = Math.min(Math.max(pal.a[2] + pal.b[2] * Math.cos(twoPi * (pal.c[2] * colorVal + pal.d[2])), 0), 1);

        const distCenter = Math.sqrt(u * u + v * v + 0.0001);
        const vig = Math.min(Math.max(1.0 - distCenter * 0.35, 0.1), 1.0);

        const idx = (y * width + x) * 4;
        data[idx] = Math.floor((cr * vig * 0.965 + 0.035) * 255);
        data[idx + 1] = Math.floor((cg * vig * 0.961 + 0.039) * 255);
        data[idx + 2] = Math.floor((cb * vig * 0.949 + 0.051) * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return snapCanvas;
  }

  /**
   * Cleans up all GPU resources, event listeners, and timers.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      this.mesh = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
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

export function createRoom(): RoomInstance {
  return new PlasmaRoom();
}

export const room: RoomInstance = new PlasmaRoom();
export default room;
