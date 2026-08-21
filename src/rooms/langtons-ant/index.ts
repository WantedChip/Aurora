/**
 * Room 25: Langton's Ant & Turmites (Multi-Color 2D Automata & Emergent Highways)
 * Curatorial Category: Morphogenesis & Landscape
 * Math Model: Discrete 2D Universal Turing Machines, Multi-Color Turn Rules & Turmites
 * Compute Engine: High-Performance Flat TypedArray Lattice & 32-bit LUT Canvas2D Streamer
 * Aesthetic Direction: Obsidian Archival Minimal (#090A0D)
 * 
 * Features:
 * - High-speed discrete 2D Turing machine solver executing 1,000–50,000 substeps per frame at 60 FPS
 * - Classic Langton's Ant (RL): initial simplicity (t < 500), chaos (500 < t < 10,000), emergent 104-step diagonal highway (t > 10,000)
 * - Generalized multi-color rules: RLR (triangular fractal), LLRR (cardioid symmetry), LRRRRRLLR (highway locomotives), LLRL (square carpet), etc.
 * - Multi-state 2D Turmite engine (spiral labyrinths, caterpillar highways)
 * - Multi-ant swarms (1 to 16 ants) with concurrent collision interactions and collaborative highway generation
 * - 7 Curatorial Spectral Palettes (Obsidian Emerald, Spectral Aurora, Solar Plasma, Cyber Neon, Cosmic Amethyst, Monochrome Lithic, Bioluminescent Abyss)
 * - 32-bit LUT (Look-Up Table) direct pixel buffer streaming with zero per-frame garbage collection
 * - Ant cursor heads with directional chevrons, luminous halos, and optional glowing phosphorescent ghost trails
 * - Interactive pointer tools: spawn ants, paint cells, invert states, erase regions, and electrostatic deflectors
 * - Web Audio API spectral reactivity: Bass speed surges, Mid palette drift, Treble beacon shimmer
 * - Offline high-resolution snapshot export (2K/4K/8K stills)
 * - Complete resource disposal lifecycle
 */

import type {
  RoomInstance,
  RoomContext,
  RoomCleanupFn,
  RoomPointerEvent,
} from '../types';
import { createPRNG, type PRNG } from '../../lib/prng';
import { dampParameter } from '../../lib/state';

export type LangtonsAntPreset =
  | 'classic-rl'
  | 'triangular-rlr'
  | 'symmetric-llrr'
  | 'highway-builder'
  | 'square-carpet'
  | 'chaotic-nebula'
  | 'dual-highway-battle'
  | 'quad-colony-rosette'
  | 'octa-swarm-mandala'
  | 'complex-tapestry-12'
  | 'turmite-spiral'
  | 'turmite-highway';

export type ColonyLayout =
  | 'center'
  | 'pair-symmetric'
  | 'cross-quad'
  | 'hex-ring'
  | 'octa-swarm'
  | 'colony-16'
  | 'random-scatter';

export type AntColorPaletteId =
  | 'obsidian-emerald'
  | 'spectral-aurora'
  | 'solar-plasma'
  | 'cyber-neon'
  | 'cosmic-amethyst'
  | 'monochrome-lithic'
  | 'bioluminescent-abyss';

export type AntHeadStyle = 'chevron' | 'glowing-disc' | 'pulsing-star' | 'none';

export type AntPointerMode =
  | 'spawn-ant'
  | 'draw-cells'
  | 'invert-cells'
  | 'clear-region'
  | 'repel-ants'
  | 'none';

export interface LangtonsAntParams {
  seed: string;
  preset: LangtonsAntPreset;
  ruleString: string;
  antCount: number;
  colonyLayout: ColonyLayout;
  speedSteps: number;
  gridResolution: number;
  colorPalette: AntColorPaletteId;
  paletteCycleSpeed: number;
  antHeadStyle: AntHeadStyle;
  antHeadSize: number;
  speedTrails: boolean;
  trailDecay: number;
  gridLines: boolean;
  contrast: number;
  pointerMode: AntPointerMode;
  brushRadius: number;
  brushColor: number;
  audioSource: 'synth' | 'mic' | 'none';
  audioSensitivity: number;
  bassReaction: number;
  midReaction: number;
  trebleReaction: number;
}

export const DEFAULT_LANGTONS_ANT_PARAMS: LangtonsAntParams = {
  seed: '#00FF9D',
  preset: 'classic-rl',
  ruleString: 'RL',
  antCount: 1,
  colonyLayout: 'center',
  speedSteps: 12000,
  gridResolution: 300,
  colorPalette: 'obsidian-emerald',
  paletteCycleSpeed: 0.0,
  antHeadStyle: 'chevron',
  antHeadSize: 3.5,
  speedTrails: true,
  trailDecay: 0.08,
  gridLines: false,
  contrast: 1.2,
  pointerMode: 'spawn-ant',
  brushRadius: 6,
  brushColor: 1,
  audioSource: 'synth',
  audioSensitivity: 1.0,
  bassReaction: 1.5,
  midReaction: 1.0,
  trebleReaction: 1.4,
};

export interface AntPresetDefinition {
  name: string;
  ruleString: string;
  antCount: number;
  colonyLayout: ColonyLayout;
  speedSteps: number;
  gridResolution: number;
  colorPalette: AntColorPaletteId;
  speedTrails: boolean;
  isTurmite?: boolean;
  turmiteTransitions?: Record<string, { nextState: number; nextColor: number; turn: string }>;
  description: string;
}

