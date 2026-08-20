/**
 * Room 21: Moiré Interference Patterns (Dynamic Rotational Gratings & Optical Shimmer)
 * Curatorial Category: Psychedelic & Optical
 * Math Model: Superimposed Multi-Layer Geometric Gratings (Ronchi Rulings, Fresnel Zone Plates, Spirals, Radial Spokes & Hex Lattices) with Chromatic Dispersion
 * Compute Engine: Three.js WebGPURenderer / TSL Fragment Shader (WebGPU WGSL / WebGL2 Fallback) & High-Performance Canvas2D Fallback
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D Base)
 * 
 * Features:
 * - Analytical geometric grating functions:
 *     1. Linear Ronchi rulings: G_line(x) = 0.5 + 0.5 · cos(k · (x cos θ + y sin θ) + φ)
 *     2. Concentric circular rings: G_ring(x) = 0.5 + 0.5 · cos(k · ||x - c|| + φ)
 *     3. Fresnel quadratic zone plates: G_fresnel(x) = 0.5 + 0.5 · cos(k · ||x - c||² · 2.5 + φ)
 *     4. Radial spokes: G_spoke(x) = 0.5 + 0.5 · cos(N · (atan2(y, x) + θ) + φ)
 *     5. Logarithmic spirals: G_spiral(x) = 0.5 + 0.5 · cos(k · ln(r · 8 + 1) + m · (atan2(y, x) + θ) + φ)
 *     6. Hexagonal dot lattice: G_hex(x) = 0.5 + 1/6 · (cos(k · u) + cos(k · (-0.5u + √3/2 v)) + cos(k · (-0.5u - √3/2 v)))
 * - Waveform profiles: Cosine, Antialiased Ronchi Bar (smoothstep), Triangle Wave, Sinusoidal Power.
 * - 2 to 4 overlapping grating layers with independent rotation velocities ω_i, density scales s_i, and center translations c_i.
 * - 6 Layer Blend Modes: Multiplication (physical overlay), Addition (superposition), Difference (contours), XOR (interference), Min (transmission cut), Max (highlight union).
 * - Interactive pointer dynamics: pointer displacement shifts focal centers of secondary/tertiary layers with smooth spring inertia.
 * - Chromatic dispersion mode: spectral frequency/angle offsets for prismatic rainbow optical interference.
 * - Real-time Web Audio API frequency analysis modulating layer rotations, radial pulsation, and chromatic shimmer.
 * - 7 Curated Canonical Presets: Rotational Rings, Counter Spokes, Cross Rulings, Spiral Vortex, Fresnel Zone Beat, Chromatic Shimmer, Hexagonal Lattice.
 * - 7 Curatorial Spectral Palettes: Monochrome Op-Art, Monochrome Inverted, Spectral Dispersion, Obsidian Gold, Cyber Neon, Solar Plasma, Bioluminescent Cyan.
 * - High-resolution offline snapshot export (captureSnapshot).
 * - Complete resource disposal lifecycle.
 */

