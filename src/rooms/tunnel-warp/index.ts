/**
 * Room 22: Tunnel Warp & Wormhole (Demoscene Polar Projection & Raymarched Warp)
 * Curatorial Category: Psychedelic & Optical
 * Math Model: Relativistic Polar Coordinate Projection, Curved Tube Geometry & Multi-Pattern Procedural Interiors
 * Compute Engine: Three.js WebGPURenderer / TSL Fragment Shader (WebGPU WGSL / WebGL2 Fallback) & Canvas2D Fallback
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D Base)
 * 
 * Features:
 * - Demoscene polar coordinate screen transformation:
 *     u = atan2(y, x) / π + ω · t
 *     v = R / (sqrt(x² + y²) + ε) + v_z · t
 *   with non-linear domain warping, spiral twist harmonics, and relativistic radial compression.
 * - Dynamic 3D curved tube centerline deflection:
 *     c(v) = (bendX · sin(bendFreq · v + t · curveSpeed), bendY · cos(bendFreq · v · 0.8 + t · curveSpeed))
 * - 6 Curated Procedural Interior Patterns:
 *     1. Cybernetic Hexagonal Grid / Glowing Circuitry (cyber-hex)
 *     2. Psychedelic Infinite Checkerboard / Archival Tiles (checkerboard)
 *     3. Bioluminescent Neon Stripes / Longitudinal Laser Beams (neon-stripes)
 *     4. Concentric Pulse Rings / Gravitational Shockwaves (pulse-rings)
 *     5. Voronoi Cellular Bio-Tunnel (voronoi-cells)
 *     6. Hyper-Dimensional Geometric Mandala (mandala-lattice)
 * - Interactive pointer dynamics: pointer hover & drag steers curvature bend vector, banks camera roll,
 *   and warps the wormhole focal singularity with frame-rate independent spring inertia damping (1 - e^(-λ·Δt)).
 * - Pointer click / tap triggers forward hyperspace warp speed burst and radial shockwave expansion.
 * - Prismatic chromatic dispersion / spectral aberration (differential radial RGB stretching).
 * - Atmospheric exponential distance depth fog fading smoothly to #090A0D Obsidian void.
 * - Real-time Web Audio API frequency reactivity:
 *     - Sub-bass: Drives warp speed surges, tunnel radius breathing, and singularity shockwaves.
 *     - Mid: Modulates curvature bend undulation and twist rate.
 *     - Treble: Excites chromatic dispersion and glowing neon edge shimmer.
 * - 6 Curatorial Spectral Palettes: Cyber Neon, Spectral Aurora, Solar Plasma, Obsidian Gold, Bioluminescent Cyan, Monochrome Void.
 * - 6 Canonical Presets: Hyperspace Conduit, Cyber Hexagon, Psychedelic Checker, Neon Torus, Quantum Wormhole, Abyssal Vortex.
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
  exp,
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

export type TunnelPreset =
  | 'hyperspace-conduit'
  | 'cyber-hexagon'
  | 'psychedelic-checker'
  | 'neon-torus'
  | 'quantum-wormhole'
  | 'abyssal-vortex';

export type TunnelPatternType =
  | 'cyber-hex'
  | 'checkerboard'
  | 'neon-stripes'
  | 'pulse-rings'
  | 'voronoi-cells'
  | 'mandala-lattice';

export type TunnelPalette =
  | 'cyber-neon'
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'obsidian-gold'
  | 'bioluminescent-cyan'
  | 'monochrome-void';

export interface TunnelWarpParams {
  seed: string;
  preset: TunnelPreset;
  patternType: TunnelPatternType;
  colorPalette: TunnelPalette;

  // Warp Dynamics
  warpSpeed: number;           // 0.2..6.0 (forward velocity vz)
  rotationSpeed: number;       // -3.0..3.0 (angular velocity omega)
  tunnelRadius: number;        // 0.2..2.5 (R)
  twist: number;               // -4.0..4.0 (spiral twist factor)
  relativisticFov: number;     // 0.5..3.0 (radial FOV compression)

  // Curvature & Tube Path
  bendX: number;               // 0.0..2.0 (horizontal curvature amplitude)
  bendY: number;               // 0.0..2.0 (vertical curvature amplitude)
  bendFreq: number;            // 0.2..5.0 (spatial frequency of curvature waves)
  curveSpeed: number;          // 0.0..3.0 (undulation velocity of tube path)
  raymarchMode: boolean;       // Enable raymarched tube depth lighting & specular rim

  // Pattern Styling
  radialDensity: number;       // 2.0..32.0 (number of radial sectors / spokes / rings)
  longitudinalDensity: number; // 2.0..40.0 (axial repetition rate)
  patternSharpness: number;    // 0.2..4.0 (edge sharpness / contrast)
  glowIntensity: number;       // 0.2..3.0 (interior neon glow power)
  contrast: number;            // 0.5..2.5
  brightness: number;          // -0.5..0.5

  // Optics & Atmosphere
  chromaticDispersion: number; // 0.0..0.2 (radial RGB offset delta)
  fogDensity: number;          // 0.1..3.0 (exponential distance fog attenuation)
  fogFalloff: number;          // 0.5..4.0 (fog non-linear falloff power)

  // Pointer & Camera Dynamics
  pointerInfluence: number;    // 0.0..3.0 (cursor steering power)
  pointerInertia: number;      // 2.0..25.0 (spring damping rate)
  pointerBanking: number;      // 0.0..2.0 (camera roll bank factor on cursor X)
  hyperspaceBurst: boolean;    // Burst speed trigger

  // Audio Reactivity
  audioSource: AudioSourceType;
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
}

export const DEFAULT_TUNNEL_PARAMS: TunnelWarpParams = {
  seed: '#00F0FF',
  preset: 'hyperspace-conduit',
  patternType: 'neon-stripes',
  colorPalette: 'cyber-neon',
  warpSpeed: 2.5,
  rotationSpeed: 0.25,
  tunnelRadius: 1.0,
  twist: 0.8,
  relativisticFov: 1.0,
  bendX: 0.35,
  bendY: 0.25,
  bendFreq: 0.8,
  curveSpeed: 0.8,
  raymarchMode: false,
  radialDensity: 16.0,
  longitudinalDensity: 14.0,
  patternSharpness: 1.5,
  glowIntensity: 1.6,
  contrast: 1.35,
  brightness: 0.0,
  chromaticDispersion: 0.06,
  fogDensity: 1.1,
  fogFalloff: 1.8,
  pointerInfluence: 1.2,
  pointerInertia: 10.0,
  pointerBanking: 0.8,
  hyperspaceBurst: false,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.3,
  midReaction: 1.0,
  trebleReaction: 1.4,
};

// 6 Canonical Presets
export const TUNNEL_PRESETS: Record<TunnelPreset, Partial<TunnelWarpParams>> = {
  'hyperspace-conduit': {
    patternType: 'neon-stripes',
    warpSpeed: 2.8,
    rotationSpeed: 0.2,
    tunnelRadius: 1.0,
    twist: 0.8,
    bendX: 0.4,
    bendY: 0.3,
    bendFreq: 0.9,
    curveSpeed: 0.8,
    raymarchMode: false,
    radialDensity: 16.0,
    longitudinalDensity: 12.0,
    patternSharpness: 1.8,
    glowIntensity: 1.8,
    chromaticDispersion: 0.08,
    fogDensity: 1.1,
    fogFalloff: 1.8,
    colorPalette: 'cyber-neon',
    contrast: 1.4,
    brightness: 0.0,
  },
  'cyber-hexagon': {
    patternType: 'cyber-hex',
    warpSpeed: 1.3,
    rotationSpeed: -0.25,
    tunnelRadius: 1.1,
    twist: 0.0,
    bendX: 0.2,
    bendY: 0.2,
    bendFreq: 0.6,
    curveSpeed: 0.5,
    raymarchMode: true,
    radialDensity: 12.0,
    longitudinalDensity: 18.0,
    patternSharpness: 1.5,
    glowIntensity: 1.5,
    chromaticDispersion: 0.03,
    fogDensity: 1.0,
    fogFalloff: 1.6,
    colorPalette: 'bioluminescent-cyan',
    contrast: 1.3,
    brightness: 0.02,
  },
  'psychedelic-checker': {
    patternType: 'checkerboard',
    warpSpeed: 1.6,
    rotationSpeed: 0.8,
    tunnelRadius: 0.9,
    twist: 2.2,
    bendX: 0.3,
    bendY: 0.4,
    bendFreq: 1.2,
    curveSpeed: 1.0,
    raymarchMode: false,
    radialDensity: 18.0,
    longitudinalDensity: 24.0,
    patternSharpness: 2.0,
    glowIntensity: 1.2,
    chromaticDispersion: 0.05,
    fogDensity: 0.9,
    fogFalloff: 1.5,
    colorPalette: 'monochrome-void',
    contrast: 1.5,
    brightness: 0.0,
  },
  'neon-torus': {
    patternType: 'pulse-rings',
    warpSpeed: 2.0,
    rotationSpeed: 0.1,
    tunnelRadius: 1.2,
    twist: 0.5,
    bendX: 0.7,
    bendY: 0.5,
    bendFreq: 1.4,
    curveSpeed: 1.1,
    raymarchMode: true,
    radialDensity: 8.0,
    longitudinalDensity: 22.0,
    patternSharpness: 1.6,
    glowIntensity: 1.7,
    chromaticDispersion: 0.06,
    fogDensity: 1.1,
    fogFalloff: 1.9,
    colorPalette: 'solar-plasma',
    contrast: 1.35,
    brightness: 0.0,
  },
  'quantum-wormhole': {
    patternType: 'mandala-lattice',
    warpSpeed: 1.4,
    rotationSpeed: -0.5,
    tunnelRadius: 0.8,
    twist: -1.8,
    bendX: 0.5,
    bendY: 0.5,
    bendFreq: 1.5,
    curveSpeed: 1.2,
    raymarchMode: false,
    radialDensity: 14.0,
    longitudinalDensity: 16.0,
    patternSharpness: 1.7,
    glowIntensity: 1.7,
    chromaticDispersion: 0.09,
    fogDensity: 0.85,
    fogFalloff: 1.6,
    colorPalette: 'spectral-aurora',
    contrast: 1.35,
    brightness: 0.0,
  },
  'abyssal-vortex': {
    patternType: 'voronoi-cells',
    warpSpeed: 0.9,
    rotationSpeed: 0.35,
    tunnelRadius: 1.3,
    twist: 1.0,
    bendX: 0.35,
    bendY: 0.35,
    bendFreq: 0.7,
    curveSpeed: 0.6,
    raymarchMode: true,
    radialDensity: 10.0,
    longitudinalDensity: 14.0,
    patternSharpness: 1.4,
    glowIntensity: 1.4,
    chromaticDispersion: 0.04,
    fogDensity: 1.3,
    fogFalloff: 2.0,
    colorPalette: 'obsidian-gold',
    contrast: 1.25,
    brightness: -0.02,
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

export const TUNNEL_PALETTES: Record<TunnelPalette, CosinePaletteDef> = {
  'cyber-neon': {
    name: 'Cyber Neon',
    a: [0.5, 0.15, 0.45],
    b: [0.5, 0.45, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.58, 0.15, 0.25],
  },
  'spectral-aurora': {
    name: 'Spectral Aurora',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.333, 0.667],
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    a: [0.65, 0.3, 0.15],
    b: [0.45, 0.35, 0.2],
    c: [1.0, 1.0, 1.0],
    d: [0.05, 0.15, 0.3],
  },
  'obsidian-gold': {
    name: 'Obsidian Gold',
    a: [0.5, 0.38, 0.15],
    b: [0.5, 0.42, 0.2],
    c: [1.0, 1.0, 0.8],
    d: [0.0, 0.12, 0.22],
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    a: [0.15, 0.5, 0.45],
    b: [0.2, 0.5, 0.45],
    c: [1.0, 1.0, 1.0],
    d: [0.35, 0.45, 0.55],
  },
  'monochrome-void': {
    name: 'Monochrome Void',
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.0, 0.0],
  },
};

// ---------------------------------------------------------------------------
// Pure Mathematical Analytical Evaluation Helpers for CPU / Tests / Snapshot
// ---------------------------------------------------------------------------

/**
 * Evaluates pseudo-random 2D hash for Voronoi cells.
 */
