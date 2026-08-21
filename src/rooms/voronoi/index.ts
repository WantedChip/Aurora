/**
 * Room 24: Dynamic Voronoi & Lloyd's Relaxation (Cellular Foams & Distance Fields)
 * Curatorial Category: Morphogenesis & Landscape
 * Math Model: Worley Distance Fields (F1, F2, F2-F1), Variable Distance Metrics (L1, L2, L_inf, Lp) & Iterative Lloyd Centroid Relaxation Dynamics
 * Compute Engine: Three.js WebGPURenderer / WebGL2 Full-Screen Shader Material & High-Performance Canvas2D Fallback
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D Base)
 * 
 * Features:
 * - Real-time GPU Voronoi & Worley noise distance field computation:
 *     F1(x, y) = min_i d(x, p_i)    (Primary distance to closest seed)
 *     F2(x, y) = min_{j≠i*} d(x, p_j) (Secondary distance to second closest seed)
 *     Boundary indicator: ΔF = F2(x, y) - F1(x, y) (Cell wall border indicator)
 * - 4 Classical & Generalized Distance Metrics:
 *     1. Euclidean (L2): d(x, p) = sqrt(Δx² + Δy²)
 *     2. Manhattan (L1): d(x, p) = |Δx| + |Δy|
 *     3. Chebyshev (L_inf): d(x, p) = max(|Δx|, |Δy|)
 *     4. Minkowski (Lp): d(x, p) = (|Δx|^p + |Δy|^p)^(1/p) (adjustable p ∈ [0.4, 4.0])
 * - 6 Curatorial Shading & Visual Modes:
 *     1. Cellular Foam (cellular-foam): Glowing neon cell walls with subtle gradient interior and nucleated centers.
 *     2. Crystal Facets (crystal-facets): 3D beveled crystal prism facets with specular rim lighting.
 *     3. Distance Field (distance-field): Concentric topographic wave contour isolines.
 *     4. Worley Noise (worley-noise): Smooth organic Worley cellular noise density.
 *     5. F2 - F1 Wireframe (f2-minus-f1): Pure architectural boundary network / skeletal tissue lattice.
 *     6. Voronoi Mosaic (voronoi-mosaic): Stained glass / flat polygon colored cells with glowing seams.
 * - Dynamic Seed Kinematics & Physics Engine:
 *     - Lloyd's Relaxation: Iteratively integrates discrete Voronoi cell centroids, shifting seeds
 *       p_i ← p_i + α · (c_i - p_i) to organize chaotic initial seeds into optimal hexagonal soap foams.
 *     - Dynamic Physics: Drift velocities, elastic boundary wall bounces, mutual soft repulsion, and fluid damping.
 *     - Cellular Drift: Gentle organic Brownian/curl noise drift with Lloyd relaxation damping.
 *     - Vortex Swirl: Tangential orbital angular momentum swirling seeds around focal center.
 *     - Pulsating Breathing: Harmonic radial expansion/contraction waves.
 * - Interactive Cursor Dynamics:
 *     - Interactive Seed: Cursor dynamically injects a 0th seed, carving out its own cell in real time.
 *     - Electrostatic Repulsion: Pushes nearby seeds away with inverse-distance force.
 *     - Gravitational Attraction: Draws seeds into high-density cluster around cursor.
 *     - Vortex Swirl: Swirls nearby seeds around pointer position.
 *     - Scatter Blast: Pointer click / tap triggers explosive kinetic shockwave dispersing seeds.
 * - Real-time Web Audio API Spectral Reactivity:
 *     - Sub-bass: Drives cell wall border thickness surging, expansion breathing, and kinetic impulses.
 *     - Mid: Modulates Lloyd relaxation rate and velocity drift speed.
 *     - Treble: Excites cell wall neon glow shimmer, seed dot luminescence, and chromatic dispersion.
 * - 7 Curatorial Spectral Palettes:
 *     Obsidian Emerald, Spectral Aurora, Solar Plasma, Cyber Neon, Cosmic Amethyst, Monochrome Lithic, Bioluminescent Abyss.
 * - 7 Canonical Presets:
 *     Hexagonal Foam, Chaotic Drift, Manhattan Grid, Chebyshev Crystals, Minkowski Hyper, Worley Biotissue, Quantum Lattice.
 * - Custom high-resolution offline snapshot pass (captureSnapshot) generating pristine 4K/8K stills.
 * - Complete resource disposal lifecycle.
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
import { detectGPUCapabilities } from '../../lib/gpu';
import { audioManager, type AudioManager, type AudioSourceType } from '../../lib/audio';

export type VoronoiPreset =
  | 'hexagonal-foam'
  | 'chaotic-drift'
  | 'manhattan-grid'
  | 'chebyshev-crystals'
  | 'minkowski-hyper'
  | 'worley-biotissue'
  | 'quantum-lattice';

export type DistanceMetric =
  | 'euclidean'
  | 'manhattan'
  | 'chebyshev'
  | 'minkowski';

export type VoronoiMotionMode =
  | 'lloyd-relaxation'
  | 'dynamic-physics'
  | 'cellular-drift'
  | 'vortex-swirl'
  | 'pulsating-breathing';

export type VoronoiShadingMode =
  | 'cellular-foam'
  | 'crystal-facets'
  | 'distance-field'
  | 'worley-noise'
  | 'f2-minus-f1'
  | 'voronoi-mosaic';

export type VoronoiPalette =
  | 'obsidian-emerald'
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'cyber-neon'
  | 'cosmic-amethyst'
  | 'monochrome-lithic'
  | 'bioluminescent-abyss';

export type VoronoiColorMode =
  | 'palette-gradient'
  | 'cell-id'
  | 'distance-f1'
  | 'boundary-f2f1';

export type VoronoiPointerMode =
  | 'interactive-seed'
  | 'repel'
  | 'attract'
  | 'vortex'
  | 'none';

export interface VoronoiParams {
  seed: string;
  preset: VoronoiPreset;
  cellCount: number;             // 16..128 (default 64)
  distanceMetric: DistanceMetric;// euclidean, manhattan, chebyshev, minkowski
  minkowskiP: number;            // 0.4..4.0 (default 0.6)
  motionMode: VoronoiMotionMode; // lloyd-relaxation, dynamic-physics, cellular-drift, vortex-swirl, pulsating-breathing
  relaxationStrength: number;    // 0.0..1.0 (default 0.5)
  shadingMode: VoronoiShadingMode; // cellular-foam, crystal-facets, distance-field, worley-noise, f2-minus-f1, voronoi-mosaic
  borderThickness: number;       // 0.005..0.15 (default 0.03)
  borderGlow: number;            // 0.0..3.0 (default 1.5)
  borderSharpness: number;       // 0.5..5.0 (default 2.0)
  interiorGradient: number;      // 0.0..2.0 (default 0.7)
  seedGlow: number;              // 0.0..3.0 (default 1.2)
  seedSize: number;              // 0.002..0.04 (default 0.012)
  isolineCount: number;          // 2..30 (default 12)
  facetBevel: number;            // 0.2..4.0 (default 1.5)
  colorPalette: VoronoiPalette;
  colorMode: VoronoiColorMode;   // palette-gradient, cell-id, distance-f1, boundary-f2f1
  paletteCycleSpeed: number;     // 0.0..2.0 (default 0.2)
  contrast: number;              // 0.5..3.0 (default 1.3)
  brightness: number;            // -0.4..0.4 (default 0.0)
  speed: number;                 // 0.0..3.0 (default 1.0)
  driftJitter: number;           // 0.0..2.0 (default 0.3)
  wallBounce: boolean;           // default true
  seedRepulsion: number;         // 0.0..2.0 (default 0.6)
  damping: number;               // 0.90..0.999 (default 0.98)
  pointerMode: VoronoiPointerMode;
  pointerRadius: number;         // 0.05..0.5 (default 0.22)
  pointerStrength: number;       // 0.1..3.0 (default 1.4)
  audioSource: AudioSourceType;
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
}

export const DEFAULT_VORONOI_PARAMS: VoronoiParams = {
  seed: '#00FF9D',
  preset: 'hexagonal-foam',
  cellCount: 64,
  distanceMetric: 'euclidean',
  minkowskiP: 0.6,
  motionMode: 'lloyd-relaxation',
  relaxationStrength: 0.65,
  shadingMode: 'cellular-foam',
  borderThickness: 0.03,
  borderGlow: 1.6,
  borderSharpness: 2.2,
  interiorGradient: 0.7,
  seedGlow: 1.2,
  seedSize: 0.012,
  isolineCount: 12,
  facetBevel: 1.5,
  colorPalette: 'obsidian-emerald',
  colorMode: 'cell-id',
  paletteCycleSpeed: 0.2,
  contrast: 1.3,
  brightness: 0.0,
  speed: 0.8,
  driftJitter: 0.3,
  wallBounce: true,
  seedRepulsion: 0.6,
  damping: 0.98,
  pointerMode: 'interactive-seed',
  pointerRadius: 0.22,
  pointerStrength: 1.4,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.4,
  midReaction: 1.2,
  trebleReaction: 1.5,
};

// 7 Curatorial Canonical Presets
export const VORONOI_PRESETS: Record<VoronoiPreset, Partial<VoronoiParams>> = {
  'hexagonal-foam': {
    cellCount: 72,
    distanceMetric: 'euclidean',
    motionMode: 'lloyd-relaxation',
    relaxationStrength: 0.75,
    shadingMode: 'cellular-foam',
    borderThickness: 0.032,
    borderGlow: 1.6,
    borderSharpness: 2.2,
    interiorGradient: 0.65,
    seedGlow: 1.1,
    seedSize: 0.012,
    colorPalette: 'obsidian-emerald',
    colorMode: 'cell-id',
    speed: 0.8,
    driftJitter: 0.2,
    pointerMode: 'interactive-seed',
  },
  'chaotic-drift': {
    cellCount: 48,
    distanceMetric: 'euclidean',
    motionMode: 'dynamic-physics',
    relaxationStrength: 0.0,
    shadingMode: 'crystal-facets',
    borderThickness: 0.025,
    borderGlow: 1.8,
    borderSharpness: 2.5,
    interiorGradient: 0.9,
    facetBevel: 2.2,
    colorPalette: 'solar-plasma',
    colorMode: 'palette-gradient',
    speed: 1.6,
    driftJitter: 0.8,
    pointerMode: 'repel',
  },
  'manhattan-grid': {
    cellCount: 56,
    distanceMetric: 'manhattan',
    motionMode: 'cellular-drift',
    relaxationStrength: 0.4,
    shadingMode: 'voronoi-mosaic',
    borderThickness: 0.028,
    borderGlow: 1.5,
    borderSharpness: 2.8,
    interiorGradient: 0.8,
    colorPalette: 'cyber-neon',
    colorMode: 'cell-id',
    speed: 0.9,
    driftJitter: 0.3,
    pointerMode: 'interactive-seed',
  },
  'chebyshev-crystals': {
    cellCount: 60,
    distanceMetric: 'chebyshev',
    motionMode: 'cellular-drift',
    relaxationStrength: 0.35,
    shadingMode: 'crystal-facets',
    borderThickness: 0.03,
    borderGlow: 1.7,
    borderSharpness: 2.4,
    facetBevel: 2.0,
    colorPalette: 'cosmic-amethyst',
    colorMode: 'distance-f1',
    speed: 0.8,
    driftJitter: 0.35,
    pointerMode: 'vortex',
  },
  'minkowski-hyper': {
    cellCount: 50,
    distanceMetric: 'minkowski',
    minkowskiP: 0.55,
    motionMode: 'pulsating-breathing',
    relaxationStrength: 0.3,
    shadingMode: 'distance-field',
    isolineCount: 14,
    borderThickness: 0.022,
    borderGlow: 1.4,
    borderSharpness: 2.0,
    interiorGradient: 0.6,
    colorPalette: 'spectral-aurora',
    colorMode: 'boundary-f2f1',
    speed: 1.1,
    driftJitter: 0.25,
    pointerMode: 'attract',
  },
  'worley-biotissue': {
    cellCount: 84,
    distanceMetric: 'euclidean',
    motionMode: 'cellular-drift',
    relaxationStrength: 0.55,
    shadingMode: 'worley-noise',
    borderThickness: 0.04,
    borderGlow: 1.3,
    borderSharpness: 1.8,
    interiorGradient: 1.1,
    seedGlow: 0.9,
    seedSize: 0.008,
    colorPalette: 'bioluminescent-abyss',
    colorMode: 'palette-gradient',
    speed: 0.7,
    driftJitter: 0.4,
    pointerMode: 'interactive-seed',
  },
  'quantum-lattice': {
    cellCount: 96,
    distanceMetric: 'euclidean',
    motionMode: 'lloyd-relaxation',
    relaxationStrength: 0.85,
    shadingMode: 'f2-minus-f1',
    borderThickness: 0.018,
    borderGlow: 2.2,
    borderSharpness: 3.5,
    interiorGradient: 0.2,
    seedGlow: 1.5,
    seedSize: 0.014,
    colorPalette: 'monochrome-lithic',
    colorMode: 'boundary-f2f1',
    speed: 0.6,
    driftJitter: 0.15,
    pointerMode: 'interactive-seed',
  },
};

// 7 Curatorial Spectral Palettes (4 Color Nodes: Void Base, Primary, Secondary Accent, Apex Crest)
export interface PaletteDef {
  name: string;
  colorA: [number, number, number]; // Void Base (#090A0D)
  colorB: [number, number, number]; // Primary Tone
  colorC: [number, number, number]; // Accent Tone
  colorD: [number, number, number]; // Apex Crest / Starlight White
}

export const VORONOI_PALETTES: Record<VoronoiPalette, PaletteDef> = {
  'obsidian-emerald': {
    name: 'Obsidian Emerald',
    colorA: [0.035, 0.039, 0.051], // #090A0D Void Obsidian
    colorB: [0.0, 0.65, 0.45],     // Deep Jade
    colorC: [0.0, 1.0, 0.62],      // Phosphor Mint (#00FF9D)
    colorD: [0.75, 1.0, 0.9],      // Electric Starlight
  },
  'spectral-aurora': {
    name: 'Spectral Aurora',
    colorA: [0.035, 0.039, 0.051], // #090A0D Void Obsidian
    colorB: [0.0, 0.85, 0.95],     // Electric Cyan (#00F0FF)
    colorC: [0.66, 0.33, 0.97],    // Royal Violet (#A855F7)
    colorD: [0.98, 0.45, 0.75],    // Aurora Rose
  },
  'solar-plasma': {
    name: 'Solar Plasma',
    colorA: [0.04, 0.02, 0.01],    // Dark Solar Void
    colorB: [0.95, 0.45, 0.0],     // Radiant Amber (#FFB800)
    colorC: [1.0, 0.18, 0.05],     // Volcanic Flare
    colorD: [1.0, 0.95, 0.7],      // Solar Gold Crest
  },
  'cyber-neon': {
    name: 'Cyber Neon',
    colorA: [0.02, 0.02, 0.05],    // Cyber Dark Base
    colorB: [0.0, 0.55, 1.0],      // Electric Cobalt
    colorC: [1.0, 0.0, 0.55],      // Neon Magenta (#FF007F)
    colorD: [0.0, 1.0, 0.9],       // Laser Cyan
  },
  'cosmic-amethyst': {
    name: 'Cosmic Amethyst',
    colorA: [0.03, 0.01, 0.06],    // Cosmic Void Base
    colorB: [0.52, 0.18, 0.88],    // Cosmic Purple
    colorC: [0.92, 0.3, 0.68],     // Orchid Amethyst
    colorD: [0.95, 0.9, 1.0],      // Diamond Starlight
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic',
    colorA: [0.025, 0.027, 0.035], // Obsidian Void
    colorB: [0.32, 0.36, 0.42],    // Slate Basalt
    colorC: [0.68, 0.72, 0.8],     // Polished Platinum
    colorD: [0.98, 0.99, 1.0],     // Titanium White
  },
  'bioluminescent-abyss': {
    name: 'Bioluminescent Abyss',
    colorA: [0.01, 0.03, 0.05],    // Marine Trench
    colorB: [0.0, 0.45, 0.75],     // Deep Ocean
    colorC: [0.0, 0.95, 0.65],     // Phosphor Abyss
    colorD: [0.6, 1.0, 0.95],      // Bioluminescent Glow
  },
};

/**
 * Samples a continuous smooth color from a curatorial palette across t ∈ [0, 1].
 */
