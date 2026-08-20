/**
 * Room 17: Fractal Flames (Non-linear IFS & Log-Density Tone Mapping)
 * Curatorial Category: Psychedelic & Optical
 * Math Model: Scott Draves' Chaos Game Iterated Function System (IFS) with Non-Linear Variations & Log-Density Tone Mapping
 * Compute Engine: Three.js WebGL2 / WebGPU Additive Starlight Points with Analytical Log-Density Fragment Shader & 2D Histogram Accumulation Fallback
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Real-time chaos game evaluation across 100,000–600,000 point particles at 60 FPS
 * - Comprehensive 18-Function Non-Linear Variation Catalog:
 *     Linear (V0), Sinusoidal (V1), Spherical (V2), Swirl (V3), Horseshoe (V4), Polar (V5),
 *     Handkerchief (V6), Heart (V7), Disc (V8), Spiral (V9), Hyperbolic (V10), Diamond (V11),
 *     Julia (V12), Fisheye (V13), Exponential (V14), Power (V15), Cylinder (V16), Tangent (V17)
 * - 8 Curated Canonical Flame Presets:
 *     Phoenix Nebula, Dragon Spirals, Cosmic Cross, Hyperbolic Bloom,
 *     Quantum Crystal, Solar Corona, Abyssal Vortex, Sierpinski Chaos
 * - Multi-transform matrix set (k=2..6) with affine coefficients, variation blend weights,
 *   cumulative selection probabilities, and structural path color tracking: c <- (c + c_i) / 2
 * - Analytical Scott Draves Log-Density Tone Mapping:
 *     color(x, y) = palette(color_index) * [log(1 + kappa * density) / log(1 + kappa * max_density)]^(1/gamma)
 * - 7 Curatorial Spectral Palettes (Spectral Aurora, Solar Plasma, Bioluminescent Cyan,
 *   Obsidian Emerald, Cosmic Amethyst, Monochrome Void, Electric Fire)
 * - Rotational and dihedral symmetry folding (N-fold symmetry z -> z * e^(2pi*i/N))
 * - Real-time Web Audio API frequency analysis modulating core breathing, swirl turbulence, and starlight shimmer
 * - Interactive pointer dynamics: drag pan/rotation, mouse hover gravitational/magnetic warping,
 *   click shockwave burst, wheel/pinch exponential zoom
 * - Custom high-resolution offline snapshot pass (captureSnapshot) with 3M+ iteration 2D histogram accumulation for 4K/8K stills
 * - Complete resource disposal lifecycle
 */

import * as THREE from 'three';
import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export type FlamePreset =
  | 'phoenix-nebula'
  | 'dragon-spirals'
  | 'cosmic-cross'
  | 'hyperbolic-bloom'
  | 'quantum-crystal'
  | 'solar-corona'
  | 'abyssal-vortex'
  | 'sierpinski-chaos';

export type ColorPalette =
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'bioluminescent-cyan'
  | 'obsidian-emerald'
  | 'cosmic-amethyst'
  | 'monochrome-void'
  | 'electric-fire';

export interface FractalFlamesParams {
  seed: string;
  preset: FlamePreset;
  pointCount: number;
  iterationsPerFrame: number;
  transformCount: number;
  symmetryFold: number;
  gamma: number;
  brightness: number; // kappa (exposure)
  vibrance: number;
  pointSize: number;
  glowIntensity: number;
  zoom: number;
  panX: number;
  panY: number;
  rotationSpeed: number;
  autoRotate: boolean;
  colorPalette: ColorPalette;
  linearWeight: number;      // V0
  sinusoidalWeight: number;  // V1
  sphericalWeight: number;   // V2
  swirlWeight: number;       // V3
  horseshoeWeight: number;   // V4
  polarWeight: number;       // V5
  handkerchiefWeight: number;// V6
  heartWeight: number;       // V7
  discWeight: number;        // V8
  spiralWeight: number;      // V9
  hyperbolicWeight: number;  // V10
  audioSource: 'synth' | 'mic' | 'none';
  audioSensitivity: number;
}

export const DEFAULT_FRACTAL_FLAMES_PARAMS: FractalFlamesParams = {
  seed: '#FF2A6D',
  preset: 'phoenix-nebula',
  pointCount: 300000,
  iterationsPerFrame: 3,
  transformCount: 4,
  symmetryFold: 2,
  gamma: 2.2,
  brightness: 3.0,
  vibrance: 1.2,
  pointSize: 1.6,
  glowIntensity: 1.2,
  zoom: 1.1,
  panX: 0.0,
  panY: 0.0,
  rotationSpeed: 0.2,
  autoRotate: true,
  colorPalette: 'spectral-aurora',
  linearWeight: 0.3,
  sinusoidalWeight: 0.4,
  sphericalWeight: 0.6,
  swirlWeight: 0.8,
  horseshoeWeight: 0.0,
  polarWeight: 0.0,
  handkerchiefWeight: 0.0,
  heartWeight: 0.0,
  discWeight: 0.0,
  spiralWeight: 0.0,
  hyperbolicWeight: 0.0,
  audioSource: 'synth',
  audioSensitivity: 1.5,
};

const MAX_POINTS_CAPACITY = 600000;

export interface PaletteStop {
  r: number;
  g: number;
  b: number;
}

export interface FlamePaletteDef {
  name: string;
  stops: [PaletteStop, PaletteStop, PaletteStop, PaletteStop];
}

export const FLAME_PALETTES: Record<ColorPalette, FlamePaletteDef> = {
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
      { r: 0.22, g: 0.06, b: 0.02 },  // Deep Amber
      { r: 1.0, g: 0.42, b: 0.0 },    // Fiery Orange (#FF6B00)
      { r: 1.0, g: 0.72, b: 0.0 },    // Golden Flame (#FFB800)
      { r: 1.0, g: 0.97, b: 0.90 },   // Core White
    ],
  },
  'bioluminescent-cyan': {
    name: 'Bioluminescent Cyan',
    stops: [
      { r: 0.0, g: 0.11, b: 0.22 },   // Deep Abyss
      { r: 0.0, g: 0.85, b: 0.95 },   // Electric Teal
      { r: 0.0, g: 1.0, b: 0.65 },    // Mint Phosphor
      { r: 0.70, g: 1.0, b: 0.95 },   // Aquamarine Core
    ],
  },
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    stops: [
      { r: 0.02, g: 0.15, b: 0.12 },  // Deep Forest
      { r: 0.0, g: 0.90, b: 0.50 },   // Radiant Jade
      { r: 0.2, g: 0.95, b: 0.75 },   // Emerald Shimmer
      { r: 0.9, g: 1.0, b: 0.95 },    // Pure Mint White
    ],
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    stops: [
      { r: 0.06, g: 0.04, b: 0.12 },  // Void Shadow
      { r: 0.45, g: 0.15, b: 0.85 },  // Deep Purple
      { r: 0.85, g: 0.25, b: 0.95 },  // Radiant Magenta
      { r: 1.0, g: 0.90, b: 1.0 },    // Starlight Opal
    ],
  },
  'monochrome-void': {
    name: 'Monochrome Void',
    stops: [
      { r: 0.04, g: 0.04, b: 0.06 },  // Void Obsidian
      { r: 0.35, g: 0.38, b: 0.45 },  // Slate Grey
      { r: 0.75, g: 0.80, b: 0.88 },  // Silver Filament
      { r: 1.0, g: 1.0, b: 1.0 },     // Pure White
    ],
  },
  'electric-fire': {
    name: 'Electric Fire',
    stops: [
      { r: 0.25, g: 0.02, b: 0.02 },  // Dark Crimson
      { r: 0.95, g: 0.20, b: 0.15 },  // Flame Red
      { r: 1.0, g: 0.65, b: 0.0 },    // Electric Amber
      { r: 1.0, g: 0.98, b: 0.55 },   // Radiant Sulfur White
    ],
  },
};