export const ANT_PRESETS: Record<LangtonsAntPreset, AntPresetDefinition> = {
  'classic-rl': {
    name: "Classic Langton's Ant (RL)",
    ruleString: 'RL',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 12000,
    gridResolution: 300,
    colorPalette: 'obsidian-emerald',
    speedTrails: true,
    description: 'The foundational 2-state discrete Turing machine. Evolves from early symmetry through chaotic dispersion (t < 10,000) and emerges into an infinite 104-step diagonal highway.',
  },
  'triangular-rlr': {
    name: 'Triangular Fractal Growth (RLR)',
    ruleString: 'RLR',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 15000,
    gridResolution: 300,
    colorPalette: 'spectral-aurora',
    speedTrails: true,
    description: '3-color rule producing an expanding concentric triangular fractal envelope with complex interior filigree.',
  },
  'symmetric-llrr': {
    name: 'Cardioid Symmetry (LLRR)',
    ruleString: 'LLRR',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 15000,
    gridResolution: 300,
    colorPalette: 'solar-plasma',
    speedTrails: true,
    description: '4-color rule expanding symmetrically into a growing diamond-cardioid mosaic with perfect 4-fold reflective symmetry.',
  },
  'highway-builder': {
    name: 'Highway Builder (LRRRRRLLR)',
    ruleString: 'LRRRRRLLR',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 20000,
    gridResolution: 360,
    colorPalette: 'cyber-neon',
    speedTrails: true,
    description: '9-color rule generating complex repeating highway locomotives that periodically branch and pave multi-colored avenues.',
  },
  'square-carpet': {
    name: 'Square Carpet (LLRL)',
    ruleString: 'LLRL',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 15000,
    gridResolution: 300,
    colorPalette: 'cosmic-amethyst',
    speedTrails: true,
    description: 'Generates dense, nested concentric square borders and recursive Sierpinski carpet-like chambers.',
  },
  'chaotic-nebula': {
    name: 'Chaotic Nebula (RLLR)',
    ruleString: 'RLLR',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 16000,
    gridResolution: 300,
    colorPalette: 'bioluminescent-abyss',
    speedTrails: true,
    description: 'Dense turbulent diffusion that slowly expands with rich organic texture without locking into simple highways.',
  },
  'dual-highway-battle': {
    name: 'Dual Highway Battle (2 Ants RL)',
    ruleString: 'RL',
    antCount: 2,
    colonyLayout: 'pair-symmetric',
    speedSteps: 16000,
    gridResolution: 320,
    colorPalette: 'spectral-aurora',
    speedTrails: true,
    description: 'Two opposing ants initialized in close proximity interact, collide, destroy each other\'s highways, and build interconnected dual highways.',
  },
  'quad-colony-rosette': {
    name: 'Quad Colony Rosette (4 Ants RLR)',
    ruleString: 'RLR',
    antCount: 4,
    colonyLayout: 'cross-quad',
    speedSteps: 20000,
    gridResolution: 360,
    colorPalette: 'obsidian-emerald',
    speedTrails: true,
    description: '4 cardinal ants expanding simultaneously, generating a breathtaking multi-cellular 4-fold rosette tapestry.',
  },
  'octa-swarm-mandala': {
    name: 'Octa-Swarm Mandala (8 Ants LLRR)',
    ruleString: 'LLRR',
    antCount: 8,
    colonyLayout: 'octa-swarm',
    speedSteps: 24000,
    gridResolution: 400,
    colorPalette: 'cyber-neon',
    speedTrails: true,
    description: '8 ants distributed radially in a circle weaving high-speed kaleidoscopic cellular webs.',
  },
  'complex-tapestry-12': {
    name: 'Complex Tapestry (RRLLLRLLLRRR)',
    ruleString: 'RRLLLRLLLRRR',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 25000,
    gridResolution: 360,
    colorPalette: 'monochrome-lithic',
    speedTrails: true,
    description: '12-color rule with rich undulating micro-structures and long periodic highways.',
  },
  'turmite-spiral': {
    name: 'Turmite Spiral Labyrinth',
    ruleString: 'TURMITE',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 15000,
    gridResolution: 300,
    colorPalette: 'obsidian-emerald',
    speedTrails: true,
    isTurmite: true,
    turmiteTransitions: {
      '0_0': { nextState: 1, nextColor: 1, turn: 'R' },
      '0_1': { nextState: 0, nextColor: 0, turn: 'L' },
      '1_0': { nextState: 1, nextColor: 1, turn: 'L' },
      '1_1': { nextState: 0, nextColor: 0, turn: 'R' },
    },
    description: '2-state 2-color Turing machine that carves winding recursive spiral labyrinths.',
  },
  'turmite-highway': {
    name: 'Turmite Moving Highway',
    ruleString: 'TURMITE',
    antCount: 1,
    colonyLayout: 'center',
    speedSteps: 18000,
    gridResolution: 300,
    colorPalette: 'solar-plasma',
    speedTrails: true,
    isTurmite: true,
    turmiteTransitions: {
      '0_0': { nextState: 1, nextColor: 1, turn: 'R' },
      '0_1': { nextState: 1, nextColor: 0, turn: 'F' },
      '1_0': { nextState: 0, nextColor: 0, turn: 'F' },
      '1_1': { nextState: 0, nextColor: 1, turn: 'R' },
    },
    description: '2-state Turmite generating a dense, persistent locomotive highway caterpillar.',
  },
};

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export const ANT_PALETTES: Record<AntColorPaletteId, RGBColor[]> = {
  'obsidian-emerald': [
    { r: 9, g: 10, b: 13 },     // Void Obsidian #090A0D (State 0)
    { r: 13, g: 56, b: 42 },    // Deep Forest Jade
    { r: 0, g: 255, b: 157 },   // Vivid Mint #00FF9D
    { r: 125, g: 255, b: 179 }, // Phosphor Lime
    { r: 0, g: 240, b: 255 },   // Electric Cyan #00F0FF
    { r: 244, g: 246, b: 251 }, // Starlight White #F4F6FB
  ],
  'spectral-aurora': [
    { r: 9, g: 10, b: 13 },     // Void Obsidian #090A0D
    { r: 29, g: 30, b: 58 },    // Midnight Slate
    { r: 0, g: 240, b: 255 },   // Neon Cyan #00F0FF
    { r: 168, g: 85, b: 247 },  // Electric Violet #A855F7
    { r: 255, g: 42, b: 109 },  // Vivid Magenta #FF2A6D
    { r: 255, g: 245, b: 157 }, // Solar Primrose
  ],
  'solar-plasma': [
    { r: 9, g: 10, b: 13 },     // Void Obsidian #090A0D
    { r: 74, g: 14, b: 23 },    // Deep Magma
    { r: 217, g: 72, b: 15 },   // Molten Crimson
    { r: 255, g: 184, b: 0 },   // Solar Amber #FFB800
    { r: 255, g: 224, b: 102 }, // Sunlight Gold
    { r: 255, g: 255, b: 255 }, // White Flare
  ],
  'cyber-neon': [
    { r: 9, g: 10, b: 13 },     // Void Obsidian #090A0D
    { r: 0, g: 27, b: 68 },     // Deep Cobalt
    { r: 0, g: 119, b: 254 },   // Laser Azure #0077FE
    { r: 255, g: 0, b: 127 },   // Shocking Pink #FF007F
    { r: 0, g: 255, b: 102 },   // Acid Green #00FF66
    { r: 255, g: 252, b: 0 },   // Electric Yellow
  ],
  'cosmic-amethyst': [
    { r: 9, g: 10, b: 13 },     // Void Obsidian #090A0D
    { r: 42, g: 8, b: 69 },     // Abyssal Plum
    { r: 107, g: 33, b: 168 },  // Imperial Purple
    { r: 192, g: 132, b: 252 }, // Luminous Amethyst #C084FC
    { r: 244, g: 114, b: 182 }, // Starlight Rose
    { r: 248, g: 250, b: 252 }, // Glacial Pure
  ],
  'monochrome-lithic': [
    { r: 9, g: 10, b: 13 },     // Void Obsidian #090A0D
    { r: 31, g: 36, b: 48 },    // Dark Basalt
    { r: 71, g: 85, b: 105 },   // Slate Grey
    { r: 148, g: 163, b: 184 }, // Cool Silver
    { r: 203, g: 213, b: 225 }, // Sterling Platinum
    { r: 248, g: 250, b: 252 }, // Pure White
  ],
  'bioluminescent-abyss': [
    { r: 5, g: 8, b: 17 },      // Deep Trench #050811
    { r: 0, g: 51, b: 102 },    // Abyssal Blue
    { r: 0, g: 128, b: 128 },   // Marine Teal
    { r: 0, g: 229, b: 255 },   // Bioluminescent Cyan #00E5FF
    { r: 105, g: 240, b: 174 }, // Seafoam Spore
    { r: 224, g: 247, b: 250 }, // Phosphor Glimmer
  ],
};