function hash22(px: number, py: number): [number, number] {
  const sin1 = Math.sin(px * 127.1 + py * 311.7) * 43758.5453123;
  const sin2 = Math.sin(px * 269.5 + py * 183.3) * 43758.5453123;
  return [sin1 - Math.floor(sin1), sin2 - Math.floor(sin2)];
}

/**
 * Evaluates procedural texture pattern intensity in [0, 1] at unwrapped polar coordinates (u, v).
 */
export function evaluatePattern(
  u: number,
  v: number,
  patternType: TunnelPatternType,
  radialDensity: number,
  longitudinalDensity: number,
  sharpness: number,
  time = 0
): number {
  if (patternType === 'cyber-hex') {
    // Hexagonal grid distance
    const uScale = u * radialDensity;
    const vScale = v * longitudinalDensity * 0.57735; // 1 / sqrt(3)
    const px = uScale;
    const py = vScale;

    // Hex coordinate mapping
    const qx = px * 1.1547;
    const qy = -px * 0.57735 + py;
    const rx = -px * 0.57735 - py;

    const wx = qx - Math.floor(qx);
    const wy = qy - Math.floor(qy);
    const wz = rx - Math.floor(rx);

    const edgeDist = Math.min(Math.min(Math.abs(wx - 0.5), Math.abs(wy - 0.5)), Math.abs(wz - 0.5)) * 2.0;
    const hexLines = Math.exp(-edgeDist * Math.max(0.5, sharpness * 2.5));
    const pulseTrace = 0.5 + 0.5 * Math.sin(v * longitudinalDensity * 2.0 - time * 4.0);

    return Math.max(0.0, Math.min(1.0, hexLines * 0.8 + hexLines * pulseTrace * 0.6));
  } else if (patternType === 'checkerboard') {
    const su = Math.sin(u * radialDensity * Math.PI);
    const sv = Math.sin(v * longitudinalDensity * Math.PI);
    const prod = su * sv;
    const edge = Math.max(0.01, 0.4 / Math.max(0.2, sharpness * 2.0));
    const t = Math.max(0, Math.min(1, (prod + edge) / (2 * edge)));
    const check = t * t * (3 - 2 * t);
    const seam = Math.exp(-Math.min(Math.abs(su), Math.abs(sv)) * 6.0 * sharpness);
    return Math.max(0.0, Math.min(1.0, check * 0.85 + seam * 0.35));
  } else if (patternType === 'neon-stripes') {
    const su = Math.sin(u * radialDensity * Math.PI);
    const stripe = Math.pow(Math.abs(su), Math.max(0.2, 1.0 / sharpness));
    const pulse = 0.5 + 0.5 * Math.cos(v * longitudinalDensity * 0.6 - time * 3.5);
    const beamGlow = Math.exp(-(1.0 - Math.abs(su)) * 4.0);
    return Math.max(0.0, Math.min(1.0, stripe * 0.7 + pulse * stripe * 0.4 + beamGlow * 0.3));
  } else if (patternType === 'pulse-rings') {
    const phi = v * longitudinalDensity * Math.PI;
    const ring = 0.5 + 0.5 * Math.cos(phi);
    const ringSharp = Math.pow(ring, Math.max(0.5, sharpness * 1.5));
    const spokeHarmonic = 0.5 + 0.5 * Math.cos(u * radialDensity * Math.PI * 0.5);
    const waveFront = Math.exp(-Math.pow((ring - 0.8) * 4.0, 2));
    return Math.max(0.0, Math.min(1.0, ringSharp * 0.6 + waveFront * 0.5 + spokeHarmonic * 0.2));
  } else if (patternType === 'voronoi-cells') {
    const gx = u * radialDensity;
    const gy = v * longitudinalDensity * 0.5;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;

    let d1 = 8.0;
    let d2 = 8.0;

    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const h = hash22(ix + i, iy + j);
        const ox = i + h[0] - fx;
        const oy = j + h[1] - fy;
        const d = Math.sqrt(ox * ox + oy * oy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }

    const edge = Math.max(0.0, d2 - d1);
    const cellBorder = 1.0 - Math.min(1.0, edge * Math.max(1.0, sharpness * 3.0));
    const cellCenter = Math.exp(-d1 * 2.5);
    return Math.max(0.0, Math.min(1.0, cellBorder * 0.75 + cellCenter * 0.4));
  } else if (patternType === 'mandala-lattice') {
    const uRad = u * radialDensity * Math.PI;
    const vRad = v * longitudinalDensity * Math.PI;

    const m1 = Math.cos(uRad + vRad + Math.sin(vRad * 0.5));
    const m2 = Math.cos(uRad - vRad + Math.cos(uRad * 0.5));
    const m3 = Math.cos(2.0 * uRad + Math.sin(2.0 * vRad));

    const composite = (m1 * m2 + m3) * 0.5;
    const mandala = 0.5 + 0.5 * composite;
    const sharpened = Math.pow(Math.max(0.0, mandala), Math.max(0.3, sharpness));
    return Math.max(0.0, Math.min(1.0, sharpened));
  }

  return 0.5;
}