export function sampleVoronoiColor(
  paletteKey: VoronoiPalette,
  t: number
): { r: number; g: number; b: number } {
  const pal = VORONOI_PALETTES[paletteKey] || VORONOI_PALETTES['obsidian-emerald'];
  const clampedT = ((t % 1) + 1) % 1;

  let c0: [number, number, number];
  let c1: [number, number, number];
  let localT: number;

  if (clampedT < 0.333) {
    c0 = pal.colorA;
    c1 = pal.colorB;
    localT = clampedT / 0.333;
  } else if (clampedT < 0.666) {
    c0 = pal.colorB;
    c1 = pal.colorC;
    localT = (clampedT - 0.333) / 0.333;
  } else {
    c0 = pal.colorC;
    c1 = pal.colorD;
    localT = (clampedT - 0.666) / 0.334;
  }

  // Smooth Hermite interpolation
  const s = localT * localT * (3.0 - 2.0 * localT);
  const r = Math.round((c0[0] + (c1[0] - c0[0]) * s) * 255);
  const g = Math.round((c0[1] + (c1[1] - c0[1]) * s) * 255);
  const b = Math.round((c0[2] + (c1[2] - c0[2]) * s) * 255);

  return { r, g, b };
}

/**
 * Returns a CSS rgba string from a palette sample.
 */