/**
 * Samples an RGB color from an ant palette given a normalized parameter t in [0, 1].
 */
export function sampleAntColor(paletteId: AntColorPaletteId, t: number): RGBColor {
  const stops = ANT_PALETTES[paletteId] || ANT_PALETTES['obsidian-emerald'];
  const n = stops.length;
  if (n === 0) return { r: 255, g: 255, b: 255 };
  if (n === 1) return stops[0];

  const clampedT = Math.max(0, Math.min(1, t));
  const scaled = clampedT * (n - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  if (idx >= n - 1) {
    return stops[n - 1];
  }

  const c0 = stops[idx];
  const c1 = stops[idx + 1];

  return {
    r: Math.round(c0.r + (c1.r - c0.r) * frac),
    g: Math.round(c0.g + (c1.g - c0.g) * frac),
    b: Math.round(c0.b + (c1.b - c0.b) * frac),
  };
}

/**
 * Returns formatted RGBA string for canvas styling.
 */
export function getAntPaletteColor(
  paletteId: AntColorPaletteId,
  t: number,
  cycleOffset = 0,
  alpha = 1.0
): string {
  const effectiveT = (t + cycleOffset) % 1.0;
  const c = sampleAntColor(paletteId, effectiveT < 0 ? effectiveT + 1.0 : effectiveT);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha.toFixed(3)})`;
}

// Direction Offsets: 0: Up (North), 1: Right (East), 2: Down (South), 3: Left (West)
export const DIR_DX = [0, 1, 0, -1] as const;
export const DIR_DY = [-1, 0, 1, 0] as const;

export interface AntAgent {
  x: number;
  y: number;
  dir: number; // 0, 1, 2, 3
  state: number; // For Turmites
  id: number;
  colorCss: string;
  steps: number;
  historyX: Float32Array;
  historyY: Float32Array;
  historyIndex: number;
}

const MAX_ANTS_CAPACITY = 32;
const MAX_COLORS_CAPACITY = 32;
const MAX_TURMITE_STATES = 8;
const GHOST_TRAIL_LENGTH = 120;

export class LangtonsAntRoom implements RoomInstance {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private prng: PRNG = createPRNG('#00FF9D');
  private rafId: number | null = null;
  private audioContext: any = null;

  public params: LangtonsAntParams = { ...DEFAULT_LANGTONS_ANT_PARAMS };
  private smoothedParams: LangtonsAntParams = { ...DEFAULT_LANGTONS_ANT_PARAMS };

  // Grid & Lattice Dimensions
  public gridWidth = 300;
  public gridHeight = 300;
  public grid: Uint8Array = new Uint8Array(300 * 300);

  // 32-bit Direct Pixel Buffer for Blitting
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private imgData: ImageData | null = null;
  private pixels32: Uint32Array | null = null;

  // Pre-computed 32-bit LUT (Look-Up Table) for fast color mapping
  public paletteLUT32 = new Uint32Array(MAX_COLORS_CAPACITY);
  public paletteRGB: RGBColor[] = [];

  // Ant Swarm
  public ants: AntAgent[] = [];
  public totalSimSteps = 0;

  // Multi-Color Rule Table
  // Turn delta: R = +1, L = +3 (or -1 mod 4), F = 0, U/B = +2
  public turnTable = new Int8Array(MAX_COLORS_CAPACITY);
  public ruleLength = 2;
  public ruleStringClean = 'RL';

  // Turmite Multi-State Transition Table
  public isTurmite = false;
  // Key = (state * MAX_COLORS_CAPACITY + color)
  public turmiteTurns = new Int8Array(MAX_TURMITE_STATES * MAX_COLORS_CAPACITY);
  public turmiteNextColors = new Uint8Array(MAX_TURMITE_STATES * MAX_COLORS_CAPACITY);
  public turmiteNextStates = new Uint8Array(MAX_TURMITE_STATES * MAX_COLORS_CAPACITY);

  // Pointer Interaction
  private isPointerDown = false;
  private pointerGridX = -1;
  private pointerGridY = -1;

  // Viewport & Simulation State
  private paletteCyclePhase = 0;
  private lastTime = 0;

  constructor() {
    this.initLattice(300, 300);
    this.applyPreset(DEFAULT_LANGTONS_ANT_PARAMS.preset, false);
  }

  /**
   * Initializes or resizes the flat discrete lattice.
   */
  public initLattice(w: number, h: number): void {
    this.gridWidth = w;
    this.gridHeight = h;
    const totalCells = w * h;
    this.grid = new Uint8Array(totalCells);

    if (typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = w;
      this.offscreenCanvas.height = h;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
      if (this.offscreenCtx) {
        this.imgData = this.offscreenCtx.createImageData(w, h);
        this.pixels32 = new Uint32Array(this.imgData.data.buffer);
      }
    }
  }

  /**
   * Parses rule string or Turmite table and builds look-up tables.
   */
  public setRule(rule: string): void {
    const clean = rule.toUpperCase().replace(/[^RLFUBN]/g, '');
    if (!clean) return;

    this.isTurmite = false;
    this.ruleStringClean = clean;
    this.ruleLength = clean.length;

    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (char === 'R') {
        this.turnTable[i] = 1; // +90° clockwise
      } else if (char === 'L') {
        this.turnTable[i] = 3; // -90° (+270° mod 4) counter-clockwise
      } else if (char === 'U' || char === 'B') {
        this.turnTable[i] = 2; // 180° U-turn
      } else {
        this.turnTable[i] = 0; // Forward / No turn
      }
    }

    this.rebuildPaletteLUT();
  }

  /**
   * Configures a Turmite multi-state transition model.
   */
  public setTurmite(
    transitions: Record<string, { nextState: number; nextColor: number; turn: string }>,
    numColors = 2
  ): void {
    this.isTurmite = true;
    this.ruleLength = Math.max(2, Math.min(numColors, 8));
    this.ruleStringClean = 'TURMITE';

    this.turmiteTurns.fill(0);
    this.turmiteNextColors.fill(0);
    this.turmiteNextStates.fill(0);

    for (const [key, val] of Object.entries(transitions)) {
      const parts = key.split('_');
      if (parts.length < 2) continue;
      const s = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      if (isNaN(s) || isNaN(c)) continue;

      const idx = s * MAX_COLORS_CAPACITY + c;
      const t = val.turn.toUpperCase();
      this.turmiteTurns[idx] = t === 'R' ? 1 : t === 'L' ? 3 : t === 'U' ? 2 : 0;
      this.turmiteNextColors[idx] = val.nextColor;
      this.turmiteNextStates[idx] = val.nextState;
    }

    this.rebuildPaletteLUT();
  }

  /**
   * Rebuilds the 32-bit LUT from the current color palette.
   */
  public rebuildPaletteLUT(): void {
    const paletteId = this.params.colorPalette || 'obsidian-emerald';
    const K = Math.max(2, this.ruleLength);
    this.paletteRGB = [];

    // State 0 is always the Obsidian Void base (#090A0D)
    const baseVoid: RGBColor = { r: 9, g: 10, b: 13 };
    this.paletteRGB.push(baseVoid);

    for (let c = 1; c < K; c++) {
      const t = (c - 1) / Math.max(1, K - 1);
      const color = sampleAntColor(paletteId, t);
      this.paletteRGB.push(color);
    }

    // Bake into 32-bit Little-Endian ABGR values: 0xAABBGGRR
    for (let c = 0; c < K; c++) {
      const rgb = this.paletteRGB[c];
      const r = rgb.r;
      const g = rgb.g;
      const b = rgb.b;
      const a = 255;
      // Little-endian Uint32 format: (A << 24) | (B << 16) | (G << 8) | R
      this.paletteLUT32[c] = (a << 24) | (b << 16) | (g << 8) | r;
    }
  }

  /**
   * Resets the entire lattice to 0 and clears simulation metrics.
   */
  public resetGrid(): void {
    this.grid.fill(0);
    this.totalSimSteps = 0;
    this.initColony(this.params.antCount, this.params.colonyLayout);
  }

  /**
   * Initializes the ant colony positions and headings.
   */
  public initColony(count: number, layout: ColonyLayout): void {
    this.ants = [];
    const clampedCount = Math.max(1, Math.min(count, MAX_ANTS_CAPACITY));
    const cx = Math.floor(this.gridWidth / 2);
    const cy = Math.floor(this.gridHeight / 2);

    const antColors = [
      '#00FF9D', '#00F0FF', '#FFB800', '#FF3366',
      '#C084FC', '#38BDF8', '#FEF08A', '#A7F3D0',
      '#F472B6', '#60A5FA', '#34D399', '#FBBF24',
      '#F87171', '#818CF8', '#A78BFA', '#E879F9',
    ];

    switch (layout) {
      case 'center': {
        for (let i = 0; i < clampedCount; i++) {
          this.ants.push(this.createAnt(cx, cy, (i * 1) % 4, i, antColors[i % antColors.length]));
        }
        break;
      }
      case 'pair-symmetric': {
        const offset = Math.min(20, Math.floor(this.gridWidth * 0.08));
        this.ants.push(this.createAnt(cx - offset, cy, 0, 0, antColors[0]));
        if (clampedCount > 1) {
          this.ants.push(this.createAnt(cx + offset, cy, 2, 1, antColors[1]));
        }
        for (let i = 2; i < clampedCount; i++) {
          this.ants.push(this.createAnt(cx, cy + (i % 2 === 0 ? 10 : -10), (i * 2) % 4, i, antColors[i % antColors.length]));
        }
        break;
      }
      case 'cross-quad': {
        const d = Math.min(25, Math.floor(this.gridWidth * 0.1));
        const dirs = [0, 1, 2, 3];
        const coords = [
          { x: cx, y: cy - d },
          { x: cx + d, y: cy },
          { x: cx, y: cy + d },
          { x: cx - d, y: cy },
        ];
        for (let i = 0; i < clampedCount; i++) {
          const c = coords[i % 4];
          this.ants.push(this.createAnt(c.x, c.y, dirs[i % 4], i, antColors[i % antColors.length]));
        }
        break;
      }
      case 'hex-ring':
      case 'octa-swarm':
      case 'colony-16': {
        const total = layout === 'hex-ring' ? 6 : layout === 'octa-swarm' ? 8 : 16;
        const radius = Math.min(35, Math.floor(this.gridWidth * 0.12));
        for (let i = 0; i < clampedCount; i++) {
          const angle = (i / total) * Math.PI * 2;
          const ax = Math.floor(cx + Math.cos(angle) * radius);
          const ay = Math.floor(cy + Math.sin(angle) * radius);
          const dir = Math.floor((angle / (Math.PI * 2)) * 4) % 4;
          this.ants.push(this.createAnt(ax, ay, dir, i, antColors[i % antColors.length]));
        }
        break;
      }
      case 'random-scatter':
      default: {
        for (let i = 0; i < clampedCount; i++) {
          const ax = this.prng.nextInt(Math.floor(this.gridWidth * 0.2), Math.floor(this.gridWidth * 0.8));
          const ay = this.prng.nextInt(Math.floor(this.gridHeight * 0.2), Math.floor(this.gridHeight * 0.8));
          const dir = this.prng.nextInt(0, 3);
          this.ants.push(this.createAnt(ax, ay, dir, i, antColors[i % antColors.length]));
        }
        break;
      }
    }
  }

  private createAnt(x: number, y: number, dir: number, id: number, colorCss: string): AntAgent {
    const historyX = new Float32Array(GHOST_TRAIL_LENGTH);
    const historyY = new Float32Array(GHOST_TRAIL_LENGTH);
    historyX.fill(x);
    historyY.fill(y);

    return {
      x: ((x % this.gridWidth) + this.gridWidth) % this.gridWidth,
      y: ((y % this.gridHeight) + this.gridHeight) % this.gridHeight,
      dir: (dir + 4) % 4,
      state: 0,
      id,
      colorCss,
      steps: 0,
      historyX,
      historyY,
      historyIndex: 0,
    };
  }

  /**
   * Spawns a new ant at specific grid coordinates.
   */
  public spawnAntAt(gridX: number, gridY: number, dir?: number): boolean {
    if (this.ants.length >= MAX_ANTS_CAPACITY) {
      this.ants.shift(); // Remove oldest ant to make room
    }
    const heading = dir !== undefined ? dir : this.prng.nextInt(0, 3);
    const id = this.ants.length;
    const antColors = ['#00FF9D', '#00F0FF', '#FFB800', '#FF3366', '#C084FC', '#38BDF8'];
    const color = antColors[id % antColors.length];

    this.ants.push(this.createAnt(gridX, gridY, heading, id, color));
    return true;
  }

  /**
   * Applies one of the canonical presets.
   */
  public applyPreset(presetId: LangtonsAntPreset, resetLattice = true): void {
    const preset = ANT_PRESETS[presetId] || ANT_PRESETS['classic-rl'];
    this.params.preset = presetId;
    this.params.ruleString = preset.ruleString;
    this.params.antCount = preset.antCount;
    this.params.colonyLayout = preset.colonyLayout;
    this.params.speedSteps = preset.speedSteps;
    this.params.colorPalette = preset.colorPalette;
    this.params.speedTrails = preset.speedTrails;

    if (preset.gridResolution !== this.gridWidth) {
      this.initLattice(preset.gridResolution, preset.gridResolution);
    }

    if (preset.isTurmite && preset.turmiteTransitions) {
      this.setTurmite(preset.turmiteTransitions, 2);
    } else {
      this.setRule(preset.ruleString);
    }

    if (resetLattice) {
      this.resetGrid();
    } else {
      this.initColony(this.params.antCount, this.params.colonyLayout);
    }
  }

  /**
   * Core discrete 2D Turing machine state update loop.
   * Executes `substeps` iterations over flat typed arrays.
   */
  public stepSimulation(substeps: number): void {
    const grid = this.grid;
    const W = this.gridWidth;
    const H = this.gridHeight;
    const K = this.ruleLength;
    const ants = this.ants;
    const antCount = ants.length;
    if (antCount === 0 || substeps <= 0) return;

    if (this.isTurmite) {
      const turmiteTurns = this.turmiteTurns;
      const nextColors = this.turmiteNextColors;
      const nextStates = this.turmiteNextStates;

      for (let s = 0; s < substeps; s++) {
        for (let a = 0; a < antCount; a++) {
          const ant = ants[a];
          const idx = ant.y * W + ant.x;
          const c = grid[idx];

          const key = ant.state * MAX_COLORS_CAPACITY + c;
          const turn = turmiteTurns[key];
          const nextC = nextColors[key];
          const nextS = nextStates[key];

          ant.dir = (ant.dir + turn + 4) & 3;
          grid[idx] = nextC;
          ant.state = nextS;

          ant.x = (ant.x + DIR_DX[ant.dir] + W) % W;
          ant.y = (ant.y + DIR_DY[ant.dir] + H) % H;
          ant.steps++;
        }
      }
    } else {
      const turns = this.turnTable;

      for (let s = 0; s < substeps; s++) {
        for (let a = 0; a < antCount; a++) {
          const ant = ants[a];
          const idx = ant.y * W + ant.x;
          const c = grid[idx];

          const turn = turns[c];
          ant.dir = (ant.dir + turn) & 3;
          grid[idx] = (c + 1) >= K ? 0 : c + 1;

          ant.x = (ant.x + DIR_DX[ant.dir] + W) % W;
          ant.y = (ant.y + DIR_DY[ant.dir] + H) % H;
          ant.steps++;
        }
      }
    }

    this.totalSimSteps += substeps * antCount;

    // Record ghost trail positions
    for (let a = 0; a < antCount; a++) {
      const ant = ants[a];
      ant.historyIndex = (ant.historyIndex + 1) % GHOST_TRAIL_LENGTH;
      ant.historyX[ant.historyIndex] = ant.x;
      ant.historyY[ant.historyIndex] = ant.y;
    }
  }

  /**
   * Applies interactive pointer brush tool effects.
   */
  private applyPointerTool(): void {
    if (!this.isPointerDown || this.pointerGridX < 0 || this.pointerGridY < 0) return;

    const gx = this.pointerGridX;
    const gy = this.pointerGridY;
    const r = Math.max(1, Math.floor(this.params.brushRadius));
    const mode = this.params.pointerMode;
    const W = this.gridWidth;
    const H = this.gridHeight;
    const K = this.ruleLength;

    if (mode === 'draw-cells') {
      const targetColor = Math.min(K - 1, Math.max(0, this.params.brushColor));
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const x = (gx + dx + W) % W;
            const y = (gy + dy + H) % H;
            this.grid[y * W + x] = targetColor;
          }
        }
      }
    } else if (mode === 'invert-cells') {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const x = (gx + dx + W) % W;
            const y = (gy + dy + H) % H;
            const idx = y * W + x;
            this.grid[idx] = (this.grid[idx] + 1) % K;
          }
        }
      }
    } else if (mode === 'clear-region') {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const x = (gx + dx + W) % W;
            const y = (gy + dy + H) % H;
            this.grid[y * W + x] = 0;
          }
        }
      }
    } else if (mode === 'repel-ants') {
      for (const ant of this.ants) {
        const dx = ant.x - gx;
        const dy = ant.y - gy;
        const dist = Math.hypot(dx, dy);
        if (dist < r * 2 && dist > 0.1) {
          ant.x = (ant.x + Math.round((dx / dist) * 8) + W) % W;
          ant.y = (ant.y + Math.round((dy / dist) * 8) + H) % H;
        }
      }
    }
  }

  /**
   * Main render dispatch copying 32-bit pixel buffer and drawing overlays.
   */
  private render(trebleGlow = 0): void {
    if (!this.ctx || !this.canvas || !this.pixels32 || !this.imgData || !this.offscreenCtx || !this.offscreenCanvas) {
      return;
    }

    const W = this.gridWidth;
    const H = this.gridHeight;
    const totalCells = W * H;
    const grid = this.grid;
    const lut = this.paletteLUT32;
    const pixels = this.pixels32;

    // Fast 32-bit integer blit
    for (let i = 0; i < totalCells; i++) {
      pixels[i] = lut[grid[i]];
    }

    this.offscreenCtx.putImageData(this.imgData, 0, 0);

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.fillStyle = '#090A0D';
    ctx.fillRect(0, 0, cw, ch);

    // Calculate aspect ratio and scaling to fit viewport cleanly
    const scale = Math.min(cw / W, ch / H);
    const renderW = W * scale;
    const renderH = H * scale;
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;

    // Nearest-neighbor scaling for pixel-perfect discrete automata
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreenCanvas, offsetX, offsetY, renderW, renderH);

    // Optional fine grid lines when zoomed in
    if (this.params.gridLines && scale >= 5.0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x <= W; x++) {
        const sx = offsetX + x * scale;
        ctx.moveTo(sx, offsetY);
        ctx.lineTo(sx, offsetY + renderH);
      }
      for (let y = 0; y <= H; y++) {
        const sy = offsetY + y * scale;
        ctx.moveTo(offsetX, sy);
        ctx.lineTo(offsetX + renderW, sy);
      }
      ctx.stroke();
    }

    // Ghost Speed Trails
    if (this.params.speedTrails) {
      ctx.lineWidth = Math.max(1.0, scale * 0.8);
      for (const ant of this.ants) {
        ctx.strokeStyle = ant.colorCss.replace(')', ', 0.35)').replace('rgb', 'rgba');
        ctx.beginPath();
        for (let i = 0; i < GHOST_TRAIL_LENGTH; i++) {
          const idx = (ant.historyIndex - i + GHOST_TRAIL_LENGTH) % GHOST_TRAIL_LENGTH;
          const hx = offsetX + (ant.historyX[idx] + 0.5) * scale;
          const hy = offsetY + (ant.historyY[idx] + 0.5) * scale;
          if (i === 0) {
            ctx.moveTo(hx, hy);
          } else {
            ctx.lineTo(hx, hy);
          }
        }
        ctx.stroke();
      }
    }

    // Ant Head Markers
    const headStyle = this.params.antHeadStyle;
    if (headStyle !== 'none') {
      const baseHeadSize = this.params.antHeadSize * Math.max(1.2, scale * 0.6) * (1.0 + trebleGlow * 0.4);

      for (const ant of this.ants) {
        const hx = offsetX + (ant.x + 0.5) * scale;
        const hy = offsetY + (ant.y + 0.5) * scale;
        const angle = ant.dir * (Math.PI / 2); // 0: Up (0 rads is North when rotated -PI/2)

        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(angle - Math.PI / 2);

        if (headStyle === 'chevron') {
          // Directional Sharp Arrow / Chevron
          ctx.fillStyle = ant.colorCss;
          ctx.beginPath();
          ctx.moveTo(baseHeadSize * 1.5, 0); // Tip
          ctx.lineTo(-baseHeadSize, -baseHeadSize * 0.9);
          ctx.lineTo(-baseHeadSize * 0.4, 0);
          ctx.lineTo(-baseHeadSize, baseHeadSize * 0.9);
          ctx.closePath();
          ctx.fill();

          // Luminous White Core
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, 0, baseHeadSize * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else if (headStyle === 'glowing-disc') {
          // Glowing disc with soft halo
          ctx.fillStyle = ant.colorCss;
          ctx.beginPath();
          ctx.arc(0, 0, baseHeadSize * 1.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, 0, baseHeadSize * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (headStyle === 'pulsing-star') {
          // 4-pointed diamond star
          ctx.fillStyle = ant.colorCss;
          ctx.beginPath();
          ctx.moveTo(baseHeadSize * 1.8, 0);
          ctx.lineTo(0, baseHeadSize * 0.6);
          ctx.lineTo(-baseHeadSize * 1.8, 0);
          ctx.lineTo(0, -baseHeadSize * 0.6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, 0, baseHeadSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // Pointer Brush Indicator
    if (this.pointerGridX >= 0 && this.pointerGridY >= 0 && this.params.pointerMode !== 'none') {
      const px = offsetX + (this.pointerGridX + 0.5) * scale;
      const py = offsetY + (this.pointerGridY + 0.5) * scale;
      const pr = this.params.brushRadius * scale;

      ctx.strokeStyle = this.isPointerDown ? 'rgba(0, 255, 157, 0.9)' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /**
   * Mounts the room simulation to the provided canvas and container.
   */
  public async mount(ctx: RoomContext): Promise<RoomCleanupFn> {
    this.canvas = ctx.canvas;
    this.ctx = ctx.canvas.getContext('2d', { alpha: false });
    this.prng = ctx.prng || createPRNG(ctx.params?.seed || '#00FF9D');
    this.audioContext = ctx.audio;

    if (ctx.params) {
      this.updateParams(ctx.params);
    }

    this.lastTime = performance.now();

    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      // Smoothly lerp numerical parameters
      this.smoothedParams.speedSteps = dampParameter(
        this.smoothedParams.speedSteps,
        this.params.speedSteps,
        8.0,
        dt
      );

      // Web Audio API Spectral Reactivity
      let bassBoost = 0;
      let midBoost = 0;
      let trebleBoost = 0;

      if (this.audioContext && this.params.audioSource !== 'none') {
        const bands = this.audioContext.getBands();
        const sensitivity = this.params.audioSensitivity;
        bassBoost = (bands.bass || 0) * this.params.bassReaction * sensitivity;
        midBoost = (bands.mid || 0) * this.params.midReaction * sensitivity;
        trebleBoost = (bands.treble || 0) * this.params.trebleReaction * sensitivity;
      }

      // Calculate effective simulation substeps for this frame
      const effectiveSteps = Math.round(
        this.smoothedParams.speedSteps * (1.0 + bassBoost * 0.8)
      );

      // Execute simulation substeps
      this.stepSimulation(effectiveSteps);

      // Apply continuous pointer interaction
      this.applyPointerTool();

      // Dynamic Palette Cycling
      if (this.params.paletteCycleSpeed > 0 || midBoost > 0) {
        this.paletteCyclePhase += dt * (this.params.paletteCycleSpeed + midBoost * 0.5);
        if (this.paletteCyclePhase > 1.0) {
          this.paletteCyclePhase -= 1.0;
        }
      }

      // Render frame
      this.render(trebleBoost);

      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);

    return () => {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.canvas = null;
      this.ctx = null;
    };
  }

  /**
   * Called when simulation parameters change via Tweakpane or URL state sync.
   */
  public updateParams(params: Record<string, any>): void {
    const oldPreset = this.params.preset;
    const oldRule = this.params.ruleString;
    const oldAntCount = this.params.antCount;
    const oldColony = this.params.colonyLayout;
    const oldRes = this.params.gridResolution;
    const oldPalette = this.params.colorPalette;

    Object.assign(this.params, params);

    if (params.preset && params.preset !== oldPreset) {
      this.applyPreset(params.preset, true);
      return;
    }

    if (params.gridResolution && params.gridResolution !== oldRes) {
      this.initLattice(params.gridResolution, params.gridResolution);
      this.resetGrid();
    }

    if (params.ruleString && params.ruleString !== oldRule) {
      this.setRule(params.ruleString);
    }

    if (params.colorPalette && params.colorPalette !== oldPalette) {
      this.rebuildPaletteLUT();
    }

    if (
      (params.antCount !== undefined && params.antCount !== oldAntCount) ||
      (params.colonyLayout !== undefined && params.colonyLayout !== oldColony)
    ) {
      this.initColony(this.params.antCount, this.params.colonyLayout);
    }
  }

  /**
   * Called when viewport dimensions change.
   */
  public resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /**
   * Called when pointer moves or clicks over the interactive viewport.
   */
  public onPointer(event: RoomPointerEvent): void {
    if (!this.canvas) return;

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const W = this.gridWidth;
    const H = this.gridHeight;
    const scale = Math.min(cw / W, ch / H);
    const renderW = W * scale;
    const renderH = H * scale;
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;

    const screenX = event.normalizedX * cw;
    const screenY = event.normalizedY * ch;

    const localX = (screenX - offsetX) / scale;
    const localY = (screenY - offsetY) / scale;

    if (localX >= 0 && localX < W && localY >= 0 && localY < H) {
      this.pointerGridX = Math.floor(localX);
      this.pointerGridY = Math.floor(localY);
    } else {
      this.pointerGridX = -1;
      this.pointerGridY = -1;
    }

    if (event.type === 'down') {
      this.isPointerDown = true;
      if (this.params.pointerMode === 'spawn-ant' && this.pointerGridX >= 0 && this.pointerGridY >= 0) {
        this.spawnAntAt(this.pointerGridX, this.pointerGridY);
      } else {
        this.applyPointerTool();
      }
    } else if (event.type === 'up') {
      this.isPointerDown = false;
    } else if (event.type === 'leave') {
      this.isPointerDown = false;
      this.pointerGridX = -1;
      this.pointerGridY = -1;
    }
  }

  /**
   * Offline high-resolution snapshot capture hook.
   */
  public async captureSnapshot(width: number, height: number): Promise<HTMLCanvasElement> {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const snapCtx = snapCanvas.getContext('2d', { alpha: false });
    if (!snapCtx) return snapCanvas;

    snapCtx.fillStyle = '#090A0D';
    snapCtx.fillRect(0, 0, width, height);

    if (this.offscreenCanvas) {
      const W = this.gridWidth;
      const H = this.gridHeight;
      const scale = Math.min(width / W, height / H);
      const renderW = W * scale;
      const renderH = H * scale;
      const offsetX = (width - renderW) / 2;
      const offsetY = (height - renderH) / 2;

      snapCtx.imageSmoothingEnabled = false;
      snapCtx.drawImage(this.offscreenCanvas, offsetX, offsetY, renderW, renderH);

      // Draw high-resolution ant heads
      const headSize = Math.max(3.0, scale * 1.2);
      for (const ant of this.ants) {
        const hx = offsetX + (ant.x + 0.5) * scale;
        const hy = offsetY + (ant.y + 0.5) * scale;
        const angle = ant.dir * (Math.PI / 2);

        snapCtx.save();
        snapCtx.translate(hx, hy);
        snapCtx.rotate(angle - Math.PI / 2);

        snapCtx.fillStyle = ant.colorCss;
        snapCtx.beginPath();
        snapCtx.moveTo(headSize * 1.5, 0);
        snapCtx.lineTo(-headSize, -headSize * 0.9);
        snapCtx.lineTo(-headSize * 0.4, 0);
        snapCtx.lineTo(-headSize, headSize * 0.9);
        snapCtx.closePath();
        snapCtx.fill();

        snapCtx.fillStyle = '#FFFFFF';
        snapCtx.beginPath();
        snapCtx.arc(0, 0, headSize * 0.35, 0, Math.PI * 2);
        snapCtx.fill();

        snapCtx.restore();
      }
    }

    return snapCanvas;
  }

  public get antCount(): number {
    return this.ants.length;
  }

  public get totalSteps(): number {
    return this.totalSimSteps;
  }

  public get currentRule(): string {
    return this.ruleStringClean;
  }
}

export function createRoom(): RoomInstance {
  return new LangtonsAntRoom();
}

export default new LangtonsAntRoom();