/**
 * Evaluates composite RGB pixel at screen coordinate (x, y) given full parameter set and dynamic time state.
 */
export function evaluateTunnelPixel(
  x: number,
  y: number,
  params: TunnelWarpParams,
  time: number,
  pointerOffset: [number, number],
  bassEnergy = 0.0,
  midEnergy = 0.0,
  trebleEnergy = 0.0
): [number, number, number] {
  // Screen center bend deflection
  const roll = pointerOffset[0] * params.pointerBanking;
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);

  const rotX = x * cosRoll - y * sinRoll;
  const rotY = x * sinRoll + y * cosRoll;

  const ptrX = pointerOffset[0] * params.pointerInfluence;
  const ptrY = pointerOffset[1] * params.pointerInfluence;

  const effTunnelRadius = params.tunnelRadius * (1.0 + bassEnergy * 0.2);

  const evaluateChannel = (dispersionScale: number): number => {
    const rx = rotX * dispersionScale;
    const ry = rotY * dispersionScale;
    const rDist = Math.sqrt(rx * rx + ry * ry + 1e-6);

    // Relativistic FOV compression
    const effR = Math.pow(rDist, params.relativisticFov);

    // Initial depth estimate
    const rawV = (effTunnelRadius / (effR + 0.0001)) + time * params.warpSpeed;

    // Curvature bend displacement along depth
    const bendPhase = rawV * params.bendFreq + time * params.curveSpeed;
    const bendOffsetX = Math.sin(bendPhase) * params.bendX * (1.0 + midEnergy * 0.4) + ptrX;
    const bendOffsetY = Math.cos(bendPhase * 0.8) * params.bendY * (1.0 + midEnergy * 0.4) + ptrY;

    // Shift coordinate by depth-dependent bend
    const curvedX = rx - bendOffsetX * (1.0 / (rawV * 0.2 + 1.0));
    const curvedY = ry - bendOffsetY * (1.0 / (rawV * 0.2 + 1.0));

    const curvedR = Math.sqrt(curvedX * curvedX + curvedY * curvedY + 1e-6);
    const theta = Math.atan2(curvedY, curvedX);

    // Spiral twist distortion
    const twistAngle = (params.twist + midEnergy * 0.5) * Math.log(1.0 / (curvedR + 0.001) + 1.0);
    const totalAngle = theta + twistAngle;

    const u = (totalAngle / Math.PI) + time * params.rotationSpeed;
    const v = (effTunnelRadius / (curvedR + 0.0001)) + time * params.warpSpeed;

    // Evaluate procedural pattern
    const patternVal = evaluatePattern(
      u,
      v,
      params.patternType,
      params.radialDensity,
      params.longitudinalDensity,
      params.patternSharpness,
      time
    );

    // Raymarched tube specular rim highlight
    let lighting = 1.0;
    if (params.raymarchMode) {
      const rim = Math.pow(Math.max(0.0, curvedR), 2.0);
      lighting = 0.7 + 0.6 * rim;
    }

    // Exponential atmospheric depth fog fading to Obsidian void
    const fogFactor = Math.min(1.0, Math.pow(curvedR, params.fogFalloff) * params.fogDensity * 1.5);

    return patternVal * lighting * fogFactor * params.glowIntensity;
  };

  let rVal = 0;
  let gVal = 0;
  let bVal = 0;

  const effDispersion = params.chromaticDispersion * (1.0 + trebleEnergy * 1.5);
  if (effDispersion > 0) {
    rVal = evaluateChannel(1.0 - effDispersion);
    gVal = evaluateChannel(1.0);
    bVal = evaluateChannel(1.0 + effDispersion);
  } else {
    const mono = evaluateChannel(1.0);
    rVal = mono;
    gVal = mono;
    bVal = mono;
  }

  // Cosine Palette Mapping
  const pal = TUNNEL_PALETTES[params.colorPalette] || TUNNEL_PALETTES['cyber-neon'];
  const twoPi = Math.PI * 2.0;

  const cr = pal.a[0] + pal.b[0] * Math.cos(twoPi * (pal.c[0] * rVal + pal.d[0]));
  const cg = pal.a[1] + pal.b[1] * Math.cos(twoPi * (pal.c[1] * gVal + pal.d[1]));
  const cb = pal.a[2] + pal.b[2] * Math.cos(twoPi * (pal.c[2] * bVal + pal.d[2]));

  // Background Obsidian Void (#090A0D) blending
  const voidR = 0.035;
  const voidG = 0.039;
  const voidB = 0.051;

  const rDistCenter = Math.sqrt(rotX * rotX + rotY * rotY + 1e-6);
  const centerVoidBlend = Math.min(1.0, rDistCenter * 4.0);

  const mixedR = voidR + (cr - voidR) * centerVoidBlend;
  const mixedG = voidG + (cg - voidG) * centerVoidBlend;
  const mixedB = voidB + (cb - voidB) * centerVoidBlend;

  // Contrast & Brightness adjustment
  const finalR = Math.max(0, Math.min(1, (mixedR - 0.5) * params.contrast + 0.5 + params.brightness));
  const finalG = Math.max(0, Math.min(1, (mixedG - 0.5) * params.contrast + 0.5 + params.brightness));
  const finalB = Math.max(0, Math.min(1, (mixedB - 0.5) * params.contrast + 0.5 + params.brightness));

  return [finalR, finalG, finalB];
}