import * as THREE from 'three/webgpu';
import {
  uniform,
  vec4,
  float,
  sin,
  cos,
  atan2,
  log,
  pow,
  abs,
  min,
  max,
  mix,
  clamp,
  smoothstep,
  fract,
  uv,
  tslFn,
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

export type MoirePreset =
  | 'rotational-rings'
  | 'counter-spokes'
  | 'cross-rulings'
  | 'spiral-vortex'
  | 'fresnel-zone-beat'
  | 'chromatic-shimmer'
  | 'hexagonal-lattice';

export type MoireGratingType =
  | 'rings'
  | 'linear'
  | 'spokes'
  | 'spirals'
  | 'fresnel'
  | 'hex';

export type MoireWaveform =
  | 'cosine'
  | 'ronchi'
  | 'triangle'
  | 'sinusoidal-power';

export type MoireBlendMode =
  | 'multiplication'
  | 'addition'
  | 'difference'
  | 'xor'
  | 'min'
  | 'max';

export type MoirePalette =
  | 'monochrome-op-art'
  | 'monochrome-inverted'
  | 'spectral-dispersion'
  | 'obsidian-gold'
  | 'cyber-neon'
  | 'solar-plasma'
  | 'bioluminescent-cyan';

export interface MoireParams {
  seed: string;
  preset: MoirePreset;
  gratingType: MoireGratingType;
  waveform: MoireWaveform;
  layerCount: number;             // 2..4
  density: number;                // 5.0..120.0 (spatial frequency k)
  sharpness: number;              // 0.1..3.0 (antialiasing / fringe edge contrast)
  rotationSpeed1: number;         // -3.0..3.0 (layer 1 angular velocity)
  rotationSpeed2: number;         // -3.0..3.0 (layer 2 angular velocity)
  rotationSpeed3: number;         // -3.0..3.0 (layer 3 angular velocity)
  rotationSpeed4: number;         // -3.0..3.0 (layer 4 angular velocity)
  angleOffset: number;            // 0.0..3.14 (static angle step between layers)
  scaleRatio: number;             // 0.8..1.5 (scale multiplier per layer)
  centerDistance: number;         // 0.0..0.4 (static layer center displacement)
  blendMode: MoireBlendMode;
  spiralArms: number;             // 1..24 (log spiral branch count)
  spokeCount: number;             // 8..120 (radial spoke count)
  pointerInfluence: number;       // 0.0..3.0 (cursor epicenter shift power)
  pointerInertia: number;         // 2.0..25.0 (spring damping rate)
  chromaticMode: boolean;         // Enable prismatic spectral dispersion
  chromaticDispersion: number;    // 0.0..0.25 (R/G/B frequency & angle offset)
  colorPalette: MoirePalette;
  contrast: number;               // 0.5..3.0
  brightness: number;             // -0.5..0.5
  audioSource: AudioSourceType;
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
}

export const DEFAULT_MOIRE_PARAMS: MoireParams = {
  seed: '#00F0FF',
  preset: 'rotational-rings',
  gratingType: 'rings',
  waveform: 'cosine',
  layerCount: 2,
  density: 38.0,
  sharpness: 1.2,
  rotationSpeed1: 0.12,
  rotationSpeed2: -0.15,
  rotationSpeed3: 0.25,
  rotationSpeed4: -0.35,
  angleOffset: 0.08,
  scaleRatio: 1.0,
  centerDistance: 0.05,
  blendMode: 'multiplication',
  spiralArms: 6,
  spokeCount: 36,
  pointerInfluence: 1.2,
  pointerInertia: 12.0,
  chromaticMode: false,
  chromaticDispersion: 0.05,
  colorPalette: 'monochrome-op-art',
  contrast: 1.3,
  brightness: 0.0,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.2,
  midReaction: 1.0,
  trebleReaction: 1.4,
};

// 7 Curated Canonical Presets
export const MOIRE_PRESETS: Record<MoirePreset, Partial<MoireParams>> = {
  'rotational-rings': {
    gratingType: 'rings',
    waveform: 'cosine',
    layerCount: 2,
    density: 38.0,
    sharpness: 1.2,
    rotationSpeed1: 0.1,
    rotationSpeed2: -0.12,
    scaleRatio: 1.0,
    centerDistance: 0.06,
    blendMode: 'multiplication',
    chromaticMode: false,
    chromaticDispersion: 0.03,
    colorPalette: 'monochrome-op-art',
    contrast: 1.35,
    brightness: 0.0,
  },
  'counter-spokes': {
    gratingType: 'spokes',
    waveform: 'ronchi',
    spokeCount: 48,
    layerCount: 2,
    density: 30.0,
    sharpness: 1.5,
    rotationSpeed1: 0.25,
    rotationSpeed2: -0.25,
    scaleRatio: 1.0,
    centerDistance: 0.0,
    blendMode: 'multiplication',
    chromaticMode: false,
    colorPalette: 'obsidian-gold',
    contrast: 1.4,
    brightness: 0.0,
  },
  'cross-rulings': {
    gratingType: 'linear',
    waveform: 'ronchi',
    layerCount: 2,
    density: 55.0,
    sharpness: 1.3,
    rotationSpeed1: 0.04,
    rotationSpeed2: -0.04,
    angleOffset: 0.09,
    scaleRatio: 1.0,
    centerDistance: 0.0,
    blendMode: 'multiplication',
    chromaticMode: false,
    colorPalette: 'monochrome-op-art',
    contrast: 1.4,
    brightness: 0.0,
  },
  'spiral-vortex': {
    gratingType: 'spirals',
    waveform: 'cosine',
    spiralArms: 8,
    layerCount: 3,
    density: 35.0,
    sharpness: 1.1,
    rotationSpeed1: 0.3,
    rotationSpeed2: -0.2,
    rotationSpeed3: 0.45,
    scaleRatio: 1.08,
    centerDistance: 0.03,
    blendMode: 'difference',
    chromaticMode: true,
    chromaticDispersion: 0.04,
    colorPalette: 'bioluminescent-cyan',
    contrast: 1.3,
    brightness: 0.02,
  },
  'fresnel-zone-beat': {
    gratingType: 'fresnel',
    waveform: 'cosine',
    layerCount: 2,
    density: 48.0,
    sharpness: 1.2,
    rotationSpeed1: 0.08,
    rotationSpeed2: -0.06,
    scaleRatio: 1.0,
    centerDistance: 0.08,
    blendMode: 'multiplication',
    chromaticMode: false,
    colorPalette: 'cyber-neon',
    contrast: 1.35,
    brightness: 0.0,
  },
  'chromatic-shimmer': {
    gratingType: 'linear',
    waveform: 'cosine',
    layerCount: 3,
    density: 68.0,
    sharpness: 1.4,
    rotationSpeed1: 0.15,
    rotationSpeed2: -0.18,
    rotationSpeed3: 0.22,
    angleOffset: 0.12,
    scaleRatio: 1.02,
    centerDistance: 0.04,
    blendMode: 'multiplication',
    chromaticMode: true,
    chromaticDispersion: 0.08,
    colorPalette: 'spectral-dispersion',
    contrast: 1.4,
    brightness: 0.0,
  },
  'hexagonal-lattice': {
    gratingType: 'hex',
    waveform: 'cosine',
    layerCount: 2,
    density: 44.0,
    sharpness: 1.2,
    rotationSpeed1: 0.05,
    rotationSpeed2: -0.05,
    angleOffset: 0.06,
    scaleRatio: 1.0,
    centerDistance: 0.02,
    blendMode: 'multiplication',
    chromaticMode: false,
    colorPalette: 'solar-plasma',
    contrast: 1.3,
    brightness: 0.0,
  },
};

// Inigo Quilez Cosine Gradient Parameter Defs: C(t) = a + b * cos(2pi * (c * t + d))
export interface CosinePaletteDef {
  name: string;
  a: [number, number, number]; // DC bias
  b: [number, number, number]; // Amplitude
  c: [number, number, number]; // Frequency
  d: [number, number, number]; // Phase shift
}

export const MOIRE_PALETTES: Record<MoirePalette, CosinePaletteDef> = {
  'monochrome-op-art': {
    name: 'Monochrome Op-Art',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.0, 0.0],
  },
  'monochrome-inverted': {
    name: 'Monochrome Inverted',
    a: [0.5, 0.5, 0.5],
    b: [-0.5, -0.5, -0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.0, 0.0],
  },
  'spectral-dispersion': {
    name: 'Spectral Dispersion',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.333, 0.667],
  },
  'obsidian-gold': {
    name: 'Obsidian Gold',
    a: [0.5, 0.38, 0.15],
    b: [0.5, 0.42, 0.2],
    c: [1.0, 1.0, 0.8],
    d: [0.0, 0.12, 0.22],
  },
  'cyber-neon': {
    name: 'Cyber Neon',
    a: [0.5, 0.15, 0.45],
    b: [0.5, 0.45, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.55, 0.18, 0.25],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    a: [0.65, 0.3, 0.15],
    b: [0.45, 0.35, 0.2],
    c: [1.0, 1.0, 1.0],
    d: [0.05, 0.15, 0.3],
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    a: [0.15, 0.5, 0.45],
    b: [0.2, 0.5, 0.45],
    c: [1.0, 1.0, 1.0],
    d: [0.35, 0.45, 0.55],
  },
};

// ---------------------------------------------------------------------------
// Pure Mathematical Analytical Evaluation Helpers for CPU / Tests / Snapshot
// ---------------------------------------------------------------------------

/**
 * Evaluates single grating layer intensity in [0, 1] at coordinates (x, y).
 */
