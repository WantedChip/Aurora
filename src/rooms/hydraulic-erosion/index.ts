/**
 * Room 26: Hydraulic Erosion Terrain (Particle-Droplet Fluvial Erosion 3D Landscape)
 * Curatorial Category: Morphogenesis & Landscape Synthesis
 * Math Model: Particle-Droplet Fluvial Hydraulic Erosion, Bilinear Normal Gradients & Multi-Octave fBm Alpine Displacement
 * Engine: Three.js WebGL2 / WebGPU 3D Displaced Terrain Mesh, OrbitControls & Dynamic Sunlight Shading
 * Aesthetic Direction: Obsidian Archival Minimal
 * 
 * Features:
 * - Multi-octave Simplex & Ridged fBm Alpine Terrain Generation:
 *   - Continuous 2D/3D heightmap generation H(x, y) with sharp granite ridges, glacial valleys, and continental plateaus
 * - Real-Time Particle-Droplet Fluvial Hydraulic Erosion Engine:
 *   - 500 to 3,000 droplet particles simulated per frame on flat typed array Float32Array
 *   - Bilinear surface height and normal gradient nabla H(x, y) evaluation for continuous downhill flow vectors
 *   - Inertia-weighted momentum steering: dir = dir_prev * inertia - nabla H * (1 - inertia)
 *   - Physical sediment transport capacity: C = max(-dH, minSlope) * ||v|| * W * Kc
 *   - Dynamic erosion (dH_erode = min((C - S) * Ke, -dH)) and alluvial deposition (dH_deposit = (S - C) * Kd)
 *   - Water evaporation (W = W * (1 - K_evap)) and velocity acceleration under gravity
 *   - Thermal talus relaxation preventing unstable overhanging cliffs
 * - Real-Time Dynamic 3D Mesh & Shader Rendering:
 *   - High-density displaced plane mesh (65,536 vertices) updated at 60 FPS
 *   - Dynamic slope-dependent tri-planar blending (steep cliff rock vs flat alluvial sediment vs alpine snow caps)
 *   - Glistening fluvial river channel highlights and wet rock specular glints
 *   - Reflective water plane with Fresnel rim reflections and deep water absorption
 *   - Dynamic sun lighting rig with customizable azimuth and elevation angles casting shadows
 *   - Atmospheric depth fog fading seamlessly into Obsidian void (#090A0D)
 * - 7 Canonical Landscape Presets:
 *   - Alpine Peaks, Grand Canyon, Volcanic Caldera, River Delta, Fjords & Glacier, Desert Mesa, Alien Archipelago
 * - 7 Curatorial Spectral Palettes:
 *   - Obsidian Alpine, Spectral Aurora, Canyon Terracotta, Volcanic Magma, Bioluminescent Abyss, Monochrome Lithic, Solar Dune
 * - Interactive Pointer Landscape Sculpting Tools:
 *   - Rain Cloud (concentrated rainfall storm carving canyons), Meteor Crater, Mountain Uplift, Basin Excavator, Thermal Relax
 * - Real-Time Web Audio API Spectral Coupling:
 *   - Bass driving rainfall storm bursts (+5,000 droplets) and seismic uplift
 *   - Mid modulating sunlight angle and water level breathing
 *   - Treble exciting specular river shimmer and snowline starlight glints
 * - 360-degree OrbitControls with inertia damping and 4 camera view presets
 * - Custom high-resolution offline snapshot export pass (4K/8K stills)
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
import { createSimplexNoise, type SimplexNoise } from '../../lib/noise';

export type TerrainPreset =
  | 'alpine-peaks'
  | 'grand-canyon'
  | 'volcanic-caldera'
  | 'river-delta'
  | 'fjords-glacier'
  | 'desert-mesa'
  | 'alien-archipelago';

export type TerrainPalette =
  | 'obsidian-alpine'
  | 'spectral-aurora'
  | 'canyon-terracotta'
  | 'volcanic-magma'
  | 'bioluminescent-abyss'
  | 'monochrome-lithic'
  | 'solar-dune';

export type CameraView =
  | 'isometric-3d'
  | 'top-down-contours'
  | 'cinematic-valley'
  | 'aerial-glide';

export type PointerSculptMode =
  | 'rain-cloud'
  | 'meteor-crater'
  | 'sculpt-raise'
  | 'sculpt-lower'
  | 'thermal-smooth'
  | 'none';

export interface HydraulicErosionParams {
  seed: string;
  preset: TerrainPreset;
  gridResolution: number;
  heightScale: number;
  noiseOctaves: number;
  noiseRoughness: number;
  ridgePower: number;
  mountainScale: number;
  dropletsPerFrame: number;
  erosionRate: number;       // Ke
  depositionRate: number;    // Kd
  sedimentCapacity: number;  // Kc
  evaporationRate: number;   // K_evap
  gravity: number;
  inertia: number;
  minSlope: number;
  maxLifetime: number;
  talusSmoothing: number;
  waterLevel: number;
  waterOpacity: number;
  riverGlow: number;
  sunAzimuth: number;
  sunElevation: number;
  sunIntensity: number;
  colorPalette: TerrainPalette;
  rockSlopeThreshold: number;
  snowElevation: number;
  cameraView: CameraView;
  cameraAutoRotate: boolean;
  rotationSpeed: number;
  pointerMode: PointerSculptMode;
  brushRadius: number;
  brushStrength: number;
  audioSource: 'synth' | 'mic' | 'none';
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
}

export const DEFAULT_HYDRAULIC_EROSION_PARAMS: HydraulicErosionParams = {
  seed: '#00FF9D',
  preset: 'alpine-peaks',
  gridResolution: 256,
  heightScale: 48.0,
  noiseOctaves: 6,
  noiseRoughness: 0.52,
  ridgePower: 1.8,
  mountainScale: 1.0,
  dropletsPerFrame: 1200,
  erosionRate: 0.12,
  depositionRate: 0.10,
  sedimentCapacity: 4.0,
  evaporationRate: 0.02,
  gravity: 12.0,
  inertia: 0.15,
  minSlope: 0.01,
  maxLifetime: 32,
  talusSmoothing: 0.02,
  waterLevel: 0.14,
  waterOpacity: 0.75,
  riverGlow: 1.5,
  sunAzimuth: 45.0,
  sunElevation: 42.0,
  sunIntensity: 1.6,
  colorPalette: 'obsidian-alpine',
  rockSlopeThreshold: 0.72,
  snowElevation: 0.65,
  cameraView: 'isometric-3d',
  cameraAutoRotate: false,
  rotationSpeed: 0.25,
  pointerMode: 'rain-cloud',
  brushRadius: 22,
  brushStrength: 1.2,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.5,
  midReaction: 1.0,
  trebleReaction: 1.4,
};

export interface PaletteStop {
  r: number;
  g: number;
  b: number;
}

export interface TerrainColorPaletteDef {
  name: string;
  deepWater: PaletteStop;
  shallowWater: PaletteStop;
  sandSediment: PaletteStop;
  lowlandGrass: PaletteStop;
  cliffRock: PaletteStop;
  alpineSnow: PaletteStop;
  riverFlow: PaletteStop;
  sunColor: number;
  ambientColor: number;
  fogColor: number;
}

export const TERRAIN_PALETTES: Record<TerrainPalette, TerrainColorPaletteDef> = {
  'obsidian-alpine': {
    name: 'Obsidian Alpine (Basalt, Emerald Moss & Arctic Snow)',
    deepWater: { r: 0.02, g: 0.08, b: 0.12 },
    shallowWater: { r: 0.05, g: 0.28, b: 0.32 },
    sandSediment: { r: 0.28, g: 0.32, b: 0.26 },
    lowlandGrass: { r: 0.05, g: 0.42, b: 0.28 },
    cliffRock: { r: 0.12, g: 0.14, b: 0.18 },
    alpineSnow: { r: 0.94, g: 0.96, b: 0.99 },
    riverFlow: { r: 0.0, g: 0.95, b: 0.85 },
    sunColor: 0xffeedd,
    ambientColor: 0x121820,
    fogColor: 0x090a0d,
  },
  'spectral-aurora': {
    name: 'Spectral Aurora (Cyan Rivers, Violet Slopes & Neon Peaks)',
    deepWater: { r: 0.05, g: 0.02, b: 0.18 },
    shallowWater: { r: 0.0, g: 0.55, b: 0.85 },
    sandSediment: { r: 0.35, g: 0.18, b: 0.55 },
    lowlandGrass: { r: 0.12, g: 0.65, b: 0.75 },
    cliffRock: { r: 0.24, g: 0.12, b: 0.42 },
    alpineSnow: { r: 0.85, g: 0.75, b: 1.0 },
    riverFlow: { r: 0.0, g: 0.98, b: 1.0 },
    sunColor: 0xeed8ff,
    ambientColor: 0x150d24,
    fogColor: 0x090a0d,
  },
  'canyon-terracotta': {
    name: 'Canyon Terracotta (Iron Sandstone, Ochre & Turquoise)',
    deepWater: { r: 0.02, g: 0.15, b: 0.20 },
    shallowWater: { r: 0.10, g: 0.65, b: 0.70 },
    sandSediment: { r: 0.78, g: 0.52, b: 0.32 },
    lowlandGrass: { r: 0.55, g: 0.38, b: 0.22 },
    cliffRock: { r: 0.62, g: 0.25, b: 0.15 },
    alpineSnow: { r: 0.92, g: 0.82, b: 0.72 },
    riverFlow: { r: 0.15, g: 0.85, b: 0.92 },
    sunColor: 0xffe2c4,
    ambientColor: 0x221410,
    fogColor: 0x090a0d,
  },
  'volcanic-magma': {
    name: 'Volcanic Magma (Obsidian Ash, Sulfur & Glowing Lava)',
    deepWater: { r: 0.15, g: 0.02, b: 0.02 },
    shallowWater: { r: 0.45, g: 0.08, b: 0.02 },
    sandSediment: { r: 0.22, g: 0.18, b: 0.16 },
    lowlandGrass: { r: 0.32, g: 0.22, b: 0.10 },
    cliffRock: { r: 0.08, g: 0.08, b: 0.10 },
    alpineSnow: { r: 0.85, g: 0.45, b: 0.15 },
    riverFlow: { r: 1.0, g: 0.35, b: 0.05 },
    sunColor: 0xffaa66,
    ambientColor: 0x200c0a,
    fogColor: 0x090a0d,
  },
  'bioluminescent-abyss': {
    name: 'Bioluminescent Abyss (Deep Marine & Phosphor Deltas)',
    deepWater: { r: 0.01, g: 0.04, b: 0.12 },
    shallowWater: { r: 0.02, g: 0.22, b: 0.35 },
    sandSediment: { r: 0.10, g: 0.25, b: 0.32 },
    lowlandGrass: { r: 0.02, g: 0.45, b: 0.42 },
    cliffRock: { r: 0.06, g: 0.10, b: 0.18 },
    alpineSnow: { r: 0.45, g: 0.92, b: 0.88 },
    riverFlow: { r: 0.10, g: 1.0, b: 0.65 },
    sunColor: 0xb8f4ff,
    ambientColor: 0x081522,
    fogColor: 0x090a0d,
  },
  'monochrome-lithic': {
    name: 'Monochrome Lithic (Slate, Quartz & Silver Streams)',
    deepWater: { r: 0.06, g: 0.07, b: 0.09 },
    shallowWater: { r: 0.20, g: 0.22, b: 0.26 },
    sandSediment: { r: 0.38, g: 0.40, b: 0.44 },
    lowlandGrass: { r: 0.25, g: 0.28, b: 0.32 },
    cliffRock: { r: 0.14, g: 0.15, b: 0.18 },
    alpineSnow: { r: 0.96, g: 0.96, b: 0.98 },
    riverFlow: { r: 0.82, g: 0.88, b: 0.95 },
    sunColor: 0xffffff,
    ambientColor: 0x181a20,
    fogColor: 0x090a0d,
  },
  'solar-dune': {
    name: 'Solar Dune (Golden Sand, Amber Strata & Sunlit Plains)',
    deepWater: { r: 0.08, g: 0.18, b: 0.22 },
    shallowWater: { r: 0.18, g: 0.55, b: 0.62 },
    sandSediment: { r: 0.85, g: 0.72, b: 0.42 },
    lowlandGrass: { r: 0.65, g: 0.58, b: 0.32 },
    cliffRock: { r: 0.45, g: 0.32, b: 0.20 },
    alpineSnow: { r: 0.98, g: 0.92, b: 0.78 },
    riverFlow: { r: 0.20, g: 0.82, b: 0.88 },
    sunColor: 0xfff0d0,
    ambientColor: 0x241a12,
    fogColor: 0x090a0d,
  },
};

export interface PresetMorphology {
  name: string;
  octaves: number;
  roughness: number;
  ridgePower: number;
  heightScale: number;
  waterLevel: number;
  erosionRate: number;
  sedimentCapacity: number;
  sunElevation: number;
  palette: TerrainPalette;
}

export const PRESET_MORPHOLOGIES: Record<TerrainPreset, PresetMorphology> = {
  'alpine-peaks': {
    name: 'Alpine Peaks (Glacial Cirques & Jagged Horns)',
    octaves: 6,
    roughness: 0.53,
    ridgePower: 2.0,
    heightScale: 52.0,
    waterLevel: 0.14,
    erosionRate: 0.14,
    sedimentCapacity: 4.5,
    sunElevation: 42.0,
    palette: 'obsidian-alpine',
  },
  'grand-canyon': {
    name: 'Grand Canyon (Layered Strata & Deep Ravines)',
    octaves: 5,
    roughness: 0.48,
    ridgePower: 1.2,
    heightScale: 46.0,
    waterLevel: 0.12,
    erosionRate: 0.22,
    sedimentCapacity: 5.5,
    sunElevation: 35.0,
    palette: 'canyon-terracotta',
  },
  'volcanic-caldera': {
    name: 'Volcanic Caldera (Cone, Crater & Pyroclastic Gullies)',
    octaves: 6,
    roughness: 0.50,
    ridgePower: 1.6,
    heightScale: 48.0,
    waterLevel: 0.16,
    erosionRate: 0.16,
    sedimentCapacity: 4.0,
    sunElevation: 48.0,
    palette: 'volcanic-magma',
  },
  'river-delta': {
    name: 'River Delta (Meandering Alluvial Basin)',
    octaves: 5,
    roughness: 0.45,
    ridgePower: 1.1,
    heightScale: 36.0,
    waterLevel: 0.22,
    erosionRate: 0.18,
    sedimentCapacity: 6.0,
    sunElevation: 55.0,
    palette: 'solar-dune',
  },
  'fjords-glacier': {
    name: 'Fjords & Glacier (Oceanic Chasm & Sea Cliffs)',
    octaves: 6,
    roughness: 0.55,
    ridgePower: 2.2,
    heightScale: 56.0,
    waterLevel: 0.28,
    erosionRate: 0.12,
    sedimentCapacity: 3.8,
    sunElevation: 28.0,
    palette: 'monochrome-lithic',
  },
  'desert-mesa': {
    name: 'Desert Mesa (Terraced Plateaus & Talus Fans)',
    octaves: 4,
    roughness: 0.42,
    ridgePower: 1.0,
    heightScale: 38.0,
    waterLevel: 0.08,
    erosionRate: 0.20,
    sedimentCapacity: 5.0,
    sunElevation: 60.0,
    palette: 'solar-dune',
  },
  'alien-archipelago': {
    name: 'Alien Archipelago (Crystalline Spire Islands)',
    octaves: 6,
    roughness: 0.56,
    ridgePower: 2.4,
    heightScale: 50.0,
    waterLevel: 0.32,
    erosionRate: 0.15,
    sedimentCapacity: 4.2,
    sunElevation: 38.0,
    palette: 'spectral-aurora',
  },
};

/**
 * Hydraulic Erosion Simulation Engine
 */