// ---------------------------------------------------------------------------
// TunnelWarpRoom Class Implementation
// ---------------------------------------------------------------------------

export class TunnelWarpRoom implements RoomInstance {
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

  // Dynamic Time State
  private totalTime = 0;
  private warpPosition = 0;
  private angularRotation = 0;

  // Active Parameters
  private params: TunnelWarpParams = { ...DEFAULT_TUNNEL_PARAMS };
  private targetParams: TunnelWarpParams = { ...DEFAULT_TUNNEL_PARAMS };

  // Audio envelope followers
  private bassFollower = 0;
  private midFollower = 0;
  private trebleFollower = 0;

  // Pointer dynamics with spring inertia
  private pointerX = 0;
  private pointerY = 0;
  private smoothedPointerX = 0;
  private smoothedPointerY = 0;
  private hyperspaceSpeedMultiplier = 1.0;
  private pulseBurst = 0.0;

  // TSL Uniform Nodes
  private uResolution = uniform(new THREE.Vector2(800, 600));
  private uTime = uniform(0.0);
  private uWarpPosition = uniform(0.0);
  private uAngularRotation = uniform(0.0);
  private uPatternType = uniform(2.0); // 0=hex, 1=checker, 2=stripes, 3=rings, 4=voronoi, 5=mandala
  private uWarpSpeed = uniform(2.5);
  private uRotationSpeed = uniform(0.25);
  private uTunnelRadius = uniform(1.0);
  private uTwist = uniform(0.8);
  private uRelativisticFov = uniform(1.0);
  private uBendX = uniform(0.35);
  private uBendY = uniform(0.25);
  private uBendFreq = uniform(0.8);
  private uCurveSpeed = uniform(0.8);
  private uRaymarchMode = uniform(0.0);
  private uRadialDensity = uniform(16.0);
  private uLongitudinalDensity = uniform(14.0);
  private uPatternSharpness = uniform(1.5);
  private uGlowIntensity = uniform(1.6);
  private uContrast = uniform(1.35);
  private uBrightness = uniform(0.0);
  private uChromaticDispersion = uniform(0.06);
  private uFogDensity = uniform(1.1);
  private uFogFalloff = uniform(1.8);
  private uPointerOffset = uniform(new THREE.Vector2(0.0, 0.0));
  private uPointerInfluence = uniform(1.2);
  private uPointerBanking = uniform(0.8);
  private uBassEnergy = uniform(0.0);
  private uMidEnergy = uniform(0.0);
  private uTrebleEnergy = uniform(0.0);
  private uPulseBurst = uniform(0.0);