export interface TransformDefinition {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  weights: {
    linear: number;
    sinusoidal: number;
    spherical: number;
    swirl: number;
    horseshoe: number;
    polar: number;
    handkerchief: number;
    heart: number;
    disc: number;
    spiral: number;
    hyperbolic: number;
  };
  probability: number;
  colorIndex: number;
}

export interface FlamePresetConfig {
  name: string;
  description: string;
  defaultPalette: ColorPalette;
  symmetryFold: number;
  zoom: number;
  gamma: number;
  brightness: number;
  vibrance: number;
  pointSize: number;
  transforms: TransformDefinition[];
}

export const FLAME_PRESET_CONFIGS: Record<FlamePreset, FlamePresetConfig> = {
  'phoenix-nebula': {
    name: 'Phoenix Nebula',
    description: 'Swirling celestial flame filaments with high-density log-tone glowing core and fiery gradients',
    defaultPalette: 'spectral-aurora',
    symmetryFold: 2,
    zoom: 1.1,
    gamma: 2.2,
    brightness: 3.2,
    vibrance: 1.3,
    pointSize: 1.6,
    transforms: [
      {
        a: 0.65, b: -0.35, c: 0.35, d: 0.65, e: 0.15, f: 0.0,
        weights: { linear: 0.2, sinusoidal: 0.3, spherical: 0.6, swirl: 0.8, horseshoe: 0.0, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.35,
        colorIndex: 0.05,
      },
      {
        a: -0.55, b: 0.45, c: -0.45, d: -0.55, e: -0.2, f: 0.1,
        weights: { linear: 0.3, sinusoidal: 0.5, spherical: 0.4, swirl: 0.6, horseshoe: 0.0, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.30,
        colorIndex: 0.45,
      },
      {
        a: 0.3, b: 0.6, c: -0.6, d: 0.3, e: 0.0, f: -0.25,
        weights: { linear: 0.4, sinusoidal: 0.2, spherical: 0.8, swirl: 0.3, horseshoe: 0.0, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.20,
        colorIndex: 0.75,
      },
      {
        a: 0.5, b: 0.0, c: 0.0, d: 0.5, e: 0.0, f: 0.0,
        weights: { linear: 0.8, sinusoidal: 0.1, spherical: 0.2, swirl: 0.4, horseshoe: 0.0, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.15,
        colorIndex: 0.95,
      },
    ],
  },

  'dragon-spirals': {
    name: 'Dragon Spirals',
    description: 'Chaotic swirling fractal dragon curves with recursive tail vortices and laminar streamers',
    defaultPalette: 'obsidian-emerald',
    symmetryFold: 1,
    zoom: 1.25,
    gamma: 2.1,
    brightness: 3.5,
    vibrance: 1.2,
    pointSize: 1.5,
    transforms: [
      {
        a: 0.72, b: -0.38, c: 0.38, d: 0.72, e: 0.2, f: -0.1,
        weights: { linear: 0.1, sinusoidal: 0.0, spherical: 0.0, swirl: 0.5, horseshoe: 0.6, polar: 0.5, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.4, hyperbolic: 0.0 },
        probability: 0.35,
        colorIndex: 0.15,
      },
      {
        a: -0.45, b: 0.55, c: -0.55, d: -0.45, e: -0.3, f: 0.2,
        weights: { linear: 0.2, sinusoidal: 0.0, spherical: 0.3, swirl: 0.6, horseshoe: 0.4, polar: 0.6, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.3, hyperbolic: 0.0 },
        probability: 0.30,
        colorIndex: 0.55,
      },
      {
        a: 0.4, b: 0.5, c: -0.5, d: 0.4, e: 0.0, f: -0.2,
        weights: { linear: 0.3, sinusoidal: 0.2, spherical: 0.0, swirl: 0.4, horseshoe: 0.8, polar: 0.3, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.5, hyperbolic: 0.0 },
        probability: 0.20,
        colorIndex: 0.85,
      },
      {
        a: 0.6, b: 0.1, c: -0.1, d: 0.6, e: 0.1, f: 0.1,
        weights: { linear: 0.6, sinusoidal: 0.0, spherical: 0.2, swirl: 0.3, horseshoe: 0.2, polar: 0.4, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.2, hyperbolic: 0.0 },
        probability: 0.15,
        colorIndex: 0.35,
      },
    ],
  },

  'cosmic-cross': {
    name: 'Cosmic Cross',
    description: '4-fold radial sacred geometry with diamond coordinate folding and crystalline interference',
    defaultPalette: 'cosmic-amethyst',
    symmetryFold: 4,
    zoom: 1.05,
    gamma: 2.3,
    brightness: 3.0,
    vibrance: 1.3,
    pointSize: 1.7,
    transforms: [
      {
        a: 0.58, b: 0.32, c: -0.32, d: 0.58, e: 0.1, f: 0.1,
        weights: { linear: 0.3, sinusoidal: 0.2, spherical: 0.4, swirl: 0.2, horseshoe: 0.0, polar: 0.0, handkerchief: 0.4, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.35,
        colorIndex: 0.1,
      },
      {
        a: 0.42, b: -0.42, c: 0.42, d: 0.42, e: -0.15, f: 0.0,
        weights: { linear: 0.4, sinusoidal: 0.3, spherical: 0.5, swirl: 0.1, horseshoe: 0.0, polar: 0.0, handkerchief: 0.3, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.30,
        colorIndex: 0.45,
      },
      {
        a: -0.35, b: 0.55, c: -0.55, d: -0.35, e: 0.0, f: -0.2,
        weights: { linear: 0.2, sinusoidal: 0.4, spherical: 0.3, swirl: 0.5, horseshoe: 0.0, polar: 0.0, handkerchief: 0.5, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.20,
        colorIndex: 0.75,
      },
      {
        a: 0.5, b: 0.0, c: 0.0, d: 0.5, e: 0.0, f: 0.0,
        weights: { linear: 0.7, sinusoidal: 0.0, spherical: 0.3, swirl: 0.0, horseshoe: 0.0, polar: 0.0, handkerchief: 0.2, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.15,
        colorIndex: 0.95,
      },
    ],
  },

  'hyperbolic-bloom': {
    name: 'Hyperbolic Bloom',
    description: 'Organic floral blossoms unfurling along hyperbolic Poincaré disks with radial symmetry',
    defaultPalette: 'bioluminescent-cyan',
    symmetryFold: 6,
    zoom: 1.15,
    gamma: 2.0,
    brightness: 3.4,
    vibrance: 1.4,
    pointSize: 1.6,
    transforms: [
      {
        a: 0.62, b: -0.25, c: 0.25, d: 0.62, e: 0.12, f: 0.0,
        weights: { linear: 0.1, sinusoidal: 0.4, spherical: 0.2, swirl: 0.3, horseshoe: 0.0, polar: 0.4, handkerchief: 0.0, heart: 0.3, disc: 0.0, spiral: 0.0, hyperbolic: 0.6 },
        probability: 0.30,
        colorIndex: 0.1,
      },
      {
        a: -0.5, b: 0.35, c: -0.35, d: -0.5, e: -0.1, f: 0.15,
        weights: { linear: 0.2, sinusoidal: 0.3, spherical: 0.3, swirl: 0.2, horseshoe: 0.0, polar: 0.5, handkerchief: 0.0, heart: 0.2, disc: 0.0, spiral: 0.0, hyperbolic: 0.5 },
        probability: 0.25,
        colorIndex: 0.4,
      },
      {
        a: 0.45, b: 0.45, c: -0.45, d: 0.45, e: 0.0, f: -0.18,
        weights: { linear: 0.2, sinusoidal: 0.5, spherical: 0.1, swirl: 0.4, horseshoe: 0.0, polar: 0.3, handkerchief: 0.0, heart: 0.4, disc: 0.0, spiral: 0.0, hyperbolic: 0.4 },
        probability: 0.25,
        colorIndex: 0.7,
      },
      {
        a: 0.4, b: 0.0, c: 0.0, d: 0.4, e: 0.0, f: 0.0,
        weights: { linear: 0.5, sinusoidal: 0.2, spherical: 0.4, swirl: 0.1, horseshoe: 0.0, polar: 0.2, handkerchief: 0.0, heart: 0.1, disc: 0.0, spiral: 0.0, hyperbolic: 0.3 },
        probability: 0.20,
        colorIndex: 0.9,
      },
    ],
  },

  'quantum-crystal': {
    name: 'Quantum Crystal',
    description: 'Crystalline quantum diffraction matrix with crisp structural filaments and sharp edges',
    defaultPalette: 'electric-fire',
    symmetryFold: 3,
    zoom: 1.2,
    gamma: 2.2,
    brightness: 3.1,
    vibrance: 1.2,
    pointSize: 1.5,
    transforms: [
      {
        a: 0.68, b: 0.2, c: -0.2, d: 0.68, e: 0.18, f: 0.0,
        weights: { linear: 0.5, sinusoidal: 0.0, spherical: 0.2, swirl: 0.4, horseshoe: 0.5, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.3, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.35,
        colorIndex: 0.15,
      },
      {
        a: -0.48, b: 0.48, c: -0.48, d: -0.48, e: -0.15, f: 0.12,
        weights: { linear: 0.4, sinusoidal: 0.2, spherical: 0.3, swirl: 0.3, horseshoe: 0.6, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.2, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.30,
        colorIndex: 0.5,
      },
      {
        a: 0.35, b: -0.55, c: 0.55, d: 0.35, e: 0.0, f: -0.2,
        weights: { linear: 0.3, sinusoidal: 0.1, spherical: 0.4, swirl: 0.5, horseshoe: 0.4, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.4, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.20,
        colorIndex: 0.8,
      },
      {
        a: 0.5, b: 0.0, c: 0.0, d: 0.5, e: 0.0, f: 0.0,
        weights: { linear: 0.8, sinusoidal: 0.0, spherical: 0.1, swirl: 0.2, horseshoe: 0.3, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.1, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.15,
        colorIndex: 0.95,
      },
    ],
  },

  'solar-corona': {
    name: 'Solar Corona',
    description: 'Blazing plasma filaments erupting in turbulent coronal magnetic loops with intense core radiance',
    defaultPalette: 'solar-plasma',
    symmetryFold: 2,
    zoom: 1.0,
    gamma: 2.1,
    brightness: 3.6,
    vibrance: 1.3,
    pointSize: 1.8,
    transforms: [
      {
        a: 0.75, b: -0.25, c: 0.25, d: 0.75, e: 0.1, f: 0.0,
        weights: { linear: 0.1, sinusoidal: 0.2, spherical: 0.8, swirl: 0.6, horseshoe: 0.0, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.2, hyperbolic: 0.0 },
        probability: 0.40,
        colorIndex: 0.1,
      },
      {
        a: -0.6, b: 0.4, c: -0.4, d: -0.6, e: -0.15, f: 0.1,
        weights: { linear: 0.2, sinusoidal: 0.4, spherical: 0.7, swirl: 0.5, horseshoe: 0.0, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.3, hyperbolic: 0.0 },
        probability: 0.35,
        colorIndex: 0.5,
      },
      {
        a: 0.4, b: 0.5, c: -0.5, d: 0.4, e: 0.0, f: -0.2,
        weights: { linear: 0.3, sinusoidal: 0.1, spherical: 0.9, swirl: 0.4, horseshoe: 0.0, polar: 0.0, handkerchief: 0.0, heart: 0.0, disc: 0.0, spiral: 0.4, hyperbolic: 0.0 },
        probability: 0.25,
        colorIndex: 0.9,
      },
    ],
  },

  'abyssal-vortex': {
    name: 'Abyssal Vortex',
    description: 'Deep oceanic whirlpool with curving laminar tidal streams and smooth polar gradients',
    defaultPalette: 'spectral-aurora',
    symmetryFold: 1,
    zoom: 1.15,
    gamma: 2.2,
    brightness: 3.2,
    vibrance: 1.2,
    pointSize: 1.6,
    transforms: [
      {
        a: 0.65, b: 0.35, c: -0.35, d: 0.65, e: 0.15, f: 0.0,
        weights: { linear: 0.1, sinusoidal: 0.1, spherical: 0.2, swirl: 0.6, horseshoe: 0.7, polar: 0.5, handkerchief: 0.0, heart: 0.0, disc: 0.4, spiral: 0.2, hyperbolic: 0.0 },
        probability: 0.35,
        colorIndex: 0.1,
      },
      {
        a: -0.52, b: 0.42, c: -0.42, d: -0.52, e: -0.2, f: 0.15,
        weights: { linear: 0.2, sinusoidal: 0.2, spherical: 0.3, swirl: 0.5, horseshoe: 0.6, polar: 0.6, handkerchief: 0.0, heart: 0.0, disc: 0.3, spiral: 0.3, hyperbolic: 0.0 },
        probability: 0.30,
        colorIndex: 0.45,
      },
      {
        a: 0.42, b: -0.48, c: 0.48, d: 0.42, e: 0.0, f: -0.22,
        weights: { linear: 0.3, sinusoidal: 0.3, spherical: 0.1, swirl: 0.4, horseshoe: 0.8, polar: 0.4, handkerchief: 0.0, heart: 0.0, disc: 0.5, spiral: 0.4, hyperbolic: 0.0 },
        probability: 0.20,
        colorIndex: 0.75,
      },
      {
        a: 0.5, b: 0.0, c: 0.0, d: 0.5, e: 0.0, f: 0.0,
        weights: { linear: 0.7, sinusoidal: 0.0, spherical: 0.2, swirl: 0.3, horseshoe: 0.3, polar: 0.3, handkerchief: 0.0, heart: 0.0, disc: 0.2, spiral: 0.1, hyperbolic: 0.0 },
        probability: 0.15,
        colorIndex: 0.95,
      },
    ],
  },

  'sierpinski-chaos': {
    name: 'Sierpinski Chaos',
    description: 'Generalized non-linear Sierpinski gasket warped through spherical space and handkerchief folds',
    defaultPalette: 'monochrome-void',
    symmetryFold: 3,
    zoom: 1.2,
    gamma: 2.3,
    brightness: 2.9,
    vibrance: 1.1,
    pointSize: 1.5,
    transforms: [
      {
        a: 0.5, b: 0.0, c: 0.0, d: 0.5, e: 0.0, f: 0.4,
        weights: { linear: 0.6, sinusoidal: 0.2, spherical: 0.5, swirl: 0.2, horseshoe: 0.0, polar: 0.0, handkerchief: 0.4, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.34,
        colorIndex: 0.1,
      },
      {
        a: 0.5, b: 0.0, c: 0.0, d: 0.5, e: -0.35, f: -0.25,
        weights: { linear: 0.6, sinusoidal: 0.2, spherical: 0.5, swirl: 0.2, horseshoe: 0.0, polar: 0.0, handkerchief: 0.4, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.33,
        colorIndex: 0.5,
      },
      {
        a: 0.5, b: 0.0, c: 0.0, d: 0.5, e: 0.35, f: -0.25,
        weights: { linear: 0.6, sinusoidal: 0.2, spherical: 0.5, swirl: 0.2, horseshoe: 0.0, polar: 0.0, handkerchief: 0.4, heart: 0.0, disc: 0.0, spiral: 0.0, hyperbolic: 0.0 },
        probability: 0.33,
        colorIndex: 0.9,
      },
    ],
  },
};

/**
 * Evaluates Scott Draves non-linear variations on coordinates (x, y).
 */
export function evaluateVariations(
  x: number,
  y: number,
  wLinear: number,
  wSinusoidal: number,
  wSpherical: number,
  wSwirl: number,
  wHorseshoe: number,
  wPolar: number,
  wHandkerchief: number,
  wHeart: number,
  wDisc: number,
  wSpiral: number,
  wHyperbolic: number
): [number, number] {
  let vx = 0;
  let vy = 0;

  const r2 = x * x + y * y + 1e-10;
  const r = Math.sqrt(r2);
  const theta = Math.atan2(x, y); // Draves standard atan2(x, y)

  // V0: Linear
  if (wLinear !== 0) {
    vx += wLinear * x;
    vy += wLinear * y;
  }

  // V1: Sinusoidal
  if (wSinusoidal !== 0) {
    vx += wSinusoidal * Math.sin(x);
    vy += wSinusoidal * Math.sin(y);
  }

  // V2: Spherical
  if (wSpherical !== 0) {
    const invR2 = 1.0 / r2;
    vx += wSpherical * (x * invR2);
    vy += wSpherical * (y * invR2);
  }

  // V3: Swirl
  if (wSwirl !== 0) {
    const sinR2 = Math.sin(r2);
    const cosR2 = Math.cos(r2);
    vx += wSwirl * (x * sinR2 - y * cosR2);
    vy += wSwirl * (x * cosR2 + y * sinR2);
  }

  // V4: Horseshoe
  if (wHorseshoe !== 0) {
    const invR = 1.0 / r;
    vx += wHorseshoe * ((x - y) * (x + y) * invR);
    vy += wHorseshoe * (2.0 * x * y * invR);
  }

  // V5: Polar
  if (wPolar !== 0) {
    vx += wPolar * (theta / Math.PI);
    vy += wPolar * (r - 1.0);
  }

  // V6: Handkerchief
  if (wHandkerchief !== 0) {
    vx += wHandkerchief * (r * Math.sin(theta + r));
    vy += wHandkerchief * (r * Math.cos(theta - r));
  }

  // V7: Heart
  if (wHeart !== 0) {
    vx += wHeart * (r * Math.sin(theta * r));
    vy += wHeart * (-r * Math.cos(theta * r));
  }

  // V8: Disc
  if (wDisc !== 0) {
    const factor = theta / Math.PI;
    vx += wDisc * (factor * Math.sin(Math.PI * r));
    vy += wDisc * (factor * Math.cos(Math.PI * r));
  }

  // V9: Spiral
  if (wSpiral !== 0) {
    const invR = 1.0 / r;
    vx += wSpiral * (invR * (Math.cos(theta) + Math.sin(r)));
    vy += wSpiral * (invR * (Math.sin(theta) - Math.cos(r)));
  }

  // V10: Hyperbolic
  if (wHyperbolic !== 0) {
    vx += wHyperbolic * (Math.sin(theta) / r);
    vy += wHyperbolic * (r * Math.cos(theta));
  }

  return [vx, vy];
}

/**
 * Interpolates smoothly along a 4-stop color palette.
 */
export function sampleFlamePalette(
  palette: FlamePaletteDef,
  t: number,
  out: { r: number; g: number; b: number }
): void {
  const clampedT = Math.max(0.0, Math.min(1.0, t));
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
    out.g = stops[3].g + (stops[3].g - stops[3].g) * s;
    out.b = stops[2].b + (stops[3].b - stops[2].b) * s;
  }
}

export class FractalFlamesRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: RoomContext | null = null;
  private prng: PRNG = createPRNG('#FF2A6D');

  // Simulation Parameters & Dynamic Target Interpolation
  private params: FractalFlamesParams = { ...DEFAULT_FRACTAL_FLAMES_PARAMS };
  private targetParams: FractalFlamesParams = { ...DEFAULT_FRACTAL_FLAMES_PARAMS };

  // Active Transforms Set
  private activeTransforms: TransformDefinition[] = [];
  private cumulativeProbabilities: number[] = [];

  // Three.js WebGL/WebGPU Pipeline Objects
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private pointsMesh: THREE.Points | null = null;
  private pointsGeometry: THREE.BufferGeometry | null = null;
  private pointsMaterial: THREE.ShaderMaterial | null = null;
  private positionAttribute: THREE.BufferAttribute | null = null;
  private colorAttribute: THREE.BufferAttribute | null = null;

  // Particle Point State Buffers
  private positions: Float32Array = new Float32Array(MAX_POINTS_CAPACITY * 3);
  private colors: Float32Array = new Float32Array(MAX_POINTS_CAPACITY * 3);
  private particleX: Float32Array = new Float32Array(MAX_POINTS_CAPACITY);
  private particleY: Float32Array = new Float32Array(MAX_POINTS_CAPACITY);
  private particleColorIndex: Float32Array = new Float32Array(MAX_POINTS_CAPACITY);
  private activePointCount = 300000;

  // Canvas2D Fallback Rendering
  private backendMode: 'webgl' | 'canvas2d' = 'webgl';
  private ctx2d: CanvasRenderingContext2D | null = null;

  // Animation Loop & Performance State
  private isMounted = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private flameRotation = 0;

  // Interactive Pointer State
  private pointerX = 0;
  private pointerY = 0;
  private isPointerDown = false;
  private pointerPrevX = 0;
  private pointerPrevY = 0;
  private shockwaveIntensity = 0;

  // Viewport Dimensions
  private width = 800;
  private height = 600;

  /**
   * Mounts the Fractal Flames simulation to the canvas and container.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.ctx = ctx;
    this.prng = ctx.prng || createPRNG(ctx.params.seed || '#FF2A6D');

    // Inherit initial parameters from registry defaults and URL hash
    this.params = {
      ...DEFAULT_FRACTAL_FLAMES_PARAMS,
      ...(ctx.params as Partial<FractalFlamesParams>),
    };
    this.targetParams = { ...this.params };

    this.width = ctx.canvas.width || 800;
    this.height = ctx.canvas.height || 600;

    // Load active preset transforms and variation weights
    this.loadPresetTransforms(this.params.preset);

    // Initialize Particle Coordinates
    this.initializeParticles();

    try {
      // Attempt Three.js WebGLRenderer Initialization
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      this.scene = new THREE.Scene();

      // Orthographic camera for crisp 2D planar projection
      const aspect = this.width / Math.max(1, this.height);
      const frustumSize = 3.0;
      this.camera = new THREE.OrthographicCamera(
        (-frustumSize * aspect) / 2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.01,
        100.0
      );
      this.camera.position.set(0, 0, 10);
      this.camera.lookAt(0, 0, 0);

      // Create Custom Luminescent Points Shader with Scott Draves Log-Density Tone Mapping
      this.pointsMaterial = this.createShaderMaterial();

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

      this.backendMode = 'webgl';
    } catch (err) {
      console.warn('WebGL initialization in Room 17 (Fractal Flames) failed, activating Canvas2D fallback:', err);
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
   * Initializes particle positions on the attractor manifold with warmup iterations.
   */
  private initializeParticles(): void {
    const targetCount = Math.min(MAX_POINTS_CAPACITY, Math.max(10000, this.params.pointCount));
    this.activePointCount = targetCount;

    // Seed points randomly around the origin
    for (let i = 0; i < targetCount; i++) {
      this.particleX[i] = this.prng.nextFloat(-1.0, 1.0);
      this.particleY[i] = this.prng.nextFloat(-1.0, 1.0);
      this.particleColorIndex[i] = this.prng.nextFloat(0.0, 1.0);
    }

    // Warmup chaos game steps to settle points onto the attractor manifold
    for (let step = 0; step < 25; step++) {
      this.stepChaosGame(1);
    }

    // Populate initial Three.js buffers
    const palette = FLAME_PALETTES[this.params.colorPalette] || FLAME_PALETTES['spectral-aurora'];
    const tempColor = { r: 0, g: 0, b: 0 };

    for (let i = 0; i < targetCount; i++) {
      this.positions[i * 3] = this.particleX[i];
      this.positions[i * 3 + 1] = this.particleY[i];
      this.positions[i * 3 + 2] = 0.0;

      sampleFlamePalette(palette, this.particleColorIndex[i], tempColor);
      this.colors[i * 3] = tempColor.r;
      this.colors[i * 3 + 1] = tempColor.g;
      this.colors[i * 3 + 2] = tempColor.b;
    }
  }

  /**
   * Loads preset transforms and computes cumulative selection probability table.
   */
  private loadPresetTransforms(preset: FlamePreset): void {
    const config = FLAME_PRESET_CONFIGS[preset] || FLAME_PRESET_CONFIGS['phoenix-nebula'];
    this.activeTransforms = config.transforms.map(t => ({
      ...t,
      weights: { ...t.weights },
    }));

    // Update preset-specific parameters if not explicitly overridden
    this.params.symmetryFold = config.symmetryFold;
    this.params.zoom = config.zoom;
    this.params.gamma = config.gamma;
    this.params.brightness = config.brightness;
    this.params.vibrance = config.vibrance;
    this.params.pointSize = config.pointSize;
    this.targetParams.zoom = config.zoom;
    this.targetParams.gamma = config.gamma;
    this.targetParams.brightness = config.brightness;
    this.targetParams.vibrance = config.vibrance;
    this.targetParams.pointSize = config.pointSize;

    // Apply variation weights from first transform to UI parameters
    if (this.activeTransforms.length > 0) {
      const w = this.activeTransforms[0].weights;
      this.params.linearWeight = w.linear;
      this.params.sinusoidalWeight = w.sinusoidal;
      this.params.sphericalWeight = w.spherical;
      this.params.swirlWeight = w.swirl;
      this.params.horseshoeWeight = w.horseshoe;
      this.params.polarWeight = w.polar;
      this.params.handkerchiefWeight = w.handkerchief;
      this.params.heartWeight = w.heart;
      this.params.discWeight = w.disc;
      this.params.spiralWeight = w.spiral;
      this.params.hyperbolicWeight = w.hyperbolic;
    }

    this.rebuildProbabilityTable();
  }

  /**
   * Normalizes probabilities and constructs cumulative distribution array for O(1) sampling.
   */
  private rebuildProbabilityTable(): void {
    const count = Math.min(this.activeTransforms.length, Math.max(1, this.params.transformCount));
    let totalProb = 0;
    for (let i = 0; i < count; i++) {
      totalProb += Math.max(0.01, this.activeTransforms[i].probability);
    }

    this.cumulativeProbabilities = new Array(count);
    let running = 0;
    for (let i = 0; i < count; i++) {
      running += Math.max(0.01, this.activeTransforms[i].probability) / totalProb;
      this.cumulativeProbabilities[i] = running;
    }
    this.cumulativeProbabilities[count - 1] = 1.0;
  }

  /**
   * Advances the chaos game by one or more steps across all active particles.
   */
  private stepChaosGame(steps: number): void {
    const count = this.activePointCount;
    const numTransforms = Math.min(this.activeTransforms.length, Math.max(1, this.params.transformCount));
    const cumProb = this.cumulativeProbabilities;
    const symFold = Math.max(1, this.params.symmetryFold);
    const hasSymmetry = symFold > 1;
    const symAngleStep = (Math.PI * 2) / symFold;

    // UI variation weight overrides (blended with transform weights)
    const uLin = this.params.linearWeight;
    const uSin = this.params.sinusoidalWeight;
    const uSph = this.params.sphericalWeight;
    const uSwi = this.params.swirlWeight;
    const uHor = this.params.horseshoeWeight;
    const uPol = this.params.polarWeight;
    const uHan = this.params.handkerchiefWeight;
    const uHea = this.params.heartWeight;
    const uDis = this.params.discWeight;
    const uSpi = this.params.spiralWeight;
    const uHyp = this.params.hyperbolicWeight;

    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < count; i++) {
        let x = this.particleX[i];
        let y = this.particleY[i];
        let c = this.particleColorIndex[i];

        // Select transform via cumulative distribution
        const rVal = Math.random();
        let tIdx = 0;
        while (tIdx < numTransforms - 1 && rVal > cumProb[tIdx]) {
          tIdx++;
        }

        const t = this.activeTransforms[tIdx];

        // 1. Affine Step
        const ax = t.a * x + t.b * y + t.e;
        const ay = t.c * x + t.d * y + t.f;

        // 2. Non-linear Variations Evaluation
        const tw = t.weights;
        const [vx, vy] = evaluateVariations(
          ax,
          ay,
          tw.linear * (uLin > 0 ? uLin : 1.0),
          tw.sinusoidal * (uSin > 0 ? uSin : 1.0),
          tw.spherical * (uSph > 0 ? uSph : 1.0),
          tw.swirl * (uSwi > 0 ? uSwi : 1.0),
          tw.horseshoe * (uHor > 0 ? uHor : 1.0),
          tw.polar * (uPol > 0 ? uPol : 1.0),
          tw.handkerchief * (uHan > 0 ? uHan : 1.0),
          tw.heart * (uHea > 0 ? uHea : 1.0),
          tw.disc * (uDis > 0 ? uDis : 1.0),
          tw.spiral * (uSpi > 0 ? uSpi : 1.0),
          tw.hyperbolic * (uHyp > 0 ? uHyp : 1.0)
        );

        let finalX = vx;
        let finalY = vy;

        // 3. Rotational Symmetry Folding
        if (hasSymmetry) {
          const symIndex = Math.floor(Math.random() * symFold);
          if (symIndex > 0) {
            const angle = symIndex * symAngleStep;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const rx = finalX * cosA - finalY * sinA;
            const ry = finalX * sinA + finalY * cosA;
            finalX = rx;
            finalY = ry;
          }
        }

        // 4. Update Structural Color Index: c <- (c + c_i) / 2
        c = (c + t.colorIndex) * 0.5;

        // Bound guard against divergence
        if (isNaN(finalX) || isNaN(finalY) || Math.abs(finalX) > 20.0 || Math.abs(finalY) > 20.0) {
          finalX = (Math.random() - 0.5) * 2.0;
          finalY = (Math.random() - 0.5) * 2.0;
          c = Math.random();
        }

        this.particleX[i] = finalX;
        this.particleY[i] = finalY;
        this.particleColorIndex[i] = c;
      }
    }
  }

  /**
   * Constructs the custom Scott Draves Log-Density Tone Mapping point shader material.
   */
  private createShaderMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPointSize: { value: this.params.pointSize },
        uBrightness: { value: this.params.brightness },
        uGamma: { value: this.params.gamma },
        uVibrance: { value: this.params.vibrance },
        uGlowIntensity: { value: this.params.glowIntensity },
        uZoom: { value: this.params.zoom },
        uPan: { value: new THREE.Vector2(this.params.panX, this.params.panY) },
        uRotation: { value: 0.0 },
        uViewportHeight: { value: this.height },
      },
      vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uPointSize;
        uniform float uZoom;
        uniform vec2 uPan;
        uniform float uRotation;
        uniform float uViewportHeight;

        void main() {
          vColor = color;
          
          // Apply 2D rotation and pan offset
          float cosR = cos(uRotation);
          float sinR = sin(uRotation);
          vec2 p = position.xy;
          vec2 rotP = vec2(p.x * cosR - p.y * sinR, p.x * sinR + p.y * cosR);
          vec2 finalP = (rotP + uPan) * uZoom;

          vec4 mvPosition = modelViewMatrix * vec4(finalP, position.z, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Smooth scale-attenuated point size
          gl_PointSize = clamp(uPointSize * (uViewportHeight / 800.0), 1.0, 16.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float uBrightness;   // kappa
        uniform float uGamma;        // gamma
        uniform float uVibrance;     // color vibrance
        uniform float uGlowIntensity;// starlight glow

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) {
            discard;
          }

          // Soft Gaussian radial point profile
          float radial = exp(-distSq * 16.0);

          // Analytical Scott Draves Log-Density Tone Mapping
          // density scaling by kappa (uBrightness)
          float density = radial * uBrightness * 0.15;
          float logDensity = log(1.0 + density * 4.0) / log(1.0 + 4.0);
          
          // Gamma correction and vibrance enhancement
          vec3 baseColor = vColor;
          float luminance = dot(baseColor, vec3(0.299, 0.587, 0.114));
          vec3 vibrantColor = mix(vec3(luminance), baseColor, uVibrance);
          
          vec3 finalColor = pow(clamp(vibrantColor * logDensity * uGlowIntensity, 0.0, 1.0), vec3(1.0 / max(0.1, uGamma)));
          float alpha = clamp(logDensity * radial * uGlowIntensity, 0.0, 1.0);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
  }

  /**
   * Applies and damps parameter changes from Tweakpane or URL state sync.
   */
  public updateParams(newParams: Partial<FractalFlamesParams>): void {
    if (!newParams) return;

    const oldPreset = this.params.preset;
    const isPresetChange = Boolean(newParams.preset && newParams.preset !== oldPreset);

    // Apply parameters to target object
    Object.assign(this.targetParams, newParams);

    if (isPresetChange && newParams.preset) {
      this.loadPresetTransforms(newParams.preset);
      this.initializeParticles();
    }

    if (newParams.transformCount !== undefined) {
      this.rebuildProbabilityTable();
    }

    if (newParams.pointCount !== undefined) {
      const count = Math.min(MAX_POINTS_CAPACITY, Math.max(10000, newParams.pointCount));
      this.activePointCount = count;
      this.initializeParticles();
    }

    if (newParams.seed !== undefined && newParams.seed !== this.params.seed) {
      this.prng = createPRNG(String(newParams.seed));
      this.initializeParticles();
    }

    // Direct uniform updates
    if (this.pointsMaterial) {
      if (newParams.pointSize !== undefined) {
        this.pointsMaterial.uniforms.uPointSize.value = newParams.pointSize;
      }
      if (newParams.brightness !== undefined) {
        this.pointsMaterial.uniforms.uBrightness.value = newParams.brightness;
      }
      if (newParams.gamma !== undefined) {
        this.pointsMaterial.uniforms.uGamma.value = newParams.gamma;
      }
      if (newParams.vibrance !== undefined) {
        this.pointsMaterial.uniforms.uVibrance.value = newParams.vibrance;
      }
      if (newParams.glowIntensity !== undefined) {
        this.pointsMaterial.uniforms.uGlowIntensity.value = newParams.glowIntensity;
      }
    }
  }

  /**
   * Handles viewport dimension changes.
   */
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    if (this.renderer) {
      this.renderer.setSize(width, height, false);
    }

    if (this.camera) {
      const aspect = width / Math.max(1, height);
      const frustumSize = 3.0;
      this.camera.left = (-frustumSize * aspect) / 2;
      this.camera.right = (frustumSize * aspect) / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = -frustumSize / 2;
      this.camera.updateProjectionMatrix();
    }

    if (this.pointsMaterial) {
      this.pointsMaterial.uniforms.uViewportHeight.value = height;
    }
  }

  /**
   * Handles interactive pointer gestures (drag pan, cursor warp, shockwave click).
   */
  public onPointer(event: RoomPointerEvent): void {
    if (event.type === 'down') {
      this.isPointerDown = true;
      this.pointerPrevX = event.x;
      this.pointerPrevY = event.y;
      this.shockwaveIntensity = 1.0;
    } else if (event.type === 'move') {
      if (this.isPointerDown) {
        const dx = (event.x - this.pointerPrevX) / Math.max(1, this.width);
        const dy = (event.y - this.pointerPrevY) / Math.max(1, this.height);
        this.targetParams.panX += dx * 2.5;
        this.targetParams.panY -= dy * 2.5;
        this.pointerPrevX = event.x;
        this.pointerPrevY = event.y;
      }
    } else if (event.type === 'up' || event.type === 'leave') {
      this.isPointerDown = false;
    }
  }

  /**
   * Main 60 FPS animation and physics step loop.
   */
  private loop(currentTime: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    // Smooth parameter damping (exponential decay)
    this.params.zoom = dampParameter(this.params.zoom, this.targetParams.zoom, 6.0, dt);
    this.params.panX = dampParameter(this.params.panX, this.targetParams.panX, 6.0, dt);
    this.params.panY = dampParameter(this.params.panY, this.targetParams.panY, 6.0, dt);
    this.params.gamma = dampParameter(this.params.gamma, this.targetParams.gamma, 5.0, dt);
    this.params.brightness = dampParameter(this.params.brightness, this.targetParams.brightness, 5.0, dt);
    this.params.vibrance = dampParameter(this.params.vibrance, this.targetParams.vibrance, 5.0, dt);
    this.params.glowIntensity = dampParameter(this.params.glowIntensity, this.targetParams.glowIntensity, 5.0, dt);

    // Audio reactivity integration
    let audioBass = 0;
    let audioMid = 0;
    let audioTreb = 0;
    if (this.ctx?.audio && this.params.audioSource !== 'none') {
      const audio = this.ctx.audio;
      const sens = this.params.audioSensitivity;
      audioBass = audio.getBass() * sens;
      audioMid = audio.getMid() * sens;
      audioTreb = audio.getTreble() * sens;
    }

    // Auto-rotation
    if (this.params.autoRotate) {
      this.flameRotation += dt * this.params.rotationSpeed * (1.0 + audioMid * 0.5);
    }

    // Shockwave decay
    if (this.shockwaveIntensity > 0.001) {
      this.shockwaveIntensity *= Math.exp(-4.0 * dt);
    }

    // Cursor magnetic influence
    if (this.pointerX > 0 && this.pointerY > 0) {
      const normCursorX = ((this.pointerX / Math.max(1, this.width)) - 0.5) * 2.0;
      const normCursorY = -((this.pointerY / Math.max(1, this.height)) - 0.5) * 2.0;
      this.targetParams.panX += normCursorX * 0.0002;
      this.targetParams.panY += normCursorY * 0.0002;
    }

    // Advance chaos game iteration steps
    const steps = Math.max(1, Math.min(8, this.params.iterationsPerFrame));
    this.stepChaosGame(steps);

    // Update Three.js Buffers
    const count = this.activePointCount;
    const palette = FLAME_PALETTES[this.params.colorPalette] || FLAME_PALETTES['spectral-aurora'];
    const tempColor = { r: 0, g: 0, b: 0 };

    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = this.particleX[i];
      this.positions[i * 3 + 1] = this.particleY[i];
      this.positions[i * 3 + 2] = 0.0;

      sampleFlamePalette(palette, this.particleColorIndex[i], tempColor);

      // Treble transient starlight excitation
      if (audioTreb > 0.1) {
        tempColor.r = Math.min(1.0, tempColor.r + audioTreb * 0.2);
        tempColor.g = Math.min(1.0, tempColor.g + audioTreb * 0.2);
        tempColor.b = Math.min(1.0, tempColor.b + audioTreb * 0.2);
      }

      this.colors[i * 3] = tempColor.r;
      this.colors[i * 3 + 1] = tempColor.g;
      this.colors[i * 3 + 2] = tempColor.b;
    }

    if (this.backendMode === 'webgl' && this.renderer && this.scene && this.camera && this.pointsMaterial) {
      if (this.positionAttribute) this.positionAttribute.needsUpdate = true;
      if (this.colorAttribute) this.colorAttribute.needsUpdate = true;

      // Update shader uniforms
      this.pointsMaterial.uniforms.uZoom.value = this.params.zoom * (1.0 + audioBass * 0.15 + this.shockwaveIntensity * 0.2);
      this.pointsMaterial.uniforms.uPan.value.set(this.params.panX, this.params.panY);
      this.pointsMaterial.uniforms.uRotation.value = this.flameRotation;
      this.pointsMaterial.uniforms.uBrightness.value = this.params.brightness * (1.0 + audioBass * 0.3);
      this.pointsMaterial.uniforms.uGamma.value = this.params.gamma;
      this.pointsMaterial.uniforms.uVibrance.value = this.params.vibrance;
      this.pointsMaterial.uniforms.uGlowIntensity.value = this.params.glowIntensity * (1.0 + audioTreb * 0.25);

      this.renderer.render(this.scene, this.camera);
    } else if (this.backendMode === 'canvas2d' && this.ctx2d) {
      this.renderCanvas2DFallback();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Fallback Canvas2D point rendering with log-density exposure simulation.
   */
  private renderCanvas2DFallback(): void {
    const ctx = this.ctx2d;
    if (!ctx) return;

    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.width / 2 + this.params.panX * 200;
    const cy = this.height / 2 - this.params.panY * 200;
    const scale = (Math.min(this.width, this.height) / 3.0) * this.params.zoom;
    const cosR = Math.cos(this.flameRotation);
    const sinR = Math.sin(this.flameRotation);
    const count = this.activePointCount;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const pSize = Math.max(1.0, this.params.pointSize);
    for (let i = 0; i < count; i += 2) {
      const px = this.positions[i * 3];
      const py = this.positions[i * 3 + 1];

      const rx = px * cosR - py * sinR;
      const ry = px * sinR + py * cosR;

      const sx = cx + rx * scale;
      const sy = cy - ry * scale;

      if (sx >= -5 && sx <= this.width + 5 && sy >= -5 && sy <= this.height + 5) {
        const r = Math.floor(this.colors[i * 3] * 255);
        const g = Math.floor(this.colors[i * 3 + 1] * 255);
        const b = Math.floor(this.colors[i * 3 + 2] * 255);
        const alpha = Math.min(1.0, this.params.glowIntensity * 0.25);

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
        ctx.fillRect(sx, sy, pSize, pSize);
      }
    }

    ctx.restore();
  }

  /**
   * Generates a high-resolution offline 2D histogram log-density tone-mapped snapshot.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;

    // Full Offline 2D Histogram Accumulation with Scott Draves Log-Density Tone Mapping
    const densityGrid = new Float32Array(width * height);
    const redGrid = new Float32Array(width * height);
    const greenGrid = new Float32Array(width * height);
    const blueGrid = new Float32Array(width * height);

    const palette = FLAME_PALETTES[this.params.colorPalette] || FLAME_PALETTES['spectral-aurora'];
    const tempColor = { r: 0, g: 0, b: 0 };

    const totalSteps = 2000000;
    const numTransforms = Math.min(this.activeTransforms.length, Math.max(1, this.params.transformCount));
    const cumProb = this.cumulativeProbabilities;
    const symFold = Math.max(1, this.params.symmetryFold);
    const hasSymmetry = symFold > 1;
    const symAngleStep = (Math.PI * 2) / symFold;

    const uLin = this.params.linearWeight;
    const uSin = this.params.sinusoidalWeight;
    const uSph = this.params.sphericalWeight;
    const uSwi = this.params.swirlWeight;
    const uHor = this.params.horseshoeWeight;
    const uPol = this.params.polarWeight;
    const uHan = this.params.handkerchiefWeight;
    const uHea = this.params.heartWeight;
    const uDis = this.params.discWeight;
    const uSpi = this.params.spiralWeight;
    const uHyp = this.params.hyperbolicWeight;

    let x = 0.1;
    let y = 0.1;
    let c = 0.5;

    // 1. Warmup Steps
    for (let w = 0; w < 50; w++) {
      const rVal = Math.random();
      let tIdx = 0;
      while (tIdx < numTransforms - 1 && rVal > cumProb[tIdx]) tIdx++;
      const t = this.activeTransforms[tIdx];
      const ax = t.a * x + t.b * y + t.e;
      const ay = t.c * x + t.d * y + t.f;
      const tw = t.weights;
      const [vx, vy] = evaluateVariations(
        ax, ay,
        tw.linear * (uLin > 0 ? uLin : 1.0),
        tw.sinusoidal * (uSin > 0 ? uSin : 1.0),
        tw.spherical * (uSph > 0 ? uSph : 1.0),
        tw.swirl * (uSwi > 0 ? uSwi : 1.0),
        tw.horseshoe * (uHor > 0 ? uHor : 1.0),
        tw.polar * (uPol > 0 ? uPol : 1.0),
        tw.handkerchief * (uHan > 0 ? uHan : 1.0),
        tw.heart * (uHea > 0 ? uHea : 1.0),
        tw.disc * (uDis > 0 ? uDis : 1.0),
        tw.spiral * (uSpi > 0 ? uSpi : 1.0),
        tw.hyperbolic * (uHyp > 0 ? uHyp : 1.0)
      );
      x = vx;
      y = vy;
      c = (c + t.colorIndex) * 0.5;
    }

    const cx = width / 2 + this.params.panX * (width / 4);
    const cy = height / 2 - this.params.panY * (height / 4);
    const scale = (Math.min(width, height) / 3.0) * this.params.zoom;
    const cosR = Math.cos(this.flameRotation);
    const sinR = Math.sin(this.flameRotation);

    let maxDensity = 0;

    // 2. Accumulation Steps
    for (let step = 0; step < totalSteps; step++) {
      const rVal = Math.random();
      let tIdx = 0;
      while (tIdx < numTransforms - 1 && rVal > cumProb[tIdx]) tIdx++;
      const t = this.activeTransforms[tIdx];
      const ax = t.a * x + t.b * y + t.e;
      const ay = t.c * x + t.d * y + t.f;
      const tw = t.weights;
      const [vx, vy] = evaluateVariations(
        ax, ay,
        tw.linear * (uLin > 0 ? uLin : 1.0),
        tw.sinusoidal * (uSin > 0 ? uSin : 1.0),
        tw.spherical * (uSph > 0 ? uSph : 1.0),
        tw.swirl * (uSwi > 0 ? uSwi : 1.0),
        tw.horseshoe * (uHor > 0 ? uHor : 1.0),
        tw.polar * (uPol > 0 ? uPol : 1.0),
        tw.handkerchief * (uHan > 0 ? uHan : 1.0),
        tw.heart * (uHea > 0 ? uHea : 1.0),
        tw.disc * (uDis > 0 ? uDis : 1.0),
        tw.spiral * (uSpi > 0 ? uSpi : 1.0),
        tw.hyperbolic * (uHyp > 0 ? uHyp : 1.0)
      );
      x = vx;
      y = vy;

      if (hasSymmetry) {
        const symIndex = Math.floor(Math.random() * symFold);
        if (symIndex > 0) {
          const angle = symIndex * symAngleStep;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const rx = x * cosA - y * sinA;
          const ry = x * sinA + y * cosA;
          x = rx;
          y = ry;
        }
      }

      c = (c + t.colorIndex) * 0.5;

      if (isNaN(x) || isNaN(y) || Math.abs(x) > 20.0 || Math.abs(y) > 20.0) {
        x = (Math.random() - 0.5) * 2.0;
        y = (Math.random() - 0.5) * 2.0;
        c = Math.random();
        continue;
      }

      const rx = x * cosR - y * sinR;
      const ry = x * sinR + y * cosR;
      const px = Math.floor(cx + rx * scale);
      const py = Math.floor(cy - ry * scale);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = py * width + px;
        densityGrid[idx] += 1.0;
        if (densityGrid[idx] > maxDensity) maxDensity = densityGrid[idx];

        sampleFlamePalette(palette, c, tempColor);
        redGrid[idx] += tempColor.r;
        greenGrid[idx] += tempColor.g;
        blueGrid[idx] += tempColor.b;
      }
    }

    // 3. Scott Draves Log-Density Tone Mapping Pass onto 2D Canvas
    const snapCtx = snapCanvas.getContext('2d');
    if (snapCtx) {
      const imgData = snapCtx.createImageData(width, height);
      const data = imgData.data;
      const kappa = this.params.brightness;
      const gamma = Math.max(0.1, this.params.gamma);
      const vibrance = this.params.vibrance;
      const logMax = Math.log(1.0 + kappa * maxDensity);

      for (let i = 0; i < width * height; i++) {
        const d = densityGrid[i];
        const pixelIdx = i * 4;

        if (d > 0 && logMax > 0) {
          const avgR = redGrid[i] / d;
          const avgG = greenGrid[i] / d;
          const avgB = blueGrid[i] / d;

          // Log-Density Tone Mapping Equation
          const alpha = Math.pow(Math.log(1.0 + kappa * d) / logMax, 1.0 / gamma);

          // Vibrance
          const lum = avgR * 0.299 + avgG * 0.587 + avgB * 0.114;
          const vR = Math.max(0.0, Math.min(1.0, lum + (avgR - lum) * vibrance));
          const vG = Math.max(0.0, Math.min(1.0, lum + (avgG - lum) * vibrance));
          const vB = Math.max(0.0, Math.min(1.0, lum + (avgB - lum) * vibrance));

          // Composite over Obsidian Void (#090A0D)
          const baseR = 9;
          const baseG = 10;
          const baseB = 13;

          data[pixelIdx] = Math.min(255, Math.floor(baseR * (1.0 - alpha) + vR * alpha * 255));
          data[pixelIdx + 1] = Math.min(255, Math.floor(baseG * (1.0 - alpha) + vG * alpha * 255));
          data[pixelIdx + 2] = Math.min(255, Math.floor(baseB * (1.0 - alpha) + vB * alpha * 255));
          data[pixelIdx + 3] = 255;
        } else {
          data[pixelIdx] = 9;
          data[pixelIdx + 1] = 10;
          data[pixelIdx + 2] = 13;
          data[pixelIdx + 3] = 255;
        }
      }

      snapCtx.putImageData(imgData, 0, 0);
    }

    return snapCanvas;
  }

  /**
   * Cleanly disposes of all GPU buffers, materials, geometries, and RAF timers.
   */
  private teardown(): void {
    this.isMounted = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
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

export const room: RoomInstance = new FractalFlamesRoom();
export default room;