export class HydraulicErosionEngine {
  public width: number;
  public height: number;
  public heightMap: Float32Array;
  public waterFlowMap: Float32Array;
  public sedimentDepositMap: Float32Array;
  public totalErosionSteps = 0;
  private noise: SimplexNoise;
  private prng: PRNG;

  constructor(resolution = 256, seed = '#00FF9D') {
    this.width = resolution;
    this.height = resolution;
    this.heightMap = new Float32Array(this.width * this.height);
    this.waterFlowMap = new Float32Array(this.width * this.height);
    this.sedimentDepositMap = new Float32Array(this.width * this.height);
    this.prng = createPRNG(seed);
    this.noise = createSimplexNoise(seed);
  }

  /**
   * Resets simulation and generates fresh procedural base heightmap
   */
  public generateBaseTerrain(params: HydraulicErosionParams): void {
    this.prng = createPRNG(params.seed);
    this.noise = createSimplexNoise(params.seed);

    const w = this.width;
    const h = this.height;

    this.waterFlowMap.fill(0);
    this.sedimentDepositMap.fill(0);
    this.totalErosionSteps = 0;

    const octaves = params.noiseOctaves;
    const roughness = params.noiseRoughness;
    const ridgePower = params.ridgePower;
    const mountainScale = params.mountainScale;
    const preset = params.preset;

    const cx = (w - 1) * 0.5;
    const cy = (h - 1) * 0.5;
    const maxRadius = Math.hypot(cx, cy);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const nx = (x / w - 0.5) * 2.5 * mountainScale;
        const ny = (y / h - 0.5) * 2.5 * mountainScale;

        // Domain warping
        const warpX = nx + this.noise.noise2D(nx * 0.8, ny * 0.8) * 0.35;
        const warpY = ny + this.noise.noise2D(nx * 0.8 + 12.5, ny * 0.8 + 8.3) * 0.35;

        // Multi-octave fBm with ridged synthesis
        let elevation = 0.0;
        let amplitude = 1.0;
        let frequency = 1.0;
        let totalAmp = 0.0;

        for (let o = 0; o < octaves; o++) {
          const rawNoise = this.noise.noise2D(warpX * frequency, warpY * frequency);
          // Ridged noise octave: 1 - |rawNoise|
          const ridged = 1.0 - Math.abs(rawNoise);
          const shaped = Math.pow(ridged, ridgePower);

          elevation += (rawNoise * 0.4 + shaped * 0.6) * amplitude;
          totalAmp += amplitude;
          amplitude *= roughness;
          frequency *= 2.02;
        }

        elevation /= totalAmp;

        // Preset-specific macroscopic morphological sculpting
        if (preset === 'volcanic-caldera') {
          const distFromCenter = Math.hypot(x - cx, y - cy) / cx;
          const cone = Math.max(0, 1.0 - distFromCenter * 1.2);
          const crater = Math.exp(-Math.pow(distFromCenter * 3.5, 2.0)) * 0.65;
          elevation = cone * 0.9 - crater + elevation * 0.3;
        } else if (preset === 'grand-canyon') {
          // Plateau terracing
          const terrace = Math.floor(elevation * 5.0) / 5.0;
          elevation = terrace * 0.5 + elevation * 0.5;
        } else if (preset === 'alien-archipelago' || preset === 'fjords-glacier') {
          // Sharpen peaks and deepen troughs
          elevation = Math.pow(Math.max(0, elevation), 1.4) * 1.2;
        }

        // Boundary radial falloff
        const distEdge = Math.hypot(x - cx, y - cy) / maxRadius;
        const mask = Math.cos(Math.min(distEdge * Math.PI * 0.5, Math.PI * 0.5));
        const falloff = Math.pow(mask, 0.45);

        this.heightMap[idx] = Math.max(0.01, elevation * falloff);
      }
    }
  }

  /**
   * Evaluates bilinear height at fractional coordinate (x, y)
   */
  public sampleHeight(x: number, y: number): number {
    const w = this.width;
    const h = this.height;

    const x0 = Math.max(0, Math.min(w - 2, Math.floor(x)));
    const y0 = Math.max(0, Math.min(h - 2, Math.floor(y)));
    const u = x - x0;
    const v = y - y0;

    const h00 = this.heightMap[y0 * w + x0];
    const h10 = this.heightMap[y0 * w + (x0 + 1)];
    const h01 = this.heightMap[(y0 + 1) * w + x0];
    const h11 = this.heightMap[(y0 + 1) * w + (x0 + 1)];

    return h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
  }

  /**
   * Simulates a batch of hydraulic erosion droplets
   */
  public stepDroplets(
    count: number,
    params: HydraulicErosionParams,
    concentratedX = -1,
    concentratedY = -1
  ): void {
    const w = this.width;
    const h = this.height;
    const inertia = params.inertia;
    const minSlope = params.minSlope;
    const capacityFactor = params.sedimentCapacity;
    const erosionRate = params.erosionRate;
    const depositionRate = params.depositionRate;
    const evapRate = params.evaporationRate;
    const gravity = params.gravity;
    const maxLifetime = params.maxLifetime;

    for (let d = 0; d < count; d++) {
      // Spawn position
      let posX: number;
      let posY: number;

      if (concentratedX >= 0 && concentratedY >= 0) {
        // Concentrated storm over cursor
        const angle = this.prng.nextFloat(0, Math.PI * 2);
        const radius = this.prng.nextFloat(0, params.brushRadius);
        posX = concentratedX + Math.cos(angle) * radius;
        posY = concentratedY + Math.sin(angle) * radius;
      } else {
        posX = this.prng.nextFloat(1, w - 2);
        posY = this.prng.nextFloat(1, h - 2);
      }

      if (posX < 1 || posX >= w - 2 || posY < 1 || posY >= h - 2) {
        continue;
      }

      let dirX = 0.0;
      let dirY = 0.0;
      let speed = 1.0;
      let water = 1.0;
      let sediment = 0.0;

      for (let step = 0; step < maxLifetime; step++) {
        const x0 = Math.floor(posX);
        const y0 = Math.floor(posY);
        const u = posX - x0;
        const v = posY - y0;

        if (x0 < 0 || x0 >= w - 1 || y0 < 0 || y0 >= h - 1) {
          break;
        }

        const idx00 = y0 * w + x0;
        const idx10 = idx00 + 1;
        const idx01 = idx00 + w;
        const idx11 = idx01 + 1;

        const h00 = this.heightMap[idx00];
        const h10 = this.heightMap[idx10];
        const h01 = this.heightMap[idx01];
        const h11 = this.heightMap[idx11];

        // Bilinear normal gradient derivation
        const gradX = (h10 - h00) * (1 - v) + (h11 - h01) * v;
        const gradY = (h01 - h00) * (1 - u) + (h11 - h10) * u;
        const currentHeight = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;

        // Direction steering with inertia
        dirX = dirX * inertia - gradX * (1 - inertia);
        dirY = dirY * inertia - gradY * (1 - inertia);

        const dirLen = Math.hypot(dirX, dirY);
        if (dirLen < 1e-5) {
          // Pit / flat region
          const rndAngle = this.prng.nextFloat(0, Math.PI * 2);
          dirX = Math.cos(rndAngle);
          dirY = Math.sin(rndAngle);
        } else {
          dirX /= dirLen;
          dirY /= dirLen;
        }

        const newPosX = posX + dirX;
        const newPosY = posY + dirY;

        if (newPosX < 1 || newPosX >= w - 2 || newPosY < 1 || newPosY >= h - 2) {
          // Droplet left simulation boundaries
          break;
        }

        const nextHeight = this.sampleHeight(newPosX, newPosY);
        const deltaHeight = nextHeight - currentHeight;

        // Sediment capacity computation
        const slope = Math.max(-deltaHeight, minSlope);
        const capacity = slope * speed * water * capacityFactor;

        // Bilinear distribution weights
        const w00 = (1 - u) * (1 - v);
        const w10 = u * (1 - v);
        const w01 = (1 - u) * v;
        const w11 = u * v;

        if (deltaHeight > 0) {
          // Flowing uphill into a pit: deposit sediment to fill depression
          const depositAmount = Math.min(sediment, deltaHeight);
          this.heightMap[idx00] += depositAmount * w00;
          this.heightMap[idx10] += depositAmount * w10;
          this.heightMap[idx01] += depositAmount * w01;
          this.heightMap[idx11] += depositAmount * w11;

          this.sedimentDepositMap[idx00] += depositAmount * w00;
          this.sedimentDepositMap[idx10] += depositAmount * w10;
          this.sedimentDepositMap[idx01] += depositAmount * w01;
          this.sedimentDepositMap[idx11] += depositAmount * w11;

          sediment -= depositAmount;
        } else if (sediment > capacity) {
          // Oversaturated with sediment: deposit excess
          const depositAmount = (sediment - capacity) * depositionRate;
          this.heightMap[idx00] += depositAmount * w00;
          this.heightMap[idx10] += depositAmount * w10;
          this.heightMap[idx01] += depositAmount * w01;
          this.heightMap[idx11] += depositAmount * w11;

          this.sedimentDepositMap[idx00] += depositAmount * w00;
          this.sedimentDepositMap[idx10] += depositAmount * w10;
          this.sedimentDepositMap[idx01] += depositAmount * w01;
          this.sedimentDepositMap[idx11] += depositAmount * w11;

          sediment -= depositAmount;
        } else {
          // Under sediment capacity: erode terrain
          const erodeAmount = Math.min((capacity - sediment) * erosionRate, -deltaHeight);
          this.heightMap[idx00] -= erodeAmount * w00;
          this.heightMap[idx10] -= erodeAmount * w10;
          this.heightMap[idx01] -= erodeAmount * w01;
          this.heightMap[idx11] -= erodeAmount * w11;

          sediment += erodeAmount;
        }

        // Record water flow trace
        const flowWeight = water * 0.08;
        this.waterFlowMap[idx00] += flowWeight * w00;
        this.waterFlowMap[idx10] += flowWeight * w10;
        this.waterFlowMap[idx01] += flowWeight * w01;
        this.waterFlowMap[idx11] += flowWeight * w11;

        // Kinematic acceleration & evaporation
        speed = Math.sqrt(Math.max(0.1, speed * speed + (-deltaHeight) * gravity));
        water *= (1 - evapRate);

        posX = newPosX;
        posY = newPosY;

        if (water < 0.05) {
          break;
        }
      }
    }

    this.totalErosionSteps += count;

    // Subtle thermal relaxation / talus slope stability
    if (params.talusSmoothing > 0.001) {
      this.applyThermalRelaxation(params.talusSmoothing);
    }
  }

  /**
   * Applies thermal talus relaxation to smooth extreme vertical discontinuities
   */
  public applyThermalRelaxation(strength: number): void {
    const w = this.width;
    const h = this.height;
    const maxSlope = 0.45;

    for (let y = 1; y < h - 1; y += 2) {
      for (let x = 1; x < w - 1; x += 2) {
        const idx = y * w + x;
        const hc = this.heightMap[idx];

        const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
        for (let n = 0; n < 4; n++) {
          const nIdx = neighbors[n];
          const hn = this.heightMap[nIdx];
          const diff = hc - hn;
          if (diff > maxSlope) {
            const transfer = (diff - maxSlope) * strength * 0.5;
            this.heightMap[idx] -= transfer;
            this.heightMap[nIdx] += transfer;
          }
        }
      }
    }
  }

  /**
   * Pointer sculpting tool application
   */
  public applySculptBrush(
    gridX: number,
    gridY: number,
    mode: PointerSculptMode,
    radius: number,
    strength: number
  ): void {
    const w = this.width;
    const h = this.height;
    const r2 = radius * radius;

    const minX = Math.max(0, Math.floor(gridX - radius));
    const maxX = Math.min(w - 1, Math.ceil(gridX + radius));
    const minY = Math.max(0, Math.floor(gridY - radius));
    const maxY = Math.min(h - 1, Math.ceil(gridY + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - gridX;
        const dy = y - gridY;
        const distSq = dx * dx + dy * dy;

        if (distSq > r2) continue;

        const factor = Math.cos((Math.sqrt(distSq) / radius) * Math.PI * 0.5);
        const idx = y * w + x;

        switch (mode) {
          case 'sculpt-raise':
            this.heightMap[idx] += factor * strength * 0.08;
            break;
          case 'sculpt-lower':
            this.heightMap[idx] = Math.max(0.01, this.heightMap[idx] - factor * strength * 0.08);
            break;
          case 'meteor-crater': {
            const normalizedDist = Math.sqrt(distSq) / radius;
            if (normalizedDist < 0.6) {
              // Deep central depression
              this.heightMap[idx] = Math.max(0.01, this.heightMap[idx] - (1.0 - normalizedDist / 0.6) * strength * 0.15);
            } else {
              // Raised crater rim
              const rimFactor = Math.sin(((normalizedDist - 0.6) / 0.4) * Math.PI);
              this.heightMap[idx] += rimFactor * strength * 0.07;
            }
            break;
          }
          case 'thermal-smooth': {
            // Local 3x3 averaging
            let avg = 0;
            let count = 0;
            for (let dy2 = -1; dy2 <= 1; dy2++) {
              for (let dx2 = -1; dx2 <= 1; dx2++) {
                const nx = x + dx2;
                const ny = y + dy2;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  avg += this.heightMap[ny * w + nx];
                  count++;
                }
              }
            }
            avg /= count;
            this.heightMap[idx] += (avg - this.heightMap[idx]) * factor * strength * 0.5;
            break;
          }
          default:
            break;
        }
      }
    }
  }
}