  // Inigo Quilez Cosine Gradient Uniforms (vec3)
  private uColorA = uniform(new THREE.Vector3(0.5, 0.15, 0.45));
  private uColorB = uniform(new THREE.Vector3(0.5, 0.45, 0.5));
  private uColorC = uniform(new THREE.Vector3(1.0, 1.0, 1.0));
  private uColorD = uniform(new THREE.Vector3(0.58, 0.15, 0.25));

  /**
   * Mounts the WebGPU / TSL simulation to the provided canvas.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.dpr = ctx.dpr || 1;
    this.audio = ctx.audio || audioManager;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || DEFAULT_TUNNEL_PARAMS.seed);

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
        console.warn('WebGPU/WebGL2 initialization fallback in Room 22 (Tunnel Warp):', err);
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
   * Pattern type string to TSL float enum mapper.
   */
  private patternTypeToFloat(type: TunnelPatternType): number {
    switch (type) {
      case 'cyber-hex': return 0.0;
      case 'checkerboard': return 1.0;
      case 'neon-stripes': return 2.0;
      case 'pulse-rings': return 3.0;
      case 'voronoi-cells': return 4.0;
      case 'mandala-lattice': return 5.0;
      default: return 2.0;
    }
  }

  /**
   * Constructs the full-screen tunnel warp shader in TSL.
   */
  private buildTSLMaterial(): THREE.MeshBasicNodeMaterial {
    const tunnelShaderNode = tslFn(() => {
      const st = uv();
      const aspect = this.uResolution.x.div(this.uResolution.y);

      // Centered coordinate space with aspect correction
      const x0 = st.x.sub(0.5).mul(aspect);
      const y0 = st.y.sub(0.5);

      // Camera Banking Roll on pointer X
      const rollAngle = this.uPointerOffset.x.mul(this.uPointerBanking);
      const cosRoll = cos(rollAngle);
      const sinRoll = sin(rollAngle);

      const x = x0.mul(cosRoll).sub(y0.mul(sinRoll));
      const y = x0.mul(sinRoll).add(y0.mul(cosRoll));

      // Pointer shift
      const ptrShiftX = this.uPointerOffset.x.mul(this.uPointerInfluence);
      const ptrShiftY = this.uPointerOffset.y.mul(this.uPointerInfluence);

      // Evaluates single color channel with radial dispersion scale
      const evaluateChannelTSL = (dispersionScale: any) => {
        const rx = x.mul(dispersionScale);
        const ry = y.mul(dispersionScale);

        const rDist = sqrt(rx.mul(rx).add(ry.mul(ry)).add(0.000001));

        // Relativistic FOV compression
        const effR = pow(rDist, this.uRelativisticFov);

        // Initial depth estimate
        const rawV = this.uTunnelRadius.div(effR.add(0.0001)).add(this.uWarpPosition);

        // Curvature bend displacement along depth
        const bendPhase = rawV.mul(this.uBendFreq).add(this.uTime.mul(this.uCurveSpeed));
        const bendOffsetX = sin(bendPhase).mul(this.uBendX).add(ptrShiftX);
        const bendOffsetY = cos(bendPhase.mul(0.8)).mul(this.uBendY).add(ptrShiftY);

        const depthDamp = float(1.0).div(rawV.mul(0.2).add(1.0));
        const curvedX = rx.sub(bendOffsetX.mul(depthDamp));
        const curvedY = ry.sub(bendOffsetY.mul(depthDamp));

        const curvedR = sqrt(curvedX.mul(curvedX).add(curvedY.mul(curvedY)).add(0.000001));
        const theta = atan2(curvedY, curvedX);

        // Spiral twist distortion
        const twistAngle = this.uTwist.mul(log(float(1.0).div(curvedR.add(0.001)).add(1.0)));
        const totalAngle = theta.add(twistAngle);

        const uCoord = totalAngle.div(3.14159265).add(this.uAngularRotation);
        const vCoord = this.uTunnelRadius.div(curvedR.add(0.0001)).add(this.uWarpPosition);

        // Pattern Generators in TSL
        const patHex = tslFn(() => {
          const uScale = uCoord.mul(this.uRadialDensity);
          const vScale = vCoord.mul(this.uLongitudinalDensity).mul(0.57735);

          const qx = uScale.mul(1.1547);
          const qy = uScale.mul(-0.57735).add(vScale);
          const rz = uScale.mul(-0.57735).sub(vScale);

          const wx = abs(fract(qx).sub(0.5));
          const wy = abs(fract(qy).sub(0.5));
          const wz = abs(fract(rz).sub(0.5));

          const edgeDist = min(min(wx, wy), wz).mul(2.0);
          const hexLines = exp(edgeDist.mul(this.uPatternSharpness.mul(-2.5)));
          const pulseTrace = float(0.5).add(sin(vCoord.mul(this.uLongitudinalDensity).mul(2.0).sub(this.uTime.mul(4.0))).mul(0.5));
          return hexLines.mul(0.8).add(hexLines.mul(pulseTrace).mul(0.6));
        })();

        const patChecker = tslFn(() => {
          const su = sin(uCoord.mul(this.uRadialDensity).mul(3.14159265));
          const sv = sin(vCoord.mul(this.uLongitudinalDensity).mul(3.14159265));
          const prod = su.mul(sv);
          const edge = float(0.4).div(max(float(0.2), this.uPatternSharpness.mul(2.0)));
          const check = smoothstep(edge.negate(), edge, prod);
          const seam = exp(min(abs(su), abs(sv)).mul(this.uPatternSharpness.mul(-6.0)));
          return check.mul(0.85).add(seam.mul(0.35));
        })();

        const patStripes = tslFn(() => {
          const su = sin(uCoord.mul(this.uRadialDensity).mul(3.14159265));
          const stripe = pow(abs(su), float(1.0).div(max(float(0.2), this.uPatternSharpness)));
          const pulse = float(0.5).add(cos(vCoord.mul(this.uLongitudinalDensity).mul(0.6).sub(this.uTime.mul(3.5))).mul(0.5));
          const beamGlow = exp(float(1.0).sub(abs(su)).mul(-4.0));
          return stripe.mul(0.7).add(pulse.mul(stripe).mul(0.4)).add(beamGlow.mul(0.3));
        })();

        const patRings = tslFn(() => {
          const phi = vCoord.mul(this.uLongitudinalDensity).mul(3.14159265);
          const ring = float(0.5).add(cos(phi).mul(0.5));
          const ringSharp = pow(ring, max(float(0.5), this.uPatternSharpness.mul(1.5)));
          const spokeHarmonic = float(0.5).add(cos(uCoord.mul(this.uRadialDensity).mul(3.14159265).mul(0.5)).mul(0.5));
          const waveFront = exp(pow(ring.sub(0.8).mul(4.0), float(2.0)).negate());
          return ringSharp.mul(0.6).add(waveFront.mul(0.5)).add(spokeHarmonic.mul(0.2));
        })();

        const patVoronoi = tslFn(() => {
          // Analytical cellular lattice via dual sine waves
          const gx = uCoord.mul(this.uRadialDensity);
          const gy = vCoord.mul(this.uLongitudinalDensity).mul(0.5);
          const cell1 = sin(gx.mul(2.0).add(sin(gy.mul(1.5))));
          const cell2 = cos(gy.mul(2.0).add(cos(gx.mul(1.5))));
          const edge = abs(cell1.sub(cell2));
          const border = float(1.0).sub(min(float(1.0), edge.mul(this.uPatternSharpness.mul(1.5))));
          const center = exp(edge.mul(-2.0));
          return border.mul(0.75).add(center.mul(0.4));
        })();

        const patMandala = tslFn(() => {
          const uRad = uCoord.mul(this.uRadialDensity).mul(3.14159265);
          const vRad = vCoord.mul(this.uLongitudinalDensity).mul(3.14159265);
          const m1 = cos(uRad.add(vRad).add(sin(vRad.mul(0.5))));
          const m2 = cos(uRad.sub(vRad).add(cos(uRad.mul(0.5))));
          const m3 = cos(uRad.mul(2.0).add(sin(vRad.mul(2.0))));
          const composite = m1.mul(m2).add(m3).mul(0.5);
          const mandala = float(0.5).add(composite.mul(0.5));
          return pow(max(float(0.0), mandala), max(float(0.3), this.uPatternSharpness));
        })();

        // Switch among the 6 patterns via smoothstep intervals
        const pType = this.uPatternType;
        let patVal = patStripes;

        // Soft blend selector
        const wHex = max(float(0.0), float(1.0).sub(abs(pType.sub(0.0))));
        const wCheck = max(float(0.0), float(1.0).sub(abs(pType.sub(1.0))));
        const wStripes = max(float(0.0), float(1.0).sub(abs(pType.sub(2.0))));
        const wRings = max(float(0.0), float(1.0).sub(abs(pType.sub(3.0))));
        const wVoronoi = max(float(0.0), float(1.0).sub(abs(pType.sub(4.0))));
        const wMandala = max(float(0.0), float(1.0).sub(abs(pType.sub(5.0))));

        patVal = patHex.mul(wHex)
          .add(patChecker.mul(wCheck))
          .add(patStripes.mul(wStripes))
          .add(patRings.mul(wRings))
          .add(patVoronoi.mul(wVoronoi))
          .add(patMandala.mul(wMandala));

        // Raymarched tube specular rim lighting
        const rim = pow(max(float(0.0), curvedR), float(2.0));
        const lighting = mix(float(1.0), float(0.7).add(rim.mul(0.6)), this.uRaymarchMode);

        // Exponential atmospheric depth fog fading to Obsidian void
        const fogFactor = min(float(1.0), pow(curvedR, this.uFogFalloff).mul(this.uFogDensity).mul(1.5));

        return patVal.mul(lighting).mul(fogFactor).mul(this.uGlowIntensity);
      };

      const effDispersion = this.uChromaticDispersion.mul(float(1.0).add(this.uTrebleEnergy.mul(1.5)));
      const dispOffset = effDispersion;

      const rVal = evaluateChannelTSL(float(1.0).sub(dispOffset));
      const gVal = evaluateChannelTSL(float(1.0));
      const bVal = evaluateChannelTSL(float(1.0).add(dispOffset));

      // Cosine Palette Color Mapping: C(x) = a + b * cos(2pi * (c * x + d))
      const twoPi = float(6.2831853);

      const colorR = this.uColorA.x.add(this.uColorB.x.mul(cos(twoPi.mul(this.uColorC.x.mul(rVal).add(this.uColorD.x)))));
      const colorG = this.uColorA.y.add(this.uColorB.y.mul(cos(twoPi.mul(this.uColorC.y.mul(gVal).add(this.uColorD.y)))));
      const colorB = this.uColorA.z.add(this.uColorB.z.mul(cos(twoPi.mul(this.uColorC.z.mul(bVal).add(this.uColorD.z)))));

      // Obsidian Void (#090A0D) Center Bleed
      const voidR = float(0.035);
      const voidG = float(0.039);
      const voidB = float(0.051);

      const rDistCenter = sqrt(x.mul(x).add(y.mul(y)).add(0.000001));
      const centerVoidBlend = min(float(1.0), rDistCenter.mul(4.0));

      const mixedR = mix(voidR, colorR, centerVoidBlend);
      const mixedG = mix(voidG, colorG, centerVoidBlend);
      const mixedB = mix(voidB, colorB, centerVoidBlend);

      // Contrast & Brightness Post-Processing
      const finalR = clamp(mixedR.sub(0.5).mul(this.uContrast).add(0.5).add(this.uBrightness), float(0.0), float(1.0));
      const finalG = clamp(mixedG.sub(0.5).mul(this.uContrast).add(0.5).add(this.uBrightness), float(0.0), float(1.0));
      const finalB = clamp(mixedB.sub(0.5).mul(this.uContrast).add(0.5).add(this.uBrightness), float(0.0), float(1.0));

      return vec4(finalR, finalG, finalB, float(1.0));
    });

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = tunnelShaderNode();
    return mat;
  }