export function evaluateGrating(
  x: number,
  y: number,
  gratingType: MoireGratingType,
  waveform: MoireWaveform,
  density: number,
  angle: number,
  center: [number, number],
  sharpness = 1.0,
  spokeCount = 36,
  spiralArms = 6
): number {
  const px = x - center[0];
  const py = y - center[1];
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const u = px * cosA + py * sinA;
  const v = -px * sinA + py * cosA;
  const r = Math.sqrt(px * px + py * py + 1e-6);

  let phi = 0;
  if (gratingType === 'linear') {
    phi = density * u;
  } else if (gratingType === 'rings') {
    phi = density * r;
  } else if (gratingType === 'fresnel') {
    phi = density * r * r * 2.5;
  } else if (gratingType === 'spokes') {
    const alpha = Math.atan2(py, px) + angle;
    phi = spokeCount * alpha;
  } else if (gratingType === 'spirals') {
    const alpha = Math.atan2(py, px);
    phi = density * Math.log(r * 8.0 + 1.0) + spiralArms * (alpha + angle);
  } else if (gratingType === 'hex') {
    const w1 = Math.cos(density * u);
    const w2 = Math.cos(density * (-0.5 * u + 0.8660254 * v));
    const w3 = Math.cos(density * (-0.5 * u - 0.8660254 * v));
    const hexS = 0.5 + (w1 + w2 + w3) / 6.0;
    return Math.max(0.0, Math.min(1.0, hexS));
  }

  const S = 0.5 + 0.5 * Math.cos(phi);
  if (waveform === 'cosine') {
    return S;
  } else if (waveform === 'ronchi') {
    const edge = Math.max(0.02, 0.5 / Math.max(0.2, sharpness * 3.0));
    const t = Math.max(0, Math.min(1, (S - (0.5 - edge)) / (2 * edge)));
    return t * t * (3 - 2 * t);
  } else if (waveform === 'triangle') {
    const twoPi = Math.PI * 2;
    const f = (((phi % twoPi) + twoPi) % twoPi) / twoPi;
    return Math.abs(2.0 * f - 1.0);
  } else if (waveform === 'sinusoidal-power') {
    return Math.pow(Math.max(0.001, S), Math.max(0.1, sharpness));
  }
  return S;
}

/**
 * Combines 2 to 4 layer values according to the selected optical blend mode.
 */
export function combineLayers(layers: number[], blendMode: MoireBlendMode): number {
  if (layers.length === 0) return 0;
  if (layers.length === 1) return layers[0];

  let result = layers[0];
  const count = layers.length;

  for (let i = 1; i < count; i++) {
    const next = layers[i];
    if (blendMode === 'multiplication') {
      result = result * next;
    } else if (blendMode === 'addition') {
      result = result + next;
    } else if (blendMode === 'difference') {
      result = Math.abs(result - next);
    } else if (blendMode === 'xor') {
      result = result + next - 2.0 * result * next;
    } else if (blendMode === 'min') {
      result = Math.min(result, next);
    } else if (blendMode === 'max') {
      result = Math.max(result, next);
    }
  }

  if (blendMode === 'addition') {
    result = result / count;
  } else if (blendMode === 'multiplication') {
    result = Math.min(1.0, result * (1.2 + count * 0.3));
  }

  return Math.max(0.0, Math.min(1.0, result));
}

/**
 * Evaluates composite RGB pixel at (x, y) given full parameter set and dynamic time state.
 */
export function evaluateMoirePixel(
  x: number,
  y: number,
  params: MoireParams,
  layerAngles: [number, number, number, number],
  ptrOffset: [number, number],
  bassEnergy = 0.0
): [number, number, number] {
  const evaluateChannel = (fScale: number, angleOffsetCh: number): number => {
    const layerValues: number[] = [];
    const count = Math.max(2, Math.min(4, Math.floor(params.layerCount)));
    const bassPulsation = 1.0 + bassEnergy * 0.15;

    for (let i = 0; i < count; i++) {
      let cx = 0;
      let cy = 0;
      const angle = layerAngles[i];

      if (i === 1) {
        cx = Math.cos(angle) * params.centerDistance + ptrOffset[0] * params.pointerInfluence;
        cy = Math.sin(angle) * params.centerDistance + ptrOffset[1] * params.pointerInfluence;
      } else if (i === 2) {
        cx = -Math.cos(angle * 0.8) * params.centerDistance * 1.5 - ptrOffset[0] * params.pointerInfluence * 0.5;
        cy = -Math.sin(angle * 0.8) * params.centerDistance * 1.5 - ptrOffset[1] * params.pointerInfluence * 0.5;
      } else if (i === 3) {
        cx = Math.sin(angle) * params.centerDistance * 1.2;
        cy = -Math.cos(angle) * params.centerDistance * 1.2;
      }

      const layerScale = Math.pow(params.scaleRatio, i);
      const density = params.density * layerScale * fScale * bassPulsation;
      const layerAngle = angle + i * params.angleOffset + angleOffsetCh;

      const val = evaluateGrating(
        x,
        y,
        params.gratingType,
        params.waveform,
        density,
        layerAngle,
        [cx, cy],
        params.sharpness,
        params.spokeCount,
        params.spiralArms
      );
      layerValues.push(val);
    }

    return combineLayers(layerValues, params.blendMode);
  };

  let rVal = 0;
  let gVal = 0;
  let bVal = 0;

  if (params.chromaticMode && params.chromaticDispersion > 0) {
    const disp = params.chromaticDispersion;
    rVal = evaluateChannel(1.0 - disp, -disp * 0.1);
    gVal = evaluateChannel(1.0, 0.0);
    bVal = evaluateChannel(1.0 + disp, disp * 0.1);
  } else {
    const mono = evaluateChannel(1.0, 0.0);
    rVal = mono;
    gVal = mono;
    bVal = mono;
  }

  // Cosine Palette Mapping
  const pal = MOIRE_PALETTES[params.colorPalette] || MOIRE_PALETTES['monochrome-op-art'];
  const twoPi = Math.PI * 2.0;

  const cr = pal.a[0] + pal.b[0] * Math.cos(twoPi * (pal.c[0] * rVal + pal.d[0]));
  const cg = pal.a[1] + pal.b[1] * Math.cos(twoPi * (pal.c[1] * gVal + pal.d[1]));
  const cb = pal.a[2] + pal.b[2] * Math.cos(twoPi * (pal.c[2] * bVal + pal.d[2]));

  // Contrast & Brightness adjustment
  const finalR = Math.max(0, Math.min(1, (cr - 0.5) * params.contrast + 0.5 + params.brightness));
  const finalG = Math.max(0, Math.min(1, (cg - 0.5) * params.contrast + 0.5 + params.brightness));
  const finalB = Math.max(0, Math.min(1, (cb - 0.5) * params.contrast + 0.5 + params.brightness));

  return [finalR, finalG, finalB];
}