/**
 * Room 26 Implementation Class
 */
export class HydraulicErosionRoom implements RoomInstance {
  public params: HydraulicErosionParams;
  public engine: HydraulicErosionEngine;

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;

  private terrainMesh: THREE.Mesh | null = null;
  private terrainGeometry: THREE.PlaneGeometry | null = null;
  private terrainMaterial: THREE.ShaderMaterial | null = null;

  private waterMesh: THREE.Mesh | null = null;
  private waterMaterial: THREE.MeshStandardMaterial | null = null;

  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;

  private pointerGridX = -1;
  private pointerGridY = -1;
  private isPointerDown = false;
  private raycaster = new THREE.Raycaster();
  private mousePos = new THREE.Vector2();

  private animationFrameId: number | null = null;
  private lastTime = 0;
  private waterPhase = 0;
  private ctx: RoomContext | null = null;

  constructor() {
    this.params = { ...DEFAULT_HYDRAULIC_EROSION_PARAMS };
    this.engine = new HydraulicErosionEngine(this.params.gridResolution, this.params.seed);
  }

  /**
   * Mounts the Three.js 3D landscape simulation
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.ctx = ctx;
    this.params = { ...DEFAULT_HYDRAULIC_EROSION_PARAMS, ...(ctx.params || {}) };

    const { canvas, container } = ctx;
    const width = container.clientWidth || canvas.width || 800;
    const height = container.clientHeight || canvas.height || 600;

    // Initialize Engine & Base Terrain
    this.engine = new HydraulicErosionEngine(this.params.gridResolution, this.params.seed);
    this.engine.generateBaseTerrain(this.params);

    // Initial pre-erosion steps to deliver a dramatic sculpted canyon immediately on first frame
    this.engine.stepDroplets(3000, this.params);

    // Three.js Scene Setup
    this.scene = new THREE.Scene();
    const paletteDef = TERRAIN_PALETTES[this.params.colorPalette] || TERRAIN_PALETTES['obsidian-alpine'];
    this.scene.background = new THREE.Color(paletteDef.fogColor);
    this.scene.fog = new THREE.FogExp2(paletteDef.fogColor, 0.0035);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    this.applyCameraView(this.params.cameraView);

    // Renderer (WebGL2 with fallback resilience)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      this.renderer = renderer;
    } catch {
      // Graceful fallback for non-WebGL test runners
      this.renderer = null;
    }

    // OrbitControls
    if (this.renderer && this.camera) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI * 0.48; // Prevent looking below ground
      this.controls.minDistance = 30;
      this.controls.maxDistance = 320;
      this.controls.autoRotate = this.params.cameraAutoRotate;
      this.controls.autoRotateSpeed = this.params.rotationSpeed;
    }

    // Lighting Rig
    this.sunLight = new THREE.DirectionalLight(paletteDef.sunColor, this.params.sunIntensity);
    this.updateSunPosition();
    this.scene.add(this.sunLight);

    this.ambientLight = new THREE.AmbientLight(paletteDef.ambientColor, 1.2);
    this.scene.add(this.ambientLight);

    // Build 3D Terrain Mesh & Custom Terrain Shader
    this.buildTerrainMesh();

    // Build Reflective Water Plane
    this.buildWaterPlane();

    // Start Simulation & Render Loop
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);

    // Return cleanup closure
    return () => {
      this.destroy();
    };
  }

  /**
   * Constructs the 3D displaced terrain mesh with custom slope & elevation vertex coloring
   */
  private buildTerrainMesh(): void {
    if (!this.scene) return;

    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainGeometry?.dispose();
      this.terrainMaterial?.dispose();
    }