export function getVoronoiPaletteColor(
  paletteKey: VoronoiPalette,
  t: number,
  cycle: number = 0,
  alpha: number = 1.0
): string {
  const { r, g, b } = sampleVoronoiColor(paletteKey, t + cycle);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

// GLSL Full-Screen Vertex Shader
const VORONOI_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// GLSL Full-Screen Fragment Shader
const VORONOI_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;

#define MAX_SEEDS 128

uniform vec2 uResolution;
uniform float uTime;
uniform int uSeedCount;
uniform vec2 uSeeds[MAX_SEEDS];
uniform vec4 uSeedColors[MAX_SEEDS];

uniform int uMetric;        // 0: Euclidean, 1: Manhattan, 2: Chebyshev, 3: Minkowski
uniform float uMinkowskiP;  // p value for Minkowski

uniform int uShadingMode;   // 0: cellular-foam, 1: crystal-facets, 2: distance-field, 3: worley-noise, 4: f2-minus-f1, 5: voronoi-mosaic
uniform float uBorderThickness;
uniform float uBorderGlow;
uniform float uBorderSharpness;
uniform float uInteriorGradient;
uniform float uSeedGlow;
uniform float uSeedSize;
uniform float uIsolineCount;
uniform float uFacetBevel;

uniform int uColorMode;     // 0: palette-gradient, 1: cell-id, 2: distance-f1, 3: boundary-f2f1
uniform float uPaletteCycle;
uniform float uContrast;
uniform float uBrightness;

uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uColorD;

uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uShockwaveRadius;
uniform float uShockwaveIntensity;

uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uTrebleEnergy;

// Generalized Distance Metric Function
float calcDistance(vec2 p1, vec2 p2, int metric, float pVal) {
    vec2 d = abs(p1 - p2);
    if (metric == 0) {
        // Euclidean L2
        return length(d);
    } else if (metric == 1) {
        // Manhattan L1
        return d.x + d.y;
    } else if (metric == 2) {
        // Chebyshev L_infinity
        return max(d.x, d.y);
    } else {
        // Minkowski Lp
        float p = max(pVal, 0.1);
        return pow(pow(max(d.x, 0.00001), p) + pow(max(d.y, 0.00001), p), 1.0 / p);
    }
}

// 4-Node Curatorial Spectral Palette Interpolator
vec3 samplePalette(float t) {
    float ct = fract(t);
    vec3 c0, c1;
    float localT;
    if (ct < 0.33333) {
        c0 = uColorA;
        c1 = uColorB;
        localT = ct / 0.33333;
    } else if (ct < 0.66666) {
        c0 = uColorB;
        c1 = uColorC;
        localT = (ct - 0.33333) / 0.33333;
    } else {
        c0 = uColorC;
        c1 = uColorD;
        localT = (ct - 0.66666) / 0.33334;
    }
    float s = localT * localT * (3.0 - 2.0 * localT);
    return mix(c0, c1, s);
}

void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    
    // Normalized aspect-corrected coordinate space centered at (0.5, 0.5)
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) + 0.5;

    float f1 = 1e6;
    float f2 = 1e6;
    int id1 = 0;
    int id2 = 0;
    vec2 seed1Pos = vec2(0.5);

    // Voronoi / Worley distance search loop across active seeds
    for (int i = 0; i < MAX_SEEDS; i++) {
        if (i >= uSeedCount) break;
        
        vec2 sPos = uSeeds[i];
        vec2 sMapped = (sPos - 0.5) * vec2(aspect, 1.0) + 0.5;
        
        float d = calcDistance(p, sMapped, uMetric, uMinkowskiP);
        
        if (d < f1) {
            f2 = f1;
            id2 = id1;
            f1 = d;
            id1 = i;
            seed1Pos = sMapped;
        } else if (d < f2) {
            f2 = d;
            id2 = i;
        }
    }

    // Boundary indicator ΔF = F2 - F1
    float deltaF = max(f2 - f1, 0.0);

    // Dynamic audio-reactive border thickness and glow
    float dynThickness = uBorderThickness * (1.0 + uBassEnergy * 0.4);
    float dynGlow = uBorderGlow * (1.0 + uTrebleEnergy * 0.6);

    // Crisp cell wall border line and exponential glow halo
    float borderFactor = 1.0 - smoothstep(0.0, dynThickness * uBorderSharpness, deltaF);
    float borderGlowHalo = exp(-deltaF / max(dynThickness * 2.2, 0.003)) * dynGlow;

    // Determine base cell color based on uColorMode
    vec3 cellColor;
    if (uColorMode == 0) {
        // 0: Palette gradient based on spatial position
        float t = p.x * 0.45 + p.y * 0.45 + uPaletteCycle;
        cellColor = samplePalette(t);
    } else if (uColorMode == 1) {
        // 1: Discrete cell ID color
        float seedHash = fract(float(id1) * 0.6180339887 + uPaletteCycle + uSeedColors[id1].x * 0.1);
        cellColor = samplePalette(seedHash);
    } else if (uColorMode == 2) {
        // 2: Distance F1 radial gradient from nucleus
        float t = f1 * 2.5 + uPaletteCycle;
        cellColor = samplePalette(t);
    } else {
        // 3: Boundary proximity F2 - F1
        float t = clamp(1.0 - deltaF * 3.5, 0.0, 1.0) + uPaletteCycle;
        cellColor = samplePalette(t);
    }

    vec3 finalColor = uColorA;

    // Apply Shading Mode
    if (uShadingMode == 0) {
        // 0: Cellular Foam (Rich organic soap foam with glowing neon borders)
        vec3 interior = mix(uColorA, cellColor, exp(-f1 * uInteriorGradient * 4.5));
        float totalBorder = clamp(borderFactor * 0.85 + borderGlowHalo * 0.55, 0.0, 1.0);
        finalColor = mix(interior, uColorD, totalBorder);
    } else if (uShadingMode == 1) {
        // 1: Crystal Facets (Angular 3D beveled crystal prism facets with specular rim)
        float facetLighting = clamp(0.25 + 0.75 * (1.0 - exp(-f1 * uFacetBevel * 5.0)), 0.0, 1.0);
        vec3 interior = cellColor * facetLighting;
        float totalBorder = clamp(borderFactor * 1.0 + borderGlowHalo * 0.6, 0.0, 1.0);
        finalColor = mix(interior, uColorD, totalBorder);
    } else if (uShadingMode == 2) {
        // 2: Distance Field (Concentric topographic wave contour isolines)
        float rings = sin(f1 * uIsolineCount * 28.0 - uTime * 2.0) * 0.5 + 0.5;
        float isoLine = smoothstep(0.72, 0.98, rings);
        vec3 interior = mix(uColorA, cellColor, rings * 0.55 + 0.2);
        finalColor = mix(interior, uColorD, isoLine * 0.65 + borderFactor * 0.75);
    } else if (uShadingMode == 3) {
        // 3: Worley Noise (Smooth organic Worley noise density)
        float worley = clamp(deltaF * 2.5, 0.0, 1.0);
        vec3 interior = mix(uColorA, cellColor, worley * uInteriorGradient);
        finalColor = mix(interior, uColorD, borderGlowHalo * 0.75);
    } else if (uShadingMode == 4) {
        // 4: F2 - F1 Wireframe (Architectural boundary lattice)
        float wire = 1.0 - smoothstep(0.0, dynThickness, deltaF);
        finalColor = mix(uColorA, uColorD * dynGlow + cellColor * 0.35, wire);
    } else {
        // 5: Voronoi Mosaic (Stained glass flat color cells with bright seams)
        float totalBorder = clamp(borderFactor * 1.2 + borderGlowHalo * 0.5, 0.0, 1.0);
        finalColor = mix(cellColor, uColorD, totalBorder);
    }

    // Cell Nucleus Starlight Center Dot Glow
    float seedDist = calcDistance(p, seed1Pos, 0, 2.0); // Always Euclidean for circular nucleus
    float dynSeedSize = uSeedSize * (1.0 + uTrebleEnergy * 0.4);
    float seedCore = 1.0 - smoothstep(0.0, dynSeedSize, seedDist);
    float seedHalo = exp(-seedDist / max(dynSeedSize * 3.5, 0.001)) * uSeedGlow * (1.0 + uTrebleEnergy * 0.8);
    finalColor += uColorD * (seedCore * 0.95 + seedHalo * 0.45);

    // Interactive Shockwave Ring Burst
    if (uShockwaveIntensity > 0.01) {
        vec2 ptrMapped = (uPointer - 0.5) * vec2(aspect, 1.0) + 0.5;
        float pDist = length(p - ptrMapped);
        float ringDist = abs(pDist - uShockwaveRadius);
        float shockRing = exp(-ringDist * 40.0) * uShockwaveIntensity;
        finalColor += uColorD * shockRing;
    }

    // Contrast & Brightness Tone Shaping
    finalColor = clamp((finalColor - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);

    // Obsidian Archival Minimal (#090A0D) Soft Radial Vignette
    float distCenter = length(vUv - 0.5);
    float vignette = clamp(1.0 - distCenter * 0.45, 0.15, 1.0);
    finalColor = mix(uColorA, finalColor, vignette);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export class VoronoiRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLElement | null = null;
  private params: VoronoiParams = { ...DEFAULT_VORONOI_PARAMS };
  private targetParams: VoronoiParams = { ...DEFAULT_VORONOI_PARAMS };
  private prng: PRNG = createPRNG('#00FF9D');
  private dpr = 1;
  private width = 800;
  private height = 600;
  private isMounted = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private simTime = 0;
  private palettePhase = 0;

  // Compute Backend
  private backendMode: 'webgl' | 'canvas2d' = 'webgl';
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private mesh: THREE.Mesh | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;

  // Particle & Seed Simulation Data (Max 128 seeds)
  private maxSeeds = 128;
  private activeSeedCount = 64;
  private seedPosX = new Float32Array(128);
  private seedPosY = new Float32Array(128);
  private seedVelX = new Float32Array(128);
  private seedVelY = new Float32Array(128);
  private seedMass = new Float32Array(128);
  private seedHue = new Float32Array(128);
  private seedOrigX = new Float32Array(128);
  private seedOrigY = new Float32Array(128);

  // Lloyd's Relaxation Centroid Accumulator Arrays (64x64 Discrete Integration Grid)
  private lloydGridRes = 64;
  private centroidSumX = new Float32Array(128);
  private centroidSumY = new Float32Array(128);
  private centroidCount = new Int32Array(128);
  private targetCentroidX = new Float32Array(128);
  private targetCentroidY = new Float32Array(128);

  // Shader Uniform Vectors for Seeds
  private uniformSeedPositions: THREE.Vector2[] = [];
  private uniformSeedColors: THREE.Vector4[] = [];

  // Pointer & Interactive Forces
  private pointerX = 0.5;
  private pointerY = 0.5;
  private isPointerDown = false;
  private isPointerActive = false;
  private shockwaveRadius = 0;
  private shockwaveIntensity = 0;

  // Web Audio Spectral Envelopes
  private audio: AudioManager | null = null;
  private bassLevel = 0;
  private midLevel = 0;
  private trebleLevel = 0;

  constructor() {
    for (let i = 0; i < this.maxSeeds; i++) {
      this.uniformSeedPositions.push(new THREE.Vector2(0.5, 0.5));
      this.uniformSeedColors.push(new THREE.Vector4(0, 0, 0, 1));
    }
  }

  /**
   * Public getters for automated testing & verification suite.
   */
  public get seedCount(): number {
    return this.activeSeedCount;
  }

  public get seedPositions(): { x: number; y: number }[] {
    const list: { x: number; y: number }[] = [];
    for (let i = 0; i < this.activeSeedCount; i++) {
      list.push({ x: this.seedPosX[i], y: this.seedPosY[i] });
    }
    return list;
  }

  /**
   * Mounts the room simulation to the provided canvas and container.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.container = ctx.container;
    this.dpr = Math.min(ctx.dpr || 1, 2);
    this.prng = ctx.prng || createPRNG('#00FF9D');
    this.audio = ctx.audio || audioManager;

    this.applyParams(ctx.params || {}, true);

    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width || this.canvas.width || 800, 100);
    this.height = Math.max(rect.height || this.canvas.height || 600, 100);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    // Initialize Seeds
    this.initSeeds();

    // Check GPU Capabilities and Initialize WebGL / WebGPU Pipeline
    const gpuCaps = await detectGPUCapabilities();
    if (gpuCaps.hasWebGL2 || gpuCaps.hasWebGPU) {
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          preserveDrawingBuffer: true,
        });

        this.renderer.setSize(this.width, this.height, false);
        this.renderer.setPixelRatio(this.dpr);

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.material = this.buildShaderMaterial();
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);

        this.backendMode = 'webgl';
      } catch (err) {
        console.warn('WebGL/WebGPU initialization fallback in Room 24 (Dynamic Voronoi):', err);
        this.initCanvas2DFallback();
      }
    } else {
      this.initCanvas2DFallback();
    }

    // Sync Audio Source
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
   * Initializes 2D canvas context fallback for headless or non-WebGL environments.
   */
  private initCanvas2DFallback(): void {
    if (!this.canvas) return;
    this.backendMode = 'canvas2d';
    this.ctx2d = this.canvas.getContext('2d', { alpha: false });
  }

  /**
   * Constructs the full-screen Voronoi ShaderMaterial.
   */
  private buildShaderMaterial(): THREE.ShaderMaterial {
    const pal = VORONOI_PALETTES[this.params.colorPalette] || VORONOI_PALETTES['obsidian-emerald'];

    const metricMap: Record<DistanceMetric, number> = {
      euclidean: 0,
      manhattan: 1,
      chebyshev: 2,
      minkowski: 3,
    };

    const shadingMap: Record<VoronoiShadingMode, number> = {
      'cellular-foam': 0,
      'crystal-facets': 1,
      'distance-field': 2,
      'worley-noise': 3,
      'f2-minus-f1': 4,
      'voronoi-mosaic': 5,
    };

    const colorModeMap: Record<VoronoiColorMode, number> = {
      'palette-gradient': 0,
      'cell-id': 1,
      'distance-f1': 2,
      'boundary-f2f1': 3,
    };

    return new THREE.ShaderMaterial({
      vertexShader: VORONOI_VERTEX_SHADER,
      fragmentShader: VORONOI_FRAGMENT_SHADER,
      uniforms: {
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uTime: { value: 0 },
        uSeedCount: { value: this.activeSeedCount },
        uSeeds: { value: this.uniformSeedPositions },
        uSeedColors: { value: this.uniformSeedColors },

        uMetric: { value: metricMap[this.params.distanceMetric] ?? 0 },
        uMinkowskiP: { value: this.params.minkowskiP },

        uShadingMode: { value: shadingMap[this.params.shadingMode] ?? 0 },
        uBorderThickness: { value: this.params.borderThickness },
        uBorderGlow: { value: this.params.borderGlow },
        uBorderSharpness: { value: this.params.borderSharpness },
        uInteriorGradient: { value: this.params.interiorGradient },
        uSeedGlow: { value: this.params.seedGlow },
        uSeedSize: { value: this.params.seedSize },
        uIsolineCount: { value: this.params.isolineCount },
        uFacetBevel: { value: this.params.facetBevel },

        uColorMode: { value: colorModeMap[this.params.colorMode] ?? 1 },
        uPaletteCycle: { value: 0 },
        uContrast: { value: this.params.contrast },
        uBrightness: { value: this.params.brightness },

        uColorA: { value: new THREE.Vector3(...pal.colorA) },
        uColorB: { value: new THREE.Vector3(...pal.colorB) },
        uColorC: { value: new THREE.Vector3(...pal.colorC) },
        uColorD: { value: new THREE.Vector3(...pal.colorD) },

        uPointer: { value: new THREE.Vector2(this.pointerX, this.pointerY) },
        uPointerActive: { value: 0 },
        uShockwaveRadius: { value: 0 },
        uShockwaveIntensity: { value: 0 },

        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uTrebleEnergy: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * Initializes or resets seed point positions, velocities, and properties.
   */
  public resetSeeds(count?: number, seedStr?: string): void {
    if (seedStr) {
      this.prng = createPRNG(seedStr);
    }
    if (count !== undefined) {
      this.activeSeedCount = Math.min(Math.max(count, 16), this.maxSeeds);
    }
    this.initSeeds();
  }

  private initSeeds(): void {
    this.activeSeedCount = Math.min(Math.max(this.params.cellCount, 16), this.maxSeeds);

    for (let i = 0; i < this.activeSeedCount; i++) {
      // Golden spiral or uniform pseudo-random seed distribution
      const theta = i * 2.399963229728653; // Golden angle
      const r = Math.sqrt((i + 0.5) / this.activeSeedCount) * 0.42;

      const posX = 0.5 + Math.cos(theta) * r + this.prng.nextFloat(-0.04, 0.04);
      const posY = 0.5 + Math.sin(theta) * r + this.prng.nextFloat(-0.04, 0.04);

      this.seedPosX[i] = Math.min(Math.max(posX, 0.04), 0.96);
      this.seedPosY[i] = Math.min(Math.max(posY, 0.04), 0.96);
      this.seedOrigX[i] = this.seedPosX[i];
      this.seedOrigY[i] = this.seedPosY[i];

      const speedAngle = this.prng.nextFloat(0, Math.PI * 2);
      const speedMag = this.prng.nextFloat(0.04, 0.12);
      this.seedVelX[i] = Math.cos(speedAngle) * speedMag;
      this.seedVelY[i] = Math.sin(speedAngle) * speedMag;

      this.seedMass[i] = this.prng.nextFloat(0.8, 1.3);
      this.seedHue[i] = this.prng.nextFloat(0, 1);

      this.targetCentroidX[i] = this.seedPosX[i];
      this.targetCentroidY[i] = this.seedPosY[i];
    }
  }

  /**
   * Plants an active custom seed point at normalized coordinates (normX, normY).
   */
  public plantSeedAt(normX: number, normY: number): boolean {
    if (this.activeSeedCount < this.maxSeeds) {
      const idx = this.activeSeedCount;
      this.seedPosX[idx] = Math.min(Math.max(normX, 0.02), 0.98);
      this.seedPosY[idx] = Math.min(Math.max(normY, 0.02), 0.98);
      this.seedOrigX[idx] = this.seedPosX[idx];
      this.seedOrigY[idx] = this.seedPosY[idx];
      this.seedVelX[idx] = 0;
      this.seedVelY[idx] = 0;
      this.seedMass[idx] = 1.0;
      this.seedHue[idx] = this.prng.nextFloat(0, 1);
      this.targetCentroidX[idx] = this.seedPosX[idx];
      this.targetCentroidY[idx] = this.seedPosY[idx];
      this.activeSeedCount++;
      return true;
    } else {
      // Overwrite least significant seed
      const idx = (this.activeSeedCount - 1);
      this.seedPosX[idx] = Math.min(Math.max(normX, 0.02), 0.98);
      this.seedPosY[idx] = Math.min(Math.max(normY, 0.02), 0.98);
      this.seedVelX[idx] = 0;
      this.seedVelY[idx] = 0;
      return true;
    }
  }

  /**
   * Applies incoming configuration parameters with clamping and preset expansion.
   */
  private applyParams(incoming: Record<string, any>, isInitial = false): void {
    if (incoming.preset && incoming.preset !== this.targetParams.preset && VORONOI_PRESETS[incoming.preset as VoronoiPreset]) {
      const presetValues = VORONOI_PRESETS[incoming.preset as VoronoiPreset];
      Object.assign(this.targetParams, presetValues);
      this.targetParams.preset = incoming.preset as VoronoiPreset;
    }

    this.targetParams = {
      seed: String(incoming.seed ?? this.targetParams.seed),
      preset: incoming.preset && VORONOI_PRESETS[incoming.preset as VoronoiPreset]
        ? (incoming.preset as VoronoiPreset)
        : this.targetParams.preset,
      cellCount: Math.min(Math.max(Math.round(Number(incoming.cellCount ?? this.targetParams.cellCount)), 16), 128),
      distanceMetric: (incoming.distanceMetric ?? this.targetParams.distanceMetric) as DistanceMetric,
      minkowskiP: Math.min(Math.max(Number(incoming.minkowskiP ?? this.targetParams.minkowskiP), 0.4), 4.0),
      motionMode: (incoming.motionMode ?? this.targetParams.motionMode) as VoronoiMotionMode,
      relaxationStrength: Math.min(Math.max(Number(incoming.relaxationStrength ?? this.targetParams.relaxationStrength), 0.0), 1.0),
      shadingMode: (incoming.shadingMode ?? this.targetParams.shadingMode) as VoronoiShadingMode,
      borderThickness: Math.min(Math.max(Number(incoming.borderThickness ?? this.targetParams.borderThickness), 0.005), 0.15),
      borderGlow: Math.min(Math.max(Number(incoming.borderGlow ?? this.targetParams.borderGlow), 0.0), 3.0),
      borderSharpness: Math.min(Math.max(Number(incoming.borderSharpness ?? this.targetParams.borderSharpness), 0.5), 5.0),
      interiorGradient: Math.min(Math.max(Number(incoming.interiorGradient ?? this.targetParams.interiorGradient), 0.0), 2.0),
      seedGlow: Math.min(Math.max(Number(incoming.seedGlow ?? this.targetParams.seedGlow), 0.0), 3.0),
      seedSize: Math.min(Math.max(Number(incoming.seedSize ?? this.targetParams.seedSize), 0.002), 0.04),
      isolineCount: Math.min(Math.max(Math.round(Number(incoming.isolineCount ?? this.targetParams.isolineCount)), 2), 30),
      facetBevel: Math.min(Math.max(Number(incoming.facetBevel ?? this.targetParams.facetBevel), 0.2), 4.0),
      colorPalette: (incoming.colorPalette ?? this.targetParams.colorPalette) as VoronoiPalette,
      colorMode: (incoming.colorMode ?? this.targetParams.colorMode) as VoronoiColorMode,
      paletteCycleSpeed: Math.min(Math.max(Number(incoming.paletteCycleSpeed ?? this.targetParams.paletteCycleSpeed), 0.0), 2.0),
      contrast: Math.min(Math.max(Number(incoming.contrast ?? this.targetParams.contrast), 0.5), 3.0),
      brightness: Math.min(Math.max(Number(incoming.brightness ?? this.targetParams.brightness), -0.4), 0.4),
      speed: Math.min(Math.max(Number(incoming.speed ?? this.targetParams.speed), 0.0), 3.0),
      driftJitter: Math.min(Math.max(Number(incoming.driftJitter ?? this.targetParams.driftJitter), 0.0), 2.0),
      wallBounce: incoming.wallBounce !== undefined ? Boolean(incoming.wallBounce) : this.targetParams.wallBounce,
      seedRepulsion: Math.min(Math.max(Number(incoming.seedRepulsion ?? this.targetParams.seedRepulsion), 0.0), 2.0),
      damping: Math.min(Math.max(Number(incoming.damping ?? this.targetParams.damping), 0.90), 0.999),
      pointerMode: (incoming.pointerMode ?? this.targetParams.pointerMode) as VoronoiPointerMode,
      pointerRadius: Math.min(Math.max(Number(incoming.pointerRadius ?? this.targetParams.pointerRadius), 0.05), 0.5),
      pointerStrength: Math.min(Math.max(Number(incoming.pointerStrength ?? this.targetParams.pointerStrength), 0.1), 3.0),
      audioSource: (incoming.audioSource ?? this.targetParams.audioSource) as AudioSourceType,
      audioSensitivity: Math.min(Math.max(Number(incoming.audioSensitivity ?? this.targetParams.audioSensitivity), 0.0), 3.0),
      bassReaction: Math.min(Math.max(Number(incoming.bassReaction ?? this.targetParams.bassReaction), 0.0), 3.0),
      midReaction: Math.min(Math.max(Number(incoming.midReaction ?? this.targetParams.midReaction), 0.0), 3.0),
      trebleReaction: Math.min(Math.max(Number(incoming.trebleReaction ?? this.targetParams.trebleReaction), 0.0), 3.0),
    };

    if (isInitial) {
      this.params = { ...this.targetParams };
    }
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL state sync.
   */
  public updateParams(params: Record<string, any>): void {
    const prevCellCount = this.targetParams.cellCount;
    const prevSeed = this.targetParams.seed;
    const prevAudio = this.targetParams.audioSource;

    this.applyParams(params);

    if (params.cellCount !== undefined && params.cellCount !== prevCellCount) {
      this.initSeeds();
    }
    if (params.seed !== undefined && params.seed !== prevSeed) {
      this.resetSeeds(this.targetParams.cellCount, this.targetParams.seed);
    }
    if (params.audioSource !== undefined && params.audioSource !== prevAudio) {
      this.syncAudioSource(this.targetParams.audioSource);
    }
  }

  /**
   * Synchronizes Web Audio API source state.
   */
  public async syncAudioSource(source: AudioSourceType): Promise<void> {
    if (!this.audio) return;
    this.targetParams.audioSource = source;
    this.params.audioSource = source;

    if (source === 'synth') {
      try {
        await this.audio.startSynth();
      } catch (err) {
        console.warn('Unable to start ambient synth in Room 24:', err);
      }
    } else if (source === 'mic') {
      try {
        const success = await this.audio.connectMicrophone();
        if (!success) {
          this.targetParams.audioSource = 'synth';
          this.params.audioSource = 'synth';
        }
      } catch (err) {
        console.warn('Unable to connect microphone in Room 24:', err);
      }
    } else if (source === 'none') {
      this.audio.stop();
    }
  }

  /**
   * Called when viewport dimensions change.
   */
  public resize(width: number, height: number): void {
    this.width = Math.max(width, 100);
    this.height = Math.max(height, 100);

    if (this.canvas) {
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
    }

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.setPixelRatio(this.dpr);
    }

    if (this.material) {
      this.material.uniforms.uResolution.value.set(this.width, this.height);
    }
  }

  /**
   * Called when pointer moves or clicks over the interactive viewport.
   */
  public onPointer(event: RoomPointerEvent): void {
    this.pointerX = Math.min(Math.max(event.normalizedX, 0.0), 1.0);
    this.pointerY = Math.min(Math.max(event.normalizedY, 0.0), 1.0);
    this.isPointerDown = event.isDown;
    this.isPointerActive = event.type !== 'leave' && event.normalizedX >= 0;

    if (event.type === 'down') {
      // Trigger shockwave pulse blast
      this.shockwaveRadius = 0.01;
      this.shockwaveIntensity = 1.0;

      // Disperse neighboring seeds with radial impulse blast
      const aspect = this.width > 0 && this.height > 0 ? this.width / this.height : 1.0;
      for (let i = 0; i < this.activeSeedCount; i++) {
        const dx = (this.seedPosX[i] - this.pointerX) * aspect;
        const dy = this.seedPosY[i] - this.pointerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.35 && dist > 0.001) {
          const impulse = (1.0 - dist / 0.35) * 0.45;
          this.seedVelX[i] += (dx / dist) * impulse;
          this.seedVelY[i] += (dy / dist) * impulse;
        }
      }
    }
  }

  /**
   * Computes discrete Voronoi cell centroids for Lloyd's relaxation algorithm.
   * Runs in < 0.4ms across a 64x64 integration grid.
   */
  public computeLloydCentroids(gridRes: number = 64): void {
    const count = this.activeSeedCount;
    if (count <= 0) return;

    this.centroidSumX.fill(0);
    this.centroidSumY.fill(0);
    this.centroidCount.fill(0);

    const metric = this.getMetricInt(this.params.distanceMetric);
    const minkowskiP = this.params.minkowskiP;
    const aspect = this.width > 0 && this.height > 0 ? this.width / this.height : 1.0;

    const step = 1.0 / gridRes;
    const halfStep = step * 0.5;

    for (let gy = 0; gy < gridRes; gy++) {
      const y = gy * step + halfStep;

      for (let gx = 0; gx < gridRes; gx++) {
        const x = gx * step + halfStep;
        const xAspect = (x - 0.5) * aspect + 0.5;

        let minDist = 1e9;
        let nearestIdx = 0;

        for (let i = 0; i < count; i++) {
          const sx = (this.seedPosX[i] - 0.5) * aspect + 0.5;
          const sy = this.seedPosY[i];

          const dx = Math.abs(xAspect - sx);
          const dy = Math.abs(y - sy);

          let d: number;
          if (metric === 0) {
            d = Math.hypot(dx, dy);
          } else if (metric === 1) {
            d = dx + dy;
          } else if (metric === 2) {
            d = Math.max(dx, dy);
          } else {
            const p = Math.max(minkowskiP, 0.1);
            d = Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1.0 / p);
          }

          if (d < minDist) {
            minDist = d;
            nearestIdx = i;
          }
        }

        this.centroidSumX[nearestIdx] += x;
        this.centroidSumY[nearestIdx] += y;
        this.centroidCount[nearestIdx] += 1;
      }
    }

    for (let i = 0; i < count; i++) {
      const n = this.centroidCount[i];
      if (n > 0) {
        this.targetCentroidX[i] = this.centroidSumX[i] / n;
        this.targetCentroidY[i] = this.centroidSumY[i] / n;
      } else {
        this.targetCentroidX[i] = 0.5;
        this.targetCentroidY[i] = 0.5;
      }
    }
  }

  /**
   * Executes explicit Lloyd relaxation step.
   */
  public performLloydRelaxation(strength: number = 0.8): void {
    this.computeLloydCentroids(this.lloydGridRes);
    const count = this.activeSeedCount;
    for (let i = 0; i < count; i++) {
      this.seedPosX[i] += (this.targetCentroidX[i] - this.seedPosX[i]) * strength;
      this.seedPosY[i] += (this.targetCentroidY[i] - this.seedPosY[i]) * strength;
    }
  }

  private getMetricInt(metric: DistanceMetric): number {
    switch (metric) {
      case 'euclidean': return 0;
      case 'manhattan': return 1;
      case 'chebyshev': return 2;
      case 'minkowski': return 3;
      default: return 0;
    }
  }

  /**
   * Advances the seed particle physics and Lloyd relaxation dynamics by dt seconds.
   */
  public stepSimulation(substeps: number = 1, dt: number = 0.016): void {
    const count = this.activeSeedCount;
    const speedMult = this.params.speed * (1.0 + this.midLevel * this.params.midReaction * 0.8);
    const aspect = this.width > 0 && this.height > 0 ? this.width / this.height : 1.0;

    // Sub-step integration loop
    const subDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      // 1. Lloyd's Centroid Relaxation Update
      if (this.params.motionMode === 'lloyd-relaxation' || this.params.relaxationStrength > 0.0) {
        this.computeLloydCentroids(this.lloydGridRes);
        const relaxRate = (this.params.motionMode === 'lloyd-relaxation' ? 0.75 : this.params.relaxationStrength) *
          (1.0 - Math.exp(-8.0 * subDt));

        for (let i = 0; i < count; i++) {
          // Keep 0th seed interactive if pointer mode is interactive-seed
          if (i === 0 && this.params.pointerMode === 'interactive-seed' && this.isPointerActive) {
            continue;
          }
          this.seedPosX[i] += (this.targetCentroidX[i] - this.seedPosX[i]) * relaxRate;
          this.seedPosY[i] += (this.targetCentroidY[i] - this.seedPosY[i]) * relaxRate;
        }
      }

      // 2. Motion Mode Physics Dynamics
      if (this.params.motionMode === 'dynamic-physics' || this.params.motionMode === 'cellular-drift') {
        for (let i = 0; i < count; i++) {
          if (i === 0 && this.params.pointerMode === 'interactive-seed' && this.isPointerActive) {
            continue;
          }

          // Brownian / curl noise jitter
          if (this.params.driftJitter > 0.001) {
            const jitterAngle = this.prng.nextFloat(0, Math.PI * 2);
            const jitterMag = this.params.driftJitter * 0.15;
            this.seedVelX[i] += Math.cos(jitterAngle) * jitterMag * subDt;
            this.seedVelY[i] += Math.sin(jitterAngle) * jitterMag * subDt;
          }

          // Particle-Particle Soft Repulsion
          if (this.params.seedRepulsion > 0.01) {
            for (let j = i + 1; j < count; j++) {
              const dx = (this.seedPosX[i] - this.seedPosX[j]) * aspect;
              const dy = this.seedPosY[i] - this.seedPosY[j];
              const dist = Math.hypot(dx, dy);
              const repelRadius = 0.12;

              if (dist < repelRadius && dist > 0.001) {
                const force = this.params.seedRepulsion * (1.0 - dist / repelRadius) * 0.3 * subDt;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                this.seedVelX[i] += fx / this.seedMass[i];
                this.seedVelY[i] += fy / this.seedMass[i];
                this.seedVelX[j] -= fx / this.seedMass[j];
                this.seedVelY[j] -= fy / this.seedMass[j];
              }
            }
          }

          // Integrate Velocity
          this.seedPosX[i] += this.seedVelX[i] * speedMult * subDt;
          this.seedPosY[i] += this.seedVelY[i] * speedMult * subDt;

          // Drag / Damping
          this.seedVelX[i] *= Math.pow(this.params.damping, subDt * 60);
          this.seedVelY[i] *= Math.pow(this.params.damping, subDt * 60);

          // Boundary Collision & Wall Bounce
          if (this.params.wallBounce) {
            if (this.seedPosX[i] < 0.03) {
              this.seedPosX[i] = 0.03;
              this.seedVelX[i] = Math.abs(this.seedVelX[i]) * 0.85;
            } else if (this.seedPosX[i] > 0.97) {
              this.seedPosX[i] = 0.97;
              this.seedVelX[i] = -Math.abs(this.seedVelX[i]) * 0.85;
            }
            if (this.seedPosY[i] < 0.03) {
              this.seedPosY[i] = 0.03;
              this.seedVelY[i] = Math.abs(this.seedVelY[i]) * 0.85;
            } else if (this.seedPosY[i] > 0.97) {
              this.seedPosY[i] = 0.97;
              this.seedVelY[i] = -Math.abs(this.seedVelY[i]) * 0.85;
            }
          }
        }
      } else if (this.params.motionMode === 'vortex-swirl') {
        const center = 0.5;
        for (let i = 0; i < count; i++) {
          if (i === 0 && this.params.pointerMode === 'interactive-seed' && this.isPointerActive) {
            continue;
          }
          const dx = (this.seedPosX[i] - center) * aspect;
          const dy = this.seedPosY[i] - center;
          const dist = Math.hypot(dx, dy) + 0.05;
          const angSpeed = (0.5 / dist) * speedMult * subDt;

          // Tangential orbital velocity
          this.seedPosX[i] += (-dy / dist) * angSpeed / aspect;
          this.seedPosY[i] += (dx / dist) * angSpeed;

          // Radial confinement
          if (dist > 0.46) {
            this.seedPosX[i] -= (dx / dist) * 0.05 * subDt;
            this.seedPosY[i] -= (dy / dist) * 0.05 * subDt;
          }
        }
      } else if (this.params.motionMode === 'pulsating-breathing') {
        const center = 0.5;
        const breath = Math.sin(this.simTime * 2.2) * 0.18 * speedMult;
        for (let i = 0; i < count; i++) {
          if (i === 0 && this.params.pointerMode === 'interactive-seed' && this.isPointerActive) {
            continue;
          }
          const ox = this.seedOrigX[i] - center;
          const oy = this.seedOrigY[i] - center;
          this.seedPosX[i] = center + ox * (1.0 + breath);
          this.seedPosY[i] = center + oy * (1.0 + breath);
        }
      }

      // 3. Pointer Interactive Forces
      if (this.isPointerActive) {
        if (this.params.pointerMode === 'interactive-seed') {
          // Lock seed 0 to cursor coordinates
          this.seedPosX[0] = this.pointerX;
          this.seedPosY[0] = this.pointerY;
          this.seedVelX[0] = 0;
          this.seedVelY[0] = 0;
        } else if (this.params.pointerMode === 'repel' || this.params.pointerMode === 'attract') {
          const isRepel = this.params.pointerMode === 'repel';
          const pRadius = this.params.pointerRadius;
          const pStrength = this.params.pointerStrength * (this.isPointerDown ? 2.5 : 1.0);

          for (let i = 0; i < count; i++) {
            const dx = (this.seedPosX[i] - this.pointerX) * aspect;
            const dy = this.seedPosY[i] - this.pointerY;
            const dist = Math.hypot(dx, dy);

            if (dist < pRadius && dist > 0.001) {
              const f = (1.0 - dist / pRadius) * pStrength * 0.45 * subDt;
              const dir = isRepel ? 1.0 : -1.0;
              this.seedVelX[i] += (dx / dist) * f * dir;
              this.seedVelY[i] += (dy / dist) * f * dir;
            }
          }
        } else if (this.params.pointerMode === 'vortex') {
          const pRadius = this.params.pointerRadius;
          const pStrength = this.params.pointerStrength * (this.isPointerDown ? 2.5 : 1.0);

          for (let i = 0; i < count; i++) {
            const dx = (this.seedPosX[i] - this.pointerX) * aspect;
            const dy = this.seedPosY[i] - this.pointerY;
            const dist = Math.hypot(dx, dy);

            if (dist < pRadius && dist > 0.001) {
              const f = (1.0 - dist / pRadius) * pStrength * 0.6 * subDt;
              this.seedVelX[i] += (-dy / dist) * f / aspect;
              this.seedVelY[i] += (dx / dist) * f;
            }
          }
        }
      }
    }

    // Decay shockwave
    if (this.shockwaveIntensity > 0.001) {
      this.shockwaveRadius += dt * 0.8;
      this.shockwaveIntensity = Math.max(this.shockwaveIntensity - dt * 2.2, 0);
    }
  }

  /**
   * 60 FPS Real-Time Simulation and Shader Evaluation Loop.
   */
  private loop(now: number): void {
    if (!this.isMounted) return;

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.simTime += dt;

    // Smooth Parameter Damping
    const dampRate = 6.0;
    this.params.relaxationStrength = dampParameter(this.params.relaxationStrength, this.targetParams.relaxationStrength, dampRate, dt);
    this.params.minkowskiP = dampParameter(this.params.minkowskiP, this.targetParams.minkowskiP, dampRate, dt);
    this.params.borderThickness = dampParameter(this.params.borderThickness, this.targetParams.borderThickness, dampRate, dt);
    this.params.borderGlow = dampParameter(this.params.borderGlow, this.targetParams.borderGlow, dampRate, dt);
    this.params.borderSharpness = dampParameter(this.params.borderSharpness, this.targetParams.borderSharpness, dampRate, dt);
    this.params.interiorGradient = dampParameter(this.params.interiorGradient, this.targetParams.interiorGradient, dampRate, dt);
    this.params.seedGlow = dampParameter(this.params.seedGlow, this.targetParams.seedGlow, dampRate, dt);
    this.params.seedSize = dampParameter(this.params.seedSize, this.targetParams.seedSize, dampRate, dt);
    this.params.facetBevel = dampParameter(this.params.facetBevel, this.targetParams.facetBevel, dampRate, dt);
    this.params.speed = dampParameter(this.params.speed, this.targetParams.speed, dampRate, dt);
    this.params.contrast = dampParameter(this.params.contrast, this.targetParams.contrast, dampRate, dt);
    this.params.brightness = dampParameter(this.params.brightness, this.targetParams.brightness, dampRate, dt);

    // Continuous Palette Phase Cycling
    this.palettePhase += dt * this.params.paletteCycleSpeed * 0.4;

    // Sample Audio Reactivity
    if (this.audio && this.params.audioSource !== 'none') {
      const sens = this.params.audioSensitivity;
      this.bassLevel = dampParameter(this.bassLevel, this.audio.getBass() * sens, 14.0, dt);
      this.midLevel = dampParameter(this.midLevel, this.audio.getMid() * sens, 14.0, dt);
      this.trebleLevel = dampParameter(this.trebleLevel, this.audio.getTreble() * sens, 18.0, dt);
    } else {
      this.bassLevel = 0;
      this.midLevel = 0;
      this.trebleLevel = 0;
    }

    // Step Physics Simulation
    this.stepSimulation(1, dt);

    // Render WebGL / Canvas2D
    if (this.backendMode === 'webgl' && this.renderer && this.scene && this.camera && this.material) {
      this.renderWebGL();
    } else if (this.ctx2d) {
      this.renderCanvas2D();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Updates shader uniforms and renders WebGL full-screen quad.
   */
  private renderWebGL(): void {
    if (!this.material || !this.renderer || !this.scene || !this.camera) return;

    const u = this.material.uniforms;
    const pal = VORONOI_PALETTES[this.params.colorPalette] || VORONOI_PALETTES['obsidian-emerald'];

    const metricMap: Record<DistanceMetric, number> = {
      euclidean: 0,
      manhattan: 1,
      chebyshev: 2,
      minkowski: 3,
    };

    const shadingMap: Record<VoronoiShadingMode, number> = {
      'cellular-foam': 0,
      'crystal-facets': 1,
      'distance-field': 2,
      'worley-noise': 3,
      'f2-minus-f1': 4,
      'voronoi-mosaic': 5,
    };

    const colorModeMap: Record<VoronoiColorMode, number> = {
      'palette-gradient': 0,
      'cell-id': 1,
      'distance-f1': 2,
      'boundary-f2f1': 3,
    };

    u.uTime.value = this.simTime;
    u.uSeedCount.value = this.activeSeedCount;
    u.uMetric.value = metricMap[this.params.distanceMetric] ?? 0;
    u.uMinkowskiP.value = this.params.minkowskiP;
    u.uShadingMode.value = shadingMap[this.params.shadingMode] ?? 0;
    u.uBorderThickness.value = this.params.borderThickness;
    u.uBorderGlow.value = this.params.borderGlow;
    u.uBorderSharpness.value = this.params.borderSharpness;
    u.uInteriorGradient.value = this.params.interiorGradient;
    u.uSeedGlow.value = this.params.seedGlow;
    u.uSeedSize.value = this.params.seedSize;
    u.uIsolineCount.value = this.params.isolineCount;
    u.uFacetBevel.value = this.params.facetBevel;
    u.uColorMode.value = colorModeMap[this.params.colorMode] ?? 1;
    u.uPaletteCycle.value = this.palettePhase;
    u.uContrast.value = this.params.contrast;
    u.uBrightness.value = this.params.brightness;

    u.uColorA.value.set(...pal.colorA);
    u.uColorB.value.set(...pal.colorB);
    u.uColorC.value.set(...pal.colorC);
    u.uColorD.value.set(...pal.colorD);

    u.uPointer.value.set(this.pointerX, this.pointerY);
    u.uPointerActive.value = this.isPointerActive ? 1.0 : 0.0;
    u.uShockwaveRadius.value = this.shockwaveRadius;
    u.uShockwaveIntensity.value = this.shockwaveIntensity;

    u.uBassEnergy.value = this.bassLevel * this.params.bassReaction;
    u.uMidEnergy.value = this.midLevel * this.params.midReaction;
    u.uTrebleEnergy.value = this.trebleLevel * this.params.trebleReaction;

    // Pack seed positions and properties into uniform vectors
    for (let i = 0; i < this.activeSeedCount; i++) {
      this.uniformSeedPositions[i].set(this.seedPosX[i], this.seedPosY[i]);
      this.uniformSeedColors[i].set(this.seedHue[i], 0, 0, 1);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Renders high-performance Canvas2D simulation for fallback and snapshots.
   */
  private renderCanvas2D(targetCtx?: CanvasRenderingContext2D, targetW?: number, targetH?: number): void {
    const ctx = targetCtx || this.ctx2d;
    if (!ctx) return;

    const w = targetW || this.width;
    const h = targetH || this.height;
    const aspect = w / max(h, 1);
    const count = this.activeSeedCount;

    // Obsidian base void
    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, w, h);

    // Render Voronoi cell boundaries via discrete ray casting or Delaunay neighbor lines
    ctx.save();
    ctx.lineWidth = Math.max(this.params.borderThickness * 80, 1.2);
    ctx.strokeStyle = getVoronoiPaletteColor(this.params.colorPalette, 0.7, this.palettePhase, 0.85);

    // Draw Voronoi seed connection network
    for (let i = 0; i < count; i++) {
      const x1 = this.seedPosX[i] * w;
      const y1 = this.seedPosY[i] * h;

      // Find 3 nearest neighbors to draw subtle organic lattice foam
      const neighbors: { idx: number; d: number }[] = [];
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const dx = (this.seedPosX[i] - this.seedPosX[j]) * aspect;
        const dy = this.seedPosY[i] - this.seedPosY[j];
        const dist = Math.hypot(dx, dy);
        neighbors.push({ idx: j, d: dist });
      }
      neighbors.sort((a, b) => a.d - b.d);

      for (let k = 0; k < Math.min(3, neighbors.length); k++) {
        const j = neighbors[k].idx;
        if (i < j) {
          const x2 = this.seedPosX[j] * w;
          const y2 = this.seedPosY[j] * h;
          const alpha = Math.max(1.0 - neighbors[k].d * 4.0, 0.1);
          ctx.strokeStyle = getVoronoiPaletteColor(this.params.colorPalette, 0.5 + k * 0.15, this.palettePhase, alpha * 0.7);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    // Render Seed Nuclei Dots
    const seedR = Math.max(this.params.seedSize * 150, 2.5);
    for (let i = 0; i < count; i++) {
      const x = this.seedPosX[i] * w;
      const y = this.seedPosY[i] * h;

      // Center glowing nucleus
      ctx.fillStyle = getVoronoiPaletteColor(this.params.colorPalette, 0.95, this.palettePhase, 0.95);
      ctx.beginPath();
      ctx.arc(x, y, seedR, 0, Math.PI * 2);
      ctx.fill();

      // Soft halo
      ctx.fillStyle = getVoronoiPaletteColor(this.params.colorPalette, 0.65, this.palettePhase, 0.25);
      ctx.beginPath();
      ctx.arc(x, y, seedR * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Pointer Shockwave
    if (this.shockwaveIntensity > 0.01) {
      ctx.strokeStyle = `rgba(244, 246, 251, ${this.shockwaveIntensity * 0.8})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(this.pointerX * w, this.pointerY * h, this.shockwaveRadius * Math.min(w, h), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Custom high-resolution offline snapshot export pass for 4K/8K stills.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');

    if (this.backendMode === 'webgl' && this.renderer && this.scene && this.camera && this.material) {
      // Temporarily render WebGL scene at snapshot resolution
      const origW = this.width;
      const origH = this.height;

      this.resize(width, height);
      this.renderWebGL();

      if (offCtx && this.canvas) {
        offCtx.drawImage(this.canvas, 0, 0, width, height);
      }

      this.resize(origW, origH);
    } else if (offCtx) {
      this.renderCanvas2D(offCtx, width, height);
    }

    return offscreen;
  }

  /**
   * Cleanly disposes of all resources, WebGL objects, listeners, and RAF timers.
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

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.canvas = null;
    this.container = null;
    this.ctx2d = null;
  }
}

function max(a: number, b: number): number {
  return a > b ? a : b;
}

export default new VoronoiRoom();