// ---------------------------------------------------------------------------
// MoireRoom Class Implementation
// ---------------------------------------------------------------------------

export class MoireRoom implements RoomInstance {
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
  private isMounted = false;
  private prefersReducedMotion = false;
  private backendMode: 'webgpu' | 'canvas2d' = 'webgpu';

  // Dynamic Layer Rotations
  private layerAngles: [number, number, number, number] = [0, 0, 0, 0];

  // Active Parameters
  private params: MoireParams = { ...DEFAULT_MOIRE_PARAMS };
  private targetParams: MoireParams = { ...DEFAULT_MOIRE_PARAMS };

  // Audio envelope followers
  private bassFollower = 0;
  private midFollower = 0;
  private trebleFollower = 0;

  // Pointer dynamics with spring inertia
  private pointerX = 0;
  private pointerY = 0;
  private smoothedPointerX = 0;
  private smoothedPointerY = 0;
  private pointerActive = 0.0;
  private pulseBurst = 0.0;

  // TSL Uniform Nodes
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uGratingType = uniform(1.0); // 0=linear, 1=rings, 2=spokes, 3=spirals, 4=fresnel, 5=hex
  private uWaveform = uniform(0.0);    // 0=cosine, 1=ronchi, 2=triangle, 3=sinusoidal-power
  private uLayerCount = uniform(2.0);
  private uDensity = uniform(38.0);
  private uSharpness = uniform(1.2);
  private uAngleOffset = uniform(0.08);
  private uScaleRatio = uniform(1.0);
  private uCenterDistance = uniform(0.05);
  private uBlendMode = uniform(0.0);   // 0=mult, 1=add, 2=diff, 3=xor, 4=min, 5=max
  private uSpiralArms = uniform(6.0);
  private uSpokeCount = uniform(36.0);
  private uPointerInfluence = uniform(1.2);
  private uPointerOffset = uniform(new THREE.Vector2(0.0, 0.0));
  private uPointerActive = uniform(0.0);
  private uChromaticMode = uniform(0.0);
  private uChromaticDispersion = uniform(0.05);
  private uContrast = uniform(1.3);
  private uBrightness = uniform(0.0);
  private uBassEnergy = uniform(0.0);
  private uMidEnergy = uniform(0.0);
  private uTrebleEnergy = uniform(0.0);
  private uPulseBurst = uniform(0.0);

  // Dynamic Layer Angles (rad)
  private uLayerAngle1 = uniform(0.0);
  private uLayerAngle2 = uniform(0.0);
  private uLayerAngle3 = uniform(0.0);
  private uLayerAngle4 = uniform(0.0);

  // Inigo Quilez Cosine Gradient Uniforms (vec3)
  private uColorA = uniform(new THREE.Vector3(0.5, 0.5, 0.5));
  private uColorB = uniform(new THREE.Vector3(0.5, 0.5, 0.5));
  private uColorC = uniform(new THREE.Vector3(1.0, 1.0, 1.0));
  private uColorD = uniform(new THREE.Vector3(0.0, 0.0, 0.0));

  /**
   * Mounts the WebGPU / TSL simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.audio = ctx.audio || audioManager;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_MOIRE_PARAMS.seed);

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
        console.warn('WebGPU/WebGL2 initialization fallback in Room 21 (Moiré):', err);
        this.initCanvas2DFallback();
      }
    } else {
      this.initCanvas2DFallback();
    }

    // Connect audio source
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
   * Initializes high-performance Canvas2D fallback.
   */
  private initCanvas2DFallback(): void {
    if (!this.canvas) return;
    this.backendMode = 'canvas2d';
    this.ctx2d = this.canvas.getContext('2d', { alpha: false });
  }