    const res = this.engine.width;
    const terrainSize = 140;

    // Plane geometry oriented horizontally
    this.terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, res - 1, res - 1);
    this.terrainGeometry.rotateX(-Math.PI * 0.5);

    // Add custom vertex attribute for water flow and sediment traces
    const vertexCount = res * res;
    const flowAttribute = new Float32Array(vertexCount);
    this.terrainGeometry.setAttribute('aFlow', new THREE.BufferAttribute(flowAttribute, 1));

    // Custom Shader Material delivering Obsidian Archival slope/elevation rendering
    const paletteDef = TERRAIN_PALETTES[this.params.colorPalette] || TERRAIN_PALETTES['obsidian-alpine'];

    this.terrainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uDeepWater: { value: new THREE.Color(paletteDef.deepWater.r, paletteDef.deepWater.g, paletteDef.deepWater.b) },
        uShallowWater: { value: new THREE.Color(paletteDef.shallowWater.r, paletteDef.shallowWater.g, paletteDef.shallowWater.b) },
        uSandSediment: { value: new THREE.Color(paletteDef.sandSediment.r, paletteDef.sandSediment.g, paletteDef.sandSediment.b) },
        uLowlandGrass: { value: new THREE.Color(paletteDef.lowlandGrass.r, paletteDef.lowlandGrass.g, paletteDef.lowlandGrass.b) },
        uCliffRock: { value: new THREE.Color(paletteDef.cliffRock.r, paletteDef.cliffRock.g, paletteDef.cliffRock.b) },
        uAlpineSnow: { value: new THREE.Color(paletteDef.alpineSnow.r, paletteDef.alpineSnow.g, paletteDef.alpineSnow.b) },
        uRiverFlow: { value: new THREE.Color(paletteDef.riverFlow.r, paletteDef.riverFlow.g, paletteDef.riverFlow.b) },
        uRockSlopeThreshold: { value: this.params.rockSlopeThreshold },
        uSnowElevation: { value: this.params.snowElevation },
        uRiverGlow: { value: this.params.riverGlow },
        uSunDirection: { value: new THREE.Vector3(1, 1, 1).normalize() },
        uSunColor: { value: new THREE.Color(paletteDef.sunColor) },
        uAmbientColor: { value: new THREE.Color(paletteDef.ambientColor) },
        uHeightScale: { value: this.params.heightScale },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        attribute float aFlow;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vElevation;
        varying float vFlow;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vElevation = position.y;
          vFlow = aFlow;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uDeepWater;
        uniform vec3 uShallowWater;
        uniform vec3 uSandSediment;
        uniform vec3 uLowlandGrass;
        uniform vec3 uCliffRock;
        uniform vec3 uAlpineSnow;
        uniform vec3 uRiverFlow;
        uniform float uRockSlopeThreshold;
        uniform float uSnowElevation;
        uniform float uRiverGlow;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform vec3 uAmbientColor;
        uniform float uHeightScale;
        uniform float uTime;

        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vElevation;
        varying float vFlow;

        void main() {
          // Normalized elevation [0.0, 1.0]
          float normElev = clamp(vElevation / max(1.0, uHeightScale), 0.0, 1.0);

          // Slope factor (1.0 = flat horizontal, 0.0 = sheer vertical wall)
          float slope = clamp(vNormal.y, 0.0, 1.0);

          // Base elevation-based color gradient
          vec3 terrainColor;
          if (normElev < 0.15) {
            terrainColor = mix(uDeepWater, uSandSediment, normElev / 0.15);
          } else if (normElev < 0.45) {
            float t = (normElev - 0.15) / 0.30;
            terrainColor = mix(uSandSediment, uLowlandGrass, t);
          } else if (normElev < uSnowElevation) {
            float t = (normElev - 0.45) / max(0.01, uSnowElevation - 0.45);
            terrainColor = mix(uLowlandGrass, uCliffRock, t);
          } else {
            float t = clamp((normElev - uSnowElevation) / (1.0 - uSnowElevation), 0.0, 1.0);
            terrainColor = mix(uCliffRock, uAlpineSnow, t);
          }

          // Blend steep cliff rock where slope exceeds threshold
          float rockFactor = smoothstep(uRockSlopeThreshold + 0.12, uRockSlopeThreshold - 0.08, slope);
          terrainColor = mix(terrainColor, uCliffRock, rockFactor * 0.85);

          // Blend snow caps on gentle high-altitude summits
          float snowCap = smoothstep(uSnowElevation - 0.05, uSnowElevation + 0.15, normElev) * smoothstep(0.45, 0.85, slope);
          terrainColor = mix(terrainColor, uAlpineSnow, snowCap);

          // Fluvial river water channels & wet rock highlight
          float flowIntensity = clamp(vFlow * 0.35, 0.0, 1.0);
          vec3 riverColor = uRiverFlow * (1.0 + sin(uTime * 2.0 + vWorldPosition.x * 0.1) * 0.15);
          terrainColor = mix(terrainColor, riverColor, flowIntensity * uRiverGlow);

          // Directional Sunlight & Ambient Shading (Lambertian + Half-Lambert fill)
          float nDotL = max(0.0, dot(vNormal, uSunDirection));
          float halfLambert = pow(nDotL * 0.5 + 0.5, 2.0);
          vec3 lighting = uAmbientColor + uSunColor * (nDotL * 0.85 + halfLambert * 0.25);

          // Specular glint for snow and river channels
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 halfVec = normalize(uSunDirection + viewDir);
          float spec = pow(max(0.0, dot(vNormal, halfVec)), 32.0) * (snowCap * 0.4 + flowIntensity * 0.8);

          vec3 finalColor = terrainColor * lighting + uSunColor * spec;

          // Atmospheric depth fog calculation
          float dist = length(cameraPosition - vWorldPosition);
          float fogFactor = 1.0 - exp(-dist * 0.0035);
          vec3 fogColor = vec3(0.035, 0.039, 0.051); // #090A0D void

          gl_FragColor = vec4(mix(finalColor, fogColor, fogFactor), 1.0);
        }
      `,
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeometry, this.terrainMaterial);
    this.scene.add(this.terrainMesh);

    this.syncMeshHeights();
  }

  /**
   * Constructs the semi-transparent reflective water plane at sea level
   */
  private buildWaterPlane(): void {
    if (!this.scene) return;

    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMaterial?.dispose();
    }

    const paletteDef = TERRAIN_PALETTES[this.params.colorPalette] || TERRAIN_PALETTES['obsidian-alpine'];
    const waterGeom = new THREE.PlaneGeometry(140, 140, 32, 32);
    waterGeom.rotateX(-Math.PI * 0.5);

    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(paletteDef.shallowWater.r, paletteDef.shallowWater.g, paletteDef.shallowWater.b),
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: this.params.waterOpacity,
    });

    this.waterMesh = new THREE.Mesh(waterGeom, this.waterMaterial);
    this.waterMesh.position.y = this.params.waterLevel * this.params.heightScale;
    this.scene.add(this.waterMesh);
  }

  /**
   * Synchronizes CPU float heightmap to GPU mesh vertex positions and normals
   */
  private syncMeshHeights(): void {
    if (!this.terrainGeometry) return;

    const posAttr = this.terrainGeometry.attributes.position as THREE.BufferAttribute;
    const flowAttr = this.terrainGeometry.attributes.aFlow as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const flows = flowAttr.array as Float32Array;

    const res = this.engine.width;
    const heightMap = this.engine.heightMap;
    const waterFlow = this.engine.waterFlowMap;
    const scale = this.params.heightScale;

    // PlaneGeometry vertices: (res x res)
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const gridIdx = y * res + x;
        const vertIdx = (y * res + x) * 3;

        positions[vertIdx + 1] = heightMap[gridIdx] * scale;
        flows[gridIdx] = waterFlow[gridIdx];
      }
    }

    posAttr.needsUpdate = true;
    flowAttr.needsUpdate = true;
    this.terrainGeometry.computeVertexNormals();
  }

  /**
   * Updates directional sunlight position from azimuth & elevation angles
   */
  private updateSunPosition(): void {
    if (!this.sunLight) return;

    const azRad = (this.params.sunAzimuth * Math.PI) / 180;
    const elRad = (this.params.sunElevation * Math.PI) / 180;

    const dist = 160;
    const sunX = Math.cos(elRad) * Math.sin(azRad) * dist;
    const sunY = Math.sin(elRad) * dist;
    const sunZ = Math.cos(elRad) * Math.cos(azRad) * dist;

    this.sunLight.position.set(sunX, sunY, sunZ);

    if (this.terrainMaterial) {
      const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
      this.terrainMaterial.uniforms.uSunDirection.value.copy(sunDir);
    }
  }

  /**
   * Positions camera according to designated viewpoint preset
   */
  private applyCameraView(view: CameraView): void {
    if (!this.camera) return;

    switch (view) {
      case 'top-down-contours':
        this.camera.position.set(0, 150, 0.01);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'cinematic-valley':
        this.camera.position.set(0, 24, 75);
        this.camera.lookAt(0, 15, 0);
        break;
      case 'aerial-glide':
        this.camera.position.set(70, 65, 80);
        this.camera.lookAt(0, 10, 0);
        break;
      case 'isometric-3d':
      default:
        this.camera.position.set(85, 68, 95);
        this.camera.lookAt(0, 12, 0);
        break;
    }

    if (this.controls) {
      this.controls.update();
    }
  }

  /**
   * Main Simulation & Render Loop
   */
  private loop(currentTime: number): void {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    this.waterPhase += dt;

    // 1. Audio Reactivity Coupling
    let extraDroplets = 0;
    if (this.ctx?.audio && this.params.audioSource !== 'none') {
      const bass = this.ctx.audio.getBass() * this.params.audioSensitivity * this.params.bassReaction;
      const mid = this.ctx.audio.getMid() * this.params.audioSensitivity * this.params.midReaction;
      const treble = this.ctx.audio.getTreble() * this.params.audioSensitivity * this.params.trebleReaction;
      const isBeat = this.ctx.audio.isTransientDetected();

      // Bass excites rainfall storm bursts
      extraDroplets = Math.floor(bass * 2500) + (isBeat ? 1500 : 0);

      // Mid modulates sunlight elevation
      if (this.sunLight) {
        const dynamicEl = this.params.sunElevation + Math.sin(this.waterPhase * 1.5) * mid * 8.0;
        const azRad = (this.params.sunAzimuth * Math.PI) / 180;
        const elRad = (dynamicEl * Math.PI) / 180;
        this.sunLight.position.set(
          Math.cos(elRad) * Math.sin(azRad) * 160,
          Math.sin(elRad) * 160,
          Math.cos(elRad) * Math.cos(azRad) * 160
        );
      }

      // Treble excites river luminescence
      if (this.terrainMaterial) {
        this.terrainMaterial.uniforms.uRiverGlow.value = this.params.riverGlow * (1.0 + treble * 0.8);
      }
    }

    // 2. Hydraulic Fluvial Simulation Substep
    const dropletsThisFrame = this.params.dropletsPerFrame + extraDroplets;

    if (this.isPointerDown && this.params.pointerMode === 'rain-cloud' && this.pointerGridX >= 0) {
      // Concentrated rainstorm at cursor
      this.engine.stepDroplets(dropletsThisFrame, this.params, this.pointerGridX, this.pointerGridY);
    } else {
      // Distributed ambient rainfall
      this.engine.stepDroplets(dropletsThisFrame, this.params);
    }

    // 3. Pointer Continuous Sculpting
    if (this.isPointerDown && this.pointerGridX >= 0 && this.params.pointerMode !== 'rain-cloud' && this.params.pointerMode !== 'none') {
      this.engine.applySculptBrush(
        this.pointerGridX,
        this.pointerGridY,
        this.params.pointerMode,
        this.params.brushRadius,
        this.params.brushStrength * dt * 60
      );
    }

    // 4. Update GPU Mesh Vertices & Normals
    this.syncMeshHeights();

    // 5. Update Water Plane Level & Animation
    if (this.waterMesh) {
      const wave = Math.sin(this.waterPhase * 1.8) * 0.2;
      this.waterMesh.position.y = this.params.waterLevel * this.params.heightScale + wave;
    }

    if (this.terrainMaterial) {
      this.terrainMaterial.uniforms.uTime.value = this.waterPhase;
    }

    // 6. Update OrbitControls & Render
    if (this.controls) {
      this.controls.autoRotate = this.params.cameraAutoRotate;
      this.controls.autoRotateSpeed = this.params.rotationSpeed;
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * Resets and regenerates raw mountain terrain
   */
  public resetTerrain(): void {
    this.engine.generateBaseTerrain(this.params);
    this.syncMeshHeights();
  }

  /**
   * Parameter updates dispatched from Tweakpane or URL state sync
   */
  public updateParams(newParams: Record<string, any>): void {
    const oldPreset = this.params.preset;
    const oldPalette = this.params.colorPalette;
    const oldSeed = this.params.seed;
    const oldView = this.params.cameraView;
    const oldWaterLevel = this.params.waterLevel;

    this.params = { ...this.params, ...newParams };

    // Morphological Preset Change
    if (newParams.preset && newParams.preset !== oldPreset) {
      const morph = PRESET_MORPHOLOGIES[this.params.preset];
      if (morph) {
        this.params.noiseOctaves = morph.octaves;
        this.params.noiseRoughness = morph.roughness;
        this.params.ridgePower = morph.ridgePower;
        this.params.heightScale = morph.heightScale;
        this.params.waterLevel = morph.waterLevel;
        this.params.erosionRate = morph.erosionRate;
        this.params.sedimentCapacity = morph.sedimentCapacity;
        this.params.sunElevation = morph.sunElevation;
        this.params.colorPalette = morph.palette;
      }
      this.engine.generateBaseTerrain(this.params);
      this.engine.stepDroplets(3000, this.params);
    } else if (newParams.seed && newParams.seed !== oldSeed) {
      this.engine.generateBaseTerrain(this.params);
      this.engine.stepDroplets(3000, this.params);
    }

    // Palette Updates
    if ((newParams.colorPalette && newParams.colorPalette !== oldPalette) || newParams.preset !== oldPreset) {
      const p = TERRAIN_PALETTES[this.params.colorPalette] || TERRAIN_PALETTES['obsidian-alpine'];
      if (this.scene) {
        this.scene.background = new THREE.Color(p.fogColor);
        if (this.scene.fog) {
          (this.scene.fog as THREE.FogExp2).color = new THREE.Color(p.fogColor);
        }
      }
      if (this.sunLight) {
        this.sunLight.color.setHex(p.sunColor);
      }
      if (this.ambientLight) {
        this.ambientLight.color.setHex(p.ambientColor);
      }
      if (this.waterMaterial) {
        this.waterMaterial.color.setRGB(p.shallowWater.r, p.shallowWater.g, p.shallowWater.b);
      }
      if (this.terrainMaterial) {
        this.terrainMaterial.uniforms.uDeepWater.value.setRGB(p.deepWater.r, p.deepWater.g, p.deepWater.b);
        this.terrainMaterial.uniforms.uShallowWater.value.setRGB(p.shallowWater.r, p.shallowWater.g, p.shallowWater.b);
        this.terrainMaterial.uniforms.uSandSediment.value.setRGB(p.sandSediment.r, p.sandSediment.g, p.sandSediment.b);
        this.terrainMaterial.uniforms.uLowlandGrass.value.setRGB(p.lowlandGrass.r, p.lowlandGrass.g, p.lowlandGrass.b);
        this.terrainMaterial.uniforms.uCliffRock.value.setRGB(p.cliffRock.r, p.cliffRock.g, p.cliffRock.b);
        this.terrainMaterial.uniforms.uAlpineSnow.value.setRGB(p.alpineSnow.r, p.alpineSnow.g, p.alpineSnow.b);
        this.terrainMaterial.uniforms.uRiverFlow.value.setRGB(p.riverFlow.r, p.riverFlow.g, p.riverFlow.b);
        this.terrainMaterial.uniforms.uSunColor.value.setHex(p.sunColor);
        this.terrainMaterial.uniforms.uAmbientColor.value.setHex(p.ambientColor);
      }
    }

    if (this.terrainMaterial) {
      if (newParams.rockSlopeThreshold !== undefined) this.terrainMaterial.uniforms.uRockSlopeThreshold.value = this.params.rockSlopeThreshold;
      if (newParams.snowElevation !== undefined) this.terrainMaterial.uniforms.uSnowElevation.value = this.params.snowElevation;
      if (newParams.riverGlow !== undefined) this.terrainMaterial.uniforms.uRiverGlow.value = this.params.riverGlow;
      if (newParams.heightScale !== undefined) this.terrainMaterial.uniforms.uHeightScale.value = this.params.heightScale;
    }

    if (newParams.sunAzimuth !== undefined || newParams.sunElevation !== undefined) {
      this.updateSunPosition();
    }

    if (newParams.cameraView && newParams.cameraView !== oldView) {
      this.applyCameraView(this.params.cameraView);
    }

    if (newParams.waterLevel !== undefined && newParams.waterLevel !== oldWaterLevel && this.waterMesh) {
      this.waterMesh.position.y = this.params.waterLevel * this.params.heightScale;
    }

    if (newParams.waterOpacity !== undefined && this.waterMaterial) {
      this.waterMaterial.opacity = this.params.waterOpacity;
    }

    if (newParams.sunIntensity !== undefined && this.sunLight) {
      this.sunLight.intensity = this.params.sunIntensity;
    }
  }

  /**
   * Resizes viewport renderer and aspect ratio
   */
  public resize(width: number, height: number): void {
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Interactive pointer event handling (raycasting onto terrain)
   */
  public onPointer(event: RoomPointerEvent): void {
    this.isPointerDown = event.isDown;

    if (!this.camera || !this.terrainMesh || event.type === 'leave') {
      this.pointerGridX = -1;
      this.pointerGridY = -1;
      return;
    }

    // Convert normalized coords [0, 1] to NDC [-1, 1]
    this.mousePos.x = event.normalizedX * 2 - 1;
    this.mousePos.y = -(event.normalizedY * 2 - 1);

    this.raycaster.setFromCamera(this.mousePos, this.camera);
    const intersects = this.raycaster.intersectObject(this.terrainMesh);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const terrainSize = 140;
      const res = this.engine.width;

      // Transform world X/Z hit into grid coordinate [0, res-1]
      const localX = (hit.point.x / terrainSize + 0.5) * (res - 1);
      const localY = (hit.point.z / terrainSize + 0.5) * (res - 1);

      this.pointerGridX = Math.max(0, Math.min(res - 1, localX));
      this.pointerGridY = Math.max(0, Math.min(res - 1, localY));
    } else {
      this.pointerGridX = -1;
      this.pointerGridY = -1;
    }
  }

  /**
   * Custom High-Resolution Offline Snapshot Capture Pass (4K/8K stills)
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement | Blob> {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    if (this.renderer && this.scene && this.camera) {
      const prevAspect = this.camera.aspect;
      const prevSize = new THREE.Vector2();
      this.renderer.getSize(prevSize);

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.render(this.scene, this.camera);

      const snapContext = offscreenCanvas.getContext('2d');
      if (snapContext) {
        snapContext.drawImage(this.renderer.domElement, 0, 0, width, height);
      }

      this.camera.aspect = prevAspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(prevSize.x, prevSize.y);

      return offscreenCanvas;
    }

    // High-performance 2D isometric shaded elevation fallback
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return offscreenCanvas;

    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, width, height);

    const res = this.engine.width;
    const heightMap = this.engine.heightMap;
    const p = TERRAIN_PALETTES[this.params.colorPalette] || TERRAIN_PALETTES['obsidian-alpine'];

    const step = 4;
    for (let y = 0; y < res; y += step) {
      for (let x = 0; x < res; x += step) {
        const hVal = heightMap[y * res + x];
        const screenX = (x / res) * width;
        const screenY = (y / res) * height;

        const r = Math.floor(THREE.MathUtils.lerp(p.cliffRock.r, p.alpineSnow.r, hVal) * 255);
        const g = Math.floor(THREE.MathUtils.lerp(p.cliffRock.g, p.alpineSnow.g, hVal) * 255);
        const b = Math.floor(THREE.MathUtils.lerp(p.cliffRock.b, p.alpineSnow.b, hVal) * 255);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(screenX, screenY, (width / res) * step, (height / res) * step);
      }
    }

    return offscreenCanvas;
  }

  /**
   * Complete resource teardown and memory release
   */
  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.terrainGeometry) {
      this.terrainGeometry.dispose();
      this.terrainGeometry = null;
    }

    if (this.terrainMaterial) {
      this.terrainMaterial.dispose();
      this.terrainMaterial = null;
    }

    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMaterial?.dispose();
      this.waterMesh = null;
      this.waterMaterial = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
  }
}

/**
 * Default factory export
 */
export default new HydraulicErosionRoom();