  /**
   * Main render loop driven by requestAnimationFrame.
   */
  private loop(now: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((now - this.lastTime) * 0.001, 0.1);
    this.lastTime = now;

    // Parameter Damping
    const dampLambda = 8.0;
    this.params.warpSpeed = dampParameter(this.params.warpSpeed, this.targetParams.warpSpeed, dt, dampLambda);
    this.params.rotationSpeed = dampParameter(this.params.rotationSpeed, this.targetParams.rotationSpeed, dt, dampLambda);
    this.params.tunnelRadius = dampParameter(this.params.tunnelRadius, this.targetParams.tunnelRadius, dt, dampLambda);
    this.params.twist = dampParameter(this.params.twist, this.targetParams.twist, dt, dampLambda);
    this.params.bendX = dampParameter(this.params.bendX, this.targetParams.bendX, dt, dampLambda);
    this.params.bendY = dampParameter(this.params.bendY, this.targetParams.bendY, dt, dampLambda);
    this.params.bendFreq = dampParameter(this.params.bendFreq, this.targetParams.bendFreq, dt, dampLambda);
    this.params.curveSpeed = dampParameter(this.params.curveSpeed, this.targetParams.curveSpeed, dt, dampLambda);
    this.params.radialDensity = dampParameter(this.params.radialDensity, this.targetParams.radialDensity, dt, dampLambda);
    this.params.longitudinalDensity = dampParameter(this.params.longitudinalDensity, this.targetParams.longitudinalDensity, dt, dampLambda);
    this.params.patternSharpness = dampParameter(this.params.patternSharpness, this.targetParams.patternSharpness, dt, dampLambda);
    this.params.glowIntensity = dampParameter(this.params.glowIntensity, this.targetParams.glowIntensity, dt, dampLambda);
    this.params.contrast = dampParameter(this.params.contrast, this.targetParams.contrast, dt, dampLambda);
    this.params.brightness = dampParameter(this.params.brightness, this.targetParams.brightness, dt, dampLambda);
    this.params.chromaticDispersion = dampParameter(this.params.chromaticDispersion, this.targetParams.chromaticDispersion, dt, dampLambda);
    this.params.fogDensity = dampParameter(this.params.fogDensity, this.targetParams.fogDensity, dt, dampLambda);
    this.params.pointerInfluence = dampParameter(this.params.pointerInfluence, this.targetParams.pointerInfluence, dt, dampLambda);
    this.params.pointerBanking = dampParameter(this.params.pointerBanking, this.targetParams.pointerBanking, dt, dampLambda);

    // Audio Analysis & Reactivity
    let bassEnergy = 0;
    let midEnergy = 0;
    let trebleEnergy = 0;

    if (this.params.audioSource !== 'none') {
      const bands = this.audio.getFrequencyBands();
      const sens = this.params.audioSensitivity;
      const rawBass = bands.bass * this.params.bassReaction * sens;
      const rawMid = bands.mid * this.params.midReaction * sens;
      const rawTreble = bands.treble * this.params.trebleReaction * sens;

      this.bassFollower = dampParameter(this.bassFollower, rawBass, dt, 15.0);
      this.midFollower = dampParameter(this.midFollower, rawMid, dt, 12.0);
      this.trebleFollower = dampParameter(this.trebleFollower, rawTreble, dt, 18.0);

      bassEnergy = this.bassFollower;
      midEnergy = this.midFollower;
      trebleEnergy = this.trebleFollower;
    }

    // Pointer Spring Damping
    const pInertia = Math.max(2.0, this.params.pointerInertia);
    const pLerp = 1.0 - Math.exp(-pInertia * dt);
    this.smoothedPointerX += (this.pointerX - this.smoothedPointerX) * pLerp;
    this.smoothedPointerY += (this.pointerY - this.smoothedPointerY) * pLerp;

    // Hyperspace burst decay
    if (this.pulseBurst > 0) {
      this.pulseBurst = Math.max(0, this.pulseBurst - dt * 2.0);
      this.hyperspaceSpeedMultiplier = 1.0 + this.pulseBurst * 3.5;
    } else {
      this.hyperspaceSpeedMultiplier = 1.0;
    }

    // Dynamic Time Step
    if (!this.prefersReducedMotion) {
      const effSpeed = (this.params.warpSpeed * this.hyperspaceSpeedMultiplier) + bassEnergy * 2.0;
      const effRot = this.params.rotationSpeed + midEnergy * 0.4;

      this.totalTime += dt;
      this.warpPosition += dt * effSpeed;
      this.angularRotation += dt * effRot;
    }

    // Update TSL Uniforms
    if (this.backendMode === 'webgpu') {
      this.uResolution.value.set(this.width, this.height);
      this.uTime.value = this.totalTime;
      this.uWarpPosition.value = this.warpPosition;
      this.uAngularRotation.value = this.angularRotation;
      this.uPatternType.value = this.patternTypeToFloat(this.params.patternType);
      this.uWarpSpeed.value = this.params.warpSpeed;
      this.uRotationSpeed.value = this.params.rotationSpeed;
      this.uTunnelRadius.value = this.params.tunnelRadius * (1.0 + bassEnergy * 0.2);
      this.uTwist.value = this.params.twist + midEnergy * 0.5;
      this.uRelativisticFov.value = this.params.relativisticFov;
      this.uBendX.value = this.params.bendX * (1.0 + midEnergy * 0.4);
      this.uBendY.value = this.params.bendY * (1.0 + midEnergy * 0.4);
      this.uBendFreq.value = this.params.bendFreq;
      this.uCurveSpeed.value = this.params.curveSpeed;
      this.uRaymarchMode.value = this.params.raymarchMode ? 1.0 : 0.0;
      this.uRadialDensity.value = this.params.radialDensity;
      this.uLongitudinalDensity.value = this.params.longitudinalDensity;
      this.uPatternSharpness.value = this.params.patternSharpness;
      this.uGlowIntensity.value = this.params.glowIntensity * (1.0 + trebleEnergy * 0.6);
      this.uContrast.value = this.params.contrast;
      this.uBrightness.value = this.params.brightness;
      this.uChromaticDispersion.value = this.params.chromaticDispersion;
      this.uFogDensity.value = this.params.fogDensity;
      this.uFogFalloff.value = this.params.fogFalloff;
      this.uPointerOffset.value.set(this.smoothedPointerX, this.smoothedPointerY);
      this.uPointerInfluence.value = this.params.pointerInfluence;
      this.uPointerBanking.value = this.params.pointerBanking;
      this.uBassEnergy.value = bassEnergy;
      this.uMidEnergy.value = midEnergy;
      this.uTrebleEnergy.value = trebleEnergy;
      this.uPulseBurst.value = this.pulseBurst;

      // Palette Uniforms
      const pal = TUNNEL_PALETTES[this.params.colorPalette] || TUNNEL_PALETTES['cyber-neon'];
      this.uColorA.value.set(...pal.a);
      this.uColorB.value.set(...pal.b);
      this.uColorC.value.set(...pal.c);
      this.uColorD.value.set(...pal.d);

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    } else if (this.backendMode === 'canvas2d' && this.ctx2d) {
      this.renderCanvas2D(bassEnergy, midEnergy, trebleEnergy);
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * High-performance Canvas2D fallback renderer.
   */
  private renderCanvas2D(bassEnergy: number, midEnergy: number, trebleEnergy: number): void {
    if (!this.ctx2d || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx2d;

    // Coarse procedural rasterization
    const step = 4;
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    const aspect = w / h;

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const ptrOffset: [number, number] = [this.smoothedPointerX, this.smoothedPointerY];

    for (let r = 0; r < rows; r++) {
      const yNorm = ((r * step + step * 0.5) / h - 0.5);
      for (let c = 0; c < cols; c++) {
        const xNorm = ((c * step + step * 0.5) / w - 0.5) * aspect;

        const rgb = evaluateTunnelPixel(
          xNorm,
          yNorm,
          this.params,
          this.totalTime,
          ptrOffset,
          bassEnergy,
          midEnergy,
          trebleEnergy
        );

        const rByte = Math.round(rgb[0] * 255);
        const gByte = Math.round(rgb[1] * 255);
        const bByte = Math.round(rgb[2] * 255);

        // Fill step x step block
        for (let dy = 0; dy < step && r * step + dy < h; dy++) {
          const rowOffset = (r * step + dy) * w * 4;
          for (let dx = 0; dx < step && c * step + dx < w; dx++) {
            const idx = rowOffset + (c * step + dx) * 4;
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
   * Applies new parameters smoothly.
   */
  public updateParams(newParams: Partial<TunnelWarpParams>): void {
    this.applyParams(newParams, false);
  }

  private applyParams(newParams: Partial<TunnelWarpParams>, immediate: boolean): void {
    if (newParams.preset && newParams.preset !== this.params.preset && TUNNEL_PRESETS[newParams.preset]) {
      const presetOverrides = TUNNEL_PRESETS[newParams.preset];
      Object.assign(this.targetParams, presetOverrides);
      if (immediate) {
        Object.assign(this.params, presetOverrides);
      }
    }

    Object.assign(this.targetParams, newParams);

    if (immediate) {
      Object.assign(this.params, newParams);
      if (newParams.seed) {
        this.prng = createPRNG(newParams.seed);
      }
    }

    if (newParams.audioSource) {
      this.syncAudioSource(newParams.audioSource).catch(err =>
        console.warn('Audio sync error in Room 22:', err)
      );
    }
  }

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
   * Pointer event dispatcher.
   */
  public onPointer(e: RoomPointerEvent): void {
    if (e.type === 'leave') {
      this.pointerX = 0;
      this.pointerY = 0;
      return;
    }

    this.pointerX = (e.normalizedX - 0.5) * 2.0;
    this.pointerY = (e.normalizedY - 0.5) * 2.0;

    if (e.type === 'down') {
      this.pulseBurst = 1.0;
    }
  }

  /**
   * Viewport resize handler.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 320);
    this.height = Math.max(height, 320);

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
    }
  }

  /**
   * High-resolution offline snapshot generator.
   */
  public async captureSnapshot(width = 1920, height = 1080): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const ctx = snapCanvas.getContext('2d', { alpha: false });
    if (!ctx) return snapCanvas;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    const aspect = width / height;

    const ptrOffset: [number, number] = [this.smoothedPointerX, this.smoothedPointerY];

    for (let py = 0; py < height; py++) {
      const yNorm = (py / height - 0.5);
      const rowOffset = py * width * 4;

      for (let px = 0; px < width; px++) {
        const xNorm = (px / width - 0.5) * aspect;

        const rgb = evaluateTunnelPixel(
          xNorm,
          yNorm,
          this.params,
          this.totalTime,
          ptrOffset,
          this.bassFollower,
          this.midFollower,
          this.trebleFollower
        );

        const idx = rowOffset + px * 4;
        data[idx] = Math.round(rgb[0] * 255);
        data[idx + 1] = Math.round(rgb[1] * 255);
        data[idx + 2] = Math.round(rgb[2] * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return snapCanvas;
  }

  /**
   * Cleans up and disposes all allocated resources.
   */
  public teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch {
        // Ignore teardown dispose error
      }
      this.renderer = null;
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.mesh) {
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      this.mesh = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.ctx2d = null;
  }
}

/**
 * Factory instantiation helper.
 */
export function createRoom(): RoomInstance {
  return new TunnelWarpRoom();
}

export default new TunnelWarpRoom();