  /**
   * Constructs the full-screen geometric moiré shader in TSL.
   */
  private buildTSLMaterial(): THREE.MeshBasicNodeMaterial {
    const moireColorNode = tslFn(() => {
      const st = uv();
      const aspect = this.uResolution.x.div(this.uResolution.y);

      // Centered coordinate space with aspect correction
      const x = st.x.sub(0.5).mul(aspect);
      const y = st.y.sub(0.5);

      const evaluateSingleLayerTSL = (
        layerIdx: number,
        angleNode: any,
        scaleMultiplier: number,
        fScale: any,
        angleOffsetCh: any
      ) => {
        // Layer center coordinates
        let cxNode: any = float(0.0);
        let cyNode: any = float(0.0);

        if (layerIdx === 1) {
          const shiftX = this.uPointerOffset.x.mul(this.uPointerInfluence);
          const shiftY = this.uPointerOffset.y.mul(this.uPointerInfluence);
          cxNode = cos(angleNode).mul(this.uCenterDistance).add(shiftX);
          cyNode = sin(angleNode).mul(this.uCenterDistance).add(shiftY);
        } else if (layerIdx === 2) {
          const shiftX = this.uPointerOffset.x.mul(this.uPointerInfluence).mul(-0.5);
          const shiftY = this.uPointerOffset.y.mul(this.uPointerInfluence).mul(-0.5);
          cxNode = cos(angleNode.mul(0.8)).mul(this.uCenterDistance).mul(-1.5).add(shiftX);
          cyNode = sin(angleNode.mul(0.8)).mul(this.uCenterDistance).mul(-1.5).add(shiftY);
        } else if (layerIdx === 3) {
          cxNode = sin(angleNode).mul(this.uCenterDistance).mul(1.2);
          cyNode = cos(angleNode).mul(this.uCenterDistance).mul(-1.2);
        }

        const px = x.sub(cxNode);
        const py = y.sub(cyNode);

        const effAngle = angleNode.add(float(layerIdx).mul(this.uAngleOffset)).add(angleOffsetCh);
        const cosA = cos(effAngle);
        const sinA = sin(effAngle);

        const uCoord = px.mul(cosA).add(py.mul(sinA));
        const vCoord = py.mul(cosA).sub(px.mul(sinA));
        const rCoord = sqrt(px.mul(px).add(py.mul(py)).add(0.000001));

        const bassPulsation = float(1.0).add(this.uBassEnergy.mul(0.18));
        const dynamicDensity = this.uDensity.mul(scaleMultiplier).mul(fScale).mul(bassPulsation);

        // Compute phase phi depending on grating type:
        // 0=linear, 1=rings, 2=spokes, 3=spirals, 4=fresnel, 5=hex
        const phiLinear = dynamicDensity.mul(uCoord);
        const phiRings = dynamicDensity.mul(rCoord);
        const phiFresnel = dynamicDensity.mul(rCoord).mul(rCoord).mul(2.5);

        const alphaSpoke = atan2(py, px).add(effAngle);
        const phiSpokes = this.uSpokeCount.mul(alphaSpoke);

        const alphaSpiral = atan2(py, px);
        const phiSpirals = dynamicDensity.mul(log(rCoord.mul(8.0).add(1.0))).add(this.uSpiralArms.mul(alphaSpiral.add(effAngle)));

        // Select phase for 0..4
        const phi01 = mix(phiLinear, phiRings, clamp(this.uGratingType.sub(0.5).mul(10.0), 0.0, 1.0));
        const phi02 = mix(phi01, phiSpokes, clamp(this.uGratingType.sub(1.5).mul(10.0), 0.0, 1.0));
        const phi03 = mix(phi02, phiSpirals, clamp(this.uGratingType.sub(2.5).mul(10.0), 0.0, 1.0));
        const phi = mix(phi03, phiFresnel, clamp(this.uGratingType.sub(3.5).mul(10.0), 0.0, 1.0));

        // Hexagonal 3-plane wave computation
        const w1 = cos(dynamicDensity.mul(uCoord));
        const w2 = cos(dynamicDensity.mul(uCoord.mul(-0.5).add(vCoord.mul(0.8660254))));
        const w3 = cos(dynamicDensity.mul(uCoord.mul(-0.5).sub(vCoord.mul(0.8660254))));
        const hexS = clamp(float(0.5).add(w1.add(w2).add(w3).div(6.0)), float(0.0), float(1.0));

        // Base sinusoidal value
        const rawS = float(0.5).add(cos(phi).mul(0.5));
        const S = mix(rawS, hexS, clamp(this.uGratingType.sub(4.5).mul(10.0), 0.0, 1.0));

        // Waveform shaping: 0=cosine, 1=ronchi, 2=triangle, 3=sinusoidal-power
        const edgeWidth = max(float(0.02), float(0.5).div(max(float(0.2), this.uSharpness.mul(3.0))));
        const ronchiV = smoothstep(float(0.5).sub(edgeWidth), float(0.5).add(edgeWidth), S);

        const twoPi = float(6.283185307);
        const normPhi = fract(phi.div(twoPi));
        const triV = abs(normPhi.mul(2.0).sub(1.0));

        const powerV = pow(clamp(S, float(0.001), float(1.0)), max(float(0.1), this.uSharpness));

        const wave01 = mix(S, ronchiV, clamp(this.uWaveform.sub(0.5).mul(10.0), 0.0, 1.0));
        const wave02 = mix(wave01, triV, clamp(this.uWaveform.sub(1.5).mul(10.0), 0.0, 1.0));
        const finalLayerV = mix(wave02, powerV, clamp(this.uWaveform.sub(2.5).mul(10.0), 0.0, 1.0));

        return finalLayerV;
      };

      const combineLayersTSL = (l0: any, l1: any, l2: any, l3: any) => {
        // Blend mode 0: Multiplication
        const mult1 = l0.mul(l1);
        const mult2 = mix(mult1, mult1.mul(l2), clamp(this.uLayerCount.sub(2.5).mul(10.0), 0.0, 1.0));
        const mult3 = mix(mult2, mult2.mul(l3), clamp(this.uLayerCount.sub(3.5).mul(10.0), 0.0, 1.0));
        const multResult = clamp(mult3.mul(float(1.2).add(this.uLayerCount.mul(0.3))), float(0.0), float(1.0));

        // Blend mode 1: Addition
        const add1 = l0.add(l1);
        const add2 = mix(add1, add1.add(l2), clamp(this.uLayerCount.sub(2.5).mul(10.0), 0.0, 1.0));
        const add3 = mix(add2, add2.add(l3), clamp(this.uLayerCount.sub(3.5).mul(10.0), 0.0, 1.0));
        const addResult = add3.div(this.uLayerCount);

        // Blend mode 2: Difference
        const diff1 = abs(l0.sub(l1));
        const diff2 = mix(diff1, abs(diff1.sub(l2)), clamp(this.uLayerCount.sub(2.5).mul(10.0), 0.0, 1.0));
        const diff3 = mix(diff2, abs(diff2.sub(l3)), clamp(this.uLayerCount.sub(3.5).mul(10.0), 0.0, 1.0));
        const diffResult = diff3;

        // Blend mode 3: XOR
        const xor1 = l0.add(l1).sub(l0.mul(l1).mul(2.0));
        const xor2 = mix(xor1, xor1.add(l2).sub(xor1.mul(l2).mul(2.0)), clamp(this.uLayerCount.sub(2.5).mul(10.0), 0.0, 1.0));
        const xor3 = mix(xor2, xor2.add(l3).sub(xor2.mul(l3).mul(2.0)), clamp(this.uLayerCount.sub(3.5).mul(10.0), 0.0, 1.0));
        const xorResult = xor3;

        // Blend mode 4: Min
        const min1 = min(l0, l1);
        const min2 = mix(min1, min(min1, l2), clamp(this.uLayerCount.sub(2.5).mul(10.0), 0.0, 1.0));
        const min3 = mix(min2, min(min2, l3), clamp(this.uLayerCount.sub(3.5).mul(10.0), 0.0, 1.0));
        const minResult = min3;

        // Blend mode 5: Max
        const max1 = max(l0, l1);
        const max2 = mix(max1, max(max1, l2), clamp(this.uLayerCount.sub(2.5).mul(10.0), 0.0, 1.0));
        const max3 = mix(max2, max(max2, l3), clamp(this.uLayerCount.sub(3.5).mul(10.0), 0.0, 1.0));
        const maxResult = max3;

        // Select blend mode: 0=mult, 1=add, 2=diff, 3=xor, 4=min, 5=max
        const blend01 = mix(multResult, addResult, clamp(this.uBlendMode.sub(0.5).mul(10.0), 0.0, 1.0));
        const blend02 = mix(blend01, diffResult, clamp(this.uBlendMode.sub(1.5).mul(10.0), 0.0, 1.0));
        const blend03 = mix(blend02, xorResult, clamp(this.uBlendMode.sub(2.5).mul(10.0), 0.0, 1.0));
        const blend04 = mix(blend03, minResult, clamp(this.uBlendMode.sub(3.5).mul(10.0), 0.0, 1.0));
        const finalBlend = mix(blend04, maxResult, clamp(this.uBlendMode.sub(4.5).mul(10.0), 0.0, 1.0));

        return clamp(finalBlend, float(0.0), float(1.0));
      };

      const evalChannelIntensity = (fScale: any, angleOffsetCh: any) => {
        const s1 = float(1.0);
        const s2 = this.uScaleRatio;
        const s3 = this.uScaleRatio.mul(this.uScaleRatio);
        const s4 = s3.mul(this.uScaleRatio);

        const l0 = evaluateSingleLayerTSL(0, this.uLayerAngle1, s1 as any, fScale, angleOffsetCh);
        const l1 = evaluateSingleLayerTSL(1, this.uLayerAngle2, s2 as any, fScale, angleOffsetCh);
        const l2 = evaluateSingleLayerTSL(2, this.uLayerAngle3, s3 as any, fScale, angleOffsetCh);
        const l3 = evaluateSingleLayerTSL(3, this.uLayerAngle4, s4 as any, fScale, angleOffsetCh);

        return combineLayersTSL(l0, l1, l2, l3);
      };

      // Chromatic dispersion evaluation
      const dynamicDisp = this.uChromaticDispersion.mul(float(1.0).add(this.uTrebleEnergy.mul(1.5)));
      const redF = float(1.0).sub(dynamicDisp);
      const redAngle = dynamicDisp.mul(-0.1);
      const blueF = float(1.0).add(dynamicDisp);
      const blueAngle = dynamicDisp.mul(0.1);

      const monoVal = evalChannelIntensity(float(1.0), float(0.0));
      const redVal = evalChannelIntensity(redF, redAngle);
      const greenVal = evalChannelIntensity(float(1.0), float(0.0));
      const blueVal = evalChannelIntensity(blueF, blueAngle);

      const rCh = mix(monoVal, redVal, this.uChromaticMode);
      const gCh = mix(monoVal, greenVal, this.uChromaticMode);
      const bCh = mix(monoVal, blueVal, this.uChromaticMode);

      // Inigo Quilez Cosine Gradient Mapping
      const twoPi = float(Math.PI * 2.0);
      const cTermR = this.uColorC.x.mul(rCh).add(this.uColorD.x);
      const cTermG = this.uColorC.y.mul(gCh).add(this.uColorD.y);
      const cTermB = this.uColorC.z.mul(bCh).add(this.uColorD.z);

      const cr = this.uColorA.x.add(this.uColorB.x.mul(cos(twoPi.mul(cTermR))));
      const cg = this.uColorA.y.add(this.uColorB.y.mul(cos(twoPi.mul(cTermG))));
      const cb = this.uColorA.z.add(this.uColorB.z.mul(cos(twoPi.mul(cTermB))));

      // Contrast & Brightness tone mapping
      const finalR = clamp(cr.sub(0.5).mul(this.uContrast).add(0.5).add(this.uBrightness), float(0.0), float(1.0));
      const finalG = clamp(cg.sub(0.5).mul(this.uContrast).add(0.5).add(this.uBrightness), float(0.0), float(1.0));
      const finalB = clamp(cb.sub(0.5).mul(this.uContrast).add(0.5).add(this.uBrightness), float(0.0), float(1.0));

      return vec4(finalR, finalG, finalB, 1.0);
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = moireColorNode();
    return mat;
  }

  /**
   * Applies incoming configuration parameters with clamping.
   */
  private applyParams(incoming: Record<string, any>, isInitial = false): void {
    if (incoming.preset && incoming.preset !== this.targetParams.preset && MOIRE_PRESETS[incoming.preset as MoirePreset]) {
      const presetValues = MOIRE_PRESETS[incoming.preset as MoirePreset];
      Object.assign(this.targetParams, presetValues);
      this.targetParams.preset = incoming.preset as MoirePreset;
    }

    const gratingType = (incoming.gratingType as MoireGratingType) ?? this.targetParams.gratingType;
    const waveform = (incoming.waveform as MoireWaveform) ?? this.targetParams.waveform;
    const blendMode = (incoming.blendMode as MoireBlendMode) ?? this.targetParams.blendMode;
    const colorPalette = (incoming.colorPalette as MoirePalette) ?? this.targetParams.colorPalette;

    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      preset: incoming.preset && MOIRE_PRESETS[incoming.preset as MoirePreset]
        ? (incoming.preset as MoirePreset)
        : this.targetParams.preset,
      gratingType,
      waveform,
      layerCount: Math.min(Math.max(Number(incoming.layerCount ?? this.targetParams.layerCount), 2), 4),
      density: Math.min(Math.max(Number(incoming.density ?? this.targetParams.density), 5.0), 120.0),
      sharpness: Math.min(Math.max(Number(incoming.sharpness ?? this.targetParams.sharpness), 0.1), 3.0),
      rotationSpeed1: Math.min(Math.max(Number(incoming.rotationSpeed1 ?? this.targetParams.rotationSpeed1), -3.0), 3.0),
      rotationSpeed2: Math.min(Math.max(Number(incoming.rotationSpeed2 ?? this.targetParams.rotationSpeed2), -3.0), 3.0),
      rotationSpeed3: Math.min(Math.max(Number(incoming.rotationSpeed3 ?? this.targetParams.rotationSpeed3), -3.0), 3.0),
      rotationSpeed4: Math.min(Math.max(Number(incoming.rotationSpeed4 ?? this.targetParams.rotationSpeed4), -3.0), 3.0),
      angleOffset: Math.min(Math.max(Number(incoming.angleOffset ?? this.targetParams.angleOffset), 0.0), 3.14),
      scaleRatio: Math.min(Math.max(Number(incoming.scaleRatio ?? this.targetParams.scaleRatio), 0.8), 1.5),
      centerDistance: Math.min(Math.max(Number(incoming.centerDistance ?? this.targetParams.centerDistance), 0.0), 0.4),
      blendMode,
      spiralArms: Math.min(Math.max(Number(incoming.spiralArms ?? this.targetParams.spiralArms), 1), 24),
      spokeCount: Math.min(Math.max(Number(incoming.spokeCount ?? this.targetParams.spokeCount), 8), 120),
      pointerInfluence: Math.min(Math.max(Number(incoming.pointerInfluence ?? this.targetParams.pointerInfluence), 0.0), 3.0),
      pointerInertia: Math.min(Math.max(Number(incoming.pointerInertia ?? this.targetParams.pointerInertia), 2.0), 25.0),
      chromaticMode: incoming.chromaticMode !== undefined ? Boolean(incoming.chromaticMode) : this.targetParams.chromaticMode,
      chromaticDispersion: Math.min(Math.max(Number(incoming.chromaticDispersion ?? this.targetParams.chromaticDispersion), 0.0), 0.25),
      colorPalette,
      contrast: Math.min(Math.max(Number(incoming.contrast ?? this.targetParams.contrast), 0.5), 3.0),
      brightness: Math.min(Math.max(Number(incoming.brightness ?? this.targetParams.brightness), -0.5), 0.5),
      audioSource: (incoming.audioSource as AudioSourceType) ?? this.targetParams.audioSource,
      audioSensitivity: Math.min(Math.max(Number(incoming.audioSensitivity ?? this.targetParams.audioSensitivity), 0.0), 3.0),
      bassReaction: Math.min(Math.max(Number(incoming.bassReaction ?? this.targetParams.bassReaction), 0.0), 3.0),
      midReaction: Math.min(Math.max(Number(incoming.midReaction ?? this.targetParams.midReaction), 0.0), 3.0),
      trebleReaction: Math.min(Math.max(Number(incoming.trebleReaction ?? this.targetParams.trebleReaction), 0.0), 3.0),
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
      this.updatePaletteUniforms(this.params.colorPalette);
      this.updateTypeUniforms();
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
  private updatePaletteUniforms(paletteKey: MoirePalette): void {
    const pal = MOIRE_PALETTES[paletteKey] || MOIRE_PALETTES['monochrome-op-art'];
    this.uColorA.value.set(pal.a[0], pal.a[1], pal.a[2]);
    this.uColorB.value.set(pal.b[0], pal.b[1], pal.b[2]);
    this.uColorC.value.set(pal.c[0], pal.c[1], pal.c[2]);
    this.uColorD.value.set(pal.d[0], pal.d[1], pal.d[2]);
  }

  /**
   * Updates enum integer indices for TSL shader branches.
   */
  private updateTypeUniforms(): void {
    const gratingMap: Record<MoireGratingType, number> = {
      linear: 0,
      rings: 1,
      spokes: 2,
      spirals: 3,
      fresnel: 4,
      hex: 5,
    };
    this.uGratingType.value = gratingMap[this.params.gratingType] ?? 1.0;

    const waveformMap: Record<MoireWaveform, number> = {
      cosine: 0,
      ronchi: 1,
      triangle: 2,
      'sinusoidal-power': 3,
    };
    this.uWaveform.value = waveformMap[this.params.waveform] ?? 0.0;

    const blendMap: Record<MoireBlendMode, number> = {
      multiplication: 0,
      addition: 1,
      difference: 2,
      xor: 3,
      min: 4,
      max: 5,
    };
    this.uBlendMode.value = blendMap[this.params.blendMode] ?? 0.0;
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
   * Handles pointer input for interactive focal epicenter displacement.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'leave') {
      this.pointerActive = 0.0;
      this.pointerX = 0;
      this.pointerY = 0;
      return;
    }

    this.pointerActive = 1.0;
    this.pointerX = (event.normalizedX - 0.5) * (this.width / Math.max(this.height, 1));
    this.pointerY = event.normalizedY - 0.5;

    if (event.type === 'down') {
      this.pulseBurst = 1.0;
    }
  }

  /**
   * Main per-frame simulation and render loop.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    // Smooth parameter lerping
    const lambda = 10.0;
    this.params.density = dampParameter(this.params.density, this.targetParams.density, lambda, dt);
    this.params.sharpness = dampParameter(this.params.sharpness, this.targetParams.sharpness, lambda, dt);
    this.params.rotationSpeed1 = dampParameter(this.params.rotationSpeed1, this.targetParams.rotationSpeed1, lambda, dt);
    this.params.rotationSpeed2 = dampParameter(this.params.rotationSpeed2, this.targetParams.rotationSpeed2, lambda, dt);
    this.params.rotationSpeed3 = dampParameter(this.params.rotationSpeed3, this.targetParams.rotationSpeed3, lambda, dt);
    this.params.rotationSpeed4 = dampParameter(this.params.rotationSpeed4, this.targetParams.rotationSpeed4, lambda, dt);
    this.params.angleOffset = dampParameter(this.params.angleOffset, this.targetParams.angleOffset, lambda, dt);
    this.params.scaleRatio = dampParameter(this.params.scaleRatio, this.targetParams.scaleRatio, lambda, dt);
    this.params.centerDistance = dampParameter(this.params.centerDistance, this.targetParams.centerDistance, lambda, dt);
    this.params.chromaticDispersion = dampParameter(this.params.chromaticDispersion, this.targetParams.chromaticDispersion, lambda, dt);
    this.params.contrast = dampParameter(this.params.contrast, this.targetParams.contrast, lambda, dt);
    this.params.brightness = dampParameter(this.params.brightness, this.targetParams.brightness, lambda, dt);
    this.params.pointerInfluence = dampParameter(this.params.pointerInfluence, this.targetParams.pointerInfluence, lambda, dt);
    this.params.layerCount = dampParameter(this.params.layerCount, this.targetParams.layerCount, lambda, dt);

    this.params.gratingType = this.targetParams.gratingType;
    this.params.waveform = this.targetParams.waveform;
    this.params.blendMode = this.targetParams.blendMode;
    this.params.colorPalette = this.targetParams.colorPalette;
    this.params.chromaticMode = this.targetParams.chromaticMode;
    this.params.spiralArms = this.targetParams.spiralArms;
    this.params.spokeCount = this.targetParams.spokeCount;

    this.updatePaletteUniforms(this.params.colorPalette);
    this.updateTypeUniforms();

    // Audio Analysis & Modulation
    let bassVal = 0;
    let midVal = 0;
    let trebleVal = 0;

    if (this.params.audioSource !== 'none') {
      const bands = this.audio.getFrequencyBands();
      const sens = this.params.audioSensitivity;
      const attack = 0.35;
      const decay = 0.08;

      const targetBass = bands.bass * sens * this.params.bassReaction;
      const targetMid = bands.mid * sens * this.params.midReaction;
      const targetTreble = bands.treble * sens * this.params.trebleReaction;

      this.bassFollower += (targetBass - this.bassFollower) * (targetBass > this.bassFollower ? attack : decay);
      this.midFollower += (targetMid - this.midFollower) * (targetMid > this.midFollower ? attack : decay);
      this.trebleFollower += (targetTreble - this.trebleFollower) * (targetTreble > this.trebleFollower ? attack : decay);

      bassVal = this.bassFollower;
      midVal = this.midFollower;
      trebleVal = this.trebleFollower;
    }

    // Pointer spring inertia
    const ptrSpring = 1.0 - Math.exp(-this.params.pointerInertia * dt);
    this.smoothedPointerX += (this.pointerX - this.smoothedPointerX) * ptrSpring;
    this.smoothedPointerY += (this.pointerY - this.smoothedPointerY) * ptrSpring;
    this.pulseBurst *= Math.exp(-5.0 * dt);

    // Layer Rotation Integration with Audio Reactivity
    const rotMult = this.prefersReducedMotion ? 0.0 : 1.0;
    const midSpeedBoost = 1.0 + midVal * 1.5;

    this.layerAngles[0] += this.params.rotationSpeed1 * rotMult * midSpeedBoost * dt;
    this.layerAngles[1] += this.params.rotationSpeed2 * rotMult * midSpeedBoost * dt;
    this.layerAngles[2] += this.params.rotationSpeed3 * rotMult * midSpeedBoost * dt;
    this.layerAngles[3] += this.params.rotationSpeed4 * rotMult * midSpeedBoost * dt;

    // Render via WebGPU or Canvas2D fallback
    if (this.backendMode === 'webgpu' && this.renderer && this.scene && this.camera) {
      this.uLayerCount.value = this.params.layerCount;
      this.uDensity.value = this.params.density;
      this.uSharpness.value = this.params.sharpness;
      this.uAngleOffset.value = this.params.angleOffset;
      this.uScaleRatio.value = this.params.scaleRatio;
      this.uCenterDistance.value = this.params.centerDistance;
      this.uSpiralArms.value = this.params.spiralArms;
      this.uSpokeCount.value = this.params.spokeCount;
      this.uPointerInfluence.value = this.params.pointerInfluence;
      this.uPointerOffset.value.set(this.smoothedPointerX, this.smoothedPointerY);
      this.uPointerActive.value = this.pointerActive;
      this.uChromaticMode.value = this.params.chromaticMode ? 1.0 : 0.0;
      this.uChromaticDispersion.value = this.params.chromaticDispersion;
      this.uContrast.value = this.params.contrast;
      this.uBrightness.value = this.params.brightness;

      this.uLayerAngle1.value = this.layerAngles[0];
      this.uLayerAngle2.value = this.layerAngles[1];
      this.uLayerAngle3.value = this.layerAngles[2];
      this.uLayerAngle4.value = this.layerAngles[3];

      this.uBassEnergy.value = bassVal;
      this.uMidEnergy.value = midVal;
      this.uTrebleEnergy.value = trebleVal;
      this.uPulseBurst.value = this.pulseBurst;

      this.renderer.render(this.scene, this.camera);
    } else if (this.ctx2d && this.canvas) {
      this.renderCanvas2D(this.ctx2d, this.width, this.height, bassVal);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Renders the analytical moiré pattern into a 2D Canvas context.
   */
  private renderCanvas2D(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bassVal: number
  ): void {
    const step = 4;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;
    const aspect = w / h;

    for (let y = 0; y < h; y += step) {
      const normY = y / h - 0.5;
      for (let x = 0; x < w; x += step) {
        const normX = (x / w - 0.5) * aspect;

        const [r, g, b] = evaluateMoirePixel(
          normX,
          normY,
          this.params,
          this.layerAngles,
          [this.smoothedPointerX, this.smoothedPointerY],
          bassVal
        );

        const rByte = Math.floor(r * 255);
        const gByte = Math.floor(g * 255);
        const bByte = Math.floor(b * 255);

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
   * Captures high-resolution offline snapshot.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const snapCtx = snapCanvas.getContext('2d', { alpha: false });

    if (!snapCtx) {
      return snapCanvas;
    }

    const imgData = snapCtx.createImageData(width, height);
    const data = imgData.data;
    const aspect = width / height;

    for (let y = 0; y < height; y++) {
      const normY = y / height - 0.5;
      for (let x = 0; x < width; x++) {
        const normX = (x / width - 0.5) * aspect;

        const [r, g, b] = evaluateMoirePixel(
          normX,
          normY,
          this.params,
          this.layerAngles,
          [this.smoothedPointerX, this.smoothedPointerY],
          this.bassFollower
        );

        const idx = (y * width + x) * 4;
        data[idx] = Math.floor(r * 255);
        data[idx + 1] = Math.floor(g * 255);
        data[idx + 2] = Math.floor(b * 255);
        data[idx + 3] = 255;
      }
    }

    snapCtx.putImageData(imgData, 0, 0);
    return snapCanvas;
  }

  /**
   * Disposes all GPU buffers, geometries, materials, audio listeners, and RAF loop.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.mesh) {
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      this.mesh = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.scene) {
      this.scene.clear();
      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.ctx2d = null;
    this.canvas = null;
  }
}

export function createRoom(): RoomInstance {
  return new MoireRoom();
}

export default new MoireRoom();
